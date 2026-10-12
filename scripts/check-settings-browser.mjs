import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3102';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
// Fictional identities and mocked services: no real credentials or database writes.
const id = '70000000-0000-4000-8000-000000000099';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'regression@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'regression_admin', email: user.email, display_name: 'Regression Admin', role: 'Root', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
let stored = { id: 'default', academy_name: 'Infinity Taekwondo', contact_phone: '123', support_email: 'support@example.test', updated_at: '2026-10-11T01:00:00.000Z' };
let failure = false; let conflict = false; let denied = false; let userFailure = false; let partnerFailure = true;
const saves = []; const errors = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'test-refresh' } });
      if (url.pathname === '/api/admin/partners') return partnerFailure
        ? json({ success: false, error: { code: 'AUTH_DATABASE_SETUP_REQUIRED', message: 'Account security setup is incomplete. Apply the profile security SQL repair in Supabase, then retry.' } }, 503)
        : json({ success: true, data: [{ id: '50000000-0000-4000-8000-000000000001', name: 'Fictional Partner Academy', partner_type: 'MOU', status: 'Active', country: 'Cambodia', created_at: '2026-10-11T01:00:00Z' }] });
      if (url.pathname === '/api/admin/update-academy-profile') {
        const patch = route.request().postDataJSON(); saves.push(patch);
        if (failure) return json({ success: false, error: { message: 'Fictional settings outage' } }, 503);
        if (conflict) { conflict = false; stored = { ...stored, academy_name: 'Other admin change', contact_phone: '456', updated_at: '2026-10-11T02:00:00.000Z' }; return json({ success: false, error: { message: 'Settings changed. Review your edits.' } }, 409); }
        for (const [key, value] of Object.entries(patch)) if (key !== 'expectedUpdatedAt') stored[key.replace(/[A-Z]/g, value => '_' + value.toLowerCase())] = value;
        stored.updated_at = '2026-10-11T03:00:00.000Z';
        return json({ success: true, data: stored });
      }
      if (url.pathname === '/api/admin/update-user' && userFailure) return json({ success: false, error: { message: 'Fictional account outage' } }, 503);
      if (url.pathname.startsWith('/api/admin/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') { const value = { ...profile, role: denied ? 'Admin' : 'Root' }; return json(url.searchParams.has('id') ? value : [value]); }
      if (table === 'user_permissions' && denied) return json(['staff_manage','partner_create','partner_edit','partner_delete'].map(permission => ({user_id:id,permission_key:'action:'+permission,is_granted:false})));
      if (table === 'academy_profile') return json(stored);
      if (table === 'branches') return json([{ id: 1, branch_name: 'Main academy' }]);
      return json([]);
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|unhandled|didn't match/i.test(message.text())) errors.push(message.text()); });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('regression_admin'); await page.locator('#login-password').fill('Fictional-Test-Password'); await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.getByText('Regression Admin', { exact: true }).first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.goto(base + '/partners', { waitUntil: 'networkidle', timeout: 120000 });
  const partnerAlert = page.getByRole('alert').filter({ hasText: 'Partner directory unavailable' });
  await partnerAlert.getByText(/profile security SQL repair/).waitFor();
  assert.equal(await page.getByRole('alertdialog').count(), 0, 'loading failures stay inline');
  assert.equal(await page.getByText('No Partners Found', {exact:true}).count(), 0, 'failed request cannot claim an empty directory');
  await partnerAlert.getByRole('button', {name:'Retry',exact:true}).click();
  await partnerAlert.getByRole('button', {name:'Retry',exact:true}).waitFor();
  assert.equal(await page.getByRole('alertdialog').count(), 0, 'failed retry does not raise an unhandled error');
  partnerFailure = false;
  await partnerAlert.getByRole('button', {name:'Retry',exact:true}).click();
  await page.getByText('Fictional Partner Academy', {exact:true}).first().waitFor();
  await partnerAlert.waitFor({state:'hidden'});
  partnerFailure = true;
  await page.getByRole('button', {name:'Synchronize partner directory'}).click();
  await partnerAlert.getByText(/Previously loaded records/).waitFor();
  assert.equal(await page.getByText('Fictional Partner Academy', {exact:true}).first().isVisible(), true, 'outage retains previously loaded records');
  partnerFailure = false;
  await page.goto(base + '/settings', { waitUntil: 'networkidle', timeout: 120000 });
  const nav = page.getByRole('navigation', { name: 'Settings sections' });
  await nav.getByRole('button', { name: /academy/i }).click().catch(async error => { await page.screenshot({path:'scratch/settings-failure.png'}); console.error('Settings navigation diagnostic:',{ url:page.url(), errors, buttons:await page.getByRole('button').allTextContents() }); throw error; });
  const form = page.getByRole('form', { name: 'Academy settings' });
  const name = page.getByLabel('Academy name', { exact: false });
  const save = form.getByRole('button', { name: 'Save changes', exact: true });
  assert.equal(await save.isDisabled(), true);
  await name.fill('Draft academy');
  await nav.getByRole('button', { name: /preferences/i }).click();
  await nav.getByRole('button', { name: /academy/i }).click();
  assert.equal(await name.inputValue(), 'Draft academy', 'draft survives switching sections');
  await page.getByLabel('Search academy settings').fill('standard monthly');
  assert.equal(await page.getByLabel('Standard monthly tuition (USD)', { exact: true }).isVisible(), true);
  await page.getByLabel('Standard monthly tuition (USD)', { exact: true }).fill('');
  await save.click();
  await page.locator('#setting-standardTuitionUsd[aria-invalid=true]').waitFor();
  assert.equal(saves.length, 0, 'blank numeric field cannot silently become zero');
  await page.getByLabel('Standard monthly tuition (USD)', { exact: true }).fill('50');
  failure = true; await save.click();
  await form.getByRole('alert').filter({ hasText: 'Fictional settings outage' }).waitFor();
  assert.equal(await name.inputValue(), 'Draft academy');
  assert.deepEqual(Object.keys(saves.at(-1)).sort(), ['academyName', 'expectedUpdatedAt', 'standardTuitionUsd']);
  failure = false; conflict = true; await save.click();
  await form.getByText('Saved settings changed while you were editing.', { exact: true }).waitFor();
  assert.equal(await name.inputValue(), 'Draft academy');
  assert.equal(await page.getByLabel('Contact phone', { exact: true }).inputValue(), '456', 'unrelated remote edit is retained');
  assert.equal(await save.isDisabled(), true);
  await form.getByRole('button', { name: 'Keep my edits', exact: true }).click();
  await save.click(); await form.getByText('Settings saved', { exact: true }).waitFor();
  assert.equal(saves.at(-1).expectedUpdatedAt, '2026-10-11T02:00:00.000Z');
  await page.getByLabel('Contact phone', { exact: true }).fill('');
  await save.click(); await form.getByText('Settings saved', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' }); await nav.getByRole('button', { name: /academy/i }).click();
  assert.equal(await page.getByLabel('Contact phone', { exact: true }).inputValue(), '', 'cleared fields survive reload');
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if(width===375){ await page.getByLabel('Settings section',{exact:true}).selectOption('general'); await page.getByLabel('Settings section',{exact:true}).selectOption('profile'); assert.equal(await page.getByLabel('Academy settings category').isVisible(),true); }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no page overflow at ' + width);
    if(width===1440){
      const navBounds=await nav.boundingBox();
      assert.ok(navBounds && navBounds.height<120 && navBounds.width>600,'desktop uses a compact horizontal settings menu');
      for(const button of await nav.getByRole('button').all())assert.ok((await button.boundingBox()).height>=44,'navigation retains usable touch targets');
    }
    const bounds = await save.boundingBox(); assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44);
    await page.getByLabel('Search academy settings').fill('no-such-field');
    await form.getByText('No settings match this search.', { exact: true }).waitFor();
    await page.screenshot({path:'scratch/settings-mobile-issue.png'});
    await form.getByRole('button', { name: 'Show all settings' }).click();
    await page.locator('main .overflow-y-auto').last().evaluate(element => element.scrollTop = 0);
    await page.screenshot({ path: 'scratch/settings-' + width + '.png', fullPage: true });
  }
  await name.focus(); await name.press('Tab'); assert.equal(await page.getByLabel('Legal name', { exact: true }).evaluate(element => element === document.activeElement), true);
  await nav.getByRole('button', {name:/preferences/i}).click();
  await page.getByRole('button',{name:/dark.*night/i}).click();
  await nav.getByRole('button', {name:/academy/i}).click();
  await page.waitForFunction(() => { const heading=Array.from(document.querySelectorAll('h1')).find(element=>/settings/i.test(element.textContent)); const card=heading?.closest('[class*=shadow-sm]'); return document.documentElement.classList.contains('dark') && card && Number(getComputedStyle(card).backgroundColor.match(/\d+/)?.[0])<100; });
  await page.screenshot({ path: 'scratch/settings-dark.png', fullPage: true });
  await nav.getByRole('button', {name:/accounts/i}).click();
  userFailure = true;
  await page.getByRole('button', {name:/lock.*unlock/i}).first().click();
  await page.getByRole('alertdialog').waitFor();
  assert.equal(await page.getByText(/access toggled|status toggled/).count(),0,'failed account status change cannot claim success');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Edit',exact:true}).first().click();
  const editor=page.getByRole('dialog',{name:'Account editor',exact:true});
  await editor.getByLabel('Display name',{exact:true}).fill('Retained account draft');
  await editor.getByRole('button',{name:/save account/i}).click();
  await page.getByRole('alertdialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await editor.getByLabel('Display name',{exact:true}).inputValue(),'Retained account draft');
  await editor.getByRole('button',{name:/save account/i}).focus();
  await page.keyboard.press('Tab');
  assert.equal(await editor.getByRole('button',{name:'Close user modal'}).evaluate(element=>element===document.activeElement),true,'dialog traps keyboard focus');
  await page.keyboard.press('Escape'); await editor.waitFor({state:'hidden'});
  userFailure = false;
  await nav.getByRole('button', {name:/security/i}).click();
  await page.locator('#security-new-password').fill('short');
  await page.locator('#security-confirm-password').fill('short');
  assert.equal(await page.getByRole('button',{name:'Update Password',exact:true}).isDisabled(),true);
  denied = true; await page.reload({ waitUntil: 'networkidle' }); await nav.getByRole('button', { name: /academy/i }).click();
  await form.getByText(/You have view access/).waitFor();
  assert.equal(await name.isDisabled(), true); assert.equal(await save.isDisabled(), true);
  assert.equal(await nav.getByRole('button', { name: /accounts/i }).count(), 0);
  await page.goto(base + '/partners', {waitUntil:'networkidle'});
  await page.getByText('Fictional Partner Academy', {exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button', {name:'Add Partner',exact:true}).count(),0,'Admin overrides can deny partner creation');
  assert.equal(await page.getByRole('button', {name:/edit|delete/i}).count(),0,'separate edit and delete permissions are enforced in the UI');
  assert.deepEqual(errors, []);
  console.log('Settings and Partners browser checks passed: inline load errors, safe retries, stale record retention, partner permission overrides, compact settings tabs, retained drafts, validation, failed saves, concurrent edits, cleared fields, responsive layouts, keyboard navigation, dark mode, account failure recovery and password rules. All provider traffic mocked; no live database writes.');
} finally { await browser.close(); }
