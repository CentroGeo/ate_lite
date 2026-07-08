import { useEffect, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient';

export default function useDashboardOptions() {
  const [data, setData] = useState({
    years: { min: null, max: null },
    tipo_periodo: [],
    modalidades: [],
    tecnologias: [],
    alert_types: [],
    alert_levels: [],
    estados: [],
    municipios: [],
    permisos: [],
    permisionarios: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardOptions() {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch('/api/dashboard/options/');

        if (isMounted) {
          setData(response);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'No se pudieron cargar los filtros.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
  };
}
