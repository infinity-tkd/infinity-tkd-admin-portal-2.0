import { chromium, webkit } from 'playwright';

// Shared set-up for the browser audits. Every API and Supabase request is intercepted with
// fictional fixtures, so nothing real is read or written. PORTAL_BROWSER=webkit runs the audit in
// Playwright's WebKit (Safari's engine) instead of Chromium.
export const ACTOR = '9c000000-0000-4000-8000-000000000001';
// The browser stores the Supabase session under a key derived from the project URL;
// set PORTAL_STORAGE_KEY when the build was made against a different project (for example CI's fixture URL).
const STORAGE_KEY = process.env.PORTAL_STORAGE_KEY || 'sb-lyjxmkyvqazqxkzoeszr-auth-token';
/** Every page behind the sign-in (the sign-in page and the 404 page are audited separately). */
export const PORTAL_ROUTES = ['/dashboard', '/operations', '/students', '/members', '/attendance', '/financials', '/pos', '/pro-shop', '/lms', '/belt-tests', '/library', '/schedule', '/calendar', '/partners', '/settings', '/profile'];

export async function launchBrowser() {
  if (process.env.PORTAL_BROWSER === 'webkit') return webkit.launch({ headless: true });
  return chromium.launch({
    headless: true,
    // Requests a service worker makes itself are not seen by Playwright's routing; keep them from ever reaching a real Supabase host.
    args: ['--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, MAP *.supabase.com ~NOTFOUND'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  });
}

/** Fictional data. `students` scales the roster (large-data runs); `empty` returns no records at all. */
export function portalFixtures({ students: count = 6, empty = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const belts = ['White', 'Yellow', 'Green', 'Blue', 'Red', '1st Poom/Dan'];
  const students = empty ? [] : Array.from({ length: count }, (_, index) => ({
    id: 'STU-M-' + String(index + 1).padStart(3, '0'), khmer_name: 'Fixture ' + index,
    english_name: index === 0 ? 'Fixture Athlete With An Exceptionally Long Legal Name' : 'Fixture Athlete ' + (index + 1),
    gender: index % 2 ? 'Female' : 'Male', dob: `${2008 + (index % 8)}-${String((index % 12) + 1).padStart(2, '0')}-15`,
    registration_date: '2026-01-15', membership_start_date: '2026-01-15', scholarship_id: 1,
    current_belt: belts[index % belts.length], student_status: 'Active', home_branch_id: 1, student_addresses: [], phone: '+85512000000',
  }));
  const classSession = { id: 1, branch_id: 1, class_name: 'Fixture evening sparring class', class_type: 'General Class', day_of_week: 'Sunday', days_of_week: ['Sunday', 'Wednesday'], start_time: '17:00', end_time: '18:30', capacity: 30, standard_duration_mins: 90 };
  const partners = empty ? [] : [{ id: '9c000000-0000-4000-8000-000000000101', name: 'Fixture National Sport University Taekwondo Department', brand_name: 'Fixture University', partner_type: 'MOU', status: 'Active', contact_name: 'Fixture liaison', contact_role: 'Director', phone: '+85512000001', email: 'liaison@example.test', telegram_username: 'fixture_liaison', country: 'Cambodia', mou_expiry_date: today, tags: ['education'] }];
  const profile = { id: ACTOR, username: 'responsive_fixture', email: 'responsive@example.test', display_name: 'Responsive fixture administrator with a long display name', role: 'Root', is_active: true, must_change_password: false };
  const user = { id: ACTOR, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ACTOR, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  return { today, students, classSession, partners, profile, user, token, empty };
}

const BELT_ROWS = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan'].map((belt_name, index) => ({ id: index + 1, belt_name, belt_order: index + 1, belt_type: index < 6 ? 'color' : 'black' }));

/** The empty-but-valid answer the server gives for each /api/operations view (see lib/operations-read.ts). */
function operationsView(view, fx) {
  const policy = { id: 'default', reminder_lead_days: 3, late_grace_days: 5 };
  const shapes = {
    today: { tasks: [], notices: [], today: fx.today },
    tasks: { tasks: [], notices: [], today: fx.today },
    sessions: { sessions: [], roster: [], attendance: [], holidays: [] },
    billing: { invoices: [], receipts: [], credits: [], pauses: [], policy, allocations: [], uses: [] },
    reconciliation: { lines: [], receipts: [], collections: { total: 0, legacy: 0, receipts: 0 } },
    timeline: { events: [], enrollmentHistory: [] },
    grading: { events: [], belts: BELT_ROWS },
    performance: [],
    quality: { findings: [], checkedAt: new Date().toISOString() },
    health: { serverTime: new Date().toISOString(), runs: [], leases: [], failures: [], workerConfigured: true, pushConfigured: false },
    policy: [policy],
  };
  return shapes[view] ?? [];
}

/** The sparse-but-valid answer the Coaching hub gets for each /api/admin/lms view (see components/lms/coaching-shared.tsx). */
function lmsView(view, fx) {
  const shapes = {
    overview: {
      students: fx.students.map(row => ({ id: row.id, english_name: row.english_name, current_belt: row.current_belt, student_status: row.student_status, home_branch_id: row.home_branch_id })),
      lessons: [], belts: BELT_ROWS.map(({ id, belt_name, belt_order }) => ({ id, belt_name, belt_order })),
      classes: [{ id: 1, class_name: 'Fixture evening sparring class', branch_id: 1 }], branches: [{ id: 1, branch_name: 'Fixture branch' }],
      categories: [], forms: [], achievements: [], studentLmsPushEnabled: false, waiting: { submissions: 0, forms: 0 },
    },
    review: { submissions: [], forms: [] },
    assignments: { assignments: [] },
    challenges: { challenges: [] },
    forms: { forms: [], questionCounts: {} },
    achievements: { definitions: [], awards: [] },
    attention: { items: [] },
    quiz: { questions: [] },
    assignment: { students: [] },
  };
  return shapes[view] ?? {};
}

/**
 * A signed-in browser context with every request answered by the fixtures.
 * options: theme, language ('en' | 'kh' | 'zh'), viewport, mobile/touch/scale (device emulation), signedIn, serviceWorkers, reducedMotion,
 * apiDelayMs (slow API), failApi (every data request answers 503), students (roster size), empty (no records).
 */
export async function openPortal(browser, base, options = {}) {
  const { theme = 'light', language = 'en', viewport = { width: 1440, height: 900 }, mobile = false, touch = false, scale = 1, signedIn = true, serviceWorkers = 'block', reducedMotion = 'reduce', apiDelayMs = 0, failApi = false, students, empty = false } = options;
  const fx = portalFixtures({ students, empty });
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: touch, deviceScaleFactor: scale, serviceWorkers, reducedMotion });
  await context.addInitScript(({ key, session, theme, language, signedIn }) => {
    try { if (signedIn) localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('infinity_theme', theme); localStorage.setItem('infinity_lang', language); } catch { /* storage is optional */ }
  }, { key: STORAGE_KEY, session: { access_token: fx.token, refresh_token: 'fictional-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: fx.user }, theme, language, signedIn });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.routeWebSocket('**/_next/webpack-hmr*', socket => socket.close());
  const origin = new URL(base).origin;
  const later = () => apiDelayMs ? new Promise(resolve => setTimeout(resolve, apiDelayMs)) : null;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body ?? null) });
    if (url.origin === origin) {
      if (!url.pathname.startsWith('/api/')) return route.continue();
      await later();
      if (failApi) return json({ success: false, error: { message: 'Fixture outage' } }, 503);
      if (url.pathname === '/api/notifications') return json({ success: true, data: { notices: [], preferences: { push_enabled: false, muted_categories: [], quiet_start: 22, quiet_end: 7 }, push: { ready: false, publicKey: '' } } });
      if (url.pathname === '/api/admin/events') return json({ success: true, data: { events: [], nextCursor: null, lookups: { branches: [], classes: [], students: [] }, permissions: { create: true, edit: true, publish: true, notify: true, archive: true } } });
      if (url.pathname === '/api/admin/student-summaries') return json({ success: true, data: fx.students });
      if (url.pathname === '/api/admin/partners') return json({ success: true, data: fx.partners });
      if (url.pathname === '/api/operations') return json({ success: true, data: operationsView(url.searchParams.get('view') ?? 'today', fx) });
      if (url.pathname === '/api/attendance/makeup') return json({ success: true, data: { candidates: [], records: [], classes: [] } });
      if (url.pathname === '/api/admin/promotions/reconcile') return json({ success: true, data: { success: true, scanned: fx.students.length, corrected: 0, details: [] } });
      if (url.pathname === '/api/admin/student-portal-preparation' && request.method() === 'GET') return json({ success: true, data: url.searchParams.get('view') === 'confirmations' ? { student: { id: 'STU-M-001', english_name: fx.students[0]?.english_name ?? 'Fixture student', current_belt: 'White', initial_belt: 'White', registration_date: '2026-01-15' }, policies: [], confirmations: [] } : { drafts: [], policies: [], rankings: [], currentRankingCount: 0, curriculum: [], publicationEnabled: false } });
      if (url.pathname === '/api/admin/lms' && request.method() === 'GET') return json({ success: true, data: lmsView(url.searchParams.get('view') ?? 'overview', fx) });
      if (url.pathname === '/api/belt-tests') {
        const view = url.searchParams.get('view');
        const belts = BELT_ROWS;
        if (view === 'overview') return json({ success: true, data: { belts, syllabi: [], events: [] } });
        if (view === 'eligibility') return json({ success: true, data: { students: [] } });
        if (view === 'eligibility_all') return json({ success: true, data: { entries: {} } });
        return json({ success: true, data: { usage: [], tests: [] } });
      }
      return json({ success: true, data: [] });
    }
    if (url.pathname === '/auth/v1/user') return json(fx.user);
    if (url.pathname === '/auth/v1/token') return json({ user: fx.user, access_token: fx.token, refresh_token: 'fictional-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (!['GET', 'HEAD'].includes(request.method())) return json([]);
      await later();
      if (table === 'profiles' && url.searchParams.get('id') === 'eq.' + ACTOR) return json(fx.profile);
      if (table === 'members' && url.searchParams.get('id') === 'eq.' + ACTOR) return json(null);
      if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Fixture academy', enable_audio_chimes: false });
      if (failApi) return json({ code: 'PGRST000', message: 'Fixture outage', details: null, hint: null }, 503);
      if (table === 'students' && request.headers().accept?.includes('vnd.pgrst.object')) return json(fx.students[0] ?? null);
      const data = {
        profiles: [fx.profile], students: fx.students, branches: [{ id: 1, branch_name: 'Fixture branch', is_active: true }],
        class_sessions: empty ? [] : [fx.classSession],
        class_enrollments: fx.students.map((row, index) => ({ id: index + 1, student_id: row.id, class_id: 1, enrollment_date: '2026-01-15', enrolled_at: '2026-01-15T00:00:00Z' })),
        scholarships: [{ id: 1, type_name: 'Standard', discount_percentage: 0 }],
      };
      return json(data[table] || []);
    }
    return route.abort();
  });
  return { context, fixtures: fx };
}

/** Opens a portal page and waits for its heading; resolves false when the page never renders. */
export async function gotoPortalRoute(page, base, route, { timeout = 90000 } = {}) {
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 180000 });
    await page.locator('[data-portal-shell]').waitFor({ timeout });
    await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    return true;
  } catch { return false; }
}

/** Collects runtime errors, warnings, failed requests and HTTP errors of this origin while a page is used. */
export function trackHealth(page, base) {
  const origin = new URL(base).origin;
  const health = { errors: [], warnings: [], failed: [], http: [] };
  page.on('pageerror', error => health.errors.push(String(error.message).slice(0, 300)));
  page.on('console', entry => {
    const text = entry.text().slice(0, 300);
    if (entry.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|ERR_ABORTED/.test(text)) health.errors.push(text);
    else if (entry.type() === 'warning') health.warnings.push(text);
  });
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText || '';
    if (request.url().startsWith(origin) && !/ERR_ABORTED|cancelled/i.test(reason)) health.failed.push(`${request.method()} ${new URL(request.url()).pathname} ${reason}`);
  });
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) health.http.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  return health;
}
