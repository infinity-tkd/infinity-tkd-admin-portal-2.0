import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { academyDate, isCalendarDate, calendarDate } = loadTs('lib/dates.ts');

// The original Date-based rules; the faster helpers must give identical answers.
const referenceIsCalendarDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const referenceCalendarDate = (year, monthIndex, day) => {
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, days))).toISOString().slice(0, 10);
};

test('isCalendarDate matches the Date-based rule for every day, every month end and malformed input', () => {
  for (let time = Date.UTC(1999, 11, 1); time <= Date.UTC(2101, 1, 1); time += 86400000) {
    const value = new Date(time).toISOString().slice(0, 10);
    assert.equal(isCalendarDate(value), true, value);
  }
  for (const year of [0, 4, 100, 1900, 2000, 2023, 2024, 2100, 2400, 9999]) for (let month = 0; month <= 13; month++) for (const day of [0, 1, 28, 29, 30, 31, 32]) {
    const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    assert.equal(isCalendarDate(value), referenceIsCalendarDate(value), value);
  }
  for (const value of ['', '2026-1-01', '2026-01-1', ' 2026-01-01', '2026-01-01T00:00', '2026/01/01', 'abcd-ef-gh', undefined, null]) assert.equal(isCalendarDate(value), referenceIsCalendarDate(String(value)) && typeof value === 'string', String(value));
});

test('calendarDate matches the Date-based rule across month overflow, short months and odd inputs', () => {
  for (const year of [99, 100, 1999, 2024, 2025, 2026, 2100, 9999]) for (let monthIndex = -25; monthIndex <= 25; monthIndex++) for (const day of [-1, 0, 1, 15, 28, 29, 30, 31, 32, 2.5]) {
    let expected; try { expected = referenceCalendarDate(year, monthIndex, day); } catch (error) { expected = error.constructor.name; }
    let actual; try { actual = calendarDate(year, monthIndex, day); } catch (error) { actual = error.constructor.name; }
    assert.equal(actual, expected, `${year},${monthIndex},${day}`);
  }
});

test('academyDate reuses one formatter and still follows the academy time zone', () => {
  const fresh = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  for (let time = Date.UTC(2025, 11, 31, 16, 59); time <= Date.UTC(2026, 0, 2); time += 37 * 60000) assert.equal(academyDate(new Date(time)), fresh(new Date(time)));
  assert.equal(academyDate(new Date('2026-10-08T17:00:00Z')), '2026-10-09');
  assert.throws(() => academyDate(new Date('invalid')), RangeError);
});
