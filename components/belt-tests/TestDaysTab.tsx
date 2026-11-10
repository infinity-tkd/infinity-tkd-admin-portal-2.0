'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { academyDate, addCalendarDays } from '@/lib/dates';
import { computeBeltTestResult, ctfNominationCsv, isItemScore, itemLevel, panelItemScores } from '@/lib/belt-test-scoring';
import { RuleChips } from './RuleChips';
import type { BeltTestOverview, CandidateRow, EligibilityEntry, EventDetail, EventRow, ScoreRow } from '@/lib/belt-test-contract';
import { useBeltTestActions, useBeltTestView } from './use-belt-tests';
import { Badge, CANDIDATE_STATUS, cardClass, ErrorNote, eventStatus, FEE_LABEL, hhmm, inputClass, Labeled, OFF_ROSTER, primaryButton, RESULT_LABEL, secondaryButton } from './ui';
import { ExaminerPanel, FeeEditor, RequestsPanel } from './TestDayPanels';

type Actions = ReturnType<typeof useBeltTestActions>;
const without = (record: Record<string, string>, key: string) => Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));
/** Requests close the day before the test day. */
const dayBefore = (date: string) => addCalendarDays(date, -1);

export function TestDaysTab({ overview, canManage }: { overview: BeltTestOverview; canManage: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const actions = useBeltTestActions();
  if (openId) return <EventDetailView eventId={openId} canManage={canManage} onBack={() => setOpenId(null)} />;
  const beltName = (id: number) => overview.belts.find(belt => belt.id === id)?.belt_name ?? 'Belt ' + id;
  const published = overview.syllabi.filter(row => row.status === 'published');
  return <div className="space-y-4">
    {canManage && <CreateEventForm overview={overview} actions={actions} onCreated={setOpenId} />}
    {canManage && !published.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Publish a syllabus in the Syllabus tab before creating a test day.</p>}
    {!overview.events.length ? <p className="text-sm text-neutral-500">No belt test days yet.</p> : <ul className="space-y-2">
      {overview.events.map(event => { const status = eventStatus(event); const counts = event.counts ?? {};
        const active = Object.entries(counts).filter(([key]) => !OFF_ROSTER.has(key)).reduce((sum, [, n]) => sum + n, 0), requests = counts.requested ?? 0;
        return <li key={event.id}><button type="button" onClick={() => setOpenId(event.id)} className={cardClass + ' flex w-full flex-wrap items-center justify-between gap-3 text-left hover:border-[#EF2F38]/50'}>
          <span className="min-w-0"><span className="block text-sm font-bold">{event.title}</span>
            <span className="block text-xs text-neutral-500">{event.exam_date}{event.start_time ? ' · ' + hhmm(event.start_time) : ''} · {beltName(event.target_belt_id)}{event.location ? ' · ' + event.location : ''} · {active}{event.capacity ? ` of ${event.capacity}` : ''} candidate{active === 1 && !event.capacity ? '' : 's'}</span></span>
          <span className="flex flex-wrap gap-1.5">{requests > 0 && <Badge tone="blue">{requests} request{requests === 1 ? '' : 's'}</Badge>}<Badge tone={event.kind === 'kukkiwon' ? 'black' : 'neutral'}>{event.kind === 'kukkiwon' ? 'Kukkiwon via CTF' : 'Academy color test'}</Badge><Badge tone={status.tone}>{status.label}</Badge></span>
        </button></li>; })}
    </ul>}
  </div>;
}

const validCapacity = (value: string) => value === '' || (/^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 500);
/** Places on the test day and whether students may request one in the student portal. */
function CapacityFields({ capacity, acceptsRequests, onChange }: { capacity: string; acceptsRequests: boolean; onChange: (change: { capacity?: string; acceptsRequests?: boolean }) => void }) {
  return <>
    <Labeled label="Places (leave blank for no limit)" hint={validCapacity(capacity) ? 'Pending requests hold a place.' : 'Enter 1 to 500, or leave blank.'}>
      <input className={inputClass} type="number" inputMode="numeric" min={1} max={500} value={capacity} onChange={event => onChange({ capacity: event.target.value })} />
    </Labeled>
    <label className="flex min-h-11 items-center gap-2 self-end text-xs"><input type="checkbox" checked={acceptsRequests} onChange={event => onChange({ acceptsRequests: event.target.checked })} />
      Eligible students can request a place in the student portal (until the day before)</label>
  </>;
}

function CreateEventForm({ overview, actions, onCreated }: { overview: BeltTestOverview; actions: Actions; onCreated: (id: string) => void }) {
  const { state } = useAppStore();
  const published = overview.syllabi.filter(row => row.status === 'published');
  const [syllabusId, setSyllabusId] = useState(published[0]?.id ?? '');
  const syllabus = published.find(row => row.id === syllabusId);
  const beltName = overview.belts.find(belt => belt.id === syllabus?.target_belt_id)?.belt_name ?? '';
  const [form, setForm] = useState({ title: '', examDate: academyDate(), startTime: '09:00', location: '', branchId: '', capacity: '', acceptsRequests: true });
  useEffect(() => { if (!syllabusId && published[0]) setSyllabusId(published[0].id); }, [published, syllabusId]);
  if (!published.length) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await actions.run<{ id: string }>({ action: 'event_create', syllabusId, title: form.title.trim() || (syllabus?.track === 'kukkiwon' ? `Kukkiwon ${beltName} test` : `${beltName} belt test`),
      examDate: form.examDate, startTime: form.startTime, location: form.location, branchId: form.branchId ? Number(form.branchId) : null,
      capacity: form.capacity ? Number(form.capacity) : null, acceptsRequests: form.acceptsRequests }, 'Test day created. It stays private until you publish it.');
    if (created?.id) onCreated(created.id);
  };
  return <details className={cardClass}><summary className="cursor-pointer text-sm font-bold">Create a test day</summary>
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Labeled label="Belt and syllabus"><select className={inputClass} value={syllabusId} onChange={event => setSyllabusId(event.target.value)}>{published.map(row => <option key={row.id} value={row.id}>{overview.belts.find(belt => belt.id === row.target_belt_id)?.belt_name} · {row.title} (v{row.version}){row.track === 'kukkiwon' ? ' · Kukkiwon' : ''}</option>)}</select></Labeled>
      <Labeled label="Title" hint={'Leave blank for "' + (syllabus?.track === 'kukkiwon' ? `Kukkiwon ${beltName} test` : `${beltName} belt test`) + '"'}><input className={inputClass} maxLength={160} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></Labeled>
      <Labeled label={syllabus?.track === 'kukkiwon' ? 'Kukkiwon test date' : 'Test date'}><input className={inputClass} type="date" required value={form.examDate} onChange={event => setForm({ ...form, examDate: event.target.value })} /></Labeled>
      <Labeled label="Start time (academy time)"><input className={inputClass} type="time" value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} /></Labeled>
      <Labeled label="Location"><input className={inputClass} maxLength={160} value={form.location} placeholder={syllabus?.track === 'kukkiwon' ? 'For example: CTF headquarters, Phnom Penh' : 'For example: Main hall'} onChange={event => setForm({ ...form, location: event.target.value })} /></Labeled>
      <Labeled label="Students from"><select className={inputClass} value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}><option value="">All branches</option>{state.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Labeled>
      <CapacityFields capacity={form.capacity} acceptsRequests={form.acceptsRequests} onChange={change => setForm({ ...form, ...change })} />
      <ErrorNote message={actions.error} />
      <button type="submit" className={primaryButton + ' sm:col-span-2'} disabled={actions.busy || !syllabusId || !validCapacity(form.capacity)}>Create test day</button>
    </form>
  </details>;
}

