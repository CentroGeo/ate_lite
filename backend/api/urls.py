from django.urls import path
from .views import map_data, dashboard_summary, dashboard_alerts, dashboard_options

urlpatterns = [
    path('map/', map_data, name='map_data'),
    path('dashboard/summary/', dashboard_summary, name='dashboard_summary'),
    path('dashboard/alerts/', dashboard_alerts, name='dashboard_alerts'),
    path('dashboard/options/', dashboard_options, name='dashboard_options'),
]
