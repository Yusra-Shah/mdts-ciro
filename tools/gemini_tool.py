import os
import json
from dotenv import load_dotenv
load_dotenv()

import google.genai as genai
from google.genai import types

MODEL = "gemini-flash-latest"

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def classify_transcript(text):
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
        print(f"Gemini classify_transcript error: {e}")
        return {
            "urgency_level": 1,
            "location_text": "unknown",
            "distress_class": "other",
            "caller_confidence": 0.0,
            "summary": "Error parsing transcript"
        }

def analyze_social_posts(posts_list):
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
        print(f"Gemini analyze_social_posts error: {e}")
        return {
            "dominant_location": "unknown",
            "mention_velocity": 0.0,
            "urgency_score": 0.0,
            "credibility_score": 0.0,
            "conflict_detected": False,
            "conflict_description": None,
            "key_themes": [],
            "sample_posts": []
        }

def generate_stakeholder_messages(incident_data):
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
        print(f"Gemini generate_stakeholder_messages error: {e}")
        return {
            "public_alert": f"Emergency at {incident_data.get('location')}. Please stay away.",
            "hospital_notice": f"Incident at {incident_data.get('location')}. Prepare for arrivals at {incident_data.get('hospital_alert')}.",
            "utility_alert": f"Check infrastructure at {incident_data.get('location')}. Potential risks detected.",
            "media_brief": f"Official Update: An incident at {incident_data.get('location')} is being managed. Resources are deployed."
        }