function EventDetailView({ eventId, canManage, onBack }: { eventId: string; canManage: boolean; onBack: () => void }) {
  const { state, showConfirm } = useAppStore();
  const view = useBeltTestView<EventDetail>({ view: 'event', id: eventId }, 20000);
  const actions = useBeltTestActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const detail = view.data;
  if (!detail) return <div className="space-y-3"><button type="button" className={secondaryButton} onClick={onBack}>← All test days</button>{view.error ? <ErrorNote message={view.error} /> : <p role="status" className="text-sm text-neutral-500">Loading test day…</p>}</div>;
  const { event } = detail, status = eventStatus(event), cancelled = !!event.cancelled_at, kukkiwon = event.kind === 'kukkiwon';
  const activeCandidates = detail.candidates.filter(row => !OFF_ROSTER.has(row.status));
  const pendingRequests = detail.candidates.filter(row => row.status === 'requested').length;
  const placesTaken = activeCandidates.length + pendingRequests;
  const branch = event.branch_id == null ? 'All branches' : state.branches.find(row => row.id === event.branch_id)?.name ?? 'Branch ' + event.branch_id;
  const candidate = detail.candidates.find(row => row.id === selected);
  const promotable = detail.candidates.filter(row => row.status === 'finalized' && (row.result === 'pass' || row.result === 'distinction'));
  const promoteAll = () => showConfirm(`Promote ${promotable.length} student(s) who passed to ${detail.targetBelt}? This creates official belt records dated ${event.exam_date}.`, async () => {
    for (const row of promotable) await actions.run({ action: 'promote', candidateId: row.id, revision: row.revision });
    await view.refresh();
  }, 'Promote passed students');

  return <div className="space-y-4">
    <button type="button" className={secondaryButton} onClick={onBack}>← All test days</button>
    <div className={cardClass + ' space-y-3'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-base font-bold">{event.title}</h2><p className="text-xs text-neutral-500">{event.exam_date}{event.start_time ? ' · ' + hhmm(event.start_time) : ''} · {branch}{event.location ? ' · ' + event.location : ''} · Syllabus v{detail.syllabus.version}</p></div>
        <div className="flex flex-wrap gap-1.5"><Badge tone={kukkiwon ? 'black' : 'neutral'}>{kukkiwon ? 'Kukkiwon via CTF' : 'Academy color test'}</Badge><Badge tone={status.tone}>{status.label}</Badge></div>
      </div>
      <p className="text-xs text-neutral-500">{kukkiwon ? 'Students see the date, location and test curriculum once published. The academy records nominations, the CTF submission, the Kukkiwon result and the certificate; there is no academy scoring.' : 'Students whose next rank is this belt see the test day once published, and their own results once you publish results.'}</p>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">{event.capacity ? `${placesTaken} of ${event.capacity} places taken` : `${activeCandidates.length} on the test day`}{pendingRequests ? ` (${pendingRequests} pending request${pendingRequests === 1 ? '' : 's'})` : ''} · {event.accepts_requests ? `Students can request a place until ${dayBefore(event.exam_date)}` : 'Coach registration only'}</p>
      {canManage && !cancelled && <div className="flex flex-wrap gap-2">
        {!event.published_at && <button type="button" className={primaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'event_publish', id: event.id }, 'Test day published to students.')}>Publish to students</button>}
        <button type="button" className={secondaryButton} onClick={() => setEditing(value => !value)}>{editing ? 'Close editor' : 'Edit date, time and place'}</button>
        {!kukkiwon && <button type="button" className={secondaryButton} disabled={actions.busy || !!event.results_published_at || activeCandidates.some(row => row.status === 'registered' || row.status === 'scoring') || pendingRequests > 0 || !activeCandidates.length}
          onClick={() => showConfirm('Publish results? Each finalized student will see their own result and section scores.', async () => { await actions.run({ action: 'publish_results', eventId: event.id }, 'Results published to students.'); }, 'Publish results')}>Publish results</button>}
        {promotable.length > 0 && <button type="button" className={primaryButton} disabled={actions.busy} onClick={promoteAll}>Promote all passed ({promotable.length})</button>}
        {!detail.candidates.some(row => row.status === 'promoted') && <CancelEvent eventId={event.id} actions={actions} />}
      </div>}
      {editing && <EditEventForm event={event} actions={actions} onDone={() => setEditing(false)} />}
      <ErrorNote message={actions.error} />
    </div>
    {canManage && !cancelled && !event.results_published_at && <RequestsPanel detail={detail} actions={actions} />}
    {canManage && !cancelled && !event.results_published_at && <RegisterPanel detail={detail} actions={actions} />}
    {!kukkiwon && <ExaminerPanel key={(detail.panel ?? []).join(',')} detail={detail} canManage={canManage} actions={actions} />}
    {kukkiwon ? <KukkiwonPanel detail={detail} canManage={canManage} actions={actions} /> : <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
      <CandidateList detail={detail} selected={selected} onSelect={setSelected} canManage={canManage} />
      {candidate ? <ScoreSheet key={candidate.id} detail={detail} candidate={candidate} canManage={canManage} actions={actions} /> : <p className={cardClass + ' text-sm text-neutral-500'}>Choose a candidate to open their score sheet.</p>}
    </div>}
  </div>;
}

