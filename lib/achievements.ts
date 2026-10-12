import { z } from 'zod';
import { academyDate, isCalendarDate } from './dates';

export const achievementEntrySchema = z.object({
  id: z.number().int().positive().max(2147483647).optional(),
  eventName: z.string().trim().min(1).max(200),
  date: z.string().refine(value => isCalendarDate(value) && value >= '1900-01-01' && value <= academyDate(), 'Use a valid event date that is not in the future.'),
  category: z.string().trim().min(1).max(150),
  division: z.string().trim().min(1).max(150),
  medalRank: z.enum(['Gold', 'Silver', 'Bronze', 'Participation', 'Fourth Place']),
  notes: z.string().max(5000).optional(),
  ageDivision: z.string().max(150).optional(),
  beltDivision: z.string().max(150).optional(),
}).strict();

export const achievementBatchSchema = z.object({
  studentId: z.string().min(1).max(50),
  entries: z.array(achievementEntrySchema).max(100),
  deletedIds: z.array(z.number().int().positive().max(2147483647)).max(100).default([]),
  requestKey: z.string().uuid(),
}).strict().superRefine((value, context) => {
  const ids = value.entries.flatMap(entry => entry.id === undefined ? [] : [entry.id]);
  if (value.entries.length + value.deletedIds.length === 0) context.addIssue({ code: 'custom', message: 'There are no achievement changes to save.' });
  if (new Set(ids).size !== ids.length || new Set(value.deletedIds).size !== value.deletedIds.length || ids.some(id => value.deletedIds.includes(id))) {
    context.addIssue({ code: 'custom', message: 'Each achievement can be changed only once per save.' });
  }
});

export type AchievementEntry = z.infer<typeof achievementEntrySchema>;
