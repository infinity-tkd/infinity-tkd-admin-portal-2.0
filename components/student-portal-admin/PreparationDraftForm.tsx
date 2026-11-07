'use client';
import { useId, useRef, useState, type ReactNode } from 'react';

export function PreparationDraftForm({ title, busy, children, onSubmit }: { title: string; busy: boolean; children: ReactNode; onSubmit: () => Promise<boolean> }) {
  const id = useId(), working = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  return <form aria-labelledby={id} className="space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800" onSubmit={async event => {
    event.preventDefault();
    if (busy || working.current) return;
    working.current = true; setPending(true); setError('');
    try { await onSubmit(); }
    catch { setError('The draft save could not be confirmed. Keep these changes and refresh before retrying.'); }
    finally { working.current = false; setPending(false); }
    // This is an editing workspace: keep controlled draft values after a save.
  }}>
    <h3 id={id} className="text-sm font-semibold">{title}</h3>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy || pending} className="grid min-w-0 gap-3 sm:grid-cols-2">{children}<button type="submit" className="operation-primary sm:col-span-2">{busy || pending ? 'Saving…' : 'Save private draft'}</button></fieldset>
  </form>;
}
