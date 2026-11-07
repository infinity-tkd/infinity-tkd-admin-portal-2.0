import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const actor='a2000000-0000-4000-8000-000000000001',product='a2000000-0000-4000-8000-000000000002';
const security=loadTs('lib/backend-security.ts',{'./env':{env:{}},'@/lib/supabase':{supabase:{}}});
function fixture({role='Root',owned=['STU-M-001'],portalEnabled=true,studentStatus='Active',result={data:{order_id:product},error:null}}={}){
 const reads=[],calls=[],ownership=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return result;},from(table){
  const entry={table,filters:{}};reads.push(entry);
  const query={select(value,options){entry.select=value;entry.options=options;return query;},eq(key,value){entry.filters[key]=value;return query;},order(){return query;},or(value){entry.or=value;return query;},gte(key,value){entry.filters['gte:'+key]=value;return query;},lte(key,value){entry.filters['lte:'+key]=value;return query;},range(from,to){entry.range=[from,to];return query;},abortSignal(){return query;},maybeSingle:async()=>({data:table==='students'?{student_status:studentStatus,deleted_at:null}:{allow_student_portal_login:portalEnabled},error:null}),then(resolve,reject){return Promise.resolve({data:[{id:product,admin_notes:'PRIVATE',student_notes:'Owned note'}],error:null,count:230}).then(resolve,reject);}};
  return query;
 }};
 const stubs={'@/lib/backend-security':{...security,verifyCaller:async()=>({context:{userId:actor,role},adminSupabase:client}),callerHasPermission:async()=>true,logSecurityAuditEvent:async()=>{}},'@/lib/student-ownership':{resolveOwnedStudentIds:async(client,id)=>{ownership.push(id);return owned;},StudentOwnershipError:class extends Error{code='42501';}},'@/lib/data-access':{fetchAllRows:async query=>await query}};
 return {reads,calls,ownership,route:file=>loadTs(file,stubs)};
}
const request=(path,body,method='POST')=>new Request('https://portal.example'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});

test('admin order listing validates bounded filters and returns stable pagination metadata privately',async()=>{
 const check=fixture(),route=check.route('app/api/admin/pos/orders/route.ts');
 const response=await route.GET(request('/api/admin/pos/orders?status=PREPARING&payment=PENDING&channel=STUDENT_PORTAL&from=2026-11-01&to=2026-11-30&limit=20&offset=40',undefined,'GET'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const body=await response.json();assert.deepEqual(body.meta,{contractVersion:'shop-admin-v1',limit:20,offset:40,total:230,hasMore:true});
 assert.deepEqual(check.reads[0].range,[40,59]);
 assert.equal(check.reads[0].filters.payment_status,'PENDING');assert.equal(check.reads[0].filters.order_status,'PREPARING');
 assert.equal(check.reads[0].filters['gte:created_at'],'2026-11-01T00:00:00+07:00');
 const before=check.reads.length;
 for(const query of ['limit=1.5','limit=101','offset=-1','status=UNKNOWN','status=PAID&status=CONFIRMED','from=2026-02-30','from=2026-11-30&to=2026-11-01','select=*'])assert.equal((await route.GET(request('/api/admin/pos/orders?'+query,undefined,'GET'))).status,422,query);
 assert.equal(check.reads.length,before,'invalid filters never reach the database');
});

test('catalog supports explicit bounded pagination while preserving legacy full catalog and create visibility flags',async()=>{
 const check=fixture(),route=check.route('app/api/admin/pos/products/route.ts');
 let response=await route.GET(request('/api/admin/pos/products?include_inactive=true&limit=10&offset=10',undefined,'GET'));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).meta,{contractVersion:'shop-admin-v1',limit:10,offset:10,total:230,hasMore:true});
 assert.deepEqual(check.reads[0].range,[10,19]);assert.equal(check.reads[0].filters.is_active,undefined);
 response=await route.GET(request('/api/admin/pos/products',undefined,'GET'));assert.equal(response.status,200);assert.equal((await response.json()).meta,undefined);
 assert.equal(check.reads[1].filters.is_active,true);
 response=await route.POST(request('/api/admin/pos/products',{action:'CREATE_PRODUCT',sku:'DRAFT',name:'Draft fixture',categoryName:'Belts',priceUsd:20,isActive:false,allowStudentOrders:false}));
 assert.equal(response.status,200);assert.equal(check.calls[0].args.p_payload.isActive,false);assert.equal(check.calls[0].args.p_payload.allowStudentOrders,false);
 for(const imageUrl of ['not-a-url','javascript:alert(1)','data:image/svg+xml,example','http://images.example.test/unsafe.png','https://user:password@images.example.test/private.png'])assert.equal((await route.POST(request('/api/admin/pos/products',{action:'CREATE_PRODUCT',sku:'INVALID',name:'Fixture',categoryName:'Belts',priceUsd:20,imageUrl}))).status,422);
});

