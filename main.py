import os
import json
import requests
import schedule
import threading
import time
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

load_dotenv()

from agents.agent1_ingestion import run_agent1
from agents.agent2_fusion import run_agent2
from agents.agent3_allocation import run_agent3
from agents.agent4_execution import run_agent4
from tools.firestore_tool import get_all_incidents, get_incident_by_id, initialize_resources, db

app = Flask(__name__,
    static_folder='frontend/static',
    static_url_path='/static',
    template_folder='frontend')
CORS(app)

# ── PAKISTAN CITY RESOURCE DATABASE ──────────────────────────────
# Based on NDMA, Rescue 1122, Edhi Foundation data
PAKISTAN_CITY_RESOURCES = {
    "Karachi": {
        "population": 16000000,
        "hospitals": 47,
        "rescue_stations": 12,
        "ambulances": 85,
        "fire_stations": 28,
        "police_stations": 94,
        "primary_hospital": "Aga Khan University Hospital",
        "secondary_hospital": "Jinnah Postgraduate Medical Centre",
        "ndma_office": "Karachi PDMA Office, Sindh Secretariat",
        "flood_zones": ["Gulshan-e-Iqbal", "Orangi Town", "Landhi", "Korangi", "Lyari"],
        "earthquake_risk": "moderate",
        "annual_flood_risk": "high"
    },
    "Lahore": {
        "population": 13000000,
        "hospitals": 38,
        "rescue_stations": 18,
        "ambulances": 120,
        "fire_stations": 22,
        "police_stations": 86,
        "primary_hospital": "Services Hospital Lahore",
        "secondary_hospital": "Mayo Hospital",
        "ndma_office": "Punjab PDMA Office, Civil Secretariat",
        "flood_zones": ["Ravi River banks", "Model Town", "Shahdara"],
        "earthquake_risk": "low",
        "annual_flood_risk": "medium"
    },
    "Islamabad": {
        "population": 1200000,
        "hospitals": 14,
        "rescue_stations": 8,
        "ambulances": 45,
        "fire_stations": 9,
        "police_stations": 32,
        "primary_hospital": "Pakistan Institute of Medical Sciences",
        "secondary_hospital": "Polyclinic Hospital",
        "ndma_office": "NDMA Headquarters, Islamabad",
        "flood_zones": ["Nullah Lai corridor", "G-10", "G-11", "Saidpur"],
        "earthquake_risk": "high",
        "annual_flood_risk": "medium"
    },
    "Hyderabad": {
        "population": 1800000,
        "hospitals": 12,
        "rescue_stations": 6,
        "ambulances": 38,
        "fire_stations": 7,
        "police_stations": 28,
        "primary_hospital": "Liaquat University Hospital",
        "secondary_hospital": "Civil Hospital Hyderabad",
        "ndma_office": "Sindh PDMA Sub-Office Hyderabad",
        "flood_zones": ["Latifabad", "Qasimabad", "Indus riverbank"],
        "earthquake_risk": "low",
        "annual_flood_risk": "very high"
    },
    "Peshawar": {
        "population": 2100000,
        "hospitals": 16,
        "rescue_stations": 9,
        "ambulances": 52,
        "fire_stations": 11,
        "police_stations": 41,
        "primary_hospital": "Lady Reading Hospital",
        "secondary_hospital": "Hayatabad Medical Complex",
        "ndma_office": "KPK PDMA Office, Peshawar",
        "flood_zones": ["Kabul River banks", "Charsadda Road", "Nowshera area"],
        "earthquake_risk": "very high",
        "annual_flood_risk": "high"
    }
}

