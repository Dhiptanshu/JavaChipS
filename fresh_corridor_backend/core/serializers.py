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

# --- Auth Serializers ---
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class SignupSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES)
    aadhar_number = serializers.CharField(max_length=12, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'aadhar_number']
        extra_kwargs = {'password': {'write_only': True}}
    
    def create(self, validated_data):
        role = validated_data.pop('role')
        aadhar_number = validated_data.pop('aadhar_number', None)
        password = validated_data.pop('password')
        
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        
        UserProfile.objects.create(user=user, role=role, aadhar_number=aadhar_number)
        return user
