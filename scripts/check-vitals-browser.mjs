import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPortal, PORTAL_ROUTES, trackHealth } from './lib/portal-harness.mjs';

// Core Web Vitals on a fresh production load of every page, measured in the browser (Chromium only):
// LCP, FCP, CLS, total blocking time (the lab stand-in for INP; see check-interactions-browser for interaction latency),
// TTFB, and the weight of scripts, styles, images and fonts. The phone profile uses Lighthouse's mobile throttling
// (4x CPU, 150 ms round trip, 1.6 Mbps) and the desktop profile none. Data requests are fictional fixtures that answer
// after a fixed delay, so this measures the app shell and rendering, not the real database.
// Usage: node scripts/check-vitals-browser.mjs <baseUrl> [outDir]
// VITALS_ROUTES=/dashboard,/students  VITALS_PROFILES=phone,desktop  VITALS_STRICT=1 (fail outside the limits; the default is to report)
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outDir = process.argv[3] || '';
const routes = process.env.VITALS_ROUTES ? process.env.VITALS_ROUTES.split(',') : PORTAL_ROUTES;
const wanted = (process.env.VITALS_PROFILES || 'phone,desktop').split(',');
const profiles = [
  { short: 'phone', label: 'phone: 4x CPU, 150 ms RTT, 1.6 Mbps', viewport: { width: 412, height: 823 }, mobile: true, touch: true, scale: 1.75, cpu: 4, network: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 }, apiDelayMs: 150 },
  { short: 'desktop', label: 'desktop: no throttling', viewport: { width: 1350, height: 940 }, apiDelayMs: 40 },
].filter(profile => wanted.includes(profile.short));
const LIMITS = { lcp: 2500, cls: 0.1, tbt: 200 };

