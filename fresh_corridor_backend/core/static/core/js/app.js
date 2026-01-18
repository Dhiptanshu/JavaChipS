// 1. CESIUM SETUP
// Token from .env
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiNjFjNDkyOS1hZmZlLTQ0YmUtODViOS1lZDUxMDExYWIwZTciLCJpZCI6MzQ2Mjc4LCJpYXQiOjE3NTkzMTY3NDd9.awxOsdnDLokLuS9p-NWVaIJSGk8u5r46bjxz1jh2pi8';

let viewer = null;
const API_BASE = '/api'; // Relative path for Django
let selectedZoneId = null;

function initCesium() {
    if (viewer) return;
    viewer = new Cesium.Viewer('cesiumContainer', {
        // terrainProvider: Cesium.createWorldTerrain(), // REMOVED
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: true,
        sceneModePicker: false,
        navigationHelpButton: false,
        timeline: false,
        animation: false,
        selectionIndicator: true
    });

    // Set View to New Delhi immediately
    // Fly to New Delhi (Animation from app_new.js)
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 20000),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0
        },
        duration: 3.0
    });

    // Add Zone Entities from API
    fetchZonesForMap();
}

async function fetchZonesForMap() {
    try {
        const res = await fetch(`${API_BASE}/planner/`);
        const zones = await res.json();

        zones.forEach(z => {
            let entity = viewer.entities.add({
                name: z.name,
                id: 'zone_' + z.id,
                position: Cesium.Cartesian3.fromDegrees(z.longitude, z.latitude),
                point: { pixelSize: 15, color: Cesium.Color.fromCssColorString('#0d9488'), outlineWidth: 2, outlineColor: Cesium.Color.WHITE },
                label: {
                    text: z.name,
                    font: '14px sans-serif',
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10)
                },
                properties: {
                    zone_id: z.id
                }
            });
        });

        // Handle Zone Click for Simulation
        viewer.selectedEntityChanged.addEventListener(function (entity) {
            if (entity && entity.id.startsWith('zone_')) {
                selectedZoneId = entity.properties.zone_id.getValue();

                // Show Urban Control Center
                const uccParams = document.getElementById('urban-control-center');
                const zoneNameEl = document.getElementById('ucc-zone-name');
                const hintEl = document.getElementById('urban-hint');
                const resiliencePanel = document.getElementById('resilience-panel');

                if (uccParams) {
                    uccParams.style.display = 'flex'; // Use flex as per CSS
                    if (zoneNameEl) zoneNameEl.innerText = entity.name;
                }
                if (hintEl) hintEl.style.display = 'none';
                if (resiliencePanel) resiliencePanel.style.display = 'flex';

                // Fetch standard metrics
                fetchResilienceMetrics(selectedZoneId);

                // Feedback
                if (window.showToast) window.showToast(`Selected Zone: ${entity.name}`, 'info');

            } else {
                selectedZoneId = null;
                // Don't auto-hide immediately on deselect as it might be a route click
                // But generally, deselecting zone should hide the panel? 
                // Let's keep existing logic but map to new IDs
                const uccParams = document.getElementById('urban-control-center');
                if (uccParams) uccParams.style.display = 'none';
                document.getElementById('resilience-panel').style.display = 'none';
                document.getElementById('urban-hint').style.display = 'block';
            }
        });

    } catch (e) { console.error("Map Data Error", e); }
}

async function fetchResilienceMetrics(id) {
    try {
        const res = await fetch(`${API_BASE}/planner/${id}/resilience_metrics/`);
        const data = await res.json();

        if (data.metrics) {
            document.getElementById('metric-overall').innerText = data.overall_resilience_score;
            document.getElementById('metric-aqi').innerText = data.metrics.aqi_score;
            document.getElementById('metric-med').innerText = data.metrics.medical_capacity_score;
        }
    } catch (e) { console.error(e); }
}

async function runSimulation() {
    if (!selectedZoneId) { alert("Select a zone first!"); return; }

    const rain = document.getElementById('sim-rain').value;
    const traffic = document.getElementById('sim-traffic').value;

    const btn = document.querySelector('#sim-panel button');
    btn.innerText = "Simulating...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/planner/${selectedZoneId}/simulate/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify({
                rain_intensity: rain,
                traffic_load: traffic
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            document.getElementById('sim-results').style.display = 'block';
            document.getElementById('res-traffic').innerText = data.scenarios.traffic_congestion_display;
            document.getElementById('res-ambulance').innerText = "+" + data.scenarios.ambulance_response_time_min + " mins";
            document.getElementById('res-flood').innerText = data.scenarios.flood_risk_probability + "% Risk";

            if (data.alerts && data.alerts.some(x => x)) {
                alert(data.alerts.filter(x => x).join("\n"));
            }
        }
    } catch (e) {
        alert("Simulation failed."); console.error(e);
    } finally {
        btn.innerText = "Run Simulation";
        btn.disabled = false;
    }
}

// Helper for CSRF
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// 2. TAB LOGIC
let healthInterval = null;

function switchTab(tabId, el) {
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (el) el.classList.add('active');
    else {
        const map = { 'urban': 0, 'health': 1, 'agri': 2, 'citizen': 3 };
        const btn = document.querySelectorAll('.nav-tab')[map[tabId]];
        if (btn) btn.classList.add('active');
    }

    // Toggle Cyber Theme (Always Active)
    document.body.classList.add('cyber-theme');

    if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
    }

    if (tabId === 'urban') {
        setTimeout(initCesium, 100);
        loadUrbanData();

        if (!window.urbanRouteInitialized) {
            initRouteTrafficAnalysis();
            window.urbanRouteInitialized = true;
        }

        if (!window.urbanTrafficInitialized) {
            initTrafficMonitoring();
            window.urbanTrafficInitialized = true;
        }
    }

    if (tabId === 'health') {
        loadHealthData();
        healthInterval = setInterval(loadHealthData, 3000);
    }

    if (tabId === 'agri') loadAgriData();

    if (tabId === 'citizen') {
        setTimeout(initCitizenMap, 100);
        loadCitizenData();

        fetchCitizenWeather();
        if (window.weatherInterval) clearInterval(window.weatherInterval);
        window.weatherInterval = setInterval(fetchCitizenWeather, 5000);

        if (!window.citizenToolsInitialized) {
            setTimeout(() => {
                initCitizenTrafficMonitoring();
                initCitizenRouteAnalysis();
                window.citizenToolsInitialized = true;
            }, 500);
        }
    }
}

// 3. HEALTH DATA & MAP
let healthViewer = null;

function initHealthMap() {
    if (healthViewer) return;
    healthViewer = new Cesium.Viewer('healthMapContainer', {
        // terrainProvider: Cesium.createWorldTerrain(), // REMOVED
        baseLayerPicker: false,
        geocoder: false,
        timeline: false,
        animation: false,
        homeButton: false,
        navigationHelpButton: false,
        infoBox: true, // Enable info box for details
        selectionIndicator: true
    });
    // New Delhi View
    healthViewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 15000),
        orientation: {
            heading: 0.0,
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0
        }
    });
}

let cachedHospitals = [];
let cachedEpi = [];

