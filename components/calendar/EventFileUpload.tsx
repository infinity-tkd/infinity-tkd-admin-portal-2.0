'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { readApiResponse, unwrapApiError } from '@/lib/api-response';
import type { EventAttachment } from './types';
import styles from './calendar.module.css';

const maxBytes = 15 * 1024 * 1024;
const types = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export function EventFileUpload({ eventId, disabled, onPending, onUploaded }: {
  eventId: string; disabled: boolean; onPending: (pending: boolean) => void; onUploaded: (file: EventAttachment) => void;
}) {
  const input = useRef<HTMLInputElement>(null), working = useRef(false);
  const active = useRef(true), controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { active.current = false; controller.current?.abort(); }, []);
  useEffect(() => { active.current = true; return cancel; }, [cancel]);
  const [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  async function upload(file: File | undefined) {
    if (!file || disabled || working.current) return;
    setError(''); setFeedback('');
    if (!file.size || file.size > maxBytes) { setError('Choose a nonempty file up to 15 MB.'); return; }
    if (!(types.has(file.type) || !file.type && /\.(pdf|jpe?g|png|webp)$/i.test(file.name))) { setError('Choose a PDF, JPEG, PNG or WebP file.'); return; }
    working.current = true; onPending(true);
    controller.current = new AbortController();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again before uploading.');
      const body = new FormData(); body.append('file', file);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/files`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body, signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(60000)]), cache: 'no-store' });
      const result = await readApiResponse(response);
      if (!response.ok || result.success !== true) throw new Error(unwrapApiError(result, 'The upload was not confirmed. Check the event files before uploading again.'));
      const { data: { session: current } } = await supabase.auth.getSession();
      if (!active.current) return;
      if (current?.user.id !== session.user.id) throw new Error('Your account changed. Reopen the event to check the upload.');
      const attachment = result.data?.attachment;
      if (!attachment || typeof attachment.id !== 'string' || typeof attachment.label !== 'string' || typeof attachment.url !== 'string') throw new Error('The upload response was incomplete. Reopen the event before retrying.');
      onUploaded(attachment as EventAttachment);
      if (input.current) input.current.value = '';
      setFeedback('Uploaded privately. Save the draft and publish it when the file is ready for students.');
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : 'The upload was not confirmed. Check the event before uploading again.'); }
    finally { working.current = false; if (active.current) onPending(false); }
  }
  return <div><input ref={input} aria-label="Upload private event file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }}/><span className={styles.hint}>Private storage · PDF, JPEG, PNG or WebP · up to 15 MB. Uploading does not publish the file.</span>{feedback && <p role="status" className={`${styles.hint} ${styles.success}`}>{feedback}</p>}{error && <p role="alert" className={`${styles.hint} ${styles.error}`}>{error}</p>}</div>;
}