# ── PAKISTAN HISTORICAL DISASTER PATTERNS ─────────────────────────
HISTORICAL_PATTERNS = [
    {
        "year": 2010,
        "type": "flood",
        "affected_provinces": ["KPK", "Punjab", "Sindh", "Balochistan"],
        "casualties": 2000,
        "displaced": 21000000,
        "trigger": "monsoon + La Nina",
        "peak_months": [7, 8, 9],
        "warning_signs": ["rainfall above 200mm/month", "Indus flow above 500000 cusecs", "La Nina conditions"]
    },
    {
        "year": 2022,
        "type": "flood",
        "affected_provinces": ["Sindh", "Balochistan", "KPK"],
        "casualties": 1739,
        "displaced": 33000000,
        "trigger": "extreme monsoon + climate change",
        "peak_months": [8, 9],
        "warning_signs": ["300% above normal rainfall", "glacial lake outburst", "pre-monsoon heatwave"]
    },
    {
        "year": 2005,
        "type": "earthquake",
        "affected_provinces": ["AJK", "KPK"],
        "casualties": 87351,
        "displaced": 3500000,
        "trigger": "Eurasian-Indian plate collision",
        "magnitude": 7.6,
        "warning_signs": ["foreshocks", "animal behavior changes", "radon gas increase"]
    }
]

def get_historical_context(crisis_type, location):
    relevant = [p for p in HISTORICAL_PATTERNS if p["type"] == crisis_type]
    if not relevant:
        return None
    return {
        "similar_events": len(relevant),
        "most_severe": max(relevant, key=lambda x: x.get("casualties", 0)),
        "context": f"Pakistan has experienced {len(relevant)} major {crisis_type} events since 2000"
    }

# ── PIPELINE ──────────────────────────────────────────────────────
def run_pipeline(image_path, transcript_text, social_posts):
    print("\n>>> Pipeline: Starting MDTS Multimodal Disaster Triage")
    a1 = run_agent1(image_path, transcript_text, social_posts)
    a2 = run_agent2(a1)
    a3 = run_agent3(a2)
    a4 = run_agent4(a3)
    return a4

def run_baseline(social_posts):
    mentions = {}
    for post in social_posts:
        loc = post.get("location_mention", "unknown")
        mentions[loc] = mentions.get(loc, 0) + 1
    if not mentions:
        return {"error": "No mentions found"}
    top_loc = max(mentions, key=mentions.get)
    return {
        "method": "baseline_heuristic",
        "top_incident": {"location": top_loc, "mention_count": mentions[top_loc]},
        "resources_assigned": {"ambulances": 5, "rescue_teams": 3, "police_units": 4, "water_tankers": 2},
        "reasoning": "Simple mention count only. No multi-signal fusion or AI analysis."
    }

