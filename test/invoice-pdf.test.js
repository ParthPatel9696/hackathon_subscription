const test = require('node:test');
const assert = require('node:assert/strict');
const { renderInvoicePdf } = require('../services/invoicePdf');

test('invoice PDF supports large amounts and paginated line snapshots without mutating them', async () => {
  const invoice = { invoiceNumber: 'PDF-REVIEW-1', subscriptionNumber: 'SUB-1', customerName: 'Review Company', customerEmail: 'review@example.test', invoiceDate: new Date('2026-10-31'), dueDate: new Date('2026-11-30'), status: 'Confirmed', subtotal: 1250000, taxTotal: 0, grandTotal: 1250000, grandTotalMinor: 125000000, paidAmount: 500, paidAmountMinor: 50000, lines: Array.from({ length: 85 }, (_, index) => ({ productName: `Line ${index + 1} - snapshotted subscription product`, quantity: 1, unitPrice: 1250000, taxRate: 0, total: 1250000 })) };
  const before = JSON.stringify(invoice);
  const pdf = await renderInvoicePdf(invoice);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
  assert.equal(JSON.stringify(invoice), before);
});
