'use client';
import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { BeltTestOverview } from '@/lib/belt-test-contract';
import { useBeltTestView } from './use-belt-tests';
import { TestDaysTab } from './TestDaysTab';
import { EligibilityTab } from './EligibilityTab';
import { SyllabusTab } from './SyllabusTab';
import { cardClass, ErrorNote, secondaryButton } from './ui';

const TABS = [
  { id: 'days', label: 'Test days' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'syllabus', label: 'Syllabus & scoring' },
] as const;

export function BeltTestsView() {
  const { state, can } = useAppStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('days');
  const overview = useBeltTestView<BeltTestOverview>({ view: 'overview' });
  // Scoring is open to every coach with grading permission; managing tests is for head coaches and administrators (enforced again in the database).
  const canManage = can('action:evaluations_grade') && ['Root', 'Super Root', 'Admin', 'Head Coach'].includes(state.currentUser?.role ?? '');
  return <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-12">
    <header className={cardClass}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#EF2F38]">Promotion</p>
      <h1 className="text-lg font-bold">Belt Tests</h1>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">Color belts (White to Red) are tested and scored by the academy. 1st and 2nd Poom/Dan are tested at Kukkiwon Cambodia: the academy nominates students to the Cambodia Taekwondo Federation, then records the result and certificate.</p>
    </header>
    <nav aria-label="Belt test sections" className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-neutral-100 p-1.5 dark:border-neutral-800 dark:bg-[#0F0F0F]">
      {TABS.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}
        className={'min-h-10 rounded-lg px-4 text-xs font-bold ' + (tab === item.id ? 'bg-white text-neutral-900 shadow-sm dark:bg-[#1C1C1C] dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white')}>{item.label}</button>)}
    </nav>
    {overview.error && <div className="space-y-2"><ErrorNote message={overview.error} /><button type="button" className={secondaryButton} onClick={() => void overview.refresh()}>Retry</button></div>}
    {!overview.data && !overview.error && <p role="status" className="text-sm text-neutral-500">Loading belt tests…</p>}
    {overview.data && tab === 'days' && <TestDaysTab overview={overview.data} canManage={canManage} />}
    {overview.data && tab === 'eligibility' && <EligibilityTab overview={overview.data} />}
    {overview.data && tab === 'syllabus' && <SyllabusTab overview={overview.data} canManage={canManage} />}
  </div>;
}