# ── WEATHER ───────────────────────────────────────────────────────
def fetch_weather_internal():
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    cities = ["Karachi", "Lahore", "Islamabad", "Hyderabad", "Peshawar"]
    results = []

    for city in cities:
        data = None
        if api_key:
            try:
                url = f"http://api.openweathermap.org/data/2.5/weather?q={city},PK&appid={api_key}&units=metric"
                resp = requests.get(url, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"Weather: Real data fetched for {city}")
            except Exception as e:
                print(f"Weather API error for {city}: {e}")

        if data:
            temp = data.get("main", {}).get("temp", 35.0)
            humidity = data.get("main", {}).get("humidity", 60)
            wind_ms = data.get("wind", {}).get("speed", 0)
            wind_speed = round(wind_ms * 3.6, 1)
            wind_direction = data.get("wind", {}).get("deg", 0)
            weather_list = data.get("weather", [])
            condition = weather_list[0].get("main", "Clear") if weather_list else "Clear"
            description = weather_list[0].get("description", "clear sky") if weather_list else "clear sky"
            feels_like = data.get("main", {}).get("feels_like", temp)
            icon_code = weather_list[0].get("icon", "01d") if weather_list else "01d"
            rain_3h = data.get("rain", {}).get("3h", 0.0)
            pressure = data.get("main", {}).get("pressure", 1013)
            visibility = data.get("visibility", 10000)
        else:
            # Realistic fallback based on Pakistan May climate
            defaults = {
                "Karachi": {"temp":38.5,"humidity":72,"wind":22,"condition":"Haze","rain":0,"pressure":1010,"icon":"50d"},
                "Lahore": {"temp":42.0,"humidity":55,"wind":15,"condition":"Clear","rain":0,"pressure":1005,"icon":"01d"},
                "Islamabad": {"temp":36.0,"humidity":65,"wind":18,"condition":"Clouds","rain":2,"pressure":1008,"icon":"03d"},
                "Hyderabad": {"temp":41.0,"humidity":70,"wind":20,"condition":"Clear","rain":0,"pressure":1007,"icon":"01d"},
                "Peshawar": {"temp":39.0,"humidity":58,"wind":16,"condition":"Clear","rain":0,"pressure":1006,"icon":"01d"},
            }
            d = defaults.get(city, {"temp":38,"humidity":65,"wind":18,"condition":"Clear","rain":0,"pressure":1008,"icon":"01d"})
            temp = d["temp"]; humidity = d["humidity"]; wind_speed = float(d["wind"])
            condition = d["condition"]; description = condition.lower()
            feels_like = temp + 3; icon_code = d["icon"]; rain_3h = d["rain"]
            wind_direction = 200; pressure = d["pressure"]; visibility = 8000

        # Smart flood risk — requires MULTIPLE factors together
        flood_risk = "LOW"
        risk_score = 0
        if rain_3h > 15: risk_score += 3
        elif rain_3h > 8: risk_score += 2
        elif rain_3h > 3: risk_score += 1
        if humidity > 88: risk_score += 2
        elif humidity > 80: risk_score += 1
        if wind_speed > 35: risk_score += 2
        elif wind_speed > 25: risk_score += 1
        if condition in ["Rain", "Thunderstorm", "Drizzle"]: risk_score += 2
        if pressure < 1005: risk_score += 1

        if risk_score >= 6:
            flood_risk = "HIGH"
        elif risk_score >= 3:
            flood_risk = "MEDIUM"

        city_db = PAKISTAN_CITY_RESOURCES.get(city, {})
        results.append({
            "city": city,
            "temperature": round(temp, 1),
            "humidity": humidity,
            "wind_speed": wind_speed,
            "wind_direction": wind_direction,
            "condition": condition,
            "description": description,
            "feels_like": round(feels_like, 1),
            "flood_risk": flood_risk,
            "risk_score": risk_score,
            "icon_code": icon_code,
            "rain_3h": rain_3h,
            "pressure": pressure,
            "visibility": visibility,
            "city_resources": {
                "hospitals": city_db.get("hospitals", 10),
                "ambulances": city_db.get("ambulances", 30),
                "rescue_stations": city_db.get("rescue_stations", 5),
                "primary_hospital": city_db.get("primary_hospital", "City Hospital"),
                "flood_zones": city_db.get("flood_zones", []),
                "earthquake_risk": city_db.get("earthquake_risk", "low")
            }
        })
    return results

def check_weather_alerts(weather_data):
    alerts = []
    for c in weather_data:
        # Only alert on genuinely critical conditions — multiple factors
        if c["flood_risk"] == "HIGH" and c["risk_score"] >= 6:
            alerts.append({
                "city": c["city"],
                "alert_type": "FLOOD_RISK",
                "severity": "CRITICAL",
                "message": f"{c['city']}: Flood risk critical — rainfall {c['rain_3h']}mm, humidity {c['humidity']}%, wind {c['wind_speed']}kmh. Risk score {c['risk_score']}/10."
            })
        if c["temperature"] > 44:
            alerts.append({
                "city": c["city"],
                "alert_type": "EXTREME_HEATWAVE",
                "severity": "CRITICAL",
                "message": f"{c['city']}: Extreme heat {c['temperature']}C — life-threatening conditions. Mass casualty risk."
            })
        if c["wind_speed"] > 50:
            alerts.append({
                "city": c["city"],
                "alert_type": "CYCLONE_WARNING",
                "severity": "CRITICAL",
                "message": f"{c['city']}: Cyclonic wind {c['wind_speed']}kmh — structural damage risk. Evacuate coastal areas."
            })
    return alerts

@app.route("/weather")
def get_weather():
    return jsonify(fetch_weather_internal())

@app.route("/weather/alerts")
def get_weather_alerts():
    return jsonify(check_weather_alerts(fetch_weather_internal()))

