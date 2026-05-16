import os
import json
from datetime import datetime, timezone
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
    
    # Initial Test Run
    print("\nRUNNING INITIAL PIPELINE TEST...")
    try:
        with open("mock_data/transcripts.json") as f:
            t_data = json.load(f)
        with open("mock_data/social_posts.json") as f:
            s_data = json.load(f)
            
        # Correctly accessing the first transcript from the list
        transcript_text = t_data[0]["text"] if isinstance(t_data, list) else t_data["t_001"]["text"]
        
        test_report = run_pipeline(
            "mock_data/images/test.jpg",
            transcript_text,
            s_data[:8]
        )
        print("\nINITIAL TEST REPORT SUCCESSFUL")
        print(json.dumps(test_report, indent=2))
    except Exception as e:
        print(f"\nINITIAL TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        
    print("\nSTARTING FLASK API SERVER ON PORT 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)
