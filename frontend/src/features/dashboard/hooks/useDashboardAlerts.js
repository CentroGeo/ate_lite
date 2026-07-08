import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';
import { appendDashboardFilters } from '../utils/dashboardFilters';

export default function useDashboardAlerts({
  source = 'all',
  level = 3,
  limit = 10,
  filters = {},
}) {
  const [data, setData] = useState({
    filters: {
      source,
      level,
      limit,
    },
    alerts: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filterKey = useMemo(
    () => JSON.stringify({ source, level, limit, filters }),
    [source, level, limit, filters]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardAlerts() {
      try {
        setLoading(true);
        setError('');

        const params = appendDashboardFilters(new URLSearchParams(), filters);

        params.set('source', source);
        params.set('level', String(level));
        params.set('limit', String(limit));

        const response = await apiFetch(`/api/dashboard/alerts/?${params.toString()}`);

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudieron cargar las alertas.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardAlerts();

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
