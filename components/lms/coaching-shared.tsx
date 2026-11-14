'use client';
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { portalRequest } from '@/lib/portal-api';
import { buttonClass, fieldClass, labelClass, sectionLabelClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import type { LmsAudience, LmsRequest } from '@/lib/lms-contract';

export interface Overview {
  students: { id: string; english_name: string; current_belt: string; student_status: string; home_branch_id: number }[];
  lessons: { id: number; title: string; target_belt: string; category: string; content_type: string }[];
  belts: { id: number; belt_name: string; belt_order: number }[];
  classes: { id: number; class_name: string; branch_id: number }[];
  branches: { id: number; branch_name: string }[];
  categories: { slug: string; title: string }[];
  forms: { id: string; name: string; curriculum_id: number; published: boolean; movement_count: number }[];
  achievements: { code: string; title: string; repeats: string; active: boolean; rule: { kind: string } }[];
  studentLmsPushEnabled: boolean;
  waiting: { submissions: number; forms: number };
}

/**
 * Loads one Coaching view; reload() refetches after a change. A result is only
 * returned for the query it was loaded for: after switching to another student
 * or quiz, the previous one's data is never shown (or edited) under the new one.
 */
export function useLmsView<T>(view: string, query = '', enabled = true) {
  const key = `${view}?${query}`;
  const [loaded, setLoaded] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!enabled) { setLoaded(null); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await portalRequest<T>(`/api/admin/lms?view=${view}${query ? `&${query}` : ''}`);
      if (id === seq.current) setLoaded({ key, data: result, error: null });
    } catch (e) {
      // A failed refresh keeps what is on screen for this query, with the error next to it.
      if (id === seq.current) setLoaded(previous => ({ key, data: previous?.key === key ? previous.data : null, error: e instanceof Error ? e.message : 'Could not load this view.' }));
    }
    finally { if (id === seq.current) setLoading(false); }
  }, [key, view, query, enabled]);
  useEffect(() => { void reload(); }, [reload]);
  const current = loaded?.key === key ? loaded : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading, reload };
}

/** One write to POST /api/admin/lms (checked again in SQL). */
export const lmsPost = <T = unknown,>(body: LmsRequest) => portalRequest<T>('/api/admin/lms', body);

/** Runs one write at a time and reports the result. */
export function useSaving(onDone?: () => void) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  // A ref, not state: two quick clicks in the same render must not send the write twice.
  const busy = useRef(false);
  const run = async <T,>(work: () => Promise<T>, success?: string, options: { refresh?: boolean } = {}): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true; setSaving(true); setMessage(null);
    try { const result = await work(); if (success) setMessage({ tone: 'ok', text: success }); if (options.refresh !== false) onDone?.(); return result; }
    catch (e) { setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'This change could not be saved.' }); return null; }
    finally { busy.current = false; setSaving(false); }
  };
  return { saving, message, setMessage, run };
}

