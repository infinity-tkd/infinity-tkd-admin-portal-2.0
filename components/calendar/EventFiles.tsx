'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, ArrowUpRight, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { readApiResponse, unwrapApiError } from '@/lib/api-response';
import type { EventAttachment } from './types';
import styles from './calendar.module.css';

function isPrivateFile(file: EventAttachment): boolean {
  try { const url = new URL(file.url), project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''); return Boolean(file.id) && url.origin === project.origin && url.pathname.startsWith('/storage/v1/object/authenticated/academy-events/'); }
  catch { return false; }
}
function safeLink(value: string): string | undefined { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; } }

export function EventFiles({ eventId, files }: { eventId: string; files: EventAttachment[] }) {
  const [pending, setPending] = useState<string | null>(null), [error, setError] = useState('');
  const working = useRef(false), controller = useRef<AbortController | null>(null), urls = useRef(new Set<string>());
  const abort = useCallback(() => controller.current?.abort(), []);
  useEffect(() => { const objects = urls.current; return () => { abort(); for (const url of objects) URL.revokeObjectURL(url); objects.clear(); }; }, [abort]);
  async function download(file: EventAttachment) {
    if (working.current || !file.id) return;
    working.current = true; setPending(file.id); setError('');
    controller.current = new AbortController();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to download this file.');
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/files/${encodeURIComponent(file.id)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(60000)]) });
      if (!response.ok) { const result = await readApiResponse(response); throw new Error(unwrapApiError(result, 'The private file could not be downloaded. Please retry.')); }
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(response.headers.get('content-type')?.split(';')[0] ?? '')) throw new Error('The private file response was unreadable. Please retry.');
      if (Number(response.headers.get('content-length')) > 15 * 1024 * 1024) throw new Error('The file exceeded the download limit.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 15 * 1024 * 1024) throw new Error('The file was empty or exceeded the download limit.');
      const { data: { session: current } } = await supabase.auth.getSession();
      if (controller.current.signal.aborted) return;
      if (current?.user.id !== session.user.id) throw new Error('Your account changed. Reopen the event before downloading.');
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const link = document.createElement('a'); link.href = url; link.download = Array.from(file.label, character => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character).join('') || 'academy-file'; link.click();
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 30000);
    } catch (cause) { if (!controller.current?.signal.aborted) setError(cause instanceof Error ? cause.message : 'The file could not be downloaded.'); }
    finally { working.current = false; setPending(null); }
  }
  if (!files.length) return <p className={styles.muted}>No attachments.</p>;
  return <>{files.map((file, index) => isPrivateFile(file) ? <button type="button" className={styles.file} style={{ width: '100%', textAlign: 'start' }} key={file.id ?? index} disabled={pending !== null} onClick={() => void download(file)}><FileText size={17}/><span style={{ flex: 1 }}>{file.label}<small className={styles.hint}>{pending === file.id ? 'Downloading…' : 'Private file · authorized download'}</small></span><Download size={16}/></button> : <a className={styles.file} key={file.id ?? index} href={safeLink(file.url)} target="_blank" rel="noopener noreferrer"><FileText size={17}/><span style={{ flex: 1 }}>{file.label}<small className={styles.hint}>{file.studentAvailable ? 'Available through the protected student download' : 'External link · student availability requires verification'}</small></span><ArrowUpRight size={16}/></a>)}{error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}</>;
}
