import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:3000';
const id='72000000-0000-4000-8000-000000000001';
const profile={id,username:'business_fixture',email:'business@example.test',display_name:'Fixture Admin',role:'Admin',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',aal:'aal2',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh'}).format(new Date());
const day=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Phnom_Penh',weekday:'long'}).format(new Date());
const student=(id,name)=>({id,khmer_name:'Fixture',english_name:name,gender:'Male',dob:'2010-01-01',registration_date:'2025-01-01',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[],telegram_username:'fixture_athlete',email:'athlete@example.test',phone:'012345678'});
const lessons=[{id:1,branch_id:1,class_name:'Fixture First',day_of_week:day,days_of_week:[day],start_time:'08:00',end_time:'09:00',capacity:1,class_type:'General Class',coach_id:id},{id:2,branch_id:1,class_name:'Fixture Second',day_of_week:day,days_of_week:[day],start_time:'10:00',end_time:'11:00',capacity:1,class_type:'General Class',coach_id:id}];
const errors=[];const studentSaves=[];const staffSaves=[];let handle='fixture_athlete';const member={id,english_name:'Fixture Admin',khmer_name:'Fixture',gender:'Male',dob:'1980-01-01',phone:'012345679',telegram_username:'fixture_coach',member_addresses:[]};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
let page;
try {
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname==='/api/telemetry/log')return json({success:true});
   if(url.pathname==='/api/admin/update-student'){const body=route.request().postDataJSON();studentSaves.push(body);handle=body.data.telegramUsername.replace(/^@/,'').toLowerCase();return json({success:true,data:{id:body.id}});}
   if(url.pathname==='/api/admin/update-user'){const body=route.request().postDataJSON();staffSaves.push(body);member.telegram_username=body.data.telegramUsername.replace(/^@/,'').toLowerCase();return json({success:true,data:{id:body.id}});}
   if(url.pathname.startsWith('/api/admin/'))return json({success:true,data:[]});
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   assert.equal(route.request().method(),'GET','no direct or live database writes');
   const table=url.pathname.split('/').pop();
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture Academy'});
   if(table==='user_permissions')return json([]);
   if(table==='members')return json(url.searchParams.has('id')?member:[member]);
   const datasets={students:[{...student('STU-M-001','Fixture Athlete'),telegram_username:handle},student('STU-M-002','Second Athlete')],branches:[{id:1,branch_name:'Fixture branch'}],class_sessions:lessons,class_enrollments:[{id:1,student_id:'STU-M-001',class_id:1,enrollment_date:'2025-01-01'},{id:2,student_id:'STU-M-001',class_id:2,enrollment_date:'2025-01-01'},{id:3,student_id:'STU-M-002',class_id:2,enrollment_date:'2025-01-01'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],attendance:[{id:1,student_id:'STU-M-001',date:today,class_id:1,status:'Present'},{id:2,student_id:'STU-M-001',date:today,class_id:2,status:'Absent'}]};
   return json(datasets[table]||[]);
  }
  return route.abort();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});
 await page.locator('#login-identifier').fill('business_fixture');await page.locator('#login-password').fill('Fictional-Password');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');

 await page.goto(base+'/students',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('row').filter({hasText:'Fixture Athlete'}).click();
 const telegram=page.getByRole('link',{name:'Contact Fixture Athlete via Telegram'});
 assert.equal(await telegram.getAttribute('href'),'https://t.me/fixture_athlete');
 await page.getByRole('button',{name:/Edit Student Profile/i}).click();
 await page.getByLabel('Telegram username',{exact:true}).fill('@Updated_Athlete');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Confirm & Save',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#edit-student-telegram'));
 assert.equal(studentSaves.length,1);
 const edited=studentSaves[0].data;
 assert.equal(edited.telegramUsername,'@Updated_Athlete');
 assert.ok(!('id' in edited)&&!('profileId' in edited)&&!('statusChangedAt' in edited),'form does not send server-owned fields');
 assert.ok(edited.heightCm == null);assert.ok(edited.weightKg == null);
 assert.ok(!('address' in edited),'empty optional address is omitted');
 assert.equal(await telegram.getAttribute('href'),'https://t.me/updated_athlete');
 await page.getByRole('button',{name:'Close Panel',exact:true}).click();
 for(const size of [{width:1440,height:1000},{width:834,height:1112},{width:390,height:844}]){
  await page.setViewportSize(size);
  await page.goto(base+'/financials',{waitUntil:'networkidle',timeout:120000});
  const contact=page.getByRole('link',{name:'Contact Fixture Athlete via Telegram'}).filter({visible:true}).first();
  await contact.waitFor();assert.equal(await contact.getAttribute('href'),'https://t.me/updated_athlete');
  const before=await page.getByRole('button',{name:'Close student dossier'}).count();
  // Clicking a contact control must not also open the parent student dossier.
  const popupPromise=context.waitForEvent('page');await contact.click();const popup=await popupPromise;await popup.close();
  assert.equal(await page.getByRole('button',{name:'Close student dossier'}).count(),before);
  await page.getByRole('button',{name:'Fixture Athlete',exact:true}).filter({visible:true}).first().click();
  await page.getByRole('button',{name:'Close student dossier'}).waitFor();
  await page.getByRole('button',{name:'Close student dossier'}).click();
  await page.getByRole('button',{name:'Renewal Calendar',exact:true}).click();
  await page.getByTitle('Agenda Cohort Stream',{exact:true}).click();
  const agendaContact=page.getByRole('link',{name:'Contact Fixture Athlete via Telegram'}).filter({visible:true}).first();
  await agendaContact.waitFor();assert.equal(await agendaContact.getAttribute('href'),'https://t.me/updated_athlete');
  await page.getByRole('button',{name:'Fixture Athlete',exact:true}).click();
  await page.getByRole('button',{name:'Close student dossier'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Contact Fixture Athlete via Email'}).filter({visible:true}).last().getAttribute('href'),'mailto:athlete@example.test?subject=Tuition%20renewal');
  await page.getByRole('button',{name:'Close student dossier'}).click();
  await page.getByRole('button',{name:'Cohort',exact:true}).first().click();
  await page.getByRole('button',{name:'Close renewal cohort modal'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Contact Fixture Athlete via Telegram'}).filter({visible:true}).last().getAttribute('href'),'https://t.me/updated_athlete');
  await page.getByRole('button',{name:'Fixture Athlete',exact:true}).filter({visible:true}).last().click();
  await page.getByRole('button',{name:'Close renewal cohort modal'}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Close student dossier'}).click();
  await page.getByTitle('Month Grid View',{exact:true}).click();
  await page.getByText('1',{exact:true}).first().click();
  await page.getByRole('button',{name:'Close renewal cohort modal'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Contact Fixture Athlete via Telegram'}).filter({visible:true}).last().getAttribute('href'),'https://t.me/updated_athlete');
  await page.getByRole('button',{name:'Close renewal cohort modal'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no page overflow at '+size.width);
  await page.goto(base+'/members',{waitUntil:'networkidle',timeout:120000});
  const staffContact=page.getByRole('link',{name:'Contact Fixture Admin via Telegram'}).filter({visible:true}).first();
  await staffContact.waitFor();assert.equal(await staffContact.getAttribute('href'),'https://t.me/fixture_coach');
  await page.getByRole('button',{name:'Table view',exact:true}).click();
  await staffContact.waitFor();assert.equal(await staffContact.getAttribute('href'),'https://t.me/fixture_coach');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/members',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('button',{name:'Table view',exact:true}).click();
 await page.getByRole('row').filter({hasText:'Fixture Admin'}).click();
 await page.getByLabel('Telegram username',{exact:true}).fill('@Updated_Coach');
 await page.getByRole('button',{name:/^Save(?: Save)?$/i}).click();
 await page.getByRole('button',{name:'Confirm & Save',exact:true}).click();
 await page.getByRole('button',{name:'Close Staff Panel'}).waitFor({state:'hidden'});
 assert.equal(staffSaves.length,1);assert.equal(staffSaves[0].data.telegramUsername,'@Updated_Coach');
 assert.deepEqual(errors,[]);
 console.log('Contact browser checks passed: student edits, safe contact links, finance ledger, renewal agenda, clicked-student dossier and staff contacts at desktop, tablet and phone sizes. All services mocked; no live writes.');
}catch(error){if(page)console.error(JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,1200),errors}));throw error;}finally{await browser.close();}

