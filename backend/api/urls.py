from django.urls import path
from .views import map_data, dashboard_summary

urlpatterns = [
    path('map/', map_data, name='map_data'),
    path('dashboard/summary/', dashboard_summary, name='dashboard_summary'),
]
