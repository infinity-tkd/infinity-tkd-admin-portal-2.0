import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Offline attendance: marks taken without a connection stay on the device, are sent on reconnect,
// and marks the server rejects are kept for review. Every request is mocked with fictional data.
// Usage: node scripts/check-offline-attendance-browser.mjs <baseUrl>
const base=(process.argv[2]||'http://127.0.0.1:3000').replace(/\/$/,'');
const actor='9c000000-0000-4000-8000-000000000002';
const profile={id:actor,username:'offline_fixture',email:'offline@example.test',display_name:'Offline fixture coach',role:'Root',is_active:true,must_change_password:false};
const user={id:actor,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const students=['Ari','Bo','Cy'].map((name,index)=>({id:`STU-O-00${index+1}`,khmer_name:'',english_name:`${name} Offline Fixture`,gender:'Male',dob:'2012-03-15',registration_date:'2026-01-15',membership_start_date:'2026-01-15',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[],phone:'+85512000000'}));
const everyDay=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const classSession={id:7,branch_id:1,class_name:'Offline fixture class',class_type:'General Class',day_of_week:'Monday',days_of_week:everyDay,start_time:'00:00',end_time:'23:59',capacity:20,standard_duration_mins:60};
let saveMode='accept',nextId=500;const saves=[];const errors=[];

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(session=>localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token',JSON.stringify(session)),{access_token:token,refresh_token:'fictional-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/notifications')return json({success:true,data:{notices:[],preferences:{push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7},push:{ready:false,publicKey:''}}});
   if(url.pathname==='/api/admin/student-summaries')return json({success:true,data:students});
   if(url.pathname.startsWith('/api/'))return json({success:true,data:[]});
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fictional-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').pop();
   if(table==='attendance'&&req.method()==='POST'){
    const rows=JSON.parse(req.postData()||'[]');saves.push({mode:saveMode,rows});
    if(saveMode==='reject')return json({code:'42501',message:'new row violates row-level security policy for table "attendance"',details:null,hint:null},403);
    return json(rows.map(row=>({id:nextId++,...row})),201);
   }
   if(!['GET','HEAD'].includes(req.method()))return json([]);
   if(table==='profiles'&&url.searchParams.get('id')==='eq.'+actor)return json(profile);
   if(table==='members'&&url.searchParams.get('id')==='eq.'+actor)return json(null);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture academy',enable_audio_chimes:false});
   const data={profiles:[profile],students,branches:[{id:1,branch_name:'Fixture branch',is_active:true}],class_sessions:[classSession],class_enrollments:students.map((row,index)=>({id:index+1,student_id:row.id,class_id:7,enrollment_date:'2026-01-15',enrolled_at:'2026-01-15T00:00:00Z'})),scholarships:[{id:1,type_name:'Standard',discount_percentage:0}]};
   return json(data[table]||[]);
  }
  return route.abort();
 });
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>{errors.push('native dialog: '+dialog.message());void dialog.dismiss();});
 const queued=()=>page.evaluate(async()=>{
  if(!(await indexedDB.databases()).some(db=>db.name==='infinity_attendance_queue'))return [];
  return new Promise(resolve=>{const open=indexedDB.open('infinity_attendance_queue');open.onsuccess=()=>{const db=open.result;if(!db.objectStoreNames.contains('marks')){db.close();resolve([]);return;}const all=db.transaction('marks','readonly').objectStore('marks').getAll();all.onsuccess=()=>{db.close();resolve(all.result);};};open.onerror=()=>resolve(null);});
 });
 const waitForQueue=async(predicate,label)=>{for(let attempt=0;attempt<60;attempt++){const marks=await queued();if(predicate(marks))return marks;await page.waitForTimeout(250);}throw new Error('Timed out waiting: '+label+' '+JSON.stringify(await queued()));};

 await page.goto(base+'/dashboard',{waitUntil:'networkidle',timeout:180000});
 const rosterRow=name=>page.locator('div').filter({hasText:name}).filter({has:page.getByRole('button',{name:'Present',exact:true})}).last();
 await rosterRow('Ari Offline Fixture').waitFor({timeout:120000});

 // 1. Offline: the mark is kept on the device, nothing is sent and no error is shown.
 await context.setOffline(true);
 await rosterRow('Ari Offline Fixture').getByRole('button',{name:'Present',exact:true}).click();
 const first=await waitForQueue(marks=>marks.length===1,'one queued mark');
 assert.equal(first[0].studentId,'STU-O-001');assert.equal(first[0].status,'Present');assert.equal(first[0].classId,7);assert.equal(first[0].userId,actor);
 assert.ok(!JSON.stringify(first).includes(token),'no session token is stored with the mark');
 assert.equal(saves.length,0,'nothing is sent while offline');
 await page.getByText(/1 mark waiting/).waitFor({timeout:10000});

 // 2. Reconnect: the mark is sent once and leaves the device.
 await context.setOffline(false);
 await waitForQueue(marks=>marks.length===0,'queue sent');
 assert.equal(saves.length,1);assert.equal(saves[0].rows[0].student_id,'STU-O-001');assert.equal(saves[0].rows[0].status,'Present');

 // 3. A mark the server rejects is kept for review, then discarded on request.
 await context.setOffline(true);
 await rosterRow('Bo Offline Fixture').getByRole('button',{name:'Late',exact:true}).click();
 await waitForQueue(marks=>marks.length===1,'second queued mark');
 saveMode='reject';
 await context.setOffline(false);
 const rejected=await waitForQueue(marks=>marks.length===1&&Boolean(marks[0].failedReason),'rejected mark flagged');
 assert.match(rejected[0].failedReason,/rejected/);
 const banner=page.getByRole('alert').filter({hasText:'could not be saved'});
 await banner.waitFor({timeout:10000});
 assert.ok(await banner.getByText(/Bo Offline Fixture/).isVisible(),'the banner names the student');
 saveMode='accept';
 await banner.getByRole('button',{name:'Discard',exact:true}).click();
 const confirm=page.getByRole('alertdialog').filter({hasText:'Discard 1 attendance mark'});
 await confirm.getByRole('button',{name:/confirm/i}).click();
 await waitForQueue(marks=>marks.length===0,'rejected mark discarded');
 await banner.waitFor({state:'hidden'});

 assert.deepEqual(errors,[],'no page errors or browser pop-ups');
 console.log(JSON.stringify({passed:true,sends:saves.length,checks:['kept offline without a token','sent on reconnect','rejected mark kept for review','discard clears it']}));
}finally{await browser.close();}
