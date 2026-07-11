import React, { useEffect, useMemo, useState } from 'react';
import useDashboardOptions from '../hooks/useDashboardOptions';

const DEFAULT_FILTERS = {
  startYear: '',
  endYear: '',
  tipoPeriodo: '',
  outputPeriod: 'auto',
  alertLevels: [],
  alertTypes: [],
  recentConsumptionAlerts: false,
  recentConsumptionAlertMonths: 6,
  estados: [],
  municipios: [],
  gerencias: [],
  modalidades: [],
  tecnologias: [],
  permisos: [],
  permisionarios: [],
};

const OUTPUT_PERIOD_LABELS = {
  auto: 'Automático',
  month: 'Mensual',
  quarter: 'Trimestral',
  semester: 'Semestral',
  year: 'Anual',
};

function getSelectedValues(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function clampRecentAlertMonths(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 6;
  }

  return Math.min(24, Math.max(1, Math.round(parsed)));
}

function formatRecentAlertRange(value) {
  const months = clampRecentAlertMonths(value);

  return months === 1
    ? 'último mes'
    : `últimos ${months} meses`;
}

function normalizeFilters(filters = {}) {
  return {
    ...DEFAULT_FILTERS,
    ...filters,
    alertLevels: filters.alertLevels || [],
    alertTypes: filters.alertTypes || [],
    recentConsumptionAlerts: Boolean(filters.recentConsumptionAlerts),
    recentConsumptionAlertMonths: clampRecentAlertMonths(filters.recentConsumptionAlertMonths),
    estados: filters.estados || [],
    municipios: filters.municipios || [],
    gerencias: filters.gerencias || [],
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
  const [isRecentAlertsOpen, setIsRecentAlertsOpen] = useState(false);

  const externalFiltersKey = useMemo(
    () => JSON.stringify(normalizeFilters(filters)),
    [filters]
  );

  const appliedFilters = useMemo(
    () => normalizeFilters(filters),
    [externalFiltersKey]
  );

  useEffect(() => {
    setDraft(normalizeFilters(filters));
  }, [externalFiltersKey]);

  const chipLookups = useMemo(() => {
    const estadoNames = new Map(
      options.estados.map((item) => [String(item.id), item.nombre])
    );

    return {
      alertLevels: new Map(
        options.alert_levels.map((item) => [
          String(item.id_nivel),
          item.descripcion_nivel,
        ])
      ),
      alertTypes: new Map(
        options.alert_types.map((item) => [
          String(item.id_alerta),
          item.nombre_alerta,
        ])
      ),
      estados: estadoNames,
      municipios: new Map(
        options.municipios.map((item) => [
          `${item.estado_id}${item.id}`,
          `${item.nombre}${estadoNames.get(String(item.estado_id)) ? `, ${estadoNames.get(String(item.estado_id))}` : ''}`,
        ])
      ),
      gerencias: new Map(
        (options.gerencias || []).map((item) => [
          String(item.id),
          item.nombre,
        ])
      ),
      modalidades: new Map(
        options.modalidades.map((item) => [String(item.value), item.label])
      ),
      tecnologias: new Map(
        options.tecnologias.map((item) => [String(item.value), item.label])
      ),
      permisos: new Map(
        options.permisos.map((item) => [String(item.value), item.label])
      ),
      permisionarios: new Map(
        options.permisionarios.map((item) => [String(item.value), item.label])
      ),
    };
  }, [options]);

  function getChipValueLabel(key, value) {
    return chipLookups[key]?.get(String(value)) || value;
  }

  const validationErrors = useMemo(() => {
    const errors = [];

    if (
      draft.startYear
      && draft.endYear
      && Number(draft.startYear) > Number(draft.endYear)
    ) {
      errors.push('El año inicial no puede ser mayor que el año final.');
    }

    if (
      draft.recentConsumptionAlerts
      && (
        draft.recentConsumptionAlertMonths < 1
        || draft.recentConsumptionAlertMonths > 24
      )
    ) {
      errors.push('El rango de alertas recientes debe estar entre 1 y 24 meses.');
    }

    return errors;
  }, [
    draft.startYear,
    draft.endYear,
    draft.recentConsumptionAlerts,
    draft.recentConsumptionAlertMonths,
  ]);

  function applyDraftPatch(patch) {
    setDraft((current) => {
      const next = normalizeFilters({
        ...current,
        ...patch,
      });

      onApply(next);

      return next;
    });
  }

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
        remove: () => applyDraftPatch({ tipoPeriodo: '' }),
      });
    }

    if (draft.outputPeriod !== 'auto') {
      chips.push({
        key: 'outputPeriod',
        label: `Agrupar: ${OUTPUT_PERIOD_LABELS[draft.outputPeriod] || draft.outputPeriod}`,
        remove: () => applyDraftPatch({ outputPeriod: 'auto' }),
      });
    }

    if (appliedFilters.recentConsumptionAlerts) {
      chips.push({
        key: 'recentConsumptionAlerts',
        label: `Alertas consumo: ${formatRecentAlertRange(appliedFilters.recentConsumptionAlertMonths)}`,
        remove: () => applyDraftPatch({ recentConsumptionAlerts: false }),
      });
    }

    const addMultiChips = (key, label, values) => {
      values.forEach((value) => {
        chips.push({
          key: `${key}-${value}`,
          label: `${label}: ${getChipValueLabel(key, value)}`,
          remove: () => applyDraftPatch({
            [key]: draft[key].filter((item) => item !== value),
          }),
        });
      });
    };

    addMultiChips('alertLevels', 'Nivel', draft.alertLevels);
    addMultiChips('alertTypes', 'Alerta', draft.alertTypes);
    addMultiChips('estados', 'Estado', draft.estados);
    addMultiChips('municipios', 'Municipio', draft.municipios);
    addMultiChips('gerencias', 'Gerencia', draft.gerencias);
    addMultiChips('modalidades', 'Modalidad', draft.modalidades);
    addMultiChips('tecnologias', 'Tecnología', draft.tecnologias);
    addMultiChips('permisos', 'Permiso', draft.permisos);
    addMultiChips('permisionarios', 'Permisionario', draft.permisionarios);

    return chips;
  }, [draft, chipLookups, appliedFilters]);

  function updateField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateLocationField(field, value) {
    setDraft((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === 'gerencias') {
        next.estados = [];
        next.municipios = [];
      }

      if (field === 'estados' || field === 'municipios') {
        next.gerencias = [];
      }

      return next;
    });
  }

  function clearFilters() {
    const cleanFilters = normalizeFilters();
    setDraft(cleanFilters);
    onClear(cleanFilters);
  }

  function applyFilters() {
    if (validationErrors.length > 0) {
      return;
    }

    onApply(draft);
    setIsOpen(false);
  }

  function applyRecentAlertsFilter() {
    const next = normalizeFilters({
      ...draft,
      recentConsumptionAlerts: true,
      recentConsumptionAlertMonths: clampRecentAlertMonths(
        draft.recentConsumptionAlertMonths
      ),
    });

    setDraft(next);
    onApply(next);
    setIsRecentAlertsOpen(false);
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
          className={`filters-special ${appliedFilters.recentConsumptionAlerts ? 'is-active' : ''}`}
          type="button"
          onClick={() => setIsRecentAlertsOpen((current) => !current)}
        >
          Alertas recientes
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

      {isRecentAlertsOpen && (
        <div className="recent-alerts-panel">
          <div>
            <strong>Alertas recientes de consumo</strong>
            <p>
              Filtra permisos con alertas de consumo en advertencia o crítico dentro del rango seleccionado.
            </p>
          </div>

          <label className="recent-alerts-range">
            <span>
              <strong>{formatRecentAlertRange(draft.recentConsumptionAlertMonths)}</strong>
            </span>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={draft.recentConsumptionAlertMonths}
              onChange={(event) => updateField(
                'recentConsumptionAlertMonths',
                clampRecentAlertMonths(event.target.value)
              )}
            />
          </label>

          <div className="recent-alerts-actions">
            <button
              className="filters-secondary"
              type="button"
              onClick={() => {
                updateField('recentConsumptionAlerts', false);
                onApply(normalizeFilters({
                  ...draft,
                  recentConsumptionAlerts: false,
                }));
                setIsRecentAlertsOpen(false);
              }}
            >
              Quitar
            </button>

            <button
              className="filters-apply"
              type="button"
              onClick={applyRecentAlertsFilter}
              disabled={validationErrors.length > 0}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

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
              {validationErrors.length > 0 && (
                <div className="filters-validation">
                  {validationErrors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}

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
                      onChange={(event) => updateLocationField('estados', getSelectedValues(event))}
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
                      onChange={(event) => updateLocationField('municipios', getSelectedValues(event))}
                    >
                      {municipiosVisibles.map((item) => (
                        <option key={`${item.estado_id}-${item.id}`} value={`${item.estado_id}${item.id}`}>
                          {item.nombre} ({item.total_permisos})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Gerencias regionales
                    <select
                      multiple
                      value={draft.gerencias}
                      onChange={(event) => updateLocationField('gerencias', getSelectedValues(event))}
                    >
                      {(options.gerencias || []).map((item) => (
                        <option key={item.id} value={String(item.id)}>
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
                  disabled={validationErrors.length > 0}
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
