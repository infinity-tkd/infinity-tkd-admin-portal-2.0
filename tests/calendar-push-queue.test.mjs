import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';

async function setup(){
 const db=await operationsDatabase();
 await db.exec(fs.readFileSync('supabase/migrations/20261012065927_portal_achievement_integrity.sql','utf8'));
 for(const entry of JSON.parse(fs.readFileSync('supabase/student-migration-imports.json','utf8')).entries)await db.exec(fs.readFileSync('supabase/migrations/'+entry.file,'utf8'));
 for(const file of ['20261101030518_student_portal_admin_preparation.sql','20261101030526_academy_calendar_and_student_notices.sql','20261101033142_library_student_projection.sql','20261101033150_student_training_assignment_workflow.sql','20261101033250_academy_event_achievement_links.sql','20261101042452_calendar_archive_and_inbox_reliability.sql','20261101042503_calendar_delivery_candidates_and_relations.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec("INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true; SET ROLE service_role");
 return db;
}
async function subscription(db,user,scope){return(await db.query("INSERT INTO portal_push_subscriptions(user_id,endpoint,keys,app_scope) VALUES($1,$2,'{}',$3) RETURNING id",[user,'https://fcm.googleapis.com/fcm/send/'+randomUUID(),scope])).rows[0].id;}
async function candidates(db,user,sub){return(await db.query('SELECT * FROM portal_push_candidates($1,$2)',[user,sub])).rows;}
async function claim(db,notice,sub){return(await db.query('SELECT portal_claim_push($1,$2) claimed',[notice,sub])).rows[0].claimed;}

test('push queue reaches older unsent work behind read and completed notices, honors backoff and browser denial',async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO portal_notification_preferences(user_id,push_enabled,quiet_start,quiet_end) VALUES($1,true,0,0)',[root]);
  const sub=await subscription(db,root,'admin');
  await db.query("INSERT INTO portal_notifications(user_id,source_key,category,title,body,href,permission_key,created_at) SELECT $1,'fixture:'||i,'billing','Fixture notice','Fixture only','/financials','page:financials',now()-i*interval '1 minute' FROM generate_series(1,75) i",[root]);
  await db.exec('UPDATE portal_notifications SET read_at=now() WHERE id IN(SELECT id FROM portal_notifications ORDER BY created_at DESC LIMIT 51)');
  await db.query('INSERT INTO portal_push_deliveries(notification_id,subscription_id,sent_at) SELECT id,$1,now() FROM portal_notifications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 20',[sub]);
  const pending=await candidates(db,root,sub);assert.equal(pending.length,4,'completed newest work does not starve the oldest four notices');
  assert.equal(await claim(db,pending[0].id,sub),true);assert.equal(await claim(db,pending[0].id,sub),false,'active lease cannot be claimed twice');
  await db.query("UPDATE portal_push_deliveries SET lease_until=NULL,next_attempt_at=now()+interval '1 hour' WHERE notification_id=$1 AND subscription_id=$2",[pending[0].id,sub]);
  assert.equal((await candidates(db,root,sub)).length,3,'deferred work cannot displace currently eligible notices');
  await db.query("UPDATE portal_notification_preferences SET muted_categories=ARRAY['billing'] WHERE user_id=$1",[root]);
  assert.equal((await candidates(db,root,sub)).length,0);assert.equal(await claim(db,pending[1].id,sub),false,'dispatch rechecks preference changes after selection');
  await db.exec('RESET ROLE; SET ROLE authenticated');await assert.rejects(candidates(db,root,sub),/permission denied/);
 }finally{await db.close();}
});

test('student dispatch rechecks current publication access, academy settings, source scope and precise quiet hours',async()=>{
 const db=await setup();try{
  await db.exec('RESET ROLE');
  const user=randomUUID();await db.query('INSERT INTO auth.users(id,email)VALUES($1,$2)',[user,'fixture-student@example.test']);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id)VALUES($1,'push_student','fixture-student@example.test','Fixture student','Student','STU-M-001')",[user]);
  await db.query("UPDATE students SET profile_id=$1 WHERE id='STU-M-001'",[user]);
  await db.exec('SET ROLE service_role');
  // Selection below tests publication/scope access. Start with quiet hours
  // explicitly disabled so the real clock cannot mask an eligible notice.
  // A precise active quiet window is tested separately just below.
  await db.query('INSERT INTO portal_notification_preferences(user_id,push_enabled,student_quiet_start,student_quiet_end)VALUES($1,true,NULL,NULL)',[user]);
  const sub=await subscription(db,user,'student'),wrongScope=await subscription(db,user,'admin');
  const draft={title:'Fixture class notice',type:'class_change',lifecycle:'scheduled',startDate:'2026-11-10',endDate:'2026-11-10',startsAt:null,endsAt:null,timezone:'Asia/Phnom_Penh',location:'Fixture dojo',description:'Fixture public description',internalNotes:'PRIVATE',audience:{mode:'all',branchIds:[],classIds:[],studentIds:[]},attachments:[],changeReason:''};
  const mutate=async(action,id,payload)=>(await db.query('SELECT portal_calendar_mutate($1,$2,$3,$4,$5) result',[root,action,id,payload,randomUUID()])).rows[0].result;
  const created=await mutate('create',null,{event:draft});const published=await mutate('publish',created.event.id,{expectedRevision:1,notifyStudents:true});
  const pending=await candidates(db,user,sub);assert.equal(pending.length,1);assert.equal((await candidates(db,user,wrongScope)).length,0);
  await db.query("UPDATE portal_notification_preferences SET student_quiet_start=to_char((now()-interval '1 minute') AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI'),student_quiet_end=to_char((now()+interval '1 hour') AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI') WHERE user_id=$1",[user]);
  assert.equal((await candidates(db,user,sub)).length,0);assert.equal(await claim(db,pending[0].id,sub),false);
  await db.query('UPDATE portal_notification_preferences SET student_quiet_start=NULL,student_quiet_end=NULL WHERE user_id=$1',[user]);
  const saved=await mutate('save',created.event.id,{expectedRevision:published.event.revision,event:{...draft,audience:{mode:'staff',branchIds:[],classIds:[],studentIds:[]},changeReason:'Fixture audience withdrawal'}});
  assert.equal((await candidates(db,user,sub)).length,1,'unpublished audience draft does not change approved access');
  await mutate('publish',created.event.id,{expectedRevision:saved.event.revision,notifyStudents:false});
  assert.equal(await claim(db,pending[0].id,sub),false,'audience loss between selection and dispatch blocks delivery');
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_push_deliveries')).rows[0].n,0);
  await db.exec("UPDATE academy_profile SET allow_student_portal_login=false WHERE id='default'");assert.equal((await candidates(db,user,sub)).length,0);
 }finally{await db.close();}
});
