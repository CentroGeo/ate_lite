import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';

export function useMapData() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const stationsData = await apiFetch('/api/map/');
        
        if (stationsData?.stations) {
          const rawList = Array.isArray(stationsData.stations) ? stationsData.stations : [stationsData.stations];
          setStations(
            rawList.filter(Boolean).map(s => ({
              name: s.name,
              coords: [parseFloat(s.lng), parseFloat(s.lat)],
              type: s.type || 'ciclo_combinado',
              capacity: s.capacity || '0.0 MW',
              capacity_mw: s.capacity_mw || 0,
            }))
          );
        }
        
      } catch (err) {
        console.error('Error cargando datos del mapa:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return { stations, loading };
}
