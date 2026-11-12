import { z } from 'zod';
import { libraryStudentProjection } from './library-student-projection';

const line = z.string().trim().max(2000);
const lines = z.array(line).max(100).default([]);
export const libraryLearningContentSchema = z.object({
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Elite']).optional(),
  repsSets: line.optional(),
  instructions: lines,
  prerequisites: lines,
  principles: lines,
  drillingMethods: lines,
  performance: lines,
  mistakes: z.array(z.object({ mistake: line, correction: line }).strict()).max(100).default([]),
  terminology: z.array(z.object({ korean: line, english: line, khmer: line }).strict()).max(100).default([]),
  studyGuide: z.array(z.object({ question: line, answer: line }).strict()).max(100).default([]),
  muscleTargets: z.array(z.object({ muscleId: z.number().int().positive(), role: z.enum(['Primary', 'Secondary']) }).strict()).max(100).default([]),
}).strict();
export type LibraryLearningContent = z.infer<typeof libraryLearningContentSchema>;

/**
 * Older lessons stored some guidance as plain text lines (for example a mistake
 * without a correction). They become the current object shape, so those lessons
 * can still be published.
 */
export function normalizeLegacyGuidance(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  if (Array.isArray(out.mistakes)) out.mistakes = out.mistakes.map(row => typeof row === 'string' ? { mistake: row, correction: '' } : row);
  if (Array.isArray(out.studyGuide)) out.studyGuide = out.studyGuide.map(row => typeof row === 'string' ? { question: row, answer: '' } : row);
  if (Array.isArray(out.terminology)) out.terminology = out.terminology.map(row => typeof row === 'string' ? { korean: '', english: row, khmer: '' } : row);
  return out;
}

/** Staff metadata is never forwarded wholesale to the student learning API. */
export function libraryPublicationProjection(asset: { description: string; video_url: string; library_type: string; target_level: string; tkd_category?: string | null; fitness_category?: string | null }) {
  const base = libraryStudentProjection(asset);
  const raw: Record<string, unknown> = normalizeLegacyGuidance(asset.description.trim().startsWith('{') ? JSON.parse(asset.description) : {});
  const category = typeof raw.actualCategory === 'string' ? raw.actualCategory.trim() : asset.fitness_category || asset.tkd_category || '';
  const type = asset.library_type === 'Fitness' ? 'Fitness' : asset.target_level === 'Dance' || category.startsWith('Dance:') ? 'Dance' : 'Taekwondo';
  const allowed = Object.fromEntries(Object.keys(libraryLearningContentSchema.shape).filter(key => key !== 'muscleTargets' && raw[key] !== undefined).map(key => [key, raw[key]]));
  const parsed = libraryLearningContentSchema.safeParse(allowed);
  if (!parsed.success) throw new Error('Review the lesson guidance: use text steps and complete vocabulary, correction and study-guide fields.');
  return { ...base, content_type: type, content_category: category.slice(0, 150), learning_content: parsed.data };
}

export const libraryCatalogItemSchema = z.object({
  id: z.number().int().positive(), title: z.string(), libraryType: z.string(), targetLevel: z.string(),
  revision: z.number().int().positive(), publishedRevision: z.number().int().nullable(),
  isPublished: z.boolean(), state: z.enum(['draft', 'published', 'changes', 'legacy']), updatedAt: z.string(),
});
export const libraryCatalogSchema = z.object({
  contractVersion: z.literal('academy-library-v1'), items: z.array(libraryCatalogItemSchema).max(100),
  hasMore: z.boolean(), offset: z.number().int().nonnegative(),
});
export type LibraryCatalogItem = z.infer<typeof libraryCatalogItemSchema>;

type LibraryRevisionFields = { studentCurriculumId?: number | null; publishedRevision?: number | null; revision?: number | null };

/** A lesson created under the publication workflow that has never been published. */
export function isPrivateLibraryDraft(video: LibraryRevisionFields) {
  return video.studentCurriculumId != null && video.publishedRevision == null;
}

/** Legacy visibility is checked by the server; explicit new private drafts cannot be graded. */
export function canMarkLibraryLessonComplete(video: LibraryRevisionFields) {
  return !isPrivateLibraryDraft(video);
}

/**
 * Publication state that can be derived from the staff library row alone.
 * 'changes' means the saved draft differs from what students last received
 * (including a lesson that was later unpublished); 'legacy' rows predate the
 * publication workflow and carry no reliable revision history.
 */
export function libraryLessonState(video: LibraryRevisionFields): 'draft' | 'changes' | 'current' | 'legacy' {
  if (video.studentCurriculumId == null || video.publishedRevision === 0) return 'legacy';
  if (video.publishedRevision == null) return 'draft';
  return (video.revision ?? video.publishedRevision) > video.publishedRevision ? 'changes' : 'current';
}
