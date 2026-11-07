import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const actor='99000000-0000-4000-8000-000000000003';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server'};
const token=aal=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.fixture';
const privateRow={id:'STU-M-1',english_name:'Fixture student',display_name:'Fixture coach',role:'Coach',is_active:true,email:'finance@example.test',phone:'012345678',telegram_username:'fixture_contact',billing_schedule:[],height_cm:170,medical_notes:'PRIVATE',allergies:'PRIVATE',emergency_contact_phone:'PRIVATE',student_addresses:[{address_line1:'PRIVATE'}],dan_certificate_url:'PRIVATE',password:'PRIVATE'};

function fixture(role,{denied=[],granted=[],rowsByTable={},active=true,aal='aal2',permissionFailure=false,dataFailure=false}={}){
 const reads=[];
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:async name=>{
  assert.equal(name,'portal_take_rate_slot','summary reads must never mutate business records');return {data:true,error:null};
 },from(table){
  const filters={};let columns='';
  const query={select(value){columns=value;return query;},eq(key,value){filters[key]=value;return query;},in(key,value){filters[key]=value;return query;},is(){return query;},order(){return query;},range(start,end){filters.range=[start,end];return query;},abortSignal(){return query;},async single(){return {data:{id:actor,role,is_active:active,must_change_password:false,email:'fixture@example.test'},error:null};},then(resolve,reject){
   reads.push({table,columns,filters});
   if(table==='role_permissions'||table==='user_permissions')return Promise.resolve({data:[...denied.filter(key=>(filters.permission_key||[]).includes(key)).map(permission_key=>({permission_key,is_granted:false})),...granted.filter(key=>(filters.permission_key||[]).includes(key)).map(permission_key=>({permission_key,is_granted:true}))],error:permissionFailure?{code:'08006'}:null}).then(resolve,reject);
   return Promise.resolve({data:rowsByTable[table]||[privateRow],error:dataFailure?{code:'08006'}:null}).then(resolve,reject);
  }};return query;
 }};
 const stubs={'@supabase/supabase-js':{createClient:()=>client},'./env':{env},'@/lib/env':{env}};
 const security=loadTs('lib/backend-security.ts',stubs);
 const route=file=>loadTs(file,{...stubs,'@/lib/backend-security':security});
 const get=(path,file)=>route(file).GET(new Request('https://portal.example'+path,{headers:{Authorization:'Bearer '+token(aal)}}));
 return {reads,get};
}
const studentRoute='app/api/admin/student-summaries/route.ts',staffRoute='app/api/admin/staff-summaries/route.ts';
const accountRoute='app/api/admin/account-summaries/route.ts';
const studentPath='/api/admin/student-summaries?purpose=';

test('non-directory staff student summaries select and return only the fields needed by the permitted module',async()=>{
 const {studentSummaryFields}=loadTs('lib/student-summaries.ts');
 for(const purpose of ['dashboard','attendance','schedule','financials','lms','pos']){
  const check=fixture('Admin',{denied:['page:directory','page:staff']}),response=await check.get(studentPath+purpose,studentRoute);
  assert.equal(response.status,200,purpose);
  assert.match(response.headers.get('cache-control'),/private.*no-store/);
  const body=await response.json(),read=check.reads.find(row=>row.table==='students');
  assert.equal(read.columns,studentSummaryFields(purpose).join(','));
  assert.deepEqual(read.filters.range,[0,99]);
  assert.equal(JSON.stringify(body).includes('PRIVATE'),false,purpose);
  assert.equal(body.data[0].email,purpose==='financials'?privateRow.email:undefined);
  assert.equal(body.data[0].height_cm,purpose==='lms'?170:undefined);
 }
});

test('student summary endpoints reject denied modules, Student overrides, inactive accounts and administrator AAL1 before reading students',async()=>{
 for(const [role,options] of [['Coach',{denied:['page:attendance']}],['Student',{}],['Root',{active:false}],['Admin',{aal:'aal1'}],['Coach',{permissionFailure:true}]]){
  const check=fixture(role,options),response=await check.get(studentPath+'attendance',studentRoute);
  assert.equal(response.status,403,role+JSON.stringify(options));
  assert.equal(check.reads.some(row=>row.table==='students'),false);
 }
});

