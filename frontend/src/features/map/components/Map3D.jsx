import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapData }  from '../../../hooks/useMapData';
import { typeIcons, getPinColor, getReadableType } from '../utils/mapConfig';
import MapLegend       from './MapLegend';
import MapFilter       from './MapFilter';

export default function Map3D() {
  const mapContainer   = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef([]);

  const { stations, loading } = useMapData();

  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [capacityRange, setCapacityRange] = useState({ min: 0, max: 5000 });

  // Initialize Map
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:     'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-102.5528, 23.6345],
      zoom: 4.5, pitch: 0, bearing: 0, antialias: true,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Stations
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || stations.length === 0) return;

    const markersList = [];
    stations.forEach(station => {
      if (isNaN(station.coords[0]) || isNaN(station.coords[1])) return;

      const color   = getPinColor(station.type);
      const iconImg = typeIcons[station.type];

      const el = document.createElement('div');
      el.style.cssText = 'width:36px;height:46px;cursor:pointer;';
      el.innerHTML = `
        <svg width="36" height="46" viewBox="0 0 36 46" fill="none"
             style="position:absolute;top:0;left:0;filter:drop-shadow(0px 3px 5px rgba(0,0,0,.35))">
          <path d="M18 0C8.059 0 0 8.059 0 18C0 29.176 18 46 18 46C18 46 36 29.176 36 18C36 8.059 27.941 0 18 0Z" fill="${color}"/>
          <circle cx="18" cy="18" r="13" fill="white"/>
        </svg>
        <img src="${iconImg}" alt="${station.type}"
             style="width:20px;height:20px;position:absolute;top:8px;left:8px;z-index:2;border-radius:50%;object-fit:contain;" />
      `;

      const popup = new maplibregl.Popup({ offset: 28 }).setHTML(`
        <div style="font-family:'Outfit',sans-serif;min-width:190px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <img src="${iconImg}" style="width:28px;height:28px;border-radius:50%;border:2px solid ${color};object-fit:contain;" />
            <strong style="font-size:13px;color:#272829;line-height:1.2;">${station.name}</strong>
          </div>
          <div style="height:2px;background:${color};border-radius:2px;margin-bottom:8px;"></div>
          <p style="margin:0 0 4px;font-size:12px;color:#545454;"><strong>Tipo:</strong> ${getReadableType(station.type)}</p>
          <p style="margin:0;font-size:12px;color:#545454;"><strong>Capacidad:</strong> ${station.capacity}</p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(station.coords)
        .setPopup(popup)
        .addTo(map);

      // Hide initially based on state
      const capMw = station.capacity_mw || 0;
      const capFilter = capMw < capacityRange.min || capMw > capacityRange.max;
      if (hiddenTypes.has(station.type) || capFilter) {
        el.style.display = 'none';
      }

      markersList.push({ marker, type: station.type, capacity_mw: capMw });
    });

    markersRef.current = markersList;

    return () => {
      markersList.forEach(m => m.marker.remove());
    };
  }, [stations]);

  // Update marker visibility when filters change
  useEffect(() => {
    markersRef.current.forEach(({ marker, type, capacity_mw }) => {
      const isHiddenByType = hiddenTypes.has(type);
      const isHiddenByCap = capacity_mw < capacityRange.min || capacity_mw > capacityRange.max;
      
      marker.getElement().style.display = (isHiddenByType || isHiddenByCap) ? 'none' : 'block';
    });
  }, [hiddenTypes, capacityRange]);

  const toggleType = (type) =>
    setHiddenTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });

  const toggleAllGen = () => {
    const all = Object.keys(typeIcons);
    setHiddenTypes(all.every(t => hiddenTypes.has(t)) ? new Set() : new Set(all));
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#eef2f5' }}>

      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,255,255,0.85)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100,
        }}>
          <p style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>
            Cargando puntos del mapa...
          </p>
        </div>
      )}

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <MapLegend
        hiddenTypes={hiddenTypes} toggleType={toggleType} toggleAllGen={toggleAllGen}
      />
      
      <MapFilter 
        capacityRange={capacityRange} 
        setCapacityRange={setCapacityRange} 
      />
    </div>
  );
}
