import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gotoPortalRoute, launchBrowser, openPortal, PORTAL_ROUTES, trackHealth } from './lib/portal-harness.mjs';
import { layoutAudit } from './lib/layout-audit.mjs';

// Every page at every size in the brief, as the device it stands for: phones and tablets are touch devices
// (pointer: coarse, mobile viewport), desktops use a mouse. A touch iPad Pro in landscape is wider than 1280 px but
// still gets the tablet layout, which a mouse-driven resize never shows. Checks per page and size: no sideways
// scrolling, no cut-off tab, card or short label, last content clear of the bottom bar, controls of at least 24 px
// (WCAG 2.2 target size). Fictional fixtures only.
// Usage: node scripts/check-device-matrix-browser.mjs <baseUrl> [outDir]
// MATRIX_CLASSES=phone,tablet,desktop  MATRIX_ROUTES=/dashboard,/students  MATRIX_THEME=dark  MATRIX_SHOTS=<dir> (screenshots at
// representative sizes)  MATRIX_REPORT_ONLY=1  MATRIX_SKIP_TARGETS=1 (do not fail on small targets)
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outDir = process.argv[3] || '';
const routes = process.env.MATRIX_ROUTES ? process.env.MATRIX_ROUTES.split(',') : PORTAL_ROUTES;
const theme = process.env.MATRIX_THEME === 'dark' ? 'dark' : 'light';
const language = ['kh', 'zh'].includes(process.env.MATRIX_LANG || '') ? process.env.MATRIX_LANG : 'en'; // Khmer and Chinese text is wider and taller than English
const shots = process.env.MATRIX_SHOTS || '';
const classes = [
  { name: 'phone', mobile: true, touch: true, scale: 2, sizes: [[320, 568], [360, 740], [375, 812], [390, 844], [414, 896], [430, 932], [568, 320], [740, 360], [844, 390], [896, 414], [932, 430]], shoot: ['320x568', '390x844', '844x390'] },
  { name: 'tablet', touch: true, scale: 2, sizes: [[600, 960], [768, 1024], [820, 1180], [834, 1194], [1024, 1366], [960, 600], [1024, 768], [1180, 820], [1194, 834], [1366, 1024]], shoot: ['768x1024', '834x1194', '1024x1366', '1194x834', '1366x1024'] },
  { name: 'desktop', sizes: [[1280, 800], [1366, 768], [1440, 900], [1536, 864], [1680, 1050], [1920, 1080], [2560, 1440]], shoot: ['1280x800', '1440x900', '2560x1440'] },
].filter(entry => (process.env.MATRIX_CLASSES || 'phone,tablet,desktop').split(',').includes(entry.name));

const results = [], renderFailures = [], errors = [];
const browser = await launchBrowser();
try {
  for (const device of classes) {
    const [firstWidth, firstHeight] = device.sizes[0];
    const { context } = await openPortal(browser, base, { theme, language, viewport: { width: firstWidth, height: firstHeight }, mobile: device.mobile, touch: device.touch, scale: device.scale ?? 1 });
    const page = await context.newPage();
    const health = trackHealth(page, base);
    for (const route of routes) {
      if (!(await gotoPortalRoute(page, base, route))) { renderFailures.push(`${device.name} ${route}`); continue; }
      for (const [width, height] of device.sizes) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(220);
        const audit = await page.evaluate(layoutAudit);
        results.push({ device: device.name, route, size: `${width}x${height}`, ...audit });
        if (shots && device.shoot.includes(`${width}x${height}`)) {
          const folder = path.join(shots, `${device.name}-${width}x${height}`);
          fs.mkdirSync(folder, { recursive: true });
          await page.screenshot({ path: path.join(folder, route.slice(1).replace(/\W+/g, '-') + '.png') });
        }
      }
    }
    for (const row of [...new Set(health.errors)]) errors.push(`${device.name}: ${row}`);
    await context.close();
  }
} finally { await browser.close(); }

