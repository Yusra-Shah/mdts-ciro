import os
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

try:
    db = firestore.Client()
except Exception as e:
    print(f"Warning: Could not initialize Firestore client: {e}")
    db = None

def write_incident(incident_data):
    if not db: return "db_not_initialized"
    # Ensure default fields are present
    if "affected_population" not in incident_data or incident_data["affected_population"] is None:
        incident_data["affected_population"] = 6500
    if "confidence" not in incident_data or incident_data["confidence"] is None:
        incident_data["confidence"] = 0.75
    if "spread_risk" not in incident_data or incident_data["spread_risk"] is None:
        incident_data["spread_risk"] = "medium"
    
    doc_ref = db.collection("incidents").document()
    doc_ref.set(incident_data)
    return doc_ref.id

def update_incident_status(incident_id, status, extra_fields=None):
    if not db: return False
    doc_ref = db.collection("incidents").document(incident_id)
    update_data = {"status": status}
    if extra_fields:
        update_data.update(extra_fields)
    doc_ref.update(update_data)
    return True

def write_agent_log(log_data):
    if not db: return "db_not_initialized"
    doc_ref = db.collection("agent_logs").document()
    doc_ref.set(log_data)
    return doc_ref.id

def get_all_incidents():
    if not db: return []
    docs = db.collection("incidents").stream()
    incidents = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        incidents.append(data)
    return incidents

def get_incident_by_id(incident_id):
    if not db: return None
    doc = db.collection("incidents").document(incident_id).get()
    if doc.exists:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None

def update_resource_status(resource_id, status, assigned_to=None):
    if not db: return False
    doc_ref = db.collection("resources").document(resource_id)
    doc_ref.update({
        "status": status,
        "assigned_to": assigned_to
    })
    return True

def initialize_resources():
    if not db: return False
    
    resource_pool = {
        "ambulances": 5,
        "rescue_teams": 3,
        "police_units": 4,
        "water_tankers": 2
    }
    
    batch = db.batch()
    for res_type, count in resource_pool.items():
        for i in range(1, count + 1):
            res_id = f"{res_type}_{i}"
            doc_ref = db.collection("resources").document(res_id)
            batch.set(doc_ref, {
                "type": res_type,
                "status": "available",
                "assigned_to": None,
                "unit_id": res_id
            })
    batch.commit()
    return True