function CancelEvent({ eventId, actions }: { eventId: string; actions: Actions }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState('');
  if (!open) return <button type="button" className={secondaryButton} onClick={() => setOpen(true)}>Cancel test day</button>;
  return <form className="flex w-full flex-wrap items-end gap-2" onSubmit={async event => { event.preventDefault(); if (await actions.run({ action: 'event_cancel', id: eventId, reason: reason.trim() }, 'Test day cancelled and hidden from students.')) setOpen(false); }}>
    <div className="min-w-[16rem] flex-1"><Labeled label="Reason for cancelling (kept in the activity history)"><input className={inputClass} required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Labeled></div>
    <button type="submit" className={primaryButton} disabled={actions.busy || reason.trim().length < 5}>Confirm cancel</button>
    <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Keep test day</button>
  </form>;
}

function EditEventForm({ event, actions, onDone }: { event: EventRow; actions: Actions; onDone: () => void }) {
  const { state } = useAppStore();
  const [form, setForm] = useState({ title: event.title, examDate: event.exam_date, startTime: hhmm(event.start_time), location: event.location ?? '', branchId: event.branch_id == null ? '' : String(event.branch_id),
    capacity: event.capacity == null ? '' : String(event.capacity), acceptsRequests: event.accepts_requests !== false });
  return <form className="grid gap-3 border-t border-neutral-200 pt-3 dark:border-neutral-800 sm:grid-cols-2" onSubmit={async submit => { submit.preventDefault();
    if (await actions.run({ action: 'event_update', id: event.id, title: form.title.trim(), examDate: form.examDate, startTime: form.startTime, location: form.location, branchId: form.branchId ? Number(form.branchId) : null,
      capacity: form.capacity ? Number(form.capacity) : null, acceptsRequests: form.acceptsRequests }, 'Test day updated.')) onDone(); }}>
    <Labeled label="Title"><input className={inputClass} required minLength={3} maxLength={160} value={form.title} onChange={change => setForm({ ...form, title: change.target.value })} /></Labeled>
    <Labeled label="Date"><input className={inputClass} type="date" required value={form.examDate} onChange={change => setForm({ ...form, examDate: change.target.value })} /></Labeled>
    <Labeled label="Start time"><input className={inputClass} type="time" value={form.startTime} onChange={change => setForm({ ...form, startTime: change.target.value })} /></Labeled>
    <Labeled label="Location"><input className={inputClass} maxLength={160} value={form.location} onChange={change => setForm({ ...form, location: change.target.value })} /></Labeled>
    <Labeled label="Students from"><select className={inputClass} value={form.branchId} onChange={change => setForm({ ...form, branchId: change.target.value })}><option value="">All branches</option>{state.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Labeled>
    <CapacityFields capacity={form.capacity} acceptsRequests={form.acceptsRequests} onChange={change => setForm({ ...form, ...change })} />
    <button type="submit" className={primaryButton + ' self-end'} disabled={actions.busy || !validCapacity(form.capacity)}>Save changes</button>
  </form>;
}

function RegisterPanel({ detail, actions }: { detail: EventDetail; actions: Actions }) {
  const list = useBeltTestView<{ students: EligibilityEntry[] }>({ view: 'eligibility', syllabusId: detail.event.syllabus_id });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Declined requests can still be registered by staff; pending requests are handled in the requests panel.
  const registered = new Set(detail.candidates.filter(row => row.status !== 'withdrawn' && row.status !== 'declined').map(row => row.student_id));
  const kukkiwon = detail.event.kind === 'kukkiwon';
  const students = (list.data?.students ?? []).filter(row => !registered.has(row.studentId) && (detail.event.branch_id == null || row.homeBranchId === detail.event.branch_id));
  return <details className={cardClass}><summary className="cursor-pointer text-sm font-bold">{kukkiwon ? 'Nominate students' : 'Register students'} ({students.filter(row => row.eligibility.status === 'eligible').length} eligible)</summary>
    <div className="mt-3 space-y-2">
      {list.error && <ErrorNote message={list.error} />}
      {!list.data && !list.error && <p role="status" className="text-sm text-neutral-500">Checking eligibility…</p>}
      {list.data && !students.length && <p className="text-sm text-neutral-500">Every student at the previous belt is already on this test day.</p>}
      {students.map(row => { const eligible = row.eligibility.status === 'eligible';
        return <div key={row.studentId} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{row.englishName} <span className="font-normal text-neutral-500">{row.khmerName} · {row.studentId}</span></span><Badge tone={eligible ? 'green' : 'amber'}>{eligible ? 'Eligible' : 'Not yet eligible'}</Badge></div>
          <RuleChips entry={row} />
          <form className="flex flex-wrap items-end gap-2" onSubmit={async event => { event.preventDefault(); await actions.run({ action: 'register', eventId: detail.event.id, studentId: row.studentId, ...(eligible ? {} : { overrideReason: (overrides[row.studentId] ?? '').trim() }) }, kukkiwon ? 'Student nominated.' : 'Student registered.'); }}>
            {!eligible && <div className="min-w-[16rem] flex-1"><Labeled label="Reason to register anyway (head coach decision)"><input className={inputClass} minLength={5} maxLength={500} value={overrides[row.studentId] ?? ''} onChange={event => setOverrides({ ...overrides, [row.studentId]: event.target.value })} /></Labeled></div>}
            <button type="submit" className={eligible ? primaryButton : secondaryButton} disabled={actions.busy || (!eligible && (overrides[row.studentId] ?? '').trim().length < 5)}>{kukkiwon ? 'Nominate' : 'Register'}</button>
          </form>
        </div>; })}
    </div>
  </details>;
}

/** Who is scoring and what they may see (older payloads without these fields behave as before). */
function scoringContext(detail: EventDetail, canManage: boolean, currentUserId: string) {
  const viewer = detail.viewer ?? { userId: currentUserId, manages: canManage };
  const panel = detail.panel ?? [];
  return { viewer, panel, canScore: panel.length === 0 || panel.includes(viewer.userId) };
}
/** Items counted for a candidate: the panel's complete items for managers, the viewer's own scores otherwise. */
function countedItems(detail: EventDetail, candidateId: string, viewer: { userId: string; manages: boolean }, panel: string[]) {
  const rows = detail.scores.filter(row => row.candidate_id === candidateId);
  return viewer.manages ? Object.keys(panelItemScores(rows, panel)).length : rows.filter(row => row.scored_by === viewer.userId).length;
}

function CandidateList({ detail, selected, onSelect, canManage }: { detail: EventDetail; selected: string | null; onSelect: (id: string) => void; canManage: boolean }) {
  const { state } = useAppStore();
  const total = detail.items.length;
  const { viewer, panel } = scoringContext(detail, canManage, state.currentUser?.id ?? '');
  const roster = detail.candidates.filter(row => row.status !== 'requested' && row.status !== 'declined');
  return <div className={cardClass + ' space-y-2'}><h3 className="text-sm font-bold">Candidates</h3>
    {!roster.length && <p className="text-sm text-neutral-500">No candidates yet.</p>}
    <ul className="space-y-1.5">{roster.map(row => { const status = CANDIDATE_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as const }; const result = row.result ? RESULT_LABEL[row.result] : null;
      const fee = row.fee_status && row.fee_status !== 'none' ? FEE_LABEL[row.fee_status] : null;
      return <li key={row.id}><button type="button" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)} className={'w-full rounded-lg border p-2.5 text-left text-sm ' + (selected === row.id ? 'border-[#EF2F38] bg-red-50/40 dark:bg-red-950/20' : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800')}>
        <span className="block font-semibold">{row.student?.english_name ?? row.student_id}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500"><Badge tone={status.tone}>{status.label}</Badge>{result && row.result !== 'pending' && <Badge tone={result.tone}>{result.label}{row.overall_percent != null ? ` ${row.overall_percent}%` : ''}</Badge>}
          {fee && <Badge tone={fee.tone}>{fee.label}</Badge>}{row.status !== 'withdrawn' && `${countedItems(detail, row.id, viewer, panel)}/${total} ${viewer.manages ? 'scored' : 'scored by you'}`}</span>
      </button></li>; })}</ul>
  </div>;
}

