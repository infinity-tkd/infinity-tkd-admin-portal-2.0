import fs from 'node:fs';
import path from 'node:path';
import { gotoPortalRoute, launchBrowser, openPortal, PORTAL_ROUTES } from './lib/portal-harness.mjs';

// Design-consistency census: how many distinct font sizes, weights, families, corner radii, shadows and gradients the
// rendered pages actually use, and how often. Report only (no pass/fail): it puts numbers on "consistent typography,
// radius and elevation" so a design decision can be made with the data. Fictional fixtures only.
// Usage: node scripts/audit-design-census.mjs <baseUrl> [outFile]
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outFile = process.argv[3] || '';

const census = () => {
  const maps = { sizes: new Map(), weights: new Map(), fonts: new Map(), radii: new Map(), shadows: new Map(), gradients: new Map(), textElements: new Map() };
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const element of document.querySelectorAll('body *')) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden') continue;
    if ([...element.childNodes].some(node => node.nodeType === 3 && /\S/.test(node.textContent))) {
      bump(maps.textElements, 'all'); bump(maps.sizes, Math.round(parseFloat(style.fontSize) * 10) / 10 + 'px'); bump(maps.weights, style.fontWeight);
      bump(maps.fonts, style.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    }
    const surface = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(style.borderTopWidth) > 0;
    if (surface && style.borderTopLeftRadius !== '0px') bump(maps.radii, style.borderTopLeftRadius);
    if (style.boxShadow !== 'none' && !/^rgba?\(0, 0, 0, 0\)/.test(style.boxShadow)) bump(maps.shadows, style.boxShadow.replace(/rgba?\([^)]*\)/g, 'c').slice(0, 50));
    if (style.backgroundImage.includes('gradient')) bump(maps.gradients, style.backgroundImage.replace(/rgba?\([^)]*\)/g, 'c').replace(/oklab\([^)]*\)|oklch\([^)]*\)/g, 'c').slice(0, 70));
  }
  return Object.fromEntries(Object.entries(maps).map(([name, map]) => [name, Object.fromEntries(map)]));
};

const total = { sizes: {}, weights: {}, fonts: {}, radii: {}, shadows: {}, gradients: {}, textElements: {} };
const perPage = [];
const browser = await launchBrowser();
try {
  for (const device of [{ name: 'phone', viewport: { width: 390, height: 844 }, mobile: true, touch: true }, { name: 'desktop', viewport: { width: 1440, height: 900 } }]) {
    const { context } = await openPortal(browser, base, { viewport: device.viewport, mobile: device.mobile, touch: device.touch });
    const page = await context.newPage();
    for (const route of PORTAL_ROUTES) {
      if (!(await gotoPortalRoute(page, base, route))) continue;
      const data = await page.evaluate(census);
      for (const [name, map] of Object.entries(data)) for (const [key, count] of Object.entries(map)) total[name][key] = (total[name][key] ?? 0) + count;
      perPage.push({ device: device.name, route, gradients: Object.values(data.gradients).reduce((sum, count) => sum + count, 0), small: Object.entries(data.sizes).filter(([size]) => parseFloat(size) < 11).reduce((sum, [, count]) => sum + count, 0), text: data.textElements.all ?? 0 });
    }
    await context.close();
  }
} finally { await browser.close(); }

const sum = map => Object.values(map).reduce((a, b) => a + b, 0);
const top = (map, limit = 12, order = (a, b) => b[1] - a[1]) => Object.entries(map).sort(order).slice(0, limit);
const percent = (count, whole) => (Math.round((count / whole) * 1000) / 10).toFixed(1) + '%';
const texts = total.textElements.all;
console.log(`DESIGN CENSUS (${perPage.length} page renders, ${texts} text elements)`);
console.log('\nFONT SIZES (distinct: ' + Object.keys(total.sizes).length + ')');
for (const [size, count] of top(total.sizes, 40, (a, b) => parseFloat(a[0]) - parseFloat(b[0]))) console.log(`  ${size.padStart(7)}  ${String(count).padStart(6)}  ${percent(count, texts)}`);
const under = limit => Object.entries(total.sizes).filter(([size]) => parseFloat(size) < limit).reduce((n, [, count]) => n + count, 0);
console.log(`  text under 10px: ${percent(under(10), texts)}   under 11px: ${percent(under(11), texts)}   under 12px: ${percent(under(12), texts)}`);
console.log('\nFONT WEIGHTS: ' + top(total.weights).map(([weight, count]) => `${weight}:${percent(count, texts)}`).join('  '));
console.log('FONT FAMILIES: ' + top(total.fonts).map(([font, count]) => `${font}:${percent(count, texts)}`).join('  '));
console.log('\nCORNER RADII (distinct: ' + Object.keys(total.radii).length + ')'); for (const [radius, count] of top(total.radii, 14)) console.log(`  ${radius.padEnd(12)} ${String(count).padStart(6)}  ${percent(count, sum(total.radii))}`);
console.log('\nSHADOWS (distinct: ' + Object.keys(total.shadows).length + ')'); for (const [shadow, count] of top(total.shadows, 8)) console.log(`  ${String(count).padStart(6)}  ${shadow}`);
console.log(`\nGRADIENT BACKGROUNDS: ${sum(total.gradients)} elements, ${Object.keys(total.gradients).length} distinct`); for (const [gradient, count] of top(total.gradients, 8)) console.log(`  ${String(count).padStart(6)}  ${gradient}`);
console.log('\nSMALL TEXT BY PAGE (elements under 11px / all text elements), desktop:'); for (const row of perPage.filter(entry => entry.device === 'desktop')) console.log(`  ${row.route.padEnd(13)} ${String(row.small).padStart(4)} / ${String(row.text).padStart(4)}  ${percent(row.small, row.text)}   gradients ${row.gradients}`);
if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify({ total, perPage }, null, 1)); }
