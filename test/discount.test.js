const test = require('node:test');
const assert = require('node:assert/strict');
const { DiscountError, assertDiscountAvailable, calculateDiscountMinor } = require('../services/discountService');

const activeDiscount = (overrides = {}) => ({
  isActive: true,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T23:59:59.999Z'),
  timesUsed: 0,
  usageLimit: 3,
  discountType: 'percentage',
  value: 10,
  minPurchaseAmount: 0,
  ...overrides
});

test('discount service calculates percentage and capped fixed discounts in minor units', () => {
  assert.equal(calculateDiscountMinor(activeDiscount(), 12345), 1235);
  assert.equal(calculateDiscountMinor(activeDiscount({ discountType: 'fixed', value: 500 }), 12345), 12345);
  assert.equal(calculateDiscountMinor(activeDiscount({ discountType: 'fixed', value: 500 }), 1234), 1234);
});

test('discount minimum purchase, date, active status, and usage limit are enforced', () => {
  assert.throws(() => calculateDiscountMinor(activeDiscount({ minPurchaseAmount: 200 }), 19999), DiscountError);
  assert.throws(() => assertDiscountAvailable(activeDiscount({ isActive: false }), new Date('2026-06-01')), /inactive/);
  assert.throws(() => assertDiscountAvailable(activeDiscount(), new Date('2027-01-01')), /expired/);
  assert.throws(() => assertDiscountAvailable(activeDiscount({ timesUsed: 3 }), new Date('2026-06-01')), /usage limit/);
});

test('discount percentage cannot exceed one hundred percent', () => {
  assert.throws(() => calculateDiscountMinor(activeDiscount({ value: 101 }), 10000), /configuration is invalid/);
});
