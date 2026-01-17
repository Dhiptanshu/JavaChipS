from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('PLANNER', 'City Planner'),
        ('AGRICULTURIST', 'Agriculturist'),
        ('HEALTH', 'Health Official'),
        ('CITIZEN', 'Citizen'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    aadhar_number = models.CharField(max_length=12, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class CityZone(models.Model):
    name = models.CharField(max_length=100)
    # Using FloatField for simple lat/long to avoid heavy GeoDjango dependencies on Windows for MVP.
    # In production with PostGIS, these would be PointField/PolygonField.
    latitude = models.FloatField()
    longitude = models.FloatField()
    risk_level = models.CharField(max_length=20, default='Low') # Low, Medium, High
    average_income_tier = models.CharField(max_length=20, default='Medium') # Low, Medium, High
    area_type = models.CharField(max_length=50, default='Mixed') # Residential, Industrial, Commercial

    def __str__(self):
        return self.name

class WeatherLog(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.CASCADE, related_name='weather_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    temperature_c = models.FloatField()
    precipitation_mm = models.FloatField()
    wind_speed_kmh = models.FloatField()
    visibility_km = models.FloatField()
    air_quality_index = models.IntegerField(default=50) # lower is better
    pollutant_details = models.TextField(default="{}") # JSON string of detailed pollutants (PM2.5, SO2, etc.)

    def __str__(self):
        return f"{self.zone.name} - {self.timestamp}"

class Hospital(models.Model):
    name = models.CharField(max_length=100)
    zone = models.ForeignKey(CityZone, on_delete=models.CASCADE)
    
    # Bed Capacity
    total_beds_icu = models.IntegerField(default=20)
    occupied_beds_icu = models.IntegerField(default=0)
    
    total_beds_general = models.IntegerField(default=100)
    occupied_beds_general = models.IntegerField(default=0)
    
    oxygen_supply_level = models.IntegerField(default=100) # Percentage
    is_live_data = models.BooleanField(default=False) # Helper for simulation vs real

    def __str__(self):
        return self.name

class TrafficStats(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    congestion_level = models.FloatField(default=0.0) # 0.0 to 1.0 (1.0 = heavy traffic)
    is_road_closed = models.BooleanField(default=False)

    def __str__(self):
        return f"Traffic in {self.zone.name}"

class RealTimeTraffic(models.Model):
    """Store real-time traffic data from TomTom API"""
    latitude = models.FloatField()
    longitude = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Speed metrics
    current_speed = models.IntegerField()  # km/h
    free_flow_speed = models.IntegerField()  # km/h
    
    # Travel time metrics
    current_travel_time = models.IntegerField()  # seconds
    free_flow_travel_time = models.IntegerField()  # seconds
    
    # Congestion metrics
    congestion_score = models.FloatField()  # 0-100 percentage
    confidence = models.FloatField()  # API confidence level
    
    # Road information
    road_class = models.CharField(max_length=20)
    road_closure = models.BooleanField(default=False)
    
    # Optional zone relationship
    zone = models.ForeignKey(CityZone, on_delete=models.SET_NULL, null=True, blank=True, related_name='realtime_traffic')
    
    class Meta:
        ordering = ['-timestamp']
        
    def __str__(self):
        return f"Traffic at ({self.latitude}, {self.longitude}) - {self.congestion_score}% congestion"

class HealthStats(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    respiratory_cases_active = models.IntegerField(default=0)
    
    def __str__(self):
        return f"Health Stats {self.zone.name}"

class AgriSupply(models.Model):
    crop_type = models.CharField(max_length=50)
    quantity_kg = models.FloatField()
    harvest_date = models.DateField()
    farmer_name = models.CharField(max_length=100)
    origin_zone = models.ForeignKey(CityZone, on_delete=models.CASCADE)
    
    # AI Prediction
    spoilage_risk_score = models.FloatField(default=0.0) # 0 to 100

    def __str__(self):
        return f"{self.quantity_kg}kg {self.crop_type} from {self.farmer_name}"

class CitizenReport(models.Model):
    REPORT_TYPES = [
        ('WASTE', 'Waste Accumulation'),
        ('TRAFFIC', 'Traffic Bottleneck'),
        ('OTHER', 'Other'),
    ]
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    description = models.TextField()
    zone = models.ForeignKey(CityZone, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    # image = models.ImageField(...) # Skipped for MVP simplicity

    def __str__(self):
        return f"{self.report_type} in {self.zone.name}"
