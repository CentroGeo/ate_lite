import { useEffect, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';

export default function useDashboardAlerts({ source = 'all', level = 3, limit = 10 }) {
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

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardAlerts() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          source,
          level: String(level),
          limit: String(limit),
        });

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
  }, [source, level, limit]);

  return {
    data,
    loading,
    error,
  };
}
