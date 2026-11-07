import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {operationsDatabase,root,coach} from './fixtures/operations-db.mjs';
const mutate=async(db,action,data,key=randomUUID(),actor=root)=>(await db.query('SELECT portal_operations_mutate($1,$2,$3,$4) AS result',[actor,action,data,key])).rows[0].result;
test('operations schema: partial allocations, controlled credits, whole-cycle pauses, immutable cash and idempotency',async()=>{
 const db=await operationsDatabase();try{
 const {id}=await mutate(db,'invoice',{studentId:'STU-M-001',cycleMonth:'2026-10-01',historicalAmount:45,reason:'Verified fixture historical tuition rate'});assert.equal(Number((await db.query('SELECT portal_invoice_balance($1) AS balance',[id])).rows[0].balance),45);
 const key=randomUUID(),payment={studentId:'STU-M-001',amount:10,paymentDate:'2026-10-20',method:'Cash',receivedVerified:true,allocations:[{invoiceId:id,amount:10}]};
 await mutate(db,'payment',payment,key);await mutate(db,'payment',payment,key);assert.equal(Number((await db.query('SELECT portal_invoice_balance($1) AS balance',[id])).rows[0].balance),35);assert.equal((await db.query('SELECT count(*)::int AS n FROM membership_receipts')).rows[0].n,1);
 await assert.rejects(mutate(db,'payment',{...payment,allocations:[{invoiceId:id,amount:40}]}),/balance|received funds/i);assert.equal((await db.query('SELECT count(*)::int AS n FROM membership_receipts')).rows[0].n,1,'failed receipt rolls back');
 const credit=await mutate(db,'issue_credit',{studentId:'STU-M-001',amount:35,reason:'Approved academy tuition credit'});await mutate(db,'apply_credit',{studentId:'STU-M-001',invoiceId:id,creditId:credit.id,amount:35});assert.equal(Number((await db.query('SELECT portal_invoice_balance($1) AS balance',[id])).rows[0].balance),0);
 assert.equal((await db.query("SELECT status FROM payments WHERE student_id='STU-M-001' AND for_month='Oct'")).rows[0].status,'Paid');await assert.rejects(db.exec('DELETE FROM membership_receipts'),/immutable/i);
 await assert.rejects(mutate(db,'issue_credit',{studentId:'STU-M-001',amount:5,reason:'Unauthorized coach credit'},randomUUID(),coach),/Administrator|denied/i);
 await mutate(db,'pause',{studentId:'STU-M-002',startDate:'2026-10-15',resumeDate:'2026-11-15',reason:'Approved whole cycle training pause'});const paused=await mutate(db,'invoice',{studentId:'STU-M-002',cycleMonth:'2026-10-01',historicalAmount:45,reason:'Verified fixture historical tuition rate'});assert.equal(Number((await db.query('SELECT portal_invoice_balance($1) AS balance',[paused.id])).rows[0].balance),0);
 const partial=await mutate(db,'invoice',{studentId:'STU-M-002',cycleMonth:'2026-11-01',historicalAmount:45,reason:'Verified fixture historical tuition rate'});assert.equal(Number((await db.query('SELECT portal_invoice_balance($1) AS balance',[partial.id])).rows[0].balance),45);
 }finally{await db.close();}
});
test('operations schema: session roster snapshots, enrollment events, holidays, task ownership and durable job leases',async()=>{
 const db=await operationsDatabase();try{
 await db.exec("INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time) VALUES(1,1,'Fixture class','Monday',ARRAY['Monday'],'08:00','09:00');INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-M-001',1,'2026-01-15');");
 assert.equal((await db.query('SELECT count(*)::int AS n FROM class_enrollment_history')).rows[0].n,1);
 await mutate(db,'snapshot_sessions',{from:'2026-10-19',to:'2026-10-19'});const session=(await db.query('SELECT * FROM class_occurrences')).rows[0];assert.equal((await db.query('SELECT count(*)::int AS n FROM class_occurrence_roster')).rows[0].n,1);
 await db.exec("DELETE FROM class_enrollments WHERE student_id='STU-M-001'");assert.equal((await db.query('SELECT count(*)::int AS n FROM class_occurrence_roster')).rows[0].n,1,'historical roster survives current enrollment removal');assert.equal((await db.query('SELECT count(*)::int AS n FROM class_enrollment_history')).rows[0].n,2);
 await mutate(db,'session_attendance',{studentId:'STU-M-001',occurrenceId:session.id,status:'Present'});assert.equal((await db.query('SELECT occurrence_id FROM attendance')).rows[0].occurrence_id,session.id);
 await assert.rejects(mutate(db,'session_change',{id:session.id,revision:1,status:'cancelled',reason:'Cannot silently cancel marked records'}),/marked session/i);
 const created=await mutate(db,'task',{title:'Call guardian',category:'general',assignedTo:root,dueDate:'2026-10-25',studentId:'STU-M-001'});await assert.rejects(mutate(db,'task_update',{id:created.id,revision:1,status:'completed',note:'Completed follow-up'},randomUUID(),coach),/denied/i);await mutate(db,'task_update',{id:created.id,revision:1,status:'completed',note:'Guardian contacted; return confirmed'});
 const first=(await db.query("SELECT portal_claim_job('notifications') AS id")).rows[0].id;assert.ok(first);assert.equal((await db.query("SELECT portal_claim_job('notifications') AS id")).rows[0].id,null);
 }finally{await db.close();}
});

