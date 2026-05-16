const API_BASE = ""; // Use relative paths for Flask

// --- Navigation ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(sectionId).classList.add('active');
    
    // Desktop Nav
    const sidebarNav = document.querySelector(`.sidebar .nav-item[onclick="showSection('${sectionId}')"]`);
    if (sidebarNav) sidebarNav.classList.add('active');
    
    // Mobile Nav
    const bottomNav = document.querySelector(`.bottom-nav .bottom-nav-item[onclick="showSection('${sectionId}')"]`);
    if (bottomNav) bottomNav.classList.add('active');

    // Section specific loads
    if (sectionId === 'logs') fetchLogs();
    if (sectionId === 'resources') renderResources();
}

// --- Data Fetching ---
async function fetchIncidents() {
    try {
        const res = await fetch(`${API_BASE}/incidents`);
        const data = await res.json();
        renderDashboard(data);
        renderIncidentsList(data);
    } catch (err) {
        showToast("Failed to fetch incidents", "error");
    }
}

async function fetchLogs() {
    try {
        const res = await fetch(`${API_BASE}/agent-logs`);
        const logs = await res.json();
        const container = document.getElementById('logs-list');
        
        if (logs.length === 0) {
            container.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-muted);">No reasoning logs found.</p></div>`;
            return;
        }

        container.innerHTML = logs.reverse().map(log => `
            <div class="card" style="margin-bottom: 12px; font-family: monospace; font-size: 13px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--primary); font-weight:700;">${log.agent_name}</span>
                    <span style="color:var(--text-muted);">Step ${log.step}</span>
                </div>
                <div style="margin-bottom:4px;"><span style="color:var(--info);">[Observation]</span> ${log.observation}</div>
                <div style="margin-bottom:4px;"><span style="color:var(--stable);">[Reasoning]</span> ${log.reasoning}</div>
                <div style="margin-bottom:4px;"><span style="color:var(--primary);">[Decision]</span> ${log.decision}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">${new Date(log.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (err) {
        showToast("Failed to fetch logs", "error");
    }
}

// --- Rendering ---
function renderDashboard(incidents) {
    const statsContainer = document.getElementById('dashboard-stats');
    const activeCount = incidents.filter(i => i.status === 'responding').length;
    const resourcesCount = incidents.reduce((acc, i) => acc + Object.values(i.resource_assignment || {}).reduce((a, b) => a + b, 0), 0);

    statsContainer.innerHTML = `
        <div class="card stat-card">
            <span class="stat-label">Active Incidents</span>
            <span class="stat-value critical">${activeCount}</span>
        </div>
        <div class="card stat-card">
            <span class="stat-label">Resources Deployed</span>
            <span class="stat-value warning">${resourcesCount}</span>
        </div>
        <div class="card stat-card">
            <span class="stat-label">System Status</span>
            <span class="stat-value stable">STABLE</span>
        </div>
        <div class="card stat-card">
            <span class="stat-label">Last Updated</span>
            <span class="stat-value info">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `;

    const dashboardIncidents = document.getElementById('dashboard-incidents');
    const highPriority = incidents
        .sort((a, b) => b.severity_score - a.severity_score)
        .slice(0, 3);

    dashboardIncidents.innerHTML = highPriority.map(renderIncidentCard).join('');
}

function renderIncidentsList(incidents) {
    const container = document.getElementById('all-incidents-list');
    container.innerHTML = incidents
        .sort((a, b) => b.severity_score - a.severity_score)
        .map(renderIncidentCard).join('');
}

function renderIncidentCard(i) {
    const severityClass = i.severity_score > 7 ? 'critical' : (i.severity_score > 4 ? 'moderate' : 'low');
    const resources = Object.entries(i.resource_assignment || {})
        .map(([k, v]) => `${v} ${k.split('_')[0]}`).join(', ') || 'None';

    return `
        <div class="card incident-card ${severityClass}">
            <div class="incident-header">
                <div>
                    <div class="incident-title">${i.crisis_type.toUpperCase()}</div>
                    <div style="font-size:14px; color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${i.location}</div>
                </div>
                <div style="text-align: right;">
                    <div class="severity-score ${severityClass}">${i.severity_score.toFixed(1)}</div>
                    <div class="status-chip ${i.status}">${i.status.replace('_', ' ')}</div>
                </div>
            </div>
            
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${i.severity_score * 10}%"></div>
                </div>
            </div>

            <div class="incident-meta">
                <span><i class="fa-solid fa-users"></i> Pop: ~${i.affected_population || 'Unknown'}</span>
                <span><i class="fa-solid fa-shield-heart"></i> Confidence: ${Math.round((i.confidence || 0.8) * 100)}%</span>
            </div>

            <div style="font-size: 13px; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
                <strong>Resources:</strong> ${resources}
            </div>

            <div class="btn-group">
                <button class="btn btn-primary" onclick="showToast('Dispatch sequence initiated', 'success')">DISPATCH</button>
                <button class="btn btn-secondary" onclick="toggleDetails('${i.incident_id}')">VIEW DETAILS</button>
            </div>

            <div id="details-${i.incident_id}" style="display:none; margin-top: 20px; border-top: 1px solid var(--border-card); padding-top: 20px;">
                <h4>Allocation Reasoning</h4>
                <p style="font-size:14px; color:var(--text-muted);">${i.allocation_reasoning}</p>
                
                <h4>Public Notification</h4>
                <p style="font-size:14px; color:var(--primary); font-style: italic;">"${i.public_notification}"</p>
                
                <h4>Stakeholder Alerts</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                    <div class="card" style="padding:10px;"><strong>Hospital:</strong> ${i.hospital_alert}</div>
                    <div class="card" style="padding:10px;"><strong>Traffic:</strong> Redirected</div>
                </div>
            </div>
        </div>
    `;
}

function toggleDetails(id) {
    const el = document.getElementById(`details-${id}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderResources() {
    const pool = {
        "ambulances": 5,
        "rescue_teams": 3,
        "police_units": 4,
        "water_tankers": 2
    };
    
    const container = document.getElementById('resource-pool-display');
    container.innerHTML = Object.entries(pool).map(([type, total]) => `
        <div style="margin-bottom: 32px;">
            <h3 style="text-transform: capitalize; border-bottom: 1px solid var(--border-card); padding-bottom: 8px;">${type.replace('_', ' ')} (${total})</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 12px;">
                ${Array.from({length: total}).map((_, i) => `
                    <div class="card" style="padding:12px; text-align:center;">
                        <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${type.split('_')[0].toUpperCase()}-${i+1}</div>
                        <div class="status-chip responding" style="font-size:10px;">AVAILABLE</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// --- Analysis Logic ---
let selectedFile = "mock_data/images/test.jpg";

async function runAnalysis() {
    const transcript = document.getElementById('transcript-input').value;
    const socialText = document.getElementById('social-input').value;
    let socialPosts = [];
    
    try {
        if (socialText) socialPosts = JSON.parse(socialText);
    } catch (e) {
        showToast("Invalid JSON in social posts", "error");
        return;
    }

    document.getElementById('analysis-loading').style.display = 'block';
    document.getElementById('analysis-results').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: selectedFile,
                transcript: transcript,
                social_posts: socialPosts
            })
        });
        
        const data = await res.json();
        showToast("Analysis Complete", "success");
        renderAnalysisResults(data);
        fetchIncidents(); // Refresh lists
    } catch (err) {
        showToast("Analysis Failed", "error");
    } finally {
        document.getElementById('analysis-loading').style.display = 'none';
    }
}

function renderAnalysisResults(report) {
    const container = document.getElementById('analysis-results');
    const content = document.getElementById('results-content');
    container.style.display = 'block';
    
    content.innerHTML = `
        <p style="color:var(--stable); font-weight:700;">Pipeline Session: ${report.session_id}</p>
        <p>Total Incidents Processed: ${report.total_incidents_processed}</p>
        <div style="margin-top: 16px;">
            ${report.incidents.map(inc => `
                <div class="card" style="margin-bottom: 8px; border-left: 3px solid var(--primary);">
                    <strong>${inc.incident_id}</strong> - Status: ${inc.status}
                    <div style="font-size:12px; color:var(--text-muted);">Ticket: ${inc.dispatch_ticket.ticket_id} | ETA: ${inc.dispatch_ticket.estimated_arrival_minutes}m</div>
                </div>
            `).join('')}
        </div>
    `;
}

// --- Utils ---
function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    fetchIncidents();
    setInterval(fetchIncidents, 30000);

    // Mock file select
    document.getElementById('upload-zone').addEventListener('click', () => {
        document.getElementById('filename-display').innerText = "Selected: test.jpg (Mock)";
        showToast("Imagery Selected", "success");
    });
});
