import { z } from 'zod';

/**
 * Library content model (library-v2).
 *
 * A lesson or article is an ordered list of typed sections that staff can add,
 * reorder and remove in Library → Content & languages. English is the base text;
 * Khmer and Chinese translations are sparse overrides keyed by section id, and any
 * missing text falls back to English. Sections live in library_asset_content
 * (draft, server only) and are snapshotted to library_published_content on publish.
 */

export const LIBRARY_LOCALES = ['km', 'zh'] as const;
export type LibraryLocale = typeof LIBRARY_LOCALES[number];
export const LIBRARY_LANGS = ['en', ...LIBRARY_LOCALES] as const;
export type LibraryLang = typeof LIBRARY_LANGS[number];
export const LIBRARY_LANG_LABEL: Record<LibraryLang, string> = { en: 'English', km: 'Khmer', zh: 'Chinese' };
export const LIBRARY_KINDS = ['lesson', 'article'] as const;
export type LibraryKind = typeof LIBRARY_KINDS[number];
/** Lessons imported without a belt; staff choose one before publishing. */
export const UNASSIGNED_BELT = 'Unassigned';
export const LIBRARY_CATEGORY_ICONS = ['BookOpen', 'Lightning', 'Fire', 'Shield', 'Stack', 'Sparkle', 'Medal', 'Scroll', 'Target', 'Barbell', 'MusicNotes', 'Hand', 'Footprints', 'Brain', 'Users', 'Star'] as const;
export const LIBRARY_CATEGORY_TYPES = ['Taekwondo', 'Fitness', 'Dance'] as const;

const str = (max: number) => z.string().trim().max(max);
const line = str(2000);
const long = str(20000);
const list = <T extends z.ZodTypeAny>(schema: T, max: number) => z.array(schema).max(max);
export const SECTION_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sectionId = z.string().regex(SECTION_ID, 'Section ids use lowercase letters, numbers and dashes.');

/** Same rule as lesson media and the student portal: HTTPS, no credentials, default port. */
export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && value.length <= 2000;
  } catch { return false; }
}
const httpsUrl = z.string().trim().refine(isSafeHttpsUrl, 'Links must start with https://');
const fact = z.object({ label: str(120), value: line }).strict();
const base = { id: sectionId, title: str(200).default('') };
const point = z.object({ x: z.number().finite().min(-2000).max(2000), y: z.number().finite().min(-2000).max(2000) }).strict();
const facing = z.enum(['N', 'E', 'S', 'W']);
const stance = z.object({ type: str(40), lead: z.enum(['left', 'right']).optional() }).passthrough();

/** Poomsae floor diagram (website walkthroughs): one geometry step per movement. */
export const poomsaeWalkthroughSchema = z.object({
  start: point, startFacing: facing, startStance: stance,
  guides: list(z.object({ from: point, to: point }).strict(), 40).default([]),
  verified: z.boolean().default(false),
  steps: list(z.object({ to: point, facing, stance, techniques: list(str(200), 12).default([]) }).passthrough(), 80).min(1),
}).passthrough();

export const SECTION_TYPES = ['text', 'list', 'steps', 'pairs', 'glossary', 'facts', 'table', 'timeline', 'cards', 'links', 'callout', 'diagram'] as const;
export type LibrarySectionType = typeof SECTION_TYPES[number];
export const SECTION_TYPE_LABEL: Record<LibrarySectionType, string> = {
  text: 'Paragraphs', list: 'List', steps: 'Steps', pairs: 'Pairs (term and detail)', glossary: 'Korean terms', facts: 'Facts',
  table: 'Table', timeline: 'Timeline', cards: 'Cards', links: 'Links', callout: 'Callout', diagram: 'Diagram',
};

