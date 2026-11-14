'use client';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { PersonSimpleTaiChi } from '@phosphor-icons/react/dist/csr/PersonSimpleTaiChi';
import { Exam } from '@phosphor-icons/react/dist/csr/Exam';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { poomsaeFormInput, QUIZ_KINDS, QUIZ_SCOPES, quizQuestionInput } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Labeled, LessonSelect, lmsPost, Pill, StatusLine, TranslationFields, useLmsView, useSaving, type Overview } from './coaching-shared';

interface Form { id: string; curriculum_id: number; name: string; korean_name: string | null; series: string; belt_id: number | null; movement_count: number; sort_order: number; published: boolean; translations: Record<string, any>; revision: number }
interface Question { id: string; scope: typeof QUIZ_SCOPES[number]; scope_ref: string; kind: typeof QUIZ_KINDS[number]; prompt: string; choices: string[]; answer: number | number[]; explanation: string | null; translations: Record<string, any>; published: boolean; revision: number }
const KIND_LABEL: Record<typeof QUIZ_KINDS[number], string> = { next_movement: 'Next movement', direction: 'Direction', stance: 'Stance', term: 'Korean term', choice: 'Multiple choice' };

function FormEditor({ overview, editing, onClose, onSaved }: { overview: Overview; editing: Form | null; onClose: () => void; onSaved: () => void }) {
  const [lesson, setLesson] = useState(editing ? String(editing.curriculum_id) : '');
  const [name, setName] = useState(editing?.name ?? '');
  const [korean, setKorean] = useState(editing?.korean_name ?? '');
  const [series, setSeries] = useState(editing?.series ?? 'Taegeuk');
  const [belt, setBelt] = useState(editing?.belt_id ? String(editing.belt_id) : '');
  const [movements, setMovements] = useState(String(editing?.movement_count ?? 18));
  const [published, setPublished] = useState(editing?.published ?? false);
  const [translations, setTranslations] = useState<Record<string, any>>(editing?.translations ?? {});
  const { saving, message, setMessage, run } = useSaving();
  const save = () => {
    const parsed = poomsaeFormInput.safeParse({ curriculumId: Number(lesson), name, koreanName: korean.trim() || null, series, beltId: belt ? Number(belt) : null, movementCount: Number(movements), published, translations });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the form.' }); return; }
    void run(async () => { await lmsPost({ action: 'form.save', id: editing?.id, expectedRevision: editing?.revision, form: parsed.data }); onSaved(); onClose(); });
  };
  return <Dialog onClose={onClose} size="lg" locked={saving}>
    <DialogHeader icon={<PersonSimpleTaiChi weight="bold" />} title={editing ? 'Edit form' : 'Register a form'} description="Links a poomsae to its library lesson and the belt that learns it" onClose={saving ? undefined : onClose} />
    <DialogBody className="space-y-3">
      <LessonSelect overview={overview} value={lesson} onChange={setLesson} label="Library lesson (with the floor plan)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Name"><input className={fieldClass} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Taegeuk Il Jang" /></Labeled>
        <Labeled label="Korean name"><input className={fieldClass} maxLength={120} value={korean} onChange={e => setKorean(e.target.value)} placeholder="태극 1장" /></Labeled>
        <Labeled label="Series"><input className={fieldClass} maxLength={60} value={series} onChange={e => setSeries(e.target.value)} placeholder="Taegeuk or Black belt" /></Labeled>
        <Labeled label="Belt that learns it"><select className={fieldClass} value={belt} onChange={e => setBelt(e.target.value)}><option value="">Every belt</option>{overview.belts.map(b => <option key={b.id} value={b.id}>{b.belt_name}</option>)}</select></Labeled>
        <Labeled label="Movements"><input type="number" min={1} max={200} className={fieldClass} value={movements} onChange={e => setMovements(e.target.value)} /></Labeled>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> Published to students</label>
      </div>
      <TranslationFields fields={[{ key: 'name', label: 'Name', max: 120 }]} value={translations} onChange={setTranslations} />
      <StatusLine message={message} />
    </DialogBody>
    <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={buttonClass({ variant: 'primary' })} onClick={save} disabled={saving}>Save</button></DialogFooter>
  </Dialog>;
}

