import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

// Every LMS create / read / update / delete, through the real Coaching API route
// (strict request schema → RPC mapping → SQL function) on a PGlite copy of the
// schema, checking the stored rows and the message staff see.
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const assistant = '94000000-0000-4000-8000-000000000001';
const student = '94000000-0000-4000-8000-000000000002';
const migrations = fs.readdirSync('supabase/migrations').filter(name => name >= '20261026' && name.endsWith('.sql')).sort();
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const count = async (db, from, params = []) => Number((await one(db, `SELECT count(*)::int AS n FROM ${from}`, params)).n);

let db, actor = { userId: coach, role: 'Coach' }, lessonA, lessonB, lessonC, monday, route, announcements;

/** A Supabase client whose rpc() runs the named SQL function on PGlite. */
const fakeClient = () => ({
  rpc(name, args) {
    const keys = Object.keys(args);
    const params = keys.map(key => args[key] !== null && typeof args[key] === 'object' ? JSON.stringify(args[key]) : args[key]);
    const run = () => db.query(`SELECT public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) AS r`, params)
      .then(result => ({ data: result.rows[0].r, error: null }), error => ({ data: null, error: { code: error.code, message: error.message } }));
    return { abortSignal: run, then: (resolve, reject) => run().then(resolve, reject) };
  },
});
const stubs = () => ({
  '@/lib/backend-security': {
    verifyCaller: async () => ({ context: actor, adminSupabase: fakeClient() }),
    validateRequestBody: async (schema, req) => { const parsed = schema.safeParse(await req.json()); return parsed.success ? { data: parsed.data } : { errorResponse: Response.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 422 }) }; },
  },
  // A generic fallback, so a test notices if an LMS message was not passed through.
  '@/lib/operations-errors': { operationsError: () => Response.json({ success: false, error: { message: 'GENERIC' } }, { status: 500 }) },
});
async function call(handler, url, body) {
  const response = await handler(new Request('http://portal.test' + url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
  const json = await response.json();
  return { status: response.status, data: json.data, message: json.error?.message };
}
const post = body => call(route.POST, '/api/admin/lms', body);
const ok = async body => { const result = await post(body); assert.equal(result.status, 200, `${body.action}: ${result.message}`); return result.data; };
const refused = async (body, status, pattern) => { const result = await post(body); assert.equal(result.status, status, `${body.action}: ${result.status} ${result.message}`); assert.match(result.message, pattern); return result; };
const as = async (who, work) => { const previous = actor; actor = who; try { return await work(); } finally { actor = previous; } };
const event = (kind, payload) => db.query('SELECT student_portal_record_event($1,$2,$3,$4,$5) AS r', [student, 'STU-M-001', randomUUID(), kind, JSON.stringify(payload)]);

async function publishLesson(title, belt, category) {
  const description = JSON.stringify({ text: title, instructions: ['Step one'] });
  const input = { title, description, library_type: 'Taekwondo', tkd_category: 'Chagi', fitness_category: null, target_level: belt, video_url: '' };
  const q = async (sql, params) => (await one(db, sql, params)).r;
  let asset = (await q('SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,$5) AS r', [root, 'CREATE', null, JSON.stringify({ ...input, studentProjection: libraryPublicationProjection(input) }), randomUUID()])).asset;
  asset = (await q('SELECT portal_save_library_content($1,$2,$3::jsonb) AS r', [root, asset.id, JSON.stringify({ expectedRevision: asset.revision,
    metadata: { categoryId: category, kind: 'lesson', slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), koreanName: null, romanized: null, summary: null, levelNote: null, tags: [] }, content: { sections: [], translations: {}, sources: [] } })])).asset;
  return (await q('SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'PUBLISH', asset.id, JSON.stringify({ expectedRevision: asset.revision, reason: 'Ready', studentProjection: libraryPublicationProjection(input) })])).studentLesson.id;
}

test.before(async () => {
  db = await operationsDatabase();
  for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}`, 'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'assistant2@example.test'),($2,'athlete2@example.test')", [assistant, student]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role) VALUES($1,'assistant2','assistant2@example.test','Assistant','Assistant Coach')", [assistant]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id,is_active,must_change_password) VALUES($1,'athlete2','athlete2@example.test','Athlete','Student','STU-M-001',true,false)", [student]);
  await db.exec("UPDATE students SET current_belt='White',belt_id=1; INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true;");
  const category = (await one(db, 'SELECT portal_save_library_category($1,$2,$3,$4::jsonb) AS r', [root, 'CREATE', null, JSON.stringify({ slug: 'kicking-fundamentals', title: 'Kicking', koreanTitle: null, subtitle: null, description: null, icon: 'Lightning', accentColor: '#EF2F38', libraryType: 'Taekwondo', isActive: true, translations: {} })])).r;
  lessonA = await publishLesson('Front Kick', 'White', category.id);
  lessonB = await publishLesson('Taegeuk Il Jang', 'White', category.id);
  lessonC = await publishLesson('Taegeuk I Jang', 'White', category.id);
  monday = (await one(db, "SELECT (d-(extract(isodow FROM d)::int-1))::text AS m FROM (SELECT (now() AT TIME ZONE 'Asia/Phnom_Penh')::date d) x")).m;
  route = loadTs('app/api/admin/lms/route.ts', stubs());
  announcements = loadTs('app/api/admin/lms/announcements/route.ts', stubs());
});
test.after(async () => { await db?.close(); });

test('forms: create, read, update, stale update, reorder, guarded delete, delete; Assistant Coach refused', async () => {
  const input = (curriculumId, extra = {}) => ({ curriculumId, name: 'Taegeuk Il Jang', koreanName: '태극 1장', series: 'Taegeuk', beltId: 1, movementCount: 18, published: false, translations: { km: { name: 'តែហ្គឹក ១' } }, ...extra });
  await as({ userId: assistant, role: 'Assistant Coach' }, () => refused({ action: 'form.save', form: input(lessonB) }, 403, /./));
  await refused({ action: 'form.save', form: input(999999) }, 400, /library lesson/);
  const created = await ok({ action: 'form.save', form: input(lessonB) });
  assert.deepEqual([created.name, created.published, created.revision, created.translations.km.name], ['Taegeuk Il Jang', false, 1, 'តែហ្គឹក ១']);
  await refused({ action: 'form.save', form: input(lessonB, { name: 'Copy' }) }, 409, /already uses this lesson/);
  const updated = await ok({ action: 'form.save', id: created.id, expectedRevision: 1, form: input(lessonB, { published: true, movementCount: 19 }) });
  assert.deepEqual([updated.revision, updated.published, updated.movement_count], [2, true, 19]);
  await refused({ action: 'form.save', id: created.id, expectedRevision: 1, form: input(lessonB) }, 409, /changed\. Reload/);
  const second = await ok({ action: 'form.save', form: input(lessonC, { name: 'Taegeuk I Jang', published: true }) });
  assert.equal((await ok({ action: 'form.reorder', order: [second.id, created.id] })).reordered, 2);
  assert.deepEqual((await db.query('SELECT name FROM poomsae_forms ORDER BY sort_order')).rows.map(r => r.name), ['Taegeuk I Jang', 'Taegeuk Il Jang']);
  assert.equal((await one(db, "SELECT portal_student_forms('STU-M-001') AS r")).r.forms.length, 2, 'students read both published forms');
  await event('form_practice', { formId: created.id, mode: 'free', movements: 19, durationSeconds: 60 });
  await refused({ action: 'form.delete', id: created.id, expectedRevision: 2 }, 409, /progress on this form/);
  await ok({ action: 'quiz.save', question: { scope: 'form', scopeRef: second.id, kind: 'choice', prompt: 'Q', choices: ['A', 'B'], answer: 0, published: true, translations: {} } });
});

test('forms: delete removes the form and its quiz questions', async () => {
  const form = await one(db, "SELECT id,revision FROM poomsae_forms WHERE name='Taegeuk I Jang'");
  await refused({ action: 'form.delete', id: form.id, expectedRevision: form.revision + 5 }, 409, /changed/);
  assert.equal((await ok({ action: 'form.delete', id: form.id, expectedRevision: form.revision })).deleted, form.id);
  assert.equal(await count(db, 'quiz_questions WHERE scope_ref=$1', [form.id]), 0);
  await refused({ action: 'form.delete', id: form.id, expectedRevision: form.revision }, 404, /not found/);
});

test('quiz: create, read (published only), update, delete', async () => {
  const form = await one(db, "SELECT id FROM poomsae_forms WHERE name='Taegeuk Il Jang'");
  const question = extra => ({ scope: 'form', scopeRef: form.id, kind: 'next_movement', prompt: 'After the low block?', choices: ['Punch', 'Kick'], answer: 0, published: true, translations: {}, ...extra });
  await refused({ action: 'quiz.save', question: question({ scope: 'lesson', scopeRef: '999999' }) }, 400, /published lesson/);
  const q = await ok({ action: 'quiz.save', question: question() });
  const draft = await ok({ action: 'quiz.save', question: question({ prompt: 'Draft', published: false }) });
  const read = () => one(db, "SELECT portal_student_quiz('STU-M-001','form',$1) AS r", [form.id]).then(row => row.r.questions.map(x => x.prompt));
  assert.deepEqual(await read(), ['After the low block?']);
  const changed = await ok({ action: 'quiz.save', id: q.id, expectedRevision: 1, question: question({ answer: 1, explanation: 'A punch follows.', translations: { km: { prompt: 'បន្ទាប់ពីការការពារទាប?' } } }) });
  assert.deepEqual([changed.answer, changed.explanation, changed.revision], [1, 'A punch follows.', 2]);
  await ok({ action: 'quiz.save', id: draft.id, expectedRevision: 1, question: question({ prompt: 'Now live' }) });
  assert.deepEqual((await read()).sort(), ['After the low block?', 'Now live']);
  assert.equal((await ok({ action: 'quiz.delete', id: q.id, expectedRevision: 2 })).deleted, q.id);
  await refused({ action: 'quiz.delete', id: q.id, expectedRevision: 2 }, 404, /not found/);
});

test('weekly plans: save, edit, publish, unpublish, stale save, delete', async () => {
  const items = [{ type: 'lesson', ref: String(lessonA), title: 'Front kick', target: '3 x 10', day: 1 }];
  await refused({ action: 'plan.save', studentId: 'STU-M-001', weekStart: '2026-11-11', items, note: null }, 400, /Monday/);
  let plan = await ok({ action: 'plan.save', studentId: 'STU-M-001', weekStart: monday, items, note: 'Chamber high' });
  plan = await ok({ action: 'plan.save', studentId: 'STU-M-001', weekStart: monday, expectedRevision: plan.revision, items: [...items, { type: 'custom', title: 'Stretch 10 minutes', day: 2 }], note: null });
  assert.deepEqual([plan.revision, plan.items.length, plan.note], [2, 2, null]);
  await refused({ action: 'plan.save', studentId: 'STU-M-001', weekStart: monday, expectedRevision: 1, items, note: null }, 409, /changed/);
  plan = await ok({ action: 'plan.publish', studentId: 'STU-M-001', weekStart: monday, expectedRevision: plan.revision });
  assert.ok(plan.published_at);
  assert.equal((await one(db, "SELECT portal_student_learning('STU-M-001') AS r")).r.plans.length, 1);
  plan = await ok({ action: 'plan.unpublish', studentId: 'STU-M-001', weekStart: monday, expectedRevision: plan.revision });
  assert.equal(plan.published_at, null);
  assert.equal((await ok({ action: 'plan.delete', studentId: 'STU-M-001', weekStart: monday, expectedRevision: plan.revision })).deleted, plan.id);
  await refused({ action: 'plan.publish', studentId: 'STU-M-001', weekStart: monday, expectedRevision: 1 }, 404, /Save the plan first/);
});

test('goals: coach sets, a new weekly goal replaces the old one, done, drop', async () => {
  const a = await ok({ action: 'goal.set', studentId: 'STU-M-001', goal: { kind: 'weekly_days', target: 3 } });
  const b = await ok({ action: 'goal.set', studentId: 'STU-M-001', goal: { kind: 'weekly_days', target: 4 } });
  assert.deepEqual((await db.query('SELECT id,status FROM student_goals WHERE id IN ($1,$2) ORDER BY created_at', [a.id, b.id])).rows.map(r => r.status), ['dropped', 'active']);
  await refused({ action: 'goal.set', studentId: 'STU-M-001', goal: { kind: 'lesson', subjectRef: '999999' } }, 400, /lesson open to this belt/);
  const c = await ok({ action: 'goal.set', studentId: 'STU-M-001', goal: { kind: 'custom', title: 'Split by December' } });
  assert.equal((await ok({ action: 'goal.done', studentId: 'STU-M-001', goalId: b.id })).status, 'done');
  assert.equal((await ok({ action: 'goal.drop', studentId: 'STU-M-001', goalId: c.id })).status, 'dropped');
  await refused({ action: 'goal.drop', studentId: 'STU-M-001', goalId: c.id }, 404, /no longer active/);
});

test('assignments: create, edit draft, publish, retarget, student status, close, reopen, guarded delete, delete', async () => {
  const input = extra => ({ title: 'Front kicks', instructions: 'Kick 20 times.', kind: 'practice', subjectType: 'lesson', subjectRef: String(lessonA), target: { reps: 20 },
    dueAt: new Date(Date.now() + 5 * 864e5).toISOString(), points: 10, rubric: [], targets: [{ type: 'student', ref: 'STU-M-001' }], translations: {}, ...extra });
  let a = await ok({ action: 'assignment.save', assignment: input() });
  a = await ok({ action: 'assignment.save', id: a.id, expectedRevision: a.revision, assignment: input({ title: 'Front kicks x20', points: 15 }) });
  assert.deepEqual([a.title, a.points, a.status, a.students], ['Front kicks x20', 15, 'draft', 0]);
  a = await ok({ action: 'assignment.publish', id: a.id, expectedRevision: a.revision });
  assert.deepEqual([a.status, a.students], ['published', 1]);
  await refused({ action: 'assignment.save', id: a.id, expectedRevision: a.revision, assignment: input({ kind: 'video', target: {} }) }, 400, /keeps its kind/);
  a = await ok({ action: 'assignment.save', id: a.id, expectedRevision: a.revision, assignment: input({ title: 'Front kicks x20', points: 15, targets: [{ type: 'belt', ref: 'White' }] }) });
  assert.equal(a.students, 2, 're-targeting a published assignment adds the new students');
  const set = (status, studentId = 'STU-M-002') => ok({ action: 'assignment.student', id: a.id, studentId, status, note: status === 'excused' ? 'Injured' : null });
  await set('done');
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-002' AND reason='assignment'"), 1);
  await set('open');
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-002' AND reason='assignment'"), 0, 'reopening removes the points');
  assert.equal((await set('excused')).note, 'Injured');
  a = await ok({ action: 'assignment.close', id: a.id, expectedRevision: a.revision });
  await refused({ action: 'assignment.close', id: a.id, expectedRevision: a.revision }, 400, /Only a published/);
  a = await ok({ action: 'assignment.reopen', id: a.id, expectedRevision: a.revision });
  await refused({ action: 'assignment.delete', id: a.id, expectedRevision: a.revision }, 409, /Close it instead/);
  const draft = await ok({ action: 'assignment.save', assignment: input({ title: 'Spare' }) });
  assert.equal((await ok({ action: 'assignment.delete', id: draft.id, expectedRevision: draft.revision })).deleted, draft.id);
  assert.equal(await count(db, 'assignment_targets WHERE assignment_id=$1', [draft.id]), 0, 'targets go with it');
  await refused({ action: 'assignment.save', assignment: input({ targets: [{ type: 'class', ref: '424242' }] }) }, 400, /no longer available/);
});

test('challenges: create, edit, publish, locked goal, close, guarded delete, delete', async () => {
  const day = (await one(db, "SELECT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)::text AS d")).d;
  const input = extra => ({ title: 'Kick 15 times', description: null, goalKind: 'reps', goalTarget: 15, subjectType: 'lesson', subjectRef: String(lessonA), startsOn: day, endsOn: day, audience: { all: true }, points: 5, badgeCode: null, translations: {}, ...extra });
  let c = await ok({ action: 'challenge.save', challenge: input() });
  c = await ok({ action: 'challenge.save', id: c.id, expectedRevision: c.revision, challenge: input({ description: 'Both legs', goalTarget: 12 }) });
  assert.deepEqual([c.description, c.goal_target], ['Both legs', 12]);
  c = await ok({ action: 'challenge.publish', id: c.id, expectedRevision: c.revision });
  await refused({ action: 'challenge.save', id: c.id, expectedRevision: c.revision, challenge: input({ goalTarget: 99 }) }, 400, /keeps its goal/);
  await event('lesson', { lessonId: lessonA, repetitionsCount: 5 });
  assert.equal((await one(db, 'SELECT progress FROM student_challenge_progress WHERE challenge_id=$1', [c.id])).progress, 5);
  c = await ok({ action: 'challenge.close', id: c.id, expectedRevision: c.revision });
  await refused({ action: 'challenge.delete', id: c.id, expectedRevision: c.revision }, 409, /progress on this challenge/);
  const draft = await ok({ action: 'challenge.save', challenge: input({ title: 'Spare' }) });
  assert.equal((await ok({ action: 'challenge.delete', id: draft.id, expectedRevision: draft.revision })).deleted, draft.id);
  await refused({ action: 'challenge.save', challenge: input({ badgeCode: 'no_such_badge' }) }, 400, /badge from the catalogue/);
});

test('achievements: create, edit, turn off, award, duplicate, revoke, re-award once, guarded delete, delete', async () => {
  const input = extra => ({ title: 'Kicks 100', description: 'Log 100 practice sessions.', icon: 'Lightning', rule: { kind: 'manual' }, points: 20, repeats: 'once', active: true, translations: {}, ...extra });
  let d = await ok({ action: 'achievement.save', code: 'kicks_100', create: true, definition: input() });
  await refused({ action: 'achievement.save', code: 'kicks_100', create: true, definition: input() }, 409, /"kicks_100" is already used/);
  d = await ok({ action: 'achievement.save', code: 'kicks_100', create: false, expectedRevision: d.revision, definition: input({ active: false, translations: { zh: { title: '踢腿100' } } }) });
  assert.deepEqual([d.active, d.translations.zh.title, d.revision], [false, '踢腿100', 2]);
  const award = extra => ({ action: 'achievement.award', studentId: 'STU-M-001', code: 'kicks_100', period: null, note: null, ...extra });
  await refused(award(), 400, /Turn this achievement on/);
  d = await ok({ action: 'achievement.save', code: 'kicks_100', create: false, expectedRevision: d.revision, definition: input() });
  assert.equal((await ok(award({ note: 'Great work' }))).awarded, true);
  await refused(award(), 409, /already has this achievement/);
  await refused({ action: 'achievement.delete', code: 'kicks_100', expectedRevision: d.revision }, 409, /Turn it off instead/);
  await ok({ ...award(), action: 'achievement.revoke', period: '' });
  await refused({ ...award(), action: 'achievement.revoke', period: '' }, 404, /does not have/);
  await ok(award());
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-001' AND reason='achievement' AND ref='kicks_100:'"), 1, 'points once after re-award');
  await ok({ ...award(), action: 'achievement.revoke', period: '' });
  assert.equal((await ok({ action: 'achievement.delete', code: 'kicks_100', expectedRevision: d.revision })).deleted, 'kicks_100');
});

test('consent, form review and submission review through the route', async () => {
  await refused({ action: 'consent.record', studentId: 'STU-M-001', consent: { revoke: true } }, 404, /no active consent/);
  const recorded = await ok({ action: 'consent.record', studentId: 'STU-M-001', consent: { guardianName: 'Fixture Parent', relationship: 'parent' } });
  assert.deepEqual([recorded.source, recorded.revoked_at], ['staff', null]);
  assert.ok((await ok({ action: 'consent.record', studentId: 'STU-M-001', consent: { revoke: true } })).revoked_at);
  await ok({ action: 'consent.record', studentId: 'STU-M-001', consent: { guardianName: 'Fixture Parent', relationship: 'guardian' } });

  const form = await one(db, "SELECT id FROM poomsae_forms WHERE name='Taegeuk Il Jang'");
  assert.equal((await ok({ action: 'form.review', studentId: 'STU-M-001', formId: form.id, review: { decision: 'mastered', note: 'Clean' } })).status, 'mastered');
  const back = await ok({ action: 'form.review', studentId: 'STU-M-001', formId: form.id, review: { decision: 'practising', note: null } });
  assert.deepEqual([back.status, back.mastered_by, back.mastered_at], ['practising', null, null], 'a coach can take mastered back');

  const written = await ok({ action: 'assignment.save', assignment: { title: 'Meaning', instructions: 'What does Il Jang mean?', kind: 'written', subjectType: null, subjectRef: null, target: {}, dueAt: null, points: 5, rubric: [{ item: 'Accuracy' }], targets: [{ type: 'student', ref: 'STU-M-001' }], translations: {} } });
  await ok({ action: 'assignment.publish', id: written.id, expectedRevision: written.revision });
  const started = (await one(db, 'SELECT student_portal_start_submission($1,$2,$3,$4) AS r', [student, 'STU-M-001', randomUUID(), JSON.stringify({ kind: 'text', assignmentId: written.id, textAnswer: 'Heaven' })])).r;
  const review = decision => ({ action: 'submission.review', id: started.submission.id, review: { decision, grade: 'Developing', feedback: 'Add more', rubric: [{ item: 'Accuracy', grade: 'Developing', note: '' }], moments: [], visibleToStudent: true } });
  assert.equal((await ok(review('returned'))).submission.status, 'returned');
  assert.equal((await ok(review('accepted'))).submission.status, 'reviewed');
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1', [written.id])).status, 'done');
  assert.equal(await count(db, 'submission_reviews WHERE submission_id=$1', [started.submission.id]), 2, 'every review is kept');
  await refused({ action: 'submission.review', id: randomUUID(), review: review('accepted').review }, 404, /not found/);

  // A student withdraws a video before review; the assignment opens again.
  const video = await ok({ action: 'assignment.save', assignment: { title: 'Film it', instructions: 'Record the form.', kind: 'video', subjectType: null, subjectRef: null, target: {}, dueAt: null, points: 0, rubric: [], targets: [{ type: 'student', ref: 'STU-M-001' }], translations: {} } });
  await ok({ action: 'assignment.publish', id: video.id, expectedRevision: video.revision });
  const upload = (await one(db, 'SELECT student_portal_start_submission($1,$2,$3,$4) AS r', [student, 'STU-M-001', randomUUID(), JSON.stringify({ kind: 'video', assignmentId: video.id, mimeType: 'video/webm', bytes: 1000, videoSeconds: 30 })])).r;
  await one(db, 'SELECT student_portal_finish_submission($1,$2,$3,$4) AS r', [student, 'STU-M-001', upload.submission.id, '{}']);
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1', [video.id])).status, 'submitted');
  const withdrawn = (await one(db, 'SELECT student_portal_withdraw_submission($1,$2,$3) AS r', [student, 'STU-M-001', upload.submission.id])).r;
  assert.equal(withdrawn.submission.status, 'withdrawn');
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1', [video.id])).status, 'open');
  assert.ok((await one(db, 'SELECT portal_lms_videos_to_delete(50) AS r')).r.some(item => item.id === upload.submission.id), 'the withdrawn file is queued for deletion');
});

test('announcements route: send, retry with the same key, Assistant Coach refused; bad input never reaches SQL', async () => {
  const body = key => ({ requestKey: key, announcement: { title: 'Grading', body: 'Bring your belt.', audience: { students: ['STU-M-001'] }, translations: {} } });
  const key = randomUUID();
  // Sending needs action:announcements_send (Admin and above by default); a Coach is refused below.
  const send = (who, b) => as(who, () => call(announcements.POST, '/api/admin/lms/announcements', b));
  const admin = { userId: root, role: 'Root' };
  const first = await send(admin, body(key));
  assert.equal(first.status, 200, first.message);
  assert.equal((await send(admin, body(key))).data.id, first.data.id);
  for (const who of [{ userId: coach, role: 'Coach' }, { userId: assistant, role: 'Assistant Coach' }]) {
    const denied = await send(who, body(randomUUID()));
    assert.deepEqual([denied.status, denied.message], [403, 'Permission denied']);
  }
  const invalid = await post({ action: 'assignment.save', assignment: { title: '' } });
  assert.equal(invalid.status, 422, 'the strict schema stops it first');
});

test('integrity: lesson and form deletes explain what blocks them; a repeated withdraw is a no-op', async () => {
  // A lesson a form uses, and a lesson an open assignment uses.
  await assert.rejects(db.query('DELETE FROM curriculum WHERE id=$1', [lessonB]), /A poomsae form uses this lesson/);
  await assert.rejects(db.query('DELETE FROM curriculum WHERE id=$1', [lessonA]), /An assignment or challenge uses this lesson/);

  // A free lesson: deleting it through the library removes its quiz and drops goals on it.
  const lessonD = await publishLesson('Spare Lesson', 'White', (await one(db, "SELECT id FROM library_categories WHERE slug='kicking-fundamentals'")).id);
  await ok({ action: 'quiz.save', question: { scope: 'lesson', scopeRef: String(lessonD), kind: 'choice', prompt: 'Q', choices: ['A', 'B'], answer: 0, published: true, translations: {} } });
  const goal = await ok({ action: 'goal.set', studentId: 'STU-M-001', goal: { kind: 'lesson', subjectRef: String(lessonD) } });
  let asset = await one(db, 'SELECT id,revision FROM library_assets WHERE student_curriculum_id=$1', [lessonD]);
  asset = (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'UNPUBLISH', asset.id, JSON.stringify({ expectedRevision: asset.revision, reason: 'Removing the lesson' })])).r.asset;
  await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'DELETE', asset.id, JSON.stringify({ expectedRevision: asset.revision })]);
  assert.equal(await count(db, "quiz_questions WHERE scope='lesson' AND scope_ref=$1", [String(lessonD)]), 0);
  assert.equal((await one(db, 'SELECT status FROM student_goals WHERE id=$1', [goal.id])).status, 'dropped');

  // A form an open assignment uses cannot be deleted until the assignment is closed.
  const lessonE = await publishLesson('Spare Form Lesson', 'White', (await one(db, "SELECT id FROM library_categories WHERE slug='kicking-fundamentals'")).id);
  const form = await ok({ action: 'form.save', form: { curriculumId: lessonE, name: 'Spare form', koreanName: null, series: 'Taegeuk', beltId: null, movementCount: 8, published: true, translations: {} } });
  let task = await ok({ action: 'assignment.save', assignment: { title: 'Perform it', instructions: 'Film the form.', kind: 'form', subjectType: 'form', subjectRef: form.id, target: {}, dueAt: null, points: 0, rubric: [], targets: [{ type: 'student', ref: 'STU-M-002' }], translations: {} } });
  task = await ok({ action: 'assignment.publish', id: task.id, expectedRevision: task.revision });
  await refused({ action: 'form.delete', id: form.id, expectedRevision: form.revision }, 409, /An assignment or challenge uses this form/);
  await ok({ action: 'assignment.close', id: task.id, expectedRevision: task.revision });
  assert.equal((await ok({ action: 'form.delete', id: form.id, expectedRevision: form.revision })).deleted, form.id);

  // Withdrawing twice (a double tap) returns the withdrawn submission.
  const withdrawn = await one(db, "SELECT id FROM student_submissions WHERE status='withdrawn' LIMIT 1");
  const again = (await one(db, 'SELECT student_portal_withdraw_submission($1,$2,$3) AS r', [student, 'STU-M-001', withdrawn.id])).r;
  assert.equal(again.submission.status, 'withdrawn');
});
test('error messages: plain LMS messages reach staff; raw database errors never do', () => {
  const { lmsErrorResponse } = loadTs('lib/lms-server.ts');
  const fallback = () => new Response('{"fallback":true}', { status: 500 });
  assert.equal(lmsErrorResponse({ code: '22023', message: 'Set the reps or sessions to reach' }, fallback).status, 400);
  assert.equal(lmsErrorResponse({ code: '40001', message: 'This assignment changed. Reload before saving' }, fallback).status, 409);
  assert.equal(lmsErrorResponse({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }, fallback).status, 500, 'raw: fallback');
  assert.equal(lmsErrorResponse({ code: '22023', message: 'invalid input syntax for type uuid: "x"' }, fallback).status, 500);
  assert.equal(lmsErrorResponse({ code: 'PGRST202', message: 'Could not find the function' }, fallback).status, 503);
});