function ScoreSheet({ detail, candidate, canManage, actions }: { detail: EventDetail; candidate: CandidateRow; canManage: boolean; actions: Actions }) {
  const { state, showConfirm } = useAppStore();
  const s = detail.syllabus;
  const { viewer, panel, canScore } = scoringContext(detail, canManage, state.currentUser?.id ?? '');
  const rows = useMemo(() => detail.scores.filter(row => row.candidate_id === candidate.id), [detail.scores, candidate.id]);
  // The viewer's own saved score per item (their input box and revision).
  const saved = useMemo(() => new Map(rows.filter(row => row.scored_by === viewer.userId).map(row => [row.item_id, row])), [rows, viewer.userId]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState(candidate.public_feedback);
  const testDayStarted = detail.event.exam_date <= academyDate();
  const open = (candidate.status === 'registered' || candidate.status === 'scoring') && testDayStarted && !detail.event.cancelled_at;
  const retestOnly = candidate.retest_count > 0;
  // Preview: managers see the panel score (average of every examiner, own drafts included); examiners see their own scores only.
  const working: ScoreRow[] = rows.filter(row => (viewer.manages || row.scored_by === viewer.userId) && !(row.scored_by === viewer.userId && drafts[row.item_id] !== undefined));
  for (const item of detail.items) {
    const draft = drafts[item.id], own = saved.get(item.id);
    if (draft === undefined) continue;
    // A valid draft replaces the viewer's saved score; an unfinished one keeps it.
    if (draft !== '' && isItemScore(Number(draft))) working.push({ id: 'draft-' + item.id, candidate_id: candidate.id, item_id: item.id, score: Number(draft), note: '', revision: 0, scored_by: viewer.userId, updated_at: '' });
    else if (own) working.push(own);
  }
  const scores = panelItemScores(working, viewer.manages ? panel : []);
  const preview = computeBeltTestResult({ passMark: s.pass_mark ?? 70, distinctionMark: s.distinction_mark ?? 90, sectionMinimum: s.section_minimum ?? 60, criticalMinimum: s.critical_minimum ?? 5 },
    detail.sections.map(section => ({ id: section.id, kind: section.kind, title: section.title, weight: section.weight, minimum: section.minimum, items: detail.items.filter(item => item.section_id === section.id).map(item => ({ id: item.id, weight: item.weight, critical: item.critical })) })), scores);
  const commit = async (itemId: string) => {
    const text = drafts[itemId]; if (text === undefined) return;
    const existing: ScoreRow | undefined = saved.get(itemId);
    const value = Number(text);
    if (text === '' || !isItemScore(value) || value === existing?.score) { if (text === '' || value === existing?.score) setDrafts(current => without(current, itemId)); return; }
    if (await actions.run({ action: 'score', candidateId: candidate.id, itemId, score: value, note: existing?.note ?? '', revision: existing?.revision ?? 0 })) setDrafts(current => without(current, itemId));
  };
  const result = RESULT_LABEL[preview.result];
  const examinerName = (id: string) => detail.examiners[id] ?? 'Examiner';
  return <div className={cardClass + ' space-y-4'}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-base font-bold">{candidate.student?.english_name ?? candidate.student_id}</h3><p className="text-xs text-neutral-500">{candidate.student?.khmer_name} · {candidate.student_id}{candidate.registration_override_reason ? ' · Registered by exception: ' + candidate.registration_override_reason : ''}</p></div>
      <div className="text-right"><p className="text-2xl font-black tabular-nums">{preview.overall.toFixed(2)}%</p><Badge tone={result.tone}>{candidate.status === 'finalized' || candidate.status === 'promoted' ? (RESULT_LABEL[candidate.result ?? 'pending']?.label ?? '') + ' (final)' : result.label + (viewer.manages ? ' (preview)' : ' (your scores)')}</Badge></div>
    </div>
    <FeeEditor key={candidate.id + ':' + candidate.revision} candidate={candidate} canManage={canManage} actions={actions} />
    {!testDayStarted && <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-200">Scores can be entered from the test day ({detail.event.exam_date}).</p>}
    {open && !canScore && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Only the examiners on this test day&apos;s panel can score.</p>}
    {retestOnly && open && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Retest: only the highlighted sections can be re-scored.</p>}
    <p className="text-xs text-neutral-500">Pass {s.pass_mark}% · Distinction {s.distinction_mark}% · Each section ≥ {s.section_minimum}% · Critical items ≥ {s.critical_minimum}/10. {preview.scoredItems}/{preview.totalItems} items {panel.length && viewer.manages ? 'scored by the whole panel' : 'scored'}.</p>
    {detail.sections.map(section => { const outcome = preview.sections.find(row => row.id === section.id)!; const editable = open && canScore && (!retestOnly || candidate.retest_sections.includes(section.id));
      return <section key={section.id} aria-label={section.title} className={'space-y-2 rounded-lg border p-3 ' + (retestOnly && candidate.retest_sections.includes(section.id) ? 'border-amber-400' : 'border-neutral-200 dark:border-neutral-800')}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold">{section.title} <span className="font-normal text-neutral-500">· weight {section.weight}%</span></h4>
          <span className="flex items-center gap-1.5"><span className="text-sm font-bold tabular-nums">{outcome.percent.toFixed(2)}%</span><Badge tone={outcome.met ? 'green' : outcome.scored ? 'red' : 'neutral'}>{outcome.grade}</Badge></span></div>
        <ul className="space-y-1.5">{detail.items.filter(item => item.section_id === section.id).map(item => { const current = saved.get(item.id); const shown = drafts[item.id] ?? (current ? String(current.score) : ''); const value = scores[item.id];
          const others = viewer.manages ? rows.filter(row => row.item_id === item.id && row.scored_by !== viewer.userId && (!panel.length || panel.includes(row.scored_by))) : [];
          return <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">{item.title}{item.critical && <span className="ml-1.5"><Badge tone="red">Critical</Badge></span>}{item.guide && <span className="block text-xs text-neutral-500">{item.guide}</span>}</span>
            {value !== undefined && <span className="text-xs text-neutral-500">{itemLevel(value)}{others.length > 0 ? ` · panel ${value}` : ''}</span>}
            {canScore || current ? <input type="number" inputMode="decimal" min={0} max={10} step={0.1} disabled={!editable || actions.busy} value={shown} aria-label={`Score out of 10 for ${item.title}`}
              onChange={event => setDrafts({ ...drafts, [item.id]: event.target.value })} onBlur={() => void commit(item.id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void commit(item.id); } }}
              className="h-9 w-20 rounded-md border border-neutral-300 bg-white px-2 text-right font-mono text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900" /> : null}
            {others.length > 0 && <span className="w-full text-right text-[11px] text-neutral-500 sm:w-auto">{others.map(row => `${examinerName(row.scored_by)} ${row.score}`).join(' · ')}</span>}
            {!others.length && current && panel.length === 0 && <span className="w-full text-right text-[11px] text-neutral-400 sm:w-auto">{examinerName(current.scored_by)}</span>}
          </li>; })}</ul>
      </section>; })}
    <div className="space-y-2"><Labeled label="Feedback the student will see with their result"><textarea className={inputClass + ' h-20 py-2'} maxLength={1000} value={feedback} disabled={candidate.status === 'withdrawn' || candidate.status === 'promoted'} onChange={event => setFeedback(event.target.value)} /></Labeled>
      <button type="button" className={secondaryButton} disabled={actions.busy || feedback === candidate.public_feedback} onClick={() => void actions.run({ action: 'feedback', candidateId: candidate.id, feedback }, 'Feedback saved.')}>Save feedback</button></div>
    <ErrorNote message={actions.error} />
    {canManage && <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      {candidate.status === 'scoring' && <button type="button" className={primaryButton} disabled={actions.busy || !preview.complete} onClick={() => showConfirm(`Finalize the result for ${candidate.student?.english_name ?? candidate.student_id}: ${result.label} at ${preview.overall}%? Scores are then locked.`, async () => { await actions.run({ action: 'finalize', candidateId: candidate.id, revision: candidate.revision }, 'Result finalized.'); }, 'Finalize result')}>Finalize result</button>}
      {candidate.status === 'finalized' && candidate.result === 'retest' && candidate.retest_count === 0 && <button type="button" className={primaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'start_retest', candidateId: candidate.id, revision: candidate.revision }, 'Retest opened for the failed sections.')}>Start retest</button>}
      {candidate.status === 'finalized' && (candidate.result === 'pass' || candidate.result === 'distinction') && <button type="button" className={primaryButton} disabled={actions.busy} onClick={() => showConfirm('Promote this student? This creates an official belt record.', async () => { await actions.run({ action: 'promote', candidateId: candidate.id, revision: candidate.revision }, 'Student promoted.'); }, 'Promote student')}>Promote</button>}
      {!['promoted', 'withdrawn'].includes(candidate.status) && <WithdrawButton candidateId={candidate.id} actions={actions} />}
    </div>}
  </div>;
}

