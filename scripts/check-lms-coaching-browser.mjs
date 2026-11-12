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
const definitions = [{ code: 'belt_exam_ready', title: 'Belt Exam Ready', description: 'Coach confirms readiness.', icon: 'Target', rule: { kind: 'manual' }, points: 50, repeats: 'per_belt', active: true, translations: {}, revision: 1 }];
const attention = [{ student_id: 'STU-M-901', student_name: 'Fixture Kid', current_belt: 'White', home_branch_id: 1, subject_type: 'lesson', subject_ref: '12', subject_title: 'Front Kick', reason: 'still_learning', occurrences: 3, last_at: '2026-11-12T01:00:00Z', class_ids: [81] }];
const posts = []; const errors = [];

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
        const data = { overview, review, forms: { forms: [], questionCounts: {} }, quiz: { questions: [] }, assignments: { assignments: [] }, challenges: { challenges: [] },
          achievements: { definitions, awards: [] }, attention: { items: attention }, consents: { consents: [] },
          student: { goals: [], plans: [], forms: [], assignments: [], achievements: [], points: 0, consent: null } }[view];
        return data ? json({ success: true, data }) : json({ success: false, error: { message: 'unknown view' } }, 422);
      }
      if (url.pathname === '/api/admin/lms/announcements') {
        if (method === 'POST') { const body = route.request().postDataJSON(); posts.push({ endpoint: 'announcement', ...body }); return json({ success: true, data: { id: u(50), recipients: 2 } }); }
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
  await page.getByRole('button', { name: 'Return for another try' }).click();
  await until(() => posts.some(p => p.action === 'submission.review'), 'review sent');
  const reviewed = posts.find(p => p.action === 'submission.review');
  assert.deepEqual([reviewed.id, reviewed.review.decision, reviewed.review.grade, reviewed.review.rubric[0].grade, reviewed.review.visibleToStudent], [u(10), 'returned', 'Proficient', 'Developing', true]);
  await page.getByRole('button', { name: 'Mastered' }).click();
  await until(() => posts.some(p => p.action === 'form.review'), 'form review sent');
  assert.deepEqual(posts.find(p => p.action === 'form.review'), { action: 'form.review', studentId: 'STU-M-901', formId: u(1), review: { decision: 'mastered', note: null } });

  // Assignment: practice reps for White belts.
  await page.getByRole('button', { name: 'Assignments', exact: true }).click();
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

  // Coach sign-off: Belt Exam Ready.
  await page.getByRole('button', { name: 'Achievements', exact: true }).click();
  await page.getByLabel('Student').first().selectOption('STU-M-901');
  await page.getByRole('button', { name: 'Award' }).click();
  await until(() => posts.some(p => p.action === 'achievement.award'), 'award sent');
  assert.deepEqual(posts.find(p => p.action === 'achievement.award'), { action: 'achievement.award', studentId: 'STU-M-901', code: 'belt_exam_ready', period: null, note: null });

  // Weekly plan for one student.
  await page.getByRole('button', { name: 'Plans & goals', exact: true }).click();
  await page.getByLabel('Student').first().selectOption('STU-F-902');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item 1 lesson').selectOption('12');
  await page.getByLabel('Item 1 target').fill('3 x 10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await until(() => posts.some(p => p.action === 'plan.save'), 'plan saved');
  const plan = posts.find(p => p.action === 'plan.save');
  assert.equal(new Date(plan.weekStart + 'T00:00:00Z').getUTCDay(), 1, 'plans start on a Monday');
  assert.deepEqual(plan.items, [{ type: 'lesson', ref: '12', title: 'Front Kick', target: '3 x 10', day: null }]);

  // Announcement to a belt, with a request key.
  await page.getByRole('button', { name: 'Announcements', exact: true }).click();
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
  console.log(JSON.stringify({ passed: true, review: true, formMastered: true, assignment: true, challenge: true, form: true, award: true, plan: true, announcement: true, attention: true, mobileOverflow: overflow, pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'scratch/lms-coaching-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  throw error;
} finally { await browser.close(); }
