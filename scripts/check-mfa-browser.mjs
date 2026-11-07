import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// All identities, sessions and factors are synthetic. No live account changes.
const base = process.argv[2] || 'http://127.0.0.1:3000';
const id = '93000000-0000-4000-8000-000000000001';
const factorId = '93000000-0000-4000-8000-000000000002';
const microsoftFactorId = '93000000-0000-4000-8000-000000000003';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'mfa@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'mfa_fixture', email: user.email, display_name: 'MFA fixture owner', role: 'Root', is_active: true, must_change_password: false };
let level = 'aal1', verified = true, pending = false, enrollFailure = false, verifyFailure = false, userFailure = false;
let loginFailure = 0, enrollments = 0, gatedReads = 0, holdEnrollment = false, releaseEnrollment;
let holdVerification = false, releaseVerification;
let multipleFactors = false, verificationErrorCode = '', lastVerifiedFactor;
const errors = [];
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aal: level, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
const session = () => ({ user, access_token: token(), refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
let page;
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
      if (window.fixtureClipboardDenied) throw new Error('Fixture clipboard denied');
      window.fixtureCopiedKey = value;
    } } });
  });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  context.on('page', target => {
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => {
      if (message.type() === 'error' && /hydration|lockmanager|unhandled|didn't match/i.test(message.text())) errors.push(message.text());
    });
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'X-Supabase-Api-Version' }, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return loginFailure
        ? json({ success: false, error: { message: loginFailure === 429 ? 'Too many sign-in attempts. Please wait a minute and retry.' : 'Unable to sign in. Check your credentials or contact the academy.' } }, loginFailure)
        : json({ success: true, data: { access_token: token(), refresh_token: 'fixture-refresh' } });
      if (url.pathname.startsWith('/api/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return userFailure
      ? json({ code: 'unexpected_failure', message: 'Fixture outage' }, 503)
      : json({ ...user, factors: verified ? [{ id: factorId, factor_type: 'totp', status: 'verified', friendly_name: 'Google Authenticator' }, ...(multipleFactors ? [{ id: microsoftFactorId, factor_type: 'totp', status: 'verified', friendly_name: 'Microsoft Authenticator' }] : [])] : pending ? [{ id: factorId, factor_type: 'totp', status: 'unverified' }] : [] });
    if (url.pathname === '/auth/v1/token') return json(session());
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/factors' && request.method() === 'POST') {
      ++enrollments;
      if (enrollFailure) return json({ code: 'unexpected_failure', message: 'Fixture enrollment outage' }, 503);
      pending = true;
      const body = { id: factorId, type: 'totp', totp: { qr_code: '<?xml version="1.0"?>\r\n<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#fff"/></svg>\r\n', secret: 'FIXTUREONLY', uri: 'otpauth://totp/fixture?secret=FIXTUREONLY' } };
      if (holdEnrollment) { releaseEnrollment = () => json(body); return; }
      return json(body);
    }
    if (url.pathname === `/auth/v1/factors/${factorId}` && request.method() === 'DELETE') { pending = false; return json({ id: factorId }); }
    if (url.pathname.endsWith('/challenge')) return json({ id: 'fixture-challenge', expires_at: Math.floor(Date.now() / 1000) + 60 });
    if (url.pathname.endsWith('/verify')) {
      if (verificationErrorCode) return json({ code: verificationErrorCode, message: 'Fixture verification rejection' }, verificationErrorCode === 'over_request_rate_limit' ? 429 : 422);
      if (verifyFailure) return json({ code: 'unexpected_failure', message: 'Fixture verification outage' }, 503);
      if (request.postDataJSON().code !== '123456' || (!verified && !pending)) return json({ code: 'mfa_verification_failed', message: 'Fixture invalid code' }, 422);
      lastVerifiedFactor = url.pathname.split('/').at(-2);
      level = 'aal2'; verified = true; pending = false;
      const upgradedSession = session();
      if (holdVerification) { releaseVerification = () => json(upgradedSession); return; }
      return json(upgradedSession);
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') {
        if (url.searchParams.has('id')) return json(profile);
      } else if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Infinity TKD' });
      const bearer = request.headers().authorization?.split(' ')[1];
      const requestLevel = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()).aal : null;
      if (requestLevel !== 'aal2') ++gatedReads;
      return json(table === 'profiles' ? [profile] : []);
    }
    return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  const heading = target => target.getByRole('heading', { name: 'Administrator verification', exact: true });
  const setup = () => page.getByRole('button', { name: 'Set up authenticator', exact: true });
  const retry = () => page.getByRole('button', { name: 'Retry verification', exact: true });
  const qr = () => page.getByRole('img', { name: 'Scan this code using your authenticator app' });
  const submitCode = async value => {
    await page.getByLabel('Authenticator code', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  };
  const signIn = async () => {
    await page.locator('#login-identifier').fill(profile.username);
    await page.locator('#login-password').fill('Fixture-Password');
    await page.locator('button[type=submit]').click();
  };
  const dashboard = async target => {
    await target.waitForURL('**/dashboard', { timeout: 60000 });
    await target.getByText(profile.display_name, { exact: true }).first().waitFor();
  };
  const signOut = async () => {
    await page.getByRole('button', { name: /^sign out$/i }).click();
    await page.waitForURL(base + '/');
    await page.locator('#login-identifier').waitFor();
  };

  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  console.log('MFA checks: password failures and existing-factor challenge');
  loginFailure = 401; await signIn();
  await page.getByText('Unable to sign in. Check your credentials or contact the academy.', { exact: true }).waitFor();
  assert.equal(await heading(page).count(), 0);
  loginFailure = 429; await signIn();
  await page.getByText('Too many sign-in attempts. Please wait a minute and retry.', { exact: true }).waitFor();
  loginFailure = 0; await signIn(); await heading(page).waitFor();
  await page.getByLabel('Authenticator code', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await heading(page).waitFor();
  await submitCode('000000'); await page.getByRole('alert').filter({ hasText: 'Verification was not confirmed' }).waitFor();
  verificationErrorCode = 'over_request_rate_limit'; await submitCode('123456');
  await page.getByRole('alert').filter({ hasText: 'Too many authenticator attempts' }).waitFor();
  verificationErrorCode = 'mfa_challenge_expired'; await submitCode('123456');
  await page.getByRole('alert').filter({ hasText: 'verification challenge expired' }).waitFor();
  verificationErrorCode = '';
  verifyFailure = true; await submitCode('123456'); await page.getByRole('alert').filter({ hasText: 'authenticator service is temporarily unavailable' }).waitFor();
  verifyFailure = false;
  multipleFactors = true; await retry().click();
  await page.getByLabel('Choose authenticator', { exact: true }).selectOption(microsoftFactorId);
  await page.getByLabel('Authenticator code', { exact: true }).evaluate(input => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text', '123 456');
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  });
  assert.equal(await page.getByLabel('Authenticator code', { exact: true }).inputValue(), '123456', 'formatted codes copied from authenticator apps keep all six digits');
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await dashboard(page);
  assert.equal(lastVerifiedFactor, microsoftFactorId, 'the chosen authenticator is used for verification');
  multipleFactors = false;
  await page.reload({ waitUntil: 'networkidle' }); await dashboard(page);
  await signOut();

  level = 'aal1'; verified = false; enrollFailure = true;
  console.log('MFA checks: enrollment, manual key and reload recovery');
  await signIn(); await setup().click();
  await page.getByRole('alert').filter({ hasText: 'Authenticator setup failed' }).waitFor();
  enrollFailure = false; await setup().click(); await qr().waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('img[alt="Scan this code using your authenticator app"]');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.getByText('Enter setup key manually', { exact: true }).click();
  await page.getByText('FIXTUREONLY', { exact: true }).waitFor();
  await page.getByText('Time based', { exact: true }).waitFor();
  await page.getByText('Microsoft Authenticator:', { exact: true }).waitFor();
  await page.getByText('Other account (Google, Facebook, etc.)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Copy setup key', exact: true }).click();
  await page.getByText('Setup key copied.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixtureCopiedKey), 'FIXTUREONLY');
  await page.evaluate(() => { window.fixtureClipboardDenied = true; });
  await page.getByRole('button', { name: 'Copy setup key', exact: true }).click();
  await page.getByText('Copy is unavailable. Select the key above and copy it manually.', { exact: true }).waitFor();
  await page.getByText('Enter setup key manually', { exact: true }).click();
  await qr().dispatchEvent('error');
  await page.getByText('The QR image could not load. Use the manual setup key below.', { exact: true }).waitFor();
  await page.getByText('FIXTUREONLY', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const beforeRetry = enrollments;
  userFailure = true; await retry().click();
  await page.getByRole('alert').filter({ hasText: 'Security verification could not load' }).waitFor();
  userFailure = false; await retry().click();
  await page.getByText('FIXTUREONLY', { exact: true }).waitFor();
  assert.equal(enrollments, beforeRetry, 'status recovery preserves the current enrollment');
  await page.reload({ waitUntil: 'networkidle' });
  await setup().waitFor();
  assert.equal(await qr().count(), 0, 'reload never persists the setup secret');
  await setup().click(); await qr().waitFor();
  verificationErrorCode = 'mfa_factor_not_found';
  await submitCode('123456');
  await page.getByRole('alert').filter({ hasText: 'This authenticator was removed' }).waitFor();
  assert.equal(await qr().count(), 0, 'removed authenticators clear their setup key and QR immediately');
  verificationErrorCode = ''; pending = false;
  await setup().click(); await qr().waitFor();
  await submitCode('123456'); await dashboard(page);
  await signOut();

  // Another tab completes MFA. This tab must load a fresh protected snapshot.
  console.log('MFA checks: cross-tab session changes');
  level = 'aal1'; await signIn(); await heading(page).waitFor();
  const other = await context.newPage();
  await other.goto(base, { waitUntil: 'networkidle' }); await heading(other).waitFor();
  await other.getByLabel('Authenticator code', { exact: true }).fill('123456');
  await other.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await dashboard(other); await dashboard(page);
  // A downgraded session must close the dashboard in both tabs.
  level = 'aal1';
  await other.evaluate(async () => {
    const { error } = await window.__infinitySupabase.client.auth.refreshSession();
    if (error) throw new Error('Fixture refresh failed');
  });
  await heading(other).waitFor(); await heading(page).waitFor();
  assert.equal(await page.getByText(profile.display_name, { exact: true }).count(), 0);
  await signOut(); await other.locator('#login-identifier').waitFor(); await other.close();

  // A late enroll response after an external sign-out must not restore a QR.
  console.log('MFA checks: late enrollment and verification responses');
  verified = false; pending = false; holdEnrollment = true;
  await signIn(); await setup().click();
  await assertEventually(() => !!releaseEnrollment, 'enrollment request in flight');
  await page.evaluate(() => window.__infinitySupabase.client.auth.signOut({ scope: 'global' }));
  await page.locator('#login-identifier').waitFor();
  holdEnrollment = false; await releaseEnrollment();
  await page.waitForLoadState('networkidle');
  assert.equal(await qr().count(), 0);
  assert.equal(await page.getByText('FIXTUREONLY', { exact: true }).count(), 0);
  await signIn(); await setup().click(); await qr().waitFor();
  await submitCode('123456'); await dashboard(page); await signOut();

  // The SDK must not reopen a signed-out account when verification finishes late.
  level = 'aal1'; holdVerification = true;
  await signIn(); await heading(page).waitFor();
  await page.evaluate(() => {
    window.fixtureMfaEvents = 0;
    window.__infinitySupabase.client.auth.onAuthStateChange(event => {
      if (event === 'MFA_CHALLENGE_VERIFIED') window.fixtureMfaEvents++;
    });
  });
  await submitCode('123456');
  await assertEventually(() => !!releaseVerification, 'verification request in flight');
  await page.evaluate(() => window.__infinitySupabase.client.auth.signOut({ scope: 'global' }));
  await page.locator('#login-identifier').waitFor();
  holdVerification = false; await releaseVerification();
  await page.waitForFunction(() => window.fixtureMfaEvents > 0);
  await page.waitForFunction(async () => !(await window.__infinitySupabase.client.auth.getSession()).data.session, null, { timeout: 10000 });
  await page.locator('#login-identifier').waitFor();
  assert.equal(gatedReads, 0, 'private datasets stay blocked until MFA is verified');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, passwordFailure: true, throttlingRecovery: true, challengeReload: true, verificationOutage: true, enrollmentOutage: true, googleAndMicrosoftGuidance: true, factorSelection: true, formattedCodePaste: true, removedFactorRecovery: true, manualKeyCopy: true, clipboardFallback: true, qrLoadFallback: true, mobile: true, pendingReload: true, crossTabMfa: true, assuranceDowngrade: true, staleEnrollment: true, staleVerification: true, gatedReads, pageErrors: errors.length }));
} catch (error) {
  if (page) await page.screenshot({ path: 'scratch/mfa-browser-failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }

async function assertEventually(check, message) {
  const deadline = Date.now() + 10000;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(check(), message);
}
