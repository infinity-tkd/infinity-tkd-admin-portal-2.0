import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:3000';
const id='72000000-0000-4000-8000-000000000001';
const profile={id,username:'business_fixture',email:'business@example.test',display_name:'Fixture Admin',role:'Admin',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh'}).format(new Date());
const day=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Phnom_Penh',weekday:'long'}).format(new Date());
const student=(id,name)=>({id,khmer_name:'Fixture',english_name:name,gender:'Male',dob:'2010-01-01',registration_date:'2025-01-01',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]});
const lessons=[{id:1,branch_id:1,class_name:'Fixture First',day_of_week:day,days_of_week:[day],start_time:'08:00',end_time:'09:00',capacity:1,class_type:'General Class',coach_id:id},{id:2,branch_id:1,class_name:'Fixture Second',day_of_week:day,days_of_week:[day],start_time:'10:00',end_time:'11:00',capacity:1,class_type:'General Class',coach_id:id}];
 let achievements=[{id:41,student_id:'STU-M-001',event_name:'Original championship',date:today,category:'Recognized Poomsae',division:'Male Division',medal_rank:'Gold'}];
let outage=true;let denyEdit=false;const saves=[];const errors=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname==='/api/telemetry/log')return json({success:true});
   if(url.pathname==='/api/admin/achievements'){
    const body=route.request().postDataJSON();saves.push(body);
    if(outage)return json({success:false,error:{message:'Fictional achievement outage'}},503);
    const records=body.entries.map((entry,index)=>({id:entry.id||100+index,student_id:body.studentId,event_name:entry.eventName,date:entry.date,category:entry.category,division:entry.division,medal_rank:entry.medalRank,notes:entry.notes,age_division:entry.ageDivision,belt_division:entry.beltDivision}));
    achievements=[...achievements.filter(row=>!body.deletedIds.includes(row.id)&&!records.some(saved=>saved.id===row.id)),...records];
    return json({success:true,data:{records,deletedIds:body.deletedIds}});
   }
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
   if(table==='user_permissions')return json(denyEdit?[{user_id:id,permission_key:'action:student_edit',is_granted:false}]:[]);
   const datasets={students:[student('STU-M-001','Fixture Athlete'),student('STU-M-002','Second Athlete')],branches:[{id:1,branch_name:'Fixture branch'}],class_sessions:lessons,class_enrollments:[{id:1,student_id:'STU-M-001',class_id:1,enrollment_date:'2025-01-01'},{id:2,student_id:'STU-M-001',class_id:2,enrollment_date:'2025-01-01'},{id:3,student_id:'STU-M-002',class_id:2,enrollment_date:'2025-01-01'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],attendance:[{id:1,student_id:'STU-M-001',date:today,class_id:1,status:'Present'},{id:2,student_id:'STU-M-001',date:today,class_id:2,status:'Absent'}],achievements};
   return json(datasets[table]||[]);
  }
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});
 await page.locator('#login-identifier').fill('business_fixture');await page.locator('#login-password').fill('Fictional-Password');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');
 await page.goto(base+'/attendance',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('combobox',{name:'Attendance class'}).selectOption('1');
 await page.getByRole('button',{name:/^Present\s+1$/i}).click();await page.getByText('STU-M-001',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Attendance class'}).selectOption('2');
 await page.getByRole('button',{name:/^Present\s+0$/i}).click();
 assert.equal(await page.getByText('STU-M-001',{exact:true}).count(),0,'class 2 Present filter cannot inherit class 1 Present');
 await page.getByRole('button',{name:/^Absent\s+1$/i}).click();await page.getByText('STU-M-001',{exact:true}).waitFor();
 await page.goto(base+'/schedule',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('alert').filter({hasText:'Roster review required'}).getByText(/Fixture Second: 2 active students \/ capacity 1/).waitFor();
 await page.goto(base+'/students',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('row').filter({hasText:'Fixture Athlete'}).click();
 await page.getByRole('button',{name:/^Achievements\s*1$/}).click();
 await page.getByText('Original championship',{exact:true}).waitFor();
 await page.getByText('Original championship',{exact:true}).hover();
 await page.getByTitle('Edit Achievement',{exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Tournament achievements'});
 await dialog.getByRole('textbox',{name:'Achievement event name'}).fill('Updated championship');
 await dialog.getByRole('button',{name:'Save',exact:true}).click();
 const notice=page.getByRole('alertdialog');await notice.getByText('Fictional achievement outage',{exact:false}).waitFor();await notice.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await dialog.getByRole('textbox',{name:'Achievement event name'}).inputValue(),'Updated championship','draft retained after failure');
 assert.equal(achievements[0].event_name,'Original championship','failed batch leaves the record unchanged');
 outage=false;await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(saves.length,2);assert.equal(saves[0].requestKey,saves[1].requestKey,'retry retains its request key');assert.equal(achievements[0].event_name,'Updated championship');
 denyEdit=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.getByTitle('Edit Achievement',{exact:true}).waitFor({state:'detached'});
 await page.getByText('Updated championship',{exact:true}).waitFor();
 assert.equal(await page.getByTitle('Edit Achievement',{exact:true}).count(),0,'denied student-edit override hides achievement edits');
 assert.deepEqual(errors,[]);
 console.log('Business browser checks passed: class-specific filters, capacity review alert, atomic achievement request, retained draft, retry key and denied edit permission. All services mocked; no live writes.');
}finally{await browser.close();}
