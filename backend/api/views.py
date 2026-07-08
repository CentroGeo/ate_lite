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

def set_dashboard_statement_timeout(cursor, milliseconds=20000):
    cursor.execute("SET statement_timeout = %s", [milliseconds])


def dashboard_api_errors(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except Exception as exc:
            message = str(exc)

            status = 500
            user_message = "Ocurrió un error al consultar el backend."

            if "statement timeout" in message.lower():
                status = 504
                user_message = (
                    "La consulta tardó demasiado. Reduce la combinación de filtros "
                    "o intenta con un rango más pequeño."
                )

            return JsonResponse(
                {
                    "status": "error",
                    "message": user_message,
                    "error_type": exc.__class__.__name__,
                },
                status=status,
            )

    return wrapper


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




def get_query_values(request, name):
    values = request.GET.getlist(name)
    output = []

    for value in values:
        for part in str(value).split(","):
            part = part.strip()
            if part:
                output.append(part)

    return output


def get_query_int_values(request, name):
    output = []

    for value in get_query_values(request, name):
        try:
            output.append(int(value))
        except ValueError:
            pass

    return output


def get_query_int(request, name):
    value = request.GET.get(name)

    if value in (None, ""):
        return None

    try:
        return int(value)
    except ValueError:
        return None


def parse_dashboard_filters(request):
    filters = {
        "start_year": get_query_int(request, "startYear"),
        "end_year": get_query_int(request, "endYear"),
        "tipo_periodo": request.GET.get("tipoPeriodo") or "",
        "output_period": request.GET.get("outputPeriod") or "auto",
        "alert_levels": get_query_int_values(request, "alertLevels"),
        "alert_types": get_query_int_values(request, "alertTypes"),
        "estados": get_query_values(request, "estados"),
        "municipios": get_query_values(request, "municipios"),
        "modalidades": get_query_values(request, "modalidades"),
        "tecnologias": get_query_values(request, "tecnologias"),
        "permisos": get_query_values(request, "permisos"),
        "permisionarios": get_query_values(request, "permisionarios"),
    }

    return filters


def validate_dashboard_filters(filters):
    errors = []

    if (
        filters["start_year"] is not None
        and filters["end_year"] is not None
        and filters["start_year"] > filters["end_year"]
    ):
        errors.append({
            "field": "years",
            "message": "El año inicial no puede ser mayor que el año final.",
        })

    return errors


def add_any_condition(conditions, params, expression, values):
    if values:
        conditions.append(f"{expression} = ANY(%s)")
        params.append(values)


def build_temporal_consumos_where(filters, alias):
    conditions = ["1=1"]
    params = []

    if filters["start_year"]:
        conditions.append(f'{alias}."Anio" >= %s')
        params.append(filters["start_year"])

    if filters["end_year"]:
        conditions.append(f'{alias}."Anio" <= %s')
        params.append(filters["end_year"])

    if filters["tipo_periodo"]:
        conditions.append(f'NULLIF(BTRIM({alias}."TipoPeriodo"), \'\') = %s')
        params.append(filters["tipo_periodo"])

    return " AND ".join(conditions), params


def build_permisos_geo_where(filters, alias):
    conditions = ["1=1"]
    params = []

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."inegi_identidad"), \'\')',
        filters["estados"],
    )

    add_any_condition(
        conditions,
        params,
        (
            f'CONCAT('
            f'COALESCE(NULLIF(BTRIM({alias}."inegi_identidad"), \'\'), \'\'), '
            f'COALESCE(NULLIF(BTRIM({alias}."inegi_idmunicipio"), \'\'), \'\')'
            f')'
        ),
        filters["municipios"],
    )

    return " AND ".join(conditions), params


def build_permisos_where(filters, alias="p"):
    conditions = ["1=1"]
    params = []

    geo_where, geo_params = build_permisos_geo_where(filters, alias)

    if geo_where != "1=1":
        conditions.append(geo_where)
        params.extend(geo_params)

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."Modalidad"), \'\')',
        filters["modalidades"],
    )

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."Tecnologia"), \'\')',
        filters["tecnologias"],
    )

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."NumeroPermiso"), \'\')',
        filters["permisos"],
    )

    add_any_condition(
        conditions,
        params,
        (
            f'COALESCE('
            f'NULLIF(BTRIM({alias}."Permisionario"), \'\'), '
            f'NULLIF(BTRIM({alias}."Razon_Social_Autorizada"), \'\')'
            f')'
        ),
        filters["permisionarios"],
    )

    temporal_where, temporal_params = build_temporal_consumos_where(filters, "pc")

    if temporal_where != "1=1":
        conditions.append(f"""
            EXISTS (
                SELECT 1
                FROM electricidad.dashboard_consumos pc
                WHERE NULLIF(BTRIM(pc."NumeroPermiso"), '') =
                      NULLIF(BTRIM({alias}."NumeroPermiso"), '')
                  AND {temporal_where}
            )
        """)
        params.extend(temporal_params)

    return " AND ".join(conditions), params


