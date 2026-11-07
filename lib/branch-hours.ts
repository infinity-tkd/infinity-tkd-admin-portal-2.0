import { z } from 'zod';

/**
 * Branch opening hours, stored on branches.opening_hours and shown by the
 * student portal. Format (academy time, 24-hour HH:MM), one entry per day:
 *   [{ "day": "Mon", "opens": "08:00", "closes": "20:00" }, { "day": "Sun", "closed": true }]
 * Days without an entry fall back to class times in the student portal.
 */
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type WeekDay = typeof WEEK_DAYS[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 08:00.');
const day = z.enum(WEEK_DAYS);
export const openingHoursEntrySchema = z.union([
  z.object({ day, closed: z.literal(true) }).strict(),
  z.object({ day, opens: time, closes: time }).strict().refine(entry => entry.closes > entry.opens, { message: 'Closing time must be after opening time.', path: ['closes'] }),
]);
export type OpeningHoursEntry = z.infer<typeof openingHoursEntrySchema>;
export const openingHoursSchema = z.array(openingHoursEntrySchema).max(7)
  .refine(entries => new Set(entries.map(entry => entry.day)).size === entries.length, 'Enter each day only once.');
export const branchHoursRequestSchema = z.object({ branchId: z.number().int().positive(), openingHours: openingHoursSchema.nullable() }).strict();

export interface DayDraft { day: WeekDay; mode: 'unset' | 'open' | 'closed'; opens: string; closes: string }

/** Accepts the short or full day names the student portal also accepts. */
export function weekDay(value: unknown): WeekDay | null {
  if (typeof value !== 'string') return null;
  const short = value.trim().slice(0, 3).toLowerCase();
  return WEEK_DAYS.find(name => name.toLowerCase() === short) ?? null;
}

/** One editor row per weekday from whatever is stored; unknown or invalid entries are left unset. */
export function draftsFromHours(hours: unknown): DayDraft[] {
  const entries = Array.isArray(hours) ? hours : [];
  return WEEK_DAYS.map(name => {
    const entry = entries.find(item => item && typeof item === 'object' && weekDay((item as { day?: unknown }).day) === name) as Record<string, unknown> | undefined;
    if (entry?.closed === true) return { day: name, mode: 'closed', opens: '', closes: '' };
    if (typeof entry?.opens === 'string' && typeof entry?.closes === 'string') return { day: name, mode: 'open', opens: entry.opens, closes: entry.closes };
    return { day: name, mode: 'unset', opens: '', closes: '' };
  });
}

/** Editor rows to the stored format. All rows unset clears the hours (null). */
export function hoursFromDrafts(drafts: readonly DayDraft[]): OpeningHoursEntry[] | null {
  const entries = drafts.flatMap((draft): OpeningHoursEntry[] => draft.mode === 'closed' ? [{ day: draft.day, closed: true }] : draft.mode === 'open' ? [{ day: draft.day, opens: draft.opens, closes: draft.closes }] : []);
  return entries.length ? entries : null;
}

/** The first problem in the editor rows, or null when they can be saved. */
export function draftError(drafts: readonly DayDraft[]): string | null {
  for (const draft of drafts) {
    if (draft.mode !== 'open') continue;
    if (!time.safeParse(draft.opens).success || !time.safeParse(draft.closes).success) return `${draft.day}: enter opening and closing times.`;
    if (draft.closes <= draft.opens) return `${draft.day}: closing time must be after opening time.`;
  }
  return null;
}
