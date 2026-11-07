'use client';
import React, { useState } from 'react';
import type { BeltTestOverview, EligibilityEntry } from '@/lib/belt-test-contract';
import { useBeltTestView } from './use-belt-tests';
import { RuleChips } from './RuleChips';
import { Badge, cardClass, ErrorNote, inputClass, Labeled } from './ui';

/** Who can test for each belt, using the same engine the student portal shows. */
export function EligibilityTab({ overview }: { overview: BeltTestOverview }) {
  const published = overview.syllabi.filter(row => row.status === 'published');
  const [syllabusId, setSyllabusId] = useState(published[0]?.id ?? '');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [search, setSearch] = useState('');
  const list = useBeltTestView<{ students: EligibilityEntry[] }>(syllabusId ? { view: 'eligibility', syllabusId } : null);
  if (!published.length) return <p className={cardClass + ' text-sm text-neutral-500'}>Publish a syllabus first. Eligibility rules (days, classes, skill average, lessons) are part of each belt&apos;s syllabus.</p>;
  const query = search.trim().toLowerCase();
  const rows = (list.data?.students ?? []).filter(row => (!onlyEligible || row.eligibility.status === 'eligible') && (!query || row.englishName.toLowerCase().includes(query) || row.khmerName.toLowerCase().includes(query) || row.studentId.toLowerCase().includes(query)));
  const eligibleCount = (list.data?.students ?? []).filter(row => row.eligibility.status === 'eligible').length;
  return <div className="space-y-4">
    <div className={cardClass + ' grid gap-3 sm:grid-cols-3'}>
      <Labeled label="Testing for"><select className={inputClass} value={syllabusId} onChange={event => setSyllabusId(event.target.value)}>{published.map(row => <option key={row.id} value={row.id}>{overview.belts.find(belt => belt.id === row.target_belt_id)?.belt_name}{row.track === 'kukkiwon' ? ' (Kukkiwon)' : ''}</option>)}</select></Labeled>
      <Labeled label="Search students"><input type="search" className={inputClass} value={search} onChange={event => setSearch(event.target.value)} /></Labeled>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={onlyEligible} onChange={event => setOnlyEligible(event.target.checked)} />Only eligible ({eligibleCount})</label>
    </div>
    <p className="text-xs text-neutral-500">Students see the same checklist in the student portal. Register eligible students from a test day&apos;s page; a head coach can register a student who is not yet eligible with a recorded reason.</p>
    {list.error && <ErrorNote message={list.error} />}
    {!list.data && !list.error && <p role="status" className="text-sm text-neutral-500">Checking eligibility…</p>}
    {list.data && !rows.length && <p className="text-sm text-neutral-500">No students match.</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.studentId} className={cardClass + ' space-y-2'}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{row.englishName} <span className="font-normal text-neutral-500">{row.khmerName} · {row.studentId} · {row.currentBelt}</span></span>
        <Badge tone={row.eligibility.status === 'eligible' ? 'green' : 'amber'}>{row.eligibility.status === 'eligible' ? 'Eligible' : 'Not yet eligible'}</Badge></div>
      <RuleChips entry={row} />
    </li>)}</ul>
  </div>;
}
