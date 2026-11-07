'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';

export function useOperations<T>(view: string, params: Record<string, string> = {}, enabled = true) {
  const { state } = useAppStore();
  const identity = state.currentUser?.id;
  const url = '/api/operations?' + new URLSearchParams({ view, ...params });
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const revision = useRef(0), working = useRef(false), attempt = useRef<{ signature: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!identity || !enabled) return;
    const current = ++revision.current; setLoading(true);
    try { const value = await portalRequest<T>(url); if (current === revision.current) { setData(value); setError(''); } }
    catch (error) { if (current === revision.current) setError(error instanceof Error ? error.message : 'Records could not refresh. Retry shortly.'); }
    finally { if (current === revision.current) setLoading(false); }
  }, [url, identity, enabled]);
  const invalidate = useCallback(() => { revision.current++; }, []);
  useEffect(() => { setData(null); setFeedback(''); setError(''); void refresh(); return invalidate; }, [refresh, invalidate]);
  useEffect(() => { const reload = () => { if (!document.hidden && navigator.onLine) void refresh(); }; window.addEventListener('portal:operations-saved', reload); window.addEventListener('online', reload); return () => { window.removeEventListener('portal:operations-saved', reload); window.removeEventListener('online', reload); }; }, [refresh]);
  useEffect(()=>{if(!['health','today'].includes(view))return;const timer=setInterval(()=>{if(!document.hidden&&navigator.onLine)void refresh();},60000);return()=>clearInterval(timer);},[view,refresh]);
  const run = async (body: Record<string, unknown>) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(''); setFeedback('');
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      await portalRequest('/api/operations', { ...body, requestKey: attempt.current.key });
      attempt.current = null; setFeedback('Saved and recorded in the activity history.');
      await refresh(); window.dispatchEvent(new Event('portal:operations-saved')); return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Save was not confirmed. Refresh before retrying.'); return false; }
    finally { working.current = false; setBusy(false); }
  };
  return { data, error, feedback, loading, busy, refresh, run };
}