function QuestionEditor({ scope, scopeRef, editing, onClose, onSaved }: { scope: Question['scope']; scopeRef: string; editing: Question | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<Question['kind']>(editing?.kind ?? (scope === 'form' ? 'next_movement' : 'choice'));
  const [prompt, setPrompt] = useState(editing?.prompt ?? '');
  const [choices, setChoices] = useState((editing?.choices ?? ['', '']).join('\n'));
  const [ordered, setOrdered] = useState(Array.isArray(editing?.answer));
  const [answer, setAnswer] = useState(typeof editing?.answer === 'number' ? editing.answer : 0);
  const [order, setOrder] = useState(Array.isArray(editing?.answer) ? editing!.answer.map(i => i + 1).join(',') : '');
  const [explanation, setExplanation] = useState(editing?.explanation ?? '');
  const [published, setPublished] = useState(editing?.published ?? true);
  const [translations, setTranslations] = useState<Record<string, any>>(editing?.translations ?? {});
  const { saving, message, setMessage, run } = useSaving();
  const list = choices.split('\n').map(c => c.trim()).filter(Boolean);
  // Translated choices: one line per English choice, in the same order (blank lines keep the English).
  const choiceLines = (lang: 'km' | 'zh') => ((translations[lang]?.choices ?? []) as string[]).join('\n');
  const setChoiceLines = (lang: 'km' | 'zh', text: string) => {
    const lines = text.split('\n').slice(0, 8);
    const next: Record<string, any> = { ...translations, [lang]: { ...(translations[lang] ?? {}), choices: lines } };
    if (!lines.some(line => line.trim())) delete next[lang].choices;
    if (!Object.keys(next[lang]).length) delete next[lang];
    setTranslations(next);
  };
  const save = () => {
    const value = ordered ? order.split(',').map(n => Number(n.trim()) - 1) : answer;
    const cleaned: Record<string, any> = structuredClone(translations);
    for (const lang of ['km', 'zh'] as const) if (cleaned[lang]?.choices) cleaned[lang].choices = (cleaned[lang].choices as string[]).map(line => line.trim()).slice(0, list.length);
    const parsed = quizQuestionInput.safeParse({ scope, scopeRef, kind, prompt, choices: list, answer: value, explanation: explanation.trim() || null, published, translations: cleaned });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the question.' }); return; }
    void run(async () => { await lmsPost({ action: 'quiz.save', id: editing?.id, expectedRevision: editing?.revision, question: parsed.data }); onSaved(); onClose(); });
  };
  return <Dialog onClose={onClose} size="lg" locked={saving}>
    <DialogHeader icon={<Exam weight="bold" />} title={editing ? 'Edit question' : 'New question'} description="Scored on the student's device; the score is self-reported" onClose={saving ? undefined : onClose} />
    <DialogBody className="space-y-3">
      <Labeled label="Kind"><select className={fieldClass} value={kind} onChange={e => setKind(e.target.value as Question['kind'])}>{QUIZ_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Labeled>
      <Labeled label="Question"><textarea rows={2} maxLength={500} className={cn(fieldClass, 'py-2')} value={prompt} onChange={e => setPrompt(e.target.value)} /></Labeled>
      <Labeled label="Choices, one per line (2 to 8)"><textarea rows={4} className={cn(fieldClass, 'py-2')} value={choices} onChange={e => setChoices(e.target.value)} /></Labeled>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={ordered} onChange={e => setOrdered(e.target.checked)} /> The answer is an order (put the choices in sequence)</label>
      {ordered ? <Labeled label="Right order, by choice number (e.g. 3,1,2)"><input className={fieldClass} value={order} onChange={e => setOrder(e.target.value)} /></Labeled>
        : <Labeled label="Right answer"><select className={fieldClass} value={answer} onChange={e => setAnswer(Number(e.target.value))}>{list.map((c, i) => <option key={i} value={i}>{i + 1}. {c}</option>)}</select></Labeled>}
      <Labeled label="Explanation shown after answering (optional)"><textarea rows={2} maxLength={1000} className={cn(fieldClass, 'py-2')} value={explanation} onChange={e => setExplanation(e.target.value)} /></Labeled>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> Published to students</label>
      <TranslationFields fields={[{ key: 'prompt', label: 'Question', multiline: true, max: 500 }, { key: 'explanation', label: 'Explanation', multiline: true, max: 1000 }]} value={translations} onChange={setTranslations} />
      <div className="grid gap-3 sm:grid-cols-2">{(['km', 'zh'] as const).map(lang => {
        const filled = choiceLines(lang).split('\n').filter(line => line.trim()).length;
        return <Labeled key={lang} label={`Choices in ${lang === 'km' ? 'Khmer' : 'Chinese'}, one per line in the same order (optional)`}>
          <textarea rows={3} className={cn(fieldClass, 'py-2')} value={choiceLines(lang)} onChange={e => setChoiceLines(lang, e.target.value)} />
          {filled > 0 && filled !== list.length && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{list.length} choices in English, {filled} translated: untranslated ones show in English.</p>}
        </Labeled>;
      })}</div>
      <StatusLine message={message} />
    </DialogBody>
    <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={buttonClass({ variant: 'primary' })} onClick={save} disabled={saving}>Save</button></DialogFooter>
  </Dialog>;
}

function QuizBank({ overview, canEdit, initialScope, initialRef, onChanged }: { overview: Overview; canEdit: boolean; initialScope?: Question['scope']; initialRef?: string; onChanged?: () => void }) {
  const [scope, setScope] = useState<Question['scope']>(initialScope ?? 'form');
  const [scopeRef, setScopeRef] = useState(initialRef ?? '');
  const ready = scopeRef.trim().length > 0;
  const { data, reload } = useLmsView<{ questions: Question[] }>('quiz', `scope=${scope}&ref=${encodeURIComponent(scopeRef.trim())}`, ready);
  const [editing, setEditing] = useState<Question | null | 'new'>(null);
  const refresh = () => { void reload(); onChanged?.(); };
  const { saving, message, run } = useSaving(refresh);
  const { showConfirm } = useAppStore();
  const questions = ready ? data?.questions ?? [] : [];
  return <section className="space-y-2">
    <h2 className={sectionLabelClass}>Quiz bank</h2>
    <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
      <Labeled label="About"><select className={fieldClass} value={scope} onChange={e => { setScope(e.target.value as Question['scope']); setScopeRef(''); }}><option value="form">A form</option><option value="lesson">A lesson</option><option value="belt">A belt</option><option value="terminology">Terminology set</option></select></Labeled>
      {scope === 'form' ? <Labeled label="Form"><select className={fieldClass} value={scopeRef} onChange={e => setScopeRef(e.target.value)}><option value="">Choose…</option>{overview.forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Labeled>
        : scope === 'lesson' ? <LessonSelect overview={overview} value={scopeRef} onChange={setScopeRef} />
        : scope === 'belt' ? <Labeled label="Belt"><select className={fieldClass} value={scopeRef} onChange={e => setScopeRef(e.target.value)}><option value="">Choose…</option>{overview.belts.map(b => <option key={b.id}>{b.belt_name}</option>)}</select></Labeled>
        : <Labeled label="Set name (letters, numbers, spaces)"><input className={fieldClass} maxLength={80} value={scopeRef} onChange={e => setScopeRef(e.target.value)} placeholder="Basics" /></Labeled>}
    </div>
    {ready && <>
      {canEdit && <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => setEditing('new')}><Plus className="size-3.5" /> Add question</button>}
      <StatusLine message={message} />
      {questions.length === 0 ? <p className="text-xs text-ink-muted">No questions yet.</p> : <ol className="space-y-1.5">{questions.map((q, i) => <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
        <span className="font-mono text-xs text-ink-subtle">{i + 1}</span><span className="min-w-[12rem] flex-1 text-ink">{q.prompt}</span><Pill>{KIND_LABEL[q.kind]}</Pill>{!q.published && <Pill tone="warn">draft</Pill>}
        {canEdit && <><button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} onClick={() => setEditing(q)}>Edit</button>
          <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => showConfirm('Delete this question?', () => void run(() => lmsPost({ action: 'quiz.delete', id: q.id, expectedRevision: q.revision }), 'Deleted.'), 'Delete question')}>Delete</button></>}
      </li>)}</ol>}
    </>}
    {editing && <QuestionEditor scope={scope} scopeRef={scopeRef.trim()} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
  </section>;
}

export function FormsPanel({ overview, canEdit, onChanged }: { overview: Overview; canEdit: boolean; onChanged: () => void }) {
  const { data, error, reload } = useLmsView<{ forms: Form[]; questionCounts: Record<string, number> }>('forms');
  const [editing, setEditing] = useState<Form | null | 'new'>(null);
  const { saving, message, run } = useSaving(() => { void reload(); onChanged(); });
  const { showConfirm } = useAppStore();
  if (error) return <ErrorBanner title="Forms unavailable">{error}</ErrorBanner>;
  if (!data) return <EmptyState busy title="Loading…" />;
  const belt = (id: number | null) => overview.belts.find(b => b.id === id)?.belt_name ?? 'Every belt';
  const reorder = (from: number, to: number) => { const ids = data.forms.map(f => f.id); const [x] = ids.splice(from, 1); ids.splice(to, 0, x); void run(() => lmsPost({ action: 'form.reorder', order: ids })); };
  return <div className="space-y-5">
    <section className="space-y-2">
      <h2 className={sectionLabelClass}>Poomsae forms</h2>
      {canEdit && <button type="button" className={buttonClass({ variant: 'primary' })} onClick={() => setEditing('new')}><Plus className="size-4" weight="bold" /> Register a form</button>}
      <StatusLine message={message} />
      {data.forms.length === 0 ? <EmptyState icon={<PersonSimpleTaiChi />} title="No forms registered" description="Register each Taegeuk and black-belt form with its library lesson and belt. Students see forms for their belt and below." />
        : <ul className="space-y-1.5">{data.forms.map((f, i) => <li key={f.id} className={cn(cardClass, 'flex flex-wrap items-center gap-2 p-2.5')}>
          <span className="min-w-[10rem] flex-1 text-sm font-bold text-ink">{f.name}{f.korean_name ? <span className="ml-1 font-normal text-ink-muted">{f.korean_name}</span> : null}</span>
          <Pill>{f.series}</Pill><Pill>{belt(f.belt_id)}</Pill><span className="text-xs text-ink-muted">{f.movement_count} movements · {data.questionCounts[`form:${f.id}`] ?? 0} questions</span>
          <Pill tone={f.published ? 'good' : 'warn'}>{f.published ? 'published' : 'draft'}</Pill>
          {canEdit && <span className="flex gap-1">
            <button type="button" aria-label={`Move ${f.name} up`} disabled={i === 0 || saving} className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} onClick={() => reorder(i, i - 1)}><ArrowUp className="size-3.5" /></button>
            <button type="button" aria-label={`Move ${f.name} down`} disabled={i === data.forms.length - 1 || saving} className={buttonClass({ size: 'sm', variant: 'ghost' }) + ' pointer-coarse:min-h-11'} onClick={() => reorder(i, i + 1)}><ArrowDown className="size-3.5" /></button>
            <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => setEditing(f)}>Edit</button>
            <button type="button" className={buttonClass({ size: 'sm', variant: 'danger' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => showConfirm(`Delete ${f.name}? Its quiz questions are deleted too.`, () => void run(() => lmsPost({ action: 'form.delete', id: f.id, expectedRevision: f.revision }), 'Deleted.'), 'Delete form')}>Delete</button>
          </span>}
        </li>)}</ul>}
    </section>
    <QuizBank overview={overview} canEdit={canEdit} onChanged={() => void reload()} />
    {editing && <FormEditor overview={overview} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { void reload(); onChanged(); }} />}
  </div>;
}
