import React from 'react';
import useDashboardSummary from './hooks/useDashboardSummary';

function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return new Intl.NumberFormat('es-MX', options).format(value);
}

export default function DashboardPage() {
  const { data, loading, error } = useDashboardSummary();

  const summary = data?.summary || {};
  const alerts = data?.alerts || {};

  const summaryCards = [
    {
      title: 'Permisos',
      value: formatNumber(summary.total_permisos),
      description: `${formatNumber(summary.total_vigentes)} vigentes`,
    },
    {
      title: 'Generación anual',
      value: formatNumber(summary.generacion_anual, {
        maximumFractionDigits: 2,
      }),
      description: 'Neta / GWh',
    },
    {
      title: 'Inversión estimada',
      value: `$${formatNumber(summary.inversion_estimada, {
        maximumFractionDigits: 2,
      })}`,
      description: 'Millones de dólares',
    },
    {
      title: 'Permisionarios',
      value: formatNumber(summary.total_permisionarios),
      description: `${formatNumber(summary.total_permisionarios_vigentes)} vigentes`,
    },
    {
      title: 'Empresas',
      value: formatNumber(summary.total_empresas),
      description: `${formatNumber(summary.total_empresas_vigentes)} vigentes`,
    },
    {
      title: 'Alertas',
      value: formatNumber(
        Object.values(alerts).reduce((total, value) => total + Number(value || 0), 0)
      ),
      description: 'Registros por revisar',
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
      title: 'Consumo cero',
      value: alerts.sin_consumo,
    },
    {
      title: 'Generación cero',
      value: alerts.sin_generacion,
    },
    {
      title: 'F. planta > 100',
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
              <article className="db-card" key={card.title}>
                <span className="db-card-title">{card.title}</span>
                <strong className="db-card-value">{card.value}</strong>
                <span className="db-card-desc">{card.description}</span>
              </article>
            ))}
          </section>

          <h2 className="section-title">Alertas</h2>

          <section className="db-grid">
            {alertCards.map((card) => (
              <article className="db-card" key={card.title}>
                <span className="db-card-title">{card.title}</span>
                <strong className="db-card-value">
                  {formatNumber(card.value)}
                </strong>
                <span className="db-card-desc">Click futuro para filtrar</span>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
