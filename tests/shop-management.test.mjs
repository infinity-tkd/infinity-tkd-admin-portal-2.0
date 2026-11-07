import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase,root,coach} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';

const migration='supabase/migrations/20261102181719_shop_management_integrity.sql';
const product='a1000000-0000-4000-8000-000000000001',other='a1000000-0000-4000-8000-000000000002';
async function database(){const db=await operationsDatabase();await db.exec(fs.readFileSync(migration,'utf8'));return db;}
const draft={action:'CREATE_PRODUCT',sku:'MANAGED-ITEM',name:'Managed fixture',categoryName:'Equipment',priceUsd:15,stock:5,isActive:false,allowStudentOrders:false};
const save=async(db,payload)=>(await db.query('SELECT portal_save_product($1,$2) result',[root,payload])).rows[0].result;

test('catalog writes preserve visibility, ledger initial stock, reject foreign variants and detect stale edits',async()=>{
 const db=await database();try{
  const saved=await save(db,draft);
  assert.equal(saved.is_active,false);assert.equal(saved.allow_student_orders,false);
  assert.deepEqual((await db.query('SELECT change_quantity,balance_after,reason FROM inventory_logs WHERE product_id=$1',[saved.id])).rows,[{change_quantity:5,balance_after:5,reason:'RESTOCK'}]);
  await assert.rejects(save(db,{action:'UPDATE_PRODUCT',productId:saved.id,expectedUpdatedAt:'2000-01-01T00:00:00Z',name:'Stale edit'}),error=>error.code==='40001');
  await assert.rejects(save(db,{action:'UPDATE_PRODUCT',productId:saved.id,variants:[{sku:'CONVERTED',size:'M',stock:5}]}),/Reconcile existing base stock/);
  const variantProduct=await save(db,{...draft,sku:'MANAGED-VARIANT',stock:0,hasVariants:true,variants:[{sku:'MANAGED-S',size:'S',color:'Red',stock:3,priceOverride:0,minStockThreshold:9}]});
  assert.equal(variantProduct.stock,3);
  assert.deepEqual((await db.query('SELECT change_quantity,balance_after FROM inventory_logs WHERE product_id=$1',[variantProduct.id])).rows,[{change_quantity:3,balance_after:3}]);
  await save(db,{action:'UPDATE_PRODUCT',productId:variantProduct.id,variants:[{id:variantProduct.variants[0].id,sku:'MANAGED-S',isActive:false,priceOverride:7}]});
  const metadata=(await db.query('SELECT stock,size,color,price_override::text,min_stock_threshold,is_active FROM product_variants WHERE product_id=$1',[variantProduct.id])).rows[0];
  assert.deepEqual(metadata,{stock:3,size:'S',color:'Red',price_override:'7.00',min_stock_threshold:9,is_active:false},'metadata-only writes preserve physical stock and omitted attributes');
  await assert.rejects(save(db,{action:'UPDATE_PRODUCT',productId:variantProduct.id,variants:[{id:saved.id,sku:'FOREIGN',size:'L',stock:0}]}),/Variant does not belong/);
  const count=(await db.query('SELECT count(*)::int n FROM products')).rows[0].n;
  await assert.rejects(save(db,{...draft,sku:'DUPLICATED',stock:0,hasVariants:true,variants:[{sku:'DUP',size:'S',stock:0},{sku:'dup',size:'L',stock:0}]}),/unique SKU/);
  assert.equal((await db.query('SELECT count(*)::int n FROM products')).rows[0].n,count,'rejected variants roll back the whole product');
  await save(db,{action:'UPDATE_PRODUCT',productId:saved.id,isActive:true,allowStudentOrders:true});
  await save(db,{action:'DELETE_PRODUCT',productId:saved.id});
  await save(db,{action:'UPDATE_PRODUCT',productId:saved.id,isActive:true});
  const restored=(await db.query('SELECT is_active,allow_student_orders,stock FROM products WHERE id=$1',[saved.id])).rows[0];
  assert.deepEqual(restored,{is_active:true,allow_student_orders:false,stock:5},'restore does not silently republish to students');
 }finally{await db.close();}
});

