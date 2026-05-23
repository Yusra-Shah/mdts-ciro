// MDTS CIRO — app.js — Final Build
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000' : '';

let allIncidents = [], allLogs = [], incFilter = 'ALL', logFilter = 'ALL';
let uploadedPath = 'mock_data/images/test.jpg';
let map = null, mapMarkers = [], activeLayer = null;

// ── STATIC FALLBACK DATA (shown on Firebase when backend offline) ──
const FALLBACK_WEATHER = [
  {city:'Karachi',temperature:35,humidity:72,wind_speed:22,condition:'Hazy',feels_like:39,flood_risk:'LOW',risk_score:2},
  {city:'Lahore',temperature:42,humidity:55,wind_speed:15,condition:'Sunny',feels_like:45,flood_risk:'LOW',risk_score:1},
  {city:'Islamabad',temperature:36,humidity:65,wind_speed:18,condition:'Cloudy',feels_like:38,flood_risk:'LOW',risk_score:2},
  {city:'Hyderabad',temperature:41,humidity:70,wind_speed:20,condition:'Sunny',feels_like:44,flood_risk:'MEDIUM',risk_score:3},
  {city:'Peshawar',temperature:39,humidity:58,wind_speed:16,condition:'Clear',feels_like:41,flood_risk:'LOW',risk_score:1},
];
const FALLBACK_QUAKES = [
  {magnitude:4.2,place:'81 km NNW of Fayzabad, Afghanistan',depth_km:210,time:new Date(Date.now()-3600000).toISOString(),severity:'moderate'},
  {magnitude:3.1,place:'37 km SW of Farkhar, Afghanistan',depth_km:89,time:new Date(Date.now()-7200000).toISOString(),severity:'minor'},
  {magnitude:2.8,place:'22 km ESE of Farkhar, Afghanistan',depth_km:54,time:new Date(Date.now()-10800000).toISOString(),severity:'minor'},
  {magnitude:5.1,place:'Near Chitral, Pakistan',depth_km:35,time:new Date(Date.now()-14400000).toISOString(),severity:'moderate'},
];
const FALLBACK_INCIDENTS = [
  {incident_id:'INC_0001',location:'Gulshan-e-Iqbal, Karachi',crisis_type:'flood',severity_score:6.1,confidence:0.92,affected_population:6500,spread_risk:'medium',status:'responding',hospital_alert:'Aga Khan University Hospital',traffic_rerouting:'University Road diverted. All non-emergency vehicles use Shahrae Faisal.',allocation_reasoning:'Priority Rank 1 based on severity 6.1. Assigned 1 rescue team, 2 ambulances, 2 police units due to flood-trapped scenario.',resource_assignment:{rescue_teams:1,ambulances:2,police_units:2},public_notification:'URGENT: Flash flooding in Gulshan-e-Iqbal. Families trapped on rooftops. Rescue teams deployed. Avoid University Road.',conflict_detected:false},
  {incident_id:'INC_0002',location:'Hyderabad City',crisis_type:'flood',severity_score:2.3,confidence:0.75,affected_population:1500,spread_risk:'low',status:'verification_required',hospital_alert:'Liaquat University Hospital',traffic_rerouting:'Monitoring in progress.',allocation_reasoning:'Priority Rank 2 based on severity 2.3. Low confidence — awaiting field verification before dispatch.',resource_assignment:{rescue_teams:1,police_units:1},public_notification:'Weather monitoring active in Hyderabad. No immediate evacuation required. Stay alert.',conflict_detected:false},
];

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  startClock();
  setThemeIcon();
  refreshAll();
  setInterval(refreshAll, 30000);
  setInterval(function(){ loadWeather(); loadEarthquakes(); loadThreatAssessment(); }, 300000);
});

function setThemeIcon() {
  var theme = document.documentElement.getAttribute('data-theme') || 'light';
  var btn = document.getElementById('theme-btn');
  if(btn) btn.innerHTML = theme==='dark'?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
}

// ── CLOCK ─────────────────────────────────────────────────────────
function startClock() {
  var el = document.getElementById('pk-clock');
  if(!el) return;
  setInterval(function(){
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset()*60000;
    var pk = new Date(utc + 3600000*5);
    el.textContent = 'Pakistan Time: '+pad(pk.getHours())+':'+pad(pk.getMinutes())+':'+pad(pk.getSeconds());
  }, 1000);
}
function pad(n){ return String(n).padStart(2,'0'); }

// ── REFRESH ───────────────────────────────────────────────────────
async function refreshAll() {
  await loadStats();
  await loadIncidents();
  await loadLogs();
  await loadResources();
  await loadWeather();
  await loadEarthquakes();
  await loadThreatAssessment();
  await loadMonitoringStatus();
  if(map) plotMarkers();
}

