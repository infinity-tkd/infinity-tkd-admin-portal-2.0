import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gotoPortalRoute, launchBrowser, openPortal, PORTAL_ROUTES } from './lib/portal-harness.mjs';
import { AXE_PATH, axeAudit, inputAudit, keyboardAudit, textSpacingAudit } from './lib/a11y-audit.mjs';

// Accessibility audit (WCAG 2.2 AA): axe-core on every page in light and dark mode on a phone, an iPad and a
// desktop; keyboard reach and focus visibility; text spacing (1.4.12); mobile input attributes.
// Fictional fixtures only. Usage: node scripts/check-a11y-browser.mjs <baseUrl> [outDir]
// A11Y_REPORT_ONLY=1 prints everything without failing; A11Y_ROUTES=/dashboard,/students narrows the run;
// A11Y_FAIL_ON=critical,serious,moderate,minor picks the axe impacts that fail the run (default critical,serious).
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const outDir = process.argv[3] || '';
const routes = process.env.A11Y_ROUTES ? process.env.A11Y_ROUTES.split(',') : PORTAL_ROUTES;
const themes = (process.env.A11Y_THEMES || 'light,dark').split(',');
const failOn = (process.env.A11Y_FAIL_ON || 'critical,serious').split(',');
const devices = [
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true, touch: true },
  { name: 'tablet', viewport: { width: 834, height: 1194 }, touch: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
];
const axeRuns = [], keyboard = [], spacing = [], inputs = [], loadFailures = [], pageErrors = [];

const browser = await launchBrowser();
try {
  for (const device of devices) for (const theme of themes) {
    const { context } = await openPortal(browser, base, { theme, viewport: device.viewport, mobile: device.mobile, touch: device.touch });
    await context.addInitScript({ path: AXE_PATH });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(`${device.name} ${page.url()}: ${error.message}`.slice(0, 240)));
    for (const route of routes) {
      if (!(await gotoPortalRoute(page, base, route))) { loadFailures.push(`${device.name}/${theme} ${route}`); continue; }
      axeRuns.push({ device: device.name, theme, route, violations: await axeAudit(page) });
      if (theme === themes[0]) {
        keyboard.push({ device: device.name, route, ...(await keyboardAudit(page)) });
        spacing.push({ device: device.name, route, ...(await textSpacingAudit(page)) });
        inputs.push({ device: device.name, route, ...(await page.evaluate(inputAudit)) });
      }
    }
    await context.close();
  }
  // Pages outside the shell: the sign-in page and the 404 page.
  for (const device of [devices[0], devices[2]]) for (const theme of themes) {
    const { context } = await openPortal(browser, base, { theme, viewport: device.viewport, mobile: device.mobile, touch: device.touch, signedIn: false });
    await context.addInitScript({ path: AXE_PATH });
    const page = await context.newPage();
    await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 120000 });
    await page.locator('#login-identifier').waitFor({ timeout: 60000 });
    axeRuns.push({ device: device.name, theme, route: '/ (sign-in)', violations: await axeAudit(page) });
    inputs.push({ device: device.name, route: '/ (sign-in)', ...(await page.evaluate(inputAudit)) });
    await page.goto(base + '/this-page-does-not-exist', { waitUntil: 'networkidle', timeout: 120000 });
    await page.locator('h1').first().waitFor({ timeout: 30000 }).catch(() => {});
    axeRuns.push({ device: device.name, theme, route: '/404', violations: await axeAudit(page) });
    await context.close();
  }
} finally { await browser.close(); }

