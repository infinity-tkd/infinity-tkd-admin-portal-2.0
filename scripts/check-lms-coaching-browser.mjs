import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Fictional identities and mocked LMS APIs: no real credentials, students or database writes.
const id = '75000000-0000-4000-8000-000000000001';
const user = { id, aud: 'authenticated', role: 'authenticated', aal: 'aal2', email: 'coaching@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'coaching_admin', email: user.email, display_name: 'Fixture Admin', role: 'Admin', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aal: 'aal2' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
const u = n => `76000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const overview = {
  students: [{ id: 'STU-M-901', english_name: 'Fixture Kid', current_belt: 'White', student_status: 'Active', home_branch_id: 1 }, { id: 'STU-F-902', english_name: 'Fixture Teen', current_belt: 'Yellow', student_status: 'Active', home_branch_id: 1 }],
  lessons: [{ id: 12, title: 'Front Kick', target_belt: 'White', category: 'Chagi', content_type: 'Taekwondo' }, { id: 91, title: 'Taegeuk 1 (Il Jang)', target_belt: 'White', category: 'Poomsae', content_type: 'Taekwondo' }],
  belts: [{ id: 1, belt_name: 'White', belt_order: 1 }, { id: 2, belt_name: 'Yellow', belt_order: 2 }],
  classes: [{ id: 81, class_name: 'Little Tigers', branch_id: 1 }], branches: [{ id: 1, branch_name: 'Main academy' }],
  categories: [{ slug: 'kicking-fundamentals', title: 'Kicking' }],
  forms: [{ id: u(1), name: 'Taegeuk Il Jang', curriculum_id: 91, published: true, movement_count: 18 }],
  achievements: [{ code: 'belt_exam_ready', title: 'Belt Exam Ready', repeats: 'per_belt', active: true, rule: { kind: 'manual' } }],
  studentLmsPushEnabled: false, waiting: { submissions: 1, forms: 1 },
};
const review = {
  submissions: [{ id: u(10), student_id: 'STU-M-901', assignment_id: u(20), subject_type: 'form', subject_ref: u(1), kind: 'text', text_answer: 'Heaven and light.', video_seconds: null, status: 'submitted',
    submitted_at: '2026-11-12T03:00:00Z', hasVideo: false, students: { english_name: 'Fixture Kid', current_belt: 'White' }, assignments: { title: 'Meaning of Taegeuk 1', rubric: [{ item: 'Accuracy' }] }, reviews: [] }],
  forms: [{ student_id: 'STU-M-901', form_id: u(1), status: 'ready_for_review', practice_count: 6, best_quiz_percent: 80, review_requested_at: '2026-11-12T02:00:00Z', reviewed_at: null, review_note: null,
    students: { english_name: 'Fixture Kid', current_belt: 'White' }, poomsae_forms: { name: 'Taegeuk Il Jang' } }],
};
// Belt Exam Ready is switched off here: Award must send the achievement the picker shows.
const definitions = [{ code: 'belt_exam_ready', title: 'Belt Exam Ready', description: 'Coach confirms readiness.', icon: 'Target', rule: { kind: 'manual' }, points: 50, repeats: 'per_belt', active: false, translations: {}, revision: 1 },
  { code: 'focus_star', title: 'Focus Star', description: 'Great focus in class.', icon: 'Star', rule: { kind: 'manual' }, points: 10, repeats: 'once', active: true, translations: {}, revision: 1 }];
const attention = [{ student_id: 'STU-M-901', student_name: 'Fixture Kid', current_belt: 'White', home_branch_id: 1, subject_type: 'lesson', subject_ref: '12', subject_title: 'Front Kick', reason: 'still_learning', occurrences: 3, last_at: '2026-11-12T01:00:00Z', class_ids: [81] }];
const assignments = [{ id: u(20), title: 'Meaning of Taegeuk 1', instructions: 'Write what Taegeuk 1 stands for.', kind: 'written', subject_type: 'form', subject_ref: u(1), target: {}, due_at: null, points: 10, rubric: [{ item: 'Accuracy' }],
  translations: {}, status: 'published', revision: 2, created_at: '2026-11-10T03:00:00Z', assignment_targets: [{ target_type: 'belt', target_ref: 'White' }], statusCounts: { submitted: 1, open: 1 } }];
// This week's Monday in Phnom Penh, as the page works it out.
const monday = (() => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); })();
// Two students whose plans have the same revision: switching must never carry one's items to the other.
const studentData = {
  'STU-M-901': { goals: [], plans: [{ id: u(30), week_start: monday, items: [{ type: 'custom', title: 'Kid only drill', target: '5 min', day: null }], note: null, published_at: null, revision: 1 }], forms: [], assignments: [], achievements: [], points: 0, consent: null },
  'STU-F-902': { goals: [], plans: [{ id: u(31), week_start: monday, items: [], note: null, published_at: null, revision: 1 }], forms: [], assignments: [], achievements: [], points: 0, consent: null },
};
const posts = []; const errors = []; const gets = []; let announcementLoads = 0;

try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'test-refresh' } });
      if (url.pathname === '/api/admin/lms') {
        if (method === 'POST') { const body = route.request().postDataJSON(); posts.push(body); return json({ success: true, data: { id: u(99), revision: 1, students: 1 } }); }
        const view = url.searchParams.get('view');
        gets.push(view);
        // The second student answers slowly, so the switch can be seen mid-load.
        if (view === 'student' && url.searchParams.get('id') === 'STU-F-902') await new Promise(resolve => setTimeout(resolve, 1500));
        const data = { overview, review, forms: { forms: [], questionCounts: {} }, quiz: { questions: [] }, assignments: { assignments }, challenges: { challenges: [] },
          achievements: { definitions, awards: [] }, attention: { items: attention }, consents: { consents: [] },
          assignment: { students: [{ student_id: 'STU-M-901', status: 'submitted', progress: {}, done_at: null, note: null, students: { english_name: 'Fixture Kid' } }] },
          student: studentData[url.searchParams.get('id')] }[view];
        return data ? json({ success: true, data }) : json({ success: false, error: { message: 'unknown view' } }, 422);
      }
      if (url.pathname === '/api/admin/lms/announcements') {
        if (method === 'POST') { const body = route.request().postDataJSON(); posts.push({ endpoint: 'announcement', ...body }); return json({ success: true, data: { id: u(50), recipients: 2 } }); }
        // The first load fails: the page must say so (with Retry), not show an empty list.
        if (announcementLoads++ === 0) return json({ success: false, error: { message: 'Sent announcements are taking too long.' } }, 503);
        return json({ success: true, data: { announcements: [] } });
      }
      if (url.pathname.startsWith('/api/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'branches') return json([{ id: 1, branch_name: 'Main academy' }]);
      return json([]);
    }
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('coaching_admin'); await page.locator('#login-password').fill('Fictional-Test-Password'); await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  await page.goto(base + '/lms?view=coaching', { waitUntil: 'networkidle', timeout: 120000 });
  const until = async (test, label) => { const end = Date.now() + 15000; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); assert.ok(test(), label); };

  // Review queue (opened from the staff notice link): a written answer and a form check.
  await page.getByText('Heaven and light.').waitFor({ timeout: 60000 });
  await page.getByLabel('Feedback for the student').fill('Good meaning; add the trigram name.');
  await page.getByLabel('Overall grade').selectOption('Proficient');
  await page.getByLabel('Accuracy grade').selectOption('Developing');
  const overviewLoads = gets.filter(view => view === 'overview').length;
  await page.getByRole('button', { name: 'Return for another try' }).click();
  await until(() => posts.some(p => p.action === 'submission.review'), 'review sent');
  const reviewed = posts.find(p => p.action === 'submission.review');
  assert.deepEqual([reviewed.id, reviewed.review.decision, reviewed.review.grade, reviewed.review.rubric[0].grade, reviewed.review.visibleToStudent], [u(10), 'returned', 'Proficient', 'Developing', true]);
  // The "N waiting" badge on the Review tab is refreshed after a review.
  await until(() => gets.filter(view => view === 'overview').length > overviewLoads, 'overview (waiting badge) refreshed after a review');
  await page.getByRole('button', { name: 'Mastered' }).click();
  await until(() => posts.some(p => p.action === 'form.review'), 'form review sent');
  assert.deepEqual(posts.find(p => p.action === 'form.review'), { action: 'form.review', studentId: 'STU-M-901', formId: u(1), review: { decision: 'mastered', note: null } });

  // A student's status on an assignment: the assignment's counts are refreshed too.
  await page.getByRole('button', { name: 'Assignments', exact: true }).click();
  await page.getByRole('button', { name: 'Students', exact: true }).click();
  const assignmentLoads = gets.filter(view => view === 'assignments').length;
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await until(() => posts.some(p => p.action === 'assignment.student'), 'student status sent');
  assert.deepEqual(posts.find(p => p.action === 'assignment.student'), { action: 'assignment.student', id: u(20), studentId: 'STU-M-901', status: 'done', note: null });
  await until(() => gets.filter(view => view === 'assignments').length > assignmentLoads, 'assignment counts refreshed');

  // Assignment: practice reps for White belts.
  await page.getByRole('button', { name: 'New assignment' }).click();
  const assignment = page.getByRole('dialog', { name: 'New assignment' });
  await assignment.getByLabel('Title').fill('50 front kicks');
  await assignment.getByLabel('Instructions').fill('Kick 50 times with each leg, chamber high.');
  await assignment.getByLabel('About').selectOption('lesson');
  await assignment.getByLabel('Lesson', { exact: true }).selectOption('12');
  await assignment.getByLabel('Reps to reach').fill('50');
  await assignment.getByLabel('Every active student').uncheck();
  await assignment.getByRole('button', { name: 'White', exact: true }).click();
  await assignment.getByRole('button', { name: 'Save draft' }).click();
  await until(() => posts.some(p => p.action === 'assignment.save'), 'assignment saved');
  const saved = posts.find(p => p.action === 'assignment.save').assignment;
  assert.deepEqual([saved.kind, saved.subjectType, saved.subjectRef, saved.target, saved.targets], ['practice', 'lesson', '12', { reps: 50 }, [{ type: 'belt', ref: 'White' }]]);

  // Challenge: a 7-day stretching-style streak with a badge-less reward.
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: 'New challenge' }).click();
  const challenge = page.getByRole('dialog', { name: 'New challenge' });
  await challenge.getByLabel('Title').fill('Kick every day');
  await challenge.getByLabel('Goal').selectOption('streak_days');
  await challenge.getByLabel('Target').fill('7');
  await challenge.getByRole('button', { name: 'Save draft' }).click();
  await until(() => posts.some(p => p.action === 'challenge.save'), 'challenge saved');
  const savedChallenge = posts.find(p => p.action === 'challenge.save').challenge;
  assert.deepEqual([savedChallenge.goalKind, savedChallenge.goalTarget, savedChallenge.audience], ['streak_days', 7, { all: true }]);

  // Forms: register Taegeuk 1 with a Khmer name.
  await page.getByRole('button', { name: 'Forms & quizzes', exact: true }).click();
  await page.getByRole('button', { name: 'Register a form' }).click();
  const form = page.getByRole('dialog', { name: 'Register a form' });
  await form.getByLabel('Library lesson (with the floor plan)').selectOption('91');
  await form.getByLabel('Name', { exact: true }).fill('Taegeuk Il Jang');
  await form.getByLabel('Belt that learns it').selectOption('1');
  await form.getByRole('button', { name: /Khmer and Chinese/ }).click();
  await form.getByLabel('Name (Khmer)').fill('តែហ្គឹក ១');
  await form.getByRole('button', { name: 'Save' }).click();
  await until(() => posts.some(p => p.action === 'form.save'), 'form saved');
  const savedForm = posts.find(p => p.action === 'form.save').form;
  assert.deepEqual([savedForm.curriculumId, savedForm.beltId, savedForm.movementCount, savedForm.translations.km.name], [91, 1, 18, 'តែហ្គឹក ១']);

  // Coach sign-off: the default (Belt Exam Ready) is switched off, so the shown achievement is sent.
  await page.getByRole('button', { name: 'Achievements', exact: true }).click();
  await page.getByLabel('Student').first().selectOption('STU-M-901');
  assert.equal(await page.getByLabel('Achievement', { exact: true }).inputValue(), 'focus_star');
  await page.getByRole('button', { name: 'Award' }).click();
  await until(() => posts.some(p => p.action === 'achievement.award'), 'award sent');
  assert.deepEqual(posts.find(p => p.action === 'achievement.award'), { action: 'achievement.award', studentId: 'STU-M-901', code: 'focus_star', period: null, note: null });

  // Switching students never shows (or saves) the previous student's plan, even mid-load
  // and when both plans have the same revision.
  await page.getByRole('button', { name: 'Plans & goals', exact: true }).click();
  const kidDrillShown = () => page.evaluate(() => [...document.querySelectorAll('[data-coaching-hub] input')].some(input => input.value === 'Kid only drill'));
  await page.getByLabel('Student').first().selectOption('STU-M-901');
  const kidEnd = Date.now() + 15000; while (!(await kidDrillShown()) && Date.now() < kidEnd) await page.waitForTimeout(100);
  assert.equal(await kidDrillShown(), true, "the first student's plan is shown");
  await page.getByLabel('Student').first().selectOption('STU-F-902');
  await page.waitForTimeout(400);
  assert.equal(await kidDrillShown(), false, "the first student's plan is not shown while the next one loads");
  await page.getByText('No items this week.').waitFor({ timeout: 15000 });
  assert.equal(await kidDrillShown(), false, "the first student's plan is not shown under the second student");
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item 1 lesson').selectOption('12');
  await page.getByLabel('Item 1 target').fill('3 x 10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await until(() => posts.some(p => p.action === 'plan.save'), 'plan saved');
  const plan = posts.find(p => p.action === 'plan.save');
  assert.equal(new Date(plan.weekStart + 'T00:00:00Z').getUTCDay(), 1, 'plans start on a Monday');
  assert.deepEqual([plan.studentId, plan.weekStart, plan.expectedRevision], ['STU-F-902', monday, 1]);
  assert.deepEqual(plan.items, [{ type: 'lesson', ref: '12', title: 'Front Kick', target: '3 x 10', day: null }], "only the second student's own item is saved");

  // Announcement to a belt, with a request key. The sent list fails to load first: the error
  // shows with Retry instead of an empty list.
  await page.getByRole('button', { name: 'Announcements', exact: true }).click();
  await page.getByText('Sent announcements unavailable').waitFor();
  assert.equal(await page.getByText('No announcements yet').count(), 0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByText('No announcements yet').waitFor();
  await page.getByLabel('Title').fill('Grading day');
  await page.getByLabel('Message').fill('Bring your uniform and belt.');
  await page.getByLabel('Every active student').uncheck();
  await page.getByRole('button', { name: 'Yellow', exact: true }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await until(() => posts.some(p => p.endpoint === 'announcement'), 'announcement sent');
  const announcement = posts.find(p => p.endpoint === 'announcement');
  assert.match(announcement.requestKey, /^[0-9a-f-]{36}$/);
  assert.deepEqual(announcement.announcement.audience, { belts: ['Yellow'] });
  await page.getByText('Sent to 2 student accounts.').waitFor();

  // Attention list.
  await page.getByRole('button', { name: 'Attention', exact: true }).click();
  await page.getByText('still learning ×3').waitFor();

  // Phone width: no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll at 390px (' + overflow + 'px)');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, review: true, badgeRefresh: true, formMastered: true, assignment: true, assignmentCounts: true, challenge: true, form: true, award: true, plan: true, studentSwitch: true, announcement: true, announcementError: true, attention: true, mobileOverflow: overflow, pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'scratch/lms-coaching-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  throw error;
} finally { await browser.close(); }
