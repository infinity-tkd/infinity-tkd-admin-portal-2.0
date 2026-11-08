import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { attendanceMarkKey, queuedMarkKey, queuedMarkId, overlayQueuedAttendance, mergeQueuedMarks, buildQueuedMarks } = loadTs('lib/attendance-queue.ts');
const { saveAttendanceBatch, isUnconfirmedAttendanceError } = loadTs('lib/attendance-write.ts');

test('queued marks are keyed per account and session, with stable negative ids', () => {
  const row = { studentId: 'S1', date: '2026-11-08', status: 'Present', classId: 3 };
  assert.equal(attendanceMarkKey(row), 'S1/2026-11-08/3');
  assert.equal(attendanceMarkKey({ ...row, classId: undefined }), 'S1/2026-11-08/daily');
  assert.equal(queuedMarkKey('coach-a', row), 'coach-a|S1/2026-11-08/3');
  const id = queuedMarkId('coach-a|S1/2026-11-08/3');
  assert.ok(Number.isSafeInteger(id) && id < 0, 'never collides with database ids');
  assert.equal(queuedMarkId('coach-a|S1/2026-11-08/3'), id, 'stable across renders');
  assert.notEqual(queuedMarkId('coach-a|S2/2026-11-08/3'), id);
});

test('a later offline mark for the same session replaces the earlier one', () => {
  const first = buildQueuedMarks('coach-a', [{ studentId: 'S1', date: '2026-11-08', status: 'Absent', classId: 3 }], 1000);
  const second = buildQueuedMarks('coach-a', [{ studentId: 'S1', date: '2026-11-08', status: 'Present', classId: 3 }, { studentId: 'S2', date: '2026-11-08', status: 'Late', classId: 3 }], 2000);
  const merged = mergeQueuedMarks(first, second);
  assert.deepEqual(merged.map(mark => [mark.studentId, mark.status]), [['S1', 'Present'], ['S2', 'Late']]);
  assert.ok(merged.every(mark => mark.userId === 'coach-a' && !('token' in mark)), 'only the mark and its author are kept');
});

test('queued marks show in place of loaded records for the same session', () => {
  const loaded = [{ id: 10, studentId: 'S1', date: '2026-11-08', status: 'Absent', classId: 3 }, { id: 11, studentId: 'S2', date: '2026-11-08', status: 'Present', classId: 3 }];
  const queued = buildQueuedMarks('coach-a', [{ studentId: 'S1', date: '2026-11-08', status: 'Present', classId: 3 }]);
  const shown = overlayQueuedAttendance(loaded, queued);
  assert.equal(shown.length, 2);
  const s1 = shown.find(row => row.studentId === 'S1');
  assert.equal(s1.status, 'Present');
  assert.equal(s1.pending, true);
  assert.ok(s1.id < 0);
  assert.equal(overlayQueuedAttendance(loaded, []), loaded, 'nothing queued leaves the records untouched');
});

test('only saves that never got a database answer are kept for later', async () => {
  const row = [{ studentId: 'S1', date: '2026-11-08', status: 'Present', classId: 3 }];
  const client = result => ({ from: () => ({ upsert: () => ({ select: () => ({ abortSignal: () => result }) }) }) });
  const offline = client(Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(saveAttendanceBatch(offline, row, 'coach-a'), error => isUnconfirmedAttendanceError(error) && /could not be confirmed/.test(error.message));
  const dropped = client(Promise.resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } }));
  await assert.rejects(saveAttendanceBatch(dropped, row, 'coach-a'), error => isUnconfirmedAttendanceError(error));
  const outage = client(Promise.resolve({ data: null, error: { code: '08006', message: 'database connection failure' } }));
  await assert.rejects(saveAttendanceBatch(outage, row, 'coach-a'), error => !isUnconfirmedAttendanceError(error) && /could not be confirmed/.test(error.message), 'a server that answers is not treated as offline');
  const rejected = client(Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }));
  await assert.rejects(saveAttendanceBatch(rejected, row, 'coach-a'), error => !isUnconfirmedAttendanceError(error) && /rejected/.test(error.message));
});
