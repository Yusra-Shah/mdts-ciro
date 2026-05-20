// MDTS CIRO — app.js
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' : '';

let allIncidents = [];
let allLogs = [];
let currentIncidentFilter = 'ALL';
let currentLogFilter = 'ALL';
let uploadedImagePath = 'mock_data/images/test.jpg';
let map = null;
let mapMarkers = [];
let weatherLayers = {};
let activeLayer = null;

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    refreshAll();
    loadWeather();
    loadWeatherAlerts();
    loadMonitoringStatus();
    loadEarthquakes();
    loadThreatAssessment();
    setThemeToggleIcon();
    setInterval(refreshAll, 30000);
    setInterval(() => { loadWeather(); loadWeatherAlerts(); loadMonitoringStatus(); }, 180000);
    setInterval(loadEarthquakes, 300000);
});

function setThemeToggleIcon() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// ── CLOCK ─────────────────────────────────────────────────────────
function startClock() {
    const el = document.getElementById('pk-clock');
    if (!el) return;
    setInterval(() => {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const pk = new Date(utc + 3600000 * 5);
        el.textContent = 'Pakistan Time: ' +
            String(pk.getHours()).padStart(2, '0') + ':' +
            String(pk.getMinutes()).padStart(2, '0') + ':' +
            String(pk.getSeconds()).padStart(2, '0');
    }, 1000);
}

// ── REFRESH ───────────────────────────────────────────────────────
async function refreshAll() {
    await loadStats();
    await loadIncidents();
    await loadLogs();
    await loadResources();
    await loadThreatAssessment();
    if (map) plotMarkers();
}

// ── STATS ─────────────────────────────────────────────────────────
async function loadStats() {
    try {
        const r = await fetch(API_URL + '/stats');
        if (!r.ok) return;
        const s = await r.json();
        animateNum('stat-incidents', s.total_incidents || 0, 0);
        animateNum('stat-resources', s.resources_deployed || 0, 0);
        animateNum('stat-avg-severity', s.avg_severity || 0, 1);
        const bi = document.getElementById('benchmark-incidents-found');
        if (bi) bi.textContent = (s.total_incidents || 0) + ' incidents found';
    } catch (e) { console.error('Stats:', e); }
}

function animateNum(id, target, dec) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseFloat(el.textContent) || 0;
    const dur = 800;
    const t0 = performance.now();
    function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const ease = p * (2 - p);
        el.textContent = (start + (target - start) * ease).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── INCIDENTS ─────────────────────────────────────────────────────
async function loadIncidents() {
    try {
        const r = await fetch(API_URL + '/incidents');
        if (!r.ok) return;
        allIncidents = await r.json();
        updateChart(allIncidents);
        renderDashboardIncidents();
        renderFilteredIncidents();
        if (map) plotMarkers();
    } catch (e) { console.error('Incidents:', e); }
}

function updateChart(incidents) {
    const total = incidents.length || 1;
    let crit = 0, mod = 0, low = 0;
    incidents.forEach(i => {
        const s = i.severity_score;
        if (s > 7) crit++;
        else if (s >= 4) mod++;
        else low++;
    });
    setChart('critical', crit, total);
    setChart('moderate', mod, total);
    setChart('low', low, total);
}

function setChart(key, count, total) {
    const pct = Math.round(count / total * 100);
    const c = document.getElementById('dist-' + key + '-count');
    const b = document.getElementById('dist-' + key + '-bar');
    if (c) c.textContent = count + ' incidents (' + pct + '%)';
    if (b) b.style.width = pct + '%';
}

function renderDashboardIncidents() {
    const el = document.getElementById('dashboard-incidents-list');
    if (!el) return;
    if (!allIncidents.length) {
        el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-satellite-dish empty-icon"></i><p>No active incidents. Ingest signals in the Analyze Lab.</p></div>';
        return;
    }
    const top = [...allIncidents].sort((a, b) => b.severity_score - a.severity_score).slice(0, 3);
    el.innerHTML = top.map(i => renderCard(i, false)).join('');
}

function filterIncidents(f) {
    currentIncidentFilter = f;
    document.querySelectorAll('#incidents .filter-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === f || (f === 'ALL' && b.textContent.includes('All')));
    });
    renderFilteredIncidents();
}

