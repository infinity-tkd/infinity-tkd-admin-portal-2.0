'use client';
import { useState } from 'react';
import { academyDate } from '@/lib/dates';
import { rankingDraftSchema, rankingReviewIssues, type RankingDraft } from '@/lib/student-portal-admin-contract';
import { Field } from '@/components/operations/shared';
import { PreparationDraftForm } from './PreparationDraftForm';
import type { SaveDraft } from './types';

type Entry = Omit<RankingDraft['entries'][number], 'gold' | 'silver' | 'bronze'> & { gold: number | ''; silver: number | ''; bronze: number | '' };
export function RankingDraftEditor({ initial, title: initialTitle = 'Season ranking review', busy, onSave }: { initial?: RankingDraft; title?: string; busy: boolean; onSave: SaveDraft }) {
  const today = academyDate();
  const [title, setTitle] = useState(initialTitle), [seasonStart, setStart] = useState(initial?.seasonStart ?? today.slice(0, 4) + '-01-01'), [seasonEnd, setEnd] = useState(initial?.seasonEnd ?? today), [notes, setNotes] = useState(initial?.reviewNotes ?? '');
  const [entries, setEntries] = useState<Entry[]>(initial?.entries ?? []), [error, setError] = useState('');
  const parsed = rankingDraftSchema.safeParse({ seasonStart, seasonEnd, methodology: 'medal_order', entries, reviewNotes: notes });
  const issues = parsed.success ? rankingReviewIssues(parsed.data) : ['Complete the athlete fields before saving. Unknown medal counts must remain blank until reviewed.'];
  function change(index: number, patch: Partial<Entry>) { setEntries(current => current.map((entry, at) => at === index ? { ...entry, ...patch } : entry)); }
  return <PreparationDraftForm title="Private season ranking draft" busy={busy} onSubmit={async () => { if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Review the athlete entries.'); return false; } setError(''); return onSave('ranking', title, parsed.data); }}>
    <p className="text-xs text-neutral-500 sm:col-span-2">Prepare only reviewed season counts, the approved display identity and real consent references. Nothing is copied automatically from private student achievements, and this form cannot publish a leaderboard.</p>
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
    <Field label="Draft title" wide><input required minLength={2} maxLength={120} value={title} onChange={event => setTitle(event.target.value)}/></Field>
    <Field label="Season starts"><input required type="date" value={seasonStart} onChange={event => setStart(event.target.value)}/></Field><Field label="Season ends"><input required type="date" value={seasonEnd} onChange={event => setEnd(event.target.value)}/></Field>
    <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><p className="text-xs text-neutral-500">Medal order: Gold → Silver → Bronze. Equal totals share rank.</p><button type="button" className="operation-control" disabled={entries.length >= 1000} onClick={() => setEntries([...entries, { student_id: '', display_name: '', consent_reference: '', gold: '', silver: '', bronze: '' }])}>Add reviewed athlete</button></div>
    {entries.map((entry, index) => <div key={index} className="grid gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 sm:col-span-2 sm:grid-cols-3"><Field label="Student ID"><input required pattern="STU-[MF]-[0-9]+" value={entry.student_id} placeholder="STU-M-…" onChange={event => change(index, { student_id: event.target.value })}/></Field><Field label="Approved display name"><input required maxLength={120} value={entry.display_name} onChange={event => change(index, { display_name: event.target.value })}/></Field><Field label="Consent/evidence reference"><input maxLength={200} value={entry.consent_reference} placeholder="May remain pending in this private draft" onChange={event => change(index, { consent_reference: event.target.value })}/></Field>{(['gold', 'silver', 'bronze'] as const).map(medal => <Field key={medal} label={`${medal[0].toUpperCase() + medal.slice(1)} count`}><input required type="number" min={0} max={10000} value={entry[medal]} onChange={event => change(index, { [medal]: event.target.value === '' ? '' : Number(event.target.value) })}/></Field>)}<button type="button" className="operation-control sm:col-span-3" onClick={() => setEntries(entries.filter((_, at) => at !== index))}>Remove athlete {index + 1}</button></div>)}
    <Field label="Private review notes" wide><textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}/></Field>
    {issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300 sm:col-span-2">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
  </PreparationDraftForm>;
}
