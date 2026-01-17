from rest_framework import serializers
from .models import CityZone, WeatherLog, Hospital, TrafficStats, AgriSupply, CitizenReport, HealthStats

class HealthStatsSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    class Meta:
        model = HealthStats
        fields = '__all__'

class CityZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = CityZone
        fields = '__all__'

class WeatherLogSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    class Meta:
        model = WeatherLog
        fields = '__all__'

class HospitalSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    class Meta:
        model = Hospital
        fields = '__all__'

class TrafficStatsSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    class Meta:
        model = TrafficStats
        fields = '__all__'

class AgriSupplySerializer(serializers.ModelSerializer):
    origin_zone_name = serializers.ReadOnlyField(source='origin_zone.name')
    class Meta:
        model = AgriSupply
        fields = '__all__'

class CitizenReportSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    class Meta:
        model = CitizenReport
        fields = '__all__'
