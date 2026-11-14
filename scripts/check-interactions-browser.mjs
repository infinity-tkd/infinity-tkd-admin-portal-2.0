import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gotoPortalRoute, launchBrowser, openPortal, PORTAL_ROUTES, trackHealth } from './lib/portal-harness.mjs';
import { AXE_PATH, axeAudit, inputAudit } from './lib/a11y-audit.mjs';
import { layoutAudit } from './lib/layout-audit.mjs';

// Interaction crawl: on every page, clicks (phone: taps) each distinct control and records what happens.
//  - controls that do nothing visible, or cannot be clicked (covered, clipped);
//  - every dialog or drawer that opens: focus moves in, Tab stays inside, Escape closes, focus returns, it fits the
//    screen, and axe finds nothing in it; every link: it navigates and Back returns;
//  - runtime errors, failed requests, "undefined"/"NaN" text, and the slowest interaction (an INP stand-in, with the
//    CPU throttled 4x on the phone run, Chromium only).
// A fresh context per page keeps state (language, theme) from leaking. Fictional fixtures only.
// Usage: node scripts/check-interactions-browser.mjs <baseUrl> [outDir]
// CRAWL_ROUTES=/dashboard,/students  CRAWL_DEVICES=phone,desktop  CRAWL_LIMIT=30 (clicks per page)  CRAWL_REPORT_ONLY=1
// CRAWL_PHONE_WIDTH=320 CRAWL_PHONE_HEIGHT=568 crawls the phone run on the smallest supported screen (default 390 x 844). On the phone run every
// state reached is also checked for words broken mid-way ("OPERATION / S").
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outDir = process.argv[3] || '';
const origin = new URL(base).origin;
const limit = Number(process.env.CRAWL_LIMIT || 30);
const routes = process.env.CRAWL_ROUTES ? process.env.CRAWL_ROUTES.split(',') : PORTAL_ROUTES;
const wanted = (process.env.CRAWL_DEVICES || 'phone,desktop').split(',');
const devices = [
  { name: 'phone', viewport: { width: Number(process.env.CRAWL_PHONE_WIDTH || 390), height: Number(process.env.CRAWL_PHONE_HEIGHT || 844) }, mobile: true, touch: true, cpu: 4 },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
].filter(device => wanted.includes(device.name));
const SKIP = /sign out|log out|logout|print/i;
// "Infinity" is also the academy's name, so only a computed value (a sign, a percent, a unit) counts.
const BAD_TEXT = /\b(undefined|NaN|Invalid Date)\b|\[object Object\]|[$\-]Infinity\b|\bInfinity\s*(?:%|\/|days?\b|min\b|h\b)/;
const DIALOGS = '[role=dialog],[role=alertdialog],[aria-modal="true"],dialog[open]';
// A dialog is marked while it is judged. The mark has to be cleared afterwards: an element that stays in the DOM (the navigation drawer, a
// re-used sheet) would otherwise keep it, and every later dialog would be judged against that stale element.
const clearMarks = () => document.querySelectorAll('[data-crawl-dialog]').forEach(node => node.removeAttribute('data-crawl-dialog'));
const theme = process.env.CRAWL_THEME || 'light';

// Runs in every page before its scripts: counts DOM changes and records event timings.
const instrument = () => {
  window.__crawl = { mutations: 0 };
  try { new MutationObserver(records => { window.__crawl.mutations += records.length; }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); } catch { /* observers are optional */ }
  window.__inp = [];
  try { new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__inp.push([entry.name, entry.duration]); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch { /* event timing is Chromium-only */ }
};

// Marks the controls a user could click right now (inside the open dialog when there is one) and lists them.
const snapshot = ({ skip, dialogs }) => {
  const open = [...document.querySelectorAll(dialogs)].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).pop();
  const root = open || document;
  document.querySelectorAll('[data-crawl-id]').forEach(element => element.removeAttribute('data-crawl-id'));
  const counts = new Map(), items = [];
  for (const element of root.querySelectorAll('button,a[href],[role=button],[role=tab],[role=switch],summary,input[type=checkbox],input[type=radio],select')) {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    // (the skip link is visually hidden until it takes focus, so a pointer cannot press it; the keyboard audit covers it)
    if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.closest('[inert],[aria-hidden="true"],.sr-only')) continue;
    // The tab, filter or toggle that is already on is not expected to do anything when pressed again.
    if (['aria-selected', 'aria-pressed', 'aria-current'].some(name => ['true', 'page', 'step', 'date'].includes(element.getAttribute(name) ?? '')) || element.getAttribute('aria-checked') === 'true' && element.getAttribute('role') === 'radio') continue;
    let name = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('title') || element.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) name = '[' + String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.') + ']';
    if (new RegExp(skip, 'i').test(name)) continue;
    if (element.tagName === 'A' && (element.hasAttribute('download') || element.target === '_blank' || new URL(element.href, location.href).origin !== location.origin)) continue;
    const key = element.tagName + '|' + name, seen = counts.get(key) ?? 0;
    if (seen >= 2) continue; // the same label repeated down a table is one kind of control
    counts.set(key, seen + 1);
    element.setAttribute('data-crawl-id', String(items.length));
    items.push({ id: items.length, key: key + '#' + seen, name, tag: element.tagName.toLowerCase(), type: element.type || '', href: element.tagName === 'A' ? element.getAttribute('href') : '' });
  }
  return { items, inDialog: Boolean(open) };
};