function renderFilteredIncidents() {
    const el = document.getElementById('all-incidents-list');
    if (!el) return;
    let list = [...allIncidents];
    if (currentIncidentFilter === 'CRITICAL') list = list.filter(i => i.severity_score > 7);
    else if (currentIncidentFilter === 'MODERATE') list = list.filter(i => i.severity_score >= 4 && i.severity_score <= 7);
    else if (currentIncidentFilter === 'LOW') list = list.filter(i => i.severity_score < 4);
    else if (currentIncidentFilter === 'responding') list = list.filter(i => i.status === 'responding');
    else if (currentIncidentFilter === 'verification_required') list = list.filter(i => i.status === 'verification_required');
    if (!list.length) {
        el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation empty-icon"></i><p>No incidents matching this filter.</p></div>';
        return;
    }
    el.innerHTML = list.map(i => renderCard(i, true)).join('');
}

function getAccent(sev) {
    if (sev > 7) return 'var(--red)';
    if (sev >= 4) return 'var(--amber)';
    return 'var(--teal)';
}

function chipClass(status) {
    const m = { responding: 'chip-responding', verification_required: 'chip-verification_required', monitoring: 'chip-monitoring', detected: 'chip-detected' };
    return m[status] || 'chip-monitoring';
}

function chipLabel(status) {
    const m = { responding: 'Responding', verification_required: 'Verify First', monitoring: 'Monitoring', detected: 'Detected' };
    return m[status] || status;
}

function renderCard(inc, expanded) {
    const color = getAccent(inc.severity_score);
    const conf = Math.round((inc.confidence || 0.75) * 100);
    const pop = (inc.affected_population || 6500).toLocaleString();
    const status = inc.status || 'monitoring';
    const resources = inc.resource_assignment && Object.keys(inc.resource_assignment).length
        ? Object.entries(inc.resource_assignment).map(([k, v]) => v + ' ' + k.replace('_', ' ')).join(', ')
        : 'None allocated';

    let expandedHTML = '';
    if (expanded) {
        expandedHTML = `
    <div class="expanded-panel">
      <div class="field-grid">
        <div class="field-block">
          <div class="field-lbl">Affected Population</div>
          <div class="field-val">${pop} estimated</div>
        </div>
        <div class="field-block">
          <div class="field-lbl">Spread Risk</div>
          <div class="field-val">${(inc.spread_risk || 'medium').toUpperCase()}</div>
        </div>
        <div class="field-block">
          <div class="field-lbl">Fleet Allocations</div>
          <div class="field-val">${resources}</div>
        </div>
        <div class="field-block">
          <div class="field-lbl">AI Reasoning</div>
          <div class="field-val" style="font-size:11px;color:var(--text-sub);">${inc.allocation_reasoning || 'Monitoring only.'}</div>
        </div>
      </div>
      <div class="trace-title">Agent Ingestion Trace</div>
      <div class="trace-timeline">
        <div class="trace-item">
          <div class="trace-dot done" style="border-color:var(--blue);background:var(--blue);"></div>
          <div class="trace-agent" style="color:var(--blue);">Agent 1 — Signal Ingestion</div>
          <div class="trace-action">Three streams fused: satellite, call transcript, social media — confidence ${conf}%</div>
        </div>
        <div class="trace-item">
          <div class="trace-dot done" style="border-color:var(--amber);background:var(--amber);"></div>
          <div class="trace-agent" style="color:var(--amber);">Agent 2 — Geospatial Fusion</div>
          <div class="trace-action">${inc.conflict_detected ? 'Conflict detected and resolved between signal sources.' : 'No conflicts between signal sources.'}</div>
        </div>
        <div class="trace-item">
          <div class="trace-dot done" style="border-color:var(--teal);background:var(--teal);"></div>
          <div class="trace-agent" style="color:var(--teal);">Agent 3 — Fleet Allocation</div>
          <div class="trace-action">Resources allocated: ${resources}</div>
        </div>
        <div class="trace-item">
          <div class="trace-dot ${status === 'responding' ? 'done' : ''}" style="border-color:var(--red);${status === 'responding' ? 'background:var(--red);' : ''}"></div>
          <div class="trace-agent" style="color:var(--red);">Agent 4 — Execution</div>
          <div class="trace-action">Record stored in Firestore. Stakeholder messages dispatched.</div>
        </div>
      </div>
      <div class="trace-title">Stakeholder Broadcasts</div>
      <div class="stakeholder-grid">
        <div class="sh-card">
          <i class="fa-solid fa-bullhorn sh-icon"></i>
          <div>
            <div class="sh-lbl">Public Alert</div>
            <div class="sh-text">${inc.public_notification || 'Emergency response initiated. Avoid the area.'}</div>
            <div class="sh-status">Broadcast Simulated</div>
          </div>
        </div>
        <div class="sh-card">
          <i class="fa-solid fa-square-h sh-icon"></i>
          <div>
            <div class="sh-lbl">Hospital Notice</div>
            <div class="sh-text">${inc.hospital_alert || 'Jinnah Hospital'} alerted. Prepare emergency bay.</div>
            <div class="sh-status">Alert Acknowledged</div>
          </div>
        </div>
        <div class="sh-card">
          <i class="fa-solid fa-bolt sh-icon"></i>
          <div>
            <div class="sh-lbl">Utilities</div>
            <div class="sh-text">KESC and SNGPL notified. Infrastructure risk assessment initiated.</div>
            <div class="sh-status">Checklist Queued</div>
          </div>
        </div>
        <div class="sh-card">
          <i class="fa-solid fa-camera sh-icon"></i>
          <div>
            <div class="sh-lbl">Media Brief</div>
            <div class="sh-text">Official response operations active at ${inc.location || 'incident location'}.</div>
            <div class="sh-status">Press Release Published</div>
          </div>
        </div>
      </div>
      <div class="dispatch-banner ${status === 'responding' ? 'dispatch-ok' : 'dispatch-wait'}">
        ${status === 'responding' ? 'Dispatch Confirmed — En Route' : 'Awaiting Field Verification'}
      </div>
    </div>`;
    } else {
        expandedHTML = `
    <div class="ic-actions">
      <button class="btn-primary" onclick="showSection('incidents')">View Details</button>
      <button class="btn-ghost">Dispatch</button>
    </div>`;
    }

    return `
  <div class="incident-card" style="--accent:${color};">
    <div class="ic-header">
      <div>
        <div class="ic-type">${(inc.crisis_type || 'Unknown').toUpperCase()}</div>
        <div class="ic-loc"><i class="fa-solid fa-location-dot" style="color:var(--amber);margin-right:4px;"></i>${inc.location || 'Unknown Location'}</div>
      </div>
      <div style="text-align:right;">
        <div class="ic-sev-val" style="color:${color};">${inc.severity_score || 0}</div>
        <div class="ic-sev-lbl">Severity Score</div>
      </div>
    </div>
    <div class="ic-metrics">
      <span class="ic-metric">Population: <strong>${pop}</strong></span>
      <span class="ic-metric">Confidence: <strong>${conf}%</strong></span>
      <span class="ic-metric">Risk: <strong>${(inc.spread_risk || 'medium').toUpperCase()}</strong></span>
    </div>
    <div class="ic-footer">
      <span class="status-chip ${chipClass(status)}">${chipLabel(status)}</span>
      ${expandedHTML}
    </div>
  </div>`;
}

