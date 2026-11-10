import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { panelItemScores, round1 } = loadTs('lib/belt-test-scoring.ts');
const { lessonLayoutRows, parseDuration, formatDuration, orderLessons, lessonLayoutRequestSchema } = loadTs('lib/lesson-layout.ts');
const { rankingReviewIssues } = loadTs('lib/student-portal-admin-contract.ts');
const { beltTestRequestSchema } = loadTs('lib/belt-test-contract.ts');
const { studentLesson } = loadTs('lib/student-catalog-contract.ts');

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('panel item scores: average of the panel, one decimal, only once every examiner scored', () => {
  assert.equal(round1(7.25), 7.3, 'half up like PostgreSQL');
  assert.equal(round1((7.1 + 7.2) / 2), 7.2, 'no binary drift at x.x5');
  const rows = [
    { item_id: 'a', score: 8, scored_by: 'x' }, { item_id: 'a', score: 7.5, scored_by: 'y' },
    { item_id: 'b', score: 9, scored_by: 'x' },
    { item_id: 'c', score: 6, scored_by: 'z' },
  ];
  assert.deepEqual(panelItemScores(rows, ['x', 'y']), { a: 7.8 }, 'b waits for y; z is not on the panel');
  assert.deepEqual(panelItemScores(rows), { a: 7.8, b: 9, c: 6 }, 'without a panel every score counts');
  assert.deepEqual(panelItemScores([], ['x']), {});
});

test('lesson layout: durations, ordering and the asset-to-lesson link', () => {
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration('4:05'), 245);
  assert.equal(parseDuration('1:02:03'), 3723);
  assert.equal(parseDuration('90'), 90);
  assert.equal(parseDuration('4:75'), undefined);
  assert.equal(parseDuration('0'), undefined);
  assert.equal(parseDuration('25:00:00'), undefined, 'longer than 24 hours');
  assert.equal(formatDuration(245), '4:05');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatDuration(null), '');
  assert.deepEqual(orderLessons([{ title: 'B', sortOrder: null }, { title: 'C', sortOrder: 2 }, { title: 'A', sortOrder: null }, { title: 'D', sortOrder: 1 }]).map(row => row.title), ['D', 'C', 'A', 'B']);
  const rows = lessonLayoutRows(
    [{ id: 1, title: 'Linked', target_level: 'Yellow', library_type: 'Taekwondo', student_curriculum_id: 10 }, { id: 2, title: 'Legacy', target_level: 'White', library_type: 'Taekwondo', student_curriculum_id: null },
      { id: 3, title: 'Renamed', target_level: 'White', library_type: 'Taekwondo', student_curriculum_id: null }, { id: 4, title: 'Unlinked', target_level: 'White', library_type: 'Fitness', student_curriculum_id: null }],
    [{ id: 10, title: 'Linked', is_active: true, sort_order: 3, duration_seconds: 245 }, { id: 2, title: 'Legacy', is_active: false, sort_order: null, duration_seconds: null }, { id: 3, title: 'Old title', is_active: true, sort_order: 1, duration_seconds: null }],
  );
  assert.deepEqual(rows.map(row => [row.assetId, row.isPublished, row.sortOrder, row.durationSeconds]), [[1, true, 3, 245], [2, false, null, null]], 'a legacy title mismatch or missing lesson is not linked');
  assert.ok(lessonLayoutRequestSchema.safeParse({ lessons: [{ assetId: 1, sortOrder: 1, durationSeconds: null }] }).success);
  assert.equal(lessonLayoutRequestSchema.safeParse({ lessons: [{ assetId: 1, sortOrder: 0, durationSeconds: null }] }).success, false);
  assert.equal(lessonLayoutRequestSchema.safeParse({ lessons: [] }).success, false);
});

test('learning-v1 lesson order and length stay off until enabled for the student portal', () => {
  const row = { id: 5, target_belt: 'Yellow', title: 'Lesson', description: 'Text', video_url: null, thumbnail_url: null, content_type: 'Taekwondo', content_category: 'Poomsae', learning_content: {}, sort_order: 4, duration_seconds: 245 };
  const plain = studentLesson(row);
  assert.equal('position' in plain || 'durationSeconds' in plain, false, 'the strict student portal schema keeps parsing today');
  const lesson = studentLesson(row, { layout: true });
  assert.equal(lesson.position, 4);
  assert.equal(lesson.durationSeconds, 245);
  const unset = studentLesson({ ...row, sort_order: null, duration_seconds: null }, { layout: true });
  assert.equal(unset.position, null);
  assert.equal(unset.durationSeconds, null);
});

test('ranking drafts flag athletes who opted out', () => {
  const draft = { seasonStart: '2026-01-01', seasonEnd: '2026-06-30', methodology: 'medal_order', reviewNotes: '', entries: [
    { student_id: 'STU-M-001', display_name: 'Athlete One', consent_reference: 'Form 12', gold: 1, silver: 0, bronze: 0 },
    { student_id: 'STU-F-002', display_name: 'Athlete Two', consent_reference: 'Form 13', gold: 0, silver: 1, bronze: 0 }] };
  assert.deepEqual(rankingReviewIssues(draft), []);
  assert.deepEqual(rankingReviewIssues(draft, new Set(['STU-F-002'])), ['Athlete Two opted out of rankings; remove this athlete before publishing.']);
});

test('belt test extras request contract', () => {
  const ok = value => beltTestRequestSchema.safeParse({ requestKey: uuid(1), ...value }).success;
  assert.ok(ok({ action: 'approve_request', id: uuid(2) }));
  assert.ok(ok({ action: 'decline_request', id: uuid(2), reason: 'Two more classes first' }));
  assert.equal(ok({ action: 'decline_request', id: uuid(2), reason: 'no' }), false);
  assert.ok(ok({ action: 'fee_update', candidateId: uuid(3), revision: 2, status: 'paid', method: 'Cash', paidOn: '2026-11-10', amountUsd: 25 }));
  assert.equal(ok({ action: 'fee_update', candidateId: uuid(3), revision: 2, status: 'paid', amountUsd: 25.005 }), false, 'cents at most');
  assert.ok(ok({ action: 'examiners_set', eventId: uuid(4), examiners: [] }));
  assert.equal(ok({ action: 'examiners_set', eventId: uuid(4), examiners: [1, 2, 3, 4, 5, 6].map(uuid) }), false);
  assert.ok(ok({ action: 'event_create', syllabusId: uuid(5), title: 'Yellow test', examDate: '2026-12-01', startTime: '09:00', location: '', branchId: null, capacity: 20, acceptsRequests: false }));
  assert.equal(ok({ action: 'event_create', syllabusId: uuid(5), title: 'Yellow test', examDate: '2026-12-01', startTime: '09:00', location: '', branchId: null, capacity: 0 }), false);
});
