import os
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.vision_tool import analyze_image
from tools.gemini_tool import classify_transcript, analyze_social_posts

AGENT_NAME = "Agent1_SignalIngestion"

def run_agent1(image_path, transcript_text, social_posts_list):
    print(f"\n{'='*50}")
    print(f"AGENT 1 — SIGNAL INGESTION STARTING")
    print(f"{'='*50}")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    signals = []

    # STREAM 1: Satellite/Drone Image
    print("Agent 1: Processing satellite image...")
    try:
        vision_result = analyze_image(image_path)
    except Exception as e:
        print(f"Agent 1: Image processing failed — {e}")
        vision_result = {
            "damage_score": 0.0,
            "detected_labels": [],
            "crisis_type": "unknown",
            "confidence": 0.0,
            "raw_response": {}
        }

    signals.append({
        "signal_id": f"sig_satellite_{timestamp}",
        "source": "satellite",
        "type": "visual",
        "location": "unknown",
        "severity_hint": vision_result.get("damage_score", 0.0),
        "confidence": vision_result.get("confidence", 0.0),
        "credibility": 0.85,
        "crisis_type_hint": vision_result.get("crisis_type", "unknown"),
        "raw_data": vision_result,
        "timestamp": timestamp
    })
    print(f"Agent 1: Satellite signal — crisis={vision_result.get('crisis_type')} severity={vision_result.get('damage_score')}")

    # STREAM 2: Emergency Call Transcript
    print("Agent 1: Analyzing emergency transcript...")
    try:
        transcript_result = classify_transcript(transcript_text)
    except Exception as e:
        print(f"Agent 1: Transcript analysis failed — {e}")
        transcript_result = {
            "urgency_level": 1,
            "location_text": "unknown",
            "distress_class": "other",
            "caller_confidence": 0.0,
            "summary": "Analysis failed"
        }

    signals.append({
        "signal_id": f"sig_call_{timestamp}",
        "source": "emergency_call",
        "type": "voice",
        "location": transcript_result.get("location_text", "unknown"),
        "severity_hint": float(transcript_result.get("urgency_level", 1)) * 2.0,
        "confidence": transcript_result.get("caller_confidence", 0.5),
        "credibility": 0.90,
        "crisis_type_hint": transcript_result.get("distress_class", "other"),
        "raw_data": transcript_result,
        "timestamp": timestamp
    })
    print(f"Agent 1: Call signal — location={transcript_result.get('location_text')} urgency={transcript_result.get('urgency_level')}")

    # STREAM 3: Social Media Posts
    print("Agent 1: Processing social media posts...")
    try:
        social_result = analyze_social_posts(social_posts_list)
    except Exception as e:
        print(f"Agent 1: Social media analysis failed — {e}")
        social_result = {
            "dominant_location": "unknown",
            "mention_velocity": 0.0,
            "urgency_score": 0.0,
            "credibility_score": 0.0,
            "conflict_detected": False,
            "conflict_description": None,
            "key_themes": [],
            "sample_posts": []
        }

    signals.append({
        "signal_id": f"sig_social_{timestamp}",
        "source": "social_media",
        "type": "text",
        "location": social_result.get("dominant_location", "unknown"),
        "severity_hint": social_result.get("urgency_score", 0.0),
        "confidence": social_result.get("credibility_score", 0.0),
        "credibility": social_result.get("credibility_score", 0.5),
        "crisis_type_hint": social_result.get("key_themes", ["unknown"])[0] if social_result.get("key_themes") else "unknown",
        "raw_data": social_result,
        "timestamp": timestamp
    })
    print(f"Agent 1: Social signal — location={social_result.get('dominant_location')} urgency={social_result.get('urgency_score')}")

    # STREAM 4: Weather/Environmental Signals
    print("Agent 1: Ingesting weather environmental signals...")
    weather_data = []
    try:
        resp = requests.get("http://127.0.0.1:5000/weather", timeout=3)
        if resp.status_code == 200:
            weather_data = resp.json()
    except Exception as e:
        print(f"Agent 1: Internal GET /weather failed — {e}. Falling back to internal generator.")
        mock_weather = {
            "Karachi": {"temp": 38.5, "humidity": 78, "wind_speed": 24.0, "flood_risk": "MEDIUM", "condition": "Haze"},
            "Lahore": {"temp": 41.0, "humidity": 62, "wind_speed": 18.0, "flood_risk": "LOW", "condition": "Clear"},
            "Islamabad": {"temp": 39.0, "humidity": 75, "wind_speed": 22.0, "flood_risk": "MEDIUM", "condition": "Partly Cloudy"},
            "Hyderabad": {"temp": 42.0, "humidity": 86, "wind_speed": 21.0, "flood_risk": "HIGH", "condition": "Rain"},
            "Peshawar": {"temp": 40.2, "humidity": 68, "wind_speed": 16.0, "flood_risk": "LOW", "condition": "Clear"}
        }
        weather_data = []
        for city, mock in mock_weather.items():
            weather_data.append({
                "city": city,
                "temperature": mock["temp"],
                "humidity": mock["humidity"],
                "wind_speed": mock["wind_speed"],
                "wind_direction": 200,
                "condition": mock["condition"],
                "description": "clear sky" if mock["condition"] == "Clear" else mock["condition"].lower(),
                "feels_like": mock["temp"],
                "flood_risk": mock["flood_risk"],
                "icon_code": "01d"
            })
            
    for city_info in weather_data:
        risk = city_info.get("flood_risk", "LOW")
        if risk in ["HIGH", "MEDIUM"]:
            sev_hint = 8.0 if risk == "HIGH" else 5.0
            crisis_type = "flood" if (city_info.get("condition") == "Rain" or risk == "HIGH") else "heatwave"
            
            signals.append({
                "signal_id": f"sig_weather_{city_info['city'].lower()}_{timestamp}",
                "source": "weather_api",
                "type": "environmental",
                "location": city_info["city"],
                "severity_hint": sev_hint,
                "confidence": 0.95,
                "credibility": 0.95,
                "crisis_type_hint": crisis_type,
                "raw_data": city_info,
                "timestamp": timestamp
            })
            print(f"Agent 1: Weather signal added — city={city_info['city']} risk={risk} severity={sev_hint} type={crisis_type}")

    print(f"\nAgent 1 COMPLETE — {len(signals)} signals processed")
    print(f"{'='*50}\n")

    return {
        "agent_name": AGENT_NAME,
        "processing_timestamp": timestamp,
        "total_signals": len(signals),
        "signals": signals
    }

if __name__ == "__main__":
    import json
    
    with open("mock_data/social_posts.json") as f:
        all_posts = json.load(f)
    
    result = run_agent1(
        image_path="mock_data/images/test.jpg",
        transcript_text="Water has entered our house in Gulshan-e-Iqbal. Family trapped on roof. Send rescue boat please.",
        social_posts_list=all_posts[:8]
    )
    
    print(json.dumps(result, indent=2))