export const librarySectionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), paragraphs: list(long, 60) }).strict(),
  z.object({ ...base, type: z.literal('list'), style: z.enum(['bullet', 'number', 'check']).default('bullet'), items: list(line, 200) }).strict(),
  z.object({ ...base, type: z.literal('steps'), items: list(z.object({ title: str(300).default(''), body: long.default(''), details: list(line, 50).default([]) }).strict(), 200) }).strict(),
  z.object({ ...base, type: z.literal('pairs'), leftLabel: str(80).default(''), rightLabel: str(80).default(''), items: list(z.object({ term: line, detail: long }).strict(), 200) }).strict(),
  z.object({ ...base, type: z.literal('glossary'), items: list(z.object({ korean: str(200).default(''), romanized: str(200).default(''), english: line, category: str(80).default('') }).strict(), 200) }).strict(),
  z.object({ ...base, type: z.literal('facts'), items: list(fact, 60) }).strict(),
  z.object({ ...base, type: z.literal('table'), columns: list(str(120), 12).min(1), rows: list(list(line, 12), 300), caption: str(500).default('') }).strict(),
  z.object({ ...base, type: z.literal('timeline'), items: list(z.object({ date: str(80).default(''), title: str(300), subtitle: str(300).default(''), body: long.default(''), details: list(line, 30).default([]), tag: str(80).default('') }).strict(), 200) }).strict(),
  z.object({ ...base, type: z.literal('cards'), items: list(z.object({ title: str(300), subtitle: str(300).default(''), body: long.default(''), bullets: list(line, 40).default([]), facts: list(fact, 20).default([]) }).strict(), 200) }).strict(),
  z.object({ ...base, type: z.literal('links'), items: list(z.object({ label: str(200), url: httpsUrl }).strict(), 30) }).strict(),
  z.object({ ...base, type: z.literal('callout'), tone: z.enum(['info', 'tip', 'warning']).default('info'), body: long }).strict(),
  z.object({ ...base, type: z.literal('diagram'), kind: z.literal('poomsae-walkthrough'), data: poomsaeWalkthroughSchema }).strict(),
]).superRefine((section, context) => {
  if (section.type === 'table' && section.rows.some(row => row.length !== section.columns.length)) context.addIssue({ code: 'custom', message: `Every row in "${section.title || section.id}" needs ${section.columns.length} cells.` });
});
export type LibrarySection = z.infer<typeof librarySectionSchema>;

/** A translation is any subset of its English section's text, by the same shape. */
function translationShapeOk(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.length <= 20000;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return true;
  if (depth > 6) return false;
  if (Array.isArray(value)) return value.length <= 300 && value.every(item => translationShapeOk(item, depth + 1));
  if (typeof value === 'object') { const entries = Object.entries(value as Record<string, unknown>); return entries.length <= 40 && entries.every(([, item]) => translationShapeOk(item, depth + 1)); }
  return false;
}
const translatedSection = z.unknown().refine(value => typeof value === 'object' && value !== null && !Array.isArray(value) && translationShapeOk(value), 'Invalid translated section.');
export const libraryTranslationSchema = z.object({
  title: str(150).optional(), summary: str(4000).optional(), koreanName: str(200).optional(), levelNote: str(120).optional(),
  sections: z.record(z.string().regex(SECTION_ID), translatedSection).refine(value => Object.keys(value).length <= 80, 'Too many translated sections.').optional(),
}).strict();
export type LibraryTranslation = z.infer<typeof libraryTranslationSchema>;
export const librarySourceSchema = z.object({ label: str(200), url: httpsUrl }).strict();

export const librarySectionsSchema = z.array(librarySectionSchema).max(80).superRefine((sections, context) => {
  const seen = new Set<string>();
  for (const section of sections) {
    if (seen.has(section.id)) context.addIssue({ code: 'custom', message: `Two sections share the id "${section.id}".` });
    seen.add(section.id);
  }
});
export const libraryContentSchema = z.object({
  sections: librarySectionsSchema.default([]),
  translations: z.object({ km: libraryTranslationSchema.optional(), zh: libraryTranslationSchema.optional() }).strict().default({}),
  sources: list(librarySourceSchema, 20).default([]),
}).strict().superRefine((content, context) => {
  // Same cap as the database check; keeps one lesson well under a megabyte.
  if (JSON.stringify(content).length > 1_500_000) context.addIssue({ code: 'custom', message: 'This lesson is too long. Split it into smaller lessons.' });
});
export type LibraryContent = z.infer<typeof libraryContentSchema>;

const optionalText = (max: number) => str(max).nullable().transform(value => value || null);
export const libraryMetadataSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  kind: z.enum(LIBRARY_KINDS),
  slug: z.string().trim().max(120).regex(SLUG, 'Slugs use lowercase letters, numbers and dashes.').nullable().or(z.literal('').transform(() => null)),
  koreanName: optionalText(200), romanized: optionalText(200), summary: optionalText(4000), levelNote: optionalText(120),
  tags: list(str(40).min(1), 20).default([]),
}).strict();
export type LibraryMetadata = z.infer<typeof libraryMetadataSchema>;

const categoryTranslation = z.object({ title: str(120).optional(), subtitle: str(240).optional(), description: str(2000).optional() }).strict();
export const libraryCategorySchema = z.object({
  slug: z.string().trim().min(2).max(60).regex(SLUG, 'Use lowercase letters, numbers and dashes.'),
  title: str(120).min(1), koreanTitle: optionalText(120), subtitle: optionalText(240), description: optionalText(2000),
  icon: z.enum(LIBRARY_CATEGORY_ICONS), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #EF2F38.'),
  libraryType: z.enum(LIBRARY_CATEGORY_TYPES), isActive: z.boolean(),
  translations: z.object({ km: categoryTranslation.optional(), zh: categoryTranslation.optional() }).strict().default({}),
}).strict();
export type LibraryCategoryInput = z.infer<typeof libraryCategorySchema>;
export interface LibraryCategory extends LibraryCategoryInput { id: string; sortOrder: number; revision: number; lessonCount?: number }

