const { test } = require('node:test');
const assert = require('node:assert/strict');
const range = require('../4ca70a9115ceec7a70a3a26e85c32caf492af4f9/search-range.js');
test('chapter selection accepts whole books, individual chapters, and overlapping ranges', () => {
  assert.equal(range.parseChapters(' ', 21), null);
  assert.deepEqual(range.parseChapters('1, 3-5, 4, 8–9', 21), [1, 3, 4, 5, 8, 9]);
  assert.deepEqual(range.parseChapters('1', 1), [1]);
});
test('invalid chapter ranges are rejected rather than broadening the search', () => {
  for (const value of ['0', '22', '4-2', '1,', 'all', '1.5', '1-999999']) {
    assert.throws(() => range.parseChapters(value, 21));
  }
});
test('multiple books retain independent chapter limits', () => {
  const selected = new Map([[42, [4, 7]], [44, null]]);
  assert.equal(range.includes(selected, 42, 4), true);
  assert.equal(range.includes(selected, 42, 5), false);
  assert.equal(range.includes(selected, 44, 16), true);
  assert.equal(range.includes(selected, 43, 4), false);
  assert.equal(range.includes(selected, 42, 0), false);
});
