'use client';
import { useRef, useState } from 'react';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { portalRequest } from '@/lib/portal-api';
import { COACH_GRADES } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { fmtDate, Labeled, lmsPost, Pill, StatusLine, useLmsView, useSaving } from './coaching-shared';

type Grade = typeof COACH_GRADES[number];
interface Review { id: string; decision: string; grade: Grade | null; feedback: string | null; moments: { second: number; note: string }[]; rubric: { item: string; grade: Grade | null; note: string }[]; visible_to_student: boolean; created_at: string; profiles?: { display_name: string } | null }
interface Submission { id: string; student_id: string; assignment_id: string | null; kind: 'video' | 'text' | 'practice'; text_answer: string | null; video_seconds: number | null; status: string; submitted_at: string | null; hasVideo: boolean;
  subject_type: string | null; students?: { english_name: string; current_belt: string } | null; assignments?: { title: string; rubric: { item: string }[] } | null; reviews: Review[] }
interface FormCheck { student_id: string; form_id: string; status: string; practice_count: number; best_quiz_percent: number | null; review_requested_at: string | null; reviewed_at: string | null; review_note: string | null;
  students?: { english_name: string; current_belt: string } | null; poomsae_forms?: { name: string } | null }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function SubmissionReview({ item, canReview, onDone }: { item: Submission; canReview: boolean; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [grade, setGrade] = useState<Grade | ''>('');
  const [feedback, setFeedback] = useState('');
  const [visible, setVisible] = useState(true);
  const [rubric, setRubric] = useState(() => (item.assignments?.rubric ?? []).map(r => ({ item: r.item, grade: null as Grade | null, note: '' })));
  const [moments, setMoments] = useState<{ second: number; note: string }[]>([]);
  const { saving, message, run } = useSaving(onDone);
  // Opening a video is not a change: the queue is not reloaded.
  const open = () => run(async () => { const result = await portalRequest<{ url: string }>(`/api/admin/lms/video?submission=${item.id}`); setUrl(result.url); }, undefined, { refresh: false });
  const submit = (decision: 'accepted' | 'returned') => run(() => lmsPost({ action: 'submission.review', id: item.id, review: {
    decision, grade: grade || null, feedback: feedback.trim() || null, rubric, moments: moments.filter(m => m.note.trim()), visibleToStudent: visible } }), decision === 'accepted' ? 'Accepted. The student sees your feedback.' : 'Returned for another try.');
  return <article className={cn(cardClass, 'space-y-3 p-3')}>
    <header className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-bold text-ink">{item.students?.english_name ?? item.student_id}</h3>
      <Pill>{item.students?.current_belt ?? ''}</Pill>
      <Pill tone={item.status === 'submitted' ? 'warn' : item.status === 'reviewed' ? 'good' : 'neutral'}>{item.status}</Pill>
      <span className="text-xs text-ink-muted">{item.assignments?.title ?? (item.subject_type ? `Sent for feedback (${item.subject_type})` : '')} · {fmtDate(item.submitted_at)}</span>
    </header>
    {item.kind === 'text' && <blockquote className="whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm text-ink">{item.text_answer}</blockquote>}
    {item.kind === 'practice' && <p className="text-sm text-ink-muted">The student marked this practice as done.</p>}
    {item.kind === 'video' && (item.hasVideo
      ? url ? <video ref={video} src={url} controls playsInline onError={() => setUrl(null)} className="max-h-[420px] w-full rounded-lg bg-black" /> : canReview && <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => void open()} disabled={saving}><VideoCamera className="size-4" /> Watch video{item.video_seconds ? ` (${clock(item.video_seconds)})` : ''}</button>
      : <p className="text-xs text-ink-muted">The video was deleted after the retention period; the feedback is kept.</p>)}
    {item.reviews.length > 0 && <div className="space-y-1.5"><p className={sectionLabelClass}>Earlier reviews</p>{item.reviews.map(r => <div key={r.id} className="rounded-lg border border-line p-2 text-xs">
      <span className="font-semibold">{r.profiles?.display_name ?? 'Coach'}</span> · {r.decision}{r.grade ? ` · ${r.grade}` : ''}{r.visible_to_student ? '' : ' · coach only'} · {fmtDate(r.created_at)}
      {r.feedback && <p className="mt-1 whitespace-pre-wrap text-ink">{r.feedback}</p>}
      {r.moments.map((m, i) => <p key={i} className="text-ink-muted">{clock(m.second)} — {m.note}</p>)}</div>)}</div>}
    {canReview && ['submitted', 'reviewed', 'returned'].includes(item.status) && <div className="space-y-2 border-t border-line pt-3">
      <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
        <Labeled label="Overall grade"><select className={fieldClass} value={grade} onChange={e => setGrade(e.target.value as Grade | '')}><option value="">No grade</option>{COACH_GRADES.map(g => <option key={g}>{g}</option>)}</select></Labeled>
        <Labeled label="Feedback for the student"><textarea rows={2} maxLength={4000} className={cn(fieldClass, 'py-2')} value={feedback} onChange={e => setFeedback(e.target.value)} /></Labeled>
      </div>
      {rubric.length > 0 && <div className="space-y-1.5"><p className={sectionLabelClass}>Rubric</p>{rubric.map((r, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_2fr]">
        <span className="self-center text-sm text-ink">{r.item}</span>
        <select aria-label={`${r.item} grade`} className={fieldClass} value={r.grade ?? ''} onChange={e => setRubric(rubric.map((x, at) => at === i ? { ...x, grade: (e.target.value || null) as Grade | null } : x))}><option value="">—</option>{COACH_GRADES.map(g => <option key={g}>{g}</option>)}</select>
        <input aria-label={`${r.item} note`} maxLength={500} className={fieldClass} placeholder="Note" value={r.note} onChange={e => setRubric(rubric.map((x, at) => at === i ? { ...x, note: e.target.value } : x))} /></div>)}</div>}
      {item.kind === 'video' && <div className="space-y-1.5"><p className={sectionLabelClass}>Timed notes</p>
        {moments.map((m, i) => <div key={i} className="flex gap-2">
          <input aria-label={`Note ${i + 1} second`} type="number" min={0} max={600} className={cn(fieldClass, 'w-24')} value={m.second} onChange={e => setMoments(moments.map((x, at) => at === i ? { ...x, second: Math.max(0, Math.min(600, Number(e.target.value) || 0)) } : x))} />
          <input aria-label={`Note ${i + 1}`} maxLength={500} className={fieldClass} placeholder="e.g. Pivot the supporting foot" value={m.note} onChange={e => setMoments(moments.map((x, at) => at === i ? { ...x, note: e.target.value } : x))} />
          <button type="button" aria-label={`Remove note ${i + 1}`} className={buttonClass({ size: 'icon', variant: 'ghost' })} onClick={() => setMoments(moments.filter((_, at) => at !== i))}><Trash className="size-4" /></button></div>)}
        <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={moments.length >= 50} onClick={() => setMoments([...moments, { second: Math.round(video.current?.currentTime ?? 0), note: '' }])}><Plus className="size-3.5" /> Add note at the video&apos;s current time</button></div>}
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Show this review to the student (sends a feedback notice)</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass({ variant: 'primary' })} disabled={saving} onClick={() => void submit('accepted')}>Accept</button>
        <button type="button" className={buttonClass()} disabled={saving} onClick={() => void submit('returned')}>Return for another try</button>
      </div>
    </div>}
    <StatusLine message={message} />
  </article>;
}

