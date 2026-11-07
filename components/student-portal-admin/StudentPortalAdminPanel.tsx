'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useStudentPortalPreparation } from '@/hooks/use-student-portal-preparation';
import { rankingDraftSchema, readinessDraftSchema } from '@/lib/student-portal-admin-contract';
import { Field, OperationForm, OperationSection, text } from '@/components/operations/shared';
import { ReadinessDraftEditor } from './ReadinessDraftEditor';
import { RankingDraftEditor } from './RankingDraftEditor';
import { LessonConfirmationPanel } from './LessonConfirmationPanel';
import type { PreparationDraft, PreparationOverview, SaveDraft } from './types';

export function StudentPortalAdminPanel() {
  const { state, can } = useAppStore();
  const reviewer = ['Root', 'Super Root', 'Admin', 'Head Coach'].includes(state.currentUser?.role ?? '');
  const api = useStudentPortalPreparation<PreparationOverview>('view=overview', reviewer);
  const [tab, setTab] = useState<'readiness' | 'ranking' | 'confirmations'>(reviewer ? 'readiness' : 'confirmations'), [editing, setEditing] = useState<PreparationDraft | null>(null), [newVersion, setNewVersion] = useState(0);
  const canWrite = can('action:evaluations_grade');
  const tabs = reviewer ? [['readiness', 'Readiness drafts'], ['ranking', 'Ranking drafts'], ['confirmations', 'Coach confirmations']] as const : [['confirmations', 'Coach confirmations']] as const;
  const save: SaveDraft = async (kind, title, payload) => {
    const result = await api.run({ action: 'save_draft', kind, title, payload, revision: editing?.revision ?? 0, ...(editing ? { id: editing.id } : {}) });
    if (!result || !result.revision) return false;
    setEditing({ id: result.id, kind, title, payload, revision: result.revision });
    return true;
  };
  const parsedReadiness = editing?.kind === 'readiness' ? readinessDraftSchema.safeParse(editing.payload) : null;
  const parsedRanking = editing?.kind === 'ranking' ? rankingDraftSchema.safeParse(editing.payload) : null;
  return <div className="space-y-4">
    <header className="space-y-2"><h2 className="text-lg font-semibold">Student portal preparation</h2><p className="max-w-3xl text-sm text-neutral-500">Prepare academy requirements and consented season lists privately. Actual publication remains an academy approval step; this workspace has no publish action.</p></header>
    <nav aria-label="Student portal preparation sections" className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} type="button" className={`operation-control ${tab === key ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : ''}`} aria-pressed={tab === key} onClick={() => { setTab(key); setEditing(null); }}>{label}</button>)}</nav>
    {tab === 'confirmations' ? <LessonConfirmationPanel/> : reviewer && <OperationSection title={tab === 'readiness' ? 'Requirements for academy review' : 'Season list for academy review'} {...api} onRefresh={() => void api.refresh()}>
      <div className="grid gap-3 sm:grid-cols-3"><p className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">Private drafts<strong className="mt-1 block text-lg">{api.data?.drafts.length ?? '—'}</strong></p><p className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">Current stored policies<strong className="mt-1 block text-lg">{api.data?.policies.length ?? '—'}</strong></p><p className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">Current ranking publications<strong className="mt-1 block text-lg">{api.data?.currentRankingCount ?? '—'}</strong></p></div>
      {api.data && <><div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="Existing private draft"><select value={editing?.id ?? ''} onChange={event => setEditing(api.data?.drafts.find(draft => draft.id === event.target.value) ?? null)}><option value="">Start a new private draft</option>{api.data.drafts.filter(draft => draft.kind === tab).map(draft => <option key={draft.id} value={draft.id}>{draft.title} · Revision {draft.revision}</option>)}</select></Field></div><button type="button" className="operation-control" onClick={() => { setEditing(null); setNewVersion(current => current + 1); }}>New draft</button></div>
        {editing && (parsedReadiness && !parsedReadiness.success || parsedRanking && !parsedRanking.success) ? <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">This stored draft needs a contract review. Its contents have been preserved; it was not replaced with empty defaults.</p> : canWrite ? tab === 'readiness' ? <ReadinessDraftEditor key={`${editing?.id ?? 'new'}:${newVersion}`} title={editing?.title} initial={parsedReadiness?.success ? parsedReadiness.data : undefined} curriculum={api.data.curriculum} busy={api.busy} onSave={save}/> : <RankingDraftEditor key={`${editing?.id ?? 'new'}:${newVersion}`} title={editing?.title} initial={parsedRanking?.success ? parsedRanking.data : undefined} busy={api.busy} onSave={save}/> : <p className="text-sm text-neutral-500">Draft editing requires evaluation-management permission.</p>}
        {canWrite && editing && <details><summary className="cursor-pointer text-xs">Archive this private draft</summary><OperationForm title="Archive draft with a reason" busy={api.busy} submitLabel="Archive draft" onSubmit={async form => { const result = await api.run({ action: 'archive_draft', id: editing.id, revision: editing.revision, reason: text(form, 'reason') }); if (result) setEditing(null); return Boolean(result); }}><Field label="Reason" wide><textarea name="reason" minLength={5} maxLength={500} required/></Field></OperationForm></details>}
      </>}
    </OperationSection>}
  </div>;
}
