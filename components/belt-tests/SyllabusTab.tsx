'use client';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { portalRequest } from '@/lib/portal-api';
import { BELT_TEST_DEFAULTS, DEFAULT_SCORING_RULES, SECTION_KINDS, type SectionKind } from '@/lib/belt-test-scoring';
import type { BeltRow, BeltTestOverview, SyllabusDetail, SyllabusRow } from '@/lib/belt-test-contract';
import { useBeltTestActions, useBeltTestView } from './use-belt-tests';
import { Badge, cardClass, ErrorNote, inputClass, Labeled, primaryButton, secondaryButton } from './ui';

interface DraftItem { key: string; title: string; libraryAssetId: number | null; weight: number; critical: boolean; guide: string; reps: string; timesPerWeek: string; formId: string | null }
interface DraftSection { key: string; kind: SectionKind; title: string; weight: number; minimum: number | null; items: DraftItem[] }
interface Draft {
  id?: string; revision?: number; targetBeltId: number; track: 'color' | 'kukkiwon'; title: string;
  passMark: number; distinctionMark: number; sectionMinimum: number; criticalMinimum: number; retestDays: number; feeUsd: number;
  eligibility: { minimumDays: number; minimumClasses: number; minimumSkillAverage: number; requireLessons: boolean }; notes: string; sections: DraftSection[];
}
const key = () => crypto.randomUUID();
const trackOf = (belt: BeltRow) => belt.belt_type.toLowerCase() === 'black' ? 'kukkiwon' as const : 'color' as const;

function draftFrom(belt: BeltRow, source?: SyllabusDetail): Draft {
  const track = trackOf(belt), defaults = BELT_TEST_DEFAULTS[belt.belt_name];
  if (source) {
    const s = source.syllabus;
    return { targetBeltId: belt.id, track, title: s.title, passMark: s.pass_mark ?? defaults?.passMark ?? 70, distinctionMark: s.distinction_mark ?? DEFAULT_SCORING_RULES.distinctionMark,
      sectionMinimum: s.section_minimum ?? DEFAULT_SCORING_RULES.sectionMinimum, criticalMinimum: s.critical_minimum ?? DEFAULT_SCORING_RULES.criticalMinimum, retestDays: s.retest_days ?? DEFAULT_SCORING_RULES.retestDays,
      feeUsd: Number(s.fee_usd ?? 0), eligibility: { ...s.eligibility }, notes: s.notes,
      sections: source.sections.map(section => ({ key: key(), kind: section.kind, title: section.title, weight: section.weight ?? 0, minimum: section.minimum,
        items: source.items.filter(item => item.section_id === section.id).map(item => ({ key: key(), title: item.title, libraryAssetId: item.library_asset_id, weight: item.weight, critical: item.critical, guide: item.guide,
          reps: item.practice_target?.reps ? String(item.practice_target.reps) : '', timesPerWeek: item.practice_target?.timesPerWeek ? String(item.practice_target.timesPerWeek) : '', formId: item.form_id ?? null })) })) };
  }
  const weights = defaults?.weights ?? [25, 25, 25, 25];
  const sections: DraftSection[] = track === 'color'
    ? SECTION_KINDS.slice(0, 4).map((section, index) => ({ key: key(), kind: section.kind, title: section.label, weight: weights[index], minimum: null, items: [] }))
    : [{ kind: 'poomsae' as const, title: 'Poomsae' }, { kind: 'skill' as const, title: 'Kyorugi (Sparring)' }, { kind: 'custom' as const, title: 'Kyukpa (Breaking)' }].map(section => ({ key: key(), ...section, weight: 0, minimum: null, items: [] }));
  return { targetBeltId: belt.id, track, title: track === 'color' ? `${belt.belt_name} belt test` : `Kukkiwon ${belt.belt_name} test`, passMark: defaults?.passMark ?? 70,
    distinctionMark: DEFAULT_SCORING_RULES.distinctionMark, sectionMinimum: DEFAULT_SCORING_RULES.sectionMinimum, criticalMinimum: DEFAULT_SCORING_RULES.criticalMinimum, retestDays: DEFAULT_SCORING_RULES.retestDays, feeUsd: 0,
    eligibility: { minimumDays: defaults?.minimumDays ?? 90, minimumClasses: defaults?.minimumClasses ?? 24, minimumSkillAverage: defaults?.minimumSkillAverage ?? 0, requireLessons: false }, notes: '', sections };
}

