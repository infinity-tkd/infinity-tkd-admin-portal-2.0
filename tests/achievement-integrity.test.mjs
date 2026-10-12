import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { loadTs } from './load-ts.mjs';
const actor='71000000-0000-4000-8000-000000000001';
const key='71000000-0000-4000-8000-000000000002';
const entry={eventName:'Test championship',date:'2026-01-01',category:'Recognized Poomsae',division:'Individual',medalRank:'Gold'};

test('achievement batches roll back removals and earlier writes, replay once, and enforce ownership and privileges',async()=>{
 const db=new PGlite();
 try {
  await db.exec(fs.readFileSync('tests/fixtures/installed-schema.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/production-upgrade-20261009.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261012065927_portal_achievement_integrity.sql','utf8'));
  await db.exec(`SELECT set_config('request.jwt.role','service_role',false);
   INSERT INTO branches(id,branch_name) VALUES(1,'Fixture'); INSERT INTO scholarships(id,type_name) VALUES(1,'Standard');
   INSERT INTO profiles(id,username,email,display_name,role,is_active) VALUES('${actor}','fixture','fixture@example.test','Fixture','Admin',true);
   INSERT INTO students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,current_belt,student_status,home_branch_id)
    VALUES('A','','A','Male','2010-01-01','2025-01-01',1,'White','Active',1),('B','','B','Female','2010-01-01','2025-01-01',1,'White','Active',1);
   INSERT INTO achievements(id,student_id,event_name,date,category,division,medal_rank) VALUES(10,'A','Original','2025-01-01','Test','Test','Silver'),(11,'B','Other student','2025-01-01','Test','Test','Bronze');`);
  const save=(entries,deletes=[],requestKey=key,student='A')=>db.query('SELECT portal_save_achievements($1,$2,$3,$4,$5) AS result',[actor,student,JSON.stringify(entries),JSON.stringify(deletes),requestKey]);
  await assert.rejects(save([entry,{...entry,date:'2026-02-30'}],[10]));
  assert.equal((await db.query('SELECT count(*)::int n FROM achievements')).rows[0].n,2,'all earlier writes/removals roll back');
  assert.equal((await db.query('SELECT count(*)::int n FROM audit_logs WHERE id=$1',[key])).rows[0].n,0);
  await assert.rejects(save([{...entry,id:11}]),/not found for this student/);
  await assert.rejects(save([entry],[11]),/not found for this student/);
  await assert.rejects(save([{...entry,id:10},{...entry,id:10}]),/Duplicate/);
  await assert.rejects(save([{...entry,id:10}],[10]),/Duplicate/);
  const first=(await save([entry],[10])).rows[0].result;
  const retry=(await save([entry],[10])).rows[0].result;
  assert.deepEqual(retry,first,'same request returns the confirmed result');
  assert.equal((await db.query("SELECT count(*)::int n FROM achievements WHERE student_id='A'")).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM achievements WHERE student_id='B'")).rows[0].n,1);
  await assert.rejects(save([{...entry,eventName:'Different'}],[10]),/Idempotency/);
  await db.exec(`INSERT INTO user_permissions(user_id,permission_key,is_granted) VALUES('${actor}','action:student_edit',false)`);
  await assert.rejects(save([entry],[],'71000000-0000-4000-8000-000000000003'),/Permission denied/);
  const privileges=(await db.query("SELECT has_function_privilege('authenticated','portal_save_achievements(uuid,text,jsonb,jsonb,uuid)','EXECUTE') AS client,has_table_privilege('authenticated','achievements','DELETE') AS direct_write")).rows[0];
  assert.deepEqual(privileges,{client:false,direct_write:false});
 } finally {await db.close();}
});

test('achievement API validates the whole batch before any write and never accepts a spoofed actor',async()=>{
 const calls=[];
 const route=loadTs('app/api/admin/achievements/route.ts',{
  '@/lib/achievements':loadTs('lib/achievements.ts'),
  '@/lib/backend-security':{
   verifyCaller:async()=>({context:{userId:actor},adminSupabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:{records:args.p_entries,deletedIds:args.p_deleted_ids},error:null};}}}),
   validateRequestBody:async(schema,req)=>{const parsed=schema.safeParse(await req.json());return parsed.success?{data:parsed.data}:{errorResponse:Response.json({success:false},{status:422})};},
   formatServerErrorResponse:()=>Response.json({success:false},{status:503}),
  },
 });
 const send=payload=>route.POST(new Request('https://portal.example/api/admin/achievements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 const payload={studentId:'A',entries:[entry],requestKey:key};
 for(const invalid of [{...payload,p_actor:actor},{...payload,entries:[{...entry,date:'2026-02-30'}]},{...payload,entries:[{...entry,date:'2200-01-01'}]},{...payload,entries:[{...entry,id:10}],deletedIds:[10]},{...payload,entries:[]}]) assert.equal((await send(invalid)).status,422);
 assert.equal(calls.length,0);
 assert.equal((await send(payload)).status,200);
 assert.equal(calls[0].args.p_actor,actor);
 assert.equal(calls[0].name,'portal_save_achievements');
});