/** Database row (snake_case) → category. */
export function libraryCategoryFromRow(row: Record<string, any>): LibraryCategory {
  return {
    id: row.id, slug: row.slug, title: row.title, koreanTitle: row.korean_title ?? null, subtitle: row.subtitle ?? null, description: row.description ?? null,
    icon: (LIBRARY_CATEGORY_ICONS as readonly string[]).includes(row.icon) ? row.icon : 'BookOpen', accentColor: row.accent_color, libraryType: row.library_type,
    isActive: row.is_active !== false, translations: row.translations && typeof row.translations === 'object' ? row.translations : {},
    sortOrder: row.sort_order, revision: row.revision, ...(row.lesson_count != null ? { lessonCount: Number(row.lesson_count) } : {}),
  };
}

// Keys whose values are structure, not prose: never translated.
const FIXED_KEYS = new Set(['id', 'type', 'style', 'tone', 'url', 'kind', 'data']);

/** English section with any translated text laid over it; blank or missing text keeps the English. */
export function localizeSection<T>(section: T, translated: unknown): T {
  const merge = (value: unknown, over: unknown): unknown => {
    if (typeof value === 'string') return typeof over === 'string' && over.trim() ? over : value;
    if (Array.isArray(value)) return value.map((item, index) => merge(item, Array.isArray(over) ? over[index] : undefined));
    if (value && typeof value === 'object') {
      const source = over && typeof over === 'object' && !Array.isArray(over) ? over as Record<string, unknown> : {};
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, FIXED_KEYS.has(key) ? item : merge(item, source[key])]));
    }
    return value;
  };
  return merge(section, translated) as T;
}

export interface TranslatableText { path: (string | number)[]; label: string; english: string; multiline: boolean }
/** Every translatable text field of a section, in display order, for the translation editor. */
export function translatableTexts(section: LibrarySection): TranslatableText[] {
  const out: TranslatableText[] = [];
  const walk = (value: unknown, path: (string | number)[], label: string) => {
    if (typeof value === 'string') { if (value.trim()) out.push({ path, label, english: value, multiline: value.length > 80 || /body|detail|paragraphs|description/.test(String(path.at(-2) ?? path.at(-1))) }); return; }
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, [...path, index], `${label} ${index + 1}`.trim())); return; }
    if (value && typeof value === 'object') for (const [key, item] of Object.entries(value as Record<string, unknown>)) if (!FIXED_KEYS.has(key)) walk(item, [...path, key], label ? `${label} · ${key}` : key);
  };
  walk(section, [], '');
  return out;
}

/** Reads one text from a sparse translated section. */
export function readPath(value: unknown, path: (string | number)[]): string {
  let current: unknown = value;
  for (const key of path) { if (current == null || typeof current !== 'object') return ''; current = (current as Record<string | number, unknown>)[key]; }
  return typeof current === 'string' ? current : '';
}
/** Writes one text into a sparse translated section, creating arrays and objects on the way. */
export function writePath(value: unknown, path: (string | number)[], text: string): Record<string, unknown> {
  const root: any = value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
  let current = root;
  path.forEach((key, index) => {
    if (index === path.length - 1) { current[key] = text; return; }
    if (current[key] == null || typeof current[key] !== 'object') current[key] = typeof path[index + 1] === 'number' ? [] : {};
    current = current[key];
  });
  return root;
}
/** Drops empty strings and empty containers so stored translations stay sparse. */
export function pruneTranslation(value: unknown): unknown {
  if (typeof value === 'string') return value.trim() ? value : undefined;
  // Array.from visits holes left by writePath, so they become '' rather than JSON null.
  if (Array.isArray(value)) { const items = Array.from(value, pruneTranslation); return items.some(item => item !== undefined) ? items.map(item => item ?? '') : undefined; }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, pruneTranslation(item)] as const).filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

export interface LibraryDocumentFields { title: string; summary: string | null; koreanName: string | null; levelNote: string | null; sections: LibrarySection[]; translations: LibraryContent['translations'] }
/** The lesson as one language sees it: translated where available, English everywhere else. */
export function localizeDocument<T extends LibraryDocumentFields>(doc: T, lang: LibraryLang): T & { lang: LibraryLang; translated: boolean } {
  const translation = lang === 'en' ? undefined : doc.translations?.[lang];
  if (!translation) return { ...doc, lang, translated: false };
  return {
    ...doc, lang, translated: true,
    title: translation.title?.trim() || doc.title,
    summary: translation.summary?.trim() || doc.summary,
    koreanName: translation.koreanName?.trim() || doc.koreanName,
    levelNote: translation.levelNote?.trim() || doc.levelNote,
    sections: doc.sections.map(section => localizeSection(section, translation.sections?.[section.id])),
  };
}

