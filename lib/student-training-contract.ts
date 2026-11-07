import { z } from 'zod';

const timestamp = z.string().datetime({ offset: true });
export const trainingAssignmentDataSchema = z.object({
  studentId: z.string().min(1).max(50),
  plans: z.array(z.object({
    id: z.string().uuid(), templateId: z.string().uuid().nullable(), title: z.string().min(1).max(255),
    active: z.boolean(), createdAt: timestamp, endedAt: timestamp.nullable(), endReason: z.string().nullable(),
  })).max(50),
  templates: z.array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(255), durationMins: z.number().int().nullable(), assignable: z.boolean() })).max(50),
  canManage: z.boolean(), hasMorePlans: z.boolean(), hasMoreTemplates: z.boolean(),
});
export type TrainingAssignmentData = z.infer<typeof trainingAssignmentDataSchema>;
