'use client';
import { useState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { portalRequest } from '@/lib/portal-api';
import { cn } from '@/lib/utils';
import { fmtDate, Labeled, Pill, StatusLine, useLmsView, useSaving, type Overview } from './coaching-shared';

interface Item { student_id: string; student_name: string; current_belt: string; subject_type: string; subject_ref: string; subject_title: string | null; reason: 'still_learning' | 'quiz_failed'; occurrences: number; last_at: string; class_ids: number[] }

/** Lessons and forms a student keeps finding hard (self-checks and quizzes, last 14 days). */
export function AttentionPanel({ overview, canManageSettings, onChanged }: { overview: Overview; canManageSettings: boolean; onChanged: () => void }) {
  const { data, error, reload } = useLmsView<{ items: Item[] }>('attention');
  const [classId, setClassId] = useState('');
  const { saving, message, run } = useSaving(onChanged);
  const togglePush = () => run(() => portalRequest('/api/admin/lms/settings', { studentLmsPushEnabled: !overview.studentLmsPushEnabled }), overview.studentLmsPushEnabled ? 'Phone alerts for LMS notices are off.' : 'Phone alerts for LMS notices are on.');
  if (error) return <ErrorBanner title="Attention list unavailable" action={<button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => void reload()}>Retry</button>}>{error}</ErrorBanner>;
  const items = (data?.items ?? []).filter(item => !classId || item.class_ids.includes(Number(classId)));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-2"><Labeled label="Class" className="min-w-[14rem]"><select className={fieldClass} value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{overview.classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></Labeled></div>
    {!data ? <EmptyState busy title="Loading…" /> : items.length === 0 ? <EmptyState icon={<Warning />} title="Nothing flagged" description={`A lesson or form appears here when a student rates it "still learning" three times, or fails its quiz twice, within 14 days.`} />
      : <ul className="space-y-1.5">{items.map(item => <li key={`${item.student_id}:${item.subject_type}:${item.subject_ref}:${item.reason}`} className={cn(cardClass, 'grid gap-1.5 p-2.5 text-sm md:grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)_auto] md:items-center md:gap-3')}>
        {/* Phones: name, then the lesson or form, then why; one row from tablet width up. */}
        <span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{item.student_name}</span><Pill>{item.current_belt}</Pill></span>
        <span className="min-w-0 break-words text-ink">{item.subject_title ?? item.subject_ref} <span className="text-xs text-ink-muted">({item.subject_type})</span></span>
        <span className="flex flex-wrap items-center gap-2"><Pill tone="warn">{item.reason === 'still_learning' ? `still learning ×${item.occurrences}` : `quiz failed ×${item.occurrences}`}</Pill>
          <span className="text-xs text-ink-muted">{fmtDate(item.last_at)}</span></span></li>)}</ul>}
    <section className={cn(cardClass, 'space-y-2 p-3')}>
      <h2 className={sectionLabelClass}>Student phone alerts for LMS notices</h2>
      <p className="text-xs text-ink-muted">Reminders, feedback, achievements and announcements always reach the student portal inbox. Turn phone alerts on only after the student portal team confirms their service worker accepts LMS notices.</p>
      <div className="flex items-center gap-2"><Pill tone={overview.studentLmsPushEnabled ? 'good' : 'neutral'}>{overview.studentLmsPushEnabled ? 'On' : 'Off'}</Pill>
        {canManageSettings && <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void togglePush()}>{overview.studentLmsPushEnabled ? 'Turn off' : 'Turn on'}</button>}</div>
      <StatusLine message={message} />
    </section>
  </div>;
}
