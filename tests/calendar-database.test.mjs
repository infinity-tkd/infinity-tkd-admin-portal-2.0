import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
const migration='supabase/migrations/20261101030526_academy_calendar_and_student_notices.sql';
const studentUser='92000000-0000-4000-8000-000000000001';
const draft={title:'Fixture competition',type:'competition',lifecycle:'scheduled',startDate:'2026-11-10',endDate:'2026-11-12',startsAt:null,endsAt:null,timezone:'Asia/Phnom_Penh',location:'Fixture dojo',description:'Public competition details',internalNotes:'Private planning note',audience:{mode:'all',branchIds:[],classIds:[],studentIds:[]},attachments:[],changeReason:''};
async function setup(){const db=await operationsDatabase();await db.exec(fs.readFileSync(migration,'utf8'));await db.exec("INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true");await db.exec(`INSERT INTO auth.users(id,email)VALUES('${studentUser}','student@example.test');INSERT INTO profiles(id,username,email,display_name,role,student_id)VALUES('${studentUser}','student','student@example.test','Student','Student','STU-M-001');UPDATE students SET profile_id='${studentUser}' WHERE id='STU-M-001';`);return db;}
async function mutate(db,action,id,data,key=randomUUID(),actor=root){return (await db.query('SELECT portal_calendar_mutate($1,$2,$3,$4,$5) result',[actor,action,id,data,key])).rows[0].result;}
async function studentEvents(db,id=null){return(await db.query("SELECT * FROM portal_calendar_student_events('STU-M-001','2026-11-01','2026-12-01',NULL,$1,51)",[id])).rows;}

test('calendar publishes immutable public snapshots; draft edits do not leak; publication and notices replay safely',async()=>{
 const db=await setup();try{
  const key=randomUUID(),created=await mutate(db,'create',null,{event:draft},key);const id=created.event.id;
  assert.deepEqual(await mutate(db,'create',null,{event:draft},key),created);assert.equal((await studentEvents(db)).length,0);
  const published=await mutate(db,'publish',id,{expectedRevision:1,notifyStudents:false});
  assert.equal((await studentEvents(db))[0].payload.internalNotes,undefined);assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications')).rows[0].n,0);
  const changed={...draft,title:'Updated competition',startDate:'2026-11-17',endDate:'2026-11-19',changeReason:'Venue changed the schedule'};
  const saved=await mutate(db,'save',id,{expectedRevision:published.event.revision,event:changed});assert.equal((await studentEvents(db))[0].payload.title,draft.title);
  await assert.rejects(mutate(db,'publish',id,{expectedRevision:published.event.revision,notifyStudents:false}),/changed/i);
  const next=await mutate(db,'publish',id,{expectedRevision:saved.event.revision,notifyStudents:true});assert.equal(next.queued,1);
  const row=(await studentEvents(db))[0];assert.equal(row.payload.title,changed.title);assert.equal(row.previous_occurrence.startDate,draft.startDate);
  assert.equal((await mutate(db,'notice',id,{expectedRevision:next.event.revision})).queued,0,'different send key still does not duplicate a revision');
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications')).rows[0].n,1);
  const inbox=(await db.query("SELECT portal_calendar_inbox($1,'STU-M-001') result",[studentUser])).rows[0].result;assert.equal(inbox.unreadCount,1);assert.equal(inbox.rows[0].body,changed.changeReason);
  await db.query("SELECT portal_calendar_inbox($1,'STU-M-001','read',$2)",[studentUser,inbox.rows[0].id]);assert.equal((await db.query("SELECT portal_calendar_inbox($1,'STU-M-001') result",[studentUser])).rows[0].result.unreadCount,0);
 }finally{await db.close();}
});

test('calendar honors owner/role denial, audience changes, contradictory ownership and server-only Data API boundary',async()=>{
 const db=await setup();try{
  const id=(await mutate(db,'create',null,{event:draft})).event.id;
  await assert.rejects(mutate(db,'save',id,{expectedRevision:1,event:draft},randomUUID(),coach),/Permission denied/);
  await mutate(db,'publish',id,{expectedRevision:1,notifyStudents:true});
  const current=(await db.query('SELECT revision FROM academy_events WHERE id=$1',[id])).rows[0].revision;
  const privateDraft={...draft,audience:{mode:'staff',branchIds:[],classIds:[],studentIds:[]},changeReason:'This event is now staff planning only'};
  const saved=await mutate(db,'save',id,{expectedRevision:current,event:privateDraft});await mutate(db,'publish',id,{expectedRevision:saved.event.revision,notifyStudents:false});
  assert.equal((await studentEvents(db,id)).length,0);assert.equal((await db.query("SELECT portal_calendar_inbox($1,'STU-M-001') result",[studentUser])).rows[0].result.rows.length,0,'old notice is hidden after access loss');
  const publicId=(await mutate(db,'create',null,{event:draft})).event.id;await db.exec("ALTER TABLE profiles DISABLE TRIGGER USER");await db.query("UPDATE profiles SET student_id='STU-M-002' WHERE id=$1",[studentUser]);await db.exec("ALTER TABLE profiles ENABLE TRIGGER USER");await mutate(db,'publish',publicId,{expectedRevision:1,notifyStudents:true});
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications WHERE source_id=$1',[publicId])).rows[0].n,0,'contradictory identity is excluded from broadcast');
  await db.exec('SET ROLE authenticated');await assert.rejects(db.exec('SELECT * FROM academy_events'),/permission denied/i);await assert.rejects(db.query('SELECT portal_calendar_mutate($1,\'create\',NULL,$2,$3)',[root,{event:draft},randomUUID()]),/permission denied/i);
 }finally{await db.close();}
});