# ── EARTHQUAKE DATA (USGS Real-Time) ─────────────────────────────
def fetch_earthquake_data():
    try:
        # Pakistan bounding box: 23-37N, 60-77E
        url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=23&maxlatitude=37&minlongitude=60&maxlongitude=77&minmagnitude=2.0&limit=20&orderby=time"
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            quakes = []
            for feat in data.get("features", []):
                props = feat.get("properties", {})
                coords = feat.get("geometry", {}).get("coordinates", [0, 0, 0])
                mag = props.get("mag", 0)
                quakes.append({
                    "magnitude": mag,
                    "place": props.get("place", "Pakistan Region"),
                    "time": datetime.fromtimestamp(props.get("time", 0)/1000, tz=timezone.utc).isoformat(),
                    "latitude": coords[1],
                    "longitude": coords[0],
                    "depth_km": coords[2],
                    "severity": "critical" if mag >= 6.0 else "moderate" if mag >= 4.5 else "minor",
                    "alert": props.get("alert", None),
                    "tsunami": props.get("tsunami", 0) == 1,
                    "felt": props.get("felt", 0),
                    "url": props.get("url", "")
                })
            print(f"USGS: Fetched {len(quakes)} real earthquakes near Pakistan")
            return quakes
    except Exception as e:
        print(f"USGS earthquake fetch error: {e}")
    return []

@app.route("/earthquakes")
def get_earthquakes():
    return jsonify(fetch_earthquake_data())

# ── NASA FIRMS SATELLITE ──────────────────────────────────────────
def reverse_geocode_pakistan(lat, lng):
    regions = [
        {"name":"Karachi Region",       "lat":24.86, "lng":67.00},
        {"name":"Lahore Region",        "lat":31.52, "lng":74.35},
        {"name":"Islamabad Region",     "lat":33.74, "lng":73.02},
        {"name":"Hyderabad Region",     "lat":25.39, "lng":68.35},
        {"name":"Peshawar Region",      "lat":34.01, "lng":71.52},
        {"name":"Quetta Region",        "lat":30.18, "lng":66.99},
        {"name":"Multan Region",        "lat":30.19, "lng":71.47},
        {"name":"Faisalabad Region",    "lat":31.41, "lng":73.07},
        {"name":"Cholistan Desert",     "lat":28.52, "lng":70.20},
        {"name":"Tharparkar",           "lat":24.85, "lng":70.18},
        {"name":"Kirthar Range",        "lat":25.92, "lng":67.54},
        {"name":"Swat Valley",          "lat":35.22, "lng":72.36},
        {"name":"Gilgit-Baltistan",     "lat":35.80, "lng":74.47},
    ]
    closest = "Pakistan Remote Area"
    min_d = 999
    for r in regions:
        d = (lat - r["lat"])**2 + (lng - r["lng"])**2
        if d < min_d:
            min_d = d
            closest = r["name"]
    return closest

def fetch_satellite_alerts_internal():
    api_key = os.getenv("NASA_FIRMS_KEY", "").strip()
    results = []

    if api_key:
        try:
            # Pakistan bounding box
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/VIIRS_SNPP_NRT/60,23,77,37/1"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                lines = resp.text.strip().split("\n")
                if len(lines) > 1:
                    headers = [h.strip() for h in lines[0].split(",")]
                    for line in lines[1:]:
                        parts = line.split(",")
                        if len(parts) >= len(headers):
                            row = dict(zip(headers, parts))
                            try:
                                lat = float(row.get("latitude", 0))
                                lng = float(row.get("longitude", 0))
                                bright = float(row.get("bright_ti4", 300))
                                frp = float(row.get("frp", 0))
                                conf = row.get("confidence", "nominal").strip()
                                results.append({
                                    "latitude": lat,
                                    "longitude": lng,
                                    "bright_ti4": bright,
                                    "confidence": conf,
                                    "acq_date": row.get("acq_date", "").strip(),
                                    "acq_time": row.get("acq_time", "").strip(),
                                    "frp": frp,
                                    "type": "wildfire" if bright > 350 else "thermal_anomaly",
                                    "region": reverse_geocode_pakistan(lat, lng),
                                    "data_source": "NASA FIRMS VIIRS Real-Time"
                                })
                            except:
                                pass
                    print(f"NASA FIRMS: Fetched {len(results)} real satellite hotspots over Pakistan")
        except Exception as e:
            print(f"NASA FIRMS error: {e}")

    # Only use fallback if no real data
    if not results:
        print("NASA FIRMS: No key or no data — using representative placeholders")
        results = [
            {"latitude":33.74,"longitude":73.02,"bright_ti4":310.2,"confidence":"nominal","acq_date":datetime.now(timezone.utc).strftime("%Y-%m-%d"),"acq_time":"08:15","frp":8.5,"type":"thermal_anomaly","region":"Islamabad Region","data_source":"Placeholder — Add NASA_FIRMS_KEY for real data"},
            {"latitude":28.52,"longitude":70.20,"bright_ti4":358.8,"confidence":"high","acq_date":datetime.now(timezone.utc).strftime("%Y-%m-%d"),"acq_time":"10:30","frp":42.1,"type":"wildfire","region":"Cholistan Desert","data_source":"Placeholder — Add NASA_FIRMS_KEY for real data"},
        ]
    return results

