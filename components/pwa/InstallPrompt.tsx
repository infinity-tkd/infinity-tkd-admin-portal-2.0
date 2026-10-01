'use client';

import React, { useState, useEffect } from 'react';
import { DownloadSimple, ShareNetwork, PlusSquare, X, Desktop } from '@phosphor-icons/react';
import { Portal } from '@/components/Portal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      return isDisplayStandalone || isNavigatorStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS Safari (not in standalone mode)
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    if (isIos && isSafari) {
      setIsIosSafari(true);
    }

    // 3. Listen for Chromium/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Listen for app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Suppress completely if already running inside standalone window or installed
  if (isStandalone || installed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('PWA install prompt failed:', err);
      }
    } else if (isIosSafari) {
      setShowIosGuide(true);
    } else {
      setShowDesktopGuide(true);
    }
  };

  return (
    <>
      {/* Sleek Header / Action Install Trigger */}
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 min-h-[36px] min-w-[36px] justify-center cursor-pointer shadow-xs shrink-0 active:scale-95 touch-manipulation"
        title="Install Infinity Admin Portal"
        aria-label="Install Infinity Admin Portal"
      >
        <DownloadSimple className="w-4 h-4 shrink-0 text-[#EF2F38]" weight="bold" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {/* Desktop Browser Instructions Modal (Rendered outside stacking context via Portal) */}
      {showDesktopGuide && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 text-neutral-900 dark:text-white">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-[#262626]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                    <Desktop className="w-4 h-4 text-[#EF2F38]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider leading-none">
                      Install on Desktop
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                      Infinity Admin Portal PWA
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDesktopGuide(false)}
                  className="p-1.5 rounded-[6px] text-neutral-400 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222] transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                  aria-label="Close installation dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed">
                To install <strong className="text-neutral-900 dark:text-white font-semibold">Infinity Admin Portal</strong> directly to your desktop (Chrome, Edge, or Brave):
              </p>

              {/* Instructions List with Clean Indentation and Alignment */}
              <div className="space-y-2.5 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 text-xs">
                <div className="flex items-start gap-3 p-2 rounded-[6px] bg-white dark:bg-[#141414] border border-neutral-200/60 dark:border-[#202020]">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-[#EF2F38] flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                    1
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                      Look at the right side of your browser address bar for the <strong className="text-neutral-900 dark:text-white font-semibold">Install</strong> icon (⊕ or computer monitor icon).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-[6px] bg-white dark:bg-[#141414] border border-neutral-200/60 dark:border-[#202020]">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-[#EF2F38] flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                    2
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                      Click it and choose <strong className="text-neutral-900 dark:text-white font-semibold">Install</strong> to launch as a standalone desktop application.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Action Footer */}
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="w-full min-h-[42px] px-4 py-2.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-colors cursor-pointer shadow-sm active:scale-95 touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* iOS Safari Instruction Modal / Bottom Sheet */}
      {showIosGuide && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md bg-white dark:bg-[#141414] border-t sm:border border-neutral-200 dark:border-[#262626] rounded-t-[12px] sm:rounded-[10px] p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 text-neutral-900 dark:text-white pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-[#262626]">
                <div className="flex items-center gap-2.5">
                  <img src="/icons/logo.svg" alt="Infinity Logo" className="w-6 h-6 object-contain" />
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider leading-none">
                      Install on iOS
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                      Add to iPhone/iPad Home Screen
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="p-1.5 rounded-[6px] text-neutral-400 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222] transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                  aria-label="Close installation guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed">
                Install <strong className="text-neutral-900 dark:text-white font-semibold">Infinity Admin Portal</strong> directly to your home screen for fullscreen performance, offline access, and fast launching:
              </p>

              {/* Instructions List with Clean Indentation */}
              <div className="space-y-2.5 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 text-xs">
                <div className="flex items-start gap-3 p-2 rounded-[6px] bg-white dark:bg-[#141414] border border-neutral-200/60 dark:border-[#202020]">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-[#EF2F38] flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                    1
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                      Tap the <strong className="text-neutral-900 dark:text-white font-semibold">Share</strong> button in Safari's bottom toolbar:
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold">
                      <ShareNetwork className="w-3.5 h-3.5" />
                      <span>Share Sheet</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-[6px] bg-white dark:bg-[#141414] border border-neutral-200/60 dark:border-[#202020]">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-[#EF2F38] flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                    2
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                      Scroll down and tap <strong className="text-neutral-900 dark:text-white font-semibold">Add to Home Screen</strong>:
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">
                      <PlusSquare className="w-3.5 h-3.5" />
                      <span>Add to Home Screen</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-[6px] bg-white dark:bg-[#141414] border border-neutral-200/60 dark:border-[#202020]">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-[#EF2F38] flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                    3
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                      Tap <strong className="text-neutral-900 dark:text-white font-semibold">Add</strong> in the top-right corner to complete installation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full min-h-[42px] px-4 py-2.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
