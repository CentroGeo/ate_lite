import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import useDashboardGeo from '../hooks/useDashboardGeo';

const GEOJSON_URLS = {
  estado: '/geo/ent_R.geojson',
  municipio: '/geo/mun_R.geojson',
};

const METRIC_LABELS = {
  permisos: 'Permisos',
  capacidad: 'Capacidad',
  generacion_neta: 'Generación neta',
  generacion_bruta: 'Generación bruta',
  consumo_auxiliar: 'Consumo auxiliar',
};

const CLASS_COLORS = {
  veryHigh: '#8cc69b',
  high: '#cfe88e',
  medium: '#fff59d',
  low: '#f7b091',
  veryLow: '#f47f8c',
  noData: '#e5eaec',
};

const GEO_SOURCE_ID = 'dashboard-geo-source';
const GEO_FILL_LAYER_ID = 'dashboard-geo-fill';
const GEO_BORDER_LAYER_ID = 'dashboard-geo-border';

function formatNumber(value) {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function readProp(properties, names) {
  for (const name of names) {
    if (
      properties?.[name] !== undefined
      && properties?.[name] !== null
      && properties?.[name] !== ''
    ) {
      return String(properties[name]);
    }
  }

  return '';
}

function normalizeStateId(value) {
  const clean = String(value || '').trim();

  if (!clean) {
    return '';
  }

  if (/^\d+$/.test(clean)) {
    return clean.padStart(2, '0').slice(0, 2);
  }

  return clean;
}

function normalizeMunicipalityId(value) {
  const clean = String(value || '').trim();

  if (!clean) {
    return '';
  }

  if (/^\d+$/.test(clean)) {
    return clean.padStart(5, '0').slice(0, 5);
  }

  return clean;
}

function getFeatureId(feature, geoLevel) {
  const properties = feature.properties || {};

  if (geoLevel === 'estado') {
    const raw = readProp(properties, [
      'entidad_cvegeo',
      'CVE_ENT',
      'cve_ent',
      'CVEGEO',
      'cvegeo',
      'ENTIDAD',
      'entidad',
      'ID',
      'id',
    ]);

    return normalizeStateId(raw);
  }

  const directMunicipality = readProp(properties, [
    'municipio_cvegeo',
    'CVEGEO',
    'cvegeo',
    'CVE_MGEO',
    'cve_mgeo',
    'ID',
    'id',
  ]);

  if (directMunicipality) {
    return normalizeMunicipalityId(directMunicipality);
  }

  const stateId = normalizeStateId(readProp(properties, [
    'CVE_ENT',
    'cve_ent',
    'entidad_cvegeo',
    'ENTIDAD',
    'entidad',
  ]));

  const municipalityId = readProp(properties, [
    'CVE_MUN',
    'cve_mun',
    'MUNICIPIO',
    'municipio',
    'ID_MUN',
    'id_mun',
  ]);

  if (stateId && municipalityId) {
    return `${stateId}${String(municipalityId).padStart(3, '0')}`;
  }

  return '';
}

function getFeatureParentId(feature) {
  const properties = feature.properties || {};

  const direct = normalizeStateId(readProp(properties, [
    'CVE_ENT',
    'cve_ent',
    'entidad_cvegeo',
    'ENTIDAD',
    'entidad',
  ]));

  if (direct) {
    return direct;
  }

  const municipalityId = getFeatureId(feature, 'municipio');

  return municipalityId.slice(0, 2);
}

function getFeatureName(feature, geoLevel) {
  const properties = feature.properties || {};

  if (geoLevel === 'estado') {
    return readProp(properties, [
      'entidad_nombre',
      'NOMGEO',
      'nomgeo',
      'NOM_ENT',
      'nom_ent',
      'nombre',
      'NOMBRE',
    ]) || 'Sin entidad';
  }

  return readProp(properties, [
    'municipio_nombre',
    'NOMGEO',
    'nomgeo',
    'NOM_MUN',
    'nom_mun',
    'nombre',
    'NOMBRE',
  ]) || 'Sin municipio';
}

function hasUsableQuintiles(quantiles, values) {
  const positiveUniqueValues = new Set(
    values
      .filter((value) => value > 0)
      .map((value) => Number(value).toFixed(4))
  );

  const uniqueQuantiles = new Set(
    quantiles
      .filter((value) => value > 0)
      .map((value) => Number(value).toFixed(4))
  );

  return positiveUniqueValues.size >= 5 && uniqueQuantiles.size >= 4;
}

function getValueClass(value, quantiles, useQuintiles) {
  if (!value || value <= 0) {
    return 'noData';
  }

  if (!useQuintiles) {
    if (value >= quantiles[2]) return 'veryHigh';
    if (value >= quantiles[1]) return 'medium';
    return 'veryLow';
  }

  if (value <= quantiles[0]) return 'veryLow';
  if (value <= quantiles[1]) return 'low';
  if (value <= quantiles[2]) return 'medium';
  if (value <= quantiles[3]) return 'high';

  return 'veryHigh';
}

function buildRangeLegend(quantiles) {
  const [q1, q2, q3, q4] = quantiles.map((value) => Math.round(value));

  return [
    {
      label: `>= ${formatNumber(q4)}`,
      color: CLASS_COLORS.veryHigh,
    },
    {
      label: `[${formatNumber(q3)} - ${formatNumber(q4)})`,
      color: CLASS_COLORS.high,
    },
    {
      label: `[${formatNumber(q2)} - ${formatNumber(q3)})`,
      color: CLASS_COLORS.medium,
    },
    {
      label: `[${formatNumber(q1)} - ${formatNumber(q2)})`,
      color: CLASS_COLORS.low,
    },
    {
      label: `< ${formatNumber(q1)}`,
      color: CLASS_COLORS.veryLow,
    },
  ];
}

function extendBoundsWithCoordinates(bounds, coordinates) {
  if (!coordinates) {
    return;
  }

  if (typeof coordinates[0] === 'number') {
    bounds.extend(coordinates);
    return;
  }

  coordinates.forEach((item) => extendBoundsWithCoordinates(bounds, item));
}

function getBoundsForFeatures(features) {
  const bounds = new maplibregl.LngLatBounds();
  let hasCoordinates = false;

  features.forEach((feature) => {
    if (feature.geometry?.coordinates) {
      extendBoundsWithCoordinates(bounds, feature.geometry.coordinates);
      hasCoordinates = true;
    }
  });

  if (!hasCoordinates) {
    return null;
  }

  return bounds;
}

function getMapStyle() {
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
      },
    },
    layers: [
      {
        id: 'carto-base',
        type: 'raster',
        source: 'carto',
      },
    ],
  };
}

