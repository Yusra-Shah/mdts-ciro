// ── MDTS CIRO — app.js ──────────────────────────────────────────
const API = '';  // same origin

// ── Navigation ──────────────────────────────────────────────────
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item,.bn-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll(`[onclick="showSection('${id}')"]`).forEach(n => n.classList.add('active'));
    if (id === 'incidents') loadAllIncidents();
    if (id === 'logs') loadLogs();
}

// ── Toast ────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── File Upload ──────────────────────────────────────────────────
let uploadedFilename = 'mock_data/images/test.jpg';
function handleFile(input) {
    if (!input.files[0]) return;
    uploadedFilename = 'mock_data/images/' + input.files[0].name;
    const zone = document.getElementById('upload-zone');
    const display = document.getElementById('filename-display');
    zone.classList.add('has-file');
    display.textContent = '✓ ' + input.files[0].name;
}

// ── Severity helpers ─────────────────────────────────────────────
function sevClass(s) {
    if (s >= 7) return '';
    if (s >= 5) return 'moderate';
    return 'low';
}
function chipClass(status) {
    const m = { responding: 'chip-responding', detected: 'chip-detected', verification_required: 'chip-verification', monitoring: 'chip-monitoring' };
    return m[status] || 'chip-detected';
}
function chipLabel(status) {
    const m = { responding: '● RESPONDING', detected: '◎ DETECTED', verification_required: '⚑ VERIFY', monitoring: '◌ MONITORING' };
    return m[status] || status.toUpperCase();
}

// ── Render incident card ─────────────────────────────────────────
function renderIncidentCard(inc, detailed = false) {
    const sc = sevClass(inc.severity_score);
    const id = inc.incident_id || inc.id || 'INC';
    const conflictBadge = inc.conflict_detected
        ? `<span class="conflict-badge">⚡ CONFLICT DETECTED</span>` : '';

    const detailHTML = detailed ? `
    <div class="detail-panel open">
      <div class="detail-grid">
        <div class="detail-block">
          <div class="detail-label">Affected Population</div>
          <div class="detail-val">${(inc.affected_population || 0).toLocaleString()} people</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">Spread Risk</div>
          <div class="detail-val">${(inc.spread_risk || 'unknown').toUpperCase()}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">Hospital Alert</div>
          <div class="detail-val">${inc.hospital_alert || '—'}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">Traffic Rerouting</div>
          <div class="detail-val" style="font-size:12px">${inc.traffic_rerouting || '—'}</div>
        </div>
      </div>
      ${inc.allocation_reasoning ? `
        <div style="background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div class="detail-label" style="margin-bottom:6px;">AI REASONING</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.6">${inc.allocation_reasoning}</div>
        </div>` : ''}
      ${inc.public_notification ? `
        <div style="background:var(--amber-dim);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div class="detail-label" style="color:var(--amber);margin-bottom:6px;">PUBLIC ALERT</div>
          <div style="font-size:12px;line-height:1.6">${inc.public_notification}</div>
        </div>` : ''}
      <div class="timeline">
        <div class="tl-item"><div class="tl-dot done"></div>
          <div class="tl-agent">AGENT 1 — SIGNAL INGESTION</div>
          <div class="tl-action">3 streams processed: satellite, call, social media</div>
          <div class="tl-time">${inc.created_at || '—'}</div>
        </div>
        <div class="tl-item"><div class="tl-dot done"></div>
          <div class="tl-agent">AGENT 2 — FUSION & SCORING</div>
          <div class="tl-action">Severity: ${inc.severity_score}/10 · Confidence: ${Math.round((inc.confidence || 0) * 100)}%</div>
          <div class="tl-time">${inc.created_at || '—'}</div>
        </div>
        <div class="tl-item"><div class="tl-dot done"></div>
          <div class="tl-agent">AGENT 3 — RESOURCE ALLOCATION</div>
          <div class="tl-action">Resources assigned · ${inc.hospital_alert || 'Hospital'} notified</div>
          <div class="tl-time">${inc.created_at || '—'}</div>
        </div>
        <div class="tl-item"><div class="tl-dot ${inc.status === 'responding' ? 'done' : 'pending'}"></div>
          <div class="tl-agent">AGENT 4 — EXECUTION</div>
          <div class="tl-action">Status: ${(inc.status || 'unknown').toUpperCase()} · Dispatch simulated</div>
          <div class="tl-time">${inc.updated_at || '—'}</div>
        </div>
      </div>
    </div>` : `<div class="ic-actions">
      <button class="btn btn-amber" onclick="showSection('incidents')">VIEW DETAILS</button>
      <button class="btn btn-ghost">DISPATCH</button>
    </div>`;

    return `
    <div class="incident-card ${sc}" onclick="toggleDetail(this)">
      <div class="ic-top">
        <div class="ic-left">
          <div class="ic-type">${(inc.crisis_type || 'UNKNOWN').toUpperCase()}</div>
          <div class="ic-loc mono">${inc.location || 'Unknown Location'}</div>
        </div>
        <div class="ic-right">
          <div class="ic-sev">${inc.severity_score || 0}</div>
          <div class="ic-sev-lbl">/ 10</div>
        </div>
      </div>
      <div class="ic-meta">
        <span class="chip ${chipClass(inc.status)}">${chipLabel(inc.status)}</span>
        <span class="meta-item">Pop: <span class="meta-val">${(inc.affected_population || 0).toLocaleString()}</span></span>
        <span class="meta-item">Conf: <span class="meta-val">${Math.round((inc.confidence || 0) * 100)}%</span></span>
        ${conflictBadge}
      </div>
      ${detailHTML}
    </div>`;
}

