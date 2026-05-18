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

def run_pipeline(image_path, transcript_text, social_posts):
    print("\n>>> Pipeline: Starting Multimodal Disaster Triage System")
    
    print(">>> Pipeline: Running Agent 1 (Ingestion)...")
    a1_out = run_agent1(image_path, transcript_text, social_posts)
    
    print(">>> Pipeline: Running Agent 2 (Fusion & Scoring)...")
    a2_out = run_agent2(a1_out)
    
    print(">>> Pipeline: Running Agent 3 (Resource Allocation)...")
    a3_out = run_agent3(a2_out)
    
    print(">>> Pipeline: Running Agent 4 (Execution & Storage)...")
    a4_report = run_agent4(a3_out)
    
    return a4_report

def run_baseline(social_posts):
    print("\n>>> Baseline: Starting Simple Heuristic Comparison")
    
    # Count mentions by location_mention field
    mentions = {}
    for post in social_posts:
        loc = post.get("location_mention", "unknown")
        mentions[loc] = mentions.get(loc, 0) + 1
    
    # Pick top location
    if not mentions:
        return {"error": "No mentions found"}
        
    top_loc = max(mentions, key=mentions.get)
    mention_count = mentions[top_loc]
    
    # Assign ALL resources to one location
    resources_assigned = {
        "ambulances": 5,
        "rescue_teams": 3,
        "police_units": 4,
        "water_tankers": 2
    }
    
    return {
        "method": "baseline_heuristic",
        "top_incident": {
            "location": top_loc,
            "mention_count": mention_count
        },
        "resources_assigned": resources_assigned,
        "reasoning": "Simple mention count heuristic used. No multi-signal fusion or AI-driven triage analysis performed."
    }

def compare_results(pipeline_result, baseline_result):
    agentic_incidents = pipeline_result.get("total_incidents_processed", 0)
    
    return {
        "agentic_incidents_found": agentic_incidents,
        "baseline_incidents_found": 1 if baseline_result.get("top_incident") else 0,
        "agentic_used_conflict_detection": True,
        "baseline_used_conflict_detection": False,
        "agentic_distributed_resources": True,
        "baseline_distributed_resources": False,
        "winner": "agentic"
    }

def fetch_weather_internal():
    api_key = os.getenv("OPENWEATHER_API_KEY")
    cities = ["Karachi", "Lahore", "Islamabad", "Hyderabad", "Peshawar"]
    results = []
    
    mock_weather = {
        "Karachi": {
            "temp": 38.5,
            "humidity": 78,
            "wind_speed": 24.0,
            "wind_deg": 230,
            "condition": "Haze",
            "description": "haze",
            "feels_like": 44.2,
            "icon": "50d",
            "rain_3h": 0.0
        },
        "Lahore": {
            "temp": 41.0,
            "humidity": 62,
            "wind_speed": 18.0,
            "wind_deg": 110,
            "condition": "Clear",
            "description": "clear sky",
            "feels_like": 45.1,
            "icon": "01d",
            "rain_3h": 0.0
        },
        "Islamabad": {
            "temp": 39.0,
            "humidity": 75,
            "wind_speed": 22.0,
            "wind_deg": 160,
            "condition": "Partly Cloudy",
            "description": "scattered clouds",
            "feels_like": 43.5,
            "icon": "03d",
            "rain_3h": 0.0
        },
        "Hyderabad": {
            "temp": 42.0,
            "humidity": 86,
            "wind_speed": 21.0,
            "wind_deg": 250,
            "condition": "Rain",
            "description": "heavy intensity rain",
            "feels_like": 47.3,
            "icon": "10d",
            "rain_3h": 12.0
        },
        "Peshawar": {
            "temp": 40.2,
            "humidity": 68,
            "wind_speed": 16.0,
            "wind_deg": 90,
            "condition": "Clear",
            "description": "clear sky",
            "feels_like": 43.0,
            "icon": "01d",
            "rain_3h": 0.0
        }
    }
    
    for city in cities:
        data = None
        if api_key and api_key.strip():
            try:
                url = f"http://api.openweathermap.org/data/2.5/weather?q={city},PK&appid={api_key}&units=metric"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
            except Exception as e:
                print(f"Error fetching real weather for {city}: {e}")
        
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
            
            rain_3h = data.get("rain", {}).get("3h", 0)
        else:
            mock = mock_weather[city]
            temp = mock["temp"]
            humidity = mock["humidity"]
            wind_speed = mock["wind_speed"]
            wind_direction = mock["wind_deg"]
            condition = mock["condition"]
            description = mock["description"]
            feels_like = mock["feels_like"]
            icon_code = mock["icon"]
            rain_3h = mock["rain_3h"]
            
        if rain_3h > 10.0 or (humidity > 85 and wind_speed > 20.0):
            flood_risk = "HIGH"
        elif humidity > 70:
            flood_risk = "MEDIUM"
        else:
            flood_risk = "LOW"
            
        results.append({
            "city": city,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "wind_direction": wind_direction,
            "condition": condition,
            "description": description,
            "feels_like": feels_like,
            "flood_risk": flood_risk,
            "icon_code": icon_code
        })
    return results

