import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadTs } from './load-ts.mjs';

const contract=loadTs('lib/student-portal-admin-contract.ts');
const actor='76000000-0000-4000-8000-000000000001',coach='76000000-0000-4000-8000-000000000002',studentActor='76000000-0000-4000-8000-000000000003';
const policyId='76000000-0000-4000-8000-000000000010';
const requirements={minimumDays:0,minimumAverageGrade:0,attendance:{minimum:0,basis:'dated_sessions'},lessons:[{id:'lesson-a',curriculumId:1,label:{en:'Test lesson',kh:'Fixture',zh:'Fixture'}}],skills:[]};
const draft={targetBelt:'White',version:'unapproved-test',minimumDays:60,minimumAverageGrade:2,attendance:{minimum:16,basis:null},lessons:[],skills:[],mappingReviewed:false,reviewNotes:'Testing unpublished preparation'};

test('preparation validators retain unknown approval decisions, reject spoofing and distinguish drafts from publications',()=>{
  assert.equal(contract.readinessDraftSchema.safeParse(draft).success,true);
  assert.ok(contract.readinessReviewIssues(draft).length>=3);
  assert.equal(contract.publishedReadinessRequirementsSchema.safeParse({...requirements,attendance:{minimum:16,basis:null}}).success,false);
  assert.equal(contract.publishedReadinessRequirementsSchema.safeParse({...requirements,minimumAverageGrade:2}).success,false);
  assert.equal(contract.studentPortalAdminSchema.safeParse({action:'publish',requestKey:randomUUID()}).success,false);
  const confirmation={action:'confirm_lesson',requestKey:randomUUID(),studentId:'STU-M-1',policyId,requirementKey:'lesson-a',result:'passed',reference:'Genuine fixture evidence',observedNow:true};
  assert.equal(contract.studentPortalAdminSchema.safeParse(confirmation).success,true);
  for(const addition of [{confirmedAt:'2020-01-01'},{confirmedBy:actor},{observedNow:false}])assert.equal(contract.studentPortalAdminSchema.safeParse({...confirmation,...addition}).success,false);
  const ranking={seasonStart:'2026-01-01',seasonEnd:'2026-12-31',methodology:'medal_order',entries:[{student_id:'STU-M-1',display_name:'Approved fixture name',consent_reference:'',gold:0,silver:1,bronze:0}],reviewNotes:''};
  assert.equal(contract.rankingDraftSchema.safeParse(ranking).success,true);
  assert.equal(contract.rankingReviewIssues(ranking).length,1);
  assert.equal(contract.rankingDraftSchema.safeParse({...ranking,entries:[...ranking.entries,...ranking.entries]}).success,false);
});

test('preparation RPC is service-only, drafts do not publish, revisions and retries are guarded, confirmations preserve withdrawn history',async()=>{
  const db=new PGlite();
  try{
    await db.exec(fs.readFileSync('tests/fixtures/student-portal-preparation.sql','utf8'));
    const helper=fs.readFileSync('supabase/production-upgrade-20261009.sql','utf8').match(/CREATE OR REPLACE FUNCTION public\.portal_assert_actor[\s\S]*?\$\$;/)[0];
    await db.exec(helper);
    await db.exec(fs.readFileSync('supabase/migrations/20261101030518_student_portal_admin_preparation.sql','utf8'));
    await db.exec(`INSERT INTO profiles(id,role) VALUES('${actor}','Admin'),('${coach}','Coach'),('${studentActor}','Student');
      INSERT INTO role_permissions VALUES('Admin','page:lms',true),('Admin','action:evaluations_grade',true),('Coach','page:lms',true),('Coach','action:evaluations_grade',true),('Student','page:lms',true),('Student','action:evaluations_grade',true);
      INSERT INTO students(id,current_belt,initial_belt,registration_date) VALUES('STU-M-1','White','White',CURRENT_DATE-100);
      INSERT INTO curriculum(id,is_active) VALUES(1,true);
      SELECT set_config('request.jwt.role','service_role',false);`);
    const call=async(action,data,key=randomUUID(),who=actor)=>{await db.exec('SET ROLE service_role');try{return await db.query('SELECT portal_student_publication_admin($1,$2,$3,$4) result',[who,action,JSON.stringify(data),key]);}finally{await db.exec('RESET ROLE');}};
    const payload={kind:'readiness',title:'Fixture private review',payload:draft,revision:0};
    const key=randomUUID();
    const saved=(await call('save_draft',payload,key)).rows[0].result;
    assert.equal(saved.state,'draft');
    assert.deepEqual((await call('save_draft',payload,key)).rows[0].result,saved);
    assert.equal((await db.query('SELECT count(*)::integer n FROM student_portal_admin_drafts')).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::integer n FROM student_portal_readiness_policies')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::integer n FROM student_portal_ranking_publications')).rows[0].n,0);
    await assert.rejects(call('save_draft',{...payload,title:'Changed'},key),/request key mismatch/);
    await assert.rejects(call('save_draft',{...payload,id:saved.id,revision:9}),/Draft changed/);
    await assert.rejects(call('save_draft',payload,randomUUID(),coach),/administrator or head coach/);
    await assert.rejects(call('save_draft',payload,randomUUID(),studentActor),/Preparation access denied/);
    await assert.rejects(call('publish',{}),/Invalid preparation/);
    await db.query(`INSERT INTO student_portal_readiness_policies(id,target_belt,version,requirements,approval_reference,approved_by,approved_at,publish_from,publish_until) VALUES($1,'White','fixture-approved',$2,'TEST ONLY',$3,now()-interval '2 days',now()-interval '1 day',now()+interval '1 day')`,[policyId,JSON.stringify(requirements),actor]);
    const observation={studentId:'STU-M-1',policyId,requirementKey:'lesson-a',result:'passed',reference:'Fixture observed lesson',observedNow:true};
    const confirmationKey=randomUUID();
    const first=(await call('confirm_lesson',observation,confirmationKey,coach)).rows[0].result;
    assert.deepEqual((await call('confirm_lesson',observation,confirmationKey,coach)).rows[0].result,first);
    await assert.rejects(call('confirm_lesson',{...observation,observedNow:false},randomUUID(),coach),/observed result/);
    await assert.rejects(call('confirm_lesson',{...observation,requirementKey:'not-in-policy'},randomUUID(),coach),/exact policy/);
    const latest=(await call('confirm_lesson',{...observation,result:'needs_work'},randomUUID(),coach)).rows[0].result;
    await call('withdraw_confirmation',{id:latest.id,reason:'Invalid fixture observation'},randomUUID(),coach);
    const records=(await db.query('SELECT * FROM student_portal_coach_confirmations ORDER BY confirmed_at DESC,id DESC')).rows;
    assert.equal(records.length,2);
    assert.equal(records[0].result,'needs_work');
    assert.ok(records[0].revoked_at,'the withdrawn latest record remains first; an older pass is not restored');
    assert.equal(records[0].confirmed_by,coach);
    assert.ok(new Date(records[0].confirmed_at).getTime()>Date.now()-60000);
    await db.exec(`UPDATE student_portal_readiness_policies SET revoked_at=now() WHERE id='${policyId}'`);
    await assert.rejects(call('confirm_lesson',observation,randomUUID(),coach),/currently approved/);
    const grants=(await db.query("SELECT has_table_privilege('authenticated','student_portal_admin_drafts','SELECT') browser_read,has_table_privilege('authenticated','student_portal_admin_drafts','INSERT') browser_write,has_function_privilege('authenticated','portal_student_publication_admin(uuid,text,jsonb,uuid)','EXECUTE') browser_execute")).rows[0];
    assert.deepEqual(grants,{browser_read:false,browser_write:false,browser_execute:false});
    await db.exec(`INSERT INTO user_permissions VALUES('${actor}','action:evaluations_grade',false)`);
    await assert.rejects(call('save_draft',payload),/Permission denied/);
  }finally{await db.close();}
});

