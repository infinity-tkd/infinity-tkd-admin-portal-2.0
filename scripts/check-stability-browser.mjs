import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gotoPortalRoute, launchBrowser, openPortal, PORTAL_ROUTES, trackHealth } from './lib/portal-harness.mjs';

// How the pages behave when the data is not the happy path. Fictional fixtures only.
//  empty    no records at all: every page renders an empty state, not a blank page or "undefined"/"NaN" text;
//  outage   every data request answers 503: every page says so (an alert or notice) instead of staying silent;
//  slow     data answers after 3 s: every page shows a loading state straight away instead of a blank screen;
//  large    a 1,500-student roster: render time, long tasks, DOM size and search-typing latency on the heavy pages;
//  offline  the connection drops and returns: a banner appears and clears;
//  history  direct access, reload, Back and Forward keep the right page; an unknown address shows the 404 page.
// Usage: node scripts/check-stability-browser.mjs <baseUrl> [outDir]      STABILITY_ONLY=empty,outage  STABILITY_REPORT_ONLY=1
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outDir = process.argv[3] || '';
const only = (process.env.STABILITY_ONLY || 'empty,outage,slow,large,offline,history').split(',');
const BAD_TEXT = /\b(undefined|NaN|Infinity|Invalid Date)\b|\[object Object\]/;
const FAILURE_WORDS = /could not|couldn't|unavailable|failed|try again|retry|offline|error|unable|not available|problem|outage/i;
const report = { empty: [], outage: [], slow: [], large: [], offline: [], history: [] };
const problems = [];
const problem = (scenario, text) => problems.push(`[${scenario}] ${text}`);

const bodyText = page => page.evaluate(() => (document.querySelector('[data-portal-scroll]')?.innerText || '').replace(/\s+/g, ' ').trim());
const badText = async page => page.evaluate(source => { const match = new RegExp(source).exec(document.body.innerText); return match ? document.body.innerText.slice(Math.max(0, match.index - 25), match.index + 35).replace(/\s+/g, ' ') : null; }, BAD_TEXT.source);

