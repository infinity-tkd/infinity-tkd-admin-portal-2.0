import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Technique steps and poomsae movement notes in the lesson content editor.
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
  { id: 7, title: 'Taegeuk 1 (Il Jang)', library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'Unassigned', video_url: '',
    description: JSON.stringify({ text: 'The first Taegeuk form.', actualCategory: 'Forms (Poomsae)', difficulty: 'Beginner', instructions: ['Left walking stance, low block.'], terminology: [{ korean: '아래막기', english: 'Arae-makki · Low block', khmer: '' }] }),
    created_at: '2026-11-10T00:00:00Z', revision: 1, published_revision: null, student_curriculum_id: 7, category_id: u(1), content_kind: 'lesson', korean_name: '태극 1장', summary: 'The first Taegeuk form.', source_key: 'web:taegeuk-1' },
  { id: 8, title: 'Front Kick (Ap Chagi / 앞차기)', library_type: 'Taekwondo', tkd_category: 'Chagi', fitness_category: null, target_level: 'White', video_url: '', description: JSON.stringify({ text: 'The basic snap kick.', actualCategory: 'Kicks (Chagi)' }),
    created_at: '2026-10-01T00:00:00Z', revision: 3, published_revision: 0, student_curriculum_id: 8, category_id: null, content_kind: 'lesson', korean_name: null, summary: null, source_key: null },
];
const content = {
  sections: [
    { id: 'meaning', type: 'text', title: 'Meaning', paragraphs: ['Keon: heaven and light.'] },
    { id: 'floor', type: 'diagram', title: 'Floor plan', kind: 'poomsae-walkthrough', data: { start: { x: 0, y: 0 }, startFacing: 'N', startStance: { type: 'ready' }, guides: [], verified: true,
      steps: [{ to: { x: -1, y: 0 }, facing: 'W', stance: { type: 'walking', lead: 'left' }, techniques: ['Low block'] }, { to: { x: -2, y: 0 }, facing: 'W', stance: { type: 'walking', lead: 'right' }, techniques: ['Middle punch'] }] } },
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
      if (url.pathname === '/api/admin/library-assets' && method === 'POST') {
        const body = route.request().postDataJSON(); posts.push({ endpoint: 'assets', ...body });
        const asset = assets.find(row => row.id === body.id);
        Object.assign(asset, { title: body.asset.title, description: body.asset.description, target_level: body.asset.target_level, revision: asset.revision + 1, updated_at: new Date().toISOString() });
        return json({ success: true, data: { asset, relations: [], studentLesson: { id: asset.student_curriculum_id } } });
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
  await page.getByRole('button', { name: 'Taegeuk 1 (Il Jang)', exact: true }).click();
  await page.getByRole('button', { name: 'Content & languages' }).click();
  const editor = page.getByRole('dialog', { name: /Content & languages/ });
  await editor.getByRole('tab', { name: /Sections/ }).click();

  // Poomsae floor plan: a clip and a mistake for movement 1.
  await editor.getByLabel('Form video for movement clips (https://)').fill('https://www.youtube.com/watch?v=form1');
  await editor.getByRole('button', { name: 'Clips and mistakes per movement' }).click();
  await editor.getByLabel('Movement 1 clip: source').selectOption('times');
  await editor.getByLabel('Movement 1 clip: end seconds').fill('3');
  const movementMistakes = editor.locator('textarea[aria-label^="Common mistakes"]').first();
  await movementMistakes.fill('Block too high -> Stop above the knee');
  await movementMistakes.blur();

  // Technique steps (the Roundhouse Kick pattern).
  await editor.getByLabel('New section').selectOption('technique-steps');
  await editor.getByRole('button', { name: 'Add section' }).click();
  await editor.getByLabel('Lesson video for the clips (YouTube unlisted or academy MP4, https://)').fill('https://www.youtube.com/watch?v=kick1');
  await editor.getByLabel('Step 1 title').fill('Chamber position');
  await editor.getByLabel('Step 1 id').fill('Chamber');
  await editor.getByLabel('Step 1 instructions').fill('Lift the knee to hip height.');
  await editor.getByLabel('Step 1 clip: source').selectOption('times');
  await editor.getByLabel('Step 1 clip: start seconds').fill('12.5');
  await editor.getByLabel('Step 1 clip: end seconds').fill('18');
  const stepMistakes = editor.locator('textarea[aria-label^="Common mistakes"]').last();
  await stepMistakes.fill('Knee too low -> Lift the knee first');
  await stepMistakes.blur();
  const checklist = editor.getByLabel('Practice checklist, one point per line').first();
  await checklist.fill('Knee at hip height\nGuard up');
  await checklist.blur();
  await editor.getByRole('button', { name: 'Add step' }).click();
  await editor.getByLabel('Step 2 title').fill('Extension');
  await editor.getByRole('button', { name: 'Save draft' }).click();
  await editor.getByText('All changes saved').waitFor({ timeout: 15000 });

  const saved = posts.find(row => row.endpoint === 'content');
  const steps = saved.content.sections.find(section => section.type === 'technique-steps');
  assert.equal(steps.video, 'https://www.youtube.com/watch?v=kick1');
  assert.deepEqual(steps.items[0], { id: 'chamber', title: 'Chamber position', body: 'Lift the knee to hip height.', clip: { start: 12.5, end: 18 },
    mistakes: [{ mistake: 'Knee too low', correction: 'Lift the knee first' }], checklist: ['Knee at hip height', 'Guard up'] });
  assert.equal(steps.items[1].id, 'step-2', 'a new step gets a unique id');
  const floor = saved.content.sections.find(section => section.id === 'floor');
  assert.equal(floor.video, 'https://www.youtube.com/watch?v=form1');
  assert.deepEqual(floor.movements, [{ clip: { start: 0, end: 3 }, mistakes: [{ mistake: 'Block too high', correction: 'Stop above the knee' }] }], 'only movement 1 has notes');
  assert.equal(floor.data.steps.length, 2, 'the geometry is unchanged');

  // The Khmer tab offers the step text, never the clip times, links or ids.
  await editor.getByRole('tab', { name: 'Khmer' }).click();
  await editor.getByText(/texts translated into Khmer/).waitFor();
  const translatable = await editor.locator('fieldset').filter({ hasText: 'Chamber position' }).innerText();
  assert.ok(translatable.includes('Knee at hip height'), 'checklist text is translatable');
  assert.ok(!translatable.includes('12.5') && !translatable.includes('youtube'), 'clip times and links are not');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, techniqueSteps: true, movementNotes: true, translationFieldsTextOnly: true, pageErrors: errors.length, liveWrites: 0 }));
} catch (error) {
  try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'scratch/technique-steps-failure.png', fullPage: true }); } catch { /* screenshot is best effort */ }
  throw error;
} finally { await browser.close(); }
