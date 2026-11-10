import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const { libraryContentSchema } = loadTs('lib/library-content.ts');

export const LIBRARY_CONTENT_MIGRATION = '20261110100715_library_content_structure';
const migrations = ['20261101033142_library_student_projection', '20261101161201_role_permission_boundaries', '20261102181732_academy_content_publication', '20261107090148_student_portal_data_requests',
  '20261107095953_belt_test_system', '20261109063848_belt_test_foreign_key_indexes', '20261110062131_ranking_lesson_layout_belt_test_extras', LIBRARY_CONTENT_MIGRATION];
const studentAccount = '92000000-0000-4000-8000-000000000001';
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function setup() {
  const db = await operationsDatabase();
  for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'reader@example.test')", [studentAccount]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id,is_active,must_change_password) VALUES($1,'reader','reader@example.test','Reader','Student','STU-M-001',true,false)", [studentAccount]);
  return db;
}
const category = (db, action, payload, id = null, actor = root) => one(db, 'SELECT portal_save_library_category($1,$2,$3,$4::jsonb) AS r', [actor, action, id, JSON.stringify(payload)]).then(row => row.r);
const categoryInput = slug => ({ slug, title: 'Poomsae (Forms)', koreanTitle: '품새', subtitle: 'Forms', description: 'Standard forms.', icon: 'BookOpen', accentColor: '#EF2F38', libraryType: 'Taekwondo', isActive: true, translations: { km: { title: 'ទម្រង់' } } });
async function createLesson(db, title, targetLevel = 'White') {
  const input = { title, description: JSON.stringify({ text: 'Lesson overview', instructions: ['Step one'] }), library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: targetLevel, video_url: '' };
  return (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,$5) AS r', [root, 'CREATE', null, JSON.stringify({ ...input, studentProjection: libraryPublicationProjection(input) }), randomUUID()])).r.asset;
}
const content = libraryContentSchema.parse({
  sections: [{ id: 'steps', type: 'steps', title: 'Steps', items: [{ title: '', body: 'Step one', details: [] }] }, { id: 'terms', type: 'glossary', title: 'Terms', items: [{ korean: '앞차기', romanized: 'Ap-chagi', english: 'Front kick', category: 'Kick' }] }],
  translations: { km: { title: 'ទាត់មុខ', sections: { steps: { title: 'ជំហាន' } } } },
  sources: [{ label: 'Kukkiwon', url: 'https://www.kukkiwon.or.kr' }],
});
const metadata = categoryId => ({ categoryId, kind: 'lesson', slug: 'front-kick', koreanName: '앞차기', romanized: 'Ap Chagi', summary: 'The foundational snap kick.', levelNote: 'White Belt and Above', tags: ['kick'] });

test('categories: create, unique web name, versioned update, reorder, guarded delete, staff only', async () => {
  const db = await setup();
  try {
    const poomsae = await category(db, 'CREATE', categoryInput('poomsae'));
    assert.equal(poomsae.title, 'Poomsae (Forms)');
    assert.equal(poomsae.translations.km.title, 'ទម្រង់');
    await assert.rejects(category(db, 'CREATE', categoryInput('poomsae')), /already uses the web name/);
    await assert.rejects(category(db, 'CREATE', { ...categoryInput('Bad Slug') }), /web name/);
    const kicks = await category(db, 'CREATE', { ...categoryInput('kicking'), title: 'Kicking' });
    assert.ok(kicks.sort_order > poomsae.sort_order);
    await assert.rejects(category(db, 'UPDATE', { ...categoryInput('poomsae'), expectedRevision: 9 }, poomsae.id), /changed/);
    const renamed = await category(db, 'UPDATE', { ...categoryInput('poomsae'), title: 'Forms', isActive: false, expectedRevision: 1 }, poomsae.id);
    assert.deepEqual([renamed.title, renamed.is_active, renamed.revision], ['Forms', false, 2]);
    assert.equal((await category(db, 'REORDER', { order: [kicks.id, poomsae.id] })).reordered, 2);
    const order = (await db.query('SELECT slug FROM library_categories ORDER BY sort_order')).rows.map(row => row.slug);
    assert.deepEqual(order, ['kicking', 'poomsae']);

    const lesson = await createLesson(db, 'Front Kick');
    await one(db, 'SELECT portal_save_library_content($1,$2,$3::jsonb) AS r', [root, lesson.id, JSON.stringify({ expectedRevision: lesson.revision, metadata: metadata(kicks.id), content })]);
    await assert.rejects(category(db, 'DELETE', { expectedRevision: kicks.revision }, kicks.id), /1 lessons use this category/);
    assert.equal((await category(db, 'DELETE', { expectedRevision: 2 }, poomsae.id)).deleted, poomsae.id);
    await assert.rejects(category(db, 'CREATE', categoryInput('stances'), null, studentAccount), /Staff access required/);
  } finally { await db.close(); }
});

