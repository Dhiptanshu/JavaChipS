from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import CityZone, WeatherLog, Hospital, TrafficStats, AgriSupply, CitizenReport, HealthStats, RealTimeTraffic
from .services.simulation_service import SimulationService
from .serializers import (
    CityZoneSerializer, WeatherLogSerializer, HospitalSerializer, 
    TrafficStatsSerializer, AgriSupplySerializer, CitizenReportSerializer, HealthStatsSerializer,
    LoginSerializer, SignupSerializer, UserSerializer
)
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Dashboard View ---
def dashboard(request):
    context = {}
    if request.user.is_authenticated:
        try:
            profile = request.user.profile
            role = profile.get_role_display()
            aadhar = profile.aadhar_number if profile.aadhar_number else ""
            masked_aadhar = f"**** **** {aadhar[-4:]}" if len(aadhar) >= 4 else "Not Linked"
        except Exception:
            role = "User"
            masked_aadhar = "**** **** ****"

        context = {
            'user_name': request.user.username,
            'user_email': request.user.email,
            'user_role': role,
            'masked_aadhar': masked_aadhar
        }
    else:
        # Default/Guest context
        context = {
            'user_name': 'Guest',
            'user_role': 'Visitor',
            'user_email': '',
            'masked_aadhar': ''
        }
    return render(request, 'core/index.html', context)

def login_index(request):
    return render(request, 'core/login/index.html')

def login_role(request, role):
    template_map = {
        'planner': 'plannerLogin.html',
        'farmer': 'farmerLogin.html',
        'health': 'healthLogin.html',
        'resident': 'residentLogin.html'
    }
    template = template_map.get(role)
    if template:
        return render(request, f'core/login/{template}')
    return render(request, 'core/login/index.html')

