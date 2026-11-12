import { z } from 'zod';
import { legacySections, librarySectionSchema, librarySourceSchema, localizeDocument, LIBRARY_LANGS, LIBRARY_LOCALES, SLUG, type LibraryLang, type LibrarySection } from './library-content';
import { resolveLessonMedia, type LessonMedia } from './lesson-media';
import { studentImageUrl } from './student-catalog-contract';

/**
 * library-v2: the student portal's localized library feed (docs/STUDENT_PORTAL_LIBRARY_V2_HANDOFF.md).
 * GET /api/portal/library          → one page of lesson summaries plus the active categories
 * GET /api/portal/library/{id}     → one lesson with its sections, in the requested language
 * Both need the X-Portal-Contract: library-v2 header and a signed-in student.
 */
export const LIBRARY_V2 = 'library-v2';
// The student portal's own locale codes (kh, zh-CN) are accepted as well.
const LANG_ALIASES: Record<string, string> = { kh: 'km', 'zh-CN': 'zh', 'zh-cn': 'zh' };
const lang = z.preprocess(value => typeof value === 'string' ? LANG_ALIASES[value] ?? value : value, z.enum(LIBRARY_LANGS).default('en'));
export const libraryV2QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25), cursor: z.string().max(4000).optional(), q: z.string().trim().max(100).default(''),
  category: z.string().trim().max(60).regex(SLUG).optional(), kind: z.enum(['lesson', 'article']).optional(), lang,
}).strict();
export const libraryV2DetailQuerySchema = z.object({ lang }).strict();

const text = z.string();
const media: z.ZodType<LessonMedia> = z.union([
  z.object({ kind: z.literal('iframe'), provider: z.enum(['youtube', 'google-drive', 'vimeo']), src: text, href: text }).strict(),
  z.object({ kind: z.literal('video'), src: text, href: text, mimeType: z.enum(['video/mp4', 'video/webm', 'video/ogg']) }).strict(),
  z.object({ kind: z.literal('external'), href: text }).strict(),
  z.object({ kind: z.literal('unavailable') }).strict(),
]);
export const libraryV2CategorySchema = z.object({
  slug: text, title: text, koreanTitle: text.nullable(), subtitle: text.nullable(), description: text.nullable(),
  icon: text, accentColor: text, type: z.enum(['Taekwondo', 'Fitness', 'Dance']),
}).strict();
export const libraryV2LessonSummarySchema = z.object({
  id: z.number().int().positive(), slug: text.nullable(), kind: z.enum(['lesson', 'article']), category: text.nullable(), title: text, koreanName: text.nullable(), romanized: text.nullable(),
  summary: text.nullable(), levelNote: text.nullable(), targetBelt: text, type: z.enum(['Taekwondo', 'Fitness', 'Dance']), thumbnailUrl: text.nullable(), media,
  position: z.number().int().nullable(), durationSeconds: z.number().int().nullable(), tags: z.array(text), sectionCount: z.number().int().nonnegative(), translated: z.boolean(),
}).strict();
export const libraryV2LessonSchema = libraryV2LessonSummarySchema.extend({
  sections: z.array(librarySectionSchema), sources: z.array(librarySourceSchema), languages: z.array(z.enum(LIBRARY_LANGS)),
}).strict();
export const libraryV2PageSchema = z.object({
  contractVersion: z.literal(LIBRARY_V2), subjectStudentId: text, lang: z.enum(LIBRARY_LANGS),
  categories: z.array(libraryV2CategorySchema), lessons: z.array(libraryV2LessonSummarySchema).max(50), nextCursor: text.nullable(),
}).strict();
export const libraryV2DetailSchema = z.object({ contractVersion: z.literal(LIBRARY_V2), subjectStudentId: text, lang: z.enum(LIBRARY_LANGS), lesson: libraryV2LessonSchema }).strict();
export type LibraryV2Category = z.infer<typeof libraryV2CategorySchema>;
export type LibraryV2LessonSummary = z.infer<typeof libraryV2LessonSummarySchema>;
export type LibraryV2Lesson = z.infer<typeof libraryV2LessonSchema>;