function FormCheckRow({ item, canReview, onDone }: { item: FormCheck; canReview: boolean; onDone: () => void }) {
  const [note, setNote] = useState('');
  const { saving, message, run } = useSaving(onDone);
  const decide = (decision: 'mastered' | 'practising' | 'learning') => run(() => lmsPost({ action: 'form.review', studentId: item.student_id, formId: item.form_id, review: { decision, note: note.trim() || null } }), decision === 'mastered' ? 'Marked mastered.' : 'Saved.');
  return <li className={cn(cardClass, 'space-y-2 p-3')}>
    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-ink">{item.students?.english_name ?? item.student_id}</span><Pill>{item.poomsae_forms?.name ?? 'Form'}</Pill>
      <Pill tone={item.status === 'ready_for_review' ? 'warn' : item.status === 'mastered' ? 'good' : 'neutral'}>{item.status.replaceAll('_', ' ')}</Pill>
      <span className="text-xs text-ink-muted">{item.practice_count} practice runs{item.best_quiz_percent != null ? ` · best quiz ${item.best_quiz_percent}%` : ''}{item.review_requested_at ? ` · asked ${fmtDate(item.review_requested_at)}` : ''}</span></div>
    {item.review_note && <p className="text-xs text-ink-muted">Last note: {item.review_note}</p>}
    {canReview && <div className="flex flex-wrap items-center gap-2">
      <input aria-label="Note to the student" maxLength={1000} placeholder="Note to the student (optional)" className={cn(fieldClass, 'min-w-[12rem] flex-1')} value={note} onChange={e => setNote(e.target.value)} />
      <button type="button" className={buttonClass({ variant: 'primary', size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={saving || item.status === 'mastered'} onClick={() => void decide('mastered')}>Mastered</button>
      <button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} disabled={saving} onClick={() => void decide('practising')}>Keep practising</button>
    </div>}
    <StatusLine message={message} />
  </li>;
}

export function ReviewQueue({ canReview, assignment = null, onClearAssignment }: { canReview: boolean; assignment?: { id: string; title: string } | null; onClearAssignment?: () => void }) {
  const { data, error, loading, reload } = useLmsView<{ submissions: Submission[]; forms: FormCheck[] }>('review');
  const [showDone, setShowDone] = useState(false);
  if (error) return <ErrorBanner title="Review queue unavailable" action={<button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => void reload()}>Retry</button>}>{error}</ErrorBanner>;
  if (!data) return <EmptyState busy title={loading ? 'Loading…' : 'Nothing yet'} />;
  const submissions = data.submissions.filter(s => (showDone || s.status === 'submitted') && (!assignment || s.assignment_id === assignment.id));
  const forms = data.forms.filter(f => showDone || f.status === 'ready_for_review');
  return <div className="space-y-4">
    {assignment && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-2 text-sm text-ink">
      <span className="min-w-0 flex-1">Showing work for <strong>{assignment.title}</strong></span>
      <button type="button" className={cn(buttonClass({ size: 'sm' }), 'pointer-coarse:min-h-11')} onClick={onClearAssignment}>Show everything</button></div>}
    <label className="flex min-h-11 items-center gap-2 text-sm text-ink-muted"><input type="checkbox" className="size-4" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Show reviewed work too</label>
    <section className="space-y-2"><h2 className={sectionLabelClass}>Videos and answers ({submissions.length})</h2>
      {submissions.length ? submissions.map(item => <SubmissionReview key={item.id} item={item} canReview={canReview} onDone={() => void reload()} />)
        : <EmptyState title="No submissions waiting" description="Video and written work students hand in appears here." />}</section>
    <section className="space-y-2"><h2 className={sectionLabelClass}>Form checks ({forms.length})</h2>
      {forms.length ? <ul className="space-y-2">{forms.map(item => <FormCheckRow key={`${item.student_id}:${item.form_id}`} item={item} canReview={canReview} onDone={() => void reload()} />)}</ul>
        : <EmptyState title="No form checks waiting" description={`When a student taps "I'm ready" on a form, it appears here. Only a coach marks a form mastered.`} />}</section>
  </div>;
}