function updateHealthMapPins(hospitals, epiData) {
    if (!healthViewer) return;

    // Cache data for slider updates
    if (hospitals) cachedHospitals = hospitals;
    if (epiData) cachedEpi = epiData;

    // Filter Logic
    const limit = parseInt(document.getElementById('hospital-scale') ? document.getElementById('hospital-scale').value : 50);
    const sortedHospitals = [...cachedHospitals].sort((a, b) => b.total_beds_general - a.total_beds_general);
    const topHospitals = new Set(sortedHospitals.slice(0, limit).map(h => 'hosp_' + h.name.replace(/\s+/g, '_')));

    // 1. Plot Hospitals
    const showHosp = document.getElementById('toggle-hospitals') ? document.getElementById('toggle-hospitals').checked : true;

    // First, hide ANY hospital not in top N or not toggled
    healthViewer.entities.values.forEach(e => {
        if (e.id.startsWith('hosp_')) {
            if (!showHosp || !topHospitals.has(e.id)) {
                e.show = false;
            }
        }
    });

    // Then, Add or Update valid ones
    sortedHospitals.slice(0, limit).forEach(h => {
        const id = 'hosp_' + h.name.replace(/\s+/g, '_');
        const isCritical = (h.occupied_beds_icu / h.total_beds_icu) > 0.8;
        let entity = healthViewer.entities.getById(id);

        if (entity) {
            // Update Existing
            entity.point.color = isCritical ? Cesium.Color.RED : Cesium.Color.GREEN;
            entity.show = showHosp; // It's in the list, so respect the toggle
            entity.description = `
                <h3>${h.name}</h3>
                <p>Status: <strong>${isCritical ? 'CRITICAL' : 'Stable'}</strong></p>
                <p>ICU: ${h.occupied_beds_icu}/${h.total_beds_icu}</p>
                <p>General: ${h.occupied_beds_general}/${h.total_beds_general}</p>
                <p>Oxygen: ${h.oxygen_supply_level}%</p>
            `;
        } else {
            // Add New
            healthViewer.entities.add({
                id: id,
                show: showHosp,
                position: Cesium.Cartesian3.fromDegrees(h.zone_name === 'Unknown' ? 77.2 : 77.2 + Math.random() * 0.1, 28.6 + Math.random() * 0.1),
                point: { pixelSize: 12, color: isCritical ? Cesium.Color.RED : Cesium.Color.GREEN, outlineWidth: 2, outlineColor: Cesium.Color.WHITE },
                label: { text: h.name, font: '10px sans-serif', verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, 10) },
                description: `
                    <h3>${h.name}</h3>
                    <p>Status: <strong>${isCritical ? 'CRITICAL' : 'Stable'}</strong></p>
                    <p>ICU: ${h.occupied_beds_icu}/${h.total_beds_icu}</p>
                    <p>General: ${h.occupied_beds_general}/${h.total_beds_general}</p>
                    <p>Oxygen: ${h.oxygen_supply_level}%</p>
                `
            });
        }
    });

    // 2. Plot AQI Stations (Zones/Real Stations)
    const showAqi = document.getElementById('toggle-aqi') ? document.getElementById('toggle-aqi').checked : true;
    (epiData || cachedEpi).forEach(z => {
        // Adapt fields
        const name = z.name || z.zone_name;
        const lat = z.lat || z.latitude;
        const lon = z.lon || z.longitude;
        const aqi = z.aqi || 0;

        const id = 'aqi_' + name.replace(/\s+/g, '_');
        let entity = healthViewer.entities.getById(id);

        if (entity) {
            // Update Existing
            entity.label.text = `${aqi} AQI`;
            entity.show = showAqi;
            entity.description = `
                <h3>${name}</h3>
                <p>City: ${z.city || z.area_type || 'Unknown'}</p>
                <p>AQI: ${aqi}</p>
                <p>${z.live_ts ? 'Live Update: ' + new Date(z.live_ts).toLocaleTimeString() : 'Simulated Data'}</p>
            `;
        } else {
            // Add New
            healthViewer.entities.add({
                id: id,
                show: showAqi,
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                point: { pixelSize: 15, color: Cesium.Color.ORANGE.withAlpha(0.7) },
                label: { text: `${aqi} AQI`, font: '12px monospace', style: Cesium.LabelStyle.FILL_AND_OUTLINE, fillColor: Cesium.Color.WHITE, outlineWidth: 2, outlineColor: Cesium.Color.BLACK },
                description: `
                    <h3>${name}</h3>
                    <p>City: ${z.city || z.area_type || 'Unknown'}</p>
                    <p>AQI: ${aqi}</p>
                    <p>${z.live_ts ? 'Live Update: ' + new Date(z.live_ts).toLocaleTimeString() : 'Simulated Data'}</p>
                `
            });
        }
    });

    // 3. Zoom ONLY ONE TIME (Initial Load) - Focus on HOSPITALS ONLY
    if (!window.hasZoomedHealthMap) {
        const hospEntities = healthViewer.entities.values.filter(e => e.id.startsWith('hosp_'));
        if (hospEntities.length > 0) {
            healthViewer.flyTo(hospEntities, {
                duration: 2.0,
                offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 2000) // Lower offset for closer view
            });
            window.hasZoomedHealthMap = true;
        }
    }
}

function toggleMapLayer(layer) {
    // Just re-run the main update logic which reads the checkboxes and slider
    updateHealthMapPins(null, null);
}


async function loadHealthData() {
    try {
        const [hosp, epi, deserts, stations] = await Promise.all([
            fetch(`${API_BASE}/health/`).then(r => r.json()),
            fetch(`${API_BASE}/health/epidemiology/`).then(r => r.json()),
            fetch(`${API_BASE}/health/health_deserts/`).then(r => r.json()),
            fetch(`${API_BASE}/get_stations`).then(r => r.json())
        ]);

        // Init Map if needed
        initHealthMap();
        // Use Real Stations for AQI pins, fallback to epi if empty
        updateHealthMapPins(hosp, stations.length > 0 ? stations : epi);

        // Render Hospitals
        let icu = 0, icuT = 0, gen = 0, genT = 0, oxy = 0;
        let hHtml = '';
        hosp.forEach(h => {
            icu += h.occupied_beds_icu; icuT += h.total_beds_icu;
            gen += h.occupied_beds_general; genT += h.total_beds_general;
            oxy += h.oxygen_supply_level;
            const icuUsage = h.total_beds_icu > 0 ? (h.occupied_beds_icu / h.total_beds_icu) : 0;
            hHtml += `<tr style="border-bottom: 1px solid var(--card-border);">
                <td style="padding:12px;"><strong style="color:var(--text-main);">${h.name}</strong><div style="font-size:0.75em;color:var(--text-muted);">${h.zone_name}</div></td>
                <td style="padding:12px;"><span style="font-size:0.85em; color:var(--text-main);">${h.zone_name}</span></td>
                <td style="padding:12px;"><div style="width:80px; background:rgba(255,255,255,0.1); border-radius:4px; height:8px; overflow:hidden;">
                        <div style="width:${icuUsage * 100}%; background:${icuUsage > 0.8 ? '#ef4444' : '#22c55e'}; height:100%;"></div>
                    </div><small style="color:var(--text-muted);">${h.occupied_beds_icu}/${h.total_beds_icu}</small></td>
                <td style="padding:12px;"><span class="badge ${icuUsage > 0.8 ? 'bg-danger' : 'bg-success'}">${icuUsage > 0.8 ? 'CRITICAL' : 'STABLE'}</span></td>
            </tr>`;
        });
        document.getElementById('hospital-table').innerHTML = hHtml;
        document.getElementById('icu-total').innerText = `${icu}/${icuT}`;
        document.getElementById('general-total').innerText = `${gen}/${genT}`;
        document.getElementById('oxygen-avg').innerText = Math.round(oxy / hosp.length || 0) + '%';

        // Render Real AQI List (replacing Epi list)
        const aqiList = stations.length > 0 ? stations : epi;
        // Sort by AQI descending
        aqiList.sort((a, b) => (parseFloat(b.aqi) || 0) - (parseFloat(a.aqi) || 0));

        if (aqiList.length === 0) {
            document.getElementById('epi-list').innerHTML = '<div style="padding:1rem;">Fetching live data...</div>';
        } else {
            document.getElementById('epi-list').innerHTML = aqiList.slice(0, 5).map(e => {
                // Adapt fields: station has 'name', epi has 'zone_name'
                const name = e.name || e.zone_name;
                const aqi = e.aqi || 0;
                // If real station, add click handler
                const clickAttr = e.name ? `onclick="openStationModal('${e.name}')" style="cursor:pointer;"` : '';

                return `
                <div style="padding:0.8rem; border-bottom:1px solid var(--card-border); display:flex; justify-content:space-between; align-items:center;" ${clickAttr}>
                    <div>
                        <div style="font-weight:600; color:var(--text-main);">${name}</div>
                        <span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted); font-weight:500;">${e.city || e.area_type || 'Station'}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.1rem; font-weight:700; color:${getColorForAQI(aqi)}">${aqi} AQI</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${e.live_ts ? new Date(e.live_ts).toLocaleTimeString() : 'Simulated'}</div>
                    </div>
                </div>`;
            }).join('');
        }

        // Render Deserts
        const dElem = document.getElementById('desert-alerts');
        if (deserts.length === 0) dElem.innerHTML = '<div style="padding:1rem;color:green;">No Health Deserts</div>';
        else dElem.innerHTML = deserts.map(d => `<div style="padding:0.8rem; background:rgba(239, 68, 68, 0.1); margin-bottom:0.5rem; border-left:3px solid #ef4444; border-radius: 4px;">
            <strong style="color:var(--text-main);">Health Desert: ${d.name}</strong><br><small style="color:var(--text-muted);">High Vulnerability Zone</small></div>`).join('');
    } catch (e) { console.error("Health Data Error", e); }
}