// ── LOGS ──────────────────────────────────────────────────────────
async function loadLogs() {
    try {
        const r = await fetch(API_URL + '/agent-logs');
        if (!r.ok) return;
        allLogs = await r.json();
        renderFilteredLogs();
    } catch (e) { console.error('Logs:', e); }
}

function filterLogs(f) {
    currentLogFilter = f;
    document.querySelectorAll('#logs .filter-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === f || (f === 'ALL' && b.textContent.includes('All')));
    });
    renderFilteredLogs();
}

function renderFilteredLogs() {
    const el = document.getElementById('logs-list-container');
    if (!el) return;
    let list = [...allLogs];
    if (currentLogFilter !== 'ALL') list = list.filter(l => l.agent_name === currentLogFilter);
    if (!list.length) {
        el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-terminal empty-icon"></i><p>No logs matching this filter.</p></div>';
        return;
    }
    el.innerHTML = list.map(log => {
        let cls = 'agent-2';
        if ((log.agent_name || '').includes('Ingestion')) cls = 'agent-1';
        else if ((log.agent_name || '').includes('Fusion')) cls = 'agent-2';
        else if ((log.agent_name || '').includes('Allocation')) cls = 'agent-3';
        else if ((log.agent_name || '').includes('Execution')) cls = 'agent-4';
        const t = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--';
        return `
    <div class="log-card ${cls}">
      <div class="log-top">
        <div><span class="log-agent">${log.agent_name || 'Agent'}</span><span class="log-step">Step ${log.step || 1}</span></div>
        <div class="log-time">${t}</div>
      </div>
      <div class="log-obs">${log.observation || 'Processing signal streams.'}</div>
      <div class="log-reason expandable collapsed" onclick="this.classList.toggle('collapsed');this.nextElementSibling.innerHTML=this.classList.contains('collapsed')?'Show reasoning':'Hide reasoning';">
        ${log.reasoning || ''}
      </div>
      <div class="expand-hint" style="font-size:10px;color:var(--amber);cursor:pointer;margin-bottom:6px;" onclick="this.previousElementSibling.classList.toggle('collapsed');this.innerHTML=this.previousElementSibling.classList.contains('collapsed')?'Show reasoning':'Hide reasoning';">Show reasoning</div>
      <div class="log-decision">Decision: ${log.decision || 'No action required.'}</div>
    </div>`;
    }).join('');
}

