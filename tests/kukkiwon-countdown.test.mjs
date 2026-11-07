import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { calendarCountdown, formatRemainingWaitTime, calculateDanEligibility } = loadTs('lib/kukkiwon.ts');

const at = date => new Date(`${date}T12:00:00Z`);

test('Dan wait countdown splits the remaining time into calendar years, months and days', () => {
  assert.deepEqual({ ...calendarCountdown(at('2026-03-17'), at('2026-05-01')) }, { years: 0, months: 1, days: 14 });
  assert.deepEqual({ ...calendarCountdown(at('2026-05-01'), at('2028-05-01')) }, { years: 2, months: 0, days: 0 });
  assert.deepEqual({ ...calendarCountdown(at('2026-01-31'), at('2026-03-01')) }, { years: 0, months: 1, days: 1 });
  assert.deepEqual({ ...calendarCountdown(at('2026-06-01'), at('2026-05-01')) }, { years: 0, months: 0, days: 0 });
  assert.equal(formatRemainingWaitTime(0, 1, 15), '1 mo, 15 days');
  assert.equal(formatRemainingWaitTime(2, 0, 0), '2 yrs');
});

test('Dan eligibility headline no longer mixes months with the total day count', () => {
  // 2nd Dan issued 2025-01-01; its 2-year wait ends 2027-01-01.
  const early = calculateDanEligibility(2, '2025-01-01', '1990-01-01', at('2026-11-17'));
  assert.equal(early.status, 'TIME_PENDING');
  assert.match(early.headline, /^1 mo, 15 days for /);
  const far = calculateDanEligibility(2, '2025-01-01', '1990-01-01', at('2025-01-01'));
  assert.match(far.headline, /^2 yrs for /);
});
