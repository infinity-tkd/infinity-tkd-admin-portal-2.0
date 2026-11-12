import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * True when an error means the LMS tables or functions are not in the database
 * yet (code deployed before the migrations). Callers treat that as "no LMS
 * data" so existing screens and jobs keep working.
 */
export function isMissingSchema(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(String(e.code ?? ''))) return true;
  return /does not exist|schema cache|Could not find the (function|table)/i.test(String(e.message ?? ''));
}

// Raw database errors name tables, constraints or types; LMS functions raise plain sentences.
const INTERNAL = /relation "|constraint "|syntax|duplicate key|column "|function |violates|operator|null value|out of range|does not exist|permission denied for/i;
const STATUS: Record<string, number> = { '42501': 403, P0002: 404, '40001': 409, '23505': 409, '23503': 409, '22023': 400, P0001: 400 };

/**
 * Error response for the LMS routes: the plain-language message an LMS function
 * raised (for example "Set the reps or sessions to reach") reaches staff as is;
 * anything else goes through the portal's usual error handling.
 */
export function lmsErrorResponse(error: unknown, fallback: (error: unknown) => Response): Response {
  const e = error as { code?: string; message?: string } | null;
  if (isMissingSchema(error)) return Response.json({ success: false, error: { message: 'Coaching is not set up yet: the LMS database update has not been applied.' } }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const message = String(e?.message ?? '');
  const status = STATUS[String(e?.code ?? '')];
  if (status && message && message.length <= 300 && !INTERNAL.test(message)) return Response.json({ success: false, error: { code: e?.code, message } }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  return fallback(error);
}

/** Lesson id → published poomsae form id, for the library-v2 cards (formId). */
export async function publishedFormIds(client: SupabaseClient, lessonIds: number[], signal?: AbortSignal): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!lessonIds.length) return map;
  let query = client.from('poomsae_forms').select('id,curriculum_id').eq('published', true).in('curriculum_id', lessonIds);
  if (signal) query = query.abortSignal(signal);
  const result = await query;
  if (result.error) { if (isMissingSchema(result.error)) return map; throw result.error; }
  for (const row of result.data ?? []) map.set(Number(row.curriculum_id), String(row.id));
  return map;
}

export const SUBMISSIONS_BUCKET = 'student-submissions';

/**
 * The LMS part of the scheduled notifications job: reminders (every reminder has
 * a source key, so running every minute never sends twice) and video retention
 * (files 90 days after review, withdrawn and abandoned uploads). Never throws:
 * a failure is reported in the metrics and the rest of the job continues.
 */
export async function runLmsJobs(client: SupabaseClient, signal?: AbortSignal): Promise<{ lmsSkipped: boolean; lmsFailed: number; lmsReminders: Record<string, number> | null; lmsVideosDeleted: number }> {
  const out = { lmsSkipped: false, lmsFailed: 0, lmsReminders: null as Record<string, number> | null, lmsVideosDeleted: 0 };
  try {
    let call = client.rpc('portal_lms_run_reminders', {});
    if (signal) call = call.abortSignal(signal);
    const reminders = await call;
    if (reminders.error) { if (isMissingSchema(reminders.error)) { out.lmsSkipped = true; return out; } throw reminders.error; }
    out.lmsReminders = reminders.data as Record<string, number>;
  } catch { out.lmsFailed++; }
  try {
    const due = await client.rpc('portal_lms_videos_to_delete', { p_limit: 50 });
    if (due.error) throw due.error;
    const items = (Array.isArray(due.data) ? due.data : []) as { id: string; path: string }[];
    if (items.length) {
      const removed = await client.storage.from(SUBMISSIONS_BUCKET).remove(items.map(item => item.path));
      if (removed.error) throw removed.error;
      // A file that was already gone counts as deleted too.
      const marked = await client.rpc('portal_lms_videos_deleted', { p_ids: items.map(item => item.id) });
      if (marked.error) throw marked.error;
      out.lmsVideosDeleted = Number(marked.data ?? 0);
    }
  } catch { out.lmsFailed++; }
  return out;
}

/** Signed playback for staff reviewing a submission: 10 minutes. */
export async function signedSubmissionUrl(client: SupabaseClient, path: string): Promise<string | null> {
  const signed = await client.storage.from(SUBMISSIONS_BUCKET).createSignedUrl(path, 600);
  if (signed.error) return null;
  return signed.data?.signedUrl ?? null;
}

/** Work waiting for a coach: submitted videos/answers and forms a student marked ready. */
export async function lmsReviewCounts(client: SupabaseClient): Promise<{ submissions: number; forms: number }> {
  const [submissions, forms] = await Promise.all([
    client.from('student_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    client.from('student_form_progress').select('student_id', { count: 'exact', head: true }).eq('status', 'ready_for_review'),
  ]);
  for (const result of [submissions, forms]) if (result.error) { if (isMissingSchema(result.error)) return { submissions: 0, forms: 0 }; throw result.error; }
  return { submissions: submissions.count ?? 0, forms: forms.count ?? 0 };
}
