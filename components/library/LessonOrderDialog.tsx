'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListNumbers } from '@phosphor-icons/react/dist/csr/ListNumbers';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, fieldClass, labelClass } from '@/components/ui/styles';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import { formatDuration, orderLessons, parseDuration, type LessonLayoutRow } from '@/lib/lesson-layout';
import { cn } from '@/lib/utils';

const BELT_ORDER = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Dan', '4th Dan', '5th Dan', '6th Dan', 'All'];
const beltRank = (belt: string) => { const at = BELT_ORDER.indexOf(belt); return at < 0 ? BELT_ORDER.length : at; };

/**
 * Orders a belt's lessons and records video lengths for the student portal
 * ("Lesson 4 of 12 · 4:05"). Saved immediately; no republishing needed.
 */
export function LessonOrderDialog({ onClose }: { onClose: () => void }) {
  const { showNotification } = useAppStore();
  const [rows, setRows] = useState<LessonLayoutRow[] | null>(null);
  const [error, setError] = useState('');
  const [belt, setBelt] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [lengths, setLengths] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setRows((await portalRequest<{ lessons: LessonLayoutRow[] }>('/api/admin/library-assets/layout')).lessons); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Lessons could not load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Lessons with no belt yet have no belt order to set.
  const belts = useMemo(() => [...new Set((rows ?? []).map(row => row.targetLevel).filter(level => level && level !== 'Unassigned'))].sort((a, b) => beltRank(a) - beltRank(b) || a.localeCompare(b)), [rows]);
  useEffect(() => { if (!belt && belts.length) setBelt(belts[0]); }, [belt, belts]);
  // Reset the working order whenever the belt or the saved data changes.
  useEffect(() => {
    const lessons = orderLessons((rows ?? []).filter(row => row.targetLevel === belt));
    setOrder(lessons.map(row => row.assetId));
    setLengths(Object.fromEntries(lessons.map(row => [row.assetId, formatDuration(row.durationSeconds)])));
  }, [rows, belt]);

  const byId = useMemo(() => new Map((rows ?? []).map(row => [row.assetId, row])), [rows]);
  const invalid = order.filter(id => parseDuration(lengths[id] ?? '') === undefined);
  const move = (from: number, to: number) => setOrder(current => { const next = [...current]; const [id] = next.splice(from, 1); next.splice(to, 0, id); return next; });
  const save = async () => {
    if (saving || invalid.length || !order.length) return;
    setSaving(true); setError('');
    try {
      const result = await portalRequest<{ updated: number }>('/api/admin/library-assets/layout', { lessons: order.map((assetId, index) => ({ assetId, sortOrder: index + 1, durationSeconds: parseDuration(lengths[assetId] ?? '') ?? null })) });
      showNotification(result.updated ? `Saved the ${belt} lesson order.` : 'No changes to save.', 'success');
      await load();
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'The lesson order could not be saved.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog onClose={onClose} size="lg" locked={saving}>
      <DialogHeader icon={<ListNumbers weight="bold" />} title="Lesson order" description="Order and video length shown to students" onClose={saving ? undefined : onClose} />
      <DialogBody className="space-y-4">
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {!rows && !error && <p role="status" className="text-sm text-ink-muted">Loading lessons…</p>}
        {rows && !belts.length && <p className="text-sm text-ink-muted">No library lessons are linked to the student library yet. Save a lesson once to link it.</p>}
        {belts.length > 0 && <>
          <div>
            <label htmlFor="lesson-order-belt" className={labelClass}>Belt</label>
            <select id="lesson-order-belt" className={fieldClass} value={belt} onChange={event => setBelt(event.target.value)} disabled={saving}>
              {belts.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <p className="text-xs text-ink-muted">Students see lessons in this order (&ldquo;Lesson 2 of {order.length}&rdquo;). Length uses minutes:seconds, for example 4:05; leave it blank if unknown.</p>
          <ol className="space-y-2">
            {order.map((assetId, index) => {
              const row = byId.get(assetId); if (!row) return null;
              const bad = parseDuration(lengths[assetId] ?? '') === undefined;
              return (
                <li key={assetId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted p-2.5 sm:flex-nowrap">
                  <span aria-hidden="true" className="w-7 shrink-0 text-center font-mono text-xs font-bold text-ink-subtle">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{row.title}</span>
                    <span className="text-[11px] text-ink-subtle">{row.isPublished ? 'Published to students' : 'Draft (not visible to students yet)'}</span>
                  </span>
                  <label className="sr-only" htmlFor={`length-${assetId}`}>Video length for {row.title}</label>
                  <input id={`length-${assetId}`} inputMode="numeric" placeholder="m:ss" value={lengths[assetId] ?? ''} disabled={saving}
                    aria-invalid={bad} onChange={event => setLengths(current => ({ ...current, [assetId]: event.target.value }))}
                    className={cn(fieldClass, 'w-24 text-right font-mono', bad && 'border-red-500 focus:border-red-500')} />
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${row.title} up`} disabled={saving || index === 0} onClick={() => move(index, index - 1)} className={buttonClass({ size: 'icon' })}><ArrowUp className="size-4" /></button>
                    <button type="button" aria-label={`Move ${row.title} down`} disabled={saving || index === order.length - 1} onClick={() => move(index, index + 1)} className={buttonClass({ size: 'icon' })}><ArrowDown className="size-4" /></button>
                  </span>
                </li>
              );
            })}
          </ol>
          {invalid.length > 0 && <p role="alert" className="text-xs text-red-700 dark:text-red-300">Use minutes:seconds (for example 4:05) for every length, or leave it blank.</p>}
        </>}
      </DialogBody>
      <DialogFooter>
        <button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Close</button>
        <button type="button" className={buttonClass({ variant: 'primary' })} onClick={() => void save()} disabled={saving || !order.length || invalid.length > 0}>{saving ? 'Saving…' : 'Save order'}</button>
      </DialogFooter>
    </Dialog>
  );
}
