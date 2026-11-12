import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTs } from './load-ts.mjs';

const content = loadTs('lib/library-content.ts');
const lms = loadTs('lib/lms-contract.ts');
const v2 = loadTs('lib/library-v2-contract.ts');
const { isMissingSchema, publishedFormIds } = loadTs('lib/lms-server.ts');
const { beltTestRequestSchema } = loadTs('lib/belt-test-contract.ts');

const steps = (extra = {}) => ({ id: 'how-to', type: 'technique-steps', title: 'Step by step', video: 'https://www.youtube.com/watch?v=abc123', items: [
  { id: 'chamber', title: 'Chamber position', body: 'Lift the knee to hip height.', clip: { start: 12.5, end: 18 }, mistakes: [{ mistake: 'Knee too low', correction: 'Lift the knee first' }], checklist: ['Knee at hip height', 'Guard up'] },
  { id: 'extension', title: 'Extension', body: 'Snap the kick.', clip: { src: 'https://cdn.example.test/clip.mp4' }, mistakes: [], checklist: [] }], ...extra });

test('technique-steps: the Roundhouse Kick shape validates; ids are unique; times need the lesson video', () => {
  const parsed = content.librarySectionSchema.parse(steps());
  assert.equal(parsed.items[0].clip.start, 12.5);
  assert.equal(parsed.items[1].clip.src, 'https://cdn.example.test/clip.mp4');
  assert.ok(!content.librarySectionSchema.safeParse(steps({ items: [steps().items[0], { ...steps().items[1], id: 'chamber' }] })).success, 'duplicate step ids');
  assert.ok(!content.librarySectionSchema.safeParse(steps({ video: '' })).success, 'clip times without a video');
  assert.ok(!content.librarySectionSchema.safeParse(steps({ items: [{ ...steps().items[0], clip: { start: 5, end: 2 } }] })).success, 'a clip ends after it starts');
  assert.ok(!content.librarySectionSchema.safeParse(steps({ items: [{ ...steps().items[0], clip: { src: 'http://insecure.test/a.mp4' } }] })).success, 'https only');
  const blank = content.emptySection('technique-steps', 'technique-steps');
  assert.ok(content.librarySectionSchema.safeParse(blank).success, 'a new section is valid as created');
});

test('technique-steps translations: text overlays English; clip, video, start, end, src and ids never change', () => {
  for (const key of ['clip', 'video', 'start', 'end', 'src', 'id']) assert.ok(content.FIXED_KEYS.has(key), key);
  const section = content.librarySectionSchema.parse(steps());
  const km = { title: 'ជំហាន', items: [{ id: 'changed', title: 'ទីតាំងបត់ជង្គង់', clip: { start: 99, end: 100 }, checklist: ['ជង្គង់ខ្ពស់'] }], video: 'https://evil.test/x' };
  const localized = content.localizeSection(section, km);
  assert.equal(localized.title, 'ជំហាន');
  assert.equal(localized.items[0].title, 'ទីតាំងបត់ជង្គង់');
  assert.deepEqual(localized.items[0].checklist, ['ជង្គង់ខ្ពស់', 'Guard up'], 'untranslated lines keep English');
  assert.equal(localized.items[0].id, 'chamber');
  assert.deepEqual(localized.items[0].clip, { start: 12.5, end: 18 });
  assert.equal(localized.video, 'https://www.youtube.com/watch?v=abc123');
  const fields = content.translatableTexts(section).map(text => text.path.join('.'));
  assert.ok(fields.includes('items.0.mistakes.0.correction') && fields.includes('items.0.checklist.1'));
  assert.ok(!fields.some(path => /clip|video|\.id$/.test(path)), 'no structure is offered for translation');
});

