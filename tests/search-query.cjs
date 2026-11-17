const {test} = require('node:test');
const assert = require('node:assert/strict');
const query = require('../4ca70a9115ceec7a70a3a26e85c32caf492af4f9/search-query.js');
const vm = require('node:vm');
const fs = require('node:fs');
const data = {};
vm.runInNewContext(fs.readFileSync('4ca70a9115ceec7a70a3a26e85c32caf492af4f9/vdata.js', 'utf8'), data);
const reference = value => query.reference(value, data.BkName, data.BkAbbr, data.BkRef, data.BkChNV);
test('query parsing combines phrases, OR branches, and exclusions', () => {
  const parsed = query.parse('"living water" -world OR grace -"works of law"');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0][0].phrase, true);
  assert.equal(parsed[0][1].exclude, true);
  assert.equal(parsed[1][1].text, 'works of law');
  assert.equal(query.regex(parsed[0][0], false, true).test('The LIVING water flows'), true);
  assert.equal(query.regex(parsed[0][0], false, true).test('living running water'), false);
  assert.equal(query.regex(parsed[0][0], true, true).test('Living water'), false);
});
test('invalid queries fail explicitly', () => {
  for (const text of ['', 'OR grace', 'grace OR', '-world', '"living water', 'grace || mercy', '" "']) assert.throws(() => query.parse(text), text);
});
test('references support book names, abbreviations, chapters, and verse ranges', () => {
  assert.deepEqual(reference('John 3:16'), {book:42, chapter:3, first:16, last:16});
  assert.deepEqual(reference('Rom. 8:1–11'), {book:44, chapter:8, first:1, last:11});
  assert.equal(reference('1 John 2:3').book, 61);
  assert.equal(reference('First John 2:3').book, 61);
  assert.equal(reference('John3:16').first, 16);
  assert.equal(reference('Psalm 3:1').book, 18);
  assert.equal(reference('John 3').last, 36);
  assert.equal(reference('living water'), null);
  for (const value of ['John 22:1', 'John 3:0', 'John 3:37', 'Romans 8:11-1']) assert.throws(() => reference(value));
});
