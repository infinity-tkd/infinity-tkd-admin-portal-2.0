/** Fetch every RLS-visible page; a partial response must not masquerade as a complete ledger. */
export async function fetchAllRows(query: any, pageSize = 500): Promise<{data: any[] | null; error: any}> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Page size must be between 1 and 1000.');
  const callerSignal: AbortSignal | undefined = query.signal;
  const table = query.url?.pathname?.split('/').pop();
  const keys: Record<string,string[]> = {
    student_addresses:['address_id'],member_addresses:['address_id'],
    role_permissions:['role','permission_key'],user_permissions:['user_id','permission_key'],
    household_students:['household_id','student_id'],
    library_asset_muscles:['asset_id','muscle_id'],biomechanical_skill_linkage:['skill_name','muscle_id'],
    class_occurrence_roster:['occurrence_id','student_id'],membership_allocations:['receipt_id','invoice_id'],
    portal_job_leases:['job_name'],data_quality_reviews:['finding_key'],
  };
  // Stable tie breakers keep offset pagination from skipping rows with equal dates/names.
  for (const key of keys[table] || ['id']) query = query.order(key, { ascending:true });
  const rows: any[] = [];
  for (let offset = 0; offset < 100000; offset += pageSize) {
    // Retries belong to reads only. Each page has its own timeout while still
    // respecting the snapshot/session cancellation supplied by the caller.
    if (query.retry) query = query.retry(true);
    if (query.abortSignal) {
      const timeout = AbortSignal.timeout(15000);
      query = query.abortSignal(callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout);
    }
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
  return { data: null, error: { message: 'Data exceeds the supported snapshot size. Narrow the date or branch filters.' } };
}

/** Load complete private route results; retain access errors so cached data is discarded. */
export async function fetchApiRows(path: string, token: string, signal?: AbortSignal): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; offset < 100000; offset += 100) {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), cache: 'no-store' });
    let result;
    try { result = await response.json(); }
    catch { throw Object.assign(new Error('Portal records returned an invalid response. Please retry.'), { code: String(response.status) }); }
    if (!response.ok || !Array.isArray(result.data)) throw Object.assign(new Error(result.error?.message || 'Could not load the complete portal records.'), { code: String(response.status) });
    rows.push(...result.data);
    if (result.data.length < 100) return rows;
  }
  throw new Error('Portal records exceed the snapshot limit. Use a narrower date range.');
}
