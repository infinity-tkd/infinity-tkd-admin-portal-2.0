import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {tuitionReceiptRecord}=loadTs('lib/tuition-receipt.ts');
const {posCartTotals,addPosCartItem,changePosCartQuantity,posCartItemKey}=loadTs('lib/pos-cart.ts');
const {normalizeWorkoutClock,sampleWorkoutClock,workoutDuration,workoutRoundStart}=loadTs('lib/workout-clock.ts');
const student={id:'STU-M-001',registrationDate:'2026-01-15',scholarshipId:1,billingInvoices:[{cycleMonth:'2026-10-01',amount:45,balance:35}]};
const scholarship={id:1,typeName:'Standard',discountPercentage:100};
test('receipt summaries use saved collections and original invoice amounts rather than current fees or preview input',()=>{
 const record=tuitionReceiptRecord(student,'2026-10',{id:1,status:'Pending',amountUsd:10,verifiedCollection:true,invoiceProjection:true},scholarship,[],{standardTuitionUsd:60});
 assert.equal(record.collected,10);assert.equal(record.billed,45);assert.equal(record.outstanding,35);assert.equal(record.title,'TUITION SUMMARY');assert.equal(record.label,'PARTIAL COLLECTION');assert.match(record.reference,/^INVOICE-/);
});
test('unpaid previews and credit-only settlements never claim a cash receipt',()=>{
 const draft=tuitionReceiptRecord(student,'2026-10',undefined,scholarship,[],{standardTuitionUsd:60});assert.equal(draft.collected,0);assert.equal(draft.label,'UNPAID PREVIEW');assert.equal(draft.reference,'PREVIEW-UNPAID');
 const settled={...student,billingInvoices:[{cycleMonth:'2026-10-01',amount:45,balance:0}]};assert.equal(tuitionReceiptRecord(settled,'2026-10',{id:1,status:'Waived',amountUsd:0,invoiceProjection:true},scholarship,[],{}).label,'SETTLED WITHOUT CASH');
 const legacy=tuitionReceiptRecord({...student,billingInvoices:[]},'2026-10',{id:9,status:'Paid',amountUsd:30,receiptNumber:'REC-9',paymentMethod:'Cash'},scholarship,[],{standardTuitionUsd:60});assert.equal(legacy.billed,30);assert.equal(legacy.collected,30);assert.equal(legacy.reference,'REC-9');
 const unknown=tuitionReceiptRecord({...student,billingInvoices:[]},'2026-10',{id:8,status:'Paid'},scholarship,[],{standardTuitionUsd:60});assert.equal(unknown.collected,null);assert.equal(unknown.billed,null);assert.equal(unknown.label,'LEGACY AMOUNT UNAVAILABLE');
});
test('POS totals round each line and the discount in cents, consistently for held and active carts',()=>{
 const item=price=>({product:{price},quantity:1});assert.deepEqual(posCartTotals([item(.05)],10),{subtotal:.05,discountPercent:10,discount:.01,total:.04});
 assert.equal(posCartTotals([item(.1),item(.2)],0).total,.3);assert.equal(posCartTotals([item(10)],150).total,0);assert.equal(posCartTotals([item(10)],NaN).total,10);
 assert.equal(posCartTotals([{product:{price:20},variant:{price_override:0},quantity:3}],0).total,0);
 assert.equal(posCartTotals([item(1.005)],0).total,1.01);
 assert.equal(posCartTotals([item(10.075)],0).total,10.08);
 assert.equal(posCartTotals([{product:{price:.175},quantity:3}],0).total,.53);
 assert.equal(posCartTotals([item(1)],14.5).discount,.15);
 assert.equal(posCartTotals([{product:{price:1e-7},quantity:1000}],0).total,0);
});
test('cart changes preserve state and enforce stock, whole quantities and server order limits',()=>{
 const product={id:'fixture',sku:'fixture',price:1,stock:1500};
 const first=addPosCartItem([],product,undefined,1);assert.equal(first.ok,true);const key=posCartItemKey({product});
 const second=changePosCartQuantity(first.cart,key,1);assert.equal(second.cart[0].quantity,2);assert.equal(first.cart[0].quantity,1,'the original cart is unchanged');
 assert.equal(addPosCartItem([],product,undefined,1001).ok,false);assert.equal(addPosCartItem([],product,undefined,1.5).ok,false);
 assert.equal(addPosCartItem([],product,undefined,1000).ok,true);assert.equal(addPosCartItem([{product,quantity:1000}],product,undefined,1).ok,false);
 assert.equal(addPosCartItem([],{...product,stock:0},undefined,1).ok,false);assert.equal(addPosCartItem([],{...product,price:NaN},undefined,1).ok,false);
 const full=Array.from({length:100},(_,index)=>({product:{...product,id:'fixture-'+index},quantity:1}));assert.equal(addPosCartItem(full,product,undefined,1).ok,false);assert.equal(addPosCartItem(full,full[0].product,undefined,1).ok,true);
 assert.deepEqual(changePosCartQuantity(first.cart,key,-1).cart,[]);assert.equal(changePosCartQuantity(first.cart,key,.5).ok,false);
});
test('workout phases follow actual elapsed time and skip zero preparation/rest without extra seconds',()=>{
 const clock=normalizeWorkoutClock({prepareSeconds:0,workSeconds:2,restSeconds:0,totalRounds:2});assert.equal(sampleWorkoutClock(clock,0).mode,'Work');assert.equal(sampleWorkoutClock(clock,2000).currentRound,2);assert.equal(sampleWorkoutClock(clock,5000).mode,'Completed');assert.equal(workoutDuration(clock),4000);
 const rested=normalizeWorkoutClock({prepareSeconds:3,workSeconds:10,restSeconds:5,totalRounds:3});assert.equal(sampleWorkoutClock(rested,13000).mode,'Rest');assert.equal(sampleWorkoutClock(rested,18000).currentRound,2);assert.equal(sampleWorkoutClock(rested,29000).mode,'Rest');assert.equal(sampleWorkoutClock(rested,34000).currentRound,3);assert.equal(workoutRoundStart(rested,3),33000);
});
test('malformed historical workout settings are bounded and cannot make an infinite timer',()=>{
 const config=normalizeWorkoutClock({prepareSeconds:-1,workSeconds:NaN,restSeconds:Infinity,totalRounds:0});assert.deepEqual(config,{prepareSeconds:0,workSeconds:30,restSeconds:0,totalRounds:1});assert.equal(sampleWorkoutClock(config,30000).mode,'Completed');
});