function draftIssues(draft: Draft): string[] {
  const issues: string[] = [];
  if (draft.title.trim().length < 3) issues.push('Give the syllabus a title.');
  if (!draft.sections.length) issues.push('Add at least one section.');
  if (draft.sections.some(section => section.title.trim().length < 2)) issues.push('Every section needs a title.');
  if (draft.sections.some(section => !section.items.length)) issues.push('Every section needs at least one item.');
  if (draft.sections.some(section => section.items.some(item => !item.title.trim()))) issues.push('Every item needs a name.');
  if (draft.sections.some(section => section.items.some(item => (item.reps && !(Number.isInteger(Number(item.reps)) && Number(item.reps) >= 1 && Number(item.reps) <= 100000)) || (item.timesPerWeek && !(Number.isInteger(Number(item.timesPerWeek)) && Number(item.timesPerWeek) >= 1 && Number(item.timesPerWeek) <= 14)))))
    issues.push('Home practice: reps are 1 to 100000 and times per week 1 to 14.');
  if (draft.track === 'color') {
    const total = draft.sections.reduce((sum, section) => sum + (Number(section.weight) || 0), 0);
    if (Math.abs(total - 100) > 1e-9) issues.push(`Section weights add up to ${total}; they must add up to 100.`);
    if (draft.distinctionMark < draft.passMark) issues.push('The distinction mark must be at or above the pass mark.');
  }
  if (!(draft.feeUsd >= 0 && draft.feeUsd <= 10000) || Math.abs(draft.feeUsd * 100 - Math.round(draft.feeUsd * 100)) > 1e-6) issues.push('Enter a test fee from 0 to 10000 USD (cents at most).');
  return issues;
}

/** Home-practice target and form link, sent only when set. */
function practiceFields(item: DraftItem) {
  const reps = Number(item.reps), times = Number(item.timesPerWeek);
  const target = { ...(Number.isInteger(reps) && reps > 0 ? { reps } : {}), ...(Number.isInteger(times) && times > 0 ? { timesPerWeek: times } : {}) };
  return { ...(Object.keys(target).length ? { practiceTarget: target } : {}), ...(item.formId ? { formId: item.formId } : {}) };
}

function payload(draft: Draft) {
  const color = draft.track === 'color';
  return {
    action: 'syllabus_save' as const, ...(draft.id ? { id: draft.id, revision: draft.revision } : {}), targetBeltId: draft.targetBeltId, title: draft.title.trim(),
    ...(color ? { passMark: draft.passMark, distinctionMark: draft.distinctionMark, sectionMinimum: draft.sectionMinimum, criticalMinimum: draft.criticalMinimum, retestDays: draft.retestDays } : {}),
    feeUsd: draft.feeUsd, eligibility: draft.eligibility, notes: draft.notes,
    sections: draft.sections.map(section => ({ kind: section.kind, title: section.title.trim(), ...(color ? { weight: Number(section.weight), minimum: section.minimum } : {}),
      items: section.items.map(item => ({ title: item.title.trim(), libraryAssetId: item.libraryAssetId, ...(color ? { weight: Number(item.weight), critical: item.critical } : {}), guide: item.guide,
        ...practiceFields(item) })) })),
  };
}

