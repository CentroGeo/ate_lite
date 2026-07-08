import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';
import { appendDashboardFilters } from '../utils/dashboardFilters';

export default function useDashboardTimeseries(filters = {}) {
  const [data, setData] = useState({
    requested_period: 'auto',
    effective_period: 'quarter',
    warning: null,
    total_records: 0,
    only_monthly: false,
    series: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filterKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardTimeseries() {
      try {
        setLoading(true);
        setError('');

        const params = appendDashboardFilters(new URLSearchParams(), filters);
        const queryString = params.toString();
        const endpoint = queryString
          ? `/api/dashboard/timeseries/?${queryString}`
          : '/api/dashboard/timeseries/';

        const response = await apiFetch(endpoint);

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudo cargar la serie temporal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardTimeseries();

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
