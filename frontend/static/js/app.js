// ── MDTS CIRO — app.js ──────────────────────────────────────────
const API_URL = ''; // Same origin requests

// Active filter state
let currentIncidentFilter = 'ALL';
let currentLogFilter = 'ALL';
let allIncidents = [];
let allLogs = [];
let uploadedImagePath = 'mock_data/images/test.jpg';

// ── DOM Initializer ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Start clock
    startPakistanClock();

    // Load main views
    refreshAllData();

    // Initial character counters
    updateCharCount('transcript-input', 'transcript-counter');
    updateCharCount('social-input', 'social-counter');

    // Auto refresh stats/dashboard every 25 seconds
    setInterval(refreshAllData, 25000);
});

// ── Clock & Telemetry ───────────────────────────────────────────
function startPakistanClock() {
    const clockEl = document.getElementById('pk-clock');
    if (!clockEl) return;

    setInterval(() => {
        // Compute PK time (UTC + 5)
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pkTime = new Date(utc + (3600000 * 5));
        
        const hrs = String(pkTime.getHours()).padStart(2, '0');
        const mins = String(pkTime.getMinutes()).padStart(2, '0');
        const secs = String(pkTime.getSeconds()).padStart(2, '0');
        
        clockEl.textContent = `PAKISTAN COMMAND TIME: ${hrs}:${mins}:${secs}`;
    }, 1000);
}

// ── Refresh stats & dashboard ────────────────────────────────────
async function refreshAllData() {
    try {
        await loadStats();
        await fetchIncidents();
        await fetchLogs();
        await fetchResources();
    } catch (e) {
        console.error("System sync failed: ", e);
    }
}

// ── Stats Loader & Animation ─────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error("Stats API unavailable");
        const stats = await res.json();

        // Animate numbers counting up from 0 to targets
        animateNumberValue('stat-incidents', stats.total_incidents, 0);
        animateNumberValue('stat-resources', stats.resources_deployed, 0);
        animateNumberValue('stat-avg-severity', stats.avg_severity, 1);
        
        // Update dashboard comparison banner text contextually
        const compBase = document.getElementById('comp-base-summary');
        const compAgent = document.getElementById('comp-agentic-summary');
        if (stats.total_incidents > 0) {
            if (compBase) compBase.textContent = `1 Cluster Detected (All resources to heaviest source)`;
            if (compAgent) compAgent.textContent = `${stats.total_incidents} Clusters Dynamically Triaged (Proportional deployment)`;
        }
    } catch (e) {
        console.error("Stats fetching error: ", e);
    }
}

function animateNumberValue(id, target, decimals = 0) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const start = parseFloat(el.textContent) || 0;
    const duration = 1000; // 1s animation
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out quad
        const ease = progress * (2 - progress);
        const current = start + (target - start) * ease;
        
        el.textContent = current.toFixed(decimals);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// ── Character Counters & Upload Selectors ───────────────────────
function updateCharCount(textareaId, counterId) {
    const textEl = document.getElementById(textareaId);
    const counterEl = document.getElementById(counterId);
    if (textEl && counterEl) {
        counterEl.textContent = `${textEl.value.length} characters`;
    }
}

function handleFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    // Set uploaded filename
    uploadedImagePath = `mock_data/images/${file.name}`;
    
    // UI Feedback styling
    const zone = document.getElementById('upload-zone');
    const display = document.getElementById('filename-display');
    if (zone) zone.classList.add('has-file');
    if (display) display.textContent = `✓ ${file.name}`;
    
    // Show image preview thumbnail
    const previewContainer = document.getElementById('image-preview-container');
    const previewThumb = document.getElementById('image-preview-thumb');
    
    if (previewContainer && previewThumb) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewThumb.src = e.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
}