// 4. AGRI DATA
async function loadAgriData() {
    try {
        // Fetch LIVE Data from Validator Service (Port 8001)
        const res = await fetch('http://127.0.0.1:8001/api/agri/batches/');
        if (!res.ok) throw new Error("Validator Service Unreachable");

        const crops = await res.json();

        // Update KPI Counters
        document.getElementById('agri-count').innerText = crops.length;
        const riskCount = crops.filter(c => c.spoilage_risk_score > 50).length;
        document.getElementById('spoilage-risk').innerText = riskCount;

        // Populate Table with Validator Data
        document.getElementById('agri-table').innerHTML = crops.map(c => `
            <tr>
                <td>${c.crop_name || c.crop}</td>
                <td>${c.farmer_name}</td>
                <td><span style="color:#64748b">North Corridor</span></td> <!-- Static for Validator Data -->
                <td>${c.quantity_kg}kg</td>
                <td>
                    <span class="badge ${c.spoilage_risk_score > 50 ? 'bg-danger' : 'bg-success'}">
                        ${c.spoilage_risk_score.toFixed(0)}%
                    </span>
                    ${c.status === 'VERIFIED' ? '<span class="badge bg-success">✅ Verified</span>' : ''}
                </td>
            </tr>
        `).join('');

        // Also fetch Market Metrics (Prices)
        fetchValidatorData();

    } catch (e) {
        console.error("Agri Load Error:", e);
        document.getElementById('agri-table').innerHTML = `
            <tr><td colspan="5" style="text-align:center; color:#ef4444;">
                Could not load live shipments. Is Agri-Validator (Port 8001) running?
            </td></tr>`;
    }
}

async function fetchValidatorData() {
    const statusEl = document.getElementById('validator-status');
    const tableEl = document.getElementById('validator-table');

    try {
        const res = await fetch('http://127.0.0.1:8001/api/agri/market-metrics/');
        if (!res.ok) throw new Error("Service unavailable");

        const data = await res.json();
        const commodities = data.commodities || [];

        statusEl.className = 'badge bg-success';
        statusEl.innerText = 'Connected • Live';

        tableEl.innerHTML = commodities.map(c => `
            <tr>
                <td style="font-weight:600;">${c.commodity}</td>
                <td style="font-size:1.1rem;">₹${c.modal_price}</td>
                <td>${c.city_stock_kg.toLocaleString()} kg</td>
                <td><span style="color:${c.trend === 'up' ? 'green' : 'gray'}">${c.trend === 'up' ? '📈 Rising' : '➡️ Stable'}</span></td>
                <td>${c.scarcity_alert ? '<span class="badge bg-danger">Low Stock</span>' : '<span class="badge bg-success">Adequate</span>'}</td>
            </tr>
        `).join('');

    } catch (e) {
        console.warn("Validator Fetch Failed:", e);
        statusEl.className = 'badge bg-danger';
        statusEl.innerText = 'Disconnected';
        tableEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">
            ⚠ Failed to connect to Validator Service on Port 8001. <br>
            Is the Agri-Validator running?
        </td></tr>`;
    }
}

// 5. CITIZEN DATA
async function loadCitizenData() {
    try {
        const res = await fetch(`${API_BASE}/citizen/`);
        const reports = await res.json();

        const cElem = document.getElementById('citizen-reports');
        if (reports.length === 0) cElem.innerHTML = '<div style="padding:1rem;color:#666;">No recent reports in your area.</div>';
        else cElem.innerHTML = reports.map(r => `
            <div style="padding:0.8rem; border-bottom:1px solid var(--card-border);">
                <span class="badge bg-warning">${r.report_type}</span>
                <div style="margin-top:0.4rem; font-weight:500; color:var(--text-main);">${r.description}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(r.timestamp).toLocaleDateString()} • ${r.zone_name}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }

    // Load AQI Hotspots
    loadAQIHotspots('cit-aqi-hotspots-list');
}

function getColorForAQI(aqi) {
    if (aqi < 50) return '#22c55e'; // Green
    if (aqi < 100) return '#84cc16'; // Light Green
    if (aqi < 200) return '#eab308'; // Yellow
    if (aqi < 300) return '#f97316'; // Orange
    if (aqi < 400) return '#ef4444'; // Red
    return '#7f1d1d'; // Maroon
}

// 6. AQI HOTSPOTS
// 6. AQI HOTSPOTS
async function loadAQIHotspots(containerId = 'aqi-hotspots-list') {
    try {
        // 1. Try fetching Real Stations first
        const res = await fetch(`${API_BASE}/get_stations`);
        let stations = await res.json();
        let useSimulated = false;

        // 2. Fallback to Simulated Epidemiology Data if no stations
        if (!stations || stations.length === 0) {
            console.log("No real AQI stations found, falling back to simulated data.");
            const resSim = await fetch(`${API_BASE}/health/epidemiology/`);
            stations = await resSim.json();
            useSimulated = true;
        }

        // 3. Filter and Normalize
        // Real data has 'aqi', Simulated has 'aqi' (but checks generic structure)
        const withData = stations.filter(s => s.aqi !== undefined || s.co2_estimated !== undefined);

        // 4. Sort by AQI descending
        withData.sort((a, b) => {
            let vA = parseFloat(a.aqi) || 0;
            let vB = parseFloat(b.aqi) || 0;
            return vB - vA;
        });

        const top5 = withData.slice(0, 5);
        const listElem = document.getElementById(containerId);
        if (!listElem) return;

        if (top5.length === 0) {
            listElem.innerHTML = '<div style="padding:1rem;color:#666;">No AQI data available.</div>';
            return;
        }

        listElem.innerHTML = top5.map(s => {
            // Normalize Fields (Real vs Simulated)
            // Simulated uses 'zone_name', Real uses 'name'
            // Simulated uses 'area_type', Real uses 'city'
            const name = s.name || s.zone_name || 'Unknown Station';
            const location = s.city || s.area_type || 'Sector Zone';
            const timeStr = s.live_ts ? new Date(s.live_ts).toLocaleTimeString() : (useSimulated ? 'Simulated' : 'N/A');
            const val = parseFloat(s.aqi) || 0;

            // Click handler only for real stations (simulated don't have modal data usually, or we adapt)
            const clickAttr = !useSimulated ? `onclick="openStationModal('${name}')"` : '';
            const cursorStyle = !useSimulated ? 'cursor:pointer;' : '';

            // EXACT MATCH with Health Monitor HTML
            return `
            <div style="padding:0.8rem; border-bottom:1px solid var(--card-border); display:flex; justify-content:space-between; align-items:center; ${cursorStyle}" ${clickAttr}>
                <div>
                    <div style="font-weight:600; color:var(--text-main);">${name}</div>
                    <span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted); font-weight:500;">${location}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.1rem; font-weight:700; color:${getColorForAQI(val)}">${val} AQI</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${timeStr}</div>
                </div>
            </div>`;
        }).join('');

        // Store for modal lookup if real
        if (!useSimulated) {
            window.allStations = stations;
        }

    } catch (e) { console.error("AQI Load Error", e); }
}

