'use client';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, cardClass, fieldClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { CHALLENGE_GOALS, challengeInput, type LmsAudience } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { AudiencePicker, audienceSummary, Labeled, LessonSelect, lmsPost, Pill, StatusLine, today, TranslationFields, useLmsView, useSaving, type Overview } from './coaching-shared';

type Goal = typeof CHALLENGE_GOALS[number];
interface Challenge { id: string; title: string; description: string | null; goal_kind: Goal; goal_target: number; subject_type: 'lesson' | 'form' | 'quiz' | null; subject_ref: string | null;
  starts_on: string; ends_on: string; audience: LmsAudience; points: number; badge_code: string | null; translations: Record<string, any>; status: 'draft' | 'published' | 'closed'; revision: number; tally: { joined: number; completed: number } }
const GOAL_LABEL: Record<Goal, string> = { reps: 'Reps of a technique', sessions: 'Practice sessions', streak_days: 'Days in a row', minutes: 'Minutes of practice', quiz_pass: 'Quizzes passed (70%+)', form_mastered: 'Forms marked mastered' };
const SUBJECTS: Record<Goal, ('lesson' | 'form' | 'quiz')[]> = { reps: ['lesson'], sessions: ['lesson'], streak_days: ['lesson'], minutes: [], quiz_pass: ['quiz'], form_mastered: ['form'] };
const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function ChallengeEditor({ overview, editing, onClose, onSaved }: { overview: Overview; editing: Challenge | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [goal, setGoal] = useState<Goal>(editing?.goal_kind ?? 'reps');
  const [target, setTarget] = useState(String(editing?.goal_target ?? 50));
  const [subjectRef, setSubjectRef] = useState(editing?.subject_ref ?? '');
  const [startsOn, setStartsOn] = useState(editing?.starts_on ?? today());
  const [endsOn, setEndsOn] = useState(editing?.ends_on ?? addDays(today(), 6));
  const [audience, setAudience] = useState<LmsAudience>(editing?.audience ?? { all: true });
  const [points, setPoints] = useState(String(editing?.points ?? 20));
  const [badge, setBadge] = useState(editing?.badge_code ?? '');
  const [translations, setTranslations] = useState<Record<string, any>>(editing?.translations ?? {});
  const { saving, message, setMessage, run } = useSaving();
  const locked = Boolean(editing && editing.status !== 'draft');
  const subjectType = SUBJECTS[goal][0] ?? null;
  const save = () => {
    const parsed = challengeInput.safeParse({ title, description: description.trim() || null, goalKind: goal, goalTarget: Number(target), subjectType: subjectRef ? subjectType : null, subjectRef: subjectRef || null,
      startsOn, endsOn, audience, points: Number(points) || 0, badgeCode: badge || null, translations });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the challenge.' }); return; }
    void run(async () => { await lmsPost({ action: 'challenge.save', id: editing?.id, expectedRevision: editing?.revision, challenge: parsed.data }); onSaved(); onClose(); });
  };
  return <Dialog onClose={onClose} size="xl" locked={saving}>
    <DialogHeader icon={<Flag weight="bold" />} title={editing ? 'Edit challenge' : 'New challenge'} description="Counted from each student's own practice; never ranked between students" onClose={saving ? undefined : onClose} />
    <DialogBody className="space-y-3">
      <Labeled label="Title"><input className={fieldClass} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Practise 50 front kicks" /></Labeled>
      <Labeled label="Description"><textarea rows={2} maxLength={2000} className={cn(fieldClass, 'py-2')} value={description} onChange={e => setDescription(e.target.value)} /></Labeled>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Goal"><select className={fieldClass} value={goal} disabled={locked} onChange={e => { setGoal(e.target.value as Goal); setSubjectRef(''); }}>{CHALLENGE_GOALS.map(g => <option key={g} value={g}>{GOAL_LABEL[g]}</option>)}</select></Labeled>
        <Labeled label="Target"><input type="number" min={1} className={fieldClass} disabled={locked} value={target} onChange={e => setTarget(e.target.value)} /></Labeled>
      </div>
      {subjectType === 'lesson' && <LessonSelect overview={overview} value={subjectRef} onChange={setSubjectRef} label="Only this lesson (optional)" />}
      {subjectType === 'form' && <Labeled label="Only this form (optional)"><select className={fieldClass} value={subjectRef} onChange={e => setSubjectRef(e.target.value)}><option value="">Any form</option>{overview.forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Labeled>}
      {subjectType === 'quiz' && <Labeled label="Only this quiz (optional): scope:reference, e.g. terminology:Basics"><input className={fieldClass} maxLength={120} value={subjectRef} onChange={e => setSubjectRef(e.target.value.trim())} /></Labeled>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Labeled label="Starts"><input type="date" className={fieldClass} value={startsOn} onChange={e => setStartsOn(e.target.value)} /></Labeled>
        <Labeled label="Ends"><input type="date" className={fieldClass} value={endsOn} onChange={e => setEndsOn(e.target.value)} /></Labeled>
        <Labeled label="Points"><input type="number" min={0} max={1000} className={fieldClass} value={points} onChange={e => setPoints(e.target.value)} /></Labeled>
        <Labeled label="Badge (optional)"><select className={fieldClass} value={badge} onChange={e => setBadge(e.target.value)}><option value="">No badge</option>{overview.achievements.filter(a => a.active).map(a => <option key={a.code} value={a.code}>{a.title}</option>)}</select></Labeled>
      </div>
      <AudiencePicker overview={overview} value={audience} onChange={setAudience} />
      <TranslationFields fields={[{ key: 'title', label: 'Title', max: 160 }, { key: 'description', label: 'Description', multiline: true, max: 2000 }]} value={translations} onChange={setTranslations} />
      <StatusLine message={message} />
    </DialogBody>
    <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Cancel</button>
      <button type="button" className={buttonClass({ variant: 'primary' })} onClick={save} disabled={saving}>{editing ? 'Save' : 'Save draft'}</button></DialogFooter>
  </Dialog>;
}

export function ChallengesPanel({ overview, canEdit }: { overview: Overview; canEdit: boolean }) {
  const { data, error, reload } = useLmsView<{ challenges: Challenge[] }>('challenges');
  const [editing, setEditing] = useState<Challenge | null | 'new'>(null);
  const { saving, message, run } = useSaving(() => void reload());
  if (error) return <ErrorBanner title="Challenges unavailable">{error}</ErrorBanner>;
  if (!data) return <EmptyState busy title="Loading…" />;
  const act = (c: Challenge, action: 'challenge.publish' | 'challenge.close' | 'challenge.delete', done: string) => run(() => lmsPost({ action, id: c.id, expectedRevision: c.revision }), done);
  return <div className="space-y-3">
    {canEdit && <button type="button" className={buttonClass({ variant: 'primary' })} onClick={() => setEditing('new')}><Plus className="size-4" weight="bold" /> New challenge</button>}
    <StatusLine message={message} />
    {data.challenges.length === 0 ? <EmptyState icon={<Flag />} title="No challenges yet" description="Weekly goals such as 50 front kicks, a 7-day stretching streak or 3 home sessions." />
      : <ul className="space-y-2">{data.challenges.map(c => <li key={c.id} className={cn(cardClass, 'space-y-2 p-3')}>
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-ink">{c.title}</h3>
          <Pill tone={c.status === 'published' ? 'brand' : c.status === 'closed' ? 'neutral' : 'warn'}>{c.status}</Pill>
          <span className="text-xs text-ink-muted">{GOAL_LABEL[c.goal_kind]}: {c.goal_target} · {c.starts_on} → {c.ends_on} · {c.points} pts · {audienceSummary(overview, c.audience)}</span></div>
        <p className="text-xs text-ink-muted">{c.tally.joined} started · {c.tally.completed} completed</p>
        {canEdit && <div className="flex flex-wrap gap-1.5">
          <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => setEditing(c)}>Edit</button>
          {c.status === 'draft' && <button type="button" className={buttonClass({ size: 'sm', variant: 'primary' })} disabled={saving} onClick={() => void act(c, 'challenge.publish', 'Published.')}>Publish</button>}
          {c.status === 'published' && <button type="button" className={buttonClass({ size: 'sm' })} disabled={saving} onClick={() => void act(c, 'challenge.close', 'Closed.')}>Close</button>}
          <button type="button" className={buttonClass({ size: 'sm', variant: 'danger' })} disabled={saving} onClick={() => { if (window.confirm(`Delete "${c.title}"? This cannot be undone.`)) void act(c, 'challenge.delete', 'Deleted.'); }}>Delete</button>
        </div>}
      </li>)}</ul>}
    {editing && <ChallengeEditor overview={overview} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />}
  </div>;
}
