'use client';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { ASSIGNMENT_KINDS, assignmentInput, type LmsAudience } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { AudiencePicker, audienceSummary, fmtDate, Labeled, LessonSelect, lmsPost, Pill, StatusLine, TranslationFields, useLmsView, useSaving, type Overview } from './coaching-shared';

type Target = { target_type: 'student' | 'class' | 'belt' | 'branch' | 'all'; target_ref: string };
interface Assignment { id: string; title: string; instructions: string; kind: typeof ASSIGNMENT_KINDS[number]; subject_type: 'lesson' | 'form' | null; subject_ref: string | null; target: Record<string, any>;
  due_at: string | null; points: number; rubric: { item: string }[]; translations: Record<string, any>; status: 'draft' | 'published' | 'closed'; revision: number; created_at: string;
  assignment_targets: Target[]; statusCounts: Record<string, number> }
const KIND_LABEL: Record<Assignment['kind'], string> = { practice: 'Practice (reps or sessions)', video: 'Video', written: 'Written answer', quiz: 'Quiz', form: 'Perform a form (video)' };

const toAudience = (targets: Target[]): LmsAudience => {
  if (targets.some(t => t.target_type === 'all')) return { all: true };
  const pick = (type: Target['target_type']) => targets.filter(t => t.target_type === type).map(t => t.target_ref);
  const a: LmsAudience = { belts: pick('belt'), branches: pick('branch'), classes: pick('class'), students: pick('student') };
  for (const key of ['belts', 'branches', 'classes', 'students'] as const) if (!a[key]!.length) delete a[key];
  return a;
};
const toTargets = (a: LmsAudience) => a.all ? [{ type: 'all' as const, ref: '' }] : [
  ...(a.belts ?? []).map(ref => ({ type: 'belt' as const, ref })), ...(a.branches ?? []).map(ref => ({ type: 'branch' as const, ref })),
  ...(a.classes ?? []).map(ref => ({ type: 'class' as const, ref })), ...(a.students ?? []).map(ref => ({ type: 'student' as const, ref }))];
/** datetime-local (Asia/Phnom_Penh) ↔ ISO. */
const toLocal = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : '';
const fromLocal = (value: string) => value ? new Date(`${value}:00+07:00`).toISOString() : null;

