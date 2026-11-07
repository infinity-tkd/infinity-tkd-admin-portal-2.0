import { supabase } from '@/lib/supabase';
import { readApiResponse, unwrapApiError } from '@/lib/api-response';

/** Mutations are single-flight at the caller; an ambiguous write is never replayed automatically. */
export async function portalRequest<T>(url: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const timeout = url.startsWith('/api/admin/events/') && url.endsWith('/publications') ? 45000 : 20000;
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(timeout) });
  const result = await readApiResponse(response);
  if (!response.ok || result?.success !== true) throw new Error(unwrapApiError(result, 'This action could not be completed. Please retry.'));
  const { data: { session: current } } = await supabase.auth.getSession();
  if (current?.user.id !== session.user.id) throw new Error('Your account changed. Reopen this page to confirm the result.');
  return result.data as T;
}
