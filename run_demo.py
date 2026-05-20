from dotenv import load_dotenv
load_dotenv()

from agents.agent1_ingestion import run_agent1
from agents.agent2_fusion import run_agent2
from agents.agent3_allocation import run_agent3
from agents.agent4_execution import run_agent4
import json

with open('mock_data/social_posts.json') as f:
    posts = json.load(f)

transcript = "URGENT: Flash flooding in Gulshan-e-Iqbal blocks 13 and 14. Water is chest high. Multiple families trapped on rooftops. Need rescue boats immediately. University Road completely submerged."

print("Running pipeline...")
a1 = run_agent1('mock_data/images/test.jpg', transcript, posts[:8])
a2 = run_agent2(a1)
a3 = run_agent3(a2)
a4 = run_agent4(a3)
print('Pipeline complete. Session:', a4['session_id'])
print('Incidents processed:', a4['total_incidents_processed'])
for inc in a4['incidents']:
    print(f"  {inc['incident_id']} — {inc['status']} — Ticket: {inc['dispatch_ticket']['ticket_id']}")