// ── STATS ─────────────────────────────────────────────────────────
async function loadStats() {
  try {
    var r = await fetch(API+'/stats'); if(!r.ok) throw new Error();
    var s = await r.json();
    animNum('stat-incidents', s.total_incidents||0, 0);
    animNum('stat-resources', s.resources_deployed||0, 0);
    animNum('stat-severity', s.avg_severity||0, 1);
    var bi = document.getElementById('bench-incidents');
    if(bi) bi.textContent = (s.total_incidents||0)+' incidents found';
  } catch(e) {
    // Show fallback stats
    animNum('stat-incidents', FALLBACK_INCIDENTS.length, 0);
    animNum('stat-resources', 5, 0);
    animNum('stat-severity', 4.2, 1);
    var bi = document.getElementById('bench-incidents');
    if(bi) bi.textContent = FALLBACK_INCIDENTS.length+' incidents found';
  }
}

function animNum(id, target, dec) {
  var el = document.getElementById(id);
  if(!el) return;
  var start = parseFloat(el.textContent)||0;
  var dur = 700, t0 = performance.now();
  function step(now) {
    var p = Math.min((now-t0)/dur,1), ease = p*(2-p);
    el.textContent = (start+(target-start)*ease).toFixed(dec);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── WEATHER ───────────────────────────────────────────────────────
async function loadWeather() {
  var el = document.getElementById('weather-strip');
  if(!el) return;
  var data = null;
  try {
    var r = await fetch(API+'/weather'); if(!r.ok) throw new Error();
    data = await r.json();
  } catch(e) { data = FALLBACK_WEATHER; }
  renderWeather(data, el);
  plotWeatherMarkers(data);
}

function renderWeather(data, el) {
  var condMap = {Clear:'Sunny',Haze:'Hazy',Rain:'Rainy',Clouds:'Cloudy','Partly Cloudy':'Partly Cloudy',Thunderstorm:'Stormy',Smoke:'Smoky',Dust:'Dusty'};
  el.innerHTML = data.map(function(c){
    var risk = (c.flood_risk||'LOW').toLowerCase();
    var cond = condMap[c.condition]||c.condition||'Clear';
    return '<div class="weather-card">'+
      '<div class="w-city">'+c.city+'</div>'+
      '<div class="w-temp-row"><span class="w-temp">'+Math.round(c.temperature)+'C</span><span class="w-cond">'+cond+'</span></div>'+
      '<div class="w-meta"><span>Humidity: '+c.humidity+'%</span><span>Wind: '+c.wind_speed+' km/h</span><span>Feels like: '+Math.round(c.feels_like||c.temperature)+'C</span></div>'+
      '<span class="w-risk risk-'+risk+'">Flood: '+(c.flood_risk||'LOW')+'</span>'+
      '</div>';
  }).join('');
}

async function loadWeatherAlerts() {
  try {
    var r = await fetch(API+'/weather/alerts'); if(!r.ok) throw new Error();
    var alerts = await r.json();
    var banner = document.getElementById('alert-banner');
    var msg = document.getElementById('alert-msg');
    if(!banner||!msg) return;
    if(alerts&&alerts.length){
      msg.textContent = alerts.map(function(a){return a.city+': '+a.message;}).join(' | ');
      banner.style.display='flex';
    } else {
      banner.style.display='none';
    }
  } catch(e){ document.getElementById('alert-banner') && (document.getElementById('alert-banner').style.display='none'); }
}

// ── EARTHQUAKES ───────────────────────────────────────────────────
async function loadEarthquakes() {
  var el = document.getElementById('earthquake-strip');
  if(!el) return;
  var data = null;
  try {
    var r = await fetch(API+'/earthquakes'); if(!r.ok) throw new Error();
    data = await r.json();
    if(!data||!data.length) throw new Error();
  } catch(e) { data = FALLBACK_QUAKES; }
  renderEarthquakes(data, el);
}

function renderEarthquakes(data, el) {
  if(!data||!data.length){
    el.innerHTML = '<div class="weather-loading">No significant seismic activity detected near Pakistan.</div>';
    return;
  }
  el.innerHTML = data.slice(0,6).map(function(q){
    var mag = parseFloat(q.magnitude||0);
    var sev = mag>=6?'critical':mag>=4.5?'moderate':'minor';
    var color = mag>=6?'var(--red)':mag>=4.5?'var(--amber)':'var(--teal)';
    var timeAgo = getTimeAgo(q.time);
    return '<div class="eq-card" style="border-left-color:'+color+';"><div class="eq-mag" style="color:'+color+';">'+mag.toFixed(1)+'</div>'+
      '<div class="eq-place">'+truncate(q.place||'Unknown Region',35)+'</div>'+
      '<div class="eq-meta">Depth: '+(q.depth_km||0)+' km · '+timeAgo+'</div>'+
      (q.tsunami?'<div style="font-size:10px;font-weight:700;color:var(--red);margin-top:4px;">TSUNAMI WARNING</div>':'')+
      '<div class="eq-badge eq-'+sev+'">'+sev.toUpperCase()+'</div>'+
      '</div>';
  }).join('');
}

function getTimeAgo(iso) {
  if(!iso) return '--';
  var diff = (Date.now()-new Date(iso).getTime())/1000;
  if(diff<3600) return Math.round(diff/60)+' min ago';
  if(diff<86400) return Math.round(diff/3600)+' hr ago';
  return Math.round(diff/86400)+' days ago';
}

function truncate(s, n){ return s.length>n?s.slice(0,n)+'...':s; }

// ── THREAT ASSESSMENT ─────────────────────────────────────────────
async function loadThreatAssessment() {
  try {
    var r = await fetch(API+'/threat-assessment'); if(!r.ok) throw new Error();
    var d = await r.json();
    var badge = document.getElementById('threat-badge');
    var tw = document.getElementById('t-weather');
    var tq = document.getElementById('t-quakes');
    var th = document.getElementById('t-hotspots');
    var level = d.overall_threat_level||'LOW';
    if(badge){ badge.textContent=level; badge.className='threat-badge'+(level==='CRITICAL'||level==='HIGH'?' high':level==='MEDIUM'?' medium':''); }
    if(tw) tw.textContent = d.active_weather_alerts||0;
    if(tq) tq.textContent = d.significant_earthquakes_24h||0;
    if(th) th.textContent = d.high_confidence_satellite_hotspots||0;
  } catch(e) {
    var badge = document.getElementById('threat-badge');
    if(badge){ badge.textContent='LOW'; badge.className='threat-badge'; }
    var tw=document.getElementById('t-weather'); if(tw) tw.textContent='0';
    var tq=document.getElementById('t-quakes'); if(tq) tq.textContent='5';
    var th=document.getElementById('t-hotspots'); if(th) th.textContent='5';
  }
}

async function loadMonitoringStatus() {
  try {
    var r = await fetch(API+'/monitoring-status'); if(!r.ok) throw new Error();
    var d = await r.json();
    var le=document.getElementById('monitor-last'); var ne=document.getElementById('monitor-next');
    if(le) le.textContent=d.last_run?new Date(d.last_run).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--';
    if(ne) ne.textContent=d.next_run?new Date(d.next_run).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--';
  } catch(e){}
}

// ── INCIDENTS ─────────────────────────────────────────────────────
async function loadIncidents() {
  try {
    var r = await fetch(API+'/incidents'); if(!r.ok) throw new Error();
    allIncidents = await r.json();
    if(!allIncidents.length) throw new Error();
  } catch(e) { allIncidents = FALLBACK_INCIDENTS; }
  updateChart(allIncidents);
  renderDashIncidents();
  renderAllIncidents();
}

function updateChart(list) {
  var total=list.length||1, crit=0, mod=0, low=0;
  list.forEach(function(i){ var s=i.severity_score; if(s>7) crit++; else if(s>=4) mod++; else low++; });
  setChartBar('crit',crit,total); setChartBar('mod',mod,total); setChartBar('low',low,total);
}
function setChartBar(k,count,total){
  var pct=Math.round(count/total*100);
  var c=document.getElementById('dist-'+k); if(c) c.textContent=count+' incidents ('+pct+'%)';
  var b=document.getElementById('bar-'+k); if(b) b.style.width=pct+'%';
}

function renderDashIncidents() {
  var el=document.getElementById('dash-incidents'); if(!el) return;
  if(!allIncidents.length){el.innerHTML='<div class="empty-state"><i class="fa-solid fa-satellite-dish empty-icon"></i><p>No active incidents. Run an analysis to begin triage.</p></div>';return;}
  var top=[...allIncidents].sort(function(a,b){return b.severity_score-a.severity_score;}).slice(0,3);
  el.innerHTML=top.map(function(i){return renderCard(i,false);}).join('');
}

function filterInc(f) {
  incFilter=f;
  document.querySelectorAll('#incidents .filter-btn').forEach(function(b){b.classList.toggle('active',b.textContent.trim()===f||(f==='ALL'&&b.textContent.includes('All')));});
  renderAllIncidents();
}

function renderAllIncidents() {
  var el=document.getElementById('incidents-list'); if(!el) return;
  var list=[...allIncidents];
  if(incFilter==='CRITICAL') list=list.filter(function(i){return i.severity_score>7;});
  else if(incFilter==='MODERATE') list=list.filter(function(i){return i.severity_score>=4&&i.severity_score<=7;});
  else if(incFilter==='LOW') list=list.filter(function(i){return i.severity_score<4;});
  else if(incFilter==='responding') list=list.filter(function(i){return i.status==='responding';});
  else if(incFilter==='verification_required') list=list.filter(function(i){return i.status==='verification_required';});
  if(!list.length){el.innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation empty-icon"></i><p>No incidents matching this filter.</p></div>';return;}
  el.innerHTML=list.map(function(i){return renderCard(i,true);}).join('');
}

function getAccent(s){ return s>7?'var(--red)':s>=4?'var(--amber)':'var(--teal)'; }
function chipCls(st){ var m={responding:'chip-responding',verification_required:'chip-verification_required',monitoring:'chip-monitoring',detected:'chip-detected'}; return m[st]||'chip-monitoring'; }
function chipLbl(st){ var m={responding:'Responding',verification_required:'Verify First',monitoring:'Monitoring',detected:'Detected'}; return m[st]||st; }

function renderCard(inc, expanded) {
  var color=getAccent(inc.severity_score);
  var conf=Math.round((inc.confidence||0.75)*100);
  var pop=(inc.affected_population||1500).toLocaleString();
  var status=inc.status||'monitoring';
  var resources=inc.resource_assignment&&Object.keys(inc.resource_assignment).length
    ?Object.entries(inc.resource_assignment).map(function(e){return e[1]+' '+e[0].replace('_',' ');}).join(', ')
    :'None allocated';

  var inner='';
  if(!expanded){
    inner='<div class="inc-actions"><button class="btn-primary" onclick="showSection(\'incidents\')">View Details</button><button class="btn-ghost">Dispatch</button></div>';
  } else {
    inner='<div class="exp-panel">'+
      '<div class="field-grid">'+
        '<div class="field-block"><div class="field-lbl">Affected Population</div><div class="field-val">'+pop+' estimated</div></div>'+
        '<div class="field-block"><div class="field-lbl">Spread Risk</div><div class="field-val">'+(inc.spread_risk||'medium').toUpperCase()+'</div></div>'+
        '<div class="field-block"><div class="field-lbl">Fleet Allocations</div><div class="field-val">'+resources+'</div></div>'+
        '<div class="field-block"><div class="field-lbl">Hospital Alert</div><div class="field-val">'+(inc.hospital_alert||'Jinnah Hospital')+'</div></div>'+
      '</div>'+
      '<div class="field-block" style="margin-bottom:12px;"><div class="field-lbl">AI Reasoning</div><div class="field-val" style="font-size:11px;color:var(--text-sub);">'+(inc.allocation_reasoning||'Monitoring only.')+'</div></div>'+
      '<div class="trace-title">Agent Ingestion Trace</div>'+
      '<div class="trace-line">'+
        '<div class="trace-item"><div class="trace-dot done" style="border-color:var(--blue);background:var(--blue);"></div><div class="trace-agent" style="color:var(--blue);">Agent 1 — Signal Ingestion</div><div class="trace-action">4 streams fused: satellite, call, social media, weather — confidence '+conf+'%</div></div>'+
        '<div class="trace-item"><div class="trace-dot done" style="border-color:var(--amber);background:var(--amber);"></div><div class="trace-agent" style="color:var(--amber);">Agent 2 — Geospatial Fusion</div><div class="trace-action">'+(inc.conflict_detected?'Conflict detected and resolved between signal sources.':'No conflicts detected between sources.')+'</div></div>'+
        '<div class="trace-item"><div class="trace-dot done" style="border-color:var(--teal);background:var(--teal);"></div><div class="trace-agent" style="color:var(--teal);">Agent 3 — Fleet Allocation</div><div class="trace-action">Resources allocated: '+resources+'</div></div>'+
        '<div class="trace-item"><div class="trace-dot '+(status==='responding'?'done':'')+'" style="border-color:var(--red);'+(status==='responding'?'background:var(--red);':'')+'"></div><div class="trace-agent" style="color:var(--red);">Agent 4 — Execution</div><div class="trace-action">Incident stored in Firestore. Stakeholder communications dispatched.</div></div>'+
      '</div>'+
      '<div class="sh-grid">'+
        '<div class="sh-card"><i class="fa-solid fa-bullhorn sh-icon"></i><div><div class="sh-lbl">Public Alert</div><div class="sh-text">'+(inc.public_notification||'Emergency response initiated. Avoid the area.')+'</div><div class="sh-status">Broadcast Simulated</div></div></div>'+
        '<div class="sh-card"><i class="fa-solid fa-square-h sh-icon"></i><div><div class="sh-lbl">Hospital Notice</div><div class="sh-text">'+(inc.hospital_alert||'Jinnah Hospital')+' alerted. Prepare emergency bay for incoming casualties.</div><div class="sh-status">Alert Acknowledged</div></div></div>'+
        '<div class="sh-card"><i class="fa-solid fa-bolt sh-icon"></i><div><div class="sh-lbl">Utilities</div><div class="sh-text">KESC and SNGPL notified. Infrastructure risk assessment and precautionary isolation checklist initiated.</div><div class="sh-status">Checklist Queued</div></div></div>'+
        '<div class="sh-card"><i class="fa-solid fa-camera sh-icon"></i><div><div class="sh-lbl">Media Brief</div><div class="sh-text">Official response operations active at '+(inc.location||'incident location')+'. Further updates to follow.</div><div class="sh-status">Press Release Published</div></div></div>'+
      '</div>'+
      '<div class="dispatch-banner '+(status==='responding'?'d-ok':'d-wait')+'">'+(status==='responding'?'Dispatch Confirmed — En Route':'Awaiting Field Verification')+'</div>'+
      '</div>';
  }

  return '<div class="inc-card" style="--acc:'+color+';">'+
    '<div class="inc-header">'+
      '<div><div class="inc-type">'+(inc.crisis_type||'Unknown').toUpperCase()+'</div><div class="inc-loc"><i class="fa-solid fa-location-dot" style="color:var(--amber);margin-right:4px;"></i>'+(inc.location||'Unknown Location')+'</div></div>'+
      '<div style="text-align:right;"><div class="inc-sev" style="color:'+color+';">'+(inc.severity_score||0)+'</div><div class="inc-sev-lbl">Severity</div></div>'+
    '</div>'+
    '<div class="inc-meta"><span>Population: <strong>'+pop+'</strong></span><span>Confidence: <strong>'+conf+'%</strong></span><span>Risk: <strong>'+(inc.spread_risk||'medium').toUpperCase()+'</strong></span></div>'+
    '<div class="inc-footer"><span class="status-chip '+chipCls(status)+'">'+chipLbl(status)+'</span>'+inner+'</div>'+
    '</div>';
}

// ── LOGS ──────────────────────────────────────────────────────────
async function loadLogs() {
  try {
    var r = await fetch(API+'/agent-logs'); if(!r.ok) throw new Error();
    allLogs = await r.json();
  } catch(e){ allLogs=[]; }
  renderLogs();
}

function filterLogs(f) {
  logFilter=f;
  document.querySelectorAll('#logs .filter-btn').forEach(function(b){b.classList.toggle('active',b.textContent.trim()===f||(f==='ALL'&&b.textContent.includes('All')));});
  renderLogs();
}

function renderLogs() {
  var el=document.getElementById('logs-list'); if(!el) return;
  var list=[...allLogs];
  if(logFilter!=='ALL') list=list.filter(function(l){return l.agent_name===logFilter;});
  if(!list.length){el.innerHTML='<div class="empty-state"><i class="fa-solid fa-terminal empty-icon"></i><p>No logs matching this filter. Run an analysis first.</p></div>';return;}
  el.innerHTML=list.map(function(log){
    var cls='a2';
    if((log.agent_name||'').includes('Ingestion')) cls='a1';
    else if((log.agent_name||'').includes('Fusion')) cls='a2';
    else if((log.agent_name||'').includes('Allocation')) cls='a3';
    else if((log.agent_name||'').includes('Execution')) cls='a4';
    var t=log.timestamp?new Date(log.timestamp).toLocaleTimeString():'--';
    return '<div class="log-card '+cls+'">'+
      '<div class="log-top"><div><span class="log-agent">'+(log.agent_name||'Agent')+'</span><span class="log-step">Step '+(log.step||1)+'</span></div><div class="log-time">'+t+'</div></div>'+
      '<div class="log-obs">'+(log.observation||'Processing signal streams.')+'</div>'+
      '<div class="log-reason">'+(log.reasoning||'')+'</div>'+
      '<div class="log-decision">Decision: '+(log.decision||'No action required.')+'</div>'+
      '</div>';
  }).join('');
}

// ── RESOURCES ─────────────────────────────────────────────────────
async function loadResources() {
  try {
    var r = await fetch(API+'/incidents'); if(!r.ok) throw new Error();
    var incidents = await r.json();
    var limits={ambulances:5,rescue_teams:3,police_units:4,water_tankers:2};
    var deployed={ambulances:0,rescue_teams:0,police_units:0,water_tankers:0};
    incidents.forEach(function(inc){
      if(inc.status==='responding'&&inc.resource_assignment){
        Object.entries(inc.resource_assignment).forEach(function(e){ if(deployed.hasOwnProperty(e[0])) deployed[e[0]]+=parseInt(e[1])||0; });
      }
    });
    renderResources(limits, deployed);
  } catch(e){
    var limits={ambulances:5,rescue_teams:3,police_units:4,water_tankers:2};
    var deployed={ambulances:2,rescue_teams:1,police_units:2,water_tankers:0};
    renderResources(limits, deployed);
  }
}

function renderResources(limits, deployed) {
  var total=0;
  Object.keys(limits).forEach(function(key){
    deployed[key]=Math.min(deployed[key]||0, limits[key]);
    total+=deployed[key];
    var pct=Math.round(deployed[key]/limits[key]*100);
    var pe=document.getElementById('pct-'+key); if(pe) pe.textContent=pct+'% Used';
    var be=document.getElementById('bar-'+key); if(be) be.style.width=pct+'%';
    var ue=document.getElementById('units-'+key);
    if(ue){
      ue.innerHTML=Array.from({length:limits[key]},function(_,i){
        var dep=i<deployed[key];
        return '<span class="unit-pill'+(dep?' deployed':'')+'">'+key.slice(0,3).toUpperCase()+'-'+String(i+1).padStart(2,'0')+'</span>';
      }).join('');
    }
  });
  var sv=document.getElementById('res-summary'); if(sv) sv.textContent='Deployed: '+total+' units — Available: '+(14-total)+' units';
}

// ── MAP ───────────────────────────────────────────────────────────
var CITY_POS = {
  Karachi:{lat:24.8607,lng:67.0011}, Lahore:{lat:31.5204,lng:74.3587},
  Islamabad:{lat:33.6844,lng:73.0479}, Hyderabad:{lat:25.3960,lng:68.3578},
  Peshawar:{lat:34.0151,lng:71.5249}
};

function initMap() {
  var el=document.getElementById('pakistan-map'); if(!el) return;
  var isDark=document.documentElement.getAttribute('data-theme')==='dark';
  var lightStyle=[
    {featureType:'all',elementType:'geometry',stylers:[{saturation:-20}]},
    {featureType:'administrative.country',elementType:'geometry.stroke',stylers:[{color:'#D97706'},{weight:1.5}]},
    {featureType:'water',elementType:'geometry',stylers:[{color:'#BFDBFE'}]},
    {featureType:'landscape',elementType:'geometry',stylers:[{color:'#F8FAFC'}]},
    {featureType:'road',elementType:'geometry',stylers:[{color:'#E2E8F0'}]},
  ];
  var darkStyle=[
    {elementType:'geometry',stylers:[{color:'#121420'}]},
    {elementType:'labels.text.fill',stylers:[{color:'#747b85'}]},
    {featureType:'administrative.country',elementType:'geometry.stroke',stylers:[{color:'#f59e0b'},{weight:1.5}]},
    {featureType:'water',elementType:'geometry',stylers:[{color:'#07080c'}]},
    {featureType:'landscape',elementType:'geometry.fill',stylers:[{color:'#0c0e14'}]},
    {featureType:'road',elementType:'geometry',stylers:[{color:'#1c2130'}]},
  ];
  map=new google.maps.Map(el,{center:{lat:30.3753,lng:69.3451},zoom:5,styles:isDark?darkStyle:lightStyle,mapTypeControl:false,streetViewControl:false,fullscreenControl:true});
  plotMarkers();
}

function rand(){ return (Math.random()-0.5)*0.12; }

function cityPos(loc) {
  var l=(loc||'').toLowerCase();
  if(l.includes('karachi')||l.includes('gulshan')) return {lat:24.8607+rand(),lng:67.0011+rand()};
  if(l.includes('lahore')) return {lat:31.5204+rand(),lng:74.3587+rand()};
  if(l.includes('islamabad')||l.includes('g-9')||l.includes('g-10')) return {lat:33.6844+rand(),lng:73.0479+rand()};
  if(l.includes('hyderabad')) return {lat:25.3960+rand(),lng:68.3578+rand()};
  if(l.includes('peshawar')) return {lat:34.0151+rand(),lng:71.5249+rand()};
  return {lat:30.3753+rand()*3,lng:69.3451+rand()*3};
}

function plotMarkers() {
  if(!map) return;
  mapMarkers.forEach(function(m){m.setMap(null);}); mapMarkers=[];
  var incidents = allIncidents.length ? allIncidents : FALLBACK_INCIDENTS;
  incidents.forEach(function(inc){
    var s=inc.severity_score||0;
    var color=s>7?'#DC2626':s>=4?'#D97706':'#059669';
    var pos=cityPos(inc.location);
    var m=new google.maps.Marker({position:pos,map:map,title:inc.location,icon:{path:google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,scale:7,fillColor:color,fillOpacity:0.9,strokeColor:'#fff',strokeWeight:1.5}});
    var iw=new google.maps.InfoWindow({content:'<div style="font-family:DM Sans,sans-serif;padding:8px;max-width:200px;"><div style="font-weight:700;color:'+color+';font-size:13px;margin-bottom:6px;">'+(inc.incident_id||'INC')+'</div><div><strong>Location:</strong> '+(inc.location||'Unknown')+'</div><div><strong>Type:</strong> '+(inc.crisis_type||'Unknown')+'</div><div><strong>Severity:</strong> '+s+'/10</div><div><strong>Status:</strong> '+(inc.status||'Unknown')+'</div></div>'});
    m.addListener('click',function(){iw.open(map,m);});
    mapMarkers.push(m);
  });
  fetch(API+'/satellite-alerts').then(function(r){return r.json();}).then(function(data){
    data.forEach(function(h){
      var m=new google.maps.Marker({position:{lat:parseFloat(h.latitude),lng:parseFloat(h.longitude)},map:map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#DC2626',fillOpacity:0.8,strokeColor:'#D97706',strokeWeight:1.5}});
      var iw=new google.maps.InfoWindow({content:'<div style="font-family:DM Sans,sans-serif;padding:8px;"><div style="font-weight:700;color:#DC2626;font-size:12px;margin-bottom:4px;">Satellite Anomaly</div><div><strong>Region:</strong> '+(h.region||'Pakistan')+'</div><div><strong>Confidence:</strong> '+(h.confidence||'nominal')+'</div><div><strong>Date:</strong> '+(h.acq_date||'--')+'</div></div>'});
      m.addListener('click',function(){iw.open(map,m);});
      mapMarkers.push(m);
    });
  }).catch(function(){});
  fetch(API+'/earthquakes').then(function(r){return r.json();}).then(function(data){
    data.forEach(function(q){
      var mag=parseFloat(q.magnitude||0);
      var color=mag>=6?'#DC2626':mag>=4.5?'#D97706':'#EAB308';
      var scale=mag>=6?10:mag>=4.5?8:5;
      var m=new google.maps.Marker({position:{lat:parseFloat(q.latitude||30),lng:parseFloat(q.longitude||69)},map:map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:scale,fillColor:color,fillOpacity:0.7,strokeColor:'#fff',strokeWeight:1}});
      var iw=new google.maps.InfoWindow({content:'<div style="font-family:DM Sans,sans-serif;padding:8px;"><div style="font-weight:700;color:'+color+';font-size:13px;margin-bottom:4px;">Magnitude '+mag+'</div><div>'+(q.place||'Pakistan Region')+'</div><div>Depth: '+(q.depth_km||0)+' km</div>'+(q.tsunami?'<div style="color:#DC2626;font-weight:700;">TSUNAMI WARNING</div>':'')+'</div>'});
      m.addListener('click',function(){iw.open(map,m);});
      mapMarkers.push(m);
    });
  }).catch(function(){});
}

function plotWeatherMarkers(data) {
  if(!map) return;
  data.forEach(function(c){
    var pos=CITY_POS[c.city]; if(!pos) return;
    var m=new google.maps.Marker({position:pos,map:map,title:c.city+' Weather',label:{text:Math.round(c.temperature)+'C',color:'#D97706',fontSize:'11px',fontWeight:'700'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:1,fillOpacity:0,strokeOpacity:0}});
    var iw=new google.maps.InfoWindow({content:'<div style="font-family:DM Sans,sans-serif;padding:8px;min-width:140px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">'+c.city+'</div><div style="font-size:18px;font-weight:700;margin-bottom:3px;">'+Math.round(c.temperature)+'C</div><div>'+c.condition+'</div><div>Humidity: '+c.humidity+'%</div><div>Wind: '+c.wind_speed+' km/h</div><div style="font-weight:600;color:'+(c.flood_risk==='HIGH'?'#DC2626':c.flood_risk==='MEDIUM'?'#D97706':'#059669')+';">Flood Risk: '+c.flood_risk+'</div></div>'});
    m.addListener('click',function(){iw.open(map,m);});
    mapMarkers.push(m);
  });
}

function toggleLayer(name, btn) {
  document.querySelectorAll('.map-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  if(activeLayer){map.overlayMapTypes.clear();activeLayer=null;}
  var apiKey='b6b4bb4e3e4e17e8c12b35f1e4b2c5a8';
  var layer=new google.maps.ImageMapType({getTileUrl:function(c,z){return'https://tile.openweathermap.org/map/'+name+'/'+z+'/'+c.x+'/'+c.y+'.png?appid='+apiKey;},tileSize:new google.maps.Size(256,256),opacity:0.5});
  activeLayer=layer;
  map.overlayMapTypes.push(layer);
}

// ── ANALYSIS ──────────────────────────────────────────────────────
async function runAnalysis() {
  var transcript=document.getElementById('transcript').value.trim();
  var socialRaw=document.getElementById('social').value.trim();
  var btn=document.getElementById('triage-btn');
  if(!transcript){toast('Enter an emergency transcript before running analysis.','err');return;}
  var social=[];
  if(socialRaw){try{social=JSON.parse(socialRaw);}catch(e){toast('Social media field has invalid JSON.','err');return;}}
  var stages=['Agent 1 Ingesting Signal Stream...','Agent 2 Fusing and Scoring...','Agent 3 Allocating Resources...','Agent 4 Executing and Storing...'];
  var step=0; btn.disabled=true; btn.style.opacity='0.7';
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> '+stages[0];
  var ps=['ps-1','ps-2','ps-3','ps-4'];
  var iv=setInterval(function(){
    step=(step+1)%stages.length;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> '+stages[step];
    ps.forEach(function(id,i){var el=document.getElementById(id);if(el){el.classList.toggle('active',i<=step);}});
  }, 2000);
  try {
    var r=await fetch(API+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_path:uploadedPath,transcript:transcript,social_posts:social})});
    clearInterval(iv); btn.disabled=false; btn.style.opacity='1'; btn.innerHTML='<i class="fa-solid fa-bolt"></i> Start Analyze and Triage';
    ps.forEach(function(id){var el=document.getElementById(id);if(el) el.classList.remove('active');});
    if(!r.ok) throw new Error();
    var data=await r.json();
    renderResults(data);
    showSection('dashboard');
    toast('Analysis complete. Incidents detected and logged.','ok');
    await loadIncidents();
    await loadStats();
    if(map) plotMarkers();
  } catch(e) {
    clearInterval(iv); btn.disabled=false; btn.style.opacity='1'; btn.innerHTML='<i class="fa-solid fa-bolt"></i> Start Analyze and Triage';
    ps.forEach(function(id){var el=document.getElementById(id);if(el) el.classList.remove('active');});
    toast('Analysis failed. Check backend connection.','err');
  }
}

function renderResults(data) {
  var box=document.getElementById('results-box'); var content=document.getElementById('results-content');
  if(!box||!content) return;
  box.style.display='block';
  var incidents=data.incidents||[];
  content.innerHTML='<div style="font-size:12px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);">Session: <strong style="font-family:DM Mono,monospace;color:var(--amber);">'+(data.session_id||'--').slice(0,16)+'</strong><br>Processed: <strong>'+(data.total_incidents_processed||0)+' incidents</strong></div>'+
    incidents.map(function(inc){return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:8px;"><div style="font-family:DM Mono,monospace;font-size:11px;color:var(--amber);font-weight:700;margin-bottom:4px;">'+(inc.incident_id||'INC')+'</div><div style="font-size:11px;display:flex;justify-content:space-between;"><span>Status: <strong>'+(inc.status||'unknown')+'</strong></span><span>Ticket: <strong style="font-family:DM Mono,monospace;">'+(inc.dispatch_ticket&&inc.dispatch_ticket.ticket_id?inc.dispatch_ticket.ticket_id:'Pending')+'</strong></span></div></div>';}).join('');
}

function handleFile(input) {
  if(!input.files||!input.files[0]) return;
  var file=input.files[0]; uploadedPath='mock_data/images/'+file.name;
  var zone=document.getElementById('upload-zone'); var fname=document.getElementById('fname');
  var pw=document.getElementById('img-preview-wrap'); var pi=document.getElementById('img-preview');
  if(zone) zone.classList.add('has-file'); if(fname) fname.textContent=file.name+' selected';
  if(pw&&pi){var reader=new FileReader();reader.onload=function(e){pi.src=e.target.result;pw.style.display='block';};reader.readAsDataURL(file);}
}

function countChars(tid, cid) {
  var t=document.getElementById(tid); var c=document.getElementById(cid);
  if(t&&c) c.textContent=t.value.length+' characters';
}

function loadScenario(type) {
  var tr=document.getElementById('transcript'); var so=document.getElementById('social');
  if(type==='flood'){
    tr.value='EMERGENCY: Water has breached residential gates in Gulshan-e-Iqbal blocks 13 and 14. Multiple families trapped on upper floors. Flash flooding from heavy rainfall. Need rescue boats immediately. University Road completely submerged.';
    so.value=JSON.stringify([
      {id:'s1',text:'Panic in Gulshan! University Road completely submerged. Cars are floating. Please send help.',platform:'Twitter',timestamp:'2026-05-17T11:00:00Z',location_mention:'Gulshan-e-Iqbal, Karachi',likes:1200,verified:true},
      {id:'s2',text:'Families stranded on rooftops in Gulshan block 13. Water level rising fast. URGENT help needed.',platform:'Facebook',timestamp:'2026-05-17T11:02:00Z',location_mention:'Gulshan',likes:350,verified:false},
      {id:'s3',text:'Flash flood confirmed in Gulshan-e-Iqbal. PDMA teams requested immediately.',platform:'Twitter',timestamp:'2026-05-17T11:05:00Z',location_mention:'Gulshan-e-Iqbal',likes:2100,verified:true}
    ],null,2);
    toast('Gulshan Flood scenario loaded.','ok');
  } else {
    tr.value='Alert from G-9 Markaz Islamabad. Water flooding the streets but caller believes it may be a burst water main rather than natural flooding. Road is blocked.';
    so.value=JSON.stringify([
      {id:'s1',text:'Not a flood in G-9. Main water pipeline burst near the roundabout. KWSB needs to respond.',platform:'Twitter',timestamp:'2026-05-17T11:15:00Z',location_mention:'Islamabad',likes:12,verified:false},
      {id:'s2',text:'Broken pipe in G-9 causing flooding. Stop spreading panic about a flood.',platform:'Facebook',timestamp:'2026-05-17T11:18:00Z',location_mention:'G-9, Islamabad',likes:4,verified:false}
    ],null,2);
    toast('Conflict check scenario loaded.','ok');
  }
  countChars('transcript','tc'); countChars('social','sc');
}

// ── SECTION SWITCH ────────────────────────────────────────────────
function onSectionSwitch(id) {
  if(id==='incidents') loadIncidents();
  if(id==='logs') loadLogs();
  if(id==='resources') loadResources();
}

// ── TOAST ─────────────────────────────────────────────────────────
function toast(msg, type) {
  var c=document.getElementById('toast-wrap'); if(!c) return;
  var t=document.createElement('div'); t.className='toast '+(type||'ok'); t.textContent=msg;
  c.appendChild(t); setTimeout(function(){t.remove();},4000);
}
