import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase,root,coach} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';
const migration='supabase/migrations/20261101161201_role_permission_boundaries.sql';
const readMigration='supabase/migrations/20261101161209_role_read_privacy_boundaries.sql';
const staffReadMigration='supabase/migrations/20261101162248_staff_member_privacy_boundaries.sql';
const {hasPermission,PERMISSION_DEFINITIONS,permissionDependencies}=loadTs('lib/permissions.ts');
const roles=['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach','Student'];
async function setup(){
 const db=await operationsDatabase();const actors={Root:root,Coach:coach};
 for(const [index,role] of roles.entries()){
  if(actors[role])continue;const id='99000000-0000-4000-8000-'+String(index+20).padStart(12,'0');actors[role]=id;
  await db.query('INSERT INTO auth.users(id,email)VALUES($1,$2)',[id,'fixture-'+index+'@example.test']);
  await db.query('INSERT INTO profiles(id,username,email,display_name,role,student_id)VALUES($1,$2,$3,$4,$5,$6)',[id,'fixture_role_'+index,'fixture-'+index+'@example.test','Fixture '+role,role,role==='Student'?'STU-M-001':null]);
 }
 await db.query("UPDATE students SET profile_id=$1 WHERE id='STU-M-001'",[actors.Student]);
 await db.exec(fs.readFileSync(migration,'utf8'));return {db,actors};
}
async function readSetup(){
 const context=await setup();const {db}=context;
 await db.exec(`INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time)VALUES(501,1,'Fixture lesson','Sunday',ARRAY['Sunday'],'09:00','10:30');
 INSERT INTO products(id,sku,name,category_name,price_usd,cost_usd,is_active,allow_student_orders)VALUES('99000000-0000-4000-8000-000000000501','FIXTURE-P','Fixture product','Uniform',25,10,true,true);
 INSERT INTO product_variants(product_id,sku,size)VALUES('99000000-0000-4000-8000-000000000501','FIXTURE-V','M');
 INSERT INTO library_assets(title,library_type)VALUES('Fixture lesson material','Taekwondo');
 INSERT INTO workout_templates(title,structure)VALUES('Fixture training','[]');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261028115518_student_portal_data_api_boundary.sql','utf8'));
 await db.exec(fs.readFileSync(readMigration,'utf8'));
 await db.exec(fs.readFileSync(staffReadMigration,'utf8'));return context;
}
async function overridePages(db,user,allowed=[]){
 await db.exec('RESET ROLE');
 const pages=['dashboard','directory','attendance','schedule','financials','lms','pos','staff','settings','library','partners','calendar'];
 for(const page of pages)await db.query('INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,$2,$3)ON CONFLICT(user_id,permission_key)DO UPDATE SET is_granted=EXCLUDED.is_granted',[user,'page:'+page,allowed.includes(page)]);
}
async function sqlPermission(db,user,key){return(await db.query('SELECT portal_permission_allowed($1,$2) allowed',[user,key])).rows[0].allowed;}
async function roleContext(db,user,aal='aal2'){
 await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.sub',$1,false),set_config('request.jwt.role','authenticated',false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({aal})]);await db.exec('SET ROLE authenticated');
}
test('database and central permission model agree for all seven roles, canonical actions, legacy aliases and factory fallback',async()=>{
 const {db,actors}=await setup();try{
  const rows=(await db.query('SELECT role,permission_key,is_granted FROM role_permissions')).rows;
  const overrides=Object.fromEntries(rows.map(row=>[row.role+':'+row.permission_key,row.is_granted]));
  const keys=[...new Set([...PERMISSION_DEFINITIONS.map(row=>row.key),'manage:users','manage:students','manage:finances','manage:pos','manage:curriculum','manage:branches','manage:schedule','view:financials','view:pos','view:analytics','mark:attendance','grade:evaluations','view:own_dossier'])];
  for(const role of roles)for(const key of keys)assert.equal(await sqlPermission(db,actors[role],key),hasPermission(role,key,overrides,actors[role],{}),role+' '+key+' '+permissionDependencies(key).join(','));
  assert.equal(await sqlPermission(db,actors.Admin,'action:events_publish'),true,'an absent database row inherits the same documented factory default');
  assert.equal((await db.query("SELECT count(*)::int n FROM role_permissions WHERE role='Admin' AND permission_key='action:events_publish'")).rows[0].n,0,'fallback does not create a stored grant');
 }finally{await db.close();}
});
test('canonical and page denials survive legacy grants, direct browser writes and service actor assertions',async()=>{
 const {db,actors}=await setup();try{
  await db.query("INSERT INTO role_permissions(role,permission_key,is_granted)VALUES('Admin','manage:users',true),('Admin','action:staff_manage',false) ON CONFLICT(role,permission_key) DO UPDATE SET is_granted=EXCLUDED.is_granted");
  assert.equal(await sqlPermission(db,actors.Admin,'manage:users'),false);
  await assert.rejects(db.query("SELECT portal_operations_mutate($1,'policy',$2,$3)",[actors.Admin,{reminderLeadDays:7,lateGraceDays:3},'99000000-0000-4000-8000-000000000099']),/Permission denied/,'read-only settings access cannot change the academy billing policy');
  await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,'page:directory',false),($1,'action:student_edit',true),($1,'page:financials',false),($1,'action:finance_record_payment',true)",[actors.Admin]);
  assert.equal(await sqlPermission(db,actors.Admin,'action:student_edit'),false);assert.equal(await sqlPermission(db,actors.Admin,'manage:students'),false);
  await assert.rejects(db.query("SELECT portal_assert_actor($1,'action:finance_record_payment')",[actors.Admin]),/Permission denied/);
  await roleContext(db,actors.Admin);
  assert.equal((await db.query("SELECT portal_has_permission('action:student_edit') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("UPDATE students SET english_name='Unauthorized fixture update' WHERE id='STU-M-001' RETURNING id")).rows.length,0,'UPDATE RLS cannot be bypassed with a legacy grant');
  await assert.rejects(db.query('UPDATE profiles SET display_name=$1 WHERE id=$2',['Unauthorized fixture profile',coach]),/permission denied/);
  await assert.rejects(db.query('SELECT portal_permission_allowed($1,$2)',[root,'action:staff_manage']),/permission denied/,'private explicit-actor helper is not a browser RPC');
  await roleContext(db,root,'aal1');
  await assert.rejects(db.query("INSERT INTO attendance(student_id,date,status,marked_by)VALUES('STU-M-001','2026-11-01','Present',$1)",[root]),/row-level security/,'MFA applies before browser attendance writes too');
  await roleContext(db,root,'aal2');assert.equal((await db.query("SELECT portal_has_permission('action:attendance_mark') allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
test('misconfigured Student staff grants never become cross-account authority, while safe self-service remains available',async()=>{
 const {db,actors}=await setup();try{
  await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,'page:staff',true),($1,'page:settings',true),($1,'action:staff_manage',true),($1,'manage:users',true)",[actors.Student]);
  assert.equal(await sqlPermission(db,actors.Student,'action:staff_manage'),false);assert.equal(await sqlPermission(db,actors.Student,'manage:users'),false);
  await assert.rejects(db.query("SELECT portal_assert_actor($1,'action:staff_manage')",[actors.Student]),/Staff access required/);
  await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,'page:dashboard',true)",[actors.Student]);
  await assert.rejects(db.query("SELECT portal_assert_actor($1,'page:dashboard')",[actors.Student]),/Staff access required/,'even read-key based staff mutations retain the Student boundary');
  await assert.rejects(db.query("SELECT portal_update_user($1,$2,'{\"display_name\":\"Cross-account attempt\"}','{}',NULL)",[actors.Student,coach]),/Permission denied/);
  await assert.rejects(db.query("SELECT portal_update_user($1,$1,'{\"role\":\"Admin\"}','{}',NULL)",[actors.Student]),/Protected profile field/);
  await db.query("SELECT portal_update_user($1,$1,'{\"display_name\":\"Fixture self-service\"}','{}',NULL)",[actors.Student]);
  assert.equal((await db.query('SELECT display_name FROM profiles WHERE id=$1',[actors.Student])).rows[0].display_name,'Fixture self-service');
 }finally{await db.close();}
});

test('finance-only browser cannot query private directory/staff records or POS costs despite broad legacy policies',async()=>{
 const {db,actors}=await readSetup();try{
  await overridePages(db,actors.Admin,['financials']);
  await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT medical_notes,allergies,emergency_contact_phone FROM students')).rows.length,0);
  assert.deepEqual((await db.query('SELECT id FROM profiles')).rows.map(row=>row.id),[actors.Admin],'own bootstrap remains readable without all staff records');
  assert.equal((await db.query('SELECT cost_usd FROM products')).rows.length,0,'student-order availability is not a staff POS permission');
  assert.equal((await db.query('SELECT stock FROM product_variants')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM library_assets')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM workout_templates')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM class_sessions')).rows.length,1,'finance retains its shared class lookup');
  await overridePages(db,actors.Admin,['directory']);await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT medical_notes FROM students')).rows.length,2,'Directory permission restores the intentional full-record boundary');
  assert.equal((await db.query('SELECT * FROM library_assets')).rows.length,1,'dossier training material remains available');
  assert.equal((await db.query('SELECT * FROM workout_templates')).rows.length,1);
  assert.equal((await db.query('SELECT id FROM profiles')).rows.length,1,'Directory does not imply Staff access');
  await overridePages(db,actors.Admin,['staff']);await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT id FROM profiles')).rows.length,roles.length,'Staff read restores staff-directory rows');
 }finally{await db.close();}
});

test('shared resources require an actual supported page and deny direct requests after permission revocation',async()=>{
 const {db,actors}=await readSetup();try{
  await overridePages(db,actors.Admin);await roleContext(db,actors.Admin);
  for(const table of ['students','products','product_variants','library_assets','workout_templates','class_sessions'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0,table+' denied without a purpose');
  for(const page of ['dashboard','attendance','schedule','directory','financials','lms','pos']){
   await overridePages(db,actors.Admin,[page]);await roleContext(db,actors.Admin);
   assert.equal((await db.query('SELECT id FROM class_sessions')).rows.length,1,page+' needs class labels');
  }
  for(const page of ['library','lms']){
   await overridePages(db,actors.Admin,[page]);await roleContext(db,actors.Admin);
   assert.equal((await db.query('SELECT id FROM library_assets')).rows.length,1,page+' lesson catalog');
   assert.equal((await db.query('SELECT id FROM workout_templates')).rows.length,1,page+' training templates');
  }
  await overridePages(db,actors.Admin,['pos']);await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT cost_usd FROM products')).rows.length,1);
  assert.equal((await db.query('SELECT stock FROM product_variants')).rows.length,1);
  await overridePages(db,actors.Admin);await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT cost_usd FROM products')).rows.length,0,'revocation affects the next direct query');
 }finally{await db.close();}
});

test('read fences preserve MFA bootstrap while blocking lower-assurance data reads and Student discretionary grants',async()=>{
 const {db,actors}=await readSetup();try{
  await roleContext(db,root,'aal1');
  assert.deepEqual((await db.query('SELECT id FROM profiles')).rows.map(row=>row.id),[root]);
  for(const table of ['students','products','product_variants','library_assets','workout_templates','class_sessions'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0,table+' requires completed administrator MFA');
  await overridePages(db,actors.Student,['directory','staff','pos','lms','schedule']);await roleContext(db,actors.Student);
  for(const table of ['students','profiles','products','product_variants','library_assets','workout_templates','class_sessions'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0,table+' retains the separate student server boundary');
  await roleContext(db,root,'aal2');assert.equal((await db.query('SELECT id FROM students')).rows.length,2,'Root remains authorized with MFA');
 }finally{await db.close();}
});

test('Settings-only account manager cannot read private member fields or certificate history; Staff and own member access remain valid',async()=>{
 const {db,actors}=await readSetup();try{
  await db.query("INSERT INTO members(id,english_name,medical_notes,emergency_contact_phone)VALUES($1,'Fixture manager','Private own medical','010000001'),($2,'Fixture staff','Private other medical','010000002')ON CONFLICT(id)DO UPDATE SET english_name=EXCLUDED.english_name,medical_notes=EXCLUDED.medical_notes,emergency_contact_phone=EXCLUDED.emergency_contact_phone",[actors.Admin,coach]);
  await db.query("INSERT INTO member_addresses(member_id,address_line1,district_commune,state_province_city,postal_code)VALUES($1,'Own private address','Fixture district','Fixture city','12000'),($2,'Other private address','Fixture district','Fixture city','12000')",[actors.Admin,coach]);
  await db.query("INSERT INTO staff_dan_history(user_id,dan_level,issue_date,certificate_url)VALUES($1,1,'2026-01-01','https://example.test/private-certificate')",[coach]);
  await overridePages(db,actors.Admin,['settings']);
  await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,'action:staff_manage',true)ON CONFLICT(user_id,permission_key)DO UPDATE SET is_granted=true",[actors.Admin]);
  await roleContext(db,actors.Admin);
  assert.equal((await db.query("SELECT portal_has_permission('action:staff_manage') allowed")).rows[0].allowed,true,'Settings remains an intentional account-management parent');
  assert.deepEqual((await db.query('SELECT id FROM members')).rows.map(row=>row.id),[actors.Admin],'management does not imply full other-member reads');
  assert.deepEqual((await db.query('SELECT member_id FROM member_addresses')).rows.map(row=>row.member_id),[actors.Admin]);
  assert.equal((await db.query('SELECT medical_notes,emergency_contact_phone FROM members WHERE id=$1',[coach])).rows.length,0);
  assert.equal((await db.query('SELECT address_line1 FROM member_addresses WHERE member_id=$1',[coach])).rows.length,0);
  assert.equal((await db.query('SELECT certificate_url FROM staff_dan_history')).rows.length,0,'Settings account authority does not open certificate history');
  await overridePages(db,actors.Admin,['staff']);await roleContext(db,actors.Admin);
  assert.equal((await db.query('SELECT id FROM members WHERE id IN($1,$2)',[actors.Admin,coach])).rows.length,2,'Staff readers retain the full member directory');
  assert.equal((await db.query('SELECT member_id FROM member_addresses')).rows.length,2);
  assert.equal((await db.query('SELECT certificate_url FROM staff_dan_history')).rows.length,1,'Staff reader retains certificate-history access');
  await roleContext(db,actors.Admin,'aal1');
  assert.equal((await db.query('SELECT id FROM members')).rows.length,0,'lower-assurance manager cannot read personal member fields');
  assert.equal((await db.query('SELECT member_id FROM member_addresses')).rows.length,0);
  assert.equal((await db.query('SELECT certificate_url FROM staff_dan_history')).rows.length,0);
 }finally{await db.close();}
});
