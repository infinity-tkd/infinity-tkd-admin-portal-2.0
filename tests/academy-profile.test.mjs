import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {academyProfileChanges}=loadTs('lib/academy-profile.ts');
const settings=loadTs('lib/academy-settings.ts');
function portal(result){
 const calls=[];
 const client={from:()=>{const query={upsert:payload=>{calls.push({payload,operation:'upsert'});return query;},update:payload=>{calls.push({payload,operation:'update',filters:[]});return query;},eq:(key,value)=>{calls.at(-1).filters.push([key,value]);return query;},select:()=>query,maybeSingle:async()=>result};return query;}};
 const routes=loadTs('app/api/admin/update-academy-profile/route.ts',{
  '@/lib/academy-settings':settings,
  '@/lib/backend-security':{
   verifyCaller:async()=>({context:{userId:'Trusted actor',email:'admin@example.test'},adminSupabase:client}),
   validateRequestBody:async(schema,req)=>{const parsed=schema.safeParse(await req.json());return parsed.success?{data:parsed.data}:{errorResponse:Response.json({success:false},{status:422})};},
   sanitizeString:value=>value.trim(),logSecurityAuditEvent:async()=>{},
   formatServerErrorResponse:error=>Response.json({success:false,error:{message:error.message}},{status:503})
  }
 });return {routes,calls};
}
const request=payload=>new Request('https://portal.example/api/admin/update-academy-profile',{method:'POST',body:JSON.stringify(payload)});
test('settings filter server-managed fields while retaining intentional clears and zero fees',async()=>{
 const payload=academyProfileChanges({id:'Ignored',updatedAt:'Old',updatedBy:'Spoofed',academyName:'Infinity',standardTuitionUsd:0,legalName:null,websiteUrl:''});
 assert.deepEqual(payload,{academyName:'Infinity',legalName:null,websiteUrl:'',standardTuitionUsd:0});
 const {routes,calls}=portal({data:{id:'default',academy_name:'Infinity'},error:null});
 assert.equal((await routes.POST(request(payload))).status,200);
 assert.equal(calls[0].payload.updated_by,'Trusted actor');assert.equal(calls[0].payload.standard_tuition_usd,0);
});

test('settings reject blank names, unsafe links, empty patches and invalid reference values',async()=>{
 const {routes,calls}=portal({data:{id:'default'},error:null});
 for(const patch of [{academyName:'   '},{websiteUrl:'javascript:alert(1)'},{logoUrl:'//evil.test/logo.svg'},{portalUrl:'ftp://example.test'},{examPassingScore:101},{tuitionGracePeriodDays:1.5},{}]) {
  assert.equal((await routes.POST(request(patch))).status,422);
 }
 assert.equal(calls.length,0);
 assert.equal((await routes.POST(request({academyName:' Infinity ',websiteUrl:''}))).status,200);
 assert.equal(calls[0].payload.academy_name,'Infinity');assert.equal(calls[0].payload.website_url,'');
});

test('settings stale saves return conflict and compare the server timestamp before writing',async()=>{
 const {routes,calls}=portal({data:null,error:null});
 const time='2026-10-11T01:02:03.000Z';
 const response=await routes.POST(request({tagline:'My draft',expectedUpdatedAt:time}));
 assert.equal(response.status,409);
 assert.equal(calls[0].operation,'update');
 assert.deepEqual(calls[0].filters,[['id','default'],['updated_at',time]]);
 assert.equal(calls[0].payload.academy_name,undefined,'partial saves do not overwrite unrelated fields');
 assert.equal(calls[0].payload.expectedUpdatedAt,undefined);
});

test('settings realtime rebase preserves local edits and identifies same-field conflicts',()=>{
 const baseline={academyName:'Infinity',contactPhone:'123',standardTuitionUsd:'45'};
 const draft={...baseline,academyName:'My academy'};
 const unrelated={...baseline,contactPhone:'456'};
 assert.deepEqual(settings.rebaseAcademyDraft(draft,baseline,unrelated),{draft:{...draft,contactPhone:'456'},conflicts:[]});
 const conflicting={...unrelated,academyName:'Other admin'};
 assert.deepEqual(settings.rebaseAcademyDraft(draft,baseline,conflicting),{draft:{...draft,contactPhone:'456'},conflicts:['academyName']});
 assert.deepEqual(settings.rebaseAcademyDraft(draft,baseline,{...unrelated,academyName:'My academy'}).conflicts,[]);
 assert.deepEqual(settings.changedAcademyFields({...baseline,contactPhone:''},baseline),{contactPhone:''});
});
test('settings database failures remain failures and invalid fees never reach the database',async t=>{
 t.mock.method(console,'error',()=>{});
 const {routes,calls}=portal({data:null,error:{message:'Database unavailable'}});
 assert.equal((await routes.POST(request({academyName:'Infinity'}))).status,503);
 assert.equal((await routes.POST(request({standardTuitionUsd:-1}))).status,422);
 assert.equal(calls.length,1,'no fallback write after failed validation or database save');
});
