import json
from agents.agent1_ingestion import run_agent1
from agents.agent2_fusion import run_agent2
from agents.agent3_allocation import run_agent3
from agents.agent4_execution import run_agent4

with open('mock_data/social_posts.json') as f:
    posts = json.load(f)

a1 = run_agent1('mock_data/images/test.jpg', 'Water has entered our house in Gulshan-e-Iqbal. Family trapped on roof. Send rescue boat please.', posts[:8])
a2 = run_agent2(a1)
a3 = run_agent3(a2)
a4 = run_agent4(a3)
print('Pipeline complete:', a4.get('session_id') or a4.get('incident_id') or a4)
