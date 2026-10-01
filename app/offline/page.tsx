'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WifiSlash, ArrowClockwise, House, Users, CalendarCheck, Calendar } from '@phosphor-icons/react';

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
      className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md bg-[#141414] border border-neutral-800 rounded-[12px] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Visual Offline Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-[#EF2F38]">
          <WifiSlash className="w-8 h-8" weight="bold" />
        </div>

        {/* Header & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Offline Mode Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Connection Unavailable
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            You are currently offline. Infinity TKD continues to protect your offline mutations, which will automatically sync once a connection is detected.
          </p>
        </div>

        {/* Retry Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full h-11 bg-[#EF2F38] hover:bg-red-600 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
          >
            <ArrowClockwise className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} weight="bold" />
            <span>{isChecking ? 'Checking Connection...' : 'Check Connection & Reload'}</span>
          </button>
        </div>

        {/* Cached Available Navigation Routes */}
        <div className="border-t border-neutral-800/80 pt-5 space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block">
            Cached App Sections
          </span>
          <div className="grid grid-cols-2 gap-2 text-left">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 p-2.5 rounded-[8px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-200 text-xs font-semibold transition-colors"
            >
              <House className="w-4 h-4 text-[#EF2F38]" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/attendance"
              className="flex items-center gap-2 p-2.5 rounded-[8px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-200 text-xs font-semibold transition-colors"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
              <span>Attendance</span>
            </Link>
            <Link
              href="/students"
              className="flex items-center gap-2 p-2.5 rounded-[8px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-200 text-xs font-semibold transition-colors"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Students</span>
            </Link>
            <Link
              href="/schedule"
              className="flex items-center gap-2 p-2.5 rounded-[8px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-200 text-xs font-semibold transition-colors"
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Schedule</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
