// 1. CESIUM SETUP
// Token from .env
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiNjFjNDkyOS1hZmZlLTQ0YmUtODViOS1lZDUxMDExYWIwZTciLCJpZCI6MzQ2Mjc4LCJpYXQiOjE3NTkzMTY3NDd9.awxOsdnDLokLuS9p-NWVaIJSGk8u5r46bjxz1jh2pi8';

let viewer = null;
const API_BASE = 'http://127.0.0.1:8000/api';

function initCesium() {
    if (viewer) return;
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: Cesium.createWorldTerrain(),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        timeline: false,
        animation: false
    });

    // Fly to New Delhi
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 5000),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
        }
    });

    // Add Zone Entities from API
    fetchZonesForMap();
}

async function fetchZonesForMap() {
    try {
        const res = await fetch(`${API_BASE}/planner/`);
        const zones = await res.json();
        zones.forEach(z => {
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(z.longitude, z.latitude),
                point: { pixelSize: 10, color: Cesium.Color.fromCssColorString('#0d9488') },
                label: {
                    text: z.name,
                    font: '14px sans-serif',
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                }
            });
        });
    } catch (e) { console.error("Map Data Error", e); }
}

// 2. TAB LOGIC
function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    // Note: 'event' is deprecated/global in some contexts, strictly we should pass it, but for simple DOM it works.
    // Better practice: allow the caller to pass 'this' or use event listener. 
    // For now we assume inline onclick passes event implicitly or we find the element by other means.
    // We'll update the inline HTML to pass 'this'.
}

// 3. HEALTH DATA
async function loadHealthData() {
    try {
        const [hosp, epi, deserts] = await Promise.all([
            fetch(`${API_BASE}/health/`).then(r => r.json()),
            fetch(`${API_BASE}/health/epidemiology/`).then(r => r.json()),
            fetch(`${API_BASE}/health/health_deserts/`).then(r => r.json())
        ]);

        // Render Hospitals
        let icu = 0, icuT = 0, gen = 0, genT = 0, oxy = 0;
        let hHtml = '';
        hosp.forEach(h => {
            icu += h.occupied_beds_icu; icuT += h.total_beds_icu;
            gen += h.occupied_beds_general; genT += h.total_beds_general;
            oxy += h.oxygen_supply_level;
            hHtml += `<tr><td>${h.name}</td><td>${h.zone_name}</td>
                <td>${h.occupied_beds_icu}/${h.total_beds_icu}</td>
                <td><span class="badge ${h.occupied_beds_icu / h.total_beds_icu > 0.8 ? 'bg-danger' : 'bg-success'}">${h.occupied_beds_icu / h.total_beds_icu > 0.8 ? 'CRITICAL' : 'STABLE'}</span></td></tr>`;
        });
        document.getElementById('hospital-table').innerHTML = hHtml;
        document.getElementById('icu-total').innerText = `${icu}/${icuT}`;
        document.getElementById('general-total').innerText = `${gen}/${genT}`;
        document.getElementById('oxygen-avg').innerText = Math.round(oxy / hosp.length || 0) + '%';

        // Render Epi
        document.getElementById('epi-list').innerHTML = epi.map(e => `
            <div style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <strong>${e.zone_name}</strong>
                <span style="color:${e.resp_cases > 50 ? 'red' : 'orange'}">Cases: ${e.resp_cases} (AQI ${e.aqi})</span>
            </div>`).join('');

        // Render Deserts
        const dElem = document.getElementById('desert-alerts');
        if (deserts.length === 0) dElem.innerHTML = '<div style="padding:1rem;color:green;">No Health Deserts</div>';
        else dElem.innerHTML = deserts.map(d => `<div style="padding:0.8rem; background:#fff1f2; margin-bottom:0.5rem; border-left:3px solid red;">
            <strong>Health Desert: ${d.name}</strong><br><small>High Vulnerability Zone</small></div>`).join('');
    } catch (e) { console.error("Health Data Error", e); }
}

// 4. AGRI DATA
async function loadAgriData() {
    try {
        const res = await fetch(`${API_BASE}/farmer/`);
        const crops = await res.json();

        document.getElementById('agri-count').innerText = crops.length;
        const riskCount = crops.filter(c => c.spoilage_risk_score > 50).length;
        document.getElementById('spoilage-risk').innerText = riskCount;

        document.getElementById('agri-table').innerHTML = crops.map(c => `
            <tr>
                <td>${c.crop_type}</td>
                <td>${c.farmer_name}</td>
                <td>${c.origin_zone_name}</td>
                <td>${c.quantity_kg}kg</td>
                <td><span class="badge ${c.spoilage_risk_score > 50 ? 'bg-danger' : 'bg-success'}">${c.spoilage_risk_score}%</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 5. CITIZEN DATA
async function loadCitizenData() {
    try {
        const res = await fetch(`${API_BASE}/citizen/`);
        const reports = await res.json();

        const cElem = document.getElementById('citizen-reports');
        if (reports.length === 0) cElem.innerHTML = '<div style="padding:1rem;color:#666;">No recent reports in your area.</div>';
        else cElem.innerHTML = reports.map(r => `
            <div style="padding:0.8rem; border-bottom:1px solid #eee;">
                <span class="badge bg-warning">${r.report_type}</span>
                <div style="margin-top:0.4rem; font-weight:500;">${r.description}</div>
                <div style="font-size:0.8rem; color:#888;">${new Date(r.timestamp).toLocaleDateString()} • ${r.zone_name}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}
