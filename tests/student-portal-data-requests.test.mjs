import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root } from './fixtures/operations-db.mjs';

const migration = 'supabase/migrations/20261107090148_student_portal_data_requests.sql';
const mutate = async (db, action, data, key = randomUUID(), actor = root) => (await db.query('SELECT portal_operations_mutate($1,$2,$3,$4) AS result', [actor, action, data, key])).rows[0].result;
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function setup() {
  const db = await operationsDatabase();
  await db.exec(fs.readFileSync('supabase/migrations/20261101161201_role_permission_boundaries.sql', 'utf8'));
  await db.exec(fs.readFileSync(migration, 'utf8'));
  return db;
}

test('belt catalog uses the stored belt names and keeps students.belt_id in step with current_belt', async () => {
  const db = await setup();
  try {
    const belts = (await db.query('SELECT belt_name,belt_order FROM belts ORDER BY belt_order')).rows;
    assert.deepEqual(belts.map(row => row.belt_name), ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan', '4th Poom/Dan', '5th Dan', '6th Dan'], 'existing White/Yellow rows are kept; missing ranks are added');
    for (const [name, key] of [['White Belt', 'white'], ['1st Poom/Dan', 'dan-1'], ['Black 1st Dan', 'dan-1'], ['2nd Dan', 'dan-2'], ['6th Dan', 'dan-6'], ['', null]]) {
      assert.equal((await one(db, 'SELECT portal_belt_key($1) AS key', [name])).key, key, name);
    }
    const student = await one(db, "SELECT s.current_belt,b.belt_name FROM students s LEFT JOIN belts b ON b.id=s.belt_id WHERE s.id='STU-M-001'");
    assert.equal(student.belt_name, student.current_belt, 'backfill links every student to their belt row');
    await db.exec("UPDATE students SET current_belt='Green' WHERE id='STU-M-001'");
    assert.equal((await one(db, "SELECT b.belt_name FROM students s JOIN belts b ON b.id=s.belt_id WHERE s.id='STU-M-001'")).belt_name, 'Green');
    await db.exec("UPDATE students SET belt_id=(SELECT id FROM belts WHERE belt_name='Red') WHERE id='STU-M-001'");
    assert.equal((await one(db, "SELECT b.belt_name FROM students s JOIN belts b ON b.id=s.belt_id WHERE s.id='STU-M-001'")).belt_name, 'Green', 'belt_id cannot drift from current_belt');
  } finally { await db.close(); }
});

test('coach assessment scores are 0-10 and every save refreshes updated_at', async () => {
  const db = await setup();
  try {
    await db.exec("INSERT INTO student_physical_evaluations(student_id,skill_name,belt_level,grade,score,updated_at) VALUES('STU-M-001','Balance','White','Proficient',8.5,'2020-01-01')");
    const saved = await one(db, "SELECT score,updated_at FROM student_physical_evaluations WHERE skill_name='Balance'");
    assert.equal(Number(saved.score), 8.5);
    assert.ok(new Date(saved.updated_at).getFullYear() > 2020, 'insert time is set by the database');
    await assert.rejects(db.exec("INSERT INTO student_physical_evaluations(student_id,skill_name,belt_level,score) VALUES('STU-M-001','Power','White',10.5)"), /check/i);
    await assert.rejects(db.exec("INSERT INTO student_physical_evaluations(student_id,skill_name,belt_level,score) VALUES('STU-M-001','Speed','White',-1)"), /check/i);
  } finally { await db.close(); }
});

test('grading days are private until published, carry branch/time/location, and cancellation hides and freezes them', async () => {
  const db = await setup();
  try {
    const white = (await one(db, "SELECT id FROM belts WHERE belt_name='White'")).id;
    const yellow = (await one(db, "SELECT id FROM belts WHERE belt_name='Yellow'")).id;
    const exam = await mutate(db, 'exam', { title: 'Autumn grading', examDate: '2026-10-20', attendanceFrom: '2026-10-01', targetBeltId: yellow, passingScore: 70, minimumAttendance: 80, branchId: 1, startTime: '09:30', location: 'Main hall' });
    let row = await one(db, 'SELECT * FROM grading_events WHERE id=$1', [exam.id]);
    assert.equal(row.published_at, null, 'new grading days start private');
    assert.equal(row.branch_id, 1);
    assert.equal(row.start_time, '09:30:00');
    assert.equal(row.location, 'Main hall');

    await mutate(db, 'exam_update', { id: exam.id, title: 'Autumn grading day', examDate: '2026-10-21', startTime: '10:00', location: '', branchId: null });
    row = await one(db, 'SELECT * FROM grading_events WHERE id=$1', [exam.id]);
    assert.equal(row.title, 'Autumn grading day');
    assert.equal(row.location, null);
    assert.equal(row.branch_id, null, 'null branch = all branches');
    await assert.rejects(mutate(db, 'exam_update', { id: exam.id, title: 'Too early', examDate: '2026-09-01', startTime: '', location: '', branchId: null }), /attendance period/);

    await mutate(db, 'exam_publish', { id: exam.id });
    const published = (await one(db, 'SELECT published_at FROM grading_events WHERE id=$1', [exam.id])).published_at;
    assert.ok(published);
    await mutate(db, 'exam_publish', { id: exam.id });
    assert.equal(String((await one(db, 'SELECT published_at FROM grading_events WHERE id=$1', [exam.id])).published_at), String(published), 'republishing keeps the first publication time');

    await mutate(db, 'exam_cancel', { id: exam.id, reason: 'Venue unavailable this weekend' });
    assert.ok((await one(db, 'SELECT cancelled_at FROM grading_events WHERE id=$1', [exam.id])).cancelled_at);
    await assert.rejects(mutate(db, 'assess', { eventId: exam.id, studentId: 'STU-M-001', score: 80, notes: 'Cancelled event', revision: 0 }), /cancelled/);
    await assert.rejects(mutate(db, 'exam_publish', { id: exam.id }), /cancelled/);
    await assert.rejects(mutate(db, 'exam_update', { id: exam.id, title: 'Revived', examDate: '2026-10-21', startTime: '', location: '', branchId: null }), /cancelled/);

    // The rank check now works because belt_id is maintained: a White exam cannot "promote" a Yellow student.
    await db.exec("UPDATE students SET current_belt='Yellow' WHERE id='STU-M-002'");
    const lower = await mutate(db, 'exam', { title: 'White refresher', examDate: '2026-10-20', attendanceFrom: '2026-10-01', targetBeltId: white, passingScore: 70, minimumAttendance: 0 });
    const assessed = await mutate(db, 'assess', { eventId: lower.id, studentId: 'STU-M-002', score: 90, notes: 'Assessed', revision: 0 });
    await assert.rejects(mutate(db, 'promote', { id: assessed.id, studentId: 'STU-M-002', revision: 1, overrideReason: 'Administrator exception for fixture' }), /advance the current rank/);
  } finally { await db.close(); }
});

test('branch opening hours must be a short array', async () => {
  const db = await setup();
  try {
    await db.exec(`UPDATE branches SET opening_hours='[{"day":"Mon","opens":"08:00","closes":"20:00"},{"day":"Sun","closed":true}]' WHERE id=1`);
    await assert.rejects(db.exec(`UPDATE branches SET opening_hours='{"Mon":"08:00-20:00"}' WHERE id=1`), /check/i);
    await assert.rejects(db.exec(`UPDATE branches SET opening_hours='[1,2,3,4,5,6,7,8]' WHERE id=1`), /check/i);
  } finally { await db.close(); }
});
