import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';
const migration='supabase/migrations/20261102181741_workout_authoring_publications.sql';
const template={title:'Fixture routine',description:'Approved practice sequence',difficulty:'Intermediate',creator:'Fixture coach',structure:{routineType:'Taekwondo Workout',prepareSeconds:10,workSeconds:30,restSeconds:15,rounds:3,exercises:['Front kick','Side kick']}};
const {workoutDraftPayload}=loadTs('lib/workout-authoring.ts');
async function setup(){const db=await operationsDatabase();await db.exec(fs.readFileSync('supabase/migrations/20261101161201_role_permission_boundaries.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20261101033150_student_training_assignment_workflow.sql','utf8'));await db.exec(fs.readFileSync(migration,'utf8'));return db;}
const command=(db,id,action,revision,content=template,key=randomUUID(),actor=root)=>db.query('SELECT portal_save_workout_draft($1,$2,$3,$4,$5,$6::jsonb,$7) result',[actor,action,id,revision,key,action==='ARCHIVE'?{}:workoutDraftPayload(content),'Academy reviewed this publication']);

test('routine authoring stays private until explicit publication; replay, stale edits and assigned snapshots are protected',async()=>{
 const db=await setup();try{
  const id=randomUUID(),key=randomUUID();
  const draft=(await command(db,id,'SAVE_DRAFT',0,template,key)).rows[0].result;
  assert.equal(draft.template.revision,1);assert.equal(draft.published,false);
  assert.equal((await db.query('SELECT count(*)::int n FROM workout_templates')).rows[0].n,0,'legacy student readers cannot see private drafts');
  assert.equal((await command(db,id,'SAVE_DRAFT',0,template,key)).rows[0].result.template.revision,1,'ambiguous save retry does not create another revision');
  await assert.rejects(command(db,id,'PUBLISH',0,template,key),error=>error.code==='22023');
  const published=(await command(db,id,'PUBLISH',1)).rows[0].result;
  assert.equal(published.template.published_revision,2);
  assert.equal((await db.query('SELECT duration_mins FROM workout_templates WHERE id=$1',[id])).rows[0].duration_mins,5,'duration has no extra rest after the last interval');
  await db.query('SELECT portal_assign_training_plan($1,$2,$3,$4,$5,$6,$7)',[root,'STU-M-001','ASSIGN',id,null,'Approved practice assignment',randomUUID()]);
  const changed={...template,title:'A revised title',structure:{...template.structure,exercises:['Back kick']}};
  await command(db,id,'SAVE_DRAFT',2,changed);
  assert.equal((await db.query('SELECT title FROM workout_templates WHERE id=$1',[id])).rows[0].title,template.title,'editing does not silently change student content');
  await assert.rejects(command(db,id,'PUBLISH',2,changed),error=>error.code==='40001');
  await command(db,id,'PUBLISH',3,changed);
  assert.equal((await db.query('SELECT title FROM workout_templates WHERE id=$1',[id])).rows[0].title,changed.title);
  assert.deepEqual((await db.query('SELECT customized_structure FROM student_training_plans')).rows[0].customized_structure.exercises,template.structure.exercises,'an existing assigned plan retains its original snapshot');
  await assert.rejects(command(db,id,'ARCHIVE',4),/Published routines are retained/);
  assert.equal((await db.query('SELECT count(*)::int n FROM student_training_plans')).rows[0].n,1);
 }finally{await db.close();}
});

test('draft archive retains records; invalid structures and browser writes cannot bypass the publication workflow',async()=>{
 const db=await setup();try{
  const id=randomUUID();await command(db,id,'SAVE_DRAFT',0);
  await command(db,id,'ARCHIVE',1);
  assert.equal((await db.query('SELECT count(*)::int n FROM workout_template_drafts')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_workout_management')).rows[0].n,0);
  assert.ok((await db.query('SELECT archived_at FROM workout_template_drafts')).rows[0].archived_at);
  await assert.rejects(command(db,id,'SAVE_DRAFT',2),/archived/);
  for(const payload of [{},{...workoutDraftPayload(template),structure:{...template.structure,rounds:0}},{...workoutDraftPayload(template),structure:{...template.structure,staffNotes:'PRIVATE'}},{...workoutDraftPayload(template),structure:{...template.structure,rounds:'3'}}]){
   await assert.rejects(db.query('SELECT portal_save_workout_draft($1,$2,$3,$4,$5,$6::jsonb,$7)',[root,'SAVE_DRAFT',randomUUID(),0,randomUUID(),payload,'Reviewed reason']),error=>error.code==='22023');
  }
  await db.exec('SET ROLE authenticated');
  await assert.rejects(db.query('SELECT * FROM workout_template_drafts'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM portal_workout_management'),/permission denied/);
  await assert.rejects(db.query('INSERT INTO workout_templates(title,structure)VALUES($1,$2::jsonb)',['Unapproved public write',template.structure]),/permission denied/);
  await assert.rejects(command(db,randomUUID(),'SAVE_DRAFT',0),/permission denied/);
 }finally{await db.close();}
});

test('routine API validates publication reasons and structures before a single verified server command',async()=>{
 const calls=[];let permitted=true;
 const security={verifyCaller:async()=>({context:{userId:root,role:'Root'},adminSupabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:{id:args.p_id,template:{id:args.p_id},published:args.p_action==='PUBLISH'},error:null};}}}),callerHasPermission:async()=>permitted,callerHasAnyPermission:async()=>permitted,validateRequestBody:async(schema,req)=>{const result=schema.safeParse(await req.json());return result.success?{data:result.data}:{errorResponse:new Response('',{status:422})};},formatServerErrorResponse:()=>new Response('',{status:503})};
 const route=loadTs('app/api/admin/workout-templates/route.ts',{'@/lib/backend-security':security});
 const body={action:'PUBLISH',id:randomUUID(),expectedRevision:0,requestKey:randomUUID(),template,reason:'Reviewed by coach'};
 const req=value=>new Request('https://academy.test/api/admin/workout-templates',{method:'POST',body:JSON.stringify(value)});
 for(const change of [{reason:''},{expectedRevision:-1},{recordedBy:'spoofed'},{template:{...template,structure:{...template.structure,exercises:[]}}}])assert.equal((await route.POST(req({...body,...change}))).status,422);
 assert.equal(calls.length,0);assert.equal((await route.POST(req(body))).status,200);assert.equal(calls.length,1);assert.equal(calls[0].args.p_actor,root);assert.equal(calls[0].args.p_payload.duration_mins,5);
 permitted=false;assert.equal((await route.POST(req(body))).status,403);assert.equal(calls.length,1);
});
