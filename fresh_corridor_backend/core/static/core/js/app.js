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
                document.getElementById('sim-panel').style.display = 'block';
                document.getElementById('resilience-panel').style.display = 'flex';
                // Fetch standard metrics
                fetchResilienceMetrics(selectedZoneId);
            } else {
                selectedZoneId = null;
                document.getElementById('sim-panel').style.display = 'none';
                document.getElementById('resilience-panel').style.display = 'none';
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

function switchTab(tabId, el) { // Update signature to match index.html call
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Handle specific active class for nav-tab
    // (Assuming this function is called with 'this' from onclick)
    if (el) el.classList.add('active');
    else {
        // Fallback if 'el' not passed, try to find by text or index (simplified: just select based on ID mapping)
        const map = { 'urban': 0, 'health': 1, 'agri': 2, 'citizen': 3 };
        document.querySelectorAll('.nav-tab')[map[tabId]].classList.add('active');
    }

    // Stop polling if leaving health tab
    if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
    }

    if (tabId === 'urban') setTimeout(initCesium, 100);

    if (tabId === 'health') {
        loadHealthData();
        // Poll every 3 seconds for live updates
        healthInterval = setInterval(loadHealthData, 3000);
    }

    if (tabId === 'agri') loadAgriData();
    if (tabId === 'citizen') loadCitizenData();
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
            hHtml += `<tr>
                <td><strong>${h.name}</strong><div style="font-size:0.75em;color:#666;">${h.zone_name}</div></td>
                <td><span style="font-size:0.85em;">${h.zone_name}</span></td>
                <td><div style="width:80px; background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden;">
                        <div style="width:${(h.occupied_beds_icu / h.total_beds_icu) * 100}%; background:${h.occupied_beds_icu / h.total_beds_icu > 0.8 ? '#ef4444' : '#22c55e'}; height:100%;"></div>
                    </div><small>${h.occupied_beds_icu}/${h.total_beds_icu}</small></td>
                <td><span class="badge ${h.occupied_beds_icu / h.total_beds_icu > 0.8 ? 'bg-danger' : 'bg-success'}">${h.occupied_beds_icu / h.total_beds_icu > 0.8 ? 'CRITICAL' : 'STABLE'}</span></td>
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
                <div style="padding:0.8rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;" ${clickAttr}>
                    <div>
                        <div style="font-weight:600; color:#334155;">${name}</div>
                        <span class="badge" style="background:#e2e8f0; color:#475569; font-weight:500;">${e.city || e.area_type || 'Station'}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.1rem; font-weight:700; color:${getColorForAQI(aqi)}">${aqi} AQI</div>
                        <div style="font-size:0.8rem; color:#64748b;">${e.live_ts ? new Date(e.live_ts).toLocaleTimeString() : 'Simulated'}</div>
                    </div>
                </div>`;
            }).join('');
        }

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

    // Load AQI Hotspots
    loadAQIHotspots();
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
async function loadAQIHotspots() {
    try {
        const res = await fetch(`${API_BASE}/get_stations`);
        const stations = await res.json();

        // Filter stations that have AQI/Pollutant data
        const withData = stations.filter(s => s.aqi || s.co2_estimated);

        // Sort by AQI descending
        withData.sort((a, b) => {
            let vA = parseFloat(a.aqi) || 0;
            let vB = parseFloat(b.aqi) || 0;
            return vB - vA;
        });

        const top5 = withData.slice(0, 5);

        const listElem = document.getElementById('aqi-hotspots-list');
        if (top5.length === 0) {
            listElem.innerHTML = '<div style="padding:1rem;color:#666;">No real-time AQI data available.</div>';
            return;
        }

        listElem.innerHTML = top5.map(s => {
            let val = parseFloat(s.aqi) || 0;
            let cls = 'aqi-good';
            if (val > 50) cls = 'aqi-satisfactory';
            if (val > 100) cls = 'aqi-moderate';
            if (val > 200) cls = 'aqi-poor';
            if (val > 300) cls = 'aqi-very-poor';
            if (val > 400) cls = 'aqi-severe';

            return `
            <div class="hotspot-item" onclick="openStationModal('${s.name}')">
                <div>
                    <div style="font-weight:600;">${s.city}</div>
                    <div style="font-size:0.8rem; color:#666;">${s.name}</div>
                </div>
                <div class="badge ${cls}" style="font-size:0.9rem;">AQI ${val}</div>
            </div>
            `;
        }).join('');

        // Store for modal lookup
        window.allStations = stations;

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
function initTrafficMonitoring() {
    const fetchBtn = document.getElementById('fetchTrafficBtn');
    const autoRefreshBtn = document.getElementById('autoRefreshTrafficBtn');
    const latInput = document.getElementById('traffic-latitude');
    const lonInput = document.getElementById('traffic-longitude');

    if (fetchBtn) {
        fetchBtn.addEventListener('click', () => fetchTrafficData(true));
    }

    if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', toggleTrafficAutoRefresh);
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

async function fetchTrafficData(showLoading = false) {
    const lat = document.getElementById('traffic-latitude').value.trim();
    const lon = document.getElementById('traffic-longitude').value.trim();

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
    initTrafficMonitoring();
    initRouteTrafficAnalysis();
});

// ============================================
// ROUTE TRAFFIC ANALYSIS - Interactive Map Selection
// ============================================

let routePoints = []; // Array to store 2 selected points
let routeMarkers = []; // Array to store marker entities
let routeLine = null; // Line entity connecting points

function initRouteTrafficAnalysis() {
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
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click) => {
        // Convert click position to cartesian
        const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);

        if (cartesian) {
            // Convert to lat/lon
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);

            addRoutePoint(lat, lon);
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
