'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { readApiResponse, unwrapApiError } from '@/lib/api-response';
import { libraryCatalogSchema, type LibraryCatalogItem } from '@/lib/library-publication';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';

export function LibraryPublicationPanel({ onClose, onOpenMaterial }: { onClose: () => void; onOpenMaterial: (id: number) => void }) {
  const { refreshData, showNotification } = useAppStore();
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<LibraryCatalogItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: LibraryCatalogItem; action: 'PUBLISH' | 'UNPUBLISH' } | null>(null);
  const [reason, setReason] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useCallback(async (path: string, signal?: AbortSignal, body?: unknown) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in again to manage the student library.');
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + session.access_token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const value = await readApiResponse(response);
    if (!response.ok || value?.success !== true) throw new Error(unwrapApiError(value, 'The student library could not be loaded.'));
    return value.data;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const params = new URLSearchParams({ search, state: filter, limit: '25', offset: String(offset) });
      void request('/api/admin/library-assets?' + params, controller.signal).then(value => {
        const parsed = libraryCatalogSchema.parse(value);
        if (!controller.signal.aborted) { setRows(parsed.items); setHasMore(parsed.hasMore); }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Refresh the library and try again.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filter, offset, request, revision, search]);
  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || busy || reason.trim().length < 5) return;
    setBusy(true); setError('');
    try {
      await request('/api/admin/library-assets', undefined, { action: selected.action, id: selected.row.id, expectedRevision: selected.row.revision, reason: reason.trim() });
      showNotification(selected.action === 'PUBLISH' ? 'The approved lesson is now available in the student library.' : 'The lesson is hidden from the student library. Existing progress is retained.', 'success');
      setSelected(null); setReason(''); setRevision(value => value + 1);
      await refreshData();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The publication could not be confirmed. Refresh before retrying.'); setRevision(value => value + 1); }
    finally { setBusy(false); }
  };
  return <Portal><div className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-950/75 p-3 backdrop-blur-sm sm:p-5">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="student-library-title" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[10px] border border-neutral-200 bg-white shadow-2xl dark:border-[#262626] dark:bg-[#141414]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 p-4 dark:border-[#262626] sm:p-5"><div><p className="mb-1 text-micro font-bold uppercase tracking-widest text-brand-ink">Academy publishing</p><h2 id="student-library-title" className="text-lg font-semibold text-neutral-900 dark:text-white">Student library</h2><p className="mt-1 text-xs leading-relaxed text-neutral-500">Save lessons privately. Publish an approved snapshot when it is ready for students.</p></div><button type="button" disabled={busy} aria-label="Close student library" onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Search student library</span><MagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-neutral-400" size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setOffset(0); setSelected(null); }} placeholder="Search lessons" maxLength={100} className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900" /></label><select aria-label="Publication status" value={filter} onChange={event => { setFilter(event.target.value); setOffset(0); setSelected(null); }} className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"><option value="all">All lessons</option><option value="draft">Private drafts</option><option value="legacy">Legacy publication · review</option><option value="changes">Published · changes pending</option><option value="published">Published · current</option></select></div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error}</p>}
        {selected && <form onSubmit={publish} className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900"><h3 className="text-sm font-semibold">{selected.action === 'PUBLISH' ? 'Publish approved lesson' : 'Unpublish lesson'}</h3><p className="text-xs text-neutral-500">{selected.row.title} · Revision {selected.row.revision}. {selected.action === 'PUBLISH' ? 'Students will receive this version of the lesson text, media and guidance.' : 'Students will no longer see this lesson in the library. Their recorded progress stays intact.'}</p><label className="block text-xs font-medium">Reason<textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" rows={2} /></label><div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || reason.trim().length < 5} className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : selected.action === 'PUBLISH' ? 'Publish lesson' : 'Unpublish lesson'}</button><button type="button" disabled={busy} onClick={() => setSelected(null)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-xs dark:border-neutral-700">Cancel</button></div></form>}
        {loading ? <p role="status" className="py-8 text-center text-sm text-neutral-500">Loading student library…</p> : !rows.length ? <p className="py-8 text-center text-sm text-neutral-500">No lessons match these filters.</p> : <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">{rows.map(row => <li key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-semibold">{row.title}</p><p className="mt-1 text-xs text-neutral-500">{row.libraryType} · {row.targetLevel} · Revision {row.revision}</p><span className="mt-2 inline-flex rounded-md bg-neutral-100 px-2 py-1 text-micro font-semibold dark:bg-neutral-800">{row.state === 'draft' ? 'Private draft' : row.state === 'changes' ? 'Published · changes pending' : row.state === 'legacy' ? 'Legacy publication · review' : 'Published · current'}</span></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => onOpenMaterial(row.id)} className="rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-medium disabled:opacity-40 dark:border-neutral-700">Review draft</button><button type="button" disabled={busy} onClick={() => { setSelected({ row, action: 'PUBLISH' }); setReason(''); }} className="rounded-lg border border-brand/30 px-3 py-2.5 text-xs font-semibold text-brand-ink disabled:opacity-40">{row.state === 'published' ? 'Republish' : 'Publish'}</button>{row.isPublished && <button type="button" disabled={busy} onClick={() => { setSelected({ row, action: 'UNPUBLISH' }); setReason(''); }} className="rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-medium disabled:opacity-40 dark:border-neutral-700">Unpublish</button>}</div></li>)}</ul>}
      </div>
      <footer className="flex shrink-0 items-center justify-between border-t border-neutral-200 p-4 dark:border-neutral-800"><button type="button" disabled={loading || busy || !offset} onClick={() => { setOffset(value => Math.max(0, value - 25)); setSelected(null); }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs disabled:opacity-40 dark:border-neutral-700">Previous</button><span className="text-xs text-neutral-500">Page {Math.floor(offset / 25) + 1}</span><button type="button" disabled={loading || busy || !hasMore} onClick={() => { setOffset(value => value + 25); setSelected(null); }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs disabled:opacity-40 dark:border-neutral-700">Next</button></footer>
    </div>
  </div></Portal>;
}
