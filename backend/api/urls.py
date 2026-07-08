from django.urls import path
from .views import map_data

urlpatterns = [
    path('map/', map_data, name='map_data'),
]