// ── RESOURCES ─────────────────────────────────────────────────────
async function loadResources() {
    try {
        const r = await fetch(API_URL + '/incidents');
        if (!r.ok) return;
        const incidents = await r.json();
        const limits = { ambulances: 5, rescue_teams: 3, police_units: 4, water_tankers: 2 };
        const deployed = { ambulances: 0, rescue_teams: 0, police_units: 0, water_tankers: 0 };
        incidents.forEach(inc => {
            if (inc.status === 'responding' && inc.resource_assignment) {
                Object.entries(inc.resource_assignment).forEach(([k, v]) => {
                    if (deployed.hasOwnProperty(k)) deployed[k] += parseInt(v) || 0;
                });
            }
        });
        let total = 0;
        Object.keys(limits).forEach(key => {
            deployed[key] = Math.min(deployed[key], limits[key]);
            total += deployed[key];
            const pct = Math.round(deployed[key] / limits[key] * 100);
            const pe = document.getElementById('util-' + key);
            const be = document.getElementById('util-bar-' + key);
            const ue = document.getElementById('units-' + key);
            if (pe) pe.textContent = pct + '% Used';
            if (be) be.style.width = pct + '%';
            if (ue) {
                ue.innerHTML = Array.from({ length: limits[key] }, (_, i) => {
                    const dep = i < deployed[key];
                    const name = key.slice(0, 3).toUpperCase() + '-' + String(i + 1).padStart(2, '0');
                    return `<span class="unit-pill ${dep ? 'deployed' : ''}">${name}</span>`;
                }).join('');
            }
        });
        const sv = document.getElementById('res-summary-val');
        if (sv) sv.textContent = 'Deployed: ' + total + ' units — Available: ' + (14 - total) + ' units';
    } catch (e) { console.error('Resources:', e); }
}

// ── WEATHER ───────────────────────────────────────────────────────
async function loadWeather() {
    try {
        const r = await fetch(API_URL + '/weather');
        if (!r.ok) return;
        const data = await r.json();
        const el = document.getElementById('weather-strip');
        if (!el) return;
        const condMap = { Clear: 'Sunny', Haze: 'Hazy', Rain: 'Rainy', Clouds: 'Cloudy', 'Partly Cloudy': 'Partly Cloudy', Thunderstorm: 'Stormy', Smoke: 'Smoky' };
        el.innerHTML = data.map(c => {
            const risk = (c.flood_risk || 'LOW').toLowerCase();
            const cond = condMap[c.condition] || c.condition;
            return `
      <div class="weather-card">
        <div class="weather-city">${c.city}</div>
        <div class="weather-temp-row">
          <span class="weather-temp">${Math.round(c.temperature)}C</span>
          <span class="weather-icon-text" style="font-size:12px;color:var(--text-sub);">${cond}</span>
        </div>
        <div class="weather-meta">
          <span>Humidity: ${c.humidity}%</span>
          <span>Wind: ${c.wind_speed} km/h</span>
          <span>Feels like: ${Math.round(c.feels_like)}C</span>
        </div>
        <span class="weather-risk risk-${risk}">Flood: ${c.flood_risk}</span>
      </div>`;
        }).join('');
        plotWeatherOnMap(data);
    } catch (e) { console.error('Weather:', e); }
}