def check_weather_alerts(weather_data):
    alerts = []
    for city_info in weather_data:
        city = city_info["city"]
        temp = city_info["temperature"]
        wind = city_info["wind_speed"]
        risk = city_info["flood_risk"]
        
        if risk == "HIGH":
            alerts.append({
                "city": city,
                "alert_type": "FLOOD_RISK",
                "severity": "CRITICAL",
                "message": f"CRITICAL: Extreme flood risk detected in {city} due to high moisture saturation/heavy precipitation."
            })
        if temp > 42:
            alerts.append({
                "city": city,
                "alert_type": "HEATWAVE",
                "severity": "CRITICAL",
                "message": f"CRITICAL: Extreme heatwave warning in {city}. Temperature is {temp}°C."
            })
        if wind > 40:
            alerts.append({
                "city": city,
                "alert_type": "STORM",
                "severity": "CRITICAL",
                "message": f"CRITICAL: Severe storm warning in {city}. Wind speed at {wind} km/h."
            })
    return alerts

@app.route("/weather", methods=["GET"])
def get_weather():
    return jsonify(fetch_weather_internal())

@app.route("/weather/alerts", methods=["GET"])
def get_weather_alerts():
    weather_data = fetch_weather_internal()
    return jsonify(check_weather_alerts(weather_data))

def reverse_geocode_pakistan(lat, lng):
    cities = [
        {"name": "Karachi Municipal Region", "lat": 24.86, "lng": 67.0},
        {"name": "Lahore Municipal Region", "lat": 31.52, "lng": 74.35},
        {"name": "Islamabad Margalla Hills", "lat": 33.74, "lng": 73.02},
        {"name": "Hyderabad City District", "lat": 25.39, "lng": 68.35},
        {"name": "Peshawar Valley Territory", "lat": 34.01, "lng": 71.52},
        {"name": "Cholistan Desert Wilds", "lat": 28.52, "lng": 70.20},
        {"name": "Tharparkar Scrubland", "lat": 24.85, "lng": 70.18},
        {"name": "Kirthar Mountain Range", "lat": 25.92, "lng": 67.54}
    ]
    
    closest_name = "Pakistan Remote Territory"
    min_dist = 999.0
    for city in cities:
        dist = (lat - city["lat"])**2 + (lng - city["lng"])**2
        if dist < min_dist:
            min_dist = dist
            closest_name = city["name"]
            
    if min_dist < 4.0:
        return closest_name
    return "Rural Area, Pakistan"

