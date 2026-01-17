from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import PlannerViewSet, HealthViewSet, FarmerViewSet, CitizenViewSet, dashboard

router = DefaultRouter()
router.register(r'planner', PlannerViewSet, basename='planner')
router.register(r'health', HealthViewSet, basename='health')
router.register(r'farmer', FarmerViewSet, basename='farmer')
router.register(r'citizen', CitizenViewSet, basename='citizen')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('', dashboard, name='dashboard'),
]
