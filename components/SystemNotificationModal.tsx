'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, Warning, Info, XCircle, X, 
  Copy, Check, CaretDown, CaretUp, Bug
} from '@phosphor-icons/react';
import { useT } from '@/hooks/useTranslation';
import { playChime } from '@/lib/soundEffects';

export function SystemNotificationModal() {
  const { state, hideNotification } = useAppStore();
  const t = useT();

  const notification = state.systemNotification;
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-chime and reset state when a new notification arrives
  useEffect(() => {
    if (!notification) {
      setShowDetails(false);
      setCopied(false);
      return;
    }

    if (notification.type === 'error' || notification.type === 'warning') {
      playChime('alert');
    } else if (notification.type === 'success') {
      playChime('success');
    }

    // Auto-dismiss transient success and info notices after 4.5 seconds
    if (notification.type === 'success' || notification.type === 'info') {
      const timer = setTimeout(() => {
        hideNotification();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification, hideNotification]);

  // Keyboard shortcut: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notification) {
        hideNotification();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, hideNotification]);

  const handleCopyDetails = useCallback(async () => {
    if (!notification) return;
    const errorPayload = `[INFINITY TKD SYSTEM ERROR REPORT]
Title: ${notification.title || 'System Notification'}
Type: ${notification.type.toUpperCase()}
Code: ${notification.code || 'N/A'}
Timestamp: ${new Date(notification.timestamp || Date.now()).toISOString()}
Message: ${notification.message}
${notification.details ? `\n--- TECHNICAL DETAILS ---\n${notification.details}` : ''}
URL: ${typeof window !== 'undefined' ? window.location.href : ''}`;

    try {
      await navigator.clipboard.writeText(errorPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  }, [notification]);

  if (!notification) return null;

  const isError = notification.type === 'error';
  const isWarning = notification.type === 'warning';
  const isSuccess = notification.type === 'success';

  // Theme styling configurations
  const theme = isError
    ? {
        accentColor: '#EF2F38',
        iconBg: 'bg-red-500/10 border-red-500/25 text-[#EF2F38]',
        badgeBg: 'bg-red-500/10 text-red-400 border-red-500/20',
        borderColor: 'border-red-500/30',
        glowColor: 'rgba(239, 47, 56, 0.15)',
        btnBg: 'bg-[#EF2F38] hover:bg-red-600 text-white',
        Icon: XCircle,
        headerLabel: 'Action Failed',
      }
    : isWarning
    ? {
        accentColor: '#F59E0B',
        iconBg: 'bg-amber-500/10 border-amber-500/25 text-amber-500',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        borderColor: 'border-amber-500/30',
        glowColor: 'rgba(245, 158, 11, 0.15)',
        btnBg: 'bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black',
        Icon: Warning,
        headerLabel: 'Attention Required',
      }
    : isSuccess
    ? {
        accentColor: '#10B981',
        iconBg: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        glowColor: 'rgba(16, 185, 129, 0.15)',
        btnBg: 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black',
        Icon: CheckCircle,
        headerLabel: 'Success',
      }
    : {
        accentColor: '#3B82F6',
        iconBg: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
        badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        borderColor: 'border-blue-500/30',
        glowColor: 'rgba(59, 130, 246, 0.15)',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
        Icon: Info,
        headerLabel: 'Information',
      };

  const Icon = theme.Icon;
  const headerTitle = notification.title || theme.headerLabel;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sys-modal-title"
        aria-describedby="sys-modal-desc"
      >
        {/* Backdrop blur with overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={hideNotification}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Card container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
          style={{
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 45px ${theme.glowColor}`,
          }}
          className={`relative w-full max-w-lg bg-white dark:bg-[#111111] border ${theme.borderColor} rounded-[10px] p-5 sm:p-6 text-neutral-900 dark:text-white shadow-2xl overflow-hidden z-10 max-h-[92dvh] flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle top edge glow */}
          <div 
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ backgroundColor: theme.accentColor }}
          />

          {/* Close button top corner */}
          <button
            onClick={hideNotification}
            className="absolute top-3.5 right-3.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#1F1F1F] cursor-pointer active:scale-95 touch-manipulation"
            aria-label="Dismiss Notification"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Row */}
          <div className="flex items-start gap-3.5 mb-3.5 pr-8">
            <div className={`p-2.5 rounded-[8px] border flex items-center justify-center shrink-0 ${theme.iconBg}`}>
              <Icon className="w-6 h-6" weight="bold" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[9px] font-mono uppercase font-black px-2 py-0.5 rounded-[4px] border tracking-wider ${theme.badgeBg}`}>
                  {theme.headerLabel}
                </span>

                {notification.code && (
                  <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] px-1.5 py-0.5 rounded-[4px] truncate max-w-[200px]">
                    {notification.code}
                  </span>
                )}
              </div>

              <h2 id="sys-modal-title" className="text-base font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
                {headerTitle}
              </h2>
            </div>
          </div>

          {/* Message Content */}
          <div className="overflow-y-auto overscroll-contain flex-1 pr-1 space-y-3.5 mb-5">
            <p id="sys-modal-desc" className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans whitespace-pre-line">
              {notification.message}
            </p>

            {/* Technical Details Accordion */}
            {notification.details && notification.details !== notification.message && (
              <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50 dark:bg-[#161616] overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full px-3 py-2 flex items-center justify-between text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer font-mono text-[11px]"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <Bug className="w-3.5 h-3.5 text-[#EF2F38]" />
                    {showDetails ? 'Hide Diagnostics' : 'Show Technical Diagnostics'}
                  </span>
                  {showDetails ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
                </button>

                {showDetails && (
                  <div className="p-3 border-t border-neutral-200 dark:border-[#262626] bg-black/40 font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-all leading-tight">
                    {notification.details}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-[#222222] shrink-0">
            {(isError || isWarning || notification.details) && (
              <button
                type="button"
                onClick={handleCopyDetails}
                className="w-full sm:w-auto px-3.5 py-2 min-h-[40px] rounded-[8px] border border-neutral-300 dark:border-[#2D2D2D] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] text-neutral-800 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" weight="bold" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-neutral-400" />
                    <span>Copy Error</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={hideNotification}
              className={`w-full sm:w-auto min-w-[110px] px-5 py-2 min-h-[40px] rounded-[8px] font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center cursor-pointer ${theme.btnBg}`}
            >
              {t('act_close')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
