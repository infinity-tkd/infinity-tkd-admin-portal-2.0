import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3102';
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
// Fictional identities and mocked services: no real credentials or database writes.
const id = '70000000-0000-4000-8000-000000000099';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'regression@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'regression_admin', email: user.email, display_name: 'Regression Admin', role: 'Root', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
let profileReads = 0;
let loginRequests = 0;
let deferStudents = false;
let deferLogout = false;
let failLogout = false;
let releaseLogout;
const pendingStudents = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  const errors = [];
  const track = page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /hydration|lockmanager|unhandled|didn't match/i.test(message.text())) errors.push(message.text()); });
  };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') { ++loginRequests; return json({ success: true, data: { access_token: token, refresh_token: 'test-refresh' } }); }
      if (url.pathname.startsWith('/api/admin/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') {
      if (failLogout) return json({ code: 'unexpected_failure', message: 'Fictional provider outage' }, 503);
      if (deferLogout && route.request().frame().page() === page) { releaseLogout = () => route.fulfill({ status: 204 }); return; }
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') { ++profileReads; return json(url.searchParams.has('id') ? profile : [profile]); }
      if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Infinity Taekwondo' });
      if (table === 'students' && deferStudents) {
        pendingStudents.push(() => json([{ id: 'STALE-STUDENT', english_name: 'Late Private Student', student_status: 'Active' }]));
        return;
      }
      return json([]);
    }
    // Prevent outbound calls to any real provider during this test.
    return route.abort();
  });
  const page = await context.newPage(); track(page);
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').waitFor();
  const authKey = await page.evaluate(() => new URL(window.__infinitySupabase.url).hostname.split('.')[0]);
  // Reproduce the reported condition: another tab holds the legacy SDK lock.
  const holder = await context.newPage(); track(holder);
  await holder.goto(base, { waitUntil: 'networkidle' });
  await holder.evaluate(name => {
    window.testLockHeld = false;
    window.testLockTask = navigator.locks.request(name, () => new Promise(resolve => {
      window.testReleaseLock = resolve;
      window.testLockHeld = true;
    }));
  }, `lock:sb-${authKey}-auth-token`);
  await holder.waitForFunction(() => window.testLockHeld);
  const signIn = async target => {
    await target.locator('#login-identifier').fill('regression_admin');
    await target.locator('#login-password').fill('Fictional-Test-Password');
    await target.locator('button[type=submit]').click();
    await target.waitForURL('**/dashboard', { timeout: 30000 });
    await target.getByText('Regression Admin', { exact: true }).first().waitFor();
  };
  await signIn(page);
  // Account links and direct reloads must render the personal page, never a 404.
  await page.getByRole('link', { name: 'Open my account' }).click();
  await page.waitForURL('**/profile');
  await page.getByRole('heading', { name: 'My account', exact: true, level: 1 }).waitFor();
  assert.equal((await page.reload({ waitUntil: 'networkidle' })).status(), 200, '/profile direct reload');
  await page.getByRole('heading', { name: 'My account', exact: true, level: 1 }).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'account page fits mobile width');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(async () => (await navigator.locks.query()).pending.length), 0, 'login must not wait for the contended Navigator lock');
  await holder.waitForURL('**/dashboard', { timeout: 30000 });
  assert.equal(await holder.evaluate(() => window.testLockHeld), true);
  // Both tabs establish and restore the same session while the old lock is held.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Regression Admin', { exact: true }).first().waitFor();
  const beforeRefresh = profileReads;
  const refreshError = await page.evaluate(async () => (await window.__infinitySupabase.client.auth.refreshSession()).error?.message);
  assert.equal(refreshError, undefined);
  assert.equal(profileReads, beforeRefresh, 'token refresh must not reload all tables');
  // Leave a private-data load in flight, then sign out in the other tab.
  deferStudents = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Regression Admin', { exact: true }).first().waitFor();
  await page.waitForFunction(() => window.__infinitySupabase.client !== undefined);
  const stopAt = Date.now() + 10000;
  while (!pendingStudents.length && Date.now() < stopAt) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(pendingStudents.length, 'delayed student snapshot must be in flight');
  await holder.evaluate(() => window.__infinitySupabase.client.auth.signOut({ scope: 'global' }));
  await page.locator('#login-identifier').waitFor({ timeout: 10000 });
  for (const release of pendingStudents.splice(0)) await release();
  deferStudents = false;
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText('Regression Admin', { exact: true }).count(), 0, 'late private snapshot cannot restore signed-out account');
  assert.equal(await page.getByText('Late Private Student', { exact: true }).count(), 0);
  await signIn(page);
  await page.getByText('Regression Admin', { exact: true }).first().waitFor();
  // A new sign-in cannot race a slow global sign-out and lose its session.
  deferLogout = true;
  await page.getByRole('button', { name: /sign out/i }).click();
  // Another tab can end the shared session while this tab's own logout waits.
  await holder.evaluate(() => window.__infinitySupabase.client.auth.signOut({ scope: 'global' }));
  await page.waitForURL(base + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-identifier').waitFor();
  const requestsBefore = loginRequests;
  await page.locator('#login-identifier').fill('regression_admin');
  await page.locator('#login-password').fill('Fictional-Test-Password');
  await page.locator('button[type=submit]').click();
  const logoutDeadline = Date.now() + 10000;
  while (!releaseLogout && Date.now() < logoutDeadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(releaseLogout, 'global sign-out request must be in flight');
  assert.equal(loginRequests, requestsBefore, 'new sign-in waits for older sign-out');
  deferLogout = false;
  await releaseLogout();
  await page.waitForURL('**/dashboard').catch(async error => {
    console.error('Delayed logout diagnostics:', { loginRequests, profileReads, errors, url: page.url() });
    throw error;
  });
  await page.getByText('Regression Admin', { exact: true }).first().waitFor();
  failLogout = true;
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.getByText('Could not confirm sign-out on all devices. Please sign in again and retry from Account Security.', { exact: true }).waitFor();
  await page.locator('#login-identifier').waitFor();
  assert.equal(await page.evaluate(async () => (await window.__infinitySupabase.client.auth.getSession()).data.session), null, 'provider failure must still clear the local session');
  failLogout = false;
  await holder.evaluate(() => window.testReleaseLock());
  assert.deepEqual(errors, []);
  console.log('Auth browser checks passed: login with a contended legacy lock, account navigation/direct reload/mobile layout, cross-tab session sync, reload, token refresh, sign-out during a delayed private-data load, login again, login during a slow global sign-out, and failed-logout reporting. All provider responses mocked; no live account or database changes.');
} finally { await browser.close(); }
