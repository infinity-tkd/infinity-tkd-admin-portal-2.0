import { z } from 'zod';
import { validateWorkoutTemplate } from './workout-structure';

export const workoutCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['SAVE_DRAFT', 'PUBLISH']), id: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), requestKey: z.string().uuid(), template: z.unknown(), reason: z.string().trim().max(500).default('') }).strict(),
  z.object({ action: z.literal('ARCHIVE'), id: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), requestKey: z.string().uuid() }).strict(),
]);
export function workoutDraftPayload(input: unknown) {
  const template = validateWorkoutTemplate(input);
  return { title: template.title, description: template.description, difficulty: template.difficulty, duration_mins: template.duration, creator_name: template.creator, structure: template.structure };
}
export function managedWorkout(row: Record<string, unknown>, publishedRevision: number | null, revision: number) {
  return { id: row.id, title: row.title, description: row.description || '', difficulty: row.difficulty,
    duration: row.duration_mins, creator: row.creator_name, structure: row.structure,
    revision, publishedRevision, publicationState: publishedRevision === null ? 'draft' : publishedRevision === revision ? 'published' : 'changes' };
}

