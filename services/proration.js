// Billing periods are half-open UTC intervals [start, end). The effective instant
// is clamped to the period and eligible time is [effective, end). Paise are
// rounded to the nearest integer, with exact halves away from zero.
function calculateProrationMinor({ oldRecurringMinor, newRecurringMinor, periodStart, periodEnd, effectiveAt }) {
  for (const [name, value] of Object.entries({ oldRecurringMinor, newRecurringMinor })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer number of paise.`);
  }
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const effective = new Date(effectiveAt).getTime();
  if (![start, end, effective].every(Number.isFinite) || end <= start) throw new TypeError('Proration requires a valid, non-empty billing period and effective date.');
  const eligible = Math.max(0, end - Math.max(start, Math.min(end, effective)));
  const total = end - start;
  const delta = BigInt(newRecurringMinor - oldRecurringMinor);
  const numerator = delta * BigInt(eligible);
  const denominator = BigInt(total);
  const abs = numerator < 0n ? -numerator : numerator;
  const rounded = (abs + denominator / 2n) / denominator;
  const signed = numerator < 0n ? -rounded : rounded;
  const result = Number(signed);
  if (!Number.isSafeInteger(result)) throw new TypeError('Proration adjustment exceeds the supported precision range.');
  return result;
}

module.exports = { calculateProrationMinor };
