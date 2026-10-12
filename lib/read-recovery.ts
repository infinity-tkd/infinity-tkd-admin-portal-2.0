/** Collapse change bursts into one read, retaining one follow-up if data changes mid-read. */
export function createReadRecovery(
  refresh: () => Promise<void>,
  isAvailable: () => boolean,
  delayMs = 750,
) {
  let disposed = false;
  let dirty = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = () => {
    if (disposed) return;
    dirty = true;
    if (!running && !timer && isAvailable()) timer = setTimeout(run, delayMs);
  };
  const run = async () => {
    timer = undefined;
    if (disposed || running || !dirty || !isAvailable()) return;
    dirty = false;
    running = true;
    try { await refresh(); }
    catch { /* The data notice/session guard owns recovery messages. Never replay a write. */ }
    finally {
      running = false;
      if (dirty && !disposed) request();
    }
  };
  return {
    request,
    dispose() { disposed = true; dirty = false; clearTimeout(timer); },
  };
}

/** Bound database read concurrency while preserving dataset/result order and failures. */
export async function settleReads<T>(reads: Array<() => PromiseLike<T>>, concurrency = 6): Promise<PromiseSettledResult<T>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Read concurrency must be a positive integer.');
  const results: PromiseSettledResult<T>[] = new Array(reads.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, reads.length) }, async () => {
    while (cursor < reads.length) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await reads[index]() }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}

export const PORTAL_REALTIME_TABLES = [
  'profiles', 'members', 'member_addresses', 'students', 'student_addresses',
  'branches', 'class_sessions', 'class_enrollments', 'scholarships', 'attendance',
  'payments', 'payment_transactions', 'belt_histories', 'achievements', 'library_assets',
  'lms_progress', 'workout_templates', 'student_physical_evaluations', 'belt_techniques',
  'muscles', 'library_asset_muscles', 'student_body_compositions', 'academy_profile',
  'role_permissions', 'user_permissions', 'staff_dan_history', 'partners',
] as const;