function toggleDetail(card) {
    const panel = card.querySelector('.detail-panel');
    if (panel) panel.classList.toggle('open');
}

// ── Dashboard ────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await fetch(`${API}/incidents`);
        const incidents = await res.json();
        document.getElementById('stat-incidents').textContent = incidents.length || 0;
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
        const el = document.getElementById('dashboard-incidents');
        if (!incidents.length) {
            el.innerHTML = `<div class="empty"><div class="empty-icon">📡</div><div class="empty-text">No incidents yet. Run an analysis to begin triage.</div></div>`;
            return;
        }
        const sorted = incidents.sort((a, b) => (b.severity_score || 0) - (a.severity_score || 0));
        el.innerHTML = sorted.slice(0, 5).map(i => renderIncidentCard(i, false)).join('');
    } catch (e) {
        console.error('Dashboard load failed:', e);
    }
}

// ── All Incidents ────────────────────────────────────────────────
async function loadAllIncidents() {
    try {
        const res = await fetch(`${API}/incidents`);
        const incidents = await res.json();
        const el = document.getElementById('all-incidents-list');
        if (!incidents.length) {
            el.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-text">No incidents yet. Run an analysis first.</div></div>`;
            return;
        }
        const sorted = incidents.sort((a, b) => (b.severity_score || 0) - (a.severity_score || 0));
        el.innerHTML = sorted.map(i => renderIncidentCard(i, true)).join('');
    } catch (e) {
        document.getElementById('all-incidents-list').innerHTML = `<div class="empty"><div class="empty-text">Could not load incidents.</div></div>`;
    }
}

// ── Logs ─────────────────────────────────────────────────────────
async function loadLogs() {
    try {
        const res = await fetch(`${API}/agent-logs`);
        const logs = await res.json();
        const el = document.getElementById('logs-list');
        if (!logs.length) {
            el.innerHTML = `<div class="empty"><div class="empty-icon">≡</div><div class="empty-text">No agent logs yet.</div></div>`;
            return;
        }
        el.innerHTML = logs.map(l => `
      <div class="log-card">
        <div class="log-header">
          <div>
            <span class="log-agent">${l.agent_name || 'AGENT'}</span>
            <span class="log-step"> · STEP ${l.step || 0}</span>
          </div>
          <div class="log-time">${l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '—'}</div>
        </div>
        <div class="log-obs">${l.observation || '—'}</div>
        <div class="log-reason">${l.reasoning || '—'}</div>
        <div class="log-decision">▸ ${l.decision || '—'}</div>
      </div>`).join('');
    } catch (e) {
        document.getElementById('logs-list').innerHTML = `<div class="empty"><div class="empty-text">Could not load logs.</div></div>`;
    }
}

