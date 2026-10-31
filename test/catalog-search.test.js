const test = require('node:test');
const assert = require('node:assert/strict');
const { isDateRangeValid } = require('../controllers/catalogController');
const { escapeRegex } = require('../controllers/searchController');

test('plan availability accepts ordered and open-ended dates', () => {
  assert.equal(isDateRangeValid('2026-01-01', '2026-01-01'), true);
  assert.equal(isDateRangeValid('2026-01-01', '2026-02-01'), true);
  assert.equal(isDateRangeValid('2026-02-01', undefined), true);
  assert.equal(isDateRangeValid('2026-02-01', '2026-01-31'), false);
});

test('global search escapes regex operators in user input', () => {
  const query = 'ACME (west)+ [ops].*';
  const escaped = escapeRegex(query);
  assert.equal(new RegExp(escaped).test(query), true);
  assert.equal(new RegExp(escaped).test('ACME west ops'), false);
});