export default function DashboardMap({
  filters,
  onApplyFilters,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [geoLevel, setGeoLevel] = useState('estado');
  const [metric, setMetric] = useState('permisos');
  const [geoJson, setGeoJson] = useState(null);
  const [hovered, setHovered] = useState(null);

  const selectedStateId = filters?.estados?.length === 1
    ? String(filters.estados[0])
    : '';

  const {
    data,
    loading,
    error,
  } = useDashboardGeo({
    filters,
    geoLevel,
    metric,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(),
      center: [-102.5, 23.7],
      zoom: 4.1,
      minZoom: 3,
      maxZoom: 13,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      'top-left'
    );

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      'bottom-right'
    );

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedStateId && geoLevel !== 'estado') {
      setGeoLevel('estado');
    }

    if (selectedStateId && geoLevel === 'estado') {
      setGeoLevel('municipio');
    }
  }, [selectedStateId, geoLevel]);

  useEffect(() => {
    let isMounted = true;

    fetch(GEOJSON_URLS[geoLevel])
      .then((response) => response.json())
      .then((json) => {
        if (isMounted) {
          setGeoJson(json);
        }
      })
      .catch((err) => {
        console.error('No se pudo cargar GeoJSON:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [geoLevel]);

  const values = useMemo(
    () => data.features.map((item) => Number(item.value || 0)),
    [data.features]
  );

  const useQuintiles = useMemo(
    () => hasUsableQuintiles(data.quantiles || [], values),
    [data.quantiles, values]
  );

  const valueById = useMemo(() => {
    const map = new Map();

    data.features.forEach((item) => {
      map.set(String(item.id), item);
    });

    return map;
  }, [data.features]);

  const visibleFeatures = useMemo(() => {
    const features = geoJson?.features || [];

    if (geoLevel !== 'municipio' || !selectedStateId) {
      return features;
    }

    return features.filter((feature) => getFeatureParentId(feature) === selectedStateId);
  }, [geoJson, geoLevel, selectedStateId]);

  const enrichedGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: visibleFeatures.map((feature) => {
        const id = getFeatureId(feature, geoLevel);
        const stats = valueById.get(id);
        const value = Number(stats?.value || 0);
        const valueClass = getValueClass(value, data.quantiles || [], useQuintiles);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            dashboardId: id,
            dashboardParentId: geoLevel === 'municipio'
              ? getFeatureParentId(feature)
              : '',
            dashboardName: stats?.name || getFeatureName(feature, geoLevel),
            dashboardValue: value,
            dashboardValueLabel: formatNumber(value),
            dashboardClass: valueClass,
          },
        };
      }),
    };
  }, [
    visibleFeatures,
    geoLevel,
    valueById,
    data.quantiles,
    useQuintiles,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !enrichedGeoJson) {
      return;
    }

    if (!map.getSource(GEO_SOURCE_ID)) {
      map.addSource(GEO_SOURCE_ID, {
        type: 'geojson',
        data: enrichedGeoJson,
      });

      map.addLayer({
        id: GEO_FILL_LAYER_ID,
        type: 'fill',
        source: GEO_SOURCE_ID,
        paint: {
          'fill-color': [
            'match',
            ['get', 'dashboardClass'],
            'veryHigh', CLASS_COLORS.veryHigh,
            'high', CLASS_COLORS.high,
            'medium', CLASS_COLORS.medium,
            'low', CLASS_COLORS.low,
            'veryLow', CLASS_COLORS.veryLow,
            'noData', CLASS_COLORS.noData,
            CLASS_COLORS.noData,
          ],
          'fill-opacity': 0.74,
        },
      });

      map.addLayer({
        id: GEO_BORDER_LAYER_ID,
        type: 'line',
        source: GEO_SOURCE_ID,
        paint: {
          'line-color': '#2f3437',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.45,
            8,
            1.2,
          ],
          'line-opacity': 0.75,
        },
      });
    } else {
      map.getSource(GEO_SOURCE_ID).setData(enrichedGeoJson);
    }

    const bounds = getBoundsForFeatures(enrichedGeoJson.features);

    if (bounds) {
      map.fitBounds(bounds, {
        padding: geoLevel === 'estado' ? 32 : 55,
        duration: 900,
        maxZoom: geoLevel === 'estado' ? 5.4 : 9.5,
      });
    }
  }, [mapReady, enrichedGeoJson, geoLevel]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !map.getLayer(GEO_FILL_LAYER_ID)) {
      return;
    }

    function handleMouseMove(event) {
      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      map.getCanvas().style.cursor = 'pointer';

      setHovered({
        name: feature.properties.dashboardName,
        value: Number(feature.properties.dashboardValue || 0),
      });
    }

    function handleMouseLeave() {
      map.getCanvas().style.cursor = '';
      setHovered(null);
    }

    function handleClick(event) {
      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      const id = String(feature.properties.dashboardId || '');
      const parentId = String(feature.properties.dashboardParentId || '');

      if (!id) {
        return;
      }

      const bounds = getBoundsForFeatures([feature]);

      if (bounds) {
        map.fitBounds(bounds, {
          padding: 70,
          duration: 850,
          maxZoom: geoLevel === 'estado' ? 7.2 : 10.5,
        });
      }

      if (geoLevel === 'estado') {
        onApplyFilters((current) => ({
          ...current,
          estados: [id],
          municipios: [],
        }));

        setGeoLevel('municipio');
        return;
      }

      onApplyFilters((current) => ({
        ...current,
        estados: current.estados?.length ? current.estados : [parentId],
        municipios: [id],
      }));
    }

    map.on('mousemove', GEO_FILL_LAYER_ID, handleMouseMove);
    map.on('mouseleave', GEO_FILL_LAYER_ID, handleMouseLeave);
    map.on('click', GEO_FILL_LAYER_ID, handleClick);

    return () => {
      map.off('mousemove', GEO_FILL_LAYER_ID, handleMouseMove);
      map.off('mouseleave', GEO_FILL_LAYER_ID, handleMouseLeave);
      map.off('click', GEO_FILL_LAYER_ID, handleClick);
    };
  }, [mapReady, geoLevel, onApplyFilters]);

  function resetToNational() {
    onApplyFilters((current) => ({
      ...current,
      estados: [],
      municipios: [],
    }));

    setGeoLevel('estado');
  }

  const rangeLegend = buildRangeLegend(data.quantiles || []);

  return (
    <section className="db-card dashboard-map-card">
      <div className="map-header">
        <div>
          <span className="db-card-title">Mapa</span>
          <h2>
            {geoLevel === 'estado'
              ? 'Distribución de permisos por entidad'
              : 'Distribución de permisos por municipio'}
          </h2>
          <p>
            Métrica: {METRIC_LABELS[metric] || metric}
          </p>
        </div>

        <div className="map-actions">
          {geoLevel === 'municipio' && (
            <button type="button" onClick={resetToNational}>
              ← Nacional
            </button>
          )}

          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            <option value="permisos">Permisos</option>
            <option value="capacidad">Capacidad</option>
            <option value="generacion_neta">Generación neta</option>
            <option value="generacion_bruta">Generación bruta</option>
            <option value="consumo_auxiliar">Consumo auxiliar</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="map-error">
          {error}
        </div>
      )}

      <div className="map-stage">
        <div ref={mapContainerRef} className="maplibre-dashboard-map" />

        {loading && (
          <div className="map-busy-overlay">
            Actualizando mapa…
          </div>
        )}

        <div className="map-title-box">
          <strong>Distribución de Permisos</strong>
          <span>Generación de Energía Eléctrica</span>
          {selectedStateId && geoLevel === 'municipio' && (
            <small>Nivel municipal</small>
          )}
        </div>

        <div className="map-legend-box">
          {useQuintiles ? (
            <div className="map-range-legend">
              {rangeLegend.map((item) => (
                <div key={item.label} className="map-range-row">
                  <span style={{ backgroundColor: item.color }} />
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="map-gradient-legend">
              <div className="map-gradient-bar" />
              <div className="map-gradient-labels">
                <strong>Alto</strong>
                <strong>Bajo</strong>
              </div>
            </div>
          )}

          <div className="map-no-data">
            <span />
            <strong>NO DATA</strong>
          </div>
        </div>

        <div className="map-hover-card">
          {hovered ? (
            <>
              <strong>{hovered.name}</strong>
              <span>{formatNumber(hovered.value)}</span>
            </>
          ) : (
            <>
              <strong>Explora el mapa</strong>
              <span>Pasa el mouse sobre una región</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