export function StatusLine({ message }: { message: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null;
  return <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('text-xs font-semibold', message.tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>{message.text}</p>;
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'good' | 'warn'; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-micro font-bold uppercase tracking-wider', {
    neutral: 'bg-control text-ink-muted', brand: 'bg-brand/10 text-brand-ink', good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', warn: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  }[tone])}>{children}</span>;
}

/** A field with its label linked by id, so the field's accessible name is exactly the label. */
export function Labeled({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const generated = useId();
  const own = isValidElement<{ id?: string }>(children) ? children.props.id : undefined;
  const id = own ?? generated;
  const field = isValidElement<{ id?: string }>(children) && !own ? cloneElement(children, { id }) : children;
  return <div className={cn('block', className)}><label htmlFor={id} className={labelClass}>{label}</label>{field}</div>;
}

export const fmtDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
/** Monday of the week containing the date (Asia/Phnom_Penh). */
export function mondayOf(date: string) { const d = new Date(`${date}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); }

export function StudentSelect({ overview, value, onChange, label = 'Student', allowEmpty = true }: { overview: Overview; value: string; onChange: (id: string) => void; label?: string; allowEmpty?: boolean }) {
  return <Labeled label={label}><select className={fieldClass} value={value} onChange={event => onChange(event.target.value)}>
    {allowEmpty && <option value="">Choose a student…</option>}
    {overview.students.map(s => <option key={s.id} value={s.id}>{s.english_name} · {s.current_belt}{s.student_status !== 'Active' ? ` (${s.student_status})` : ''}</option>)}
  </select></Labeled>;
}

export function LessonSelect({ overview, value, onChange, label = 'Lesson' }: { overview: Overview; value: string; onChange: (id: string) => void; label?: string }) {
  return <Labeled label={label}><select className={fieldClass} value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Choose a published lesson…</option>
    {overview.lessons.map(l => <option key={l.id} value={String(l.id)}>{l.title} · {l.target_belt}</option>)}
  </select></Labeled>;
}

/** English is the base text; Khmer and Chinese are optional overlays that fall back to English. */
export function TranslationFields<K extends string>({ fields, value, onChange }: { fields: { key: K; label: string; multiline?: boolean; max: number }[]; value: { km?: Partial<Record<K, string>>; zh?: Partial<Record<K, string>> }; onChange: (next: { km?: Partial<Record<K, string>>; zh?: Partial<Record<K, string>> }) => void }) {
  const [open, setOpen] = useState(false);
  const set = (lang: 'km' | 'zh', key: K, text: string) => {
    const next = { ...value, [lang]: { ...(value[lang] ?? {}), [key]: text } };
    if (!text.trim()) delete (next[lang] as Record<string, string>)[key];
    if (next[lang] && Object.keys(next[lang]!).length === 0) delete next[lang];
    onChange(next);
  };
  return <div className="rounded-lg border border-dashed border-line p-2">
    <button type="button" className="inline-flex min-h-9 items-center text-xs font-semibold text-ink-muted underline-offset-2 hover:underline pointer-coarse:min-h-11" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {open ? 'Hide translations' : `Khmer and Chinese (optional)${value.km || value.zh ? ' · added' : ''}`}</button>
    {open && <div className="mt-2 grid gap-3 sm:grid-cols-2">{(['km', 'zh'] as const).map(lang => <div key={lang} className="space-y-2">
      <p className={sectionLabelClass}>{lang === 'km' ? 'Khmer' : 'Chinese'}</p>
      {fields.map(field => field.multiline
        ? <textarea key={field.key} aria-label={`${field.label} (${lang === 'km' ? 'Khmer' : 'Chinese'})`} placeholder={field.label} rows={3} maxLength={field.max} className={cn(fieldClass, 'py-2')} value={value[lang]?.[field.key] ?? ''} onChange={event => set(lang, field.key, event.target.value)} />
        : <input key={field.key} aria-label={`${field.label} (${lang === 'km' ? 'Khmer' : 'Chinese'})`} placeholder={field.label} maxLength={field.max} className={fieldClass} value={value[lang]?.[field.key] ?? ''} onChange={event => set(lang, field.key, event.target.value)} />)}
    </div>)}</div>}
  </div>;
}

/** Everyone, or any mix of belts, branches, classes and students. */
export function AudiencePicker({ overview, value, onChange }: { overview: Overview; value: LmsAudience; onChange: (next: LmsAudience) => void }) {
  const toggle = (key: 'belts' | 'branches' | 'classes' | 'students', item: string) => {
    const list = new Set(value[key] ?? []); if (list.has(item)) list.delete(item); else list.add(item);
    const next: LmsAudience = { ...value, [key]: [...list] }; delete next.all;
    if (!next[key]!.length) delete next[key];
    onChange(next);
  };
  const [student, setStudent] = useState('');
  const chip = (active: boolean) => cn('min-h-9 pointer-coarse:min-h-11 rounded-lg border px-2.5 text-xs font-semibold', active ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line bg-surface-muted text-ink-muted hover:bg-control');
  return <fieldset className="space-y-2 rounded-lg border border-line p-2">
    <legend className={cn(labelClass, 'px-1')}>Who</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value.all)} onChange={event => onChange(event.target.checked ? { all: true } : {})} /> Every active student</label>
    {!value.all && <>
      <div><p className={labelClass}>Belts</p><div className="flex flex-wrap gap-1.5">{overview.belts.map(b => <button key={b.id} type="button" aria-pressed={value.belts?.includes(b.belt_name) ?? false} className={chip(value.belts?.includes(b.belt_name) ?? false)} onClick={() => toggle('belts', b.belt_name)}>{b.belt_name}</button>)}</div></div>
      {overview.branches.length > 1 && <div><p className={labelClass}>Branches</p><div className="flex flex-wrap gap-1.5">{overview.branches.map(b => <button key={b.id} type="button" aria-pressed={value.branches?.includes(String(b.id)) ?? false} className={chip(value.branches?.includes(String(b.id)) ?? false)} onClick={() => toggle('branches', String(b.id))}>{b.branch_name}</button>)}</div></div>}
      <div><p className={labelClass}>Classes</p><div className="flex flex-wrap gap-1.5">{overview.classes.map(c => <button key={c.id} type="button" aria-pressed={value.classes?.includes(String(c.id)) ?? false} className={chip(value.classes?.includes(String(c.id)) ?? false)} onClick={() => toggle('classes', String(c.id))}>{c.class_name}</button>)}</div></div>
      <div className="flex flex-wrap items-end gap-2">
        <StudentSelect overview={overview} value={student} onChange={setStudent} label="Add one student" />
        <button type="button" className={buttonClass()} disabled={!student} onClick={() => { if (student && !value.students?.includes(student)) toggle('students', student); setStudent(''); }}>Add</button>
      </div>
      {!!value.students?.length && <div className="flex flex-wrap gap-1.5">{value.students.map(id => <button key={id} type="button" className={chip(true)} onClick={() => toggle('students', id)} aria-label={`Remove ${overview.students.find(s => s.id === id)?.english_name ?? id}`}>{overview.students.find(s => s.id === id)?.english_name ?? id} ✕</button>)}</div>}
    </>}
  </fieldset>;
}

export function audienceSummary(overview: Overview, audience: LmsAudience | Record<string, unknown>) {
  const a = audience as LmsAudience;
  if (a.all) return 'Everyone';
  const parts = [...(a.belts ?? []), ...(a.branches ?? []).map(id => overview.branches.find(b => String(b.id) === id)?.branch_name ?? `Branch ${id}`),
    ...(a.classes ?? []).map(id => overview.classes.find(c => String(c.id) === id)?.class_name ?? `Class ${id}`),
    ...(a.students ?? []).map(id => overview.students.find(s => s.id === id)?.english_name ?? id)];
  return parts.length ? parts.join(', ') : 'Nobody yet';
}
