import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { operationsDatabase, root } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';
const { libraryPublicationProjection, canMarkLibraryLessonComplete } = loadTs('lib/library-publication.ts');
const migration = 'supabase/migrations/20261102181732_academy_content_publication.sql';
const base = { title: 'Fixture lesson', description: JSON.stringify({ text: 'Approved overview', actualCategory: 'Kicks (Chagi)', instructions: ['Lift the knee', 'Extend with control'], staffNotes: 'Private coordination' }), library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'White', video_url: 'https://video.example.test/lesson', muscleRelations: [] };
const payload = input => ({ ...input, studentProjection: libraryPublicationProjection(input) });
const call = (db, action, id, data, key = null) => db.query('SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,$5) result', [root, action, id, JSON.stringify(data), key]).then(result => result.rows[0].result);

test('public learning guidance is explicit, typed and excludes private authored metadata', () => {
  const result = libraryPublicationProjection(base);
  assert.equal(result.content_type, 'Taekwondo');
  assert.deepEqual(result.learning_content.instructions, ['Lift the knee', 'Extend with control']);
  assert.equal(JSON.stringify(result).includes('Private coordination'), false);
  assert.deepEqual(libraryPublicationProjection({ ...base, description: JSON.stringify({ text: 'Public', muscleTargets: [{ muscleId: 999, role: 'Primary' }] }) }).learning_content.muscleTargets, [], 'client metadata cannot invent anatomy links');
  assert.equal(libraryPublicationProjection({ ...base, library_type: 'Fitness' }).content_type, 'Fitness');
  assert.equal(libraryPublicationProjection({ ...base, target_level: 'Dance' }).content_type, 'Dance');
  assert.throws(() => libraryPublicationProjection({ ...base, description: JSON.stringify({ text: 'Overview', instructions: [{ unsupported: 'object' }] }) }), /guidance/);
  assert.equal(canMarkLibraryLessonComplete({ studentCurriculumId: 1, publishedRevision: null }), false);
  assert.equal(canMarkLibraryLessonComplete({ studentCurriculumId: 1, publishedRevision: 2 }), true);
});

test('draft edits retain the published snapshot and history until an explicit revision-checked publish', async () => {
  const db = await operationsDatabase();
  try {
    await db.exec(fs.readFileSync('supabase/migrations/20261101033142_library_student_projection.sql', 'utf8'));
    const existing = await call(db, 'CREATE', null, payload(base), 'a2000000-0000-4000-8000-000000000001');
    const id = existing.asset.id;
    await db.query("INSERT INTO lms_progress(student_id,curriculum_id,status)VALUES('STU-M-001',$1,'Completed')", [id]);
    const before = (await db.query('SELECT * FROM curriculum WHERE id=$1', [id])).rows[0];
    await db.exec(fs.readFileSync(migration, 'utf8'));
    const after = (await db.query('SELECT * FROM curriculum WHERE id=$1', [id])).rows[0];
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], 'installation preserves ' + key);
    assert.equal((await db.query('SELECT student_curriculum_id FROM library_assets WHERE id=$1', [id])).rows[0].student_curriculum_id, null, 'no legacy identity backfill');
    const changed = { ...base, title: 'Updated authored lesson', description: JSON.stringify({ text: 'New approved overview', instructions: ['New controlled step'], actualCategory: 'Kicks (Chagi)', staffNotes: 'Still private' }) };
    const saved = await call(db, 'UPDATE', id, { ...payload(changed), expectedRevision: 1 });
    assert.equal(saved.asset.revision, 2);
    assert.equal(saved.asset.published_revision, 0, 'a deliberately linked legacy publication is distinguished from a new private draft');
    assert.equal(saved.studentLesson.title, before.title);
    assert.equal(saved.studentLesson.description, before.description);
    const muscleId = (await db.query("INSERT INTO muscles(name,muscle_group)VALUES('Fixture target','Legs') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO library_asset_muscles(asset_id,muscle_id,role)VALUES($1,$2,'Primary')", [id, muscleId]);
    await db.query('SELECT portal_set_video_progress($1,$2,$3,true)', [root, 'STU-M-002', id]);
    assert.equal((await db.query('SELECT title FROM curriculum WHERE id=$1', [id])).rows[0].title, before.title, 'grading never publishes the staged draft');
    const published = await call(db, 'PUBLISH', id, { expectedRevision: 2, reason: 'Coach reviewed the technique', studentProjection: libraryPublicationProjection(changed) });
    assert.equal(published.asset.revision, 3); assert.equal(published.asset.published_revision, 3);
    assert.equal(published.studentLesson.title, changed.title);
    assert.equal(published.studentLesson.is_active, true);
    assert.deepEqual(published.studentLesson.learning_content.instructions, ['New controlled step']);
    assert.deepEqual(published.studentLesson.learning_content.muscleTargets, [{ muscleId, role: 'Primary' }]);
    await db.query('DELETE FROM library_asset_muscles WHERE asset_id=$1', [id]);
    assert.deepEqual((await db.query('SELECT learning_content FROM curriculum WHERE id=$1', [id])).rows[0].learning_content.muscleTargets, [{ muscleId, role: 'Primary' }], 'later draft anatomy edits do not change the approved snapshot');
    assert.equal(JSON.stringify(published.studentLesson).includes('Still private'), false);
    await assert.rejects(call(db, 'PUBLISH', id, { expectedRevision: 2, reason: 'Stale second approval', studentProjection: libraryPublicationProjection(changed) }), error => error.code === '40001');
    const hidden = await call(db, 'UNPUBLISH', id, { expectedRevision: 3, reason: 'Review training guidance' });
    assert.equal(hidden.studentLesson.is_active, false);
    assert.equal((await db.query('SELECT count(*)::int n FROM lms_progress WHERE curriculum_id=$1', [id])).rows[0].n, 2);
    await db.query('SELECT portal_set_video_progress($1,$2,$3,false)', [root, 'STU-M-002', id]);
    assert.equal((await db.query("SELECT status FROM lms_progress WHERE curriculum_id=$1 AND student_id='STU-M-002'", [id])).rows[0].status, 'Not Started', 'an incorrect grade can be cleared after unpublication');
    await assert.rejects(call(db, 'DELETE', id, { expectedRevision: 4 }), /student progress/);
  } finally { await db.close(); }
});

