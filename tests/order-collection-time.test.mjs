import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';

const shop='supabase/migrations/20261102181719_shop_management_integrity.sql';
const migration='supabase/migrations/20261102182859_order_collection_timestamps.sql';
const product='a4000000-0000-4000-8000-000000000001';

test('collection timestamps record new paid actions without backfilling legacy paid rows',async()=>{
 const db=await operationsDatabase();try{
  await db.exec(fs.readFileSync(shop,'utf8'));
  await db.query("INSERT INTO products(id,sku,name,category_name,price_usd,stock)VALUES($1,'COLLECTION-TIME','Fixture item','Equipment',15,10)",[product]);
  const counter={customerName:'Fixture counter',paymentMethod:'Cash',subtotal:15,items:[{productId:product,price:15,qty:1}]};
  const placeCounter=async(key=crypto.randomUUID())=>(await db.query('SELECT portal_place_counter_order($1,$2,$3) result',[root,counter,key])).rows[0].result;
  const legacy=await placeCounter();
  const pending=(await db.query("SELECT portal_place_order($1,'STUDENT_PORTAL',$2,$3) result",[root,{studentId:'STU-M-001',customerName:'Fixture student',customerPhone:'012345678',paymentMethod:'Pay at Counter',items:[{productId:product,qty:1}]},crypto.randomUUID()])).rows[0].result;
  await db.query("UPDATE pos_orders SET created_at=now()-interval '21 days' WHERE id=ANY($1::uuid[])",[[legacy.order_id,pending.order_id]]);
  await db.exec(fs.readFileSync(migration,'utf8'));
  const collection=async id=>(await db.query('SELECT payment_recorded_at::text value FROM pos_orders WHERE id=$1',[id])).rows[0].value;
  assert.equal(await collection(legacy.order_id),null);assert.equal(await collection(pending.order_id),null);
  await db.query("UPDATE pos_orders SET admin_notes='Legacy note review' WHERE id=$1",[legacy.order_id]);
  assert.equal(await collection(legacy.order_id),null,'unrelated edits must not guess the legacy collection date');
  await db.query("SELECT portal_transition_order($1,$2,'CONFIRMED',NULL,NULL,NULL,NULL)",[root,pending.order_id]);
  assert.equal(await collection(pending.order_id),null,'acceptance does not record collection');
  const before=Date.now();
  await db.query("SELECT portal_transition_order($1,$2,'CONFIRMED','PAID',NULL,NULL,'CASH-VERIFIED')",[root,pending.order_id]);
  const recorded=await collection(pending.order_id);assert.ok(recorded);
  const row=(await db.query('SELECT extract(epoch FROM payment_recorded_at)*1000 collected,extract(epoch FROM created_at)*1000 created FROM pos_orders WHERE id=$1',[pending.order_id])).rows[0];
  assert.ok(Number(row.collected)>=before-1000);assert.ok(Number(row.collected)<=Date.now()+1000);
  assert.ok(Number(row.collected)-Number(row.created)>20*86400000,'an old order is collected in its payment period');
  await db.query("SELECT portal_transition_order($1,$2,'PREPARING',NULL,NULL,NULL,NULL)",[root,pending.order_id]);
  await db.query("SELECT portal_transition_order($1,$2,'COMPLETED',NULL,NULL,NULL,NULL)",[root,pending.order_id]);
  assert.equal(await collection(pending.order_id),recorded,'fulfillment preserves the original recorded collection time');
  await db.query("SELECT portal_refund_order($1,$2,'REFUND-VERIFIED','Reviewed fixture refund',false)",[root,pending.order_id]);
  assert.equal(await collection(pending.order_id),recorded,'refund history retains the original collection timestamp');
  await assert.rejects(db.query("UPDATE pos_orders SET payment_recorded_at=payment_recorded_at+interval '1 day' WHERE id=$1",[pending.order_id]),/cannot be reassigned/);
  await assert.rejects(db.query('UPDATE pos_orders SET payment_recorded_at=NULL WHERE id=$1',[pending.order_id]),/cannot be reassigned/);
  await assert.rejects(db.query("UPDATE pos_orders SET payment_recorded_at=now() WHERE id=$1",[legacy.order_id]),/cannot be reassigned/,'legacy dates require a separately reviewed migration, not an ordinary edit');
  const key=crypto.randomUUID(),fresh=await placeCounter(key);const first=await collection(fresh.order_id);assert.ok(first,'counter PAID inserts are recorded by the server');
  assert.equal((await placeCounter(key)).order_id,fresh.order_id);assert.equal(await collection(fresh.order_id),first,'checkout replay retains original collection time');
 }finally{await db.close();}
});