test('summary query allowlists reject unknown or duplicated inputs without business reads',async()=>{
 for(const query of ['purpose=attendance&purpose=financials','purpose=directory','purpose=attendance&select=*','purpose=attendance&limit=501','purpose=attendance&offset=-1']){
  const check=fixture('Root'),response=await check.get('/api/admin/student-summaries?'+query,studentRoute);
  assert.equal(response.status,422,query);assert.equal(check.reads.some(row=>row.table==='students'),false);
 }
});

test('staff labels exclude student accounts and private staff fields, including when Staff read is denied',async()=>{
 const check=fixture('Coach',{denied:['page:staff']}),response=await check.get('/api/admin/staff-summaries?limit=20&offset=20',staffRoute);
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const body=await response.json(),read=check.reads.find(row=>row.table==='profiles');
 assert.equal(read.columns,'id,display_name,role,is_active');
 assert.equal(read.filters.role.includes('Student'),false);
 assert.deepEqual(read.filters.range,[20,39]);
 assert.deepEqual(body.data,[{id:privateRow.id,display_name:privateRow.display_name,role:'Coach',is_active:true}]);
 assert.equal(check.reads.filter(row=>['role_permissions','user_permissions'].includes(row.table)).length,2,'shared staff purposes must use one grant snapshot');
});

test('staff label reads fail closed for no authorized modules, Student and grant lookup failure',async()=>{
 const {staffSummaryPages}=loadTs('lib/staff-summaries.ts');
 for(const [role,options] of [['Coach',{denied:staffSummaryPages}],['Student',{}],['Coach',{permissionFailure:true}]]){
  const check=fixture(role,options),response=await check.get('/api/admin/staff-summaries',staffRoute);
  assert.equal(response.status,403);assert.equal(check.reads.some(row=>row.table==='profiles'),false);
 }
});

test('Settings-only account management preserves full editor fields and Student links without staff dossier access',async()=>{
 const staff={...privateRow,id:actor,username:'fixture_coach',student_id:null,must_change_password:false};
 const student={...staff,id:'99000000-0000-4000-8000-000000000004',role:'Student',username:'fixture_student',student_id:'STU-M-1'};
 const members=[{...privateRow,id:actor,khmer_name:'Fixture Khmer name',phone:'012345678',profile_picture_path:'/fixture-avatar.png'}];
 const check=fixture('Admin',{denied:['page:staff'],granted:['page:settings','action:staff_manage'],rowsByTable:{profiles:[staff,student],members}});
 const response=await check.get('/api/admin/account-summaries',accountRoute);
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const body=await response.json();
 assert.equal(body.data.length,2);assert.equal(body.data[0].username,'fixture_coach');assert.equal(body.data[0].email,staff.email);
 assert.deepEqual(body.data[0].member_summary,{khmer_name:'Fixture Khmer name',phone:'012345678',profile_picture_path:'/fixture-avatar.png'});
 assert.equal(body.data[1].role,'Student');assert.equal(body.data[1].student_id,'STU-M-1');
 assert.equal(JSON.stringify(body).includes('PRIVATE'),false);
 const reads=check.reads.filter(row=>['profiles','members'].includes(row.table));
 assert.deepEqual(reads.map(row=>row.columns),['id,username,email,display_name,role,is_active,student_id,must_change_password','id,khmer_name,phone,profile_picture_path']);
 assert.equal(reads[0].filters.role,undefined,'account administration includes existing Student identities');
});

test('Settings account data requires both current Settings read and staff management, independently of Staff read',async()=>{
 for(const [role,options] of [['Admin',{denied:['action:staff_manage']}],['Admin',{denied:['page:settings'],granted:['page:staff','action:staff_manage']}],['Student',{granted:['page:settings','action:staff_manage']}],['Admin',{permissionFailure:true}]]){
  const check=fixture(role,options),response=await check.get('/api/admin/account-summaries',accountRoute);
  assert.equal(response.status,403,role+JSON.stringify(options));assert.equal(check.reads.some(row=>['profiles','members'].includes(row.table)),false);
 }
});

test('paginated summary transport preserves permission and session codes to evict stale cached records',async()=>{
 const {fetchApiRows}=loadTs('lib/data-access.ts');
 const oldFetch=global.fetch,oldWindow=global.window;
 global.window={location:{origin:'https://portal.example'}};
 try{
  for(const status of [401,403]){
   global.fetch=async()=>new Response(JSON.stringify({error:{message:'Access changed.'}}),{status});
   await assert.rejects(fetchApiRows('/api/admin/student-summaries?purpose=attendance','fixture'),error=>error.code===String(status));
  }
 }finally{global.fetch=oldFetch;global.window=oldWindow;}
});