@app.route("/satellite-alerts")
def get_satellite_alerts():
    return jsonify(fetch_satellite_alerts_internal())

# ── PAKISTAN CITY RESOURCES ───────────────────────────────────────
@app.route("/city-resources")
def get_city_resources():
    return jsonify(PAKISTAN_CITY_RESOURCES)

@app.route("/city-resources/<city>")
def get_city_resource(city):
    data = PAKISTAN_CITY_RESOURCES.get(city.title(), {})
    if not data:
        return jsonify({"error": "City not found"}), 404
    return jsonify(data)

# ── HISTORICAL CONTEXT ────────────────────────────────────────────
@app.route("/historical/<crisis_type>")
def get_historical(crisis_type):
    context = get_historical_context(crisis_type, "Pakistan")
    return jsonify(context or {"message": "No historical data for this crisis type"})

# ── COMBINED THREAT ASSESSMENT ────────────────────────────────────
@app.route("/threat-assessment")
def get_threat_assessment():
    weather = fetch_weather_internal()
    earthquakes = fetch_earthquake_data()
    satellite = fetch_satellite_alerts_internal()
    alerts = check_weather_alerts(weather)

    critical_quakes = [q for q in earthquakes if q["magnitude"] >= 5.0]
    high_sat = [s for s in satellite if s["confidence"] == "high" and s["frp"] > 30]

    overall_threat = "LOW"
    threat_score = 0
    if alerts: threat_score += len(alerts) * 2
    if critical_quakes: threat_score += len(critical_quakes) * 3
    if high_sat: threat_score += len(high_sat) * 2

    if threat_score >= 8: overall_threat = "CRITICAL"
    elif threat_score >= 4: overall_threat = "HIGH"
    elif threat_score >= 2: overall_threat = "MEDIUM"

    return jsonify({
        "overall_threat_level": overall_threat,
        "threat_score": threat_score,
        "active_weather_alerts": len(alerts),
        "significant_earthquakes_24h": len(critical_quakes),
        "high_confidence_satellite_hotspots": len(high_sat),
        "weather_alerts": alerts,
        "recent_earthquakes": earthquakes[:5],
        "satellite_hotspots": satellite[:5],
        "assessed_at": datetime.now(timezone.utc).isoformat()
    })

# ── SCHEDULER ─────────────────────────────────────────────────────
scheduler_diagnostics = {
    "status": "active",
    "last_run": None,
    "next_run": None,
    "checks_run": 0,
    "threats_found": 0,
    "pipelines_executed": 0
}

