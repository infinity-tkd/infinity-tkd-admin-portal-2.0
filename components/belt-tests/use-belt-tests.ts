'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { portalRequest } from '@/lib/portal-api';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import type { BeltTestAction } from '@/lib/belt-test-contract';

/**
 * Live sync: after every saved change the browser broadcasts a content-free
 * "changed" signal; every open Belt Tests screen refetches through the API.
 * The signal carries no data, so the service-only table boundary is unchanged.
 */
const LOCAL_EVENT = 'portal:belt-tests-changed';
let channel: RealtimeChannel | null = null;
function liveChannel() {
  if (!channel) {
    channel = supabase.channel('belt-tests-live');
    channel.on('broadcast', { event: 'changed' }, () => window.dispatchEvent(new Event(LOCAL_EVENT))).subscribe();
  }
  return channel;
}
function announceChange() {
  window.dispatchEvent(new Event(LOCAL_EVENT));
  void liveChannel().send({ type: 'broadcast', event: 'changed', payload: { at: Date.now() } }).catch(() => undefined);
}

export function useBeltTestView<T>(query: Record<string, string> | null, pollMs = 0) {
  const { state } = useAppStore();
  const identity = state.currentUser?.id;
  const url = query ? '/api/belt-tests?' + new URLSearchParams(query) : null;
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!url || !identity) return;
    const current = ++revision.current; setLoading(true);
    try { const value = await portalRequest<T>(url); if (current === revision.current) { setData(value); setError(''); } }
    catch (cause) { if (current === revision.current) setError(cause instanceof Error ? cause.message : 'Belt test records could not load. Retry shortly.'); }
    finally { if (current === revision.current) setLoading(false); }
  }, [url, identity]);
  // Bumping the revision makes any in-flight response for the previous view stale.
  const invalidate = useCallback(() => { revision.current++; }, []);
  useEffect(() => { setData(null); setError(''); void refresh(); return invalidate; }, [refresh, invalidate]);
  useEffect(() => {
    if (!url) return;
    liveChannel();
    const reload = () => { if (!document.hidden) void refresh(); };
    window.addEventListener(LOCAL_EVENT, reload); window.addEventListener('online', reload);
    const timer = pollMs > 0 ? setInterval(reload, pollMs) : undefined;
    return () => { window.removeEventListener(LOCAL_EVENT, reload); window.removeEventListener('online', reload); if (timer) clearInterval(timer); };
  }, [url, pollMs, refresh]);
  return { data, error, loading, refresh };
}

/** Single-flight actions; a retried identical request reuses its key so it is never applied twice. */
export function useBeltTestActions() {
  const { showNotification } = useAppStore();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false), attempt = useRef<{ signature: string; key: string } | null>(null);
  const run = useCallback(async <T = Record<string, unknown>>(action: BeltTestAction, success?: string): Promise<T | null> => {
    if (working.current) return null;
    working.current = true; setBusy(true); setError('');
    const signature = JSON.stringify(action);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await portalRequest<T>('/api/belt-tests', { ...action, requestKey: attempt.current.key });
      attempt.current = null;
      if (success) showNotification(success, 'success');
      announceChange();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change was not confirmed. Refresh before retrying.';
      setError(message); return null;
    } finally { working.current = false; setBusy(false); }
  }, [showNotification]);
  return { run, busy, error, clearError: () => setError('') };
}
