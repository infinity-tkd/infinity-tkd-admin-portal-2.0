'use client';
import { useOperations } from '@/hooks/use-operations';
import { Field, OperationForm, OperationSection, number } from './shared';
import { useAppStore } from '@/lib/store';
import { adminRoles } from './shared';
interface Health { serverTime: string; workerConfigured: boolean; pushConfigured: boolean; runs: { id: string; job_name: string; status: string; started_at: string; finished_at?: string; error_code?: string; metrics: Record<string, number> }[]; failures: { attempts: number; next_attempt_at: string; last_error_code: number }[] }
export function SystemHealthPanel() {
  const {state,can}=useAppStore();
  const api = useOperations<Health>('health'); const policy = useOperations<{ reminder_lead_days: number; late_grace_days: number }[]>('policy');
  const latest = api.data?.runs[0]; const stale = !latest || Date.parse(api.data?.serverTime ?? '') - Date.parse(latest.finished_at ?? latest.started_at) > (latest.status==='running'?2:5) * 60000;
  const needsAttention=stale||latest?.status==='failed'||latest?.status==='partial';
  return <OperationSection title="Background-job health" {...api} onRefresh={() => { void api.refresh(); void policy.refresh(); }}>
    {api.data && <div role="status" className={`rounded-xl border p-3 text-sm ${needsAttention ? 'border-amber-400' : 'border-emerald-400'}`}>{stale ? 'The worker has not completed recently. Check the scheduler and server logs.' : needsAttention?'The latest worker run needs attention. Review the failure counts below.':'Recent worker activity is available below.'}<p className="mt-2 text-xs">Scheduler environment: {api.data.workerConfigured ? 'Configured' : 'Incomplete'} · Background push: {api.data.pushConfigured ? 'Configured' : 'Incomplete'} · Retrying / exhausted deliveries: {api.data.failures.length}</p><p className="mt-1 text-xs text-neutral-500">Checked {api.data.serverTime.slice(0,19).replace('T',' ')} UTC. Configuration alone does not prove the worker is running.</p></div>}
    <div className="max-h-96 space-y-2 overflow-y-auto">{api.data?.runs.map(run => <article key={run.id} className="rounded-lg border p-3 text-xs dark:border-neutral-800"><p className="font-semibold">{run.job_name} · {run.status}</p><p className="mt-1">Started: {run.started_at.slice(0, 19).replace('T', ' ')} UTC · Finished: {run.finished_at?.slice(0, 19).replace('T', ' ') ?? 'Not recorded'}</p><p className="mt-1">Accounts completed {run.metrics.completed ?? 0} · Failed {run.metrics.failed ?? 0} · Push sent {run.metrics.sent ?? 0} · Delivery failures {run.metrics.deliveryFailed ?? 0} · Membership changes needing review {run.metrics.operationsFailed ?? 0} · Pending {run.metrics.pending ?? 0}</p>{run.error_code && <p className="mt-1 text-amber-700">{run.error_code}</p>}</article>)}</div>
    <OperationSection title="Renewal and late-payment policy" error={policy.error} feedback={policy.feedback}>
      <p className="text-xs text-neutral-500">Reminder lead time is before the due date. Grace is after it. Both remain separate from the amount owed.</p>
      {policy.data?.[0] && <p className="text-sm">Renewal reminder: {policy.data[0].reminder_lead_days} days before due · Payment grace: {policy.data[0].late_grace_days} days after due.</p>}
      {policy.data?.[0] && adminRoles.includes(state.currentUser?.role??'') && can('action:staff_manage') && <OperationForm title="Billing timing" busy={policy.busy} submitLabel="Save billing timing" onSubmit={form => policy.run({ action: 'policy', reminderLeadDays: number(form, 'reminderLeadDays'), lateGraceDays: number(form, 'lateGraceDays') })}>
        <Field label="Remind before due date (days)"><input name="reminderLeadDays" type="number" min={0} max={60} required defaultValue={policy.data[0].reminder_lead_days}/></Field><Field label="Grace after due date (days)"><input name="lateGraceDays" type="number" min={0} max={60} required defaultValue={policy.data[0].late_grace_days}/></Field>
      </OperationForm>}
    </OperationSection>
  </OperationSection>;
}