test('lesson content: metadata and sections saved together, revision checked, web names unique', async () => {
  const db = await setup();
  try {
    const kicks = await category(db, 'CREATE', categoryInput('kicking'));
    const lesson = await createLesson(db, 'Front Kick');
    const saved = (await one(db, 'SELECT portal_save_library_content($1,$2,$3::jsonb) AS r', [root, lesson.id, JSON.stringify({ expectedRevision: lesson.revision, metadata: metadata(kicks.id), content })])).r;
    assert.equal(saved.asset.revision, lesson.revision + 1, 'content edits are draft changes');
    assert.deepEqual([saved.asset.category_id, saved.asset.slug, saved.asset.korean_name, saved.asset.tags], [kicks.id, 'front-kick', '앞차기', ['kick']]);
    assert.equal(saved.content.sections.length, 2);
    await assert.rejects(db.query('SELECT portal_save_library_content($1,$2,$3::jsonb)', [root, lesson.id, JSON.stringify({ expectedRevision: lesson.revision, metadata: metadata(kicks.id), content })]), /changed/);
    const other = await createLesson(db, 'Side Kick');
    await assert.rejects(db.query('SELECT portal_save_library_content($1,$2,$3::jsonb)', [root, other.id, JSON.stringify({ expectedRevision: other.revision, metadata: metadata(kicks.id), content })]), /already uses the web name/);
    await assert.rejects(db.query('SELECT portal_save_library_content($1,$2,$3::jsonb)', [root, other.id, JSON.stringify({ expectedRevision: other.revision, metadata: { ...metadata(randomUUID()), slug: 'side-kick' }, content })]), /existing category/);
    await assert.rejects(db.query('SELECT portal_save_library_content($1,$2,$3::jsonb)', [studentAccount, other.id, JSON.stringify({ expectedRevision: other.revision, metadata: metadata(null), content })]), /Staff access required/);
  } finally { await db.close(); }
});

test('publishing: blocked without a belt, then snapshots sections and translations for library-v2', async () => {
  const db = await setup();
  try {
    const kicks = await category(db, 'CREATE', categoryInput('kicking'));
    let lesson = await createLesson(db, 'Front Kick', 'Unassigned');
    lesson = (await one(db, 'SELECT portal_save_library_content($1,$2,$3::jsonb) AS r', [root, lesson.id, JSON.stringify({ expectedRevision: lesson.revision, metadata: metadata(kicks.id), content })])).r.asset;
    const publish = (asset, projection) => one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'PUBLISH', asset.id, JSON.stringify({ expectedRevision: asset.revision, reason: 'Ready for students', studentProjection: projection })]);
    const projection = libraryPublicationProjection({ description: lesson.description, video_url: '', library_type: 'Taekwondo', target_level: 'Unassigned', tkd_category: 'Poomsae' });
    await assert.rejects(publish(lesson, projection), /Choose a belt/);
    const input = { title: 'Front Kick', description: lesson.description, library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'White', video_url: '' };
    lesson = (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'UPDATE', lesson.id, JSON.stringify({ ...input, expectedRevision: lesson.revision, studentProjection: libraryPublicationProjection(input) })])).r.asset;
    const published = (await publish(lesson, libraryPublicationProjection(input))).r;
    assert.equal(published.studentLesson.is_active, true);
    const snapshot = await one(db, 'SELECT * FROM library_published_content WHERE asset_id=$1', [lesson.id]);
    assert.equal(snapshot.curriculum_id, published.studentLesson.id);
    assert.equal(snapshot.category_id, kicks.id);
    assert.equal(snapshot.document.slug, 'front-kick');
    assert.equal(snapshot.document.sections.length, 2);
    assert.equal(snapshot.document.translations.km.title, 'ទាត់មុខ');
    assert.equal(snapshot.published_revision, published.asset.published_revision);

    // Republishing replaces the snapshot; deleting the lesson removes it.
    const unpublished = (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'UNPUBLISH', lesson.id, JSON.stringify({ expectedRevision: published.asset.revision, reason: 'Revising the lesson' })])).r.asset;
    await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'DELETE', lesson.id, JSON.stringify({ expectedRevision: unpublished.revision })]);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM library_published_content')).n, 0);
    assert.equal((await one(db, 'SELECT count(*)::int n FROM library_asset_content')).n, 0);
  } finally { await db.close(); }
});

