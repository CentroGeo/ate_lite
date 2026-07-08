from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
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

def dictfetchone(cursor):
    columns = [column[0] for column in cursor.description]
    row = cursor.fetchone()
    return dict(zip(columns, row)) if row else {}


def dictfetchall(cursor):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def to_int(value):
    return int(value or 0)


def to_float(value):
    return float(value or 0)


@csrf_exempt
def dashboard_summary(request):
    """
    Resumen principal del dashboard usando las vistas y bitácoras nuevas
    del schema electricidad.

    Regla inicial:
    - id_nivel = 0 significa Correcto
    - id_nivel > 0 se considera alerta/revisión
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                COUNT(DISTINCT NULLIF(BTRIM("NumeroPermiso"), '')) AS total_permisos,

                COUNT(DISTINCT CASE
                    WHEN COALESCE("Estatus_Legal", "Estatus_BDI", '') ILIKE '%vigente%'
                    THEN NULLIF(BTRIM("NumeroPermiso"), '')
                END) AS total_vigentes,

                COUNT(DISTINCT COALESCE(
                    NULLIF(BTRIM("Permisionario"), ''),
                    NULLIF(BTRIM("Razon_Social_Autorizada"), '')
                )) AS total_permisionarios,

                COUNT(DISTINCT COALESCE(
                    NULLIF(BTRIM("Razon_Social_Autorizada"), ''),
                    NULLIF(BTRIM("Permisionario"), '')
                )) AS total_empresas,

                COUNT(DISTINCT NULLIF(BTRIM("CentralEntidadFederativa"), '')) AS total_entidades,
                COUNT(DISTINCT NULLIF(BTRIM("CentralMunicipio"), '')) AS total_municipios,

                COALESCE(SUM("TotalCapacidad"), 0) AS total_capacidad,
                COUNT(*) AS registros_permisos
            FROM electricidad.dashboard_permisos;
        """)
        permisos = dictfetchone(cursor)

        cursor.execute("""
            WITH ultimo_anio AS (
                SELECT MAX("Anio") AS anio
                FROM electricidad.dashboard_consumos
                WHERE "Anio" IS NOT NULL
            )
            SELECT
                ultimo_anio.anio AS anio_generacion,
                COUNT(*) AS registros_consumo,
                COUNT(DISTINCT NULLIF(BTRIM(c."NumeroPermiso"), '')) AS permisos_con_consumo,
                COALESCE(SUM(c."GeneracionNeta"), 0) AS generacion_neta,
                COALESCE(SUM(c."GeneracionBruta"), 0) AS generacion_bruta,
                COALESCE(SUM(c."ConsumoAuxiliar"), 0) AS consumo_auxiliar
            FROM electricidad.dashboard_consumos c
            CROSS JOIN ultimo_anio
            WHERE c."Anio" = ultimo_anio.anio
            GROUP BY ultimo_anio.anio;
        """)
        consumos = dictfetchone(cursor)

        cursor.execute("""
            WITH alertas AS (
                SELECT
                    'Permiso' AS origen,
                    id_alerta,
                    id_nivel
                FROM electricidad.bitacora_alertas_permisos

                UNION ALL

                SELECT
                    'Consumo' AS origen,
                    id_alerta,
                    id_nivel
                FROM electricidad.bitacora_alertas_consumos
            )
            SELECT
                COUNT(*) FILTER (WHERE id_nivel > 0) AS total_alertas,
                COUNT(*) FILTER (WHERE origen = 'Permiso' AND id_nivel > 0) AS total_alertas_permisos,
                COUNT(*) FILTER (WHERE origen = 'Consumo' AND id_nivel > 0) AS total_alertas_consumos,
                COUNT(*) FILTER (WHERE id_nivel = 3) AS alertas_criticas,
                COUNT(*) FILTER (WHERE id_nivel = 2) AS alertas_advertencia,
                COUNT(*) FILTER (WHERE id_nivel = 1) AS alertas_inactivas,

                COUNT(*) FILTER (WHERE id_alerta = 1 AND id_nivel > 0) AS permisos_sin_georeferencia,
                COUNT(*) FILTER (WHERE id_alerta = 10 AND id_nivel > 0) AS permisos_sin_historico,
                COUNT(*) FILTER (WHERE id_alerta = 7 AND id_nivel > 0) AS sin_consumo,
                COUNT(*) FILTER (WHERE id_alerta = 11 AND id_nivel > 0) AS sin_generacion,
                COUNT(*) FILTER (WHERE id_alerta = 5 AND id_nivel > 0) AS factor_planta_mayor_100,
                COUNT(*) FILTER (WHERE id_alerta = 12 AND id_nivel > 0) AS alta_variabilidad
            FROM alertas;
        """)
        alertas = dictfetchone(cursor)

        cursor.execute("""
            WITH alertas AS (
                SELECT id_nivel
                FROM electricidad.bitacora_alertas_permisos
                WHERE id_nivel > 0

                UNION ALL

                SELECT id_nivel
                FROM electricidad.bitacora_alertas_consumos
                WHERE id_nivel > 0
            )
            SELECT
                n.id_nivel,
                n.descripcion_nivel,
                COUNT(a.id_nivel) AS total
            FROM electricidad.cat_niveles_alerta n
            LEFT JOIN alertas a
                ON a.id_nivel = n.id_nivel
            WHERE n.id_nivel > 0
            GROUP BY n.id_nivel, n.descripcion_nivel
            ORDER BY n.id_nivel;
        """)
        alertas_por_nivel = dictfetchall(cursor)

        cursor.execute("""
            WITH alertas AS (
                SELECT id_alerta, id_nivel
                FROM electricidad.bitacora_alertas_permisos
                WHERE id_nivel > 0

                UNION ALL

                SELECT id_alerta, id_nivel
                FROM electricidad.bitacora_alertas_consumos
                WHERE id_nivel > 0
            )
            SELECT
                c.id_alerta,
                c.nombre_alerta,
                c.nivel_categoria,
                COUNT(a.id_alerta) AS total
            FROM electricidad.cat_alertas c
            JOIN alertas a
                ON a.id_alerta = c.id_alerta
            GROUP BY c.id_alerta, c.nombre_alerta, c.nivel_categoria
            ORDER BY total DESC, c.id_alerta
            LIMIT 10;
        """)
        top_alertas = dictfetchall(cursor)

    data = {
        "status": "success",
        "summary": {
            "total_permisos": to_int(permisos.get("total_permisos")),
            "total_vigentes": to_int(permisos.get("total_vigentes")),
            "total_permisionarios": to_int(permisos.get("total_permisionarios")),
            "total_empresas": to_int(permisos.get("total_empresas")),
            "total_entidades": to_int(permisos.get("total_entidades")),
            "total_municipios": to_int(permisos.get("total_municipios")),
            "total_capacidad": to_float(permisos.get("total_capacidad")),
            "registros_permisos": to_int(permisos.get("registros_permisos")),

            "anio_generacion": to_int(consumos.get("anio_generacion")),
            "registros_consumo": to_int(consumos.get("registros_consumo")),
            "permisos_con_consumo": to_int(consumos.get("permisos_con_consumo")),
            "generacion_neta": to_float(consumos.get("generacion_neta")),
            "generacion_bruta": to_float(consumos.get("generacion_bruta")),
            "consumo_auxiliar": to_float(consumos.get("consumo_auxiliar")),
        },
        "alerts": {
            "total_alertas": to_int(alertas.get("total_alertas")),
            "total_alertas_permisos": to_int(alertas.get("total_alertas_permisos")),
            "total_alertas_consumos": to_int(alertas.get("total_alertas_consumos")),
            "alertas_criticas": to_int(alertas.get("alertas_criticas")),
            "alertas_advertencia": to_int(alertas.get("alertas_advertencia")),
            "alertas_inactivas": to_int(alertas.get("alertas_inactivas")),

            "permisos_sin_historico": to_int(alertas.get("permisos_sin_historico")),
            "permisos_sin_georeferencia": to_int(alertas.get("permisos_sin_georeferencia")),
            "sin_consumo": to_int(alertas.get("sin_consumo")),
            "sin_generacion": to_int(alertas.get("sin_generacion")),
            "factor_planta_mayor_100": to_int(alertas.get("factor_planta_mayor_100")),
            "alta_variabilidad": to_int(alertas.get("alta_variabilidad")),
        },
        "alerts_by_level": [
            {
                "id_nivel": to_int(row["id_nivel"]),
                "descripcion_nivel": row["descripcion_nivel"],
                "total": to_int(row["total"]),
            }
            for row in alertas_por_nivel
        ],
        "top_alerts": [
            {
                "id_alerta": to_int(row["id_alerta"]),
                "nombre_alerta": row["nombre_alerta"],
                "nivel_categoria": row["nivel_categoria"],
                "total": to_int(row["total"]),
            }
            for row in top_alertas
        ],
    }

    return JsonResponse(data)

