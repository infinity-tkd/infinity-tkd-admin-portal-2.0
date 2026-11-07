import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {loadTs} from '../tests/load-ts.mjs';

// Fictional identities in separate browser contexts. Every API/provider call is
// intercepted; this harness never changes a real account or business record.
const base=process.argv[2]||'http://127.0.0.1:3000';
const scenarioFilter=process.argv[3];
const {ROLE_PERMISSIONS,PERMISSION_DEFINITIONS,hasPermission}=loadTs('lib/permissions.ts');
const pages=[['/dashboard','page:dashboard'],['/students','page:directory'],['/members','page:staff'],['/attendance','page:attendance'],['/financials','page:financials'],['/pos','page:pos'],['/lms','page:lms'],['/library','page:library'],['/schedule','page:schedule'],['/calendar','page:calendar'],['/partners','page:partners'],['/settings','page:settings']];
const roles=['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach'];
const actionDenies=Object.fromEntries(PERMISSION_DEFINITIONS.filter(row=>row.accessType==='write').map(row=>[row.key,false]));
const scenarios=[...roles.map(role=>({name:role,role,overrides:{}})),{name:'Admin with write denies',role:'Admin',overrides:actionDenies},{name:'Assistant with explicit teaching grants',role:'Assistant Coach',overrides:{'action:schedule_manage':true,'action:curriculum_edit':true,'action:evaluations_grade':true}},{name:'Attendance-only coach',role:'Coach',overrides:{...Object.fromEntries(PERMISSION_DEFINITIONS.map(row=>[row.key,false])),'page:attendance':true,'action:attendance_mark':true}},{name:'Denied-page grant attempt',role:'Admin',overrides:{'page:library':false,'action:curriculum_edit':true,'page:financials':false,'action:finance_record_payment':true}},{name:'Student restoration denied',role:'Student',overrides:{}},{name:'Admin permission service unavailable',role:'Admin',overrides:{},permissionFailure:true}];
scenarios.push({name:'Settings-only account manager',role:'Admin',overrides:{...Object.fromEntries(PERMISSION_DEFINITIONS.map(row=>[row.key,false])),'page:settings':true,'action:staff_manage':true}});
const results=[],errors=[],writes=[],unexpected=[],businessReads=[],bootstrapReads=[];
let observedPage;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const staffTarget='9b000000-0000-4000-8000-000000000999';
const student={id:'STU-M-001',khmer_name:'Fixture',english_name:'Fixture Athlete',gender:'Male',dob:'2010-01-15',registration_date:'2026-01-15',membership_start_date:'2026-01-15',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const lesson={id:1,title:'Fixture lesson',description:'Fixture public technique',library_type:'Taekwondo',tkd_category:'Kicks (Chagi)',target_level:'White',created_at:'2026-01-01T00:00:00Z'};
const classSession={id:1,branch_id:1,class_name:'Fixture class',class_type:'General Class',day_of_week:'Sunday',days_of_week:['Sunday'],start_time:'09:00',end_time:'10:00',capacity:30,standard_duration_mins:60};
async function ensureShell(page){await page.locator('[data-portal-shell]').waitFor({timeout:60000});}
async function fits(page,name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),name+' fits viewport');}
async function checkLessonDialog(page,dialog,opener){
 const close=dialog.getByRole('button',{name:'Close lesson viewer',exact:true});
 await close.waitFor();
 assert.ok(await close.evaluate(button=>{const box=button.getBoundingClientRect();return box.top>=0&&box.left>=0&&box.right<=window.innerWidth&&box.bottom<=window.innerHeight;}),'lesson close stays within the viewport');
 assert.ok(await close.evaluate(button=>button===document.activeElement),'lesson viewer receives keyboard focus');
 await page.keyboard.press('Shift+Tab');
 assert.ok(await dialog.evaluate(element=>element.contains(document.activeElement)),'lesson keyboard focus stays inside the dialog');
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 assert.ok(await opener.evaluate(button=>button===document.activeElement),'lesson viewer returns keyboard focus to its opener');
 await opener.click();
 await dialog.waitFor();
 await dialog.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Close',exact:true}).last().click();
 await dialog.waitFor({state:'hidden'});
}