function openStationModal(stationName) {
    const s = (window.allStations || []).find(x => x.name === stationName);
    if (!s) return;

    document.getElementById('modal-station-name').innerText = s.name;
    document.getElementById('modal-station-location').innerText = `${s.city}, ${s.state}`;
    document.getElementById('modal-aqi').innerText = s.aqi || '--';
    document.getElementById('modal-predominant').innerText = s.predominant_parameter || '--';
    document.getElementById('modal-updated').innerText = 'Last Update: ' + (s.live_ts || 'N/A');

    const pGrid = document.getElementById('modal-pollutants');
    if (s.pollutants && s.pollutants.length > 0) {
        pGrid.innerHTML = s.pollutants.map(p => `
            <div class="pollutant-card">
                <div class="p-label">${p.id}</div>
                <div class="p-val">${p.avg || '--'}</div>
                <div style="font-size:0.7rem; color:#666; margin-top:4px;">Min ${p.min} / Max ${p.max}</div>
            </div>
        `).join('');
    } else {
        pGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#666;">No detailed pollutant data.</div>';
    }

    document.getElementById('station-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('station-modal').classList.remove('active');
}

// ======================================
// TRAFFIC CONGESTION MONITORING
// ======================================

const TRAFFIC_API_URL = '/api/traffic/';
let trafficAutoRefreshInterval = null;
let isTrafficAutoRefreshEnabled = false;
let previousTrafficData = null;
const TRAFFIC_POLL_INTERVAL = 10000; // 10 seconds

// Initialize traffic monitoring event listeners
// Initialize traffic monitoring event listeners
function initTrafficMonitoring() {
    // Prevent double binding
    if (window.isTrafficMonitoringInitialized) return;
    window.isTrafficMonitoringInitialized = true;

    const fetchBtn = document.getElementById('fetchTrafficBtn');
    const autoRefreshBtn = document.getElementById('autoRefreshTrafficBtn');
    const latInput = document.getElementById('traffic-latitude');
    const lonInput = document.getElementById('traffic-longitude');

    if (fetchBtn) {
        // Use onclick to ensure single handler and overwrite any potential conflicts
        fetchBtn.onclick = function () {
            fetchTrafficData(true);
        };
    }

    if (autoRefreshBtn) {
        autoRefreshBtn.onclick = toggleTrafficAutoRefresh;
    }

    if (latInput) {
        latInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchTrafficData(true);
        });
    }

    if (lonInput) {
        lonInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchTrafficData(true);
        });
    }
}

// Helper: Show Error
function showTrafficError(msg) {
    const errEl = document.getElementById('traffic-error');
    const loadingEl = document.getElementById('traffic-loading');
    const resultsEl = document.getElementById('traffic-results');

    if (loadingEl) loadingEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'none';

    if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
    } else {
        console.error("Traffic Error:", msg);
        alert("Traffic Error: " + msg);
    }
}

