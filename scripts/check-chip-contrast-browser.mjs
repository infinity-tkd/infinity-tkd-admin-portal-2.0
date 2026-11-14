import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { contrastAudit } from './lib/contrast-audit.mjs';
import { gotoPortalRoute, launchBrowser, openPortal } from './lib/portal-harness.mjs';

// Status chips and badges pair a text colour with a tint of the same hue (text-amber-600 on bg-amber-500/10, ...).
// Fixture data only ever renders a few of them, so the page-level contrast audits cannot see the others.
// This reads every colour class combination the components use, renders each one as written on every surface it can
// sit on (cards, inset panels, controls), in light and dark, and measures the real contrast with the colours the
// stylesheet produces (oklch, translucent tints and the light-mode overrides included). 4.5:1 for text, 3:1 for large text.
// Usage: node scripts/check-chip-contrast-browser.mjs <baseUrl>     CHIP_REPORT_ONLY=1 prints without failing.
const base = (process.argv[2] || 'http://127.0.0.1:3005').replace(/\/$/, '');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.tsx$/.test(entry.name) ? [full] : [];
});

// Keep only the tokens that decide colour and size: layout classes (fixed, absolute, ...) would pull a probe out of its box,
// and hover/focus/responsive variants are not the resting state.
const KEEP = /^(dark:)?(bg|text|border)-|^font-(bold|black|semibold|medium|mono)$|^uppercase$/;
const strings = new Set();
for (const file of [...walk('components'), ...walk('app')]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(["'`])((?:(?!\1)[^\n\\])*?)\1/g)) {
    const value = match[2];
    if (value.includes('${') || !/\bbg-/.test(value) || !/\btext-[a-z]+-\d{2,3}\b/.test(value)) continue;
    const tokens = value.split(/\s+/).filter(token => KEEP.test(token) && !/^(dark:)?(bg|text|border)-(left|right|center|justify|wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(token));
    if (tokens.some(token => /^(bg|dark:bg)-/.test(token)) && tokens.some(token => /^(dark:)?text-[a-z]+-\d{2,3}/.test(token))) strings.add(tokens.join(' '));
  }
}
// Only the status-chip pattern is judged: text of one hue on a translucent tint of the same hue (neutral included). Other pairings are written for a
// specific backdrop the script cannot know (a photo overlay, a coloured button, a dark panel), so measuring them on a card would only report noise.
const hueOf = (tokens, prefix) => { const match = tokens.map(token => new RegExp('^' + prefix + '-([a-z]+)-(\\d{2,3})(?:/\\d+)?$').exec(token)).find(Boolean); return match ? { hue: match[1], shade: Number(match[2]) } : null; };
// A chip that declares dark: colours is theme-aware, so both of its looks are judged; one without them is written for a fixed backdrop.
const isStatusChip = value => {
  const tokens = value.split(' ').filter(token => !token.startsWith('dark:'));
  const tint = tokens.find(token => /^bg-[a-z]+-\d{2,3}\/\d+$/.test(token));
  const bg = hueOf(tokens, 'bg'), text = hueOf(tokens, 'text');
  return Boolean(tint && bg && text && bg.hue === text.hue && bg.shade <= 600 && text.shade >= 500 && value.split(' ').some(token => token.startsWith('dark:text-')));
};
const chips = [...strings].filter(isStatusChip).sort();
const darkChips = chips;

const SURFACES = {
  light: [['card', '#ffffff'], ['inset', '#fafafa'], ['control', '#f5f5f5']],
  dark: [['page', '#0a0a0a'], ['inset', '#0f0f0f'], ['card', '#141414'], ['control', '#1c1c1c']],
};
const isTint = value => value.split(' ').some(token => /^(dark:)?bg-[a-z]+-\d{2,3}\/\d+$/.test(token) || /^(dark:)?bg-\[#[0-9a-f]{3,8}\]\/\d+$/i.test(token) || /^(dark:)?bg-[a-z]+-\d{2,3}\/\[/.test(token));

const probe = ({ list, surfaces }) => {
  document.body.replaceChildren();
  const root = document.createElement('div'); root.id = 'chip-probe'; document.body.append(root);
  for (const [surface, colour] of surfaces) {
    const panel = document.createElement('div'); panel.style.cssText = `background:${colour};padding:8px;display:flex;flex-wrap:wrap;gap:6px`;
    for (const classes of list) {
      const chip = document.createElement('span'); chip.className = classes; chip.textContent = 'Sample'; chip.dataset.chip = `${surface} ${colour} | ${classes}`;
      panel.append(chip);
    }
    root.append(panel);
  }
  return true;
};

const browser = await launchBrowser();
const failures = [];
let measured = 0;
try {
  for (const theme of ['light', 'dark']) {
    const { context } = await openPortal(browser, base, { theme });
    const page = await context.newPage();
    assert.ok(await gotoPortalRoute(page, base, '/dashboard'), 'the page behind the probe renders');
    // Light: every status chip. Dark: only chips that carry their own dark: colours (the rest are written for light surfaces).
    const pool = theme === 'dark' ? darkChips : chips;
    const tints = pool.filter(isTint), solids = pool.filter(value => !isTint(value));
    // Tinted chips take their backdrop from the surface, so they are measured on each surface; solid chips on one.
    const surfaces = SURFACES[theme];
    for (const [list, where] of [[tints, surfaces], [solids, surfaces.slice(0, 1)]]) {
      if (!list.length) continue;
      await page.evaluate(probe, { list, surfaces: where.map(([name, colour]) => [name, colour]) });
      const result = await page.evaluate(contrastAudit, '#chip-probe');
      measured += result.checked;
      for (const finding of result.failing) failures.push({ theme, ...finding });
    }
    await context.close();
  }
} finally { await browser.close(); }

console.log(`CHIP CONTRAST: ${chips.length} status-chip colour combinations in the source (${darkChips.length} with dark colours), ${measured} measurements (light + dark)`);
const byPair = new Map();
for (const finding of failures) {
  const key = `${finding.theme}  ${finding.colours}`;
  const entry = byPair.get(key) ?? { ...finding, count: 0, examples: new Set() };
  entry.count += finding.count; finding.examples.forEach(example => entry.examples.add(example));
  byPair.set(key, entry);
}
const rows = [...byPair.values()].sort((a, b) => a.ratio - b.ratio);
console.log(`\nBELOW AA: ${rows.length} colour pairs`);
for (const row of rows.slice(0, 60)) console.log(`  ${String(row.ratio).padStart(5)}:1  ${row.theme.padEnd(5)} ${row.colours}  x${row.count}\n          ${[...row.examples].slice(0, 2).join('\n          ')}`);
console.log(JSON.stringify({ combinations: chips.length, measurements: measured, failingPairs: rows.length }));
if (!process.env.CHIP_REPORT_ONLY) assert.deepEqual(rows.map(row => `${row.theme} ${row.colours} ${row.ratio}`), [], 'every chip colour combination reaches WCAG AA');