async function loadWeatherAlerts() {
    try {
        const r = await fetch(API_URL + '/weather/alerts');
        if (!r.ok) return;
        const alerts = await r.json();
        const banner = document.getElementById('weather-alerts-banner');
        const detail = document.getElementById('weather-alert-details');
        if (!banner || !detail) return;
        if (alerts && alerts.length) {
            detail.textContent = alerts.map(a => a.city + ': ' + a.message).join(' | ');
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    } catch (e) { console.error('Weather alerts:', e); }
}

async function loadMonitoringStatus() {
    try {
        const r = await fetch(API_URL + '/monitoring-status');
        if (!r.ok) return;
        const d = await r.json();
        const le = document.getElementById('monitor-last-time');
        const ne = document.getElementById('monitor-next-time');
        if (le) le.textContent = d.last_run ? new Date(d.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';
        if (ne) ne.textContent = d.next_run ? new Date(d.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
    } catch (e) { console.error('Monitoring:', e); }
}

// ── GOOGLE MAP ────────────────────────────────────────────────────
const lightMapStyle = [
    { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -30 }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#D97706' }, { weight: 1.5 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
];

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#121420' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#747b85' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#f59e0b' }, { weight: 1.5 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07080c' }] },
    { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#0c0e14' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2130' }] },
];

function initPakistanMap() {
    const el = document.getElementById('pakistan-map');
    if (!el) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    map = new google.maps.Map(el, {
        center: { lat: 30.3753, lng: 69.3451 },
        zoom: 5,
        styles: isDark ? darkMapStyle : lightMapStyle,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
    });
    plotMarkers();
    if (allIncidents.length) plotMarkers();
}

function toggleLayer(layerName, btn) {
    document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (activeLayer) { activeLayer.setMap(null); activeLayer = null; }
    if (weatherLayers[layerName]) {
        activeLayer = weatherLayers[layerName];
        activeLayer.setMap(map);
        return;
    }
    fetch(API_URL + '/weather').then(r => r.json()).then(data => {
        const key = data[0]?.api_key || '';
        const layer = new google.maps.ImageMapType({
            getTileUrl: (c, z) => `https://tile.openweathermap.org/map/${layerName}/${z}/${c.x}/${c.y}.png?appid=b6b4bb4e3e4e17e8c12b35f1e4b2c5a8`,
            tileSize: new google.maps.Size(256, 256),
            opacity: 0.5,
            name: layerName,
        });
        weatherLayers[layerName] = layer;
        activeLayer = layer;
        if (map) map.overlayMapTypes.push(layer);
    }).catch(() => {
        const layer = new google.maps.ImageMapType({
            getTileUrl: (c, z) => `https://tile.openweathermap.org/map/${layerName}/${z}/${c.x}/${c.y}.png`,
            tileSize: new google.maps.Size(256, 256),
            opacity: 0.5,
        });
        activeLayer = layer;
        if (map) map.overlayMapTypes.push(layer);
    });
}

function cityCoords(loc) {
    const l = (loc || '').toLowerCase();
    if (l.includes('karachi') || l.includes('gulshan')) return { lat: 24.8607 + rand(), lng: 67.0011 + rand() };
    if (l.includes('lahore')) return { lat: 31.5204 + rand(), lng: 74.3587 + rand() };
    if (l.includes('islamabad') || l.includes('g-9') || l.includes('g-10')) return { lat: 33.6844 + rand(), lng: 73.0479 + rand() };
    if (l.includes('hyderabad') || l.includes('latifabad')) return { lat: 25.3960 + rand(), lng: 68.3578 + rand() };
    if (l.includes('peshawar')) return { lat: 34.0151 + rand(), lng: 71.5249 + rand() };
    return { lat: 30.3753 + rand() * 2, lng: 69.3451 + rand() * 2 };
}

function rand() { return (Math.random() - 0.5) * 0.1; }

function plotMarkers() {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];

    allIncidents.forEach(inc => {
        const sev = inc.severity_score || 0;
        const color = sev > 7 ? '#DC2626' : sev >= 4 ? '#D97706' : '#059669';
        const pos = cityCoords(inc.location);
        const m = new google.maps.Marker({
            position: pos, map: map,
            title: inc.location,
            icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 7, fillColor: color, fillOpacity: 0.9,
                strokeColor: '#fff', strokeWeight: 1.5
            }
        });
        const iw = new google.maps.InfoWindow({
            content: `
      <div style="font-family:DM Sans,sans-serif;padding:10px;max-width:220px;">
        <div style="font-weight:700;color:${color};font-size:13px;margin-bottom:6px;">${inc.incident_id || 'Incident'}</div>
        <div><strong>Location:</strong> ${inc.location}</div>
        <div><strong>Type:</strong> ${inc.crisis_type}</div>
        <div><strong>Severity:</strong> ${sev}/10</div>
        <div><strong>Status:</strong> ${inc.status}</div>
      </div>` });
        m.addListener('click', () => iw.open(map, m));
        mapMarkers.push(m);
    });

    fetch(API_URL + '/satellite-alerts').then(r => r.json()).then(data => {
        data.forEach(h => {
            const m = new google.maps.Marker({
                position: { lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) },
                map: map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#DC2626', fillOpacity: 0.8, strokeColor: '#D97706', strokeWeight: 1.5 }
            });
            const iw = new google.maps.InfoWindow({
                content: `
        <div style="font-family:DM Sans,sans-serif;padding:10px;">
          <div style="font-weight:700;color:#DC2626;font-size:12px;margin-bottom:4px;">Satellite Anomaly</div>
          <div><strong>Region:</strong> ${h.region}</div>
          <div><strong>Confidence:</strong> ${h.confidence}</div>
          <div><strong>Date:</strong> ${h.acq_date}</div>
        </div>` });
            m.addListener('click', () => iw.open(map, m));
            mapMarkers.push(m);
        });
    }).catch(() => { });

    fetch(API_URL + '/earthquakes').then(r => r.json()).then(data => {
        data.forEach(eq => {
            let color = '#EAB308';
            let scale = 5;
            if (eq.magnitude > 6.0) {
                color = '#DC2626';
                scale = 10;
            } else if (eq.magnitude >= 4.5) {
                color = '#D97706';
                scale = 8;
            }
            const m = new google.maps.Marker({
                position: { lat: parseFloat(eq.latitude), lng: parseFloat(eq.longitude) },
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: scale,
                    fillColor: color,
                    fillOpacity: 0.8,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 1.5
                }
            });
            const tsunamiHtml = eq.tsunami ? `<div style="margin-top: 4px; color: #DC2626; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Tsunami Warning</div>` : '';
            const iw = new google.maps.InfoWindow({
                content: `
        <div style="font-family:DM Sans,sans-serif;padding:10px;min-width:180px;">
          <div style="font-weight:700;color:${color};font-size:12px;margin-bottom:4px;">Earthquake (Mag: ${eq.magnitude})</div>
          <div><strong>Place:</strong> ${eq.place}</div>
          <div><strong>Depth:</strong> ${eq.depth_km} km</div>
          <div><strong>Time:</strong> ${new Date(eq.time).toLocaleString()}</div>
          ${tsunamiHtml}
        </div>`
            });
            m.addListener('click', () => iw.open(map, m));
            mapMarkers.push(m);
        });
    }).catch(() => { });
}

