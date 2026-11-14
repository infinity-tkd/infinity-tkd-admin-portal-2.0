// Layout checks evaluated inside the page (pass the function to page.evaluate).
// Horizontal overflow, cut-off labels, words broken mid-way, controls below the WCAG 2.2 minimum target size,
// and content hidden behind the phone/tablet bottom bar. layoutAudit({ onlyWords: true }) runs just the
// mid-word check (it never scrolls the page, so a crawl can call it after every click).
export function layoutAudit(options = {}) {
  const viewport = document.documentElement.clientWidth;
  const scroller = document.querySelector('[data-portal-scroll]');
  const describe = element => (element.tagName.toLowerCase() + '.' + String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.')).slice(0, 110);
  const shown = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
  // A short label whose longest word is wider than its box is broken in the middle ("OPERATION / S") when the box allows overflow-wrap: it must
  // fit whole, or wrap at a space. Measured with the element's own font, size, case and letter spacing. Dialogs are included.
  const measurer = document.createElement('canvas').getContext('2d');
  const splitWords = [];
  for (const element of document.querySelectorAll('[data-portal-scroll] *, [data-portal-navigation] *, [role=dialog] *, [role=alertdialog] *')) {
    if (splitWords.length >= 6) break;
    const style = getComputedStyle(element);
    if (!/(break-word|anywhere)/.test(style.overflowWrap) && style.wordBreak !== 'break-all') continue;
    const own = [...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!own || own.length > 40 || style.display === 'inline' || !shown(element) || element.closest('[inert],[aria-hidden="true"],.sr-only')) continue;
    const room = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    measurer.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    for (const word of own.split(' ')) {
      // Khmer and Chinese have no spaces between words; the browser breaks them at word boundaries of its own, so only Latin words are judged.
      if (/[^\u0000-ɏ -⁯]/.test(word)) continue;
      const text = style.textTransform === 'uppercase' ? word.toUpperCase() : word;
      const width = measurer.measureText(text).width + spacing * text.length;
      if (room > 0 && width > room + 0.5) { splitWords.push(`${describe(element)} "${word}" needs ${Math.round(width)}px in ${Math.round(room)}px`); break; }
    }
  }
  if (options.onlyWords) return { splitWords };
  // Content inside its own horizontal scroller (tables, chip rails) is allowed to be wider than the page.
  const clipped = element => { for (let node = element.parentElement; node && node !== scroller && node !== document.body; node = node.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowX)) return true; return false; };
  const offenders = [];
  for (const element of document.querySelectorAll('[data-portal-scroll] *')) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || box.right <= viewport + 1 || clipped(element)) continue;
    offenders.push(describe(element) + ' right=' + Math.round(box.right));
    if (offenders.length >= 4) break;
  }
  const small = [...document.querySelectorAll('[data-portal-scroll] :is(button,a[href],select,input:not([type=hidden]),[role=button])')].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.height < 32 || box.width < 32) && getComputedStyle(element).visibility !== 'hidden'; }).length;
  // WCAG 2.2 SC 2.5.8: pointer targets of at least 24 x 24 CSS px (inline text links and labelled checkboxes are exempt).
  const targets = [...document.querySelectorAll('[data-portal-scroll] :is(a[href],button,select,input:not([type=hidden]),[role=button],[role=tab],summary), [data-portal-navigation] :is(a[href],button)')]
    .filter(element => shown(element) && !element.disabled && !element.closest('[inert],[aria-hidden="true"]') && !(element.matches('input[type=checkbox],input[type=radio]') && element.labels?.length) && !(element.tagName === 'A' && getComputedStyle(element).display === 'inline'));
  const under = limit => targets.filter(element => { const box = element.getBoundingClientRect(); return box.width < limit || box.height < limit; });
  const tooSmall24 = under(24).slice(0, 6).map(element => { const box = element.getBoundingClientRect(); return `${describe(element)} ${Math.round(box.width)}x${Math.round(box.height)} "${(element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 24)}"`; });
  const touchSmall = under(44).length;
  const cutKpis = viewport >= 768 ? [...document.querySelectorAll('[data-kpi-card] .truncate')].filter(element => element.getBoundingClientRect().width > 0 && element.scrollWidth > element.clientWidth + 1).map(element => element.textContent.trim().slice(0, 40)) : [];
  const cutTabs = [...document.querySelectorAll('[data-portal-bottom-nav] span')].filter(element => element.getBoundingClientRect().width > 0 && element.scrollWidth > element.clientWidth + 1).map(element => element.textContent.trim());
  // Short labels (tabs, buttons, headings, column heads) must not be ellipsised; long names and descriptions may be.
  const cutLabels = [...document.querySelectorAll('[data-portal-scroll] *, [data-portal-navigation] *')].filter(element => {
    if (element.scrollWidth <= element.clientWidth + 1 || element.clientWidth === 0) return false;
    const text = (element.textContent || '').trim();
    return text.length > 0 && text.length <= 28 && getComputedStyle(element).textOverflow === 'ellipsis';
  }).slice(0, 6).map(element => `${describe(element)} "${element.textContent.trim()}"`);
  // Phone and tablet bottom bar: after scrolling to the end, the last content sits above it.
  const bottomBar = document.querySelector('[data-portal-bottom-nav]');
  const navMode = bottomBar && getComputedStyle(bottomBar).display !== 'none' ? 'bottom-bar' : 'sidebar';
  let obscured = 0, obscuredBy = '';
  if (scroller && navMode === 'bottom-bar' && bottomBar.dataset.visible !== 'false') {
    const previous = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    const barTop = bottomBar.getBoundingClientRect().top;
    let lowest = 0, lowestElement = null;
    for (const element of scroller.querySelectorAll('*')) {
      const box = element.getBoundingClientRect();
      // The contents of a closed <details> keep layout boxes in current Chromium but are never shown.
      if (box.width === 0 || box.height === 0 || box.bottom > innerHeight + 2 || getComputedStyle(element).visibility === 'hidden' || element.closest('[aria-hidden="true"],.sr-only,details:not([open]) > :not(summary)')) continue;
      const position = getComputedStyle(element).position;
      if (position === 'fixed' || position === 'sticky') continue;
      // What is shown ends where an inner scroll area (a table with its own max height) ends, not where its full content would.
      let bottom = box.bottom;
      for (let node = element.parentElement; node && node !== scroller; node = node.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowY)) bottom = Math.min(bottom, node.getBoundingClientRect().bottom);
      if (bottom > lowest) { lowest = bottom; lowestElement = element; }
    }
    obscured = Math.max(0, Math.round(lowest - barTop));
    if (obscured && lowestElement) obscuredBy = `${describe(lowestElement)} "${(lowestElement.textContent || '').trim().slice(0, 30)}" (scroll ${Math.round(scroller.scrollTop)} of ${scroller.scrollHeight - scroller.clientHeight})`;
    scroller.scrollTop = previous;
  }
  return { page: document.documentElement.scrollWidth > viewport + 1, shell: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false, offenders, small, tooSmall24, touchSmall, cutKpis, cutTabs, cutLabels, splitWords, obscured, obscuredBy, navMode };
}
