import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { beltKey, nextBelt, libraryUsageRows, usageByAsset, lessonDeletionBlock, lessonUsageNote, studentTestRows } = loadTs('lib/belt-test-links.ts');
const belts = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan'].map((belt_name, index) => ({ id: index + 1, belt_name, belt_order: index + 1 }));

test('belt keys and the next belt follow the database rules', () => {
  assert.equal(beltKey('White Belt'), 'white');
  assert.equal(beltKey('Black 1st Dan'), 'dan-1');
  assert.equal(beltKey('1st Poom/Dan'), 'dan-1');
  assert.equal(nextBelt('White', belts).belt_name, 'Yellow');
  assert.equal(nextBelt('Red', belts).belt_name, '1st Poom/Dan');
  assert.equal(nextBelt('Black 1st Dan', belts).belt_name, '2nd Poom/Dan');
  assert.equal(nextBelt('2nd Poom/Dan', belts), null);
  assert.equal(nextBelt('Unknown', belts), null);
});

test('library usage lists draft and published syllabi and guards deleting a published test lesson', () => {
  const syllabi = [{ id: 's1', target_belt_id: 2, track: 'color', status: 'published', version: 1 }, { id: 's2', target_belt_id: 3, track: 'color', status: 'draft', version: 1 }, { id: 's3', target_belt_id: 2, track: 'color', status: 'retired', version: 0 }];
  const sections = [{ id: 'x1', syllabus_id: 's1', title: 'Poomsae Test' }, { id: 'x2', syllabus_id: 's2', title: 'Poomsae Test' }, { id: 'x3', syllabus_id: 's3', title: 'Old' }];
  const items = [{ section_id: 'x1', title: 'Taegeuk Il Jang', library_asset_id: 7 }, { section_id: 'x2', title: 'Taegeuk Ee Jang', library_asset_id: 8 }, { section_id: 'x3', title: 'Retired', library_asset_id: 9 }, { section_id: 'x1', title: 'Free text', library_asset_id: null }];
  const usage = libraryUsageRows(syllabi, sections, items, belts);
  assert.deepEqual(usage.map(row => [row.libraryAssetId, row.targetBelt, row.status]), [[7, 'Yellow', 'published'], [8, 'Green', 'draft']], 'retired syllabi and free-text items are not links');
  const byAsset = usageByAsset(usage);
  assert.match(lessonDeletionBlock(byAsset.get(7)), /published Yellow belt test/);
  assert.equal(lessonDeletionBlock(byAsset.get(8)), null, 'a draft never blocks deletion');
  assert.match(lessonUsageNote(byAsset.get(8)), /draft Green/);
  assert.equal(lessonDeletionBlock(undefined), null);
});

test('student test history shows results only once finalized, newest first', () => {
  const rows = studentTestRows([
    { id: 'c1', event_id: 'e1', status: 'scoring', result: 'pending', overall_percent: null, section_results: null, grading_events: { title: 'Yellow test', kind: 'color', exam_date: '2026-10-01', results_published_at: null, cancelled_at: null, belts: { belt_name: 'Yellow' } } },
    { id: 'c2', event_id: 'e2', status: 'finalized', result: 'pass', overall_percent: '78.50', section_results: [{ title: 'Poomsae Test', percent: 80, grade: 'B', met: true }], grading_events: { title: 'Green test', kind: 'color', exam_date: '2026-11-01', results_published_at: null, cancelled_at: null, belts: { belt_name: 'Green' } } },
  ]);
  assert.deepEqual(rows.map(row => row.candidateId), ['c2', 'c1']);
  assert.equal(rows[0].overallPercent, 78.5);
  assert.equal(rows[0].resultsPublished, false);
  assert.equal(rows[0].sections[0].grade, 'B');
  assert.equal(rows[1].result, null, 'in-progress scores are not shown as a result');
  assert.deepEqual(rows[1].sections, []);
});
