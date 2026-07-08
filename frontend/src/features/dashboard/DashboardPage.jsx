import React from 'react';

const summaryCards = [
  {
    title: 'Permisos',
    value: '-',
    description: 'Total de permisos registrados',
  },
  {
    title: 'Permisionarios',
    value: '-',
    description: 'Personas físicas o morales',
  },
  {
    title: 'Empresas',
    value: '-',
    description: 'Empresas relacionadas',
  },
  {
    title: 'Alertas',
    value: '-',
    description: 'Registros por revisar',
  },
];

export default function DashboardPage() {
  return (
    <main className="dashboard-content">
      <h1 className="section-title">
        Dashboard de Generación de Energía Eléctrica
      </h1>

      <section className="db-grid">
        {summaryCards.map((card) => (
          <article className="db-card" key={card.title}>
            <span className="db-card-title">{card.title}</span>
            <strong className="db-card-value">{card.value}</strong>
            <span className="db-card-desc">{card.description}</span>
          </article>
        ))}
      </section>

      <section className="db-card">
        <span className="db-card-title">Siguiente paso</span>
        <p style={{ marginTop: '0.75rem' }}>
          Esta página ya está montada en React. Después conectaremos estos
          valores a un endpoint de Django que regresará JSON en vez de scripts PHP.
        </p>
      </section>
    </main>
  );
}
