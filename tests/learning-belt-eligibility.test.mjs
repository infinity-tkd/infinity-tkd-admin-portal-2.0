import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { studentLessonEligible } = loadTs('lib/student-catalog-contract.ts');

test('an empty database belt catalog uses the existing Academy order without opening higher-level lessons', () => {
  assert.equal(studentLessonEligible('White', 'White', []), true);
  assert.equal(studentLessonEligible('White belt', 'white', []), true);
  assert.equal(studentLessonEligible('Red', 'White', []), false);
  assert.equal(studentLessonEligible('White', 'Red', []), true);
  assert.equal(studentLessonEligible('Red', 'Red', []), true);
});

test('unknown restricted targets and unknown student belts remain denied when the database catalog is empty', () => {
  assert.equal(studentLessonEligible('Unknown restriction', 'Red', []), false);
  assert.equal(studentLessonEligible('White', 'Unknown belt', []), false);
  assert.equal(studentLessonEligible('White', '', []), false);
  assert.equal(studentLessonEligible('', 'Red', []), false);
});

test('a partial configured catalog never fills its missing levels from the Academy defaults', () => {
  const partial = [{ belt_name: 'White', belt_order: 1 }];
  assert.equal(studentLessonEligible('White', 'White', partial), true);
  assert.equal(studentLessonEligible('White', 'Red', partial), false);
  assert.equal(studentLessonEligible('Red', 'White', partial), false);
});

test('a nonempty custom catalog keeps its own names and order authoritative', () => {
  const custom = [{ belt_name: 'Orange', belt_order: 2 }, { belt_name: 'White', belt_order: 10 }, { belt_name: 'Red', belt_order: 5 }];
  assert.equal(studentLessonEligible('Orange', 'Red', custom), true);
  assert.equal(studentLessonEligible('White', 'Red', custom), false);
  assert.equal(studentLessonEligible('Red', 'White', custom), true);
  assert.equal(studentLessonEligible('Yellow', 'White', custom), false);
});