// Registered before the page's own scripts so that nothing is missed.
const observe = () => {
  const vitals = window.__vitals = { lcp: 0, lcpNode: '', fcp: 0, cls: 0, shifts: [], longTasks: [] };
  const watch = (type, handle) => { try { new PerformanceObserver(list => list.getEntries().forEach(handle)).observe({ type, buffered: true }); } catch { /* unsupported entry type */ } };
  watch('largest-contentful-paint', entry => { vitals.lcp = entry.startTime; vitals.lcpNode = entry.element ? entry.element.tagName.toLowerCase() + '.' + String(entry.element.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.') : entry.url.slice(-40); });
  watch('paint', entry => { if (entry.name === 'first-contentful-paint') vitals.fcp = entry.startTime; });
  let windowValue = 0, windowEntries = [];
  watch('layout-shift', entry => {
    if (entry.hadRecentInput) return;
    const first = windowEntries[0], last = windowEntries[windowEntries.length - 1];
    if (windowEntries.length && entry.startTime - last.startTime < 1000 && entry.startTime - first.startTime < 5000) { windowValue += entry.value; windowEntries.push(entry); } else { windowValue = entry.value; windowEntries = [entry]; }
    vitals.cls = Math.max(vitals.cls, windowValue);
    vitals.shifts.push({ at: Math.round(entry.startTime), value: Math.round(entry.value * 1e4) / 1e4, nodes: (entry.sources || []).slice(0, 2).map(source => source.node ? source.node.nodeName.toLowerCase() + '.' + String(source.node.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '?') });
  });
  watch('longtask', entry => vitals.longTasks.push([Math.round(entry.startTime), Math.round(entry.duration)]));
};

const rows = [];
const browser = await launchBrowser();
try {
  for (const profile of profiles) for (const route of routes) {
    const { context } = await openPortal(browser, base, { viewport: profile.viewport, mobile: profile.mobile, touch: profile.touch, scale: profile.scale || 1, apiDelayMs: profile.apiDelayMs, reducedMotion: 'no-preference' });
    await context.addInitScript(observe);
    const page = await context.newPage();
    const health = trackHealth(page, base);
    if (process.env.PORTAL_BROWSER !== 'webkit') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      if (profile.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.network.latency, downloadThroughput: profile.network.down, uploadThroughput: profile.network.up });
      if (profile.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    }
    const row = { profile: profile.short, route, ok: false };
    try {
      await page.goto(base + route, { waitUntil: 'load', timeout: 180000 });
      await page.locator('[data-portal-scroll] h1').first().waitFor({ timeout: 120000 });
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500); // late layout shifts and long tasks
      const data = await page.evaluate(() => {
        const vitals = window.__vitals, navigation = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const bytes = test => Math.round(resources.filter(test).reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0) / 1024);
        const fcp = vitals.fcp, blocked = vitals.longTasks.filter(([start]) => start >= fcp).reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
        const images = [...document.images].map(image => { const box = image.getBoundingClientRect(); return { src: (image.currentSrc || image.src || '').slice(-50), alt: image.hasAttribute('alt'), sized: image.hasAttribute('width') && image.hasAttribute('height'), lazy: image.loading === 'lazy', broken: image.complete && image.naturalWidth === 0, natural: image.naturalWidth, shown: Math.round(box.width), visible: box.width > 0 }; });
        return {
          lcp: Math.round(vitals.lcp), lcpNode: vitals.lcpNode, fcp: Math.round(vitals.fcp), cls: Math.round(vitals.cls * 1e4) / 1e4, shifts: vitals.shifts.slice(0, 4), tbt: Math.round(blocked), longTasks: vitals.longTasks.length, longest: Math.max(0, ...vitals.longTasks.map(([, duration]) => duration)),
          ttfb: Math.round(navigation.responseStart), load: Math.round(navigation.loadEventEnd),
          jsKB: bytes(entry => /\.js(\?|$)/.test(entry.name)), cssKB: bytes(entry => /\.css(\?|$)/.test(entry.name)), imgKB: bytes(entry => entry.initiatorType === 'img' || /\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/.test(entry.name)), fontKB: bytes(entry => /\.(woff2?|ttf|otf)(\?|$)/.test(entry.name)), requests: resources.length,
          dom: document.querySelectorAll('*').length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
          images, fonts: [...document.fonts].map(font => `${font.family} ${font.weight} ${font.status}`),
        };
      });
      Object.assign(row, data, { ok: true, errors: [...new Set(health.errors)].length, http: [...new Set(health.http)], failed: [...new Set(health.failed)] });
    } catch (error) { row.error = String(error.message).split('\n')[0]; }
    rows.push(row);
    await context.close();
  }
} finally { await browser.close(); }

// ---------- summary ----------
const flag = (value, limit) => value > limit ? ' !' : '  ';
for (const profile of profiles) {
  console.log(`\nWEB VITALS - ${profile.label} (limits: LCP ${LIMITS.lcp} ms, CLS ${LIMITS.cls}, TBT ${LIMITS.tbt} ms)`);
  console.log('  route         LCP ms   FCP ms  CLS     TBT ms  TTFB   JS KB  CSS KB  img KB  font KB  DOM    heap MB  LCP element');
  for (const row of rows.filter(entry => entry.profile === profile.short)) {
    if (!row.ok) { console.log(`  ${row.route.padEnd(13)} DID NOT RENDER ${row.error || ''}`); continue; }
    console.log(`  ${row.route.padEnd(13)} ${String(row.lcp).padStart(6)}${flag(row.lcp, LIMITS.lcp)} ${String(row.fcp).padStart(7)}  ${String(row.cls).padEnd(7)}${flag(row.cls, LIMITS.cls)}${String(row.tbt).padStart(5)}${flag(row.tbt, LIMITS.tbt)} ${String(row.ttfb).padStart(5)}  ${String(row.jsKB).padStart(6)} ${String(row.cssKB).padStart(7)} ${String(row.imgKB).padStart(7)} ${String(row.fontKB).padStart(8)} ${String(row.dom).padStart(6)} ${String(row.heapMB ?? '-').padStart(8)}  ${row.lcpNode}`);
  }
}
const issues = [];
for (const row of rows.filter(entry => entry.ok)) {
  for (const shift of row.cls > 0 ? row.shifts : []) issues.push(`${row.profile} ${row.route}: layout shift ${shift.value} at ${shift.at} ms (${shift.nodes.join(', ')})`);
  for (const image of row.images) { if (image.broken) issues.push(`${row.profile} ${row.route}: broken image ${image.src}`); else if (image.visible && !image.alt) issues.push(`${row.profile} ${row.route}: image without alt ${image.src}`); else if (image.visible && !image.sized && image.shown > 0) issues.push(`${row.profile} ${row.route}: image without width/height (layout shift risk) ${image.src}`); }
  for (const font of row.fonts) if (/ error$/.test(font)) issues.push(`${row.profile} ${row.route}: font failed to load: ${font}`);
  for (const entry of [...row.http, ...row.failed]) issues.push(`${row.profile} ${row.route}: ${entry}`);
}
console.log(`\nASSET AND LAYOUT-SHIFT NOTES: ${new Set(issues).size}`); for (const issue of [...new Set(issues)].slice(0, 30)) console.log('  ' + issue);
const bad = rows.filter(row => !row.ok || row.lcp > LIMITS.lcp || row.cls > LIMITS.cls || row.tbt > LIMITS.tbt);
console.log(JSON.stringify({ measured: rows.filter(row => row.ok).length, outsideLimits: bad.length, worstLcp: Math.max(0, ...rows.filter(row => row.ok).map(row => row.lcp)), worstCls: Math.max(0, ...rows.filter(row => row.ok).map(row => row.cls)), worstTbt: Math.max(0, ...rows.filter(row => row.ok).map(row => row.tbt)) }));
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'vitals.json'), JSON.stringify(rows, null, 1)); }
// The phone profile is Lighthouse's slow-4G mobile preset: the numbers are a lab budget to watch, not a gate every build must meet. Set
// VITALS_STRICT=1 (for example against a staging build behind a CDN) to fail when a page is outside the limits.
if (process.env.VITALS_STRICT && !process.env.VITALS_REPORT_ONLY) assert.deepEqual(bad.map(row => `${row.profile} ${row.route}`), [], 'every page is within the LCP, CLS and TBT limits');
