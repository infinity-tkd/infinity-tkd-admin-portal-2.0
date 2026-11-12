import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
// Screenshots go to LMS_LAYOUT_SHOTS when set (for a visual review), else nowhere.
const shots = process.env.LMS_LAYOUT_SHOTS || '';
if (shots) await mkdir(shots, { recursive: true });
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Coaching hub as a phone, iPads (touch) and a desktop (mouse), with long fictional
// names and busy lists: no sideways scroll, all tabs on screen, dialogs fit the
// screen, and every button is at least 44 px tall on touch screens.
const id = '77000000-0000-4000-8000-000000000001';
const user = { id, aud: 'authenticated', role: 'authenticated', aal: 'aal2', email: 'layout@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'layout_admin', email: user.email, display_name: 'Fixture Admin', role: 'Admin', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aal: 'aal2' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
const u = n => `78000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const long = 'Sokhavirak Chanmonyroth Phalladeth';
const students = Array.from({ length: 30 }, (_, i) => ({ id: `STU-${i % 2 ? 'F' : 'M'}-9${String(i).padStart(2, '0')}`, english_name: i === 0 ? long : `Fixture Student ${i}`, current_belt: ['White', 'Yellow', 'Green', 'Blue'][i % 4], student_status: i % 9 ? 'Active' : 'Paused', home_branch_id: 1 + (i % 2) }));
const overview = {
  students, lessons: Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, title: i === 0 ? 'Spinning Hook Kick (Dwi Huryeo Chagi / 뒤후려차기) with a very long title' : `Lesson ${i}`, target_belt: 'White', category: 'Chagi', content_type: 'Taekwondo' })),
  belts: ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'].map((belt_name, i) => ({ id: i + 1, belt_name, belt_order: i + 1 })),
  classes: ['Little Tigers', 'Juniors Monday Wednesday Friday Evening', 'Adults', 'Competition Team', 'Black Belt Club'].map((class_name, i) => ({ id: 80 + i, class_name, branch_id: 1 })),
  branches: [{ id: 1, branch_name: 'Main academy' }, { id: 2, branch_name: 'Riverside branch' }],
  categories: [{ slug: 'kicking-fundamentals', title: 'Kicking' }, { slug: 'kicking-advanced', title: 'Advanced kicking' }],
  forms: [{ id: u(1), name: 'Taegeuk Il Jang', curriculum_id: 11, published: true, movement_count: 18 }, { id: u(2), name: 'Taegeuk I Jang', curriculum_id: 12, published: false, movement_count: 18 }],
  achievements: [{ code: 'belt_exam_ready', title: 'Belt Exam Ready', repeats: 'per_belt', active: true, rule: { kind: 'manual' } }],
  studentLmsPushEnabled: false, waiting: { submissions: 3, forms: 2 },
};
const review = {
  submissions: [0, 1, 2].map(i => ({ id: u(10 + i), student_id: students[i].id, assignment_id: u(20), subject_type: 'form', subject_ref: u(1), kind: i === 0 ? 'video' : 'text', text_answer: i ? 'Heaven and light: the first trigram, Keon. '.repeat(4) : null,
    video_seconds: i === 0 ? 74 : null, status: 'submitted', submitted_at: '2026-11-12T03:00:00Z', hasVideo: i === 0, students: { english_name: students[i].english_name, current_belt: 'White' },
    assignments: { title: 'Film Taegeuk Il Jang from the front and the side', rubric: [{ item: 'Stances' }, { item: 'Rhythm and power' }, { item: 'Focus and kihap' }] },
    reviews: i === 1 ? [{ id: u(30), decision: 'returned', grade: 'Developing', feedback: 'Deeper front stances, then send it again.', moments: [{ second: 12, note: 'Pivot the supporting foot' }], rubric: [], visible_to_student: true, created_at: '2026-11-11T03:00:00Z', profiles: { display_name: 'Coach Fixture' } }] : [] })),
  forms: [0, 1].map(i => ({ student_id: students[i].id, form_id: u(1), status: 'ready_for_review', practice_count: 12, best_quiz_percent: 85, review_requested_at: '2026-11-12T02:00:00Z', reviewed_at: null, review_note: null,
    students: { english_name: students[i].english_name, current_belt: 'White' }, poomsae_forms: { name: 'Taegeuk Il Jang' } })),
};
const assignment = (i, status) => ({ id: u(40 + i), title: i ? `Assignment ${i}` : 'Kick 50 front kicks with each leg, chamber high, both sides every day', instructions: 'Practise.', kind: ['practice', 'video', 'written', 'quiz', 'form'][i % 5],
  subject_type: null, subject_ref: null, target: { reps: 50 }, due_at: '2026-11-20T10:00:00Z', points: 10, rubric: [], translations: {}, status, revision: 1, created_at: '2026-11-12T00:00:00Z',
  assignment_targets: [{ target_type: 'belt', target_ref: 'White' }, { target_type: 'class', target_ref: '81' }, { target_type: 'student', target_ref: students[0].id }], statusCounts: { open: 12, in_progress: 4, submitted: 2, done: 9, excused: 1 } });
const views = {
  overview, review, forms: { forms: overview.forms.map((f, i) => ({ ...f, korean_name: '태극 1장', series: 'Taegeuk', belt_id: 1, sort_order: (i + 1) * 10, translations: {}, revision: 1 })), questionCounts: { [`form:${u(1)}`]: 6 } },
  assignments: { assignments: [assignment(0, 'published'), assignment(1, 'draft'), assignment(2, 'closed')] },
  assignment: { students: students.slice(0, 8).map((s, i) => ({ student_id: s.id, status: ['open', 'in_progress', 'done', 'excused'][i % 4], progress: i % 2 ? { reps: 30, sessions: 2 } : {}, done_at: null, note: null, students: { english_name: s.english_name } })) },
  challenges: { challenges: [{ id: u(60), title: 'Practise 50 front kicks this week with both legs', description: null, goal_kind: 'reps', goal_target: 50, subject_type: null, subject_ref: null, starts_on: '2026-11-16', ends_on: '2026-11-22',
    audience: { belts: ['White', 'Yellow'], classes: ['81', '82'] }, points: 20, badge_code: null, translations: {}, status: 'published', revision: 1, tally: { joined: 14, completed: 3 } }] },
  achievements: { definitions: [{ code: 'belt_exam_ready', title: 'Belt Exam Ready', description: 'Your coach confirms you are ready for your next belt test.', icon: 'Target', rule: { kind: 'manual' }, points: 50, repeats: 'per_belt', active: true, translations: {}, revision: 1 },
    { code: 'lessons_10', title: 'First 10 Lessons Completed', description: 'Complete 10 lessons in the library.', icon: 'BookOpen', rule: { kind: 'lessons_completed', min: 10 }, points: 50, repeats: 'once', active: true, translations: {}, revision: 1 }],
    awards: [{ student_id: students[0].id, code: 'belt_exam_ready', period: 'Yellow', earned_at: '2026-11-12T03:00:00Z', awarded_by: id, students: { english_name: long } }] },
  student: { goals: [{ id: u(70), kind: 'weekly_days', target: 4, subject_ref: null, title: null, set_by: 'coach', status: 'active', starts_on: '2026-11-10', ends_on: null }],
    plans: [], forms: [{ form_id: u(1), status: 'practising', practice_count: 7, best_quiz_percent: 60, poomsae_forms: { name: 'Taegeuk Il Jang' } }],
    assignments: [{ assignment_id: u(40), status: 'in_progress', assignments: { title: 'Kick 50 front kicks with each leg', kind: 'practice', due_at: null, status: 'published' } }],
    achievements: [{ code: 'belt_exam_ready', period: 'Yellow', earned_at: '2026-11-12T03:00:00Z', awarded_by: id }], points: 120,
    consent: { guardian_name: 'Fixture Guardian With A Long Name', relationship: 'parent', source: 'portal', consented_at: '2026-11-12T03:00:00Z', revoked_at: null } },
  attention: { items: students.slice(0, 5).map((s, i) => ({ student_id: s.id, student_name: s.english_name, current_belt: s.current_belt, home_branch_id: 1, subject_type: i % 2 ? 'form' : 'lesson', subject_ref: '10', subject_title: i ? 'Front Kick' : 'Spinning Hook Kick (Dwi Huryeo Chagi) with a very long title', reason: i % 2 ? 'quiz_failed' : 'still_learning', occurrences: 3, last_at: '2026-11-12T01:00:00Z', class_ids: [81] })) },
};
const errors = [];
// Phones and iPads are touch devices (pointer: coarse); desktop uses a mouse.
const viewports = [{ name: 'phone', width: 390, height: 844, touch: true, mobile: true }, { name: 'ipad-portrait', width: 768, height: 1024, touch: true }, { name: 'ipad-air', width: 834, height: 1194, touch: true },
  { name: 'ipad-landscape', width: 1024, height: 768, touch: true }, { name: 'desktop', width: 1440, height: 900, touch: false }];
const tabs = [/^Review/, 'Assignments', 'Challenges', 'Forms & quizzes', 'Achievements', 'Plans & goals', 'Announcements', 'Attention'];
const dialogs = [['Assignments', 'New assignment'], ['Challenges', 'New challenge'], ['Forms & quizzes', 'Register a form'], ['Achievements', 'New achievement']];
const results = [];

async function device(viewport) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: Boolean(viewport.mobile) });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'test-refresh' } });
      if (url.pathname === '/api/admin/lms') return route.request().method() === 'POST' ? json({ success: true, data: {} }) : json({ success: true, data: views[url.searchParams.get('view')] ?? {} });
      if (url.pathname === '/api/admin/lms/announcements') return json({ success: true, data: { announcements: [{ id: u(90), title: 'Grading day on Saturday', body: 'Bring your uniform and belt.', audience: { belts: ['White'] }, recipients: 18, sent_at: '2026-11-12T03:00:00Z', profiles: { display_name: 'Fixture Admin' } }] } });
      if (url.pathname.startsWith('/api/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'branches') return json(overview.branches);
      return json([]);
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('layout_admin'); await page.locator('#login-password').fill('Fictional-Test-Password'); await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  return { context, page };
}

try {
  for (const viewport of viewports) {
    const { context, page } = await device(viewport);
    const tap = (locator, options) => viewport.touch ? locator.tap(options) : locator.click(options);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
    // Touch screens: every visible button in Coaching is at least 44 px tall.
    const smallTargets = () => page.evaluate(() => [...document.querySelectorAll('[data-coaching-hub] button, [role="dialog"] button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(el => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)));
    await page.goto(base + '/lms?view=coaching', { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByText('Heaven and light', { exact: false }).first().waitFor({ timeout: 60000 });
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), viewport.touch, `${viewport.name}: pointer type`);
    // All eight Coaching tabs are on screen at once (no sideways strip).
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Coaching views"] button')].filter(b => { const r = b.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).length);
    assert.equal(hidden, 0, `${viewport.name}: ${hidden} Coaching tabs off screen`);
    for (const tab of tabs) {
      await tap(page.getByRole('button', { name: tab, exact: typeof tab === 'string' }));
      await page.waitForTimeout(250);
      if (tab === 'Plans & goals') { await page.getByLabel('Student', { exact: true }).selectOption(students[0].id); await page.getByText('Weekly plan').waitFor(); await tap(page.getByRole('button', { name: 'Add item' })); }
      if (tab === 'Assignments') { await tap(page.getByRole('button', { name: 'Students' }).first()); await page.waitForTimeout(200); }
      const over = await overflow();
      results.push({ viewport: viewport.name, view: String(tab), overflow: over });
      assert.ok(over <= 1, `${viewport.name} ${tab}: ${over}px sideways scroll`);
      if (viewport.touch) { const small = await smallTargets(); assert.deepEqual(small, [], `${viewport.name} ${tab}: buttons under 44 px: ${small.join(' | ')}`); }
      await shot(`${viewport.name}-${String(tab).replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`);
    }
    // "Review 2 submitted" on an assignment opens the queue filtered to it.
    await tap(page.getByRole('button', { name: 'Assignments', exact: true }));
    await tap(page.getByRole('button', { name: 'Review 2 submitted' }).first());
    await page.getByText('Showing work for').waitFor();
    await tap(page.getByRole('button', { name: 'Show everything' }));
    for (const [tab, button] of dialogs) {
      await tap(page.getByRole('button', { name: tab, exact: true }));
      await tap(page.getByRole('button', { name: button }));
      const dialog = page.getByRole('dialog').last();
      await dialog.waitFor();
      if (button === 'New challenge') {
        await dialog.getByLabel('Start from an example (optional)').selectOption('kicks');
        assert.equal(await dialog.getByLabel('Title', { exact: true }).inputValue(), 'Practise 50 front kicks');
        assert.equal(await dialog.getByLabel('Target', { exact: true }).inputValue(), '50');
      }
      const box = await dialog.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1, `${viewport.name} ${button}: dialog ${box?.x},${box?.width} wider than ${viewport.width}`);
      const inner = await dialog.evaluate(el => el.scrollWidth - el.clientWidth);
      assert.ok(inner <= 1, `${viewport.name} ${button}: ${inner}px sideways scroll inside the dialog`);
      if (viewport.touch) { const small = await smallTargets(); assert.deepEqual(small, [], `${viewport.name} ${button}: buttons under 44 px: ${small.join(' | ')}`); }
      results.push({ viewport: viewport.name, view: button, overflow: inner });
      await shot(`${viewport.name}-dialog-${button.replace(/[^a-z]+/gi, '-').toLowerCase()}`);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(async () => { await page.getByRole('button', { name: 'Cancel' }).last().click(); });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: results.length, worstOverflow: Math.max(...results.map(r => r.overflow)), viewports: viewports.map(v => `${v.width}${v.touch ? ' touch' : ''}`), pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages.at(-1)) await pages.at(-1).screenshot({ path: 'scratch/lms-layout-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  console.error(JSON.stringify(results.slice(-5)));
  throw error;
} finally { await browser.close(); }