test('operations schema: bank reconciliation, immutable rate snapshots and legacy collection coexist safely',async()=>{
 const db=await operationsDatabase();try{
 const invoice=await mutate(db,'invoice',{studentId:'STU-M-001',cycleMonth:'2026-10-01',historicalAmount:45,reason:'Verified fixture historical tuition rate'});await db.exec("UPDATE academy_profile SET standard_tuition_usd=60 WHERE id='default'");assert.equal(Number((await db.query('SELECT amount_usd FROM membership_invoices WHERE id=$1',[invoice.id])).rows[0].amount_usd),45);
 const receipt=await mutate(db,'payment',{studentId:'STU-M-001',amount:20,paymentDate:'2026-10-20',method:'Bank Transfer',externalReference:'BANK-FIXTURE-001',receivedVerified:true,allocations:[{invoiceId:invoice.id,amount:10}]});
 assert.equal(Number((await db.query('SELECT balance_usd FROM membership_invoices WHERE id=$1',[invoice.id])).rows[0].balance_usd),35);assert.equal(Number((await db.query('SELECT amount_usd FROM membership_credits')).rows[0].amount_usd),10,'unallocated cash remains a credit');
 await assert.rejects(db.query("SELECT portal_record_payment($1,'STU-M-001',2026,'Oct',45,'Cash',$2)",[root,randomUUID()]),/invoice ledger/i);
 await mutate(db,'bank_import',{lines:[{reference:'bank-fixture-001',amount:20,transactionDate:'2026-10-20'}]});const bank=(await db.query('SELECT id FROM payment_reconciliation_lines')).rows[0];await mutate(db,'reconcile',{bankLineId:bank.id,receiptId:receipt.id});assert.equal((await db.query('SELECT receipt_id FROM payment_reconciliation_lines')).rows[0].receipt_id,receipt.id);
 await assert.rejects(mutate(db,'bank_import',{lines:[{reference:'bank-fixture-001',amount:25,transactionDate:'2026-10-20'}]}),/conflicting/i);await assert.rejects(mutate(db,'payment',{studentId:'STU-M-001',amount:20,paymentDate:'2026-10-20',method:'Bank Transfer',externalReference:'BANK-FIXTURE-001',receivedVerified:true,allocations:[{invoiceId:invoice.id,amount:10}]}),/unique|reference/i);
 }finally{await db.close();}
});

test('operations schema: historical makeup uses frozen roster after unenrollment, and grading overrides are audited',async()=>{
 const db=await operationsDatabase();try{
 await db.exec("INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time) VALUES(1,1,'Fixture class','Monday',ARRAY['Monday'],'08:00','09:00');INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-M-001',1,'2026-01-15');");await mutate(db,'snapshot_sessions',{from:'2026-10-19',to:'2026-10-19'});await db.exec("DELETE FROM class_enrollments WHERE student_id='STU-M-001'");
 const made=(await db.query("SELECT portal_record_makeup($1,'STU-M-001',1,'2026-10-19','2026-10-20',NULL,'Present','Verified catch-up session',$2) AS result",[root,randomUUID()])).rows[0].result;assert.ok(made.source_occurrence_id);
 const exam=await mutate(db,'exam',{title:'Fixture examination',examDate:'2026-10-20',attendanceFrom:'2026-10-01',targetBeltId:2,passingScore:70,minimumAttendance:80});const assessed=await mutate(db,'assess',{eventId:exam.id,studentId:'STU-M-001',score:80,notes:'Coach assessment recorded',revision:0});
 await assert.rejects(mutate(db,'assess',{eventId:exam.id,studentId:'STU-M-001',score:85,notes:'Stale concurrent assessment',revision:0}),/Assessment changed/i);
 await assert.rejects(mutate(db,'promote',{id:assessed.id,studentId:'STU-M-001',revision:1},randomUUID(),coach),/override|requirements/i);
 await mutate(db,'promote',{id:assessed.id,studentId:'STU-M-001',revision:1,overrideReason:'Verified historical roster and assessed competence'});assert.equal((await db.query('SELECT status FROM grading_candidates')).rows[0].status,'promoted');assert.equal((await db.query("SELECT current_belt FROM students WHERE id='STU-M-001'")).rows[0].current_belt,'Yellow');
 }finally{await db.close();}
});

