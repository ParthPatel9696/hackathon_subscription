const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCurrency, invoiceOutstandingMinor, toMinor } = require('../utils/money');

test('INR output retains Indian digit grouping and explicit PDF-safe currency', () => {
  assert.equal(formatCurrency(1250000), '₹12,50,000.00');
  assert.equal(formatCurrency(1250000, { code: true }), 'INR 12,50,000.00');
});

test('invoice balance uses paise snapshots and excludes non-payable documents', async () => {
  const { invoiceOutstanding, toMinorUnits } = await import('../client/src/utils/locale.js');
  const invoice = { status: 'Confirmed', grandTotalMinor: 10010, paidAmountMinor: 3005, grandTotal: 999, paidAmount: 0 };
  assert.equal(invoiceOutstandingMinor(invoice), 7005);
  assert.equal(invoiceOutstanding(invoice), 70.05);
  assert.equal(invoiceOutstandingMinor({ ...invoice, status: 'Cancelled' }), 0);
  assert.equal(invoiceOutstanding({ ...invoice, status: 'Draft' }), 0);
  for (const value of ['0.005', '1.005', '1250000.10', '-0.015']) assert.equal(toMinorUnits(value), toMinor(value));
  assert.equal(invoiceOutstandingMinor({ status: 'Confirmed', grandTotal: '100.10', paidAmount: '30.05' }), 7005);
});