test('library-v2 feed page: published lessons only, filters, hidden categories, translations, server only', async () => {
  const db = await setup();
  try {
    const kicks = await category(db, 'CREATE', { ...categoryInput('kicking'), title: 'Kicking' });
    const history = await category(db, 'CREATE', { ...categoryInput('history'), title: 'History' });
    const publish = async (title, cat, kind) => {
      let lesson = await createLesson(db, title);
      lesson = (await one(db, 'SELECT portal_save_library_content($1,$2,$3::jsonb) AS r', [root, lesson.id, JSON.stringify({ expectedRevision: lesson.revision, metadata: { ...metadata(cat.id), kind, slug: title.toLowerCase().replace(/\W+/g, '-') }, content })])).r.asset;
      const input = { title, description: lesson.description, library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'White', video_url: '' };
      return (await one(db, 'SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,NULL) AS r', [root, 'PUBLISH', lesson.id, JSON.stringify({ expectedRevision: lesson.revision, reason: 'Ready for students', studentProjection: libraryPublicationProjection(input) })])).r.asset;
    };
    const kick = await publish('Front Kick', kicks, 'lesson');
    const story = await publish('History Timeline', history, 'article');
    await createLesson(db, 'Private Draft');
    const page = async (args = {}) => (await one(db, 'SELECT portal_student_library_page($1,$2,$3,$4,$5,$6) AS r', [args.lang ?? 'en', args.category ?? null, args.kind ?? null, args.pattern ?? null, args.after ?? null, args.limit ?? 10])).r;
    const all = await page();
    assert.deepEqual(all.map(row => row.title), ['Front Kick', 'History Timeline'], 'drafts never reach students');
    assert.deepEqual([all[0].published.category, all[0].published.kind, all[0].published.sectionCount], ['kicking', 'lesson', 2]);
    assert.deepEqual((await page({ category: 'history' })).map(row => row.id), [story.student_curriculum_id]);
    assert.deepEqual((await page({ kind: 'article' })).map(row => row.title), ['History Timeline']);
    assert.deepEqual((await page({ pattern: '%front%' })).map(row => row.title), ['Front Kick']);
    assert.deepEqual((await page({ pattern: '%ទាត់មុខ%', lang: 'km' })).map(row => row.title), ['Front Kick', 'History Timeline'], 'translated titles are searchable');
    assert.equal((await page({ lang: 'km' }))[0].published.translation.title, 'ទាត់មុខ');
    assert.deepEqual((await page({ after: kick.student_curriculum_id })).map(row => row.title), ['History Timeline']);
    await category(db, 'UPDATE', { ...categoryInput('history'), title: 'History', isActive: false, expectedRevision: history.revision }, history.id);
    assert.deepEqual((await page()).map(row => row.title), ['Front Kick'], 'a hidden category hides its lessons');
    await assert.rejects(page({ lang: 'ko' }), /supported library filters/);
    await db.query("SELECT set_config('request.jwt.role','authenticated',false)");
    await assert.rejects(page(), /Server only/);
  } finally { await db.close(); }
});

