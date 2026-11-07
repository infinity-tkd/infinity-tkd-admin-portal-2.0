import { TKD_CATEGORIES, FITNESS_CATEGORIES, DANCE_CATEGORIES, BELTS } from './library-catalog';

export type LibraryImportTab = 'tkd' | 'fitness' | 'dance' | 'routines';
export interface LibraryImportRecord { title: string; description: string; category: string; minBeltLevel: string; videoUrl: string }
export interface LibraryImportRow { index: number; data: LibraryImportRecord; errors: string[]; isValid: boolean }

const TITLE_LIMIT = 150; // Matches the library save API.
const categoryKey = (category: string) => (category || '').replace(/^Fitness:\s*/i, '').replace(/^Dance:\s*/i, '').trim().toLowerCase();
const lessonKey = (title: string, category: string) => title.trim().toLowerCase() + '\u0000' + categoryKey(category);

/** The canonical belt name for a CSV value in any letter case; unknown values are returned trimmed. */
export function canonicalImportBelt(value: string): string {
  const clean = (value || '').trim();
  return BELTS.slice(1).find(belt => belt.toLowerCase() === clean.toLowerCase()) ?? clean;
}

/** The save API only accepts credential-free HTTPS media links, so the preview must too. */
function isHttpsLink(value: string) {
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function validateLibraryImportRecord(record: LibraryImportRecord, tab: LibraryImportTab, existing: readonly { title: string; category: string }[]): string[] {
  const errors: string[] = [];
  if (!record.title.trim()) errors.push('Title is required.');
  else if (record.title.trim().length > TITLE_LIMIT) errors.push(`Title must be ${TITLE_LIMIT} characters or fewer.`);
  if (!record.description.trim()) errors.push('Description is required.');

  const key = lessonKey(record.title, record.category);
  if (record.title.trim() && existing.some(lesson => lessonKey(lesson.title || '', lesson.category || '') === key)) {
    errors.push('Asset already exists in this category.');
  }

  if (record.videoUrl && !isHttpsLink(record.videoUrl)) errors.push('Video link must be a full https:// address.');

  if (tab === 'tkd') {
    if (!(TKD_CATEGORIES as readonly string[]).includes(record.category)) errors.push(`Invalid Category. Choose from: ${TKD_CATEGORIES.join(', ')}`);
    if (!(BELTS.slice(1) as readonly string[]).includes(record.minBeltLevel)) errors.push('Invalid target belt level.');
  } else if (tab === 'dance') {
    if (!(DANCE_CATEGORIES as readonly string[]).includes(record.category)) errors.push(`Invalid Category. Choose from: ${DANCE_CATEGORIES.join(', ')}`);
  } else if (!(FITNESS_CATEGORIES as readonly string[]).includes(record.category)) {
    errors.push(`Invalid Category. Choose from: ${FITNESS_CATEGORIES.join(', ')}`);
  }
  return errors;
}

/** Revalidates every row and flags repeats of an earlier row in the same import. */
export function validateLibraryImportRows<T extends LibraryImportRow>(rows: readonly T[], validate: (record: LibraryImportRecord) => string[]): T[] {
  const firstRow = new Map<string, number>();
  return rows.map(row => {
    const errors = validate(row.data);
    if (row.data.title.trim()) {
      const key = lessonKey(row.data.title, row.data.category);
      const first = firstRow.get(key);
      if (first === undefined) firstRow.set(key, row.index);
      else errors.push(`Duplicate of row ${first} in this import.`);
    }
    return { ...row, errors, isValid: errors.length === 0 };
  });
}