def run_scheduler_check():
    global scheduler_diagnostics
    now_str = datetime.now(timezone.utc).isoformat()
    scheduler_diagnostics["last_run"] = now_str
    scheduler_diagnostics["next_run"] = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    scheduler_diagnostics["checks_run"] += 1
    print(f"\n[SCHEDULER] Automated check at {now_str}")

    try:
        weather_data = fetch_weather_internal()
        weather_alerts = check_weather_alerts(weather_data)
        earthquakes = fetch_earthquake_data()
        satellite = fetch_satellite_alerts_internal()

        critical_quakes = [q for q in earthquakes if q["magnitude"] >= 5.5]
        high_sat = [s for s in satellite if s["confidence"] == "high" and s["frp"] > 40]
        critical_weather = [w for w in weather_alerts if w["severity"] == "CRITICAL"]

        threats = len(critical_weather) + len(critical_quakes) + len(high_sat)
        scheduler_diagnostics["threats_found"] += threats

        if threats > 0:
            print(f"[SCHEDULER] {threats} threats — triggering pipeline")
            scheduler_diagnostics["pipelines_executed"] += 1
            location = "Pakistan"
            if critical_weather: location = critical_weather[0]["city"]
            elif critical_quakes: location = critical_quakes[0]["place"]

            transcript = f"AUTOMATED ALERT: Multi-signal threat detected in {location}. Weather alerts: {len(critical_weather)}. Seismic events: {len(critical_quakes)}. Satellite anomalies: {len(high_sat)}. Requesting emergency assessment."
            run_pipeline("mock_data/images/test.jpg", transcript, [])

        if db:
            try:
                db.collection("auto_monitoring_logs").document().set({
                    "timestamp": now_str,
                    "threats_found": threats,
                    "weather_alerts": len(critical_weather),
                    "earthquake_alerts": len(critical_quakes),
                    "satellite_alerts": len(high_sat),
                    "pipeline_triggered": threats > 0
                })
            except Exception as e:
                print(f"[SCHEDULER] Firestore log failed: {e}")
    except Exception as e:
        print(f"[SCHEDULER] Error: {e}")

def scheduler_loop():
    print("[SCHEDULER] Background monitoring active — checks every 30 minutes")
    time.sleep(15)
    run_scheduler_check()
    schedule.every(30).minutes.do(run_scheduler_check)
    while True:
        schedule.run_pending()
        time.sleep(1)

@app.route("/monitoring-status")
def get_monitoring_status():
    return jsonify(scheduler_diagnostics)

# ── CORE ROUTES ───────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    report = run_pipeline(
        data.get("image_path", "mock_data/images/test.jpg"),
        data.get("transcript", ""),
        data.get("social_posts", [])
    )
    return jsonify(report)

@app.route("/incidents")
def list_incidents():
    return jsonify(get_all_incidents())

@app.route("/incidents/<incident_id>")
def get_incident(incident_id):
    inc = get_incident_by_id(incident_id)
    return jsonify(inc) if inc else (jsonify({"error": "Not found"}), 404)

@app.route("/agent-logs")
def get_agent_logs():
    if not db:
        return jsonify([])
    try:
        logs = [l.to_dict() for l in db.collection("agent_logs").order_by("timestamp").stream()]
        return jsonify(logs)
    except:
        return jsonify([])

@app.route("/stats")
def get_stats():
    incidents = get_all_incidents()
    total = len(incidents)
    responding = sum(1 for i in incidents if i.get("status") == "responding")
    verification = sum(1 for i in incidents if i.get("status") == "verification_required")
    deployed = 0
    total_sev = 0.0
    for inc in incidents:
        if inc.get("status") == "responding":
            for v in (inc.get("resource_assignment") or {}).values():
                try: deployed += int(v)
                except: pass
        total_sev += float(inc.get("severity_score", 0))
    return jsonify({
        "total_incidents": total,
        "responding_count": responding,
        "verification_count": verification,
        "resources_deployed": deployed,
        "avg_severity": round(total_sev / total, 1) if total else 0.0,
        "last_updated": datetime.now(timezone.utc).isoformat()
    })

@app.route("/baseline")
def baseline_endpoint():
    return jsonify(run_baseline([]))

@app.route("/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "agents_ready": True})

if __name__ == "__main__":
    print("\nMDTS CIRO — System Initialization")
    initialize_resources()
    print("\nStarting auto-monitoring scheduler...")
    threading.Thread(target=scheduler_loop, daemon=True).start()
    print("\nStarting Flask API on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)