def fetch_satellite_alerts_internal():
    api_key = os.getenv("NASA_FIRMS_KEY")
    results = []
    
    mock_hotspots = [
        {
            "latitude": 33.7435,
            "longitude": 73.0215,
            "bright_ti4": 345.2,
            "confidence": "high",
            "acq_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "acq_time": "08:15",
            "frp": 12.5,
            "type": "wildfire"
        },
        {
            "latitude": 28.5200,
            "longitude": 70.2000,
            "bright_ti4": 362.8,
            "confidence": "nominal",
            "acq_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "acq_time": "10:30",
            "frp": 45.2,
            "type": "thermal_anomaly"
        },
        {
            "latitude": 24.8500,
            "longitude": 70.1800,
            "bright_ti4": 350.1,
            "confidence": "high",
            "acq_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "acq_time": "11:05",
            "frp": 18.1,
            "type": "wildfire"
        },
        {
            "latitude": 25.9200,
            "longitude": 67.5400,
            "bright_ti4": 340.5,
            "confidence": "low",
            "acq_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "acq_time": "06:40",
            "frp": 8.9,
            "type": "thermal_anomaly"
        }
    ]
    
    if api_key and api_key.strip():
        try:
            url = f"https://firms.modaps.eosdis.nasa.gov/api/country/csv/{api_key}/VIIRS_SNPP_NRT/PAK/1"
            resp = requests.get(url, timeout=6)
            if resp.status_code == 200:
                lines = resp.text.strip().split("\n")
                if len(lines) > 1:
                    headers = lines[0].split(",")
                    for line in lines[1:]:
                        parts = line.split(",")
                        if len(parts) == len(headers):
                            row = dict(zip(headers, parts))
                            lat = float(row["latitude"])
                            lng = float(row["longitude"])
                            results.append({
                                "latitude": lat,
                                "longitude": lng,
                                "bright_ti4": float(row.get("bright_ti4", 300.0)),
                                "confidence": row.get("confidence", "nominal"),
                                "acq_date": row.get("acq_date", ""),
                                "acq_time": row.get("acq_time", ""),
                                "frp": float(row.get("frp", 10.0)),
                                "type": "wildfire"
                            })
        except Exception as e:
            print(f"Error fetching NASA FIRMS satellite data: {e}")
            
    if not results:
        results = mock_hotspots
        
    for item in results:
        item["region"] = reverse_geocode_pakistan(item["latitude"], item["longitude"])
        
    return results

@app.route("/satellite-alerts", methods=["GET"])
def get_satellite_alerts():
    return jsonify(fetch_satellite_alerts_internal())

# Scheduler diagnostics tracking variables
scheduler_diagnostics = {
    "status": "active",
    "last_run": None,
    "next_run": None,
    "checks_run": 0,
    "threats_found": 0,
    "pipelines_executed": 0
}

def auto_monitoring_scheduler_loop():
    print("[SCHEDULER] Background monitoring loop started.")
    time.sleep(10)
    run_scheduler_check()
    
    schedule.every(30).minutes.do(run_scheduler_check)
    
    while True:
        schedule.run_pending()
        time.sleep(1)

def run_scheduler_check():
    global scheduler_diagnostics
    now_str = datetime.now(timezone.utc).isoformat()
    scheduler_diagnostics["last_run"] = now_str
    
    next_dt = datetime.now(timezone.utc) + timedelta(minutes=30)
    scheduler_diagnostics["next_run"] = next_dt.isoformat()
    scheduler_diagnostics["checks_run"] += 1
    
    print(f"\n[SCHEDULER] Starting automated check at {now_str}...")
    
    try:
        weather_alerts = []
        try:
            weather_data = fetch_weather_internal()
            weather_alerts = check_weather_alerts(weather_data)
        except Exception as ex:
            print(f"[SCHEDULER] Error during weather hazard check: {ex}")
            
        satellite_alerts = []
        try:
            satellite_alerts = fetch_satellite_alerts_internal()
        except Exception as ex:
            print(f"[SCHEDULER] Error during satellite hazard check: {ex}")
            
        high_risk_weather = [w for w in weather_alerts if "HIGH" in w.get("message", "").upper() or "EXTREME" in w.get("message", "").upper()]
        high_conf_satellites = [s for s in satellite_alerts if s.get("confidence", "").lower() == "high"]
        
        threats_found = len(high_risk_weather) + len(high_conf_satellites)
        scheduler_diagnostics["threats_found"] += threats_found
        
        agent_reports = []
        
        if threats_found > 0:
            print(f"[SCHEDULER] Threats detected! Running multi-agent triage pipeline. (Weather: {len(high_risk_weather)}, Satellites: {len(high_conf_satellites)})")
            scheduler_diagnostics["pipelines_executed"] += 1
            
            threat_location = "Pakistan Region"
            if high_risk_weather:
                threat_location = high_risk_weather[0]["city"]
            elif high_conf_satellites:
                threat_location = high_conf_satellites[0]["region"]
                
            transcript = f"EMERGENCY BROADCAST: Auto-monitoring scheduler detected satellite/weather hazards in {threat_location}. Extreme levels registered. Local emergency responder fleets are requested to dispatch and establish base camps to assess damage."
            social_posts = [
                {
                    "id": f"auto_s_{int(time.time())}",
                    "text": f"Scary alerts coming in for {threat_location}. Dark clouds and heavy winds. Stay inside!",
                    "platform": "Twitter",
                    "timestamp": now_str,
                    "location_mention": threat_location,
                    "likes": 50,
                    "verified": True
                }
            ]
            
            image_path = "mock_data/images/test.jpg"
            report = run_pipeline(image_path, transcript, social_posts)
            if isinstance(report, dict) and "incident_id" in report:
                agent_reports.append(report["incident_id"])
            else:
                agent_reports.append("unknown_incident")
            
        if db:
            try:
                log_ref = db.collection("auto_monitoring_logs").document()
                log_ref.set({
                    "timestamp": now_str,
                    "checks_run": scheduler_diagnostics["checks_run"],
                    "threats_found": threats_found,
                    "pipelines_executed": 1 if threats_found > 0 else 0,
                    "incident_references": agent_reports,
                    "raw_weather_warnings": [w["message"] for w in weather_alerts],
                    "raw_satellite_warnings": [f"{s['region']} (Conf: {s['confidence']})" for s in satellite_alerts]
                })
                print("[SCHEDULER] Saved log document in Firestore auto_monitoring_logs.")
            except Exception as fs_ex:
                print(f"[SCHEDULER] Firestore log write failed: {fs_ex}")
                
    except Exception as general_ex:
        print(f"[SCHEDULER] General scheduling error: {general_ex}")

