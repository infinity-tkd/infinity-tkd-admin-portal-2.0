// WCAG 2.1 text contrast, measured on the rendered page. Runs inside the browser via
// page.evaluate(contrastAudit): every visible text element is compared with the colour actually
// behind it (ancestor backgrounds composited, including translucent ones). Colours are converted
// through a canvas, so oklch()/color-mix() values from Tailwind 4 are handled.
// Thresholds: 4.5:1, or 3:1 for large text (24px+, or 18.66px+ bold). Disabled controls are exempt.
export function contrastAudit() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  const luminance = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const page = rgba(getComputedStyle(document.body).backgroundColor)[3] > 0 ? rgba(getComputedStyle(document.body).backgroundColor) : [255, 255, 255, 1];
  // Background behind an element: composite translucent ancestor backgrounds; give up on images/gradients.
  const backdrop = element => {
    const layers = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none') return null;
      const colour = rgba(style.backgroundColor);
      if (colour[3] > 0) { layers.push(colour); if (colour[3] >= 1) break; }
    }
    let result = page;
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  };
  const findings = new Map();
  let checked = 0;
  for (const element of document.querySelectorAll('body *')) {
    if (!/\S/.test([...element.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''))) continue;
    const box = element.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0 || element.closest('[aria-hidden="true"],[inert],:disabled,[aria-disabled="true"],.sr-only')) continue;
    let faded = 1; for (let node = element; node; node = node.parentElement) faded *= Number(getComputedStyle(node).opacity);
    if (faded < 0.99) continue; // fading in or deliberately dimmed (disabled look): not measured
    const behind = backdrop(element); if (!behind) continue;
    const ink = over(rgba(style.color), behind);
    const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const value = ratio(ink, behind); checked++;
    if (value + 0.005 < (large ? 3 : 4.5)) {
      const key = `${hex(ink)} on ${hex(behind)}`;
      const entry = findings.get(key) ?? { colours: key, ratio: Math.round(value * 100) / 100, count: 0, examples: [] };
      entry.count++;
      if (entry.examples.length < 3) entry.examples.push(`${element.tagName.toLowerCase()}.${String(element.className || '').split(/\s+/).filter(c => /text-|bg-/.test(c)).slice(0, 4).join('.')} "${element.textContent.trim().slice(0, 30)}"`);
      findings.set(key, entry);
    }
  }
  return { checked, failing: [...findings.values()].sort((a, b) => a.ratio - b.ratio) };
}