const state = ({ dialogs }) => {
  // Full-screen fixed layers that take pointer input: a modal built without dialog semantics shows up here. A layer that lets pointer input
  // through (a passing status message) does not block anything, so it is not a modal.
  const covers = [...document.querySelectorAll('body *')].filter(element => { const style = getComputedStyle(element); if (style.position !== 'fixed' || style.pointerEvents === 'none') return false; const box = element.getBoundingClientRect(); return box.width >= innerWidth * 0.7 && box.height >= innerHeight * 0.5 && style.visibility !== 'hidden'; });
  return {
    mutations: window.__crawl?.mutations ?? 0, url: location.href,
    dialogs: [...document.querySelectorAll(dialogs)].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).length,
    covers: covers.length,
    coverNotes: covers.map(element => `<${element.tagName.toLowerCase()}${element.getAttribute('role') ? ' role=' + element.getAttribute('role') : ''}> "${(element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)}"`),
  };
};
// Whether a dialog that was open has gone: removed, hidden, off-screen, inert, or no longer announced as a dialog (the navigation drawer
// stays in the DOM, slid off-canvas, when it closes).
const dialogGone = selector => { const dialog = document.querySelector('[data-crawl-dialog]'); if (!dialog || !dialog.isConnected || !dialog.matches(selector) || dialog.closest('[inert]')) return true; const box = dialog.getBoundingClientRect(); return box.width === 0 || box.height === 0 || box.right <= 0 || box.bottom <= 0 || box.left >= innerWidth || box.top >= innerHeight; };

