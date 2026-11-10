import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Fictional identities and mocked library APIs: no real credentials or database writes.
const id = '73000000-0000-4000-8000-000000000001';
const user = { id, aud: 'authenticated', role: 'authenticated', aal: 'aal2', email: 'library@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'library_head_coach', email: user.email, display_name: 'Fixture Head Coach', role: 'Head Coach', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aal: 'aal2' })).toString('base64url')}.${Buffer.from('test-signature').toString('base64url')}`;
const u = n => `74000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const categories = [
  { id: u(1), slug: 'poomsae', title: 'Poomsae (Forms)', koreanTitle: '공인 품새', subtitle: 'Standard forms', description: null, icon: 'BookOpen', accentColor: '#EF2F38', libraryType: 'Taekwondo', isActive: true, translations: { km: { title: 'ទម្រង់' } }, sortOrder: 10, revision: 1, lessonCount: 1 },
  { id: u(2), slug: 'kicking', title: 'Kicking', koreanTitle: null, subtitle: null, description: null, icon: 'Lightning', accentColor: '#FFD505', libraryType: 'Taekwondo', isActive: true, translations: {}, sortOrder: 20, revision: 1, lessonCount: 0 },
];
const assets = [
  { id: 7, title: 'Taegeuk 1 (Il Jang)', library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'Unassigned', video_url: '', description: JSON.stringify({ text: 'The first Taegeuk form.', actualCategory: 'Forms (Poomsae)' }),
    created_at: '2026-11-10T00:00:00Z', revision: 1, published_revision: null, student_curriculum_id: 7, category_id: u(1), content_kind: 'lesson', korean_name: '태극 1장', summary: 'The first Taegeuk form.', source_key: 'web:taegeuk-1' },
  { id: 8, title: 'Front Kick (Ap Chagi / 앞차기)', library_type: 'Taekwondo', tkd_category: 'Chagi', fitness_category: null, target_level: 'White', video_url: '', description: JSON.stringify({ text: 'The basic snap kick.', actualCategory: 'Kicks (Chagi)' }),
    created_at: '2026-10-01T00:00:00Z', revision: 3, published_revision: 0, student_curriculum_id: 8, category_id: null, content_kind: 'lesson', korean_name: null, summary: null, source_key: null },
];
const content = {
  sections: [
    { id: 'meaning', type: 'text', title: 'Meaning', paragraphs: ['Keon: heaven and light.'] },
    { id: 'steps', type: 'steps', title: 'Movement sequence', items: [{ title: '', body: 'Left walking stance, low block.', details: [] }, { title: '', body: 'Right walking stance, middle punch.', details: [] }] },
    { id: 'terminology', type: 'glossary', title: 'Korean terminology', items: [{ korean: '아래막기', romanized: 'Arae-makki', english: 'Low block', category: 'Block' }] },
  ],
  translations: { km: { title: 'តេហ្គឹក ១', sections: { meaning: { title: 'អត្ថន័យ' } } } },
  sources: [{ label: 'Kukkiwon', url: 'https://www.kukkiwon.or.kr' }],
};
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
      if (url.pathname === '/api/admin/library-categories') {
        if (method === 'GET') return json({ success: true, data: { categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder) } });
        const body = route.request().postDataJSON(); posts.push({ endpoint: 'categories', ...body });
        if (body.action === 'CREATE') { const created = { ...body.category, id: u(3), sortOrder: 30, revision: 1, lessonCount: 0 }; categories.push(created); return json({ success: true, data: created }); }
        if (body.action === 'REORDER') { body.order.forEach((catId, index) => { const row = categories.find(cat => cat.id === catId); if (row) row.sortOrder = (index + 1) * 10; }); return json({ success: true, data: { reordered: body.order.length } }); }
        return json({ success: true, data: {} });
      }
      if (url.pathname === '/api/admin/library-assets/content') {
        if (method === 'GET') {
          const asset = assets.find(row => row.id === Number(url.searchParams.get('id')));
          return json({ success: true, data: { asset: { id: asset.id, title: asset.title, revision: asset.revision, publishedRevision: asset.published_revision, studentCurriculumId: asset.student_curriculum_id, targetLevel: asset.target_level, sourceKey: asset.source_key },
            metadata: { categoryId: asset.category_id, kind: asset.content_kind, slug: 'taegeuk-1-il-jang', koreanName: asset.korean_name, romanized: 'Taegeuk Il Jang', summary: asset.summary, levelNote: 'White Belt', tags: ['poomsae'] }, content, contentIssue: null, updatedAt: null } });
        }
        const body = route.request().postDataJSON(); posts.push({ endpoint: 'content', ...body });
        const asset = assets.find(row => row.id === body.id);
        Object.assign(asset, { revision: asset.revision + 1, summary: body.metadata.summary, category_id: body.metadata.categoryId, korean_name: body.metadata.koreanName, updated_at: new Date().toISOString() });
        return json({ success: true, data: { asset, content: { ...body.content, updatedAt: new Date().toISOString() } } });
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
      if (table === 'library_assets') return json(assets);
      return json([]);
    }
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('library_head_coach'); await page.locator('#login-password').fill('Fictional-Test-Password'); await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  await page.goto(base + '/library', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: 'Taegeuk 1 (Il Jang)', exact: true }).waitFor({ timeout: 60000 });

  // Cards: imported lesson without a belt, its category and Korean name.
  // The card badge (the belt filter also has a "No belt yet" option, which is never visible).
  await page.locator('span').filter({ hasText: /^No belt yet$/ }).first().waitFor();
  assert.ok(await page.getByText('Poomsae (Forms)', { exact: true }).count() >= 1, 'the card shows its library category');
  assert.ok(await page.getByText('태극 1장', { exact: true }).count() >= 1);

  // Filters: "No belt yet" and the library category.
  await page.locator('select').filter({ hasText: 'No belt yet' }).selectOption('Unassigned');
  assert.equal(await page.getByRole('button', { name: 'Front Kick (Ap Chagi / 앞차기)', exact: true }).count(), 0, 'the belt filter finds lessons without a belt');
  await page.locator('select').filter({ hasText: 'No belt yet' }).selectOption('All');
  await page.getByLabel('Library category').selectOption(u(2));
  assert.equal(await page.getByRole('button', { name: 'Taegeuk 1 (Il Jang)', exact: true }).count(), 0, 'the category filter hides other categories');
  await page.getByLabel('Library category').selectOption('none');
  await page.getByRole('button', { name: 'Front Kick (Ap Chagi / 앞차기)', exact: true }).waitFor();
  await page.getByLabel('Library category').selectOption('All');

  // Categories: add one with a Khmer name, then reorder.
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'Library categories' });
  await manager.getByText('Kicking', { exact: true }).waitFor();
  await manager.getByRole('button', { name: 'New category' }).click();
  await manager.getByLabel('Name', { exact: true }).fill('Hand Techniques');
  assert.equal(await manager.getByLabel('Web name (used in links)').inputValue(), 'hand-techniques', 'the web name follows the name');
  await manager.getByLabel('Khmer name').fill('ក្បាច់ដៃ');
  await manager.getByRole('button', { name: 'Add category' }).click();
  await manager.getByText('Hand Techniques', { exact: true }).waitFor();
  const created = posts.find(row => row.endpoint === 'categories' && row.action === 'CREATE');
  assert.deepEqual([created.category.slug, created.category.translations.km.title, created.category.isActive], ['hand-techniques', 'ក្បាច់ដៃ', true]);
  await manager.getByRole('button', { name: 'Move Kicking up' }).click();
  await page.waitForFunction(() => true);
  const until = Date.now() + 10000; while (!posts.some(row => row.action === 'REORDER') && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(posts.find(row => row.action === 'REORDER').order, [u(2), u(1), u(3)]);
  await manager.getByRole('button', { name: 'Close', exact: true }).last().click();

  // Content & languages: summary, a new section, a Khmer translation.
  await page.getByRole('button', { name: 'Taegeuk 1 (Il Jang)', exact: true }).click();
  await page.getByRole('button', { name: 'Content & languages' }).click();
  const editor = page.getByRole('dialog', { name: /Content & languages/ });
  await editor.getByLabel('Summary (shown on the lesson card)').waitFor({ timeout: 30000 });
  await editor.getByText(/No belt yet\. Choose a belt/).waitFor();
  assert.equal(await editor.getByLabel('Category').inputValue(), u(1));
  await editor.getByLabel('Summary (shown on the lesson card)').fill('The first Taegeuk form: heaven and light.');
  await editor.getByRole('tab', { name: /Sections/ }).click();
  await editor.getByLabel('New section').selectOption('facts');
  await editor.getByRole('button', { name: 'Add section' }).click();
  await editor.getByLabel('Section 4 title').fill('At a glance');
  await editor.getByLabel('Label').fill('Movements');
  await editor.getByLabel('Value').fill('18');
  await editor.getByRole('button', { name: 'Move section 4 up' }).click();
  await editor.getByRole('tab', { name: 'Khmer' }).click();
  await editor.getByText(/texts translated into Khmer/).waitFor();
  const stepsTitle = editor.locator('fieldset').filter({ hasText: 'Movement sequence' }).getByRole('textbox').first();
  await stepsTitle.fill('លំដាប់ចលនា');
  await editor.getByRole('button', { name: 'Save draft' }).click();
  await editor.getByText('All changes saved').waitFor({ timeout: 15000 });
  const saved = posts.find(row => row.endpoint === 'content');
  assert.equal(saved.expectedRevision, 1);
  assert.equal(saved.metadata.summary, 'The first Taegeuk form: heaven and light.');
  assert.deepEqual(saved.content.sections.map(section => section.id), ['meaning', 'steps', 'facts', 'terminology'], 'the new section moved above the glossary');
  assert.deepEqual(saved.content.sections[2].items, [{ label: 'Movements', value: '18' }]);
  assert.equal(saved.content.translations.km.sections.steps.title, 'លំដាប់ចលនា');
  assert.equal(saved.content.translations.km.title, 'តេហ្គឹក ១', 'existing translations are kept');
  await editor.getByRole('button', { name: 'Close', exact: true }).last().click();
  await editor.waitFor({ state: 'detached', timeout: 10000 });

  // Phone width: the library page does not scroll sideways.
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll at 390px (' + overflow + 'px)');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, categoryCreated: true, categoryReordered: true, contentSaved: true, khmerTranslation: true, filters: true, mobileOverflow: overflow, pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'scratch/library-content-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  throw error;
} finally { await browser.close(); }
