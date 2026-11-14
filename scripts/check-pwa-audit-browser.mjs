import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { contrastAudit } from './lib/contrast-audit.mjs';
import { launchBrowser, gotoPortalRoute, openPortal } from './lib/portal-harness.mjs';

// Progressive Web App audit against a production build (`next build` + `next start`), complementing check-pwa-browser:
//  - manifest fields, scope, shortcuts, icons (real pixel sizes, a full-bleed maskable icon), theme colours for both schemes;
//  - Chromium's own installability verdict (Page.getInstallabilityErrors) and manifest parser errors;
//  - what the service worker stores: nothing from /api/, /auth/ or Supabase, no page or router payloads, no HTML;
//  - the update flow with a really changed worker: it waits (no silent takeover), the "Update ready" toast is readable
//    in light and dark mode, Apply asks first and then reloads onto the new worker;
//  - standalone display mode: the install button is gone, and the header, bottom bar and content keep clear of a notch,
//    home indicator and landscape side insets.
// Only the local server is reachable (Supabase hosts are unresolvable), so no real data is read or written.
// Usage: node scripts/check-pwa-audit-browser.mjs <baseUrl>      PWA_REPORT_ONLY=1 prints without failing.
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const origin = new URL(base).origin;
const chromium = process.env.PORTAL_BROWSER !== 'webkit';
const issues = [], notes = [];
const expect = (condition, message) => { if (!condition) issues.push(message); };
const note = text => notes.push(text);