const browser = await launchBrowser();
try {
  if (only.includes('empty')) for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const { context } = await openPortal(browser, base, { empty: true, viewport, mobile, touch: mobile });
    const page = await context.newPage(); const health = trackHealth(page, base);
    for (const route of PORTAL_ROUTES) {
      if (!(await gotoPortalRoute(page, base, route))) { problem('empty', `${name} ${route} did not render`); continue; }
      await page.waitForTimeout(600);
      const text = await bodyText(page), bad = await badText(page);
      report.empty.push({ name, route, chars: text.length });
      if (text.length < 60) problem('empty', `${name} ${route} is nearly blank with no data (${text.length} characters)`);
      if (bad) problem('empty', `${name} ${route} shows "${bad}"`);
    }
    for (const row of [...new Set(health.errors)]) problem('empty', `${name} runtime error: ${row}`);
    await context.close();
  }

  if (only.includes('outage')) {
    const { context } = await openPortal(browser, base, { failApi: true });
    const page = await context.newPage(); const health = trackHealth(page, base);
    for (const route of PORTAL_ROUTES) {
      if (!(await gotoPortalRoute(page, base, route))) { problem('outage', `${route} did not render at all during an outage`); continue; }
      await page.waitForTimeout(1500);
      const informed = await page.evaluate(source => { const pattern = new RegExp(source, 'i'); const alerts = [...document.querySelectorAll('[role=alert],[role=status],[data-portal-scroll] [class*=notice],[data-load-status]')].map(element => element.innerText).join(' '); return pattern.test(alerts) || pattern.test(document.querySelector('[data-portal-scroll]')?.innerText || ''); }, FAILURE_WORDS.source);
      const bad = await badText(page);
      report.outage.push({ route, informed });
      if (!informed) problem('outage', `${route} gives no sign that its data could not be loaded`);
      if (bad) problem('outage', `${route} shows "${bad}"`);
    }
    // The shop pages log a console error for each request that fails during the outage; that is the diagnostic working, not a crash.
    for (const row of [...new Set(health.errors)].filter(text => !/^Failed to fetch (student orders|products from Supabase|sales history from database)/.test(text))) problem('outage', `runtime error: ${row}`);
    await context.close();
  }

  if (only.includes('slow')) {
    const { context } = await openPortal(browser, base, { apiDelayMs: 3000 });
    const page = await context.newPage();
    for (const route of PORTAL_ROUTES) {
      await page.goto(base + route, { waitUntil: 'commit', timeout: 120000 });
      await page.locator('[data-portal-scroll]').waitFor({ timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => { const scroller = document.querySelector('[data-portal-scroll]'); const text = (scroller?.innerText || '').replace(/\s+/g, ' ').trim(); return { chars: text.length, indicator: Boolean(document.querySelector('[aria-busy="true"],.animate-pulse,[role=progressbar],[data-loading]')) || /loading|please wait|syncing|checking/i.test(text) }; });
      report.slow.push({ route, ...state });
      if (!state.indicator && state.chars < 80) problem('slow', `${route} is blank while its data loads (${state.chars} characters, no loading indicator)`);
    }
    await context.close();
  }

  if (only.includes('large')) {
    const { context } = await openPortal(browser, base, { students: 1500, reducedMotion: 'no-preference' });
    await context.addInitScript(() => { window.__long = []; window.__events = []; try { new PerformanceObserver(list => list.getEntries().forEach(entry => window.__long.push(Math.round(entry.duration)))).observe({ type: 'longtask', buffered: true }); new PerformanceObserver(list => list.getEntries().forEach(entry => window.__events.push([entry.name, Math.round(entry.duration)]))).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch { /* unsupported in this engine */ } });
    const page = await context.newPage(); const health = trackHealth(page, base);
    for (const route of ['/students', '/dashboard', '/attendance', '/financials', '/schedule', '/belt-tests']) {
      const started = Date.now();
      if (!(await gotoPortalRoute(page, base, route))) { problem('large', `${route} did not render with 1,500 students`); continue; }
      const loadMs = Date.now() - started;
      let typing = null;
      const search = page.locator('[data-portal-scroll] input[type=text], [data-portal-scroll] input[type=search]').first();
      if (await search.count()) { const t0 = Date.now(); await search.pressSequentially('Athlete 77', { delay: 0 }); await page.waitForTimeout(250); typing = Date.now() - t0; }
      const stats = await page.evaluate(() => ({ dom: document.querySelectorAll('*').length, longTasks: window.__long.length, longest: Math.max(0, ...window.__long), worstEvent: Math.max(0, ...window.__events.filter(([name]) => ['keydown', 'keyup', 'input', 'click', 'pointerup'].includes(name)).map(([, duration]) => duration)), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));
      report.large.push({ route, loadMs, typing, ...stats });
      if (stats.dom > 15000) problem('large', `${route} renders ${stats.dom} DOM nodes for 1,500 students`);
      if (stats.longest > 1000) problem('large', `${route} blocks the main thread for ${stats.longest} ms`);
      if (stats.worstEvent > 500) problem('large', `${route} answers an interaction in ${stats.worstEvent} ms`);
    }
    for (const row of [...new Set(health.errors)]) problem('large', `runtime error: ${row}`);
    await context.close();
  }

  if (only.includes('offline')) {
    const { context } = await openPortal(browser, base);
    const page = await context.newPage();
    if (await gotoPortalRoute(page, base, '/dashboard')) {
      await context.setOffline(true);
      const shown = await page.getByText(/offline|no connection|connection lost/i).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
      report.offline.push({ bannerWhenOffline: shown });
      if (!shown) problem('offline', 'no sign of being offline appears within 8 s of losing the connection');
      await context.setOffline(false);
      const cleared = await page.waitForFunction(() => !/you are offline|no connection|connection lost/i.test(document.body.innerText), null, { timeout: 15000 }).then(() => true, () => false);
      report.offline.push({ bannerClearsOnline: cleared });
      if (!cleared) problem('offline', 'the offline notice does not clear after the connection returns');
    } else problem('offline', '/dashboard did not render');
    await context.close();
  }

  if (only.includes('history')) {
    const { context } = await openPortal(browser, base, { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pathOf = () => new URL(page.url()).pathname;
    // direct access to every page was exercised above; here: reload, Back and Forward through client-side navigation
    if (await gotoPortalRoute(page, base, '/students')) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 60000 }).catch(() => {});
      report.history.push({ step: 'reload keeps /students', ok: pathOf() === '/students' });
      const links = ['/attendance', '/financials', '/schedule'];
      for (const href of links) { await page.locator(`aside a[href="${href}"]`).first().click(); await page.waitForURL('**' + href, { timeout: 15000 }).catch(() => {}); await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 30000 }).catch(() => {}); }
      report.history.push({ step: 'navigated forward through 3 pages', ok: pathOf() === '/schedule' });
      for (const expected of ['/financials', '/attendance', '/students']) { await page.goBack({ waitUntil: 'domcontentloaded' }); await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 30000 }).catch(() => {}); const ok = pathOf() === expected; report.history.push({ step: `Back to ${expected}`, ok }); if (!ok) problem('history', `Back went to ${pathOf()}, expected ${expected}`); }
      await page.goForward({ waitUntil: 'domcontentloaded' }); await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 30000 }).catch(() => {});
      const forwardOk = pathOf() === '/attendance'; report.history.push({ step: 'Forward to /attendance', ok: forwardOk });
      if (!forwardOk) problem('history', `Forward went to ${pathOf()}, expected /attendance`);
      if (!(await page.locator('[data-portal-scroll] h1').first().isVisible())) problem('history', 'the page shows no heading after Back and Forward');
    } else problem('history', '/students did not render');
    await page.goto(base + '/this-page-does-not-exist', { waitUntil: 'networkidle' });
    const notFound = await page.locator('[data-portal-scroll] h1').first().innerText().catch(() => '');
    const homeLink = await page.getByRole('link', { name: /home|dashboard|back|sign in|return/i }).count();
    report.history.push({ step: '404 page', heading: notFound, linkBack: homeLink > 0 });
    if (!/404|not found|missing|lost|couldn/i.test(notFound)) problem('history', `an unknown address shows "${notFound}" instead of a clear 404 page`);
    if (!homeLink) problem('history', 'the 404 page has no link back');
    await context.close();
  }
} finally { await browser.close(); }