test('inventory request replay changes stock once, rejects changed commands, and remains server-only',async()=>{
 const db=await database();try{
  await db.query('INSERT INTO products(id,sku,name,category_name,price_usd,stock)VALUES($1,$2,$3,$4,15,10)',[product,'STOCK-ONCE','Stock fixture','Equipment']);
  const key=crypto.randomUUID();
  const adjust=async(qty=2,requestKey=key,actor=root,reason='RESTOCK')=>(await db.query('SELECT portal_adjust_inventory_once($1,$2,NULL,$3,$4,$5,$6) result',[actor,product,qty,reason,'Received stock',requestKey])).rows[0].result;
  assert.equal((await adjust()).replayed,false);assert.equal((await adjust()).replayed,true);
  assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product])).rows[0].stock,12);
  assert.equal((await db.query('SELECT count(*)::int n FROM inventory_logs')).rows[0].n,1);
  await assert.rejects(adjust(3),/already used/);
  await assert.rejects(adjust(-1,crypto.randomUUID()),/Invalid inventory/);
  await assert.rejects(adjust(-20,crypto.randomUUID(),root,'DAMAGE_WRITE_OFF'),/Insufficient stock/);
  await assert.rejects(adjust(1,crypto.randomUUID(),coach),/Permission denied/);
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_inventory_requests')).rows[0].n,1,'failed commands do not leave replay records');
  for(const signature of ['portal_adjust_inventory_once(uuid,uuid,uuid,integer,text,text,uuid)','portal_transition_order(uuid,uuid,text,text,text,timestamptz,text)']){
   assert.deepEqual((await db.query('SELECT has_function_privilege($1,$2,$3) allowed',['authenticated','public.'+signature,'EXECUTE'])).rows,[{allowed:false}]);
  }
  await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM public.portal_inventory_requests'),/permission denied/);
 }finally{await db.close();}
});

test('fulfillment preserves pending collection, requires verified payment, guards revision and retains original confirmer',async()=>{
 const db=await database();try{
  const second='a1000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO auth.users(id,email)VALUES($1,'second-owner@example.test')",[second]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role)VALUES($1,'second_owner','second-owner@example.test','Second fixture owner','Root')",[second]);
  const saved=await save(db,{...draft,sku:'FULFILL',isActive:true,allowStudentOrders:true});
  const payload={studentId:'STU-M-001',customerName:'Fixture athlete',customerPhone:'012345678',paymentMethod:'Pay at Counter',items:[{productId:saved.id,qty:1}]};
  const order=(await db.query("SELECT portal_place_order($1,'STUDENT_PORTAL',$2,$3) result",[root,payload,crypto.randomUUID()])).rows[0].result;
  const version=async()=>(await db.query('SELECT updated_at::text value FROM pos_orders WHERE id=$1',[order.order_id])).rows[0].value;
  const change=async(status,payment=null,reference=null,expected=null,actor=root)=>(await db.query('SELECT portal_transition_order($1,$2,$3,$4,NULL,$5,$6) result',[actor,order.order_id,status,payment,expected,reference])).rows[0].result;
  const accepted=await change('CONFIRMED');assert.equal(accepted.payment_status,'PENDING');
  await assert.rejects(change('COMPLETED'),/Payment must be recorded/);
  await assert.rejects(change('CONFIRMED','PAID'),/verified payment reference/);
  await assert.rejects(change('PREPARING',null,null,'2000-01-01T00:00:00Z'),error=>error.code==='40001');
  await change('PREPARING',null,null,await version(),second);
  await change('PREPARING','PAID','BANK-VERIFIED-1',await version(),second);
  await change('READY_FOR_PICKUP',null,null,await version(),second);
  const completed=await change('COMPLETED',null,null,await version(),second);assert.equal(completed.payment_status,'PAID');
  const row=(await db.query('SELECT confirmed_by,fulfilled_at FROM pos_orders WHERE id=$1',[order.order_id])).rows[0];
  assert.equal(row.confirmed_by,root);assert.ok(row.fulfilled_at);
  const audit=(await db.query("SELECT details FROM audit_logs WHERE target_id=$1 AND action='ORDER_STATUS_UPDATED' AND details->>'payment_reference' IS NOT NULL",[order.order_id])).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].details.payment_reference,'BANK-VERIFIED-1');
  await assert.rejects(db.query('SELECT portal_place_counter_order($1,$2,$3)',[root,{...payload,subtotal:15,items:[{productId:saved.id,price:15,qty:1}]},crypto.randomUUID()]),/collected payment method/);
 }finally{await db.close();}
});