# --- Auth APIs ---
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username_input = serializer.validated_data['username']
        password = serializer.validated_data['password']

        # Support Email Login
        if '@' in username_input:
            try:
                user_obj = User.objects.get(email=username_input)
                username_input = user_obj.username
            except User.DoesNotExist:
                pass # Will fail in authenticate

        user = authenticate(username=username_input, password=password)
        if user:
            login(request, user)
            return Response({
                'message': 'Login Successful',
                'user': UserSerializer(user).data,
                'role': user.profile.role
            })
        return Response({'error': 'Invalid credentials'}, status=400)
    return Response(serializer.errors, status=400)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_signup(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        return Response({
            'message': 'Signup Successful',
            'user': UserSerializer(user).data,
            'role': user.profile.role
        }, status=201)
    return Response(serializer.errors, status=400)

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

    @action(detail=True, methods=['get'])
    def resilience_metrics(self, request, pk=None):
        """Feature B: City Resilience Metrics"""
        metrics = SimulationService.calculate_resilience_metrics(pk)
        if metrics:
            return Response(metrics)
        return Response({"error": "Zone not found"}, status=404)

    @action(detail=True, methods=['post'])
    def simulate(self, request, pk=None):
        """Core Feature: What-If Simulation"""
        modifiers = request.data
        result = SimulationService.run_what_if_simulation(pk, modifiers)
        return Response(result)

@api_view(['GET'])
@permission_classes([AllowAny]) 
def get_user_profile(request):
    if not request.user.is_authenticated:
        return Response({"error": "Not authenticated"}, status=401)
    
    try:
        profile = request.user.profile
        aadhar = profile.aadhar_number if profile.aadhar_number else ""
        masked_aadhar = f"**** **** {aadhar[-4:]}" if len(aadhar) >= 4 else "Not Linked"
        
        return Response({
            "username": request.user.username,
            "email": request.user.email,
            "role": profile.get_role_display(),
            "aadhar_last4": masked_aadhar
        })
    except Exception as e:
        # Fallback if profile missing
        return Response({
            "username": request.user.username, 
            "email": request.user.email, 
            "role": "CITIZEN", 
            "aadhar_last4": ""
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
                    'pollutant_details': weather.pollutant_details,
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

# --- Shared: AQI Stations ---
from rest_framework.decorators import api_view
from .services.aqi_service import AQIService

@api_view(['GET'])
def get_stations_api(request):
    """Proxy CPCB data from AQIService"""
    # Optional: trigger refresh
    if 'refresh' in request.query_params:
        AQIService.fetch_live_data()
    
    stations = AQIService.get_stations()
    return Response(stations)

@api_view(['GET'])
def get_simulated_weather(request):
    """
    Returns LIVE weather data from Open-Meteo API.
    Cached for 10 minutes to prevent rate limiting.
    """
    from django.core.cache import cache
    
    CACHE_KEY = 'weather_data_delhi'
    cached_data = cache.get(CACHE_KEY)
    
    if cached_data:
        # Add a flag to indicate cached data for debugging
        cached_data['_source'] = 'cache'
        return Response(cached_data)

    try:
        # Open-Meteo API for New Delhi (28.61, 77.20)
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": 28.61,
            "longitude": 77.20,
            "current": "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,visibility",
            "timezone": "auto"
        }
        
        r = requests.get(url, params=params, timeout=5)
        r.raise_for_status()
        data = r.json().get('current', {})
        
        # Helper to convert degrees to cardinal
        def deg_to_cardinal(deg):
            dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
            ix = round(deg / (360. / len(dirs)))
            return dirs[ix % len(dirs)]

        # Map to our app's expected format
        weather_response = {
            "temp": data.get('temperature_2m', '--'),
            "humidity": data.get('relative_humidity_2m', '--'),
            "windSpeed": data.get('wind_speed_10m', '--'),
            "windDir": deg_to_cardinal(data.get('wind_direction_10m', 0)),
            "pressure": round(data.get('surface_pressure', 1013)),
            "condition": "Clear" if data.get('precipitation', 0) == 0 else "Rainy", # Simple inference
            "uv": "Moderate", # Open-Meteo basic free tier doesn't fully support UV in 'current' easily without more params, keep static or infer
            "vis": round(data.get('visibility', 5000) / 1000, 1), # Convert m to km
            "precipitation": f"{data.get('precipitation', 0)} mm"
        }
        
        # Cache for 10 minutes (600 seconds)
        cache.set(CACHE_KEY, weather_response, 600)
        
        return Response(weather_response)

    except Exception as e:
        print(f"Weather API Error: {e}")
        # Fallback to a basic safe state if API fails
        return Response({
            "temp": 22.0,
            "humidity": 45,
            "windSpeed": 10,
            "windDir": "N",
            "pressure": 1013,
            "condition": "Offline",
            "uv": "--",
            "vis": 4.0,
            "precipitation": "0.0 mm"
        })

# --- Traffic Monitoring ---
def traffic_monitor(request):
    """Render the traffic monitoring page"""
    return render(request, 'core/traffic.html')

@api_view(['GET'])
def get_traffic_data(request):
    """API endpoint to fetch real-time traffic data from TomTom"""
    API_KEY = os.getenv('TOMTOM_API_KEY')
    
    # --- RATE LIMITING (Protect Credits) ---
    from django.core.cache import cache
    
    # Get client IP
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
        
    cache_key = f"traffic_api_limit_{ip}"
    if cache.get(cache_key):
        return Response({
            'status': 'error',
            'message': 'Rate limit exceeded. Please wait 2 seconds.'
        }, status=429)
    
    # Set cache for 2 seconds (Reduced from 10s for better UX)
    cache.set(cache_key, True, 2)
    # --------------------------------------

    if not API_KEY:
        return Response({
            'status': 'error',
            'message': 'TomTom API key not configured. Please set TOMTOM_API_KEY in .env file'
        }, status=500)
    
    try:
        # Get coordinates from query parameters or use default (Connaught Place, New Delhi)
        lat = request.GET.get('lat', '28.6139')
        lon = request.GET.get('lon', '77.2090')
        point = f"{lat},{lon}"

        url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"

        params = {
            "point": point,
            "unit": "KMPH",
            "key": API_KEY
        }

        r = requests.get(url, params=params)

        if r.status_code == 200:
            data = r.json()["flowSegmentData"]

            current_speed = data["currentSpeed"]
            free_flow_speed = data["freeFlowSpeed"]

            congestion_score = round(
                (1 - current_speed / free_flow_speed) * 100, 2
            )

            # Store in database
            try:
                RealTimeTraffic.objects.create(
                    latitude=float(lat),
                    longitude=float(lon),
                    current_speed=current_speed,
                    free_flow_speed=free_flow_speed,
                    current_travel_time=data["currentTravelTime"],
                    free_flow_travel_time=data["freeFlowTravelTime"],
                    congestion_score=congestion_score,
                    confidence=round(data["confidence"] * 100, 2),
                    road_class=data["frc"],
                    road_closure=data["roadClosure"]
                )
            except Exception as db_error:
                print(f"Database save error: {db_error}")

            response_data = {
                "status": "success",
                "location": {
                    "latitude": lat,
                    "longitude": lon
                },
                "traffic": {
                    "currentSpeed": current_speed,
                    "freeFlowSpeed": free_flow_speed,
                    "currentTravelTime": data["currentTravelTime"],
                    "freeFlowTravelTime": data["freeFlowTravelTime"],
                    "confidence": round(data["confidence"] * 100, 2),
                    "roadClosure": data["roadClosure"],
                    "roadClass": data["frc"],
                    "congestionScore": congestion_score
                },
                "coordinates": data["coordinates"]["coordinate"]
            }

            return Response(response_data)
        else:
            # Fallback for Demo/Presentation if API Key fails (e.g. 403)
            print(f"TomTom API failed with {r.status_code}. Using MOCK data.")
            import random
            
            # Mock Traffic Data
            mock_current = random.randint(10, 50)
            mock_free = 60
            mock_congestion = round((1 - mock_current / mock_free) * 100, 2)
            
            return Response({
                "status": "success",
                "message": "Live API failed, showing simulation data",
                "location": {"latitude": lat, "longitude": lon},
                "traffic": {
                    "currentSpeed": mock_current,
                    "freeFlowSpeed": mock_free,
                    "currentTravelTime": 300,
                    "freeFlowTravelTime": 150,
                    "confidence": 100,
                    "roadClosure": False,
                    "roadClass": "FRC2",
                    "congestionScore": mock_congestion
                },
                "coordinates": [] # No line segment for mock
            })

    except Exception as e:
        print(f"Traffic API Error: {e}")
        # Graceful fallback on exception too
        import random
        mock_current = random.randint(10, 40)
        return Response({
            "status": "success",
            "message": "System Error, showing simulation data",
            "location": {"latitude": lat, "longitude": lon},
            "traffic": {
                "currentSpeed": mock_current,
                "freeFlowSpeed": 60,
                "currentTravelTime": 400,
                "freeFlowTravelTime": 150,
                "confidence": 90,
                "roadClosure": False,
                "roadClass": "FRC2",
                "congestionScore": round((1 - mock_current/60)*100, 2)
            },
            "coordinates": []
        })
