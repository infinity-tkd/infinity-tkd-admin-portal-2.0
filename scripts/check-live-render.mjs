import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {liveSnapshot} from './lib/live-snapshot.mjs';
import {fetchAllRows} from './lib/read-helpers.mjs';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const {datasets} = await liveSnapshot();
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{db:{retry:false},auth:{persistSession:false,autoRefreshToken:false}});
const products = await fetchAllRows(client.from('products').select('*,variants:product_variants(*),categories:product_categories(*)'));
const orders = await fetchAllRows(client.from('pos_orders').select('*,items:pos_order_items(*),students(english_name,khmer_name,current_belt,phone),branches(branch_name)').order('created_at',{ascending:false}));
assert.equal(products.error,null,'real product join query'); assert.equal(orders.error,null,'real order join query');
client.auth.dispose();
const base = process.argv[2] || 'http://localhost:3000';
const id='60000000-0000-4000-8000-000000000099';
const profile={id,username:'readonly_render',email:'readonly@example.test',display_name:'Read-only Verification',role:'Root',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${Buffer.from('fictional-signature').toString('base64url')}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fictional-refresh'}});
   if(url.pathname.startsWith('/api/admin/')){
    assert.equal(route.request().method(),'GET','live-render harness forbids admin writes');
    if(url.pathname==='/api/admin/pos/products')return json({success:true,data:products.data});
    if(url.pathname==='/api/admin/pos/orders')return json({success:true,data:orders.data});
    if(url.pathname==='/api/admin/partners')return json({success:true,data:datasets.partners});
    return json({success:true,data:[]});
   }
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fictional-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   assert.equal(route.request().method(),'GET','live-render harness forbids database writes');
   const table=url.pathname.split('/').pop();
   if(table==='profiles'&&url.searchParams.has('id'))return json(profile);
   if(table==='members'&&url.searchParams.has('id'))return json(null);
   if(table==='academy_profile')return json(datasets.academy_profile[0]);
   const from=Number(route.request().headers().range?.split('-')[0]||url.searchParams.get('offset')||0);
   const limit=Number(url.searchParams.get('limit')||500);
   return json((datasets[table]||[]).slice(from,from+limit));
  }
  return route.abort();
 });
 const page=await context.newPage(); const errors=[]; const measurements=[];
 page.on('pageerror',error=>errors.push(error.name));
 page.on('console',message=>{if(message.type()==='error'&&/hydrat|didn't match|unhandled/i.test(message.text()))errors.push('ConsoleError');});
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});
 await page.locator('#login-identifier').fill('readonly_render');await page.locator('#login-password').fill('Fictional-Password');
 await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');await page.waitForLoadState('networkidle');
 const links=await page.getByRole('navigation',{name:'Portal navigation'}).locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
 for(const href of links){
  const start=performance.now();
  await page.getByRole('navigation',{name:'Portal navigation'}).locator(`a[href="${href}"]`).click();
  await page.waitForURL('**'+href);await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('alertdialog').count(),0,href+' runtime recovery modal');
  assert.equal(await page.getByRole('alert').filter({hasText:/Some .*records are unavailable/}).count(),0,href+' data-load errors');
  assert.equal(errors.length,0,href+' runtime error count');
  measurements.push({route:href,ms:Math.round(performance.now()-start)});
 }
 await page.goto(base+'/profile',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'My account',level:1}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'real-data account page fits mobile');
 console.log(JSON.stringify({passed:true,scope:'real database records rendered with a fictional read-only browser session; no live writes',students:datasets.students.length,payments:datasets.payments.length,products:products.data.length,measurements},null,2));
} finally {await browser.close();}
