'use client';

import { useEffect, useState } from 'react';
import { PageLoader } from '@/components/ui/States';

/**
 * Shown in place of a page while the first snapshot of the academy's records loads, so a page never flashes
 * "0 students", empty ledgers or "Access restricted" before its data (and the user's permissions) have arrived.
 * After a few seconds it says so, instead of leaving a spinner with no explanation.
 */
export function RecordsLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div aria-busy="true">
      <PageLoader label="Loading records…" />
      {slow && (
        <p role="status" className="-mt-10 px-6 pb-10 text-center text-xs leading-relaxed text-ink-muted">
          This is taking longer than usual. Check your connection; the page opens as soon as the records arrive.
        </p>
      )}
    </div>
  );
}
