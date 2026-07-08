import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatNumber(value) {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const periodNames = {
  auto: 'Automático',
  month: 'Mensual',
  quarter: 'Trimestral',
  semester: 'Semestral',
  year: 'Anual',
};

export default function GenerationTimeseriesChart({ data, loading, error }) {
  const series = data?.series || [];

  return (
    <section className="db-card chart-card">
      <div className="chart-header">
        <div>
          <span className="db-card-title">Serie temporal</span>
          <h2>Generación y consumo auxiliar</h2>
        </div>

        <span className="chart-period-pill">
          {periodNames[data?.effective_period] || data?.effective_period}
        </span>
      </div>

      {data?.warning && (
        <div className="chart-warning">
          {data.warning}
        </div>
      )}

      {loading && (
        <p>Cargando serie temporal...</p>
      )}

      {error && (
        <p style={{ color: '#9D2148' }}>{error}</p>
      )}

      {!loading && !error && series.length === 0 && (
        <p>No hay datos para la combinación de filtros seleccionada.</p>
      )}

      {!loading && !error && series.length > 0 && (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart
              data={series}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period_label"
                minTickGap={24}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={formatNumber}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${formatNumber(value)} GWh`,
                  name,
                ]}
                labelFormatter={(label) => `Periodo: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="generacion_bruta"
                name="Generación bruta"
                stroke="#7a244f"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="generacion_neta"
                name="Generación neta"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="consumo_auxiliar"
                name="Consumo auxiliar"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
