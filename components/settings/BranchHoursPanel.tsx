'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import { draftError, draftsFromHours, hoursFromDrafts, type DayDraft } from '@/lib/branch-hours';

const branchHoursResponseSchema = z.object({
  available: z.boolean(),
  branches: z.array(z.object({ id: z.number().int(), name: z.string(), isActive: z.boolean(), openingHours: z.unknown() })),
});
type BranchHours = z.infer<typeof branchHoursResponseSchema>['branches'][number];

/** Opening hours per branch, shown in the student portal's Academy & contact page. */
export function BranchHoursPanel() {
  const { can, showNotification } = useAppStore();
  const canEdit = can('action:staff_manage');
  const [branches, setBranches] = useState<BranchHours[]>([]);
  const [available, setAvailable] = useState(true);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DayDraft[]>(draftsFromHours(null));
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // An unexpected response must never take the rest of Settings down with it.
      const parsed = branchHoursResponseSchema.safeParse(await portalRequest<unknown>('/api/admin/branches/hours'));
      if (!parsed.success) throw new Error('Opening hours could not be loaded. Refresh and try again.');
      const result = parsed.data;
      setAvailable(result.available); setBranches(result.branches);
      setBranchId(current => current ?? result.branches.find(branch => branch.isActive)?.id ?? result.branches[0]?.id ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opening hours could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = branches.find(branch => branch.id === branchId);
  useEffect(() => { setDrafts(draftsFromHours(selected?.openingHours)); }, [selected]);

  const update = (index: number, change: Partial<DayDraft>) => setDrafts(rows => rows.map((row, position) => position === index ? { ...row, ...change } : row));
  const invalid = draftError(drafts);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || saving || invalid) return;
    setSaving(true); setError('');
    try {
      const saved = await portalRequest<{ id?: unknown; openingHours?: unknown }>('/api/admin/branches/hours', { branchId: selected.id, openingHours: hoursFromDrafts(drafts) });
      if (saved?.id !== selected.id) throw new Error('The save was not confirmed. Refresh before trying again.');
      setBranches(rows => rows.map(row => row.id === selected.id ? { ...row, openingHours: saved.openingHours ?? null } : row));
      showNotification(`Opening hours saved for ${selected.name}.`, 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opening hours were not saved.'); }
    finally { setSaving(false); }
  };

  return (
    <section aria-labelledby="branch-hours-title" className="mt-6 space-y-4 rounded-[10px] border border-neutral-200 bg-white p-4 dark:border-[#262626] dark:bg-[#141414] sm:p-5">
      <div>
        <h2 id="branch-hours-title" className="text-sm font-bold text-neutral-900 dark:text-white">Branch opening hours</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">Shown to students on the Academy &amp; contact page, in academy time. Days left as “Not set” show that branch’s class times instead.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error}</p>}
      {!available && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Opening hours need a database update before they can be saved.</p>}
      {loading ? <p role="status" className="text-sm text-neutral-500">Loading branches…</p> : !branches.length ? <p className="text-sm text-neutral-500">No branches found.</p> : (
        <form onSubmit={save} className="space-y-3">
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">Branch
            <select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value))} className="mt-1 block h-10 w-full max-w-xs rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}{branch.isActive ? '' : ' (inactive)'}</option>)}
            </select>
          </label>
          <fieldset disabled={!canEdit || !available || saving} className="space-y-2">
            <legend className="sr-only">Opening hours by day</legend>
            {drafts.map((draft, index) => (
              <div key={draft.day} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-10 font-semibold text-neutral-800 dark:text-neutral-200">{draft.day}</span>
                <select aria-label={`${draft.day} status`} value={draft.mode} onChange={event => update(index, { mode: event.target.value as DayDraft['mode'], ...(event.target.value === 'open' && !draft.opens ? { opens: '08:00', closes: '20:00' } : {}) })} className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="unset">Not set</option><option value="open">Open</option><option value="closed">Closed</option>
                </select>
                {draft.mode === 'open' && <>
                  <input type="time" aria-label={`${draft.day} opens`} value={draft.opens} onChange={event => update(index, { opens: event.target.value })} className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-700 dark:bg-neutral-900" />
                  <span aria-hidden="true">–</span>
                  <input type="time" aria-label={`${draft.day} closes`} value={draft.closes} onChange={event => update(index, { closes: event.target.value })} className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-700 dark:bg-neutral-900" />
                </>}
              </div>
            ))}
          </fieldset>
          {invalid && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{invalid}</p>}
          {canEdit ? <button type="submit" disabled={!available || saving || !!invalid} className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save opening hours'}</button>
            : <p className="text-xs text-neutral-500">You can view opening hours. Staff managers can change them.</p>}
        </form>
      )}
    </section>
  );
}
