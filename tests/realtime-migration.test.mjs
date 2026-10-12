import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadTs} from './load-ts.mjs';
const {PORTAL_REALTIME_TABLES} = loadTs('lib/read-recovery.ts');
const tables = [...PORTAL_REALTIME_TABLES, 'products', 'product_variants', 'product_categories', 'pos_orders'];
const sql = fs.readFileSync('supabase/migrations/20261011215930_portal_realtime_sync.sql', 'utf8');

test('realtime migration preserves existing entries, is repeatable, and fails closed without RLS', async () => {
 const db = new PGlite();
 try {
  await db.exec('CREATE PUBLICATION supabase_realtime;');
  for (const table of tables) await db.exec(`CREATE TABLE public.${table}(id integer PRIMARY KEY); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
  await db.exec('ALTER PUBLICATION supabase_realtime ADD TABLE public.partners;');
  await db.exec(sql);
  await db.exec(sql);
  const result = await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename");
  assert.deepEqual(result.rows.map(row=>row.tablename), [...tables].sort());
  await db.exec('ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;');
  await assert.rejects(db.exec(sql), /must exist with RLS enabled/);
  await db.exec('ROLLBACK;');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_publication_tables WHERE pubname='supabase_realtime'")).rows[0].n, tables.length);
 } finally {await db.close();}
});