function plotWeatherOnMap(data) {
    if (!map) return;
    const cityPos = {
        Karachi: { lat: 24.8607, lng: 67.0011 }, Lahore: { lat: 31.5204, lng: 74.3587 },
        Islamabad: { lat: 33.6844, lng: 73.0479 }, Hyderabad: { lat: 25.3960, lng: 68.3578 },
        Peshawar: { lat: 34.0151, lng: 71.5249 }
    };
    data.forEach(c => {
        const pos = cityPos[c.city];
        if (!pos) return;
        const m = new google.maps.Marker({
            position: pos, map: map,
            title: c.city + ' Weather',
            label: { text: c.temperature + 'C', color: '#D97706', fontSize: '11px', fontWeight: '700' },
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 1, fillOpacity: 0, strokeOpacity: 0 }
        });
        const iw = new google.maps.InfoWindow({
            content: `
      <div style="font-family:DM Sans,sans-serif;padding:10px;min-width:160px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${c.city}</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${c.temperature}C</div>
        <div>${c.condition}</div>
        <div>Humidity: ${c.humidity}%</div>
        <div>Wind: ${c.wind_speed} km/h</div>
        <div style="font-weight:600;margin-top:6px;color:${c.flood_risk === 'HIGH' ? '#DC2626' : c.flood_risk === 'MEDIUM' ? '#D97706' : '#059669'};">Flood Risk: ${c.flood_risk}</div>
      </div>` });
        m.addListener('click', () => iw.open(map, m));
        mapMarkers.push(m);
    });
}

