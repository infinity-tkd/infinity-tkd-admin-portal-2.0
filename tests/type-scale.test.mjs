import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './load-ts.mjs';

// The smallest text in the portal is one design token (text-micro, --text-micro in app/globals.css) instead of a scatter of
// 9, 9.5, 10 and 11px arbitrary sizes. These tests keep it that way and keep the class-merging helper from dropping it.
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.tsx$/.test(entry.name) ? [full] : [];
});
// Print layouts (receipts, packing slips, the dossier sheet) are sized for paper; the phone tab bar fits 320px screens.
const PAPER_AND_TAB_BAR = new Set(['components/StudentDossierModal.tsx', 'components/2d/Biomechanical2DScanner.tsx', 'components/pos/PackingSlipDialog.tsx', 'components/pos/SaleReceiptDialog.tsx', 'components/finance/TuitionReceiptDialogs.tsx', 'components/PortalLayout.tsx']);

test('the smallest text size is a single token, not scattered arbitrary sizes', () => {
  const css = fs.readFileSync('app/globals.css', 'utf8');
  assert.match(css, /--text-micro:\s*0\.6875rem/, 'globals.css defines --text-micro as 11px');
  const offenders = [];
  for (const file of [...walk('components'), ...walk('app')]) {
    if (PAPER_AND_TAB_BAR.has(file.replace(/\\/g, '/'))) continue;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(match[1]) < 12) offenders.push(`${file.replace(/\\/g, '/')}:${index + 1} ${match[0]}`);
    });
  }
  assert.deepEqual(offenders, [], `use text-micro (or text-xs and up) instead of arbitrary sizes under 12px:\n  ${offenders.slice(0, 20).join('\n  ')}`);
});

test('stylesheets do not set text below the floor either', () => {
  const sheets = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sheets(full) : /\.css$/.test(entry.name) ? [full] : [];
  });
  const offenders = [];
  for (const file of [...sheets('components'), ...sheets('app')]) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem)\b/g)) {
        const pixels = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
        if (pixels < 10.99) offenders.push(`${file.replace(/\\/g, '/')}:${index + 1} ${match[0]}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `use var(--text-micro) instead:\n  ${offenders.join('\n  ')}`);
});

test('class merging keeps text-micro next to a text colour', () => {
  const stubs = Object.fromEntries(['./google-drive-media', './lesson-media', './library-publication', './physical-grades', './dates', './attendance-index'].map(name => [name, {}]));
  const { cn } = loadTs('lib/utils.ts', stubs);
  assert.equal(cn('text-micro font-bold', 'text-neutral-500'), 'text-micro font-bold text-neutral-500');
  assert.equal(cn('text-micro text-red-500', 'text-blue-500'), 'text-micro text-blue-500');
  assert.equal(cn('text-xs', 'text-micro'), 'text-micro');
  assert.equal(cn('text-micro', 'text-xs'), 'text-xs');
});
