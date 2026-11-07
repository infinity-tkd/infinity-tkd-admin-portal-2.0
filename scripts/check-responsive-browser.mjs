import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

// Responsive layout audit. Every API and Supabase request is intercepted with
// fictional fixtures, so this never reads or writes a real record.
// Usage: node scripts/check-responsive-browser.mjs <baseUrl> [all|route,route] [screenshotDir]
const base=process.argv[2]||'http://127.0.0.1:3000';
const routeFilter=(process.argv[3]||'').split(',').filter(route=>route&&route!=='all');
const screenshotDir=process.argv[4]||'';
const routes=['/dashboard','/operations','/students','/members','/attendance','/financials','/pos','/lms','/belt-tests','/library','/schedule','/calendar','/partners','/settings','/profile'].filter(route=>!routeFilter.length||routeFilter.includes(route));
const viewports=[[375,812],[390,844],[768,1024],[834,1194],[1024,768],[1280,800],[1440,900]];
const actor='9c000000-0000-4000-8000-000000000001';
const profile={id:actor,username:'responsive_fixture',email:'responsive@example.test',display_name:'Responsive fixture administrator with a long display name',role:'Root',is_active:true,must_change_password:false};
const user={id:actor,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const today=new Date().toISOString().slice(0,10);
const students=Array.from({length:6},(_,index)=>({id:'STU-M-00'+(index+1),khmer_name:'Fixture '+index,english_name:index===0?'Fixture Athlete With An Exceptionally Long Legal Name':'Fixture Athlete '+(index+1),gender:index%2?'Female':'Male',dob:'2012-0'+(index+1)+'-15',registration_date:'2026-01-15',membership_start_date:'2026-01-15',scholarship_id:1,current_belt:['White','Yellow','Green','Blue','Red','1st Poom/Dan'][index],student_status:'Active',home_branch_id:1,student_addresses:[],phone:'+85512000000'}));
const classSession={id:1,branch_id:1,class_name:'Fixture evening sparring class',class_type:'General Class',day_of_week:'Sunday',days_of_week:['Sunday','Wednesday'],start_time:'17:00',end_time:'18:30',capacity:30,standard_duration_mins:90};
const partners=[{id:'9c000000-0000-4000-8000-000000000101',name:'Fixture National Sport University Taekwondo Department',brand_name:'Fixture University',partner_type:'MOU',status:'Active',contact_name:'Fixture liaison',contact_role:'Director',phone:'+85512000001',email:'liaison@example.test',telegram_username:'fixture_liaison',country:'Cambodia',mou_expiry_date:today,tags:['education']}];
const errors=[],findings=[];

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(({session,theme})=>{localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token',JSON.stringify(session));localStorage.setItem('infinity_theme',theme);},{session:{access_token:token,refresh_token:'fictional-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user},theme:process.env.RESPONSIVE_THEME==='dark'?'dark':'light'});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.routeWebSocket('**/_next/webpack-hmr*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/notifications')return json({success:true,data:{notices:[],preferences:{push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7},push:{ready:false,publicKey:''}}});
    if(url.pathname==='/api/admin/events')return json({success:true,data:{events:[],nextCursor:null,lookups:{branches:[],classes:[],students:[]},permissions:{create:true,edit:true,publish:true,notify:true,archive:true}}});
    if(url.pathname==='/api/admin/student-summaries')return json({success:true,data:students});
    if(url.pathname==='/api/admin/partners')return json({success:true,data:partners});
    if(url.pathname==='/api/operations')return json({success:true,data:{tasks:[],notices:[],today,sessions:[],roster:[],attendance:[],holidays:[],events:[],total:0}});
    if(url.pathname==='/api/belt-tests'){
     const view=url.searchParams.get('view');
     const belts=['White','Yellow','Green','Blue','Brown','Red','1st Poom/Dan','2nd Poom/Dan'].map((belt_name,index)=>({id:index+1,belt_name,belt_order:index+1,belt_type:index<6?'color':'black'}));
     if(view==='overview')return json({success:true,data:{belts,syllabi:[],events:[]}});
     if(view==='eligibility')return json({success:true,data:{students:[]}});
     if(view==='eligibility_all')return json({success:true,data:{entries:{}}});
     return json({success:true,data:{usage:[],tests:[]}});
    }
    return json({success:true,data:[]});
   }
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fictional-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').pop();
   if(!['GET','HEAD'].includes(req.method()))return json([]);
   if(table==='profiles'&&url.searchParams.get('id')==='eq.'+actor)return json(profile);
   if(table==='members'&&url.searchParams.get('id')==='eq.'+actor)return json(null);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture academy',enable_audio_chimes:false});
   if(table==='students'&&req.headers().accept?.includes('vnd.pgrst.object'))return json(students[0]);
   const data={profiles:[profile],students,branches:[{id:1,branch_name:'Fixture branch',is_active:true}],class_sessions:[classSession],class_enrollments:students.map((row,index)=>({id:index+1,student_id:row.id,class_id:1,enrollment_date:'2026-01-15',enrolled_at:'2026-01-15T00:00:00Z'})),scholarships:[{id:1,type_name:'Standard',discount_percentage:0}]};
   return json(data[table]||[]);
  }
  return route.abort();
 });
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push({route:page.url(),message:error.message}));
 page.on('console',entry=>{if(entry.type()==='error'&&!/Failed to load resource|net::ERR_FAILED|ERR_ABORTED/.test(entry.text()))errors.push({route:page.url(),message:entry.text().slice(0,400)});});
 if(screenshotDir)fs.mkdirSync(screenshotDir,{recursive:true});
 for(const route of routes){
  console.log('Checking '+route);
  // RESPONSIVE_LOAD_WIDTH loads each route at that width first (e.g. 390 for a cold phone load).
  const loadWidth=Number(process.env.RESPONSIVE_LOAD_WIDTH)||1440;
  await page.setViewportSize({width:loadWidth,height:loadWidth<768?844:900});
  try{
   await page.goto(base+route,{waitUntil:'networkidle',timeout:180000});
   await page.locator('[data-portal-shell]').waitFor({timeout:120000});
   await page.locator('[data-portal-scroll] h1').first().waitFor({timeout:60000});
  }catch(error){
   findings.push({route,rendered:false,error:error.message.split('\n')[0],text:(await page.locator('body').innerText().catch(()=>'')).slice(0,600)});
   if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,route.slice(1).replace(/\W+/g,'-')+'-failure.png')});
   continue;
  }
  for(const [width,height] of viewports){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(250);
   const result=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const scroller=document.querySelector('[data-portal-scroll]');
    // Content inside its own horizontal scroller (tables, chip rails) is allowed to be wider than the page.
    const clipped=element=>{for(let node=element.parentElement;node&&node!==scroller&&node!==document.body;node=node.parentElement){const style=getComputedStyle(node);if(/(auto|scroll|hidden|clip)/.test(style.overflowX))return true;}return false;};
    const offenders=[];
    for(const element of document.querySelectorAll('[data-portal-scroll] *')){
     const box=element.getBoundingClientRect();
     if(box.width===0||box.height===0||box.right<=viewport+1||clipped(element))continue;
     offenders.push((element.tagName.toLowerCase()+'.'+String(element.className||'').split(/\s+/).slice(0,4).join('.')).slice(0,120)+' right='+Math.round(box.right));
     if(offenders.length>=4)break;
    }
    const small=[...document.querySelectorAll('[data-portal-scroll] :is(button,a[href],select,input:not([type=hidden]),[role=button])')].filter(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0&&(box.height<32||box.width<32)&&getComputedStyle(element).visibility!=='hidden';}).length;
    return {page:document.documentElement.scrollWidth>viewport+1,shell:scroller?scroller.scrollWidth>scroller.clientWidth+1:false,offenders,small};
   });
   if(result.page||result.shell||result.offenders.length)findings.push({route,width,...result});
   if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,route.slice(1).replace(/\W+/g,'-')+'-'+width+'.png')});
  }
 }
 // Legacy modals open as phone bottom sheets, take focus, close on Escape and return focus.
 const sheets=[['/students','Add student',page=>page.getByRole('button',{name:'Add',exact:true})],['/members','Add staff member',page=>page.getByRole('button',{name:/Add Staff/})]].filter(([route])=>!routeFilter.length||routeFilter.includes(route));
 for(const [route,name,opener] of sheets){
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+route,{waitUntil:'networkidle',timeout:180000});
  const button=opener(page);await button.first().click();
  const dialog=page.getByRole('dialog',{name,exact:true});await dialog.waitFor();
  await page.waitForTimeout(400);
  // A bottom sheet ([data-modal-panel]) or a panel that is already full screen on phones both qualify.
  const sheet=await dialog.evaluate(element=>{const panel=element.querySelector('[data-modal-panel]')??[...element.children].filter(child=>child.getClientRects().length).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];const box=panel?.getBoundingClientRect();return {panel:Boolean(panel),left:box?.left,width:box?.width,bottom:box?.bottom,viewport:innerWidth,height:innerHeight,focused:element.contains(document.activeElement)};});
  if(!sheet.panel||Math.abs(sheet.left)>1||Math.abs(sheet.width-sheet.viewport)>1||Math.abs(sheet.bottom-sheet.height)>2||!sheet.focused)findings.push({route,sheet:name,...sheet});
  if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,route.slice(1)+'-sheet-390.png')});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  if(!await button.first().evaluate(element=>element===document.activeElement))findings.push({route,sheet:name,focusReturned:false});
 }
 console.log(JSON.stringify({findings,errors},null,1));
 if(screenshotDir)fs.writeFileSync(path.join(screenshotDir,'report.json'),JSON.stringify({findings,errors},null,1));
 assert.deepEqual(findings,[],'every page fits phone, tablet and desktop widths without horizontal scrolling');
 assert.deepEqual(errors,[],'pages render without console errors');
 console.log(JSON.stringify({passed:true,routes:routes.length,viewports:viewports.length}));
}finally{await browser.close();}
