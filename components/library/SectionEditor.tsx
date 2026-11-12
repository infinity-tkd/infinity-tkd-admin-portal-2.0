'use client';
import { useState } from 'react';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { buttonClass, fieldClass, labelClass, sectionLabelClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import { TechniqueStepsEditor, DiagramMovementsEditor } from './TechniqueStepsEditor';
import { emptySection, nextSectionId, SECTION_TYPE_LABEL, SECTION_TYPES, type LibrarySection, type LibrarySectionType } from '@/lib/library-content';

type Row = Record<string, any>;
type Field = { key: string; label: string; multiline?: boolean };
/** Item fields per section type; "lines" fields hold one entry per line. */
const ROW_FIELDS: Partial<Record<LibrarySectionType, { fields: Field[]; lines?: { key: string; label: string }; facts?: boolean; blank: Row }>> = {
  steps: { fields: [{ key: 'title', label: 'Step title (optional)' }, { key: 'body', label: 'What to do', multiline: true }], lines: { key: 'details', label: 'Details, one per line' }, blank: { title: '', body: '', details: [] } },
  pairs: { fields: [{ key: 'term', label: 'Term' }, { key: 'detail', label: 'Detail', multiline: true }], blank: { term: '', detail: '' } },
  glossary: { fields: [{ key: 'korean', label: 'Korean' }, { key: 'romanized', label: 'Romanized' }, { key: 'english', label: 'English' }, { key: 'category', label: 'Group' }], blank: { korean: '', romanized: '', english: '', category: '' } },
  facts: { fields: [{ key: 'label', label: 'Label' }, { key: 'value', label: 'Value' }], blank: { label: '', value: '' } },
  timeline: { fields: [{ key: 'date', label: 'Date' }, { key: 'title', label: 'Title' }, { key: 'subtitle', label: 'Subtitle' }, { key: 'body', label: 'Text', multiline: true }, { key: 'tag', label: 'Era or tag' }], lines: { key: 'details', label: 'Details, one per line' }, blank: { date: '', title: '', subtitle: '', body: '', details: [], tag: '' } },
  cards: { fields: [{ key: 'title', label: 'Title' }, { key: 'subtitle', label: 'Subtitle' }, { key: 'body', label: 'Text', multiline: true }], lines: { key: 'bullets', label: 'Bullet points, one per line' }, facts: true, blank: { title: '', subtitle: '', body: '', bullets: [], facts: [] } },
  links: { fields: [{ key: 'label', label: 'Label' }, { key: 'url', label: 'Link (https://)' }], blank: { label: '', url: 'https://' } },
};
const linesToArray = (value: string) => value.split('\n').map(line => line.trimEnd()).filter(line => line.trim() !== '');
const factsToText = (facts: { label: string; value: string }[] = []) => facts.map(fact => `${fact.label}: ${fact.value}`).join('\n');
const textToFacts = (value: string) => linesToArray(value).map(line => { const at = line.indexOf(':'); return at > 0 ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() } : { label: line.trim(), value: '' }; });

/** Lines and "Label: value" text areas keep their raw text while typing; arrays are parsed on blur. */
function LinesInput({ value, onChange, label, facts = false }: { value: any[]; onChange: (next: any[]) => void; label: string; facts?: boolean }) {
  const format = () => facts ? factsToText(value) : (value as string[]).join('\n');
  const [draft, setDraft] = useState<string | null>(null);
  return <textarea aria-label={label} placeholder={label} rows={Math.min(8, Math.max(2, value.length + 1))} className={cn(fieldClass, 'py-2 text-xs')} value={draft ?? format()}
    onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== null) { onChange(facts ? textToFacts(draft) : linesToArray(draft)); setDraft(null); } }} />;
}
const move = <T,>(list: T[], from: number, to: number) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

