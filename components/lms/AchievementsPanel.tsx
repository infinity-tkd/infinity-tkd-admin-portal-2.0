'use client';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_RULES, achievementDefinitionInput } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { fmtDate, Labeled, lmsPost, Pill, StatusLine, StudentSelect, TranslationFields, useLmsView, useSaving, type Overview } from './coaching-shared';

type RuleKind = typeof ACHIEVEMENT_RULES[number];
interface Definition { code: string; title: string; description: string; icon: typeof ACHIEVEMENT_ICONS[number]; rule: { kind: RuleKind; min?: number; percent?: number; categories?: string[] };
  points: number; repeats: 'once' | 'monthly' | 'per_belt'; active: boolean; translations: Record<string, any>; revision: number }
interface Award { student_id: string; code: string; period: string; earned_at: string; awarded_by: string | null; students?: { english_name: string } | null }
const RULE_LABEL: Record<RuleKind, string> = { lessons_completed: 'Lessons completed', streak_days: 'Days in a row', forms_mastered: 'Forms mastered (coach)', category_completed: 'Every lesson in categories',
  sessions_total: 'Practice sessions', attendance_month: 'Perfect attendance month', quiz_passed: 'Quizzes passed', challenges_completed: 'Challenges completed', manual: 'Coach sign-off' };
const REPEATS = { once: 'Once', monthly: 'Every month', per_belt: 'Once per belt' } as const;

