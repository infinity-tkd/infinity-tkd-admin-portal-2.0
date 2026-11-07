'use client';
import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { BeltTestOverview } from '@/lib/belt-test-contract';
import { useBeltTestView } from './use-belt-tests';
import { TestDaysTab } from './TestDaysTab';
import { EligibilityTab } from './EligibilityTab';
import { SyllabusTab } from './SyllabusTab';
import { ErrorNote, secondaryButton } from './ui';
import { Medal } from '@phosphor-icons/react/dist/csr/Medal';
import { PageHeader, SegmentedTabs } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/States';

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
  return <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-12 sm:space-y-5">
    <PageHeader
      icon={<Medal weight="bold" />}
      eyebrow="Promotion"
      title="Belt Tests"
      description="Color belts (White to Red) are tested and scored by the academy. 1st and 2nd Poom/Dan are tested at Kukkiwon Cambodia: the academy nominates students to the Cambodia Taekwondo Federation, then records the result and certificate."
    />
    <nav aria-label="Belt test sections">
      <SegmentedTabs label="Belt test views" value={tab} onChange={setTab} items={TABS.map(item => ({ id: item.id, label: item.label }))} />
    </nav>
    {overview.error && <div className="space-y-2"><ErrorNote message={overview.error} /><button type="button" className={secondaryButton} onClick={() => void overview.refresh()}>Retry</button></div>}
    {!overview.data && !overview.error && <PageLoader label="Loading belt tests…" />}
    {overview.data && tab === 'days' && <TestDaysTab overview={overview.data} canManage={canManage} />}
    {overview.data && tab === 'eligibility' && <EligibilityTab overview={overview.data} />}
    {overview.data && tab === 'syllabus' && <SyllabusTab overview={overview.data} canManage={canManage} />}
  </div>;
}
