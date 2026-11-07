import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {loadTs} from '../tests/load-ts.mjs';
const {academyDate,addCalendarDays}=loadTs('lib/dates.ts');
const base=process.argv[2]||'http://127.0.0.1:3000',id='72000000-0000-4000-8000-000000000001';
const profile={id,username:'feature_fixture',email:'fixture@example.test',display_name:'Fixture Admin',role:'Admin',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',aal:'aal2',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const today=academyDate(),source=addCalendarDays(today,-3),month=today.slice(0,7);
const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long'}).format(new Date(source+'T00:00:00Z'));
const student={id:'STU-M-001',profile_id:id,khmer_name:'Fixture',english_name:'Fixture Athlete',gender:'Male',dob:'2010-01-01',registration_date:'2026-01-05',membership_start_date:'2026-01-15',billing_schedule:[],scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const lessons=[{id:1,branch_id:1,class_name:'Fixture class',day_of_week:weekday,days_of_week:[weekday],start_time:'08:00',end_time:'09:00',capacity:30,class_type:'General Class',coach_id:id}];
const candidates=[{key:`STU-M-001:1:${source}`,studentId:student.id,studentName:student.english_name,classId:1,className:'Fixture class',sourceDate:source,sourceStatus:'Unmarked'}];
let records=[],failBilling=false,failMakeup=false,failInbox=false;
const billingWrites=[],makeupWrites=[],inboxWrites=[],errors=[];
let notices=[{id:'73000000-0000-4000-8000-000000000001',source_key:'billing:fixture',category:'billing',title:'Membership follow-up needed',body:'Fixture Athlete payment needs review.',href:'/financials?student=STU-M-001',created_at:today+'T02:00:00Z'},{id:'73000000-0000-4000-8000-000000000002',source_key:'attendance:fixture',category:'attendance',title:'Attendance needs review',body:'Fixture class has an unmarked roster.',href:`/attendance?class=1&date=${source}`,created_at:today+'T01:00:00Z'}];
let preferences={push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
let page;
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname==='/api/telemetry/log')return json({success:true});
   if(url.pathname==='/api/membership/schedule'){
    const body=request.postDataJSON();billingWrites.push(body);if(failBilling)return json({success:false,error:{message:'Fixture billing conflict. Reload before saving.'}},409);
    await new Promise(resolve=>setTimeout(resolve,150));const entry={id:crypto.randomUUID(),day:body.day,previousDay:15,effectiveMonth:body.effectiveMonth,reason:body.reason,changedBy:id,changedAt:new Date().toISOString()};student.billing_schedule.push(entry);return json({success:true,data:entry});
   }
   if(url.pathname==='/api/attendance/makeup'){
    if(request.method()==='GET')return json({success:true,data:{candidates:candidates.filter(row=>!records.some(saved=>!saved.voided_at&&saved.source_date===row.sourceDate)),records,classes:[{id:1,name:'Fixture class'}]}});
    const body=request.postDataJSON();makeupWrites.push(body);if(failMakeup)return json({success:false,error:{message:'Fixture makeup save interrupted. Retry safely.'}},503);
    await new Promise(resolve=>setTimeout(resolve,150));if(body.action==='void'){records=records.map(row=>row.id===body.id?{...row,voided_at:new Date().toISOString()}:row);}else records.push({id:crypto.randomUUID(),student_id:body.studentId,source_class_id:body.sourceClassId,source_date:body.sourceDate,attended_date:body.attendedDate,target_class_id:body.targetClassId,status:body.status,source_status:'Unmarked',reason:body.reason});return json({success:true,data:{saved:true}});
   }
   if(url.pathname==='/api/notifications'){
    if(failInbox)return json({success:false,error:{message:'Fixture inbox unavailable. Retry notifications.'}},503);
    if(request.method()==='GET')return json({success:true,data:{notices,preferences,push:{ready:false,publicKey:''},refreshError:false}});
    const body=request.postDataJSON();inboxWrites.push(body);
    if(body.action==='preferences')preferences={...body};
    else if(body.action==='read-all')notices=notices.map(row=>({...row,read_at:new Date().toISOString()}));
    else if(body.action==='read'||body.action==='dismiss')notices=notices.map(row=>row.id===body.id?{...row,[body.action==='read'?'read_at':'dismissed_at']:new Date().toISOString()}:row);
    return json({success:true,data:{saved:true}});
   }
   if(url.pathname==='/api/shop/order')return json({success:true,data:[{id:'fixture-order',order_number:'FIXTURE-001',order_status:'CONFIRMED',payment_status:'PAID',total_usd:10,created_at:today+'T01:00:00Z'}]});
   if(url.pathname.startsWith('/api/'))return json({success:false,error:{message:'Unexpected fixture API call'}},400);
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   assert.equal(request.method(),'GET','Direct database writes are forbidden in the browser rehearsal');const table=url.pathname.split('/').pop();
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture Academy'});
   if(table==='user_permissions'&&profile.role==='Coach')return json(['page:financials','action:finance_record_payment'].map(permission_key=>({user_id:id,permission_key,is_granted:true})));
   const datasets={students:[student],branches:[{id:1,branch_name:'Fixture branch'}],class_sessions:lessons,class_enrollments:[{id:1,student_id:student.id,class_id:1,enrollment_date:'2026-01-15'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}]};
   return json(datasets[table]||[]);
  }
  return route.abort();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.locator('#login-identifier').fill('feature_fixture');await page.locator('#login-password').fill('Fictional-Password');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');
 await page.goto(base+'/financials?student=STU-M-001',{waitUntil:'networkidle',timeout:120000});
 const schedule=page.getByRole('region',{name:'Membership billing schedule'});await schedule.waitFor();
 await schedule.getByRole('button',{name:'Change billing date'}).click();await schedule.getByLabel('Membership billing day').fill('20');await schedule.getByLabel('Billing date change reason').fill('Align with family salary date');
 failBilling=true;await schedule.getByRole('button',{name:'Save billing date',exact:true}).click();await schedule.getByRole('alert').waitFor();assert.equal(await schedule.getByLabel('Billing date change reason').inputValue(),'Align with family salary date');
 failBilling=false;await schedule.getByRole('button',{name:'Save billing date',exact:true}).evaluate(button=>{button.click();button.click();});await schedule.getByRole('status').waitFor();
 assert.equal(billingWrites.length,2,'double activation does not duplicate a save');assert.equal(billingWrites[0].requestKey,billingWrites[1].requestKey,'ambiguous retries reuse the request key');assert.equal(billingWrites[1].effectiveMonth,month+'-01');
 await schedule.locator('summary').click();await schedule.getByText('Align with family salary date',{exact:true}).waitFor();assert.match(await schedule.innerText(),new RegExp(`${month}-20`));
 await page.goto(base+'/attendance',{waitUntil:'networkidle',timeout:120000});const makeup=page.getByRole('region',{name:'Makeup attendance',exact:true}).first();await makeup.getByRole('button',{name:/Makeup classes/}).click();await makeup.getByText('Unmarked — review required',{exact:false}).waitFor();
 await makeup.getByRole('button',{name:`Record makeup for Fixture Athlete ${source} class 1`,exact:true}).click();await makeup.getByLabel('Makeup reason').fill('Coach confirmed additional session');await makeup.getByLabel('Makeup attended date').fill(today);await makeup.getByLabel('Makeup attendance status').selectOption('Late');
 failMakeup=true;await makeup.getByRole('button',{name:'Save makeup attendance',exact:true}).click();await makeup.getByRole('alert').waitFor();assert.equal(records.length,0);
 failMakeup=false;await makeup.getByRole('button',{name:'Save makeup attendance',exact:true}).evaluate(button=>{button.click();button.click();});await makeup.getByRole('status').waitFor();assert.equal(makeupWrites.length,2);assert.equal(makeupWrites[0].requestKey,makeupWrites[1].requestKey);assert.equal(records[0].status,'Late');assert.equal(records[0].source_date,source);assert.equal(records[0].attended_date,today);assert.equal(records[0].target_class_id,null);
 await makeup.getByRole('button',{name:'Void makeup',exact:true}).click();await makeup.getByLabel('Makeup reason').fill('Wrong session; review with coach');await makeup.getByRole('button',{name:'Confirm void makeup',exact:true}).click();await makeup.getByText('Unmarked — review required',{exact:false}).waitFor();assert.ok(records[0].voided_at);
 await page.getByRole('button',{name:/^Notifications/}).click();const drawer=page.getByRole('dialog',{name:'Notifications',exact:true});await drawer.waitFor();await drawer.getByRole('heading',{name:'Membership follow-up needed'}).waitFor();
 await drawer.getByLabel('Notification category').selectOption('billing');assert.equal(await drawer.locator('article').count(),1);
 await drawer.getByRole('button',{name:'Preferences',exact:true}).click();await drawer.getByRole('button',{name:'Enable on this device',exact:true}).click();await drawer.getByText(/The inbox|notification inbox|installed Home Screen/).first().waitFor();
 await drawer.getByLabel('Quiet from (hour)').fill('21');await drawer.getByRole('button',{name:'Save notification preferences',exact:true}).click();await drawer.getByText('Notification preferences saved.',{exact:true}).waitFor();assert.equal(preferences.quiet_start,21);
 for(const size of [{width:1440,height:1000},{width:834,height:1112},{width:390,height:844}]){await page.setViewportSize(size);assert.ok(await drawer.evaluate(element=>element.scrollWidth<=element.clientWidth),'drawer fits '+size.width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page fits '+size.width);await drawer.screenshot({path:`scratch/notifications-${size.width}.png`});}
 await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});
 failInbox=true;await page.getByRole('button',{name:/^Notifications/}).click();await drawer.getByText(/Fixture inbox unavailable/).waitFor();failInbox=false;await drawer.getByRole('button',{name:'Retry notifications',exact:true}).click();await drawer.getByRole('button',{name:/^Unread/}).click();await drawer.getByLabel('Notification category').selectOption('billing');await drawer.getByRole('button',{name:'Review',exact:true}).click();await page.waitForURL('**/financials?student=STU-M-001');await schedule.waitFor();
 profile.role='Coach';await page.goto(base+'/financials?student=STU-M-001',{waitUntil:'networkidle',timeout:120000});await schedule.waitFor();assert.equal(await schedule.getByRole('button',{name:'Change billing date'}).count(),0,'coaches cannot change billing dates');
 profile.role='Student';await page.goto(base+'/profile?orders=open',{waitUntil:'networkidle',timeout:120000});await page.locator('#login-identifier').waitFor();assert.equal(await page.getByRole('button',{name:/^Notifications/}).count(),0,'the admin portal remains staff-only');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,billingAttempts:billingWrites.length,makeupAttempts:makeupWrites.length,notificationActions:inboxWrites.length,widths:[1440,834,390],pageErrors:errors.length}));
}catch(error){if(page)await page.screenshot({path:'scratch/membership-browser-failure.png',fullPage:true});throw error;}finally{await browser.close();}
