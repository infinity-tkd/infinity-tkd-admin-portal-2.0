'use client';

import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
function snapshot() { return window.matchMedia(query).matches; }
// The same conservative snapshot is used for SSR and the first hydration render.
function serverSnapshot() { return true; }

export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