function AssignmentEditor({ overview, editing, onClose, onSaved }: { overview: Overview; editing: Assignment | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [instructions, setInstructions] = useState(editing?.instructions ?? '');
  const [kind, setKind] = useState<Assignment['kind']>(editing?.kind ?? 'practice');
  const [subjectType, setSubjectType] = useState<'lesson' | 'form' | ''>(editing?.subject_type ?? '');
  const [subjectRef, setSubjectRef] = useState(editing?.subject_ref ?? '');
  const [reps, setReps] = useState(String(editing?.target?.reps ?? ''));
  const [sessions, setSessions] = useState(String(editing?.target?.sessions ?? ''));
  const [quiz, setQuiz] = useState({ scope: editing?.target?.scope ?? 'form', scopeRef: editing?.target?.scopeRef ?? '', passPercent: String(editing?.target?.passPercent ?? 70) });
  const [due, setDue] = useState(toLocal(editing?.due_at ?? null));
  const [points, setPoints] = useState(String(editing?.points ?? 10));
  const [rubric, setRubric] = useState((editing?.rubric ?? []).map(r => r.item).join('\n'));
  const [audience, setAudience] = useState<LmsAudience>(editing ? toAudience(editing.assignment_targets) : { all: true });
  const [translations, setTranslations] = useState<Record<string, any>>(editing?.translations ?? {});
  const { saving, message, setMessage, run } = useSaving();
  const published = editing && editing.status !== 'draft';
  const save = () => {
    const target = kind === 'practice' ? { ...(reps ? { reps: Number(reps) } : {}), ...(sessions ? { sessions: Number(sessions) } : {}) }
      : kind === 'quiz' ? { scope: quiz.scope, scopeRef: quiz.scopeRef.trim(), passPercent: Number(quiz.passPercent) } : {};
    const parsed = assignmentInput.safeParse({ title, instructions, kind, subjectType: subjectType || null, subjectRef: subjectType ? subjectRef || null : null, target,
      dueAt: fromLocal(due), points: Number(points) || 0, rubric: rubric.split('\n').map(item => item.trim()).filter(Boolean).map(item => ({ item })), targets: toTargets(audience), translations });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the assignment.' }); return; }
    void run(async () => { await lmsPost({ action: 'assignment.save', id: editing?.id, expectedRevision: editing?.revision, assignment: parsed.data }); onSaved(); onClose(); });
  };
  return <Dialog onClose={onClose} size="xl" locked={saving}>
    <DialogHeader icon={<ClipboardText weight="bold" />} title={editing ? 'Edit assignment' : 'New assignment'} description="Students see it in Pending tasks once published" onClose={saving ? undefined : onClose} />
    <DialogBody className="space-y-3">
      <Labeled label="Title"><input className={fieldClass} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></Labeled>
      <Labeled label="Instructions"><textarea rows={4} maxLength={4000} className={cn(fieldClass, 'py-2')} value={instructions} onChange={e => setInstructions(e.target.value)} /></Labeled>
      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Kind"><select className={fieldClass} value={kind} disabled={Boolean(published)} onChange={e => { const k = e.target.value as Assignment['kind']; setKind(k); if (k === 'form' && subjectType !== 'form') { setSubjectType('form'); setSubjectRef(''); } }}>{ASSIGNMENT_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Labeled>
        <Labeled label="Due (Phnom Penh time)"><input type="datetime-local" className={fieldClass} value={due} onChange={e => setDue(e.target.value)} /></Labeled>
        <Labeled label="Points"><input type="number" min={0} max={1000} className={fieldClass} value={points} onChange={e => setPoints(e.target.value)} /></Labeled>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="About"><select className={fieldClass} value={subjectType} onChange={e => { setSubjectType(e.target.value as 'lesson' | 'form' | ''); setSubjectRef(''); }}>
          {kind !== 'form' && <option value="">Nothing specific</option>}<option value="lesson">A lesson</option><option value="form">A poomsae form</option></select></Labeled>
        {subjectType === 'lesson' && <LessonSelect overview={overview} value={subjectRef} onChange={setSubjectRef} />}
        {subjectType === 'form' && <Labeled label="Form"><select className={fieldClass} value={subjectRef} onChange={e => setSubjectRef(e.target.value)}><option value="">Choose a form…</option>{overview.forms.map(f => <option key={f.id} value={f.id}>{f.name}{f.published ? '' : ' (draft)'}</option>)}</select></Labeled>}
      </div>
      {kind === 'practice' && <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Reps to reach"><input type="number" min={1} className={fieldClass} value={reps} onChange={e => setReps(e.target.value)} /></Labeled>
        <Labeled label="Or sessions to log"><input type="number" min={1} max={100} className={fieldClass} value={sessions} onChange={e => setSessions(e.target.value)} /></Labeled></div>}
      {kind === 'quiz' && <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Quiz about"><select className={fieldClass} value={quiz.scope} onChange={e => setQuiz({ ...quiz, scope: e.target.value, scopeRef: '' })}><option value="form">A form</option><option value="lesson">A lesson</option><option value="belt">A belt</option><option value="terminology">Terminology set</option></select></Labeled>
        {quiz.scope === 'form' ? <Labeled label="Form"><select className={fieldClass} value={quiz.scopeRef} onChange={e => setQuiz({ ...quiz, scopeRef: e.target.value })}><option value="">Choose…</option>{overview.forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Labeled>
          : quiz.scope === 'lesson' ? <LessonSelect overview={overview} value={quiz.scopeRef} onChange={scopeRef => setQuiz({ ...quiz, scopeRef })} />
          : quiz.scope === 'belt' ? <Labeled label="Belt"><select className={fieldClass} value={quiz.scopeRef} onChange={e => setQuiz({ ...quiz, scopeRef: e.target.value })}><option value="">Choose…</option>{overview.belts.map(b => <option key={b.id}>{b.belt_name}</option>)}</select></Labeled>
          : <Labeled label="Set name"><input className={fieldClass} maxLength={80} value={quiz.scopeRef} onChange={e => setQuiz({ ...quiz, scopeRef: e.target.value })} /></Labeled>}
        <Labeled label="Pass mark %"><input type="number" min={1} max={100} className={fieldClass} value={quiz.passPercent} onChange={e => setQuiz({ ...quiz, passPercent: e.target.value })} /></Labeled></div>}
      {['video', 'form', 'written'].includes(kind) && <Labeled label="Rubric for the review, one item per line (optional)"><textarea rows={3} className={cn(fieldClass, 'py-2')} value={rubric} onChange={e => setRubric(e.target.value)} placeholder={'Stances\nRhythm\nPower'} /></Labeled>}
      <AudiencePicker overview={overview} value={audience} onChange={setAudience} />
      <TranslationFields fields={[{ key: 'title', label: 'Title', max: 160 }, { key: 'instructions', label: 'Instructions', multiline: true, max: 4000 }]} value={translations} onChange={setTranslations} />
      <StatusLine message={message} />
    </DialogBody>
    <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Cancel</button>
      <button type="button" className={buttonClass({ variant: 'primary' })} onClick={save} disabled={saving}>{editing ? 'Save' : 'Save draft'}</button></DialogFooter>
  </Dialog>;
}

function StudentStatuses({ assignment, canEdit, onChanged }: { assignment: Assignment; canEdit: boolean; onChanged: () => void }) {
  const { data, reload } = useLmsView<{ students: { student_id: string; status: string; progress: Record<string, unknown>; done_at: string | null; note: string | null; students?: { english_name: string } | null }[] }>('assignment', `id=${assignment.id}`);
  // The assignment's counts ("3 open · 1 done") and its review button change too.
  const { saving, message, run } = useSaving(() => { void reload(); onChanged(); });
  if (!data) return <p className="text-xs text-ink-muted">Loading students…</p>;
  if (!data.students.length) return <p className="text-xs text-ink-muted">{assignment.status === 'draft' ? 'Publish to send it to students.' : 'No students match the targets.'}</p>;
  const set = (studentId: string, status: 'done' | 'excused' | 'open') => run(() => lmsPost({ action: 'assignment.student', id: assignment.id, studentId, status, note: null }), 'Saved.');
  return <div className="space-y-1">
    <ul className="divide-y divide-line rounded-lg border border-line">{data.students.map(s => <li key={s.student_id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs">
      <span className="min-w-[10rem] flex-1 font-semibold text-ink">{s.students?.english_name ?? s.student_id}</span><Pill tone={s.status === 'done' ? 'good' : s.status === 'submitted' ? 'warn' : 'neutral'}>{s.status.replace('_', ' ')}</Pill>
      {Object.keys(s.progress).length > 0 && <span className="text-ink-muted">{Object.entries(s.progress).map(([k, v]) => `${k} ${v}`).join(' · ')}</span>}
      {canEdit && <span className="flex gap-1">
        {s.status !== 'done' && <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void set(s.student_id, 'done')}>Done</button>}
        {s.status !== 'excused' && <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void set(s.student_id, 'excused')}>Excuse</button>}
        {['done', 'excused'].includes(s.status) && <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void set(s.student_id, 'open')}>Reopen</button>}
      </span>}</li>)}</ul>
    <StatusLine message={message} /></div>;
}

