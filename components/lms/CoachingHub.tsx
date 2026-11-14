'use client';
import { useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { PersonSimpleTaiChi } from '@phosphor-icons/react/dist/csr/PersonSimpleTaiChi';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { UserFocus } from '@phosphor-icons/react/dist/csr/UserFocus';
import { Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { SegmentedTabs } from '@/components/ui/PageHeader';
import { buttonClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { useAppStore } from '@/lib/store';
import { useLmsView, type Overview } from './coaching-shared';
import { ReviewQueue } from './ReviewQueue';
import { AssignmentsPanel } from './AssignmentsPanel';
import { ChallengesPanel } from './ChallengesPanel';
import { FormsPanel } from './FormsPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { StudentCoachingPanel } from './StudentCoachingPanel';
import { AnnouncementsPanel } from './AnnouncementsPanel';
import { AttentionPanel } from './AttentionPanel';

type Tab = 'review' | 'assignments' | 'challenges' | 'forms' | 'achievements' | 'students' | 'announcements' | 'attention';

/**
 * Coaching hub (LMS): coaches and above review work, set tasks and challenges,
 * manage forms, quizzes and achievements, plan each student's week and send
 * announcements. Every change is checked again in the database.
 */
export function CoachingHub() {
  const { can } = useAppStore();
  const canEdit = can('action:curriculum_edit');
  const { data: overview, error, reload } = useLmsView<Overview>('overview');
  const [tab, setTab] = useState<Tab>('review');
  // "Review submitted" on an assignment opens the queue filtered to it.
  const [reviewFor, setReviewFor] = useState<{ id: string; title: string } | null>(null);
  if (error) return <ErrorBanner title="Coaching is unavailable" action={<button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => void reload()}>Retry</button>}>{error}</ErrorBanner>;
  if (!overview) return <EmptyState busy title="Loading coaching…" />;
  const waiting = overview.waiting.submissions + overview.waiting.forms;
  const refresh = () => void reload();
  // Phones: a 4 x 2 grid of icon tabs with short labels (no sideways scrolling);
  // tablets: one wrapping row; desktop: one row.
  const label = (short: string, full: string) => <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{full}</span></>;
  return <div className="space-y-4" data-coaching-hub>
    {!canEdit && <p className="rounded-lg border border-line bg-surface-muted p-3 text-xs text-ink-muted">View only: coaches and above review work and make changes.</p>}
    <SegmentedTabs label="Coaching views" value={tab} onChange={next => { setTab(next); if (next !== 'review') setReviewFor(null); }} stretch={false} stacked
      className="max-sm:grid max-sm:grid-cols-4 max-[359px]:grid-cols-3 max-sm:overflow-visible sm:flex-wrap sm:overflow-visible" items={[
      { id: 'review', label: label('Review', 'Review'), ariaLabel: waiting ? `Review, ${waiting} waiting` : 'Review', icon: <CheckCircle />,
        badge: waiting ? <span aria-hidden="true" className="rounded-full bg-brand px-1.5 text-micro leading-4 text-on-brand max-sm:absolute max-sm:right-1 max-sm:top-1 sm:ml-1">{waiting}</span> : undefined },
      { id: 'assignments', label: label('Tasks', 'Assignments'), ariaLabel: 'Assignments', icon: <ClipboardText /> },
      { id: 'challenges', label: label('Challenges', 'Challenges'), ariaLabel: 'Challenges', icon: <Flag /> },
      { id: 'forms', label: label('Forms', 'Forms & quizzes'), ariaLabel: 'Forms & quizzes', icon: <PersonSimpleTaiChi /> },
      { id: 'achievements', label: label('Awards', 'Achievements'), ariaLabel: 'Achievements', icon: <Trophy /> },
      { id: 'students', label: label('Plans', 'Plans & goals'), ariaLabel: 'Plans & goals', icon: <UserFocus /> },
      { id: 'announcements', label: label('Notices', 'Announcements'), ariaLabel: 'Announcements', icon: <Megaphone /> },
      { id: 'attention', label: label('Attention', 'Attention'), ariaLabel: 'Attention', icon: <Warning /> },
    ]} />
    {tab === 'review' && <ReviewQueue canReview={canEdit} assignment={reviewFor} onClearAssignment={() => setReviewFor(null)} onChanged={refresh} />}
    {tab === 'assignments' && <AssignmentsPanel overview={overview} canEdit={canEdit} onReview={assignment => { setReviewFor(assignment); setTab('review'); }} />}
    {tab === 'challenges' && <ChallengesPanel overview={overview} canEdit={canEdit} />}
    {tab === 'forms' && <FormsPanel overview={overview} canEdit={canEdit} onChanged={refresh} />}
    {tab === 'achievements' && <AchievementsPanel overview={overview} canEdit={canEdit} onChanged={refresh} />}
    {tab === 'students' && <StudentCoachingPanel overview={overview} canEdit={canEdit} />}
    {tab === 'announcements' && <AnnouncementsPanel overview={overview} canSend={can('action:announcements_send')} />}
    {tab === 'attention' && <AttentionPanel overview={overview} canManageSettings={can('action:staff_manage')} onChanged={refresh} />}
  </div>;
}