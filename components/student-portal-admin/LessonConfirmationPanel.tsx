'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useStudentPortalPreparation } from '@/hooks/use-student-portal-preparation';
import { publishedReadinessRequirementsSchema } from '@/lib/student-portal-admin-contract';
import { Field, OperationForm, OperationSection, text } from '@/components/operations/shared';
import type { PublishedPolicy } from './types';

interface Confirmation { id: string; policy_id: string; requirement_key: string; result: 'passed' | 'needs_work'; confirmed_by: string; confirmed_at: string; confirmation_reference: string; revoked_at: string | null }
interface ConfirmationData { student: { id: string; english_name: string; current_belt: string }; policies: PublishedPolicy[]; confirmations: Confirmation[] }
export function LessonConfirmationPanel() {
  const { state, can } = useAppStore();
  const [studentId, setStudent] = useState('');
  const api = useStudentPortalPreparation<ConfirmationData>(new URLSearchParams({ view: 'confirmations', studentId }).toString(), Boolean(studentId));
  const policy = api.data?.policies.length === 1 ? api.data.policies[0] : null;
  const requirements = publishedReadinessRequirementsSchema.safeParse(policy?.requirements);
  const canGrade = can('action:evaluations_grade');
  const reviewer = ['Root', 'Super Root', 'Admin', 'Head Coach'].includes(state.currentUser?.role ?? '');
  return <OperationSection title="Observed lesson confirmations" {...api} onRefresh={studentId ? () => void api.refresh() : undefined}>
    <p className="text-xs text-neutral-500">Record a genuine coach observation now against an active published policy. Student practice, historic Completed labels and physical grades remain separate. A pass supports coach review; it never promotes a student.</p>
    <Field label="Student"><select value={studentId} onChange={event => setStudent(event.target.value)}><option value="">Choose a student</option>{state.students.map(student => <option key={student.id} value={student.id}>{student.englishName} · {student.id}</option>)}</select></Field>
    {api.data && (!policy || !requirements.success) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{api.data.policies.length > 1 ? 'Overlapping policies need academy review before a confirmation can be recorded.' : 'No single valid published readiness policy is available for this current belt. Prepare and approve the actual mappings first.'}</p>}
    {policy && requirements.success && canGrade && requirements.data.lessons.length > 0 && <OperationForm key={`${studentId}:${policy.id}`} title={`${api.data?.student.current_belt} · Policy ${policy.version}`} busy={api.busy} submitLabel="Record observed result now" onSubmit={async form => Boolean(await api.run({ action: 'confirm_lesson', studentId, policyId: policy.id, requirementKey: text(form, 'requirement'), result: text(form, 'result'), reference: text(form, 'reference'), observedNow: form.get('observedNow') === 'on' }))}>
      <Field label="Published lesson requirement"><select required name="requirement">{requirements.data.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.label.en} · #{lesson.curriculumId}</option>)}</select></Field><Field label="Observed outcome"><select name="result" required><option value="">Choose an outcome</option><option value="passed">Passed</option><option value="needs_work">Needs work</option></select></Field><Field label="Genuine observation/evidence reference" wide><input required name="reference" maxLength={200}/></Field><label className="flex items-start gap-2 text-xs sm:col-span-2"><input type="checkbox" name="observedNow" required/><span>I observed this lesson outcome now. This is not a backdated or student-reported completion.</span></label>
    </OperationForm>}
    {policy && requirements.success && !requirements.data.lessons.length && <p className="text-sm text-neutral-500">This policy has no lesson-confirmation requirements.</p>}
    <div className="space-y-3">{api.data?.confirmations.map(record => <article key={record.id} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{record.requirement_key} · {record.result === 'passed' ? 'Passed' : 'Needs work'}</p><span className="text-xs text-neutral-500">{record.revoked_at ? 'Withdrawn · retained in history' : 'Recorded'}</span></div><p className="break-words text-xs text-neutral-500">{new Date(record.confirmed_at).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })} · Academy time<br/>Evidence: {record.confirmation_reference}</p>{canGrade && !record.revoked_at && (reviewer || record.confirmed_by === state.currentUser?.id) && <details><summary className="cursor-pointer text-xs">Withdraw an invalid confirmation</summary><OperationForm title="Withdrawal reason" busy={api.busy} submitLabel="Withdraw and keep history" onSubmit={async form => Boolean(await api.run({ action: 'withdraw_confirmation', id: record.id, reason: text(form, 'reason') }))}><Field label="Reason" wide><textarea required name="reason" minLength={5} maxLength={500}/></Field></OperationForm></details>}</article>)}</div>
    {api.data && !api.data.confirmations.length && <p className="text-sm text-neutral-500">No lesson observations have been recorded for this student.</p>}
    {api.data?.confirmations.length === 100 && <p className="text-xs text-neutral-500">Showing the 100 most recent observations, including withdrawals.</p>}
  </OperationSection>;
}
