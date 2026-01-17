import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fresh_corridor_backend.settings')
django.setup()

from core.models import CityZone, WeatherLog, Hospital, TrafficStats, HealthStats

def seed():
    print("Seeding data...")
    
    # 1. Create Zones
    zones_data = [
        {"name": "Zone A (Downtown)", "lat": 28.6139, "long": 77.2090, "income": "High"},
        {"name": "Zone B (Industrial)", "lat": 28.6200, "long": 77.2100, "income": "Low"},
        {"name": "Zone C (Residential)", "lat": 28.6300, "long": 77.2200, "income": "Medium"},
    ]
    
    zones = []
    for z in zones_data:
        zone, created = CityZone.objects.get_or_create(
            name=z['name'],
            defaults={
                "latitude": z['lat'],
                "longitude": z['long'],
                "average_income_tier": z['income']
            }
        )
        zones.append(zone)
        print(f"Zone: {zone.name}")

    # 2. Create Hospitals
    for zone in zones:
        Hospital.objects.get_or_create(
            name=f"{zone.name} General Hospital",
            zone=zone,
            defaults={
                "total_beds_icu": 50,
                "occupied_beds_icu": random.randint(10, 45),
                "total_beds_general": 200,
                "occupied_beds_general": random.randint(50, 180),
                "oxygen_supply_level": random.randint(60, 100)
            }
        )

    # 3. Create Logs (Weather, Traffic, Health)
    for zone in zones:
        # Weather (Simulate smog in Industrial zone)
        is_industrial = "Industrial" in zone.name
        WeatherLog.objects.create(
            zone=zone,
            temperature_c=random.uniform(25, 35),
            precipitation_mm=random.uniform(0, 10) if not is_industrial else 0,
            wind_speed_kmh=random.uniform(5, 15),
            visibility_km=random.uniform(2, 10) if not is_industrial else 1.5,
            air_quality_index=random.randint(200, 400) if is_industrial else random.randint(50, 150)
        )
        
        # Health Stats (More cases in polluted areas)
        HealthStats.objects.create(
            zone=zone,
            respiratory_cases_active=random.randint(50, 100) if is_industrial else random.randint(5, 20)
        )

        # 4. Agri Supply (Random Logs)
        if random.choice([True, False]):
            from core.models import AgriSupply
            AgriSupply.objects.create(
                crop_type=random.choice(['Tomatoes', 'Wheat', 'Rice', 'Spinach']),
                quantity_kg=random.randint(100, 5000),
                harvest_date=django.utils.timezone.now().date(),
                farmer_name=f"Farmer {random.randint(1, 100)}",
                origin_zone=zone,
                spoilage_risk_score=random.uniform(10, 80)
            )

        # 5. Citizen Reports
        if random.choice([True, False]):
            from core.models import CitizenReport
            CitizenReport.objects.create(
                report_type=random.choice(['WASTE', 'TRAFFIC', 'OTHER']),
                description=f"Issue reported in {zone.name}",
                zone=zone
            )
            
    print("Seeding complete!")

if __name__ == '__main__':
    seed()
