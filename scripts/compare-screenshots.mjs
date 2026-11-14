import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './lib/portal-harness.mjs';

// Visual regression: compares two folders of PNG screenshots of the same pages (for example the output of
// check-device-matrix-browser with MATRIX_SHOTS=<dir>, before and after a change) and reports what moved.
// The PNGs are decoded in headless Chromium, so no extra dependency is needed. A pixel counts as changed when any
// colour channel differs by more than 12/255; changed pixels are drawn red on a faded copy in the diff folder.
// Usage: node scripts/compare-screenshots.mjs <beforeDir> <afterDir> [diffDir] [maxChangedPercent=2]
const [beforeDir, afterDir, diffDir, limitArg] = process.argv.slice(2);
if (!beforeDir || !afterDir) { console.error('Usage: node scripts/compare-screenshots.mjs <beforeDir> <afterDir> [diffDir] [maxChangedPercent]'); process.exit(2); }
const limit = Number(limitArg || 2);
const list = dir => fs.readdirSync(dir, { recursive: true }).map(file => String(file).replace(/\\/g, '/')).filter(file => file.endsWith('.png')).sort();
const before = new Set(list(beforeDir)), after = new Set(list(afterDir));
const both = [...before].filter(file => after.has(file));

const browser = await launchBrowser();
const page = await browser.newPage();
await page.setContent('<!doctype html><title>diff</title>');
const rows = [];
try {
  for (const file of both) {
    const result = await page.evaluate(async ({ a, b, wantDiff }) => {
      const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('decode')); image.src = 'data:image/png;base64,' + source; });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return { resized: `${x.width}x${x.height} -> ${y.width}x${y.height}` };
      const read = image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height); };
      const one = read(x), two = read(y), out = new ImageData(x.width, x.height);
      let changed = 0, minY = x.height, maxY = 0;
      for (let i = 0; i < one.data.length; i += 4) {
        const delta = Math.max(Math.abs(one.data[i] - two.data[i]), Math.abs(one.data[i + 1] - two.data[i + 1]), Math.abs(one.data[i + 2] - two.data[i + 2]));
        if (delta > 12) { changed++; const row = Math.floor(i / 4 / x.width); minY = Math.min(minY, row); maxY = Math.max(maxY, row); out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255; }
        else { out.data[i] = two.data[i]; out.data[i + 1] = two.data[i + 1]; out.data[i + 2] = two.data[i + 2]; out.data[i + 3] = 70; }
      }
      let diff = null;
      if (wantDiff && changed) { const canvas = document.createElement('canvas'); canvas.width = x.width; canvas.height = x.height; canvas.getContext('2d').putImageData(out, 0, 0); diff = canvas.toDataURL('image/png').split(',')[1]; }
      return { percent: Math.round((changed / (one.data.length / 4)) * 10000) / 100, changed, band: changed ? [minY, maxY] : null, diff };
    }, { a: fs.readFileSync(path.join(beforeDir, file)).toString('base64'), b: fs.readFileSync(path.join(afterDir, file)).toString('base64'), wantDiff: Boolean(diffDir) });
    rows.push({ file, ...result });
    if (result.diff) { const target = path.join(diffDir, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, Buffer.from(result.diff, 'base64')); }
  }
} finally { await browser.close(); }

const identical = rows.filter(row => !row.resized && row.changed === 0);
const small = rows.filter(row => !row.resized && row.changed > 0 && row.percent <= limit);
const large = rows.filter(row => !row.resized && row.percent > limit);
const resized = rows.filter(row => row.resized);
console.log(`SCREENSHOT COMPARISON: ${both.length} pairs (${[...before].length - both.length} only in before, ${[...after].length - both.length} only in after)`);
console.log(`  identical ${identical.length}, changed up to ${limit}% ${small.length}, changed over ${limit}% ${large.length}, different size ${resized.length}`);
for (const row of large.sort((a, b) => b.percent - a.percent).slice(0, 40)) console.log(`  ${String(row.percent).padStart(6)}%  rows ${row.band[0]}..${row.band[1]}  ${row.file}`);
for (const row of resized.slice(0, 15)) console.log(`  size changed ${row.resized}  ${row.file}`);
console.log(JSON.stringify({ pairs: both.length, identical: identical.length, changedSmall: small.length, changedLarge: large.length, resized: resized.length }));
