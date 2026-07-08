from django.urls import path
from .views import map_data, dashboard_summary, dashboard_alerts, dashboard_options, dashboard_timeseries, dashboard_geo, dashboard_points

urlpatterns = [
    path('map/', map_data, name='map_data'),
    path('dashboard/summary/', dashboard_summary, name='dashboard_summary'),
    path('dashboard/alerts/', dashboard_alerts, name='dashboard_alerts'),
    path('dashboard/options/', dashboard_options, name='dashboard_options'),
    path('dashboard/timeseries/', dashboard_timeseries, name='dashboard_timeseries'),
    path('dashboard/geo/', dashboard_geo, name='dashboard_geo'),
    path('dashboard/points/', dashboard_points, name='dashboard_points'),
]