test('poomsae diagram: movement notes add a clip and mistakes per movement without touching the geometry', () => {
  const diagram = { id: 'floor', type: 'diagram', title: '', kind: 'poomsae-walkthrough', video: 'https://www.youtube.com/watch?v=form1',
    data: { start: { x: 0, y: 0 }, startFacing: 'N', startStance: { type: 'ready' }, steps: [{ to: { x: 0, y: 1 }, facing: 'W', stance: { type: 'walking' }, techniques: ['Low block'] }, { to: { x: 0, y: 2 }, facing: 'W', stance: { type: 'walking' }, techniques: ['Punch'] }] },
    movements: [{ clip: { start: 1, end: 3 }, mistakes: [{ mistake: 'Block too high', correction: 'Stop above the knee' }] }] };
  const parsed = content.librarySectionSchema.parse(diagram);
  assert.equal(parsed.movements[0].mistakes[0].mistake, 'Block too high');
  assert.ok(!content.librarySectionSchema.safeParse({ ...diagram, movements: [{}, {}, {}] }).success, 'more notes than movements');
  assert.ok(!content.librarySectionSchema.safeParse({ ...diagram, video: undefined }).success, 'clip times need the form video');
  const localized = content.localizeSection(parsed, { movements: [{ mistakes: [{ mistake: '挡得太高' }] }] });
  assert.equal(localized.movements[0].mistakes[0].mistake, '挡得太高');
  assert.equal(localized.movements[0].mistakes[0].correction, 'Stop above the knee');
  assert.deepEqual(localized.data, parsed.data, 'geometry is never translated');
});

