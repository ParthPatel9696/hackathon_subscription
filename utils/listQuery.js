function sortFromQuery(value, fieldMap, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const sort = {};
  for (const pair of value.split(',').slice(0, 3)) {
    const [key, direction] = pair.split(':');
    const field = fieldMap[key];
    if (field && (direction === 'asc' || direction === 'desc')) sort[field] = direction === 'asc' ? 1 : -1;
  }
  return Object.keys(sort).length ? sort : fallback;
}

function applyNumericRange(query, field, minValue, maxValue) {
  const min = minValue === undefined || minValue === '' ? undefined : Number(minValue);
  const max = maxValue === undefined || maxValue === '' ? undefined : Number(maxValue);
  if (min !== undefined && Number.isFinite(min) || max !== undefined && Number.isFinite(max)) {
    query[field] = {};
    if (Number.isFinite(min)) query[field].$gte = min;
    if (Number.isFinite(max)) query[field].$lte = max;
  }
}

function applyDateRange(query, field, start, end) {
  const businessMidnight = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) - 330 * 60000);
  };
  const from = start ? businessMidnight(start) : null; const to = end ? businessMidnight(end) : null;
  if (from && !Number.isFinite(from.getTime()) || to && !Number.isFinite(to.getTime())) return false;
  if (from || to) { query[field] = {}; if (from) query[field].$gte = from; if (to) query[field].$lte = new Date(to.getTime() + 86400000 - 1); }
  return true;
}

module.exports = { sortFromQuery, applyNumericRange, applyDateRange };