test('admin preparation API checks both permissions and role, rejects forged publication/actor/time fields, and forwards the verified actor',async()=>{
  const calls=[];
  let role='Admin',allowed=true;
  const route=loadTs('app/api/admin/student-portal-preparation/route.ts',{
    '@/lib/student-portal-admin-contract':contract,
    '@/lib/backend-security':{
      verifyCaller:async(_req,roles)=>{assert.ok(!roles.includes('Student'));return {context:{userId:actor,role},adminSupabase:{rpc:(name,args)=>({abortSignal:async()=>{calls.push({name,args});return {data:{id:randomUUID(),revision:1},error:null};}})}};},
      callerHasPermission:async(_client,_context,permission)=>{assert.ok(['page:lms','action:evaluations_grade'].includes(permission));return allowed;},
      validateRequestBody:async(schema,req)=>{const parsed=schema.safeParse(await req.json());return parsed.success?{data:parsed.data}:{errorResponse:Response.json({success:false},{status:422})};},
    },
    '@/lib/student-portal-admin-server':{
      preparationRoles:['Root','Super Root','Admin','Head Coach'],confirmationRoles:['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach'],
      readStudentPortalPreparation:async()=>({drafts:[],publicationEnabled:false}),readStudentLessonConfirmations:async()=>({confirmations:[]}),
      studentPortalAdminError:()=>Response.json({success:false},{status:503}),validateLessonPolicyContract:async()=>{},
    },
  });
  const send=body=>route.POST(new Request('https://portal.example/api/admin/student-portal-preparation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const payload={action:'save_draft',kind:'readiness',title:'Private review',revision:0,payload:draft,requestKey:randomUUID()};
  for(const forged of [{...payload,approvedBy:actor},{...payload,action:'publish'},{...payload,p_actor:actor}])assert.equal((await send(forged)).status,422);
  role='Coach';assert.equal((await send(payload)).status,403);assert.equal((await route.GET(new Request('https://portal.example/api/admin/student-portal-preparation?view=overview'))).status,403);
  role='Admin';allowed=false;assert.equal((await send(payload)).status,403);allowed=true;
  assert.equal(calls.length,0);
  assert.equal((await send(payload)).status,200);assert.equal(calls[0].name,'portal_student_publication_admin');assert.equal(calls[0].args.p_actor,actor);assert.equal(calls[0].args.p_action,'save_draft');
  assert.ok(!Object.hasOwn(calls[0].args.p_data,'requestKey'));
  const confirmation={action:'confirm_lesson',studentId:'STU-M-1',policyId,requirementKey:'lesson-a',result:'passed',reference:'Observed fixture',observedNow:true,requestKey:randomUUID()};
  assert.equal((await send({...confirmation,confirmedAt:'2020-01-01'})).status,422);
  role='Coach';assert.equal((await send(confirmation)).status,200);
});
