import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const admin='00000000-0000-0000-0000-000000000001';
const student='00000000-0000-0000-0000-000000000002';
const product='10000000-0000-0000-0000-000000000001';
const variant='20000000-0000-0000-0000-000000000001';
const key='30000000-0000-0000-0000-000000000001';
test('isolated database: migration, permissions, transactions and failure recovery', async (t) => {
 const db=new PGlite();
 try {
 await db.exec(fs.readFileSync('tests/fixtures/installed-schema.sql','utf8'));
 // The shared account guard can be repaired without running workflow migrations.
 const profileRepair=fs.readFileSync('supabase/profile-security-repair-20261011.sql','utf8');
 await db.exec(profileRepair);
 await db.exec("INSERT INTO profiles(id,username,email,display_name,role,is_active,must_change_password) VALUES('00000000-0000-0000-0000-000000000998','security-repair','repair@example.test','Repair','Admin',true,true)");
 await db.exec(profileRepair);
 assert.equal((await db.query("SELECT must_change_password FROM profiles WHERE username='security-repair'")).rows[0].must_change_password,true,'repair never clears an existing password change requirement');
 await db.exec("DELETE FROM profiles WHERE username='security-repair'");
 // Login can be repaired independently and repeatedly before the full upgrade.
 const loginRepair=fs.readFileSync('supabase/login-repair-20261011.sql','utf8');
 await db.exec(loginRepair);
 await db.exec(loginRepair);
 await db.exec("SET ROLE authenticated");
 await assert.rejects(db.query("SELECT public.portal_take_rate_slot('repair-check',2,60)"), /permission denied/);
 await assert.rejects(db.query("SELECT * FROM public.portal_rate_limits"), /permission denied/);
 await db.exec("RESET ROLE; SELECT set_config('request.jwt.role','service_role',false); SET ROLE service_role");
 for (const expected of [true,true,false]) {
   assert.equal((await db.query("SELECT public.portal_take_rate_slot('repair-check',2,60) AS allowed")).rows[0].allowed,expected);
 }
 await db.exec("RESET ROLE; SELECT set_config('request.jwt.role','anon',false)");
 // Exercise type-aware SQL with an enum as used by installed library schemas.
 await db.exec("CREATE TYPE library_kind AS ENUM ('Taekwondo','Fitness'); ALTER TABLE library_assets ALTER COLUMN library_type TYPE library_kind USING library_type::library_kind");
 await db.exec("INSERT INTO profiles(id,username,email,display_name,role,is_active) VALUES('00000000-0000-0000-0000-000000000999','preflight','preflight@example.test','Preflight','Root',true)");
 await db.exec(fs.readFileSync('supabase/preflight-20261009.sql','utf8'));
 await db.exec("DELETE FROM profiles WHERE username='preflight'");
 await db.exec(`INSERT INTO partners(name,partner_type,secondary_contacts) VALUES('Legacy contacts','MOU','[{"name":"Contact","phone":"012345678"}]')`);
 await db.exec(fs.readFileSync('supabase/production-upgrade-20261009.sql','utf8'));
 const legacyContact=(await db.query("SELECT secondary_contact_name,secondary_contact_phone FROM partners WHERE name='Legacy contacts'")).rows[0];
 assert.equal(legacyContact.secondary_contact_name,'Contact');
 assert.equal(legacyContact.secondary_contact_phone,'012345678');
 const postflight=await db.exec(fs.readFileSync('supabase/postflight-20261009.sql','utf8'));
 assert.deepEqual(postflight[0].rows,[],'no client-executable private mutators');
 assert.equal(postflight[1].rows.length,0,'all protected tables have RLS');
 assert.ok(Object.values(postflight[2].rows[0]).every(Boolean),'all documented RPC signatures exist');
 assert.equal(postflight[3].rows.length,1,'class occurrence constraint exists');
 await db.exec(`SELECT set_config('request.jwt.role','service_role',false);
 INSERT INTO scholarships(id,type_name,discount_percentage) VALUES(1,'Early Group Student',0);
 INSERT INTO academy_profile(id) VALUES('default');
 INSERT INTO profiles(id,username,email,display_name,role,is_active) VALUES('${admin}','admin','admin@example.test','Admin','Admin',true),('${student}','student','student@example.test','Student','Student',true);
 INSERT INTO students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,current_belt,student_status,home_branch_id,profile_id) VALUES('STU-001','','Student','Male','2010-01-01','2026-01-01',1,'White','Active',1,'${student}');
 UPDATE profiles SET student_id='STU-001' WHERE id='${student}';
 INSERT INTO products(id,sku,name,category_name,price_usd,stock,has_variants) VALUES('${product}','DOBOK','Uniform','Uniform',25,3,true);
 INSERT INTO product_variants(id,product_id,sku,size,stock,price_override) VALUES('${variant}','${product}','DOBOK-M','M',3,30);`);
 const order={studentId:'STU-001',customerName:'Student',customerPhone:'123',paymentMethod:'Cash',items:[{productId:product,variantId:variant,qty:2,price:0}]};
 const place=async(actor,channel,payload,request=key)=>(await db.query('SELECT portal_place_order($1,$2,$3,$4) AS result',[actor,channel,JSON.stringify(payload),request])).rows[0].result;
 const result=await place(student,'STUDENT_PORTAL',order);
 assert.equal(Number(result.total_usd),60,'catalog variant price, not client price');
 assert.equal((await db.query('SELECT stock FROM product_variants')).rows[0].stock,1);
 assert.equal((await place(student,'STUDENT_PORTAL',order)).order_id,result.order_id,'same request must return same order');
 await assert.rejects(place(student,'STUDENT_PORTAL',{...order,customerName:'Changed'}),/Idempotency/);
 await assert.rejects(place(student,'STUDENT_PORTAL',order,'30000000-0000-0000-0000-000000000002'),/Insufficient stock/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM pos_orders')).rows[0].n,1,'failed order rolled back');
 await assert.rejects(place(student,'ADMIN_POS',order),/Permission denied/);
 await assert.rejects(db.query('SELECT portal_update_order($1,$2,$3,$4)',[admin,result.order_id,'COMPLETED','PENDING']),/transition/);
 await db.query('SELECT portal_update_order($1,$2,$3,$4)',[admin,result.order_id,'CONFIRMED','PAID']);
 await db.query('SELECT portal_cancel_order($1,$2,$3)',[admin,result.order_id,'Requested cancellation']);
 assert.equal((await db.query('SELECT stock FROM product_variants')).rows[0].stock,3);
 assert.equal((await db.query('SELECT payment_status FROM pos_orders')).rows[0].payment_status,'REFUND_PENDING');
 await db.query('SELECT portal_cancel_order($1,$2,$3)',[admin,result.order_id,'Repeated cancellation']);
 assert.equal((await db.query('SELECT stock FROM product_variants')).rows[0].stock,3,'cancel twice must restore once');
 await assert.rejects(db.query('SELECT portal_update_order($1,$2,$3,$4)',[admin,result.order_id,'CONFIRMED','PAID']),/final/);
 await db.exec(`SELECT set_config('request.jwt.sub','${admin}',false); SELECT set_config('request.jwt.role','authenticated',false);`);
 assert.equal((await db.query("SELECT portal_has_permission('action:finance_record_payment') AS allowed")).rows[0].allowed,true);
 await db.exec(`UPDATE profiles SET is_active=false WHERE id='${admin}'`);
 assert.equal((await db.query("SELECT portal_has_permission('action:finance_record_payment') AS allowed")).rows[0].allowed,false,'suspension is immediate');
 await db.exec(`UPDATE profiles SET is_active=true WHERE id='${admin}'; SELECT set_config('request.jwt.role','service_role',false);`);
 const payment=await db.query('SELECT portal_record_payments($1,$2,$3,$4,$5) AS result',[admin,'STU-001',JSON.stringify([{year:2026,month:'Oct',amount:25}]),'Cash',key]);
 assert.equal(payment.rows[0].result.length,1);
 await db.query('SELECT portal_record_payments($1,$2,$3,$4,$5)',[admin,'STU-001',JSON.stringify([{year:2026,month:'Oct',amount:25}]),'Cash',key]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM payment_transactions')).rows[0].n,1);
 await assert.rejects(db.query('SELECT portal_record_payments($1,$2,$3,$4,$5)',[admin,'STU-001',JSON.stringify([{year:2026,month:'Nov',amount:25},{year:2026,month:'Oct',amount:25}]),'Cash','30000000-0000-0000-0000-000000000003']),/already settled/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,1,'bulk payment rolls back all allocations');
 await t.test('full tuition, historical arrears, and immutable payments',async()=>{
   await assert.rejects(db.query('SELECT portal_record_payments($1,$2,$3,$4,$5)',[admin,'STU-001',JSON.stringify([{year:2026,month:'Nov',amount:1}]),'Cash','30000000-0000-0000-0000-000000000009']),/Full monthly tuition/);
   await assert.rejects(db.query('SELECT portal_record_payments($1,$2,$3,$4,$5)',[admin,'STU-001',JSON.stringify([{year:2025,month:'Dec',amount:25}]),'Cash','30000000-0000-0000-0000-000000000008']),/precedes enrollment/);
   await assert.rejects(db.exec('UPDATE payment_transactions SET amount_usd=1'),/immutable/);
 });
 await t.test('verified refunds restore inventory only once',async()=>{
   await assert.rejects(db.query('SELECT portal_refund_order($1,$2,$3,$4,$5)',[admin,result.order_id,'','Reviewed refund',true]),/reference/);
   await db.query('SELECT portal_refund_order($1,$2,$3,$4,$5)',[admin,result.order_id,'BANK-0001','Reviewed refund',true]);
   await db.query('SELECT portal_refund_order($1,$2,$3,$4,$5)',[admin,result.order_id,'BANK-0001','Reviewed refund',true]);
   assert.equal((await db.query('SELECT stock FROM product_variants')).rows[0].stock,3);
   assert.equal((await db.query('SELECT payment_status FROM pos_orders')).rows[0].payment_status,'REFUNDED');
 });
 await t.test('catalog editing preserves variants and rolls back invalid removals',async()=>{
   await db.query('SELECT portal_save_product($1,$2)',[admin,JSON.stringify({action:'UPDATE_PRODUCT',productId:product,name:'Updated Uniform',variants:[{id:variant,sku:'DOBOK-M',size:'M',stock:3,priceOverride:30}]})]);
   assert.equal((await db.query('SELECT id FROM product_variants')).rows[0].id,variant);
   await assert.rejects(db.query('SELECT portal_save_product($1,$2)',[admin,JSON.stringify({action:'UPDATE_PRODUCT',productId:product,name:'Must rollback',variants:[]})]),/Cannot remove/);
   assert.equal((await db.query('SELECT name FROM products')).rows[0].name,'Updated Uniform');
 });
 await t.test('household save is persistent and atomic on invalid student links',async()=>{
   const household=(await db.query('SELECT portal_save_household($1,$2) AS result',[admin,JSON.stringify({guardianName:'Parent',guardianPhone:'012345678',studentIds:['STU-001']})])).rows[0].result.id;
   await assert.rejects(db.query('SELECT portal_save_household($1,$2)',[admin,JSON.stringify({id:household,guardianName:'Must rollback',guardianPhone:'012345678',studentIds:['MISSING']})]),/foreign key/);
   assert.equal((await db.query('SELECT guardian_name FROM households')).rows[0].guardian_name,'Parent');
   assert.equal((await db.query('SELECT student_id FROM household_students')).rows[0].student_id,'STU-001');
 });
 await t.test('Root authority and profile/member changes remain consistent',async()=>{
   const root='00000000-0000-0000-0000-000000000003';
   await db.exec(`INSERT INTO profiles(id,username,email,display_name,role,is_active) VALUES('${root}','root','root@example.test','Root','Root',true); UPDATE members SET khmer_name='',english_name='Root',gender='Male',dob='1980-01-01' WHERE id='${root}'`);
   await assert.rejects(db.query('SELECT portal_update_user($1,$2,$3,$4,$5)',[admin,root,JSON.stringify({role:'Admin'}),'{}',null]),/Root authority/);
   await assert.rejects(db.query('SELECT portal_update_user($1,$2,$3,$4,$5)',[root,root,JSON.stringify({is_active:false}),'{}',null]),/active Root/);
   await assert.rejects(db.query('SELECT portal_update_user($1,$2,$3,$4,$5)',[root,root,JSON.stringify({display_name:'Must rollback'}),JSON.stringify({phone:'Bad'}),JSON.stringify({address_line1:'123 Academy'})]),/not-null/);
   assert.equal((await db.query('SELECT display_name FROM profiles WHERE id=$1',[root])).rows[0].display_name,'Root');
   await db.query('SELECT portal_update_user($1,$2,$3,$4,$5)',[root,root,JSON.stringify({display_name:'Updated Root'}),JSON.stringify({phone:'012345678'}),JSON.stringify({address_line1:'123 Academy',district_commune:'Sen Sok',state_province_city:'Phnom Penh',postal_code:'12000',country:'Cambodia'})]);
   assert.equal((await db.query('SELECT phone FROM members WHERE id=$1',[root])).rows[0].phone,'012345678');
   assert.equal((await db.query('SELECT address_line1 FROM member_addresses')).rows[0].address_line1,'123 Academy');
   await assert.rejects(db.query('SELECT portal_archive_user($1,$2)',[root,root]),/own account/);
   await db.exec(`UPDATE profiles SET must_change_password=true WHERE id='${admin}'; SELECT set_config('request.jwt.sub','${admin}',false)`);
   assert.equal((await db.query("SELECT portal_has_permission('page:financials') AS allowed")).rows[0].allowed,false);
   await assert.rejects(db.query('SELECT portal_save_product($1,$2)',[admin,JSON.stringify({action:'DELETE_PRODUCT',productId:product})]),/Inactive or missing account/);
   await db.exec(`UPDATE profiles SET must_change_password=false WHERE id='${admin}'`);
 });
 await t.test('shared rate limits cannot be bypassed by another API instance',async()=>{
   for(let i=0;i<2;i++)assert.equal((await db.query('SELECT portal_take_rate_slot($1,$2,$3) AS allowed',['login:test',2,60])).rows[0].allowed,true);
   assert.equal((await db.query('SELECT portal_take_rate_slot($1,$2,$3) AS allowed',['login:test',2,60])).rows[0].allowed,false);
 });
 await t.test('provisioning handles signup profiles and rolls back incomplete setup',async()=>{
   const id='00000000-0000-0000-0000-000000000004';
   await db.exec(`INSERT INTO profiles(id,username,email,display_name,role,is_active) VALUES('${id}','signup','staff@example.test','Signup','Student',false)`);
   const profile={id,username:'newcoach',email:'staff@example.test',display_name:'New coach',role:'Coach',is_active:true,student_id:null};
   await assert.rejects(db.query('SELECT portal_provision_user($1,$2,$3,$4)',[admin,JSON.stringify({...profile,role:'Root'}),'{}',null]),/Root role/);
   await assert.rejects(db.query('SELECT portal_provision_user($1,$2,$3,$4)',[admin,JSON.stringify({...profile,student_id:'STU-001'}),'{}',null]),/Only Student/);
   await assert.rejects(db.query('SELECT portal_provision_user($1,$2,$3,$4)',[admin,JSON.stringify(profile),'{}',JSON.stringify({line1:'Academy'})]),/not-null/);
   assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1',[id])).rows[0].role,'Student');
   assert.equal((await db.query('SELECT count(*)::int AS n FROM members WHERE id=$1',[id])).rows[0].n,0);
   await db.query('SELECT portal_provision_user($1,$2,$3,$4)',[admin,JSON.stringify(profile),'{}',null]);
   assert.equal((await db.query('SELECT must_change_password FROM profiles WHERE id=$1',[id])).rows[0].must_change_password,true);
   await db.exec(`SELECT set_config('request.jwt.sub','${id}',false)`);
   assert.equal((await db.query('SELECT is_dojo_staff() AS allowed')).rows[0].allowed,false);
   await db.exec(`SELECT set_config('request.jwt.sub','${admin}',false)`);
 });
 await t.test('Student RLS uses explicit links and denies suspended or forced-password accounts',async()=>{
   const selectStudent=async()=>{
     await db.exec(`SELECT set_config('request.jwt.sub','${student}',false); SELECT set_config('request.jwt.role','authenticated',false); SET ROLE authenticated`);
     return db.query("SELECT id FROM students");
   };
   try {
     assert.equal((await selectStudent()).rows.length,1);
     assert.equal((await db.query("SELECT is_current_student('STU-001'::varchar) AS allowed")).rows[0].allowed,true);
     assert.equal((await db.query("SELECT is_current_student('NOT-OWNED'::text) AS allowed")).rows[0].allowed,false);
     await db.exec(`RESET ROLE; SELECT set_config('request.jwt.role','service_role',false); UPDATE profiles SET must_change_password=true WHERE id='${student}'`);
     assert.equal((await selectStudent()).rows.length,0);
     assert.equal((await db.query("SELECT is_current_student('STU-001'::varchar) AS allowed")).rows[0].allowed,false);
     await db.exec(`RESET ROLE; SELECT set_config('request.jwt.role','service_role',false); UPDATE profiles SET must_change_password=false,is_active=false WHERE id='${student}'`);
     assert.equal((await selectStudent()).rows.length,0);
   } finally {
     await db.exec(`RESET ROLE; SELECT set_config('request.jwt.role','service_role',false); UPDATE profiles SET is_active=true,must_change_password=false WHERE id='${student}'; SELECT set_config('request.jwt.sub','${admin}',false)`);
   }
 });
 await t.test('permission override batches require Root and roll back together',async()=>{
   const root='00000000-0000-0000-0000-000000000003';
   await assert.rejects(db.query('SELECT portal_set_user_permissions($1,$2,$3)',[admin,student,JSON.stringify([{permissionKey:'page:financials',isGranted:true}])]),/Root authority/);
   await assert.rejects(db.query('SELECT portal_set_user_permissions($1,$2,$3)',[root,student,JSON.stringify([{permissionKey:'page:financials',isGranted:true},{permissionKey:'UNKNOWN',isGranted:true}])]),/Unknown permission/);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM user_permissions WHERE user_id=$1',[student])).rows[0].n,0);
   await db.query('SELECT portal_set_user_permissions($1,$2,$3)',[root,student,JSON.stringify([{permissionKey:'page:financials',isGranted:true}])]);
   await db.query('SELECT portal_set_user_permissions($1,$2,$3)',[root,student,JSON.stringify([{permissionKey:'page:financials',isGranted:null}])]);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM user_permissions WHERE user_id=$1',[student])).rows[0].n,0);
 });
 await t.test('promotions and voids update the belt atomically and preserve a migrated starting rank',async()=>{
   await db.exec("UPDATE students SET current_belt='Yellow' WHERE id='STU-001'; INSERT INTO belt_histories(student_id,belt_level,promotion_date) VALUES('STU-001','Green','2026-09-01')");
   assert.equal((await db.query("SELECT current_belt FROM students WHERE id='STU-001'")).rows[0].current_belt,'Green');
   await db.exec("DELETE FROM belt_histories WHERE student_id='STU-001'");
   assert.equal((await db.query("SELECT current_belt FROM students WHERE id='STU-001'")).rows[0].current_belt,'Yellow');
 });
 await db.exec(`INSERT INTO class_sessions(branch_id,class_name,day_of_week,start_time,end_time,days_of_week,capacity) VALUES(1,'Full','Monday','10:00','11:00',ARRAY['Monday'],0);`);
 const st={khmer_name:'',english_name:'New student',gender:'Male',dob:'2011-01-01',registration_date:'2026-10-09',scholarship_id:1,home_branch_id:1,current_belt:'White',student_status:'Active'};
 await assert.rejects(db.query('SELECT portal_create_student($1,$2,$3,$4)',[admin,JSON.stringify(st),null,1]),/capacity/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM students')).rows[0].n,1,'full class must not leave an orphan student');
 await t.test('class attendance is independent and roster creation preserves check-ins',async()=>{
   await db.exec(`INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,start_time,end_time,days_of_week,capacity) VALUES(2,1,'Morning','Friday','10:00','11:00',ARRAY['Friday'],10),(3,1,'Afternoon','Friday','14:00','15:00',ARRAY['Friday'],10);
   INSERT INTO attendance(student_id,date,class_id,status,marked_by) VALUES('STU-001','2026-10-09',2,'Present','${admin}'),('STU-001','2026-10-09',3,'Absent','${admin}');
   INSERT INTO attendance(student_id,date,class_id,status,marked_by) VALUES('STU-001','2026-10-09',2,'Absent','${admin}') ON CONFLICT(student_id,date,class_id) DO NOTHING;`);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance')).rows[0].n,2);
   assert.equal((await db.query('SELECT status FROM attendance WHERE class_id=2')).rows[0].status,'Present');
   await db.exec("DELETE FROM attendance WHERE date='2026-10-09' AND class_id=3");
   assert.equal((await db.query('SELECT class_id FROM attendance')).rows[0].class_id,2);
 });
 await t.test('class edits and reactivation cannot bypass capacity or schedule validation',async()=>{
   await db.exec("INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-001',2,'2026-01-01'); UPDATE class_sessions SET capacity=1 WHERE id=2");
   await assert.rejects(db.exec('UPDATE class_sessions SET capacity=0 WHERE id=2'),/active enrollment/);
   await assert.rejects(db.exec("UPDATE class_sessions SET end_time='09:00' WHERE id=2"),/class times/);
   await db.exec("INSERT INTO students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,current_belt,student_status,home_branch_id) VALUES('STU-002','','Paused student','Female','2010-01-01','2026-01-01',1,'White','Inactive',1); INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-002',2,'2026-01-01')");
   await assert.rejects(db.exec("UPDATE students SET student_status='Active' WHERE id='STU-002'"),/Reactivation would exceed/);
   await assert.rejects(db.exec("INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-002',2,'2026-01-01')"),/already enrolled/);
   assert.equal((await db.query("SELECT student_status FROM students WHERE id='STU-002'")).rows[0].student_status,'Inactive');
 });
 await t.test('MOU expiry cannot precede its signing date',async()=>{
   await assert.rejects(db.exec("INSERT INTO partners(name,partner_type,mou_signed_date,mou_expiry_date) VALUES('Invalid agreement','MOU','2026-10-10','2026-10-09')"),/portal_partner_dates/);
 });


 await t.test('student profile and enrollment edits commit together and never change login email',async()=>{
  const edit=async(changes,enrollment,date)=>db.query('SELECT portal_update_student_with_enrollment($1,$2,$3,$4,$5,$6)',[admin,'STU-001',JSON.stringify(changes),null,enrollment,date]);
  await assert.rejects(edit({phone:'Must rollback'},999,'2026-09-01'),/enrollment not found/);
  assert.notEqual((await db.query("SELECT phone FROM students WHERE id='STU-001'")).rows[0].phone,'Must rollback');
  const enrollment=(await db.query("SELECT id FROM class_enrollments WHERE student_id='STU-001' AND class_id=2")).rows[0].id;
  await edit({phone:'012345678',email:'contact@example.test'},Number(enrollment),'2026-01-02');
  assert.equal((await db.query('SELECT enrollment_date::date::text AS enrollment_date FROM class_enrollments WHERE id=$1',[enrollment])).rows[0].enrollment_date,'2026-01-02');
  assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1',[student])).rows[0].email,'student@example.test');
  await assert.rejects(edit({phone:'Must rollback'},Number(enrollment),'2200-01-01'),/Invalid enrollment date/);
  assert.equal((await db.query("SELECT phone FROM students WHERE id='STU-001'")).rows[0].phone,'012345678');
 });
 await t.test('class deletion protects history and rolls back enrollment removal on a later failure',async()=>{
  await assert.rejects(db.query('SELECT portal_delete_class($1,$2)',[admin,2]),/attendance history/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM class_enrollments WHERE class_id=2')).rows[0].n,2);
  await assert.rejects(db.query('SELECT portal_delete_class($1,$2)',[admin,999]),/Class not found/);
  await db.exec("INSERT INTO class_enrollments(student_id,class_id) VALUES('STU-001',3); CREATE FUNCTION test_class_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated class delete failure'; END $$; CREATE TRIGGER test_class_failure BEFORE DELETE ON class_sessions FOR EACH ROW EXECUTE FUNCTION test_class_failure()");
  await assert.rejects(db.query('SELECT portal_delete_class($1,$2)',[admin,3]),/Simulated/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM class_enrollments WHERE class_id=3')).rows[0].n,1);
  await db.exec('DROP TRIGGER test_class_failure ON class_sessions');
  await db.query('SELECT portal_delete_class($1,$2)',[admin,3]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM class_enrollments WHERE class_id=3')).rows[0].n,0);
 });
 await t.test('measurements preserve newer metrics, zero values, retry safety, and rollback together',async()=>{
  const base={student_id:'STU-001',recorded_date:'2026-09-01',height_cm:180,weight_kg:70,body_fat_percentage:0};
  const key='40000000-0000-0000-0000-000000000001';
  const save=async(payload,k)=>(await db.query('SELECT portal_record_body_composition($1,$2,$3) AS result',[admin,JSON.stringify(payload),k])).rows[0].result;
  const first=await save(base,key);assert.equal(Number(first.measurement.body_fat_percentage),0);
  assert.equal((await save(base,key)).measurement.id,first.measurement.id);
  await assert.rejects(save({...base,weight_kg:71},key),/Idempotency/);
  const older=await save({...base,recorded_date:'2026-08-01',height_cm:175},'40000000-0000-0000-0000-000000000002');
  assert.equal(Number(older.latest.height_cm),180);
  assert.equal(Number((await db.query("SELECT height_cm FROM students WHERE id='STU-001'")).rows[0].height_cm),180);
  await assert.rejects(save({...base,recorded_date:'2200-01-01'},'40000000-0000-0000-0000-000000000003'),/date/);
  await assert.rejects(save({...base,recorded_by:student},'40000000-0000-0000-0000-000000000004'),/Unsupported/);
  await db.exec("CREATE FUNCTION test_measurement_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.height_cm=177 THEN RAISE EXCEPTION 'Simulated student update failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_measurement_failure BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION test_measurement_failure()");
  await assert.rejects(save({...base,recorded_date:'2026-09-02',height_cm:177},'40000000-0000-0000-0000-000000000005'),/Simulated/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM student_body_compositions')).rows[0].n,2);
  assert.equal(Number((await db.query("SELECT height_cm FROM students WHERE id='STU-001'")).rows[0].height_cm),180);
  await db.exec('DROP TRIGGER test_measurement_failure ON students');
 });
 await t.test('family collections are atomic, idempotent, linked, immutable, and require verified references',async()=>{
  await db.exec("INSERT INTO students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,current_belt,student_status,home_branch_id) VALUES('STU-003','','Sibling','Female','2010-01-01','2026-01-01',1,'White','Active',1)");
  const household=(await db.query('SELECT id FROM households')).rows[0].id;
  await db.query('SELECT portal_save_household($1,$2)',[admin,JSON.stringify({id:household,guardianName:'Parent',guardianPhone:'012345678',studentIds:['STU-001','STU-002','STU-003']})]);
  const entries=[{studentId:'STU-001',year:2026,month:'Nov',amount:25},{studentId:'STU-003',year:2026,month:'Nov',amount:25}];
  const call=async(e,method,ref,key)=>(await db.query('SELECT portal_record_household_payment($1,$2,$3,$4,$5,$6) AS result',[admin,household,JSON.stringify(e),method,ref,key])).rows[0].result;
  const key='50000000-0000-0000-0000-000000000001';
  await assert.rejects(call(entries,'ABA Bank KHQR',null,key),/reference/);
  await assert.rejects(call([{...entries[0]},{...entries[1],amount:1}],'Cash',null,key),/Full monthly tuition/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM payment_transactions WHERE for_month='Nov'")).rows[0].n,0,'all sibling allocations rolled back');
  await assert.rejects(call([{...entries[0]},{...entries[1],studentId:'STU-002'}],'Cash',null,key),/no longer active/);
  const batch=await call(entries,'ABA Bank KHQR','BANK-FAMILY-1',key);
  assert.match(batch.receipt_number,/^FAMILY-/);assert.equal(batch.transactions.length,2);assert.equal(batch.transactions[0].student_name,'Student');
  assert.equal((await call([...entries].reverse(),'ABA Bank KHQR','BANK-FAMILY-1',key)).id,batch.id);
  await assert.rejects(call(entries,'Cash',null,key),/Idempotency/);
  await assert.rejects(call(entries.map(e=>({...e,month:'Dec'})),'ABA Bank KHQR','BANK-FAMILY-1','50000000-0000-0000-0000-000000000002'),/unique/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM payment_transactions WHERE for_month='Dec'")).rows[0].n,0);
  await assert.rejects(db.exec("UPDATE household_payment_batches SET guardian_name='Changed'"),/immutable/);
  await assert.rejects(db.query('SELECT portal_record_payment($1,$2,$3,$4,$5,$6,$7)',[admin,'STU-001',2026,'Dec',25,'Waived','50000000-0000-0000-0000-000000000003']),/Waived.*zero|waiver must/i);
 });
 await t.test('library saves retain curriculum, rollback relations, and protect student progress',async()=>{
  await db.exec("INSERT INTO muscles(id,name,muscle_group) VALUES(1,'Quadriceps','Legs'); INSERT INTO curriculum(id,title,target_belt,category) VALUES(50,'Unrelated syllabus','White','Recognized Poomsae')");
  const payload={title:'Safe lesson',description:'Details',library_type:'Taekwondo',tkd_category:'Recognized Poomsae',fitness_category:null,target_level:'Yellow',video_url:'',muscleRelations:[{muscleId:1,role:'Primary'}]};
  const key='60000000-0000-0000-0000-000000000001';
  const save=async(action,id,p,k=null)=>(await db.query('SELECT portal_save_library_asset($1,$2,$3,$4,$5) AS result',[admin,action,id,JSON.stringify(p),k])).rows[0].result;
  const result=await save('CREATE',null,payload,key);assert.ok(result.asset.id>50);
  assert.equal((await save('CREATE',null,payload,key)).asset.id,result.asset.id);
  assert.equal((await db.query('SELECT title FROM curriculum WHERE id=50')).rows[0].title,'Unrelated syllabus');
  await assert.rejects(save('UPDATE',result.asset.id,{...payload,title:'Must rollback',muscleRelations:[{muscleId:999,role:'Primary'}]}),/Invalid muscle/);
  assert.equal((await db.query('SELECT title FROM library_assets WHERE id=$1',[result.asset.id])).rows[0].title,'Safe lesson');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM library_asset_muscles')).rows[0].n,1);
  await db.query('SELECT portal_set_video_progress($1,$2,$3,$4)',[admin,'STU-001',result.asset.id,true]);
  assert.equal((await db.query('SELECT target_belt FROM curriculum WHERE id=$1',[result.asset.id])).rows[0].target_belt,'Yellow','watch status never rewrites belt');
  await assert.rejects(save('DELETE',result.asset.id,{}),/student progress/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lms_progress')).rows[0].n,1);
  await db.query('SELECT portal_set_video_progress($1,$2,$3,$4)',[admin,'STU-001',result.asset.id,false]);
  assert.equal((await db.query('SELECT status FROM lms_progress')).rows[0].status,'Not Started');
  await assert.rejects(save('DELETE',result.asset.id,{}),/student progress/);
  const unused=await save('CREATE',null,{...payload,title:'Unused lesson'},'60000000-0000-0000-0000-000000000002');
  await save('DELETE',unused.asset.id,{});
  await db.exec("INSERT INTO library_assets(id,title,library_type,target_level) VALUES(50,'Conflicting library asset','Taekwondo','White')");
  await assert.rejects(save('UPDATE',50,payload),/ID conflict/);
  assert.equal((await db.query('SELECT title FROM curriculum WHERE id=50')).rows[0].title,'Unrelated syllabus');
 });
 await db.exec(`INSERT INTO user_permissions(user_id,permission_key,is_granted) VALUES('${admin}','action:student_delete',true)`);
 await db.query('SELECT portal_archive_student($1,$2)',[admin,'STU-001']);
 assert.ok((await db.query("SELECT deleted_at FROM students WHERE id='STU-001'")).rows[0].deleted_at);
 assert.equal((await db.query(`SELECT is_active FROM profiles WHERE id='${student}'`)).rows[0].is_active,false);
 await db.exec(`SELECT set_config('request.jwt.role','authenticated',false); SET ROLE authenticated;`);
 await assert.rejects(db.query("SELECT portal_stock_change($1,$2,999,'RESTOCK',$3)",[product,variant,student]),/permission denied/);
 await assert.rejects(db.exec(`UPDATE profiles SET role='Root' WHERE id='${student}'`),/permission denied/);
 await assert.rejects(db.exec("DELETE FROM library_assets WHERE id=50"),/permission denied/);
 await assert.rejects(db.exec("DELETE FROM lms_progress"),/permission denied/);
 await assert.rejects(db.exec("DELETE FROM student_body_compositions"),/permission denied/);
 await assert.rejects(db.exec("DELETE FROM class_sessions WHERE id=2"),/permission denied/);
 } finally { await db.close(); }
});