test('staff requests: strict shapes that match the SQL checks', () => {
  const ok = body => lms.lmsRequestSchema.safeParse(body).success;
  assert.ok(ok({ action: 'quiz.save', question: { scope: 'form', scopeRef: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d', kind: 'direction', prompt: 'Order the turns', choices: ['Left', 'Right', 'Back'], answer: [2, 0, 1], published: true, translations: {} } }));
  assert.ok(!ok({ action: 'quiz.save', question: { scope: 'form', scopeRef: 'x', kind: 'choice', prompt: 'Q', choices: ['A', 'B'], answer: 2, published: true, translations: {} } }), 'answer out of range');
  const assignment = { title: 'Front kicks', instructions: 'Practise.', kind: 'practice', subjectType: 'lesson', subjectRef: '12', target: { reps: 50 }, dueAt: '2026-11-20T10:00:00+07:00', points: 10, rubric: [], targets: [{ type: 'belt', ref: 'White' }], translations: {} };
  assert.ok(ok({ action: 'assignment.save', assignment }));
  assert.ok(!ok({ action: 'assignment.save', assignment: { ...assignment, target: {} } }), 'practice needs reps or sessions');
  assert.ok(!ok({ action: 'assignment.save', assignment: { ...assignment, targets: [{ type: 'all', ref: 'x' }] } }), '"all" takes no reference');
  assert.ok(!ok({ action: 'assignment.save', assignment: { ...assignment, extra: true } }), 'no unknown fields');
  assert.ok(ok({ action: 'submission.review', id: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d', review: { decision: 'returned', grade: 'Developing', feedback: 'Deeper stances', rubric: [], moments: [{ second: 12, note: 'Pivot' }], visibleToStudent: true } }));
  assert.ok(!ok({ action: 'submission.review', id: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d', review: { decision: 'accepted', grade: 'Excellent', feedback: null, rubric: [], moments: [], visibleToStudent: true } }), '4-level scale only');
  assert.ok(!lms.achievementDefinitionInput.safeParse({ title: 'Attendance', description: 'Every class', icon: 'Star', rule: { kind: 'attendance_month' }, points: 10, repeats: 'once', active: true, translations: {} }).success, 'attendance repeats monthly');
  assert.ok(lms.challengeInput.safeParse({ title: '7-day stretch', description: null, goalKind: 'streak_days', goalTarget: 7, subjectType: 'lesson', subjectRef: '12', startsOn: '2026-11-16', endsOn: '2026-11-22', audience: { belts: ['White'] }, points: 20, badgeCode: null, translations: {} }).success);
  assert.ok(!lms.audienceInput.safeParse({}).success, 'an audience names someone');
  for (const [kind, schema] of Object.entries(lms.lmsActivityPayloads)) assert.ok(schema, kind);
  assert.ok(lms.lmsActivityPayloads.step_check.safeParse({ lessonId: 12, stepId: 'chamber', checked: [0, 2] }).success);
});

test('belt syllabus items accept a home-practice target and a form link', () => {
  const base = { requestKey: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', action: 'syllabus_save', targetBeltId: 2, title: 'Yellow belt test', eligibility: { minimumDays: 0, minimumClasses: 0, minimumSkillAverage: 0, requireLessons: false }, notes: '' };
  const item = extra => ({ ...base, sections: [{ kind: 'poomsae', title: 'Poomsae', items: [{ title: 'Taegeuk 1', ...extra }] }] });
  assert.ok(beltTestRequestSchema.safeParse(item({ practiceTarget: { reps: 50, timesPerWeek: 3 }, formId: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d' })).success);
  assert.ok(!beltTestRequestSchema.safeParse(item({ practiceTarget: { timesPerWeek: 30 } })).success);
  assert.ok(!beltTestRequestSchema.safeParse(item({ practiceTarget: {} })).success, 'an empty target is not saved');
});

test('library-v2 formId: from a map of published forms; never from an Array#map index', async () => {
  const row = { id: 12, title: 'Taegeuk Il Jang', targetBelt: 'White', type: 'Taekwondo', thumbnailUrl: null, videoUrl: '', position: null, durationSeconds: null, published: null };
  assert.equal(v2.libraryV2Summary(row, new Map([[12, '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d']])).formId, '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d');
  assert.equal([row].map(v2.libraryV2Summary)[0].formId, null);
  assert.ok(v2.libraryV2LessonSummarySchema.safeParse(v2.libraryV2Summary(row)).success);
  // Code deployed before the LMS migration: a missing table reads as "no forms".
  const missing = { from: () => ({ select() { return this; }, eq() { return this; }, in() { return this; }, then: resolve => resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.poomsae_forms' in the schema cache" } }) }) };
  assert.equal((await publishedFormIds(missing, [12])).size, 0);
  assert.ok(isMissingSchema({ code: '42883', message: 'function public.portal_lms_run_reminders() does not exist' }));
  assert.ok(!isMissingSchema({ code: '42501', message: 'Staff access required' }));
});

test('push: LMS notices carry references only, with the topic and a UUID source', () => {
  const server = loadTs('lib/notifications-server.ts', { 'web-push': {}, './backend-security': { callerHasPermission: async () => true }, './operations-server': { ownedStudentIds: async () => [], featureRows: async () => [], loadMakeupData: async () => ({}) } });
  const notice = { id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', source_type: 'lms', source_id: null, category: 'assignment_due', topic: 'assignment_due', subject_ref: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d', title: 'Due soon: Front kicks', body: 'Private' };
  assert.deepEqual(server.pushPayload(notice, true, 'kh'), { sourceType: 'lms', topic: 'assignment_due', sourceId: notice.subject_ref, noticeId: notice.id, language: 'kh' });
  assert.equal(server.pushPayload({ ...notice, subject_ref: null }, true).sourceId, notice.id, 'falls back to the notice itself');
  assert.ok(!JSON.stringify(server.pushPayload(notice, true)).includes('Front kicks'), 'no title or body on the lock screen');
});

test('the technique-steps handoff sample is exactly what the admin portal sends', () => {
  const envelope = JSON.parse(fs.readFileSync('docs/student-portal/library-v2-samples/lesson-roundhouse-technique-steps-en.json', 'utf8'));
  const parsed = v2.libraryV2DetailSchema.safeParse(envelope.data);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 2)));
});
