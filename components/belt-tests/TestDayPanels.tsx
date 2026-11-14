'use client';
import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { academyDate } from '@/lib/dates';
import type { CandidateRow, EventDetail } from '@/lib/belt-test-contract';
import type { useBeltTestActions } from './use-belt-tests';
import { Badge, cardClass, FEE_LABEL, inputClass, Labeled, primaryButton, secondaryButton, usd } from './ui';

type Actions = ReturnType<typeof useBeltTestActions>;
const SCORING_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const FEE_METHODS = ['Cash', 'Bank transfer', 'KHQR', 'Card', 'Other'];
const omit = <T,>(record: Record<string, T>, key: string) => Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

/** Requests students made in the student portal; a head coach or admin approves or declines each. */
export function RequestsPanel({ detail, actions }: { detail: EventDetail; actions: Actions }) {
  const requests = detail.candidates.filter(row => row.status === 'requested');
  const [declining, setDeclining] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string | undefined>>({});
  // Ask for an override reason only when approval failed because the student is no longer eligible.
  const [lastApproval, setLastApproval] = useState<string | null>(null);
  const needsOverride = /no longer eligible/i.test(actions.error);
  if (!requests.length) return null;
  return <section aria-label="Student requests" className={cardClass + ' space-y-3'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Student requests ({requests.length})</h3>
      <span className="text-xs text-neutral-500">Requested in the student portal. Approving registers the student and holds their place.</span></div>
    <ul className="space-y-2">{requests.map(row => {
      const decline = declining[row.id], override = overrides[row.id] ?? (lastApproval === row.id && needsOverride ? '' : undefined);
      return <li key={row.id} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">{row.student?.english_name ?? row.student_id} <span className="font-normal text-neutral-500">{row.student?.khmer_name} · {row.student_id}</span></span>
          <span className="text-xs text-neutral-500">Requested {row.requested_at ? new Date(row.requested_at).toLocaleDateString() : ''}</span>
        </div>
        {decline === undefined ? <div className="flex flex-wrap items-end gap-2">
          {override !== undefined && <div className="min-w-[14rem] flex-1"><Labeled label="Reason to approve although no longer eligible"><input className={inputClass} minLength={5} maxLength={500} value={override} onChange={event => setOverrides({ ...overrides, [row.id]: event.target.value })} /></Labeled></div>}
          <button type="button" className={primaryButton} disabled={actions.busy || (override !== undefined && override.trim().length < 5)}
            onClick={async () => { setLastApproval(row.id); if (override !== undefined) setOverrides(current => ({ ...current, [row.id]: override }));
              await actions.run({ action: 'approve_request', id: row.id, ...(override !== undefined ? { overrideReason: override.trim() } : {}) }, detail.event.kind === 'kukkiwon' ? 'Request approved: student nominated.' : 'Request approved: student registered.'); }}>Approve</button>
          <button type="button" className={secondaryButton} disabled={actions.busy} onClick={() => setDeclining({ ...declining, [row.id]: '' })}>Decline</button>
        </div> : <form className="flex flex-wrap items-end gap-2" onSubmit={async event => { event.preventDefault();
          if (await actions.run({ action: 'decline_request', id: row.id, reason: decline.trim() }, 'Request declined. The student sees your reason.')) setDeclining(current => omit(current, row.id)); }}>
          <div className="min-w-[14rem] flex-1"><Labeled label="Reason the student will see"><input className={inputClass} required minLength={5} maxLength={500} value={decline} onChange={event => setDeclining({ ...declining, [row.id]: event.target.value })} /></Labeled></div>
          <button type="submit" className={primaryButton} disabled={actions.busy || decline.trim().length < 5}>Decline request</button>
          <button type="button" className={secondaryButton} onClick={() => setDeclining(current => omit(current, row.id))}>Keep</button>
        </form>}
      </li>; })}</ul>
  </section>;
}

/**
 * The examiners who score this test day. Without a panel any coach with grading
 * permission may score; with one, only its members score and each item uses their average.
 */
export function ExaminerPanel({ detail, canManage, actions }: { detail: EventDetail; canManage: boolean; actions: Actions }) {
  const { state } = useAppStore();
  const panel = useMemo(() => detail.panel ?? [], [detail.panel]);
  const locked = detail.candidates.some(row => row.status === 'finalized' || row.status === 'promoted') || !!detail.event.cancelled_at;
  // Active scoring staff, plus any panel member who can no longer score so they can be removed.
  const staff = useMemo(() => {
    const active = state.users.filter(user => user.isActive && SCORING_ROLES.includes(user.role)).map(user => ({ id: user.id, name: user.displayName, role: user.role, canScore: true }));
    const former = panel.filter(id => !active.some(user => user.id === id)).map(id => ({ id, name: detail.examiners[id] ?? 'Examiner', role: 'Can no longer score', canScore: false }));
    return [...active, ...former].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.users, panel, detail.examiners]);
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<string[]>(panel);
  const names = panel.map(id => staff.find(user => user.id === id)?.name ?? 'Examiner');
  const save = async () => { if (await actions.run({ action: 'examiners_set', eventId: detail.event.id, examiners: chosen }, chosen.length ? 'Examiner panel saved.' : 'Panel cleared: any coach can score.')) setEditing(false); };
  return <section aria-label="Examiner panel" className={cardClass + ' space-y-2'}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold">Examiners</h3>
      {canManage && !locked && !editing && <button type="button" className={secondaryButton} onClick={() => { setChosen(panel); setEditing(true); }}>{panel.length ? 'Change panel' : 'Set a panel'}</button>}
    </div>
    <p className="text-xs text-neutral-500">{panel.length
      ? `${names.join(', ')}. Each examiner scores every item; the item score is their average (one decimal). Examiners see only their own scores.`
      : 'No panel: any coach with grading permission can score, and an item scored by more than one coach uses their average.'}{locked && panel.length ? ' The panel is locked once a result is finalized.' : ''}</p>
    {editing && <div className="space-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      <fieldset className="grid gap-1.5 sm:grid-cols-2"><legend className="mb-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">Choose up to 5 examiners ({chosen.length}/5)</legend>
        {staff.map(user => { const checked = chosen.includes(user.id);
          return <label key={user.id} className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 px-2 text-sm dark:border-neutral-800">
            <input type="checkbox" checked={checked} disabled={!checked && (chosen.length >= 5 || !user.canScore)} onChange={() => setChosen(current => checked ? current.filter(id => id !== user.id) : [...current, user.id])} />
            <span className="min-w-0 flex-1 truncate">{user.name}</span><span className="text-micro text-neutral-500">{user.role}</span></label>; })}
      </fieldset>
      <div className="flex flex-wrap gap-2"><button type="button" className={primaryButton} disabled={actions.busy} onClick={() => void save()}>Save panel</button>
        <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>Cancel</button></div>
    </div>}
  </section>;
}

/** Test fee status for one registration: tracked for the office only. */
export function FeeEditor({ candidate, canManage, actions }: { candidate: CandidateRow; canManage: boolean; actions: Actions }) {
  const status = candidate.fee_status ?? 'none';
  const label = FEE_LABEL[status] ?? FEE_LABEL.none;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ status: string; amount: string; method: string; reference: string; paidOn: string; waiverReason: string }>({ status: status === 'none' || status === 'unpaid' ? 'paid' : status, amount: candidate.fee_usd == null ? '' : String(candidate.fee_usd), method: candidate.fee_method ?? 'Cash', reference: candidate.fee_reference ?? '', paidOn: candidate.fee_paid_on ?? academyDate(), waiverReason: candidate.fee_waiver_reason ?? '' });
  const amount = form.amount === '' ? undefined : Number(form.amount);
  const invalid = (amount !== undefined && !(amount >= 0 && amount <= 10000)) || (form.status === 'paid' && (!form.method || !form.paidOn)) || (form.status === 'waived' && form.waiverReason.trim().length < 5);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { action: 'fee_update' as const, candidateId: candidate.id, revision: candidate.revision, status: form.status as 'unpaid' | 'paid' | 'waived',
      ...(amount !== undefined ? { amountUsd: amount } : {}),
      ...(form.status === 'paid' ? { method: form.method, paidOn: form.paidOn, ...(form.reference.trim() ? { reference: form.reference.trim() } : {}) } : {}),
      ...(form.status === 'waived' ? { waiverReason: form.waiverReason.trim() } : {}) };
    if (await actions.run(payload, 'Test fee updated.')) setOpen(false);
  };
  const detailText = status === 'paid' ? [candidate.fee_method, candidate.fee_paid_on, candidate.fee_reference].filter(Boolean).join(' · ') : status === 'waived' ? candidate.fee_waiver_reason ?? '' : '';
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge tone={label.tone}>{label.label}{candidate.fee_usd ? ' · ' + usd(candidate.fee_usd) : ''}</Badge>
      {detailText && <span className="text-neutral-500">{detailText}</span>}
      {canManage && !open && <button type="button" className={secondaryButton} onClick={() => setOpen(true)}>{status === 'none' ? 'Add a fee' : 'Update fee'}</button>}
    </div>
    {open && <form onSubmit={submit} className="grid gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-3">
      <Labeled label="Status"><select className={inputClass} value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
        <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="waived">Waived</option></select></Labeled>
      <Labeled label="Amount (USD)"><input className={inputClass} type="number" inputMode="decimal" min={0} max={10000} step={0.01} value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></Labeled>
      {form.status === 'paid' && <>
        <Labeled label="Paid by"><select className={inputClass} value={form.method} onChange={event => setForm({ ...form, method: event.target.value })}>{FEE_METHODS.map(method => <option key={method}>{method}</option>)}</select></Labeled>
        <Labeled label="Paid on"><input className={inputClass} type="date" required max={academyDate()} value={form.paidOn} onChange={event => setForm({ ...form, paidOn: event.target.value })} /></Labeled>
        <Labeled label="Receipt or reference (optional)"><input className={inputClass} maxLength={120} value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} /></Labeled>
      </>}
      {form.status === 'waived' && <div className="sm:col-span-2"><Labeled label="Why the fee is waived"><input className={inputClass} required minLength={5} maxLength={500} value={form.waiverReason} onChange={event => setForm({ ...form, waiverReason: event.target.value })} /></Labeled></div>}
      <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
        <button type="submit" className={primaryButton} disabled={actions.busy || invalid}>Save fee</button>
        <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>}
  </div>;
}
