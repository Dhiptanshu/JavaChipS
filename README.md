# Fresh Corridor Nexus - GeoAnushasan

**A Next-Gen Smart City Digital Twin for Urban Resilience & Logistics.**

Fresh Corridor Nexus integrates real-time environmental data, hospital capacity tracking, and agri-supply chain logistics into a single, interactive 3D dashboard. It empowers urban planners with "What-If" simulations and provides citizens with transparent safety metrics.

---

## Features

*   **Urban Digital Twin**: High-fidelity 3D map (CesiumJS) with interactive City Zones.
*   **What-If Simulations**: Test disaster scenarios (Floods, Traffic Spikes) and predict impacts on city infrastructure.
*   **Real-Time Traffic**: Live congestion tracking with "FlyTo" navigation and notifications.
*   **Health Monitor**: Live tracking of ICU bed availability and Air Quality (AQI) hotspots.
*   **Agri-Logistics**: Farm-to-City supply chain visibility with AI-driven spoilage risk assessment.

---

## Tech Stack

*   **Backend**: Django 5.0, Django REST Framework (DRF)
*   **Frontend**: HTML5, Vanilla JavaScript, CSS3
*   **Geospatial**: CesiumJS (1.113)
*   **Data Sources**: Central Pollution Control Board (CPCB), TomTom Traffic API

---

## Quick Start Guide

Follow these steps to get the system running locally.

### 1. Prerequisites
*   Python 3.10+ installed.
*   Git installed.

### 2. Setup Project
```bash
# Clone the repository
git clone <repository_url>
cd fresh_corridor_backend

# Create a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the `fresh_corridor_backend` directory (example below):
```ini
TOMTOM_API_KEY=your_tomtom_api_key
DEBUG=True
SECRET_KEY=your_django_secret_key
```

### 5. Initialize Database
```bash
# Apply migrations
python manage.py migrate

# Seed data (Required for demo visuals)
python seed_data.py
```

### 6. Run Server
```bash
# Start the Django server
python manage.py runserver
```
The dashboard is now live at: **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---


## Error Handling

*   **Map Rendering**: If the map is black, ensure you have an active internet connection as CesiumJS streams global data.
*   **Traffic Data**: If the TomTom API returns an error or rate-limit, the system automatically falls back to **Simulation Mode** to ensure the UI remains interactive.
*   **Database**: If zones do not appear, ensure `seed_data.py` was executed successfully.

---

## Security Declaration

This repository contains **no hardcoded secrets**. All sensitive configurations (API keys, Secret keys) are managed via a `.env` file which is explicitly ignored by the `.gitignore` policy.

---

## Background Worker

To simulate real-time updates for health and environmental metrics during a demo:
```bash
python manage.py simulate_health
```
