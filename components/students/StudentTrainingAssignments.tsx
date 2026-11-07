'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { readApiResponse, unwrapApiError } from '@/lib/api-response';
import { trainingAssignmentDataSchema, type TrainingAssignmentData } from '@/lib/student-training-contract';

const field = 'min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#141414]';
const date = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function StudentTrainingAssignments({ studentId }: { studentId: string }) {
  const { can } = useAppStore();
  const allowed = can('page:lms');
  const [data, setData] = useState<TrainingAssignmentData | null>(null), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [reason, setReason] = useState(''), [uncertain, setUncertain] = useState(false);
  const pending = useRef(new Map<string, string>()), activeStudent = useRef(studentId), inFlight = useRef(false);
  activeStudent.current = studentId;
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const id = studentId;
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const response = await fetch(`/api/admin/student-training-plans?${new URLSearchParams({ studentId: id, search })}`, { headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store', signal });
      const result = await readApiResponse(response);
      const parsed = trainingAssignmentDataSchema.safeParse(result.data);
      if (!response.ok || !parsed.success || parsed.data.studentId !== id) throw new Error(unwrapApiError(result, 'Training assignments could not load.'));
      if (!signal?.aborted && activeStudent.current === id) { setData(parsed.data); setUncertain(false); }
    } catch (failure) {
      if (!signal?.aborted && activeStudent.current === id) { setError(failure instanceof Error ? failure.message : 'Training assignments could not load.'); setUncertain(true); }
    } finally { if (!signal?.aborted && activeStudent.current === id) setLoading(false); }
  }, [studentId, search]);
  useEffect(() => { if (!allowed) return; const controller = new AbortController(); const timer = setTimeout(() => void fetchData(controller.signal), 200); return () => { clearTimeout(timer); controller.abort(); }; }, [fetchData, allowed]);
  useEffect(() => { setData(null); setSelected(''); setSearch(''); setReason(''); setFeedback(''); setBusy(false); setUncertain(false); }, [studentId]);
  if (!allowed) return null;
  const current = data?.plans.find(plan => plan.active);
  const manage = data?.canManage && can('action:evaluations_grade');
  const save = async (action: 'ASSIGN' | 'WITHDRAW') => {
    if (inFlight.current || busy || loading || !data || uncertain) return;
    const id = studentId;
    const value = { action, studentId: id, expectedActivePlanId: current?.id ?? null, reason: reason.trim(), ...(action === 'ASSIGN' ? { templateId: selected } : {}) };
    const signature = JSON.stringify(value), key = pending.current.get(signature) ?? crypto.randomUUID();
    pending.current.set(signature, key); inFlight.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const response = await fetch('/api/admin/student-training-plans', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ ...value, requestKey: key }) });
      const result = await readApiResponse(response);
      if (!response.ok || result.data?.saved !== true) throw new Error(unwrapApiError(result, 'The assignment was not confirmed. Refresh before retrying.'));
      pending.current.delete(signature);
      if (activeStudent.current === id) { setFeedback(action === 'ASSIGN' ? 'Training assignment saved. Previous plans remain in history.' : 'Training assignment withdrawn. Its history is retained.'); setReason(''); await fetchData(); }
    } catch (failure) { if (activeStudent.current === id) { setError(failure instanceof Error ? failure.message : 'The assignment could not be confirmed.'); setUncertain(true); } }
    finally { inFlight.current = false; if (activeStudent.current === id) setBusy(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void save('ASSIGN'); };
  return <section aria-label="Student training assignments" className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-[#262626] dark:bg-[#0f0f0f] dark:text-[#E4E4E4]">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Training assignment</h3><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Assigned routines appear in the student portal. Practice does not approve a grade.</p></div><button type="button" className="min-h-11 rounded-lg border px-3 text-xs dark:border-neutral-700" disabled={loading || busy} onClick={() => void fetchData()}>Refresh</button></div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{error}{uncertain && ' Refresh current records before another change.'}</p>}
    {feedback && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    {loading && <p role="status" className="text-xs text-neutral-500">Loading training records…</p>}
    {data && <><div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs text-neutral-500">Current plan</p><p className="mt-1 text-sm font-medium">{current?.title ?? 'No active training assignment'}</p>{current && <p className="mt-1 text-xs text-neutral-500">Assigned {date(current.createdAt)} · Saved exercise snapshot</p>}</div>
      {manage && <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1 text-xs font-medium"><span>Find a routine</span><input className={field} disabled={busy} value={search} onChange={event => { setSearch(event.target.value); setSelected(''); }} maxLength={100} placeholder="Search workout templates"/></label>
        <fieldset disabled={busy || uncertain || loading} className="space-y-3">
        <label className="block space-y-1 text-xs font-medium"><span>Routine to assign</span><select className={field} value={selected} onChange={event => setSelected(event.target.value)} required><option value="">Choose a routine</option>{data.templates.map(template => <option key={template.id} value={template.id} disabled={!template.assignable}>{template.title}{template.assignable ? '' : ' · Review structure in Library'}</option>)}</select></label>
        {!data.templates.length && <p className="text-xs text-neutral-500">No matching routines. Create a valid routine in <Link className="text-red-700 underline dark:text-red-400" href="/library">Library</Link> first.</p>}
        {data.hasMoreTemplates && <p className="text-xs text-neutral-500">Showing the first 50 matches. Narrow the search to find another routine.</p>}
        <label className="block space-y-1 text-xs font-medium"><span>Assignment or withdrawal reason</span><textarea className={field} value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={500} required rows={2}/></label>
        {current && <p className="text-xs text-neutral-500">Assigning a routine replaces the current plan and retains its history.</p>}
        <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50" disabled={!selected || reason.trim().length < 5}>{busy ? 'Saving…' : current ? 'Replace current plan' : 'Assign routine'}</button>{current && <button type="button" className="min-h-11 rounded-lg border px-4 text-xs disabled:opacity-50 dark:border-neutral-700" disabled={reason.trim().length < 5} onClick={() => void save('WITHDRAW')}>Withdraw current plan</button>}</div>
      </fieldset></form>}
      {data.plans.some(plan => !plan.active) && <details className="rounded-lg border p-3 dark:border-neutral-800"><summary className="min-h-11 cursor-pointer text-xs font-medium">Previous assignments</summary><ul className="space-y-3">{data.plans.filter(plan => !plan.active).map(plan => <li key={plan.id} className="border-t pt-3 text-xs dark:border-neutral-800"><p className="font-medium">{plan.title}</p><p className="mt-1 text-neutral-500">Assigned {date(plan.createdAt)}{plan.endedAt ? ` · Ended ${date(plan.endedAt)}` : ''}</p>{plan.endReason && <p className="mt-1 whitespace-pre-wrap">{plan.endReason}</p>}</li>)}</ul>{data.hasMorePlans && <p className="mt-3 text-xs text-neutral-500">Showing the latest 50 assignments. Earlier changes remain in the audit history.</p>}</details>}
    </>}
  </section>;
}
