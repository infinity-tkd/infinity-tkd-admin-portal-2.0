import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { DEFAULT_BELT_ORDER, normalizeBeltOrder, beltRank, nextBeltName } = loadTs('lib/belts.ts');

test('the built-in belt order matches the belts table and the naming convention', () => {
  assert.deepEqual([...DEFAULT_BELT_ORDER], ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan', '4th Poom/Dan', '5th Dan', '6th Dan']);
  assert.ok(!DEFAULT_BELT_ORDER.some(name => /black/i.test(name)), 'never "Black 1st Dan"');
  assert.ok(Object.isFrozen(DEFAULT_BELT_ORDER));
});

test('table rows become one ordered list; unusable rows are ignored', () => {
  assert.deepEqual([...normalizeBeltOrder([{ belt_name: 'Yellow', belt_order: 2 }, { belt_name: ' White ', belt_order: 1 }, { belt_name: 'Yellow', belt_order: 3 }, { belt_name: '', belt_order: 4 }, { belt_name: 'Red', belt_order: null }])], ['White', 'Yellow']);
  assert.equal(normalizeBeltOrder([]), null);
  assert.equal(normalizeBeltOrder(null), null);
});

test('ranking and promotion follow the order; unknown belts sort last', () => {
  assert.ok(beltRank('White') < beltRank('Red'));
  assert.ok(beltRank('6th Dan') < beltRank('Unknown belt'), 'unknown belts no longer sort before White');
  assert.equal(beltRank(undefined), DEFAULT_BELT_ORDER.length);
  assert.equal(nextBeltName('Red'), '1st Poom/Dan');
  assert.equal(nextBeltName('4th Poom/Dan'), '5th Dan');
  assert.equal(nextBeltName('6th Dan'), '6th Dan');
  assert.equal(nextBeltName('Purple'), 'Purple');
  assert.equal(nextBeltName('Yellow', ['White', 'Yellow', 'Orange']), 'Orange', 'a loaded table order wins');
});
