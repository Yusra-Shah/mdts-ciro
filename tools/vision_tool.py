import os
from google.cloud import vision
from dotenv import load_dotenv

load_dotenv()

def analyze_image(image_path):
    """
    Analyzes an image using Google Cloud Vision API for disaster triage.
    """
    try:
        client = vision.ImageAnnotatorClient()
        
        with open(image_path, "rb") as image_file:
            content = image_file.read()

        image = vision.Image(content=content)

        features = [
            vision.Feature(type_=vision.Feature.Type.LABEL_DETECTION),
            vision.Feature(type_=vision.Feature.Type.OBJECT_LOCALIZATION)
        ]
        request = vision.AnnotateImageRequest(image=image, features=features)
        response = client.annotate_image(request)

        labels = response.label_annotations
        detected_labels = [label.description.lower() for label in labels]

        crisis_type = "other"
        damage_score = 0.0
        confidence = 0.0
        
        flood_keywords = {"flood", "water", "inundation", "submerged", "river", "flooding"}
        fire_keywords = {"fire", "smoke", "flame", "wildfire", "burning"}
        collapse_keywords = {"rubble", "debris", "collapse", "destruction", "earthquake", "ruins"}
        
        label_set = set(detected_labels)
        
        if label_set & flood_keywords:
            crisis_type = "flood"
        elif label_set & fire_keywords:
            crisis_type = "fire"
        elif label_set & collapse_keywords:
            crisis_type = "collapse"

        crisis_related_labels = len(label_set & (flood_keywords | fire_keywords | collapse_keywords))
        
        if labels:
            top_label_confidence = labels[0].score
            confidence = float(top_label_confidence)
            damage_score = min(10.0, crisis_related_labels * 3.0 + (confidence * 4.0))
            if crisis_type != "other" and damage_score < 4.0:
                damage_score = 5.0 

        raw_response = {
            "labels": [{"description": l.description, "score": l.score} for l in labels],
            "objects": [{"name": o.name, "score": o.score} for o in response.localized_object_annotations]
        }

        return {
            "damage_score": round(damage_score, 1),
            "detected_labels": detected_labels,
            "crisis_type": crisis_type,
            "confidence": round(confidence, 2),
            "raw_response": raw_response
        }

    except Exception as e:
        print(f"Vision API Error: {e}")
        return {
            "damage_score": 0.0,
            "detected_labels": [],
            "crisis_type": "unknown",
            "confidence": 0.0,
            "raw_response": {"error": str(e)}
        }