function DefinitionEditor({ overview, editing, onClose, onSaved }: { overview: Overview; editing: Definition | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(editing?.code ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [icon, setIcon] = useState<Definition['icon']>(editing?.icon ?? 'Medal');
  const [kind, setKind] = useState<RuleKind>(editing?.rule.kind ?? 'lessons_completed');
  const [min, setMin] = useState(String(editing?.rule.min ?? 10));
  const [percent, setPercent] = useState(String(editing?.rule.percent ?? 70));
  const [categories, setCategories] = useState<string[]>(editing?.rule.categories ?? []);
  const [points, setPoints] = useState(String(editing?.points ?? 20));
  const [repeats, setRepeats] = useState<Definition['repeats']>(editing?.repeats ?? 'once');
  const [active, setActive] = useState(editing?.active ?? true);
  const [translations, setTranslations] = useState<Record<string, any>>(editing?.translations ?? {});
  const { saving, message, setMessage, run } = useSaving();
  const counted = !['manual', 'category_completed', 'attendance_month'].includes(kind);
  const save = () => {
    const rule = { kind, ...(counted ? { min: Number(min) } : {}), ...(kind === 'quiz_passed' ? { percent: Number(percent) } : {}), ...(kind === 'category_completed' ? { categories } : {}) };
    const parsed = achievementDefinitionInput.safeParse({ title, description, icon, rule, points: Number(points) || 0, repeats: kind === 'attendance_month' ? 'monthly' : repeats, active, translations });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the achievement.' }); return; }
    if (!editing && !/^[a-z][a-z0-9_]{1,59}$/.test(code)) { setMessage({ tone: 'error', text: 'Use a code of lowercase letters, numbers and underscores, e.g. kicks_100.' }); return; }
    void run(async () => { await lmsPost({ action: 'achievement.save', code: editing?.code ?? code, create: !editing, expectedRevision: editing?.revision, definition: parsed.data }); onSaved(); onClose(); });
  };
  return <Dialog onClose={onClose} size="lg" locked={saving}>
    <DialogHeader icon={<Trophy weight="bold" />} title={editing ? 'Edit achievement' : 'New achievement'} description="Compares a student with their own progress, never with others" onClose={saving ? undefined : onClose} />
    <DialogBody className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Code (never changes)"><input className={cn(fieldClass, 'font-mono')} maxLength={60} disabled={Boolean(editing)} value={code} onChange={e => setCode(e.target.value.toLowerCase())} placeholder="kicks_100" /></Labeled>
        <Labeled label="Icon"><select className={fieldClass} value={icon} onChange={e => setIcon(e.target.value as Definition['icon'])}>{ACHIEVEMENT_ICONS.map(i => <option key={i}>{i}</option>)}</select></Labeled>
      </div>
      <Labeled label="Title"><input className={fieldClass} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></Labeled>
      <Labeled label="Description"><textarea rows={2} maxLength={500} className={cn(fieldClass, 'py-2')} value={description} onChange={e => setDescription(e.target.value)} /></Labeled>
      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Earned by"><select className={fieldClass} value={kind} onChange={e => setKind(e.target.value as RuleKind)}>{ACHIEVEMENT_RULES.map(r => <option key={r} value={r}>{RULE_LABEL[r]}</option>)}</select></Labeled>
        {counted && <Labeled label="At least"><input type="number" min={1} className={fieldClass} value={min} onChange={e => setMin(e.target.value)} /></Labeled>}
        {kind === 'quiz_passed' && <Labeled label="Pass mark %"><input type="number" min={1} max={100} className={fieldClass} value={percent} onChange={e => setPercent(e.target.value)} /></Labeled>}
        <Labeled label="Repeats"><select className={fieldClass} value={kind === 'attendance_month' ? 'monthly' : repeats} disabled={kind === 'attendance_month'} onChange={e => setRepeats(e.target.value as Definition['repeats'])}>{Object.entries(REPEATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Labeled>
        <Labeled label="Points"><input type="number" min={0} max={1000} className={fieldClass} value={points} onChange={e => setPoints(e.target.value)} /></Labeled>
      </div>
      {kind === 'category_completed' && <fieldset className="rounded-lg border border-line p-2"><legend className="px-1 text-micro font-semibold text-ink-muted">Library categories</legend>
        <div className="flex flex-wrap gap-2">{overview.categories.map(c => <label key={c.slug} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={categories.includes(c.slug)} onChange={e => setCategories(e.target.checked ? [...categories, c.slug] : categories.filter(x => x !== c.slug))} />{c.title}</label>)}</div></fieldset>}
      {kind === 'manual' && <p className="text-xs text-ink-muted">A coach awards it from the panel below (for example Belt Exam Ready), or a challenge gives it as its badge.</p>}
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active (shown to students and awarded)</label>
      <TranslationFields fields={[{ key: 'title', label: 'Title', max: 120 }, { key: 'description', label: 'Description', multiline: true, max: 500 }]} value={translations} onChange={setTranslations} />
      <StatusLine message={message} />
    </DialogBody>
    <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={buttonClass({ variant: 'primary' })} onClick={save} disabled={saving}>Save</button></DialogFooter>
  </Dialog>;
}

export function AchievementsPanel({ overview, canEdit, onChanged }: { overview: Overview; canEdit: boolean; onChanged: () => void }) {
  const { data, error, reload } = useLmsView<{ definitions: Definition[]; awards: Award[] }>('achievements');
  const [editing, setEditing] = useState<Definition | null | 'new'>(null);
  const [student, setStudent] = useState('');
  const [code, setCode] = useState('belt_exam_ready');
  const [note, setNote] = useState('');
  const { saving, message, run } = useSaving(() => { void reload(); onChanged(); });
  const { showConfirm } = useAppStore();
  if (error) return <ErrorBanner title="Achievements unavailable">{error}</ErrorBanner>;
  if (!data) return <EmptyState busy title="Loading…" />;
  const title = (c: string) => data.definitions.find(d => d.code === c)?.title ?? c;
  // The picker only lists active achievements: award the one it shows, even when
  // the default (Belt Exam Ready) has been switched off or deleted.
  const awardable = data.definitions.filter(d => d.active);
  const chosen = awardable.some(d => d.code === code) ? code : awardable[0]?.code ?? '';
  return <div className="space-y-5">
    {canEdit && <section className={cn(cardClass, 'space-y-2 p-3')}>
      <h2 className={sectionLabelClass}>Coach sign-off</h2>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <StudentSelect overview={overview} value={student} onChange={setStudent} />
        <Labeled label="Achievement"><select className={fieldClass} value={chosen} onChange={e => setCode(e.target.value)}>{awardable.map(d => <option key={d.code} value={d.code}>{d.title}</option>)}</select></Labeled>
        <Labeled label="Note (optional)"><input className={fieldClass} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></Labeled>
        <button type="button" className={buttonClass({ variant: 'primary' })} disabled={!student || !chosen || saving} onClick={() => void run(async () => { await lmsPost({ action: 'achievement.award', studentId: student, code: chosen, period: null, note: note.trim() || null }); setNote(''); }, 'Awarded. The student gets a notice.')}>Award</button>
      </div>
      <p className="text-xs text-ink-muted">A per-belt award (Belt Exam Ready) is recorded for the student&apos;s next belt.</p>
    </section>}
    <StatusLine message={message} />
    <section className="space-y-2"><h2 className={sectionLabelClass}>Catalogue</h2>
      {canEdit && <button type="button" className={buttonClass()} onClick={() => setEditing('new')}><Plus className="size-4" weight="bold" /> New achievement</button>}
      <ul className="grid gap-2 sm:grid-cols-2">{data.definitions.map(d => <li key={d.code} className={cn(cardClass, 'space-y-1 p-3')}>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-ink">{d.title}</span>{!d.active && <Pill tone="warn">off</Pill>}<Pill>{RULE_LABEL[d.rule.kind]}{d.rule.min ? ` ${d.rule.min}` : ''}</Pill><Pill>{REPEATS[d.repeats]}</Pill><Pill tone="brand">{d.points} pts</Pill></div>
        <p className="text-xs text-ink-muted">{d.description}</p>
        {canEdit && <div className="flex gap-1.5"><button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => setEditing(d)}>Edit</button>
          <button type="button" className={buttonClass({ size: 'sm', variant: 'danger' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => showConfirm(`Delete "${d.title}"?`, () => void run(() => lmsPost({ action: 'achievement.delete', code: d.code, expectedRevision: d.revision }), 'Deleted.'), 'Delete achievement')}>Delete</button></div>}
      </li>)}</ul></section>
    <section className="space-y-2"><h2 className={sectionLabelClass}>Recent awards</h2>
      {data.awards.length === 0 ? <p className="text-xs text-ink-muted">No awards yet.</p> : <ul className="divide-y divide-line rounded-lg border border-line">{data.awards.map(a => <li key={`${a.student_id}:${a.code}:${a.period}`} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs">
        <span className="min-w-[10rem] flex-1 font-semibold text-ink">{a.students?.english_name ?? a.student_id}</span><span>{title(a.code)}{a.period ? ` · ${a.period}` : ''}</span>{a.awarded_by && <Pill>signed off</Pill>}<span className="text-ink-muted">{fmtDate(a.earned_at)}</span>
        {canEdit && <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => showConfirm('Remove this award and its points?', () => void run(() => lmsPost({ action: 'achievement.revoke', studentId: a.student_id, code: a.code, period: a.period, note: null }), 'Removed.'), 'Remove award')}>Remove</button>}
      </li>)}</ul>}</section>
    {editing && <DefinitionEditor overview={overview} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { void reload(); onChanged(); }} />}
  </div>;
}
