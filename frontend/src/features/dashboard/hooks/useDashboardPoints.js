import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';
import { appendDashboardFilters } from '../utils/dashboardFilters';

export default function useDashboardPoints({ filters = {}, enabled = false, limit = 2000 } = {}) {
  const [data, setData] = useState({
    status: 'idle',
    count: 0,
    limit,
    points: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filterKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  useEffect(() => {
    let isMounted = true;

    if (!enabled) {
      setData({
        status: 'idle',
        count: 0,
        limit,
        points: [],
      });
      setLoading(false);
      setError('');

      return () => {
        isMounted = false;
      };
    }

    async function loadDashboardPoints() {
      try {
        setLoading(true);
        setError('');

        const params = appendDashboardFilters(new URLSearchParams(), filters);
        params.set('limit', String(limit));

        const response = await apiFetch(`/api/dashboard/points/?${params.toString()}`);

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudieron cargar los puntos georreferenciados.');
          setData({
            status: 'error',
            count: 0,
            limit,
            points: [],
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardPoints();

    return () => {
      isMounted = false;
    };
  }, [filterKey, enabled, limit]);

  return {
    data,
    loading,
    error,
  };
}
