function normalizePaymentTerms(value) {
  const terms = String(value || 'Net 30 Days').trim();
  if (/^due on receipt$/i.test(terms)) return 'Due on Receipt';
  const match = /^net\s+(\d{1,3})\s+days$/i.exec(terms);
  const days = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new TypeError('Payment terms must be Due on Receipt or Net 0 to 365 Days.');
  return `Net ${days} Days`;
}

function paymentTermsDays(value) {
  const terms = normalizePaymentTerms(value);
  if (terms === 'Due on Receipt') return 0;
  return Number(/^Net (\d+) Days$/.exec(terms)[1]);
}

module.exports = { normalizePaymentTerms, paymentTermsDays };
