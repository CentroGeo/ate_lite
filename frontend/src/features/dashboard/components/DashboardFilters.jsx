import React, { useMemo, useState } from 'react';
import useDashboardOptions from '../hooks/useDashboardOptions';

const DEFAULT_FILTERS = {
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
};

function getSelectedValues(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function normalizeFilters(filters = {}) {
  return {
    ...DEFAULT_FILTERS,
    ...filters,
    alertLevels: filters.alertLevels || [],
    alertTypes: filters.alertTypes || [],
    estados: filters.estados || [],
    municipios: filters.municipios || [],
    modalidades: filters.modalidades || [],
    tecnologias: filters.tecnologias || [],
    permisos: filters.permisos || [],
    permisionarios: filters.permisionarios || [],
  };
}

function toggleValue(values, value) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}

function FilterChip({ label, onRemove }) {
  return (
    <button className="filter-chip" type="button" onClick={onRemove}>
      {label} <span aria-hidden="true">×</span>
    </button>
  );
}

export default function DashboardFilters({ filters, onApply, onClear }) {
  const { data: options, loading, error } = useDashboardOptions();
  const [draft, setDraft] = useState(() => normalizeFilters(filters));
  const [isOpen, setIsOpen] = useState(false);

  const activeChips = useMemo(() => {
    const chips = [];

    if (draft.startYear || draft.endYear) {
      chips.push({
        key: 'years',
        label: `${draft.startYear || 'Inicio'}–${draft.endYear || 'Fin'}`,
        remove: () => setDraft((current) => ({
          ...current,
          startYear: '',
          endYear: '',
        })),
      });
    }

    if (draft.tipoPeriodo) {
      chips.push({
        key: 'tipoPeriodo',
        label: draft.tipoPeriodo,
        remove: () => setDraft((current) => ({ ...current, tipoPeriodo: '' })),
      });
    }

    if (draft.outputPeriod !== 'auto') {
      chips.push({
        key: 'outputPeriod',
        label: `Agrupar: ${draft.outputPeriod}`,
        remove: () => setDraft((current) => ({ ...current, outputPeriod: 'auto' })),
      });
    }

    const addMultiChips = (key, label, values) => {
      values.forEach((value) => {
        chips.push({
          key: `${key}-${value}`,
          label: `${label}: ${value}`,
          remove: () => setDraft((current) => ({
            ...current,
            [key]: current[key].filter((item) => item !== value),
          })),
        });
      });
    };

    addMultiChips('alertLevels', 'Nivel', draft.alertLevels);
    addMultiChips('alertTypes', 'Alerta', draft.alertTypes);
    addMultiChips('estados', 'Estado', draft.estados);
    addMultiChips('municipios', 'Municipio', draft.municipios);
    addMultiChips('modalidades', 'Modalidad', draft.modalidades);
    addMultiChips('tecnologias', 'Tecnología', draft.tecnologias);
    addMultiChips('permisos', 'Permiso', draft.permisos);
    addMultiChips('permisionarios', 'Permisionario', draft.permisionarios);

    return chips;
  }, [draft]);

  function updateField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFilters() {
    const cleanFilters = normalizeFilters();
    setDraft(cleanFilters);
    onClear(cleanFilters);
  }

  function applyFilters() {
    onApply(draft);
    setIsOpen(false);
  }

  const selectedEstadoSet = new Set(draft.estados);

  const municipiosVisibles = draft.estados.length === 0
    ? options.municipios
    : options.municipios.filter((municipio) => selectedEstadoSet.has(municipio.estado_id));

  return (
    <section className="filters-shell">
      <div className="filters-toolbar">
        <button
          className="filters-toggle"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          ☰ Filtros
        </button>

        <button
          className="filters-secondary"
          type="button"
          onClick={clearFilters}
        >
          Limpiar
        </button>

        <div className="filters-chips">
          {activeChips.length === 0 && (
            <span className="filters-empty">Sin filtros activos</span>
          )}

          {activeChips.slice(0, 8).map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.remove}
            />
          ))}

          {activeChips.length > 8 && (
            <span className="filters-empty">
              +{activeChips.length - 8} más
            </span>
          )}
        </div>
      </div>

      {isOpen && (
        <aside className="filters-panel">
          <div className="filters-panel-header">
            <div>
              <h2>Filtros del dashboard</h2>
              <p>
                Estos filtros quedarán conectados a KPIs, gráfica, mapa y reporte.
              </p>
            </div>

            <button
              className="filters-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar filtros"
            >
              ×
            </button>
          </div>

          {loading && <p>Cargando catálogos...</p>}
          {error && <p className="filters-error">{error}</p>}

          {!loading && !error && (
            <>
              <div className="filters-grid">
                <fieldset className="filter-group">
                  <legend>Tiempo</legend>

                  <label>
                    Año inicial
                    <select
                      value={draft.startYear}
                      onChange={(event) => updateField('startYear', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {Array.from(
                        {
                          length: (options.years.max || 0) - (options.years.min || 0) + 1,
                        },
                        (_, index) => (options.years.min || 0) + index
                      ).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Año final
                    <select
                      value={draft.endYear}
                      onChange={(event) => updateField('endYear', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {Array.from(
                        {
                          length: (options.years.max || 0) - (options.years.min || 0) + 1,
                        },
                        (_, index) => (options.years.min || 0) + index
                      ).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    TipoPeriodo
                    <select
                      value={draft.tipoPeriodo}
                      onChange={(event) => updateField('tipoPeriodo', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {options.tipo_periodo.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label} ({item.total})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Agrupar reporte/gráfica
                    <select
                      value={draft.outputPeriod}
                      onChange={(event) => updateField('outputPeriod', event.target.value)}
                    >
                      <option value="auto">Automático</option>
                      <option value="month">Mes</option>
                      <option value="quarter">Trimestre</option>
                      <option value="semester">Semestre</option>
                      <option value="year">Año</option>
                    </select>
                  </label>
                </fieldset>

                <fieldset className="filter-group">
                  <legend>Ubicación</legend>

                  <label>
                    Estados
                    <select
                      multiple
                      value={draft.estados}
                      onChange={(event) => updateField('estados', getSelectedValues(event))}
                    >
                      {options.estados.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre} ({item.total_permisos})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Municipios
                    <select
                      multiple
                      value={draft.municipios}
                      onChange={(event) => updateField('municipios', getSelectedValues(event))}
                    >
                      {municipiosVisibles.map((item) => (
                        <option key={`${item.estado_id}-${item.id}`} value={`${item.estado_id}${item.id}`}>
                          {item.nombre} ({item.total_permisos})
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="filter-group">
                  <legend>Alertas</legend>

                  <div className="checkbox-list">
                    {options.alert_levels
                      .filter((item) => item.id_nivel > 0)
                      .map((item) => (
                        <label key={item.id_nivel} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={draft.alertLevels.includes(String(item.id_nivel))}
                            onChange={() => updateField(
                              'alertLevels',
                              toggleValue(draft.alertLevels, String(item.id_nivel))
                            )}
                          />
                          {item.descripcion_nivel}
                        </label>
                      ))}
                  </div>

                  <label>
                    Tipo de alerta
                    <select
                      multiple
                      value={draft.alertTypes}
                      onChange={(event) => updateField('alertTypes', getSelectedValues(event))}
                    >
                      {options.alert_types.map((item) => (
                        <option key={item.id_alerta} value={String(item.id_alerta)}>
                          {item.id_alerta}. {item.nombre_alerta}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="filter-group">
                  <legend>Características</legend>

                  <label>
                    Modalidad
                    <select
                      multiple
                      value={draft.modalidades}
                      onChange={(event) => updateField('modalidades', getSelectedValues(event))}
                    >
                      {options.modalidades.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label} ({item.total})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Tecnología
                    <select
                      multiple
                      value={draft.tecnologias}
                      onChange={(event) => updateField('tecnologias', getSelectedValues(event))}
                    >
                      {options.tecnologias.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label} ({item.total})
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="filter-group wide">
                  <legend>Permiso y permisionario</legend>

                  <label>
                    Permisos
                    <select
                      multiple
                      value={draft.permisos}
                      onChange={(event) => updateField('permisos', getSelectedValues(event))}
                    >
                      {options.permisos.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Permisionarios
                    <select
                      multiple
                      value={draft.permisionarios}
                      onChange={(event) => updateField('permisionarios', getSelectedValues(event))}
                    >
                      {options.permisionarios.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              </div>

              <div className="filters-actions">
                <button
                  className="filters-secondary"
                  type="button"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </button>

                <button
                  className="filters-apply"
                  type="button"
                  onClick={applyFilters}
                >
                  Aplicar filtros
                </button>
              </div>
            </>
          )}
        </aside>
      )}
    </section>
  );
}
