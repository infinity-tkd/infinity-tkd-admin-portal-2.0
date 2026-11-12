import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as zod from 'zod';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

// End to end over the three LMS migrations (docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md).
// The fixture already holds the schema up to 20261025; every later migration is applied.
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const lmsContract = loadTs('lib/lms-contract.ts');

const assistant = '93000000-0000-4000-8000-000000000001';
const student = '93000000-0000-4000-8000-000000000002';
const otherStudent = '93000000-0000-4000-8000-000000000003';
const migrations = fs.readdirSync('supabase/migrations').filter(name => name >= '20261026' && name.endsWith('.sql')).sort();

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const call = async (db, fn, args) => (await one(db, `SELECT ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS r`, args)).r;
const event = (db, kind, payload, key = randomUUID(), actor = student, id = 'STU-M-001') => call(db, 'student_portal_record_event', [actor, id, key, kind, payload]);
const asServer = db => db.query("SELECT set_config('request.jwt.role','service_role',false)");
const asAnon = db => db.query("SELECT set_config('request.jwt.role','anon',false)");
const count = async (db, sql, params = []) => Number((await one(db, `SELECT count(*)::int AS n FROM ${sql}`, params)).n);

const steps = [{ id: 'how-to', type: 'technique-steps', title: 'Step by step', video: 'https://www.youtube.com/watch?v=abc123',
  items: [{ id: 'chamber', title: 'Chamber', body: 'Lift the knee.', clip: { start: 1, end: 4 }, mistakes: [{ mistake: 'Knee low', correction: 'Lift it' }], checklist: ['Knee up', 'Guard up'] },
    { id: 'extension', title: 'Extension', body: 'Snap the kick.', clip: { start: 4, end: 7 }, mistakes: [], checklist: ['Hips through'] }] }];

let db, kicks, lessonOpen, lessonForm, lessonYellow, form, today;

async function publishLesson(title, belt, sections = []) {
  const description = JSON.stringify({ text: title + ' overview', instructions: ['Step one'] });
  const input = { title, description, library_type: 'Taekwondo', tkd_category: 'Chagi', fitness_category: null, target_level: belt, video_url: '' };
  let asset = (await call(db, 'portal_save_library_asset', [root, 'CREATE', null, JSON.stringify({ ...input, studentProjection: libraryPublicationProjection(input) }), randomUUID()])).asset;
  asset = (await call(db, 'portal_save_library_content', [root, asset.id, JSON.stringify({ expectedRevision: asset.revision,
    metadata: { categoryId: kicks.id, kind: 'lesson', slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), koreanName: null, romanized: null, summary: title, levelNote: null, tags: [] },
    content: { sections, translations: {}, sources: [] } })])).asset;
  const published = await call(db, 'portal_save_library_asset', [root, 'PUBLISH', asset.id, JSON.stringify({ expectedRevision: asset.revision, reason: 'Ready for students', studentProjection: libraryPublicationProjection(input) }), null]);
  return published.studentLesson.id;
}