export function SyllabusTab({ overview, canManage }: { overview: BeltTestOverview; canManage: boolean }) {
  const testableBelts = overview.belts.filter(belt => belt.belt_order > 1 && (trackOf(belt) === 'color' || belt.belt_order <= 8));
  const [beltId, setBeltId] = useState<number>(testableBelts[0]?.id ?? 0);
  const belt = testableBelts.find(row => row.id === beltId);
  const versions = overview.syllabi.filter(row => row.target_belt_id === beltId);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { setOpenId(versions.find(row => row.status === 'draft')?.id ?? versions.find(row => row.status === 'published')?.id ?? null); }, [beltId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when the belt changes
  const detail = useBeltTestView<SyllabusDetail>(openId ? { view: 'syllabus', id: openId } : null);
  const actions = useBeltTestActions();
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft | null>(null);
  useEffect(() => { setNewDraft(null); }, [beltId]);
  const current = versions.find(row => row.id === openId);

  /** A new version starts from the published one (or the academy defaults) and stays local until saved. */
  const startDraft = async () => {
    if (!belt) return;
    setCreating(true);
    const published = versions.find(row => row.status === 'published');
    let source: SyllabusDetail | undefined;
    if (published) { try { source = await portalRequest<SyllabusDetail>('/api/belt-tests?' + new URLSearchParams({ view: 'syllabus', id: published.id })); } catch { source = undefined; } }
    setCreating(false); setOpenId(null); setNewDraft(draftFrom(belt, source));
  };

  return <div className="space-y-4">
    <div className={cardClass + ' space-y-3'}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs"><Labeled label="Belt being tested for"><select className={inputClass} value={beltId} onChange={event => setBeltId(Number(event.target.value))}>
          {testableBelts.map(row => <option key={row.id} value={row.id}>{row.belt_name}{trackOf(row) === 'kukkiwon' ? ' (Kukkiwon via CTF)' : ''}</option>)}
        </select></Labeled></div>
        {canManage && !newDraft && !versions.some(row => row.status === 'draft') && <button type="button" className={primaryButton} disabled={creating || actions.busy || !belt} onClick={() => void startDraft()}>{versions.length ? 'New draft version' : 'Create syllabus'}</button>}
      </div>
      <p className="text-xs text-neutral-500">{belt && trackOf(belt) === 'kukkiwon'
        ? 'Kukkiwon black belt tests are run by Kukkiwon Cambodia through the CTF. This syllabus lists what will be tested so students can prepare; the academy does not score it.'
        : 'Color belt tests are scored by the academy: each item 0–10, sections weighted to 100%. Published versions are frozen; edit a new draft version to change them.'}</p>
      {versions.length > 0 && <div className="flex flex-wrap gap-2">{versions.map(row => <button key={row.id} type="button" onClick={() => setOpenId(row.id)} aria-pressed={openId === row.id}
        className={secondaryButton + (openId === row.id ? ' ring-2 ring-brand' : '')}>v{row.version} · {row.status === 'draft' ? 'Draft' : row.status === 'published' ? 'Published' : 'Retired'}</button>)}</div>}
      <ErrorNote message={actions.error} />
    </div>
    {newDraft && belt && <SyllabusEditor key="new" belt={belt} initial={newDraft} actions={actions} onSaved={id => { setNewDraft(null); setOpenId(id); }} onClose={() => setNewDraft(null)} />}
    {!newDraft && openId && detail.error && <ErrorNote message={detail.error} />}
    {!newDraft && openId && !detail.data && !detail.error && <p role="status" className="text-sm text-neutral-500">Loading syllabus…</p>}
    {!newDraft && detail.data && belt && current && (current.status === 'draft' && canManage
      ? <SyllabusEditor key={current.id + ':' + current.revision} belt={belt} row={current} initial={{ ...draftFrom(belt, detail.data), id: current.id, revision: current.revision }} actions={actions} onSaved={id => setOpenId(id)} onClose={() => setOpenId(null)} />
      : <SyllabusReadOnly detail={detail.data} canManage={canManage} actions={actions} />)}
  </div>;
}

function SyllabusReadOnly({ detail, canManage, actions }: { detail: SyllabusDetail; canManage: boolean; actions: ReturnType<typeof useBeltTestActions> }) {
  const s = detail.syllabus, color = s.track === 'color';
  return <div className={cardClass + ' space-y-4'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{s.title} · v{s.version}</h3>
      <div className="flex gap-2"><Badge tone={s.status === 'published' ? 'green' : 'neutral'}>{s.status === 'published' ? 'Published' : s.status === 'retired' ? 'Retired' : 'Draft'}</Badge>
        {canManage && s.status === 'published' && <button type="button" className={secondaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'syllabus_retire', id: s.id }, 'Syllabus retired.')}>Retire</button>}</div></div>
    {color && <p className="text-xs text-neutral-600 dark:text-neutral-400">Pass {s.pass_mark}% · Distinction {s.distinction_mark}% · Each section ≥ {s.section_minimum}% · Critical items ≥ {s.critical_minimum}/10 · Retest within {s.retest_days} days</p>}
    <p className="text-xs text-neutral-600 dark:text-neutral-400">Test fee: {s.fee_usd > 0 ? '$' + s.fee_usd.toFixed(2) + ' (tracked by the office; never blocks testing)' : 'none'}</p>
    <p className="text-xs text-neutral-600 dark:text-neutral-400">Eligibility: {s.eligibility.minimumDays} days at current belt · {s.eligibility.minimumClasses} classes · skill average ≥ {s.eligibility.minimumSkillAverage}{s.eligibility.requireLessons ? ' · linked library lessons completed' : ''}</p>
    {detail.sections.map(section => <section key={section.id} className="space-y-1">
      <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">{section.title}{color ? ` · ${section.weight}%` : ''}{color && section.minimum != null ? ` · minimum ${section.minimum}%` : ''}</h4>
      <ul className="space-y-1 text-sm">{detail.items.filter(item => item.section_id === section.id).map(item => <li key={item.id} className="flex flex-wrap items-center gap-2">
        <span>{item.title}</span>{color && item.weight !== 1 && <Badge>×{item.weight}</Badge>}{item.critical && <Badge tone="red">Critical</Badge>}{item.library_asset_id && <Badge tone="blue">Library</Badge>}
        {item.form_id && <Badge tone="blue">Form</Badge>}
        {item.practice_target && <Badge>Home: {[item.practice_target.reps ? `${item.practice_target.reps} reps` : '', item.practice_target.timesPerWeek ? `${item.practice_target.timesPerWeek}×/week` : ''].filter(Boolean).join(', ')}</Badge>}
        {item.guide &&<span className="text-xs text-neutral-500">— {item.guide}</span>}</li>)}</ul>
    </section>)}
    {s.notes && <p className="whitespace-pre-wrap text-xs text-neutral-500">{s.notes}</p>}
  </div>;
}

