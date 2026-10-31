const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePaymentTerms, paymentTermsDays } = require('../utils/paymentTerms');

test('payment terms normalize supported immediate and net day terms', () => {
  assert.equal(normalizePaymentTerms('due on receipt'), 'Due on Receipt');
  assert.equal(normalizePaymentTerms('net 45 days'), 'Net 45 Days');
  assert.equal(paymentTermsDays('Net 60 Days'), 60);
  assert.equal(paymentTermsDays('Due on Receipt'), 0);
});

test('payment terms reject unsupported or out-of-range values', () => {
  for (const value of ['Net 366 Days', 'Net -1 Days', 'Due in 10 days']) {
    assert.throws(() => normalizePaymentTerms(value), TypeError);
  }
});
