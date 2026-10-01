'use client';

import React, { useState, useEffect } from 'react';
import { ArrowClockwise, Sparkle } from '@phosphor-icons/react';

export function PwaUpdater() {
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
      // Check if there is already a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleApplyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Application update available"
      className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-60 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-sm w-[calc(100vw-2rem)] sm:w-auto"
    >
      <div className="bg-[#141414]/95 backdrop-blur-md border border-red-500/40 rounded-[8px] p-4 shadow-2xl flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-[#EF2F38] flex items-center justify-center shrink-0">
            <Sparkle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white tracking-wide">Update Ready</p>
            <p className="text-[10px] text-[#888] truncate">New features are available</p>
          </div>
        </div>

        <button
          onClick={handleApplyUpdate}
          className="px-3 py-1.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-wider text-[10px] rounded-[6px] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          <ArrowClockwise className="w-3.5 h-3.5" />
          <span>Apply</span>
        </button>
      </div>
    </aside>
  );
}
