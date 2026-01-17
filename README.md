# Fresh Corridor Initiative

The Fresh Corridor Initiative is a data-driven urban systems platform designed to optimize city logistics, reduce food waste, and improve public health outcomes. This repository contains the source code for the unified digital platform, comprising a Django backend, a Flutter mobile application, and a web dashboard.

## System Architecture

The project is divided into three main components:

1.  **Backend**: A Python Django Application handling APIs, database interactions, and simulation logic.
2.  **Mobile Application**: A Flutter-based cross-platform app for Farmers, Citizens, Health Officials, and Planners.
3.  **Web Dashboard**: A web interface for visualization and monitoring.

## Prerequisites

Ensure the following tools are installed on your system:

- Python 3.8 or higher
- Flutter SDK (Latest Stable)
- Dart SDK
- Git

## Backend Setup (Django)

The backend powers the API and data management for the platform.

1.  Navigate to the backend directory:

    ```bash
    cd fresh_corridor_backend
    ```

2.  Create and activate a virtual environment (Optional but Recommended):

    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # macOS/Linux
    source venv/bin/activate
    ```

3.  Install dependencies:

    ```bash
    pip install django djangorestframework django-cors-headers requests python-dotenv
    ```

4.  Configure environment variables:

    ```bash
    # Copy the template file
    cp .env.template .env
    # Edit .env and add your TomTom API key (for traffic monitoring)
    # Get a free key at: https://developer.tomtom.com/
    ```

5.  Initialize the database:
    Run the following commands to create the database schema and apply migrations.

    ```bash
    python manage.py makemigrations core
    python manage.py migrate
    ```

6.  (Optional) Load real hospital data:

    ```bash
    python fetch_real_hospitals.py
    ```

7.  Run the development server:
    ```bash
    python manage.py runserver
    ```
    The API will be available at `http://127.0.0.1:8000/`.

## Features

### Urban Digital Twin with Traffic Monitoring

The platform includes an interactive 3D urban digital twin powered by Cesium, with integrated real-time traffic congestion monitoring:

- **3D City Visualization** - Interactive map of New Delhi with zone markers
- **Real-time Traffic Monitoring** - Live traffic speed and congestion analysis powered by TomTom API
- **Travel Time Calculations** - Compare current vs free-flow travel times
- **Road Closure Detection** - Instant alerts for blocked roads
- **Auto-Refresh Monitoring** - Automatic updates when traffic conditions change
- **Congestion Scoring** - Visual indicators for Low, Moderate, High, and Severe congestion
- **Historical Data Storage** - All traffic data saved for analysis

Access the integrated dashboard at: `http://127.0.0.1:8000/`  
Traffic monitoring is located in the **Urban Nexus** tab below the digital twin map.

## Mobile Application Setup (Flutter)

The mobile application provides a unified interface for all user personas.

1.  Navigate to the mobile app directory:

    ```bash
    cd fresh_corridor_mobile
    ```

2.  Install dependencies:

    ```bash
    flutter pub get
    ```

3.  Run the application:
    Ensure a simulator or physical device is connected.
    ```bash
    flutter run
    ```

## Web Dashboard Setup

The web dashboard is a static client interacting with the backend API.

1.  Navigate to the web directory:

    ```bash
    cd fresh_corridor_web
    ```

2.  Open the dashboard:
    Open `index.html` in any modern web browser.

## Project Structure

- `fresh_corridor_backend/`: Django project root.
  - `core/`: Main application app containing Models, Views, and Serializers.
- `fresh_corridor_mobile/`: Flutter project root.
  - `lib/main.dart`: Application entry point and view logic.
- `fresh_corridor_web/`: Web dashboard resources.
  - `index.html`: Main dashboard entry point.
