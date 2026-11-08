import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { groupByStudent, rowsForStudent, attendanceOnDate, sessionMark } = loadTs('lib/attendance-index.ts');
const { calculatePromotionReadiness, calculateChurnRisk } = loadTs('lib/utils.ts');

const records = [
  { id: 1, studentId: 'A', date: '2026-11-02', status: 'Present', classId: 1 },
  { id: 2, studentId: 'B', date: '2026-11-02', status: 'Absent', classId: 1 },
  { id: 3, studentId: 'A', date: '2026-11-04', status: 'Late', classId: 2 },
  { id: 4, studentId: 'A', date: '2026-11-04', status: 'Present' },
];

test('lookups give the same answers as scanning the list', () => {
  assert.deepEqual(rowsForStudent(records, 'A').map(row => row.id), records.filter(row => row.studentId === 'A').map(row => row.id));
  assert.deepEqual(rowsForStudent(records, 'Z'), []);
  for (const [studentId, date, classId] of [['A', '2026-11-02', 1], ['A', '2026-11-04', 2], ['B', '2026-11-02', 1], ['B', '2026-11-04', 1], ['A', '2026-11-04', null], ['A', '2026-11-04', undefined]]) {
    assert.equal(sessionMark(records, studentId, date, classId), classId == null ? undefined : records.find(row => row.studentId === studentId && row.date === date && row.classId === classId), `${studentId} ${date} ${classId}`);
  }
  assert.equal(attendanceOnDate(records, '2026-11-04').get('A/daily').id, 4, 'daily check-ins keep their own key');
  assert.equal(groupByStudent(records), groupByStudent(records), 'one pass per list');
  assert.notEqual(groupByStudent([...records]), groupByStudent(records), 'a replaced list is indexed again');
});

test('promotion readiness and churn risk read only the student\'s own records', () => {
  const student = { id: 'A', currentBelt: 'White', registrationDate: '2026-11-01' };
  assert.equal(calculatePromotionReadiness(student, records, [], [], [], [], []).attendanceSince, 3, 'two Present and one Late since registration');
  assert.equal(calculatePromotionReadiness({ ...student, id: 'B' }, records, [], [], [], [], []).attendanceSince, 0, 'absences do not count');
  assert.equal(calculatePromotionReadiness({ ...student, id: 'Z' }, records, [], [], [], [], []).attendanceSince, 0);
  assert.equal(calculateChurnRisk(student, records, [], [], new Date(2026, 10, 8, 10)).lastDate, '2026-11-04');
  assert.equal(calculateChurnRisk({ ...student, id: 'B' }, records, [], [], new Date(2026, 10, 8, 10)).lastDate, 'Never');
});
