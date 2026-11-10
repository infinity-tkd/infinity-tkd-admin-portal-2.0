import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

const { computeBeltTestResult, panelItemScores } = loadTs('lib/belt-test-scoring.ts');
const { beltTestsV1 } = loadTs('lib/belt-tests-student-contract.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');

const headCoach = '91000000-0000-4000-8000-000000000003';
const secondCoach = '91000000-0000-4000-8000-000000000004';
const studentAccount = '91000000-0000-4000-8000-000000000005';
export const EXTRAS_MIGRATION = '20261110062131_ranking_lesson_layout_belt_test_extras';
const migrations = ['20261101033142_library_student_projection', '20261101161201_role_permission_boundaries', '20261102181732_academy_content_publication',
  '20261107090148_student_portal_data_requests', '20261107095953_belt_test_system', '20261109063848_belt_test_foreign_key_indexes', EXTRAS_MIGRATION];

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const mutate = async (db, action, data, actor = headCoach, key = randomUUID()) => (await db.query('SELECT portal_belt_tests_mutate($1,$2,$3,$4) AS result', [actor, action, data, key])).rows[0].result;
// The fixture runs as the service role (as the portals' servers do).
const asServer = db => db.query("SELECT set_config('request.jwt.role','service_role',false)");
const asAnon = db => db.query("SELECT set_config('request.jwt.role','anon',false)");
const studentCall = async (db, fn, args) => (await db.query(`SELECT ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS result`, args)).rows[0].result;

async function setup() {
  const db = await operationsDatabase();
  for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'head@example.test'),($2,'coach2@example.test'),($3,'student@example.test')", [headCoach, secondCoach, studentAccount]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role) VALUES($1,'head_coach','head@example.test','Fixture head coach','Head Coach'),($2,'coach_two','coach2@example.test','Second coach','Coach')", [headCoach, secondCoach]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id,is_active,must_change_password) VALUES($1,'athlete','student@example.test','Athlete','Student','STU-M-001',true,false)", [studentAccount]);
  const today = (await one(db, "SELECT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)::text AS d")).d;
  const tomorrow = (await one(db, "SELECT (((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)+1)::text AS d")).d;
  const yellow = (await one(db, "SELECT id FROM belts WHERE belt_name='Yellow'")).id;
  return { db, today, tomorrow, yellow };
}

const syllabusPayload = (targetBeltId, feeUsd = 0) => ({
  targetBeltId, title: 'Yellow belt test', passMark: 70, distinctionMark: 90, sectionMinimum: 60, criticalMinimum: 5, retestDays: 30, notes: '', feeUsd,
  eligibility: { minimumDays: 60, minimumClasses: 2, minimumSkillAverage: 0, requireLessons: false },
  sections: [
    { kind: 'physical', title: 'Physical Test', weight: 50, minimum: null, items: [{ title: 'Push-ups', weight: 1, critical: false }] },
    { kind: 'poomsae', title: 'Poomsae Test', weight: 50, minimum: null, items: [{ title: 'Taegeuk Il Jang', weight: 1, critical: true }] },
  ],
});
/** Both fixture students eligible: two classes since registration. */
const attend = db => db.exec("INSERT INTO attendance(student_id,date,status) VALUES('STU-M-001','2026-02-02','Present'),('STU-M-001','2026-02-03','Late'),('STU-M-002','2026-02-02','Present'),('STU-M-002','2026-02-03','Present')");