// ── Triage Ingestion Invocator ──────────────────────────────────
async function runAnalysis() {
    const transcript = document.getElementById('transcript-input').value.trim();
    const socialRaw = document.getElementById('social-input').value.trim();
    const btn = document.getElementById('triage-btn');

    let social_posts = [];
    if (socialRaw) {
        try {
            social_posts = JSON.parse(socialRaw);
        } catch(e) {
            showToast("Invalid JSON array formatted inside Social Media input field.", "err");
            return;
        }
    }

    if (!transcript) {
        showToast("Please enter an emergency voice transcript before initiating triage.", "err");
        return;
    }

    // Set Loading state with status text cycler
    btn.classList.add('disabled');
    btn.disabled = true;
    
    const statuses = [
        "AGENT 1 INGESTING LIVE SIGNAL STREAM...",
        "AGENT 2 DYNAMIC FUSION & SCORING...",
        "AGENT 3 PROPORTIONAL RESOURCE DISPATCHING...",
        "AGENT 4 AUDITING STATE & RECORDING LOGS..."
    ];
    let step = 0;
    btn.innerHTML = `<span class="loading-spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span> ${statuses[0]}`;
    
    const intervalId = setInterval(() => {
        step = (step + 1) % statuses.length;
        btn.innerHTML = `<span class="loading-spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span> ${statuses[step]}`;
        
        // Update Agent timeline active states inside agent logs tab preview
        const vizSteps = document.querySelectorAll('.viz-step');
        vizSteps.forEach((vs, idx) => {
            if (idx <= step) vs.classList.add('active');
            else vs.classList.remove('active');
        });
    }, 2000);

    try {
        const res = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: uploadedImagePath,
                transcript: transcript,
                social_posts: social_posts
            })
        });

        clearInterval(intervalId);
        btn.classList.remove('disabled');
        btn.disabled = false;
        btn.textContent = "⚡ START ANALYZE & TRIAGE";

        if (!res.ok) throw new Error("Pipeline returned error code");
        const report = await res.json();
        
        // Switch view to dashboard on finish
        showSection('dashboard');
        showToast("System Ingestion and Incident Triage complete!", "ok");
        
        // Render reports inside side laboratory panel
        renderLabResults(report);
        
        // Force refresh all layouts
        refreshAllData();
    } catch (e) {
        clearInterval(intervalId);
        btn.classList.remove('disabled');
        btn.disabled = false;
        btn.textContent = "⚡ START ANALYZE & TRIAGE";
        showToast("Signal analysis failed — Backend connection issue.", "err");
        console.error(e);
    }
}

