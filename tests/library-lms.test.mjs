import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { libraryLessonState, isPrivateLibraryDraft } = loadTs('lib/library-publication.ts');
const { lessonThumbnailUrl } = loadTs('lib/lesson-media.ts');
const { parseAssetDescription, calculatePromotionReadiness, isAllBeltsLesson, isSyllabusLessonFor } = loadTs('lib/utils.ts');
const { academyDate, addCalendarDays } = loadTs('lib/dates.ts');
const { validateLibraryImportRecord, validateLibraryImportRows, canonicalImportBelt } = loadTs('lib/library-import.ts');

test('library publication state is derived from the staff row without guessing', () => {
  assert.equal(libraryLessonState({ studentCurriculumId: null, publishedRevision: null, revision: 3 }), 'legacy');
  assert.equal(libraryLessonState({ studentCurriculumId: 9, publishedRevision: 0, revision: 3 }), 'legacy');
  assert.equal(libraryLessonState({ studentCurriculumId: 9, publishedRevision: null, revision: 1 }), 'draft');
  assert.equal(libraryLessonState({ studentCurriculumId: 9, publishedRevision: 2, revision: 2 }), 'current');
  assert.equal(libraryLessonState({ studentCurriculumId: 9, publishedRevision: 2, revision: 4 }), 'changes');
  assert.equal(isPrivateLibraryDraft({ studentCurriculumId: 9, publishedRevision: null }), true);
  assert.equal(isPrivateLibraryDraft({ studentCurriculumId: null, publishedRevision: null }), false, 'legacy rows stay visible');
});

test('a private draft never lowers a student syllabus or promotion readiness', () => {
  const student = { id: 'S1', currentBelt: 'White', registrationDate: addCalendarDays(academyDate(), -10), studentStatus: 'Active' };
  const published = { id: 1, title: 'Front kick', minBeltLevel: 'White', category: 'Kicks (Chagi)', description: '', studentCurriculumId: 1, publishedRevision: 1, revision: 1 };
  const draft = { id: 2, title: 'New draft', minBeltLevel: 'White', category: 'Kicks (Chagi)', description: '', studentCurriculumId: 2, publishedRevision: null, revision: 1 };
  const progress = [{ studentId: 'S1', videoId: 1, status: 'Completed' }];
  const report = calculatePromotionReadiness(student, [], progress, [published, draft], [], [], []);
  assert.equal(report.totalVideos, 1);
  assert.equal(report.completedVideos, 1);
  assert.equal(report.syllabusCompletedPct, 100);
  assert.equal(report.syllabusEligible, true);
});

test('lessons for all belts are required at every belt; fitness and dance never are', () => {
  const student = { id: 'S1', currentBelt: 'Yellow', registrationDate: addCalendarDays(academyDate(), -10), studentStatus: 'Active' };
  const lesson = (id, minBeltLevel, category = 'Theory & Terminology') => ({ id, title: 'Lesson ' + id, minBeltLevel, category, description: '', studentCurriculumId: id, publishedRevision: 1, revision: 1 });
  const videos = [lesson(1, 'Yellow'), lesson(2, 'All'), lesson(3, 'Red'), lesson(4, 'Fitness', 'Fitness: Strength'), lesson(5, 'Dance', 'Dance: Hiphop'), lesson(6, 'All', 'Fitness: Core')];
  const report = calculatePromotionReadiness(student, [], [{ studentId: 'S1', videoId: 1, status: 'Completed' }], videos, [], [], []);
  assert.equal(report.totalVideos, 2, 'the Yellow lesson and the all-belts lesson');
  assert.equal(report.completedVideos, 1);
  assert.equal(report.syllabusCompletedPct, 50);
  assert.equal(report.syllabusEligible, false);
  assert.equal(isAllBeltsLesson('All Belts'), true);
  assert.equal(isAllBeltsLesson('all'), true);
  assert.equal(isAllBeltsLesson('White'), false);
  assert.equal(isSyllabusLessonFor({ ...lesson(7, 'All'), publishedRevision: null }, 'Yellow'), false, 'an all-belts draft is still private');
});

test('lesson descriptions are normalised so legacy rows display and re-save safely', () => {
  const missingText = parseAssetDescription(JSON.stringify({ actualCategory: 'Kicks (Chagi)' }));
  assert.equal(missingText.text, '', 'structured rows without text never fall back to raw JSON');
  const legacy = parseAssetDescription(JSON.stringify({
    text: 'Overview', difficulty: 'Easy', instructions: 'Step 1: Chamber\nStep 2: Extend', focusZones: ['Quads', 7],
    terminology: [{ korean: 'Ap chagi', english: 'Front kick' }, 'bad'], studyGuide: [{ question: 'Why?' }], fitnessSolutions: ['3', 'x'],
  }));
  assert.equal(legacy.difficulty, undefined);
  assert.deepEqual(legacy.instructions, ['Step 1: Chamber', 'Step 2: Extend']);
  assert.deepEqual(legacy.focusZones, ['Quads']);
  assert.deepEqual(legacy.terminology, [{ korean: 'Ap chagi', english: 'Front kick', khmer: '' }]);
  assert.deepEqual(legacy.studyGuide, [{ question: 'Why?', answer: '' }]);
  assert.deepEqual(legacy.fitnessSolutions, [3]);
  assert.equal(parseAssetDescription('Plain text lesson').text, 'Plain text lesson');
  assert.equal(parseAssetDescription('{not json}').text, '{not json}');
});

test('lesson artwork uses only authored HTTPS images or the YouTube poster', () => {
  assert.equal(lessonThumbnailUrl('https://cdn.example.test/a.jpg', ''), 'https://cdn.example.test/a.jpg');
  assert.equal(lessonThumbnailUrl('http://cdn.example.test/a.jpg', 'https://youtu.be/dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(lessonThumbnailUrl('', 'https://vimeo.com/123456'), null);
  assert.equal(lessonThumbnailUrl(undefined, undefined), null);
});

test('bulk import preview rejects rows the save API would reject', () => {
  const row = { title: 'Ap Chagi', description: 'Front kick', category: 'Kicks (Chagi)', minBeltLevel: 'White', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' };
  assert.deepEqual(validateLibraryImportRecord(row, 'tkd', []), []);
  assert.match(validateLibraryImportRecord({ ...row, videoUrl: 'http://example.test/v.mp4' }, 'tkd', []).join(' '), /https/);
  assert.match(validateLibraryImportRecord({ ...row, videoUrl: 'https://user:pass@example.test/v.mp4' }, 'tkd', []).join(' '), /https/);
  assert.match(validateLibraryImportRecord({ ...row, title: 'x'.repeat(151) }, 'tkd', []).join(' '), /150/);
  assert.match(validateLibraryImportRecord(row, 'tkd', [{ title: ' ap chagi ', category: 'Kicks (Chagi)' }]).join(' '), /already exists/);
  assert.equal(canonicalImportBelt(' yellow '), 'Yellow');
  assert.equal(canonicalImportBelt('1st poom/dan'), '1st Poom/Dan');
  const rows = validateLibraryImportRows([
    { index: 1, data: row, errors: [], isValid: false },
    { index: 2, data: { ...row, title: 'AP CHAGI' }, errors: [], isValid: false },
    { index: 3, data: { ...row, title: 'Dollyo Chagi' }, errors: [], isValid: false },
  ], record => validateLibraryImportRecord(record, 'tkd', []));
  assert.deepEqual(rows.map(entry => entry.isValid), [true, false, true]);
  assert.match(rows[1].errors.join(' '), /Duplicate of row 1/);
});
