'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { financialDataAffected } from '@/lib/data-load-status';

export function DataLoadNotice() {
  const { state, refreshData } = useAppStore();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const issues = state.dataLoadIssues || [];
  if (!issues.length) return null;
  const setupRequired = issues.some(issue => issue.reason === 'setup');
  const retry = async () => {
    if (retrying || state.isRefreshingData) return;
    setRetrying(true);
    setRetryError('');
    try { await refreshData(); }
    catch { setRetryError('Records could not be refreshed. Check your connection and session, then retry.'); }
    finally { setRetrying(false); }
  };
  return <div role="alert" className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Some records are unavailable</p>
        <p className="mt-1">Affected: {issues.map(issue => issue.label).join(', ')}.</p>
        <p className="mt-1">{setupRequired
          ? 'Database setup or schema cache is incomplete. An administrator needs to verify the portal migrations in Supabase, then retry.'
          : issues.some(issue => issue.reason === 'permission')
            ? 'Your account could not access these records. Ask an administrator to check the access rules.'
            : issues.some(issue => issue.reason === 'session')
              ? 'Your session could not access these records. Please sign in again.'
              : 'The request failed. Check your connection and retry.'}</p>
        {financialDataAffected(issues) && <p className="mt-1">Financial reports may be incomplete. Refresh successfully before relying on them.</p>}
        {retryError && <p className="mt-1">{retryError}</p>}
      </div>
      <button type="button" onClick={retry} disabled={retrying || state.isRefreshingData}
        className="min-h-11 rounded-lg border border-amber-500 px-4 py-2 font-semibold disabled:cursor-wait disabled:opacity-60">
        {retrying || state.isRefreshingData ? 'Retrying…' : 'Retry loading records'}
      </button>
    </div>
    <details className="mt-2">
      <summary className="cursor-pointer text-xs">Technical details</summary>
      <ul className="mt-2 break-words text-xs">{issues.map(issue => <li key={issue.dataset}><code>{issue.dataset}</code>{issue.code && ` (${issue.code})`}</li>)}</ul>
      {setupRequired && <p className="mt-2 text-xs">Run the database readiness check and apply only missing migrations. Do not reapply an upgrade already installed.</p>}
    </details>
  </div>;
}
