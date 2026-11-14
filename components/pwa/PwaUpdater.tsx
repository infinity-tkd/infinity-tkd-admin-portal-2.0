'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { useAppStore } from '@/lib/store';

export function PwaUpdater() {
  const { showConfirm } = useAppStore();
  const applyRequested = useRef(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      (process.env.NODE_ENV !== 'production' && process.env.ENABLE_PWA_DEV !== 'true')
    ) {
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      // Follow a new worker until it is installed and waiting. It may already be installing, or waiting, by the time this runs: the browser
      // looks for an update as the page loads and `updatefound` fires when installation starts, before this effect has attached a listener.
      const follow = (worker: ServiceWorker | null) => {
        if (!worker) return;
        const settle = () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(worker);
            setUpdateAvailable(true);
          }
        };
        worker.addEventListener('statechange', settle);
        settle();
      };
      follow(registration.waiting);
      follow(registration.installing);
      registration.addEventListener('updatefound', () => follow(registration.installing));
    });

    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing && applyRequested.current) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  const handleApplyUpdate = () => {
    showConfirm('The portal reloads to finish the update. Save any open form first. Reload now?', () => {
      applyRequested.current = true;
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    }, 'Apply update');
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Application update available"
      className="portal-global-toast fixed right-4 sm:right-6 z-[35] animate-in fade-in max-w-sm w-[calc(100vw-2rem)] sm:w-auto"
    >
      <div className="bg-surface/95 backdrop-blur-md border border-brand/40 rounded-[8px] p-4 shadow-2xl flex items-center justify-between gap-3 text-ink">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 text-brand-ink flex items-center justify-center shrink-0">
            <Sparkle className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink tracking-wide">Update Ready</p>
            <p className="text-micro text-ink-muted truncate">Save your work before applying</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplyUpdate}
          className="min-h-9 px-3 py-1.5 bg-brand hover:bg-brand-strong text-on-brand font-bold uppercase tracking-wider text-micro rounded-[6px] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm pointer-coarse:min-h-11"
        >
          <ArrowClockwise className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Apply</span>
        </button>
      </div>
    </aside>
  );
}
