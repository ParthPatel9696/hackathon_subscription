const business = require('../config/business');
const CURRENCY_SCALE = business.minorUnitsPerRupee;

const toMinor = (value) => {
  const text = String(value ?? '').trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new TypeError('Money value must be a finite decimal amount.');
  const fraction = match[3] || '';
  let minor = BigInt(match[2]) * BigInt(CURRENCY_SCALE) + BigInt((fraction + '00').slice(0, 2));
  if (fraction.length > 2 && Number(fraction[2]) >= 5) minor += 1n;
  if (match[1] === '-') minor = -minor;
  const minorValue = Number(minor);
  if (!Number.isSafeInteger(minorValue)) {
    throw new TypeError('Money value exceeds the supported precision range.');
  }
  return minorValue;
};

const fromMinor = (value) => {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('Minor currency value must be an integer.');
  }

  return value / CURRENCY_SCALE;
};

const normalizeMonthlyMinor = ({ billingFrequency = 'monthly', subtotalMinor, discountMinor = 0, recurringTotalMinor, taxMinor = 0 }) => {
  const knownSubtotal = Number.isInteger(subtotalMinor) ? subtotalMinor : Number.isInteger(recurringTotalMinor) ? recurringTotalMinor - taxMinor : 0;
  const monthlyBase = Math.max(0, knownSubtotal - (Number.isInteger(discountMinor) ? discountMinor : 0));
  if (billingFrequency === 'yearly') return Math.round(monthlyBase / 12);
  if (billingFrequency === 'weekly') return Math.round(monthlyBase * 52 / 12);
  if (billingFrequency === 'daily') return Math.round(monthlyBase * 365 / 12);
  return monthlyBase;
};

const calculateLine = ({ unitPrice, variantPriceExtra = 0, quantity = 1, taxRate = 0, discountAmount = 0 }) => {
  const normalizedQuantity = Number(quantity);
  const normalizedTaxRate = Number(taxRate);

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    throw new TypeError('Quantity must be a positive integer.');
  }
  if (!Number.isFinite(normalizedTaxRate) || normalizedTaxRate < 0 || normalizedTaxRate > 1) {
    throw new TypeError('Tax rate must be between zero and one.');
  }

  const unitPriceMinor = toMinor(unitPrice);
  const variantPriceExtraMinor = toMinor(variantPriceExtra);
  const discountMinor = toMinor(discountAmount);
  if (unitPriceMinor < 0 || variantPriceExtraMinor < 0 || discountMinor < 0) throw new TypeError('Prices and discounts must be non-negative.');
  const subtotalMinor = (unitPriceMinor + variantPriceExtraMinor) * normalizedQuantity;
  if (!Number.isSafeInteger(subtotalMinor) || discountMinor > subtotalMinor) {
    throw new TypeError('Discount cannot exceed the line subtotal.');
  }
  const taxableMinor = subtotalMinor - discountMinor;
  const taxScale = 100_000_000;
  const taxRateScaled = BigInt(Math.round(normalizedTaxRate * taxScale));
  const taxMinor = Number((BigInt(taxableMinor) * taxRateScaled + BigInt(taxScale / 2)) / BigInt(taxScale));
  const totalMinor = taxableMinor + taxMinor;

  if (![taxableMinor, taxMinor, totalMinor].every(Number.isSafeInteger)) {
    throw new TypeError('Calculated line total exceeds the supported precision range.');
  }
  if (totalMinor < 0) {
    throw new TypeError('Discount cannot exceed the line total.');
  }

  return {
    unitPriceMinor,
    variantPriceExtraMinor,
    quantity: normalizedQuantity,
    taxMinor,
    discountMinor,
    subtotalMinor,
    totalMinor
  };
};

module.exports = {
  CURRENCY_SCALE,
  toMinor,
  fromMinor,
  normalizeMonthlyMinor,
  calculateLine
};
