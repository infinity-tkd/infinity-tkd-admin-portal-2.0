import { z } from 'zod';

/**
 * belt-tests-v1: what public.portal_student_belt_tests returns to the student
 * portal. Kept identical to docs/STUDENT_PORTAL_BELT_TESTS_HANDOFF.md; a
 * database test parses real RPC output with it so the two cannot drift.
 */
const rule = z.object({
  key: z.enum(['current_belt', 'active', 'time_in_rank', 'classes', 'skill_average', 'lessons']),
  met: z.boolean(),
  current: z.union([z.string(), z.number()]).nullable(),
  required: z.union([z.string(), z.number()]).nullable(),
  since: z.string().optional(), graded: z.number().optional(), total: z.number().optional(),
}).passthrough();

export const beltTestsV1 = z.object({
  contractVersion: z.literal('belt-tests-v1'),
  studentId: z.string(),
  currentBelt: z.string(),
  nextBelt: z.object({ name: z.string(), order: z.number(), track: z.enum(['color', 'kukkiwon']) }).nullable(),
  eligibility: z.object({
    status: z.enum(['eligible', 'not_yet']), syllabusId: z.string().uuid(), targetBelt: z.string(), track: z.enum(['color', 'kukkiwon']),
    evaluatedOn: z.string(), since: z.string(), rules: z.array(rule),
  }).nullable(),
  curriculum: z.object({
    title: z.string(), version: z.number(), track: z.enum(['color', 'kukkiwon']), passMark: z.number().nullable(),
    sections: z.array(z.object({
      kind: z.enum(['physical', 'skill', 'poomsae', 'acrobatics', 'custom']), title: z.string(), weight: z.number().nullable(),
      items: z.array(z.object({ title: z.string(), libraryAssetId: z.number().nullable() })),
    })),
  }).nullable(),
  upcoming: z.array(z.object({
    eventId: z.string().uuid(), title: z.string(), kind: z.enum(['color', 'kukkiwon']), date: z.string(), startTime: z.string().nullable(),
    location: z.string().nullable(), branchName: z.string().nullable(), targetBelt: z.string(), registration: z.string().nullable(),
  })),
  results: z.array(z.object({
    eventId: z.string().uuid(), title: z.string(), date: z.string(), targetBelt: z.string(), overallPercent: z.number().nullable(),
    result: z.enum(['distinction', 'pass', 'retest', 'fail']), promoted: z.boolean(),
    sections: z.array(z.object({ kind: z.string(), title: z.string(), percent: z.number(), grade: z.enum(['A', 'B', 'C', 'D', 'F']), met: z.boolean() })),
    feedback: z.string().nullable(),
  })),
  kukkiwon: z.array(z.object({
    eventId: z.string().uuid(), title: z.string(), testDate: z.string(), location: z.string().nullable(), targetBelt: z.string(),
    poomOrDan: z.enum(['Poom', 'Dan']).nullable(), status: z.enum(['nominated', 'submitted', 'passed', 'failed', 'certified', 'promoted']),
    ctfSubmittedOn: z.string().nullable(), certificateNo: z.string().nullable(),
  })),
});
export type BeltTestsV1 = z.infer<typeof beltTestsV1>;