test('ranking opt-out: staff and the signed-in student can switch it; other students cannot', async () => {
  const { db } = await setup();
  try {
    assert.equal((await one(db, "SELECT ranking_opt_out FROM students WHERE id='STU-M-001'")).ranking_opt_out, false, 'everyone is listed by default');
    assert.deepEqual((await one(db, "SELECT portal_set_ranking_opt_out($1,'STU-M-001',true) AS r", [root])).r, { studentId: 'STU-M-001', rankingOptOut: true });
    assert.equal((await one(db, "SELECT ranking_opt_out FROM students WHERE id='STU-M-001'")).ranking_opt_out, true);
    await assert.rejects(db.query("SELECT portal_set_ranking_opt_out($1,'STU-M-404',true)", [root]), /not found/);

    await asAnon(db);
    await assert.rejects(db.query("SELECT student_portal_set_ranking_opt_out($1,'STU-M-001',false)", [studentAccount]), /Server only/);
    await asServer(db);
    assert.equal((await studentCall(db, 'student_portal_set_ranking_opt_out', [studentAccount, 'STU-M-001', false])).rankingOptOut, false);
    assert.equal((await one(db, "SELECT ranking_opt_out FROM students WHERE id='STU-M-001'")).ranking_opt_out, false);
    await assert.rejects(studentCall(db, 'student_portal_set_ranking_opt_out', [studentAccount, 'STU-M-002', true]), /mismatch/);
    // audit_logs ids are random, so compare the sources without relying on row order.
    const audit = (await db.query("SELECT details->>'source' AS source FROM audit_logs WHERE action='STUDENT_RANKING_OPT_OUT'")).rows.map(row => row.source).sort();
    assert.deepEqual(audit, ['staff', 'student']);
  } finally { await db.close(); }
});

