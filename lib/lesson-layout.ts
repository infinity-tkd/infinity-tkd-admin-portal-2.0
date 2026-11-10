import { z } from 'zod';

/**
 * Lesson order and length for the student portal ("Lesson 4 of 12 · 4:05").
 * Stored on the published student lesson (curriculum.sort_order / duration_seconds)
 * and edited per belt from the Library; changes apply without republishing.
 */
export const lessonLayoutRequestSchema = z.object({
  lessons: z.array(z.object({
    assetId: z.number().int().positive(),
    sortOrder: z.number().int().min(1).max(10000).nullable(),
    durationSeconds: z.number().int().min(1).max(86400).nullable(),
  }).strict()).min(1).max(300),
}).strict();
export type LessonLayoutRequest = z.infer<typeof lessonLayoutRequestSchema>;

export interface LessonLayoutRow { assetId: number; title: string; targetLevel: string; libraryType: string; isPublished: boolean; sortOrder: number | null; durationSeconds: number | null }

/** Library assets joined to their student lesson (linked id, or the legacy same-id same-title match). */
export function lessonLayoutRows(assets: readonly Record<string, any>[], lessons: readonly Record<string, any>[]): LessonLayoutRow[] {
  const byId = new Map(lessons.map(row => [Number(row.id), row]));
  const rows: LessonLayoutRow[] = [];
  for (const asset of assets) {
    const linked = asset.student_curriculum_id != null ? byId.get(Number(asset.student_curriculum_id)) : byId.get(Number(asset.id));
    if (!linked || (asset.student_curriculum_id == null && linked.title !== asset.title)) continue;
    rows.push({ assetId: Number(asset.id), title: String(asset.title), targetLevel: String(asset.target_level ?? ''), libraryType: String(asset.library_type ?? ''),
      isPublished: linked.is_active === true, sortOrder: linked.sort_order ?? null, durationSeconds: linked.duration_seconds ?? null });
  }
  return rows;
}

/** "m:ss" or "h:mm:ss" ⇄ seconds. Blank means unknown; anything else invalid returns undefined. */
export function parseDuration(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return null;
  if (/^\d{1,5}$/.test(value)) { const seconds = Number(value); return seconds >= 1 && seconds <= 86400 ? seconds : undefined; }
  const match = value.match(/^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/);
  if (!match) return undefined;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return seconds >= 1 && seconds <= 86400 ? seconds : undefined;
}
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Orders a belt's lessons: positioned lessons first (by position), then the rest by title. */
export function orderLessons<T extends { sortOrder: number | null; title: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.title.localeCompare(b.title));
}