const results = { clicked: 0, dead: [], unclickable: [], navigations: [], dialogs: [], errors: [], errorContexts: [], failed: [], http: [], badText: [], inp: [], slow: [], overlays: [], routesCrawled: 0, loadFailures: [] };
const splitWords = new Map(); // "page: element word" -> the first control after which it was seen
const browser = await launchBrowser();
try {
  for (const device of devices) for (const route of routes) {
    const { context } = await openPortal(browser, base, { theme, viewport: device.viewport, mobile: device.mobile, touch: device.touch });
    await context.addInitScript(instrument);
    await context.addInitScript({ path: AXE_PATH });
    const page = await context.newPage();
    const health = trackHealth(page, base);
    const counters = { native: 0, downloads: 0, popups: 0, api: 0 };
    page.on('dialog', dialog => { counters.native++; dialog.accept().catch(() => {}); });
    page.on('download', () => { counters.downloads++; });
    page.on('request', request => { if (request.url().startsWith(origin) && request.url().includes('/api/') || request.url().includes('/rest/v1/')) counters.api++; });
    // Lazy-loaded dialogs arrive as script chunks; wait for them before judging what a click did.
    const inflight = new Set();
    page.on('request', request => inflight.add(request));
    for (const event of ['requestfinished', 'requestfailed']) page.on(event, request => inflight.delete(request));
    // On the throttled phone a lazy dialog mounts a few hundred ms after its chunk arrives, so the page is also given time to go quiet
    // (no DOM change for ~320 ms, at most 3.5 s) before a click is judged; otherwise a late dialog is mistaken for "nothing happened" and
    // then covers the next control.
    const settle = async () => {
      for (let waited = 0; waited < 4000 && inflight.size; waited += 50) await page.waitForTimeout(50);
      let last = -1, quiet = 0;
      for (let waited = 0; waited < 3500 && quiet < 4; waited += 80) { await page.waitForTimeout(80); const now = await page.evaluate(() => window.__crawl?.mutations ?? 0).catch(() => last); quiet = now === last ? quiet + 1 : 0; last = now; }
    };
    context.on('page', extra => { if (extra !== page) { counters.popups++; extra.close().catch(() => {}); } });
    if (device.cpu && process.env.PORTAL_BROWSER !== 'webkit') { try { await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: device.cpu }); } catch { /* throttling is Chromium-only */ } }
    const label = `${device.name} ${route}`;
    // Which control was used just before a runtime error, so the report says where to look.
    let lastControl = '(page load)';
    page.on('pageerror', error => { results.errorContexts.push(`${label}: after "${lastControl}": ${String(error.message).slice(0, 110)}`); });
    // A render error is caught by the error boundary, so it never reaches pageerror; the boundary logs it to the console.
    page.on('console', message => { if (message.type() === 'error' && /SEGMENT_ERROR|System captured exception|FATAL_ROOT_CRASH/.test(message.text())) results.errorContexts.push(`${label}: after "${lastControl}": ${message.text().replace(/\s+/g, ' ').slice(0, 110)}`); });
    if (!(await gotoPortalRoute(page, base, route))) { results.loadFailures.push(label); await context.close(); continue; }
    results.routesCrawled++;
    const act = locator => device.touch ? locator.tap({ timeout: 1500 }) : locator.click({ timeout: 1500 });
    const scanText = async where => { const hit = await page.evaluate(source => { const match = new RegExp(source).exec(document.body.innerText); return match ? document.body.innerText.slice(Math.max(0, match.index - 25), match.index + 35).replace(/\s+/g, ' ') : null; }, BAD_TEXT.source); if (hit) results.badText.push(`${label} (${where}): ...${hit}...`); };
    await scanText('on load');

    const done = new Set();
    for (let clicks = 0, guard = 0; clicks < limit && guard++ < limit * 3;) {
      let listing;
      try { listing = await page.evaluate(snapshot, { skip: SKIP.source, dialogs: DIALOGS }); } catch { break; }
      const item = listing.items.find(entry => !done.has(entry.key));
      if (!item) break;
      done.add(item.key); clicks++; results.clicked++; lastControl = item.name;
      const locator = page.locator(`[data-crawl-id="${item.id}"]`);
      await page.waitForTimeout(30);
      const before = await page.evaluate(state, { dialogs: DIALOGS }).catch(() => null);
      const inpFrom = await page.evaluate(() => window.__inp?.length ?? 0).catch(() => 0);
      const counted = { ...counters };
      let failure = '';
      try {
        if (item.tag === 'select') { const options = await locator.locator('option').count(); if (options > 1) await locator.selectOption({ index: 1 }, { timeout: 1500 }); }
        else if (item.type === 'checkbox' || item.type === 'radio') await locator.check({ timeout: 1500, force: false }).catch(() => act(locator));
        else await act(locator);
      } catch (error) {
        // Playwright's call log says why: another element intercepts the pointer, the control is outside the viewport, and so on.
        const lines = String(error.message).split('\n');
        const reason = lines.find(line => /intercepts pointer events|not visible|outside of the viewport|not stable|not enabled|detached|does not receive pointer events/i.test(line));
        failure = (lines[0].replace(/^locator\.\w+: /, '').slice(0, 60) + (reason ? ' | ' + reason.replace(/^\s*-?\s*/, '').replace(/\s+/g, ' ').slice(0, 170) : '')).slice(0, 240);
      }
      if (failure) { results.unclickable.push(`${label}: ${item.tag} "${item.name}" - ${failure}`); continue; }
      await page.waitForTimeout(160);
      await settle(); await page.waitForTimeout(60);
      // Which control made the page slowest to respond (Event Timing, Chromium only).
      const slowest = await page.evaluate(from => (window.__inp ?? []).slice(from).filter(([name]) => ['click', 'pointerup', 'mouseup', 'keydown'].includes(name)).reduce((worst, [, duration]) => Math.max(worst, duration), 0), inpFrom).catch(() => 0);
      if (slowest >= 96) results.slow.push({ device: device.name, route, control: item.name, ms: Math.round(slowest) });
      const after = await page.evaluate(state, { dialogs: DIALOGS }).catch(() => null);
      if (device.name === 'phone') { const words = await page.evaluate(layoutAudit, { onlyWords: true }).catch(() => null); for (const entry of words?.splitWords ?? []) if (!splitWords.has(`${label}: ${entry}`)) splitWords.set(`${label}: ${entry}`, item.name); }
      const moved = !after || !before || after.url !== before.url;
      const effect = moved || after.mutations !== before.mutations || after.dialogs !== before.dialogs || counters.native !== counted.native || counters.downloads !== counted.downloads || counters.popups !== counted.popups || counters.api !== counted.api;
      const quiet = item.tag === 'select' || item.type === 'checkbox' || item.type === 'radio'; // may only change a value the page keeps in state
      if (!effect && !quiet) results.dead.push(`${label}: ${item.tag} "${item.name}"${item.href ? ' -> ' + item.href : ''}`);

      if (moved && after && before && new URL(after.url).pathname !== new URL(before.url).pathname) {
        const entry = { from: new URL(before.url).pathname, to: new URL(after.url).pathname, rendered: false, backOk: false, via: item.name };
        // The sidebar's own heading is hidden on phones, so wait for the page's heading inside the content area.
        entry.rendered = await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 8000 }).catch(() => {});
        entry.backOk = new URL(page.url()).pathname === entry.from;
        results.navigations.push({ device: device.name, ...entry });
        if (!entry.backOk) await gotoPortalRoute(page, base, route);
        continue;
      }

      if (after && before && after.dialogs > before.dialogs) {
        const found = { where: `${label} via "${item.name}"`, issues: [] };
        // Judge the dialog at rest: a sheet that is still sliding in sits a few pixels low, and axe blends a half-transparent card with the
        // backdrop and reports contrast that never exists once it has settled.
        await page.waitForTimeout(450);
        const info = await page.evaluate(selector => {
          document.querySelectorAll('[data-crawl-dialog]').forEach(node => node.removeAttribute('data-crawl-dialog'));
          const dialog = [...document.querySelectorAll(selector)].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).pop();
          dialog.setAttribute('data-crawl-dialog', '');
          const box = dialog.getBoundingClientRect();
          const title = dialog.getAttribute('aria-label') || document.getElementById(dialog.getAttribute('aria-labelledby') || '')?.textContent || dialog.querySelector('h1,h2,h3')?.textContent || '';
          return { title: title.replace(/\s+/g, ' ').trim().slice(0, 50), focusInside: dialog.contains(document.activeElement), left: box.left, right: box.right, bottom: box.bottom, vw: innerWidth, vh: innerHeight, modal: dialog.getAttribute('aria-modal') === 'true' || dialog.tagName === 'DIALOG' };
        }, DIALOGS);
        found.title = info.title;
        if (!info.title) found.issues.push('dialog has no accessible name');
        if (!info.modal) found.issues.push('dialog is not aria-modal');
        if (!info.focusInside) found.issues.push('focus did not move into the dialog');
        if (info.left < -1 || info.right > info.vw + 1 || info.bottom > info.vh + 1) found.issues.push(`dialog does not fit the screen (${Math.round(info.left)}..${Math.round(info.right)} of ${info.vw}, bottom ${Math.round(info.bottom)} of ${info.vh})`);
        await scanText('dialog ' + info.title);
        const axe = await axeAudit(page, { include: '[data-crawl-dialog]' }).catch(() => []);
        for (const violation of axe) found.issues.push(`axe ${violation.impact} ${violation.id} x${violation.nodes.length}: ${violation.nodes[0].target} :: ${violation.nodes[0].html.slice(0, 90)}`);
        const fields = await page.evaluate(inputAudit, '[data-crawl-dialog]');
        for (const problem of fields.problems.slice(0, 3)) found.issues.push(`input ${problem.field}: ${problem.found.join(', ')}`);
        let escaped = 0;
        for (let step = 0; step < 24; step++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => document.querySelector('[data-crawl-dialog]')?.contains(document.activeElement) ?? true))) escaped++; }
        if (escaped) found.issues.push(`Tab left the dialog ${escaped} times (focus is not trapped)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(260);
        let closed = await page.evaluate(dialogGone, DIALOGS);
        if (!closed) {
          found.issues.push('Escape does not close the dialog');
          await page.locator('[data-crawl-dialog]').getByRole('button', { name: /close|cancel|dismiss|back|done|no\b|×/i }).first().click({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(260);
          closed = await page.evaluate(dialogGone, DIALOGS);
          if (!closed) found.issues.push('the dialog could not be closed by any button either');
        }
        if (closed) {
          const returned = await page.evaluate(id => { const active = document.activeElement; return active && active !== document.body ? (active.getAttribute('data-crawl-id') === id ? 'opener' : 'elsewhere') : 'lost'; }, String(item.id));
          if (returned === 'lost') found.issues.push('after closing, focus is lost (back to the top of the page)');
        }
        results.dialogs.push(found);
        await page.evaluate(clearMarks).catch(() => {});
      } else if (after && before && after.covers > before.covers) results.overlays.push(`${label}: "${item.name}" opened a full-screen layer without dialog semantics: ${after.coverNotes.filter(note => !before.coverNotes.includes(note)).join(' ; ') || after.coverNotes.join(' ; ')}`);
      await scanText(`after "${item.name}"`);
    }

    await scanText('end');
    const events = await page.evaluate(() => window.__inp || []).catch(() => []);
    const durations = events.filter(([name]) => ['click', 'keydown', 'pointerup', 'mouseup'].includes(name)).map(([, duration]) => duration).sort((a, b) => a - b);
    if (durations.length) results.inp.push({ device: device.name, route, interactions: durations.length, p75: Math.round(durations[Math.floor(durations.length * 0.75)]), worst: Math.round(durations[durations.length - 1]) });
    for (const [kind, rows] of [['errors', health.errors], ['failed', health.failed], ['http', health.http]]) for (const row of [...new Set(rows)]) results[kind].push(`${label}: ${row}`);
    await context.close();
  }
} finally { await browser.close(); }

// ---------- summary ----------
const dialogIssues = results.dialogs.filter(dialog => dialog.issues.length);
const list = (title, rows, max = 30) => { console.log(`\n${title}: ${rows.length}`); for (const row of rows.slice(0, max)) console.log('  ' + row); if (rows.length > max) console.log(`  ... and ${rows.length - max} more`); };
console.log(`INTERACTION CRAWL: ${results.routesCrawled} page runs (${devices.map(device => device.name).join(' + ')}), ${results.clicked} controls used, ${results.dialogs.length} dialogs opened, ${results.navigations.length} navigations`);
list('DEAD CONTROLS (no visible effect)', results.dead, 60);
list('UNCLICKABLE (covered, clipped or off-screen)', results.unclickable, 30);
list('NAVIGATION (did not render, or Back did not return)', results.navigations.filter(entry => !entry.rendered || !entry.backOk).map(entry => `${entry.device} ${entry.from} -> ${entry.to} via "${entry.via}" rendered=${entry.rendered} back=${entry.backOk}`));
console.log(`\nDIALOGS with issues: ${dialogIssues.length} of ${results.dialogs.length}`);
for (const dialog of dialogIssues.slice(0, 40)) { console.log(`  ${dialog.where} [${dialog.title || 'untitled'}]`); for (const issue of dialog.issues.slice(0, 6)) console.log('      - ' + issue); }
list('FULL-SCREEN LAYERS WITHOUT DIALOG SEMANTICS', results.overlays);
list('WORDS BROKEN MID-WAY (phone run)', [...splitWords].map(([key, control]) => `${key} (first seen after "${control}")`), 60);
list('RUNTIME ERRORS', results.errors);
list('RUNTIME ERRORS: the control used just before each', results.errorContexts, 12);
list('FAILED REQUESTS (this origin)', results.failed);
list('HTTP ERRORS (this origin)', results.http);
list('"undefined" / "NaN" TEXT', results.badText);
list('LOAD FAILURES', results.loadFailures);
const worst = results.inp.sort((a, b) => b.worst - a.worst).slice(0, 8);
console.log('\nSLOWEST INTERACTIONS (event duration, ms; phone is CPU-throttled 4x):'); for (const row of worst) console.log(`  ${row.device} ${row.route}: worst ${row.worst}, p75 ${row.p75} over ${row.interactions} interactions`);
console.log('\nSLOW CONTROLS (a click that took 96 ms or more to respond):'); for (const row of results.slow.sort((a, b) => b.ms - a.ms).slice(0, 14)) console.log(`  ${String(row.ms).padStart(4)} ms  ${row.device} ${row.route}  "${row.control}"`);
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'interactions.json'), JSON.stringify(results, null, 1)); }
console.log(JSON.stringify({ routesCrawled: results.routesCrawled, controlsUsed: results.clicked, dead: results.dead.length, unclickable: results.unclickable.length, dialogs: results.dialogs.length, dialogsWithIssues: dialogIssues.length, navigations: results.navigations.length, errors: results.errors.length, failedRequests: results.failed.length, badText: results.badText.length, splitWords: splitWords.size, worstInteractionMs: worst[0]?.worst ?? null }));
if (!process.env.CRAWL_REPORT_ONLY) {
  assert.deepEqual(results.loadFailures, [], 'every page renders');
  assert.deepEqual(results.errors, [], 'no runtime errors while using the pages');
  assert.deepEqual(results.badText, [], 'no "undefined" or "NaN" text');
  assert.deepEqual([...splitWords.keys()], [], 'no word is broken mid-way on the phone');
  assert.deepEqual(dialogIssues.map(dialog => `${dialog.where}: ${dialog.issues[0]}`), [], 'every dialog manages focus, closes with Escape and fits the screen');
  assert.deepEqual(results.unclickable, [], 'no control is covered or clipped');
}