try{
 for(const [index,scenario] of scenarios.filter(row=>!scenarioFilter||row.name===scenarioFilter).entries()){
  const actor='9b000000-0000-4000-8000-'+String(index+1).padStart(12,'0');
  const profile={id:actor,username:'role_fixture_'+index,email:'role'+index+'@example.test',display_name:'Fixture '+scenario.name,role:scenario.role,is_active:true,must_change_password:false};
  const user={id:actor,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
  const allowed=permission=>hasPermission(scenario.role,permission,{},actor,Object.fromEntries(Object.entries(scenario.overrides).map(([key,value])=>[actor+':'+key,value])));
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(session=>localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token',JSON.stringify(session)),{access_token:token,refresh_token:'fictional-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});
  await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
  await context.routeWebSocket('**/_next/webpack-hmr*',socket=>socket.close());
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.origin===new URL(base).origin){
    if(url.pathname.startsWith('/api/')){
     if(!['GET','HEAD'].includes(req.method())&&!url.pathname.startsWith('/api/telemetry/')&&url.pathname!=='/api/performance')writes.push({scenario:scenario.name,method:req.method(),path:url.pathname});
     if(url.pathname==='/api/notifications')return json({success:true,data:{notices:[],preferences:{push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7},push:{ready:false,publicKey:''}}});
     if(url.pathname==='/api/admin/events')return json({success:true,data:{events:[],nextCursor:null,lookups:{branches:[],classes:[],students:[]},permissions:{create:allowed('action:events_create'),edit:allowed('action:events_edit'),publish:allowed('action:events_publish'),notify:allowed('action:announcements_send'),archive:allowed('action:events_publish')&&['Root','Super Root','Admin'].includes(scenario.role)}}});
     if(url.pathname==='/api/admin/student-summaries')return json({success:true,data:[student]});
     if(url.pathname==='/api/admin/staff-summaries')return json({success:true,data:[{id:staffTarget,display_name:'Fixture staff colleague',role:'Coach',is_active:true}],error:null});
     if(url.pathname==='/api/admin/account-summaries')return json({success:true,data:[profile,{id:staffTarget,username:'fixture_staff',email:'colleague@example.test',display_name:'Fixture staff colleague',role:'Coach',is_active:true,must_change_password:false,student_id:null,member_summary:{khmer_name:'Fixture Khmer staff',phone:'+85512000000',profile_picture_path:''}},{id:'9b000000-0000-4000-8000-000000000777',username:'fixture_student',email:'student@example.test',display_name:'Fixture portal athlete',role:'Student',is_active:true,must_change_password:false,student_id:student.id}],error:null});
     if(url.pathname==='/api/operations')return json({success:true,data:{tasks:[],sessions:[],roster:[],attendance:[],holidays:[],events:[],total:0}});
     if(url.pathname==='/api/admin/student-training-plans')return json({success:false,error:{message:'Fixture assignments intentionally unavailable'}},503);
     return json({success:true,data:[]});
    }
    return route.continue();
   }
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fictional-refresh',expires_in:3600,token_type:'bearer'});
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
   if(url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').pop();
    if(!['GET','HEAD'].includes(req.method())){writes.push({scenario:scenario.name,path:'/rest/'+table,method:req.method()});return json([]);}
    if(table==='profiles'&&url.searchParams.get('id')==='eq.'+actor){bootstrapReads.push({scenario:scenario.name,table,ownIdentity:true});return json(profile);}
    if(table==='members'&&url.searchParams.get('id')==='eq.'+actor){bootstrapReads.push({scenario:scenario.name,table,ownIdentity:true});return json(null);}
    if(table==='profiles'){businessReads.push({scenario:scenario.name,table});return json([profile,{id:staffTarget,username:'fixture_staff',display_name:'Fixture staff colleague',email:'colleague@example.test',role:'Coach',is_active:true,must_change_password:false}]);}
    if(table==='role_permissions')return scenario.permissionFailure?json({message:'Fixture permission service unavailable'},503):json((ROLE_PERMISSIONS[scenario.role]||[]).map(permission_key=>({role:scenario.role,permission_key,is_granted:true})));
    if(table==='user_permissions')return json(Object.entries(scenario.overrides).map(([permission_key,is_granted])=>({user_id:actor,permission_key,is_granted})));
    if(table==='academy_profile')return json({id:'default',academy_name:'Fixture academy',enable_audio_chimes:false});
    businessReads.push({scenario:scenario.name,table});
    const data={students:[student],members:[],branches:[{id:1,branch_name:'Fixture branch',is_active:true}],class_sessions:[classSession],class_enrollments:[{id:1,student_id:student.id,class_id:1,enrollment_date:'2026-01-15',enrolled_at:'2026-01-15T00:00:00Z'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],library_assets:[lesson],belt_techniques:[{id:'9b000000-0000-4000-8000-000000000888',belt_level:'White',technique_name:'Fixture lesson',category:'Kicks (Chagi)'}]};
    return json(data[table]||[]);
   }
   unexpected.push({scenario:scenario.name,path:url.pathname});return route.abort();
  });
  const page=await context.newPage();observedPage=page;const debug=await context.newCDPSession(page);await debug.send('Debugger.enable');debug.on('Debugger.scriptFailedToParse',event=>{errors.push({scenario:scenario.name,failedScript:event.url,line:event.startLine,endLine:event.endLine});void debug.send('Debugger.getScriptSource',{scriptId:event.scriptId}).then(result=>fs.writeFileSync('scratch/role-failed-script.js',result.scriptSource)).catch(()=>{});});page.on('pageerror',error=>errors.push({scenario:scenario.name,message:error.message,stack:error.stack}));page.on('console',entry=>{if(entry.type()==='error'&&/hydrat|Minified React error|Maximum update depth|Invalid hook call/i.test(entry.text()))errors.push({scenario:scenario.name,message:entry.text(),location:entry.location()});});
  await page.goto(base+'/profile',{waitUntil:'networkidle',timeout:120000});
  if(scenario.role==='Student'){await page.locator('#login-identifier').waitFor({timeout:60000});assert.equal(await page.locator('[data-portal-shell]').count(),0);assert.equal(businessReads.filter(row=>row.scenario===scenario.name).length,0);results.push({scenario:scenario.name,role:scenario.role,passed:true,restorationDenied:true});await context.close();continue;}
  await ensureShell(page);
  if(scenario.permissionFailure){assert.equal(businessReads.filter(row=>row.scenario===scenario.name).length,0,'permission outage cannot load unrelated profiles or private business tables');const links=await page.getByRole('navigation',{name:'Portal navigation',exact:true}).locator('a').evaluateAll(elements=>elements.map(element=>element.getAttribute('href')));assert.deepEqual(links.filter(href=>[...pages.map(row=>row[0]),'/operations'].includes(href)),[],'permission outage hides all protected module links');results.push({scenario:scenario.name,role:scenario.role,passed:true,failedClosed:true,ownBootstrapReads:bootstrapReads.filter(row=>row.scenario===scenario.name)});await context.close();continue;}
  const nav=page.getByRole('navigation',{name:'Portal navigation',exact:true});
  for(const [path,permission] of pages)assert.equal(await nav.locator('a[href="'+path+'"]').count(),Number(allowed(permission)),scenario.name+' nav '+path);
  const operationsAllowed=['page:dashboard','page:schedule','page:attendance','page:financials','page:lms','page:settings'].some(allowed);
  assert.equal(await nav.locator('a[href="/operations"]').count(),Number(operationsAllowed),scenario.name+' operations');
  for(const width of [1440,834,390]){await page.setViewportSize({width,height:width===390?844:1000});await fits(page,scenario.name);if(width<1024){await page.getByRole('button',{name:'Open Navigation Menu',exact:true}).click();await page.getByRole('button',{name:'Close Navigation Menu',exact:true}).waitFor({state:'visible'});for(const [path,permission] of pages)assert.equal(await nav.locator('a[href="'+path+'"]').isVisible(),Boolean(allowed(permission)),scenario.name+' mobile nav '+path);await page.keyboard.press('Escape');}}
  const check=async(path,permission,run)=>{console.log('Checking '+scenario.name+' '+path);await page.goto(base+path,{waitUntil:'networkidle'});await ensureShell(page);if(!allowed(permission)){await page.getByRole('heading',{name:'Access Restricted',exact:true}).waitFor();return;}if(path!=='/students')await page.locator('[data-portal-scroll] h1').first().waitFor({timeout:60000});await run();await fits(page,scenario.name+' '+path);};
  await check('/schedule','page:schedule',async()=>assert.equal(await page.getByRole('button',{name:'Book Session',exact:true}).count(),Number(allowed('action:schedule_manage')),scenario.name+' schedule management'));
  await check('/library','page:library',async()=>{assert.equal(await page.getByRole('button',{name:'Add Asset',exact:true}).count(),Number(allowed('action:curriculum_edit')),scenario.name+' library edits');assert.equal(await page.getByRole('button',{name:'Build Routine',exact:true}).count(),Number(allowed('action:curriculum_edit')),scenario.name+' routine edits');assert.ok(await page.getByRole('button',{name:/3D/i}).count()>0,'readers retain anatomy viewing');});
  await check('/members','page:staff',async()=>{assert.equal(await page.getByRole('button',{name:/Add Staff/i}).count(),Number(allowed('action:staff_manage')),scenario.name+' staff management');});
  await check('/students','page:directory',async()=>{
   await page.getByText(student.english_name,{exact:true}).filter({visible:true}).first().click();
   await page.getByRole('button',{name:'Close Panel',exact:true}).waitFor();
   await page.getByText('Active Schedule & Coach',{exact:true}).waitFor({state:'attached'});
   assert.equal(await page.getByRole('button',{name:'Manage Schedules',exact:true}).count(),Number(allowed('action:schedule_manage')),scenario.name+' enrollment management');
   assert.equal(await page.getByRole('button',{name:'Provision Portal Account',exact:true}).count(),Number(allowed('action:staff_manage')),scenario.name+' account provisioning');
   await page.getByRole('button',{name:'Close Panel',exact:true}).click();
  });
  await check('/lms','page:lms',async()=>{const select=page.locator('select').filter({has:page.locator('option[value="STU-M-001"]')}).first();if(await select.count()){await select.selectOption(student.id);const before=writes.length;const play=page.getByRole('button',{name:'Watch Video',exact:true}).first();if(await play.count()){await play.click();const dialog=page.getByRole('dialog',{name:lesson.title,exact:true});await dialog.waitFor();assert.equal(writes.length,before,'opening material never records official completion');await checkLessonDialog(page,dialog,play);}}await page.getByRole('button',{name:'Student Testing Matrix',exact:true}).click();assert.equal(await page.getByText('Belt Skills Syllabus',{exact:true}).count(),Number(allowed('action:curriculum_edit')),scenario.name+' rubric management');});
  if(scenario.name==='Attendance-only coach'){await check('/operations?view=sessions','page:attendance',async()=>{await page.getByRole('button',{name:'Dated classes',exact:true}).waitFor();});}
  if(scenario.name==='Settings-only account manager'){
   await check('/settings','page:settings',async()=>{
    await page.locator('#settings-section').selectOption('members');
    await page.getByText('Fixture staff colleague',{exact:true}).filter({visible:true}).first().waitFor();
    const search=page.getByPlaceholder('Search by name, username, email...', {exact:true});
    await search.fill('fixture_staff');
    await page.getByTitle('Edit',{exact:true}).filter({visible:true}).first().click();
    const editor=page.getByRole('dialog',{name:'Account editor',exact:true});await editor.waitFor();
    assert.equal(await editor.getByRole('textbox',{name:'Username',exact:true}).inputValue(),'fixture_staff');
    assert.equal(await editor.getByRole('textbox',{name:'Account email',exact:true}).inputValue(),'colleague@example.test');
    assert.equal(await editor.getByRole('textbox',{name:'Account phone',exact:true}).inputValue(),'+85512000000');
    await editor.getByRole('button',{name:'Close user modal',exact:true}).click();
    await search.fill('fixture_student');
    await page.getByText('Fixture portal athlete',{exact:true}).filter({visible:true}).first().waitFor();
    await page.getByTitle('Edit',{exact:true}).filter({visible:true}).first().click();
    await editor.waitFor();
    assert.equal(await editor.getByRole('combobox',{name:'Linked student',exact:true}).inputValue(),student.id,'the existing student account link stays selected without directory access');
    await editor.getByRole('button',{name:'Close user modal',exact:true}).click();
    assert.equal(businessReads.filter(row=>row.scenario===scenario.name&&['students','members'].includes(row.table)).length,0,'settings account manager cannot load directory or medical records');
   });
  }
  results.push({scenario:scenario.name,role:scenario.role,viewports:[1440,834,390],passed:true});console.log('Passed role fixture: '+scenario.name);
  if(scenario.name==='Admin with write denies')await page.screenshot({path:'scratch/role-readonly-mobile.png',fullPage:true});
  await context.close();
 }
 assert.equal(writes.length,0,'viewing role fixtures must not perform any business mutation');assert.deepEqual(errors,[],'no JavaScript errors');
 fs.writeFileSync('scratch/role-ui-browser-evidence.json',JSON.stringify({synthetic:true,realAccounts:false,liveWrites:0,scenarios:results,javascriptErrors:errors,unexpectedNetwork:unexpected,mutations:writes},null,2)+'\n');
 console.log(JSON.stringify({passed:true,scenarios:results.length,viewportChecks:results.filter(row=>row.viewports).length*3,javascriptErrors:errors.length,liveWrites:0}));
}catch(error){if(observedPage&&!observedPage.isClosed())await observedPage.screenshot({path:'scratch/role-ui-browser-failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync('scratch/role-ui-browser-failure.json',JSON.stringify({error:error.message,scenarios:results,errors,writes,unexpected},null,2)+'\n');throw error;}
finally{await browser.close();}
