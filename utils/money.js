const CURRENCY_SCALE = 100;

const toMinor = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new TypeError('Money value must be a finite number.');
  }

  return Math.round(numericValue * CURRENCY_SCALE);
};

const fromMinor = (value) => {
  if (!Number.isInteger(value)) {
    throw new TypeError('Minor currency value must be an integer.');
  }

  return value / CURRENCY_SCALE;
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
  calculateLine
};