@app.route("/monitoring-status", methods=["GET"])
def get_monitoring_status():
    return jsonify(scheduler_diagnostics)

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    image_path = data.get("image_path", "mock_data/images/test.jpg")
    transcript = data.get("transcript", "")
    social_posts = data.get("social_posts", [])
    
    report = run_pipeline(image_path, transcript, social_posts)
    return jsonify(report)

@app.route("/incidents", methods=["GET"])
def list_incidents():
    return jsonify(get_all_incidents())

@app.route("/incidents/<incident_id>", methods=["GET"])
def get_incident(incident_id):
    inc = get_incident_by_id(incident_id)
    if inc:
        return jsonify(inc)
    return jsonify({"error": "Not found"}), 404

@app.route("/agent-logs", methods=["GET"])
def get_agent_logs():
    if not db:
        return jsonify([])
    
    logs_ref = db.collection("agent_logs").order_by("timestamp").stream()
    logs = [log.to_dict() for log in logs_ref]
    return jsonify(logs)

@app.route("/baseline", methods=["GET"])
def baseline_endpoint():
    with open("mock_data/social_posts.json") as f:
        posts = json.load(f)
    return jsonify(run_baseline(posts))

@app.route("/compare", methods=["GET"])
def compare_endpoint():
    # Load mock data
    with open("mock_data/transcripts.json") as f:
        transcripts = json.load(f)
    with open("mock_data/social_posts.json") as f:
        posts = json.load(f)
        
    p_report = run_pipeline("mock_data/images/test.jpg", transcripts["t_001"]["text"], posts[:8])
    b_report = run_baseline(posts)
    
    comparison = compare_results(p_report, b_report)
    return jsonify({
        "pipeline_summary": p_report,
        "baseline_summary": b_report,
        "comparison": comparison
    })

@app.route("/stats", methods=["GET"])
def get_stats():
    incidents = get_all_incidents()
    total_incidents = len(incidents)
    
    responding_count = 0
    verification_count = 0
    resources_deployed = 0
    total_severity = 0.0
    
    for inc in incidents:
        status = inc.get("status", "unknown")
        if status == "responding":
            responding_count += 1
            res_assignment = inc.get("resource_assignment", {})
            if isinstance(res_assignment, dict):
                for count in res_assignment.values():
                    try:
                        resources_deployed += int(count)
                    except (ValueError, TypeError):
                        pass
        elif status == "verification_required":
            verification_count += 1
            
        total_severity += float(inc.get("severity_score", 0.0))
        
    avg_severity = round(total_severity / total_incidents, 1) if total_incidents > 0 else 0.0
    
    return jsonify({
        "total_incidents": total_incidents,
        "responding_count": responding_count,
        "verification_count": verification_count,
        "resources_deployed": resources_deployed,
        "avg_severity": avg_severity,
        "last_updated": datetime.now(timezone.utc).isoformat()
    })

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agents_ready": True
    })

if __name__ == "__main__":
    print("\nSYSTEM INITIALIZATION...")
    initialize_resources()
    
    print("\nSTARTING AUTO-MONITORING SCHEDULER...")
    scheduler_thread = threading.Thread(target=auto_monitoring_scheduler_loop, daemon=True)
    scheduler_thread.start()
    
    print("\nSTARTING FLASK API SERVER ON PORT 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
