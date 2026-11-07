import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase,root,coach} from './fixtures/operations-db.mjs';
import {loadTs} from './load-ts.mjs';
const migration='supabase/migrations/20261027190551_counter_sale_quote_validation.sql';
const product='97000000-0000-4000-8000-000000000001';
const variantProduct='97000000-0000-4000-8000-000000000002';
const variant='97000000-0000-4000-8000-000000000003';
const quote={customerName:'Fixture buyer',paymentMethod:'Cash',discountPercentage:10,subtotal:1.05,items:[{productId:product,sku:'FIXTURE',name:'Fixture item',price:.35,qty:3}]};

test('counter checkout rejects stale prices atomically and preserves completed idempotent retries',async()=>{
 const db=await operationsDatabase();
 try{
  await db.exec(fs.readFileSync(migration,'utf8'));
  await db.exec(`INSERT INTO products(id,sku,name,category_name,price_usd,stock) VALUES('${product}','FIXTURE','Fixture item','Fixture',.35,10),('${variantProduct}','VARIANT','Fixture options','Fixture',12,5);INSERT INTO product_variants(id,product_id,sku,price_override,stock) VALUES('${variant}','${variantProduct}','FREE-VARIANT',0,5);`);
  const place=async(payload,key=crypto.randomUUID(),actor=root)=>(await db.query('SELECT public.portal_place_counter_order($1,$2,$3) AS result',[actor,JSON.stringify(payload),key])).rows[0].result;
  await assert.rejects(place({...quote,items:[{...quote.items[0],price:.34}]}),/POS_QUOTE_CHANGED/);
  await assert.rejects(place({...quote,subtotal:1.04}),/POS_QUOTE_CHANGED/);
  await assert.rejects(place({...quote,items:[{...quote.items[0],qty:1001}]}),/Invalid quantity/);
  assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product])).rows[0].stock,10);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM pos_orders')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM inventory_logs')).rows[0].n,0);
  const key=crypto.randomUUID(),saved=await place(quote,key);
  assert.equal(Number(saved.subtotal_usd),1.05);assert.equal(Number(saved.discount_usd),.11);assert.equal(Number(saved.total_usd),.94);
  await db.query('UPDATE products SET price_usd=.20 WHERE id=$1',[product]);
  assert.equal((await place(quote,key)).order_id,saved.order_id,'completed retries survive later price changes');
  await assert.rejects(place({...quote,customerName:'Changed'},key),/Idempotency/);
  await assert.rejects(place(quote),/POS_QUOTE_CHANGED/);
  assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product])).rows[0].stock,7);
  await assert.rejects(place(quote,crypto.randomUUID(),coach),/Permission denied/);
  const zero=await place({...quote,subtotal:0,items:[{productId:variantProduct,variantId:variant,price:0,qty:1}]});assert.equal(Number(zero.total_usd),0);
  await assert.rejects(place({...quote,subtotal:12,items:[{productId:variantProduct,variantId:variant,price:12,qty:1}]}),/POS_QUOTE_CHANGED/);
  await db.exec(fs.readFileSync(migration,'utf8'));
  const privileges=(await db.query("SELECT has_function_privilege('anon','public.portal_place_counter_order(uuid,jsonb,uuid)','EXECUTE') AS anon,has_function_privilege('authenticated','public.portal_place_counter_order(uuid,jsonb,uuid)','EXECUTE') AS signed_in,has_function_privilege('service_role','public.portal_place_counter_order(uuid,jsonb,uuid)','EXECUTE') AS server")).rows[0];assert.deepEqual(privileges,{anon:false,signed_in:false,server:true});
 }finally{await db.close();}
});

test('counter API reports changed quotes as conflicts and derives the operator from the verified session',async()=>{
 const security=loadTs('lib/backend-security.ts',{'./env':{env:{}},'@/lib/supabase':{supabase:{}}});
 const calls=[];let conflict=true;
 const route=loadTs('app/api/admin/pos/orders/route.ts',{'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:root,role:'Root'},adminSupabase:{rpc:async(name,args)=>{calls.push({name,args});return conflict?{data:null,error:{code:'P0001',message:'POS_QUOTE_CHANGED'}}:{data:{order_id:product,total_usd:.94},error:null};}}}),logSecurityAuditEvent:async()=>{}}});
 const request=body=>new Request('http://localhost/api/admin/pos/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...quote,...body})});
 const key=crypto.randomUUID(),response=await route.POST(request({requestKey:key}));assert.equal(response.status,409);assert.equal((await response.json()).error.code,'POS_QUOTE_CHANGED');assert.equal(calls[0].name,'portal_place_counter_order');assert.equal(calls[0].args.p_actor,root);assert.equal(calls[0].args.p_request_key,key);
 conflict=false;assert.equal((await route.POST(request({requestKey:key}))).status,200);
 assert.equal((await route.POST(request({requestKey:key,items:[{...quote.items[0],qty:1001}]}))).status,422);assert.equal(calls.length,2);
});