const type = (value: unknown): 'Taekwondo' | 'Fitness' | 'Dance' => value === 'Fitness' || value === 'Dance' ? value : 'Taekwondo';
const positiveInt = (value: unknown) => Number.isInteger(value) && (value as number) > 0 ? value as number : null;
const str = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

/** An active category in the student's language (English where a translation is missing). */
export function libraryV2Category(row: Record<string, any>, language: LibraryLang): LibraryV2Category {
  const t = language === 'en' ? undefined : row.translations?.[language];
  return {
    slug: row.slug, title: str(t?.title) ?? row.title, koreanTitle: row.korean_title ?? null, subtitle: str(t?.subtitle) ?? row.subtitle ?? null,
    description: str(t?.description) ?? row.description ?? null, icon: row.icon, accentColor: row.accent_color, type: type(row.library_type),
  };
}

/** One row of portal_student_library_page → a lesson summary. */
export function libraryV2Summary(row: Record<string, any>): LibraryV2LessonSummary {
  const p = row.published && typeof row.published === 'object' ? row.published : null;
  const t = p?.translation && typeof p.translation === 'object' ? p.translation : {};
  const legacySummary = typeof row.description === 'string' && row.description.trim() ? row.description.trim().slice(0, 600) : null;
  return {
    id: row.id, slug: p?.slug ?? null, kind: p?.kind === 'article' ? 'article' : 'lesson', category: p?.category ?? null,
    title: str(t.title) ?? row.title, koreanName: p?.koreanName ?? null, romanized: p?.romanized ?? null,
    summary: str(t.summary) ?? p?.summary ?? legacySummary, levelNote: str(t.levelNote) ?? p?.levelNote ?? null,
    targetBelt: row.targetBelt, type: type(row.type), thumbnailUrl: studentImageUrl(row.thumbnailUrl), media: resolveLessonMedia(row.videoUrl),
    position: positiveInt(row.position), durationSeconds: positiveInt(row.durationSeconds), tags: Array.isArray(p?.tags) ? p.tags.filter((tag: unknown) => typeof tag === 'string') : [],
    sectionCount: Number.isInteger(p?.sectionCount) ? p.sectionCount : 0, translated: Object.keys(t).length > 0,
  };
}

/**
 * One published lesson in the student's language. Lessons published before library-v2
 * have no snapshot and are built from their learning-v1 guidance.
 */
export function libraryV2Lesson(curriculum: Record<string, any>, published: Record<string, any> | null, categorySlug: string | null, language: LibraryLang): LibraryV2Lesson {
  const doc = published?.document && typeof published.document === 'object' ? published.document : null;
  const sectionsParsed = z.array(librarySectionSchema).safeParse(doc?.sections ?? []);
  const sections: LibrarySection[] = doc ? (sectionsParsed.success ? sectionsParsed.data : []) : legacySections(curriculum.learning_content, curriculum.description);
  const translations = doc?.translations && typeof doc.translations === 'object' ? doc.translations : {};
  const localized = localizeDocument({ title: curriculum.title, summary: doc?.summary ?? null, koreanName: doc?.koreanName ?? null, levelNote: doc?.levelNote ?? null, sections, translations }, language);
  const sources = z.array(librarySourceSchema).safeParse(doc?.sources ?? []);
  const languages = ['en', ...LIBRARY_LOCALES.filter(code => translations[code])] as LibraryLang[];
  return {
    id: curriculum.id, slug: doc?.slug ?? null, kind: published?.content_kind === 'article' ? 'article' : 'lesson', category: categorySlug,
    title: localized.title, koreanName: localized.koreanName, romanized: doc?.romanized ?? null, summary: localized.summary, levelNote: localized.levelNote,
    targetBelt: curriculum.target_belt, type: type(curriculum.content_type), thumbnailUrl: studentImageUrl(curriculum.thumbnail_url), media: resolveLessonMedia(curriculum.video_url),
    position: positiveInt(curriculum.sort_order), durationSeconds: positiveInt(curriculum.duration_seconds), tags: Array.isArray(doc?.tags) ? doc.tags.filter((tag: unknown) => typeof tag === 'string') : [],
    sectionCount: localized.sections.length, translated: localized.translated, sections: localized.sections, sources: sources.success ? sources.data : [], languages,
  };
}
