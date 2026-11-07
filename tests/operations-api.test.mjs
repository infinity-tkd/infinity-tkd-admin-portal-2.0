import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const actor='93000000-0000-4000-8000-000000000001',other='93000000-0000-4000-8000-000000000002';
const security=loadTs('lib/backend-security.ts',{'./env':{env:{}},'@/lib/supabase':{supabase:{}}});
function fixture({granted=true,role='Admin'}={}) {
 const calls=[];
 const route=loadTs('app/api/operations/route.ts',{'./backend-security':security,'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:actor,role},adminSupabase:{rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:{saved:true},error:null})};}}}),callerHasPermission:async()=>granted},'@/lib/operations-read':{readOperations:async()=>({tasks:[]})}});
 return {route,calls};
}
const request=body=>new Request('https://portal.example/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('operations API validates financial and schedule payloads and derives the actor from the verified session',async()=>{
 const f=fixture();const body={action:'payment',requestKey:other,studentId:'STU-M-001',amount:10,paymentDate:'2026-10-25',method:'Cash',externalReference:null,receivedVerified:true,allocations:[{invoiceId:other,amount:10}]};
 assert.equal((await f.route.POST(request(body))).status,200);assert.equal(f.calls[0].args.p_actor,actor);assert.equal(f.calls[0].args.p_action,'payment');assert.ok(!('requestKey' in f.calls[0].args.p_data));
 for(const change of [{amount:-1},{amount:10.123},{paymentDate:'2026-02-30'},{receivedVerified:false},{userId:other},{allocations:[]},{method:'Bank Transfer',externalReference:null},{externalReference:'AB'}])assert.equal((await f.route.POST(request({...body,...change}))).status,422);
 assert.equal(f.calls.length,1);assert.equal((await fixture({granted:false}).route.POST(request(body))).status,403);
 assert.equal((await f.route.POST(request({action:'session_change',requestKey:other,id:other,revision:1,status:'scheduled',startsAt:'bad-date',reason:'A valid change reason'}))).status,422);
});
test('operations API preserves setup failures and returns safe actionable business errors',async()=>{
 const {operationsError}=loadTs('lib/operations-errors.ts',{'./operations-server':{featureError:()=>new Response('setup',{status:503})}});
 let response=operationsError({code:'40001',message:'Session changed. Reload before saving',details:'Private row values'});assert.equal(response.status,409);assert.ok(!(await response.text()).includes('Private'));
 response=operationsError({code:'23505',message:'duplicate row with private bank reference'});assert.equal(response.status,409);assert.ok(!(await response.text()).includes('private bank'));
 assert.equal(operationsError({code:'42P01'}).status,503);
});
test('performance API stores bounded metrics with account-scoped hashed metric identities',async()=>{
 const recorded=[];const route=loadTs('app/api/performance/route.ts',{'./backend-security':security,'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:actor,role:'Admin'},adminSupabase:{from:()=>({upsert:async sample=>{recorded.push(sample);return {error:null};}})}})}});
 const body={page:'/operations',metric:'INP',value:110,device:'phone',metricId:'random-sample'};
 assert.equal((await route.POST(request(body))).status,200);assert.equal(recorded[0].metric_key.length,64);assert.ok(!JSON.stringify(recorded).includes(actor));assert.ok(!('metricId' in recorded[0]));
 for(const change of [{page:'/students?student=private'},{metric:'unknown'},{value:-1},{device:'device-model'},{studentId:'STU-M-001'}])assert.equal((await route.POST(request({...body,...change}))).status,422);
 assert.equal((await route.POST(request({...body,metric:'CLS',value:150}))).status,422);assert.equal(recorded.length,1);
});