test('website import: new drafts without a belt, title matches merged, corrupted titles fixed, repeat runs skipped', async () => {
  const db = await setup();
  try {
    const existing = await createLesson(db, 'Hook Kick (Huryeo Chagi / 후려 can기)', 'Green');
    // Mirror the live data: an active legacy curriculum row linked by id and title.
    await db.query('UPDATE curriculum SET is_active=true WHERE id=$1', [existing.id]);
    await db.query('UPDATE library_assets SET student_curriculum_id=NULL,published_revision=NULL WHERE id=$1', [existing.id]);
    const guidance = { text: 'Website text', instructions: ['Chamber', 'Snap'], mistakes: [{ mistake: 'Dropping the guard', correction: 'Keep hands up' }] };
    const item = (sourceKey, extra = {}) => ({ sourceKey, title: 'Taegeuk 1 (Il Jang)', slug: 'taegeuk-1-il-jang', kind: 'lesson', categorySlug: 'poomsae', tkdCategory: 'Poomsae', koreanName: '태극 1장', romanized: 'Taegeuk Il Jang', summary: 'The first Taegeuk form.', levelNote: 'White Belt',
      tags: ['taegeuk'], description: JSON.stringify(guidance), projectionText: guidance.text, guidance, content, ...extra });
    const payload = { source: 'website', categories: [categoryInput('poomsae'), { ...categoryInput('kicking'), title: 'Kicking' }],
      items: [item('web:taegeuk-1'), item('web:hook-kick', { title: 'Hook Kick', slug: 'hook-kick', categorySlug: 'kicking', tkdCategory: 'Chagi', mergeTitle: 'Hook Kick (Huryeo Chagi / 후려 can기)', fixedTitle: 'Hook Kick (Huryeo Chagi / 후려차기)' })] };
    const result = (await one(db, 'SELECT portal_import_library_content($1,$2::jsonb) AS r', [root, JSON.stringify(payload)])).r;
    assert.equal(result.categoriesAdded, 2);
    assert.equal(result.created.length, 1);
    assert.deepEqual(result.merged, [{ sourceKey: 'web:hook-kick', id: existing.id }]);

    const created = await one(db, 'SELECT a.*,c.is_active,c.target_belt FROM library_assets a JOIN curriculum c ON c.id=a.student_curriculum_id WHERE a.source_key=$1', ['web:taegeuk-1']);
    assert.deepEqual([created.target_level, created.is_active, created.published_revision, created.slug, created.korean_name], ['Unassigned', false, null, 'taegeuk-1-il-jang', '태극 1장'], 'imported lessons are private drafts with no belt');
    assert.equal((await one(db, 'SELECT jsonb_array_length(sections) n FROM library_asset_content WHERE asset_id=$1', [created.id])).n, 2);

    const merged = await one(db, 'SELECT a.*,c.title AS live_title FROM library_assets a JOIN curriculum c ON c.id=a.student_curriculum_id WHERE a.id=$1', [existing.id]);
    assert.equal(merged.target_level, 'Green', 'a merged lesson keeps its belt');
    assert.equal(merged.title, 'Hook Kick (Huryeo Chagi / 후려차기)');
    assert.equal(merged.live_title, 'Hook Kick (Huryeo Chagi / 후려차기)', 'the corrected title reaches the live lesson');
    assert.equal(merged.published_revision, 0, 'a live legacy lesson stays live');
    const description = JSON.parse(merged.description);
    assert.equal(description.text, 'Lesson overview', 'staff text is kept');
    assert.deepEqual(description.instructions, ['Step one'], 'existing guidance is kept');
    assert.equal(description.mistakes[0].mistake, 'Dropping the guard', 'missing guidance is added');

    const again = (await one(db, 'SELECT portal_import_library_content($1,$2::jsonb) AS r', [root, JSON.stringify(payload)])).r;
    assert.deepEqual([again.categoriesAdded, again.created.length, again.merged.length, again.skipped.length], [0, 0, 0, 2]);
    await db.query("UPDATE library_assets SET summary='Edited by staff' WHERE id=$1", [created.id]);
    const overwritten = (await one(db, 'SELECT portal_import_library_content($1,$2::jsonb) AS r', [root, JSON.stringify({ ...payload, overwrite: true, items: [item('web:taegeuk-1', { content: { ...content, sections: content.sections.slice(0, 1) } })] })])).r;
    assert.equal(overwritten.updated.length, 1);
    assert.equal((await one(db, 'SELECT summary FROM library_assets WHERE id=$1', [created.id])).summary, 'Edited by staff', 'overwrite replaces sections, not staff edits to the details');
    assert.equal((await one(db, 'SELECT jsonb_array_length(sections) n FROM library_asset_content WHERE asset_id=$1', [created.id])).n, 1);
    await assert.rejects(db.query('SELECT portal_import_library_content($1,$2::jsonb)', [studentAccount, JSON.stringify(payload)]), /Staff access required/);
    const audit = await one(db, "SELECT details FROM audit_logs WHERE action='LIBRARY_CONTENT_IMPORTED' ORDER BY created_at LIMIT 1");
    assert.equal(audit.details.created, 1);
  } finally { await db.close(); }
});
