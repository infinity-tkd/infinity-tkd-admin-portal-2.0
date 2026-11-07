'use client';
import { cloneElement, isValidElement, useId, useRef, useState, type ReactElement } from 'react';
import './operations.css';

export function OperationSection({ title, children, error, feedback, loading, onRefresh }: { title: string; children: React.ReactNode; error?: string; feedback?: string; loading?: boolean; onRefresh?: () => void }) {
  return <section aria-label={title} className="operations-panel space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{title}</h2>{onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="operation-control">{loading ? 'Refreshing…' : 'Refresh'}</button>}</div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}
    {feedback && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    {loading && <p role="status" className="text-xs text-neutral-500">Loading current records…</p>}{children}
  </section>;
}
export function OperationForm({ title, children, submitLabel = 'Save', busy = false, onSubmit }: { title: string; children: React.ReactNode; submitLabel?: string; busy?: boolean; onSubmit: (data: FormData) => Promise<boolean> }) {
  const ref = useRef(false); const [pending, setPending] = useState(false),[error,setError]=useState(''); const id = useId();
  return <form aria-labelledby={id} onSubmit={async event => { event.preventDefault(); if (ref.current || busy) return; ref.current = true; setPending(true);setError(''); const form = event.currentTarget; try { if (await onSubmit(new FormData(form))) form.reset(); } catch {setError('The action could not be confirmed. Refresh the records before retrying.');} finally { ref.current = false; setPending(false); } }} className="space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
    <h3 id={id} className="text-sm font-semibold">{title}</h3>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<fieldset disabled={busy || pending} className="grid min-w-0 gap-3 sm:grid-cols-2">{children}<button className="operation-primary sm:col-span-2" disabled={busy || pending}>{busy || pending ? 'Saving…' : submitLabel}</button></fieldset>
  </form>;
}
export function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { const id=useId();return <div className={`block min-w-0 space-y-1 text-xs font-medium ${wide ? 'sm:col-span-2' : ''}`}><label htmlFor={id} className="block">{label}</label>{isValidElement(children)?cloneElement(children as ReactElement<{id?:string}>,{id}):children}</div>; }
export const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
export const number = (data: FormData, name: string) => Number(text(data, name));
export const money = (value: unknown) => '$' + Number(value ?? 0).toFixed(2);
export const adminRoles = ['Root', 'Super Root', 'Admin'];