// ---------- summary ----------
const broken = row => row.page || row.shell || row.offenders.length || row.cutKpis.length || row.cutTabs.length || row.cutLabels.length || row.splitWords.length || row.obscured > 0;
const sizes = [...new Set(results.map(row => `${row.device} ${row.size}`))];
console.log(`DEVICE MATRIX: ${results.length} page-size checks (${routes.length} pages x ${sizes.length} sizes), theme ${theme}, language ${language}`);
console.log('  size                nav        broken pages   < 24px controls   touch targets < 44px (total)');
for (const label of sizes) {
  const rows = results.filter(row => `${row.device} ${row.size}` === label);
  const modes = [...new Set(rows.map(row => row.navMode))].join('/');
  console.log(`  ${label.padEnd(19)} ${modes.padEnd(10)} ${String(rows.filter(broken).length).padStart(6)}  ${String(rows.filter(row => row.tooSmall24.length).length).padStart(14)}  ${String(rows.reduce((sum, row) => sum + row.touchSmall, 0)).padStart(22)}`);
}
const reasons = row => [row.page && 'page scrolls sideways', row.shell && 'content area scrolls sideways', row.offenders.length && `overflow: ${row.offenders.join(' | ')}`, row.cutKpis.length && `cut metric labels: ${row.cutKpis.join(', ')}`, row.cutTabs.length && `cut tab labels: ${row.cutTabs.join(', ')}`, row.cutLabels.length && `cut labels: ${row.cutLabels.join(' | ')}`, row.splitWords.length && `word broken mid-way: ${row.splitWords.join(' | ')}`, row.obscured > 0 && `last content ${row.obscured}px under the bottom bar${row.obscuredBy ? ' (' + row.obscuredBy + ')' : ''}`].filter(Boolean).join('; ');
const brokenRows = results.filter(broken);
console.log(`\nBROKEN LAYOUTS: ${brokenRows.length}`);
for (const row of brokenRows.slice(0, 40)) console.log(`  ${row.device} ${row.size} ${row.route}: ${reasons(row)}`);
const smallRows = results.filter(row => row.tooSmall24.length);
const smallKinds = new Map();
for (const row of smallRows) for (const target of row.tooSmall24) { const key = target.replace(/\s+\d+x\d+/, ''); const entry = smallKinds.get(key) ?? { count: 0, pages: new Set(), example: target }; entry.count++; entry.pages.add(row.route); smallKinds.set(key, entry); }
console.log(`\nCONTROLS UNDER 24 x 24 px (WCAG 2.2 target size): ${smallKinds.size} distinct controls on ${new Set(smallRows.map(row => row.route)).size} pages`);
for (const [key, entry] of [...smallKinds].sort((a, b) => b[1].count - a[1].count).slice(0, 25)) console.log(`  ${entry.example}  (${entry.pages.size} pages, ${entry.count} checks)`);
if (renderFailures.length) console.log(`\nPAGES THAT DID NOT RENDER: ${renderFailures.join(', ')}`);
if (errors.length) console.log(`\nRUNTIME ERRORS: ${errors.slice(0, 8).join(' || ')}`);
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'matrix.json'), JSON.stringify({ results, renderFailures, errors }, null, 1)); }
console.log(JSON.stringify({ checks: results.length, sizes: sizes.length, broken: brokenRows.length, smallTargetControls: smallKinds.size, renderFailures: renderFailures.length, errors: errors.length }));
if (!process.env.MATRIX_REPORT_ONLY) {
  assert.deepEqual(renderFailures, [], 'every page renders at every size');
  assert.deepEqual(errors, [], 'no runtime errors');
  assert.deepEqual(brokenRows.slice(0, 10).map(row => `${row.device} ${row.size} ${row.route}: ${reasons(row)}`), [], 'no layout breaks at any size');
  if (!process.env.MATRIX_SKIP_TARGETS) assert.equal(smallKinds.size, 0, 'every control is at least 24 x 24 px');
}