// ── Analysis ─────────────────────────────────────────────────────
async function runAnalysis() {
    const transcript = document.getElementById('transcript-input').value.trim();
    const socialRaw = document.getElementById('social-input').value.trim();

    let social_posts = [];
    if (socialRaw) {
        try { social_posts = JSON.parse(socialRaw); }
        catch { toast('Invalid JSON in social posts field', 'err'); return; }
    }

    document.getElementById('analysis-loading').style.display = 'block';
    document.getElementById('results-panel').classList.remove('visible');

    try {
        const res = await fetch(`${API}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: uploadedFilename, transcript, social_posts })
        });
        const data = await res.json();
        document.getElementById('analysis-loading').style.display = 'none';
        renderResults(data);
        toast('Analysis complete — incidents detected', 'ok');
        loadDashboard();
    } catch (e) {
        document.getElementById('analysis-loading').style.display = 'none';
        toast('Analysis failed — check backend', 'err');
        console.error(e);
    }
}

function renderResults(data) {
    const panel = document.getElementById('results-panel');
    const content = document.getElementById('results-content');
    panel.classList.add('visible');

    const incidents = data.incidents || [];
    const total = data.total_incidents_processed || incidents.length || 0;

    let html = `
    <div class="result-row">
      <span class="result-key">Session</span>
      <span class="result-val mono" style="font-size:11px">${(data.session_id || '—').slice(0, 16)}</span>
    </div>
    <div class="result-row">
      <span class="result-key">Incidents Found</span>
      <span class="result-val" style="color:var(--red)">${total}</span>
    </div>`;

    incidents.forEach(inc => {
        const sev = (inc.dispatch_ticket?.dispatched_resources) ? 'dispatched' : inc.status;
        html += `
      <div style="background:var(--bg3);border-radius:10px;padding:12px;margin-top:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--amber);font-family:'JetBrains Mono',monospace;margin-bottom:6px;">${inc.incident_id}</div>
        <div class="result-row">
          <span class="result-key">Status</span>
          <span class="chip ${chipClass(inc.status)}" style="font-size:10px">${chipLabel(inc.status)}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Ticket</span>
          <span class="result-val mono" style="font-size:11px">${inc.dispatch_ticket?.ticket_id || '—'}</span>
        </div>
        <div class="result-row">
          <span class="result-key">ETA</span>
          <span class="result-val">${inc.dispatch_ticket?.estimated_arrival_minutes || '—'} min</span>
        </div>
      </div>`;
    });
    content.innerHTML = html;
}

// ── Mock Data Loaders ─────────────────────────────────────────────
function loadMockData() {
    document.getElementById('transcript-input').value =
        "Hello, is this emergency? Please help! Water has entered our house on University Road in Gulshan-e-Iqbal. My family is trapped on the roof and the water level is rising fast! Send a rescue boat please!";
    document.getElementById('social-input').value = JSON.stringify([
        { "id": "s_001", "text": "Terrifying scenes from Gulshan-e-Iqbal block 13. The whole road is flooded, cars are floating. Need help ASAP!", "platform": "Twitter", "timestamp": "2026-05-16T10:02:00Z", "location_mention": "Gulshan-e-Iqbal, Karachi", "likes": 1500, "verified": false },
        { "id": "s_002", "text": "My family is stuck on the first floor in Gulshan, ground floor is completely submerged. Nobody is responding!", "platform": "Facebook", "timestamp": "2026-05-16T10:08:00Z", "location_mention": "Gulshan-e-Iqbal", "likes": 350, "verified": false },
        { "id": "s_003", "text": "Never seen water levels this high in Gulshan-e-Iqbal. Avoid University Road at all costs.", "platform": "Twitter", "timestamp": "2026-05-16T10:12:00Z", "location_mention": "Gulshan-e-Iqbal", "likes": 2100, "verified": true },
        { "id": "s_009", "text": "Oh my God! A 4-story building just collapsed in North Nazimabad Block H! Sending prayers.", "platform": "Twitter", "timestamp": "2026-05-16T10:14:00Z", "location_mention": "North Nazimabad, Karachi", "likes": 3200, "verified": true }
    ], null, 2);
    toast('Mock data loaded — click Analyze to run', 'ok');
}

function loadFalseAlarmData() {
    document.getElementById('transcript-input').value =
        "I'm calling from G-9 Markaz. There's water everywhere on the main road. I don't know if it's flooding from the rain or if a massive water main just burst, but the road is blocked.";
    document.getElementById('social-input').value = JSON.stringify([
        { "id": "s_014", "text": "Guys, it's not a flood in Gulshan. The main KWSB water line burst near NIPA causing all this water. Stop spreading panic.", "platform": "Facebook", "timestamp": "2026-05-16T10:35:00Z", "location_mention": "Gulshan", "likes": 12, "verified": false },
        { "id": "s_015", "text": "Fake news about flooding. It's just a broken pipe in Gulshan-e-Iqbal block 13. I'm standing right here.", "platform": "Twitter", "timestamp": "2026-05-16T10:38:00Z", "location_mention": "Gulshan-e-Iqbal", "likes": 4, "verified": false },
        { "id": "s_016", "text": "Water pipeline burst in Gulshan, that's why there's water. No flood.", "platform": "Twitter", "timestamp": "2026-05-16T10:40:00Z", "location_mention": "Gulshan", "likes": 2, "verified": false }
    ], null, 2);
    toast('False alarm scenario loaded', 'ok');
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setInterval(loadDashboard, 30000);
});