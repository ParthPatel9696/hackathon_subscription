const CURRENCY_SCALE = 100;

const toMinor = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new TypeError('Money value must be a finite number.');
  }

  const minorValue = Math.round(numericValue * CURRENCY_SCALE);
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
  if (!Number.isFinite(normalizedTaxRate) || normalizedTaxRate < 0) {
    throw new TypeError('Tax rate must be a non-negative number.');
  }

  const unitPriceMinor = toMinor(unitPrice);
  const variantPriceExtraMinor = toMinor(variantPriceExtra);
  const discountMinor = toMinor(discountAmount);
  const taxableMinor = (unitPriceMinor + variantPriceExtraMinor) * normalizedQuantity;
  const taxMinor = Math.round(taxableMinor * normalizedTaxRate);
  const totalMinor = taxableMinor + taxMinor - discountMinor;

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
    subtotalMinor: taxableMinor,
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
