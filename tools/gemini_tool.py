import os
import json
import time
from dotenv import load_dotenv
load_dotenv()

import google.genai as genai
from google.genai import types

MODEL = "gemini-flash-latest"

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def classify_transcript(text):
    for attempt in range(3):
        try:
            prompt = f"""You are an emergency call analyzer for Pakistan Disaster Response.
Extract information from this emergency call transcript.
Respond ONLY with valid JSON, no extra text, no markdown.

Transcript: {text}

Return JSON with exactly these fields:
- urgency_level (int 1-5)
- location_text (string)
- distress_class (string: trapped/injured/property/evacuation/other)
- caller_confidence (float 0-1)
- summary (string under 20 words)"""

            response = client.models.generate_content(
                model=MODEL,
                contents=prompt
            )
            text_response = response.text.strip()
            if text_response.startswith("```"):
                text_response = text_response.split("```")[1]
                if text_response.startswith("json"):
                    text_response = text_response[4:]
            return json.loads(text_response.strip())
        except Exception as e:
            print(f"Gemini classify_transcript attempt {attempt+1} error: {e}")
            if ("429" in str(e) or "quota" in str(e).lower()) and attempt < 2:
                print("Quota exceeded, waiting 60s...")
                time.sleep(60)
            elif attempt == 2:
                break
    
    # Fallback logic
    print("Gemini classify_transcript: Using fallback logic.")
    location = "unknown"
    cities = ["Gulshan", "Karachi", "Islamabad", "Lahore", "Hyderabad"]
    for city in cities:
        if city.lower() in text.lower():
            location = city
            break
            
    return {
        "urgency_level": 4,
        "location_text": location,
        "distress_class": "trapped",
        "caller_confidence": 0.7,
        "summary": " ".join(text.split()[:20])
    }

def analyze_social_posts(posts_list):
    for attempt in range(3):
        try:
            posts_str = "\n".join([
                f"[{p.get('timestamp')}] {p.get('platform')}: {p.get('text')} (Likes: {p.get('likes')}, Verified: {p.get('verified')})"
                for p in posts_list
            ])

            prompt = f"""You are a social media intelligence analyst for Pakistan Disaster Response.
Analyze these social media posts and return ONLY valid JSON, no markdown, no extra text.

Posts:
{posts_str}

Return JSON with exactly these fields:
- dominant_location (string)
- mention_velocity (float: estimated posts per hour)
- urgency_score (float 0-10)
- credibility_score (float 0-1)
- conflict_detected (boolean)
- conflict_description (string or null)
- key_themes (list of strings)
- sample_posts (list of 3 most relevant post texts)"""

            response = client.models.generate_content(
                model=MODEL,
                contents=prompt
            )
            text_response = response.text.strip()
            if text_response.startswith("```"):
                text_response = text_response.split("```")[1]
                if text_response.startswith("json"):
                    text_response = text_response[4:]
            return json.loads(text_response.strip())
        except Exception as e:
            print(f"Gemini analyze_social_posts attempt {attempt+1} error: {e}")
            if ("429" in str(e) or "quota" in str(e).lower()) and attempt < 2:
                print("Quota exceeded, waiting 60s...")
                time.sleep(60)
            elif attempt == 2:
                break

    # Fallback logic
    print("Gemini analyze_social_posts: Using fallback logic.")
    mentions = {}
    for p in posts_list:
        loc = p.get("location_mention", "unknown")
        mentions[loc] = mentions.get(loc, 0) + 1
    dominant = max(mentions, key=mentions.get) if mentions else "unknown"
    
    return {
        "dominant_location": dominant,
        "mention_velocity": 5.0,
        "urgency_score": 7.5,
        "credibility_score": 0.7,
        "conflict_detected": False,
        "conflict_description": None,
        "key_themes": ["Urban Emergency"],
        "sample_posts": [p.get("text") for p in posts_list[:3]] if posts_list else []
    }

def generate_stakeholder_messages(incident_data):
    for attempt in range(3):
        try:
            prompt = f"""You are a crisis communication expert for the Pakistan Disaster Response Team.
Generate 4 stakeholder messages for this incident:
Location: {incident_data.get('location')}
Crisis Type: {incident_data.get('crisis_type')}
Severity: {incident_data.get('severity_score')}
Resources Dispatched: {incident_data.get('resource_assignment')}

Respond ONLY with valid JSON, no extra text, no markdown.
Fields:
- public_alert: (Under 80 words, simple Urdu-friendly English, warning the public)
- hospital_notice: (Medical details, mention specific hospital: {incident_data.get('hospital_alert')})
- utility_alert: (Specific alert for KESC or SNGPL mentioning infrastructure risk)
- media_brief: (Official government tone, under 100 words, factual summary)"""

            response = client.models.generate_content(
                model=MODEL,
                contents=prompt
            )
            text_response = response.text.strip()
            if text_response.startswith("```"):
                text_response = text_response.split("```")[1]
                if text_response.startswith("json"):
                    text_response = text_response[4:]
            return json.loads(text_response.strip())
        except Exception as e:
            print(f"Gemini generate_stakeholder_messages attempt {attempt+1} error: {e}")
            if ("429" in str(e) or "quota" in str(e).lower()) and attempt < 2:
                print("Quota exceeded, waiting 60s...")
                time.sleep(60)
            elif attempt == 2:
                break

    # Fallback logic
    print("Gemini generate_stakeholder_messages: Using fallback logic.")
    return {
        "public_alert": f"Emergency at {incident_data.get('location')}. Please stay away.",
        "hospital_notice": f"Incident at {incident_data.get('location')}. Prepare for arrivals at {incident_data.get('hospital_alert')}.",
        "utility_alert": f"Check infrastructure at {incident_data.get('location')}. Potential risks detected.",
        "media_brief": f"Official Update: An incident at {incident_data.get('location')} is being managed. Resources are deployed."
    }
