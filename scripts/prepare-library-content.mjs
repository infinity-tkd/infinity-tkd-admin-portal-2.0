#!/usr/bin/env node
/**
 * Prepares library lessons made before library-v2 so every lesson works in the
 * new editor and the student library-v2 feed:
 *   - files lessons with no category into one (from their legacy category),
 *   - turns learning-v1 guidance into editable sections when a lesson has none,
 *   - fills Korean and romanized names, summary and web name where missing.
 * Existing values are never replaced. Optional: --publish-live republishes
 * lessons that students can already see, so their full content (text, steps,
 * mistakes, sections and translations) reaches them in learning-v1 and library-v2.
 *
 * Dry run (default) prints what would change:   node scripts/prepare-library-content.mjs
 * Apply (service role from .env.local):         node scripts/prepare-library-content.mjs --apply --actor <staff profile uuid> [--publish-live]
 */
import fs from 'node:fs';
import { loadTs } from '../tests/load-ts.mjs';

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => { const index = argv.indexOf(`--${name}`); return index >= 0 ? argv[index + 1] : undefined; };
const apply = flag('apply'), publishLive = flag('publish-live'), actor = option('actor');
if (apply && !/^[0-9a-f-]{36}$/i.test(actor ?? '')) { console.error('--apply needs --actor <staff profile uuid> (recorded in the audit log).'); process.exit(1); }

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { preparationFor } = loadTs('lib/library-prepare.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const { libraryContentSchema, libraryMetadataSchema, UNASSIGNED_BELT } = loadTs('lib/library-content.ts');

const must = async query => { const { data, error } = await query; if (error) throw new Error(error.message); return data; };
const [assets, contents, categories, curriculum] = await Promise.all([
  must(db.from('library_assets').select('*').order('id').limit(5000)),
  must(db.from('library_asset_content').select('asset_id,sections,translations,sources').limit(5000)),
  must(db.from('library_categories').select('id,slug').limit(500)),
  must(db.from('curriculum').select('id,title,is_active').limit(5000)),
]);
const contentById = new Map(contents.map(row => [row.asset_id, row]));
const categoryIdBySlug = new Map(categories.map(row => [row.slug, row.id]));
const curriculumById = new Map(curriculum.map(row => [row.id, row]));
const usedSlugs = new Set(assets.map(row => row.slug).filter(Boolean));
const liveLesson = asset => { const linked = curriculumById.get(asset.student_curriculum_id ?? asset.id); return !!linked?.is_active && (asset.student_curriculum_id != null || linked.title === asset.title); };

const plan = [];
for (const asset of assets) {
  const prep = preparationFor(asset, contentById.has(asset.id), categoryIdBySlug, usedSlugs);
  const edit = prep.changes.content || !!prep.changes.category || prep.changes.names;
  const publish = publishLive && liveLesson(asset) && asset.target_level !== UNASSIGNED_BELT;
  if (!edit && !publish) continue;
  const existing = contentById.get(asset.id);
  const content = prep.content ?? libraryContentSchema.parse({ sections: existing.sections, translations: existing.translations, sources: existing.sources });
  const metadata = libraryMetadataSchema.parse(prep.metadata);
  // Same checks the admin portal runs before saving and publishing.
  const projection = libraryPublicationProjection(asset);
  plan.push({ asset, edit, publish, metadata, content, projection, changes: prep.changes });
}

const count = predicate => plan.filter(predicate).length;
const byCategory = {};
for (const row of plan) if (row.changes.category) byCategory[row.changes.category] = (byCategory[row.changes.category] ?? 0) + 1;
console.log(JSON.stringify({
  lessons: assets.length, toEdit: count(row => row.edit), categoriesAssigned: byCategory, sectionsCreated: count(row => row.changes.content), namesFilled: count(row => row.changes.names),
  stillUncategorized: assets.filter(asset => !asset.category_id && !plan.find(row => row.asset.id === asset.id)?.metadata.categoryId).map(asset => asset.title),
  toPublish: publishLive ? count(row => row.publish) : 'add --publish-live to include lessons students can already see',
}, null, 1));
if (flag('list')) for (const row of plan.filter(item => item.edit)) {
  const filled = ['koreanName', 'romanized', 'summary', 'slug'].filter(key => row.metadata[key] && !row.asset[{ koreanName: 'korean_name', romanized: 'romanized', summary: 'summary', slug: 'slug' }[key]]);
  console.log(` ${row.asset.id} ${row.asset.title} → ${[row.changes.category && 'category ' + row.changes.category, row.changes.content && 'sections', filled.length && 'fills ' + filled.join('/')].filter(Boolean).join(', ')}`);
}
if (!apply) { console.log('Dry run only. Add --apply --actor <staff profile id> to write these changes.'); process.exit(0); }

let edited = 0, published = 0;
for (const row of plan) {
  let revision = row.asset.revision;
  if (row.edit) {
    const result = await must(db.rpc('portal_save_library_content', { p_actor: actor, p_id: row.asset.id, p_payload: { expectedRevision: revision, metadata: row.metadata, content: row.content } }));
    revision = result.asset.revision; edited++;
  }
  if (row.publish) {
    await must(db.rpc('portal_save_library_asset', { p_actor: actor, p_action: 'PUBLISH', p_id: row.asset.id, p_request_key: null,
      p_payload: { expectedRevision: revision, reason: 'Publish the full lesson content prepared for library-v2', studentProjection: row.projection } }));
    published++;
  }
  if ((edited + published) % 20 === 0) console.log(`… ${edited} prepared, ${published} published`);
}
console.log(JSON.stringify({ prepared: edited, published }, null, 1));
