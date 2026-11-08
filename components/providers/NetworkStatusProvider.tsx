'use client';

/**
 * Infinity network status. Monitors connectivity and reports attendance that was marked offline
 * and is waiting on this device (lib/attendance-queue.ts); the store sends it on reconnect.
 */

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { queuedAttendanceSnapshot, subscribeQueuedAttendance, type QueuedAttendanceMark } from '@/lib/attendance-queue';

interface NetworkStatusContextType {
  isOnline: boolean;
  isSyncing: boolean;
  /** Attendance marks waiting on this device for the signed-in account. */
  queuedCount: number;
  flushQueue: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isSyncing: false,
  queuedCount: 0,
  flushQueue: async () => {},
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

const NO_MARKS: readonly QueuedAttendanceMark[] = Object.freeze([]);

export function NetworkStatusProvider({ children, showConnectionBanners = true }: { children: React.ReactNode; showConnectionBanners?: boolean }) {
  const { state, attendanceSyncing, syncPendingAttendance } = useAppStore();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState<boolean>(false);
  const queued = useSyncExternalStore(subscribeQueuedAttendance, queuedAttendanceSnapshot, () => NO_MARKS);
  const userId = state.currentUser?.id;
  const queuedCount = queued.filter(mark => mark.userId === userId && !mark.failedReason).length;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    let reconnectedTimer: ReturnType<typeof setTimeout> | undefined;
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);
      clearTimeout(reconnectedTimer);
      reconnectedTimer = setTimeout(() => setShowReconnectedBanner(false), 4000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearTimeout(reconnectedTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        isSyncing: attendanceSyncing,
        queuedCount,
        flushQueue: syncPendingAttendance,
      }}
    >
      {/* Offline Status Warning Bar */}
      {!isOnline && (showConnectionBanners || queuedCount > 0) && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="portal-global-toast fixed right-4 z-[35] max-w-[calc(100vw-2rem)] pointer-events-none portal-notice-enter bg-amber-600/90 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between rounded-lg shadow-md"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 flex-shrink-0 text-amber-200" />
            <span>
              <strong>Offline:</strong> attendance you mark is kept on this device and sent when you reconnect. Other changes need a connection.
            </span>
          </div>
          {queuedCount > 0 && (
            <span className="bg-amber-800/80 px-2 py-0.5 rounded-full text-xs font-semibold ml-2 shrink-0">
              {queuedCount} {queuedCount === 1 ? 'mark' : 'marks'} waiting
            </span>
          )}
        </aside>
      )}

      {/* Syncing Activity Bar */}
      {isOnline && attendanceSyncing && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="portal-global-toast fixed right-4 z-[35] max-w-[calc(100vw-2rem)] pointer-events-none portal-notice-enter bg-blue-600/90 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 rounded-lg shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin text-blue-200" />
          <span>Sending attendance marked while offline…</span>
        </aside>
      )}

      {/* Back Online Reconnection Banner */}
      {showConnectionBanners && isOnline && showReconnectedBanner && !attendanceSyncing && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="portal-global-toast fixed right-4 z-[35] max-w-[calc(100vw-2rem)] pointer-events-none portal-notice-enter bg-emerald-600/90 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 rounded-lg shadow-sm"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
          <span>Connection restored — you are back online.</span>
        </aside>
      )}

      {children}
    </NetworkStatusContext.Provider>
  );
}