function renderLabResults(data) {
    const panel = document.getElementById('results-panel');
    const content = document.getElementById('results-content');
    if (!panel || !content) return;

    panel.classList.add('visible');
    const incidents = data.incidents || [];
    
    let html = `
    <div style="font-size:12px; margin-bottom:12px; padding-bottom:10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div>Session ID: <strong class="mono" style="color:var(--amber);">${data.session_id}</strong></div>
        <div style="margin-top:4px;">Processed: <strong class="mono">${data.total_incidents_processed} Incidents</strong></div>
    </div>`;

    incidents.forEach(inc => {
        html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:10px; margin-top:8px;">
            <div class="mono" style="font-size:11px; color:var(--amber); font-weight:700;">${inc.incident_id}</div>
            <div style="font-size:11px; margin-top:4px; display:flex; justify-content:space-between;">
                <span>Status: <strong style="text-transform:uppercase;">${inc.status}</strong></span>
                <span>Ticket: <strong class="mono">${inc.dispatch_ticket?.ticket_id || 'PENDING'}</strong></span>
            </div>
        </div>`;
    });
    
    content.innerHTML = html;
}

// ── Incidents Filtering & Layouts ────────────────────────────────
async function fetchIncidents() {
    try {
        const res = await fetch(`${API_URL}/incidents`);
        if (!res.ok) throw new Error("Fail");
        allIncidents = await res.json();
        
        // Update Pure CSS Severity Distribution Chart
        updateSeverityDistributionChart(allIncidents);

        // Update dashboard incident list
        const dashContainer = document.getElementById('dashboard-incidents-list');
        if (dashContainer) {
            if (allIncidents.length === 0) {
                dashContainer.innerHTML = `<div class="empty"><div class="empty-icon">📡</div><div class="empty-text">No active incidents tracked. Ingest signals in the Analyze Lab.</div></div>`;
            } else {
                const highPriority = allIncidents
                    .sort((a,b) => b.severity_score - a.severity_score)
                    .slice(0, 3);
                dashContainer.innerHTML = highPriority.map(inc => renderIncidentCard(inc, false)).join('');
            }
        }

        // Render main list under incidents view
        renderFilteredIncidents();
    } catch(e) {
        console.error("Incidents load error: ", e);
    }
}

function updateSeverityDistributionChart(incidents) {
    const total = incidents.length || 1;
    let crit = 0, mod = 0, low = 0;
    
    incidents.forEach(inc => {
        const s = inc.severity_score;
        if (s > 7.0) crit++;
        else if (s >= 4.0) mod++;
        else low++;
    });

    const cPercent = Math.round((crit / total) * 100);
    const mPercent = Math.round((mod / total) * 100);
    const lPercent = Math.round((low / total) * 100);

    const cVal = document.getElementById('dist-critical-count');
    const cBar = document.getElementById('dist-critical-bar');
    if (cVal && cBar) {
        cVal.textContent = `${crit} Incident${crit !== 1 ? 's' : ''} (${cPercent}%)`;
        cBar.style.width = `${cPercent}%`;
    }

    const mVal = document.getElementById('dist-moderate-count');
    const mBar = document.getElementById('dist-moderate-bar');
    if (mVal && mBar) {
        mVal.textContent = `${mod} Incident${mod !== 1 ? 's' : ''} (${mPercent}%)`;
        mBar.style.width = `${mPercent}%`;
    }

    const lVal = document.getElementById('dist-low-count');
    const lBar = document.getElementById('dist-low-bar');
    if (lVal && lBar) {
        lVal.textContent = `${low} Incident${low !== 1 ? 's' : ''} (${lPercent}%)`;
        lBar.style.width = `${lPercent}%`;
    }
}

function filterIncidents(filter) {
    currentIncidentFilter = filter;
    
    // Toggle active filter button
    const buttons = document.querySelectorAll('.filter-bar button');
    buttons.forEach(btn => {
        if (btn.textContent.includes(filter) || (filter === 'ALL' && btn.textContent.includes('ALL'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderFilteredIncidents();
}

function renderFilteredIncidents() {
    const listEl = document.getElementById('all-incidents-list');
    if (!listEl) return;

    let filtered = [...allIncidents];
    if (currentIncidentFilter === 'CRITICAL') {
        filtered = allIncidents.filter(i => i.severity_score > 7.0);
    } else if (currentIncidentFilter === 'MODERATE') {
        filtered = allIncidents.filter(i => i.severity_score >= 4.0 && i.severity_score <= 7.0);
    } else if (currentIncidentFilter === 'LOW') {
        filtered = allIncidents.filter(i => i.severity_score < 4.0);
    } else if (currentIncidentFilter === 'responding') {
        filtered = allIncidents.filter(i => i.status === 'responding');
    } else if (currentIncidentFilter === 'verification_required') {
        filtered = allIncidents.filter(i => i.status === 'verification_required');
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-text">No active incidents matching '${currentIncidentFilter}' status.</div></div>`;
        return;
    }

    listEl.innerHTML = filtered.map(inc => renderIncidentCard(inc, true)).join('');
}

function renderIncidentCard(inc, expanded = false) {
    let color = 'var(--teal)';
    let colorClass = 'low';
    if (inc.severity_score > 7.0) {
        color = 'var(--red)';
        colorClass = 'critical';
    } else if (inc.severity_score >= 4.0) {
        color = 'var(--amber)';
        colorClass = 'moderate';
    }

    const confPercent = Math.round((inc.confidence || 0.75) * 100);
    const affectedVal = inc.affected_population || 6500;
    const spreadRiskVal = inc.spread_risk || "medium";
    const statusVal = inc.status || "monitoring";

    // Build resources allocated list
    let resourcesHTML = '';
    if (inc.resource_assignment && Object.keys(inc.resource_assignment).length > 0) {
        resourcesHTML = Object.entries(inc.resource_assignment)
            .map(([k, v]) => `<strong>${v}</strong> ${k.replace('_', ' ')}`)
            .join(' · ');
    } else {
        resourcesHTML = 'None';
    }

    let innerContent = '';
    if (!expanded) {
        innerContent = `
        <div class="ic-content">
            <div class="ic-header">
                <div>
                    <div class="ic-type">${(inc.crisis_type || 'UNKNOWN').toUpperCase()}</div>
                    <div class="ic-loc mono"><i class="fa-solid fa-location-crosshairs" style="color:var(--amber);"></i> ${inc.location || 'Unknown Location'}</div>
                </div>
                <div class="ic-sev-container">
                    <div class="ic-sev-value" style="color: ${color};">${inc.severity_score}</div>
                    <div class="ic-sev-lbl">Severity</div>
                </div>
            </div>
            <div class="ic-metrics">
                <div class="ic-metric"><i class="fa-solid fa-users"></i> Pop: <strong>${affectedVal.toLocaleString()}</strong></div>
                <div class="ic-metric">
                    <span class="mono">Conf: ${confPercent}%</span>
                    <div class="ic-progress-wrap">
                        <div class="ic-progress-bar"><div class="ic-progress-fill" style="background:${color}; width:${confPercent}%"></div></div>
                    </div>
                </div>
            </div>
            <div class="ic-footer">
                <span class="status-chip ${statusVal}"><div class="dot" style="background:${color}; box-shadow: 0 0 8px ${color};"></div> ${statusVal.replace('_', ' ')}</span>
                <div class="ic-actions">
                    <button class="btn btn-primary" onclick="showSection('incidents')">VIEW STAMP</button>
                </div>
            </div>
        </div>`;
    } else {
        // Fully Expanded view with timeline traces, stakeholder messages grid, and verification banner
        const hospitalAlert = inc.hospital_alert || "Jinnah Hospital";
        const reroutingAlert = inc.traffic_rerouting || "Diversion in place";
        const publicNotification = inc.public_notification || "Emergency response teams dispatched.";

        // Default stakeholder messages in case Gemini output is stored as subfields or missing
        const publicMsg = publicNotification;
        const hospitalMsg = `Emergency ward alerted at ${hospitalAlert}. Preparing for priority arrivals.`;
        const utilityMsg = `SNGPL & KESC warning: Precautionary shutoff checklist initiated for nearby pipelines at ${inc.location}.`;
        const mediaMsg = `Media bulletin: Response operations initiated at ${inc.location} following high-accuracy spatial signal fusion.`;

        innerContent = `
        <div class="ic-content">
            <div class="ic-header">
                <div>
                    <div class="ic-type" style="font-size: 22px;">${(inc.crisis_type || 'UNKNOWN').toUpperCase()}</div>
                    <div class="ic-loc mono" style="font-size: 13px; margin-top: 4px;"><i class="fa-solid fa-location-crosshairs" style="color:var(--amber);"></i> ${inc.location || 'Unknown Location'}</div>
                </div>
                <div class="ic-sev-container">
                    <div class="ic-sev-value" style="font-size: 42px; color: ${color};">${inc.severity_score}</div>
                    <div class="ic-sev-lbl">Severity Score</div>
                </div>
            </div>

            <!-- Incidents expanded layout grid -->
            <div class="expanded-panel">
                <div class="field-grid">
                    <div class="field-block">
                        <div class="field-lbl">Affected Population</div>
                        <div class="field-val"><i class="fa-solid fa-user-group" style="color:var(--amber); margin-right: 6px;"></i> ${affectedVal.toLocaleString()} estimated</div>
                    </div>
                    <div class="field-block">
                        <div class="field-lbl">Spread &amp; Cascade Risk</div>
                        <div class="field-val"><i class="fa-solid fa-arrow-trend-up" style="color:var(--red); margin-right: 6px;"></i> ${spreadRiskVal.toUpperCase()} RISK</div>
                    </div>
                    <div class="field-block">
                        <div class="field-lbl">FUSED FLEET ALLOCATIONS</div>
                        <div class="field-val"><i class="fa-solid fa-truck-moving" style="color:var(--teal); margin-right: 6px;"></i> ${resourcesHTML}</div>
                    </div>
                    <div class="field-block">
                        <div class="field-lbl">AI ALLOCATION REASONING</div>
                        <div class="field-val" style="font-size: 11px; line-height: 1.4; color: var(--text-muted);">${inc.allocation_reasoning || 'Monitoring status only. No active allocation triggers.'}</div>
                    </div>
                </div>

                <!-- Agent trace timeline visual -->
                <div class="mono" style="font-size: 10px; color: var(--text-muted); margin-bottom: 10px; font-weight: 700; text-transform: uppercase;">Agent Ingestion Tracing</div>
                <div class="trace-timeline">
                    <div class="trace-item">
                        <div class="trace-dot done" style="border-color:var(--blue); background:var(--blue);"></div>
                        <div class="trace-agent" style="color:var(--blue);">AGENT 1 — SIGNAL INGESTION</div>
                        <div class="trace-action">Fusing visual drone footage and call streams. Accuracy: ${confPercent}%</div>
                    </div>
                    <div class="trace-item">
                        <div class="trace-dot done" style="border-color:var(--amber); background:var(--amber);"></div>
                        <div class="trace-agent" style="color:var(--amber);">AGENT 2 — GEOSPATIAL FUSION</div>
                        <div class="trace-action">${inc.conflict_detected ? '⚠️ CONFLICT REPORT RESOLVED: Bursted line identified.' : 'No geographical conflicts verified.'}</div>
                    </div>
                    <div class="trace-item">
                        <div class="trace-dot done" style="border-color:var(--teal); background:var(--teal);"></div>
                        <div class="trace-agent" style="color:var(--teal);">AGENT 3 — FLEET DESK</div>
                        <div class="trace-action">Proportional fleets allocated. Diverting logistics around NIPA corridors.</div>
                    </div>
                    <div class="trace-item">
                        <div class="trace-dot ${statusVal === 'responding' ? 'done' : 'pending'}" style="border-color:var(--red); ${statusVal === 'responding' ? 'background:var(--red);' : ''}"></div>
                        <div class="trace-agent" style="color:var(--red);">AGENT 4 — RUNTIMES</div>
                        <div class="trace-action">Records logged to database document ID: <span class="mono">${inc.id || 'INC_001'}</span></div>
                    </div>
                </div>

                <!-- 2x2 Stakeholder alert grid -->
                <div class="mono" style="font-size: 10px; color: var(--text-muted); margin-bottom: 10px; font-weight: 700; text-transform: uppercase;">Tailored Stakeholder Broadcasts</div>
                <div class="stakeholder-grid">
                    <div class="sh-card">
                        <div class="sh-icon"><i class="fa-solid fa-bullhorn" style="color: var(--amber);"></i></div>
                        <div class="sh-info">
                            <div class="sh-lbl">Public Alert</div>
                            <div class="sh-text">${publicMsg}</div>
                            <div class="sh-status">📡 Broadcast Sim Sent</div>
                        </div>
                    </div>
                    <div class="sh-card">
                        <div class="sh-icon"><i class="fa-solid fa-square-h" style="color: var(--red);"></i></div>
                        <div class="sh-info">
                            <div class="sh-lbl">Hospital Dispatch</div>
                            <div class="sh-text">${hospitalMsg}</div>
                            <div class="sh-status">🏥 Alert Acknowledged</div>
                        </div>
                    </div>
                    <div class="sh-card">
                        <div class="sh-icon"><i class="fa-solid fa-bolt-lightning" style="color: var(--amber);"></i></div>
                        <div class="sh-info">
                            <div class="sh-lbl">Utilities Checklist</div>
                            <div class="sh-text">${utilityMsg}</div>
                            <div class="sh-status">⚡ Auto isolation checklist queued</div>
                        </div>
                    </div>
                    <div class="sh-card">
                        <div class="sh-icon"><i class="fa-solid fa-camera" style="color: var(--blue);"></i></div>
                        <div class="sh-info">
                            <div class="sh-lbl">Press Bureau</div>
                            <div class="sh-text">${mediaMsg}</div>
                            <div class="sh-status">🎥 Live RSS feed published</div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Verification Banner -->
                ${statusVal === 'responding'
                    ? `<div class="dispatch-banner"><i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> DISPATCH SIMULATION LOCKED - EN ROUTE</div>`
                    : `<div class="dispatch-banner awaiting"><i class="fa-solid fa-circle-pause" style="margin-right: 6px;"></i> AWAITING GEOSPATIAL FIELD VERIFICATION</div>`
                }
            </div>
        </div>`;
    }

    return `
    <div class="incident-card" style="--accent-color: ${color};">
        ${innerContent}
    </div>`;
}

// ── Fleet Resource Utilization Rates ──────────────────────────────
async function fetchResources() {
    try {
        const res = await fetch(`${API_URL}/incidents`);
        if (!res.ok) throw new Error("Err");
        const incidents = await res.json();
        
        // Define fixed counts
        const limits = {
            ambulances: 5,
            rescue_teams: 3,
            police_units: 4,
            water_tankers: 2
        };

        const deployed = {
            ambulances: 0,
            rescue_teams: 0,
            police_units: 0,
            water_tankers: 0
        };

        incidents.forEach(inc => {
            if (inc.status === 'responding' && inc.resource_assignment) {
                Object.entries(inc.resource_assignment).forEach(([k, v]) => {
                    if (deployed.hasOwnProperty(k)) {
                        deployed[k] += parseInt(v) || 0;
                    }
                });
            }
        });

        // Constrain deployed counts to maximum limits
        let totalDeployed = 0;
        let totalLimit = 14; // 5 + 3 + 4 + 2

        Object.keys(limits).forEach(key => {
            deployed[key] = Math.min(deployed[key], limits[key]);
            totalDeployed += deployed[key];

            const pct = Math.round((deployed[key] / limits[key]) * 100);
            
            // Update utilization text
            const pctEl = document.getElementById(`util-${key}`);
            const barEl = document.getElementById(`util-bar-${key}`);
            if (pctEl) pctEl.textContent = `${pct}% DEPLOYED`;
            if (barEl) barEl.style.width = `${pct}%`;

            // Draw unit capsules
            const capsuleContainer = document.getElementById(`units-${key}`);
            if (capsuleContainer) {
                let capsulesHTML = '';
                for (let i = 1; i <= limits[key]; i++) {
                    const isDeployed = i <= deployed[key];
                    const unitName = `${key.slice(0,3).toUpperCase()}-${String(i).padStart(2,'0')}`;
                    capsulesHTML += `<div class="unit-capsule ${isDeployed ? 'deployed' : ''}">${unitName}</div>`;
                }
                capsuleContainer.innerHTML = capsulesHTML;
            }
        });

        // Update overall summary bar
        const summaryVal = document.getElementById('res-summary-val');
        if (summaryVal) {
            summaryVal.textContent = `ACTIVE SHIELD: ${totalDeployed} UNITS DEPLOYED · ${totalLimit - totalDeployed} UNITS STANDBY`;
        }

    } catch(e) {
        console.error("Resources fetching failed: ", e);
    }
}

// ── Agent Audit Logs Layouts & Filters ──────────────────────────
async function fetchLogs() {
    try {
        const res = await fetch(`${API_URL}/agent-logs`);
        if (!res.ok) throw new Error("Fail");
        allLogs = await res.json();
        
        renderFilteredLogs();
    } catch(e) {
        console.error("Logs load failed: ", e);
    }
}

function filterLogs(filter) {
    currentLogFilter = filter;
    
    // Toggle active filter button
    const buttons = document.querySelectorAll('#logs .filter-bar button');
    buttons.forEach(btn => {
        if (btn.textContent.includes(filter) || (filter === 'ALL' && btn.textContent.includes('ALL'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderFilteredLogs();
}

function renderFilteredLogs() {
    const listEl = document.getElementById('logs-list-container');
    if (!listEl) return;

    let filtered = [...allLogs];
    if (currentLogFilter !== 'ALL') {
        filtered = allLogs.filter(l => l.agent_name === currentLogFilter);
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty"><div class="empty-icon">≡</div><div class="empty-text">No active audit logs matching '${currentLogFilter}'.</div></div>`;
        return;
    }

    listEl.innerHTML = filtered.map(log => {
        let agentClass = 'agent-2';
        if (log.agent_name.includes('Ingestion')) agentClass = 'agent-1';
        else if (log.agent_name.includes('Fusion')) agentClass = 'agent-2';
        else if (log.agent_name.includes('Allocation')) agentClass = 'agent-3';
        else if (log.agent_name.includes('Execution')) agentClass = 'agent-4';

        const step = log.step || 1;
        const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
        const obs = log.observation || 'Observing data streams...';
        const reasoning = log.reasoning || '';
        const decision = log.decision || 'No routing decided.';

        return `
        <div class="log-card-box ${agentClass}">
            <div class="log-card-top">
                <div class="log-card-title">
                    <span class="log-card-agent-lbl">${log.agent_name}</span>
                    <span class="log-card-step">· Phase Step ${step}</span>
                </div>
                <div class="log-card-time">${timeStr}</div>
            </div>
            <div class="log-card-obs">${obs}</div>
            
            <!-- Expandable Reasoning -->
            <div class="log-card-reasoning expandable-text collapsed" onclick="toggleReasoning(this)">
                ${reasoning}
                <div class="expand-indicator"><i class="fa-solid fa-angles-down"></i> click to show analysis details</div>
            </div>
            
            <div class="log-card-decision"><i class="fa-solid fa-caret-right"></i> DECISION: ${decision}</div>
        </div>`;
    }).join('');
}

function toggleReasoning(element) {
    element.classList.toggle('collapsed');
    const indicator = element.querySelector('.expand-indicator');
    if (indicator) {
        if (element.classList.contains('collapsed')) {
            indicator.innerHTML = '<i class="fa-solid fa-angles-down"></i> click to show analysis details';
        } else {
            indicator.innerHTML = '<i class="fa-solid fa-angles-up"></i> click to collapse';
        }
    }
}

// ── Quick Demo Scenario Loader ──────────────────────────────────
function loadDemoScenario(type) {
    const transcriptEl = document.getElementById('transcript-input');
    const socialEl = document.getElementById('social-input');

    if (type === 'flood') {
        transcriptEl.value = "EMERGENCY: Urgent assistance needed blocks 13 and 14 in Gulshan-e-Iqbal. Water has breached residential gates due to heavy flash storms and rising street levels. Multiple families stuck on top levels. We need boats or trucks immediately to prevent people from drowning.";
        socialEl.value = JSON.stringify([
            { "id": "s_001", "text": "Panic on University Road! Roads are under 4 feet of water, cars are completely submerged near Gulshan block 13.", "platform": "Twitter", "timestamp": "2026-05-17T11:00:00Z", "location_mention": "Gulshan-e-Iqbal, Karachi", "likes": 120, "verified": true },
            { "id": "s_002", "text": "Submerged streets near NIPA Chowrangi, avoid driving in Gulshan until storm ends.", "platform": "Facebook", "timestamp": "2026-05-17T11:02:00Z", "location_mention": "Gulshan", "likes": 40, "verified": false }
        ], null, 2);
        showToast("Gulshan Flood Scenario pre-populated.", "ok");
    } else {
        transcriptEl.value = "ALERT: Massive amount of water filling G-9 Markaz square. It seems a central water pipeline has broken under high pressure and is flooding the streets. It is not natural rain flooding, but it needs instant utility isolating.";
        socialEl.value = JSON.stringify([
            { "id": "s_011", "text": "Avoid G-9 Markaz. Main pipeline burst. Water flowing like a river, traffic is backed up.", "platform": "Twitter", "timestamp": "2026-05-17T11:15:00Z", "location_mention": "Karachi", "likes": 95, "verified": true }
        ], null, 2);
        showToast("False Alarm scenario pre-populated.", "ok");
    }

    updateCharCount('transcript-input', 'transcript-counter');
    updateCharCount('social-input', 'social-counter');
}

// ── Toasts Manager ──────────────────────────────────────────────
function showToast(msg, type = 'ok') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const t = document.createElement('div');
    t.className = `toast-msg ${type}`;
    t.textContent = msg;
    container.appendChild(t);

    setTimeout(() => {
        t.remove();
    }, 4000);
}

// ── SECTION EVENT TRIGGERS ──────────────────────────────────────
function onSectionSwitch(id) {
    if (id === 'incidents') fetchIncidents();
    if (id === 'logs') fetchLogs();
    if (id === 'resources') fetchResources();
}