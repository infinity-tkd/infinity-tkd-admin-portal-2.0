#!/usr/bin/env node
/**
 * Imports the public website's library (Infinity TKD Web/data/library) into the
 * library-v2 tables: 9 categories, the website lessons and its reference articles,
 * with Khmer and Chinese translations. No belts are linked; staff choose them.
 *
 * Dry run (default): converts and validates everything and prints a report.
 *   node scripts/import-website-library.mjs [--source <dir>] [--out preview.json]
 * Apply: writes through public.portal_import_library_content with the service role
 * from .env.local, recorded in the audit log as the given staff profile.
 *   node scripts/import-website-library.mjs --apply --actor <staff profile uuid> [--overwrite]
 *
 * Re-running is safe: imported items are skipped unless --overwrite is given, which
 * replaces their sections and translations but keeps staff edits to names and details.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from '../tests/load-ts.mjs';

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => { const index = argv.indexOf(`--${name}`); return index >= 0 ? argv[index + 1] : undefined; };
const source = path.resolve(option('source') ?? path.join('..', 'Infinity TKD Web', 'data', 'library'));
const FILES = [
  'index.ts', 'categories.ts', 'poomsae/poomsaeTranslations.ts', 'poomsae/poomsaeWalkthroughs.ts', 'kicking/kickingTranslations.ts', 'kicking/kickingTranslationsDetailed.ts',
  'kicking/kickingAdvancedTranslations.ts', 'hosinsul/hosinsulTranslations.ts', 'hosinsul/hosinsulCurriculum.ts', 'history/historyTranslations.ts', 'history/historyTimelineTranslations.ts',
  'history/historyKwansTranslations.ts', 'history/historyOrganizationsTranslations.ts', 'history/historyPhilosophyTranslations.ts', 'rules/competitionRulesData.ts',
  'rules/competitionRulesTranslations.ts', 'rules/competitionRulesDetailedTranslations.ts', 'rules/freestyleScoringTranslations.ts', 'rules/ruleDocuments.ts',
];
if (!fs.existsSync(path.join(source, 'index.ts'))) { console.error(`Website library not found at ${source}. Pass --source <dir>.`); process.exit(1); }
const web = Object.assign({}, ...FILES.map(file => loadTs(path.join(source, file))));
const { websiteImport } = loadTs('lib/library-website-import.ts');
const { categories, items, report } = websiteImport(web);
console.log(JSON.stringify({ source, ...report }, null, 1));
if (option('out')) { fs.writeFileSync(option('out'), JSON.stringify({ categories, items }, null, 1)); console.log('Preview written to', option('out')); }
if (!flag('apply')) { console.log('Dry run only. Add --apply --actor <staff profile id> to import.'); process.exit(0); }

const actor = option('actor');
if (!/^[0-9a-f-]{36}$/i.test(actor ?? '')) { console.error('--apply needs --actor <staff profile uuid> (recorded in the audit log).'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Batches stay well under the API body limit; categories go with the first batch.
const batches = [];
let current = [], size = 0;
for (const item of items) {
  const bytes = JSON.stringify(item).length;
  if (current.length && (current.length >= 8 || size + bytes > 700_000)) { batches.push(current); current = []; size = 0; }
  current.push(item); size += bytes;
}
if (current.length) batches.push(current);
const totals = { categoriesAdded: 0, created: [], merged: [], updated: [], skipped: [] };
for (const [index, batch] of batches.entries()) {
  const { data, error } = await supabase.rpc('portal_import_library_content', { p_actor: actor, p_payload: { source: 'website', overwrite: flag('overwrite'), categories: index === 0 ? categories : [], items: batch } });
  if (error) { console.error(`Batch ${index + 1} of ${batches.length} failed: ${error.message}`); console.error('Earlier batches were saved; re-run to continue (imported items are skipped).'); process.exit(1); }
  totals.categoriesAdded += data.categoriesAdded;
  for (const key of ['created', 'merged', 'updated', 'skipped']) totals[key].push(...data[key]);
  console.log(`Batch ${index + 1}/${batches.length}: ${data.created.length} created, ${data.merged.length} merged, ${data.updated.length} updated, ${data.skipped.length} skipped`);
}
console.log(JSON.stringify({ categoriesAdded: totals.categoriesAdded, created: totals.created.length, merged: totals.merged.length, updated: totals.updated.length, skipped: totals.skipped.length }, null, 1));
