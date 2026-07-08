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
const GEO_SELECTED_LAYER_ID = 'dashboard-geo-selected';

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

function getNationalFitOptions() {
  return {
    padding: 32,
    duration: 650,
    maxZoom: 5.4,
  };
}

function getDetailFitOptions(geoLevel, overrides = {}) {
  return {
    padding: {
      top: 150,
      right: 70,
      bottom: 85,
      left: 70,
    },
    duration: 600,
    maxZoom: geoLevel === 'estado' ? 7.4 : 11.2,
    ...overrides,
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSelectionLabel({
  geoLevel,
  featureName,
  stateCount,
  municipalityCount,
}) {
  if (municipalityCount > 1) {
    return `${municipalityCount} municipios seleccionados`;
  }

  if (stateCount > 1) {
    return `${stateCount} estados seleccionados`;
  }

  if (featureName && geoLevel === 'municipio') {
    return `Municipio: ${featureName}`;
  }

  if (featureName && geoLevel === 'estado') {
    return `Estado: ${featureName}`;
  }

  return 'Vista nacional';
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
  onSelectionLabelChange = () => {},
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const lastAutoFitKeyRef = useRef('');
  const hadActiveGeoSelectionRef = useRef(false);
  const nameLookupRef = useRef({
    estado: new Map(),
    municipio: new Map(),
  });

  const [mapReady, setMapReady] = useState(false);
  const [geoLevel, setGeoLevel] = useState('estado');
  const [metric, setMetric] = useState('permisos');
  const [geoJson, setGeoJson] = useState(null);
  const [mapTitleContext, setMapTitleContext] = useState('Vista nacional por estados');

  const selectedStateIds = Array.isArray(filters?.estados)
    ? filters.estados.map(String)
    : [];

  const selectedStateId = selectedStateIds.length === 1
    ? selectedStateIds[0]
    : '';

  const selectedMunicipalityIds = Array.isArray(filters?.municipios)
    ? filters.municipios.map(String)
    : [];

  const isNationalView = selectedStateIds.length === 0
    && selectedMunicipalityIds.length === 0;

  const geoFilters = useMemo(() => {
    /*
     * El mapa debe conservar contexto visual aunque el dashboard esté filtrado.
     *
     * - Vista estatal: no filtramos por estados ni municipios, para que todos
     *   los estados conserven su color.
     * - Vista municipal de un estado: mantenemos el estado, pero quitamos municipio,
     *   para que todos los municipios del estado sigan visibles.
     * - Vista municipal nacional: no filtramos por estados ni municipios.
     */
    const baseFilters = {
      ...filters,
      municipios: [],
    };

    if (geoLevel === 'estado' || selectedStateIds.length !== 1) {
      return {
        ...baseFilters,
        estados: [],
      };
    }

    return baseFilters;
  }, [filters, geoLevel, selectedStateIds]);

  const {
    data,
    loading,
    error,
  } = useDashboardGeo({
    filters: geoFilters,
    geoLevel,
    metric,
  });

  function updateSelectionContext(label) {
    setMapTitleContext(label);
    onSelectionLabelChange(label);
  }

  function cacheFeatureNames(features, level) {
    const lookup = nameLookupRef.current[level];

    features.forEach((feature) => {
      const id = getFeatureId(feature, level);
      const name = getFeatureName(feature, level);

      if (id && name && !name.startsWith('Sin ')) {
        lookup.set(String(id), name);
      }
    });
  }

  function getCachedName(level, id) {
    return nameLookupRef.current[level]?.get(String(id)) || '';
  }

  function getStateNameForFeature(feature) {
    const parentId = getFeatureParentId(feature);
    return parentId ? getCachedName('estado', parentId) : '';
  }

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

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: true,
      offset: 12,
      className: 'dashboard-map-tooltip',
    });

    map.on('movestart', () => {
      popupRef.current?.remove();
    });

    map.on('zoomstart', () => {
      popupRef.current?.remove();
    });

    map.on('dragstart', () => {
      popupRef.current?.remove();
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isNationalView) {
      updateSelectionContext(
        geoLevel === 'municipio'
          ? 'Vista nacional por municipios'
          : 'Vista nacional por estados'
      );
    }
  }, [isNationalView, geoLevel, onSelectionLabelChange]);

  useEffect(() => {
    const hasActiveGeoSelection = selectedStateIds.length > 0
      || selectedMunicipalityIds.length > 0;

    if (!hasActiveGeoSelection && hadActiveGeoSelectionRef.current) {
      setGeoLevel('estado');
      lastAutoFitKeyRef.current = '';
    }

    hadActiveGeoSelectionRef.current = hasActiveGeoSelection;
  }, [selectedStateIds, selectedMunicipalityIds]);

  useEffect(() => {
    let isMounted = true;

    fetch(GEOJSON_URLS[geoLevel])
      .then((response) => response.json())
      .then((json) => {
        if (isMounted) {
          cacheFeatureNames(json.features || [], geoLevel);
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
            dashboardSelected: geoLevel === 'estado'
              ? selectedStateIds.includes(id)
              : selectedMunicipalityIds.includes(id),
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
    selectedStateIds,
    selectedMunicipalityIds,
    metric,
  ]);

  const selectedNames = useMemo(() => {
    const namesById = new Map();

    enrichedGeoJson?.features?.forEach((feature) => {
      const id = String(feature.properties?.dashboardId || '');
      const name = String(feature.properties?.dashboardName || '');

      if (id && name) {
        namesById.set(id, name);
      }
    });

    const stateNames = selectedStateIds.map((id) => (
      getCachedName('estado', id)
      || namesById.get(id)
      || id
    ));

    const municipalityNames = selectedMunicipalityIds.map((id) => (
      getCachedName('municipio', id)
      || namesById.get(id)
      || id
    ));

    return {
      stateNames,
      municipalityNames,
    };
  }, [enrichedGeoJson, selectedStateIds, selectedMunicipalityIds]);

  useEffect(() => {
    if (selectedMunicipalityIds.length > 1) {
      updateSelectionContext(`${selectedMunicipalityIds.length} municipios seleccionados`);
      return;
    }

    if (selectedMunicipalityIds.length === 1) {
      const municipalityName = selectedNames.municipalityNames[0] || selectedMunicipalityIds[0];
      const stateName = selectedNames.stateNames[0];

      updateSelectionContext(
        stateName
          ? `Estado: ${stateName} · Municipio: ${municipalityName}`
          : `Municipio: ${municipalityName}`
      );
      return;
    }

    if (selectedStateIds.length > 1) {
      updateSelectionContext(`${selectedStateIds.length} estados seleccionados`);
      return;
    }

    if (selectedStateIds.length === 1) {
      const stateName = selectedNames.stateNames[0] || selectedStateIds[0];
      updateSelectionContext(`Estado: ${stateName}`);
      return;
    }

    updateSelectionContext(
      geoLevel === 'municipio'
        ? 'Vista nacional por municipios'
        : 'Vista nacional por estados'
    );
  }, [
    selectedStateIds,
    selectedMunicipalityIds,
    selectedNames,
    geoLevel,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !enrichedGeoJson?.features?.length) {
      return;
    }

    let targetFeatures = [];

    if (selectedMunicipalityIds.length > 0) {
      const selectedSet = new Set(selectedMunicipalityIds.map(String));

      targetFeatures = enrichedGeoJson.features.filter((feature) => (
        selectedSet.has(String(feature.properties?.dashboardId || ''))
      ));
    } else if (selectedStateIds.length > 0 && geoLevel === 'estado') {
      const selectedSet = new Set(selectedStateIds.map(String));

      targetFeatures = enrichedGeoJson.features.filter((feature) => (
        selectedSet.has(String(feature.properties?.dashboardId || ''))
      ));
    } else if (selectedStateIds.length === 1 && geoLevel === 'municipio') {
      targetFeatures = enrichedGeoJson.features;
    }

    if (targetFeatures.length === 0) {
      return;
    }

    const bounds = getBoundsForFeatures(targetFeatures);

    if (bounds) {
      map.fitBounds(bounds, getDetailFitOptions(geoLevel));
    }
  }, [
    mapReady,
    enrichedGeoJson,
    geoLevel,
    selectedStateIds,
    selectedMunicipalityIds,
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

      map.addLayer({
        id: GEO_SELECTED_LAYER_ID,
        type: 'line',
        source: GEO_SOURCE_ID,
        filter: ['==', ['get', 'dashboardSelected'], true],
        paint: {
          'line-color': '#7a244f',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            2.2,
            9,
            4,
          ],
          'line-opacity': 0.95,
        },
      });
    } else {
      map.getSource(GEO_SOURCE_ID).setData(enrichedGeoJson);
    }

    const autoFitKey = `${geoLevel}|${selectedStateId || 'nacional'}`;
    const bounds = getBoundsForFeatures(enrichedGeoJson.features);

    if (bounds && lastAutoFitKeyRef.current !== autoFitKey) {
      const fitOptions = isNationalView
        ? getNationalFitOptions()
        : getDetailFitOptions(geoLevel);

      map.fitBounds(bounds, fitOptions);
      lastAutoFitKeyRef.current = autoFitKey;
    }
  }, [mapReady, enrichedGeoJson, geoLevel, selectedStateId, isNationalView]);


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

      const featureValue = Number(feature.properties.dashboardValue || 0);
      const featureName = String(feature.properties.dashboardName || '');

      if (featureValue <= 0) {
        map.getCanvas().style.cursor = 'not-allowed';
        popupRef.current?.remove();
        return;
      }

      const parentStateName = geoLevel === 'municipio'
        ? getStateNameForFeature(feature)
        : '';

      map.getCanvas().style.cursor = 'pointer';

      popupRef.current
        ?.setLngLat(event.lngLat)
        .setHTML(`
          <div class="dashboard-map-tooltip-card">
            <span class="tooltip-kicker">${escapeHtml(METRIC_LABELS[metric] || metric)}</span>
            <strong>${escapeHtml(featureName)}</strong>
            ${parentStateName ? `<small class="tooltip-subtitle">${escapeHtml(parentStateName)}</small>` : ''}
            <span class="tooltip-value">${escapeHtml(formatNumber(featureValue))}</span>
          </div>
        `)
        .addTo(map);
    }

    function handleMouseLeave() {
      map.getCanvas().style.cursor = '';
      popupRef.current?.remove();
    }

    function handleClick(event) {
      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      popupRef.current?.remove();

      const id = String(feature.properties.dashboardId || '');
      const parentId = String(feature.properties.dashboardParentId || '');

      if (!id) {
        return;
      }

      event.originalEvent?.preventDefault?.();

      const isMultiSelect = Boolean(
        event.originalEvent?.ctrlKey
        || event.originalEvent?.metaKey
        || event.originalEvent?.shiftKey
      );

      const featureName = String(feature.properties.dashboardName || '');
      const featureValue = Number(feature.properties.dashboardValue || 0);

      if (featureValue <= 0) {
        return;
      }

      const bounds = getBoundsForFeatures([feature]);

      if (bounds && !isMultiSelect) {
        map.fitBounds(bounds, getDetailFitOptions(geoLevel));
      }

      if (geoLevel === 'estado') {
        if (isMultiSelect) {
          const exists = selectedStateIds.includes(id);
          const nextStates = exists
            ? selectedStateIds.filter((item) => item !== id)
            : [...selectedStateIds, id];

          onApplyFilters({
            ...filters,
            estados: nextStates,
            municipios: [],
          });

          updateSelectionContext(
            nextStates.length === 0
              ? 'Vista nacional por estados'
              : buildSelectionLabel({
                  geoLevel,
                  featureName: nextStates.length === 1 ? featureName : '',
                  stateCount: nextStates.length,
                  municipalityCount: 0,
                })
          );

          return;
        }

        onApplyFilters({
          ...filters,
          estados: [id],
          municipios: [],
        });

        updateSelectionContext(buildSelectionLabel({
          geoLevel,
          featureName,
          stateCount: 1,
          municipalityCount: 0,
        }));

        setGeoLevel('municipio');
        return;
      }

      if (isMultiSelect) {
        const exists = selectedMunicipalityIds.includes(id);
        const nextMunicipalities = exists
          ? selectedMunicipalityIds.filter((item) => item !== id)
          : [...selectedMunicipalityIds, id];

        onApplyFilters({
          ...filters,
          estados: selectedStateId ? [selectedStateId] : selectedStateIds,
          municipios: nextMunicipalities,
        });

        updateSelectionContext(buildSelectionLabel({
          geoLevel,
          stateCount: selectedStateIds.length,
          municipalityCount: nextMunicipalities.length,
        }));

        return;
      }

      onApplyFilters({
        ...filters,
        estados: parentId ? [parentId] : selectedStateIds,
        municipios: [id],
      });

      const stateNameForLabel = parentId
        ? getCachedName('estado', parentId)
        : selectedNames.stateNames[0];

      updateSelectionContext(
        stateNameForLabel
          ? `Estado: ${stateNameForLabel} · Municipio: ${featureName}`
          : buildSelectionLabel({
              geoLevel,
              featureName,
              stateCount: parentId ? 1 : selectedStateIds.length,
              municipalityCount: 1,
            })
      );
    }

    map.on('mousemove', GEO_FILL_LAYER_ID, handleMouseMove);
    map.on('mouseleave', GEO_FILL_LAYER_ID, handleMouseLeave);
    map.on('click', GEO_FILL_LAYER_ID, handleClick);

    return () => {
      map.off('mousemove', GEO_FILL_LAYER_ID, handleMouseMove);
      map.off('mouseleave', GEO_FILL_LAYER_ID, handleMouseLeave);
      map.off('click', GEO_FILL_LAYER_ID, handleClick);
    };
  }, [
    mapReady,
    geoLevel,
    onApplyFilters,
    onSelectionLabelChange,
    filters,
    selectedStateId,
    selectedStateIds,
    selectedMunicipalityIds,
  ]);

  function resetToNational() {
    onApplyFilters({
      ...filters,
      estados: [],
      municipios: [],
    });

    setGeoLevel('estado');
    lastAutoFitKeyRef.current = '';
    updateSelectionContext('Vista nacional por estados');
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
          {isNationalView && (
            <div className="map-view-switcher">
              <button
                type="button"
                className={geoLevel === 'estado' ? 'is-active' : ''}
                onClick={() => {
                  setGeoLevel('estado');
                  lastAutoFitKeyRef.current = '';
                }}
              >
                Estados
              </button>

              <button
                type="button"
                className={geoLevel === 'municipio' ? 'is-active' : ''}
                onClick={() => {
                  setGeoLevel('municipio');
                  lastAutoFitKeyRef.current = '';
                }}
              >
                Municipios
              </button>
            </div>
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
          <small title={mapTitleContext}>
            {mapTitleContext}
          </small>
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

        {!isNationalView && (
          <button
            type="button"
            className="map-home-button"
            onClick={resetToNational}
          >
            🏠 Nacional
          </button>
        )}

      </div>
    </section>
  );
}