// ---------- manifest ----------
// (installability is judged further down: in a persistent Chrome profile, because an incognito-like context cannot be installed into)
const manifest = await (await fetch(base + '/manifest.webmanifest')).json();
const inScope = path => new URL(path, base).pathname.startsWith(manifest.scope || '/');
expect(manifest.id, 'manifest has an id');
expect(manifest.short_name && manifest.short_name.length <= 12, `short_name "${manifest.short_name}" fits a home-screen label (12 characters)`);
expect(inScope(manifest.start_url), `start_url ${manifest.start_url} is inside the scope`);
expect(manifest.display === 'standalone' && manifest.display_override?.includes('standalone'), 'display is standalone (with a standalone override)');
for (const key of ['background_color', 'theme_color']) expect(/^#[0-9a-f]{6}$/i.test(manifest[key] || ''), `${key} is a #rrggbb colour`);
expect(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'), 'a 192x192 "any" icon');
expect(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'), 'a 512x512 "any" icon');
expect(manifest.icons.some(icon => icon.purpose === 'maskable'), 'a maskable icon');
for (const icon of manifest.icons.filter(icon => icon.type === 'image/png')) {
  const bytes = Buffer.from(await (await fetch(base + icon.src)).arrayBuffer());
  expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}` === icon.sizes, `${icon.src} is really ${icon.sizes}`);
}
for (const shortcut of manifest.shortcuts ?? []) {
  expect(inScope(shortcut.url), `shortcut "${shortcut.name}" url ${shortcut.url} is inside the scope`);
  expect((await fetch(base + shortcut.url, { redirect: 'manual' })).status < 400, `shortcut "${shortcut.name}" url answers`);
  for (const icon of shortcut.icons ?? []) expect((await fetch(base + icon.src)).status === 200, `shortcut icon ${icon.src} exists`);
}
note(`manifest: "${manifest.name}", ${manifest.icons.length} icons, ${manifest.screenshots?.length ?? 0} screenshots, ${manifest.shortcuts?.length ?? 0} shortcuts, start ${manifest.start_url}`);

/** A pass-through proxy in front of the app. After change() is called it serves /sw.js with one extra comment, so the browser sees a new worker. */
async function startProxy(target) {
  let changed = 0;
  const server = http.createServer((request, response) => {
    const upstream = http.request(new URL(request.url, target), { method: request.method, headers: { ...request.headers, host: new URL(target).host, 'accept-encoding': 'identity' } }, reply => {
      if (changed && /^\/sw\.js(\?|$)/.test(request.url)) {
        const chunks = [];
        reply.on('data', chunk => chunks.push(chunk));
        reply.on('end', () => {
          const body = Buffer.concat([...chunks, Buffer.from(`\n/* audit update ${changed} */`)]);
          response.writeHead(reply.statusCode, { ...reply.headers, 'content-length': body.length });
          response.end(body);
        });
      } else { response.writeHead(reply.statusCode, reply.headers); reply.pipe(response); }
    });
    upstream.on('error', () => { response.statusCode = 502; response.end(); });
    request.pipe(upstream);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, change: () => { changed++; }, close: () => new Promise(resolve => server.close(resolve)) };
}

const browser = await launchBrowser();
try {
  const themes = ['light', 'dark'];
  for (const theme of themes) {
    // A context with the service worker enabled; everything outside the local origin is refused.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow', reducedMotion: 'reduce' });
    await context.addInitScript(value => { try { localStorage.setItem('infinity_theme', value); } catch { /* storage is optional */ } }, theme);
    // The page is opened through a pass-through proxy that can serve /sw.js with one changed byte: a Playwright route cannot alter the worker
    // script the browser fetches for itself, and a genuinely new worker is what the update flow needs.
    const proxy = await startProxy(base);
    const appBase = proxy.base, appOrigin = new URL(appBase).origin;
    await context.route('**/*', route => new URL(route.request().url()).origin === appOrigin ? route.continue() : route.abort());
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(appBase + '/', { waitUntil: 'load' });
    await page.evaluate(async () => {
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('worker did not activate within 60s')), 60000))]);
      for (let attempt = 0; attempt < 120 && registration.active?.state !== 'activated'; attempt++) await new Promise(resolve => setTimeout(resolve, 500));
    });
    await page.reload({ waitUntil: 'load' });
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), `[${theme}] the worker controls the page after a reload`);

    if (theme === 'light') {
      // theme colours for both colour schemes
      const colours = await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(meta => `${meta.media || 'default'}=${meta.content}`));
      expect(colours.length >= 2 && colours.some(entry => /dark/.test(entry)), `theme-color is set for light and dark schemes (${colours.join(', ')})`);
      const links = await page.evaluate(() => ({ appleIcon: Boolean(document.querySelector('link[rel="apple-touch-icon"]')), capable: Boolean(document.querySelector('meta[name="apple-mobile-web-app-capable"],meta[name="mobile-web-app-capable"]')), viewport: document.querySelector('meta[name="viewport"]')?.content || '' }));
      expect(links.appleIcon && links.capable, 'iOS home-screen metadata (apple-touch-icon and web-app-capable)');
      expect(/viewport-fit=cover/.test(links.viewport) && !/user-scalable=no|maximum-scale=1(\.0)?(,|$)/.test(links.viewport), `viewport allows zoom and uses the full screen (${links.viewport})`);
      // The maskable icon must be full bleed: every corner opaque, or the OS shows a transparent hole when it masks the icon.
      const maskable = await page.evaluate(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context2d = canvas.getContext('2d'); context2d.drawImage(image, 0, 0);
        const alpha = (x, y) => context2d.getImageData(x, y, 1, 1).data[3];
        const last = image.naturalWidth - 1;
        return { corners: [alpha(0, 0), alpha(last, 0), alpha(0, last), alpha(last, last)], edge: alpha(Math.floor(last / 2), 0) };
      }, manifest.icons.find(icon => icon.purpose === 'maskable').src);
      expect([...maskable.corners, maskable.edge].every(value => value === 255), `the maskable icon is full bleed (corner and edge alpha ${maskable.corners.join('/')}, ${maskable.edge})`);
      if (chromium) {
        const cdp = await context.newCDPSession(page);
        const parsed = await cdp.send('Page.getAppManifest');
        expect(!parsed.errors.length, `the manifest parses without errors (${parsed.errors.map(error => error.message).join('; ')})`);
        // A Playwright context is incognito-like, so Chromium reports "in-incognito" (and stops short of the manifest checks): the real verdict comes from the persistent profile below.
        const installability = await cdp.send('Page.getInstallabilityErrors');
        const blocking = installability.installabilityErrors.map(error => error.errorId).filter(id => !['in-incognito', 'no-manifest'].includes(id));
        expect(blocking.length === 0, `Chromium reports no installability errors in the page (${blocking.join(', ') || 'none besides incognito'})`);
      }
      // What the worker stores. Requests a signed-in session makes (API, auth, Next router payloads, documents) must never be kept.
      await page.evaluate(async () => {
        const rsc = { RSC: '1', 'Next-Router-State-Tree': '%5B%22%22%5D' };
        for (const [url, init] of [['/dashboard?_rsc=probe', { headers: rsc }], ['/students?_rsc=probe', { headers: { ...rsc, 'Next-Router-Prefetch': '1' } }], ['/api/admin/student-summaries'], ['/auth/v1/user'], ['/icons/icon-192x192.png'], ['/manifest.webmanifest']]) { try { await (await fetch(url, init)).arrayBuffer(); } catch { /* an unreachable host is fine */ } }
      });
      await page.goto(appBase + '/students', { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const stored = await page.evaluate(async () => {
        const out = [];
        for (const name of await caches.keys()) { const cache = await caches.open(name); for (const request of await cache.keys()) { const response = await cache.match(request); out.push({ cache: name, path: new URL(request.url).pathname + new URL(request.url).search, type: response?.headers.get('content-type') || '' }); } }
        return out;
      });
      // The precached /offline.html is the intended offline fallback: a static page with no account data.
      const risky = stored.filter(entry => !(/^serwist-precache/.test(entry.cache) && /^\/offline\.html/.test(entry.path)))
        .filter(entry => /^\/(api|auth)\//.test(entry.path) || /supabase/.test(entry.path) || /_rsc=/.test(entry.path) || /text\/html|text\/x-component/.test(entry.type) || /^pages/.test(entry.cache) || /^(other|cross-origin)/.test(entry.cache));
      expect(!risky.length, `the worker stores no API, auth, router or page responses: ${risky.slice(0, 5).map(entry => `${entry.cache}:${entry.path}`).join(', ')}`);
      const byCache = Object.entries(stored.reduce((map, entry) => { map[entry.cache] = (map[entry.cache] ?? 0) + 1; return map; }, {})).map(([name, count]) => `${name}=${count}`).join(', ');
      note(`caches after browsing: ${byCache || 'none'}`);
    }

    // ---------- update flow ----------
    proxy.change();
    await page.goto(appBase + '/', { waitUntil: 'load' });
    await page.evaluate(() => { window.__beforeUpdate = true; return navigator.serviceWorker.getRegistration().then(registration => registration.update()); });
    const waiting = await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => Boolean(registration?.waiting)), null, { timeout: 30000, polling: 500 }).then(() => true, () => false);
    expect(waiting, `[${theme}] a changed worker installs and waits for the person's go-ahead (it is not applied silently)`);
    if (waiting) {
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.__beforeUpdate === true), `[${theme}] a waiting update does not reload the page by itself`);
      const toast = page.getByRole('status', { name: 'Application update available' });
      const shown = await toast.waitFor({ timeout: 10000 }).then(() => true, () => false);
      expect(shown, `[${theme}] the "Update ready" toast appears`);
      if (shown) {
        const audit = await page.evaluate(contrastAudit);
        const failing = audit.failing.filter(entry => entry.examples.some(example => /Update Ready|Save your work|Apply/i.test(example)));
        expect(!failing.length, `[${theme}] the update toast is readable: ${failing.map(entry => `${entry.colours} ${entry.ratio}:1`).join('; ')}`);
        const box = await toast.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845, `[${theme}] the update toast fits a 390 px phone (${JSON.stringify(box)})`);
        await page.getByRole('button', { name: 'Apply' }).click();
        const confirm = page.getByRole('alertdialog');
        await confirm.waitFor({ timeout: 5000 });
        expect(await page.evaluate(() => window.__beforeUpdate === true), `[${theme}] Apply asks for confirmation before reloading`);
        await confirm.getByRole('button', { name: /confirm|apply|reload/i }).first().click();
        const reloaded = await page.waitForFunction(() => window.__beforeUpdate === undefined, null, { timeout: 20000, polling: 300 }).then(() => true, () => false);
        expect(reloaded, `[${theme}] confirming reloads the page onto the new worker`);
        if (reloaded) { await page.waitForLoadState('load'); expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), `[${theme}] the page is controlled again after the update`); }
      }
    }
    expect(!pageErrors.length, `[${theme}] no page errors in the PWA flow: ${pageErrors.slice(0, 2).join(' | ')}`);
    await context.close();
    await proxy.close();
  }

  // ---------- standalone display mode and safe areas ----------
  if (chromium) {
    for (const scene of [
      { name: 'phone portrait', viewport: { width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } },
      { name: 'phone landscape', viewport: { width: 844, height: 390 }, insets: { top: 0, bottom: 21, left: 47, right: 47 } },
    ]) {
      const { context } = await openPortal(browser, base, { viewport: scene.viewport, mobile: true, touch: true, scale: 2 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      // Chromium cannot emulate the display-mode media feature, so the page's matchMedia is told it runs as an installed app (the portal's
      // own check). Its CSS has only an iOS-specific standalone rule, which a headless Chromium cannot show either way.
      await context.addInitScript(() => { const original = window.matchMedia.bind(window); window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } : original(query); });
      const insets = await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: scene.insets }).then(() => true, () => false);
      if (!insets) { note(`[${scene.name}] this Chrome cannot emulate safe-area insets; the notch checks were skipped`); }
      if (!(await gotoPortalRoute(page, base, '/dashboard'))) { issues.push(`[${scene.name}] the dashboard did not render in standalone mode`); await context.close(); continue; }
      expect(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), `[${scene.name}] standalone display mode is detected`);
      expect(await page.getByRole('button', { name: /install app/i }).count() === 0, `[${scene.name}] the install button is hidden once installed`);
      const layout = await page.evaluate(() => {
        const rect = element => element?.getBoundingClientRect();
        const header = document.querySelector('[data-portal-header]'), bar = document.querySelector('[data-portal-bottom-nav]'), scroller = document.querySelector('[data-portal-scroll]');
        const top = header ? Math.min(...[...header.querySelectorAll('button,a,h1,img,span')].filter(element => rect(element).width > 0).map(element => rect(element).top)) : null;
        const barItems = bar && getComputedStyle(bar).display !== 'none' ? [...bar.querySelectorAll('a,button')].filter(element => rect(element).width > 0).map(rect) : [];
        const content = scroller ? [...scroller.querySelectorAll('h1,section,article,[class*=card]')].filter(element => rect(element).width > 0).map(rect) : [];
        return { top, barBottom: barItems.length ? Math.max(...barItems.map(box => box.bottom)) : null, barLeft: barItems.length ? Math.min(...barItems.map(box => box.left)) : null, barRight: barItems.length ? Math.max(...barItems.map(box => box.right)) : null, contentLeft: content.length ? Math.min(...content.map(box => box.left)) : null, contentRight: content.length ? Math.max(...content.map(box => box.right)) : null, width: innerWidth, height: innerHeight };
      });
      if (insets) {
        if (scene.insets.top) expect(layout.top >= scene.insets.top - 1, `[${scene.name}] the header starts below the notch (${Math.round(layout.top)}px, needs ${scene.insets.top}px)`);
        if (scene.insets.bottom && layout.barBottom !== null) expect(layout.barBottom <= layout.height - scene.insets.bottom + 1, `[${scene.name}] the bottom bar clears the home indicator (ends at ${Math.round(layout.barBottom)}px of ${layout.height}px, needs ${layout.height - scene.insets.bottom}px)`);
        if (scene.insets.left) {
          expect(layout.contentLeft >= scene.insets.left - 1 && layout.contentRight <= layout.width - scene.insets.right + 1, `[${scene.name}] page content clears the side insets (${Math.round(layout.contentLeft)}..${Math.round(layout.contentRight)} of ${layout.width}, needs ${scene.insets.left}..${layout.width - scene.insets.right})`);
          if (layout.barLeft !== null) expect(layout.barLeft >= scene.insets.left - 1 && layout.barRight <= layout.width - scene.insets.right + 1, `[${scene.name}] bottom-bar buttons clear the side insets (${Math.round(layout.barLeft)}..${Math.round(layout.barRight)})`);
        }
      }
      note(`[${scene.name}] header top ${layout.top === null ? '-' : Math.round(layout.top)}px, bottom bar ends ${layout.barBottom === null ? '-' : Math.round(layout.barBottom)}px of ${layout.height}px, content ${Math.round(layout.contentLeft ?? 0)}..${Math.round(layout.contentRight ?? 0)} of ${layout.width}px`);
      await context.close();
    }
  } else note('standalone and safe-area checks need Chromium DevTools and were skipped');

  // ---------- installability, judged in a persistent profile (the same kind of profile a person installs from) ----------
  if (chromium) {
    const { chromium: engine } = await import('playwright');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-pwa-'));
    const persistent = await engine.launchPersistentContext(profile, { headless: true, viewport: { width: 1280, height: 800 }, args: ['--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, MAP *.supabase.com ~NOTFOUND'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    try {
      const page = await persistent.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const cdp = await persistent.newCDPSession(page);
      const verdict = await cdp.send('Page.getInstallabilityErrors');
      const manifestLoaded = Boolean((await cdp.send('Page.getAppManifest')).url);
      const errors = verdict.installabilityErrors.map(error => `${error.errorId}${error.errorArguments?.length ? ' ' + error.errorArguments.map(argument => `${argument.name}=${argument.value}`).join(' ') : ''}`);
      // Headless Chromium never loads the manifest, so it can only answer "no-manifest"; the install criteria are then judged one by one
      // (manifest fields, icons, start_url and scope, a worker that controls the page) by the checks above.
      if (!manifestLoaded && errors.length === 1 && errors[0] === 'no-manifest') note('Chromium\'s own install verdict is unavailable in headless mode (it does not load manifests); the install criteria were checked individually instead');
      else expect(errors.length === 0, `Chromium finds the app installable in a normal profile (${errors.join('; ') || 'no errors'})`);
    } finally { await persistent.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  }
} finally { await browser.close(); }

console.log('PWA AUDIT'); for (const text of notes) console.log('  ' + text);
console.log(`\nISSUES: ${issues.length}`); for (const issue of issues) console.log('  - ' + issue);
console.log(JSON.stringify({ passed: issues.length === 0, issues: issues.length }));
if (!process.env.PWA_REPORT_ONLY) assert.deepEqual(issues, [], 'the PWA audit passes');
