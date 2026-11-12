'use client';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { UserFocus } from '@phosphor-icons/react/dist/csr/UserFocus';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { goalInput, planItemInput } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { fmtDate, Labeled, lmsPost, mondayOf, Pill, StatusLine, StudentSelect, today, useLmsView, useSaving, type Overview } from './coaching-shared';

type PlanItem = { type: 'lesson' | 'form' | 'quiz' | 'custom'; ref?: string; title?: string; target?: string; day?: number | null; note?: string };
interface Plan { id: string; week_start: string; items: PlanItem[]; note: string | null; published_at: string | null; revision: number }
interface Goal { id: string; kind: string; target: number | null; subject_ref: string | null; title: string | null; set_by: 'student' | 'coach'; status: string; starts_on: string; ends_on: string | null }
interface StudentData { goals: Goal[]; plans: Plan[]; forms: { form_id: string; status: string; practice_count: number; best_quiz_percent: number | null; poomsae_forms?: { name: string } | null }[];
  assignments: { assignment_id: string; status: string; assignments?: { title: string; kind: string; due_at: string | null; status: string } | null }[];
  achievements: { code: string; period: string; earned_at: string; awarded_by: string | null }[]; points: number;
  consent: { guardian_name: string; relationship: string; source: string; consented_at: string; revoked_at: string | null } | null }
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOAL_LABEL: Record<string, string> = { weekly_days: 'Days a week', weekly_minutes: 'Minutes a week', lesson: 'Lesson', form: 'Form', belt_exam: 'Belt exam', custom: 'Custom' };

function PlanEditor({ overview, studentId, plans, canEdit, onSaved }: { overview: Overview; studentId: string; plans: Plan[]; canEdit: boolean; onSaved: () => void }) {
  const [week, setWeek] = useState(mondayOf(today()));
  const current = plans.find(p => p.week_start === week) ?? null;
  // The status survives the remount below, so the coach sees the save result.
  const saver = useSaving(onSaved);
  // Remounts with fresh items whenever the week or the saved plan changes.
  return <PlanForm key={`${week}:${current?.revision ?? 0}`} overview={overview} studentId={studentId} week={week} setWeek={setWeek} current={current} canEdit={canEdit} saver={saver} />;
}

