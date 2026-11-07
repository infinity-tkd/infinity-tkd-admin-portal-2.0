'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import type { CalendarData, EventRecord } from './types';

export function useCalendarEvents(from: string, to: string) {
  const { state } = useAppStore();
  const identity = state.currentUser?.id;
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const generation = useRef(0), working = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const url = '/api/admin/events?' + new URLSearchParams({ from, to });
  const refresh = useCallback(async (cursor?: string) => {
    if (!identity) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const result = await portalRequest<CalendarData>(url + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
      if (current !== generation.current) return;
      // A malformed payload shows the inline Retry state instead of crashing the calendar view.
      if (!Array.isArray(result?.events) || !result.permissions || !result.lookups) throw new Error('The calendar returned an unexpected response. Please retry.');
      setData(previous => cursor && previous ? { ...result, events: [...new Map([...previous.events, ...result.events].map(event => [event.id, event])).values()] } : result);
      setError('');
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Events could not be loaded. Please retry.'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [identity, url]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { setData(null); setError(''); void refresh(); return invalidate; }, [refresh, invalidate]);
  useEffect(() => { const reload = () => { if (!document.hidden && navigator.onLine) void refresh(); }; window.addEventListener('online', reload); return () => window.removeEventListener('online', reload); }, [refresh]);
  const run = async (path: string, body: Record<string, unknown>, method = 'POST'): Promise<EventRecord | null> => {
    if (working.current) return null;
    working.current = true; setBusy(true); setError(''); setFeedback('');
    const signature = JSON.stringify({ path, method, body });
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await portalRequest<{ event: EventRecord; queued?:number; notificationCount?:number }>(path, { ...body, requestKey: attempt.current.key }, method);
      attempt.current = null;
      setData(previous => previous ? { ...previous, events: [...previous.events.filter(event => event.id !== result.event.id), result.event] } : previous);
      const announced=path.endsWith('/notices')||body.notifyStudents===true;
      setFeedback(announced && result.notificationCount!==undefined ? result.notificationCount===0?'Saved. No eligible student accounts matched this audience. Review account links before notifying again.':result.queued===0?'This revision is already in the student inboxes.':`Saved. Notification added to ${result.queued} student inbox${result.queued===1?'':'es'}.`:'Saved. The activity history has been updated.');
      window.dispatchEvent(new Event('portal:calendar-saved'));
      return result.event;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The save was not confirmed. Refresh before retrying.'); return null; }
    finally { working.current = false; setBusy(false); }
  };
  return { data, loading, busy, error, feedback, refresh, run };
}