// Helper: Format Time
function formatTrafficTime(seconds) {
    if (!seconds) return '--';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}m ${sec}s`;
}

async function fetchTrafficData(showLoading = false) {
    const lat = document.getElementById('traffic-latitude').value.trim();
    const lon = document.getElementById('traffic-longitude').value.trim();

    console.log(`Fetching Traffic Data for ${lat}, ${lon}`);

    if (!lat || !lon) {
        showTrafficError('Please enter both latitude and longitude');
        return;
    }

    const loading = document.getElementById('traffic-loading');
    const error = document.getElementById('traffic-error');
    const results = document.getElementById('traffic-results');

    if (showLoading && loading) {
        loading.style.display = 'block';
        error.style.display = 'none';
        results.style.display = 'none';
    }

    try {
        const response = await fetch(`${TRAFFIC_API_URL}?lat=${lat}&lon=${lon}`);
        const data = await response.json();

        if (data.status === 'success') {
            if (hasTrafficDataChanged(data)) {
                displayTrafficData(data, !showLoading);
                previousTrafficData = data;
            }
        } else {
            showTrafficError(data.message || 'Failed to fetch traffic data');
        }
    } catch (err) {
        if (showLoading) {
            showTrafficError('Network error: ' + err.message);
        }
    } finally {
        if (showLoading && loading) {
            loading.style.display = 'none';
        }
    }
}

function hasTrafficDataChanged(newData) {
    if (!previousTrafficData) return true;

    const oldTraffic = previousTrafficData.traffic;
    const newTraffic = newData.traffic;

    return (
        oldTraffic.currentSpeed !== newTraffic.currentSpeed ||
        oldTraffic.freeFlowSpeed !== newTraffic.freeFlowSpeed ||
        oldTraffic.currentTravelTime !== newTraffic.currentTravelTime ||
        oldTraffic.congestionScore !== newTraffic.congestionScore ||
        oldTraffic.roadClosure !== newTraffic.roadClosure
    );
}

function displayTrafficData(data, isAutoUpdate = false) {
    const traffic = data.traffic;
    const location = data.location;

    // Feature from app_new.js: Notification
    if (isAutoUpdate) {
        showTrafficUpdateNotification();
    }

    // Congestion score and level
    const congestionScore = traffic.congestionScore;
    const congestionLevel = getTrafficCongestionLevel(congestionScore);

    const scoreEl = document.getElementById('traffic-congestion-score');
    const labelEl = document.getElementById('traffic-congestion-label');
    const cardEl = document.getElementById('traffic-congestion-card');
    const progressEl = document.getElementById('traffic-progress-fill');

    if (scoreEl) scoreEl.textContent = congestionScore + '%';
    if (labelEl) labelEl.textContent = congestionLevel.label;

    if (cardEl) {
        cardEl.className = 'card ' + congestionLevel.class;
    }

    if (progressEl) {
        progressEl.style.width = congestionScore + '%';
        progressEl.style.background = 'rgba(255,255,255,0.8)';
    }

    // Speed stats
    const currentSpeedEl = document.getElementById('traffic-current-speed');
    const freeFlowSpeedEl = document.getElementById('traffic-free-flow-speed');
    if (currentSpeedEl) currentSpeedEl.textContent = traffic.currentSpeed + ' km/h';
    if (freeFlowSpeedEl) freeFlowSpeedEl.textContent = traffic.freeFlowSpeed + ' km/h';

    // Time stats
    const currentTimeEl = document.getElementById('traffic-current-time');
    if (currentTimeEl) currentTimeEl.textContent = formatTrafficTime(traffic.currentTravelTime);

    // Road information
    const roadClassEl = document.getElementById('traffic-road-class');
    const roadClosureEl = document.getElementById('traffic-road-closure');
    const confidenceEl = document.getElementById('traffic-confidence');

    if (roadClassEl) roadClassEl.textContent = traffic.roadClass;
    if (roadClosureEl) roadClosureEl.textContent = traffic.roadClosure ? '⚠️ Yes' : '✅ No';
    if (confidenceEl) confidenceEl.textContent = traffic.confidence + '%';

    // Location
    const locLatEl = document.getElementById('traffic-loc-lat');
    const locLonEl = document.getElementById('traffic-loc-lon');
    const coordCountEl = document.getElementById('traffic-coord-count');

    if (locLatEl) locLatEl.textContent = location.latitude;
    if (locLonEl) locLonEl.textContent = location.longitude;
    if (coordCountEl) coordCountEl.textContent = data.coordinates.length + ' points';

    // Update last updated time
    updateTrafficLastRefreshTime();

    // Show results
    const results = document.getElementById('traffic-results');
    if (results) results.style.display = 'block';
}

function toggleTrafficAutoRefresh() {
    isTrafficAutoRefreshEnabled = !isTrafficAutoRefreshEnabled;
    const btn = document.getElementById('autoRefreshTrafficBtn');

    if (isTrafficAutoRefreshEnabled) {
        if (btn) {
            btn.textContent = '🔄 Monitor: ON';
            btn.classList.add('active');
        }
        fetchTrafficData(true);
        trafficAutoRefreshInterval = setInterval(() => fetchTrafficData(false), TRAFFIC_POLL_INTERVAL);
    } else {
        if (btn) {
            btn.textContent = '🔄 Monitor: OFF';
            btn.classList.remove('active');
        }
        if (trafficAutoRefreshInterval) {
            clearInterval(trafficAutoRefreshInterval);
            trafficAutoRefreshInterval = null;
        }
        previousTrafficData = null;
    }
}

function updateTrafficLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const statusText = isTrafficAutoRefreshEnabled ? 'Monitoring - Last changed' : 'Last updated';
    const el = document.getElementById('traffic-last-updated');

    if (el) {
        el.textContent = `${statusText}: ${timeString}`;
    }
}

function getTrafficCongestionLevel(score) {
    if (score < 20) {
        return { label: 'Low Traffic', class: 'level-low' };
    } else if (score < 40) {
        return { label: 'Moderate Traffic', class: 'level-moderate' };
    } else if (score < 60) {
        return { label: 'High Congestion', class: 'level-high' };
    } else {
        return { label: 'Severe Congestion', class: 'level-severe' };
    }
}

function formatTrafficTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function showTrafficError(message) {
    const error = document.getElementById('traffic-error');
    const results = document.getElementById('traffic-results');

    if (error) {
        error.textContent = '❌ ' + message;
        error.style.display = 'block';
    }
    if (results) {
        results.style.display = 'none';
    }
}

// Feature from app_new.js
function showTrafficUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = '✨ Traffic data updated!';
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize traffic monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    // RBAC: Check Login
    const role = localStorage.getItem('user_role');
    if (!role) {
        window.location.href = '/login/';
        return;
    }

    // RBAC: Hide Tabs based on Role
    // Roles: PLANNER, AGRICULTURIST, HEALTH, CITIZEN
    // Tabs (Ids): btn-urban (Planner), btn-agri (Agri), btn-health (Health), btn-citizen (Citizen)

    const tabs = {
        'urban': document.getElementById('btn-urban'),
        'agri': document.getElementById('btn-agri'),
        'health': document.getElementById('btn-health'),
        'citizen': document.getElementById('btn-citizen')
    };

    if (role === 'PLANNER') {
        // All visible
    } else if (role === 'AGRICULTURIST') {
        tabs.urban.style.display = 'none';
        tabs.health.style.display = 'none';
        // Auto-switch to Agri
        switchTab('agri');
    } else if (role === 'HEALTH') {
        tabs.urban.style.display = 'none';
        tabs.agri.style.display = 'none';
        // Auto-switch to Health
        switchTab('health');
    } else if (role === 'CITIZEN') {
        tabs.urban.style.display = 'none';
        tabs.agri.style.display = 'none';
        tabs.health.style.display = 'none';
        // Auto-switch to Citizen
        switchTab('citizen');
    }

    initCesium();

    // Default load actions...
    initTrafficMonitoring();
    initRouteTrafficAnalysis();
});

// ============================================
// ROUTE TRAFFIC ANALYSIS - Interactive Map Selection
// ============================================

let routePoints = []; // Array to store 2 selected points
let routeMarkers = []; // Array to store marker entities
let routeLine = null; // Line entity connecting points

let routeClickHandler = null;

function initRouteTrafficAnalysis() {
    // Prevent double binding of button listeners
    if (window.isRouteTrafficAnalysisInitialized) return;
    window.isRouteTrafficAnalysisInitialized = true;

    const analyzeBtn = document.getElementById('analyze-route-btn');
    const clearBtn = document.getElementById('clear-route-btn');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeRouteTraffic);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearRoutePoints);
    }

    // Wait for Cesium viewer to be initialized
    const checkViewer = setInterval(() => {
        if (viewer && viewer.scene) {
            clearInterval(checkViewer);
            setupMapClickHandler();
        }
    }, 100);
}

function setupMapClickHandler() {
    console.log("Setting up Map Click Handler");
    if (window.showToast) window.showToast("Route Analysis Ready (Click Map)", "info");

    // Cleanup existing handler if any
    if (routeClickHandler && !routeClickHandler.isDestroyed()) {
        routeClickHandler.destroy();
    }

    routeClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const handler = routeClickHandler;

    handler.setInputAction((click) => {
        // 1. Check if we clicked an existing Route Marker to avoid duplicate/stacked points
        const pickedObject = viewer.scene.pick(click.position);

        if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id === 'string' && pickedObject.id.startsWith('route_marker')) {
            console.log("Clicked existing route marker. Ignoring.");
            return;
        }

        // 2. Allow adding points even if we clicked a Zone (pickedObject is defined)
        // Convert to cartesian
        const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        if (cartesian) {
            console.log("Adding route point (Zone or Empty Space)");
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            addRoutePoint(lat, lon);

            // Populate Traffic Monitor Inputs
            const tLat = document.getElementById('traffic-latitude');
            const tLon = document.getElementById('traffic-longitude');
            if (tLat && tLon) {
                tLat.value = lat.toFixed(4);
                tLon.value = lon.toFixed(4);
            }

            // Close Urban Control only if we clicked EMPTY space (no zone picked)
            // If user clicked a Zone, let the default handler open the panel (user gets both feedback)
            if (!Cesium.defined(pickedObject)) {
                if (typeof closeUrbanControl === 'function') closeUrbanControl();
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function addRoutePoint(lat, lon) {
    if (routePoints.length >= 2) {
        // If already 2 points, clear and start over
        clearRoutePoints();
    }

    routePoints.push({ lat, lon });

    // Add marker to map
    const pointLabel = routePoints.length === 1 ? 'A' : 'B';
    const pointColor = routePoints.length === 1
        ? Cesium.Color.fromCssColorString('#10b981') // Green for start
        : Cesium.Color.fromCssColorString('#ef4444'); // Red for end

    const marker = viewer.entities.add({
        id: `route_marker_${pointLabel}`, // Explicit ID for filtering
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
            image: createMarkerCanvas(pointLabel, routePoints.length === 1 ? '#10b981' : '#ef4444'),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });

    routeMarkers.push(marker);

    // Update UI
    updateRoutePointsUI();

    // If both points selected, draw line and enable analyze button
    if (routePoints.length === 2) {
        drawRouteLine();
        document.getElementById('analyze-route-btn').disabled = false;
    }
}

function createMarkerCanvas(label, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Draw pin shape
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, Math.PI * 2);
    ctx.fill();

    // Draw point at bottom
    ctx.beginPath();
    ctx.moveTo(24, 44);
    ctx.lineTo(14, 54);
    ctx.lineTo(34, 54);
    ctx.closePath();
    ctx.fill();

    // Draw label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 24, 24);

    return canvas;
}

function drawRouteLine() {
    if (routePoints.length !== 2) return;

    const positions = [
        Cesium.Cartesian3.fromDegrees(routePoints[0].lon, routePoints[0].lat),
        Cesium.Cartesian3.fromDegrees(routePoints[1].lon, routePoints[1].lat)
    ];

    routeLine = viewer.entities.add({
        polyline: {
            positions: positions,
            width: 4,
            material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#3b82f6'),
                dashLength: 16
            }),
            clampToGround: true
        }
    });
}

function updateRoutePointsUI() {
    const pointAEl = document.getElementById('point-a-coords');
    const pointBEl = document.getElementById('point-b-coords');

    if (routePoints.length >= 1 && pointAEl) {
        pointAEl.textContent = `${routePoints[0].lat.toFixed(4)}, ${routePoints[0].lon.toFixed(4)}`;
    }

    if (routePoints.length >= 2 && pointBEl) {
        pointBEl.textContent = `${routePoints[1].lat.toFixed(4)}, ${routePoints[1].lon.toFixed(4)}`;
    }

    // Update instructions
    const instructions = document.getElementById('route-instructions');
    if (instructions && routePoints.length > 0) {
        if (routePoints.length === 1) {
            instructions.innerHTML = '<strong>📍 Select end point</strong><br><span style="font-size: 0.8rem;">Click on the map to select the destination point.</span>';
        } else {
            instructions.innerHTML = '<strong>✅ Route ready</strong><br><span style="font-size: 0.8rem;">Click "Analyze Traffic" to view congestion data.</span>';
        }
    }
}

function clearRoutePoints() {
    routePoints = [];

    // Remove markers from map
    routeMarkers.forEach(marker => viewer.entities.remove(marker));
    routeMarkers = [];

    // Remove line from map
    if (routeLine) {
        viewer.entities.remove(routeLine);
        routeLine = null;
    }

    // Reset UI
    const pointAEl = document.getElementById('point-a-coords');
    const pointBEl = document.getElementById('point-b-coords');

    if (pointAEl) pointAEl.textContent = 'Not selected';
    if (pointBEl) pointBEl.textContent = 'Not selected';

    const instructions = document.getElementById('route-instructions');
    if (instructions) {
        instructions.innerHTML = '<strong>📍 Click on map to select points</strong><br><span style="font-size: 0.8rem;">Select start and end points to analyze traffic congestion along the route.</span>';
    }

    document.getElementById('analyze-route-btn').disabled = true;
    document.getElementById('route-results').style.display = 'none';
    document.getElementById('route-error').style.display = 'none';
}

async function analyzeRouteTraffic() {
    if (routePoints.length !== 2) return;

    const loadingEl = document.getElementById('route-loading');
    const resultsEl = document.getElementById('route-results');
    const errorEl = document.getElementById('route-error');
    const analyzeBtn = document.getElementById('analyze-route-btn');

    // Show loading
    if (loadingEl) loadingEl.style.display = 'block';
    if (resultsEl) resultsEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (analyzeBtn) analyzeBtn.disabled = true;

    try {
        // Calculate intermediate points along the route (every ~2km)
        const checkpoints = generateRouteCheckpoints(routePoints[0], routePoints[1], 5);

        // Fetch traffic data for all checkpoints
        const trafficPromises = checkpoints.map(point =>
            fetch(`${API_BASE}/traffic/?lat=${point.lat}&lon=${point.lon}`)
                .then(res => res.json())
                .catch(err => ({ error: true }))
        );

        const trafficDataArray = await Promise.all(trafficPromises);

        // Filter out errors and extract valid traffic data
        const validData = trafficDataArray.filter(data =>
            data.status === 'success' && data.traffic && data.traffic.currentSpeed
        );

        if (validData.length === 0) {
            throw new Error('No traffic data available for this route');
        }

        // Calculate aggregated metrics
        const totalCongestion = validData.reduce((sum, data) => {
            return sum + data.traffic.congestionScore;
        }, 0);
        const avgCongestion = totalCongestion / validData.length;

        const totalSpeed = validData.reduce((sum, data) => sum + data.traffic.currentSpeed, 0);
        const avgSpeed = totalSpeed / validData.length;

        const distance = calculateDistance(routePoints[0], routePoints[1]);
        const estimatedTime = (distance / avgSpeed) * 60; // minutes

        // Display results
        displayRouteResults({
            avgCongestion,
            avgSpeed,
            distance,
            estimatedTime,
            checkpoints: validData.length
        });

    } catch (error) {
        console.error('Route analysis error:', error);
        if (errorEl) {
            errorEl.textContent = error.message || 'Failed to analyze route traffic';
            errorEl.style.display = 'block';
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

function generateRouteCheckpoints(start, end, numPoints) {
    const checkpoints = [start];

    for (let i = 1; i < numPoints - 1; i++) {
        const ratio = i / (numPoints - 1);
        checkpoints.push({
            lat: start.lat + (end.lat - start.lat) * ratio,
            lon: start.lon + (end.lon - start.lon) * ratio
        });
    }

    checkpoints.push(end);
    return checkpoints;
}

function calculateDistance(point1, point2) {
    // Haversine formula to calculate distance in km
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function displayRouteResults(results) {
    const resultsEl = document.getElementById('route-results');
    if (!resultsEl) return;

    // Update congestion display
    document.getElementById('route-avg-congestion').textContent =
        Math.round(results.avgCongestion) + '%';

    const level = getTrafficCongestionLevel(results.avgCongestion);
    const levelEl = document.getElementById('route-congestion-level');
    if (levelEl) {
        levelEl.textContent = level;
        levelEl.className = '';
        levelEl.style.color = getCongestionColor(results.avgCongestion);
    }

    // Update metrics
    document.getElementById('route-distance').textContent =
        results.distance.toFixed(2) + ' km';
    document.getElementById('route-time').textContent =
        formatRouteTime(results.estimatedTime);
    document.getElementById('route-avg-speed').textContent =
        Math.round(results.avgSpeed) + ' km/h';
    document.getElementById('route-checkpoints').textContent =
        results.checkpoints;

    resultsEl.style.display = 'block';
}

function formatRouteTime(minutes) {
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }
    return Math.round(minutes) + ' min';
}

function getCongestionColor(congestion) {
    if (congestion < 25) return '#10b981'; // Green
    if (congestion < 50) return '#f59e0b'; // Orange
    if (congestion < 75) return '#f97316'; // Dark orange
    return '#ef4444'; // Red
}

// --- UI / Profile Functions ---
window.toggleProfileDropdown = function () {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const profileSection = document.querySelector('.profile-section');
    const dropdown = document.getElementById('profile-dropdown');
    if (profileSection && !profileSection.contains(e.target) && dropdown) {
        dropdown.classList.remove('active');
    }
});

window.handleLogout = function () {
    if (confirm('Disconnect Neural Link?')) {
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_token');
        window.location.href = '/login/';
    }
}

// --- Generic Toast Notification ---
window.showToast = function (message, type = 'info') {
    // Create element if not exists (or append new one)
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error_outline';

    toast.innerHTML = `
        <span class="material-icons-sharp" style="font-size: 1.5rem;">${icon}</span>
        <div>${message}</div>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// Update Profile Info on Load
