import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {loadTs} from '../tests/load-ts.mjs';

const {academyDate}=loadTs('lib/dates.ts');
const base=process.argv[2]||'http://127.0.0.1:3000';
const today=academyDate(),actor='98000000-0000-4000-8000-000000000001',productId='98000000-0000-4000-8000-000000000002';
const profile={id:actor,username:'component_fixture',email:'fixture@example.test',display_name:'Fixture administrator',role:'Admin',is_active:true,must_change_password:false};
const user={id:actor,role:'authenticated',aud:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const student={id:'STU-M-001',khmer_name:'Fixture',english_name:'Fixture Athlete',gender:'Male',dob:'2010-'+today.slice(5),registration_date:'2026-01-15',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const products=[{id:productId,name:'Fixture Uniform',sku:'FIXTURE-1',category_name:'Uniforms',price_usd:5,cost_usd:0,stock:5,min_stock_threshold:0,has_variants:false,variants:[],is_active:true}];
let inventoryAllowed=true,studentEditingAllowed=true,failBeltBatch=true,releaseCreate,createSeen;
const createStarted=new Promise(resolve=>{createSeen=resolve;});
const createRelease=new Promise(resolve=>{releaseCreate=resolve;});
let releaseAdjustment;
const adjustmentRelease=new Promise(resolve=>{releaseAdjustment=resolve;});
const productWrites=[],beltWrites=[],belts=[],errors=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Fixture clipboard denial');}}});
  Object.defineProperty(document,'execCommand',{configurable:true,writable:true,value:()=>false});
 });
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname==='/api/notifications')return json({success:true,data:{notices:[],preferences:{push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7},push:{ready:false,publicKey:''},refreshError:false}});
   if(url.pathname==='/api/operations')return json({success:true,data:{events:[],total:0}});
   if(url.pathname==='/api/admin/pos/products'){
    if(request.method()==='POST'){
     const body=request.postDataJSON();productWrites.push(body);
     if(body.action==='CREATE_PRODUCT'){
      createSeen();await createRelease;
      products.push({id:'98000000-0000-4000-8000-'+String(products.length+2).padStart(12,'0'),name:body.name,sku:body.sku,price_usd:body.priceUsd,stock:body.stock,category_name:body.categoryName,min_stock_threshold:body.minStockThreshold,has_variants:body.hasVariants,variants:[],is_active:true});
     }
     if(body.action==='ADJUST_STOCK')await adjustmentRelease;
     return json({success:true,data:{new_balance:3}});
    }
    return json({success:true,data:products});
   }
   if(url.pathname==='/api/admin/pos/orders')return json({success:true,data:[]});
   if(url.pathname.startsWith('/api/telemetry')||url.pathname.startsWith('/api/performance'))return json({success:true});
   if(url.pathname.startsWith('/api/'))return json({success:true,data:[]});
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').pop();
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture academy',enable_audio_chimes:false});
   if(table==='user_permissions')return json([
    ...(!inventoryAllowed?[{user_id:actor,permission_key:'action:pos_manage_inventory',is_granted:false}]:[]),
    ...(!studentEditingAllowed?[{user_id:actor,permission_key:'action:student_edit',is_granted:false},{user_id:actor,permission_key:'action:student_delete',is_granted:false},{user_id:actor,permission_key:'action:evaluations_grade',is_granted:true}]:[]),
   ]);
   if(table==='belt_histories'&&request.method()==='POST'){
    const body=request.postDataJSON();beltWrites.push(body);
    if(failBeltBatch)return json({code:'23505',message:'Fixture certificate conflict'},409);
    const saved=body.map((row,index)=>({...row,id:1000+index}));belts.push(...saved);student.current_belt=saved.at(-1).belt_level;return json(saved,201);
   }
   const data={students:[student],members:[],branches:[{id:1,branch_name:'Fixture branch'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],belt_histories:belts};
   if(table==='students'&&request.headers().accept?.includes('vnd.pgrst.object'))return json(student);
   return json(data[table]||[]);
  }
  return route.abort();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#login-identifier').fill(profile.username);await page.locator('#login-password').fill('Fixture-Password-123');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');

 await page.goto(base+'/pos',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'ADD ITEM',exact:true}).click();
 const create=page.getByRole('dialog',{name:'Create product',exact:true});await create.waitFor();
 await create.getByRole('textbox').first().fill('Fixture new item');
 const threshold=create.getByText('MIN THRESHOLD',{exact:true}).locator('..').getByRole('spinbutton');await threshold.fill('0');assert.equal(await threshold.inputValue(),'0');
 await create.getByRole('button',{name:'Add Single Item',exact:true}).click();
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture product submission did not start')),15000);createStarted.then(()=>{clearTimeout(timer);resolve();});});
 assert.equal(await threshold.isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await create.isVisible(),true,'pending creation retains the form');
 await create.evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(productWrites.length,1,'a second submission is ignored');releaseCreate();await create.waitFor({state:'hidden'});assert.equal(productWrites[0].minStockThreshold,0);

 await page.getByRole('button',{name:'INVENTORY',exact:true}).click();await page.getByTitle('Adjust Stock / Restock',{exact:true}).first().click();
 const adjust=page.getByRole('dialog',{name:'Adjust stock',exact:true});await adjust.waitFor();await adjust.locator('select').last().selectOption('AUDIT_ADJUSTMENT');await adjust.getByRole('spinbutton').fill('-2');
 const adjustmentSent=page.waitForRequest(request=>request.url().endsWith('/api/admin/pos/products')&&request.method()==='POST'&&request.postDataJSON().action==='ADJUST_STOCK');
 await adjust.getByRole('button',{name:'Save Stock Adjustment',exact:true}).click();await adjustmentSent;
 assert.equal(await adjust.getByRole('spinbutton').isDisabled(),true);await adjust.evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(productWrites.filter(row=>row.action==='ADJUST_STOCK').length,1);releaseAdjustment();
 await adjust.waitFor({state:'hidden'});assert.equal(productWrites.at(-1).changeQty,-2);
 await page.getByRole('button',{name:'ADD ITEM',exact:true}).click();await create.waitFor();await create.getByRole('textbox').first().fill('Fixture variation product');await create.getByRole('switch').click();
 await create.locator('tbody tr').first().getByRole('spinbutton').last().fill('0');await create.getByRole('button',{name:/Create Product \(/}).click();await create.waitFor({state:'hidden'});
 const variantWrite=productWrites.at(-1);assert.equal(variantWrite.variants[0].priceOverride,0);assert.equal(Object.hasOwn(variantWrite.variants[0],'price_override'),false);
 inventoryAllowed=false;await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'ADD ITEM',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'INVENTORY',exact:true}).click();assert.equal(await page.getByTitle('Edit Product Details',{exact:true}).first().isDisabled(),true);

 inventoryAllowed=true;studentEditingAllowed=false;await page.goto(base+'/students',{waitUntil:'networkidle'});await page.getByText(student.english_name,{exact:true}).first().click();
 await page.getByRole('button',{name:'Download Student Dossier',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Edit Student Profile',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Delete',exact:true}).count(),0);
 await page.getByRole('button',{name:'Belt Log',exact:true}).click();await page.getByRole('button',{name:'Bulk Log',exact:true}).click();
 const bulk=page.getByRole('dialog',{name:'Belt history batch',exact:true});await bulk.waitFor();await bulk.getByRole('button',{name:'+ Add Row',exact:true}).click();
 await bulk.getByRole('button',{name:'Save',exact:true}).click();const alert=page.getByRole('alertdialog');await alert.waitFor();assert.equal(beltWrites.length,1);assert.ok(Array.isArray(beltWrites[0]));assert.equal(beltWrites[0].length,2);assert.equal(belts.length,0);await alert.getByRole('button',{name:'Dismiss Notification',exact:true}).click();assert.equal(await bulk.isVisible(),true);
 failBeltBatch=false;await bulk.getByRole('button',{name:'Save',exact:true}).click();await bulk.waitFor({state:'hidden'});assert.equal(belts.length,2);assert.deepEqual(beltWrites[1],beltWrites[0],'failed batches retain the same draft and certificate references');

 await page.goto(base+'/dashboard',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Open birthday greeting for '+student.english_name,exact:true}).click();const birthday=page.getByRole('dialog',{name:'Birthday greeting',exact:true});await birthday.waitFor();
 await birthday.getByRole('button',{name:'Copy to Clipboard',exact:true}).click();await alert.waitFor();assert.ok((await alert.innerText()).includes('Copying is unavailable'));await alert.getByRole('button',{name:'Dismiss Notification',exact:true}).click();assert.equal(await birthday.getByRole('button',{name:'Copy to Clipboard',exact:true}).isVisible(),true);
 await page.evaluate(()=>{document.execCommand=()=>true;});await birthday.getByRole('button',{name:'Copy to Clipboard',exact:true}).click();await birthday.getByRole('button',{name:'Copied Message!',exact:true}).waitFor();
 const popupEvent=page.waitForEvent('popup');await birthday.getByRole('link',{name:'Send Telegram',exact:true}).click();const popup=await popupEvent;await popup.close();assert.equal(await birthday.isVisible(),true,'opening a share composer does not mark a greeting sent');await birthday.getByRole('button',{name:'Mark as Sent',exact:true}).click();await birthday.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,zeroThreshold:true,duplicateCreateBlocked:true,inventoryPermissions:true,signedAudit:true,atomicBeltRetry:true,clipboardFailure:true,clipboardFallback:true,explicitBirthdayConfirmation:true,pageErrors:0}));
}catch(error){releaseCreate();releaseAdjustment();if(page){await page.screenshot({path:'scratch/component-browser-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-2200));}throw error;}finally{await browser.close();}
