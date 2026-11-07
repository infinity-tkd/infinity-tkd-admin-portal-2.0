'use client';

import { useLayoutEffect, useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';

/**
 * Gives a legacy modal overlay dialog semantics without restructuring it:
 * render it as the first child of the `fixed inset-0` overlay. The overlay
 * becomes a labelled modal dialog that traps Tab, closes on Escape (unless
 * `locked`) and returns focus to its opener. Centred cards are also marked so
 * they open as bottom sheets on phones (see `[data-modal-sheet]` in
 * app/globals.css). New modals should use ui/Dialog.
 */
export function ModalA11y({ label, onClose, locked = false }: { label: string; onClose: () => void; locked?: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const overlay = marker.current?.parentElement;
    if (!overlay) return;
    host.current = overlay;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', label);
    if (!overlay.hasAttribute('tabindex')) overlay.tabIndex = -1;
    const style = getComputedStyle(overlay);
    if (style.position !== 'fixed' || style.alignItems !== 'center') return;
    const panel = Array.from(overlay.children).find(child => child !== marker.current
      && child instanceof HTMLElement && !(child instanceof HTMLStyleElement)
      && !['absolute', 'fixed'].includes(getComputedStyle(child).position));
    if (!panel) return;
    overlay.setAttribute('data-modal-sheet', '');
    panel.setAttribute('data-modal-panel', '');
  }, [label]);
  useModalFocus(host, () => { if (!locked) onClose(); });
  return <span ref={marker} hidden />;
}
