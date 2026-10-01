'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Pulse, HardDrives, WifiHigh, WifiSlash, 
  ArrowClockwise, Trash, ShieldCheck, CheckCircle, Warning
} from '@phosphor-icons/react';
import { Portal } from '@/components/Portal';
import { useNetworkStatus } from '@/components/providers/NetworkStatusProvider';

interface CacheDetail {
  name: string;
  itemCount: number;
}

interface PwaDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PwaDiagnosticsModal({ isOpen, onClose }: PwaDiagnosticsModalProps) {
  const { isOnline, queuedCount, flushQueue } = useNetworkStatus();
  const [swStatus, setSwStatus] = useState<string>('Checking...');
  const [swScope, setSwScope] = useState<string>('N/A');
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [cachesList, setCachesList] = useState<CacheDetail[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    setIsRefreshing(true);
    setActionMessage(null);

    // 1. Standalone detection
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standaloneMode);

    // 2. Service Worker detection
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          setSwScope(reg.scope);
          if (reg.active) {
            setSwStatus('Active & Running');
          } else if (reg.installing) {
            setSwStatus('Installing new version');
          } else if (reg.waiting) {
            setSwStatus('Update Ready (Waiting)');
          } else {
            setSwStatus('Registered');
          }
        } else {
          setSwStatus('Not Registered');
        }
      } catch (err) {
        setSwStatus('Error querying worker');
      }
    } else {
      setSwStatus('Not Supported by Browser');
    }

    // 3. Cache Storage Inspection
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        const details: CacheDetail[] = [];
        for (const key of keys) {
          const cache = await caches.open(key);
          const entries = await cache.keys();
          details.push({ name: key, itemCount: entries.length });
        }
        setCachesList(details);
      } catch {
        setCachesList([]);
      }
    }

    // 4. Storage Quota Estimation
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      } catch {
        setStorageEstimate(null);
      }
    }

    setIsRefreshing(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadDiagnostics();
    }
  }, [isOpen]);

  const handleCheckUpdate = async () => {
    setActionMessage('Checking for updates...');
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          setActionMessage('Service Worker checked: Latest manifest active.');
        } else {
          setActionMessage('No active service worker registered.');
        }
      } catch (err) {
        setActionMessage('Failed to check service worker update.');
      }
    }
    setTimeout(() => loadDiagnostics(), 800);
  };

  const handleClearCaches = async () => {
    setActionMessage('Clearing runtime caches...');
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        setActionMessage('All runtime caches cleared successfully.');
      } catch {
        setActionMessage('Failed to clear runtime caches.');
      }
    }
    setTimeout(() => loadDiagnostics(), 800);
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div 
        className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-diag-title"
      >
        <div 
          className="w-full max-w-xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl p-5 sm:p-6 space-y-5 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-red-500/10 border border-red-500/20 text-[#EF2F38] flex items-center justify-center">
                <Pulse className="w-4 h-4" weight="bold" />
              </div>
              <div>
                <h3 id="pwa-diag-title" className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  PWA Architecture &amp; Cache Diagnostics
                </h3>
                <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                  Client Runtime &bull; Service Worker v2.0.0
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Close Diagnostics"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Status Feedback */}
          {actionMessage && (
            <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/25 text-[#EF2F38] text-xs font-mono flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Diagnostics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Online Status */}
            <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block">
                Network Status
              </span>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <WifiHigh className="w-4 h-4 text-emerald-500" weight="bold" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Connected Online</span>
                  </>
                ) : (
                  <>
                    <WifiSlash className="w-4 h-4 text-amber-500" weight="bold" />
                    <span className="font-semibold text-amber-600 dark:text-amber-400">Disconnected Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Standalone Display Mode */}
            <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block">
                Display Mode
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isStandalone ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                <span className="font-semibold">
                  {isStandalone ? 'PWA Standalone Window' : 'Standard Web Browser Tab'}
                </span>
              </div>
            </div>

            {/* Service Worker Lifecycle */}
            <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] space-y-1 sm:col-span-2">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block">
                Service Worker Controller
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold font-mono text-xs">{swStatus}</span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                  Scope: {swScope}
                </span>
              </div>
            </div>

            {/* Offline Mutation Queue */}
            <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block">
                Offline IndexedDB Queue
              </span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm font-mono">{queuedCount} changes</span>
                {queuedCount > 0 && (
                  <button
                    onClick={() => flushQueue()}
                    className="text-[10px] font-mono font-bold text-[#EF2F38] hover:underline cursor-pointer"
                  >
                    Sync Now
                  </button>
                )}
              </div>
            </div>

            {/* Storage Quota */}
            <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block">
                Estimated Storage Quota
              </span>
              <span className="font-bold text-sm font-mono">
                {storageEstimate
                  ? `${(storageEstimate.usage / (1024 * 1024)).toFixed(1)} MB / ${(storageEstimate.quota / (1024 * 1024 * 1024)).toFixed(1)} GB`
                  : 'Unavailable'}
              </span>
            </div>
          </div>

          {/* Cache Pools Detail */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
              Active Cache Storage Pools ({cachesList.length})
            </span>
            <div className="divide-y divide-neutral-200 dark:divide-[#262626] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden max-h-36 overflow-y-auto">
              {cachesList.map((c) => (
                <div key={c.name} className="px-3 py-2 bg-neutral-50 dark:bg-[#181818] flex items-center justify-between text-xs font-mono">
                  <span className="truncate max-w-[280px]">{c.name}</span>
                  <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-[#282828] text-[10px] font-bold">
                    {c.itemCount} items
                  </span>
                </div>
              ))}
              {cachesList.length === 0 && (
                <div className="p-4 text-center text-xs text-neutral-400 font-mono">
                  No runtime caches initialized yet.
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-[#262626]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#202020] dark:hover:bg-[#282828] text-xs font-bold uppercase tracking-wider font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowClockwise className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Check Update</span>
              </button>
              <button
                type="button"
                onClick={handleClearCaches}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-[6px] bg-red-500/10 hover:bg-red-500/20 text-[#EF2F38] text-xs font-bold uppercase tracking-wider font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash className="w-3.5 h-3.5" />
                <span>Clear Caches</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-[6px] bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
