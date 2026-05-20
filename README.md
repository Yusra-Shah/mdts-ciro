# MDTS CIRO — Multimodal Disaster Triage System

### Real-Time Agentic AI System for Pakistan Disaster Response
**Hackathon:** AISeekho 2026 Google Antigravity Hackathon — Challenge 3: Crisis Intelligence and Response Orchestrator (CIRO)
**Team Lead:** Yusra Batool — Sukkur IBA University
**Live Demo:** https://mdts-ciro-2026-9a7e3.web.app
**GitHub:** https://github.com/Yusra-Shah/mdts-ciro

---

## Project Overview

Pakistan has no unified disaster intelligence platform. When floods or earthquakes strike, information is fragmented across government departments, resources are deployed blind, and coordination takes 2 to 4 hours. MDTS CIRO solves this.

MDTS is a real-time agentic AI system that fuses four simultaneous signal streams — satellite imagery, emergency call transcripts, social media posts, and live weather data — through a 4-agent Google ADK pipeline. It detects disasters, resolves conflicts between sources, allocates limited resources across simultaneous crises, and dispatches stakeholder communications in 47 seconds.

---

## System Architecture

```
INPUT STREAMS
├── Satellite Image (Google Vision API)
├── Emergency Call Transcript (Gemini NLP)
├── Social Media Posts (Gemini NLP)
└── Weather + Environmental Data (OpenWeatherMap API)
         │
         ▼
AGENT 1 — Signal Ingestion
Processes all 4 streams simultaneously. Extracts location,
urgency, crisis type, and credibility from each source.
         │
         ▼
AGENT 2 — Fusion and Scoring
Clusters signals by location. Calculates composite severity
using weighted credibility scores. Detects conflicts between
sources (e.g. flood vs burst pipe). Flags false alarms.
         │
         ▼
AGENT 3 — Resource Allocation
Allocates ambulances, rescue teams, police units, water tankers
across all simultaneous incidents. Prioritizes by severity.
Never depletes resources to a single location.
         │
         ▼
AGENT 4 — Execution and Dispatch
Writes incidents to Firestore. Generates 4 stakeholder messages
via Gemini. Creates dispatch tickets with ETA. Logs full
agent reasoning chain for audit transparency.
         │
         ▼
LIVE DASHBOARD
Pakistan command map, weather strip, earthquake feed,
incident cards, agent reasoning audit, fleet deployment tracker.
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | Python, Flask, Flask-CORS | REST API with 15 endpoints |
| AI Pipeline | Google ADK, Gemini Flash | 4-agent orchestration and NLP |
| Vision AI | Google Cloud Vision API | Satellite image damage detection |
| Database | Google Cloud Firestore | Real-time incident persistence |
| Scheduler | Python schedule library | Auto-monitoring every 30 minutes |
| Frontend | HTML5, CSS3, JavaScript | Live command dashboard |
| Hosting | Firebase Hosting | Public deployment |
| Maps | Google Maps JavaScript API | Live incident and weather map |
| Weather | OpenWeatherMap API | Real-time Pakistan city weather |
| Satellite | NASA FIRMS VIIRS API | Real fire and flood hotspots |
| Earthquakes | USGS Earthquake API | Live seismic data near Pakistan |

---

## Real APIs Used

| API | Data | Free Tier |
|---|---|---|
| OpenWeatherMap | Live weather for Karachi, Lahore, Islamabad, Hyderabad, Peshawar | Yes |
| NASA FIRMS VIIRS | Real satellite fire and thermal hotspots over Pakistan | Yes |
| USGS Earthquake API | Live magnitude 2.0+ earthquakes near Pakistan, last 24 hours | Yes |
| Google Vision API | Satellite image label detection and damage scoring | GCP credits |
| Google Gemini Flash | NLP for transcripts, social posts, stakeholder messages | AI Studio free tier |
| Google Maps JavaScript | Interactive Pakistan map with weather radar overlays | GCP credits |

---

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/Yusra-Shah/mdts-ciro.git
cd mdts-ciro
```

### 2. Create virtual environment
```bash
python -m venv venv
venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
Create a `.env` file:
```
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT=mdts-ciro-2026
GOOGLE_APPLICATION_CREDENTIALS=firebase-credentials.json
OPENWEATHER_API_KEY=your_openweathermap_key
NASA_FIRMS_KEY=your_nasa_firms_key
```

### 5. Run the server
```bash
python main.py
```

### 6. Open the dashboard
```
http://localhost:5000
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| / | GET | Serves the frontend dashboard |
| /analyze | POST | Runs the full 4-agent pipeline |
| /incidents | GET | All incidents from Firestore |
| /incidents/id | GET | Single incident detail |
| /agent-logs | GET | Full agent reasoning audit logs |
| /weather | GET | Real-time weather for 5 Pakistan cities |
| /weather/alerts | GET | Active weather threat alerts |
| /earthquakes | GET | Live USGS earthquake data near Pakistan |
| /satellite-alerts | GET | NASA FIRMS satellite hotspots |
| /threat-assessment | GET | Combined threat score from all sources |
| /city-resources | GET | Pakistan city resource database |
| /stats | GET | Aggregate incident metrics |
| /baseline | GET | Simple heuristic comparison result |
| /monitoring-status | GET | Auto-scheduler diagnostics |
| /health | GET | System health check |

