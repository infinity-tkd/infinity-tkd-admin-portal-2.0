'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { IDLE_TIMEOUT_MS, WARNING_DURATION_MS } from '@/lib/security';
import { Warning, LockKey, Clock } from '@phosphor-icons/react';

interface IdleTimerOptions {
  idleTimeoutMs?: number;
  warningDurationMs?: number;
  onTimeout?: () => void;
}

export function useIdleTimer({
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  warningDurationMs = WARNING_DURATION_MS,
  onTimeout,
}: IdleTimerOptions = {}) {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor(warningDurationMs / 1000));

  const resetTimer = useCallback(() => {
    setIsWarningVisible(false);
    setRemainingSeconds(Math.floor(warningDurationMs / 1000));
  }, [warningDurationMs]);

  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const handleActivity = () => {
      if (!isWarningVisible) {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          setIsWarningVisible(true);
        }, idleTimeoutMs - warningDurationMs);
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity));

    idleTimer = setTimeout(() => {
      setIsWarningVisible(true);
    }, idleTimeoutMs - warningDurationMs);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearTimeout(idleTimer);
    };
  }, [idleTimeoutMs, warningDurationMs, isWarningVisible]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWarningVisible) {
      interval = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            if (onTimeout) onTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWarningVisible, onTimeout]);

  return {
    isWarningVisible,
    remainingSeconds,
    resetTimer,
  };
}

export function SessionTimeoutModal() {
  const { logout, state } = useAppStore();

  const handleAutoLogout = useCallback(() => {
    logout();
  }, [logout]);

  const { isWarningVisible, remainingSeconds, resetTimer } = useIdleTimer({
    onTimeout: handleAutoLogout,
  });

  if (!state.currentUser || !isWarningVisible) {
    return null;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 max-w-md w-full shadow-2xl text-center space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>

        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            Session Expiring Due To Inactivity
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            For security, your session will automatically lock if no activity is detected.
          </p>
        </div>

        <div className="py-3 bg-neutral-100 dark:bg-[#1C1C1C] rounded-[8px] border border-neutral-200 dark:border-[#262626]">
          <span className="text-2xl font-black font-mono text-[#EF2F38]">{formattedTime}</span>
          <span className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mt-0.5">
            Time Remaining
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={logout}
            className="flex-1 px-4 py-2.5 bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-bold text-xs rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#333] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LockKey className="w-4 h-4" /> Sign Out Now
          </button>
          <button
            onClick={resetTimer}
            className="flex-1 px-4 py-2.5 bg-[#EF2F38] text-white font-bold text-xs rounded-[8px] hover:opacity-90 transition-all shadow-lg shadow-[#EF2F38]/20 cursor-pointer"
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
