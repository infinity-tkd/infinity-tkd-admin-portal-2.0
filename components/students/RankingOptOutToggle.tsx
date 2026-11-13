'use client';
import { useState } from 'react';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { useAppStore, type Student } from '@/lib/store';
import { cardClass, sectionLabelClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/**
 * Whether the student appears on the student portal's public leaderboards.
 * Saved immediately and audited; the student can also change it in the portal.
 */
export function RankingOptOutToggle({ student }: { student: Student }) {
  const { can, setStudentRankingOptOut } = useAppStore();
  const [saving, setSaving] = useState(false);
  const hidden = student.rankingOptOut === true;
  const editable = can('action:student_edit');
  const change = async () => {
    if (saving) return;
    setSaving(true);
    try { await setStudentRankingOptOut(student.id, !hidden); } finally { setSaving(false); }
  };
  return (
    <section aria-labelledby={`ranking-${student.id}`} className={cn(cardClass, 'space-y-3 p-4 md:p-5')}>
      <div className="flex items-center gap-2 border-b border-line pb-2.5">
        {hidden ? <EyeSlash aria-hidden="true" className="size-4 text-ink-muted" /> : <Trophy aria-hidden="true" className="size-4 text-brand-ink" />}
        <h3 id={`ranking-${student.id}`} className={sectionLabelClass}>Student rankings</h3>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-ink-muted">
          {hidden
            ? 'Hidden from the public leaderboards in the student portal. Their own progress still counts for them.'
            : 'Shown on the public leaderboards in the student portal.'}
        </p>
        {editable && (
          <button type="button" role="switch" aria-checked={!hidden} aria-labelledby={`ranking-${student.id}`} disabled={saving} onClick={() => void change()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-control px-3 text-xs font-semibold text-ink hover:bg-control-hover disabled:opacity-50 touch-manipulation">
            <span aria-hidden="true" className={cn('relative inline-block h-5 w-9 rounded-full transition-colors', hidden ? 'bg-line-strong' : 'bg-brand')}>
              <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', hidden ? 'left-0.5' : 'left-[1.125rem]')} />
            </span>
            {saving ? 'Saving…' : hidden ? 'Hidden' : 'Shown'}
          </button>
        )}
      </div>
    </section>
  );
}
