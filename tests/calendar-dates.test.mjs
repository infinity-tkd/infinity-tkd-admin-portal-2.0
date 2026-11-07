import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { monthDays, shiftMonth, venueTimestamp, venueDate, dateLabel } = loadTs('components/calendar/calendar-dates.ts');

test('calendar grid includes both sides of a year boundary in Monday-first order', () => {
  const days = monthDays('2026-01');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2025-12-29');
  assert.equal(new Date(`${days[0]}T00:00:00Z`).getUTCDay(), 1);
  assert.ok(days.includes('2026-01-31'));
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('calendar includes leap days and rejects malformed month input without crashing', () => {
  assert.ok(monthDays('2028-02').includes('2028-02-29'));
  assert.deepEqual(monthDays('2026-13'), []);
  assert.equal(dateLabel('invalid'), 'invalid');
});

test('venue time uses the saved timezone rather than the process/device timezone', () => {
  assert.equal(venueTimestamp('2026-11-01', '09:15', 'Asia/Phnom_Penh'), '2026-11-01T02:15:00.000Z');
  assert.equal(venueTimestamp('2026-11-01', '00:00', 'Asia/Phnom_Penh'), '2026-10-31T17:00:00.000Z');
  assert.equal(venueTimestamp('2026-06-01', '09:15', 'America/New_York'), '2026-06-01T13:15:00.000Z');
});

test('nonexistent or repeated venue times require a correction instead of silent DST guessing', () => {
  assert.throws(() => venueTimestamp('2026-03-08', '02:30', 'America/New_York'), /does not exist/);
  assert.throws(() => venueTimestamp('2026-11-01', '01:30', 'America/New_York'), /occurs twice/);
  assert.throws(() => venueTimestamp('2026-02-30', '09:00', 'Asia/Phnom_Penh'), /valid date/);
});

test('a midnight endpoint belongs to the previous covered day without changing its actual end date', () => {
  const endpoint = venueTimestamp('2026-11-02', '00:00', 'Asia/Phnom_Penh');
  assert.equal(venueDate(endpoint, 'Asia/Phnom_Penh'), '2026-11-02');
  assert.equal(venueDate(Date.parse(endpoint) - 1, 'Asia/Phnom_Penh'), '2026-11-01');
});