function RowsEditor({ section, onChange }: { section: LibrarySection & { items: Row[] }; onChange: (section: LibrarySection) => void }) {
  const spec = ROW_FIELDS[section.type]!;
  const setItems = (items: Row[]) => onChange({ ...section, items } as LibrarySection);
  const setItem = (index: number, change: Row) => setItems(section.items.map((row, at) => at === index ? { ...row, ...change } : row));
  return <div className="space-y-2">
    {section.type === 'pairs' && <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label="Left column heading" placeholder="Left heading (e.g. Mistake)" maxLength={80} className={fieldClass} value={section.leftLabel} onChange={event => onChange({ ...section, leftLabel: event.target.value })} />
      <input aria-label="Right column heading" placeholder="Right heading (e.g. Correction)" maxLength={80} className={fieldClass} value={section.rightLabel} onChange={event => onChange({ ...section, rightLabel: event.target.value })} /></div>}
    <ol className="space-y-2">{section.items.map((row, index) => (
      <li key={index} className="rounded-lg border border-line p-2">
        <div className="mb-1.5 flex items-center justify-between gap-2"><span className={sectionLabelClass}>{index + 1}</span>
          <span className="flex gap-1">
            <button type="button" aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => setItems(move(section.items, index, index - 1))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><ArrowUp className="size-3.5" /></button>
            <button type="button" aria-label={`Move item ${index + 1} down`} disabled={index === section.items.length - 1} onClick={() => setItems(move(section.items, index, index + 1))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><ArrowDown className="size-3.5" /></button>
            <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setItems(section.items.filter((_, at) => at !== index))} className={buttonClass({ size: 'sm', variant: 'ghost' })}><Trash className="size-3.5" /></button>
          </span></div>
        <div className={cn('grid gap-2', spec.fields.length > 2 && 'sm:grid-cols-2')}>
          {spec.fields.map(field => field.multiline
            ? <textarea key={field.key} aria-label={field.label} placeholder={field.label} rows={2} className={cn(fieldClass, 'py-2 sm:col-span-2')} value={row[field.key] ?? ''} onChange={event => setItem(index, { [field.key]: event.target.value })} />
            : <input key={field.key} aria-label={field.label} placeholder={field.label} className={fieldClass} value={row[field.key] ?? ''} onChange={event => setItem(index, { [field.key]: event.target.value })} />)}
          {spec.lines && <div className="sm:col-span-2"><LinesInput label={spec.lines.label} value={row[spec.lines.key] ?? []} onChange={next => setItem(index, { [spec.lines!.key]: next })} /></div>}
          {spec.facts && <div className="sm:col-span-2"><LinesInput facts label="Facts, one per line as Label: value" value={row.facts ?? []} onChange={next => setItem(index, { facts: next })} /></div>}
        </div>
      </li>))}</ol>
    <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => setItems([...section.items, structuredClone(spec.blank)])}><Plus className="size-3.5" /> Add item</button>
  </div>;
}

function TableEditor({ section, onChange }: { section: Extract<LibrarySection, { type: 'table' }>; onChange: (section: LibrarySection) => void }) {
  const set = (columns: string[], rows: string[][]) => onChange({ ...section, columns, rows });
  return <div className="space-y-2">
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] border-separate border-spacing-1 text-xs">
      <thead><tr>{section.columns.map((column, c) => <th key={c} className="font-normal">
        <div className="flex gap-1"><input aria-label={`Column ${c + 1} heading`} className={cn(fieldClass, 'font-semibold')} value={column} onChange={event => set(section.columns.map((value, at) => at === c ? event.target.value : value), section.rows)} />
          <button type="button" aria-label={`Remove column ${c + 1}`} disabled={section.columns.length === 1} onClick={() => set(section.columns.filter((_, at) => at !== c), section.rows.map(row => row.filter((_, at) => at !== c)))} className={buttonClass({ size: 'icon', variant: 'ghost' })}><Trash className="size-3.5" /></button></div></th>)}<th /></tr></thead>
      <tbody>{section.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><input aria-label={`Row ${r + 1}, ${section.columns[c] || `column ${c + 1}`}`} className={fieldClass} value={cell} onChange={event => set(section.columns, section.rows.map((cells, at) => at === r ? cells.map((value, ci) => ci === c ? event.target.value : value) : cells))} /></td>)}
        <td><button type="button" aria-label={`Remove row ${r + 1}`} onClick={() => set(section.columns, section.rows.filter((_, at) => at !== r))} className={buttonClass({ size: 'icon', variant: 'ghost' })}><Trash className="size-3.5" /></button></td></tr>)}</tbody>
    </table></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => set(section.columns, [...section.rows, section.columns.map(() => '')])}><Plus className="size-3.5" /> Add row</button>
      <button type="button" className={buttonClass({ size: 'sm' })} disabled={section.columns.length >= 12} onClick={() => set([...section.columns, `Column ${section.columns.length + 1}`], section.rows.map(row => [...row, '']))}><Plus className="size-3.5" /> Add column</button>
    </div>
    <input aria-label="Table caption" placeholder="Caption (optional)" maxLength={500} className={fieldClass} value={section.caption} onChange={event => onChange({ ...section, caption: event.target.value })} />
  </div>;
}

