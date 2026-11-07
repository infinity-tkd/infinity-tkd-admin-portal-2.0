import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { loadTs } from '../tests/load-ts.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3194';
const { ROLE_PERMISSIONS } = loadTs('lib/permissions.ts');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const results = [], errors = [], unexpectedWrites = [], commands = [], network = [];
const asset = { id: 1, title: 'Fixture academy lesson', description: JSON.stringify({ text: 'Approved fixture guidance', actualCategory: 'Kicks (Chagi)' }), library_type: 'Taekwondo', tkd_category: 'Poomsae', target_level: 'White', video_url: 'https://media.example.test/fixture.mp4', revision: 3, student_curriculum_id: 1, published_revision: null, updated_at: '2026-11-03T00:00:00Z', created_at: '2026-01-01T00:00:00Z' };
const routine = { id: 'b3000000-0000-4000-8000-000000000002', title: 'Fixture published routine', description: 'A retained student routine.', difficulty: 'Intermediate', duration: 3, creator: 'Fixture coach', structure: { routineType: 'Taekwondo Workout', prepareSeconds: 10, workSeconds: 30, restSeconds: 15, rounds: 2, exercises: ['Fixture academy lesson'] }, revision: 0, publishedRevision: 0, publicationState: 'published' };
let lastPage;
try {
  for (const role of ['Root', 'Assistant Coach']) {
    const actor = role === 'Root' ? 'b3000000-0000-4000-8000-000000000001' : 'b3000000-0000-4000-8000-000000000003';
    const profile = { id: actor, username: 'fixture_user', email: 'fixture@example.test', display_name: 'Fixture ' + role, role, is_active: true, must_change_password: false };
    const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
    const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(session => localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token', JSON.stringify(session)), { access_token: token, refresh_token: 'fictional-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user });
    await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
    await context.routeWebSocket('**/_next/webpack-hmr*', socket => socket.close());
    let published = false;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') network.push({ role, path: url.pathname, method: request.method() });
      const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (url.origin === new URL(base).origin) {
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/admin/library-assets') {
          if (request.method() === 'POST') { const body = request.postDataJSON(); commands.push({ role, ...body }); assert.equal(body.action, 'PUBLISH'); assert.equal(body.expectedRevision, 3); assert.ok(body.reason.length >= 5); published = true; return json({ success: true, data: { asset: { ...asset, revision: 4, published_revision: 4 }, studentLesson: { id: 1 } } }); }
          const row = { id: 1, title: asset.title, libraryType: 'Taekwondo', targetLevel: 'White', revision: published ? 4 : 3, publishedRevision: published ? 4 : null, isPublished: true, state: published ? 'published' : 'legacy', updatedAt: asset.updated_at };
          return json({ success: true, data: { contractVersion: 'academy-library-v1', items: [row], hasMore: false, offset: 0 } });
        }
        if (!['GET', 'HEAD'].includes(request.method()) && !['/api/performance', '/api/telemetry/log'].includes(url.pathname)) unexpectedWrites.push({ role, path: url.pathname, method: request.method() });
        if (url.pathname === '/api/admin/workout-templates') return json({ success: true, data: { templates: [routine], nextCursor: null } });
        if (url.pathname === '/api/admin/staff-summaries') return json({ success: true, data: [{ id: actor, display_name: profile.display_name, role, is_active: true }] });
        if (url.pathname === '/api/admin/student-summaries') return json({ success: true, data: [] });
        if (url.pathname === '/api/notifications') return json({ success: true, data: { notices: [], preferences: { push_enabled: false, muted_categories: [], quiet_start: 22, quiet_end: 7 }, push: { ready: false, publicKey: '' } } });
        return json({ success: true, data: [] });
      }
      if (url.pathname === '/auth/v1/user') return json(user);
      if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'fictional-refresh', expires_in: 3600, token_type: 'bearer' });
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').pop();
        if (!['GET', 'HEAD'].includes(request.method())) { unexpectedWrites.push({ role, table, method: request.method() }); return json([]); }
        if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
        if (table === 'role_permissions') return json((ROLE_PERMISSIONS[role] || []).map(permission_key => ({ role, permission_key, is_granted: true })));
        if (table === 'user_permissions') return json([]);
        if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Fixture academy', enable_audio_chimes: false });
        if (table === 'library_assets') return json([{ ...asset, revision: published ? 4 : 3, published_revision: published ? 4 : null }]);
        if (table === 'workout_templates') return json([{ id: routine.id, title: routine.title, description: routine.description, difficulty: routine.difficulty, duration_mins: routine.duration, creator_name: routine.creator, structure: routine.structure }]);
        return json([]);
      }
      return route.abort();
    });
    const page = await context.newPage(); lastPage = page;
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push({ role, error: error.message }));
    page.on('console', message => { if (message.type() === 'error' && /hydration|invalid hook|maximum update|content security policy|violates.*(?:directive|policy)|refused to (?:frame|load|connect)/i.test(message.text())) errors.push({ role, error: message.text() }); });
    await page.goto(base + '/library', { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('heading', { name: 'Academy Library', exact: true }).first().waitFor({ timeout: 60000 });
    for (const width of [1440, 834, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), role + ' fits ' + width);
    }
    if (role === 'Root') {
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const assetEditor = page.getByRole('dialog', { name: 'Edit library lesson', exact: true });
      await assetEditor.waitFor();
      assert.equal(await assetEditor.locator('input').first().inputValue(), asset.title, 'card editing opens the selected material');
      await page.screenshot({ path: 'scratch/academy-mobile-lesson-editor.png' });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: asset.title, exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog', { name: asset.title, exact: true }).locator('video[preload="none"][controls][playsinline]').count(), 1, 'direct media uses the native accessible player');
      await page.screenshot({ path: 'scratch/academy-mobile-native-media.png' });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Student library', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Student library', exact: true });
      await dialog.getByText(asset.title, { exact: true }).waitFor();
      await dialog.getByRole('listitem').getByText('Legacy publication · review', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
      const confirm = dialog.getByRole('button', { name: 'Publish lesson', exact: true });
      assert.equal(await confirm.isDisabled(), true);
      await dialog.getByLabel('Reason', { exact: true }).fill('Coach approved fixture guidance');
      await page.screenshot({ path: 'scratch/academy-mobile-publication-review.png' });
      await confirm.click();
      await dialog.getByRole('listitem').getByText('Published · current', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Close student library', exact: true }).click();
      // The success notification is an intentional UI overlay; dismiss it without touching data.
      const dismiss = page.getByRole('button', { name: /Dismiss|Got it|Close notification/i });
      if (await dismiss.count()) await dismiss.first().click();
      await page.getByRole('button', { name: 'Build Routine', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Create routine', exact: true });
      await editor.waitFor();
      for (const index of [0, 1]) {
        const box = await editor.locator('select').nth(index).boundingBox();
        assert.ok(box && box.width > 200, 'mobile routine type and difficulty stay readable');
      }
      await page.screenshot({ path: 'scratch/academy-mobile-routine-fields.png' });
      assert.equal(await editor.getByRole('checkbox', { name: 'Publish this version to the student portal', exact: true }).isChecked(), false);
      assert.equal(await editor.getByRole('button', { name: 'Save private draft', exact: true }).isDisabled(), true);
      await editor.getByRole('checkbox', { name: 'Publish this version to the student portal', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'scratch/academy-mobile-routine-editor.png' });
      await page.keyboard.press('Escape'); await editor.waitFor({ state: 'hidden' });
    } else {
      assert.equal(await page.getByRole('button', { name: 'Student library', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Build Routine', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Add Asset', exact: true }).count(), 0);
    }
    results.push({ role, viewports: [1440, 834, 390], passed: true });
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(unexpectedWrites, []); assert.equal(commands.length, 1);
  fs.writeFileSync('scratch/academy-management-browser-evidence.json', JSON.stringify({ testedBaseURL: base, fixtureOnly: true, liveWrites: 0, results, commands, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, scenarios: results.length, viewportChecks: results.length * 3, javascriptErrors: errors.length, fixturePublishCommands: commands.length, liveWrites: 0 }));
} catch (error) { fs.writeFileSync('scratch/academy-management-browser-failure.json', JSON.stringify({ error: error.message, results, errors, network, commands }, null, 2)); if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: 'scratch/academy-management-browser-failure.png', fullPage: true }).catch(() => {}); throw error; }
finally { await browser.close(); }