function PlanForm({ overview, studentId, week, setWeek, current, canEdit, saver }: { overview: Overview; studentId: string; week: string; setWeek: (week: string) => void; current: Plan | null; canEdit: boolean; saver: ReturnType<typeof useSaving> }) {
  const [items, setItems] = useState<PlanItem[]>(current?.items ?? []);
  const [note, setNote] = useState(current?.note ?? '');
  const { saving, message, setMessage, run } = saver;
  const set = (i: number, change: Partial<PlanItem>) => setItems(items.map((x, at) => at === i ? { ...x, ...change } : x));
  const save = () => {
    const clean = items.map(item => ({ ...item, ref: item.type === 'custom' || item.type === 'quiz' ? item.ref?.trim() || undefined : item.ref, title: item.title?.trim() || undefined, target: item.target?.trim() || undefined, note: item.note?.trim() || undefined }));
    const bad = clean.map(item => planItemInput.safeParse(item)).find(r => !r.success);
    if (bad && !bad.success) { setMessage({ tone: 'error', text: bad.error.issues[0]?.message ?? 'Check the plan items.' }); return; }
    void run(() => lmsPost({ action: 'plan.save', studentId, weekStart: week, expectedRevision: current?.revision, items: clean, note: note.trim() || null }), 'Plan saved.');
  };
  const publish = (action: 'plan.publish' | 'plan.unpublish' | 'plan.delete') => current && run(() => lmsPost({ action, studentId, weekStart: week, expectedRevision: current.revision }), action === 'plan.publish' ? 'Published to the student.' : 'Saved.');
  return <section className={cn(cardClass, 'space-y-2 p-3')}>
    <div className="flex flex-wrap items-end gap-2"><h3 className={cn(sectionLabelClass, 'flex-1')}>Weekly plan</h3>
      <Labeled label="Week of (Monday)"><input type="date" className={fieldClass} value={week} onChange={e => setWeek(mondayOf(e.target.value || today()))} /></Labeled>
      {current && <Pill tone={current.published_at ? 'good' : 'warn'}>{current.published_at ? 'published' : 'draft'}</Pill>}</div>
    {items.length === 0 && <p className="text-xs text-ink-muted">No items this week. A coach&apos;s plan comes first in the student&apos;s daily practice.</p>}
    <ol className="space-y-1.5">{items.map((item, i) => <li key={i} className="grid gap-1.5 rounded-lg border border-line p-2 sm:grid-cols-[110px_1fr_110px_90px_auto]">
      <select aria-label={`Item ${i + 1} type`} className={fieldClass} value={item.type} disabled={!canEdit} onChange={e => set(i, { type: e.target.value as PlanItem['type'], ref: undefined })}><option value="lesson">Lesson</option><option value="form">Form</option><option value="quiz">Quiz</option><option value="custom">Custom</option></select>
      {item.type === 'lesson' ? <select aria-label={`Item ${i + 1} lesson`} className={fieldClass} disabled={!canEdit} value={item.ref ?? ''} onChange={e => set(i, { ref: e.target.value, title: overview.lessons.find(l => String(l.id) === e.target.value)?.title })}><option value="">Choose…</option>{overview.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
        : item.type === 'form' ? <select aria-label={`Item ${i + 1} form`} className={fieldClass} disabled={!canEdit} value={item.ref ?? ''} onChange={e => set(i, { ref: e.target.value, title: overview.forms.find(f => f.id === e.target.value)?.name })}><option value="">Choose…</option>{overview.forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        : <input aria-label={`Item ${i + 1} title`} className={fieldClass} disabled={!canEdit} maxLength={120} placeholder={item.type === 'quiz' ? 'Quiz, e.g. Terms for Yellow' : 'What to do'} value={item.title ?? ''} onChange={e => set(i, { title: e.target.value })} />}
      <input aria-label={`Item ${i + 1} target`} className={fieldClass} disabled={!canEdit} maxLength={60} placeholder="3 x 10" value={item.target ?? ''} onChange={e => set(i, { target: e.target.value })} />
      <select aria-label={`Item ${i + 1} day`} className={fieldClass} disabled={!canEdit} value={item.day ?? ''} onChange={e => set(i, { day: e.target.value ? Number(e.target.value) : null })}><option value="">Any day</option>{DAYS.slice(1).map((d, n) => <option key={d} value={n + 1}>{d}</option>)}</select>
      {canEdit && <button type="button" aria-label={`Remove item ${i + 1}`} className={buttonClass({ size: 'icon', variant: 'ghost' })} onClick={() => setItems(items.filter((_, at) => at !== i))}><Trash className="size-4" /></button>}
    </li>)}</ol>
    {canEdit && <>
      <button type="button" className={buttonClass({ size: 'sm' })} disabled={items.length >= 30} onClick={() => setItems([...items, { type: 'lesson', day: null }])}><Plus className="size-3.5" /> Add item</button>
      <Labeled label="Note to the student"><textarea rows={2} maxLength={1000} className={cn(fieldClass, 'py-2')} value={note} onChange={e => setNote(e.target.value)} /></Labeled>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass()} disabled={saving} onClick={save}>Save</button>
        {current && !current.published_at && <button type="button" className={buttonClass({ variant: 'primary' })} disabled={saving} onClick={() => void publish('plan.publish')}>Publish</button>}
        {current?.published_at && <button type="button" className={buttonClass()} disabled={saving} onClick={() => void publish('plan.unpublish')}>Unpublish</button>}
        {current && <button type="button" className={buttonClass({ variant: 'danger' })} disabled={saving} onClick={() => { if (window.confirm('Delete this week\'s plan?')) void publish('plan.delete'); }}>Delete</button>}
      </div></>}
    <StatusLine message={message} />
  </section>;
}

function Goals({ overview, studentId, goals, canEdit, onSaved }: { overview: Overview; studentId: string; goals: Goal[]; canEdit: boolean; onSaved: () => void }) {
  const [kind, setKind] = useState('weekly_days');
  const [target, setTarget] = useState('3');
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const { saving, message, setMessage, run } = useSaving(onSaved);
  const add = () => {
    const parsed = goalInput.safeParse({ kind, target: target ? Number(target) : null, subjectRef: ref || null, title: title.trim() || null });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the goal.' }); return; }
    void run(() => lmsPost({ action: 'goal.set', studentId, goal: parsed.data }), 'Goal set.');
  };
  const name = (g: Goal) => g.title ?? (g.kind === 'lesson' ? overview.lessons.find(l => String(l.id) === g.subject_ref)?.title : g.kind === 'form' ? overview.forms.find(f => f.id === g.subject_ref)?.name : null) ?? GOAL_LABEL[g.kind];
  return <section className={cn(cardClass, 'space-y-2 p-3')}>
    <h3 className={sectionLabelClass}>Goals</h3>
    {goals.length === 0 ? <p className="text-xs text-ink-muted">No goals yet.</p> : <ul className="space-y-1">{goals.map(g => <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-[10rem] flex-1 text-ink">{name(g)}{g.target ? ` · ${g.target}` : ''}</span><Pill>{g.set_by}</Pill><Pill tone={g.status === 'active' ? 'brand' : g.status === 'done' ? 'good' : 'neutral'}>{g.status}</Pill>
      {canEdit && g.status === 'active' && <><button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' })} disabled={saving} onClick={() => void run(() => lmsPost({ action: 'goal.done', studentId, goalId: g.id }))}>Done</button>
        <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' })} disabled={saving} onClick={() => void run(() => lmsPost({ action: 'goal.drop', studentId, goalId: g.id }))}>Drop</button></>}
    </li>)}</ul>}
    {canEdit && <div className="grid gap-2 sm:grid-cols-[160px_1fr_110px_auto] sm:items-end">
      <Labeled label="New goal"><select className={fieldClass} value={kind} onChange={e => { setKind(e.target.value); setRef(''); }}>{Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Labeled>
      {kind === 'lesson' ? <Labeled label="Lesson"><select className={fieldClass} value={ref} onChange={e => setRef(e.target.value)}><option value="">Choose…</option>{overview.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></Labeled>
        : kind === 'form' ? <Labeled label="Form"><select className={fieldClass} value={ref} onChange={e => setRef(e.target.value)}><option value="">Choose…</option>{overview.forms.filter(f => f.published).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Labeled>
        : <Labeled label="In words (optional)"><input className={fieldClass} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></Labeled>}
      <Labeled label="Target"><input type="number" min={1} className={fieldClass} value={target} onChange={e => setTarget(e.target.value)} /></Labeled>
      <button type="button" className={buttonClass()} disabled={saving} onClick={add}>Set</button></div>}
    <StatusLine message={message} />
  </section>;
}

function Consent({ studentId, consent, canEdit, onSaved }: { studentId: string; consent: StudentData['consent']; canEdit: boolean; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<'parent' | 'guardian' | 'self'>('parent');
  const { saving, message, run } = useSaving(onSaved);
  const active = consent && !consent.revoked_at;
  return <section className={cn(cardClass, 'space-y-2 p-3')}>
    <h3 className={sectionLabelClass}>Video consent</h3>
    <p className="text-sm text-ink">{active ? `Given by ${consent!.guardian_name} (${consent!.relationship}, ${consent!.source === 'portal' ? 'in the portal' : 'recorded by staff'}) on ${fmtDate(consent!.consented_at)}.` : consent?.revoked_at ? `Withdrawn on ${fmtDate(consent.revoked_at)}.` : 'Not given yet. Families agree in the portal before the first upload.'}</p>
    {canEdit && (active
      ? <button type="button" className={buttonClass({ size: 'sm', variant: 'danger' })} disabled={saving} onClick={() => { if (window.confirm('Withdraw video consent? New uploads stop; videos already sent stay until their deletion date.')) void run(() => lmsPost({ action: 'consent.record', studentId, consent: { revoke: true } }), 'Consent withdrawn.'); }}>Withdraw consent</button>
      : <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-end">
        <Labeled label="Guardian's name (consent given on paper)"><input className={fieldClass} maxLength={120} value={name} onChange={e => setName(e.target.value)} /></Labeled>
        <Labeled label="Relationship"><select className={fieldClass} value={relationship} onChange={e => setRelationship(e.target.value as typeof relationship)}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Adult student</option></select></Labeled>
        <button type="button" className={buttonClass()} disabled={saving || name.trim().length < 2} onClick={() => void run(() => lmsPost({ action: 'consent.record', studentId, consent: { guardianName: name.trim(), relationship } }), 'Consent recorded.')}>Record</button></div>)}
    <StatusLine message={message} />
  </section>;
}

export function StudentCoachingPanel({ overview, canEdit }: { overview: Overview; canEdit: boolean }) {
  const [studentId, setStudentId] = useState('');
  const { data, error, reload } = useLmsView<StudentData>('student', `id=${encodeURIComponent(studentId)}`, Boolean(studentId));
  const refresh = () => void reload();
  return <div className="space-y-3">
    <div className="max-w-md"><StudentSelect overview={overview} value={studentId} onChange={setStudentId} /></div>
    {!studentId ? <EmptyState icon={<UserFocus />} title="Choose a student" description="Set their weekly plan and goals, see form progress, tasks and awards, and record video consent." />
      : error ? <ErrorBanner title="Student unavailable">{error}</ErrorBanner>
      : !data ? <EmptyState busy title="Loading…" />
      : <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3 lg:col-span-2"><PlanEditor key={studentId} overview={overview} studentId={studentId} plans={data.plans} canEdit={canEdit} onSaved={refresh} /></div>
        <Goals overview={overview} studentId={studentId} goals={data.goals} canEdit={canEdit} onSaved={refresh} />
        <Consent studentId={studentId} consent={data.consent} canEdit={canEdit} onSaved={refresh} />
        <section className={cn(cardClass, 'space-y-1.5 p-3')}><h3 className={sectionLabelClass}>Forms</h3>
          {data.forms.length === 0 ? <p className="text-xs text-ink-muted">No form practice yet.</p> : data.forms.map(f => <p key={f.form_id} className="flex flex-wrap items-center gap-2 text-sm"><span className="flex-1 text-ink">{f.poomsae_forms?.name ?? 'Form'}</span><Pill tone={f.status === 'mastered' ? 'good' : f.status === 'ready_for_review' ? 'warn' : 'neutral'}>{f.status.replaceAll('_', ' ')}</Pill><span className="text-xs text-ink-muted">{f.practice_count} runs{f.best_quiz_percent != null ? ` · quiz ${f.best_quiz_percent}%` : ''}</span></p>)}</section>
        <section className={cn(cardClass, 'space-y-1.5 p-3')}><h3 className={sectionLabelClass}>Tasks and awards · {data.points} points</h3>
          {data.assignments.map(a => <p key={a.assignment_id} className="flex flex-wrap items-center gap-2 text-sm"><span className="flex-1 text-ink">{a.assignments?.title}</span><Pill>{a.status.replace('_', ' ')}</Pill></p>)}
          {data.achievements.map(a => <p key={`${a.code}:${a.period}`} className="text-xs text-ink-muted">🏅 {overview.achievements.find(d => d.code === a.code)?.title ?? a.code}{a.period ? ` · ${a.period}` : ''} · {fmtDate(a.earned_at)}</p>)}
          {data.assignments.length === 0 && data.achievements.length === 0 && <p className="text-xs text-ink-muted">Nothing yet.</p>}</section>
      </div>}
  </div>;
}
