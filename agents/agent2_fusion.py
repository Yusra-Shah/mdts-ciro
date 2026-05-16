import os
import json
from datetime import datetime, timezone
from collections import Counter

AGENT_NAME = "Agent2_FusionScoring"

def normalize_location(loc):
    if not loc or loc.lower() == "unknown":
        return "unknown"
    
    loc_clean = loc.lower().replace(",", "").replace(".", "").strip()
    
    # Specific rule: Gulshan-e-Iqbal and Gulshan are the same
    if "gulshan" in loc_clean:
        return "gulshan-e-iqbal"
    
    return loc_clean

def run_agent2(agent1_output):
    print(f"\n{'='*50}")
    print(f"AGENT 2 — FUSION & SCORING STARTING")
    print(f"{'='*50}")
    
    signals = agent1_output.get("signals", [])
    clusters = {}
    
    # 1. Clustering by location
    for signal in signals:
        raw_loc = signal.get("location", "unknown")
        norm_loc = normalize_location(raw_loc)
        
        # Unknown locations get their own separate clusters
        if norm_loc == "unknown":
            cluster_key = f"unknown_{signal.get('signal_id')}"
            clusters[cluster_key] = [signal]
        else:
            if norm_loc not in clusters:
                clusters[norm_loc] = []
            clusters[norm_loc].append(signal)
    
    incidents = []
    
    # Weights for composite severity
    weights = {
        "satellite": 0.3,
        "emergency_call": 0.4,
        "social_media": 0.3
    }
    
    # 2. Processing each cluster
    for cluster_key, cluster_signals in clusters.items():
        signals_count = len(cluster_signals)
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Determining display location
        if cluster_key.startswith("unknown_"):
            display_location = "Unknown Location"
        else:
            display_location = cluster_key.title()
            
        composite_severity = 0.0
        total_confidence = 0.0
        crisis_hints = []
        contributing_signal_ids = []
        
        # Conflict detection tracking
        has_flood = False
        has_infrastructure = False
        infra_source = "unknown"
        
        for sig in cluster_signals:
            source = sig.get("source")
            weight = weights.get(source, 0.3)
            
            # Credibility assignment
            if source == "satellite":
                credibility = 0.85
            elif source == "emergency_call":
                credibility = 0.90
            else:
                credibility = sig.get("credibility", 0.7)
            
            # Composite Severity Formula: Sum(severity_hint * weight * credibility)
            severity_hint = sig.get("severity_hint", 0.0)
            composite_severity += (severity_hint * weight * credibility)
            
            total_confidence += sig.get("confidence", 0.5)
            crisis_hint = sig.get("crisis_type_hint", "unknown")
            crisis_hints.append(crisis_hint)
            contributing_signal_ids.append(sig.get("signal_id"))
            
            # Conflict detection logic
            hint_lower = crisis_hint.lower()
            if "flood" in hint_lower or "water" in hint_lower:
                has_flood = True
            if any(k in hint_lower for k in ["water_main", "pipe", "infrastructure"]):
                has_infrastructure = True
                infra_source = source
        
        final_severity = round(composite_severity, 1)
        avg_confidence = round(total_confidence / signals_count, 2) if signals_count > 0 else 0.0
        
        # Crisis Type: Most common
        crisis_type = Counter(crisis_hints).most_common(1)[0][0] if crisis_hints else "unknown"
        
        # Conflict handling
        conflict_detected = False
        conflict_description = ""
        if has_flood and has_infrastructure:
            conflict_detected = True
            conflict_description = f"Conflict detected: Mixed signals between natural flooding and infrastructure failure reported by {infra_source}."
            
        # Affected Population & Spread Risk logic
        if final_severity > 8:
            affected_population = 15000  # Middle of 10k-20k
            spread_risk = "high"
        elif final_severity >= 6:
            affected_population = 6500   # Middle of 3k-10k
            spread_risk = "medium"
        else:
            affected_population = 1500   # Middle of under 3k
            spread_risk = "low"
            
        incident = {
            "incident_id": f"INC_{len(incidents) + 1:04d}",
            "location": display_location,
            "crisis_type": crisis_type,
            "severity_score": final_severity,
            "confidence": avg_confidence,
            "conflict_detected": conflict_detected,
            "conflict_description": conflict_description if conflict_detected else None,
            "affected_population": affected_population,
            "spread_risk": spread_risk,
            "signals_count": signals_count,
            "contributing_signals": contributing_signal_ids,
            "timestamp": timestamp
        }
        incidents.append(incident)
    
    # 3. Sorting by severity descending
    incidents.sort(key=lambda x: x["severity_score"], reverse=True)
    
    # 4. Print Summary
    print(f"\nAGENT 2 SUMMARY — {len(incidents)} Incidents Identified")
    print(f"{'ID':<10} {'Location':<25} {'Severity':<10} {'Conflict'}")
    print("-" * 60)
    for inc in incidents:
        print(f"{inc['incident_id']:<10} {inc['location']:<25} {inc['severity_score']:<10} {inc['conflict_detected']}")
    
    print(f"\nAgent 2 COMPLETE")
    print(f"{'='*50}\n")
    
    return {
        "agent_name": AGENT_NAME,
        "processing_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_incidents": len(incidents),
        "incidents": incidents
    }

if __name__ == "__main__":
    # Test with the exact Agent 1 output from the last successful test
    agent1_test_output = {
      "agent_name": "Agent1_SignalIngestion",
      "processing_timestamp": "2026-05-16T15:22:08.308883+00:00",
      "total_signals": 3,
      "signals": [
        {
          "signal_id": "sig_satellite_2026-05-16T15:22:08.308883+00:00",
          "source": "satellite",
          "type": "visual",
          "location": "unknown",
          "severity_hint": 9.8,
          "confidence": 0.95,
          "credibility": 0.85,
          "crisis_type_hint": "flood",
          "timestamp": "2026-05-16T15:22:08.308883+00:00"
        },
        {
          "signal_id": "sig_call_2026-05-16T15:22:08.308883+00:00",
          "source": "emergency_call",
          "type": "voice",
          "location": "Gulshan-e-Iqbal",
          "severity_hint": 10.0,
          "confidence": 0.9,
          "credibility": 0.9,
          "crisis_type_hint": "trapped",
          "timestamp": "2026-05-16T15:22:08.308883+00:00"
        },
        {
          "signal_id": "sig_social_2026-05-16T15:22:08.308883+00:00",
          "source": "social_media",
          "type": "text",
          "location": "Gulshan-e-Iqbal, Karachi",
          "severity_hint": 9.5,
          "confidence": 0.88,
          "credibility": 0.88,
          "crisis_type_hint": "Urban flooding",
          "timestamp": "2026-05-16T15:22:08.308883+00:00"
        }
      ]
    }
    
    result = run_agent2(agent1_test_output)
    print(json.dumps(result, indent=2))
