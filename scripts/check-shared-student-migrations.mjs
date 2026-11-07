import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
if (args.some((arg, index) => index % 2 === 0 && !['--source', '--live-metadata'].includes(arg)) || args.length % 2) throw new Error('Usage: node scripts/check-shared-student-migrations.mjs [--source directory] [--live-metadata json-file]');
const manifest = JSON.parse(fs.readFileSync('supabase/student-migration-imports.json', 'utf8'));
const hash = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const source = option('--source'), metadataFile = option('--live-metadata');
const metadata = metadataFile ? JSON.parse(fs.readFileSync(metadataFile, 'utf8')) : null;
const versions = new Set();
for (const entry of manifest.entries) {
  if (!/^\d{14}$/.test(entry.version) || !/^student_portal_[a-z_]+$/.test(entry.name) || entry.file !== `${entry.version}_${entry.name}.sql` || versions.has(entry.version)) throw new Error('Invalid or duplicate imported migration identity.');
  versions.add(entry.version);
  const file = path.join('supabase/migrations', entry.file);
  if (hash(fs.readFileSync(file, 'utf8')) !== entry.importSha256) throw new Error(`Reviewed SQL changed: ${entry.file}`);
  if (source) {
    const legacy = path.join(source, entry.sourceFilename), canonical = path.join(source, entry.file);
    const selected = fs.existsSync(legacy) ? legacy : canonical;
    const expected = selected === legacy ? [entry.sourceSha256] : [entry.sourceSha256, entry.importSha256];
    if (!expected.includes(hash(fs.readFileSync(selected, 'utf8')))) throw new Error(`Student source changed and needs review: ${entry.name}`);
  }
  if (metadata) {
    const found = metadata.find(row => row.version === entry.version && row.name === entry.name);
    if (!found || found.statements_md5 !== entry.registeredStatementsMd5) throw new Error(`Registered metadata does not match reviewed history: ${entry.version}`);
  }
}
console.log(JSON.stringify({ checked: versions.size, versions: [...versions], sourceChecked: Boolean(source), suppliedLiveMetadataChecked: Boolean(metadata), databaseQueries: 0, databaseWrites: 0 }));