test('new assets start private, retries preserve identity and catalogs are bounded and literal-searchable', async () => {
  const db = await operationsDatabase();
  try {
    await db.exec(fs.readFileSync(migration, 'utf8'));
    const key = 'a2000000-0000-4000-8000-000000000002';
    const draft = await call(db, 'CREATE', null, payload(base), key);
    assert.equal(draft.studentLesson.is_active, false);
    assert.equal(draft.asset.student_curriculum_id, draft.studentLesson.id);
    await assert.rejects(db.query('SELECT portal_set_video_progress($1,$2,$3,true)', [root, 'STU-M-001', draft.asset.id]), /Publish this lesson/);
    assert.equal((await call(db, 'CREATE', null, payload(base), key)).asset.id, draft.asset.id);
    for (let i = 3; i < 6; i++) await call(db, 'CREATE', null, payload({ ...base, title: 'Fixture ' + i }), 'a2000000-0000-4000-8000-' + String(i).padStart(12, '0'));
    const list = async (search, state, limit, offset) => (await db.query('SELECT portal_library_catalog($1,$2,$3,$4,$5) data', [root, search, state, limit, offset])).rows[0].data;
    const page = await list('', 'draft', 2, 0);
    assert.equal(page.contractVersion, 'academy-library-v1'); assert.equal(page.items.length, 2); assert.equal(page.hasMore, true);
    assert.equal((await list('%', 'all', 25, 0)).items.length, 0, 'search metacharacters are literal');
    await assert.rejects(list('', 'all', 101, 0), error => error.code === '22023');
    await assert.rejects(list('', 'all', null, 0), error => error.code === '22023');
    const fitness = { ...base, title: 'General conditioning', library_type: 'Fitness', tkd_category: null, fitness_category: 'Strength', target_level: 'All' };
    const fitnessDraft = await call(db, 'CREATE', null, payload(fitness), 'a2000000-0000-4000-8000-000000000007');
    const publishedFitness = await call(db, 'PUBLISH', fitnessDraft.asset.id, { expectedRevision: 1, reason: 'Reviewed general conditioning', studentProjection: libraryPublicationProjection(fitness) });
    assert.equal(publishedFitness.studentLesson.content_type, 'Fitness');
    assert.equal(publishedFitness.studentLesson.category, 'Conditioning');
    assert.equal(publishedFitness.studentLesson.target_belt, 'All', 'general learning is not misclassified as White belt');
    await db.exec('SET ROLE authenticated');
    await assert.rejects(list('', 'all', 25, 0), /permission denied/);
    await assert.rejects(call(db, 'UNPUBLISH', draft.asset.id, { expectedRevision: 1, reason: 'Browser attempt' }), /permission denied/);
  } finally { await db.close(); }
});
