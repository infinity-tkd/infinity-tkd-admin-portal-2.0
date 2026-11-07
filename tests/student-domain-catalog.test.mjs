import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadTs} from './load-ts.mjs';
const actor=randomUUID(),studentId='STU-M-001';
const core=loadTs('lib/student-domain-server.ts',{'./backend-security':{verifyCaller:async()=>({}),formatServerErrorResponse:()=>new Response('',{status:503})}});
function resourceFixture(data,{userId=actor,status='Active',belt='White'}={}){
 const reads=[];
 const db={from(table){const conditions={},query={select(columns){conditions.columns=columns;return query;},eq(key,value){conditions[key]=value;return query;},order(){return query;},limit(n){conditions.limit=n;return query;},gt(key,value){conditions.after=value;return query;},ilike(key,value){conditions.search=[key,value];return query;},abortSignal(){return query;},then(resolve,reject){reads.push({table,...conditions});let rows=data[table]||[];if(conditions.after)rows=rows.filter(row=>row.id>conditions.after);return Promise.resolve({data:rows.slice(0,conditions.limit),error:null}).then(resolve,reject);}};return query;}};
 const domain={...core,studentDomain:async()=>({context:{userId,role:'Student'},adminSupabase:db,student:{id:studentId,current_belt:belt,student_status:status}})};
 const route=file=>loadTs(file,{'@/lib/student-domain-server':domain});return {reads,route};
}
const request=(path,contract)=>new Request('https://academy.test'+path,{headers:{'X-Portal-Contract':contract,Authorization:'Bearer fictional'}});

