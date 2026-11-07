import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
import {operationsDatabase} from './fixtures/operations-db.mjs';

const {copyText}=loadTs('lib/clipboard.ts');
const {createAttendanceAudio}=loadTs('lib/attendance-audio.ts');
const {insertBeltHistoryBatch,validateBeltHistoryBatch,beltHistoryPayload}=loadTs('lib/student-records.ts');
const {inventoryAdjustmentQuantity,stockAlertThreshold}=loadTs('lib/pos-catalog.ts');

test('physical stock audits preserve signed corrections while restocks and damage keep their required directions',()=>{
 assert.equal(inventoryAdjustmentQuantity('AUDIT_ADJUSTMENT',-3),-3);
 assert.equal(inventoryAdjustmentQuantity('AUDIT_ADJUSTMENT',4),4);
 assert.equal(inventoryAdjustmentQuantity('RESTOCK',-3),3);
 assert.equal(inventoryAdjustmentQuantity('DAMAGE_WRITE_OFF',3),-3);
 assert.throws(()=>inventoryAdjustmentQuantity('AUDIT_ADJUSTMENT',0));
 assert.throws(()=>inventoryAdjustmentQuantity('AUDIT_ADJUSTMENT',NaN));
 assert.equal(stockAlertThreshold(0),0);assert.equal(stockAlertThreshold(NaN),5);assert.equal(stockAlertThreshold(''),5);
});

test('clipboard success is verified, with permission fallback, cleanup and honest failure',async()=>{
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 let appended=0,removed=0,focused=0,allowed=true;
 const document={activeElement:{focus(){focused++;}},getSelection:()=>null,body:{appendChild(){appended++;}},execCommand:()=>allowed,createElement:()=>({style:{},setAttribute(){},select(){},setSelectionRange(){},remove(){removed++;}})};
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:document});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{}}}});
  assert.equal(await copyText('Fixture text'),true);assert.equal(appended,0);
  navigator.clipboard.writeText=async()=>{throw new Error('Permission denied');};
  assert.equal(await copyText('Fixture text'),true);assert.equal(appended,1);assert.equal(removed,1);assert.equal(focused,1);
  allowed=false;assert.equal(await copyText('Fixture text'),false);assert.equal(removed,2);
  document.getSelection=()=>{throw new Error('Selection unavailable');};assert.equal(await copyText('Fixture text'),false);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});Object.defineProperty(globalThis,'document',{configurable:true,value:undefined});
  assert.equal(await copyText('Fixture text'),false);
 }finally{
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
  if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;
 }
});

test('kiosk feedback reuses one audio context, disconnects nodes and tolerates denied audio',async()=>{
 let created=0,disconnected=0,closed=0,nodes=0;
 const makeContext=()=>{created++;return{state:'running',currentTime:0,destination:{},resume:async()=>{},close:async()=>{closed++;},createOscillator(){nodes++;const node={frequency:{setValueAtTime(){}},connect(){},disconnect(){disconnected++;},start(){},stop(){node.onended();}};return node;},createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){disconnected++;}})};};
 const audio=createAttendanceAudio(makeContext);await audio.play('success');await audio.play('error');assert.equal(created,1);assert.equal(nodes,2);assert.equal(disconnected,4);audio.dispose();assert.equal(closed,1);
 const denied=createAttendanceAudio(()=>{throw new Error('Audio unavailable');});await assert.doesNotReject(denied.play('success'));denied.dispose();
 let resume;
 const pending=createAttendanceAudio(()=>({...makeContext(),state:'suspended',resume:()=>new Promise(resolve=>{resume=resolve;})}));
 const playing=pending.play('success');pending.dispose();resume();await playing;assert.equal(nodes,2,'leaving attendance during resume cannot create another sound');
});

test('belt batches reject incomplete rows before writes and send one insert without losing zero scores',async()=>{
 const rows=[{studentId:'STU-M-001',beltLevel:'Yellow',promotionDate:'2026-10-01',certificateRef:'CERT-1',testScore:0},{studentId:'STU-M-001',beltLevel:'Green',promotionDate:'2026-10-02',certificateRef:'CERT-2'}];
 assert.throws(()=>validateBeltHistoryBatch([{...rows[0],promotionDate:'2026-02-30'}]),/valid promotion date/);
 assert.throws(()=>validateBeltHistoryBatch([rows[0],{...rows[1],certificateRef:'cert-1'}]),/unique/);
 assert.throws(()=>validateBeltHistoryBatch([{...rows[0],testScore:NaN}]),/score/);
 assert.equal(beltHistoryPayload(rows[0]).test_score,0);
 let calls=0;const client={from:table=>{assert.equal(table,'belt_histories');return{insert:payload=>{calls++;assert.equal(payload.length,2);return{select:async()=>({data:payload.map((row,index)=>({...row,id:index+1})),error:null})};}};}};
 const saved=await insertBeltHistoryBatch(client,rows);assert.equal(calls,1);assert.equal(saved[0].testScore,0);assert.equal(saved[1].beltLevel,'Green');
 await assert.rejects(insertBeltHistoryBatch(client,[{...rows[0],promotionDate:''}]));assert.equal(calls,1);
 const failure={code:'23505',message:'Certificate already used'};
 await assert.rejects(insertBeltHistoryBatch({from:()=>({insert:()=>({select:async()=>({data:null,error:failure})})})},rows),error=>error===failure);
 await assert.rejects(insertBeltHistoryBatch({from:()=>({insert:()=>({select:async()=>({data:null,error:{code:'',message:'Failed to fetch'}})})})},rows),/may already have been saved/);
});

test('a conflicting belt row rolls back the entire multi-row insert and current-rank update',async()=>{
 const db=await operationsDatabase();
 try{
  await db.exec("INSERT INTO belt_histories(student_id,belt_level,promotion_date,certificate_id) VALUES('STU-M-002','Yellow','2026-09-01','EXISTING-CERT');");
  await assert.rejects(db.exec("INSERT INTO belt_histories(student_id,belt_level,promotion_date,certificate_id) VALUES('STU-M-001','Yellow','2026-10-01','NEW-CERT'),('STU-M-001','Green','2026-10-01','EXISTING-CERT');"),/unique|duplicate/i);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM belt_histories WHERE student_id='STU-M-001'")).rows[0].n,0);
  assert.equal((await db.query("SELECT current_belt FROM students WHERE id='STU-M-001'")).rows[0].current_belt,'White');
  await db.exec("INSERT INTO belt_histories(student_id,belt_level,promotion_date,certificate_id) VALUES('STU-M-001','Yellow','2026-10-01','NEW-CERT'),('STU-M-001','Green','2026-10-01','NEXT-CERT');");
  assert.equal((await db.query("SELECT current_belt FROM students WHERE id='STU-M-001'")).rows[0].current_belt,'Green');
 }finally{await db.close();}
});
