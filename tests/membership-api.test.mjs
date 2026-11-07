import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const actor='85000000-0000-4000-8000-000000000001';
const uuid='85000000-0000-4000-8000-000000000002';
const security=loadTs('lib/backend-security.ts',{'./env':{env:{}},'@/lib/supabase':{supabase:{}}});
function fixture(role='Admin',granted=true){
 const calls=[];const queries=[];
 const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:{id:uuid},error:null}),then(resolve){return Promise.resolve({data:{id:uuid},error:null}).then(resolve);}};},from(table){const filters=[];const q={select(){return q;},update(body){queries.push({table,body,filters});return q;},eq(...args){filters.push(args);return q;},is(){return q;},then(resolve){return Promise.resolve({error:null,data:[]}).then(resolve);}};return q;}};
 const guard={...security,verifyCaller:async(req,roles)=>roles.includes(role)?{context:{userId:actor,role},adminSupabase:client}:{errorResponse:new Response('',{status:403})},callerHasPermission:async()=>granted};
 const stubs={'@/lib/backend-security':guard,'@/lib/operations-server':{featureError:()=>new Response('',{status:503})},'@/lib/notifications-server':{refreshNotices:async()=>{},dispatchUserPush:async()=>{},pushConfiguration:()=>({ready:false,publicKey:''})}};
 return {calls,queries,route:file=>loadTs(file,stubs)};
}
const req=body=>new Request('https://portal.example/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const billing={studentId:'STU-M-001',day:31,effectiveMonth:'2026-10-01',reason:'Family salary date',expectedVersion:'',requestKey:uuid};
test('billing API accepts audited administrator changes and derives actor from session',async()=>{
 const f=fixture();const route=f.route('app/api/membership/schedule/route.ts');
 assert.equal((await route.POST(req(billing))).status,200);assert.equal(f.calls[0].args.p_actor,actor);assert.equal(f.calls[0].args.p_request_key,uuid);
 for(const change of [{reason:'x'},{day:0},{day:32},{effectiveMonth:'2026-02-30'},{userId:uuid}])assert.equal((await route.POST(req({...billing,...change}))).status,422);
 assert.equal(f.calls.length,1);
 for(const [role,grant] of [['Coach',true],['Student',true],['Admin',false]])assert.equal((await fixture(role,grant).route('app/api/membership/schedule/route.ts').POST(req(billing))).status,403);
});
test('makeup API requires mark/delete permission and rejects client actors and ordinary absence writes',async()=>{
 const body={action:'record',studentId:'STU-M-001',sourceClassId:1,sourceDate:'2026-10-20',attendedDate:'2026-10-22',targetClassId:null,status:'Present',reason:'Coach confirmed attendance',requestKey:uuid};
 const f=fixture('Coach');const route=f.route('app/api/attendance/makeup/route.ts');
 assert.equal((await route.POST(req(body))).status,200);assert.equal(f.calls[0].name,'portal_record_makeup');assert.equal(f.calls[0].args.p_actor,actor);
 assert.equal((await route.POST(req({action:'void',id:uuid,reason:'Correct the wrong session'}))).status,200);assert.equal(f.calls[1].name,'portal_void_makeup');
 for(const change of [{status:'Absent'},{sourceDate:'2026-02-30'},{p_actor:uuid},{reason:'x'}])assert.equal((await route.POST(req({...body,...change}))).status,422);
 for(const [role,grant] of [['Student',true],['Coach',false]])assert.equal((await fixture(role,grant).route('app/api/attendance/makeup/route.ts').POST(req(body))).status,403);
});
test('inbox mutations are scoped to the authenticated user and reject SSRF endpoints or extra ownership fields',async()=>{
 const f=fixture('Coach');const route=f.route('app/api/notifications/route.ts');
 assert.equal((await fixture('Student').route('app/api/notifications/route.ts').POST(req({action:'read',id:uuid}))).status,403,'students use the separately source-scoped portal inbox');
 assert.equal((await route.POST(req({action:'read',id:uuid}))).status,200);assert.ok(f.queries[0].filters.some(([key,value])=>key==='user_id'&&value===actor));
 assert.equal((await route.POST(req({action:'read',id:uuid,user_id:uuid}))).status,422);
 assert.equal((await route.POST(req({action:'subscribe',subscription:{endpoint:'http://127.0.0.1/private',keys:{p256dh:'a'.repeat(87),auth:'a'.repeat(22)}}}))).status,422);
 assert.equal((await route.POST(req({action:'preferences',push_enabled:true,muted_categories:['unknown'],quiet_start:22,quiet_end:7}))).status,422);
});
test('notification job rejects missing, incorrect and non-ASCII secrets without querying the database',async()=>{
 const previous=process.env.NOTIFICATION_JOB_SECRET;try{
 const route=loadTs('app/api/jobs/notifications/route.ts',{'@/lib/env':{env:{}},'@/lib/operations-server':{},'@/lib/notifications-server':{}});
 delete process.env.NOTIFICATION_JOB_SECRET;assert.equal((await route.POST(req({}))).status,503);
 process.env.NOTIFICATION_JOB_SECRET='a'.repeat(32);assert.equal((await route.POST(req({}))).status,401);
 assert.equal((await route.POST(new Request('https://portal.example/api/jobs/notifications',{method:'POST',headers:{Authorization:'Bearer '+'é'.repeat(32)}}))).status,401);
 }finally{if(previous===undefined)delete process.env.NOTIFICATION_JOB_SECRET;else process.env.NOTIFICATION_JOB_SECRET=previous;}
});

test('student order history does not expose internal staff notes',async()=>{
 const query={select(){return query;},eq(){return query;},or(){return query;},order(){return query;},abortSignal(){return query;},maybeSingle:async()=>({data:{id:'STU-M-001',student_id:'STU-M-001',allow_student_portal_login:true},error:null})};
 const route=loadTs('app/api/shop/order/route.ts',{'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:actor,role:'Student'},adminSupabase:{from:()=>query}}),callerHasPermission:async()=>true},'@/lib/student-ownership':{resolveOwnedStudentIds:async()=>['STU-M-001'],StudentOwnershipError:class extends Error{}},'@/lib/data-access':{fetchAllRows:async()=>({data:[{id:uuid,order_number:'FIXTURE-001',student_notes:'My size is M',admin_notes:'Private staff follow-up'}],error:null})}});
 const response=await route.GET(new Request('https://portal.example/api/shop/order'));assert.equal(response.status,200);const body=await response.json();assert.equal(body.data[0].student_notes,'My size is M');assert.ok(!('admin_notes' in body.data[0]));
});
