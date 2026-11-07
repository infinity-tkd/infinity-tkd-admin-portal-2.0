import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { mergeBeltEligibility, beltEligibilitySummary } = loadTs('lib/belt-eligibility.ts');
const eligibility = status => ({ status, syllabusId: '72000000-0000-4000-8000-000000000001', targetBelt: 'Yellow', track: 'color', evaluatedOn: '2026-11-07', since: '2026-01-15',
  rules: [{ key: 'current_belt', met: true, current: 'White', required: 'White' }, { key: 'classes', met: status === 'eligible', current: status === 'eligible' ? 20 : 10, required: 16 }] });
const report = (eligibilityStatus, pri = 80) => ({ eligibilityStatus, pri, rank: eligibilityStatus === 'Ready' ? 'Gold' : eligibilityStatus === 'Developing' ? 'Silver' : 'Bronze' });

test('a published belt test decides Ready everywhere in the admin portal', () => {
  // Engine says eligible: Ready, even when the older progress index lags.
  const promoted = mergeBeltEligibility(report('Needs Work', 30), eligibility('eligible'));
  assert.equal(promoted.eligibilityStatus, 'Ready');
  assert.equal(promoted.rank, 'Gold');
  assert.equal(promoted.pri, 30, 'the progress index is kept as progress');
  // Engine says not yet: never Ready, whatever the older calculation thought.
  const held = mergeBeltEligibility(report('Ready', 95), eligibility('not_yet'));
  assert.equal(held.eligibilityStatus, 'Developing');
  assert.equal(held.rank, 'Silver');
  assert.equal(mergeBeltEligibility(report('Needs Work'), eligibility('not_yet')).eligibilityStatus, 'Needs Work');
  // No published syllabus: the original report is unchanged.
  const fallback = mergeBeltEligibility(report('Ready'), undefined);
  assert.equal(fallback.eligibilityStatus, 'Ready');
  assert.equal(fallback.beltTest, null);
});

test('eligibility summaries name the test and progress', () => {
  assert.equal(beltEligibilitySummary(eligibility('eligible')), 'Eligible for the Yellow test');
  assert.equal(beltEligibilitySummary(eligibility('not_yet')), '1 of 2 Yellow test rules met');
});