document.addEventListener('DOMContentLoaded', async () => {
    const displayName = document.getElementById('user-display-name');
    const displayRole = document.getElementById('user-display-role');
    const dropdown = document.getElementById('profile-dropdown');

    // Initial localstorage fail-safe
    const cachedRole = localStorage.getItem('user_role');
    if (displayName && cachedRole) {
        const roleMap = {
            'PLANNER': 'City Planner',
            'AGRICULTURIST': 'Agriculturist',
            'HEALTH': 'Health Official',
            'CITIZEN': 'Citizen'
        };
        displayRole.textContent = roleMap[cachedRole] || cachedRole;
    }

    // Fetch real details
    try {
        const res = await fetch('/api/auth/me/');
        if (res.ok) {
            const user = await res.json();

            // Update Top Bar (Visible Outside Below Logo)
            const outName = document.getElementById('user-display-name-out');
            const outEmail = document.getElementById('user-display-email-out');
            const outAadhar = document.getElementById('user-display-aadhar-out');

            if (outName) outName.textContent = user.username;
            if (outEmail) outEmail.textContent = user.email;
            if (outAadhar) outAadhar.textContent = user.aadhar_last4 || '**** **** ****';

            if (displayName) displayName.textContent = user.username.split(' ')[0] || user.username;

            const roleMap = {
                'PLANNER': 'City Planner',
                'AGRICULTURIST': 'Agriculturist',
                'HEALTH': 'Health Official',
                'CITIZEN': 'Citizen'
            };
            if (displayRole) displayRole.textContent = roleMap[user.role] || user.role;

            // Updated Dropdown Content
            if (dropdown) {
                // Keep logout, prepend info
                const logoutHtml = `<a href="#" onclick="handleLogout()"><span class="material-icons-sharp">logout</span> Logout</a>`;

                // Construct Profile Card HTML
                const profileHtml = `
                    <div class="dropdown-profile-header">
                        <div class="dp-name">${user.username}</div>
                        <div class="dp-email">${user.email}</div>
                    </div>
                    <div class="dropdown-profile-body">
                         <div class="dp-item">
                            <span class="dp-label">Role</span>
                            <span class="dp-value">${roleMap[user.role] || user.role}</span>
                        </div>
                        <div class="dp-item">
                            <span class="dp-label">Aadhar</span>
                            <span class="dp-value font-mono">${user.aadhar_last4 || '**** **** ****'}</span>
                        </div>
                    </div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 0.5rem 0;">
                `;

                dropdown.innerHTML = profileHtml + logoutHtml;
            }
        }
    } catch (e) {
        console.error("Failed to load profile", e);
    }
});

// ======================================
// 6. CITIZEN MAP & WEATHER
// ======================================
let citizenViewer = null;

function initCitizenMap() {
    if (citizenViewer) return;
    citizenViewer = new Cesium.Viewer('citizenMapContainer', {
        baseLayerPicker: false,
        geocoder: false,
        timeline: false,
        animation: false,
        homeButton: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        sceneMode: Cesium.SceneMode.SCENE3D
    });

    citizenViewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 25000),
        orientation: {
            heading: 0.0,
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0
        }
    });

    citizenViewer.scene.skyAtmosphere.hueShift = -0.1;
    citizenViewer.scene.skyAtmosphere.saturationShift = -0.1;
    citizenViewer.scene.fog.enabled = true;
    citizenViewer.scene.fog.density = 0.0005;

    console.log("Citizen Map Initialized (Traffic Mode)");

    // Setup Click Handler
    setupCitizenMapClickHandler();
}

