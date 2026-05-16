import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

MODEL_NAME = "gemini-2.0-flash-exp"

def classify_transcript(text):
    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction="You are an emergency call analyzer for Pakistan Disaster Response. Extract information from emergency call transcripts. Always respond in valid JSON only with no extra text."
        )
        prompt = f"""
        Analyze the following emergency call transcript and output JSON with these exact fields:
        - urgency_level (int 1-5)
        - location_text (string)
        - distress_class (string, one of: trapped/injured/property/evacuation/other)
        - caller_confidence (float 0-1)
        - summary (string under 20 words)

        Transcript:
        {text}
        """
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
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
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction="You are a social media intelligence analyst for Pakistan Disaster Response. Always respond in valid JSON only."
        )
        
        posts_str = "\n".join([f"[{p.get('timestamp')}] @{p.get('platform')}: {p.get('text')} (Likes: {p.get('likes')}, Verified: {p.get('verified')})" for p in posts_list])
        
        prompt = f"""
        Analyze this batch of social media posts and return a JSON object with these exact fields:
        - dominant_location (string)
        - mention_velocity (float estimated posts per hour)
        - urgency_score (float 0-10)
        - credibility_score (float 0-1)
        - conflict_detected (boolean)
        - conflict_description (string or null)
        - key_themes (list of strings)
        - sample_posts (list of 3 most relevant post texts)

        Posts:
        {posts_str}
        """
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
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
