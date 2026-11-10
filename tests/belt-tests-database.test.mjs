import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

const { computeBeltTestResult } = loadTs('lib/belt-test-scoring.ts');
const { beltTestsV1 } = loadTs('lib/belt-tests-student-contract.ts');
const headCoach = '91000000-0000-4000-8000-000000000003';
// Includes the later extras migration, so the original flows are checked against what production runs.
const migrations = ['20261101161201_role_permission_boundaries', '20261107090148_student_portal_data_requests', '20261107095953_belt_test_system',
  '20261109063848_belt_test_foreign_key_indexes', '20261110062131_ranking_lesson_layout_belt_test_extras'];
const mutate = async (db, action, data, actor = headCoach, key = randomUUID()) => (await db.query('SELECT portal_belt_tests_mutate($1,$2,$3,$4) AS result', [actor, action, data, key])).rows[0].result;
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function setup() {
  const db = await operationsDatabase();
  for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'head@example.test')", [headCoach]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role) VALUES($1,'head_coach','head@example.test','Fixture head coach','Head Coach')", [headCoach]);
  const today = (await one(db, "SELECT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)::text AS d")).d;
  const belt = async name => (await one(db, 'SELECT id FROM belts WHERE belt_name=$1', [name])).id;
  return { db, today, belt };
}

const colorSyllabus = (targetBeltId, overrides = {}) => ({
  targetBeltId, title: 'Yellow belt test', passMark: 70, distinctionMark: 90, sectionMinimum: 60, criticalMinimum: 5, retestDays: 30, notes: '',
  eligibility: { minimumDays: 60, minimumClasses: 2, minimumSkillAverage: 0, requireLessons: false },
  sections: [
    { kind: 'physical', title: 'Physical Test', weight: 25, minimum: null, items: [{ title: 'Push-ups', weight: 1, critical: false }, { title: 'Flexibility', weight: 1, critical: false }] },
    { kind: 'skill', title: 'Taekwondo Skill Test', weight: 35, minimum: null, items: [{ title: 'Ap Chagi', weight: 2, critical: true }, { title: 'Arae Makki', weight: 1, critical: false }] },
    { kind: 'poomsae', title: 'Poomsae Test', weight: 30, minimum: null, items: [{ title: 'Taegeuk Il Jang', weight: 1, critical: true, libraryAssetId: 7 }] },
    { kind: 'acrobatics', title: 'Acrobatic & Tricking Test', weight: 10, minimum: null, items: [{ title: 'Cartwheel', weight: 1, critical: false }] },
  ],
  ...overrides,
});

/** Runs the TypeScript mirror on exactly what the database holds. */
async function tsCompute(db, candidateId) {
  const syllabus = await one(db, 'SELECT y.* FROM grading_candidates c JOIN grading_events e ON e.id=c.event_id JOIN belt_test_syllabi y ON y.id=e.syllabus_id WHERE c.id=$1', [candidateId]);
  const sections = (await db.query('SELECT * FROM belt_test_sections WHERE syllabus_id=$1 ORDER BY position', [syllabus.id])).rows;
  const items = (await db.query('SELECT i.* FROM belt_test_items i JOIN belt_test_sections x ON x.id=i.section_id WHERE x.syllabus_id=$1 ORDER BY i.position', [syllabus.id])).rows;
  const scores = Object.fromEntries((await db.query('SELECT item_id,score FROM grading_item_scores WHERE candidate_id=$1', [candidateId])).rows.map(row => [row.item_id, Number(row.score)]));
  return computeBeltTestResult(
    { passMark: Number(syllabus.pass_mark), distinctionMark: Number(syllabus.distinction_mark), sectionMinimum: Number(syllabus.section_minimum), criticalMinimum: Number(syllabus.critical_minimum) },
    sections.map(section => ({ id: section.id, kind: section.kind, title: section.title, weight: section.weight == null ? null : Number(section.weight), minimum: section.minimum == null ? null : Number(section.minimum),
      items: items.filter(item => item.section_id === section.id).map(item => ({ id: item.id, weight: Number(item.weight), critical: item.critical })) })),
    scores,
  );
}
async function assertParity(db, candidateId, label) {
  const sql = (await one(db, 'SELECT portal_belt_test_compute($1) AS r', [candidateId])).r;
  const ts = await tsCompute(db, candidateId);
  assert.equal(Number(sql.overall), ts.overall, label + ' overall');
  assert.equal(sql.result, ts.result, label + ' result');
  assert.deepEqual(sql.sections.map(row => Number(row.percent)), ts.sections.map(row => row.percent), label + ' section %');
  assert.deepEqual([...sql.retestSections].sort(), ts.retestSections, label + ' retest sections');
  return sql;
}

