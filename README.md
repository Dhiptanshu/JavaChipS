# Fresh Corridor Nexus - GeoAnushasan

**A Next-Gen Smart City Digital Twin for Urban Resilience & Logistics.**

Fresh Corridor Nexus integrates real-time environmental data, hospital capacity tracking, and agri-supply chain logistics into a single, interactive 3D dashboard. It empowers urban planners with "What-If" simulations and provides citizens with transparent safety metrics.

---

## Latest Updates (Jan 2026)
*   **Unified Cyber Theme**: Deep glassmorphism and neon accents across all tabs (Urban Nexus, Health, Agri, Citizen).
*   **Urban Control Center (UCC)**: High-visibility simulation panel with dark-mode overlays and real-time impact analysis.
*   **Aadhar Masking**: Enhanced data privacy with standardized `**** **** 1234` formatting and direct backend integration.
*   **Performance Optimization**: Optimized CesiumJS memory usage and refined responsive layout for the profile header.

---

## Features

*   **Urban Digital Twin**: High-fidelity 3D map (CesiumJS) with interactive City Zones and Urban Control Center overlay.
*   **What-If Simulations**: Test disaster scenarios (Floods, Heatwaves, Storms) and predict impacts on city infrastructure.
*   **Real-Time Traffic**: Live congestion tracking with "FlyTo" navigation and route traffic analysis.
*   **Health Monitor**: Live tracking of ICU bed availability, pandemic surge simulations, and AQI hotspots.
*   **Agri-Logistics**: Farm-to-City supply chain visibility with Blockchain-backed validation (mints on Sepolia).

---

## Tech Stack

*   **Backend**: Django 5.0, Django REST Framework (DRF)
*   **Frontend**: HTML5, Vanilla JavaScript, CSS3
*   **Blockchain**: Web3.py (Ethereum Interaction)
*   **Geospatial**: CesiumJS (1.113), Cesiumpy
*   **Data Sources**: Central Pollution Control Board (CPCB), TomTom API

---

## Database Migrations Reference

The system utilizes a complex schema across multiple modules. Below are the key migration tracks:

### Core Backend (`core` app)
| Seq | Migration Name | Key Change |
|-----|----------------|------------|
| 0001 | `initial` | Base models for Zones, Weather, and Hospitals |
| 0002 | `cityzone_average_income...` | Socio-economic metric tracking |
| 0003 | `cityzone_area_type` | Zone classification for simulations |
| 0004 | `hospital_is_live_data...` | Real-time hospital metrics toggle |
| 0006 | `realtimetraffic` | Integration for TomTom live feeds |
| 0007 | `userprofile` | Extended User model for Roles |
| 0008 | `userprofile_aadhar...` | Aadhar number integration with masking logic |
| 0009 | `citizenreport...` | Citizen Connect reporting system with Lat/Long |

### Agri Validator (`agri_supply` app)
| Seq | Migration Name | Key Change |
|-----|----------------|------------|
| 0001 | `initial` | Models for Verifiable Farm Shipments |

---

## Quick Start Guide

### 1. Setup Project
```bash
git clone <repository_url>
cd fresh_corridor_backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Configure Environment Variables (.env)
```ini
TOMTOM_API_KEY=your_tomtom_api_key
ETH_PRIVATE_KEY=your_wallet_key
INFURA_PROJECT_ID=your_infura_id
DEBUG=True
```

### 3. Run Servers
**Main Engine (Port 8000):**
```bash
python manage.py runserver
```

**Agri-Validator (Port 8001):**
```bash
cd agri
python manage.py runserver 8001
```

---

## Background Services
To keep the dashboard "alive" with simulated data:
```bash
python manage.py simulate_health
```
