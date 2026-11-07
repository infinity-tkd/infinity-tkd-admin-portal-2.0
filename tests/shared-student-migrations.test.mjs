import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';

test('canonical student schema imports create no publications and preserve staff/student boundaries',async()=>{
 const db=await operationsDatabase();
 try{
  const manifest=JSON.parse(fs.readFileSync('supabase/student-migration-imports.json','utf8'));
  assert.equal(manifest.entries.length,6);
  for(const entry of manifest.entries){const sql=fs.readFileSync('supabase/migrations/'+entry.file,'utf8');assert.equal(crypto.createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex'),entry.importSha256);await db.exec(sql);}
  for(const name of ['student_portal_progress','student_portal_events','student_portal_preferences','student_portal_ranking_publications','student_portal_readiness_policies','student_portal_coach_confirmations'])assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.${name}`)).rows[0].count,0,`${name} contains no invented records`);
  const student='96000000-0000-4000-8000-000000000001';
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[student,'student@example.test']);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id) VALUES($1,'student','student@example.test','Fixture student','Student','STU-M-001')",[student]);
  await db.query("UPDATE students SET profile_id=$1 WHERE id='STU-M-001'",[student]);
  await db.query("SELECT set_config('request.jwt.sub',$1,false)",[student]);
  await db.exec("SELECT set_config('request.jwt.role','authenticated',false); SET ROLE authenticated");
  assert.equal((await db.query('SELECT id FROM students')).rows.length,0,'student browser cannot read even own official rows directly');
  await assert.rejects(db.query('SELECT * FROM student_portal_readiness_policies'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM student_portal_ranking_publications'),/permission denied/);
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.sub',$1,false)",[root]);
  await db.exec('SET ROLE authenticated');
  assert.ok((await db.query('SELECT id FROM students')).rows.length>0,'staff row policies still operate');
 }finally{await db.close();}
});

test('shared imports and all admin handoff migrations install in release order behind service-only boundaries',async()=>{
 const db=await operationsDatabase();
 try{
  await db.exec(fs.readFileSync('supabase/migrations/20261012065927_portal_achievement_integrity.sql','utf8'));
  const manifest=JSON.parse(fs.readFileSync('supabase/student-migration-imports.json','utf8'));
  const files=[...manifest.entries.map(entry=>entry.file),
   '20261101030518_student_portal_admin_preparation.sql',
   '20261101030526_academy_calendar_and_student_notices.sql',
   '20261101033142_library_student_projection.sql',
   '20261101033150_student_training_assignment_workflow.sql',
   '20261101033250_academy_event_achievement_links.sql',
   '20261101042452_calendar_archive_and_inbox_reliability.sql',
   '20261101042503_calendar_delivery_candidates_and_relations.sql',
  ];
  assert.deepEqual(files,[...files].sort(),'registered shared dependencies precede their admin consumers');
  for(const file of files)await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  for(const name of ['academy_events','academy_event_revisions','student_training_plans','student_portal_ranking_publications','student_portal_coach_confirmations'])assert.equal((await db.query(`SELECT count(*)::int n FROM public.${name}`)).rows[0].n,0,`${name} contains no business records seeded by installation`);
  for(const name of ['academy_events','academy_event_revisions','portal_training_plan_requests']){
   const privileges=(await db.query('SELECT has_table_privilege(\'authenticated\',$1,\'SELECT\') client_read,has_table_privilege(\'authenticated\',$1,\'INSERT\') client_write,has_table_privilege(\'anon\',$1,\'SELECT\') anonymous_read',[name])).rows[0];
   assert.deepEqual(privileges,{client_read:false,client_write:false,anonymous_read:false},name);
  }
  const leaked=(await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND (p.proname LIKE 'portal_calendar_%' OR p.proname IN ('portal_push_eligible','portal_push_candidates','portal_claim_push','portal_assign_training_plan','portal_achievement_event_snapshot','portal_save_achievements','portal_save_library_asset'))
   AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))`)).rows;
  assert.deepEqual(leaked,[],'student and anonymous browsers cannot invoke privileged producers or calendar projections');
 }finally{await db.close();}
});
