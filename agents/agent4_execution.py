import os
import json
import sys
import uuid
from datetime import datetime, timezone

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.firestore_tool import write_incident, write_agent_log, update_incident_status, initialize_resources
from tools.gemini_tool import generate_stakeholder_messages

AGENT_NAME = "Agent4_Execution"

def run_agent4(agent3_output):
    print(f"\n{'='*50}")
    print(f"AGENT 4 — EXECUTION & FIRESTORE STARTING")
    print(f"{'='*50}")
    
    session_id = f"session_{uuid.uuid4().hex[:8]}"
    action_plans = agent3_output.get("action_plans", [])
    
    # 1. Initialize Resources in Firestore
    print("Agent 4: Initializing resource pool in Firestore...")
    initialize_resources()
    
    execution_incidents = []
    
    for i, plan in enumerate(action_plans, 1):
        incident_id = plan["incident_id"]
        severity = plan["severity_score"]
        location = plan["location"]
        
        # Log Step 1: Observation & State Setup
        write_agent_log({
            "session_id": session_id,
            "agent_name": AGENT_NAME,
            "step": i * 2 - 1,
            "observation": f"Plan for {incident_id} at {location} received. Severity: {severity}.",
            "reasoning": "Initiating state capture and status determination based on severity thresholds.",
            "decision": "Set initial status and prepare incident document.",
            "tool_called": "None",
            "tool_output": "None",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Status logic
        if severity > 5:
            status = "responding"
        elif severity < 4:
            status = "verification_required"
        else:
            status = "monitoring"
            
        before_state = {
            "incident_id": incident_id,
            "location": location,
            "status": "detected",
            "resources_assigned": None
        }
        
        incident_doc = {
            "incident_id": incident_id,
            "location": location,
            "crisis_type": plan["crisis_type"],
            "severity_score": severity,
            "priority_rank": plan["priority_rank"],
            "status": status,
            "resource_assignment": plan["resource_assignment"],
            "allocation_reasoning": plan["allocation_reasoning"],
            "traffic_rerouting": plan["traffic_rerouting"],
            "hospital_alert": plan["hospital_alert"],
            "public_notification": plan["public_notification"],
            "affected_population": plan.get("affected_population"),
            "spread_risk": plan.get("spread_risk"),
            "confidence": plan.get("confidence"),
            "before_state": before_state,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verification required logic
        if status == "verification_required":
            incident_doc["verification_request"] = f"Field verification needed before dispatch due to low confidence/severity ({severity})."
            # In verification mode, we don't dispatch resources yet
            resources_for_dispatch = {}
        else:
            resources_for_dispatch = plan["resource_assignment"]
            
        incident_doc["after_state"] = incident_doc.copy()
        incident_doc["after_state"]["status"] = status
        
        # 2. Write to Firestore
        print(f"Agent 4: Writing incident {incident_id} to Firestore...")
        doc_id = write_incident(incident_doc)
        
        # 3. Generate Stakeholder Messages via Gemini
        print(f"Agent 4: Generating stakeholder alerts for {incident_id}...")
        stakeholder_msgs = generate_stakeholder_messages(plan)
        
        # 4. Generate Dispatch Ticket
        if severity > 8:
            eta = 5
        elif severity > 6:
            eta = 10
        else:
            eta = 15
            
        dispatch_ticket = {
            "ticket_id": f"TKT-{uuid.uuid4().hex[:6].upper()}",
            "incident_id": incident_id,
            "dispatched_resources": resources_for_dispatch,
            "dispatch_time": datetime.now(timezone.utc).isoformat(),
            "estimated_arrival_minutes": eta,
            "status": "dispatched" if status != "verification_required" else "pending_verification"
        }
        
        # Log Step 2: Final Action Taken
        write_agent_log({
            "session_id": session_id,
            "agent_name": AGENT_NAME,
            "step": i * 2,
            "observation": f"Incident {incident_id} stored with Firestore Doc ID: {doc_id}.",
            "reasoning": f"Dispatch ticket {dispatch_ticket['ticket_id']} generated with ETA {eta}m.",
            "decision": "Complete execution phase for this incident.",
            "tool_called": "write_incident, generate_stakeholder_messages",
            "tool_output": f"DocID: {doc_id}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        execution_incidents.append({
            "incident_id": incident_id,
            "firestore_doc_id": doc_id,
            "status": status,
            "dispatch_ticket": dispatch_ticket,
            "stakeholder_messages": stakeholder_msgs,
            "agent_logs_written": 2
        })
        
    report = {
        "session_id": session_id,
        "agent_name": AGENT_NAME,
        "processing_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_incidents_processed": len(execution_incidents),
        "incidents": execution_incidents
    }
    
    # 5. Print Summary
    print(f"\nAGENT 4 EXECUTION SUMMARY")
    print(f"{'Incident ID':<15} {'Firestore Doc ID':<25} {'Status':<20} {'Ticket ID'}")
    print("-" * 80)
    for inc in execution_incidents:
        print(f"{inc['incident_id']:<15} {inc['firestore_doc_id']:<25} {inc['status']:<20} {inc['dispatch_ticket']['ticket_id']}")
        
    print(f"\nAgent 4 COMPLETE")
    print(f"{'='*50}\n")
    
    return report

if __name__ == "__main__":
    from agents.agent1_ingestion import run_agent1
    from agents.agent2_fusion import run_agent2
    from agents.agent3_allocation import run_agent3
    
    print("\n--- STARTING FULL END-TO-END SYSTEM TEST ---")
    
    try:
        # Load mock data
        with open("mock_data/social_posts.json") as f:
            all_posts = json.load(f)
        
        # Execute Pipeline
        print("STAGE 1: Signal Ingestion...")
        a1 = run_agent1(
            image_path="mock_data/images/test.jpg",
            transcript_text="URGENT: Flooding in Gulshan-e-Iqbal. Multiple families trapped. Need rescue teams immediately!",
            social_posts_list=all_posts[:12]
        )
        
        print("STAGE 2: Fusion & Scoring...")
        a2 = run_agent2(a1)
        
        print("STAGE 3: Resource Allocation...")
        a3 = run_agent3(a2)
        
        print("STAGE 4: Execution & Storage...")
        final_report = run_agent4(a3)
        
        print("\n--- FINAL EXECUTION REPORT ---")
        print(json.dumps(final_report, indent=2))
        
    except Exception as e:
        print(f"System test failed: {e}")
        import traceback
        traceback.print_exc()
