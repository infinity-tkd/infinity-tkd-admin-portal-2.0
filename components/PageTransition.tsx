'use client';

import { useEffect, useRef } from 'react';

/** Fade the current surface without delaying navigation or remounting its forms. */
export function PageTransition({ children, identity, className }: { children: React.ReactNode; identity: string; className?: string }) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element || !element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const duration = parseFloat(getComputedStyle(element).getPropertyValue('--motion-standard')) || 180;
    const animation = element.animate([{ opacity: 0.9 }, { opacity: 1 }], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => { if (preference.matches) animation.cancel(); };
    preference.addEventListener('change', cancel);
    return () => { animation.cancel(); preference.removeEventListener('change', cancel); };
  }, [identity]);
  return <div ref={surface} data-page-surface className={className}>{children}</div>;
}
