'use client';

import React, { useState, useEffect } from 'react';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buttonClass, fieldClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

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
    <div className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden p-4 font-sans text-ink sm:p-6">
      {/* Background radial glow */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center space-y-6 rounded-lg border border-line bg-surface p-6 text-center shadow-2xl sm:p-8">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-brand-ink shadow-[0_0_20px_rgba(239,47,56,0.15)]">
          <span className="text-xl font-mono font-black tracking-tight">404</span>
        </div>

        <div className="space-y-2">
          {isInternalBrokenLink && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              <Warning className="w-3.5 h-3.5" /> Broken Link Detected & Reported
            </span>
          )}
          <h1 className="text-xl font-black tracking-tight text-ink uppercase">Page Not Found</h1>
          <p className="text-xs leading-relaxed text-ink-muted">
            The page or record you requested does not exist, was moved, or requires upgraded security credentials.
          </p>
        </div>

        {/* Quick Portal Search Shortcut */}
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative flex items-center">
            <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search portal (students, billing, roster)..."
              aria-label="Search portal" className={cn(fieldClass, 'pl-10 pr-16 text-xs')}
            />
            <button
              type="submit"
              className="absolute right-1 flex h-9 items-center rounded-md bg-brand px-3 text-[10px] font-bold uppercase text-on-brand transition-colors hover:bg-brand-strong"
            >
              Go
            </button>
          </div>
        </form>

        <div className="flex flex-col w-full gap-2.5 pt-2">
          <Link
            href="/dashboard"
            className={buttonClass({ variant: 'primary' })}
          >
            <House className="w-4 h-4" /> Return to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => router.back()}
            className={buttonClass()}
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
