import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadTs } from '../tests/load-ts.mjs';

const { academyDate, addCalendarDays } = loadTs('lib/dates.ts');
const { eventCreateSchema, eventUpdateSchema } = loadTs('lib/calendar-contract.ts');
const base = process.argv[2] ?? 'http://127.0.0.1:3194';
const today = academyDate();
const actor = '94000000-0000-4000-8000-000000000001';
const profile = { id: actor, username: 'calendar_fixture', email: 'fixture@example.test', display_name: 'Fixture administrator', role: 'Root', is_active: true, must_change_password: false };
const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
const draft = { title: 'Fixture academy workshop', type: 'workshop', lifecycle: 'scheduled', startDate: today, endDate: today, startsAt: null, endsAt: null, timezone: 'Asia/Phnom_Penh', location: 'Fixture dojang', description: 'A published training workshop.', internalNotes: 'Private fixture coordination', audience: { mode: 'all', branchIds: [], classIds: [], studentIds: [] }, attachments: [], changeReason: '' };
let events = [{ ...draft, id: '94000000-0000-4000-8000-000000000002', revision: 2, publishedRevision: 2, hasUnpublishedChanges: false, lastNotifiedRevision: null, editable: true }, { ...draft, id: '94000000-0000-4000-8000-000000000007', title: 'Fixture class timetable notice', type: 'class_change', startDate: addCalendarDays(today, 2), endDate: addCalendarDays(today, 2), revision: 1, publishedRevision: 1, hasUnpublishedChanges: false, lastNotifiedRevision: null, editable: true }];
let failRead = true, failCreate = true, failNotice = true, failArchive = true, readOnly = false;
const writes = [], errors = [], diagnostics = [], paths = [];
let uploadRequests = 0, downloadRequests = 0;
const fileId = '94000000-0000-4000-8000-000000000004';
const competitionA='94000000-0000-4000-8000-000000000005',competitionB='94000000-0000-4000-8000-000000000006';
const student={id:'STU-M-001',khmer_name:'Fixture',english_name:'Fixture Athlete',gender:'Male',dob:'2010-01-01',registration_date:today,membership_start_date:today,scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const achievements=[101,102,103].map((id,index)=>({id,student_id:student.id,event_name:'Fixture twin cup',event_id:index<2?competitionA:competitionB,date:today,category:index===1?'Kyorugi':'Recognized Poomsae',division:'Male Division',medal_rank:'Gold',notes:'',age_division:'No Age Requirement',belt_division:'No Belt Requirement'}));
const achievementWrites=[];let failCompetitionLookup=false;
const permissions = () => ({ create: !readOnly, edit: !readOnly, publish: !readOnly, notify: !readOnly, archive: !readOnly });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
let page;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.addInitScript(({ session }) => {
    localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token', JSON.stringify(session));
  }, { session: { access_token: token, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user } });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  // Other implementation work can rebuild shared modules during this isolated fixture.
  await context.routeWebSocket('**/_next/webpack-hmr*', socket => socket.close());
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/_next/')) paths.push(`${request.method()} ${url.pathname}`);
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'fixture-refresh' } });
      if (url.pathname === '/api/notifications') return json({ success: true, data: { notices: [], preferences: { push_enabled: false, muted_categories: [], quiet_start: 22, quiet_end: 7 }, push: { ready: false, publicKey: '' }, refreshError: false } });
      if (url.pathname === '/api/performance' || url.pathname.startsWith('/api/telemetry')) return json({ success: true, data: { recorded: true } });
      if (url.pathname === '/api/admin/events' && request.method() === 'GET') {
        if (failRead) return json({ success: false, error: { message: 'Fixture calendar service unavailable. Retry shortly.' } }, 503);
        return json({ success: true, data: { events: events.map(event => ({ ...event, editable: !readOnly && !event.archivedAt })), nextCursor: null, permissions: permissions(), lookups: { branches: [{ id: 1, name: 'Fixture branch' }], classes: [{ id: 1, name: 'Fixture junior class' }], students: [{ id: 'STU-M-001', name: 'Fixture athlete' }] } } });
      }
      if(url.pathname==='/api/admin/events/competitions')return failCompetitionLookup?json({success:false,error:{message:'Fixture competition lookup unavailable.'}},503):json({success:true,data:{competitions:[{id:competitionA,title:'Fixture renamed cup',startDate:today},{id:competitionB,title:'Fixture twin cup',startDate:today}]}});
      if(url.pathname==='/api/admin/achievements'&&request.method()==='POST'){
        const body=request.postDataJSON();achievementWrites.push(body);
        const records=[];for(const entry of body.entries){const existing=achievements.find(row=>row.id===entry.id),id=existing?.id??100+achievements.length+1;const row={id,student_id:student.id,event_name:existing&&entry.eventId===existing.event_id?existing.event_name:entry.eventName,event_id:entry.eventId===undefined?existing?.event_id??null:entry.eventId,date:entry.date,category:entry.category,division:entry.division,medal_rank:entry.medalRank,notes:entry.notes??'',age_division:entry.ageDivision??null,belt_division:entry.beltDivision??null};if(existing)Object.assign(existing,row);else achievements.push(row);records.push(row);}
        return json({success:true,data:{records,deletedIds:body.deletedIds??[]}});
      }
      if(url.pathname==='/api/admin/partners')return json({success:true,data:[]});
      if (url.pathname.startsWith('/api/admin/events')) {
        if (url.pathname.endsWith('/files') && request.method() === 'POST') {
          assert.ok(request.headers().authorization?.startsWith('Bearer '));assert.ok(request.headers()['content-type']?.startsWith('multipart/form-data'));uploadRequests++;
          await new Promise(resolve => setTimeout(resolve, 500));
          const eventId = url.pathname.split('/')[4];
          return json({ success: true, data: { attachment: { id: fileId, label: 'Fixture guide.pdf', url: `https://lyjxmkyvqazqxkzoeszr.supabase.co/storage/v1/object/authenticated/academy-events/${eventId}/${fileId}.pdf` } } });
        }
        if (url.pathname.includes('/files/') && request.method() === 'GET') { assert.ok(request.headers().authorization?.startsWith('Bearer '));downloadRequests++;return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7\nFixture only\n%%EOF' }); }
        if (request.method() === 'GET') return json({ success: true, data: { event: events.find(event => event.id === url.pathname.split('/').at(-1)) } });
        const body = request.postDataJSON(); writes.push({ path: url.pathname, method: request.method(), body });
        await new Promise(resolve => setTimeout(resolve, 160));
        if (url.pathname === '/api/admin/events') {
          assert.equal(eventCreateSchema.safeParse(body).success, true, 'UI create payload matches backend schema');
          if (failCreate) return json({ success: false, error: { message: 'Fixture save was not confirmed. Retry safely.' } }, 503);
          const { requestKey, ...fields } = body; assert.ok(requestKey); assert.equal(fields.publishedRevision, undefined);
          const event = { ...fields, id: '94000000-0000-4000-8000-000000000003', revision: 1, publishedRevision: null, hasUnpublishedChanges: true, editable: true, lastNotifiedRevision: null };
          events.push(event); return json({ success: true, data: { event } });
        }
        const parts = url.pathname.split('/'), event = events.find(row => row.id === parts[4]); assert.ok(event);
        if (body.expectedRevision !== event.revision) return json({ success: false, error: { message: 'Fixture revision changed. Refresh first.' } }, 409);
        if (request.method() === 'PATCH') { assert.equal(eventUpdateSchema.safeParse(body).success, true, 'UI update payload matches backend schema');const { requestKey, expectedRevision, ...fields } = body; assert.ok(requestKey); assert.ok(expectedRevision); Object.assign(event, fields, { revision: event.revision + 1, hasUnpublishedChanges: true }); }
        else if (parts[5] === 'publications') { event.revision++; event.publishedRevision = event.revision; event.hasUnpublishedChanges = false; if (body.notifyStudents) event.lastNotifiedRevision = event.publishedRevision; }
        else if (parts[5] === 'notices') {
          if(failNotice)return json({success:false,error:{message:'Fixture notice was not confirmed. Retry safely.'}},503);
          event.lastNotifiedRevision = event.publishedRevision;
        }
        else if (parts[5] === 'archive') {
          assert.ok(body.reason.trim().length >= 5);assert.ok(body.requestKey);
          if(failArchive)return json({success:false,error:{message:'Fixture archive was not confirmed. Retry safely.'}},503);
          Object.assign(event,{archivedAt:new Date().toISOString(),archiveReason:body.reason,editable:false,revision:event.revision+1});
        }
        else throw Error('Unexpected event mutation');
        return json({ success: true, data: { event } });
      }
      if (url.pathname === '/api/operations') return json({ success: true, data: { events: [], tasks: [], notices: [], total: 0 } });
      if (url.pathname.startsWith('/api/')) return json({ success: false, error: { message: 'Unsupported fixture API' } }, 400);
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname.startsWith('/rest/v1/')) {
      assert.equal(request.method(), 'GET', 'No direct database mutations');
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Fixture academy', enable_audio_chimes: false });
      if(table==='students')return json([student]);if(table==='achievements')return json(achievements);if(table==='branches')return json([{id:1,branch_name:'Fixture branch'}]);if(table==='scholarships')return json([{id:1,type_name:'Standard',discount_percentage:0}]);
      return json([]);
    }
    return route.abort();
  });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));page.on('console',message=>{if(['error','warning'].includes(message.type()))diagnostics.push(message.text().slice(0,800));});
  await page.goto(base + '/calendar', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('alert').filter({ hasText: 'Fixture calendar service' }).waitFor(); failRead = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('button', { name: `Fixture academy workshop on ${today}`, exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Achievements', exact: true }).count(), 0); assert.equal(await page.getByRole('tab', { name: 'Announcements', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'New event', exact: true }).click(); const editor = page.getByRole('dialog', { name: 'New event', exact: true }); await editor.waitFor();
  await editor.getByLabel('Event title', { exact: true }).fill('Fixture new competition'); await editor.getByLabel('Event type', { exact: true }).selectOption('class_change');await editor.getByText('This is an information notice. Confirm actual session changes in Dated classes before publishing.',{exact:true}).waitFor();await editor.getByLabel('Event type', { exact: true }).selectOption('competition');
  await editor.getByLabel('First day', { exact: true }).fill(today); await editor.getByLabel('Last day, inclusive', { exact: true }).fill(today);
  await editor.getByLabel('Description for students', { exact: true }).fill('Bring water. <img src=x onerror=alert(1)>');
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click(); await editor.getByRole('alert').filter({ hasText: 'Fixture save' }).waitFor(); assert.equal(await editor.getByLabel('Event title', { exact: true }).inputValue(), 'Fixture new competition');
  failCreate = false; await editor.getByRole('button', { name: 'Save draft', exact: true }).evaluate(button => { button.click(); button.click(); });
  const details = page.getByRole('dialog', { name: 'Fixture new competition', exact: true }); await details.waitFor();
  assert.equal(writes.filter(write => write.path === '/api/admin/events').length, 2); assert.equal(writes[0].body.requestKey, writes[1].body.requestKey);
  assert.equal(await details.locator('img').count(), 0); await page.keyboard.press('Shift+Tab'); assert.ok(await details.evaluate(node => node.contains(document.activeElement)));
  await details.getByRole('button', { name: 'Review & publish', exact: true }).click(); const review = page.getByRole('dialog', { name: 'Review & publish', exact: true }); await review.waitFor();
  assert.ok(!await review.getByRole('checkbox',{name:'Notify students after publishing',exact:false}).isChecked(),'publishing starts with notification opt-in unchecked');
  await review.getByRole('region',{name:'Student notification preview',exact:true}).getByText('An academy update is available. Open the event for details.',{exact:true}).waitFor();
  await review.getByRole('button', { name: 'Publish event', exact: true }).click(); assert.equal(writes.filter(write => write.path.endsWith('/publications')).length, 0);
  await review.getByRole('checkbox', { name: 'I reviewed the public content, audience and event dates.', exact: true }).check(); await review.getByRole('button', { name: 'Publish event', exact: true }).click(); await details.waitFor();
  assert.equal(writes.find(write => write.path.endsWith('/publications')).body.notifyStudents, false);
  assert.equal(writes.filter(write=>write.path.endsWith('/notices')).length,0,'save and publish without opt-in send no notification');
  await details.getByRole('button', { name: 'Notify students', exact: true }).click();
  const noticeReview=page.getByRole('dialog',{name:'Review student notification',exact:true});await noticeReview.waitFor();
  const noticePreview=noticeReview.getByRole('region',{name:'Student notification preview',exact:true});
  await noticePreview.getByText('Fixture new competition',{exact:true}).waitFor();await noticePreview.getByText('An academy update is available. Open the event for details.',{exact:true}).waitFor();await noticePreview.getByText('All students',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await noticeReview.evaluate(node=>node.scrollWidth<=node.clientWidth),'notification review fits the mobile dialog');
  await page.screenshot({animations:'disabled',path:'scratch/calendar-admin-mobile-notification-preview.png'});
  await page.setViewportSize({width:1440,height:1000});
  await noticeReview.getByRole('button',{name:'Confirm notification',exact:true}).click();
  assert.equal(writes.filter(write=>write.path.endsWith('/notices')).length,0,'opening the preview and clicking without acknowledgment never sends');
  await noticeReview.getByRole('checkbox',{name:'I reviewed the message and intended audience.',exact:true}).check();
  await noticeReview.getByRole('button',{name:'Confirm notification',exact:true}).click();await noticeReview.getByRole('alert').filter({hasText:'Fixture notice'}).waitFor();
  assert.ok(await noticeReview.getByRole('checkbox',{name:'I reviewed the message and intended audience.',exact:true}).isChecked(),'a retry keeps the same reviewed revision');
  failNotice=false;await noticeReview.getByRole('button',{name:'Confirm notification',exact:true}).evaluate(button=>{button.click();button.click();});
  await details.getByRole('button', { name: 'Notification queued', exact: true }).waitFor();
  const noticeWrites=writes.filter(write=>write.path.endsWith('/notices'));assert.equal(noticeWrites.length,2);assert.equal(noticeWrites[0].body.requestKey,noticeWrites[1].body.requestKey,'notification retries preserve request identity');assert.equal(noticeWrites[0].body.expectedRevision,noticeWrites[1].body.expectedRevision);
  await details.getByRole('button', { name: 'Edit', exact: true }).click(); const edit = page.getByRole('dialog', { name: 'Edit event', exact: true }); await edit.waitFor(); await edit.getByLabel('Reason for change', { exact: true }).fill('Fixture date correction'); await edit.getByLabel('Last day, inclusive', { exact: true }).fill(addCalendarDays(today, 1)); await edit.getByRole('button', { name: 'Save draft', exact: true }).click(); await details.getByText('You are viewing working changes.', { exact: false }).waitFor();
  await details.getByRole('button', { name: 'Review & publish', exact: true }).click(); await review.getByRole('checkbox', { name: 'I reviewed the public content, audience and event dates.', exact: true }).check(); await review.getByRole('checkbox', { name: 'Notify students after publishing', exact: false }).check(); await review.getByRole('button', { name: 'Publish event', exact: true }).click(); await details.waitFor(); assert.equal(writes.filter(write => write.path.endsWith('/publications')).at(-1).body.notifyStudents, true); await details.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button',{name:`Fixture new competition on ${today}`,exact:true}).click();await details.getByRole('button',{name:'Edit',exact:true}).click();await edit.waitFor();
  await edit.getByRole('checkbox',{name:'All-day event',exact:true}).uncheck();await edit.getByLabel('Start time',{exact:true}).fill('09:00');await edit.getByLabel('End date',{exact:true}).fill(addCalendarDays(today,1));await edit.getByLabel('End time',{exact:true}).fill('00:00');await edit.getByLabel('Reason for change',{exact:true}).fill('Fixture timed midnight correction');
  await edit.getByLabel('Upload private event file',{exact:true}).setInputFiles({name:'Fixture guide.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nFixture only\n%%EOF')});await edit.getByRole('button',{name:'Uploading…',exact:true}).waitFor();assert.ok(await edit.getByRole('button',{name:'Uploading…',exact:true}).isDisabled());await edit.getByRole('status').filter({hasText:'Uploaded privately'}).waitFor();await edit.getByRole('button',{name:'Save draft',exact:true}).click();await details.waitFor();
  assert.equal(uploadRequests,1);assert.equal(writes.filter(write=>write.method==='PATCH').at(-1).body.endDate,today,'midnight endpoint is stored with its covered end date');
  const download=page.waitForEvent('download');await details.getByRole('button',{name:'Fixture guide.pdf',exact:false}).click();assert.equal((await download).suggestedFilename(),'Fixture guide.pdf');assert.equal(downloadRequests,1);
  await details.getByRole('button',{name:'Edit',exact:true}).click();await edit.waitFor();assert.equal(await edit.getByLabel('End date',{exact:true}).inputValue(),addCalendarDays(today,1),'existing midnight endpoint is preserved when reopening');await edit.getByRole('button',{name:'Cancel',exact:true}).click();await details.getByRole('button',{name:'Close',exact:true}).click();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 834, height: 1112 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${viewport.width}`); await page.screenshot({ animations: 'disabled', path: `scratch/calendar-admin-${viewport.width}.png` });
  }
  await page.evaluate(() => document.documentElement.classList.add('dark')); await page.screenshot({ animations: 'disabled', path: 'scratch/calendar-admin-dark.png' });
  await page.getByRole('button', { name: 'Open Fixture academy workshop', exact: true }).click(); const mobileDetails = page.getByRole('dialog', { name: 'Fixture academy workshop', exact: true }); await mobileDetails.waitFor(); assert.ok(await mobileDetails.evaluate(node => node.scrollWidth <= node.clientWidth)); await page.screenshot({ animations: 'disabled', path: 'scratch/calendar-admin-mobile-details.png' }); await page.keyboard.press('Escape');
  readOnly = true; await page.getByRole('button', { name: 'Refresh calendar', exact: true }).click(); await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'New event')); await page.getByRole('button', { name: 'Open Fixture academy workshop', exact: true }).click(); await mobileDetails.waitFor(); assert.equal(await mobileDetails.getByRole('button', { name: 'Edit', exact: true }).count(), 0); assert.equal(await mobileDetails.getByRole('button', { name: 'Notify students', exact: true }).count(), 0); await page.keyboard.press('Escape');
  readOnly=false;await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/students',{waitUntil:'networkidle',timeout:120000});await page.getByText('Fixture Athlete',{exact:true}).first().click();await page.getByRole('button',{name:/^Achievements/}).click();await page.locator('button[title="Edit Achievement"]').first().click();
  const achievementDialog=page.getByRole('dialog',{name:'Tournament achievements',exact:true});await achievementDialog.waitFor();assert.equal(await achievementDialog.getByPlaceholder('e.g. Score: 7.82, 1st match win by K.O.').count(),2,'different event IDs never merge into the same edit group');assert.equal(await achievementDialog.getByLabel('Achievement event name',{exact:true}).inputValue(),'Fixture twin cup');assert.ok(await achievementDialog.getByLabel('Achievement event name',{exact:true}).evaluate(node=>node.readOnly));
  failCompetitionLookup=true;await achievementDialog.getByLabel('Search calendar competitions',{exact:true}).fill('lookup failure');await achievementDialog.getByRole('alert').filter({hasText:'Fixture competition lookup'}).waitFor();assert.equal(await achievementDialog.getByLabel('Choose calendar competition',{exact:true}).locator('option').count(),2,'failed lookups keep only placeholder and saved link');
  await achievementDialog.getByRole('button',{name:'Enter manually',exact:true}).click();await achievementDialog.getByLabel('Achievement event name',{exact:true}).fill('Fixture manual cup');await achievementDialog.getByRole('button',{name:'Save',exact:true}).click();await achievementDialog.waitFor({state:'hidden'});assert.deepEqual(achievementWrites[0].entries.map(row=>row.id).sort(),[101,102]);assert.ok(achievementWrites[0].entries.every(row=>row.eventId===null&&row.eventName==='Fixture manual cup'));if(await page.getByRole('button',{name:'Dismiss Notification',exact:true}).isVisible())await page.getByRole('button',{name:'Dismiss Notification',exact:true}).click();
  failCompetitionLookup=false;await page.getByRole('button',{name:'+ Add Achievement',exact:true}).click();await achievementDialog.waitFor();assert.equal(await achievementDialog.getByLabel('Achievement event name',{exact:true}).inputValue(),'');await achievementDialog.getByRole('button',{name:'Link calendar competition',exact:true}).click();await achievementDialog.getByLabel('Choose calendar competition',{exact:true}).selectOption(competitionB);assert.equal(await achievementDialog.getByLabel('Achievement event name',{exact:true}).inputValue(),'Fixture twin cup');await achievementDialog.getByRole('button',{name:'Add Achievement',exact:true}).click();await achievementDialog.waitFor({state:'hidden'});assert.equal(achievementWrites.at(-1).entries[0].eventId,competitionB);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/calendar',{waitUntil:'networkidle',timeout:120000});
  await page.getByRole('button',{name:'Open Fixture academy workshop',exact:true}).click();
  const archiveDetails=page.getByRole('dialog',{name:'Fixture academy workshop',exact:true});
  await archiveDetails.getByRole('button',{name:'Archive event',exact:true}).click();
  assert.ok(await archiveDetails.getByRole('button',{name:'Confirm archive',exact:true}).isDisabled());
  const archiveReason=archiveDetails.getByLabel('Reason for archiving',{exact:true});
  await archiveReason.fill('Fixture obsolete planning notice');
  assert.ok(await archiveDetails.evaluate(node=>node.scrollWidth<=node.clientWidth));
  await page.screenshot({animations:'disabled',path:'scratch/calendar-admin-mobile-archive-review.png'});
  await archiveDetails.getByRole('button',{name:'Confirm archive',exact:true}).click();
  await archiveDetails.getByRole('alert').filter({hasText:'Fixture archive'}).waitFor();
  assert.equal(await archiveReason.inputValue(),'Fixture obsolete planning notice','failed archive retains its reason');
  failArchive=false;
  await archiveDetails.getByRole('button',{name:'Confirm archive',exact:true}).evaluate(button=>{button.click();button.click();});
  await archiveDetails.getByText('Archived · staff history',{exact:true}).waitFor();
  assert.equal(await archiveDetails.getByRole('button',{name:'Edit',exact:true}).count(),0);
  assert.equal(await archiveDetails.getByRole('button',{name:'Notify students',exact:true}).count(),0);
  assert.equal(await archiveDetails.getByRole('button',{name:'Review & publish',exact:true}).count(),0);
  assert.equal(await archiveDetails.getByRole('button',{name:'Archive event',exact:true}).count(),0);
  assert.equal(await archiveDetails.getByRole('button',{name:'Confirm archive',exact:true}).count(),0);
  const archiveWrites=writes.filter(write=>write.path.endsWith('/archive'));
  assert.equal(archiveWrites.length,2,'only one retry is submitted despite a double click');
  assert.equal(archiveWrites[0].body.requestKey,archiveWrites[1].body.requestKey,'archive retries preserve their request identity');
  assert.equal(archiveWrites[0].body.expectedRevision,archiveWrites[1].body.expectedRevision);
  await page.screenshot({animations:'disabled',path:'scratch/calendar-admin-mobile-archived.png'});
  await archiveDetails.getByRole('button',{name:'Close',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.locator('aside').getByText('Fixture academy workshop',{exact:true}).count(),0,'archived events are retained in the calendar history without appearing in Coming up');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, fixtureOnly: true, draftRetry: true, idempotency: true, publishReview: true, saveAndNotify: true, unpublishedEdit: true, privateUpload:true,authorizedDownload:true,timedMidnight:true,readOnly: true,achievementGrouping:true,manualCompetitionFallback:true,linkedCompetition:true,notificationReview:true,notificationRetry:true,archiveReview:true,archiveRetry:true,archivedReadOnly:true,classChangeCategory:true, widths: [1440, 834, 390], keyboard: true, javascriptErrors: 0, liveWrites: 0 }));
} catch (error) {
  if (page) { await page.screenshot({ animations: 'disabled', path: 'scratch/calendar-admin-failure.png' }); console.error(JSON.stringify({ url: page.url(), pageErrors: errors, diagnostics: diagnostics.slice(-15), paths: paths.slice(-50), body: (await page.locator('body').innerText()).slice(0, 3500) })); }
  throw error;
} finally { await browser.close(); }
