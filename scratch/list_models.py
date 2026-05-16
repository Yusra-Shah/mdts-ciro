import os
import google.genai as genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

try:
    print("Listing models...")
    for model in client.models.list():
        print(f"Model: {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")