// ---------- summary ----------
console.log('STABILITY');
if (report.empty.length) console.log(`  empty data: ${report.empty.length} page renders; shortest page text ${Math.min(...report.empty.map(row => row.chars))} characters (${report.empty.sort((a, b) => a.chars - b.chars)[0]?.name} ${report.empty[0]?.route})`);
if (report.outage.length) console.log(`  API outage: ${report.outage.filter(row => row.informed).length} of ${report.outage.length} pages tell the user`);
if (report.slow.length) console.log(`  slow API: ${report.slow.filter(row => row.indicator || row.chars >= 80).length} of ${report.slow.length} pages show something while loading`);
if (report.large.length) { console.log('  1,500 students:  route         load ms  typing ms  DOM nodes  long tasks  longest  worst interaction  heap MB'); for (const row of report.large) console.log(`                   ${row.route.padEnd(13)} ${String(row.loadMs).padStart(7)}  ${String(row.typing ?? '-').padStart(9)}  ${String(row.dom).padStart(9)}  ${String(row.longTasks).padStart(10)}  ${String(row.longest).padStart(7)}  ${String(row.worstEvent).padStart(17)}  ${String(row.heapMB ?? '-').padStart(7)}`); }
for (const row of report.offline) console.log('  offline: ' + JSON.stringify(row));
for (const row of report.history) console.log('  history: ' + JSON.stringify(row));
console.log(`\nPROBLEMS: ${problems.length}`); for (const text of problems) console.log('  - ' + text);
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'stability.json'), JSON.stringify({ report, problems }, null, 1)); }
console.log(JSON.stringify({ problems: problems.length, scenarios: only }));
if (!process.env.STABILITY_REPORT_ONLY) assert.deepEqual(problems, [], 'the pages hold up when the data is empty, slow, failing or large');
