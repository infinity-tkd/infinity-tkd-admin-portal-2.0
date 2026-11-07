import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';
const {prepaymentSchedule,isMonthBeforeEnrollment}=loadTs('lib/tuition-payments.ts');
const {billingDueDay}=loadTs('lib/billing.ts');
const {productVariantPayloads}=loadTs('lib/pos-product.ts');
const {validInventoryChange}=loadTs('lib/pos-catalog.ts');
const {attendanceBatchPayload,saveAttendanceBatch,clearAttendanceBatch,attendanceRemovalIds}=loadTs('lib/attendance-write.ts');
const {unmarkedSessionRoster}=loadTs('lib/attendance-roster.ts');

test('prepayments allocate exact cents across year boundaries and reject invalid ranges and totals',()=>{
 const value=prepaymentSchedule('Nov',2026,3,10.075);
 assert.deepEqual(value,{entries:[{year:2026,month:'Nov',amount:10.08},{year:2026,month:'Dec',amount:10.08},{year:2027,month:'Jan',amount:10.08}],total:30.24});
 assert.equal(prepaymentSchedule('Jan',2026,12,0,'0').total,0);
 for(const args of [['Jan',2026,0,45],['Jan',2026,25,45],['Jan',2026,1.5,45],['Dec',2100,2,45],['Invalid',2026,1,45],['Jan',2026,1,NaN],['Jan',2026,3,45,'134.99']])assert.throws(()=>prepaymentSchedule(...args));
 assert.equal(isMonthBeforeEnrollment('Jan',2026,'2026-02-01'),true);
 assert.equal(isMonthBeforeEnrollment('Feb',2026,'2026-02-28'),false);
});

test('billing day follows effective schedule changes and month ends without device timezone conversion',()=>{
 const student={id:'STU-M-001',registrationDate:'2026-01-31',scholarshipId:1,billingSchedule:[{day:20,effectiveMonth:'2026-04-01',changedAt:'2026-03-01'}]};
 assert.equal(billingDueDay(student,[],'2026-02'),28);
 assert.equal(billingDueDay(student,[],'2026-04'),20);
 assert.equal(billingDueDay({...student,registrationDate:'invalid'},[],'2026-04'),null);
});

test('variant payloads preserve zero override prices and permit style-only variations',()=>{
 assert.deepEqual(productVariantPayloads([{sku:' red ',color:' Red ',size:'',stock:2,price_override:0}]),[{sku:'RED',color:'Red',size:null,stock:2,priceOverride:0}]);
 const row={sku:'S',color:'',size:'S',stock:0,price_override:null};
 assert.throws(()=>productVariantPayloads([]));assert.throws(()=>productVariantPayloads([row,{...row,sku:'s'}]));
 assert.throws(()=>productVariantPayloads([{...row,stock:1.5}]));assert.throws(()=>productVariantPayloads([{...row,price_override:NaN}]));
 for(const [reason,qty,expected] of [['RESTOCK',2,true],['RESTOCK',-2,false],['DAMAGE_WRITE_OFF',-2,true],['DAMAGE_WRITE_OFF',2,false],['AUDIT_ADJUSTMENT',-2,true],['AUDIT_ADJUSTMENT',0,false],['AUDIT_ADJUSTMENT',100001,false]])assert.equal(validInventoryChange(reason,qty),expected);
});

test('attendance batch validation rejects duplicates and invalid dates before any request',()=>{
 const row={studentId:'STU-M-001',date:'2026-01-16',classId:1,status:'Present'};
 assert.deepEqual(attendanceBatchPayload([row],root,'2026-01-16')[0],{student_id:row.studentId,date:row.date,class_id:1,status:'Present',marked_by:root});
 for(const rows of [[row,row],[{...row,date:'2026-02-30'}],[{...row,date:'2026-01-17'}],[{...row,classId:0}],[{...row,status:'unknown'}]])assert.throws(()=>attendanceBatchPayload(rows,root,'2026-01-16'));
});