test('shop domain stock and value distinguish archived items, active variants and zero-price overrides',()=>{
 const {inventoryRetailValue,sellableProductStock}=loadTs('lib/pos-catalog.ts');
 const {addPosCartItem}=loadTs('lib/pos-cart.ts');
 const item={id:product,name:'Fixture',sku:'FIXTURE',category:'Equipment',price:20,stock:5,minStockThreshold:3,hasVariants:true,variants:[{id:other,sku:'FREE',stock:2,price_override:0,is_active:true},{id:'hidden',sku:'ARCHIVED',stock:3,price_override:10,is_active:false}]};
 assert.equal(sellableProductStock(item),2);assert.equal(inventoryRetailValue(item),30);
 assert.equal(inventoryRetailValue({...item,hasVariants:false,price:.335,stock:3}),1.01);
 assert.equal(sellableProductStock({...item,isActive:false}),0);
 assert.equal(addPosCartItem([],item,undefined,1).ok,false);
 assert.equal(addPosCartItem([],item,item.variants[1],1).ok,false);
 assert.equal(addPosCartItem([],{...item,isActive:false},item.variants[0],1).ok,false);
 assert.equal(addPosCartItem([],item,item.variants[0],1).ok,true);
});

test('student-channel membership gate covers legacy RPCs atomically while staff counter sales remain available',async()=>{
 const db=await database();try{
  const studentActor='a1000000-0000-4000-8000-000000000010';
  await db.query("INSERT INTO auth.users(id,email)VALUES($1,'student-order@example.test')",[studentActor]);
  await db.query("INSERT INTO profiles(id,username,email,display_name,role,student_id)VALUES($1,'student_order','student-order@example.test','Fixture student','Student','STU-M-001')",[studentActor]);
  await db.query("UPDATE students SET profile_id=$1 WHERE id='STU-M-001'",[studentActor]);
  const saved=await save(db,{...draft,sku:'MEMBERSHIP-SHOP',isActive:true,allowStudentOrders:true});
  const payload={studentId:'STU-M-001',customerName:'Fixture student',customerPhone:'012345678',paymentMethod:'Pay at Counter',items:[{productId:saved.id,qty:1}]};
  const count=async table=>(await db.query('SELECT count(*)::int n FROM '+table)).rows[0].n;
  const beforeLogs=await count('inventory_logs');
  for(const status of ['Paused','Inactive','Graduated','Suspended']){
   await db.query("UPDATE students SET student_status=$1 WHERE id='STU-M-001'",[status]);
   await assert.rejects(db.query("SELECT portal_place_order($1,'STUDENT_PORTAL',$2,$3)",[studentActor,payload,crypto.randomUUID()]),error=>error.code==='42501' && /active training membership/.test(error.message));
   assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[saved.id])).rows[0].stock,5);
   assert.equal(await count('inventory_logs'),beforeLogs);assert.equal(await count('pos_orders'),0);
  }
  await db.exec("UPDATE students SET student_status='Active' WHERE id='STU-M-001'");
  const placed=(await db.query("SELECT portal_place_order($1,'STUDENT_PORTAL',$2,$3) result",[studentActor,payload,crypto.randomUUID()])).rows[0].result;
  assert.equal(placed.order_status,'PENDING_CONFIRMATION');assert.equal(placed.payment_status,'PENDING');
  await db.exec("UPDATE students SET student_status='Inactive' WHERE id='STU-M-001'");
  const counterPayload={...payload,paymentMethod:'Cash',subtotal:15,items:[{productId:saved.id,qty:1,price:15}]};
  const counter=(await db.query('SELECT portal_place_counter_order($1,$2,$3) result',[root,counterPayload,crypto.randomUUID()])).rows[0].result;
  assert.equal(counter.order_status,'COMPLETED');assert.equal(counter.payment_status,'PAID');assert.equal(await count('pos_orders'),2);
 }finally{await db.close();}
});