function SyllabusEditor({ belt, row, initial, actions, onSaved, onClose }: { belt: BeltRow; row?: SyllabusRow; initial: Draft; actions: ReturnType<typeof useBeltTestActions>; onSaved: (id: string) => void; onClose: () => void }) {
  const { state, showConfirm } = useAppStore();
  const [draft, setDraft] = useState<Draft>(initial);
  const libraryListId = useId();
  const library = useMemo(() => state.curriculumVideos.map(video => ({ id: video.id, title: video.title })).sort((a, b) => a.title.localeCompare(b.title)), [state.curriculumVideos]);
  // Registered poomsae forms (Coaching → Forms); empty until the LMS is set up.
  const [forms, setForms] = useState<{ id: string; name: string; published: boolean }[]>([]);
  useEffect(() => { let alive = true; portalRequest<{ forms: { id: string; name: string; published: boolean }[] }>('/api/admin/lms?view=forms').then(result => { if (alive) setForms(Array.isArray(result?.forms) ? result.forms : []); }).catch(() => {}); return () => { alive = false; }; }, []);
  const issues = draftIssues(draft), color = draft.track === 'color';
  const totalWeight = draft.sections.reduce((sum, section) => sum + (Number(section.weight) || 0), 0);
  const setSection = (index: number, change: Partial<DraftSection>) => setDraft(value => ({ ...value, sections: value.sections.map((section, at) => at === index ? { ...section, ...change } : section) }));
  const setItem = (sectionIndex: number, itemIndex: number, change: Partial<DraftItem>) => setSection(sectionIndex, { items: draft.sections[sectionIndex].items.map((item, at) => at === itemIndex ? { ...item, ...change } : item) });
  const move = <T,>(list: T[], from: number, to: number) => { const next = [...list]; const [entry] = next.splice(from, 1); next.splice(to, 0, entry); return next; };
  const save = async () => { const saved = await actions.run<{ id: string }>(payload(draft), 'Draft saved.'); if (saved?.id) onSaved(saved.id); };
  const publish = () => showConfirm(`Publish "${draft.title}"? It replaces the current published syllabus for ${belt.belt_name} and is frozen once published.`, async () => {
    const saved = await actions.run<{ id: string; revision: number }>(payload(draft));
    if (saved && await actions.run({ action: 'syllabus_publish', id: saved.id, revision: saved.revision }, 'Syllabus published.')) onSaved(saved.id);
  }, 'Publish syllabus');

  return <div className={cardClass + ' space-y-5'}>
    <datalist id={libraryListId}>{library.map(entry => <option key={entry.id} value={entry.title} />)}</datalist>
    <div className="grid gap-3 sm:grid-cols-2">
      <Labeled label="Syllabus title" wide><input className={inputClass} value={draft.title} maxLength={160} onChange={event => setDraft({ ...draft, title: event.target.value })} /></Labeled>
      <Labeled label="Test fee (USD, 0 = no fee)" hint="Copied onto each registration so the office can mark it paid or waived. It never blocks testing or promotion.">
        <input className={inputClass} type="number" inputMode="decimal" min={0} max={10000} step={0.01} value={draft.feeUsd} onChange={event => setDraft({ ...draft, feeUsd: event.target.value === '' ? 0 : Number(event.target.value) })} />
      </Labeled>
      {color && <>
        <Labeled label="Pass mark (%)"><input className={inputClass} type="number" min={0} max={100} step={0.5} value={draft.passMark} onChange={event => setDraft({ ...draft, passMark: Number(event.target.value) })} /></Labeled>
        <Labeled label="Distinction mark (%)"><input className={inputClass} type="number" min={0} max={100} step={0.5} value={draft.distinctionMark} onChange={event => setDraft({ ...draft, distinctionMark: Number(event.target.value) })} /></Labeled>
        <Labeled label="Minimum per section (%)"><input className={inputClass} type="number" min={0} max={100} step={0.5} value={draft.sectionMinimum} onChange={event => setDraft({ ...draft, sectionMinimum: Number(event.target.value) })} /></Labeled>
        <Labeled label="Minimum for critical items (0–10)"><input className={inputClass} type="number" min={0} max={10} step={0.5} value={draft.criticalMinimum} onChange={event => setDraft({ ...draft, criticalMinimum: Number(event.target.value) })} /></Labeled>
        <Labeled label="Retest window (days)"><input className={inputClass} type="number" min={0} max={365} value={draft.retestDays} onChange={event => setDraft({ ...draft, retestDays: Number(event.target.value) })} /></Labeled>
      </>}
    </div>
    <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-2">
      <legend className="px-1 text-xs font-bold">Eligibility to test</legend>
      <Labeled label="Minimum days at current belt"><input className={inputClass} type="number" min={0} max={3650} value={draft.eligibility.minimumDays} onChange={event => setDraft({ ...draft, eligibility: { ...draft.eligibility, minimumDays: Number(event.target.value) } })} /></Labeled>
      <Labeled label="Minimum classes attended"><input className={inputClass} type="number" min={0} max={1000} value={draft.eligibility.minimumClasses} onChange={event => setDraft({ ...draft, eligibility: { ...draft.eligibility, minimumClasses: Number(event.target.value) } })} /></Labeled>
      <Labeled label="Minimum coach skill average (0–4, 0 = off)" hint="Average of the belt's technique grades in the LMS testing tab."><input className={inputClass} type="number" min={0} max={4} step={0.1} value={draft.eligibility.minimumSkillAverage} onChange={event => setDraft({ ...draft, eligibility: { ...draft.eligibility, minimumSkillAverage: Number(event.target.value) } })} /></Labeled>
      <label className="flex items-center gap-2 self-end text-xs"><input type="checkbox" checked={draft.eligibility.requireLessons} onChange={event => setDraft({ ...draft, eligibility: { ...draft.eligibility, requireLessons: event.target.checked } })} />Require the linked library lessons to be completed</label>
    </fieldset>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Sections</h3>
        {color && <Badge tone={Math.abs(totalWeight - 100) < 1e-9 ? 'green' : 'red'}>Weights total {totalWeight}%</Badge>}</div>
      {draft.sections.map((section, sectionIndex) => <section key={section.key} aria-label={section.title || 'Section'} className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr_6rem_7rem_auto]">
          <Labeled label="Type"><select className={inputClass} value={section.kind} onChange={event => setSection(sectionIndex, { kind: event.target.value as SectionKind })}>{SECTION_KINDS.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}</select></Labeled>
          <Labeled label="Section title"><input className={inputClass} value={section.title} maxLength={120} onChange={event => setSection(sectionIndex, { title: event.target.value })} /></Labeled>
          {color ? <Labeled label="Weight %"><input className={inputClass} type="number" min={0} max={100} step={0.5} value={section.weight} onChange={event => setSection(sectionIndex, { weight: Number(event.target.value) })} /></Labeled> : <span />}
          {color ? <Labeled label="Own minimum %"><input className={inputClass} type="number" min={0} max={100} placeholder={String(draft.sectionMinimum)} value={section.minimum ?? ''} onChange={event => setSection(sectionIndex, { minimum: event.target.value === '' ? null : Number(event.target.value) })} /></Labeled> : <span />}
          <div className="flex items-end gap-1">
            <button type="button" className={secondaryButton} aria-label={`Move ${section.title} up`} disabled={sectionIndex === 0} onClick={() => setDraft({ ...draft, sections: move(draft.sections, sectionIndex, sectionIndex - 1) })}>↑</button>
            <button type="button" className={secondaryButton} aria-label={`Move ${section.title} down`} disabled={sectionIndex === draft.sections.length - 1} onClick={() => setDraft({ ...draft, sections: move(draft.sections, sectionIndex, sectionIndex + 1) })}>↓</button>
            <button type="button" className={secondaryButton} aria-label={`Remove ${section.title}`} onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, at) => at !== sectionIndex) })}>✕</button>
          </div>
        </div>
        <ol className="space-y-2">{section.items.map((item, itemIndex) => <li key={item.key} className="grid gap-2 rounded-md bg-neutral-50 p-2 dark:bg-neutral-900 sm:grid-cols-[1fr_5rem_auto_auto]">
          <Labeled label={`Item ${itemIndex + 1} (pick from the library or type a name)`}>
            <input className={inputClass} list={libraryListId} value={item.title} maxLength={150} onChange={event => { const title = event.target.value; setItem(sectionIndex, itemIndex, { title, libraryAssetId: library.find(entry => entry.title === title)?.id ?? null }); }} />
          </Labeled>
          {color ? <Labeled label="Weight"><input className={inputClass} type="number" min={0.5} max={100} step={0.5} value={item.weight} onChange={event => setItem(sectionIndex, itemIndex, { weight: Number(event.target.value) })} /></Labeled> : <span />}
          {color ? <label className="flex items-end gap-1.5 pb-2 text-xs"><input type="checkbox" checked={item.critical} onChange={event => setItem(sectionIndex, itemIndex, { critical: event.target.checked })} />Critical</label> : <span />}
          <div className="flex items-end gap-1 pb-0.5">
            {item.libraryAssetId && <Badge tone="blue">Library</Badge>}
            <button type="button" className={secondaryButton} aria-label={`Remove ${item.title || 'item'}`} onClick={() => setSection(sectionIndex, { items: section.items.filter((_, at) => at !== itemIndex) })}>✕</button>
          </div>
          <div className="sm:col-span-4"><Labeled label="What a full score looks like (optional)"><input className={inputClass} value={item.guide} maxLength={500} onChange={event => setItem(sectionIndex, itemIndex, { guide: event.target.value })} /></Labeled></div>
          <div className="grid gap-2 sm:col-span-4 sm:grid-cols-[7rem_7rem_1fr]">
            <Labeled label="Home practice: reps"><input className={inputClass} type="number" min={1} max={100000} placeholder="e.g. 50" value={item.reps} onChange={event => setItem(sectionIndex, itemIndex, { reps: event.target.value })} /></Labeled>
            <Labeled label="Times per week"><input className={inputClass} type="number" min={1} max={14} placeholder="e.g. 3" value={item.timesPerWeek} onChange={event => setItem(sectionIndex, itemIndex, { timesPerWeek: event.target.value })} /></Labeled>
            {(section.kind === 'poomsae' || item.formId) && forms.length > 0 ? <Labeled label="Poomsae form (for form progress)"><select className={inputClass} value={item.formId ?? ''} onChange={event => setItem(sectionIndex, itemIndex, { formId: event.target.value || null })}>
              <option value="">Not a registered form</option>{forms.map(form => <option key={form.id} value={form.id}>{form.name}{form.published ? '' : ' (draft)'}</option>)}</select></Labeled> : <span />}
          </div>
        </li>)}</ol>
        <button type="button" className={secondaryButton} onClick={() => setSection(sectionIndex, { items: [...section.items, { key: key(), title: '', libraryAssetId: null, weight: 1, critical: false, guide: '', reps: '', timesPerWeek: '', formId: null }] })}>Add item</button>
      </section>)}
      <button type="button" className={secondaryButton} disabled={draft.sections.length >= 12} onClick={() => setDraft({ ...draft, sections: [...draft.sections, { key: key(), kind: 'custom', title: 'New section', weight: 0, minimum: null, items: [] }] })}>Add section</button>
    </div>
    <Labeled label="Notes for staff (optional)" wide><textarea className={inputClass + ' h-20 py-2'} maxLength={2000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></Labeled>
    {issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <ErrorNote message={actions.error} />
    <div className="flex flex-wrap gap-2">
      <button type="button" className={secondaryButton} disabled={actions.busy || issues.length > 0} onClick={() => void save()}>Save draft</button>
      <button type="button" className={primaryButton} disabled={actions.busy || issues.length > 0} onClick={publish}>Publish</button>
      {row
        ? <button type="button" className={secondaryButton} disabled={actions.busy} onClick={() => showConfirm('Discard this draft? It cannot be recovered.', async () => { if (await actions.run({ action: 'syllabus_discard', id: row.id }, 'Draft discarded.')) onClose(); }, 'Discard draft')}>Discard draft</button>
        : <button type="button" className={secondaryButton} disabled={actions.busy} onClick={onClose}>Cancel</button>}
    </div>
  </div>;
}
