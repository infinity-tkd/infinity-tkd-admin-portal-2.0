/** Copy only on a user action; a rejected permission must not claim success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Denied permissions can use the selection fallback. */ }
  if (typeof document === 'undefined') return false;
  let active: HTMLElement | null = null;
  let selection: Selection | null = null;
  const ranges: Range[] = [];
  let field: HTMLTextAreaElement | null = null;
  try {
    active = document.activeElement as HTMLElement | null;
    selection = document.getSelection?.() ?? null;
    if (selection) for (let index = 0; index < selection.rangeCount; index++) ranges.push(selection.getRangeAt(index).cloneRange());
    field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.tabIndex = -1;
    field.setAttribute('aria-hidden', 'true');
    field.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field?.remove();
    try {
      active?.focus({ preventScroll: true });
      if (selection) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    } catch { /* Focus recovery must not turn a completed copy into an error. */ }
  }
}
