import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Fictional identities and a mocked belt-test API: no real credentials or database writes.
const id = '71000000-0000-4000-8000-000000000001';
const user = { id, aud: 'authenticated', role: 'authenticated', aal: 'aal2', email: 'belt-tests@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'belt_head_coach', email: user.email, display_name: 'Fixture Head Coach', role: 'Head Coach', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aal: 'aal2' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
const u = n => `72000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const belts = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan'].map((belt_name, index) => ({ id: index + 1, belt_name, belt_order: index + 1, belt_type: index < 6 ? 'color' : 'black' }));
const colorSyllabus = { id: u(1), target_belt_id: 2, track: 'color', version: 1, title: 'Yellow belt test', status: 'published', revision: 1, pass_mark: 70, distinction_mark: 90, section_minimum: 60, critical_minimum: 5, retest_days: 30,
  eligibility: { minimumDays: 60, minimumClasses: 16, minimumSkillAverage: 2, requireLessons: false }, notes: '', published_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' };
const blackSyllabus = { ...colorSyllabus, id: u(2), target_belt_id: 7, track: 'kukkiwon', title: 'Kukkiwon 1st Poom/Dan test', pass_mark: null, distinction_mark: null, section_minimum: null, critical_minimum: null, retest_days: null };
const sections = [
  { id: u(11), syllabus_id: u(1), kind: 'physical', title: 'Physical Test', weight: 25, minimum: null, position: 0 },
  { id: u(12), syllabus_id: u(1), kind: 'skill', title: 'Taekwondo Skill Test', weight: 35, minimum: null, position: 1 },
  { id: u(13), syllabus_id: u(1), kind: 'poomsae', title: 'Poomsae Test', weight: 30, minimum: null, position: 2 },
  { id: u(14), syllabus_id: u(1), kind: 'acrobatics', title: 'Acrobatic & Tricking Test', weight: 10, minimum: null, position: 3 },
];
const items = [
  { id: u(21), section_id: u(11), title: 'Push-ups', library_asset_id: null, weight: 1, critical: false, guide: '', position: 0 },
  { id: u(22), section_id: u(11), title: 'Flexibility', library_asset_id: null, weight: 1, critical: false, guide: '', position: 1 },
  { id: u(23), section_id: u(12), title: 'Ap Chagi', library_asset_id: null, weight: 2, critical: true, guide: 'Chamber, snap and re-chamber', position: 0 },
  { id: u(24), section_id: u(12), title: 'Arae Makki', library_asset_id: null, weight: 1, critical: false, guide: '', position: 1 },
  { id: u(25), section_id: u(13), title: 'Taegeuk Il Jang', library_asset_id: 7, weight: 1, critical: true, guide: '', position: 0 },
  { id: u(26), section_id: u(14), title: 'Cartwheel', library_asset_id: null, weight: 1, critical: false, guide: '', position: 0 },
];
const blackSections = [{ id: u(31), syllabus_id: u(2), kind: 'poomsae', title: 'Poomsae', weight: null, minimum: null, position: 0 }];
const blackItems = [{ id: u(41), section_id: u(31), title: 'Koryo', library_asset_id: null, weight: 1, critical: false, guide: '', position: 0 }];
const colorEvent = { id: u(51), title: 'Yellow belt test day', kind: 'color', exam_date: today, start_time: '09:00:00', location: 'Main hall', branch_id: null, target_belt_id: 2, syllabus_id: u(1), published_at: '2026-11-02T00:00:00Z', cancelled_at: null, results_published_at: null };
const blackEvent = { ...colorEvent, id: u(52), title: 'Kukkiwon 1st Poom/Dan test', kind: 'kukkiwon', target_belt_id: 7, syllabus_id: u(2), location: 'CTF headquarters' };
const candidate = { id: u(61), event_id: u(51), student_id: 'STU-M-001', status: 'registered', revision: 1, result: 'pending', overall_percent: null, section_results: null, retest_sections: [], retest_count: 0, public_feedback: '', registration_override_reason: null,
  eligibility_snapshot: null, withdrawn_reason: null, poom_or_dan: null, legal_name_en: null, legal_name_kh: null, dob: null, gender: null, previous_certificate_no: null, ctf_submitted_on: null, ctf_reference: null, external_result: null, certificate_no: null, certificate_date: null,
  student: { english_name: 'Fixture Athlete', khmer_name: 'Fixture', current_belt: 'White' } };
const nominee = { ...candidate, id: u(62), event_id: u(52), student_id: 'STU-F-002', status: 'nominated', result: null, poom_or_dan: 'Poom', legal_name_en: '=CMD|Injected', legal_name_kh: 'Fixture', dob: '2014-03-01', gender: 'Female', student: { english_name: 'Fixture Junior', khmer_name: 'Fixture', current_belt: 'Red' } };
const scores = [];
const posts = []; const errors = [];
const eligibility = { students: [{ studentId: 'STU-M-003', englishName: 'Eligible Fixture', khmerName: 'Fixture', currentBelt: 'White', homeBranchId: 1,
  eligibility: { status: 'eligible', syllabusId: u(1), targetBelt: 'Yellow', track: 'color', evaluatedOn: today, since: '2026-01-15', rules: [{ key: 'current_belt', met: true, current: 'White', required: 'White' }, { key: 'classes', met: true, current: 20, required: 16 }] } }] };

try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'test-refresh' } });
      if (url.pathname === '/api/belt-tests' && route.request().method() === 'GET') {
        const view = url.searchParams.get('view');
        if (view === 'overview') return json({ success: true, data: { belts, syllabi: [colorSyllabus, blackSyllabus], events: [{ ...colorEvent, counts: { [candidate.status]: 1 } }, { ...blackEvent, counts: { nominated: 1 } }] } });
        if (view === 'syllabus') return json({ success: true, data: url.searchParams.get('id') === u(1) ? { syllabus: colorSyllabus, sections, items } : { syllabus: blackSyllabus, sections: blackSections, items: blackItems } });
        if (view === 'eligibility') return json({ success: true, data: eligibility });
        if (view === 'eligibility_all') return json({ success: true, data: { entries: {} } });
        if (view === 'library_usage') return json({ success: true, data: { usage: [{ libraryAssetId: 7, syllabusId: u(1), targetBelt: 'Yellow', track: 'color', status: 'published', version: 1, section: 'Poomsae Test', item: 'Taegeuk Il Jang' }] } });
        if (view === 'student_tests') return json({ success: true, data: { tests: [] } });
        if (view === 'event') {
          const color = url.searchParams.get('id') === u(51);
          return json({ success: true, data: color
            ? { syllabus: colorSyllabus, sections, items, event: colorEvent, targetBelt: 'Yellow', candidates: [candidate], scores, examiners: { [id]: 'Fixture Head Coach' } }
            : { syllabus: blackSyllabus, sections: blackSections, items: blackItems, event: blackEvent, targetBelt: '1st Poom/Dan', candidates: [nominee], scores: [], examiners: {} } });
        }
      }
      if (url.pathname === '/api/belt-tests' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); posts.push(body);
        if (body.action === 'score') {
          const existing = scores.find(row => row.item_id === body.itemId);
          if (existing) Object.assign(existing, { score: body.score, revision: existing.revision + 1 }); else scores.push({ id: crypto.randomUUID(), candidate_id: body.candidateId, item_id: body.itemId, score: body.score, note: '', revision: 1, scored_by: id, updated_at: new Date().toISOString() });
          candidate.status = 'scoring';
          return json({ success: true, data: { id: crypto.randomUUID(), revision: 1 } });
        }
        if (body.action === 'finalize') { Object.assign(candidate, { status: 'finalized', result: 'pass', overall_percent: 75.58, revision: candidate.revision + 1 }); return json({ success: true, data: { id: candidate.id, result: 'pass' } }); }
        return json({ success: true, data: { id: body.id ?? body.candidateId ?? body.eventId ?? u(99) } });
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
      if (table === 'library_assets') return json([{ id: 7, title: 'Taegeuk Il Jang', library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'White', video_url: '', description: JSON.stringify({ text: 'First form', actualCategory: 'Forms (Poomsae)' }), created_at: '2026-10-01T00:00:00Z', revision: 1, published_revision: null, student_curriculum_id: null }]);
      return json([]);
    }
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('belt_head_coach'); await page.locator('#login-password').fill('Fictional-Test-Password'); await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  const nav = page.getByRole('navigation', { name: 'Portal navigation', exact: true });
  await nav.locator('a[href="/belt-tests"]').first().waitFor({ timeout: 30000 });
  await page.goto(base + '/belt-tests', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText(/Color belts \(White to Red\) are tested and scored by the academy/).waitFor({ timeout: 60000 });

  // Test days list: both tracks, labelled.
  await page.getByText('Yellow belt test day', { exact: true }).waitFor();
  assert.ok(await page.getByText('Kukkiwon via CTF', { exact: true }).count() >= 1);

  // Score sheet: live preview uses the shared scoring formula.
  await page.getByText('Yellow belt test day', { exact: true }).click();
  await page.getByRole('button', { name: /Fixture Athlete/ }).click();
  const values = { 'Push-ups': '8', 'Flexibility': '7', 'Ap Chagi': '8', 'Arae Makki': '7', 'Taegeuk Il Jang': '8', 'Cartwheel': '6' };
  const waitForPosts = async (action, count) => { const until = Date.now() + 15000; while (posts.filter(row => row.action === action).length < count) { if (Date.now() > until) throw new Error(`Timed out waiting for ${count} ${action} request(s)`); await new Promise(resolve => setTimeout(resolve, 100)); } };
  let saved = 0;
  for (const [item, value] of Object.entries(values)) {
    const field = page.getByLabel(`Score out of 10 for ${item}`, { exact: true });
    await field.fill(value); await field.press('Enter');
    await waitForPosts('score', ++saved);
  }
  await page.getByText('75.58%', { exact: true }).waitFor({ timeout: 15000 });
  const scorePosts = posts.filter(row => row.action === 'score');
  assert.equal(scorePosts.length, 6, 'one save per item');
  assert.ok(scorePosts.every(row => row.revision === 0 && typeof row.score === 'number' && row.requestKey), 'first saves are revision 0 with a request key');
  await page.getByRole('button', { name: 'Finalize result', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await waitForPosts('finalize', 1);
  await page.getByText('Pass (final)', { exact: false }).waitFor({ timeout: 15000 });
  assert.ok(posts.some(row => row.action === 'finalize' && row.candidateId === u(61)));

  // Kukkiwon: curriculum, no scoring inputs, and a formula-safe CTF export.
  await page.getByRole('button', { name: '← All test days' }).click();
  await page.getByText('Kukkiwon 1st Poom/Dan test', { exact: true }).first().click();
  await page.getByText('Test curriculum', { exact: true }).waitFor();
  await page.getByText('Koryo', { exact: true }).waitFor();
  assert.equal(await page.getByLabel(/Score out of 10/).count(), 0, 'Kukkiwon tests have no academy scoring');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CTF list (CSV)' }).click()]);
  const csv = await readFile(await download.path(), 'utf8');
  assert.match(csv, /Full name \(English\)/);
  assert.match(csv, /'=CMD\|Injected/, 'a cell starting with = is neutralised for spreadsheets');
  assert.match(csv, /Poom/);

  // Syllabus: published version is read-only; a new draft validates the weight total.
  await page.getByRole('button', { name: 'Syllabus & scoring', exact: true }).click();
  await page.getByText('Pass 70%', { exact: false }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'New draft version', exact: true }).click();
  await page.getByText('Weights total 100%', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByLabel('Weight %', { exact: true }).first().fill('40');
  await page.getByText(/must add up to 100/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).isDisabled(), true);

  // Eligibility shows the same rules students see.
  await page.getByRole('button', { name: 'Eligibility', exact: true }).click();
  await page.getByText('Eligible Fixture', { exact: false }).waitFor();

  // Library: lessons show the belt tests that use them, and a published test's lesson cannot be deleted.
  await page.goto(base + '/library', { waitUntil: 'networkidle', timeout: 120000 });
  const usedIn = page.getByRole('list', { name: 'Used in belt tests' }).first();
  await usedIn.getByText('Yellow test', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByTitle('Remove from Library').first().click();
  await page.getByText(/part of the published Yellow belt test syllabus/).first().waitFor();
  assert.equal(posts.some(row => row.action === 'DELETE'), false, 'no delete request is sent');

  // LMS: the White track shows what the Yellow test covers and marks its lessons.
  await page.goto(base + '/lms', { waitUntil: 'networkidle', timeout: 120000 });
  const panel = page.getByRole('region', { name: /Yellow belt test · what is tested/ });
  await panel.waitFor({ timeout: 30000 });
  await panel.getByRole('button', { name: 'Taegeuk Il Jang', exact: true }).waitFor();
  await page.getByText('On the Yellow test', { exact: true }).first().waitFor();

  // Narrow screens: no horizontal page scroll.
  await page.goto(base + '/belt-tests', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText(/Color belts \(White to Red\) are tested/).waitFor({ timeout: 60000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Test days', exact: true }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll at 390px (' + overflow + 'px)');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scorePosts: scorePosts.length, finalized: true, csvExport: true, libraryBadge: true, deleteGuard: true, lmsNextTest: true, mobileOverflow: overflow, pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'scratch/belt-tests-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  throw error;
} finally { await browser.close(); }
