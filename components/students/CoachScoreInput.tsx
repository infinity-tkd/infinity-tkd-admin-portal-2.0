'use client';
import React, { useEffect, useId, useState } from 'react';
import { parseCoachScore } from '@/lib/physical-grades';

/**
 * Coach assessment score (0–10, one decimal) shown on the student portal's
 * skills radar. Saves on blur or Enter; leaving it blank clears the score.
 */
export function CoachScoreInput({ score, skill, disabled = false, onSave }: { score?: number | null; skill: string; disabled?: boolean; onSave: (score: number | null) => Promise<void> }) {
  const saved = score == null ? '' : String(score);
  const [value, setValue] = useState(saved);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  useEffect(() => { setValue(saved); setError(''); }, [saved]);
  const commit = async () => {
    if (busy || value.trim() === saved) return;
    const parsed = parseCoachScore(value);
    if (parsed === 'invalid') { setError('Use 0–10, one decimal'); return; }
    setBusy(true); setError('');
    try { await onSave(parsed); }
    catch { setValue(saved); } // The store already reports the failure.
    finally { setBusy(false); }
  };
  return (
    <span className="inline-flex items-center gap-1.5" title="Coach score from 0 to 10 for the student portal skills chart">
      <span aria-hidden="true" className="text-micro font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Score</span>
      <input
        type="number" inputMode="decimal" min={0} max={10} step={0.1} placeholder="–"
        value={value} disabled={disabled || busy}
        aria-label={`Coach score out of 10 for ${skill}`} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        onChange={event => { setValue(event.target.value); setError(''); }}
        onBlur={() => void commit()}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void commit(); } }}
        className="h-8 w-16 rounded-[6px] border border-neutral-300 bg-white px-2 text-xs font-mono text-neutral-900 focus:border-brand focus:outline-none disabled:opacity-50 dark:border-[#333] dark:bg-[#141414] dark:text-white"
      />
      {error && <span id={errorId} role="alert" className="text-micro text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
