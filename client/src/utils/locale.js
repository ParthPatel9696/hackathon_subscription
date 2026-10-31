export const BUSINESS_LOCALE = 'en-IN';
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
export const BUSINESS_CURRENCY = 'INR';

export function formatCurrency(amount) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(BUSINESS_LOCALE, {
    style: 'currency', currency: BUSINESS_CURRENCY,
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: BUSINESS_TIME_ZONE
  }).format(date);
}

export function toMinorUnits(amount) {
  const text = String(amount ?? '0').trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new TypeError('Enter a valid monetary amount.');
  const sign = match[1] === '-' ? -1n : 1n;
  const fraction = match[3] || '';
  let minor = BigInt(match[2]) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (fraction.length > 2 && Number(fraction[2]) >= 5) minor += 1n;
  const result = Number(sign * minor);
  if (!Number.isSafeInteger(result)) throw new TypeError('Amount exceeds supported precision.');
  return result;
}
