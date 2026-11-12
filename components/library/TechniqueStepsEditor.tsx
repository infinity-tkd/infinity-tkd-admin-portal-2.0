'use client';
import { useState } from 'react';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { buttonClass, fieldClass, labelClass, sectionLabelClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import type { LibraryClip, LibrarySection, TechniqueStep } from '@/lib/library-content';

type Mistake = { mistake: string; correction: string };
const toLines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
const mistakesText = (mistakes: Mistake[]) => mistakes.map(m => m.correction ? `${m.mistake} -> ${m.correction}` : m.mistake).join('\n');
const textMistakes = (value: string): Mistake[] => toLines(value).map(line => { const at = line.indexOf('->'); return at > 0 ? { mistake: line.slice(0, at).trim(), correction: line.slice(at + 2).trim() } : { mistake: line, correction: '' }; });

/** Free text kept while typing; parsed into a list on blur. */
function ListArea({ label, value, onChange, format, parse }: { label: string; value: unknown[]; onChange: (next: any[]) => void; format: () => string; parse: (text: string) => any[] }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <textarea aria-label={label} placeholder={label} rows={Math.min(6, Math.max(2, value.length + 1))} className={cn(fieldClass, 'py-2 text-xs')}
    value={draft ?? format()} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== null) { onChange(parse(draft)); setDraft(null); } }} />;
}

/** Clip as start/end seconds in the section video, or its own https file. */
function ClipInput({ clip, onChange, label }: { clip: LibraryClip | null; onChange: (clip: LibraryClip | null) => void; label: string }) {
  const mode = clip == null ? 'none' : 'src' in clip ? 'src' : 'times';
  const seconds = (value: string) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0; };
  return <div className="flex flex-wrap items-end gap-2">
    <div><label className={labelClass}>{label}</label>
      <select aria-label={`${label}: source`} className={fieldClass} value={mode} onChange={event => onChange(event.target.value === 'none' ? null : event.target.value === 'src' ? { src: 'https://' } : { start: 0, end: 5 })}>
        <option value="none">No clip</option><option value="times">Part of the lesson video</option><option value="src">Its own video file</option>
      </select></div>
    {clip && 'start' in clip && <>
      <div className="w-24"><label className={labelClass}>Start (s)</label><input aria-label={`${label}: start seconds`} type="number" min={0} step={0.1} className={fieldClass} value={clip.start} onChange={event => onChange({ ...clip, start: seconds(event.target.value) })} /></div>
      <div className="w-24"><label className={labelClass}>End (s)</label><input aria-label={`${label}: end seconds`} type="number" min={0} step={0.1} className={fieldClass} value={clip.end} onChange={event => onChange({ ...clip, end: seconds(event.target.value) })} /></div>
      {clip.end <= clip.start && <span role="alert" className="text-xs text-red-600 dark:text-red-400">The end must be after the start.</span>}
    </>}
    {clip && 'src' in clip && <div className="min-w-[14rem] flex-1"><label className={labelClass}>Video link (https://)</label>
      <input aria-label={`${label}: video link`} className={fieldClass} value={clip.src} onChange={event => onChange({ src: event.target.value.trim() })} /></div>}
  </div>;
}

