import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const actor='99000000-0000-4000-8000-000000000001',other='99000000-0000-4000-8000-000000000002';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server'};
const bearer='Bearer '+Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url')+'.fixture';
const request=(path,body)=>new Request('https://portal.example'+path,{method:'POST',headers:{Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify(body??{})});
function fixture(role,{roleOverrides={},userOverrides={},permissionFailure=false}={}){
 const reads=[],writes=[];
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null}),admin:{createUser:async()=>{writes.push('createUser');throw Error('Unexpected identity creation');},updateUserById:async()=>{writes.push('updateUserById');throw Error('Unexpected credential update');}}},rpc:async(name)=>{if(name==='portal_take_rate_slot')return {data:true,error:null};writes.push(name);throw Error('Unexpected database mutation');},from(table){
  const filters={};const query={select(){return query;},eq(key,value){filters[key]=value;return query;},in(key,value){filters[key]=value;return query;},async single(){reads.push(table);return {data:{id:actor,role,is_active:true,must_change_password:false,email:'fixture@example.test'},error:null};},then(resolve,reject){reads.push({table,filters});const overrides=table==='role_permissions'?roleOverrides:userOverrides;return Promise.resolve(permissionFailure?{data:null,error:{code:'08006'}}:{data:(filters.permission_key??[]).filter(key=>typeof overrides[key]==='boolean').map(permission_key=>({permission_key,is_granted:overrides[permission_key]})),error:null}).then(resolve,reject);}};return query;
 }};
 const stubs={'@supabase/supabase-js':{createClient:()=>client},'./env':{env},'@/lib/env':{env},'@/lib/supabase':{supabase:{}}};
 const security=loadTs('lib/backend-security.ts',stubs);
 return {security,client,reads,writes,route:file=>loadTs(file,{...stubs,'@/lib/backend-security':{...security,logSecurityAuditEvent:async()=>{}}})};
}
test('archive authentication requires publishing rather than creation, preserving page/action and explicit denial rules',async()=>{
 const check=fixture('Admin',{roleOverrides:{'action:events_publish':true,'action:events_create':false}});
 assert.equal((await check.security.verifyCaller(request('/api/admin/events/'+other+'/archive'))).context?.role,'Admin');
 assert.equal((await check.security.verifyCaller(request('/api/admin/events'))).errorResponse.status,403);
 for(const options of [{roleOverrides:{'action:events_publish':true},userOverrides:{'page:calendar':false}},{roleOverrides:{'action:events_publish':true,'page:calendar':true},userOverrides:{'action:events_publish':false}},{permissionFailure:true}]){
  const blocked=fixture('Admin',options);const result=await blocked.security.verifyCaller(request('/api/admin/events/'+other+'/archive'));
  assert.equal(result.errorResponse.status,403);assert.match(result.errorResponse.headers.get('cache-control'),/private.*no-store/);assert.deepEqual(blocked.writes,[]);
 }
});
test('each persisted role receives only its default server capabilities, including owner-only administration',async()=>{
 const owners=['Root','Super Root'],admins=[...owners,'Admin'],heads=[...admins,'Head Coach'],staff=[...heads,'Coach','Assistant Coach'];
 const cases=[
  ['/api/admin/classes','GET',staff],['/api/admin/classes','POST',heads],
  ['/api/admin/payments','POST',admins],['/api/admin/create-student','POST',heads],
  ['/api/admin/library-assets','POST',[...heads,'Coach']],
  ['/api/admin/events','POST',heads],['/api/admin/events/'+other+'/publications','POST',admins],
  ['/api/admin/permissions','POST',owners],['/api/admin/export','GET',owners],
 ];
 for(const role of [...staff,'Student'])for(const [path,method,allowed] of cases){
  const check=fixture(role);const req=method==='GET'?new Request('https://portal.example'+path,{headers:{Authorization:bearer}}):request(path);
  const result=await check.security.verifyCaller(req,path.endsWith('/permissions')||path.endsWith('/export')?owners:staff);
  assert.equal(Boolean(result.context),allowed.includes(role),role+' '+method+' '+path);assert.deepEqual(check.writes,[]);
 }
});
test('every non-owner role is stopped before the Auth provider can provision Root identities',async()=>{
 for(const role of ['Admin','Head Coach','Coach','Assistant Coach'])for(const targetRole of ['Root','Super Root']){
  const check=fixture(role,{roleOverrides:{'action:staff_manage':true,'page:staff':true}}),route=check.route('app/api/admin/create-user/route.ts');
  const response=await route.POST(request('/api/admin/create-user',{username:'fixture_account',email:'fixture-new@example.test',password:'Fictional-Password-Only',role:targetRole}));
  assert.equal(response.status,403,role+' cannot provision '+targetRole);assert.deepEqual(check.writes,[],'no temporary identity exists to reconcile');
 }
});
test('Student self-service never accepts staff overrides for cross-account or privileged account changes',async()=>{
 const check=fixture('Student',{userOverrides:{'action:staff_manage':true,'page:staff':true,'page:settings':true}}),route=check.route('app/api/admin/update-user/route.ts');
 for(const [id,data] of [[other,{password:'Fictional-Password-Only'}],[other,{displayName:'Cross-account attempt'}],[actor,{role:'Admin'}],[actor,{isActive:false}]]){
  const response=await route.POST(request('/api/admin/update-user',{id,data}));assert.equal(response.status,403);assert.deepEqual(check.writes,[],'no credential or profile write occurs');
 }
});