def build_consumos_where(filters, alias="c"):
    conditions = ["1=1"]
    params = []

    temporal_where, temporal_params = build_temporal_consumos_where(filters, alias)

    if temporal_where != "1=1":
        conditions.append(temporal_where)
        params.extend(temporal_params)

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."Modalidad"), \'\')',
        filters["modalidades"],
    )

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."Tecnologia"), \'\')',
        filters["tecnologias"],
    )

    add_any_condition(
        conditions,
        params,
        f'NULLIF(BTRIM({alias}."NumeroPermiso"), \'\')',
        filters["permisos"],
    )

    add_any_condition(
        conditions,
        params,
        (
            f'COALESCE('
            f'NULLIF(BTRIM({alias}."Permisionario"), \'\'), '
            f'NULLIF(BTRIM({alias}."Razon_Social_Autorizada"), \'\')'
            f')'
        ),
        filters["permisionarios"],
    )

    geo_where, geo_params = build_permisos_geo_where(filters, "cp")

    if geo_where != "1=1":
        conditions.append(f"""
            EXISTS (
                SELECT 1
                FROM electricidad.dashboard_permisos cp
                WHERE NULLIF(BTRIM(cp."NumeroPermiso"), '') =
                      NULLIF(BTRIM({alias}."NumeroPermiso"), '')
                  AND {geo_where}
            )
        """)
        params.extend(geo_params)

    return " AND ".join(conditions), params


def build_alert_where(filters, alias):
    conditions = []
    params = []

    if filters["alert_levels"]:
        add_any_condition(conditions, params, f"{alias}.id_nivel", filters["alert_levels"])
    else:
        conditions.append(f"{alias}.id_nivel > 0")

    add_any_condition(conditions, params, f"{alias}.id_alerta", filters["alert_types"])

    return " AND ".join(conditions), params



