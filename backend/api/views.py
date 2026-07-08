from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import DatosDashboardGeorreferenciado


TECNOLOGIA_MAP = {
    'hidroelectrica': 'hidroelectrica',
    'eolica': 'eolica',
    'fotovoltaica': 'fotovoltaica',
    'nucleoelectrica': 'nucleoelectrica',
    'geotermoelectrica': 'geotermoelectrica',
    'ciclo combinado': 'ciclo_combinado',
    'combustion interna': 'combustion_interna',
    'carboelectrica': 'carboelectrica',
    'turbogas': 'turbogas',
    'almacenamiento': 'almacenamiento',
    'termoelectrica convencional': 'termoelectrica_convencional',
    'termoelectrica': 'termoelectrica_convencional',
    'cogeneracion': 'ciclo_combinado',
    'cogeneracion eficiente': 'ciclo_combinado',
}



def normalize_tech(tech_name):
    if not tech_name:
        return 'ciclo_combinado'
    tech_clean = tech_name.strip().lower()
    
    tech_clean = tech_clean.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    for pattern, key in TECNOLOGIA_MAP.items():
        if pattern in tech_clean:
            return key
    return 'ciclo_combinado'


@csrf_exempt
def map_data(request):
    """
    Endpoint para proveer las coordenadas e información georreferenciada de las centrales eléctricas.
    """
    from django.db.models import Func, F
    
    class ST_GeomFromText(Func):
        function = 'ST_GeomFromText'
    
    class ST_X(Func):
        function = 'ST_X'
        
    class ST_Y(Func):
        function = 'ST_Y'

    
    plantas_qs = DatosDashboardGeorreferenciado.objects.exclude(
        geom_texto__isnull=True
    ).exclude(
        geom_texto=''
    ).annotate(
        lng=ST_X(ST_GeomFromText('geom_texto')),
        lat=ST_Y(ST_GeomFromText('geom_texto'))
    ).values(
        'numero_permiso', 'tecnologia_instalada', 'fuente_energia', 'permisionario', 'total_capacidad', 'lng', 'lat'
    ).order_by('-total_capacidad')
    
    stations = []
    permisos_vistos = set()
    
    for planta in plantas_qs.iterator():
        numero_permiso = planta['numero_permiso']
        if numero_permiso in permisos_vistos:
            continue
        
        lng = planta['lng']
        lat = planta['lat']
        
        if lng is None or lat is None:
            continue
            
        tech = planta['tecnologia_instalada'] or planta['fuente_energia']
        norm_tech = normalize_tech(tech)
        
        cap = planta['total_capacidad']
        cap_val = float(cap) if cap is not None else 0.0
        
        stations.append({
            'name': planta['permisionario'] or numero_permiso,
            'lng': str(lng),
            'lat': str(lat),
            'type': norm_tech,
            'capacity': f"{cap_val:,.1f} MW",
            'capacity_mw': cap_val
        })
        permisos_vistos.add(numero_permiso)

    
    if not stations:
        stations = [
            { 'name': 'Central Laguna Verde (Fallback)', 'lng': '-96.4056', 'lat': '19.7214', 'type': 'nucleoelectrica', 'capacity': '1,640 MW', 'capacity_mw': 1640.0 },
            { 'name': 'Central Eólica La Venta (Fallback)', 'lng': '-94.7578', 'lat': '16.5861', 'type': 'eolica', 'capacity': '85 MW', 'capacity_mw': 85.0 }
        ]

    data = {
        'status': 'success',
        'stations': stations
    }
    return JsonResponse(data, safe=False)