// ── ANALYSIS ──────────────────────────────────────────────────────
async function runAnalysis() {
    const transcript = document.getElementById('transcript-input').value.trim();
    const socialRaw = document.getElementById('social-input').value.trim();
    const btn = document.getElementById('triage-btn');
    if (!transcript) { showToast('Enter an emergency transcript before running analysis.', 'err'); return; }
    let social_posts = [];
    if (socialRaw) {
        try { social_posts = JSON.parse(socialRaw); }
        catch { showToast('Social media field contains invalid JSON.', 'err'); return; }
    }
    const stages = ['Agent 1 Ingesting Signal Stream...', 'Agent 2 Fusing and Scoring...', 'Agent 3 Allocating Resources...', 'Agent 4 Executing and Storing...'];
    let step = 0;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + stages[0];
    const iv = setInterval(() => {
        step = (step + 1) % stages.length;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + stages[step];
        document.querySelectorAll('.lc-step').forEach((el, i) => el.classList.toggle('active', i <= step));
    }, 2000);
    try {
        const r = await fetch(API_URL + '/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: uploadedImagePath, transcript, social_posts })
        });
        clearInterval(iv);
        btn.disabled = false; btn.style.opacity = '1';
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Start Analyze and Triage';
        if (!r.ok) throw new Error('Pipeline error');
        const data = await r.json();
        renderResults(data);
        showSection('dashboard');
        showToast('Analysis complete. Incidents detected and logged.', 'ok');
        await refreshAll();
    } catch (e) {
        clearInterval(iv);
        btn.disabled = false; btn.style.opacity = '1';
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Start Analyze and Triage';
        showToast('Analysis failed. Check backend connection.', 'err');
    }
}

function renderResults(data) {
    const panel = document.getElementById('results-panel');
    const content = document.getElementById('results-content');
    if (!panel || !content) return;
    panel.style.display = 'block';
    const incidents = data.incidents || [];
    content.innerHTML = `
    <div style="font-size:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">
      <div>Session: <strong style="font-family:DM Mono,monospace;color:var(--amber);">${data.session_id}</strong></div>
      <div style="margin-top:4px;">Processed: <strong>${data.total_incidents_processed} incidents</strong></div>
    </div>` +
        incidents.map(inc => `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:8px;">
      <div style="font-family:DM Mono,monospace;font-size:11px;color:var(--amber);font-weight:700;margin-bottom:4px;">${inc.incident_id}</div>
      <div style="font-size:11px;display:flex;justify-content:space-between;">
        <span>Status: <strong>${inc.status}</strong></span>
        <span>Ticket: <strong style="font-family:DM Mono,monospace;">${inc.dispatch_ticket?.ticket_id || 'Pending'}</strong></span>
      </div>
    </div>`).join('');
}

function handleFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    uploadedImagePath = 'mock_data/images/' + file.name;
    const zone = document.getElementById('upload-zone');
    const disp = document.getElementById('filename-display');
    const prev = document.getElementById('image-preview-container');
    const thumb = document.getElementById('image-preview-thumb');
    if (zone) zone.classList.add('has-file');
    if (disp) disp.textContent = file.name + ' selected';
    if (prev && thumb) {
        const reader = new FileReader();
        reader.onload = e => { thumb.src = e.target.result; prev.style.display = 'block'; };
        reader.readAsDataURL(file);
    }
}

function updateCharCount(tid, cid) {
    const t = document.getElementById(tid);
    const c = document.getElementById(cid);
    if (t && c) c.textContent = t.value.length + ' characters';
}

function loadDemoScenario(type) {
    const tr = document.getElementById('transcript-input');
    const so = document.getElementById('social-input');
    if (type === 'flood') {
        tr.value = 'EMERGENCY: Water has breached residential gates in Gulshan-e-Iqbal blocks 13 and 14. Multiple families are trapped on upper floors. Flash flooding from heavy rainfall. Need rescue boats immediately.';
        so.value = JSON.stringify([
            { id: 's1', text: 'Roads completely underwater near NIPA Chowrangi in Gulshan. Cars are submerged. Please avoid area.', platform: 'Twitter', timestamp: '2026-05-17T11:00:00Z', location_mention: 'Gulshan-e-Iqbal, Karachi', likes: 1200, verified: true },
            { id: 's2', text: 'Families stranded on rooftops in Gulshan block 13. Water level rising rapidly. Urgent help needed.', platform: 'Facebook', timestamp: '2026-05-17T11:02:00Z', location_mention: 'Gulshan', likes: 350, verified: false },
            { id: 's3', text: 'Flash flood confirmed in Gulshan-e-Iqbal. PDMA teams requested.', platform: 'Twitter', timestamp: '2026-05-17T11:05:00Z', location_mention: 'Gulshan-e-Iqbal', likes: 2100, verified: true }
        ], null, 2);
        showToast('Gulshan Flood scenario loaded.', 'ok');
    } else {
        tr.value = 'Alert from G-9 Markaz. Large amount of water flooding the streets. Caller believes it may be a burst water main rather than natural flooding. Road is blocked and traffic is backed up.';
        so.value = JSON.stringify([
            { id: 's1', text: 'Not a flood in G-9. Main water pipeline burst near the roundabout. KWSB needs to respond.', platform: 'Twitter', timestamp: '2026-05-17T11:15:00Z', location_mention: 'Islamabad', likes: 12, verified: false },
            { id: 's2', text: 'Broken pipe in G-9 causing flooding. Stop spreading panic about a flood.', platform: 'Facebook', timestamp: '2026-05-17T11:18:00Z', location_mention: 'G-9, Islamabad', likes: 4, verified: false }
        ], null, 2);
        showToast('Conflict check scenario loaded.', 'ok');
    }
    updateCharCount('transcript-input', 'transcript-counter');
    updateCharCount('social-input', 'social-counter');
}