test('color belt test: syllabus, eligibility, scoring parity, retest, results and promotion', async () => {
  const { db, today, belt } = await setup();
  try {
    const yellow = await belt('Yellow');
    // Management rules: weights must add to 100, coaches cannot manage, published syllabi are frozen.
    await assert.rejects(mutate(db, 'syllabus_save', colorSyllabus(yellow, { sections: colorSyllabus(yellow).sections.slice(0, 3) })), /add up to 100/);
    await assert.rejects(mutate(db, 'syllabus_save', colorSyllabus(yellow), coach), /head coach or administrator/);
    const syllabus = await mutate(db, 'syllabus_save', colorSyllabus(yellow));
    assert.equal(syllabus.version, 1);
    await mutate(db, 'syllabus_publish', { id: syllabus.id, revision: syllabus.revision });
    await assert.rejects(db.query("UPDATE belt_test_syllabi SET title='Edited after publishing' WHERE id=$1", [syllabus.id]), /cannot change/);
    await assert.rejects(db.query("DELETE FROM belt_test_items WHERE section_id IN (SELECT id FROM belt_test_sections WHERE syllabus_id=$1)", [syllabus.id]), /cannot change/);

    // Eligibility counts real attendance since the last promotion (no class_occurrences needed).
    await db.query("INSERT INTO attendance(student_id,date,status) VALUES('STU-M-001','2026-02-02','Present'),('STU-M-001','2026-02-03','Late'),('STU-M-001','2026-02-04','Absent')");
    const list = (await one(db, 'SELECT portal_belt_test_eligibility_list($1) AS r', [syllabus.id])).r;
    const byId = Object.fromEntries(list.map(row => [row.studentId, row.eligibility]));
    assert.equal(byId['STU-M-001'].status, 'eligible');
    assert.equal(byId['STU-M-001'].rules.find(rule => rule.key === 'classes').current, 2);
    assert.equal(byId['STU-M-002'].status, 'not_yet');

    const event = await mutate(db, 'event_create', { syllabusId: syllabus.id, title: 'Yellow belt test day', examDate: today, startTime: '09:00', location: 'Main hall', branchId: 1 });
    assert.equal((await one(db, 'SELECT kind,target_belt_id,published_at FROM grading_events WHERE id=$1', [event.id])).kind, 'color');
    const first = await mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-001' });
    await assert.rejects(mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-002' }), /not yet eligible/);
    const second = await mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-002', overrideReason: 'Coach recommendation after review' });
    assert.equal(first.status, 'registered');
    await assert.rejects(mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-001' }), /already on this test day/);

    // Writes outside the belt-test RPC are refused for structured test days.
    await assert.rejects(db.query("UPDATE grading_candidates SET score=99 WHERE id=$1", [first.id]), /Use Belt Tests/);
    await assert.rejects((async () => (await db.query('SELECT portal_operations_mutate($1,$2,$3,$4)', [root, 'assess', { eventId: event.id, studentId: 'STU-M-001', score: 90, notes: 'Legacy', revision: 1 }, randomUUID()])))(), /Use Belt Tests/);

    const items = (await db.query('SELECT i.id,i.title FROM belt_test_items i JOIN belt_test_sections x ON x.id=i.section_id WHERE x.syllabus_id=$1', [syllabus.id])).rows;
    const item = title => items.find(row => row.title === title).id;
    const score = (candidateId, title, value, revision = 0, actor = coach) => mutate(db, 'score', { candidateId, itemId: item(title), score: value, note: '', revision }, actor);

    // Coaches score; values are validated and revision-checked.
    await assert.rejects(score(first.id, 'Push-ups', 10.5), /0 to 10/);
    await score(first.id, 'Push-ups', 8);
    await assert.rejects(score(first.id, 'Push-ups', 9, 0), /changed/);
    await score(first.id, 'Push-ups', 8, 1);
    await assertParity(db, first.id, 'partial');
    for (const [title, value] of [['Flexibility', 7], ['Ap Chagi', 8], ['Arae Makki', 7], ['Taegeuk Il Jang', 8], ['Cartwheel', 6]]) await score(first.id, title, value);
    const passed = await assertParity(db, first.id, 'complete pass');
    assert.equal(Number(passed.overall), 75.58);
    assert.equal(passed.result, 'pass');

    for (const [title, value] of [['Push-ups', 9], ['Flexibility', 9], ['Ap Chagi', 9], ['Arae Makki', 9], ['Taegeuk Il Jang', 5], ['Cartwheel', 9]]) await score(second.id, title, value);
    const retest = await assertParity(db, second.id, 'retest');
    assert.equal(retest.result, 'retest', 'overall 78 passes but Poomsae 50% is below the 60% section minimum');

    // Only a head coach/admin finalizes; finalize freezes the computed result.
    const candidateRevision = async id => (await one(db, 'SELECT revision FROM grading_candidates WHERE id=$1', [id])).revision;
    await assert.rejects(mutate(db, 'finalize', { candidateId: first.id, revision: await candidateRevision(first.id) }, coach), /head coach or administrator/);
    await mutate(db, 'finalize', { candidateId: first.id, revision: await candidateRevision(first.id) });
    await mutate(db, 'finalize', { candidateId: second.id, revision: await candidateRevision(second.id) });
    await assert.rejects(score(first.id, 'Cartwheel', 9, 1), /locked/);
    await assert.rejects(mutate(db, 'promote', { candidateId: second.id, revision: await candidateRevision(second.id) }), /finalized pass/);

    // One retest of the failed section only.
    await mutate(db, 'start_retest', { candidateId: second.id, revision: await candidateRevision(second.id) });
    await assert.rejects(score(second.id, 'Push-ups', 10, 1), /retest sections/);
    await score(second.id, 'Taegeuk Il Jang', 7, 1);
    const afterRetest = await assertParity(db, second.id, 'after retest');
    assert.equal(afterRetest.result, 'pass');
    await mutate(db, 'finalize', { candidateId: second.id, revision: await candidateRevision(second.id) });

    await mutate(db, 'feedback', { candidateId: first.id, feedback: 'Strong front kick; keep working on cartwheel control.' }, coach);
    await mutate(db, 'publish_results', { eventId: event.id });
    const promoted = await mutate(db, 'promote', { candidateId: first.id, revision: await candidateRevision(first.id) });
    assert.equal(promoted.belt, 'Yellow');
    const student = await one(db, "SELECT s.current_belt,b.belt_name FROM students s JOIN belts b ON b.id=s.belt_id WHERE s.id='STU-M-001'");
    assert.equal(student.current_belt, 'Yellow');
    assert.equal(student.belt_name, 'Yellow', 'belt_id follows the promotion');
    await assert.rejects(mutate(db, 'promote', { candidateId: first.id, revision: await candidateRevision(first.id) }), /finalized pass/);

    // Student portal contract: whitelisted results, never private notes or examiners.
    const view = (await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r;
    assert.equal(view.contractVersion, 'belt-tests-v1');
    assert.ok(beltTestsV1.safeParse(view).success, 'color view matches the documented student contract: ' + JSON.stringify(beltTestsV1.safeParse(view).error?.issues?.slice(0, 2)));
    assert.equal(view.currentBelt, 'Yellow');
    assert.deepEqual(view.nextBelt, { name: 'Green', order: 3, track: 'color' });
    assert.equal(view.results[0].result, 'pass');
    assert.equal(view.results[0].promoted, true);
    assert.equal(view.results[0].sections.length, 4);
    assert.match(view.results[0].feedback, /front kick/);
    assert.equal(JSON.stringify(view).includes(coach), false, 'examiner identity is not exposed');
    const audit = (await one(db, "SELECT count(*)::int n FROM audit_logs WHERE action LIKE 'BELT_TESTS_%'")).n;
    assert.ok(audit >= 20);
  } finally { await db.close(); }
});

test('Kukkiwon black belt: no academy scoring, CTF submission, result, certificate and promotion', async () => {
  const { db, today, belt } = await setup();
  try {
    await db.exec("UPDATE students SET current_belt='Red' WHERE id='STU-M-001'");
    const first = await belt('1st Poom/Dan');
    const payload = { targetBeltId: first, title: '1st Poom/Dan Kukkiwon test', notes: '', eligibility: { minimumDays: 0, minimumClasses: 0, minimumSkillAverage: 0, requireLessons: false },
      sections: [{ kind: 'poomsae', title: 'Poomsae', items: [{ title: 'Koryo' }, { title: 'Taegeuk Pal Jang' }] }, { kind: 'skill', title: 'Kyorugi', items: [{ title: 'Sparring' }] }] };
    await assert.rejects(mutate(db, 'syllabus_save', { ...payload, passMark: 70 }), /not scored/);
    const syllabus = await mutate(db, 'syllabus_save', payload);
    const stored = await one(db, 'SELECT track,pass_mark FROM belt_test_syllabi WHERE id=$1', [syllabus.id]);
    assert.equal(stored.track, 'kukkiwon');
    assert.equal(stored.pass_mark, null);
    await mutate(db, 'syllabus_publish', { id: syllabus.id, revision: syllabus.revision });
    const event = await mutate(db, 'event_create', { syllabusId: syllabus.id, title: 'Kukkiwon Cambodia test', examDate: today, startTime: '08:00', location: 'National Olympic Stadium', branchId: null });
    await mutate(db, 'event_publish', { id: event.id });
    await assert.rejects(mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-002' }), /next rank after Red/);
    const nominee = await mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-001' });
    assert.equal(nominee.status, 'nominated');
    const row = await one(db, 'SELECT * FROM grading_candidates WHERE id=$1', [nominee.id]);
    assert.equal(row.poom_or_dan, 'Dan', 'born 2010: 15 or older on the test date');
    assert.equal(row.legal_name_en, 'Athlete');

    const itemId = (await one(db, 'SELECT i.id FROM belt_test_items i JOIN belt_test_sections x ON x.id=i.section_id WHERE x.syllabus_id=$1 LIMIT 1', [syllabus.id])).id;
    await assert.rejects(mutate(db, 'score', { candidateId: nominee.id, itemId, score: 8, note: '', revision: 0 }, coach), /not scored/);

    const revision = async () => (await one(db, 'SELECT revision FROM grading_candidates WHERE id=$1', [nominee.id])).revision;
    await mutate(db, 'kukkiwon_update', { candidateId: nominee.id, revision: await revision(), legalNameEn: 'ATHLETE FIXTURE', legalNameKh: 'Fixture', previousCertificateNo: '' });
    const submitted = await mutate(db, 'kukkiwon_submit', { eventId: event.id, submittedOn: today, reference: 'CTF-2026-11' });
    assert.equal(submitted.submitted, 1);
    await assert.rejects(mutate(db, 'kukkiwon_update', { candidateId: nominee.id, revision: await revision(), legalNameEn: 'Changed', legalNameKh: '', previousCertificateNo: '' }), /locked/);
    await assert.rejects(mutate(db, 'promote', { candidateId: nominee.id, revision: await revision() }), /certificate/);
    await mutate(db, 'kukkiwon_result', { candidateId: nominee.id, revision: await revision(), result: 'passed' });
    await mutate(db, 'kukkiwon_certificate', { candidateId: nominee.id, revision: await revision(), certificateNo: 'KKW-0012345', certificateDate: today });
    const promoted = await mutate(db, 'promote', { candidateId: nominee.id, revision: await revision() });
    assert.equal(promoted.belt, '1st Poom/Dan');
    const history = await one(db, "SELECT belt_level,kukkiwon_dan_card_id FROM belt_histories WHERE student_id='STU-M-001' ORDER BY id DESC LIMIT 1");
    assert.deepEqual(history, { belt_level: '1st Poom/Dan', kukkiwon_dan_card_id: 'KKW-0012345' });
    assert.equal((await one(db, "SELECT kukkiwon_id FROM students WHERE id='STU-M-001'")).kukkiwon_id, 'KKW-0012345');

    const view = (await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r;
    assert.ok(beltTestsV1.safeParse(view).success, 'Kukkiwon view matches the documented student contract: ' + JSON.stringify(beltTestsV1.safeParse(view).error?.issues?.slice(0, 2)));
    assert.equal(view.currentBelt, '1st Poom/Dan');
    assert.deepEqual(view.nextBelt, { name: '2nd Poom/Dan', order: 8, track: 'kukkiwon' });
    assert.equal(view.kukkiwon[0].status, 'promoted');
    assert.equal(view.kukkiwon[0].certificateNo, 'KKW-0012345');
    assert.equal(view.kukkiwon[0].poomOrDan, 'Dan');
  } finally { await db.close(); }
});
