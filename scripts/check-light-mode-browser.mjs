import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3001';
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });

// Light mode rewrites some colours with !important (app/globals.css). Hovering a button with a
// light tint (hover:bg-red-500/10, hover:bg-emerald-50) must keep its own text colour; only solid
// hover fills (hover:bg-red-600) turn the text white. Runs on the public sign-in page: no data.
const white = 'rgb(255, 255, 255)';
const probes = [
  { id: 'tint-red', className: 'text-red-600 hover:bg-red-500/10', solid: false },
  { id: 'tint-red-50', className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950', solid: false },
  { id: 'tint-brand', className: 'text-[#EF2F38] hover:bg-[#EF2F38]/10', solid: false },
  { id: 'tint-emerald', className: 'text-emerald-700 hover:bg-emerald-500/20', solid: false },
  { id: 'tint-amber', className: 'text-amber-700 hover:bg-amber-200', solid: false },
  { id: 'tint-purple', className: 'text-purple-700 hover:bg-purple-100', solid: false },
  { id: 'solid-red', className: 'text-red-600 hover:bg-red-600', solid: true },
  { id: 'solid-emerald', className: 'text-emerald-700 hover:bg-emerald-600', solid: true },
  { id: 'solid-blue', className: 'text-blue-700 hover:bg-blue-700', solid: true },
  { id: 'solid-amber', className: 'text-amber-700 hover:bg-amber-500', solid: true },
];
const results = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => { try { localStorage.setItem('infinity_theme', 'light'); } catch { /* storage is optional */ } });
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === new URL(base).origin ? route.continue() : route.abort(); });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(list => {
    document.documentElement.classList.remove('dark');
    // Read the final hover colour, not a colour transition half-way.
    const still = document.createElement('style'); still.textContent = '#light-mode-probes *{transition:none!important}'; document.head.append(still);
    const box = document.createElement('div'); box.id = 'light-mode-probes';
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;padding:24px;display:flex;flex-direction:column;gap:8px;align-items:flex-start';
    for (const probe of list) { const button = document.createElement('button'); button.type = 'button'; button.id = probe.id; button.className = `px-4 py-2 border ${probe.className}`; button.textContent = probe.id; box.append(button); }
    document.body.append(box);
  }, probes);
  for (const probe of probes) {
    const button = page.locator('#' + probe.id);
    const before = await button.evaluate(el => getComputedStyle(el).color);
    await button.hover();
    const hovered = await button.evaluate(el => ({ color: getComputedStyle(el).color, matches: el.matches(':hover') }));
    assert.ok(hovered.matches, `${probe.id}: the pointer is over the button`);
    results.push({ id: probe.id, before, hovered: hovered.color });
    if (probe.solid) assert.equal(hovered.color, white, `${probe.id}: a solid hover fill shows white text`);
    else assert.notEqual(hovered.color, white, `${probe.id}: a tinted hover keeps its own text colour (was white on a near-white background)`);
  }
  console.log(JSON.stringify({ passed: true, probes: results.length, tinted: results.filter(r => r.id.startsWith('tint')).length, solid: results.filter(r => r.id.startsWith('solid')).length, liveWrites: 0 }));
} catch (error) {
  console.error(JSON.stringify(results));
  throw error;
} finally { await browser.close(); }