@csrf_exempt
@dashboard_api_errors
def dashboard_summary(request):
    """
    Resumen principal del dashboard aplicando filtros globales.

    Los filtros llegan por query params:
    startYear, endYear, tipoPeriodo, estados, municipios, modalidades,
    tecnologias, permisos, permisionarios, alertTypes, alertLevels.
    """
    filters = parse_dashboard_filters(request)
    filter_errors = validate_dashboard_filters(filters)

    if filter_errors:
        return JsonResponse(
            {
                "status": "error",
                "errors": filter_errors,
            },
            status=400,
        )

    permisos_where, permisos_params = build_permisos_where(filters, "p")
    consumos_where, consumos_params = build_consumos_where(filters, "c")
    selected_consumos_sql = "SELECT * FROM filtered_consumos"

    if not filters["start_year"] and not filters["end_year"]:
        selected_consumos_sql = """
            SELECT *
            FROM filtered_consumos
            WHERE "Anio" = (
                SELECT MAX("Anio")
                FROM filtered_consumos
                WHERE "Anio" IS NOT NULL
            )
        """

    with connection.cursor() as cursor:
        set_dashboard_statement_timeout(cursor)
        cursor.execute(f"""
            WITH filtered_permisos AS (
                SELECT p.*
                FROM electricidad.dashboard_permisos p
                WHERE {permisos_where}
            ),
            filtered_consumos AS (
                SELECT c.*
                FROM electricidad.dashboard_consumos c
                WHERE {consumos_where}
            ),
            selected_consumos AS (
                {selected_consumos_sql}
            )
            SELECT
                (
                    SELECT COUNT(DISTINCT NULLIF(BTRIM("NumeroPermiso"), ''))
                    FROM filtered_permisos
                ) AS total_permisos,

                (
                    SELECT COUNT(DISTINCT CASE
                        WHEN COALESCE("Estatus_Legal", "Estatus_BDI", '') ILIKE '%%vigente%%'
                        THEN NULLIF(BTRIM("NumeroPermiso"), '')
                    END)
                    FROM filtered_permisos
                ) AS total_vigentes,

                (
                    SELECT COUNT(DISTINCT COALESCE(
                        NULLIF(BTRIM("Permisionario"), ''),
                        NULLIF(BTRIM("Razon_Social_Autorizada"), '')
                    ))
                    FROM filtered_permisos
                ) AS total_permisionarios,

                (
                    SELECT COUNT(DISTINCT COALESCE(
                        NULLIF(BTRIM("Razon_Social_Autorizada"), ''),
                        NULLIF(BTRIM("Permisionario"), '')
                    ))
                    FROM filtered_permisos
                ) AS total_empresas,

                (
                    SELECT COUNT(DISTINCT NULLIF(BTRIM("inegi_identidad"), ''))
                    FROM filtered_permisos
                ) AS total_entidades,

                (
                    SELECT COUNT(DISTINCT CONCAT(
                        COALESCE(NULLIF(BTRIM("inegi_identidad"), ''), ''),
                        COALESCE(NULLIF(BTRIM("inegi_idmunicipio"), ''), '')
                    ))
                    FROM filtered_permisos
                    WHERE NULLIF(BTRIM("inegi_idmunicipio"), '') IS NOT NULL
                ) AS total_municipios,

                (
                    SELECT COALESCE(SUM("TotalCapacidad"), 0)
                    FROM filtered_permisos
                ) AS total_capacidad,

                (
                    SELECT COUNT(*)
                    FROM filtered_permisos
                ) AS registros_permisos,

                (
                    SELECT MIN("Anio")
                    FROM selected_consumos
                ) AS anio_inicio,

                (
                    SELECT MAX("Anio")
                    FROM selected_consumos
                ) AS anio_generacion,

                (
                    SELECT COUNT(*)
                    FROM selected_consumos
                ) AS registros_consumo,

                (
                    SELECT COUNT(DISTINCT NULLIF(BTRIM("NumeroPermiso"), ''))
                    FROM selected_consumos
                ) AS permisos_con_consumo,

                (
                    SELECT COALESCE(SUM("GeneracionNeta"), 0)
                    FROM selected_consumos
                ) AS generacion_neta,

                (
                    SELECT COALESCE(SUM("GeneracionBruta"), 0)
                    FROM selected_consumos
                ) AS generacion_bruta,

                (
                    SELECT COALESCE(SUM("ConsumoAuxiliar"), 0)
                    FROM selected_consumos
                ) AS consumo_auxiliar;
        """, permisos_params + consumos_params)
        resumen = dictfetchone(cursor)

        alert_where_p, alert_params_p = build_alert_where(filters, "ap")
        alert_where_c, alert_params_c = build_alert_where(filters, "ac")

        cursor.execute(f"""
            WITH filtered_permisos AS (
                SELECT p.*
                FROM electricidad.dashboard_permisos p
                WHERE {permisos_where}
            ),
            filtered_consumos AS (
                SELECT c.*
                FROM electricidad.dashboard_consumos c
                WHERE {consumos_where}
            ),
            alertas AS (
                SELECT
                    'Permiso' AS origen,
                    ap.id_alerta,
                    ap.id_nivel
                FROM electricidad.bitacora_alertas_permisos ap
                JOIN filtered_permisos fp
                  ON NULLIF(BTRIM(fp."NumeroPermiso"), '') =
                     NULLIF(BTRIM(ap."NumeroPermiso"), '')
                WHERE {alert_where_p}

                UNION ALL

                SELECT
                    'Consumo' AS origen,
                    ac.id_alerta,
                    ac.id_nivel
                FROM electricidad.bitacora_alertas_consumos ac
                JOIN filtered_consumos fc
                  ON fc.id_registro = ac.id_registro
                WHERE {alert_where_c}
            )
            SELECT
                COUNT(*) AS total_alertas,
                COUNT(*) FILTER (WHERE origen = 'Permiso') AS total_alertas_permisos,
                COUNT(*) FILTER (WHERE origen = 'Consumo') AS total_alertas_consumos,
                COUNT(*) FILTER (WHERE id_nivel = 3) AS alertas_criticas,
                COUNT(*) FILTER (WHERE id_nivel = 2) AS alertas_advertencia,
                COUNT(*) FILTER (WHERE id_nivel = 1) AS alertas_inactivas,

                COUNT(*) FILTER (WHERE id_alerta = 1) AS permisos_sin_georeferencia,
                COUNT(*) FILTER (WHERE id_alerta = 10) AS permisos_sin_historico,
                COUNT(*) FILTER (WHERE id_alerta = 7) AS sin_consumo,
                COUNT(*) FILTER (WHERE id_alerta = 11) AS sin_generacion,
                COUNT(*) FILTER (WHERE id_alerta = 5) AS factor_planta_mayor_100,
                COUNT(*) FILTER (WHERE id_alerta = 12) AS alta_variabilidad
            FROM alertas;
        """, permisos_params + consumos_params + alert_params_p + alert_params_c)
        alertas = dictfetchone(cursor)

        cursor.execute(f"""
            WITH filtered_permisos AS (
                SELECT p.*
                FROM electricidad.dashboard_permisos p
                WHERE {permisos_where}
            ),
            filtered_consumos AS (
                SELECT c.*
                FROM electricidad.dashboard_consumos c
                WHERE {consumos_where}
            ),
            alertas AS (
                SELECT ap.id_alerta, ap.id_nivel
                FROM electricidad.bitacora_alertas_permisos ap
                JOIN filtered_permisos fp
                  ON NULLIF(BTRIM(fp."NumeroPermiso"), '') =
                     NULLIF(BTRIM(ap."NumeroPermiso"), '')
                WHERE {alert_where_p}

                UNION ALL

                SELECT ac.id_alerta, ac.id_nivel
                FROM electricidad.bitacora_alertas_consumos ac
                JOIN filtered_consumos fc
                  ON fc.id_registro = ac.id_registro
                WHERE {alert_where_c}
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
        """, permisos_params + consumos_params + alert_params_p + alert_params_c)
        alertas_por_nivel = dictfetchall(cursor)

        cursor.execute(f"""
            WITH filtered_permisos AS (
                SELECT p.*
                FROM electricidad.dashboard_permisos p
                WHERE {permisos_where}
            ),
            filtered_consumos AS (
                SELECT c.*
                FROM electricidad.dashboard_consumos c
                WHERE {consumos_where}
            ),
            alertas AS (
                SELECT ap.id_alerta, ap.id_nivel
                FROM electricidad.bitacora_alertas_permisos ap
                JOIN filtered_permisos fp
                  ON NULLIF(BTRIM(fp."NumeroPermiso"), '') =
                     NULLIF(BTRIM(ap."NumeroPermiso"), '')
                WHERE {alert_where_p}

                UNION ALL

                SELECT ac.id_alerta, ac.id_nivel
                FROM electricidad.bitacora_alertas_consumos ac
                JOIN filtered_consumos fc
                  ON fc.id_registro = ac.id_registro
                WHERE {alert_where_c}
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
        """, permisos_params + consumos_params + alert_params_p + alert_params_c)
        top_alertas = dictfetchall(cursor)

    data = {
        "status": "success",
        "filters": filters,
        "summary": {
            "total_permisos": to_int(resumen.get("total_permisos")),
            "total_vigentes": to_int(resumen.get("total_vigentes")),
            "total_permisionarios": to_int(resumen.get("total_permisionarios")),
            "total_empresas": to_int(resumen.get("total_empresas")),
            "total_entidades": to_int(resumen.get("total_entidades")),
            "total_municipios": to_int(resumen.get("total_municipios")),
            "total_capacidad": to_float(resumen.get("total_capacidad")),
            "registros_permisos": to_int(resumen.get("registros_permisos")),

            "anio_inicio": to_int(resumen.get("anio_inicio")),
            "anio_generacion": to_int(resumen.get("anio_generacion")),
            "registros_consumo": to_int(resumen.get("registros_consumo")),
            "permisos_con_consumo": to_int(resumen.get("permisos_con_consumo")),
            "generacion_neta": to_float(resumen.get("generacion_neta")),
            "generacion_bruta": to_float(resumen.get("generacion_bruta")),
            "consumo_auxiliar": to_float(resumen.get("consumo_auxiliar")),
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


@csrf_exempt
@dashboard_api_errors
def dashboard_alerts(request):
    """
    Devuelve detalle de alertas recientes aplicando filtros globales.

    Query params especiales:
    - source: all | permiso | consumo
    - level: 1 | 2 | 3
    - limit: máximo 100
    """
    filters = parse_dashboard_filters(request)
    filter_errors = validate_dashboard_filters(filters)

    if filter_errors:
        return JsonResponse(
            {
                "status": "error",
                "errors": filter_errors,
            },
            status=400,
        )

    source = request.GET.get("source", "all").lower()
    level = request.GET.get("level", "3")
    limit = request.GET.get("limit", "25")

    if source not in {"all", "permiso", "consumo"}:
        source = "all"

    try:
        level = int(level)
    except ValueError:
        level = 3

    if level not in {1, 2, 3}:
        level = 3

    try:
        limit = int(limit)
    except ValueError:
        limit = 25

    limit = max(1, min(limit, 100))

    permisos_where, permisos_params = build_permisos_where(filters, "p")
    consumos_where, consumos_params = build_consumos_where(filters, "c")

    alert_types_p = []
    alert_types_c = []

    if filters["alert_types"]:
        alert_types_p.append("ap.id_alerta = ANY(%s)")
        alert_types_c.append("ac.id_alerta = ANY(%s)")

    alert_where_p = " AND ".join(["ap.id_nivel = %s"] + alert_types_p)
    alert_where_c = " AND ".join(["ac.id_nivel = %s"] + alert_types_c)

    alert_params_p = [level]
    alert_params_c = [level]

    if filters["alert_types"]:
        alert_params_p.append(filters["alert_types"])
        alert_params_c.append(filters["alert_types"])

    source_where = ""

    if source == "permiso":
        source_where = "WHERE au.origen = 'Permiso'"
    elif source == "consumo":
        source_where = "WHERE au.origen = 'Consumo'"

    sql = f"""
        WITH filtered_permisos AS (
            SELECT p.*
            FROM electricidad.dashboard_permisos p
            WHERE {permisos_where}
        ),
        filtered_consumos AS (
            SELECT c.*
            FROM electricidad.dashboard_consumos c
            WHERE {consumos_where}
        ),
        permisos_base AS (
            SELECT
                NULLIF(BTRIM("NumeroPermiso"), '') AS numero_permiso,
                MAX(NULLIF(BTRIM("Permisionario"), '')) AS permisionario,
                MAX(NULLIF(BTRIM("Razon_Social_Autorizada"), '')) AS razon_social,
                MAX(NULLIF(BTRIM("CentralEntidadFederativa"), '')) AS entidad,
                MAX(NULLIF(BTRIM("CentralMunicipio"), '')) AS municipio
            FROM filtered_permisos
            GROUP BY NULLIF(BTRIM("NumeroPermiso"), '')
        ),
        alertas_unidas AS (
            SELECT
                'Permiso' AS origen,
                ap."NumeroPermiso" AS numero_permiso,
                NULL::integer AS id_registro,
                ap.id_alerta,
                ap.id_nivel,
                ap.mensaje_especifico,
                ap.fecha_evaluacion,
                pb.permisionario,
                pb.razon_social,
                pb.entidad,
                pb.municipio,
                NULL::integer AS anio,
                NULL::text AS mes_ini,
                NULL::text AS mes_fin
            FROM electricidad.bitacora_alertas_permisos ap
            JOIN permisos_base pb
                ON pb.numero_permiso = NULLIF(BTRIM(ap."NumeroPermiso"), '')
            WHERE {alert_where_p}

            UNION ALL

            SELECT
                'Consumo' AS origen,
                fc."NumeroPermiso" AS numero_permiso,
                ac.id_registro,
                ac.id_alerta,
                ac.id_nivel,
                ac.mensaje_especifico,
                ac.fecha_evaluacion,
                NULLIF(BTRIM(fc."Permisionario"), '') AS permisionario,
                NULLIF(BTRIM(fc."Razon_Social_Autorizada"), '') AS razon_social,
                NULL::text AS entidad,
                NULL::text AS municipio,
                fc."Anio" AS anio,
                fc."MesIni" AS mes_ini,
                fc."MesFin" AS mes_fin
            FROM electricidad.bitacora_alertas_consumos ac
            JOIN filtered_consumos fc
                ON fc.id_registro = ac.id_registro
            WHERE {alert_where_c}
        )
        SELECT
            au.origen,
            au.numero_permiso,
            au.id_registro,
            au.id_alerta,
            ca.nombre_alerta,
            ca.nivel_categoria,
            au.id_nivel,
            cn.descripcion_nivel,
            au.mensaje_especifico,
            au.fecha_evaluacion,
            COALESCE(au.permisionario, au.razon_social, '') AS permisionario,
            au.entidad,
            au.municipio,
            au.anio,
            au.mes_ini,
            au.mes_fin
        FROM alertas_unidas au
        JOIN electricidad.cat_alertas ca
            ON ca.id_alerta = au.id_alerta
        LEFT JOIN electricidad.cat_niveles_alerta cn
            ON cn.id_nivel = au.id_nivel
        {source_where}
        ORDER BY au.fecha_evaluacion DESC NULLS LAST, au.id_alerta
        LIMIT %s;
    """

    params = (
        permisos_params
        + consumos_params
        + alert_params_p
        + alert_params_c
        + [limit]
    )

    with connection.cursor() as cursor:
        set_dashboard_statement_timeout(cursor)
        cursor.execute(sql, params)
        rows = dictfetchall(cursor)

    data = {
        "status": "success",
        "filters": {
            "source": source,
            "level": level,
            "limit": limit,
            "global_filters": filters,
        },
        "alerts": [
            {
                "origen": row["origen"],
                "numero_permiso": row["numero_permiso"],
                "id_registro": row["id_registro"],
                "id_alerta": to_int(row["id_alerta"]),
                "nombre_alerta": row["nombre_alerta"],
                "nivel_categoria": row["nivel_categoria"],
                "id_nivel": to_int(row["id_nivel"]),
                "descripcion_nivel": row["descripcion_nivel"],
                "mensaje_especifico": row["mensaje_especifico"],
                "fecha_evaluacion": row["fecha_evaluacion"].isoformat() if row["fecha_evaluacion"] else None,
                "permisionario": row["permisionario"],
                "entidad": row["entidad"],
                "municipio": row["municipio"],
                "anio": row["anio"],
                "mes_ini": row["mes_ini"],
                "mes_fin": row["mes_fin"],
            }
            for row in rows
        ],
    }

    return JsonResponse(data)

@csrf_exempt
def dashboard_options(request):
    """
    Catálogos para construir los filtros del dashboard.

    Estos valores salen de las vistas/tablas reales del schema electricidad.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                MIN("Anio") AS min_year,
                MAX("Anio") AS max_year
            FROM electricidad.dashboard_consumos
            WHERE "Anio" IS NOT NULL;
        """)
        years = dictfetchone(cursor)

        cursor.execute("""
            WITH valores AS (
                SELECT NULLIF(BTRIM("TipoPeriodo"), '') AS value
                FROM electricidad.dashboard_consumos
            )
            SELECT
                value,
                COUNT(*) AS total
            FROM valores
            WHERE value IS NOT NULL
            GROUP BY value
            ORDER BY value;
        """)
        tipo_periodo = dictfetchall(cursor)

        cursor.execute("""
            WITH valores AS (
                SELECT NULLIF(BTRIM("Modalidad"), '') AS value
                FROM electricidad.dashboard_permisos
                UNION ALL
                SELECT NULLIF(BTRIM("Modalidad"), '') AS value
                FROM electricidad.dashboard_consumos
            )
            SELECT
                value,
                COUNT(*) AS total
            FROM valores
            WHERE value IS NOT NULL
            GROUP BY value
            ORDER BY value;
        """)
        modalidades = dictfetchall(cursor)

        cursor.execute("""
            WITH valores AS (
                SELECT NULLIF(BTRIM("Tecnologia"), '') AS value
                FROM electricidad.dashboard_permisos
                UNION ALL
                SELECT NULLIF(BTRIM("Tecnologia"), '') AS value
                FROM electricidad.dashboard_consumos
            )
            SELECT
                value,
                COUNT(*) AS total
            FROM valores
            WHERE value IS NOT NULL
            GROUP BY value
            ORDER BY value;
        """)
        tecnologias = dictfetchall(cursor)

        cursor.execute("""
            SELECT
                id_alerta,
                nombre_alerta,
                nivel_categoria,
                descripcion
            FROM electricidad.cat_alertas
            ORDER BY id_alerta;
        """)
        alert_types = dictfetchall(cursor)

        cursor.execute("""
            SELECT
                id_nivel,
                descripcion_nivel
            FROM electricidad.cat_niveles_alerta
            ORDER BY id_nivel;
        """)
        alert_levels = dictfetchall(cursor)

        cursor.execute("""
            WITH estados_base AS (
                SELECT
                    NULLIF(BTRIM("inegi_identidad"), '') AS estado_id,
                    COALESCE(
                        NULLIF(BTRIM("inegi_entidad"), ''),
                        NULLIF(BTRIM("CentralEntidadFederativa"), '')
                    ) AS estado_nombre,
                    NULLIF(BTRIM("NumeroPermiso"), '') AS numero_permiso
                FROM electricidad.dashboard_permisos
            )
            SELECT
                estado_id,
                MAX(estado_nombre) AS estado_nombre,
                COUNT(DISTINCT numero_permiso) AS total_permisos
            FROM estados_base
            WHERE estado_id IS NOT NULL
            GROUP BY estado_id
            ORDER BY estado_nombre;
        """)
        estados = dictfetchall(cursor)

        cursor.execute("""
            WITH municipios_base AS (
                SELECT
                    NULLIF(BTRIM("inegi_identidad"), '') AS estado_id,
                    NULLIF(BTRIM("inegi_idmunicipio"), '') AS municipio_id,
                    COALESCE(
                        NULLIF(BTRIM("inegi_municipio"), ''),
                        NULLIF(BTRIM("CentralMunicipio"), '')
                    ) AS municipio_nombre,
                    NULLIF(BTRIM("NumeroPermiso"), '') AS numero_permiso
                FROM electricidad.dashboard_permisos
            )
            SELECT
                estado_id,
                municipio_id,
                MAX(municipio_nombre) AS municipio_nombre,
                COUNT(DISTINCT numero_permiso) AS total_permisos
            FROM municipios_base
            WHERE municipio_id IS NOT NULL
            GROUP BY estado_id, municipio_id
            ORDER BY municipio_nombre;
        """)
        municipios = dictfetchall(cursor)

        cursor.execute("""
            WITH valores AS (
                SELECT NULLIF(BTRIM("NumeroPermiso"), '') AS numero_permiso
                FROM electricidad.dashboard_permisos
                UNION
                SELECT NULLIF(BTRIM("NumeroPermiso"), '') AS numero_permiso
                FROM electricidad.dashboard_consumos
            )
            SELECT numero_permiso
            FROM valores
            WHERE numero_permiso IS NOT NULL
            ORDER BY numero_permiso;
        """)
        permisos = dictfetchall(cursor)

        cursor.execute("""
            WITH valores AS (
                SELECT COALESCE(
                    NULLIF(BTRIM("Permisionario"), ''),
                    NULLIF(BTRIM("Razon_Social_Autorizada"), '')
                ) AS permisionario
                FROM electricidad.dashboard_permisos

                UNION

                SELECT COALESCE(
                    NULLIF(BTRIM("Permisionario"), ''),
                    NULLIF(BTRIM("Razon_Social_Autorizada"), '')
                ) AS permisionario
                FROM electricidad.dashboard_consumos
            )
            SELECT permisionario
            FROM valores
            WHERE permisionario IS NOT NULL
            ORDER BY permisionario;
        """)
        permisionarios = dictfetchall(cursor)

    data = {
        "status": "success",
        "years": {
            "min": to_int(years.get("min_year")),
            "max": to_int(years.get("max_year")),
        },
        "tipo_periodo": [
            {
                "value": row["value"],
                "label": row["value"],
                "total": to_int(row["total"]),
            }
            for row in tipo_periodo
        ],
        "modalidades": [
            {
                "value": row["value"],
                "label": row["value"],
                "total": to_int(row["total"]),
            }
            for row in modalidades
        ],
        "tecnologias": [
            {
                "value": row["value"],
                "label": row["value"],
                "total": to_int(row["total"]),
            }
            for row in tecnologias
        ],
        "alert_types": [
            {
                "id_alerta": to_int(row["id_alerta"]),
                "nombre_alerta": row["nombre_alerta"],
                "nivel_categoria": row["nivel_categoria"],
                "descripcion": row["descripcion"],
            }
            for row in alert_types
        ],
        "alert_levels": [
            {
                "id_nivel": to_int(row["id_nivel"]),
                "descripcion_nivel": row["descripcion_nivel"],
            }
            for row in alert_levels
        ],
        "estados": [
            {
                "id": row["estado_id"],
                "nombre": row["estado_nombre"],
                "total_permisos": to_int(row["total_permisos"]),
            }
            for row in estados
        ],
        "municipios": [
            {
                "estado_id": row["estado_id"],
                "id": row["municipio_id"],
                "nombre": row["municipio_nombre"],
                "total_permisos": to_int(row["total_permisos"]),
            }
            for row in municipios
        ],
        "permisos": [
            {
                "value": row["numero_permiso"],
                "label": row["numero_permiso"],
            }
            for row in permisos
        ],
        "permisionarios": [
            {
                "value": row["permisionario"],
                "label": row["permisionario"],
            }
            for row in permisionarios
        ],
    }

    return JsonResponse(data)


@csrf_exempt
@dashboard_api_errors
def dashboard_timeseries(request):
    """
    Serie temporal de generación bruta, generación neta y consumo auxiliar.

    Reglas de granularidad:
    - outputPeriod=auto:
        usa month solo si todos los registros filtrados son Mensual.
        si hay Trimestral o mezcla, usa quarter.
    - outputPeriod=month:
        solo se respeta si todos los registros filtrados son Mensual.
        si hay mezcla o Trimestral, se baja a quarter y se informa warning.
    - outputPeriod=quarter | semester | year:
        se respeta directamente.
    """
    filters = parse_dashboard_filters(request)
    filter_errors = validate_dashboard_filters(filters)

    if filter_errors:
        return JsonResponse(
            {
                "status": "error",
                "errors": filter_errors,
            },
            status=400,
        )

    requested_period = filters.get("output_period") or "auto"

    if requested_period not in {"auto", "month", "quarter", "semester", "year"}:
        requested_period = "auto"

    consumos_where, consumos_params = build_consumos_where(filters, "c")

    month_case = """
        CASE
            WHEN LOWER(BTRIM("MesIni")) = 'enero' THEN 1
            WHEN LOWER(BTRIM("MesIni")) = 'febrero' THEN 2
            WHEN LOWER(BTRIM("MesIni")) = 'marzo' THEN 3
            WHEN LOWER(BTRIM("MesIni")) = 'abril' THEN 4
            WHEN LOWER(BTRIM("MesIni")) = 'mayo' THEN 5
            WHEN LOWER(BTRIM("MesIni")) = 'junio' THEN 6
            WHEN LOWER(BTRIM("MesIni")) = 'julio' THEN 7
            WHEN LOWER(BTRIM("MesIni")) = 'agosto' THEN 8
            WHEN LOWER(BTRIM("MesIni")) IN ('septiembre', 'setiembre') THEN 9
            WHEN LOWER(BTRIM("MesIni")) = 'octubre' THEN 10
            WHEN LOWER(BTRIM("MesIni")) = 'noviembre' THEN 11
            WHEN LOWER(BTRIM("MesIni")) = 'diciembre' THEN 12
            ELSE NULL
        END
    """

    with connection.cursor() as cursor:
        set_dashboard_statement_timeout(cursor)
        cursor.execute(f"""
            SELECT
                COUNT(*) AS total_records,
                COUNT(DISTINCT NULLIF(BTRIM(c."TipoPeriodo"), '')) AS distinct_periods,
                BOOL_AND(NULLIF(BTRIM(c."TipoPeriodo"), '') = 'Mensual') AS only_monthly
            FROM electricidad.dashboard_consumos c
            WHERE {consumos_where};
        """, consumos_params)
        period_info = dictfetchone(cursor)

    total_records = to_int(period_info.get("total_records"))
    only_monthly = bool(period_info.get("only_monthly")) if total_records > 0 else False

    warning = None

    if requested_period == "auto":
        effective_period = "month" if only_monthly else "quarter"
    elif requested_period == "month" and not only_monthly:
        effective_period = "quarter"
        warning = (
            "La consulta incluye registros trimestrales o mezcla de periodicidades; "
            "se agrupó la serie a trimestre."
        )
    else:
        effective_period = requested_period

    if effective_period == "month":
        period_select = """
            "Anio" AS period_year,
            mes_num AS period_number,
            "Anio"::text || '-' || LPAD(mes_num::text, 2, '0') AS period_key,
            "Anio"::text || '-' || LPAD(mes_num::text, 2, '0') AS period_label
        """
        period_group = '"Anio", mes_num'
        period_order = '"Anio", mes_num'

    elif effective_period == "quarter":
        period_select = """
            "Anio" AS period_year,
            CEIL(mes_num / 3.0)::integer AS period_number,
            "Anio"::text || '-Q' || CEIL(mes_num / 3.0)::integer::text AS period_key,
            "Anio"::text || ' T' || CEIL(mes_num / 3.0)::integer::text AS period_label
        """
        period_group = '"Anio", CEIL(mes_num / 3.0)::integer'
        period_order = '"Anio", CEIL(mes_num / 3.0)::integer'

    elif effective_period == "semester":
        period_select = """
            "Anio" AS period_year,
            CEIL(mes_num / 6.0)::integer AS period_number,
            "Anio"::text || '-S' || CEIL(mes_num / 6.0)::integer::text AS period_key,
            "Anio"::text || ' S' || CEIL(mes_num / 6.0)::integer::text AS period_label
        """
        period_group = '"Anio", CEIL(mes_num / 6.0)::integer'
        period_order = '"Anio", CEIL(mes_num / 6.0)::integer'

    else:
        period_select = """
            "Anio" AS period_year,
            1 AS period_number,
            "Anio"::text AS period_key,
            "Anio"::text AS period_label
        """
        period_group = '"Anio"'
        period_order = '"Anio"'

    with connection.cursor() as cursor:
        set_dashboard_statement_timeout(cursor)
        cursor.execute(f"""
            WITH filtered_consumos AS (
                SELECT
                    c.*,
                    {month_case} AS mes_num
                FROM electricidad.dashboard_consumos c
                WHERE {consumos_where}
            ),
            valid_consumos AS (
                SELECT *
                FROM filtered_consumos
                WHERE "Anio" IS NOT NULL
                  AND mes_num IS NOT NULL
            )
            SELECT
                {period_select},
                COUNT(*) AS registros,
                COUNT(DISTINCT NULLIF(BTRIM("NumeroPermiso"), '')) AS permisos,
                COALESCE(SUM("GeneracionBruta"), 0) AS generacion_bruta,
                COALESCE(SUM("GeneracionNeta"), 0) AS generacion_neta,
                COALESCE(SUM("ConsumoAuxiliar"), 0) AS consumo_auxiliar,
                COALESCE(AVG("FactorPlanta"), 0) AS factor_planta_promedio
            FROM valid_consumos
            GROUP BY {period_group}
            ORDER BY {period_order};
        """, consumos_params)
        rows = dictfetchall(cursor)

    data = {
        "status": "success",
        "requested_period": requested_period,
        "effective_period": effective_period,
        "warning": warning,
        "total_records": total_records,
        "only_monthly": only_monthly,
        "series": [
            {
                "period_key": row["period_key"],
                "period_label": row["period_label"],
                "period_year": to_int(row["period_year"]),
                "period_number": to_int(row["period_number"]),
                "registros": to_int(row["registros"]),
                "permisos": to_int(row["permisos"]),
                "generacion_bruta": to_float(row["generacion_bruta"]),
                "generacion_neta": to_float(row["generacion_neta"]),
                "consumo_auxiliar": to_float(row["consumo_auxiliar"]),
                "factor_planta_promedio": to_float(row["factor_planta_promedio"]),
            }
            for row in rows
        ],
    }

    return JsonResponse(data)

