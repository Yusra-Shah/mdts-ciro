import os
import json
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
