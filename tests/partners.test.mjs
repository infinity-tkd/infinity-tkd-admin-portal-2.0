import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const id='50000000-0000-4000-8000-000000000001';
function portal(result){
 const calls=[];
 const client={from:table=>{
  const query={};
  for(const method of ['insert','update','delete','select','eq','order'])query[method]=(...args)=>{calls.push({table,method,args});return query;};
  query.single=async()=>result;
  return query;
 }};
 const routes=loadTs('app/api/admin/partners/route.ts',{
  '@/lib/dates':loadTs('lib/dates.ts'),
  '@/lib/partners':loadTs('lib/partners.ts'),
  '@/lib/data-access':{fetchAllRows:async()=>result},
  '@/lib/backend-security':{
   verifyCaller:async()=>({context:{userId:id,role:'Root'},adminSupabase:client}),
   validateRequestBody:async(schema,req)=>{
    const parsed=schema.safeParse(await req.json());
    return parsed.success ? {data:parsed.data} : {errorResponse:Response.json({success:false},{status:422})};
   },
   sanitizeString:value=>value.trim(),
   logSecurityAuditEvent:async()=>{},
   formatServerErrorResponse:error=>Response.json({success:false,error:{message:error.message}},{status:500})
  }
 });
 return {routes,calls};
}
const request=(method,body)=>new Request('https://portal.example/api/admin/partners'+(method==='DELETE'?'?id='+id:''),{
 method,...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})
});
test('partner database failures never return invented records or successful local-only mutations',async()=>{
 const {routes,calls}=portal({data:null,error:{code:'42P01',message:'Missing partners table'}});
 for(const [method,body] of [['GET'],['POST',{name:'Academy',status:'Under Renewal'}],['PUT',{id,name:'Updated Academy'}],['DELETE']]){
  const response=await routes[method](request(method,body));
  assert.equal(response.status,500,method);
  assert.equal((await response.json()).success,false,method);
 }
 assert.equal(calls.filter(c=>c.method==='insert').length,1,'no schema fallback that discards submitted fields');
});
test('partner saves preserve MOU status, scope, benefits and confirmed identity',async()=>{
 const body={name:'Academy',status:'Under Renewal',collaborationScope:'Athlete exchange',benefitsSummary:'Equipment support'};
 const {routes,calls}=portal({data:{id,name:body.name,status:body.status},error:null});
 const response=await routes.POST(request('POST',body));
 assert.equal(response.status,201);
 assert.equal((await response.json()).data.id,id);
 const payload=calls.find(c=>c.method==='insert').args[0];
 assert.equal(payload.status,body.status);
 assert.equal(payload.collaboration_scope,body.collaborationScope);
 assert.equal(payload.benefits_summary,body.benefitsSummary);
});
test('sample partner IDs and impossible dates are rejected before database writes',async()=>{
 const {routes,calls}=portal({data:{id},error:null});
 assert.equal((await routes.PUT(request('PUT',{id:'p-sample',name:'Sample'}))).status,422);
 assert.equal((await routes.POST(request('POST',{name:'Academy',mouSignedDate:'2026-02-30'}))).status,422);
 assert.equal(calls.length,0);
});
test('cleared CRM contacts do not reappear from legacy duplicated values',async()=>{
 const {routes}=portal({data:{id,name:'Academy',contact_name:null,contact_person:'Old contact',notes:null,internal_notes:'Old notes'},error:null});
 const response=await routes.PUT(request('PUT',{id,contactName:null,notes:null}));
 const body=await response.json();
 assert.equal(body.data.contact_name,null);
 assert.equal(body.data.notes,null);
});
