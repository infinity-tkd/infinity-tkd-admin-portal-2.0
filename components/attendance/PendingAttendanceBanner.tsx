'use client';

import { useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { queuedAttendanceSnapshot, subscribeQueuedAttendance, type QueuedAttendanceMark } from '@/lib/attendance-queue';
import { useNetworkStatus } from '@/components/providers/NetworkStatusProvider';
import { buttonClass } from '@/components/ui/styles';

const NO_MARKS: readonly QueuedAttendanceMark[] = Object.freeze([]);

/**
 * Attendance marked offline that still needs attention once the device is online: marks the
 * server rejected (kept for review) or marks that could not be sent yet. While offline, the
 * connection bar already reports the waiting marks.
 */
export function PendingAttendanceBanner() {
  const { state, syncPendingAttendance, retryRejectedAttendance, discardQueuedAttendance, showConfirm } = useAppStore();
  const { isOnline, isSyncing } = useNetworkStatus();
  const queued = useSyncExternalStore(subscribeQueuedAttendance, queuedAttendanceSnapshot, () => NO_MARKS);
  const [busy, setBusy] = useState(false);
  const mine = queued.filter(mark => mark.userId === state.currentUser?.id);
  const rejected = mine.filter(mark => mark.failedReason);
  const waiting = mine.length - rejected.length;
  if (!isOnline || isSyncing || (!rejected.length && !waiting)) return null;

  const run = async (work: () => Promise<void>) => { setBusy(true); try { await work(); } finally { setBusy(false); } };
  const names = new Map(state.students.map(student => [student.id, student.englishName]));
  const describe = (mark: QueuedAttendanceMark) => `${names.get(mark.studentId) ?? mark.studentId} · ${mark.date} · ${mark.status}`;

  return (
    <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      {rejected.length > 0 ? (
        <>
          <p className="font-semibold">{rejected.length} attendance {rejected.length === 1 ? 'mark' : 'marks'} taken offline could not be saved.</p>
          <p className="mt-1 text-xs leading-relaxed">{rejected[0].failedReason}</p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {rejected.slice(0, 5).map(mark => <li key={mark.key}>{describe(mark)}</li>)}
            {rejected.length > 5 && <li>and {rejected.length - 5} more</li>}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={buttonClass({ variant: 'primary' })} onClick={() => run(() => retryRejectedAttendance(rejected.map(mark => mark.key)))}>Try again</button>
            <button type="button" disabled={busy} className={buttonClass()} onClick={() => showConfirm(`Discard ${rejected.length} attendance ${rejected.length === 1 ? 'mark' : 'marks'} that could not be saved? The roster reloads with the saved records.`, () => { void run(() => discardQueuedAttendance(rejected.map(mark => mark.key))); }, 'Discard offline marks')}>Discard</button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">{waiting} attendance {waiting === 1 ? 'mark' : 'marks'} taken offline {waiting === 1 ? 'is' : 'are'} waiting to be sent.</p>
          <button type="button" disabled={busy} className={buttonClass({ variant: 'primary' })} onClick={() => run(syncPendingAttendance)}>Send now</button>
        </div>
      )}
    </div>
  );
}