function WithdrawButton({ candidateId, actions }: { candidateId: string; actions: Actions }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState('');
  if (!open) return <button type="button" className={secondaryButton} onClick={() => setOpen(true)}>Withdraw</button>;
  return <form className="flex w-full flex-wrap items-end gap-2" onSubmit={async event => { event.preventDefault(); if (await actions.run({ action: 'withdraw', id: candidateId, reason: reason.trim() }, 'Candidate withdrawn.')) setOpen(false); }}>
    <div className="min-w-[14rem] flex-1"><Labeled label="Reason for withdrawing"><input className={inputClass} required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Labeled></div>
    <button type="submit" className={primaryButton} disabled={actions.busy || reason.trim().length < 5}>Confirm</button><button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Keep</button>
  </form>;
}

function KukkiwonPanel({ detail, canManage, actions }: { detail: EventDetail; canManage: boolean; actions: Actions }) {
  const { event } = detail;
  const targetBelt = detail.targetBelt;
  const nominees = detail.candidates.filter(row => !OFF_ROSTER.has(row.status));
  const [submission, setSubmission] = useState({ submittedOn: academyDate(), reference: '' });
  const download = () => {
    const csv = ctfNominationCsv({ title: event.title, examDate: event.exam_date, targetBelt, location: event.location }, nominees.map(row => ({ studentId: row.student_id, legalNameEn: row.legal_name_en, legalNameKh: row.legal_name_kh, gender: row.gender, dob: row.dob, poomOrDan: row.poom_or_dan, previousCertificateNo: row.previous_certificate_no, currentBelt: row.student?.current_belt ?? '' })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `ctf-nominations-${event.exam_date}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-4">
    <div className={cardClass + ' space-y-2'}><h3 className="text-sm font-bold">Test curriculum</h3>
      {detail.sections.map(section => <div key={section.id}><p className="text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{section.title}</p>
        <ul className="list-disc pl-5 text-sm">{detail.items.filter(item => item.section_id === section.id).map(item => <li key={item.id}>{item.title}</li>)}</ul></div>)}</div>
    <div className={cardClass + ' space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Nominations ({nominees.length})</h3>
        <button type="button" className={secondaryButton} disabled={!nominees.length} onClick={download}>Download CTF list (CSV)</button></div>
      {!nominees.length && <p className="text-sm text-neutral-500">No nominations yet.</p>}
      <ul className="space-y-3">{nominees.map(row => <KukkiwonRow key={row.id} row={row} event={event} targetBelt={targetBelt} canManage={canManage} actions={actions} />)}</ul>
      {canManage && nominees.some(row => row.status === 'nominated') && <form className="grid gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800 sm:grid-cols-[10rem_1fr_auto]" onSubmit={async submit => { submit.preventDefault(); await actions.run({ action: 'kukkiwon_submit', eventId: event.id, submittedOn: submission.submittedOn, reference: submission.reference.trim() }, 'Nominations marked as submitted to the CTF.'); }}>
        <Labeled label="Submitted to CTF on"><input className={inputClass} type="date" required max={academyDate()} value={submission.submittedOn} onChange={change => setSubmission({ ...submission, submittedOn: change.target.value })} /></Labeled>
        <Labeled label="CTF reference or receipt"><input className={inputClass} required maxLength={120} value={submission.reference} onChange={change => setSubmission({ ...submission, reference: change.target.value })} /></Labeled>
        <button type="submit" className={primaryButton + ' self-end'} disabled={actions.busy || !submission.reference.trim()}>Mark all nominated as submitted</button>
      </form>}
    </div>
  </div>;
}

function KukkiwonRow({ row, event, targetBelt, canManage, actions }: { row: CandidateRow; event: EventRow; targetBelt: string; canManage: boolean; actions: Actions }) {
  const status = CANDIDATE_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as const };
  const [names, setNames] = useState({ legalNameEn: row.legal_name_en ?? '', legalNameKh: row.legal_name_kh ?? '', previousCertificateNo: row.previous_certificate_no ?? '' });
  const [certificate, setCertificate] = useState({ certificateNo: '', certificateDate: academyDate() });
  const afterTest = event.exam_date <= academyDate();
  return <li className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{row.student?.english_name ?? row.student_id} <span className="font-normal text-neutral-500">· {row.poom_or_dan} · born {row.dob} · {row.gender}</span></span><Badge tone={status.tone}>{status.label}</Badge></div>
    <FeeEditor key={row.id + ':' + row.revision} candidate={row} canManage={canManage} actions={actions} />
    {row.ctf_submitted_on && <p className="text-xs text-neutral-500">Submitted to CTF on {row.ctf_submitted_on} · {row.ctf_reference}</p>}
    {row.certificate_no && <p className="text-xs text-neutral-500">Kukkiwon certificate {row.certificate_no} · {row.certificate_date}</p>}
    {canManage && row.status === 'nominated' && <form className="grid gap-2 sm:grid-cols-3" onSubmit={async submit => { submit.preventDefault(); await actions.run({ action: 'kukkiwon_update', candidateId: row.id, revision: row.revision, ...names }, 'Nomination details saved.'); }}>
      <Labeled label="Full name (English, as on ID)"><input className={inputClass} maxLength={150} value={names.legalNameEn} onChange={change => setNames({ ...names, legalNameEn: change.target.value })} /></Labeled>
      <Labeled label="Full name (Khmer)"><input className={inputClass} maxLength={150} value={names.legalNameKh} onChange={change => setNames({ ...names, legalNameKh: change.target.value })} /></Labeled>
      <Labeled label="Previous Kukkiwon certificate no." hint="Required for 2nd Poom/Dan and above."><input className={inputClass} maxLength={60} value={names.previousCertificateNo} onChange={change => setNames({ ...names, previousCertificateNo: change.target.value })} /></Labeled>
      <button type="submit" className={secondaryButton + ' sm:col-span-3 sm:justify-self-start'} disabled={actions.busy}>Save details</button>
    </form>}
    {canManage && (row.status === 'submitted' || row.status === 'failed') && afterTest && <div className="flex flex-wrap gap-2">
      <button type="button" className={primaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'kukkiwon_result', candidateId: row.id, revision: row.revision, result: 'passed' }, 'Result recorded: passed.')}>Passed at Kukkiwon</button>
      {row.status !== 'failed' && <button type="button" className={secondaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'kukkiwon_result', candidateId: row.id, revision: row.revision, result: 'failed' }, 'Result recorded: not passed.')}>Not passed</button>}
    </div>}
    {canManage && row.status === 'submitted' && !afterTest && <p className="text-xs text-neutral-500">Record the result after the Kukkiwon test date ({event.exam_date}).</p>}
    {canManage && row.status === 'passed' && <form className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]" onSubmit={async submit => { submit.preventDefault(); await actions.run({ action: 'kukkiwon_certificate', candidateId: row.id, revision: row.revision, certificateNo: certificate.certificateNo.trim(), certificateDate: certificate.certificateDate }, 'Certificate recorded.'); }}>
      <Labeled label="Kukkiwon certificate no."><input className={inputClass} required maxLength={60} value={certificate.certificateNo} onChange={change => setCertificate({ ...certificate, certificateNo: change.target.value })} /></Labeled>
      <Labeled label="Issue date"><input className={inputClass} type="date" required max={academyDate()} value={certificate.certificateDate} onChange={change => setCertificate({ ...certificate, certificateDate: change.target.value })} /></Labeled>
      <button type="submit" className={primaryButton + ' self-end'} disabled={actions.busy || !certificate.certificateNo.trim()}>Save certificate</button>
    </form>}
    {canManage && row.status === 'certified' && <button type="button" className={primaryButton} disabled={actions.busy} onClick={() => void actions.run({ action: 'promote', candidateId: row.id, revision: row.revision }, 'Student promoted.')}>Promote to {targetBelt}</button>}
    {canManage && !['promoted', 'withdrawn', 'certified'].includes(row.status) && <WithdrawButton candidateId={row.id} actions={actions} />}
  </li>;
}
