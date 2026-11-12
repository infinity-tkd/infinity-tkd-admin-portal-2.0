#!/usr/bin/env node
/**
 * Read-only health check of the library for the student portal. For every lesson,
 * in English, Khmer and Chinese, it builds the library-v2 response the student
 * portal would receive (as if published) and checks it against the contract and the
 * student portal's 1 MB gateway limit. Live lessons are also checked as learning-v1,
 * with the student portal's own schema when its checkout sits next to this one.
 *
 *   node scripts/check-library-v2-data.mjs [--samples <dir>]
 *
 * --samples writes example responses (a page and lessons) for the student portal team.
 * Uses the service role from .env.local and never writes to the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from '../tests/load-ts.mjs';

const argv = process.argv.slice(2);
const samplesDir = argv.includes('--samples') ? argv[argv.indexOf('--samples') + 1] : null;
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const v2 = loadTs('lib/library-v2-contract.ts');
const { libraryContentSchema, UNASSIGNED_BELT } = loadTs('lib/library-content.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const { studentLesson } = loadTs('lib/student-catalog-contract.ts');
const siblingContract = path.resolve('..', 'infinitytkd student portal 2.0', 'lib', 'published-catalog-contract.ts');
const student = fs.existsSync(siblingContract) ? loadTs(siblingContract) : null;

const must = async query => { const { data, error } = await query; if (error) throw new Error(error.message); return data; };
const [assets, contents, categories, curriculum, published] = await Promise.all([
  must(db.from('library_assets').select('*').order('id').limit(5000)),
  must(db.from('library_asset_content').select('asset_id,sections,translations,sources').limit(5000)),
  must(db.from('library_categories').select('*').order('sort_order').limit(500)),
  must(db.from('curriculum').select('*').limit(5000)),
  must(db.from('library_published_content').select('*').limit(5000)),
]);
const contentById = new Map(contents.map(row => [row.asset_id, row]));
const categoryById = new Map(categories.map(row => [row.id, row]));
const curriculumById = new Map(curriculum.map(row => [row.id, row]));
const publishedByCurriculum = new Map(published.map(row => [row.curriculum_id, row]));
const LIMIT = 1024 * 1024, langs = ['en', 'km', 'zh'];
const issues = [];
const report = { lessons: assets.length, withContent: 0, readyToPublish: 0, noBeltYet: 0, uncategorized: 0, livePublished: 0, liveWithSnapshot: 0, largestResponseBytes: { en: 0, km: 0, zh: 0 }, largestLesson: '' };
const envelope = data => JSON.stringify({ success: true, data: { ...data, contractVersion: 'library-v2' }, error: null });
const samples = {};

for (const asset of assets) {
  const content = contentById.get(asset.id);
  if (content) report.withContent++;
  if (!asset.category_id) report.uncategorized++;
  if (asset.target_level === UNASSIGNED_BELT) report.noBeltYet++;
  let projection;
  try { projection = libraryPublicationProjection(asset); if (asset.target_level !== UNASSIGNED_BELT) report.readyToPublish++; }
  catch (error) { issues.push(`${asset.id} ${asset.title}: cannot be published (${error.message})`); continue; }
  const parsedContent = content ? libraryContentSchema.safeParse({ sections: content.sections, translations: content.translations, sources: content.sources }) : null;
  if (parsedContent && !parsedContent.success) issues.push(`${asset.id} ${asset.title}: saved content is invalid (${parsedContent.error.issues[0]?.message})`);
  // The response this lesson would give once published (the same snapshot the publish step writes).
  // Publishing needs a belt, so a lesson without one is checked (and sampled) as an "All" lesson.
  const row = { id: asset.student_curriculum_id ?? asset.id, target_belt: asset.target_level === UNASSIGNED_BELT ? 'All' : asset.target_level, title: asset.title, description: projection.description, video_url: projection.video_url, thumbnail_url: projection.thumbnail_url,
    content_type: projection.content_type, learning_content: projection.learning_content, sort_order: null, duration_seconds: null };
  const snapshot = content ? { content_kind: asset.content_kind, document: { slug: asset.slug, summary: asset.summary, koreanName: asset.korean_name, romanized: asset.romanized, levelNote: asset.level_note, tags: asset.tags,
    sections: content.sections, translations: content.translations, sources: content.sources } } : null;
  const categorySlug = categoryById.get(asset.category_id)?.slug ?? null;
  for (const lang of langs) {
    const lesson = v2.libraryV2Lesson(row, snapshot, categorySlug, lang);
    const data = { subjectStudentId: 'STU-M-000', lang, lesson };
    const parsed = v2.libraryV2DetailSchema.safeParse({ ...data, contractVersion: 'library-v2' });
    if (!parsed.success) issues.push(`${asset.id} ${asset.title} (${lang}): library-v2 lesson invalid (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message})`);
    const bytes = Buffer.byteLength(envelope(data));
    if (bytes > report.largestResponseBytes[lang]) { report.largestResponseBytes[lang] = bytes; if (lang === 'km') report.largestLesson = asset.title; }
    if (bytes > LIMIT) issues.push(`${asset.id} ${asset.title} (${lang}): ${bytes} bytes is over the student portal's 1 MB limit`);
    if (samplesDir && ['web:taegeuk-1', 'web:front-kick-ap-chagi', 'web:ref:history-timeline'].includes(asset.source_key) && lang !== 'zh') samples[`lesson-${asset.slug}-${lang}`] = JSON.parse(envelope(data));
  }
  const summary = v2.libraryV2Summary({ id: row.id, targetBelt: row.target_belt, title: row.title, description: row.description, videoUrl: row.video_url, thumbnailUrl: row.thumbnail_url, type: row.content_type,
    published: snapshot ? { category: categorySlug, kind: asset.content_kind, slug: asset.slug, summary: asset.summary, koreanName: asset.korean_name, romanized: asset.romanized, levelNote: asset.level_note, tags: asset.tags,
      sectionCount: (content.sections ?? []).length } : null });
  if (!v2.libraryV2LessonSummarySchema.safeParse(summary).success) issues.push(`${asset.id} ${asset.title}: library-v2 card invalid`);
  if (samplesDir && asset.category_id && categorySlug === 'poomsae') (samples.page ??= []).push(summary);
}

// Live lessons as students receive them today (learning-v1) and in library-v2.
for (const lesson of curriculum.filter(row => row.is_active)) {
  report.livePublished++;
  const snapshot = publishedByCurriculum.get(lesson.id);
  if (snapshot) report.liveWithSnapshot++;
  const v1 = studentLesson(lesson);
  if (!v1) issues.push(`live ${lesson.id} ${lesson.title}: learning-v1 guidance invalid (the student lesson page would fail)`);
  else if (student) {
    const parsed = student.publishedLessonSchema.safeParse(v1);
    if (!parsed.success) issues.push(`live ${lesson.id} ${lesson.title}: rejected by the student portal's learning-v1 schema (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message})`);
  }
  for (const lang of langs) {
    const parsed = v2.libraryV2DetailSchema.safeParse({ contractVersion: 'library-v2', subjectStudentId: 'STU-M-000', lang, lesson: v2.libraryV2Lesson(lesson, snapshot ?? null, snapshot?.category_id ? categoryById.get(snapshot.category_id)?.slug ?? null : null, lang) });
    if (!parsed.success) issues.push(`live ${lesson.id} ${lesson.title} (${lang}): library-v2 lesson invalid`);
  }
}

// The live student feed: the exact queries GET /api/portal/library and /api/portal/library/{id}
// run, for every belt and language, paging the way the route does.
const { studentLessonEligible } = loadTs('lib/student-catalog-contract.ts');
const belts = await must(db.from('belts').select('belt_name,belt_order').order('belt_order').limit(100));
const feedCategories = await must(db.from('library_categories').select('slug,title,korean_title,subtitle,description,icon,accent_color,library_type,translations').eq('is_active', true).order('sort_order').order('title').limit(500));
report.feed = { pages: 0, cardsByBelt: {}, lessonsOpened: 0 };
for (const lang of langs) for (const belt of belts.map(row => row.belt_name)) {
  let after = null, cards = 0;
  for (let guard = 0; guard < 100; guard++) {
    const rows = await must(db.rpc('portal_student_library_page', { p_lang: lang, p_category: null, p_kind: null, p_pattern: null, p_after: after, p_limit: 26 }));
    const scanned = rows.slice(0, 25);
    const lessons = scanned.filter(row => studentLessonEligible(String(row.targetBelt ?? ''), belt, belts)).map(v2.libraryV2Summary);
    const data = { subjectStudentId: 'STU-M-000', lang, categories: feedCategories.map(row => v2.libraryV2Category(row, lang)), lessons, nextCursor: rows.length > 25 ? 'cursor' : null };
    const parsed = v2.libraryV2PageSchema.safeParse({ ...data, contractVersion: 'library-v2' });
    if (!parsed.success) issues.push(`feed page (${lang}, ${belt}): invalid (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message})`);
    if (Buffer.byteLength(envelope(data)) > LIMIT) issues.push(`feed page (${lang}, ${belt}) is over 1 MB`);
    report.feed.pages++; cards += lessons.length;
    if (rows.length <= 25) break;
    after = scanned.at(-1).id;
  }
  if (lang === 'en') report.feed.cardsByBelt[belt] = cards;
}
for (const lesson of curriculum.filter(row => row.is_active)) {
  const [row, snapshot] = await Promise.all([
    must(db.from('curriculum').select('id,target_belt,title,description,video_url,thumbnail_url,content_type,learning_content,sort_order,duration_seconds,is_active').eq('id', lesson.id).maybeSingle()),
    must(db.from('library_published_content').select('content_kind,category_id,document').eq('curriculum_id', lesson.id).maybeSingle()),
  ]);
  const category = snapshot?.category_id ? await must(db.from('library_categories').select('slug,is_active').eq('id', snapshot.category_id).maybeSingle()) : null;
  for (const lang of langs) {
    const data = { subjectStudentId: 'STU-M-000', lang, lesson: v2.libraryV2Lesson(row, snapshot, category?.slug ?? null, lang) };
    const parsed = v2.libraryV2DetailSchema.safeParse({ ...data, contractVersion: 'library-v2' });
    if (!parsed.success) issues.push(`feed lesson ${lesson.id} (${lang}): invalid (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message})`);
    if (Buffer.byteLength(envelope(data)) > LIMIT) issues.push(`feed lesson ${lesson.id} (${lang}) is over 1 MB`);
  }
  report.feed.lessonsOpened++;
}

if (samplesDir) {
  fs.mkdirSync(samplesDir, { recursive: true });
  const page = { success: true, data: { subjectStudentId: 'STU-M-000', lang: 'en', categories: categories.filter(row => row.is_active).map(row => v2.libraryV2Category(row, 'en')), lessons: (samples.page ?? []).slice(0, 10), nextCursor: 'opaque-cursor', contractVersion: 'library-v2' }, error: null };
  fs.writeFileSync(path.join(samplesDir, 'page-poomsae-en.json'), JSON.stringify(page, null, 2) + '\n');
  for (const [name, value] of Object.entries(samples)) if (name !== 'page') fs.writeFileSync(path.join(samplesDir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
  console.log('Samples written to', samplesDir);
}
console.log(JSON.stringify({ ...report, studentPortalSchemaChecked: !!student, issues: issues.length }, null, 1));
for (const issue of issues.slice(0, 40)) console.log(' -', issue);
process.exit(issues.length ? 1 : 0);