test('event type does not change classes or tuition; minute-precision preferences preserve other categories',async()=>{
 const db=await setup();try{
  const before=(await db.query('SELECT count(*)::int n FROM class_occurrences')).rows[0].n;
  const id=(await mutate(db,'create',null,{event:{...draft,type:'holiday'}})).event.id;await mutate(db,'publish',id,{expectedRevision:1,notifyStudents:false});
  assert.equal((await db.query('SELECT count(*)::int n FROM class_occurrences')).rows[0].n,before);assert.equal((await db.query('SELECT count(*)::int n FROM membership_invoices')).rows[0].n,0);
  await db.query("INSERT INTO portal_notification_preferences(user_id,muted_categories) VALUES($1,ARRAY['orders'])",[studentUser]);
  await db.query('SELECT portal_calendar_preferences($1,$2)',[studentUser,{pushEnabled:false,mutedCategories:['events'],quietStart:'21:30',quietEnd:'06:15'}]);
  const prefs=(await db.query('SELECT * FROM portal_notification_preferences WHERE user_id=$1',[studentUser])).rows[0];assert.deepEqual(prefs.muted_categories,['orders','events']);assert.equal(prefs.student_quiet_start,'21:30');
 }finally{await db.close();}
});

test('competition links retain snapshots, support manual fallback and replay without rewriting later corrections',async()=>{
 const db=await setup();try{
  await db.exec(fs.readFileSync('supabase/migrations/20261012065927_portal_achievement_integrity.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261101033250_academy_event_achievement_links.sql','utf8'));
  await db.exec('SET ROLE service_role');
  const original={...draft,startDate:'2026-01-10',endDate:'2026-01-10'};
  const event=(await mutate(db,'create',null,{event:original})).event;const published=await mutate(db,'publish',event.id,{expectedRevision:event.revision,notifyStudents:false});
  const first={eventId:event.id,eventName:'Client name is not authoritative',date:'2026-01-10',category:'Recognized Poomsae',division:'Junior',medalRank:'Gold'};
  const save=async(entries,key=randomUUID())=>(await db.query("SELECT portal_save_achievements($1,'STU-M-001',$2,'[]',$3) result",[root,entries,key])).rows[0].result;
  const key=randomUUID(),saved=await save([first],key),achievement=saved.records[0];assert.equal(achievement.event_id,event.id);assert.equal(achievement.event_name,original.title);
  const revised=await mutate(db,'save',event.id,{expectedRevision:published.event.revision,event:{...original,title:'Renamed competition'}});await mutate(db,'publish',event.id,{expectedRevision:revised.event.revision,notifyStudents:false});
  const edited=await save([{...first,id:achievement.id,eventName:'Renamed competition',notes:'Coach corrected the division notes'}]);assert.equal(edited.records[0].event_name,original.title,'ordinary edits do not rewrite historical title');
  const manual=await save([{...first,id:achievement.id,eventId:null,eventName:'External historical cup'}]);assert.equal(manual.records[0].event_id,null);assert.equal(manual.records[0].event_name,'External historical cup');
  assert.deepEqual(await save([first],key),saved);assert.equal((await db.query('SELECT event_name FROM achievements WHERE id=$1',[achievement.id])).rows[0].event_name,'External historical cup','retry returns receipt without undoing later correction');
  const workshop=(await mutate(db,'create',null,{event:{...original,type:'workshop'}})).event;await mutate(db,'publish',workshop.id,{expectedRevision:workshop.revision,notifyStudents:false});
  await assert.rejects(save([{...first,eventId:workshop.id}]),/published competition/i);assert.equal((await db.query('SELECT count(*)::int n FROM achievements')).rows[0].n,1,'invalid link rolls back the whole save');
 }finally{await db.close();}
});
