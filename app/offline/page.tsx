'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WifiSlash } from '@phosphor-icons/react/dist/csr/WifiSlash';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { Calendar } from '@phosphor-icons/react/dist/csr/Calendar';

export default function OfflineFallbackPage() {
  const [isChecking, setIsChecking] = useState(false);

  const handleRetry = () => {
    setIsChecking(true);
    if (typeof window !== 'undefined') {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setTimeout(() => {
          setIsChecking(false);
        }, 1200);
      }
    }
  };

  return (
    <main
      role="main"
      className="flex min-h-[70dvh] flex-col items-center justify-center p-4 text-ink sm:p-6"
    >
      <div className="w-full max-w-md space-y-6 rounded-lg border border-line bg-surface p-6 text-center shadow-2xl sm:p-8">
        {/* Visual Offline Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-[#EF2F38]">
          <WifiSlash className="w-8 h-8" weight="bold" />
        </div>

        {/* Header & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Offline Mode Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink">
            Connection Unavailable
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
            You are currently offline. Infinity TKD continues to protect your offline mutations, which will automatically sync once a connection is detected.
          </p>
        </div>

        {/* Retry Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isChecking}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand text-xs font-bold uppercase tracking-wider text-on-brand shadow-md transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            <ArrowClockwise className={`w-4 h-4 ${isChecking ? 'motion-safe:animate-spin' : ''}`} weight="bold" />
            <span>{isChecking ? 'Checking Connection...' : 'Check Connection & Reload'}</span>
          </button>
        </div>

        {/* Cached Available Navigation Routes */}
        <div className="space-y-3 border-t border-line pt-5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-subtle block">
            Cached App Sections
          </span>
          <div className="grid grid-cols-2 gap-2 text-left">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-control p-2.5 text-xs font-semibold text-ink transition-colors hover:bg-control-hover"
            >
              <House className="w-4 h-4 text-[#EF2F38]" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/attendance"
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-control p-2.5 text-xs font-semibold text-ink transition-colors hover:bg-control-hover"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Attendance</span>
            </Link>
            <Link
              href="/students"
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-control p-2.5 text-xs font-semibold text-ink transition-colors hover:bg-control-hover"
            >
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Students</span>
            </Link>
            <Link
              href="/schedule"
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-control p-2.5 text-xs font-semibold text-ink transition-colors hover:bg-control-hover"
            >
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Schedule</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