function setupCitizenMapClickHandler() {
    if (!citizenViewer) return;
    const handler = new Cesium.ScreenSpaceEventHandler(citizenViewer.scene.canvas);

    handler.setInputAction((click) => {
        const cartesian = citizenViewer.camera.pickEllipsoid(click.position, citizenViewer.scene.globe.ellipsoid);
        if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);

            console.log(`Citizen Map Click: ${lat}, ${lon}`);

            // 1. Add Route Point
            addCitizenRoutePoint(lat, lon);

            // 2. Populate Traffic Monitor Inputs
            const latInput = document.getElementById('cit-traffic-latitude');
            const lonInput = document.getElementById('cit-traffic-longitude');
            if (latInput && lonInput) {
                latInput.value = lat.toFixed(6);
                lonInput.value = lon.toFixed(6);

                // Optional: Flash highlights or small feedback?
                // For now, just value update is sufficient
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

async function fetchCitizenWeather() {
    try {
        const res = await fetch(`${API_BASE}/weather/`);
        const data = await res.json();

        // DOM Updates (Citizen Tab)
        if (document.getElementById('w-temp')) document.getElementById('w-temp').innerText = data.temp + "°C";
        if (document.getElementById('w-humidity')) document.getElementById('w-humidity').innerText = data.humidity + "%";
        if (document.getElementById('w-pressure')) document.getElementById('w-pressure').innerText = data.pressure + " hPa";
        if (document.getElementById('w-wind')) document.getElementById('w-wind').innerText = data.windSpeed + " km/h";
        if (document.getElementById('w-dir')) document.getElementById('w-dir').innerText = "Direction: " + data.windDir;
        if (document.getElementById('w-vis')) document.getElementById('w-vis').innerText = data.vis + " km";
        if (document.getElementById('w-precip')) document.getElementById('w-precip').innerText = data.precipitation;

        // Update Header Weather
        const headerWeather = document.getElementById('header-weather-text');
        if (headerWeather) {
            headerWeather.innerHTML = `New Delhi | <strong>${data.temp}°C</strong>`;
        }

        return data; // Return for reuse
    } catch (e) {
        console.error("Weather Fetch Error", e);
        return null;
    }
}

function getAQIClass(aqi) {
    if (!aqi) return 'bg-secondary';
    if (aqi < 50) return 'bg-success';
    if (aqi < 100) return 'bg-success';
    if (aqi < 200) return 'bg-warning';
    if (aqi < 300) return 'bg-warning';
    if (aqi < 400) return 'bg-danger';
    return 'bg-danger';
}

// ======================================

async function loadUrbanData() {
    console.log("Loading Urban Data Phase 1...");

    // 1. AQI (Reuse shared function for consistency)
    // This ensures sorting, coloring, and data source is identical to Health/Citizen tabs
    loadAQIHotspots('dash-aqi-list');

    // 2. Market (Fetch from Agri-Validator Service Port 8001)
    // Matches 'Agri-Logistics' tab logic
    const ucMarketList = document.getElementById('dash-market-table');
    if (ucMarketList) {
        try {
            const res = await fetch('http://127.0.0.1:8001/api/agri/market-metrics/');
            if (res.ok) {
                const data = await res.json();
                const commodities = data.commodities || [];

                // Display top 5 crops
                ucMarketList.innerHTML = commodities.slice(0, 5).map(c => `
                     <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:8px;">${c.commodity}</td>
                        <td style="text-align:right; padding:8px; font-weight:600;">₹${c.modal_price}</td>
                        <td style="padding:8px; text-align:center;">
                             <span style="color:${c.trend === 'up' ? 'green' : 'gray'}">${c.trend === 'up' ? '📈' : '➡️'}</span>
                        </td>
                    </tr>
                `).join('');
            } else {
                throw new Error("Agri API Error");
            }
        } catch (e) {
            console.error("Market Load Failed", e);
            // Fallback to internal API if 8001 fails (optional, or just show error)
            ucMarketList.innerHTML = '<tr><td colspan="3" style="padding:10px; text-align:center; color:red;">Agri Service Unavailable</td></tr>';
        }
    }

    // 3. Health (Use dash-beds-icu / dash-beds-gen)
    // Matches Health Tab aggregation logic
    try {
        const hosp = await fetch(`${API_BASE}/health/`).then(r => r.json());

        // Aggregate Data
        let freeICU = 0;
        let freeGen = 0;

        if (Array.isArray(hosp)) {
            hosp.forEach(h => {
                freeICU += (h.total_beds_icu - h.occupied_beds_icu);
                freeGen += (h.total_beds_general - h.occupied_beds_general);
            });

            const icuEl = document.getElementById('dash-beds-icu');
            const genEl = document.getElementById('dash-beds-gen');

            if (icuEl) icuEl.innerText = freeICU;
            if (genEl) genEl.innerText = freeGen;
        }
    } catch (e) { console.error("Health Load Failed", e); }

    // 4. Weather (Update Dashboard Widget from Citizen API)
    fetchCitizenWeather().then(data => {
        if (data) {
            if (document.getElementById('dash-weather-temp')) document.getElementById('dash-weather-temp').innerText = data.temp + "°C";
            if (document.getElementById('dash-weather-hum')) document.getElementById('dash-weather-hum').innerText = data.humidity + "%";
            if (document.getElementById('dash-weather-wind')) document.getElementById('dash-weather-wind').innerText = data.windSpeed + " km/h";
        }
    });
}

function closeUrbanControl() {
    if (viewer) viewer.selectedEntity = undefined;
    document.getElementById('urban-control-center').style.display = 'none';
    document.getElementById('urban-hint').style.display = 'block';
    document.getElementById('resilience-panel').style.display = 'none';
}

function runUrbanSimulation(type) {
    const resEl = document.getElementById(`res-${type}`);
    if (!resEl) return;

    resEl.style.display = 'block';
    resEl.innerHTML = '<span style="color:#666;">Calculating impact...</span>';

    setTimeout(() => {
        let html = '';
        if (type === 'weather') {
            const val = document.getElementById('sim-weather-type').value;
            if (val === 'clear') {
                html = '<strong style="color:green">No Adverse Impact.</strong><br>Traffic Flow: Optimal<br>Logistics Delay: 0 min';
            } else if (val === 'rain') {
                html = '<strong>⚠️ Heavy Rain Impact:</strong><br>• Traffic Congestion: High (+45%)<br>• Logistics Delay: +25 mins<br>• Spoilage Risk: Moderate';
            } else if (val === 'heat') {
                html = '<strong>🔥 Heatwave Warning:</strong><br>• Power Grid Load: +15%<br>• Health Emergencies: +12%<br>• Crop Stress: High';
            } else {
                html = '<strong>🌪️ Storm Alert:</strong><br>• Visibility: <50m<br>• Transport Halted<br>• AQI Spike Expected';
            }
        } else if (type === 'aqi') {
            const val = parseInt(document.getElementById('sim-aqi-slider').value);
            if (val < 100) html = '<strong style="color:green">Air Quality Acceptable.</strong><br>No major health advisories.';
            else if (val < 300) html = '<strong style="color:orange">Poor Air Quality:</strong><br>• Respiratory Cases: +5%<br>• Outdoor Activity: Limited';
            else html = '<strong style="color:red">SEVERE HAZARD:</strong><br>• Asthma Attacks: +25%<br>• Emergency Ward Load: Critical<br>• School Closure Recommended';
        } else if (type === 'market') {
            const val = document.getElementById('sim-market-event').value;
            if (val === 'normal') html = '<strong style="color:green">Market Stable.</strong><br>Prices: Normal<br>Supply: Adequate';
            else if (val === 'blockade') html = '<strong style="color:red">CRITICAL SHORTAGE:</strong><br>• Tomato Price: +200%<br>• Milk Supply: -60%<br>• Panic Buying Likely';
            else html = '<strong>⚠️ Spoilage Event:</strong><br>• Economic Loss: ₹50 Lakhs<br>• Waste Management Load: High';
        } else if (type === 'health') {
            const val = document.getElementById('sim-health-event').value;
            if (val === 'normal') html = '<strong style="color:green">Systems Normal.</strong><br>Bed Availability: >20%';
            else if (val === 'surge') html = '<strong>⚠️ Epidemic Surge:</strong><br>• ICU Occupancy: 95%<br>• Oxygen Demand: +40%<br>• Staff Fatigue: High';
            else html = '<strong>🚑 Mass Casualty:</strong><br>• Trauma Center: Full<br>• Ambulance Delay: +15 mins<br>• Mutual Aid Required';
        }

        resEl.innerHTML = html;
    }, 1500);
}

// ======================================
// CITIZEN TRAFFIC MONITORING
// ======================================
function initCitizenTrafficMonitoring() {
    console.log("Initializing Citizen Traffic Monitoring...");
    const fetchBtn = document.getElementById('cit-fetchTrafficBtn');
    if (fetchBtn) {
        console.log("Fetch Traffic Button found, attaching listener.");
        fetchBtn.addEventListener('click', fetchCitizenTrafficData);
    } else {
        console.error("Fetch Traffic Button NOT found!");
    }
}

async function fetchCitizenTrafficData() {
    console.log("Fetching Citizen Traffic Data...");
    const lat = document.getElementById('cit-traffic-latitude').value.trim();
    const lon = document.getElementById('cit-traffic-longitude').value.trim();
    const resDiv = document.getElementById('cit-traffic-results');
    const statusDiv = document.getElementById('cit-traffic-status');
    const detailsDiv = document.getElementById('cit-traffic-details');

    if (!lat || !lon) { alert("Please enter coordinates."); return; }

    statusDiv.innerText = "Loading...";
    resDiv.style.display = 'block';

    try {
        const response = await fetch(`/api/traffic/?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        console.log("Traffic Data Response:", data);

        if (data.status === 'success') {
            const cong = data.traffic.congestionScore;
            statusDiv.innerText = cong + "% Congestion";
            if (typeof getCongestionColor === 'function') {
                statusDiv.style.color = getCongestionColor(cong);
            }

            detailsDiv.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.5rem; font-size:0.9rem; text-align:left; color:var(--text-main);">
                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;">Speed: <b style="color:var(--primary-color);">${data.traffic.currentSpeed} km/h</b></div>
                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;">Travel Time: <b style="color:var(--primary-color);">${Math.round(data.traffic.currentTravelTime / 60)} min</b></div>
                </div>
            `;
        } else {
            statusDiv.innerText = "Error: " + (data.message || "Unknown");
            statusDiv.style.color = '#ef4444';
        }
    } catch (e) {
        console.error("Fetch Traffic Error:", e);
        statusDiv.innerText = "System Error";
    }
}

// ======================================
// CITIZEN ROUTE ANALYSIS
// ======================================
let citRoutePoints = [];
let citRouteMarkers = [];
let citRouteLine = null;

function initCitizenRouteAnalysis() {
    console.log("Initializing Citizen Route Analysis...");
    const analyzeBtn = document.getElementById('cit-analyze-route-btn');
    const clearBtn = document.getElementById('cit-clear-route-btn');

    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeCitizenRouteTraffic);
    if (clearBtn) clearBtn.addEventListener('click', clearCitizenRoutePoints);

    // Note: Click handler is now managed centrally by setupCitizenMapClickHandler()
}

function addCitizenRoutePoint(lat, lon) {
    if (citRoutePoints.length >= 2) clearCitizenRoutePoints();

    citRoutePoints.push({ lat, lon });

    const label = citRoutePoints.length === 1 ? 'A' : 'B';
    const color = citRoutePoints.length === 1 ? '#10b981' : '#ef4444';

    const marker = citizenViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
            image: createMarkerCanvas(label, color),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
    citRouteMarkers.push(marker);

    // Update UI
    if (citRoutePoints.length >= 1) document.getElementById('cit-point-a-coords').innerText = `${citRoutePoints[0].lat.toFixed(4)}, ${citRoutePoints[0].lon.toFixed(4)}`;
    if (citRoutePoints.length >= 2) document.getElementById('cit-point-b-coords').innerText = `${citRoutePoints[1].lat.toFixed(4)}, ${citRoutePoints[1].lon.toFixed(4)}`;

    if (citRoutePoints.length === 2) {
        // Draw Line
        citRouteLine = citizenViewer.entities.add({
            polyline: {
                positions: [
                    Cesium.Cartesian3.fromDegrees(citRoutePoints[0].lon, citRoutePoints[0].lat),
                    Cesium.Cartesian3.fromDegrees(citRoutePoints[1].lon, citRoutePoints[1].lat)
                ],
                width: 4,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#3b82f6'),
                    dashLength: 16
                }),
                clampToGround: true
            }
        });
        document.getElementById('cit-analyze-route-btn').disabled = false;
        document.getElementById('cit-route-instructions').innerHTML = '<strong>✅ Ready</strong><br>Click analyze.';
    }
}