test('attendance uses one batch statement, verifies responses and reports uncertain connections honestly',async()=>{
 const rows=[{studentId:'STU-M-001',date:'2026-01-16',status:'Present'},{studentId:'STU-M-002',date:'2026-01-16',status:'Late'}];
 let calls=0,payload,mode='success';
 const query={select(){return this;},async abortSignal(){return mode==='success'?{data:payload.map((row,i)=>({...row,id:i+1})),error:null}:mode==='uncertain'?{data:null,error:{code:'08006'}}:{data:[],error:null};}};
 const client={from(){return{upsert(value){calls++;payload=value;return query;}};}};
 const saved=await saveAttendanceBatch(client,rows,root);assert.equal(calls,1);assert.equal(saved.length,2);assert.equal(saved[1].status,'Late');
 mode='uncertain';await assert.rejects(saveAttendanceBatch(client,rows,root),/may have completed/);
 mode='empty';await assert.rejects(saveAttendanceBatch(client,rows,root),/could not be verified/);
});

test('clearing attendance exposes only returned IDs so inaccessible marks remain visible',async()=>{
 let selected;
 const query={in(column,ids){assert.equal(column,'id');selected=ids;return this;},select(){return this;},async abortSignal(){return{data:[{id:1}],error:null};}};
 assert.deepEqual(await clearAttendanceBatch({from(){return{delete(){return query;}};}},[1,2,2]),[1]);assert.deepEqual(selected,[1,2]);
});

test('clearing daily check-ins never selects hidden marks from another class or student',()=>{
 const records=[{id:1,studentId:'A',date:'2026-01-16'},{id:2,studentId:'A',date:'2026-01-16',classId:1},{id:3,studentId:'A',date:'2026-01-16',classId:2},{id:4,studentId:'B',date:'2026-01-16'}];
 assert.deepEqual(attendanceRemovalIds(records,'2026-01-16',['A']),[1]);
 assert.deepEqual(attendanceRemovalIds(records,'2026-01-16',['A'],2),[3]);
 assert.deepEqual(attendanceRemovalIds(records,'2026-01-17',['A']),[]);
});

test('roster commits use saved sessions, preserve existing marks and ignore cancellations and moved source dates',()=>{
 const data={sessions:[{id:'moved',class_id:1,branch_id:2,starts_at:'2026-01-16T09:00:00+07:00',status:'scheduled'},{id:'cancelled',class_id:2,branch_id:2,starts_at:'2026-01-16T09:00:00+07:00',status:'cancelled'}],roster:[{occurrence_id:'moved',student_id:'former-student'},{occurrence_id:'moved',student_id:'already-present'},{occurrence_id:'cancelled',student_id:'cancelled-student'}],attendance:[{student_id:'already-present',date:'2026-01-16',class_id:1}]};
 assert.deepEqual(unmarkedSessionRoster(data,'2026-01-16',2,'all'),[{studentId:'former-student',date:'2026-01-16',classId:1,status:'Absent'}]);
 assert.throws(()=>unmarkedSessionRoster(data,'2026-01-15',2,'all'),/No saved session/);
 assert.throws(()=>unmarkedSessionRoster(data,'2026-01-16',1,'all'),/No saved session/);
});

test('PostgreSQL rolls back a rejected attendance batch and persists variant prices and stock atomically',async()=>{
 const db=await operationsDatabase();
 try{
  await assert.rejects(db.exec(`INSERT INTO attendance(student_id,date,status,marked_by) VALUES('STU-M-001','2026-01-16','Present','${root}'),('STU-M-002','2100-01-01','Present','${root}');`),/Future attendance/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance')).rows[0].n,0);
  const payload={action:'CREATE_PRODUCT',sku:'COLOR-ONLY',name:'Style-only fixture',categoryName:'Belts',priceUsd:25,stock:0,hasVariants:true,variants:productVariantPayloads([{sku:'COLOR-RED',color:'Red',size:'',stock:3,price_override:0}])};
  const result=(await db.query('SELECT portal_save_product($1,$2::jsonb) AS product',[root,JSON.stringify(payload)])).rows[0].product;
  assert.equal(Number(result.variants[0].price_override),0);assert.equal(result.variants[0].size,null);assert.equal(result.stock,3);
  const duplicate={...payload,sku:'ROLLBACK',variants:[{sku:'UNIQUE',size:'S',stock:2},{sku:'COLOR-RED',size:'M',stock:2}]};
  await assert.rejects(db.query('SELECT portal_save_product($1,$2::jsonb)',[root,JSON.stringify(duplicate)]));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM products WHERE sku='ROLLBACK'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM product_variants WHERE sku='UNIQUE'")).rows[0].n,0);
 }finally{await db.close();}
});