// ── SECTION SWITCH ────────────────────────────────────────────────
function onSectionSwitch(id) {
    if (id === 'incidents') loadIncidents();
    if (id === 'logs') loadLogs();
    if (id === 'resources') loadResources();
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, type) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function timeSince(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " years ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hours ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " mins ago";
    if (seconds < 0 || isNaN(seconds)) return "just now";
    return Math.floor(seconds) + " secs ago";
}

async function loadEarthquakes() {
    try {
        const r = await fetch(API_URL + '/earthquakes');
        if (!r.ok) return;
        const data = await r.json();
        const el = document.getElementById('earthquake-strip');
        if (!el) return;
        if (!data || !data.length) {
            el.innerHTML = '<div style="padding: 10px; color: var(--text-sub); font-size: 12px;">No recent earthquakes detected near Pakistan.</div>';
            return;
        }
        el.innerHTML = data.map(eq => {
            const riskClass = eq.severity === 'critical' ? 'risk-high' : eq.severity === 'moderate' ? 'risk-medium' : 'risk-low';
            return `
      <div class="weather-card">
        <div class="weather-city" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${eq.place}">${eq.place}</div>
        <div class="weather-temp-row">
          <span class="weather-temp" style="color: ${eq.magnitude >= 6.0 ? 'var(--red)' : eq.magnitude >= 4.5 ? 'var(--amber)' : 'var(--teal)'};">${eq.magnitude.toFixed(1)}</span>
          <span class="weather-icon-text" style="font-size:12px;color:var(--text-sub);">Mag</span>
        </div>
        <div class="weather-meta">
          <span>Depth: ${eq.depth_km} km</span>
          <span>Time: ${timeSince(eq.time)}</span>
        </div>
        <span class="weather-risk ${riskClass}">${eq.severity.toUpperCase()}</span>
      </div>`;
        }).join('');
    } catch (e) { console.error('Earthquakes:', e); }
}

async function loadThreatAssessment() {
    try {
        const r = await fetch(API_URL + '/threat-assessment');
        if (!r.ok) return;
        const d = await r.json();
        const level = d.overall_threat_level || 'LOW';
        const badge = document.getElementById('threat-level');
        if (badge) {
            badge.textContent = level;
            if (level === 'CRITICAL') {
                badge.style.background = 'var(--red-bg)';
                badge.style.color = 'var(--red)';
                badge.style.borderColor = 'var(--red)';
            } else if (level === 'HIGH') {
                badge.style.background = 'var(--amber-bg)';
                badge.style.color = 'var(--amber)';
                badge.style.borderColor = 'var(--amber)';
            } else if (level === 'MEDIUM') {
                badge.style.background = 'var(--blue-bg)';
                badge.style.color = 'var(--blue)';
                badge.style.borderColor = 'var(--blue)';
            } else {
                badge.style.background = 'var(--teal-bg)';
                badge.style.color = 'var(--teal)';
                badge.style.borderColor = 'var(--teal)';
            }
        }
        const wCount = document.getElementById('threat-weather-count');
        const qCount = document.getElementById('threat-quake-count');
        const sCount = document.getElementById('threat-satellite-count');
        if (wCount) wCount.textContent = d.active_weather_alerts || 0;
        if (qCount) qCount.textContent = (d.recent_earthquakes ? d.recent_earthquakes.length : 0);
        if (sCount) sCount.textContent = (d.satellite_hotspots ? d.satellite_hotspots.length : 0);
    } catch (e) { console.error('Threat assessment:', e); }
}