function clearCitizenRoutePoints() {
    citRoutePoints = [];
    citRouteMarkers.forEach(m => citizenViewer.entities.remove(m));
    citRouteMarkers = [];
    if (citRouteLine) {
        citizenViewer.entities.remove(citRouteLine);
        citRouteLine = null;
    }
    document.getElementById('cit-point-a-coords').innerText = '--';
    document.getElementById('cit-point-b-coords').innerText = '--';
    document.getElementById('cit-route-instructions').innerHTML = 'Select points on map';
    document.getElementById('cit-analyze-route-btn').disabled = true;
    document.getElementById('cit-route-results').style.display = 'none';
}

async function analyzeCitizenRouteTraffic() {
    if (citRoutePoints.length !== 2) return;

    // Reuse the existing analyze logic but update Citizen UI
    const loadingEl = document.getElementById('cit-route-loading');
    const resultsEl = document.getElementById('cit-route-results');

    loadingEl.style.display = 'block';
    resultsEl.style.display = 'none';

    try {
        const checkpoints = generateRouteCheckpoints(citRoutePoints[0], citRoutePoints[1], 5);
        const trafficPromises = checkpoints.map(point =>
            fetch(`${API_BASE}/traffic/?lat=${point.lat}&lon=${point.lon}`)
                .then(res => res.json())
                .catch(err => ({ error: true }))
        );
        const trafficDataArray = await Promise.all(trafficPromises);
        const validData = trafficDataArray.filter(data =>
            data.status === 'success' && data.traffic && data.traffic.currentSpeed
        );

        if (validData.length === 0) throw new Error('No traffic data');

        const totalCongestion = validData.reduce((sum, data) => sum + data.traffic.congestionScore, 0);
        const avgCongestion = totalCongestion / validData.length;
        const totalSpeed = validData.reduce((sum, data) => sum + data.traffic.currentSpeed, 0);
        const avgSpeed = totalSpeed / validData.length;
        const distance = calculateDistance(citRoutePoints[0], citRoutePoints[1]);
        const estimatedTime = (distance / avgSpeed) * 60;

        // Display results
        document.getElementById('cit-route-avg-congestion').innerText = Math.round(avgCongestion) + '%';
        document.getElementById('cit-route-distance').innerText = distance.toFixed(2) + ' km';
        document.getElementById('cit-route-time').innerText = formatRouteTime(estimatedTime);

        resultsEl.style.display = 'block';

    } catch (e) {
        alert("Route analysis failed.");
    } finally {
        loadingEl.style.display = 'none';
    }
}



// Helper: Get Congestion Level Object
function getTrafficCongestionLevel(score) {
    if (score < 25) return { label: 'Low', class: 'level-low' };
    if (score < 50) return { label: 'Moderate', class: 'level-moderate' };
    if (score < 75) return { label: 'High', class: 'level-high' };
    return { label: 'Severe', class: 'level-severe' };
}

function showTrafficUpdateNotification() {
    if (window.showToast) window.showToast("Traffic data updated", "info");
}

function switchUrbanTab(tabId, btn) {
    // Hide all tab content
    document.querySelectorAll('.uc-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    // Remove active class from all buttons
    document.querySelectorAll('.uc-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const selectedContent = document.getElementById(tabId);
    if (selectedContent) {
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
    }

    // Set active button
    if (btn) {
        btn.classList.add('active');
    }
}
