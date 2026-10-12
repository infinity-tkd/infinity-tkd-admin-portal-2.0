import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://localhost:3000';
const id='80000000-0000-4000-8000-000000000099';
const profile={id,username:'pos_regression',email:'pos@example.test',display_name:'POS Regression',role:'Root',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${Buffer.from('fictional-signature').toString('base64url')}`;
let outage=true;
const orders=[['PAID','COMPLETED',25],['PENDING','CONFIRMED',50],['REFUNDED','CANCELLED',75],['VOID','CANCELLED',100],['PAID','CANCELLED',150]].map(([payment_status,order_status,total_usd],index)=>({id:`fixture-${index}`,order_number:`ORDER-${index}`,order_channel:'ADMIN_POS',customer_name:'Fictional Customer',payment_status,order_status,total_usd,subtotal_usd:total_usd,discount_usd:0,payment_method:'Cash',items:[{product_name:'Uniform',quantity:1,unit_price_usd:total_usd}],created_at:'2026-10-12T04:00:00Z'}));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',route=>{
  const url=new URL(route.request().url()); const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname.startsWith('/api/admin/pos/')){
    assert.equal(route.request().method(),'GET','no live or mocked mutation required');
    if(outage)return json({success:false,error:{message:'Fictional outage'}},503);
    return json({success:true,data:url.pathname.endsWith('/products')?[]:url.searchParams.has('channel')?[]:orders});
   }
   if(url.pathname.startsWith('/api/admin/'))return json({success:true,data:[]});
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').pop();
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);
   if(table==='academy_profile')return json({id:'default',academy_name:'Infinity Taekwondo'});
   return json([]);
  }
  return route.abort();
 });
 const page=await context.newPage(); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#login-identifier').fill('pos_regression');await page.locator('#login-password').fill('Fictional-Password');await page.locator('button[type=submit]').click();
 await page.waitForURL('**/dashboard');await page.goto(base+'/pos',{waitUntil:'networkidle'});
 const warning=page.getByRole('alert').filter({hasText:'Some POS records are unavailable'});
 await warning.getByText('Sales history could not be refreshed. Totals may be incomplete.',{exact:true}).waitFor();
 await warning.getByText('Product prices and stock could not be refreshed.',{exact:true}).waitFor();
 outage=false;await warning.getByRole('button',{name:'Retry POS records'}).click();await warning.waitFor({state:'hidden'});
 await page.getByRole('button',{name:/SALES \(5\)/}).click();
 assert.equal((await page.getByText('Total Revenue',{exact:true}).locator('..').locator('p').innerText()).trim(),'$25.00');
 assert.equal((await page.getByText('Collected TX',{exact:true}).locator('..').locator('p').innerText()).trim(),'1');
 await page.getByRole('cell',{name:'ORDER-2 REFUNDED'}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'POS recovery fits mobile');
 assert.deepEqual(errors,[]);
 console.log('POS recovery browser checks passed: visible catalog/order/sales failures, retry recovery, accurate collected revenue, retained refund records and mobile layout. All providers mocked; no live writes.');
} finally {await browser.close();}
