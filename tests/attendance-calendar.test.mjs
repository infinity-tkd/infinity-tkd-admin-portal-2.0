import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { attendanceMonthDays, shiftAttendanceDate, indexAttendanceCalendar, attendanceMarkBlock } = loadTs('lib/attendance-calendar.ts');
const { clearAttendanceMark } = loadTs('lib/attendance-write.ts');

test('attendance calendar aligns Monday-first weeks and handles leap days and year boundaries', () => {
  const october = attendanceMonthDays('2026-10');
  assert.equal(october.indexOf('2026-10-01'), 3);
  assert.equal(october.length % 7, 0);
  assert.equal(october.filter(Boolean).length, 31);
  assert.ok(attendanceMonthDays('2024-02').includes('2024-02-29'));
  assert.ok(!attendanceMonthDays('2026-02').includes('2026-02-29'));
  assert.equal(shiftAttendanceDate('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftAttendanceDate('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftAttendanceDate('2026-12-14', 1), '2027-01-14');
  assert.equal(shiftAttendanceDate('1900-01-01', -1), '1900-01-01');
  assert.throws(() => attendanceMonthDays('2026-13'));
  assert.throws(() => shiftAttendanceDate('2026-02-30', 1));
});

test('calendar scopes isolate each student, daily records and conflicting class marks', () => {
  const date = '2026-10-14';
  const records = [
    { id: 1, studentId: 'A', date, classId: 1, status: 'Present' },
    { id: 2, studentId: 'A', date, classId: 2, status: 'Absent' },
    { id: 3, studentId: 'A', date, status: 'Late' },
    { id: 4, studentId: 'B', date, classId: 1, status: 'Present' },
  ];
  assert.deepEqual(indexAttendanceCalendar(records, 'A', 2).get(date).map(item => item.id), [2]);
  assert.deepEqual(indexAttendanceCalendar(records, 'A', 'daily').get(date).map(item => item.id), [3]);
  assert.deepEqual(indexAttendanceCalendar(records, 'A', 'all').get(date).map(item => item.id), [3, 1, 2]);
  assert.deepEqual(indexAttendanceCalendar(records, 'A', 'all'), indexAttendanceCalendar([...records].reverse(), 'A', 'all'));
  assert.equal(indexAttendanceCalendar(records, 'A', 'all').has('2026-10-13'), false);
});

test('new marks respect registration and enrollment while historical corrections remain available', () => {
  const base = { date: '2026-10-14', today: '2026-10-14', registrationDate: '2026-01-01', studentId: 'A', classId: 1, enrollments: [{ studentId: 'A', classId: 1, enrollmentDate: '2026-02-01' }], existing: false };
  assert.equal(attendanceMarkBlock(base), null);
  assert.equal(attendanceMarkBlock({ ...base, date: '2026-10-15' }), 'future');
  assert.equal(attendanceMarkBlock({ ...base, date: '2025-12-31' }), 'before_registration');
  assert.equal(attendanceMarkBlock({ ...base, date: '2026-01-31' }), 'before_enrollment');
  assert.equal(attendanceMarkBlock({ ...base, classId: 2 }), 'not_enrolled');
  assert.equal(attendanceMarkBlock({ ...base, classId: undefined, enrollments: [] }), null);
  assert.equal(attendanceMarkBlock({ ...base, date: '2025-12-31', enrollments: [], existing: true }), null);
  assert.equal(attendanceMarkBlock({ ...base, date: '2026-10-15', existing: true }), 'future');
});

test('clearing requires the exact record and student and confirms a deleted row', async () => {
  for (const result of [{ data: { id: 2 }, error: null }, { data: null, error: null }, { data: null, error: { code: '42501' } }]) {
    const calls = [];
    const query = { delete: () => {calls.push('delete');return query;}, eq: (key, value) => {calls.push([key, value]);return query;}, select: () => query, abortSignal: signal => {assert.ok(signal instanceof AbortSignal);return query;}, maybeSingle: async () => result };
    const client = { from: table => {assert.equal(table,'attendance');return query;} };
    if (result.data) await clearAttendanceMark(client, 2, 'A');
    else await assert.rejects(clearAttendanceMark(client, 2, 'A'), /Reload/i);
    assert.deepEqual(calls, ['delete', ['id', 2], ['student_id', 'A']]);
    for (const id of [0, -1, NaN, 2.5]) await assert.rejects(clearAttendanceMark(client, id, 'A'), /Invalid/);
    assert.equal(calls.length, 3, 'invalid identities never reach a database delete');
  }
});
