import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadTs } from '../tests/load-ts.mjs';
const { academyDate, addCalendarDays } = loadTs('lib/dates.ts');
const base = process.argv[2] || 'http://127.0.0.1:3000';
const id = '74000000-0000-4000-8000-000000000001';
const profile = { id, username: 'calendar_fixture', email: 'calendar@example.test', display_name: 'Fixture Admin', role: 'Admin', is_active: true, must_change_password: false };
const user = { id, aud: 'authenticated', role: 'authenticated',aal:'aal2', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated',aal:'aal2', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.fixture`;
const today = academyDate();
const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(today+'T00:00:00Z'));
const lessons = [1,2].map(number => ({ id: number, branch_id: number, class_name: `Fixture Class ${number}`, day_of_week: weekday, days_of_week: [weekday], start_time: '08:00', end_time: '09:00', capacity: 30, class_type: 'General Class', coach_id: id }));
const student = (id, name) => ({ id, khmer_name: 'Fixture', english_name: name, gender: 'Male', dob: '2010-01-01', registration_date: '2025-01-01', scholarship_id: 1, current_belt: 'White', student_status: 'Active', home_branch_id: 1, student_addresses: [] });
let attendance = [
  { id: 101, student_id: 'STU-M-001', date: today, class_id: 1, status: 'Present' },
  { id: 102, student_id: 'STU-M-001', date: today, class_id: 2, status: 'Absent' },
  { id: 103, student_id: 'STU-M-001', date: today, class_id: null, status: 'Late' },
  { id: 201, student_id: 'STU-M-002', date: today, class_id: 1, status: 'Present' },
];
const writes = []; const errors = []; let deny = false; let failWrite = false; let nextId = 500;let denyBulkClear=false;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
let page;
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status=200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if(url.pathname==='/api/operations'&&url.searchParams.get('view')==='sessions')return json({success:true,data:{sessions:[{id:'fixture-session',class_id:2,branch_id:2,starts_at:today+'T09:00:00+07:00',status:'scheduled'}],roster:[{occurrence_id:'fixture-session',student_id:'STU-M-001'},{occurrence_id:'fixture-session',student_id:'STU-M-002'}],attendance}});
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'fixture-refresh' } });
      if (url.pathname === '/api/telemetry/log' || url.pathname.startsWith('/api/admin/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop(); const method = route.request().method();
      if (method !== 'GET') {
        assert.equal(table, 'attendance', 'all other database writes are forbidden');
        assert.ok(['POST','DELETE'].includes(method));
        writes.push({ method, query: Object.fromEntries(url.searchParams), body: route.request().postDataJSON() });
        if (failWrite) return json({ code: '08006', message: 'Fictional attendance outage' }, 503);
        await new Promise(resolve => setTimeout(resolve, 150));
        if (method === 'POST') {
          const bodies = route.request().postDataJSON();
          assert.ok(Array.isArray(bodies), 'attendance writes use the batch contract');
          const saved = bodies.map(body => {
            const existing = attendance.find(row => row.student_id===body.student_id && row.date===body.date && row.class_id===body.class_id);
            return { ...body, id: existing?.id || nextId++ };
          });
          attendance = [...attendance.filter(row => !saved.some(item=>item.id===row.id)), ...saved];
          return json(saved);
        }
        if(url.searchParams.get('id')?.startsWith('in.')){
          const ids=url.searchParams.get('id').slice(4,-1).split(',').map(Number);
          if(denyBulkClear)return json([]);
          const removed=attendance.filter(row=>ids.includes(row.id));attendance=attendance.filter(row=>!ids.includes(row.id));return json(removed.map(row=>({id:row.id})));
        }
        assert.match(url.searchParams.get('id') || '', /^eq\.\d+$/);
        assert.equal(url.searchParams.get('student_id'), 'eq.STU-M-001');
        const target = Number(url.searchParams.get('id').slice(3));
        const row = attendance.find(row => row.id===target && row.student_id==='STU-M-001');
        attendance = attendance.filter(item => item.id!==row?.id);
        return json(row ? { id: row.id } : null);
      }
      if (table==='profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table==='academy_profile') return json({ id: 'default', academy_name: 'Fixture Academy' });
      if (table==='user_permissions') return json(deny ? ['action:attendance_mark','action:attendance_delete'].map(permission_key => ({ user_id: id, permission_key, is_granted: false })) : []);
      const datasets = { students: [student('STU-M-001','Calendar Athlete'),student('STU-M-002','Other Athlete')], branches: [{ id: 1, branch_name: 'Fixture Branch' },{id:2,branch_name:'Away branch'}], class_sessions: lessons,
        class_enrollments: [{id:4,student_id:'STU-M-002',class_id:2,enrollment_date:'2026-01-01'},{ id: 1, student_id: 'STU-M-001', class_id: 1, enrollment_date: '2026-01-01' },{ id: 2, student_id: 'STU-M-001', class_id: 2, enrollment_date: '2026-01-01' },{ id: 3, student_id: 'STU-M-002', class_id: 1, enrollment_date: '2026-01-01' }],
        scholarships: [{ id: 1, type_name: 'Standard', discount_percentage: 0 }], attendance };
      return json(datasets[table] || []);
    }
    return route.abort();
  });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('calendar_fixture'); await page.locator('#login-password').fill('Fictional-Password'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/dashboard');
  attendance[0].status='Late';attendance[3].status='Absent';await page.reload({waitUntil:'networkidle'});
  await page.getByLabel('Dashboard class',{exact:true}).selectOption('1');
  const dashboardBulk=page.getByRole('button',{name:'Mark All Present',exact:true});await dashboardBulk.waitFor();failWrite=true;
  const dashboardWriteCount=writes.length;await dashboardBulk.click();const dashboardError=page.getByRole('alertdialog');await dashboardError.waitFor();assert.equal(writes.length,dashboardWriteCount+1);assert.equal(writes.at(-1).body.length,2);assert.equal(attendance[0].status,'Late');assert.equal(attendance[3].status,'Absent');
  await dashboardError.getByRole('button',{name:'Dismiss Notification',exact:true}).click();failWrite=false;
  const dashboardSaved=page.waitForResponse(response=>response.url().includes('/rest/v1/attendance?')&&response.request().method()==='POST');await dashboardBulk.click();await dashboardSaved;assert.equal(attendance.find(row=>row.id===101).status,'Present');assert.equal(attendance.find(row=>row.id===201).status,'Present');
  await page.goto(base+'/attendance', { waitUntil: 'networkidle', timeout: 120000 });
  const opener = page.getByRole('button',{name:'Attendance details for Calendar Athlete',exact:true});
  await opener.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog',{name:'Calendar Athlete',exact:true}); await dialog.waitFor();
  const calendar = dialog.getByRole('region',{name:'Attendance calendar',exact:true});
  await calendar.locator(`[data-attendance-date="${today}"]`).waitFor();
  assert.match(await calendar.locator(`[data-attendance-date="${today}"]`).getAttribute('aria-label'), /Present.*Late.*Absent/);
  await page.keyboard.press('Shift+Tab'); assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)),'focus stays inside the student dialog');
  await dialog.getByRole('tab',{name:'Attendance calendar',exact:true}).focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await dialog.getByRole('tab',{name:'Attendance Insights',exact:true}).getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');
  await calendar.getByLabel('Class / record',{exact:true}).selectOption('2');
  for (const status of ['Present','Late','Absent']) {
    await calendar.getByRole('button',{name:`${status} — Fixture Class 2`,exact:true}).click();
    await calendar.getByRole('status').filter({hasText:'Attendance saved.'}).waitFor();
    assert.equal(attendance.find(row=>row.id===102).status,status);
  }
  await calendar.getByRole('button',{name:'Clear mark — Fixture Class 2',exact:true}).click();
  await calendar.getByRole('button',{name:'Cancel',exact:true}).click(); assert.ok(attendance.some(row=>row.id===102));
  await calendar.getByRole('button',{name:'Clear mark — Fixture Class 2',exact:true}).click();
  await calendar.getByRole('button',{name:'Confirm clear',exact:true}).click(); await calendar.getByRole('status').filter({hasText:'Attendance mark cleared.'}).waitFor();
  assert.deepEqual(attendance.map(row=>row.id).sort((a,b)=>a-b),[101,103,201],'other classes, daily mark and other students survive clearing');
  const before = writes.length;
  await calendar.getByRole('button',{name:'Present — Fixture Class 2',exact:true}).evaluate(button=>{button.click();button.click();});
  await calendar.getByRole('status').filter({hasText:'Attendance saved.'}).waitFor(); assert.equal(writes.length,before+1,'double activation saves only once');
  const savedCount=attendance.length;failWrite=true;
  await calendar.getByRole('button',{name:'Clear mark — Fixture Class 2',exact:true}).click();
  await calendar.getByRole('button',{name:'Confirm clear',exact:true}).click();
  await calendar.getByRole('alert').waitFor();assert.equal(attendance.length,savedCount,'failed clearing keeps the confirmed record');
  await calendar.getByRole('button',{name:'Cancel',exact:true}).click();
  failWrite=true;
  await calendar.getByRole('button',{name:'Late — Fixture Class 2',exact:true}).click();
  await calendar.getByRole('alert').waitFor(); assert.equal(attendance.find(row=>row.class_id===2).status,'Present','a failed save retains the last confirmed mark');
  const notice=page.getByRole('alertdialog');if(await notice.count())await notice.getByRole('button',{name:'Close',exact:true}).click();
  failWrite=false;await calendar.getByRole('button',{name:'Late — Fixture Class 2',exact:true}).click();await calendar.getByRole('status').filter({hasText:'Attendance saved.'}).waitFor();
  await calendar.getByLabel('Selected attendance date',{exact:true}).fill(addCalendarDays(today,1));
  assert.ok(await calendar.getByRole('button',{name:'Present — Fixture Class 2',exact:true}).isDisabled(),'future attendance is not marked');
  await calendar.getByLabel('Selected attendance date',{exact:true}).fill('2025-12-31');
  assert.ok(await calendar.getByRole('button',{name:'Present — Fixture Class 2',exact:true}).isDisabled(),'dates before class enrollment are not marked');
  await calendar.getByLabel('Selected attendance date',{exact:true}).fill('2024-12-31');
  assert.ok(await calendar.getByRole('button',{name:'Present — Fixture Class 2',exact:true}).isDisabled(),'dates before registration are not marked');
  await calendar.getByRole('button',{name:'Today',exact:true}).click();
  const currentMonth=await calendar.getByLabel('Selected attendance date',{exact:true}).inputValue();
  await calendar.getByRole('button',{name:'Previous month',exact:true}).click();assert.notEqual((await calendar.getByLabel('Selected attendance date',{exact:true}).inputValue()).slice(0,7),currentMonth.slice(0,7));
  await calendar.getByRole('button',{name:'Next month',exact:true}).click();await calendar.getByRole('button',{name:'Today',exact:true}).click();
  await calendar.getByLabel('Selected attendance date',{exact:true}).fill(addCalendarDays(today,-1));
  const makeupMark=calendar.getByRole('button',{name:'Present — Fixture Class 2',exact:true});
  assert.ok(await makeupMark.isDisabled(),'off-schedule new marks require explicit make-up confirmation');
  await calendar.getByLabel('Confirm an additional class outside the timetable. For a linked makeup, use Makeup classes below.',{exact:true}).check();
  await makeupMark.click();await calendar.getByRole('status').filter({hasText:'Attendance saved.'}).waitFor();
  assert.ok(attendance.some(row=>row.date===addCalendarDays(today,-1)&&row.class_id===2&&row.status==='Present'));
  await calendar.getByRole('button',{name:'Today',exact:true}).click();
  for (const size of [{width:1440,height:1000},{width:834,height:1112},{width:390,height:844}]) {
    await page.setViewportSize(size); assert.ok(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth),'dialog fits '+size.width);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+size.width);
    const mark=calendar.getByRole('button',{name:'Absent — Fixture Class 2',exact:true});await mark.scrollIntoViewIfNeeded();
    const box=await mark.boundingBox();assert.ok(box.height>=44,'status controls remain touch-sized');
    await dialog.locator('.custom-scrollbar').evaluate(element=>element.scrollTop=0);
    await dialog.screenshot({path:`scratch/attendance-calendar-${size.width}.png`});
  }
  await dialog.getByRole('button',{name:'Close attendance details',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Attendance branch',{exact:true}).selectOption('2');await page.getByLabel('Attendance class',{exact:true}).selectOption('2');
  await opener.waitFor();await page.getByRole('button',{name:'Attendance details for Other Athlete',exact:true}).waitFor();
  const recordsBefore=JSON.stringify(attendance),writeCount=writes.length;failWrite=true;
  await page.getByRole('button',{name:'Mark All Absent',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  const bulkError=page.getByRole('alertdialog');await bulkError.waitFor();assert.equal(writes.length,writeCount+1);assert.equal(writes.at(-1).body.length,2);assert.equal(JSON.stringify(attendance),recordsBefore,'a failed roster batch preserves every previous mark');
  await bulkError.getByRole('button',{name:'Dismiss Notification',exact:true}).click();failWrite=false;
  await page.getByRole('button',{name:'Mark All Absent',exact:true}).click();
  const bulkSaved=page.waitForResponse(response=>response.url().includes('/rest/v1/attendance?')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Confirm',exact:true}).click();await bulkSaved;
  assert.equal(attendance.filter(row=>row.date===today&&row.class_id===2&&row.status==='Absent').length,2);
  assert.equal(attendance.find(row=>row.id===201).status,'Present','another class retains its mark');assert.equal(attendance.find(row=>row.id===103).status,'Late','daily check-ins remain separate');
  attendance=attendance.filter(row=>!(row.student_id==='STU-M-002'&&row.class_id===2&&row.date===today));
  await page.reload({waitUntil:'networkidle'});await page.getByLabel('Attendance branch',{exact:true}).selectOption('2');await page.getByLabel('Attendance class',{exact:true}).selectOption('2');
  await page.getByRole('button',{name:'Save Absent Students',exact:true}).click();
  const committed=page.waitForResponse(response=>response.url().includes('/rest/v1/attendance?')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Confirm',exact:true}).click();await committed;assert.equal(writes.at(-1).body.length,1,'only the unmarked saved session member is committed');assert.equal(writes.at(-1).body[0].student_id,'STU-M-002');
  await page.getByLabel('Attendance branch',{exact:true}).selectOption('all');
  const scopeSnapshot=attendance.filter(row=>row.class_id!==null).map(row=>row.id).sort();denyBulkClear=true;
  await page.getByRole('button',{name:'Reset Filtered',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await bulkError.waitFor();assert.ok((await bulkError.innerText()).includes('Cleared 0 of 1'));assert.ok(attendance.some(row=>row.id===103));await bulkError.getByRole('button',{name:'Dismiss Notification',exact:true}).click();denyBulkClear=false;
  await page.getByRole('button',{name:'Reset Filtered',exact:true}).click();const dailyCleared=page.waitForResponse(response=>response.url().includes('/rest/v1/attendance?')&&response.request().method()==='DELETE');await page.getByRole('button',{name:'Confirm',exact:true}).click();await dailyCleared;
  assert.ok(!attendance.some(row=>row.id===103));assert.deepEqual(attendance.filter(row=>row.class_id!==null).map(row=>row.id).sort(),scopeSnapshot,'clearing daily marks preserves every class record');
  deny=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);
  await opener.click();await dialog.waitFor();
  await calendar.getByLabel('Class / record',{exact:true}).selectOption('2');
  await calendar.getByText('You can view this history. Editing requires attendance permission.',{exact:true}).waitFor();
  assert.ok(await calendar.getByRole('button',{name:'Absent — Fixture Class 2',exact:true}).isDisabled());
  assert.equal(await calendar.getByRole('button',{name:/Clear mark —/}).count(),0);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  console.log('Attendance calendar browser checks passed: class/date isolation, Present/Late/Absent, exact-row clearing, cancellation, single-flight saves, failure recovery, date limits, month navigation, read-only permissions, keyboard focus, and desktop/tablet/phone layouts. All services mocked; no live writes.');
} catch(error) {if(page)console.error(JSON.stringify({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1400)}));throw error;} finally {await browser.close();}
