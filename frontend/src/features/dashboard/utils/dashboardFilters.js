export function appendDashboardFilters(params, filters = {}) {
  const scalarFields = [
    'startYear',
    'endYear',
    'tipoPeriodo',
    'outputPeriod',
  ];

  const arrayFields = [
    'alertLevels',
    'alertTypes',
    'estados',
    'municipios',
    'modalidades',
    'tecnologias',
    'permisos',
    'permisionarios',
  ];

  scalarFields.forEach((field) => {
    if (filters[field] !== undefined && filters[field] !== null && filters[field] !== '') {
      params.append(field, String(filters[field]));
    }
  });

  arrayFields.forEach((field) => {
    const values = Array.isArray(filters[field]) ? filters[field] : [];

    values.forEach((value) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(field, String(value));
      }
    });
  });

  return params;
}
