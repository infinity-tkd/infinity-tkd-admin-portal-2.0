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
  if (error) return <ErrorBanner title="Coaching is unavailable" action={<button type="button" className={buttonClass({ size: 'sm' })} onClick={() => void reload()}>Retry</button>}>{error}</ErrorBanner>;
  if (!overview) return <EmptyState busy title="Loading coaching…" />;
  const waiting = overview.waiting.submissions + overview.waiting.forms;
  const refresh = () => void reload();
  return <div className="space-y-4">
    {!canEdit && <p className="rounded-lg border border-line bg-surface-muted p-3 text-xs text-ink-muted">View only: coaches and above review work and make changes.</p>}
    <SegmentedTabs label="Coaching views" value={tab} onChange={setTab} stretch={false} items={[
      { id: 'review', label: 'Review', icon: <CheckCircle />, badge: waiting ? <span className="ml-1 rounded-full bg-brand px-1.5 text-[10px] text-on-brand">{waiting}</span> : undefined },
      { id: 'assignments', label: 'Assignments', icon: <ClipboardText /> },
      { id: 'challenges', label: 'Challenges', icon: <Flag /> },
      { id: 'forms', label: 'Forms & quizzes', icon: <PersonSimpleTaiChi /> },
      { id: 'achievements', label: 'Achievements', icon: <Trophy /> },
      { id: 'students', label: 'Plans & goals', icon: <UserFocus /> },
      { id: 'announcements', label: 'Announcements', icon: <Megaphone /> },
      { id: 'attention', label: 'Attention', icon: <Warning /> },
    ]} />
    {tab === 'review' && <ReviewQueue canReview={canEdit} />}
    {tab === 'assignments' && <AssignmentsPanel overview={overview} canEdit={canEdit} />}
    {tab === 'challenges' && <ChallengesPanel overview={overview} canEdit={canEdit} />}
    {tab === 'forms' && <FormsPanel overview={overview} canEdit={canEdit} onChanged={refresh} />}
    {tab === 'achievements' && <AchievementsPanel overview={overview} canEdit={canEdit} onChanged={refresh} />}
    {tab === 'students' && <StudentCoachingPanel overview={overview} canEdit={canEdit} />}
    {tab === 'announcements' && <AnnouncementsPanel overview={overview} canSend={can('action:announcements_send')} />}
    {tab === 'attention' && <AttentionPanel overview={overview} canManageSettings={can('action:staff_manage')} onChanged={refresh} />}
  </div>;
}
