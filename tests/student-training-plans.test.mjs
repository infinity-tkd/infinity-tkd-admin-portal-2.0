import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase,root,coach} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';

test('assignment transaction checks staff/student scope, preserves replaced history and replays safely',async()=>{
 const db=await operationsDatabase();
 try{
  await db.exec(fs.readFileSync('supabase/migrations/20261101033150_student_training_assignment_workflow.sql','utf8'));
  const template='95000000-0000-4000-8000-000000000001',second='95000000-0000-4000-8000-000000000002';
  const structure={routineType:'Taekwondo Workout',prepareSeconds:10,workSeconds:30,restSeconds:15,rounds:3,exercises:['Front kick','Side kick']};
  await db.query('INSERT INTO workout_templates(id,title,structure) VALUES($1,$2,$3::jsonb),($4,$5,$3::jsonb)',[template,'Original routine',JSON.stringify(structure),second,'Replacement routine']);
  const call=(actor,action,expected,templateId,key,student='STU-M-001',reason='Coach reviewed the training plan')=>db.query('SELECT portal_assign_training_plan($1,$2,$3,$4,$5,$6,$7) AS result',[actor,student,action,templateId,expected,reason,key]);
  const key='95000000-0000-4000-8000-000000000003';
  await assert.rejects(call(coach,'ASSIGN',null,template,key),error=>error.code==='42501');
  const first=(await call(root,'ASSIGN',null,template,key)).rows[0].result;
  assert.equal((await call(root,'ASSIGN',null,template,key)).rows[0].result.planId,first.planId);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM student_training_plans')).rows[0].count,1);
  await assert.rejects(call(root,'ASSIGN',null,second,'95000000-0000-4000-8000-000000000004'),error=>error.code==='40001');
  await db.query("UPDATE workout_templates SET structure=jsonb_set(structure,'{exercises}','[\"Changed later\"]') WHERE id=$1",[template]);
  assert.deepEqual((await db.query('SELECT customized_structure FROM student_training_plans WHERE id=$1',[first.planId])).rows[0].customized_structure.exercises,structure.exercises,'assignment retains the original exercise snapshot');
  const replacement=(await call(root,'ASSIGN',first.planId,second,'95000000-0000-4000-8000-000000000005')).rows[0].result;
  const old=(await db.query('SELECT is_active,ended_at,end_reason FROM student_training_plans WHERE id=$1',[first.planId])).rows[0];assert.equal(old.is_active,false);assert.ok(old.ended_at);assert.ok(old.end_reason.startsWith('Replaced:'));
  assert.equal((await db.query('SELECT count(*)::int AS count FROM student_training_plans WHERE is_active')).rows[0].count,1);
  await assert.rejects(db.query('DELETE FROM workout_templates WHERE id=$1',[template]),error=>['23503','23001'].includes(error.code));
  const endKey='95000000-0000-4000-8000-000000000006';
  await call(root,'WITHDRAW',replacement.planId,null,endKey);
  await call(root,'WITHDRAW',replacement.planId,null,endKey);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM student_training_plans')).rows[0].count,2);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM student_training_plans WHERE is_active')).rows[0].count,0);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(call(root,'ASSIGN',null,template,'95000000-0000-4000-8000-000000000007'),/permission denied/);
 }finally{await db.close();}
});

test('assignment API rejects spoofed actors, malformed IDs, missing reasons and unsupported students',async()=>{
 const calls=[];
 const query={select(){return query;},eq(){return query;},is(){return query;},maybeSingle:async()=>({data:{id:'STU-M-001'},error:null})};
 const route=loadTs('app/api/admin/student-training-plans/route.ts',{'@/lib/backend-security':{
  verifyCaller:async()=>({context:{userId:root,role:'Admin'},adminSupabase:{from:()=>query,rpc:async(name,args)=>{calls.push({name,args});return {data:{saved:true},error:null};}}}),
  callerHasPermission:async()=>true,
  validateRequestBody:async(schema,request)=>{const parsed=schema.safeParse(await request.json());return parsed.success?{data:parsed.data}:{errorResponse:new Response('',{status:422})};},
  formatServerErrorResponse:()=>new Response('',{status:503}),
 }});
 const body={action:'ASSIGN',studentId:'STU-M-001',templateId:'95000000-0000-4000-8000-000000000001',expectedActivePlanId:null,reason:'A reviewed assignment',requestKey:'95000000-0000-4000-8000-000000000002'};
 const request=value=>new Request('https://portal.example/api/admin/student-training-plans',{method:'POST',body:JSON.stringify(value)});
 for(const change of [{recordedBy:coach},{reason:''},{templateId:'bad-id'},{expectedActivePlanId:'bad-id'}])assert.equal((await route.POST(request({...body,...change}))).status,422);
 assert.equal(calls.length,0);assert.equal((await route.POST(request(body))).status,200);assert.equal(calls[0].args.p_actor,root);
});