test('collection projection has no creation-date or display-label fallback',()=>{
 const {collectionTimestamp}=loadTs('lib/pos-reporting.ts');
 assert.equal(collectionTimestamp({payment_recorded_at:'2026-11-03T07:00:00+07:00'}),Date.parse('2026-11-03T00:00:00Z'));
 assert.equal(collectionTimestamp({payment_recorded_at:'2026-11-03T00:00:00.123456+00:00'}),Date.parse('2026-11-03T00:00:00.123Z'));
 assert.equal(collectionTimestamp({created_at:'2026-11-01T00:00:00Z'}),null);
 for(const value of [null,undefined,'','03/11/2026','2026-02-30T00:00:00Z','Collection date needs review','2026-11-03T25:00:00Z'])assert.equal(collectionTimestamp({payment_recorded_at:value}),null);
});

test('sales periods use academy day, Monday week and calendar month boundaries',()=>{
 const {saleWithinPeriod}=loadTs('lib/pos-reporting.ts');
 const sale=value=>({timestamp:Date.parse(value)});
 const now=new Date('2026-11-03T08:00:00+07:00');
 assert.equal(saleWithinPeriod(sale('2026-11-02T18:00:00Z'),'TODAY',now),true,'UTC previous day is the current academy day');
 assert.equal(saleWithinPeriod(sale('2026-11-02T16:59:59Z'),'TODAY',now),false);
 assert.equal(saleWithinPeriod(sale('2026-11-02T00:00:00+07:00'),'WEEK',now),true);
 assert.equal(saleWithinPeriod(sale('2026-11-01T23:59:59+07:00'),'WEEK',now),false,'Sunday is not this Monday-start week');
 assert.equal(saleWithinPeriod(sale('2026-11-01T00:00:00+07:00'),'MONTH',now),true);
 assert.equal(saleWithinPeriod(sale('2026-10-31T23:59:59+07:00'),'MONTH',now),false,'last month is excluded even within a rolling 30 days');
 assert.equal(saleWithinPeriod(sale('2026-11-03T09:00:00+07:00'),'TODAY',now),false,'future timestamps are excluded');
 for(const period of ['TODAY','WEEK','MONTH'])assert.equal(saleWithinPeriod({},period,now),false);
 assert.equal(saleWithinPeriod({},'ALL',now),true,'undated records remain in audit history');
 const yearStart=new Date('2027-01-01T08:00:00+07:00');
 assert.equal(saleWithinPeriod(sale('2026-12-29T12:00:00+07:00'),'WEEK',yearStart),true,'this week can cross a year boundary');
 assert.equal(saleWithinPeriod(sale('2026-12-31T23:59:59+07:00'),'MONTH',yearStart),false);
});

test('counter responses use the stored collection time and remain confirmed during a metadata outage',async t=>{
 t.mock.method(console,'warn',()=>{});
 const security=loadTs('lib/backend-security.ts',{'./env':{env:{}},'@/lib/supabase':{supabase:{}}});
 const recorded='2026-11-03T00:00:00+00:00';let unavailable=false;
 const query={select(){return query;},eq(){return query;},abortSignal(){return query;},maybeSingle:async()=>unavailable?{data:null,error:{code:'08006'}}:{data:{payment_recorded_at:recorded},error:null}};
 const route=loadTs('app/api/admin/pos/orders/route.ts',{'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:root,role:'Root'},adminSupabase:{rpc:async()=>({data:{order_id:product,total_usd:15},error:null}),from:()=>query}}),logSecurityAuditEvent:async()=>{}}});
 const payload={customerName:'Fixture',paymentMethod:'Cash',subtotal:15,discountPercentage:0,items:[{productId:product,sku:'FIXTURE',name:'Fixture',price:15,qty:1}],requestKey:crypto.randomUUID()};
 const request=()=>new Request('https://portal.example/api/admin/pos/orders',{method:'POST',body:JSON.stringify(payload)});
 let response=await route.POST(request());assert.equal(response.status,200);assert.equal((await response.json()).data.payment_recorded_at,recorded);
 unavailable=true;response=await route.POST(request());assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data.order_id,product);assert.equal(data.payment_recorded_at,null);
});
