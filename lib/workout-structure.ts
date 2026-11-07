import { z } from 'zod';

export const workoutStructureSchema = z.object({
  routineType: z.string().trim().min(1).max(100),
  prepareSeconds: z.number().int().min(0).max(300),
  workSeconds: z.number().int().min(1).max(3600),
  restSeconds: z.number().int().min(0).max(1800),
  rounds: z.number().int().min(1).max(20),
  exercises: z.array(z.string().trim().min(1).max(160)).min(1, 'Add at least one exercise before saving.').max(50),
}).strict().superRefine((value, context) => {
  if (workoutStructureSeconds(value) > 43200) context.addIssue({ code: 'custom', message: 'A workout cannot exceed 12 hours.' });
});

export type WorkoutStructure = z.infer<typeof workoutStructureSchema>;

/** A round is one full sequence, with rest between intervals but not after the last. */
export function workoutStructureSeconds(value: Pick<WorkoutStructure, 'prepareSeconds' | 'workSeconds' | 'restSeconds' | 'rounds' | 'exercises'>) {
  const intervals = value.rounds * value.exercises.length;
  return value.prepareSeconds + intervals * value.workSeconds + Math.max(0, intervals - 1) * value.restSeconds;
}

const templateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().max(10000),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Elite']),
  creator: z.string().trim().min(1).max(100),
  structure: workoutStructureSchema,
  duration: z.number().optional(),
}).strict();

export function validateWorkoutTemplate(input: unknown) {
  const result = templateSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Review the workout fields before saving.');
  return { ...result.data, duration: Math.max(1, Math.ceil(workoutStructureSeconds(result.data.structure) / 60)) };
}
