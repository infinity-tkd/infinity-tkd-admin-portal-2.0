import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const actor='70000000-0000-4000-8000-000000000001';
const key='70000000-0000-4000-8000-000000000002';
function route(file,result={data:{receipt_number:'Receipt',transactions:[]},error:null}){
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return result;},from:()=>{
  const query={};for(const method of ['select','order','eq','update','delete'])query[method]=()=>query;
  query.single=async()=>({error:{code:'PGRST116',message:'Not found'}});return query;
 }};
 const routes=loadTs(file,{
  '@/lib/dates':loadTs('lib/dates.ts'),
  '@/lib/data-access':{fetchAllRows:async()=>({data:[],error:null})},
  '@/lib/backend-security':{
   verifyCaller:async()=>({context:{userId:actor,role:'Coach'},adminSupabase:client}),
   validateRequestBody:async(schema,req)=>{const parsed=schema.safeParse(await req.json());return parsed.success?{data:parsed.data}:{errorResponse:Response.json({success:false},{status:422})};},
   formatServerErrorResponse:error=>Response.json({success:false,error:{message:error.message}},{status:error.code==='PGRST116'||error.code==='P0002'?404:503}),
   logSecurityAuditEvent:async()=>{}
  }
 });return {routes,calls};
}
const request=(path,body,method='POST')=>new Request('https://portal.example'+path,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
test('family API validates allocations and bank references before calling the database',async()=>{
 const {routes,calls}=route('app/api/admin/households/payments/route.ts');
 const payload={householdId:actor,requestKey:key,method:'ABA Bank KHQR',entries:[{studentId:'A',year:2026,month:'Oct',amount:25}]};
 assert.equal((await routes.POST(request('/api/admin/households/payments',payload))).status,422);
 assert.equal((await routes.POST(request('/api/admin/households/payments',{...payload,method:'Cash',entries:[...payload.entries,...payload.entries]}))).status,422);
 assert.equal((await routes.POST(request('/api/admin/households/payments',{...payload,method:'Cash',recordedBy:'Spoofed'}))).status,422);
 assert.equal(calls.length,0);
 assert.equal((await routes.POST(request('/api/admin/households/payments',{...payload,reference:'BANK-1'}))).status,200);
 assert.equal(calls[0].args.p_actor,actor);assert.equal(calls[0].args.p_request_key,key);
});
test('measurement API rejects future dates, missing metrics and spoofed audit identities',async()=>{
 const {routes,calls}=route('app/api/admin/body-compositions/route.ts',{data:{measurement:{id:1},latest:{height_cm:180}},error:null});
 const payload={requestKey:key,measurement:{student_id:'A',recorded_date:'2026-01-01',height_cm:180,weight_kg:70,body_fat_percentage:0}};
 for(const measurement of [{...payload.measurement,recorded_date:'2200-01-01'},{...payload.measurement,height_cm:null},{...payload.measurement,body_fat_percentage:101},{...payload.measurement,recorded_by:actor}])assert.equal((await routes.POST(request('/api/admin/body-compositions',{...payload,measurement}))).status,422);
 assert.equal(calls.length,0);
 assert.equal((await routes.POST(request('/api/admin/body-compositions',payload))).status,200);
 assert.equal(calls[0].args.p_actor,actor);assert.equal(calls[0].args.p_payload.body_fat_percentage,0);
});
test('class routes reject malformed IDs and report missing edits without successful audit entries',async()=>{
 const {routes,calls}=route('app/api/admin/classes/route.ts',{data:null,error:{code:'P0002',message:'Class not found'}});
 for(const id of ['1abc','1.5','2147483648','-1'])assert.equal((await routes.DELETE(request('/api/admin/classes?id='+id,undefined,'DELETE'))).status,422);
 assert.equal((await routes.GET(request('/api/admin/classes?branchId=1abc',undefined,'GET'))).status,422);
 assert.equal(calls.length,0);
 assert.equal((await routes.DELETE(request('/api/admin/classes?id=2',undefined,'DELETE'))).status,404);
 assert.equal(calls[0].name,'portal_delete_class');
 assert.equal((await routes.PUT(request('/api/admin/classes',{id:999,data:{name:'Missing'}},'PUT'))).status,404);
});
test('staff Dan routes reject impossible dates, no-op edits, spoofed identities and missing deletions',async()=>{
 const {routes}=route('app/api/admin/staff-dan/route.ts');
 const payload={userId:actor,danLevel:1,issueDate:'2026-01-01'};
 for(const invalid of [{...payload,issueDate:'2026-02-30'},{...payload,issueDate:'2200-01-01'},{...payload,recordedBy:actor}])assert.equal((await routes.POST(request('/api/admin/staff-dan',invalid))).status,422);
 assert.equal((await routes.PUT(request('/api/admin/staff-dan',{id:key},'PUT'))).status,422);
 assert.equal((await routes.GET(request('/api/admin/staff-dan?userId=invalid',undefined,'GET'))).status,422);
 assert.equal((await routes.DELETE(request('/api/admin/staff-dan?id=invalid',undefined,'DELETE'))).status,422);
 assert.equal((await routes.DELETE(request('/api/admin/staff-dan?id='+key,undefined,'DELETE'))).status,404);
});
test('library API rejects duplicate relations, invalid actions and unconfirmed saves',async()=>{
 const {routes,calls}=route('app/api/admin/library-assets/route.ts',{data:null,error:{code:'PGRST202',message:'Migration missing'}});
 const asset={title:'Lesson',description:'',library_type:'Taekwondo',tkd_category:'Recognized Poomsae',fitness_category:null,target_level:'Yellow',video_url:'',muscleRelations:[{muscleId:1,role:'Primary'},{muscleId:1,role:'Secondary'}]};
 assert.equal((await routes.POST(request('/api/admin/library-assets',{action:'CREATE',requestKey:key,asset}))).status,422);
 assert.equal((await routes.POST(request('/api/admin/library-assets',{action:'DELETE',id:'1'}))).status,422);
 assert.equal(calls.length,0);
 assert.equal((await routes.POST(request('/api/admin/library-assets',{action:'CREATE',requestKey:key,asset:{...asset,muscleRelations:[]}}))).status,503);
 assert.equal(calls[0].args.p_actor,actor);
});
