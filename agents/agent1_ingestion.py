import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.vision_tool import analyze_image
from tools.gemini_tool import classify_transcript, analyze_social_posts

try:
    from google_adk import Agent
except ImportError:
    class Agent:
        def __init__(self, name, system_prompt):
            self.name = name
            self.system_prompt = system_prompt

def run_agent1(image_path, transcript_text, social_posts_list):
    """
    Agent 1 function that orchestrates the ingestion and normalization of signals.
    """
    system_prompt = "You are Agent 1 \u2014 the Signal Ingestion Agent for MDTS, Pakistan's Multimodal Disaster Triage System. Your role is to receive three input streams simultaneously \u2014 satellite or drone imagery, emergency call transcripts, and social media posts \u2014 and normalize them into unified signal objects for downstream processing. You must call the appropriate tool for each stream, handle failures gracefully, and always return a structured list of normalized signals. Be precise, never hallucinate locations or details not present in the inputs."
    
    agent = Agent(name="Agent1_Ingestion", system_prompt=system_prompt)
    
    signals = []
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    print("Agent1: Processing satellite/drone imagery...")
    try:
        vision_result = analyze_image(image_path)
        location = "unknown" 
        
        signal = {
            "signal_id": f"sig_vis_{len(signals)+1}",
            "source": "satellite",
            "type": "visual",
            "location": location,
            "severity_hint": vision_result.get("damage_score", 0.0),
            "confidence": vision_result.get("confidence", 0.0),
            "credibility": 0.85,
            "crisis_type_hint": vision_result.get("crisis_type", "unknown"),
            "raw_data": vision_result,
            "timestamp": timestamp
        }
        signals.append(signal)
        print(f"Agent1: Satellite signal normalized. Damage Score: {signal['severity_hint']}")
    except Exception as e:
        print(f"Agent1: Error processing image: {e}")

    print("Agent1: Processing emergency call transcript...")
    try:
        transcript_result = classify_transcript(transcript_text)
        
        urgency_level = transcript_result.get("urgency_level", 1)
        if isinstance(urgency_level, str) and urgency_level.isdigit():
            urgency_level = int(urgency_level)
            
        signal = {
            "signal_id": f"sig_voice_{len(signals)+1}",
            "source": "emergency_call",
            "type": "voice",
            "location": transcript_result.get("location_text", "unknown"),
            "severity_hint": float(urgency_level) * 2.0,
            "confidence": float(transcript_result.get("caller_confidence", 0.0)),
            "credibility": 0.90,
            "crisis_type_hint": transcript_result.get("distress_class", "unknown"),
            "raw_data": transcript_result,
            "timestamp": timestamp
        }
        signals.append(signal)
        print(f"Agent1: Emergency call signal normalized. Location: {signal['location']}")
    except Exception as e:
        print(f"Agent1: Error processing transcript: {e}")

    print(f"Agent1: Processing {len(social_posts_list)} social media posts...")
    try:
        social_result = analyze_social_posts(social_posts_list)
        
        signal = {
            "signal_id": f"sig_text_{len(signals)+1}",
            "source": "social_media",
            "type": "text",
            "location": social_result.get("dominant_location", "unknown"),
            "severity_hint": float(social_result.get("urgency_score", 0.0)),
            "confidence": 0.7, 
            "credibility": float(social_result.get("credibility_score", 0.0)),
            "crisis_type_hint": "unknown", 
            "raw_data": social_result,
            "timestamp": timestamp
        }
        signals.append(signal)
        print(f"Agent1: Social media signal normalized. Dominant Location: {signal['location']}")
    except Exception as e:
        print(f"Agent1: Error processing social media: {e}")

    return {
        "signals": signals,
        "processing_timestamp": timestamp,
        "total_signals_count": len(signals),
        "agent_name": getattr(agent, 'name', 'Agent1_Ingestion')
    }

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        with open(os.path.join(base_dir, "mock_data", "social_posts.json"), "r") as f:
            all_social_posts = json.load(f)
        test_social_posts = [p for p in all_social_posts if p.get("id") in [f"s_{i:03d}" for i in range(1, 9)]]
    except FileNotFoundError:
        print("mock_data/social_posts.json not found. Using empty list for social posts.")
        test_social_posts = []
    
    test_transcript = "Hello, is this emergency? Please help! Water has entered our house on University Road in Gulshan-e-Iqbal. My family is trapped on the roof and the water level is rising fast! Send a rescue boat please!"
    
    test_image_path = "fake/path/to/nonexistent_image.jpg"
    
    print("\n--- RUNNING AGENT 1 TEST ---")
    output = run_agent1(test_image_path, test_transcript, test_social_posts)
    print("\n--- AGENT 1 OUTPUT ---")
    print(json.dumps(output, indent=2))
