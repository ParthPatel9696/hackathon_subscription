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
  assert.equal(line.taxMinor, 13260);
  assert.equal(line.totalMinor, 145860);
  assert.equal(fromMinor(line.totalMinor), 1458.6);
  assert.equal(toMinor(10.99), 1099);
});

test('decimal rupee inputs are parsed as strings before conversion to paise', () => {
  assert.equal(toMinor('1250.50'), 125050);
  assert.equal(toMinor('1.005'), 101);
  assert.equal(toMinor('-0.005'), -1);
  assert.throws(() => toMinor('1e3'), /decimal amount/);
});

test('billing dates advance according to cadence', () => {
  const date = new Date('2026-01-15T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'daily').toISOString(), '2026-01-16T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'weekly').toISOString(), '2026-01-22T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'monthly').toISOString(), '2026-02-15T00:00:00.000Z');
  assert.equal(advanceBillingDate(date, 'yearly').toISOString(), '2027-01-15T00:00:00.000Z');
});

test('monthly billing clamps month ends without drifting into the following month', () => {
  assert.equal(advanceBillingDate(new Date('2025-01-31T12:30:00.000Z'), 'monthly').toISOString(), '2025-02-28T12:30:00.000Z');
  assert.equal(advanceBillingDate(new Date('2024-01-31T12:30:00.000Z'), 'monthly').toISOString(), '2024-02-29T12:30:00.000Z');
});

test('yearly billing clamps leap day and rejects unknown cadences', () => {
  assert.equal(advanceBillingDate(new Date('2024-02-29T00:00:00.000Z'), 'yearly').toISOString(), '2025-02-28T00:00:00.000Z');
  assert.throws(() => advanceBillingDate(new Date(), 'quarterly'), /Unsupported billing frequency/);
});

test('MRR normalizes net recurring value and excludes tax', () => {
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'monthly', subtotalMinor: 10000, discountMinor: 1000 }), 9000);
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'yearly', subtotalMinor: 120000, discountMinor: 12000 }), 9000);
  assert.equal(normalizeMonthlyMinor({ billingFrequency: 'weekly', subtotalMinor: 10000 }), 43333);
});
