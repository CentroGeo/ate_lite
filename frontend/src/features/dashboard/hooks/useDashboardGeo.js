import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';
import { appendDashboardFilters } from '../utils/dashboardFilters';

export default function useDashboardGeo({
  filters = {},
  geoLevel = 'estado',
  metric = 'permisos',
}) {
  const [data, setData] = useState({
    status: 'idle',
    geo_level: geoLevel,
    metric,
    count: 0,
    quantiles: [],
    features: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filterKey = useMemo(
    () => JSON.stringify({ filters, geoLevel, metric }),
    [filters, geoLevel, metric]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardGeo() {
      try {
        setLoading(true);
        setError('');

        const params = appendDashboardFilters(new URLSearchParams(), filters);
        params.set('geoLevel', geoLevel);
        params.set('metric', metric);

        const response = await apiFetch(`/api/dashboard/geo/?${params.toString()}`);

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudieron cargar los datos geográficos.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardGeo();

    return () => {
      isMounted = false;
    };
  }, [filterKey]);

  return {
    data,
    loading,
    error,
  };
}
