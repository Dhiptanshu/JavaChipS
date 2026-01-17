from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import CityZone, WeatherLog, Hospital, TrafficStats, AgriSupply, CitizenReport, HealthStats
from .serializers import (
    CityZoneSerializer, WeatherLogSerializer, HospitalSerializer, 
    TrafficStatsSerializer, AgriSupplySerializer, CitizenReportSerializer, HealthStatsSerializer
)

# --- Dashboard View ---
def dashboard(request):
    return render(request, 'core/index.html')

# --- Tab 1: Planner View ---
class PlannerViewSet(viewsets.ModelViewSet):
    queryset = CityZone.objects.all()
    serializer_class = CityZoneSerializer

    @action(detail=True, methods=['get'])
    def full_status(self, request, pk=None):
        """Returns consolidated status for a zone (Weather, Traffic, Hospitals)"""
        zone = self.get_object()
        weather = WeatherLog.objects.filter(zone=zone).last()
        traffic = TrafficStats.objects.filter(zone=zone).last()
        hospitals = Hospital.objects.filter(zone=zone)
        
        return Response({
            'zone': CityZoneSerializer(zone).data,
            'weather': WeatherLogSerializer(weather).data if weather else None,
            'traffic': TrafficStatsSerializer(traffic).data if traffic else None,
            'hospitals': HospitalSerializer(hospitals, many=True).data
        })

# --- Tab 2: Health View ---
class HealthViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer

    def list(self, request, *args, **kwargs):
        """Standard list, but with optional location filtering"""
        lat = request.query_params.get('lat')
        long = request.query_params.get('long')
        radius = float(request.query_params.get('radius', 50)) # Default 50km

        hospitals = list(self.get_queryset())

        if lat and long:
            from .utils import haversine
            u_lat, u_long = float(lat), float(long)
            
            # Annotate with distance
            for h in hospitals:
                h.distance_km = haversine(u_lat, u_long, h.zone.latitude, h.zone.longitude)
            
            # Filter and Sort
            hospitals = [h for h in hospitals if h.distance_km <= radius]
            hospitals.sort(key=lambda x: x.distance_km)
            
            # Serialize (we need to pass many=True manually since we converted to list)
            serializer = self.get_serializer(hospitals, many=True)
            # Add distance to response if needed, but serializer fields are fixed. 
            # ideally we'd add a custom field, but for now just returning sorted list is good.
            return Response(serializer.data)

        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def epidemiology(self, request):
        """Feature A: Epidemiological Heatmap (Resp Cases vs Pollution)"""
        data = []
        zones = CityZone.objects.all()
        
        lat = request.query_params.get('lat')
        long = request.query_params.get('long')
        
        for zone in zones:
            health_stats = HealthStats.objects.filter(zone=zone).last()
            weather = WeatherLog.objects.filter(zone=zone).last()
            
            dist = 0
            if lat and long:
                 from .utils import haversine
                 dist = haversine(float(lat), float(long), zone.latitude, zone.longitude)

            if health_stats and weather:
                data.append({
                    'zone_name': zone.name,
                    'latitude': zone.latitude,
                    'longitude': zone.longitude,
                    'resp_cases': health_stats.respiratory_cases_active,
                    'aqi': weather.air_quality_index,
                    'temperature': weather.temperature_c,
                    'distance_km': round(dist, 2)
                })
        
        # Sort by distance if location provided
        if lat and long:
            data.sort(key=lambda x: x['distance_km'])
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def health_deserts(self, request):
        """Feature B: Health Desert Identifier (Low Income + Poor AQI + No Fresh Food)"""
        deserts = []
        zones = CityZone.objects.filter(average_income_tier='Low')
        
        for zone in zones:
            weather = WeatherLog.objects.filter(zone=zone).last()
            # Simple check: If no supply in last X days (mocked as count=0 for MVP)
            has_supply = AgriSupply.objects.filter(origin_zone=zone).exists() # Note: Origin isn't destination, but simplified for MVP or assumes local market
            
            # Logic: Low Income (Filtered) + AQI > 150 (Poor) + No Supply
            if weather and weather.air_quality_index > 100: # Threshold for 'Poor'
                 # Note: Real logic finds supply DESTINED for zone, but we lack 'destination' in AgriSupply.
                 # Assuming for MVP 'origin_zone' implies local availability or we check simple supply chain gap.
                 # Let's assume we flag if NO farmer is logging from this zone (zero production/market activity)
                 if not has_supply: 
                     deserts.append(CityZoneSerializer(zone).data)
        
        return Response(deserts)

# --- Tab 3: Farmer View ---
class FarmerViewSet(viewsets.ModelViewSet):
    queryset = AgriSupply.objects.all()
    serializer_class = AgriSupplySerializer

# --- Tab 4: Citizen View ---
class CitizenViewSet(viewsets.ModelViewSet):
    queryset = CitizenReport.objects.all()
    serializer_class = CitizenReportSerializer
