import os
import json
from dotenv import load_dotenv
load_dotenv()

import google.genai as genai
from google.genai import types

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "mdts-ciro-2026")
LOCATION = "us-central1"
MODEL = "gemini-2.0-flash-001"

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

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
