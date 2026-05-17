import os
import json
import sys
from datetime import datetime, timezone

# Add parent directory to sys.path for tool imports if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

AGENT_NAME = "Agent3_ResourceAllocation"

def run_agent3(agent2_output):
    print(f"\n{'='*50}")
    print(f"AGENT 3 — RESOURCE ALLOCATION STARTING")
    print(f"{'='*50}")
    
    incidents = agent2_output.get("incidents", [])
    
    # Fixed Resource Pool
    resources = {
        "ambulances": 5,
        "rescue_teams": 3,
        "police_units": 4,
        "water_tankers": 2
    }
    
    resource_pool_initial = resources.copy()
    action_plans = []
    
    # 1. Priority Logic: Sort by severity descending
    sorted_incidents = sorted(incidents, key=lambda x: x["severity_score"], reverse=True)
    
    # 2. Allocation Logic
    for rank, inc in enumerate(sorted_incidents, 1):
        loc = inc.get("location", "Unknown Location")
        severity = inc.get("severity_score", 0.0)
        crisis = inc.get("crisis_type", "unknown").lower()
        
        # Rule-based resource requirements
        needed_types = []
        if "flood" in crisis:
            needed_types = ["rescue_teams", "water_tankers", "police_units"]
        elif any(k in crisis for k in ["collapse", "trapped"]):
            needed_types = ["rescue_teams", "ambulances", "police_units"]
        elif "fire" in crisis:
            needed_types = ["ambulances", "police_units"]
        elif "heatwave" in crisis:
            needed_types = ["ambulances"]
        else: # other or unknown
            needed_types = ["ambulances", "police_units"]
            
        # Severity-based scaling limits
        if severity > 8:
            limits = {"rescue_teams": 2, "ambulances": 3, "police_units": 2, "water_tankers": 1}
        elif severity >= 6:
            limits = {"rescue_teams": 1, "ambulances": 2, "police_units": 2, "water_tankers": 1}
        else:
            limits = {"rescue_teams": 1, "ambulances": 1, "police_units": 1, "water_tankers": 0}
            
        # Actual Resource Assignment (constrained by availability)
        allocated = {}
        for r_type in needed_types:
            requested = limits.get(r_type, 0)
            actual = min(requested, resources[r_type])
            if actual > 0:
                allocated[r_type] = actual
                resources[r_type] -= actual
        
        # Generate plan details
        allocated_summary = ", ".join([f"{v} {k.replace('_', ' ')}" for k, v in allocated.items()])
        reasoning = f"Priority Rank {rank} based on severity {severity}. Assigned {allocated_summary if allocated_summary else 'no resources'} due to {crisis} specific needs and current availability."
        
        # Dynamic instructions
        hospital = "Aga Khan Hospital" if "Gulshan" in loc else "Jinnah Hospital"
        rerouting = f"URGENT traffic rerouting at {loc}. All non-emergency vehicles diverted to nearest relief corridors."
        notification = f"Emergency Alert for {loc}: High-level {crisis} response in progress. Please stay indoors and clear the roads for rescue teams. Resources deployed: {allocated_summary if allocated_summary else 'monitoring only'}."
        
        action_plans.append({
            "incident_id": inc["incident_id"],
            "location": loc,
            "severity_score": severity,
            "priority_rank": rank,
            "crisis_type": inc.get("crisis_type", "unknown"),
            "resource_assignment": allocated,
            "allocation_reasoning": reasoning,
            "traffic_rerouting": rerouting,
            "hospital_alert": hospital,
            "public_notification": notification[:80] + "..." if len(notification) > 80 else notification,
            "affected_population": inc.get("affected_population"),
            "spread_risk": inc.get("spread_risk"),
            "confidence": inc.get("confidence")
        })
        
    # 3. Print Summary Table
    print(f"\nAGENT 3 SUMMARY — {len(action_plans)} Plans Generated")
    print(f"{'Rank':<5} {'ID':<10} {'Location':<25} {'Resources Assigned'}")
    print("-" * 75)
    for p in action_plans:
        res_list = [f"{v}{k[0].upper()}" for k, v in p["resource_assignment"].items()]
        res_str = ", ".join(res_list) if res_list else "NONE"
        print(f"{p['priority_rank']:<5} {p['incident_id']:<10} {p['location']:<25} {res_str}")
        
    print(f"\nRemaining Resources: {resources}")
    print(f"\nAgent 3 COMPLETE")
    print(f"{'='*50}\n")
    
    return {
        "agent_name": AGENT_NAME,
        "processing_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_incidents": len(action_plans),
        "resource_pool_initial": resource_pool_initial,
        "remaining_resources": resources,
        "action_plans": action_plans
    }

if __name__ == "__main__":
    # Import other agents for full chain testing
    from agents.agent1_ingestion import run_agent1
    from agents.agent2_fusion import run_agent2
    
    print("\n--- STARTING FULL MULTIMODAL CHAIN TEST ---")
    
    try:
        # 1. Load mock data
        with open("mock_data/social_posts.json") as f:
            all_posts = json.load(f)
        
        # 2. Execute Chain
        print("Executing Agent 1...")
        a1_results = run_agent1(
            image_path="mock_data/images/test.jpg",
            transcript_text="Water has entered our house in Gulshan-e-Iqbal. Family trapped on roof. Send rescue boat please.",
            social_posts_list=all_posts[:8]
        )
        
        print("Executing Agent 2...")
        a2_results = run_agent2(a1_results)
        
        print("Executing Agent 3...")
        a3_results = run_agent3(a2_results)
        
        # 3. Show Final Output
        print("\n--- FINAL ACTION PLANS OUTPUT ---")
        print(json.dumps(a3_results["action_plans"], indent=2))
        
    except Exception as e:
        print(f"Full chain test failed: {e}")
