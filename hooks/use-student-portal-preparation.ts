'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';

export function useStudentPortalPreparation<T>(query: string, enabled = true) {
  const { state } = useAppStore();
  const identity = state.currentUser?.id;
  const dataKey = `${identity ?? ''}:${query}`;
  const [snapshot, setSnapshot] = useState<{ key: string; value: T } | null>(null), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const generation = useRef(0), working = useRef(false), attempt = useRef<{ signature: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!identity || !enabled) return;
    const token = ++generation.current;
    setLoading(true);
    try { const next = await portalRequest<T>('/api/admin/student-portal-preparation?' + query); if (token === generation.current) { setSnapshot({ key: `${identity}:${query}`, value: next }); setError(''); } }
    catch (reason) { if (token === generation.current) setError(reason instanceof Error ? reason.message : 'Preparation records could not be loaded.'); }
    finally { if (token === generation.current) setLoading(false); }
  }, [identity, enabled, query]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { setSnapshot(null); setError(''); setFeedback(''); void refresh(); return invalidate; }, [refresh, invalidate]);
  async function run(body: Record<string, unknown>): Promise<{ id: string; revision?: number } | null> {
    if (working.current) return null;
    working.current = true; setBusy(true); setError(''); setFeedback('');
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await portalRequest<{ id: string; revision?: number }>('/api/admin/student-portal-preparation', { ...body, requestKey: attempt.current.key });
      attempt.current = null;
      setFeedback(body.action === 'save_draft' ? 'Draft saved privately. Nothing was published to students.' : 'Recorded with the current actor, timestamp and audit history.');
      await refresh();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Save was not confirmed. Keep this form and refresh before retrying.'); return null; }
    finally { working.current = false; setBusy(false); }
  }
  return { data: snapshot?.key === dataKey && enabled ? snapshot.value : null, loading, busy, error, feedback, refresh, run };
}
