const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLine, fromMinor, normalizeMonthlyMinor, toMinor } = require('../utils/money');
const { advanceBillingDate } = require('../services/billingService');

test('money calculations use integer minor units', () => {
  const line = calculateLine({
    unitPrice: 1500,
    variantPriceExtra: 60,
    quantity: 1,
    taxRate: 0.1,
    discountAmount: 234
  });

  assert.equal(line.subtotalMinor, 156000);
  assert.equal(line.taxMinor, 15600);
  assert.equal(line.totalMinor, 148200);
  assert.equal(fromMinor(line.totalMinor), 1482);
  assert.equal(toMinor(10.99), 1099);
});

test('billing dates advance according to cadence', () => {
  const date = new Date('2026-01-15T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'daily').toISOString(), '2026-01-16T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'weekly').toISOString(), '2026-01-22T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'monthly').toISOString(), '2026-02-15T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'yearly').toISOString(), '2027-01-15T00:00:00.000Z');
});

test('MRR normalizes net recurring value and excludes tax', () => {
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'monthly', subtotalMinor: 10000, discountMinor: 1000 }), 9000);
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'yearly', subtotalMinor: 120000, discountMinor: 12000 }), 9000);
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'weekly', subtotalMinor: 10000 }), 43333);
});
