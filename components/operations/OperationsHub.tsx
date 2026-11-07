'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
const StudentPortalAdminPanel=dynamic(()=>import('@/components/student-portal-admin/StudentPortalAdminPanel').then(module=>module.StudentPortalAdminPanel),{loading:()=> <p role="status" className="text-sm text-neutral-500">Loading student portal preparation…</p>});
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { TodayPanel } from './TodayPanel';
import { SessionsPanel } from './SessionsPanel';
import { InvoiceLedgerPanel } from './InvoiceLedgerPanel';
import { ReconciliationPanel } from './ReconciliationPanel';
import { GradingPanel } from './GradingPanel';
import { SystemHealthPanel } from './SystemHealthPanel';
import { QualityPanel } from './QualityPanel';
import { PerformancePanel } from './PerformancePanel';
import { adminRoles } from './shared';
import { useNotificationTarget } from '@/hooks/use-notification-target';
export function OperationsHub() {
  const { state, can } = useAppStore(); const query = useSearchParams();
  const tabs = [['today', 'Today', 'page:dashboard'], ['sessions', 'Dated classes', 'page:schedule'], ['billing', 'Invoices & pauses', 'page:financials'], ['reconciliation', 'Reconciliation', 'page:financials'], ['grading', 'Grading', 'page:lms'], ['student-portal','Student portal','page:lms'], ['health', 'Job health', 'page:settings'], ['quality', 'Data quality', 'page:settings'], ['performance', 'Performance', 'page:settings']].filter(([key, , permission]) => (can(permission as any) || key === 'sessions' && can('page:attendance')) && (key !== 'quality' || adminRoles.includes(state.currentUser?.role ?? '')));
  const [selected, select] = useState(query.get('view') ?? 'today'); const active = tabs.some(([key]) => key === selected) ? selected : tabs[0]?.[0];
  const [studentId, setStudent] = useState(query.get('student') ?? ''); const student = state.students.find(row => row.id === studentId);
  useNotificationTarget(url=>{if(url.pathname!=='/operations')return;if(url.searchParams.get('view'))select(url.searchParams.get('view')!);if(url.searchParams.get('student'))setStudent(url.searchParams.get('student')!);},state.permissionsReady);
  return <div className="mx-auto max-w-6xl space-y-4 pb-8"><header><h1 className="text-xl font-semibold">Academy operations</h1><p className="mt-1 text-sm text-neutral-500">Daily work, dated sessions and auditable academy decisions.</p></header><nav aria-label="Operations sections" className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => select(key)} aria-pressed={active === key} className={`operation-control ${active === key ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : ''}`}>{label}</button>)}</nav>
    {active === 'today' && <TodayPanel/>}{active === 'sessions' && <SessionsPanel/>}
    {active === 'billing' && <><label className="operations-panel block space-y-2 text-sm"><span>Student invoice ledger</span><select aria-label="Student invoice ledger" value={studentId} onChange={event => setStudent(event.target.value)}><option value="">Choose a student</option>{state.students.map(row => <option key={row.id} value={row.id}>{row.englishName} · {row.id}</option>)}</select></label>{student && <InvoiceLedgerPanel key={student.id} studentId={student.id}/>}</>}
    {active === 'reconciliation' && <ReconciliationPanel/>}{active === 'grading' && <GradingPanel/>}{active === 'student-portal' && <StudentPortalAdminPanel/>}{active === 'health' && <SystemHealthPanel/>}{active === 'quality' && <QualityPanel/>}{active === 'performance' && <PerformancePanel/>}
    {!active && <p role="alert">No operations sections are available for your permissions.</p>}
  </div>;
}

