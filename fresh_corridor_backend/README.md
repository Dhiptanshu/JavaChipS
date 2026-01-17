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

## Quick Start Guide

Follow these steps to get the system running locally.

### 1. Prerequisites
*   **Python 3.10+** installed.
*   **Git** installed.

### 2. Setup Project
```bash
# Clone the repository
git clone <repository_url>
cd fresh_corridor_backend

# Create a virtual environment (Optional but Recommended)
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

### 4. Configure Environment
Create a `.env` file in the `fresh_corridor_backend` directory:
```ini
TOMTOM_API_KEY=your_tomtom_api_key
DEBUG=True
SECRET_KEY=your_secret_key
```

### 5. Initialize Database
```bash
# Apply database migrations
python manage.py migrate

# Seed initial demo data (Zones, Hospitals, Logs)
python manage.py seed_data
```
*Note: The `seed_data` command populates the database so you're not starting with a blank slate.*

### 6. Run Server
```bash
python manage.py runserver
```
The dashboard is now live at: **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## System Architecture

### Backend
*   **Django 5.0**: Robust web framework.
*   **Django REST Framework**: JSON APIs for all modules.
*   **Services**:
    *   `AQIService`: Fetches live pollution data from CPCB.
    *   `SimulationService`: Handles logic for resilience metrics and disaster modeling.

### Frontend
*   **HTML/CSS/JS**: Lightweight, no-build setup.
*   **CesiumJS**: 3D geospatial visualization.
*   **Chart.js**: Statistical graphs.

---

## Troubleshooting

**Q: The Map is black or not loading?**
*   **A:** Check your internet connection. CesiumJS requires online access to stream 3D terrain and imagery.

**Q: How do I simulate real-time updates?**
*   **A:** Run the health simulation worker in a separate terminal:
    ```bash
    python manage.py simulate_health
    ```
