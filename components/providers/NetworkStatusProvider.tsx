'use client';

/**
 * Infinity Network Status & Offline Mutation Queue Provider
 * Monitors connectivity, queues offline mutations in IndexedDB, and auto-syncs on reconnect.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { openDB, IDBPDatabase } from 'idb';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

interface NetworkStatusContextType {
  isOnline: boolean;
  isSyncing: boolean;
  queuedCount: number;
  queueMutation: (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>) => Promise<string>;
  flushQueue: () => Promise<{ synced: number; failed: number }>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isSyncing: false,
  queuedCount: 0,
  queueMutation: async () => '',
  flushQueue: async () => ({ synced: 0, failed: 0 }),
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

const DB_NAME = 'infinity_offline_store';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState<boolean>(false);

  // Refresh queued mutations count from IndexedDB
  const refreshQueueCount = useCallback(async () => {
    try {
      const db = await getDb();
      const count = await db.count(STORE_NAME);
      setQueuedCount(count);
    } catch {
      // IndexedDB might not be available in SSR or private mode
    }
  }, []);

  // Queue a mutation in IndexedDB
  const queueMutation = useCallback(
    async (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> => {
      try {
        const db = await getDb();
        const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const record: QueuedMutation = {
          ...mutation,
          id,
          timestamp: Date.now(),
          retryCount: 0,
        };
        await db.put(STORE_NAME, record);
        await refreshQueueCount();
        return id;
      } catch (err) {
        console.error('[OFFLINE_QUEUE_ERROR] Failed to queue mutation:', err);
        throw err;
      }
    },
    [refreshQueueCount]
  );

  // Flush and replay all queued mutations
  const flushQueue = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    let synced = 0;
    let failed = 0;

    try {
      const db = await getDb();
      const allMutations: QueuedMutation[] = await db.getAll(STORE_NAME);

      if (allMutations.length === 0) {
        setQueuedCount(0);
        return { synced: 0, failed: 0 };
      }

      setIsSyncing(true);

      // Sort by timestamp ascending to replay in chronological order
      allMutations.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of allMutations) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
          });

          if (res.ok) {
            await db.delete(STORE_NAME, item.id);
            synced++;
          } else if (res.status >= 400 && res.status < 500) {
            // Client error - record cannot be retried automatically without mutation
            await db.delete(STORE_NAME, item.id);
            failed++;
          } else {
            // Server error - increment retryCount
            item.retryCount += 1;
            await db.put(STORE_NAME, item);
            failed++;
          }
        } catch {
          // Network still down or interrupted
          item.retryCount += 1;
          await db.put(STORE_NAME, item);
          failed++;
          break; // Stop replaying if network dropped again
        }
      }

      await refreshQueueCount();
    } catch (err) {
      console.error('[OFFLINE_SYNC_ERROR] Error replaying mutations:', err);
    } finally {
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [refreshQueueCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    refreshQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);
      setTimeout(() => setShowReconnectedBanner(false), 4000);
      flushQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue, refreshQueueCount]);

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        isSyncing,
        queuedCount,
        queueMutation,
        flushQueue,
      }}
    >
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="bg-amber-600/90 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-md backdrop-blur-sm sticky top-0 z-[100] transition-all"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-200" />
            <span>
              <strong>Offline Mode:</strong> You are currently offline. Changes will be saved locally and synced once reconnected.
            </span>
          </div>
          {queuedCount > 0 && (
            <span className="bg-amber-800/80 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">
              {queuedCount} pending {queuedCount === 1 ? 'change' : 'changes'}
            </span>
          )}
        </aside>
      )}

      {/* Syncing Activity Bar */}
      {isOnline && isSyncing && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="bg-blue-600/90 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shadow-sm backdrop-blur-sm sticky top-0 z-[100]"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-200" />
          <span>Synchronizing offline changes to cloud database...</span>
        </aside>
      )}

      {/* Back Online Reconnection Banner */}
      {isOnline && showReconnectedBanner && !isSyncing && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="bg-emerald-600/90 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shadow-sm backdrop-blur-sm sticky top-0 z-[100] transition-opacity duration-300"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
          <span>Connection restored — you are back online.</span>
        </aside>
      )}

      {children}
    </NetworkStatusContext.Provider>
  );
}