test('lesson order and length: set on the linked student lesson without republishing', async () => {
  const { db } = await setup();
  try {
    const base = { description: JSON.stringify({ text: 'Approved overview', instructions: ['Step'] }), library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'Yellow', video_url: 'https://video.example.test/lesson', muscleRelations: [] };
    const create = async title => { const input = { ...base, title }; return (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,$5) AS r', [root, 'CREATE', null, JSON.stringify({ ...input, studentProjection: libraryPublicationProjection(input) }), randomUUID()])).r.asset; };
    const first = await create('Taegeuk Il Jang'), second = await create('Arae Makki');
    const layout = lessons => one(db, 'SELECT portal_set_lesson_layout($1,$2::jsonb) AS r', [root, JSON.stringify(lessons)]);
    assert.equal((await layout([{ assetId: first.id, sortOrder: 2, durationSeconds: 245 }, { assetId: second.id, sortOrder: 1, durationSeconds: null }])).r.updated, 2);
    const rows = (await db.query('SELECT id,sort_order,duration_seconds FROM curriculum WHERE id IN ($1,$2) ORDER BY sort_order', [first.student_curriculum_id, second.student_curriculum_id])).rows;
    assert.deepEqual(rows.map(row => [row.id, row.sort_order, row.duration_seconds]), [[second.student_curriculum_id, 1, null], [first.student_curriculum_id, 2, 245]]);
    assert.equal((await layout([{ assetId: first.id, sortOrder: 2, durationSeconds: 245 }])).r.updated, 0, 'repeating the same layout changes nothing');
    await assert.rejects(layout([{ assetId: first.id, sortOrder: 0 }]), /Positions run/);
    await assert.rejects(layout([{ assetId: first.id, sortOrder: 1.5 }]), /Invalid lesson order/);
    await assert.rejects(layout([{ assetId: first.id, sortOrder: 1 }, { assetId: first.id, sortOrder: 2 }]), /twice/);
    await assert.rejects(layout([{ assetId: 999999, sortOrder: 1 }]), /not found/);
    await assert.rejects(db.query('SELECT portal_set_lesson_layout($1,$2::jsonb)', [studentAccount, JSON.stringify([{ assetId: first.id, sortOrder: 3 }])]), /Staff access required/);
  } finally { await db.close(); }
});

test('student requests: eligible students request, coaches approve or decline, capacity and deadline hold', async () => {
  const { db, tomorrow, yellow } = await setup();
  try {
    await attend(db);
    const syllabus = await mutate(db, 'syllabus_save', syllabusPayload(yellow, 25));
    await mutate(db, 'syllabus_publish', { id: syllabus.id, revision: syllabus.revision });
    assert.equal(Number((await one(db, 'SELECT fee_usd FROM belt_test_syllabi WHERE id=$1', [syllabus.id])).fee_usd), 25);
    await assert.rejects(mutate(db, 'event_create', { syllabusId: syllabus.id, title: 'Yellow test', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1, capacity: 0 }), /Capacity/);
    const event = await mutate(db, 'event_create', { syllabusId: syllabus.id, title: 'Yellow test', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1, capacity: 1, acceptsRequests: true });

    await asServer(db);
    const key = randomUUID();
    await assert.rejects(studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-001', event.id, key]), /not open/, 'an unpublished test day takes no requests');
    await mutate(db, 'event_publish', { id: event.id });
    const before = (await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r;
    assert.ok(beltTestsV1.safeParse(before).success, JSON.stringify(beltTestsV1.safeParse(before).error?.issues?.slice(0, 2)));
    assert.deepEqual({ ...before.upcoming[0], eventId: undefined }, { ...before.upcoming[0], eventId: undefined, registration: null, canRequest: true, requestsOpen: true, placesLeft: 1, feeUsd: 25, feeStatus: null, declineReason: null });

    const requestKey = randomUUID();
    assert.deepEqual(await studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-001', event.id, requestKey]), { eventId: event.id, status: 'requested' });
    assert.deepEqual(await studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-001', event.id, requestKey]), { eventId: event.id, status: 'requested' }, 'a retried request is idempotent');
    const requested = (await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r.upcoming[0];
    assert.equal(requested.registration, 'requested');
    assert.equal(requested.canRequest, false);
    assert.equal(requested.placesLeft, 0, 'a pending request holds its place');

    // Capacity 1: the other student and staff cannot take the held place.
    await assert.rejects(mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-002' }), /full \(1 places\)/);
    // Cancel and re-request.
    await studentCall(db, 'student_portal_cancel_belt_test_request', [studentAccount, 'STU-M-001', event.id]);
    assert.equal((await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r.upcoming[0].canRequest, true);
    await studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-001', event.id, randomUUID()]);
    const candidate = await one(db, "SELECT id,status,registered_at FROM grading_candidates WHERE event_id=$1 AND student_id='STU-M-001'", [event.id]);
    assert.equal(candidate.status, 'requested');
    assert.equal(candidate.registered_at, null);

    // Coaches cannot approve; a head coach approves: registered with the fee snapshot.
    await assert.rejects(mutate(db, 'approve_request', { id: candidate.id }, coach), /head coach or administrator/);
    const approved = await mutate(db, 'approve_request', { id: candidate.id });
    assert.equal(approved.status, 'registered');
    await assert.rejects(mutate(db, 'approve_request', { id: candidate.id }), /already handled/);
    const row = await one(db, 'SELECT status,fee_usd,fee_status,decided_by,revision FROM grading_candidates WHERE id=$1', [candidate.id]);
    assert.deepEqual([row.status, Number(row.fee_usd), row.fee_status, row.decided_by], ['registered', 25, 'unpaid', headCoach]);
    await assert.rejects(studentCall(db, 'student_portal_cancel_belt_test_request', [studentAccount, 'STU-M-001', event.id]), /Ask your coach/);

    // Fees: tracked only, revision-checked, validated.
    await assert.rejects(mutate(db, 'fee_update', { candidateId: candidate.id, revision: row.revision, status: 'paid', method: '', paidOn: tomorrow }), /how and when/);
    await assert.rejects(mutate(db, 'fee_update', { candidateId: candidate.id, revision: row.revision, status: 'waived', waiverReason: 'no' }), /why the fee/);
    const paid = await mutate(db, 'fee_update', { candidateId: candidate.id, revision: row.revision, status: 'paid', method: 'Cash', reference: 'R-1001', paidOn: (await one(db, "SELECT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)::text AS d")).d });
    assert.equal(paid.feeStatus, 'paid');
    await assert.rejects(mutate(db, 'fee_update', { candidateId: candidate.id, revision: row.revision, status: 'unpaid' }), /changed/);
    const feed = (await one(db, "SELECT portal_student_belt_tests('STU-M-001') AS r")).r;
    assert.equal(feed.upcoming[0].feeStatus, 'paid');
    assert.ok(beltTestsV1.safeParse(feed).success);

    // Raise capacity; STU-M-002 requests and is declined with a reason the student sees.
    await assert.rejects(mutate(db, 'event_update', { id: event.id, title: 'Yellow test', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1, capacity: null, acceptsRequests: true }).then(() => mutate(db, 'event_update', { id: event.id, title: 'Yellow test', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1, capacity: 0 })), /Capacity/);
    await db.query("UPDATE profiles SET student_id='STU-M-002' WHERE id=$1", [studentAccount]);
    await studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-002', event.id, randomUUID()]);
    const second = await one(db, "SELECT id FROM grading_candidates WHERE event_id=$1 AND student_id='STU-M-002'", [event.id]);
    await assert.rejects(mutate(db, 'decline_request', { id: second.id, reason: 'no' }), /at least 5/);
    await mutate(db, 'decline_request', { id: second.id, reason: 'Please attend two more sparring classes first' });
    const declined = (await one(db, "SELECT portal_student_belt_tests('STU-M-002') AS r")).r.upcoming[0];
    assert.equal(declined.registration, 'declined');
    assert.match(declined.declineReason, /sparring/);
    await assert.rejects(studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-002', event.id, randomUUID()]), /declined/);
    // Staff can still register a declined student.
    assert.equal((await mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-002' })).status, 'registered');

    // An update that leaves capacity out keeps the limit.
    await mutate(db, 'event_update', { id: event.id, title: 'Yellow test', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1, capacity: 5 });
    await mutate(db, 'event_update', { id: event.id, title: 'Yellow test day', examDate: tomorrow, startTime: '09:00', location: 'Main hall', branchId: 1 });
    assert.equal((await one(db, 'SELECT capacity FROM grading_events WHERE id=$1', [event.id])).capacity, 5);

    // A student the coach withdrew cannot request again from the student portal.
    const registeredSecond = await one(db, "SELECT id FROM grading_candidates WHERE event_id=$1 AND student_id='STU-M-002'", [event.id]);
    await mutate(db, 'withdraw', { id: registeredSecond.id, reason: 'Injured before the test' });
    const withdrawn = (await one(db, "SELECT portal_student_belt_tests('STU-M-002') AS r")).r.upcoming[0];
    assert.equal(withdrawn.registration, null);
    assert.equal(withdrawn.canRequest, false);
    await assert.rejects(studentCall(db, 'student_portal_request_belt_test', [studentAccount, 'STU-M-002', event.id, randomUUID()]), /withdrawn from this test day/);
    const activity = (await db.query("SELECT title FROM student_activity_events WHERE category='grading' ORDER BY created_at")).rows.map(row => row.title);
    assert.ok(activity.includes('Requested a belt test') && activity.includes('Belt test request approved') && activity.includes('Belt test request declined'));
  } finally { await db.close(); }
});

test('examiner panel: only the panel scores, items use its average, examiners stay private', async () => {
  const { db, today, yellow } = await setup();
  try {
    await attend(db);
    const syllabus = await mutate(db, 'syllabus_save', syllabusPayload(yellow));
    await mutate(db, 'syllabus_publish', { id: syllabus.id, revision: syllabus.revision });
    const event = await mutate(db, 'event_create', { syllabusId: syllabus.id, title: 'Yellow test', examDate: today, startTime: '09:00', location: 'Main hall', branchId: 1 });
    const candidate = await mutate(db, 'register', { eventId: event.id, studentId: 'STU-M-001' });
    await assert.rejects(mutate(db, 'examiners_set', { eventId: event.id, examiners: [coach, secondCoach, headCoach, root, coach, coach] }), /up to 5/);
    await assert.rejects(mutate(db, 'examiners_set', { eventId: event.id, examiners: [randomUUID()] }), /active coach/);
    assert.equal((await mutate(db, 'examiners_set', { eventId: event.id, examiners: [coach, secondCoach] })).examiners.length, 2);

    const items = (await db.query('SELECT i.id,i.title FROM belt_test_items i JOIN belt_test_sections x ON x.id=i.section_id WHERE x.syllabus_id=$1', [syllabus.id])).rows;
    const item = title => items.find(row => row.title === title).id;
    const score = (actor, title, value, revision = 0) => mutate(db, 'score', { candidateId: candidate.id, itemId: item(title), score: value, note: '', revision }, actor);
    await assert.rejects(score(headCoach, 'Push-ups', 9), /panel can score/, 'a manager outside the panel cannot score');
    const own = await score(coach, 'Push-ups', 8);
    assert.equal(own.preview, null, 'examiners never receive the panel average');
    await score(coach, 'Taegeuk Il Jang', 7);
    let computed = (await one(db, 'SELECT portal_belt_test_compute($1) AS r', [candidate.id])).r;
    assert.equal(computed.scoredItems, 0, 'an item counts once every examiner has scored it');
    await score(secondCoach, 'Push-ups', 7.5);
    await score(secondCoach, 'Taegeuk Il Jang', 7.2);
    computed = (await one(db, 'SELECT portal_belt_test_compute($1) AS r', [candidate.id])).r;
    assert.equal(computed.complete, true);
    assert.deepEqual(computed.sections.map(row => Number(row.percent)), [78, 71], 'Push-ups (8+7.5)/2 = 7.75 → 7.8; Poomsae (7+7.2)/2 = 7.1');
    assert.equal(Number(computed.overall), 74.5);

    // TypeScript mirror on exactly what the database holds.
    const rows = (await db.query('SELECT item_id,score,scored_by FROM grading_item_scores WHERE candidate_id=$1', [candidate.id])).rows.map(row => ({ ...row, score: Number(row.score) }));
    const scores = panelItemScores(rows, [coach, secondCoach]);
    const sections = (await db.query('SELECT * FROM belt_test_sections WHERE syllabus_id=$1 ORDER BY position', [syllabus.id])).rows;
    const ts = computeBeltTestResult({ passMark: 70, distinctionMark: 90, sectionMinimum: 60, criticalMinimum: 5 },
      sections.map(section => ({ id: section.id, kind: section.kind, title: section.title, weight: Number(section.weight), minimum: null, items: items.filter(row => (row.title === 'Push-ups') === (section.kind === 'physical')).map(row => ({ id: row.id, weight: 1, critical: row.title !== 'Push-ups' })) })), scores);
    assert.equal(ts.overall, Number(computed.overall));
    assert.equal(ts.result, computed.result);

    // Each examiner revises only their own row.
    await assert.rejects(score(secondCoach, 'Push-ups', 9, 0), /changed/);
    await score(secondCoach, 'Push-ups', 9, 1);
    assert.equal(Number((await one(db, "SELECT score FROM portal_belt_test_item_scores($1) WHERE item_id=$2", [candidate.id, item('Push-ups')])).score), 8.5);
    const finalized = await mutate(db, 'finalize', { candidateId: candidate.id, revision: (await one(db, 'SELECT revision FROM grading_candidates WHERE id=$1', [candidate.id])).revision });
    assert.equal(finalized.result, 'pass');
    await assert.rejects(mutate(db, 'examiners_set', { eventId: event.id, examiners: [coach] }), /locked/);
  } finally { await db.close(); }
});