test('inventory request keys and verified collection references reach actor-checked atomic commands',async()=>{
 const check=fixture(),products=check.route('app/api/admin/pos/products/route.ts'),orders=check.route('app/api/admin/pos/orders/route.ts'),key=crypto.randomUUID();
 assert.equal((await products.POST(request('/api/admin/pos/products',{action:'ADJUST_STOCK',productId:product,changeQty:2,reason:'RESTOCK',requestKey:key}))).status,200);
 assert.equal(check.calls[0].name,'portal_adjust_inventory_once');assert.equal(check.calls[0].args.p_request_key,key);assert.equal(check.calls[0].args.p_actor,actor);
 const at='2026-11-03T10:00:00+07:00';
 assert.equal((await orders.PUT(request('/api/admin/pos/orders',{orderId:product,newOrderStatus:'PREPARING',paymentStatus:'PAID',paymentReference:'BANK-VERIFIED',expectedUpdatedAt:at},'PUT'))).status,200);
 assert.equal(check.calls[1].name,'portal_transition_order');assert.equal(check.calls[1].args.p_expected_updated_at,at);assert.equal(check.calls[1].args.p_payment_reference,'BANK-VERIFIED');assert.equal(check.calls[1].args.p_admin_notes,null,'payment verification does not overwrite fulfillment notes');
 const conflict=fixture({result:{data:null,error:{code:'40001'}}});
 assert.equal((await conflict.route('app/api/admin/pos/orders/route.ts').PUT(request('/api/admin/pos/orders',{orderId:product,newOrderStatus:'PREPARING'},'PUT'))).status,409);
 const empty=fixture({result:{data:null,error:null}});assert.ok((await empty.route('app/api/admin/pos/orders/route.ts').PUT(request('/api/admin/pos/orders',{orderId:product,newOrderStatus:'CONFIRMED'},'PUT'))).status>=400);
});

test('student orders use canonical ownership, respect portal closure and never return internal notes',async()=>{
 const check=fixture({role:'Student'}),route=check.route('app/api/shop/order/route.ts');
 let response=await route.GET(request('/api/shop/order',undefined,'GET'));assert.equal(response.status,200);
 assert.equal((await response.json()).data[0].admin_notes,undefined);assert.deepEqual(check.ownership,[actor]);
 assert.equal(check.reads.find(row=>row.table==='pos_orders').filters.student_id,'STU-M-001');
 assert.equal(check.reads.find(row=>row.table==='pos_orders').select.includes('admin_notes'),false,'private columns are not selected in the first place');
 const body={studentId:'STU-M-OTHER',customerName:'Fixture',customerPhone:'012345678',paymentMethod:'Pay at Counter',items:[{productId:product,qty:1}],requestKey:crypto.randomUUID()};
 response=await route.POST(request('/api/shop/order',body));assert.equal(response.status,403);assert.deepEqual(check.calls,[]);
 const disabled=fixture({role:'Student',portalEnabled:false});response=await disabled.route('app/api/shop/order/route.ts').POST(request('/api/shop/order',{...body,studentId:'STU-M-001'}));assert.equal(response.status,403);assert.deepEqual(disabled.calls,[]);
 for(const status of ['Paused','Inactive','Graduated']){
  const paused=fixture({role:'Student',studentStatus:status});response=await paused.route('app/api/shop/order/route.ts').POST(request('/api/shop/order',{...body,studentId:'STU-M-001'}));assert.equal(response.status,403);assert.equal((await response.json()).error.code,'SHOP_MEMBERSHIP_REQUIRED');assert.deepEqual(paused.calls,[]);
  assert.equal((await paused.route('app/api/shop/order/route.ts').GET(request('/api/shop/order',undefined,'GET'))).status,200,'history stays readable for '+status);
 }
});
