import React, { useState } from 'react';
import DashboardFilters from './components/DashboardFilters';
import GenerationTimeseriesChart from './components/GenerationTimeseriesChart';
import DashboardMap from './components/DashboardMap';
import useDashboardAlerts from './hooks/useDashboardAlerts';
import useDashboardSummary from './hooks/useDashboardSummary';
import useDashboardTimeseries from './hooks/useDashboardTimeseries';

function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return new Intl.NumberFormat('es-MX', options).format(value);
}

function buildChartContextLabel(baseLabel, filters) {
  const permisos = Array.isArray(filters?.permisos)
    ? filters.permisos.filter(Boolean)
    : [];

  if (permisos.length === 0) {
    return baseLabel;
  }

  if (permisos.length === 1) {
    return `${baseLabel} · Permiso: ${permisos[0]}`;
  }

  return `${baseLabel} · ${permisos.length} permisos seleccionados`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatAlertActivation(row) {
  const origin = String(row?.origen || '').toLowerCase();

  if (origin !== 'consumo') {
    return '-';
  }

  if (!row?.anio) {
    return '-';
  }

  if (row.mes_ini) {
    return `${row.mes_ini} ${row.anio}`;
  }

  return String(row.anio);
}

export default function DashboardPage() {
  const [alertSource, setAlertSource] = useState('all');
  const [alertLevel, setAlertLevel] = useState(3);
  const [mapSelectionLabel, setMapSelectionLabel] = useState('Vista nacional');
  const [dashboardFilters, setDashboardFilters] = useState({
    startYear: '',
    endYear: '',
    tipoPeriodo: '',
    outputPeriod: 'auto',
    alertLevels: [],
    alertTypes: [],
    estados: [],
    municipios: [],
    modalidades: [],
    tecnologias: [],
    permisos: [],
    permisionarios: [],
  });


  const chartContextLabel = buildChartContextLabel(
    mapSelectionLabel,
    dashboardFilters
  );

  const {
    data,
    loading,
    error,
    refreshing: summaryRefreshing,
  } = useDashboardSummary(dashboardFilters);

  const {
    data: alertsDetail,
    loading: alertsLoading,
    error: alertsError,
  } = useDashboardAlerts({
    source: alertSource,
    level: alertLevel,
    limit: 10,
    filters: dashboardFilters,
  });

  const {
    data: timeseriesData,
    loading: timeseriesLoading,
    error: timeseriesError,
  } = useDashboardTimeseries(dashboardFilters);

  const summary = data?.summary || {};
  const alerts = data?.alerts || {};
  const alertsByLevel = data?.alerts_by_level || [];
  const topAlerts = data?.top_alerts || [];
  const detailRows = alertsDetail?.alerts || [];

  const summaryCards = [
    {
      title: 'Permisos',
      value: formatNumber(summary.total_permisos),
      description: `${formatNumber(summary.total_vigentes)} vigentes`,
    },
    {
      title: 'Capacidad total',
      value: formatNumber((summary.total_capacidad || 0) / 1000, {
        maximumFractionDigits: 2,
      }),
      description: 'GW autorizados',
    },
    {
      title: 'Generación neta',
      value: formatNumber(summary.generacion_neta, {
        maximumFractionDigits: 2,
      }),
      description: `GWh en ${summary.anio_generacion || '-'}`,
    },
    {
      title: 'Permisionarios',
      value: formatNumber(summary.total_permisionarios),
      description: 'Distintos en permisos',
    },
    {
      title: 'Registros históricos',
      value: formatNumber(summary.registros_consumo),
      description: `${formatNumber(summary.permisos_con_consumo)} permisos con consumo`,
    },
    {
      title: 'Alertas',
      value: formatNumber(alerts.total_alertas),
      description: `${formatNumber(alerts.alertas_criticas)} críticas`,
    },
  ];

  const alertCards = [
    {
      title: 'Sin histórico',
      value: alerts.permisos_sin_historico,
      description: 'Sin trazabilidad histórica',
    },
    {
      title: 'Sin georreferencia',
      value: alerts.permisos_sin_georeferencia,
      description: 'Ubicación pendiente',
    },
    {
      title: 'Consumo auxiliar 0',
      value: alerts.sin_consumo,
      description: 'Revisión operativa',
    },
    {
      title: 'Generación bruta/neta 0',
      value: alerts.sin_generacion,
      description: 'Producción reportada en cero',
    },
    {
      title: 'Factor de planta',
      value: alerts.factor_planta_mayor_100,
      description: 'Valores fuera de rango',
    },
    {
      title: 'Alta variabilidad',
      value: alerts.alta_variabilidad,
      description: 'Cambios atípicos detectados',
    },
  ];

  const alertLevelCards = alertsByLevel.map((row) => ({
    title: Number(row.id_nivel) === 3 ? 'Críticas' : 'Advertencias',
    value: row.total,
    description: Number(row.id_nivel) === 3
      ? 'Atención prioritaria'
      : 'Revisión recomendada',
    level: Number(row.id_nivel),
  }));

  return (
    <main className="dashboard-content">
      <h1 className="section-title">
        Dashboard de Generación de Energía Eléctrica
      </h1>

      <DashboardFilters
        filters={dashboardFilters}
        onApply={setDashboardFilters}
        onClear={setDashboardFilters}
      />

      {loading && (
        <section className="db-card">
          <span className="db-card-title">Cargando</span>
          <p style={{ marginTop: '0.75rem' }}>
            Consultando información del backend...
          </p>
        </section>
      )}

      {error && (
        <section className="db-card">
          <span className="db-card-title">Error</span>
          <p style={{ marginTop: '0.75rem', color: '#9D2148' }}>
            {error}
          </p>
        </section>
      )}

      {!loading && !error && (
        <>
          <section className="db-grid">
            {summaryCards.map((card) => (
              <article
                className={`db-card kpi-card ${summaryRefreshing ? 'is-refreshing' : ''}`}
                key={card.title}
              >
                <div className="kpi-card-topline">
                  <span className="db-card-title">{card.title}</span>
                  {summaryRefreshing && <span className="kpi-refresh-dot" />}
                </div>

                <strong className="db-card-value">{card.value}</strong>
                <span className="db-card-desc">{card.description}</span>

                <div className="kpi-card-accent" />
              </article>
            ))}
          </section>

          <section className="dashboard-map-chart-layout">
            <DashboardMap
              filters={dashboardFilters}
              onApplyFilters={setDashboardFilters}
              onSelectionLabelChange={setMapSelectionLabel}
            />

            <GenerationTimeseriesChart
              data={timeseriesData}
              loading={timeseriesLoading}
              error={timeseriesError}
              contextLabel={chartContextLabel}
            />
          </section>

          <h2 className="section-title alert-section-title">Alertas principales</h2>

          <section className="db-grid">
            {alertCards.map((card) => (
              <article
                className={`db-card kpi-card alert-kpi-card ${summaryRefreshing ? 'is-refreshing' : ''}`}
                key={card.title}
              >
                <div className="kpi-card-topline">
                  <span className="db-card-title">{card.title}</span>
                  {summaryRefreshing && <span className="kpi-refresh-dot" />}
                </div>

                <strong className="db-card-value">
                  {formatNumber(card.value)}
                </strong>
                <span className="db-card-desc">{card.description}</span>

                <div className="kpi-card-accent" />
              </article>
            ))}
          </section>

          <h2 className="section-title alert-section-title">Alertas por severidad</h2>

          <section className="db-grid alert-level-grid">
            {alertLevelCards.map((card) => (
              <article
                className={`db-card kpi-card alert-kpi-card severity-card severity-card-${card.level} ${summaryRefreshing ? 'is-refreshing' : ''}`}
                key={card.level}
              >
                <div className="kpi-card-topline">
                  <span className="db-card-title">{card.title}</span>
                  {summaryRefreshing && <span className="kpi-refresh-dot" />}
                </div>

                <strong className="db-card-value">
                  {formatNumber(card.value)}
                </strong>
                <span className="db-card-desc">{card.description}</span>

                <div className="kpi-card-accent" />
              </article>
            ))}
          </section>

          <h2 className="section-title">Top 10 tipos de alerta</h2>

          <section className="db-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Alerta</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Categoría</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topAlerts.map((row) => (
                    <tr key={row.id_alerta}>
                      <td style={{ padding: '0.5rem' }}>{row.id_alerta}</td>
                      <td style={{ padding: '0.5rem' }}>{row.nombre_alerta}</td>
                      <td style={{ padding: '0.5rem' }}>{row.nivel_categoria}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                        {formatNumber(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <h2 className="section-title">Detalle de alertas</h2>

          <section className="db-card">
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: '1rem',
              }}
            >
              <label>
                Origen:{' '}
                <select
                  value={alertSource}
                  onChange={(event) => setAlertSource(event.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="permiso">Permisos</option>
                  <option value="consumo">Consumos</option>
                </select>
              </label>

              <label>
                Severidad:{' '}
                <select
                  value={alertLevel}
                  onChange={(event) => setAlertLevel(Number(event.target.value))}
                >
                  <option value={3}>Crítico</option>
                  <option value={2}>Advertencia</option>
                </select>
              </label>
            </div>

            {alertsLoading && (
              <p>Cargando detalle de alertas...</p>
            )}

            {alertsError && (
              <p style={{ color: '#9D2148' }}>{alertsError}</p>
            )}

            {!alertsLoading && !alertsError && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Origen</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Permiso</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Alerta</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Mensaje</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Activación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row) => (
                      <tr key={`${row.origen}-${row.id_registro || row.numero_permiso}-${row.id_alerta}-${row.fecha_evaluacion}`}>
                        <td style={{ padding: '0.5rem' }}>{row.origen}</td>
                        <td style={{ padding: '0.5rem' }}>{row.numero_permiso || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.nombre_alerta}</td>
                        <td style={{ padding: '0.5rem' }}>{row.mensaje_especifico}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {formatAlertActivation(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {detailRows.length === 0 && (
                  <p style={{ marginTop: '1rem' }}>
                    No hay alertas con estos filtros.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
