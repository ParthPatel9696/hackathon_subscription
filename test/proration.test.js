const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateProrationMinor } = require('../services/proration');

const start = new Date('2026-01-01T00:00:00.000Z');
const end = new Date('2026-02-01T00:00:00.000Z');

test('proration uses half-open UTC period and rounds to nearest paise', () => {
  assert.equal(calculateProrationMinor({ oldRecurringMinor: 10000, newRecurringMinor: 20000, periodStart: start, periodEnd: end, effectiveAt: new Date('2026-01-17T12:00:00.000Z') }), 4677);
});
test('proration clamps effective dates to period boundaries', () => {
  assert.equal(calculateProrationMinor({ oldRecurringMinor: 20000, newRecurringMinor: 10000, periodStart: start, periodEnd: end, effectiveAt: new Date('2025-12-01T00:00:00Z') }), -10000);
  assert.equal(calculateProrationMinor({ oldRecurringMinor: 20000, newRecurringMinor: 10000, periodStart: start, periodEnd: end, effectiveAt: end }), 0);
});
test('invalid periods and monetary values are rejected', () => {
  assert.throws(() => calculateProrationMinor({ oldRecurringMinor: 10.5, newRecurringMinor: 20, periodStart: start, periodEnd: end, effectiveAt: start }), /integer/);
  assert.throws(() => calculateProrationMinor({ oldRecurringMinor: 10, newRecurringMinor: 20, periodStart: end, periodEnd: start, effectiveAt: start }), /period/);
});
