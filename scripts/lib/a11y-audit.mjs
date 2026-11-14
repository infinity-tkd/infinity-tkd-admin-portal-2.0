import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Accessibility audits for a page already open in Playwright: axe-core (WCAG 2.2 AA + best practice),
// keyboard reach and focus visibility, text spacing (WCAG 1.4.12) and mobile input attributes.
const require = createRequire(import.meta.url);
/** axe-core ships with the project's dev tooling; add it to a context with context.addInitScript({ path: AXE_PATH }). */
export const AXE_PATH = path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js');
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe-core on the open page (or one region of it) and returns its violations. */
export async function axeAudit(page, { include = null, tags = AXE_TAGS } = {}) {
  // Evaluating the source bypasses the page's Content-Security-Policy (an injected <script> would be blocked).
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(fs.readFileSync(AXE_PATH, 'utf8'));
  return page.evaluate(async ({ include, tags }) => {
    const result = await window.axe.run(include ? { include: [include] } : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return result.violations.map(violation => ({
      id: violation.id, impact: violation.impact, help: violation.help,
      nodes: violation.nodes.map(node => ({
        target: node.target.join(' > ').slice(0, 180), html: node.html.replace(/\s+/g, ' ').slice(0, 170),
        why: [...node.any, ...node.all, ...node.none].map(check => check.message).slice(0, 2).join(' | ').slice(0, 220),
      })),
    }));
  }, { include, tags });
}

// Controls the Tab key should reach. A roving tabindex (tabindex="-1" on the inactive tabs of a tablist, moved with the
// arrow keys) is the correct pattern, so those are not expected to be tabbed to. Safari and WebKit skip links when Tab is pressed unless the
// person turns on "Press Tab to highlight each item on a webpage" (Option+Tab reaches them), so a WebKit run judges every other control.
const FOCUSABLE = ['a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type=hidden])', 'select:not([disabled])', 'textarea:not([disabled])', 'summary', '[tabindex]', '[role=button]', '[role=tab]', '[role=switch]', '[role=checkbox]'].filter(selector => !(process.env.PORTAL_BROWSER === 'webkit' && selector === 'a[href]')).map(selector => selector + ':not([tabindex="-1"])').join(',');

/**
 * Tabs through the page: how many controls the keyboard reaches, which are never reached, and which show
 * no visible change when focused (no outline, ring, border, background or colour difference).
 */
export async function keyboardAudit(page, { max = 300 } = {}) {
  // The controls that can take focus when the walk starts. A control that only becomes enabled during the walk (the shop's catalog
  // refresh button while its list loads) is not expected to be reached, so it is marked here and judged only if it was marked.
  const expected = await page.evaluate(selector => [...document.querySelectorAll(selector)].filter(element => {
    const box = element.getBoundingClientRect();
    const focusable = box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[aria-hidden="true"],[hidden]') && !element.closest('details:not([open]) > :not(summary)');
    if (focusable) element.dataset.kbdStart = '1';
    return focusable;
  }).length, FOCUSABLE);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); document.querySelector('[data-portal-scroll]')?.scrollTo(0, 0); });
  const sequence = [];
  const seen = new Set();
  for (let step = 0; step < Math.min(max, expected + 20); step++) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body || element === document.documentElement) return null;
      if (!element.dataset.kbd) element.dataset.kbd = String(Math.random()).slice(2, 10);
      const read = node => { const style = getComputedStyle(node); return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderTopColor, style.backgroundColor, style.color, style.textDecorationLine].join('|'); };
      return {
        id: element.dataset.kbd, own: read(element), parent: element.parentElement ? read(element.parentElement) : '',
        tag: element.tagName.toLowerCase(), text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || element.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 36),
        classes: String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
      };
    });
    if (!state) continue;
    if (seen.has(state.id)) break; // focus came back round to the start
    seen.add(state.id);
    sequence.push(state);
  }
  const outcome = await page.evaluate(({ signatures, selector }) => {
    document.activeElement?.blur?.();
    const read = node => { const style = getComputedStyle(node); return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderTopColor, style.backgroundColor, style.color, style.textDecorationLine].join('|'); };
    const weak = [];
    for (const [id, own, parent] of signatures) {
      const element = document.querySelector(`[data-kbd="${id}"]`);
      if (!element) continue;
      // Focus can be shown on the control itself or on its wrapper (an input's ring).
      if (read(element) === own && (!element.parentElement || read(element.parentElement) === parent)) {
        weak.push(`${element.tagName.toLowerCase()}.${String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')} "${(element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
      }
    }
    const unreached = [...document.querySelectorAll(selector)].filter(element => {
      const box = element.getBoundingClientRect();
      return element.dataset.kbdStart === '1' && !element.dataset.kbd && box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[aria-hidden="true"],[hidden]') && !element.closest('details:not([open]) > :not(summary)');
    }).map(element => `${element.tagName.toLowerCase()}.${String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')} "${(element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
    document.querySelectorAll('[data-kbd],[data-kbd-start]').forEach(element => { element.removeAttribute('data-kbd'); element.removeAttribute('data-kbd-start'); });
    return { weak, unreached };
  }, { signatures: sequence.map(state => [state.id, state.own, state.parent]), selector: FOCUSABLE });
  return { expected, tabbed: sequence.length, unreached: outcome.unreached.slice(0, 8), unreachedCount: outcome.unreached.length, weak: outcome.weak.slice(0, 8), weakCount: outcome.weak.length, firstStop: sequence[0]?.text ?? '' };
}

/**
 * WCAG 1.4.12: with line height 1.5, letter spacing 0.12em, word spacing 0.16em and paragraph spacing 2em
 * applied, text must not be cut off or the page grow sideways. Reports only what the spacing newly breaks.
 */
export async function textSpacingAudit(page) {
  const measure = () => page.evaluate(() => {
    const label = element => `${element.tagName.toLowerCase()}.${String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')} "${(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28)}"`;
    const clipped = [];
    for (const element of document.querySelectorAll('body *')) {
      if (![...element.childNodes].some(node => node.nodeType === 3 && /\S/.test(node.textContent))) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden') continue;
      const clipY = /hidden|clip/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      const clipX = /hidden|clip/.test(style.overflowX) && style.textOverflow !== 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
      if (clipY || clipX) clipped.push(label(element));
    }
    return { clipped, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const before = await measure();
  // A constructed stylesheet is not blocked by the page's Content-Security-Policy, unlike an injected <style>.
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}');
    window.__spacingSheet = sheet;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
  await page.waitForTimeout(120);
  const after = await measure();
  await page.evaluate(() => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== window.__spacingSheet); });
  const known = new Set(before.clipped);
  return { newlyClipped: [...new Set(after.clipped.filter(label => !known.has(label)))].slice(0, 8), newlyClippedCount: new Set(after.clipped.filter(label => !known.has(label))).size, overflowGrowth: Math.max(0, after.overflow - Math.max(0, before.overflow)) };
}

/**
 * Mobile keyboards, autofill and labels, evaluated in the page: input types, font size (iOS zooms the page when a field
 * under 16px is focused; the portal's iOS-only rule forces 16px, so it is only checked where that rule can apply),
 * password autocomplete, names, and visible labels that are not linked to any control.
 */
export function inputAudit(rootSelector = '') {
  const problems = [];
  let inspected = 0;
  const root = (rootSelector && document.querySelector(rootSelector)) || document;
  const iosRule = CSS.supports('-webkit-touch-callout', 'none') && matchMedia('(pointer: coarse)').matches;
  for (const element of root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]), textarea, select')) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || element.disabled || element.closest('[inert],[aria-hidden="true"]')) continue;
    inspected++;
    const style = getComputedStyle(element);
    const label = (element.labels?.[0]?.textContent || element.getAttribute('aria-label') || element.placeholder || element.name || element.id || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const hint = `${label} ${element.name} ${element.id} ${element.placeholder}`.toLowerCase();
    const type = element.type, mode = element.getAttribute('inputmode') || '', autocomplete = element.getAttribute('autocomplete') || '';
    const searchLike = type === 'search' || /search|filter/.test(hint);
    const found = [];
    if (iosRule && parseFloat(style.fontSize) < 16) found.push('font-size ' + style.fontSize + ' (iOS zooms the page on focus)');
    // (a textarea has no type: one that mentions phones or e-mails, such as a paste-in CSV box, is free text)
    const singleLine = element.tagName === 'INPUT';
    if (singleLine && !searchLike && /phone|\btel\b|mobile|whatsapp/.test(hint) && type !== 'tel' && mode !== 'tel') found.push('phone field is not type=tel');
    if (singleLine && !searchLike && /e-?mail/.test(hint) && type !== 'email' && mode !== 'email') found.push('email field is not type=email');
    if (type === 'password' && !/(current|new)-password/.test(autocomplete)) found.push('password field without autocomplete');
    // A placeholder is not a label, but axe accepts it; selects have no placeholder to fall back on.
    if (!element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !element.title && (element.tagName === 'SELECT' || !element.placeholder)) found.push('no accessible name');
    if (found.length) problems.push({ field: `${element.tagName.toLowerCase()}[${type}] "${label}"`, found });
  }
  // A visible <label> that is neither wrapped around a control nor pointing at one (for/id) names nothing.
  for (const label of root.querySelectorAll('label')) {
    const box = label.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || label.control || !label.textContent.trim() || label.closest('[inert],[aria-hidden="true"]')) continue;
    problems.push({ field: `label "${label.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)}"`, found: ['label is not linked to a control (add htmlFor/id, or use a heading, span or aria-labelledby)'] });
  }
  return { inspected, problems };
}
