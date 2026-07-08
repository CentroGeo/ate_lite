import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';
import { appendDashboardFilters } from '../utils/dashboardFilters';

export default function useDashboardSummary(filters = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filterKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardSummary() {
      try {
        setLoading(true);
        setError('');

        const params = appendDashboardFilters(new URLSearchParams(), filters);
        const queryString = params.toString();
        const endpoint = queryString
          ? `/api/dashboard/summary/?${queryString}`
          : '/api/dashboard/summary/';

        const response = await apiFetch(endpoint);

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudo cargar el resumen del dashboard.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardSummary();

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