test.before(async () => {
  db = await operationsDatabase();
  for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}`, 'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'assistant@example.test'),($2,'athlete@example.test'),($3,'other@example.test')", [assistant, student, otherStudent]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role) VALUES($1,'assistant','assistant@example.test','Assistant','Assistant Coach')", [assistant]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id,is_active,must_change_password) VALUES($1,'athlete','athlete@example.test','Athlete','Student','STU-M-001',true,false),($2,'other','other@example.test','Other','Student','STU-M-002',true,false)", [student, otherStudent]);
  await db.exec("INSERT INTO belts(id,belt_name,belt_order,belt_type) VALUES(3,'Green',3,'Color') ON CONFLICT DO NOTHING; UPDATE students SET current_belt='White',belt_id=1;");
  await db.exec("INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true");
  today = (await one(db, "SELECT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)::text AS d")).d;
  kicks = await call(db, 'portal_save_library_category', [root, 'CREATE', null, JSON.stringify({ slug: 'kicking-fundamentals', title: 'Kicking', koreanTitle: null, subtitle: null, description: null, icon: 'Lightning', accentColor: '#EF2F38', libraryType: 'Taekwondo', isActive: true, translations: {} })]);
  lessonOpen = await publishLesson('Front Kick', 'White', steps);
  lessonForm = await publishLesson('Taegeuk Il Jang', 'White');
  lessonYellow = await publishLesson('Yellow Lesson', 'Yellow');
  // The bug the design asks to fix: a lesson for "all belts" in any spelling.
  await db.query("UPDATE curriculum SET target_belt='all belts' WHERE id=$1", [lessonOpen]);
});
test.after(async () => { await db?.close(); });

test('activity: the library belt rule, idempotent request keys, unknown kinds refused', async () => {
  const key = randomUUID();
  const first = await event(db, 'lesson', { lessonId: lessonOpen, repetitionsCount: 5, completed: false }, key);
  const again = await event(db, 'lesson', { lessonId: lessonOpen, repetitionsCount: 5, completed: false }, key);
  assert.equal(first.id, again.id, 'a retried request is recorded once');
  assert.equal((await one(db, 'SELECT repetition_count FROM student_portal_progress WHERE curriculum_id=$1', [lessonOpen])).repetition_count, 5);
  await assert.rejects(event(db, 'lesson', { lessonId: lessonYellow, repetitionsCount: 1 }), /unavailable for belt/);
  await assert.rejects(event(db, 'teleport', {}), /Invalid event/);
  await assert.rejects(event(db, 'lesson', { lessonId: lessonOpen }, randomUUID(), otherStudent), /Student mismatch/);
});

test('staff content: forms and quiz questions need Coach or above; students see published ones only', async () => {
  await assert.rejects(call(db, 'portal_save_poomsae_form', [assistant, 'CREATE', null, JSON.stringify({ curriculumId: lessonForm, name: 'Taegeuk 1', series: 'Taegeuk', beltId: 1, movementCount: 18, published: true })]), /permission|not allowed|Staff/i);
  await assert.rejects(call(db, 'portal_save_poomsae_form', [student, 'CREATE', null, JSON.stringify({ curriculumId: lessonForm, name: 'Taegeuk 1', series: 'Taegeuk', beltId: 1, movementCount: 18 })]), /Staff access required/);
  form = await call(db, 'portal_save_poomsae_form', [coach, 'CREATE', null, JSON.stringify({ curriculumId: lessonForm, name: 'Taegeuk Il Jang', koreanName: '태극 1장', series: 'Taegeuk', beltId: 1, movementCount: 18, published: false, translations: { km: { name: 'តែហ្គឹក ១' } } })]);
  await assert.rejects(call(db, 'portal_save_poomsae_form', [coach, 'CREATE', null, JSON.stringify({ curriculumId: lessonForm, name: 'Copy', series: 'Taegeuk', movementCount: 18 })]), /already uses this lesson/);
  assert.deepEqual((await call(db, 'portal_student_forms', ['STU-M-001'])).forms, [], 'a draft form is hidden');
  await assert.rejects(call(db, 'portal_save_poomsae_form', [coach, 'UPDATE', form.id, JSON.stringify({ curriculumId: lessonForm, name: 'Taegeuk Il Jang', series: 'Taegeuk', beltId: 1, movementCount: 18, published: true, expectedRevision: 9 })]), /changed/);
  form = await call(db, 'portal_save_poomsae_form', [coach, 'UPDATE', form.id, JSON.stringify({ curriculumId: lessonForm, name: 'Taegeuk Il Jang', koreanName: '태극 1장', series: 'Taegeuk', beltId: 1, movementCount: 18, published: true, expectedRevision: 1, translations: {} })]);
  const forms = await call(db, 'portal_student_forms', ['STU-M-001']);
  assert.equal(lmsContract.formsV1.parse(forms).forms[0].name, 'Taegeuk Il Jang');
  assert.equal(forms.forms[0].isCurrentBelt, true);
  assert.equal(forms.forms[0].progress.status, 'learning');

  const question = (extra = {}) => JSON.stringify({ scope: 'form', scopeRef: form.id, kind: 'next_movement', prompt: 'What comes after the low block?', choices: ['Middle punch', 'High block'], answer: 0, published: true, ...extra });
  await assert.rejects(call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question({ answer: 5 })]), /right answer/);
  await assert.rejects(call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question({ answer: [0, 0] })]), /every choice once/);
  await assert.rejects(call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question({ scopeRef: randomUUID() })]), /registered form/);
  const q1 = await call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question()]);
  await call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question({ prompt: 'Hidden draft', published: false })]);
  await call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question({ kind: 'direction', prompt: 'Order the turns', choices: ['Left', 'Right', 'Back'], answer: [2, 0, 1] })]);
  const quiz = lmsContract.quizV1.parse(await call(db, 'portal_student_quiz', ['STU-M-001', 'form', form.id]));
  assert.deepEqual(quiz.questions.map(q => q.prompt), ['What comes after the low block?', 'Order the turns']);
  assert.equal((await call(db, 'portal_student_quiz', ['STU-M-001', 'lesson', String(lessonYellow)])).questions.length, 0, 'a lesson above the belt has no quiz');
  assert.equal((await call(db, 'portal_save_quiz_question', [coach, 'DELETE', q1.id, JSON.stringify({ expectedRevision: 1 })])).deleted, q1.id);
  await call(db, 'portal_save_quiz_question', [coach, 'CREATE', null, question()]);
});

test('activity: step checks, self-checks, quizzes, form practice and goals update their records', async () => {
  await event(db, 'step_check', { lessonId: lessonOpen, stepId: 'chamber', checked: [1, 0, 1] });
  await event(db, 'step_check', { lessonId: lessonOpen, stepId: 'chamber', checked: [0] });
  assert.deepEqual((await one(db, 'SELECT checked FROM student_step_checks WHERE step_id=$1', ['chamber'])).checked, [0], 'the latest ticks replace earlier ones');
  await assert.rejects(event(db, 'step_check', { lessonId: lessonOpen, stepId: 'no-such-step', checked: [0] }), /Step unavailable/);
  await assert.rejects(event(db, 'step_check', { lessonId: lessonOpen, stepId: 'chamber', checked: [60] }), /Invalid checklist/);

  for (const [subjectType, subjectRef] of [['lesson', String(lessonOpen)], ['step', `${lessonOpen}:chamber`], ['form', form.id], ['movement', `${form.id}:7`]])
    await event(db, 'self_assessment', { subjectType, subjectRef, rating: 1, note: 'Still learning' });
  await assert.rejects(event(db, 'self_assessment', { subjectType: 'movement', subjectRef: `${form.id}:99`, rating: 2 }), /Subject unavailable/);
  await assert.rejects(event(db, 'self_assessment', { subjectType: 'lesson', subjectRef: String(lessonOpen), rating: 5 }), /Invalid rating/);

  await event(db, 'quiz_attempt', { scope: 'form', scopeRef: form.id, score: 1, total: 4, missed: [randomUUID()] });
  await event(db, 'quiz_attempt', { scope: 'form', scopeRef: form.id, score: 2, total: 4, missed: [] });
  await assert.rejects(event(db, 'quiz_attempt', { scope: 'form', scopeRef: form.id, score: 5, total: 4 }), /Quiz unavailable/);
  await event(db, 'form_practice', { formId: form.id, mode: 'guided', movements: 18, durationSeconds: 120 });
  let progress = await one(db, 'SELECT * FROM student_form_progress WHERE form_id=$1', [form.id]);
  assert.deepEqual([progress.status, progress.practice_count, progress.practice_seconds, progress.best_quiz_percent], ['practising', 1, 120, 50]);
  await event(db, 'form_ready', { formId: form.id });
  progress = await one(db, 'SELECT * FROM student_form_progress WHERE form_id=$1', [form.id]);
  assert.equal(progress.status, 'ready_for_review');

  await event(db, 'goal', { kind: 'weekly_days', target: 3 });
  await event(db, 'goal', { kind: 'weekly_days', target: 4 });
  assert.equal(await count(db, "student_goals WHERE status='active' AND kind='weekly_days'"), 1, 'one active weekly goal of each kind');
  await assert.rejects(event(db, 'goal', { kind: 'weekly_days', target: 9 }), /student_goals_shape|check constraint/i);
  const goal = await one(db, "SELECT id FROM student_goals WHERE status='active'");
  await event(db, 'goal', { goalId: goal.id, status: 'done' });

  const state = lmsContract.learningStateV1.parse(await call(db, 'portal_student_learning', ['STU-M-001']));
  assert.equal(state.stepChecks[0].stepId, 'chamber');
  assert.equal(state.quizBest[0].bestPercent, 50);
  assert.ok(state.selfAssessments.length >= 4);
  assert.ok(state.goals.some(g => g.status === 'done'));

  // Coach attention: three "still learning" ratings on the same lesson (the step counts for its lesson).
  await event(db, 'self_assessment', { subjectType: 'lesson', subjectRef: String(lessonOpen), rating: 1 });
  const attention = (await db.query('SELECT * FROM coach_attention_items WHERE student_id=$1', ['STU-M-001'])).rows;
  assert.ok(attention.some(row => row.subject_type === 'lesson' && row.subject_ref === String(lessonOpen) && row.reason === 'still_learning' && row.subject_title === 'Front Kick'));
  assert.ok(attention.some(row => row.subject_type === 'form' && row.reason === 'quiz_failed'), 'two failed quizzes within 14 days');
});

test('coach plans and goals: Monday weeks, publish, visible in learning-state-v1', async () => {
  const monday = (await one(db, "SELECT (d - (extract(isodow FROM d)::int-1))::text AS m FROM (SELECT (now() AT TIME ZONE 'Asia/Phnom_Penh')::date d) x")).m;
  const items = [{ type: 'lesson', ref: String(lessonOpen), title: 'Front kick', target: '3 x 10', day: 1 }, { type: 'form', ref: form.id, title: 'Taegeuk 1', day: 3 }];
  await assert.rejects(call(db, 'portal_save_learning_plan', [coach, 'SAVE', 'STU-M-001', '2026-11-11', JSON.stringify({ items })]), /Monday/);
  await assert.rejects(call(db, 'portal_save_learning_plan', [coach, 'SAVE', 'STU-M-001', monday, JSON.stringify({ items: [{ type: 'lesson', ref: '999999' }] })]), /not published/);
  let plan = await call(db, 'portal_save_learning_plan', [coach, 'SAVE', 'STU-M-001', monday, JSON.stringify({ items, note: 'Focus on chambering' })]);
  assert.equal((await call(db, 'portal_student_learning', ['STU-M-001'])).plans.length, 0, 'a draft plan is hidden');
  plan = await call(db, 'portal_save_learning_plan', [coach, 'PUBLISH', 'STU-M-001', monday, JSON.stringify({ expectedRevision: plan.revision })]);
  const plans = (await call(db, 'portal_student_learning', ['STU-M-001'])).plans;
  assert.equal(plans[0].items.length, 2);
  const goal = await call(db, 'portal_save_student_goal', [coach, 'SET', 'STU-M-001', JSON.stringify({ kind: 'form', subjectRef: form.id, title: 'Learn Taegeuk 1' })]);
  assert.equal(goal.set_by, 'coach');
  await assert.rejects(event(db, 'goal', { goalId: goal.id, status: 'dropped' }), /Goal unavailable/, 'a student cannot drop a coach goal');
});

test('belt syllabus: items keep a practice target and form link for belt-tests-v1', async () => {
  const yellow = 2;
  const payload = { targetBeltId: yellow, title: 'Yellow belt test', passMark: 70, distinctionMark: 90, sectionMinimum: 60, criticalMinimum: 5, retestDays: 30, notes: '', feeUsd: 0,
    eligibility: { minimumDays: 0, minimumClasses: 0, minimumSkillAverage: 0, requireLessons: false },
    sections: [{ kind: 'physical', title: 'Physical Test', weight: 50, minimum: null, items: [{ title: 'Front kicks', weight: 1, critical: false, practiceTarget: { reps: 50, timesPerWeek: 3 } }] },
      { kind: 'poomsae', title: 'Poomsae Test', weight: 50, minimum: null, items: [{ title: 'Taegeuk Il Jang', weight: 1, critical: true, formId: form.id }] }] };
  const saved = await call(db, 'portal_belt_tests_mutate', [root, 'syllabus_save', payload, randomUUID()]);
  await call(db, 'portal_belt_tests_mutate', [root, 'syllabus_publish', { id: saved.id, revision: saved.revision }, randomUUID()]);
  const items = (await call(db, 'portal_student_belt_tests', ['STU-M-001'])).curriculum.sections.flatMap(section => section.items);
  assert.deepEqual(items.find(item => item.title === 'Front kicks').practiceTarget, { reps: 50, timesPerWeek: 3 });
  assert.equal(items.find(item => item.title === 'Taegeuk Il Jang').formId, form.id);
  await assert.rejects(call(db, 'portal_save_poomsae_form', [coach, 'DELETE', form.id, JSON.stringify({ expectedRevision: form.revision })]), /progress on this form|syllabus links/);
});

test('assignments: targeting, practice progress, completion points, tasks-v1 and deadline reminders', async () => {
  const base = { title: 'Front kicks', instructions: 'Practise 20 front kicks.', kind: 'practice', subjectType: 'lesson', subjectRef: String(lessonOpen), target: { reps: 20 }, points: 10, rubric: [], translations: {} };
  await assert.rejects(call(db, 'portal_save_assignment', [coach, 'CREATE', null, JSON.stringify({ ...base, targets: [{ type: 'belt', ref: 'Purple' }] })]), /no longer available/);
  await assert.rejects(call(db, 'portal_save_assignment', [coach, 'CREATE', null, JSON.stringify({ ...base, target: {}, targets: [{ type: 'all', ref: '' }] })]), /reps or sessions/);
  let assignment = await call(db, 'portal_save_assignment', [coach, 'CREATE', null, JSON.stringify({ ...base, dueAt: new Date(Date.now() + 30 * 3600e3).toISOString(), targets: [{ type: 'belt', ref: 'White' }] })]);
  assert.equal(assignment.students, 0, 'a draft reaches nobody yet');
  assignment = await call(db, 'portal_save_assignment', [coach, 'PUBLISH', assignment.id, JSON.stringify({ expectedRevision: assignment.revision })]);
  assert.equal(assignment.students, 2, 'both White belts');
  const tasks = lmsContract.tasksV1.parse(await call(db, 'portal_student_tasks', ['STU-M-001']));
  assert.equal(tasks.assignments[0].status, 'open');

  // 30 hours before the due time: the 48-hour reminder, once.
  const run = (when = new Date()) => call(db, 'portal_lms_run_reminders', [when.toISOString()]);
  assert.equal((await run()).assignmentReminders, 2, 'both students with a portal account');
  assert.equal((await run()).assignmentReminders, 0, 'a rerun never sends twice');

  await event(db, 'assignment_progress', { assignmentId: assignment.id, reps: 12 });
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1 AND student_id=$2', [assignment.id, 'STU-M-001'])).status, 'in_progress');
  await event(db, 'assignment_progress', { assignmentId: assignment.id, reps: 8 });
  const row = await one(db, 'SELECT status,progress FROM student_assignments WHERE assignment_id=$1 AND student_id=$2', [assignment.id, 'STU-M-001']);
  assert.deepEqual([row.status, row.progress], ['done', { reps: 20, sessions: 2 }]);
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-001' AND reason='assignment'"), 1);
  await assert.rejects(event(db, 'assignment_progress', { assignmentId: assignment.id, reps: 1 }), /already handed in/);
  await assert.rejects(call(db, 'portal_save_assignment', [coach, 'DELETE', assignment.id, JSON.stringify({ expectedRevision: assignment.revision })]), /Close it instead/);
  const excused = await call(db, 'portal_set_student_assignment', [coach, assignment.id, 'STU-M-002', JSON.stringify({ status: 'excused', note: 'Injured' })]);
  assert.equal(excused.status, 'excused');
});

test('video submissions: consent first, upload, review with timed notes, feedback notice, 90-day retention', async () => {
  const assignment = await call(db, 'portal_save_assignment', [coach, 'CREATE', null, JSON.stringify({ title: 'Film Taegeuk 1', instructions: 'Record the whole form.', kind: 'form', subjectType: 'form', subjectRef: form.id,
    target: {}, points: 20, rubric: [{ item: 'Stances' }, { item: 'Rhythm' }], translations: {}, targets: [{ type: 'student', ref: 'STU-M-001' }] })]);
  const published = await call(db, 'portal_save_assignment', [coach, 'PUBLISH', assignment.id, JSON.stringify({ expectedRevision: assignment.revision })]);
  const start = (key, extra = {}) => call(db, 'student_portal_start_submission', [student, 'STU-M-001', key, JSON.stringify({ kind: 'video', assignmentId: published.id, mimeType: 'video/mp4', bytes: 5e6, videoSeconds: 60, ...extra })]);
  await assert.rejects(start(randomUUID()), /guardian must agree/);
  await assert.rejects(call(db, 'student_portal_video_consent', [student, 'STU-M-001', JSON.stringify({ agree: true, guardianName: 'Parent', relationship: 'self' })]), /under 18/);
  const consent = await call(db, 'student_portal_video_consent', [student, 'STU-M-001', JSON.stringify({ agree: true, guardianName: 'Fixture Parent', relationship: 'parent' })]);
  assert.equal(consent.consented, true);
  await assert.rejects(start(randomUUID(), { mimeType: 'video/avi' }), /MP4, WebM or MOV/);
  await assert.rejects(start(randomUUID(), { bytes: 3e8 }), /200 MB/);
  const key = randomUUID();
  const started = await start(key);
  assert.equal(started.uploadPath, `STU-M-001/${started.submission.id}.mp4`);
  assert.equal((await start(key)).submission.id, started.submission.id, 'a retried start returns the same upload');
  const finished = await call(db, 'student_portal_finish_submission', [student, 'STU-M-001', started.submission.id, JSON.stringify({ videoSeconds: 58 })]);
  assert.equal(finished.submission.status, 'submitted');
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1 AND student_id=$2', [published.id, 'STU-M-001'])).status, 'submitted');

  const review = payload => call(db, 'portal_review_submission', [coach, started.submission.id, JSON.stringify(payload)]);
  await assert.rejects(review({ decision: 'accepted', moments: [{ second: 12 }] }), /time and a note/);
  await assert.rejects(call(db, 'portal_review_submission', [assistant, started.submission.id, JSON.stringify({ decision: 'accepted' })]), /permission|not allowed/i);
  await review({ decision: 'returned', grade: 'Developing', feedback: 'Deeper stances, then send it again.', rubric: [{ item: 'Stances', grade: 'Needs Work', note: 'Too high' }], moments: [{ second: 12, note: 'Pivot the supporting foot' }] });
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1 AND student_id=$2', [published.id, 'STU-M-001'])).status, 'open', 'returned work is open again');
  const second = await start(randomUUID());
  await call(db, 'student_portal_finish_submission', [student, 'STU-M-001', second.submission.id, JSON.stringify({})]);
  await call(db, 'portal_review_submission', [coach, second.submission.id, JSON.stringify({ decision: 'accepted', grade: 'Proficient', feedback: 'Much better.', visibleToStudent: true })]);
  await call(db, 'portal_review_submission', [coach, second.submission.id, JSON.stringify({ decision: 'accepted', feedback: 'Coach-only note', visibleToStudent: false })]);
  assert.equal((await one(db, 'SELECT status FROM student_assignments WHERE assignment_id=$1 AND student_id=$2', [published.id, 'STU-M-001'])).status, 'done');

  const feed = lmsContract.submissionsV1.parse(await call(db, 'portal_student_submissions', ['STU-M-001']));
  const latest = feed.submissions.find(s => s.id === second.submission.id);
  assert.deepEqual(latest.reviews.map(r => r.feedback), ['Much better.'], 'hidden reviews never reach the student');
  assert.equal(feed.submissions.find(s => s.id === started.submission.id).reviews[0].moments[0].note, 'Pivot the supporting foot');
  assert.equal(await count(db, "portal_notifications WHERE user_id=$1 AND category='feedback' AND source_type='lms'", [student]), 2);

  // Retention: due 90 days after review; the job lists the file, then marks it deleted.
  const due = await one(db, 'SELECT delete_video_after::text AS d FROM student_submissions WHERE id=$1', [second.submission.id]);
  assert.equal(due.d, (await one(db, "SELECT (((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)+90)::text AS d")).d);
  await db.query('UPDATE student_submissions SET delete_video_after=current_date-1 WHERE id=$1', [second.submission.id]);
  const toDelete = await call(db, 'portal_lms_videos_to_delete', [50]);
  assert.ok(toDelete.some(item => item.id === second.submission.id));
  assert.equal(await call(db, 'portal_lms_videos_deleted', [[second.submission.id]]), 1);
  const after = await one(db, 'SELECT video_path,status FROM student_submissions WHERE id=$1', [second.submission.id]);
  assert.deepEqual([after.video_path, after.status], [null, 'reviewed'], 'the written feedback stays');

  // Staff can record paper consent; the student can withdraw it.
  await call(db, 'portal_record_video_consent', [coach, 'STU-M-002', JSON.stringify({ guardianName: 'Other Parent', relationship: 'guardian' })]);
  assert.equal((await call(db, 'student_portal_video_consent', [student, 'STU-M-001', JSON.stringify({ agree: false })])).consented, false);
});

test('challenges and achievements: counted from activity, points once, coach sign-off, seen once', async () => {
  const challenge = await call(db, 'portal_save_challenge', [coach, 'CREATE', null, JSON.stringify({ title: '50 front kicks', goalKind: 'reps', goalTarget: 30, subjectType: 'lesson', subjectRef: String(lessonOpen),
    startsOn: today, endsOn: today, audience: { belts: ['White'] }, points: 15, badgeCode: null, translations: {} })]);
  await assert.rejects(call(db, 'portal_save_challenge', [coach, 'CREATE', null, JSON.stringify({ title: 'Bad', goalKind: 'minutes', goalTarget: 10, subjectType: 'form', subjectRef: form.id, startsOn: today, endsOn: today })]), /cannot be limited/);
  await call(db, 'portal_save_challenge', [coach, 'PUBLISH', challenge.id, JSON.stringify({ expectedRevision: challenge.revision })]);
  await event(db, 'lesson', { lessonId: lessonOpen, repetitionsCount: 20, completed: true });
  let progress = await one(db, 'SELECT progress,completed_at FROM student_challenge_progress WHERE challenge_id=$1', [challenge.id]);
  assert.equal(progress.progress, 25, 'reps logged today on that lesson (5 earlier + 20)');
  assert.equal(progress.completed_at, null);
  await event(db, 'lesson', { lessonId: lessonOpen, repetitionsCount: 10 });
  progress = await one(db, 'SELECT progress,completed_at FROM student_challenge_progress WHERE challenge_id=$1', [challenge.id]);
  assert.ok(progress.completed_at, 'completed at 35 reps');
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-001' AND reason='challenge'"), 1);
  await call(db, 'student_portal_evaluate_rewards', ['STU-M-001']);
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-001' AND reason='challenge'"), 1, 'evaluating again never adds points twice');

  // A custom automatic achievement and the coach-signed "Belt Exam Ready".
  await call(db, 'portal_save_achievement_definition', [coach, 'CREATE', 'first_lesson', JSON.stringify({ title: 'First lesson', description: 'Complete one lesson.', icon: 'Star', rule: { kind: 'lessons_completed', min: 1 }, points: 5, repeats: 'once', translations: {}, active: true })]);
  await call(db, 'student_portal_evaluate_rewards', ['STU-M-001']);
  assert.equal(await count(db, "student_achievements WHERE student_id='STU-M-001' AND code='first_lesson'"), 1);
  const signed = await call(db, 'portal_award_achievement', [coach, 'AWARD', 'STU-M-001', JSON.stringify({ code: 'belt_exam_ready', note: 'Ready for Yellow' })]);
  assert.equal(signed.period, 'Yellow', 'a per-belt sign-off is for the next belt');
  await assert.rejects(call(db, 'portal_award_achievement', [coach, 'AWARD', 'STU-M-001', JSON.stringify({ code: 'belt_exam_ready' })]), /already has/);
  await assert.rejects(call(db, 'portal_save_achievement_definition', [coach, 'DELETE', 'belt_exam_ready', JSON.stringify({ expectedRevision: 1 })]), /Turn it off instead/);

  // Only a coach marks a form mastered; it awards "Poomsae Beginner".
  await call(db, 'portal_review_form', [coach, 'STU-M-001', form.id, JSON.stringify({ decision: 'mastered', note: 'Clean and sharp' })]);
  assert.equal(await count(db, "student_achievements WHERE student_id='STU-M-001' AND code='poomsae_beginner'"), 1);
  await assert.rejects(event(db, 'form_ready', { formId: form.id }), /already mastered/);

  const feed = lmsContract.achievementsV1.parse(await call(db, 'portal_student_achievements', ['STU-M-001']));
  assert.ok(feed.earned.some(a => a.code === 'belt_exam_ready' && a.signedOff));
  const expected = Number((await one(db, "SELECT sum(delta)::int AS n FROM student_points WHERE student_id='STU-M-001'")).n);
  assert.equal(feed.points.total, expected);
  assert.equal((await call(db, 'student_portal_mark_achievements_seen', [student, 'STU-M-001', JSON.stringify(feed.earned.map(({ code, period }) => ({ code, period })))])).marked, feed.earned.length);
  await call(db, 'portal_award_achievement', [coach, 'REVOKE', 'STU-M-001', JSON.stringify({ code: 'belt_exam_ready', period: 'Yellow' })]);
  assert.equal(await count(db, "student_points WHERE student_id='STU-M-001' AND ref='belt_exam_ready:Yellow'"), 0, 'revoking removes its points');
});

test('notices: notices-v2 lists LMS notices; the old inbox is unchanged; phone alerts wait for the switch', async () => {
  const inbox = await call(db, 'portal_student_inbox', [student, 'STU-M-001', 'list', null, null, null]);
  assert.equal(inbox.contractVersion, 'notices-v2');
  const lms = inbox.rows.filter(row => row.source_type === 'lms');
  assert.ok(lms.length >= 3);
  for (const row of lms) { assert.ok(row.topic); assert.match(row.source_id, /^[0-9a-f-]{36}$/); assert.equal(row.source_revision, 1); }
  assert.equal(inbox.unreadCount, lms.length);
  const old = await call(db, 'portal_calendar_inbox', [student, 'STU-M-001', 'list', null, null, null]);
  assert.equal(old.rows.length, 0, 'portal_calendar_inbox still lists academy events only');
  await call(db, 'portal_student_inbox', [student, 'STU-M-001', 'read', lms[0].id, null, null]);
  await call(db, 'portal_student_inbox', [student, 'STU-M-001', 'dismiss', lms[1].id, null, null]);
  const after = await call(db, 'portal_student_inbox', [student, 'STU-M-001', 'list', null, null, null]);
  assert.equal(after.unreadCount, lms.length - 2);
  await assert.rejects(call(db, 'portal_student_inbox', [otherStudent, 'STU-M-002', 'read', lms[0].id, null, null]), /not available/);

  const subscription = (await one(db, "INSERT INTO portal_push_subscriptions(user_id,endpoint,keys,app_scope) VALUES($1,'https://fcm.googleapis.com/fcm/send/x','{}','student') RETURNING id", [student])).id;
  await db.query('INSERT INTO portal_notification_preferences(user_id,push_enabled,student_quiet_start,student_quiet_end) VALUES($1,true,NULL,NULL) ON CONFLICT(user_id) DO UPDATE SET push_enabled=true,student_quiet_start=NULL,student_quiet_end=NULL', [student]);
  await db.exec('SET ROLE service_role');
  const eligible = async () => (await one(db, 'SELECT portal_push_eligible($1,$2) AS r', [lms[2].id, subscription])).r;
  try {
    assert.equal(await eligible(), false, 'off until the student portal is ready');
    await db.exec('RESET ROLE'); await db.exec("UPDATE academy_profile SET student_lms_push_enabled=true WHERE id='default'"); await db.exec('SET ROLE service_role');
    assert.equal(await eligible(), true);
    await db.exec('RESET ROLE'); await db.query("UPDATE portal_notification_preferences SET muted_categories=ARRAY[$2] WHERE user_id=$1", [student, lms[2].category]); await db.exec('SET ROLE service_role');
    assert.equal(await eligible(), false, 'a muted category is never pushed');
  } finally { await db.exec('RESET ROLE'); }
});

test('preferences: all student categories can be muted; reminder settings are optional keys', async () => {
  const save = payload => call(db, 'portal_calendar_preferences', [student, JSON.stringify(payload)]);
  await save({ pushEnabled: true, mutedCategories: ['events', 'streak_reminder', 'not_a_category'], quietStart: '22:00', quietEnd: '07:00', practiceReminderTime: '18:30', practiceDays: [1, 3, 5], classReminderHours: 3 });
  let row = await one(db, 'SELECT * FROM portal_notification_preferences WHERE user_id=$1', [student]);
  assert.deepEqual([row.muted_categories, row.practice_reminder_time, row.practice_days, row.class_reminder_hours], [['events', 'streak_reminder'], '18:30:00', [1, 3, 5], 3]);
  await save({ pushEnabled: false, mutedCategories: [], quietStart: null, quietEnd: null });
  row = await one(db, 'SELECT * FROM portal_notification_preferences WHERE user_id=$1', [student]);
  assert.deepEqual([row.push_enabled, row.muted_categories, row.practice_reminder_time, row.class_reminder_hours], [false, [], '18:30:00', 3], 'today\'s client keeps the reminder settings');
  await assert.rejects(save({ pushEnabled: true, mutedCategories: [], quietStart: null, quietEnd: null, practiceDays: [8] }), /Monday \(1\) to Sunday \(7\)/);
});

test('announcements: audience, language, request key; Assistant Coach refused', async () => {
  const payload = { title: 'Grading day', body: 'Bring your uniform.', translations: { km: { title: 'ថ្ងៃប្រឡង', body: 'យកឯកសណ្ឋានមក។' } }, audience: { students: ['STU-M-001'] } };
  await db.query("INSERT INTO student_portal_preferences(user_id,theme,language) VALUES($1,'light','kh') ON CONFLICT(user_id) DO UPDATE SET language='kh'", [student]);
  const key = randomUUID();
  const sent = await call(db, 'portal_send_announcement', [root, key, JSON.stringify(payload)]);
  assert.equal(sent.recipients, 1);
  assert.equal((await call(db, 'portal_send_announcement', [root, key, JSON.stringify(payload)])).id, sent.id, 'a retried send is one announcement');
  const notice = await one(db, "SELECT title,body FROM portal_notifications WHERE source_key=$1", ['announcement:' + sent.id]);
  assert.deepEqual([notice.title, notice.body], ['ថ្ងៃប្រឡង', 'យកឯកសណ្ឋានមក។'], 'Khmer for a Khmer account');
  await assert.rejects(call(db, 'portal_send_announcement', [assistant, randomUUID(), JSON.stringify(payload)]), /permission|not allowed/i);
});

test('reminders: class, exam, practice, streak, new material and missed class, each once', async () => {
  const at = local => new Date(`${local}+07:00`).toISOString();
  const tomorrow = (await one(db, "SELECT (((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)+1)::text AS d")).d;
  const yesterday = (await one(db, "SELECT (((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)-1)::text AS d")).d;
  await db.exec("INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time) VALUES(81,1,'Little Tigers','Monday',ARRAY['Monday'],'17:00','18:00')");
  const soon = randomUUID(), missed = randomUUID();
  await db.query("INSERT INTO class_occurrences(id,class_id,source_date,starts_at,ends_at,class_name,branch_id,capacity) VALUES($1,81,$2,$3,$4,'Little Tigers',1,20),($5,81,$6,$7,$8,'Little Tigers',1,20)",
    [soon, tomorrow, at(`${tomorrow}T17:00:00`), at(`${tomorrow}T18:00:00`), missed, yesterday, at(`${yesterday}T17:00:00`), at(`${yesterday}T18:00:00`)]);
  await db.query("INSERT INTO class_occurrence_roster(occurrence_id,student_id,enrolled_date) VALUES($1,'STU-M-001','2026-01-01'),($2,'STU-M-001','2026-01-01')", [soon, missed]);
  await db.query("INSERT INTO attendance(student_id,date,status,class_id,occurrence_id) VALUES('STU-M-001',$1,'Absent',81,$2)", [yesterday, missed]);
  const run = local => call(db, 'portal_lms_run_reminders', [at(local)]);
  // Earlier tests ran the job at the real time, which may already have taken
  // today's once-a-day marks and sent today's digest.
  await db.exec("DELETE FROM lms_job_marks; DELETE FROM portal_notifications WHERE category IN ('new_material','practice_reminder','streak_reminder','missed_class')");

  // Class at 17:00 tomorrow with a 3-hour lead (set in the preferences test).
  assert.equal((await run(`${tomorrow}T13:00:00`)).classReminders, 0, 'too early');
  assert.equal((await run(`${tomorrow}T14:30:00`)).classReminders, 1);
  assert.equal((await run(`${tomorrow}T15:00:00`)).classReminders, 0, 'once');

  // Daily steps from 08:00: yesterday's absence.
  const daily = await run(`${today}T09:00:00`);
  assert.equal(daily.missedClass, 1);
  assert.equal((await run(`${today}T10:00:00`)).missedClass, 0);

  // New material digest at 17:00 counts lessons published since yesterday 17:00
  // and open to the belt: Front Kick and Taegeuk for White, not the Yellow lesson.
  await db.query('UPDATE library_published_content SET published_at=$1', [at(`${today}T12:00:00`)]);
  assert.equal((await run(`${today}T17:05:00`)).newMaterial, 2, 'one digest for each White belt');
  assert.equal((await run(`${today}T17:30:00`)).newMaterial, 0, 'once a day');
  const digest = await one(db, "SELECT body FROM portal_notifications WHERE user_id=$1 AND category='new_material'", [otherStudent]);
  assert.match(digest.body, /^2 new lessons/);

  // Practice reminder at the chosen time, every day when no days are chosen; not
  // for a student who already practised today.
  await db.query('UPDATE portal_notification_preferences SET practice_days=NULL WHERE user_id=$1', [student]);
  await db.query("INSERT INTO portal_notification_preferences(user_id,push_enabled,practice_reminder_time) VALUES($1,false,'18:30')", [otherStudent]);
  assert.equal((await run(`${today}T18:20:00`)).practiceReminders, 0, 'not before the time');
  assert.equal((await run(`${today}T18:40:00`)).practiceReminders, 1, 'only the student who has not practised today');
  assert.equal((await run(`${today}T18:50:00`)).practiceReminders, 0, 'once a day');

  // A belt test in 3 days for a registered student.
  const yellowSyllabus = (await one(db, "SELECT id FROM belt_test_syllabi WHERE status='published'")).id;
  const inThreeDays = (await one(db, "SELECT (((now() AT TIME ZONE 'Asia/Phnom_Penh')::date)+3)::text AS d")).d;
  const mutate = (action, data) => call(db, 'portal_belt_tests_mutate', [root, action, data, randomUUID()]);
  const exam = await mutate('event_create', { syllabusId: yellowSyllabus, title: 'Yellow belt test day', examDate: inThreeDays, startTime: '09:00', location: 'Main hall', branchId: 1 });
  await mutate('event_publish', { id: exam.id });
  await mutate('register', { eventId: exam.id, studentId: 'STU-M-001', overrideReason: 'Coach recommendation for the test' });
  assert.equal((await run(`${today}T08:30:00`)).examReminders, 2, 'the registered student, and the other White belt who is eligible for it');
  assert.equal((await run(`${today}T08:45:00`)).examReminders, 0);

  const categories = (await db.query("SELECT DISTINCT category FROM portal_notifications WHERE user_id=$1 AND source_type='lms'", [student])).rows.map(row => row.category).sort();
  for (const category of ['class_reminder', 'exam_reminder', 'missed_class', 'new_material', 'feedback', 'achievement', 'announcement', 'assignment_due']) assert.ok(categories.includes(category), category);
});

test('handoff: the student portal schemas parse every LMS feed this database returns', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lms-contract-')), 'lms-contract.ts');
  fs.writeFileSync(file, fs.readFileSync('docs/student-portal/lms-contract.example.ts.txt', 'utf8'));
  const contract = loadTs(file, { zod });
  const feeds = [['portal_student_forms', 'formsV1', ['STU-M-001']], ['portal_student_quiz', 'quizV1', ['STU-M-001', 'form', form.id]], ['portal_student_learning', 'learningStateV1', ['STU-M-001']],
    ['portal_student_tasks', 'tasksV1', ['STU-M-001']], ['portal_student_submissions', 'submissionsV1', ['STU-M-001']], ['portal_student_achievements', 'achievementsV1', ['STU-M-001']]];
  for (const [fn, schema, args] of feeds) {
    const data = await call(db, fn, args);
    const parsed = contract[schema].safeParse(data);
    assert.ok(parsed.success, `${fn}: ${JSON.stringify(parsed.error?.issues?.slice(0, 2))}`);
    assert.ok(lmsContract[schema].safeParse(data).success, `${fn}: the admin copy agrees`);
  }
  const inbox = await call(db, 'portal_student_inbox', [student, 'STU-M-001', 'list', null, null, null]);
  for (const row of inbox.rows.filter(r => r.source_type === 'lms')) assert.ok(contract.LMS_TOPICS.includes(row.topic), row.topic);
  // Every LMS activity payload the tests recorded matches the documented payload schema.
  const events = (await db.query("SELECT kind,payload FROM student_portal_events WHERE kind=ANY($1)", [Object.keys(contract.activityPayloads)])).rows;
  assert.ok(events.length >= 7);
  for (const row of events) assert.ok(contract.activityPayloads[row.kind].safeParse(row.payload).success, `${row.kind}: ${JSON.stringify(row.payload)}`);
});
test('server-only: student feeds and writes refuse non-server callers', async () => {
  await asAnon(db);
  try {
    for (const [fn, args] of [['portal_student_forms', ['STU-M-001']], ['portal_student_tasks', ['STU-M-001']], ['portal_student_achievements', ['STU-M-001']],
      ['portal_student_submissions', ['STU-M-001']], ['portal_student_learning', ['STU-M-001']], ['portal_lms_run_reminders', [new Date().toISOString()]]])
      await assert.rejects(call(db, fn, args), /Server only/);
    await assert.rejects(event(db, 'lesson', { lessonId: lessonOpen }), /Server only/);
  } finally { await asServer(db); }
});