export function AssignmentsPanel({ overview, canEdit, onReview }: { overview: Overview; canEdit: boolean; onReview?: (assignment: { id: string; title: string }) => void }) {
  const { data, error, reload } = useLmsView<{ assignments: Assignment[] }>('assignments');
  const [editing, setEditing] = useState<Assignment | null | 'new'>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { saving, message, run } = useSaving(() => void reload());
  const { showConfirm } = useAppStore();
  if (error) return <ErrorBanner title="Assignments unavailable">{error}</ErrorBanner>;
  if (!data) return <EmptyState busy title="Loading…" />;
  const act = (a: Assignment, action: 'assignment.publish' | 'assignment.close' | 'assignment.reopen' | 'assignment.delete', done: string) =>
    run(() => lmsPost({ action, id: a.id, expectedRevision: a.revision }), done);
  return <div className="space-y-3">
    {canEdit && <button type="button" className={buttonClass({ variant: 'primary' })} onClick={() => setEditing('new')}><Plus className="size-4" weight="bold" /> New assignment</button>}
    <StatusLine message={message} />
    {data.assignments.length === 0 ? <EmptyState icon={<ClipboardText />} title="No assignments yet" description="Practical, video, written, quiz and form tasks with a due date and points." />
      : <ul className="space-y-2">{data.assignments.map(a => {
        const target = a.assignment_targets.length ? audienceSummary(overview, toAudience(a.assignment_targets)) : '—';
        const counts = Object.entries(a.statusCounts).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(' · ');
        return <li key={a.id} className={cn(cardClass, 'space-y-2 p-3')}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-ink">{a.title}</h3>
            <Pill tone={a.status === 'published' ? 'brand' : a.status === 'closed' ? 'neutral' : 'warn'}>{a.status}</Pill><Pill>{KIND_LABEL[a.kind]}</Pill>
            <span className="text-xs text-ink-muted">Due {fmtDate(a.due_at)} · {a.points} pts · {target}</span></div>
          {counts && <p className="text-xs text-ink-muted">{counts}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} aria-expanded={expanded === a.id} onClick={() => setExpanded(expanded === a.id ? null : a.id)}>Students</button>
            {onReview && (a.statusCounts.submitted ?? 0) > 0 && <button type="button" className={buttonClass({ size: 'sm', variant: 'primary' }) + ' pointer-coarse:min-h-11'} onClick={() => onReview({ id: a.id, title: a.title })}>Review {a.statusCounts.submitted} submitted</button>}
            {canEdit && <>
              <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => setEditing(a)}>Edit</button>
              {a.status === 'draft' && <button type="button" className={buttonClass({ size: 'sm', variant: 'primary' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void act(a, 'assignment.publish', 'Published to students.')}>Publish</button>}
              {a.status === 'published' && <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void act(a, 'assignment.close', 'Closed.')}>Close</button>}
              {a.status === 'closed' && <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void act(a, 'assignment.reopen', 'Reopened.')}>Reopen</button>}
              <button type="button" className={buttonClass({ size: 'sm', variant: 'danger' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => showConfirm(`Delete "${a.title}"? This cannot be undone.`, () => void act(a, 'assignment.delete', 'Deleted.'), 'Delete assignment')}>Delete</button>
            </>}
          </div>
          {expanded === a.id && <div><p className={sectionLabelClass}>Students</p><StudentStatuses assignment={a} canEdit={canEdit} onChanged={() => void reload()} /></div>}
        </li>;
      })}</ul>}
    {editing && <AssignmentEditor overview={overview} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />}
  </div>;
}