test('student shop contract exposes only active storefront products and variants, with accurate effective prices and no costs',async()=>{
 const product={id:randomUUID(),sku:'FIX-1',name:'Fixture uniform',category_name:'Uniforms',price_usd:30,stock:99,description:'Public details',image_url:null,cost_usd:98765,internal_notes:'PRIVATE',has_variants:true,product_variants:[{id:randomUUID(),sku:'FIX-S',size:'S',color:null,price_override:0,stock:3,is_active:true},{id:randomUUID(),sku:'PRIVATE-INACTIVE',price_override:1,stock:100,is_active:false}]};
 const check=resourceFixture({products:[product]},{status:'Paused'});
 const response=await check.route('app/api/portal/shop/catalog/route.ts').GET(request('/api/portal/shop/catalog','shop-v1'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const data=(await response.json()).data;assert.equal(data.contractVersion,'shop-v1');assert.equal(data.subjectStudentId,studentId);assert.equal(data.canOrder,false);
 assert.equal(data.products[0].hasVariants,true);assert.equal(data.products[0].stock,3);assert.equal(data.products[0].variants.length,1);assert.equal(data.products[0].variants[0].priceUsd,0);
 assert.equal(JSON.stringify(data).includes('PRIVATE'),false);assert.equal(JSON.stringify(data).includes('98765'),false);
 assert.equal(check.reads[0].is_active,true);assert.equal(check.reads[0].allow_student_orders,true);assert.ok(!check.reads[0].columns.includes('cost_usd'));
 for(const query of ['?limit=51','?limit=0','?studentId=OTHER','?q=a&q=b']){
  const before=check.reads.length;assert.equal((await check.route('app/api/portal/shop/catalog/route.ts').GET(request('/api/portal/shop/catalog'+query,'shop-v1'))).status,422);assert.equal(check.reads.length,before);
 }
});

test('converted simple products use base stock despite historical variants and public images are sanitized',async()=>{
 const {studentProduct,studentImageUrl}=loadTs('lib/student-catalog-contract.ts');
 const product={id:randomUUID(),sku:'CONVERTED',name:'Converted fixture',category_name:'Equipment',price_usd:20,stock:7,description:null,image_url:'https://user:private@example.test/image.png',has_variants:false,product_variants:[{id:randomUUID(),sku:'HISTORY',stock:0,is_active:false}]};
 const projected=studentProduct(product);assert.equal(projected.hasVariants,false);assert.equal(projected.stock,7);assert.deepEqual(projected.variants,[]);assert.equal(projected.imageUrl,null);
 assert.equal(studentImageUrl('/images/uniform.webp'),'/images/uniform.webp');
 assert.equal(studentImageUrl('https://cdn.example.test/image.png'),'https://cdn.example.test/image.png');
 for(const input of ['//example.test/a','/\\example.test/a','javascript:alert(1)','data:image/svg+xml,example','http://example.test/a','https://user:private@example.test/a','https://example.test/\nimage'])assert.equal(studentImageUrl(input),null,input);
 const conflict=resourceFixture({products:[{...product,product_variants:[{...product.product_variants[0],is_active:true}]}]});
 const response=await conflict.route('app/api/portal/shop/catalog/route.ts').GET(request('/api/portal/shop/catalog','shop-v1'));
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'DATA_INTEGRITY');
});

test('lesson keyset pages preserve eligibility and rich public guidance without exposing private draft fields',async()=>{
 const previous=process.env.PORTAL_CURSOR_SECRET;process.env.PORTAL_CURSOR_SECRET='fixture-domain-cursor-key';
 try{
  const lesson=(id,target)=>({id,target_belt:target,title:'Fixture lesson '+id,description:'Published overview',video_url:null,thumbnail_url:null,content_type:'Taekwondo',content_category:'Kicks',category:'Kicking Basics',learning_content:{instructions:['Controlled practice'],staffNotes:'PRIVATE'},internal_notes:'PRIVATE'});
  const source={curriculum:[lesson(1,'All Belts'),lesson(2,'Red'),lesson(3,'White')],belts:[{belt_name:'White',belt_order:1},{belt_name:'Red',belt_order:6}]};
  source.curriculum[0].thumbnail_url='https://PRIVATE:secret@media.example/cover.jpg';
  source.curriculum[0].video_url='https://PRIVATE:secret@media.example/lesson.mp4';
  source.curriculum[2].thumbnail_url='https://media.example/cover.jpg';
  source.curriculum[2].video_url='https://media.example/lesson.mp4';
  const check=resourceFixture(source),file='app/api/portal/learning/library/route.ts';
  const first=await check.route(file).GET(request('/api/portal/learning/library?limit=2','learning-v1'));
  assert.equal(first.status,200);const data=(await first.json()).data;
  assert.deepEqual(data.lessons.map(row=>row.id),[1]);assert.deepEqual(data.lessons[0].content.instructions,['Controlled practice']);assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(data.nextCursor);
  assert.equal(data.lessons[0].thumbnailUrl,null);assert.equal(data.lessons[0].videoUrl,null);assert.equal(data.lessons[0].media.kind,'unavailable');
  const second=await check.route(file).GET(request('/api/portal/learning/library?limit=2&cursor='+encodeURIComponent(data.nextCursor),'learning-v1'));
  const page=(await second.json()).data;assert.deepEqual(page.lessons.map(row=>row.id),[3]);assert.equal(page.nextCursor,null);
  assert.equal(page.lessons[0].thumbnailUrl,'https://media.example/cover.jpg');assert.equal(page.lessons[0].media.kind,'video');
  const other=resourceFixture(source,{userId:randomUUID()});assert.equal((await other.route(file).GET(request('/api/portal/learning/library?limit=2&cursor='+encodeURIComponent(data.nextCursor),'learning-v1'))).status,409);assert.equal(other.reads.length,0);
  assert.equal((await check.route(file).GET(request('/api/portal/learning/library?limit=2&q=changed&cursor='+encodeURIComponent(data.nextCursor),'learning-v1'))).status,409);
  assert.equal(check.reads.find(row=>row.table==='curriculum').is_active,true);
 }finally{if(previous===undefined)delete process.env.PORTAL_CURSOR_SECRET;else process.env.PORTAL_CURSOR_SECRET=previous;}
});

test('domain gateways require the exact contract, real Student role, explicit ownership and the academy switch',async()=>{
 let role='Student',enabled=true,ids=[studentId],calls=0;
 const client={from(table){const query={select(){return query;},eq(){return query;},is(){return query;},maybeSingle:async()=>({data:table==='academy_profile'?{allow_student_portal_login:enabled}:{id:studentId,current_belt:'White',student_status:'Active'},error:null})};return query;}};
 const domain=loadTs('lib/student-domain-server.ts',{'./backend-security':{verifyCaller:async()=>{calls++;return {context:{userId:actor,role},adminSupabase:client};},formatServerErrorResponse:()=>new Response('',{status:503})},'./student-ownership':{resolveOwnedStudentIds:async()=>ids}});
 await assert.rejects(domain.studentDomain(request('/api/portal/shop/catalog','learning-v1'),'shop-v1'),error=>error.code==='42501');assert.equal(calls,0);
 const valid=await domain.studentDomain(request('/api/portal/shop/catalog','shop-v1'),'shop-v1');assert.equal(valid.student.id,studentId);
 role='Admin';await assert.rejects(domain.studentDomain(request('/api/portal/shop/catalog','shop-v1'),'shop-v1'),error=>error.code==='42501');
 role='Student';enabled=false;await assert.rejects(domain.studentDomain(request('/api/portal/shop/catalog','shop-v1'),'shop-v1'),error=>error.code==='42501');
 enabled=true;ids=[];await assert.rejects(domain.studentDomain(request('/api/portal/shop/catalog','shop-v1'),'shop-v1'),error=>error.code==='42501');
});
