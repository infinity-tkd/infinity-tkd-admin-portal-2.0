'use client';

import React, { useState, useEffect } from 'react';
import { Warning, House, MagnifyingGlass, ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isInternalBrokenLink, setIsInternalBrokenLink] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ref = document.referrer;
      const currentHost = window.location.host;
      if (ref && ref.includes(currentHost)) {
        setIsInternalBrokenLink(true);

        // Automated telemetry report for internal broken link
        fetch('/api/telemetry/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'WARN',
            type: 'BROKEN_INTERNAL_LINK',
            missingUrl: window.location.href,
            referrer: ref,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const term = searchQuery.toLowerCase().trim();
    if (term.includes('student') || term.includes('member') || term.includes('belt')) {
      router.push('/students');
    } else if (term.includes('attend') || term.includes('checkin')) {
      router.push('/attendance');
    } else if (term.includes('pay') || term.includes('finance') || term.includes('tuition')) {
      router.push('/financials');
    } else if (term.includes('lms') || term.includes('learn') || term.includes('video')) {
      router.push('/lms');
    } else if (term.includes('pos') || term.includes('shop') || term.includes('inventory')) {
      router.push('/pos');
    } else if (term.includes('setting') || term.includes('config') || term.includes('coach')) {
      router.push('/settings');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-[#141414] border border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-[#EF2F38] shadow-[0_0_20px_rgba(239,47,56,0.15)]">
          <span className="text-xl font-mono font-black tracking-tight">404</span>
        </div>

        <div className="space-y-2">
          {isInternalBrokenLink && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-widest">
              <Warning className="w-3.5 h-3.5" /> Broken Link Detected & Reported
            </span>
          )}
          <h1 className="text-xl font-black text-white tracking-tight uppercase">Page Not Found</h1>
          <p className="text-xs text-[#999] leading-relaxed">
            The page or record you requested does not exist, was moved, or requires upgraded security credentials.
          </p>
        </div>

        {/* Quick Portal Search Shortcut */}
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative flex items-center">
            <MagnifyingGlass className="absolute left-3.5 w-4 h-4 text-[#777] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search portal (students, billing, roster)..."
              className="w-full min-h-[44px] pl-10 pr-20 bg-[#0A0A0A] border border-[#262626] focus:border-[#EF2F38] rounded-[8px] text-xs text-white placeholder:text-[#555] outline-none transition-colors"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase text-[9px] rounded-[6px] transition-colors"
            >
              Go
            </button>
          </div>
        </form>

        <div className="flex flex-col w-full gap-2.5 pt-2">
          <Link
            href="/dashboard"
            className="w-full min-h-[44px] py-2.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
          >
            <House className="w-4 h-4" /> Return to Dashboard
          </Link>

          <button
            onClick={() => router.back()}
            className="w-full min-h-[44px] py-2.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#333] text-[#E4E4E4] font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
