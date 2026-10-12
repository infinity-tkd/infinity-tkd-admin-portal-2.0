'use client';

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useReducedMotionPreference } from './use-reduced-motion';
import { PORTAL_COMPACT_MEDIA, navigationScrollState, updateNavigationScroll } from '@/lib/navigation';

export function usePortalScroll(pathname: string, drawerOpen: boolean, enabled = true) {
  const reduced = useReducedMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const activeScroller = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const scrollState = useRef(navigationScrollState());
  const positions = useRef(new WeakMap<HTMLElement, number>());
  const compact = useRef(false);
  const visible = useRef(true);
  const elevated = useRef(false);
  const [isNavVisible, setNavVisible] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isCompactNavigation, setCompactNavigation] = useState(false);

  const reveal = useCallback(() => {
    scrollState.current = navigationScrollState(activeScroller.current?.scrollTop || 0);
    visible.current = true;
    setNavVisible(true);
  }, []);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    activeScroller.current = null;
    scrollState.current = navigationScrollState();
    positions.current = new WeakMap();
    elevated.current = false;
    reveal();
    setShowScrollTop(false);
    if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';
    containerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [pathname, enabled, reveal]);

  useEffect(() => {
    const media = window.matchMedia(PORTAL_COMPACT_MEDIA);
    const sync = () => {
      compact.current = media.matches;
      setCompactNavigation(media.matches);
      scrollState.current = navigationScrollState(activeScroller.current?.scrollTop || 0);
      reveal();
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Tab') reveal(); };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('keydown', keyboard, true);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('keydown', keyboard, true); };
  }, [reveal]);

  useEffect(() => {
    if (!enabled) return;
    const shell = containerRef.current?.closest('[data-portal-shell]');
    const header = shell?.querySelector<HTMLElement>('[data-portal-header]');
    const footer = shell?.querySelector<HTMLElement>('[data-portal-bottom-nav]');
    if (!header || !footer) return;
    const root = document.documentElement;
    const measure = () => {
      for (const [element, variable] of [[header, '--portal-header-height'], [footer, '--portal-footer-height']] as const) {
        const height = Math.ceil(element.getBoundingClientRect().height);
        if (height > 0) root.style.setProperty(variable, `${height}px`);
      }
    };
    const observer = new ResizeObserver(measure);
    // Safe-area padding changes the border box without changing the content box.
    observer.observe(header, { box: 'border-box' });
    observer.observe(footer, { box: 'border-box' });
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--portal-header-height');
      root.style.removeProperty('--portal-footer-height');
    };
  }, [enabled]);

  useEffect(() => {
    if (drawerOpen || reduced) reveal();
  }, [drawerOpen, reduced, reveal]);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const scroller = event.target;
    if (!(scroller instanceof HTMLElement) || scroller.scrollHeight - scroller.clientHeight < 2) return;
    // Ignore scrolling in a dialog or a small horizontal list inside a page.
    if (scroller.closest('[role="dialog"], [role="alertdialog"]') || scroller.clientHeight < 160) return;
    if (activeScroller.current !== scroller) {
      activeScroller.current = scroller;
      scrollState.current = { ...navigationScrollState(positions.current.get(scroller) || 0), visible: visible.current };
    }
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const current = activeScroller.current;
      if (!current?.isConnected) return;
      const maximum = current.scrollHeight - current.clientHeight;
      const top = Math.max(0, Math.min(current.scrollTop, maximum));
      const progress = maximum > 0 ? Math.min(1, Math.max(0, top / maximum)) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      const raised = top > 320 && maximum - top > 160;
      if (raised !== elevated.current) { elevated.current = raised; setShowScrollTop(raised); }
      // Touch-selected links retain focus too; only keyboard focus pins the chrome.
      const keyboardFocus = Boolean(document.activeElement?.matches(':focus-visible') && document.activeElement.closest('[data-portal-navigation]'));
      scrollState.current = updateNavigationScroll(scrollState.current, top, maximum, !compact.current || drawerOpen || reduced || keyboardFocus);
      const nextVisible = scrollState.current.visible;
      if (nextVisible !== visible.current) { visible.current = nextVisible; setNavVisible(nextVisible); }
      positions.current.set(current, top);
    });
  }, [drawerOpen, reduced]);

  const scrollToTop = useCallback(() => {
    (activeScroller.current || containerRef.current)?.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
    reveal();
  }, [reduced, reveal]);

  return { containerRef, progressRef, onScroll, isNavVisible, isCompactNavigation, showScrollTop, revealNavigation: reveal, scrollToTop };
}