const move = <T,>(list: T[], from: number, to: number) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };
const slug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const uniqueId = (steps: TechniqueStep[], wanted: string) => { const used = new Set(steps.map(s => s.id)); const base = slug(wanted) || 'step'; if (!used.has(base)) return base; for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`; };

/** The Roundhouse Kick pattern: a lesson video and steps, each with a clip, mistakes and a checklist. */
export function TechniqueStepsEditor({ section, onChange }: { section: Extract<LibrarySection, { type: 'technique-steps' }>; onChange: (section: LibrarySection) => void }) {
  const setItems = (items: TechniqueStep[]) => onChange({ ...section, items });
  const setItem = (index: number, change: Partial<TechniqueStep>) => setItems(section.items.map((step, at) => at === index ? { ...step, ...change } : step));
  return <div className="space-y-3">
    <div><label className={labelClass} htmlFor={`${section.id}-video`}>Lesson video for the clips (YouTube unlisted or academy MP4, https://)</label>
      <input id={`${section.id}-video`} className={fieldClass} placeholder="https://www.youtube.com/watch?v=…" value={section.video} onChange={event => onChange({ ...section, video: event.target.value.trim() })} /></div>
    <p className="text-xs text-ink-muted">Step ids are fixed once students see the lesson: their checklist ticks are saved against them. Slow motion is the player&apos;s speed control.</p>
    <ol className="space-y-2">{section.items.map((step, index) => (
      <li key={index} className="space-y-2 rounded-lg border border-line p-2">
        <div className="flex items-center justify-between gap-2"><span className={sectionLabelClass}>Step {index + 1}</span>
          <span className="flex gap-1">
            <button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => setItems(move(section.items, index, index - 1))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><ArrowUp className="size-3.5" /></button>
            <button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === section.items.length - 1} onClick={() => setItems(move(section.items, index, index + 1))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><ArrowDown className="size-3.5" /></button>
            <button type="button" aria-label={`Remove step ${index + 1}`} disabled={section.items.length === 1} onClick={() => setItems(section.items.filter((_, at) => at !== index))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><Trash className="size-3.5" /></button>
          </span></div>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <input aria-label={`Step ${index + 1} title`} placeholder="Title, e.g. Chamber position" maxLength={300} className={fieldClass} value={step.title} onChange={event => setItem(index, { title: event.target.value })} />
          <input aria-label={`Step ${index + 1} id`} placeholder="id, e.g. chamber" maxLength={60} className={cn(fieldClass, 'font-mono text-xs')} value={step.id} onChange={event => setItem(index, { id: slug(event.target.value) || step.id })} />
        </div>
        <textarea aria-label={`Step ${index + 1} instructions`} placeholder="What to do" rows={2} className={cn(fieldClass, 'py-2')} value={step.body} onChange={event => setItem(index, { body: event.target.value })} />
        <ClipInput label={`Step ${index + 1} clip`} clip={step.clip} onChange={clip => setItem(index, { clip })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <ListArea label="Common mistakes, one per line as Mistake -> correction" value={step.mistakes} format={() => mistakesText(step.mistakes)} parse={textMistakes} onChange={mistakes => setItem(index, { mistakes })} />
          <ListArea label="Practice checklist, one point per line" value={step.checklist} format={() => step.checklist.join('\n')} parse={text => toLines(text).slice(0, 20)} onChange={checklist => setItem(index, { checklist })} />
        </div>
      </li>))}</ol>
    <button type="button" className={buttonClass({ size: 'sm' })} disabled={section.items.length >= 40}
      onClick={() => setItems([...section.items, { id: uniqueId(section.items, `step-${section.items.length + 1}`), title: `Step ${section.items.length + 1}`, body: '', clip: null, mistakes: [], checklist: [] }])}><Plus className="size-3.5" /> Add step</button>
  </div>;
}

/** Poomsae floor plan: the geometry is imported; a clip and mistakes can be added per movement. */
export function DiagramMovementsEditor({ section, onChange }: { section: Extract<LibrarySection, { type: 'diagram' }>; onChange: (section: LibrarySection) => void }) {
  const [open, setOpen] = useState(false);
  const count = section.data.steps.length;
  const movements = Array.from({ length: count }, (_, i) => section.movements?.[i] ?? { clip: null, mistakes: [] });
  const setMovement = (index: number, change: Partial<(typeof movements)[number]>) => {
    const next = movements.map((m, at) => at === index ? { ...m, ...change } : m);
    // Trailing empty notes are dropped so the stored list stays short.
    let end = next.length; while (end > 0 && !next[end - 1].clip && next[end - 1].mistakes.length === 0) end--;
    onChange({ ...section, movements: end ? next.slice(0, end) : undefined });
  };
  const noted = movements.filter(m => m.clip || m.mistakes.length).length;
  return <div className="space-y-2 rounded-lg border border-dashed border-line p-3 text-xs">
    <p className="text-ink-muted">Poomsae floor diagram with {count} movements, imported from the website. Students see it as an animated floor plan. {noted ? `${noted} movement${noted === 1 ? '' : 's'} have a clip or mistakes.` : ''}</p>
    <div><label className={labelClass} htmlFor={`${section.id}-video`}>Form video for movement clips (https://)</label>
      <input id={`${section.id}-video`} className={fieldClass} placeholder="https://www.youtube.com/watch?v=…" value={section.video ?? ''} onChange={event => onChange({ ...section, video: event.target.value.trim() || undefined })} /></div>
    <button type="button" className={buttonClass({ size: 'sm' })} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Hide movement notes' : 'Clips and mistakes per movement'}</button>
    {open && <ol className="space-y-2">{movements.map((movement, index) => {
      const techniques = (section.data.steps[index] as { techniques?: string[] }).techniques ?? [];
      return <li key={index} className="space-y-2 rounded-lg border border-line p-2">
        <span className={sectionLabelClass}>Movement {index + 1}{techniques.length ? ` · ${techniques.join(', ')}` : ''}</span>
        <ClipInput label={`Movement ${index + 1} clip`} clip={movement.clip} onChange={clip => setMovement(index, { clip })} />
        <ListArea label="Common mistakes, one per line as Mistake -> correction" value={movement.mistakes} format={() => mistakesText(movement.mistakes)} parse={textMistakes} onChange={mistakes => setMovement(index, { mistakes })} />
      </li>;
    })}</ol>}
  </div>;
}
