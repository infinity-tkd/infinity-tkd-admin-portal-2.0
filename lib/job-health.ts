import type { SupabaseClient } from '@supabase/supabase-js';

export async function claimJob(client: SupabaseClient, name: 'notifications' | 'operations'): Promise<string | null> {
  const result = await client.rpc('portal_claim_job', { p_name: name }).abortSignal(AbortSignal.timeout(10000));
  if (result.error) throw result.error;
  return result.data;
}
export async function finishJob(client: SupabaseClient, id: string, metrics: Record<string, unknown>, errorCode?: string) {
  const failed = Boolean(errorCode), partial = Number(metrics.failed ?? 0) > 0 || Number(metrics.deliveryFailed ?? 0) > 0 || Number(metrics.operationsFailed ?? 0) > 0 || Number(metrics.lmsFailed ?? 0) > 0;
  const result = await client.from('portal_job_runs').update({ status: failed ? 'failed' : partial ? 'partial' : 'succeeded', finished_at: new Date().toISOString(), metrics, error_code: errorCode ?? null }).eq('id', id).eq('status', 'running').select('id').single();
  if (result.error) throw result.error;
  // The run ID prevents an old worker from releasing a replacement worker's lease.
  const released = await client.from('portal_job_leases').delete().eq('run_id', id);
  if (released.error) throw released.error;
}
