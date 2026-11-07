import assert from 'node:assert/strict';import {chromium} from 'playwright';import {loadTs} from '../tests/load-ts.mjs';
const {academyDate,addCalendarDays}=loadTs('lib/dates.ts');const base=process.argv[2]||'http://127.0.0.1:3000',today=academyDate(),past=addCalendarDays(today,-3);
const actor='92000000-0000-4000-8000-000000000001',invoiceId='92000000-0000-4000-8000-000000000002',sessionId='92000000-0000-4000-8000-000000000003',examId='92000000-0000-4000-8000-000000000004',bankId='92000000-0000-4000-8000-000000000005';
const profile={id:actor,username:'operations_fixture',email:'fixture@example.test',display_name:'Fixture owner',role:'Root',is_active:true,must_change_password:false};
const user={id:actor,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=level=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:level,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
let level='aal2',deny=false,fail=false,existingFactor=true,gatedReads=0,financeCase=false;const writes=[],errors=[];
let pendingEnrollment=false,pendingFactorId=examId,enrollmentRequests=0;
const student={id:'STU-M-001',khmer_name:'Fixture',english_name:'Fixture Athlete',gender:'Male',dob:'2010-01-01',registration_date:'2026-01-15',membership_start_date:'2026-01-15',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const policy={id:'default',reminder_lead_days:5,late_grace_days:5};let invoices=[{id:invoiceId,student_id:student.id,cycle_month:today.slice(0,7)+'-01',due_date:today,cycle_end:addCalendarDays(today,30),amount_usd:45,waiver_usd:0,balance:45}],receipts=[],credits=[],pauses=[],tasks=[];
const sessions=[{id:sessionId,class_id:1,class_name:'Fixture dated class',source_date:past,starts_at:past+'T01:00:00Z',ends_at:past+'T02:00:00Z',status:'scheduled',revision:1,roster_provenance:'reconstructed'}];let attendance=[];
const exam={id:examId,title:'Fixture grading',exam_date:past,passing_score:70,minimum_attendance:80,belts:{belt_name:'Yellow'},candidates:[]};
let lines=[{id:bankId,bank_reference:'fixture-bank-001',amount_usd:20,transaction_date:today}],review=null;
const fixtureData=view=>{
 if(view==='today'||view==='tasks')return {tasks,notices:[],today};
 if(view==='sessions')return {sessions,roster:[{occurrence_id:sessionId,student_id:student.id}],attendance,holidays:[]};
 if(view==='billing')return {invoices,receipts,credits,pauses,policy,allocations:[],uses:[]};
 if(view==='reconciliation')return {lines,receipts,collections:{total:receipts.reduce((sum,row)=>sum+row.amount_usd,0),legacy:0,receipts:20}};
 if(view==='grading')return {events:[exam],belts:[{id:1,belt_name:'White'},{id:2,belt_name:'Yellow'}]};
 if(view==='policy')return [policy];
 if(view==='health')return {serverTime:new Date().toISOString(),workerConfigured:true,pushConfigured:true,leases:[],failures:[],runs:[{id:'run',job_name:'notifications',status:'failed',started_at:new Date().toISOString(),finished_at:new Date().toISOString(),metrics:{failed:1},error_code:'FIXTURE_OUTAGE'}]};
 if(view==='quality')return {checkedAt:new Date().toISOString(),findings:[{key:'capacity:1',title:'Fixture capacity review',record:'Class 1',explanation:'Review the existing roster.',review}]};
 if(view==='performance')return [{page:'/operations',device:'phone',metric:'LCP',samples:12,p75:1700}];
 if(view==='timeline')return {events:[{id:'activity',category:'enrollment',title:'Class enrollment added',created_at:new Date().toISOString()}],enrollmentHistory:[{id:'history',class_id:1,event_type:'baseline',created_at:new Date().toISOString()}]};
 throw new Error('Unexpected operations view '+view);
};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});let page;
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token(level),refresh_token:'fixture-refresh'}});
   if(url.pathname==='/api/notifications')return json({success:true,data:{notices:[],preferences:{push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7},push:{ready:false,publicKey:''},refreshError:false}});
   if(url.pathname==='/api/performance'||url.pathname==='/api/telemetry/log')return json({success:true,data:{recorded:true}});
   if(url.pathname==='/api/operations'){
    if(request.method()==='GET')return json({success:true,data:fixtureData(url.searchParams.get('view'))});
    const body=request.postDataJSON();writes.push(body);if(fail)return json({success:false,error:{message:'Fixture write was not confirmed. Retry safely.'}},503);await new Promise(resolve=>setTimeout(resolve,120));
    if(body.action==='task')tasks.push({id:crypto.randomUUID(),title:body.title,description:body.description,student_id:body.studentId,category:body.category,assigned_to:body.assignedTo,due_date:body.dueDate,status:'open',revision:1});
    if(body.action==='task_update')tasks=tasks.map(row=>row.id===body.id?{...row,status:body.status,completion_note:body.note,revision:row.revision+1}:row);
    if(body.action==='payment'){invoices[0].balance-=body.allocations[0].amount;receipts.push({id:crypto.randomUUID(),receipt_number:'FIXTURE-RECEIPT',amount_usd:body.amount,payment_method:body.method,payment_date:body.paymentDate,external_reference:body.externalReference,student_id:student.id});if(body.amount>body.allocations[0].amount)credits.push({id:crypto.randomUUID(),reason:'Unallocated receipt balance',balance:body.amount-body.allocations[0].amount});}
    if(body.action==='pause')pauses.push({id:crypto.randomUUID(),start_date:body.startDate,resume_date:body.resumeDate,reason:body.reason});
    if(body.action==='reconcile')lines=lines.map(row=>row.id===body.bankLineId?{...row,receipt_id:body.receiptId}:row);
    if(body.action==='policy'){policy.reminder_lead_days=body.reminderLeadDays;policy.late_grace_days=body.lateGraceDays;}
    if(body.action==='quality_review')review={note:body.note,reviewed_at:new Date().toISOString()};
    if(body.action==='session_attendance')attendance=[{student_id:body.studentId,occurrence_id:body.occurrenceId,class_id:1,date:past,status:body.status}];
    if(body.action==='assess')exam.candidates=[{id:crypto.randomUUID(),student_id:body.studentId,score:body.score,status:'assessed',assessment_notes:body.notes,revision:1}];
    if(body.action==='promote'){if(!body.overrideReason)return json({success:false,error:{message:'An administrator override reason is required for reconstructed attendance.'}},400);exam.candidates[0].status='promoted';student.current_belt='Yellow';}
    return json({success:true,data:{saved:true}});
   }
   if(url.pathname.startsWith('/api/'))return json({success:false,error:{message:'Unexpected fixture API call'}},400);return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json({...user,factors:level==='aal1'&&existingFactor?[{id:examId,status:'verified',factor_type:'totp',friendly_name:'Fixture authenticator'}]:pendingEnrollment?[{id:pendingFactorId,status:'unverified',factor_type:'totp',friendly_name:'Fixture authenticator'}]:[]});
  if(url.pathname==='/auth/v1/factors'&&request.method()==='POST'){
   enrollmentRequests++;pendingEnrollment=true;pendingFactorId=crypto.randomUUID();
   return json({id:pendingFactorId,type:'totp',totp:{qr_code:'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="208" height="208"><rect width="208" height="208" fill="#fff"/></svg>\r\n',secret:'FIXTUREONLY',uri:'otpauth://totp/Fixture?secret=FIXTUREONLY'}});
  }
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token(level),refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.includes('/auth/v1/factors/')&&url.pathname.endsWith('/challenge'))return json({id:bankId,type:'totp',expires_at:Math.floor(Date.now()/1000)+300});
  if(url.pathname.includes('/auth/v1/factors/')&&url.pathname.endsWith('/verify')){const body=request.postDataJSON();const expectedFactor=existingFactor?examId:pendingFactorId;if(body.code!=='123456'||!url.pathname.includes('/'+expectedFactor+'/')||!existingFactor&&!pendingEnrollment)return json({code:'mfa_verification_failed',msg:'Invalid code'},422);level='aal2';pendingEnrollment=false;return json({user,access_token:token(level),refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});}
  if(url.pathname.startsWith('/rest/v1/')){
   assert.equal(request.method(),'GET','all direct database mutations are forbidden');const table=url.pathname.split('/').pop();
   if(table!=='profiles')try{if(JSON.parse(Buffer.from((request.headers().authorization??'').split('.')[1]??'','base64url').toString()).aal==='aal1')gatedReads++;}catch{}
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);if(table==='academy_profile')return json({id:'default',academy_name:'Fixture Academy',standard_tuition_usd:financeCase?60:45});
   if(financeCase&&table==='scholarships')return json([{id:1,type_name:'Standard',discount_percentage:100}]);
   if(financeCase&&table==='payments')return json([{id:1,student_id:student.id,year:Number(today.slice(0,4)),for_month:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(today.slice(5,7))-1],status:invoices[0].balance>0?'Pending':'Paid',amount_usd:10,payment_date:today,notes:'INV-'+invoiceId}]);
   const datasets={students:[student],members:[],branches:[{id:1,branch_name:'Fixture branch'}],class_sessions:[{id:1,branch_id:1,class_name:'Fixture class',days_of_week:['Monday'],day_of_week:'Monday',start_time:'08:00',end_time:'09:00',capacity:35}],class_enrollments:[{id:1,student_id:student.id,class_id:1,enrollment_date:'2026-01-15'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],academy_operations_policy:[policy],membership_invoices:invoices.map(row=>({...row,balance_usd:row.balance})),membership_pauses:pauses,user_permissions:deny?[{user_id:actor,permission_key:'page:financials',is_granted:true},{user_id:actor,permission_key:'action:finance_record_payment',is_granted:false}]:[]};return json(datasets[table]||[]);
  }
  return route.abort();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.locator('#login-identifier').fill(profile.username);await page.locator('#login-password').fill('Fixture-Password');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');
 await page.goto(base+'/operations',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('button',{name:'Create a follow-up',exact:true}).count();await page.getByText('Create a follow-up',{exact:true}).click();const taskForm=page.getByRole('form',{name:'New follow-up',exact:true});await taskForm.getByLabel('Title',{exact:true}).fill('Call fixture guardian');await taskForm.getByLabel('Context / next action',{exact:true}).fill('Confirm the planned return date');
 fail=true;await taskForm.getByRole('button',{name:'Assign follow-up',exact:true}).click();await page.getByRole('alert').filter({hasText:'Fixture write'}).waitFor();assert.equal(await taskForm.getByLabel('Title',{exact:true}).inputValue(),'Call fixture guardian');fail=false;await taskForm.getByRole('button',{name:'Assign follow-up',exact:true}).evaluate(button=>{button.click();button.click();});await page.getByRole('heading',{name:'Call fixture guardian',exact:true}).waitFor();assert.equal(writes.filter(row=>row.action==='task').length,2);assert.equal(writes[0].requestKey,writes[1].requestKey);
 const update=page.getByRole('form',{name:'Update Call fixture guardian',exact:true});await update.getByLabel('Task status',{exact:true}).selectOption('completed');await update.getByLabel('Outcome / correction reason',{exact:true}).fill('Guardian confirmed return next week');await update.getByRole('button',{name:'Update follow-up',exact:true}).click();await page.getByLabel('Show completed and cancelled tasks',{exact:true}).check();await page.getByText('Outcome: Guardian confirmed return next week',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Invoices & pauses',exact:true}).click();await page.getByLabel('Student invoice ledger',{exact:true}).selectOption(student.id);await page.getByText('Record a full or partial payment',{exact:true}).click();const payment=page.getByRole('form',{name:'Record received funds',exact:true});await payment.getByLabel('Total funds received (USD)',{exact:true}).fill('20');await payment.getByLabel('Apply to this invoice (USD)',{exact:true}).fill('10');await payment.getByLabel('Payment method',{exact:true}).selectOption('Bank Transfer');await payment.getByLabel('Bank / card reference (required for non-cash)',{exact:true}).fill('fixture-bank-001');await payment.getByLabel(/I verified the funds/).check();await payment.getByRole('button',{name:'Record payment and allocation',exact:true}).click();await page.getByText('$35.00',{exact:true}).waitFor();assert.equal(receipts.length,1);assert.equal(credits[0].balance,10);
 await page.getByText('Approve a pause or return',{exact:true}).click();const pause=page.getByRole('form',{name:'Approve membership pause',exact:true});await pause.getByLabel('First paused date',{exact:true}).fill(addCalendarDays(today,5));await pause.getByLabel('Return date (training resumes)',{exact:true}).fill(addCalendarDays(today,40));await pause.getByLabel('Approval reason',{exact:true}).fill('Approved family travel and return');await pause.getByRole('button',{name:'Approve pause',exact:true}).click();await page.getByText('Approved family travel and return',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Reconciliation',exact:true}).click();await page.getByRole('button',{name:'Confirm receipt match',exact:true}).click();await page.getByText(/Matched to a receipt/).waitFor();assert.ok(lines[0].receipt_id);
 await page.getByRole('button',{name:'Dated classes',exact:true}).click();await page.getByRole('button',{name:'Roster and session actions',exact:true}).click();await page.getByRole('button',{name:'Present',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Present'&&button.getAttribute('aria-pressed')==='true'));assert.equal(attendance[0].status,'Present');
 await page.getByRole('button',{name:'Grading',exact:true}).click();await page.getByText('Record an assessment',{exact:true}).click();const assessment=page.getByRole('form',{name:'Assess for Fixture grading',exact:true});await assessment.getByLabel('Assessment score (%)',{exact:true}).fill('80');await assessment.getByLabel('Coach assessment notes',{exact:true}).fill('Required techniques assessed');await assessment.getByRole('button',{name:'Save assessment',exact:true}).click();const promote=page.getByRole('form',{name:'Confirm promotion after eligibility checks',exact:true});await promote.waitFor();await promote.getByLabel('Administrator exception reason (only if requirements are not met)',{exact:true}).fill('Historical attendance evidence reviewed by owner');await promote.getByRole('button',{name:'Check eligibility and promote',exact:true}).click();await page.getByText(/80% · promoted/).waitFor();
 await page.getByRole('button',{name:'Job health',exact:true}).click();await page.getByText(/latest worker run needs attention/).waitFor();const timing=page.getByRole('form',{name:'Billing timing',exact:true});await timing.getByLabel('Remind before due date (days)',{exact:true}).fill('3');await timing.getByLabel('Grace after due date (days)',{exact:true}).fill('7');await timing.getByRole('button',{name:'Save billing timing',exact:true}).click();await page.waitForTimeout(150);assert.equal(policy.reminder_lead_days,3);assert.equal(policy.late_grace_days,7);
 await page.getByRole('button',{name:'Data quality',exact:true}).click();await page.getByText('Record a review',{exact:true}).click();const quality=page.getByRole('form',{name:'Review Class 1',exact:true});await quality.getByLabel('Evidence checked / next action',{exact:true}).fill('Roster assigned to head coach for review');await quality.getByRole('button',{name:'Save review note',exact:true}).click();await page.getByText(/Last review: Roster assigned/).waitFor();await page.getByRole('heading',{name:'Fixture capacity review',exact:true}).waitFor();
 await page.getByRole('button',{name:'Performance',exact:true}).click();await page.getByText('1700 ms',{exact:true}).waitFor();
 for(const viewport of [{width:1440,height:1000},{width:834,height:1112},{width:390,height:844}]){await page.setViewportSize(viewport);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+viewport.width);await page.screenshot({path:`scratch/operations-${viewport.width}.png`});}
 financeCase=true;student.student_status='Paused';await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/financials',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Fixture Athlete',exact:true}).first().waitFor();await page.getByRole('button',{name:'Renewal Calendar',exact:true}).click();await page.getByText('$35.00',{exact:true}).first().waitFor();
 invoices[0].balance=0;await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Revenue Dashboard',exact:true}).click();assert.equal(await page.getByText('$35.00',{exact:true}).count(),0,'credit-settled tuition must not remain outstanding');financeCase=false;student.student_status='Active';invoices[0].balance=35;
 deny=true;profile.role='Coach';await page.goto(base+'/operations?view=billing&student='+student.id,{waitUntil:'networkidle',timeout:120000});await page.getByRole('region',{name:'Invoices, partial payments and pauses',exact:true}).waitFor();assert.equal(await page.getByText('Record a full or partial payment',{exact:true}).count(),0,'denied finance write permission hides collection controls');assert.equal(await page.getByText('Approve a pause or return',{exact:true}).count(),0,'coaches cannot approve pauses');
 profile.role='Root';deny=false;level='aal1';await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.locator('#login-identifier').fill(profile.username);await page.locator('#login-password').fill('Fixture-Password');await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:'Administrator verification',exact:true}).waitFor();const code=page.getByLabel('Authenticator code',{exact:true});await code.fill('000000');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Verification was not confirmed'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Academy operations',exact:true}).count(),0);await code.fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.waitForURL('**/dashboard');await page.goto(base+'/operations',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Academy operations',exact:true}).waitFor();
 existingFactor=false;level='aal1';await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#login-identifier').fill(profile.username);
 await page.locator('#login-password').fill('Fixture-Password');
 await page.locator('button[type=submit]').click();
 await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
 const qrImage=page.getByRole('img',{name:'Scan this code using your authenticator app'});
 await qrImage.waitFor();
 await page.waitForFunction(()=>{
  const image=document.querySelector('img[alt="Scan this code using your authenticator app"]');
  return image?.complete && image.naturalWidth>0;
 });
 assert.equal(await qrImage.evaluate(image=>decodeURIComponent(image.src.slice(image.src.indexOf(',')+1)).endsWith('</svg>\r\n')),true,'the complete multiline SVG must reach the image decoder');
 assert.ok(await qrImage.evaluate(image=>image.getBoundingClientRect().width>=280),'desktop QR has enough display area for scanning');
 await page.getByText('Enter setup key manually',{exact:true}).click();
 await page.getByText('Time based',{exact:true}).waitFor();
 await page.getByText('FIXTUREONLY',{exact:true}).waitFor();
 await page.screenshot({path:'scratch/mfa-setup-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'MFA setup has no mobile horizontal overflow');
 await page.screenshot({path:'scratch/mfa-setup-mobile.png',fullPage:true});
 await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
 await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Verification was not confirmed'}).waitFor();
 const enrolledQr=await qrImage.getAttribute('src');
 const retryVerification=page.getByRole('button',{name:'Retry verification',exact:true});
 await retryVerification.click();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Retry verification'&&!button.disabled));
 await qrImage.waitFor();
 assert.equal(await qrImage.getAttribute('src'),enrolledQr,'status retry preserves the pending QR');
 await page.getByText('FIXTUREONLY',{exact:true}).waitFor();
 assert.equal(enrollmentRequests,1,'status retry does not replace the authenticator already added on the phone');
 assert.equal(level,'aal1','retry cannot bypass the authenticator code');
 pendingEnrollment=false;
 await retryVerification.click();
 await page.getByRole('button',{name:'Set up authenticator',exact:true}).waitFor();
 assert.equal(await qrImage.count(),0,'a revoked pending factor clears its QR');
 assert.equal(await page.getByText('FIXTUREONLY',{exact:true}).count(),0,'a revoked pending factor clears its setup key');
 await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
 await qrImage.waitFor();
 assert.equal(enrollmentRequests,2,'a missing factor can be enrolled again explicitly');
 await page.getByLabel('Authenticator code',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
 await page.waitForURL('**/dashboard');
 assert.equal(gatedReads,0,'administrator private datasets wait for verified MFA');assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,writes:writes.length,widths:[1440,834,390],mfaChallenge:true,mfaEnrollment:true,mfaPendingRetry:true,mfaRevokedSetup:true,financeInvoiceSnapshots:true,deniedPermission:true,pageErrors:errors.length}));
}catch(error){if(page)await page.screenshot({path:'scratch/operations-browser-failure.png',fullPage:true});throw error;}finally{await browser.close();}