/** Which languages have any translated text, for badges in the admin library. */
export function translatedLanguages(translations: LibraryContent['translations'] | undefined): LibraryLocale[] {
  return LIBRARY_LOCALES.filter(lang => { const t = translations?.[lang]; return !!t && (!!t.title || !!t.summary || Object.keys(t.sections ?? {}).length > 0); });
}

/** A blank section of the chosen type, for the "Add section" menu. */
export function emptySection(type: LibrarySectionType, id: string): LibrarySection {
  switch (type) {
    case 'text': return { id, type, title: '', paragraphs: [''] };
    case 'list': return { id, type, title: '', style: 'bullet', items: [''] };
    case 'steps': return { id, type, title: '', items: [{ title: '', body: '', details: [] }] };
    case 'pairs': return { id, type, title: '', leftLabel: '', rightLabel: '', items: [{ term: '', detail: '' }] };
    case 'glossary': return { id, type, title: '', items: [{ korean: '', romanized: '', english: '', category: '' }] };
    case 'facts': return { id, type, title: '', items: [{ label: '', value: '' }] };
    case 'table': return { id, type, title: '', columns: ['Column 1', 'Column 2'], rows: [['', '']], caption: '' };
    case 'timeline': return { id, type, title: '', items: [{ date: '', title: '', subtitle: '', body: '', details: [], tag: '' }] };
    case 'cards': return { id, type, title: '', items: [{ title: '', subtitle: '', body: '', bullets: [], facts: [] }] };
    case 'links': return { id, type, title: '', items: [{ label: '', url: 'https://' }] };
    case 'callout': return { id, type, title: '', tone: 'info', body: '' };
    case 'diagram': throw new Error('Diagrams are imported, not created by hand.');
  }
}

/** A section id not used yet, derived from the type (text, text-2, …). */
export function nextSectionId(sections: readonly { id: string }[], type: string) {
  const used = new Set(sections.map(section => section.id));
  if (!used.has(type)) return type;
  for (let n = 2; ; n++) if (!used.has(`${type}-${n}`)) return `${type}-${n}`;
}

/**
 * Sections for a lesson published before library-v2 (legacy learning-v1 guidance),
 * so the v2 feed can show every published lesson with one renderer.
 */
export function legacySections(content: Record<string, any> | null | undefined, description: string | null | undefined): LibrarySection[] {
  const c = content && typeof content === 'object' ? content : {};
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim().slice(0, 2000)) : [];
  const out: LibrarySection[] = [];
  if (description?.trim()) out.push({ id: 'overview', type: 'text', title: '', paragraphs: description.trim().split(/\n{2,}/).map(part => part.slice(0, 20000)).slice(0, 60) });
  const steps = strings(c.instructions);
  if (steps.length) out.push({ id: 'steps', type: 'steps', title: 'Steps', items: steps.map(body => ({ title: '', body, details: [] })) });
  for (const [key, id, title] of [['prerequisites', 'prerequisites', 'Prerequisites'], ['principles', 'principles', 'Key principles'], ['drillingMethods', 'drills', 'Drills'], ['performance', 'performance', 'Performance']] as const) {
    const items = strings(c[key]);
    if (items.length) out.push({ id, type: 'list', title, style: 'bullet', items });
  }
  const mistakes = Array.isArray(c.mistakes) ? c.mistakes.filter((row: any) => row && typeof row.mistake === 'string' && row.mistake.trim()) : [];
  if (mistakes.length) out.push({ id: 'mistakes', type: 'pairs', title: 'Common mistakes', leftLabel: 'Mistake', rightLabel: 'Correction', items: mistakes.map((row: any) => ({ term: row.mistake.slice(0, 2000), detail: String(row.correction ?? '').slice(0, 20000) })) });
  const terms = Array.isArray(c.terminology) ? c.terminology.filter((row: any) => row && (row.korean || row.english)) : [];
  if (terms.length) out.push({ id: 'terminology', type: 'glossary', title: 'Terminology', items: terms.map((row: any) => ({ korean: String(row.korean ?? '').slice(0, 200), romanized: '', english: String(row.english ?? '').slice(0, 2000), category: '' })) });
  const guide = Array.isArray(c.studyGuide) ? c.studyGuide.filter((row: any) => row && typeof row.question === 'string' && row.question.trim()) : [];
  if (guide.length) out.push({ id: 'study-guide', type: 'pairs', title: 'Study guide', leftLabel: 'Question', rightLabel: 'Answer', items: guide.map((row: any) => ({ term: row.question.slice(0, 2000), detail: String(row.answer ?? '').slice(0, 20000) })) });
  return out;
}