// ---------- summary ----------
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const byRule = new Map();
for (const run of axeRuns) for (const violation of run.violations) {
  const entry = byRule.get(violation.id) ?? { id: violation.id, impact: violation.impact, help: violation.help, nodes: 0, pages: new Set(), combos: new Set(), examples: new Map() };
  entry.nodes += violation.nodes.length; entry.pages.add(run.route); entry.combos.add(`${run.device}/${run.theme}`);
  for (const node of violation.nodes) if (entry.examples.size < 3 && !entry.examples.has(node.target)) entry.examples.set(node.target, node);
  byRule.set(violation.id, entry);
}
const rules = [...byRule.values()].sort((a, b) => order[a.impact] - order[b.impact] || b.nodes - a.nodes);
console.log(`\nAXE (WCAG 2.2 AA + best practice): ${axeRuns.length} page runs, ${rules.length} failing rules`);
for (const rule of rules) {
  console.log(`  [${rule.impact}] ${rule.id}: ${rule.nodes} nodes on ${rule.pages.size} pages (${[...rule.combos].join(', ')}) - ${rule.help}`);
  for (const node of rule.examples.values()) console.log(`      ${node.target}  ::  ${node.html}${node.why ? '  ::  ' + node.why : ''}`);
}
const summarize = (title, rows, pick) => {
  const flagged = rows.filter(row => pick(row).count);
  console.log(`\n${title}: ${flagged.length} of ${rows.length} page runs flagged`);
  for (const row of flagged.slice(0, 40)) console.log(`  ${row.device} ${row.route}: ${pick(row).text}`);
};
summarize('KEYBOARD (controls never reached by Tab)', keyboard, row => ({ count: row.unreachedCount, text: `${row.unreachedCount} of ${row.expected} unreached, e.g. ${row.unreached.slice(0, 3).join(' | ')}` }));
summarize('FOCUS VISIBILITY (no visible change when focused)', keyboard, row => ({ count: row.weakCount, text: `${row.weakCount} of ${row.tabbed}, e.g. ${row.weak.slice(0, 3).join(' | ')}` }));
console.log(`\nSKIP LINK: first Tab stop on each page is "${[...new Set(keyboard.map(row => row.firstStop))].join('" / "')}"`);
summarize('TEXT SPACING 1.4.12 (text newly cut off)', spacing, row => ({ count: row.newlyClippedCount + (row.overflowGrowth > 1 ? 1 : 0), text: `${row.newlyClippedCount} clipped, +${row.overflowGrowth}px sideways, e.g. ${row.newlyClipped.slice(0, 3).join(' | ')}` }));
summarize('INPUTS (keyboard type, font size, labels)', inputs, row => ({ count: row.problems.length, text: row.problems.slice(0, 4).map(problem => `${problem.field}: ${problem.found.join(', ')}`).join(' || ') }));
if (loadFailures.length) console.log(`\nPAGES THAT DID NOT RENDER: ${loadFailures.join(', ')}`);
if (pageErrors.length) console.log(`\nPAGE ERRORS: ${[...new Set(pageErrors)].slice(0, 6).join(' || ')}`);

if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'a11y.json'), JSON.stringify({ axeRuns, keyboard, spacing, inputs, loadFailures, pageErrors }, null, 1)); }
const gating = rules.filter(rule => failOn.includes(rule.impact));
console.log(JSON.stringify({ axeRuns: axeRuns.length, axeFailingRules: rules.length, axeGatingRules: gating.length, keyboardUnreached: keyboard.reduce((sum, row) => sum + row.unreachedCount, 0), weakFocus: keyboard.reduce((sum, row) => sum + row.weakCount, 0), spacingClipped: spacing.reduce((sum, row) => sum + row.newlyClippedCount, 0), inputProblems: inputs.reduce((sum, row) => sum + row.problems.length, 0), loadFailures: loadFailures.length, pageErrors: pageErrors.length }));
if (!process.env.A11Y_REPORT_ONLY) {
  assert.deepEqual(loadFailures, [], 'every page renders');
  assert.deepEqual(gating.map(rule => `${rule.id} (${rule.nodes})`), [], `no axe violations of impact ${failOn.join('/')}`);
  assert.equal(keyboard.reduce((sum, row) => sum + row.unreachedCount, 0), 0, 'every control is reachable with the keyboard');
  assert.equal(keyboard.reduce((sum, row) => sum + row.weakCount, 0), 0, 'every control shows a visible focus indicator');
}