test('operations schema: future rosters update until class start; holidays use actual rescheduled dates',async()=>{
 const db=await operationsDatabase();try{
 const {monday,tuesday}=(await db.query("SELECT (current_date+7+((8-extract(isodow from current_date+7)::int)%7))::text AS monday,(current_date+8+((8-extract(isodow from current_date+7)::int)%7))::text AS tuesday")).rows[0];
 await db.exec("INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time) VALUES(1,1,'Future fixture','Monday',ARRAY['Monday'],'08:00','09:00');INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-M-001',1,'2026-01-15');");await mutate(db,'snapshot_sessions',{from:monday,to:monday});const session=(await db.query('SELECT * FROM class_occurrences')).rows[0];assert.ok(session);
 await db.exec("DELETE FROM class_enrollments WHERE student_id='STU-M-001';INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-M-002',1,'2026-01-15');");assert.equal((await db.query('SELECT student_id FROM class_occurrence_roster')).rows[0].student_id,'STU-M-002');
 await mutate(db,'session_change',{id:session.id,revision:1,status:'scheduled',startsAt:tuesday+'T08:00:00+07:00',endsAt:tuesday+'T09:00:00+07:00',reason:'Coach requested next-day session'});
 await mutate(db,'holiday',{title:'Original day closure',branchId:1,startDate:monday,endDate:monday,reason:'Planned academy closure on original date'});assert.equal((await db.query('SELECT status FROM class_occurrences')).rows[0].status,'scheduled','holiday on original date does not cancel a moved session');
 await mutate(db,'holiday',{title:'Actual day closure',branchId:1,startDate:tuesday,endDate:tuesday,reason:'Planned closure on actual session date'});assert.equal((await db.query('SELECT status FROM class_occurrences')).rows[0].status,'cancelled');
 await assert.rejects(mutate(db,'session_attendance',{studentId:'STU-M-002',occurrenceId:session.id,status:'Present'}),/non-cancelled/i);
 }finally{await db.close();}
});
test('operations schema: administrator AAL1 cannot read operational records or execute privileged mutations',async()=>{
 const db=await operationsDatabase();try{
 await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.role','authenticated',false);SELECT set_config('request.jwt.sub','${root}',false);SELECT set_config('request.jwt.claims','{"aal":"aal1"}',false);`);
 assert.equal((await db.query('SELECT id FROM students')).rows.length,0);assert.equal((await db.query(`SELECT id FROM profiles WHERE id='${root}'`)).rows.length,1,'own profile remains available for authenticator setup');
 await assert.rejects(db.query("SELECT portal_operations_mutate($1,'policy','{}',$2)",[root,randomUUID()]),/permission/i);
 await db.exec("SELECT set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false)");assert.equal((await db.query('SELECT id FROM students')).rows.length,2);
 }finally{await db.close();}
});

test('operations schema: automatic return belongs to its approved pause and revoked task permissions are enforced',async()=>{
 const db=await operationsDatabase();try{
 const {today,yesterday,tomorrow}=(await db.query("SELECT current_date::text today,(current_date-1)::text yesterday,(current_date+1)::text tomorrow")).rows[0];
 const paused=await mutate(db,'pause',{studentId:'STU-M-001',startDate:yesterday,resumeDate:tomorrow,reason:'Approved recovery period'});
 assert.equal((await db.query("SELECT student_status FROM students WHERE id='STU-M-001'")).rows[0].student_status,'Paused','pause starts immediately without waiting for scheduler');
 await assert.rejects(db.exec("UPDATE students SET student_status='Active' WHERE id='STU-M-001'"),/approved pause/i);
 await mutate(db,'void_pause',{studentId:'STU-M-001',id:paused.id,reason:'Recovery complete; approved early return'});await db.query('SELECT portal_process_membership_dates()');assert.equal((await db.query("SELECT student_status FROM students WHERE id='STU-M-001'")).rows[0].student_status,'Active');
 await db.exec("UPDATE students SET student_status='Paused',pause_end_date=current_date+10,status_reason='Legacy manual review hold' WHERE id='STU-M-001'");await db.query('SELECT portal_process_membership_dates()');assert.equal((await db.query("SELECT student_status FROM students WHERE id='STU-M-001'")).rows[0].student_status,'Paused','an old voided pause must not end a later manual hold');
 await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted) VALUES($1,'page:financials',true)",[coach]);const task=await mutate(db,'task',{title:'Review membership',category:'billing',assignedTo:coach,dueDate:today});await db.query("UPDATE user_permissions SET is_granted=false WHERE user_id=$1 AND permission_key='page:financials'",[coach]);
 await assert.rejects(mutate(db,'task_update',{id:task.id,revision:1,status:'completed',note:'Would expose restricted billing context'},randomUUID(),coach),/denied/i);
 }finally{await db.close();}
});
