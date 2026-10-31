const test = require('node:test');
const assert = require('node:assert/strict');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');

test('list sorting accepts only whitelisted fields and bounded columns', () => {
  assert.deepEqual(sortFromQuery('record:asc,status:desc,amount:asc,secret:desc', { record: 'name', status: 'status', amount: 'amount' }, { createdAt: -1 }), { name: 1, status: -1, amount: 1 });
  assert.deepEqual(sortFromQuery('secret:asc', { record: 'name' }, { createdAt: -1 }), { createdAt: -1 });
});

test('numeric filters preserve zero and ignore empty values', () => {
  const query = {};
  applyNumericRange(query, 'amount', '0', '1250.50');
  assert.deepEqual(query.amount, { $gte: 0, $lte: 1250.5 });
  const empty = {};
  applyNumericRange(empty, 'amount', '', '');
  assert.deepEqual(empty, {});
});

test('date filters cover inclusive Asia/Kolkata business dates and reject invalid dates', () => {
  const query = {};
  assert.equal(applyDateRange(query, 'createdAt', '2026-10-31', '2026-10-31'), true);
  assert.equal(query.createdAt.$gte.toISOString(), '2026-10-30T18:30:00.000Z');
  assert.equal(query.createdAt.$lte.toISOString(), '2026-10-31T18:29:59.999Z');
  assert.equal(applyDateRange({}, 'createdAt', 'not-a-date', ''), false);
});
