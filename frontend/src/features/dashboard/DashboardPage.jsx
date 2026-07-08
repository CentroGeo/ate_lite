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

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
      value: formatNumber(summary.total_capacidad, {
        maximumFractionDigits: 2,
      }),
      description: 'MW autorizados',
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
    },
    {
      title: 'Sin georreferencia',
      value: alerts.permisos_sin_georeferencia,
    },
    {
      title: 'Consumo auxiliar 0',
      value: alerts.sin_consumo,
    },
    {
      title: 'Generación bruta/neta 0',
      value: alerts.sin_generacion,
    },
    {
      title: 'Factor de planta',
      value: alerts.factor_planta_mayor_100,
    },
    {
      title: 'Alta variabilidad',
      value: alerts.alta_variabilidad,
    },
  ];

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
              contextLabel={mapSelectionLabel}
            />
          </section>

          <h2 className="section-title">Alertas principales</h2>

          <section className="db-grid">
            {alertCards.map((card) => (
              <article className="db-card" key={card.title}>
                <span className="db-card-title">{card.title}</span>
                <strong className="db-card-value">
                  {formatNumber(card.value)}
                </strong>
                <span className="db-card-desc">id_nivel &gt; 0</span>
              </article>
            ))}
          </section>

          <h2 className="section-title">Alertas por nivel</h2>

          <section className="db-grid">
            {alertsByLevel.map((row) => (
              <article className="db-card" key={row.id_nivel}>
                <span className="db-card-title">{row.descripcion_nivel}</span>
                <strong className="db-card-value">
                  {formatNumber(row.total)}
                </strong>
                <span className="db-card-desc">Nivel {row.id_nivel}</span>
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
                Nivel:{' '}
                <select
                  value={alertLevel}
                  onChange={(event) => setAlertLevel(Number(event.target.value))}
                >
                  <option value={3}>Crítico</option>
                  <option value={2}>Advertencia</option>
                  <option value={1}>Inactivo</option>
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
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Periodo</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Fecha</th>
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
                          {row.anio
                            ? `${row.anio} · ${row.mes_ini || '-'} - ${row.mes_fin || '-'}`
                            : '-'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {formatDate(row.fecha_evaluacion)}
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