function SectionBody({ section, onChange }: { section: LibrarySection; onChange: (section: LibrarySection) => void }) {
  switch (section.type) {
    case 'text': return <textarea aria-label="Paragraphs, separated by a blank line" placeholder="Paragraphs, separated by a blank line" rows={Math.min(14, 3 + Math.round(section.paragraphs.join('\n\n').length / 160))} className={cn(fieldClass, 'py-2')}
      value={section.paragraphs.join('\n\n')} onChange={event => onChange({ ...section, paragraphs: event.target.value.split(/\n\s*\n/) })} onBlur={() => onChange({ ...section, paragraphs: section.paragraphs.map(p => p.trim()).filter(Boolean) })} />;
    case 'list': return <div className="space-y-2">
      <select aria-label="List style" className={fieldClass} value={section.style} onChange={event => onChange({ ...section, style: event.target.value as typeof section.style })}><option value="bullet">Bullets</option><option value="number">Numbered</option><option value="check">Checklist</option></select>
      <LinesInput label="Items, one per line" value={section.items} onChange={items => onChange({ ...section, items })} /></div>;
    case 'callout': return <div className="space-y-2">
      <select aria-label="Callout style" className={fieldClass} value={section.tone} onChange={event => onChange({ ...section, tone: event.target.value as typeof section.tone })}><option value="info">Note</option><option value="tip">Tip</option><option value="warning">Warning</option></select>
      <textarea aria-label="Callout text" rows={3} className={cn(fieldClass, 'py-2')} value={section.body} onChange={event => onChange({ ...section, body: event.target.value })} /></div>;
    case 'table': return <TableEditor section={section} onChange={onChange} />;
    case 'technique-steps': return <TechniqueStepsEditor section={section} onChange={onChange} />;
    case 'diagram': return <DiagramMovementsEditor section={section} onChange={onChange} />;
    default: return <RowsEditor section={section as LibrarySection & { items: Row[] }} onChange={onChange} />;
  }
}

/** Ordered, typed sections of one lesson: add, edit, reorder and remove. */
export function SectionEditor({ sections, onChange }: { sections: LibrarySection[]; onChange: (sections: LibrarySection[]) => void }) {
  const [adding, setAdding] = useState<LibrarySectionType>('text');
  const setAt = (index: number, section: LibrarySection) => onChange(sections.map((row, at) => at === index ? section : row));
  return <div className="space-y-3">
    {sections.length === 0 && <p className="text-sm text-ink-muted">No sections yet. Add paragraphs, steps, a glossary, a table and more below.</p>}
    {sections.map((section, index) => (
      <section key={section.id} aria-label={`Section ${index + 1}: ${section.title || SECTION_TYPE_LABEL[section.type]}`} className="space-y-2 rounded-lg border border-line bg-surface-muted p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-control px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">{SECTION_TYPE_LABEL[section.type]}</span>
          <input aria-label={`Section ${index + 1} title`} placeholder="Section title (optional)" maxLength={200} className={cn(fieldClass, 'min-w-[12rem] flex-1')} value={section.title} onChange={event => setAt(index, { ...section, title: event.target.value })} />
          <span className="flex gap-1">
            <button type="button" aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => onChange(move(sections, index, index - 1))} className={buttonClass({ size: 'icon' })}><ArrowUp className="size-4" /></button>
            <button type="button" aria-label={`Move section ${index + 1} down`} disabled={index === sections.length - 1} onClick={() => onChange(move(sections, index, index + 1))} className={buttonClass({ size: 'icon' })}><ArrowDown className="size-4" /></button>
            <button type="button" aria-label={`Remove section ${index + 1}`} onClick={() => onChange(sections.filter((_, at) => at !== index))} className={buttonClass({ size: 'icon', variant: 'danger' })}><Trash className="size-4" /></button>
          </span>
        </div>
        <SectionBody section={section} onChange={next => setAt(index, next)} />
      </section>
    ))}
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3">
      <div className="min-w-[12rem] flex-1"><label htmlFor="add-section-type" className={labelClass}>New section</label>
        <select id="add-section-type" className={fieldClass} value={adding} onChange={event => setAdding(event.target.value as LibrarySectionType)}>
          {SECTION_TYPES.filter(type => type !== 'diagram').map(type => <option key={type} value={type}>{SECTION_TYPE_LABEL[type]}</option>)}
        </select></div>
      <button type="button" className={buttonClass()} disabled={sections.length >= 80} onClick={() => onChange([...sections, emptySection(adding, nextSectionId(sections, adding))])}><Plus className="size-4" weight="bold" /> Add section</button>
    </div>
  </div>;
}