---

## Agent Details

**Agent 1 — Signal Ingestion**
Processes 4 streams simultaneously. Google Vision API analyzes satellite imagery and returns damage score and crisis type. Gemini classifies emergency transcripts extracting location, urgency level 1 to 5, and distress class. Gemini analyzes social media posts extracting dominant location, urgency score, credibility, and conflict indicators. OpenWeatherMap data is ingested as a 4th environmental signal stream.

**Agent 2 — Fusion and Scoring**
Clusters signals by normalized location using fuzzy matching. Calculates composite severity using weighted formula: satellite weight 0.3, emergency call weight 0.4, social media weight 0.3, adjusted by source credibility. Detects conflicts between sources and flags them. Estimates affected population and spread risk. Sorts incidents by severity descending.

**Agent 3 — Resource Allocation**
Manages fixed resource pool: 5 ambulances, 3 rescue teams, 4 police units, 2 water tankers. Allocates based on crisis type and severity. Flood gets rescue teams and water tankers. Collapse gets rescue teams and ambulances. Heatwave gets ambulances. Never deploys more than available. Generates traffic rerouting, hospital alerts, and public notifications per incident.

**Agent 4 — Execution**
Writes every incident to Firestore with full detail. Calls Gemini to generate 4 stakeholder messages: public alert, hospital notice, utility alert for KESC and SNGPL, and media brief. Creates dispatch tickets with estimated arrival times. Logs every agent step to agent_logs collection for full audit transparency. Low-severity incidents get verification_required status instead of blind dispatch.

---

## Pakistan City Resource Database

The system includes a verified database of 5 major Pakistan cities with:
- Hospital counts and primary hospital names
- Rescue station counts and ambulance fleet sizes
- Known flood zones by neighborhood
- Earthquake risk level
- NDMA office locations

Cities: Karachi, Lahore, Islamabad, Hyderabad, Peshawar

---

## Baseline Comparison

| Factor | Simple Heuristic | MDTS CIRO |
|---|---|---|
| Method | Mention count only | Multi-agent AI fusion |
| Signal sources | 1 source | 4 streams simultaneously |
| Incidents found | 1 always | Multiple dynamic |
| Resource distribution | All to one location | Optimized across all incidents |
| Conflict detection | None | Active |
| Weather integration | None | Active |
| False alarm protection | None | Verification required status |
| Response time | 2 to 4 hours | 47 seconds |
| Score | 2 out of 10 | 9 out of 10 |

---

## Auto-Monitoring

A background scheduler runs every 30 minutes and automatically:
1. Fetches real weather data and checks threat thresholds
2. Queries NASA FIRMS for new satellite hotspots
3. Checks USGS for significant earthquakes magnitude 5.5 or above
4. If multiple threat factors align simultaneously triggers the full pipeline autonomously
5. Logs all monitoring activity to Firestore

---

## Limitations and Future Work (AEGIS Vision)

MDTS CIRO is Phase 1 of a larger vision called AEGIS — Pakistan's unified national disaster intelligence ecosystem.

Future phases include:
- IoT river and dam sensors for real-time water level monitoring
- Drone swarm dispatch coordination for search and rescue
- Digital twin simulation of Pakistan for disaster modeling
- Multilingual alerts in Urdu, Sindhi, Punjabi, Pashto, and Balochi
- Offline AI operation for network-deprived disaster zones
- Blockchain aid tracking for transparent resource distribution
- Citizen mobile app with SOS and family location sharing

---

## Cost Estimate

| Service | Rate | Monthly Estimate |
|---|---|---|
| Google Vision API | 1.50 per 1000 images | Low usage: under 5 USD |
| Gemini Flash input | 0.075 per 1M tokens | Under 2 USD |
| Firestore | Free 50000 ops daily | Under 1 USD |
| Firebase Hosting | Free tier | 0 USD |
| OpenWeatherMap | Free 1000 calls daily | 0 USD |
| NASA FIRMS | Free | 0 USD |
| USGS Earthquake | Free | 0 USD |

**Total estimated monthly cost for prototype: under 10 USD**

---

## Team

**Yusra Batool** — Team Lead
**Inshrah Batool** — Team Member
