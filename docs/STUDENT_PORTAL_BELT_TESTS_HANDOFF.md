# Student Portal: belt tests (contract `belt-tests-v1`)

From the admin portal team, 2026-11-07. Paste-ready brief for the student portal developers.

## What the academy now runs

- **Color belts** (White → Yellow → Green → Blue → Brown → Red) are tested and **scored by the academy**. Each belt has a published syllabus with four sections (Physical Test, Taekwondo Skill Test, Poomsae Test, Acrobatic & Tricking Test), weighted to 100%. Coaches score every item 0–10; the result is Distinction, Pass, Retest or Not yet.
- **Black belts** (1st and 2nd Poom/Dan) are tested at **Kukkiwon Cambodia**. The academy nominates students to the **Cambodia Taekwondo Federation (CTF)**, then records the Kukkiwon result and certificate. **There is no academy scoring** for these tests: students see the test date, location and test curriculum only.
- Coaches/head coaches **register** students (students do not self-register). Eligibility is computed by the database and is identical in both portals.

## How to read it

One server-side call with the service role. Do not read the belt-test tables directly (they are service-only) and do not compute eligibility yourselves.

```ts
const { data, error } = await adminSupabase.rpc('portal_student_belt_tests', { p_student: studentId });
// data: BeltTestsV1 | null   (null when the student does not exist or is archived)
```

Refresh the belt-test screen when it regains focus and every 60 seconds while it is open. Results appear only after the academy publishes them.

## Response shape

```ts
import { z } from 'zod';

const rule = z.object({
  key: z.enum(['current_belt', 'active', 'time_in_rank', 'classes', 'skill_average', 'lessons']),
  met: z.boolean(),
  current: z.union([z.string(), z.number()]).nullable(),
  required: z.union([z.string(), z.number()]).nullable(),
  since: z.string().optional(),          // ISO date the counting starts from (last promotion or registration)
  graded: z.number().optional(),         // skill_average only: skills graded so far
  total: z.number().optional(),          // skill_average only: skills for the belt
}).passthrough();

export const beltTestsV1 = z.object({
  contractVersion: z.literal('belt-tests-v1'),
  studentId: z.string(),
  currentBelt: z.string(),               // e.g. "White", "1st Poom/Dan"
  nextBelt: z.object({ name: z.string(), order: z.number(), track: z.enum(['color', 'kukkiwon']) }).nullable(),
  eligibility: z.object({
    status: z.enum(['eligible', 'not_yet']),
    syllabusId: z.string().uuid(), targetBelt: z.string(), track: z.enum(['color', 'kukkiwon']),
    evaluatedOn: z.string(), since: z.string(), rules: z.array(rule),
  }).nullable(),                          // null until the academy publishes a syllabus for the next belt
  curriculum: z.object({
    title: z.string(), version: z.number(), track: z.enum(['color', 'kukkiwon']),
    passMark: z.number().nullable(),       // null for Kukkiwon
    sections: z.array(z.object({
      kind: z.enum(['physical', 'skill', 'poomsae', 'acrobatics', 'custom']),
      title: z.string(),
      weight: z.number().nullable(),       // % of the overall score; null for Kukkiwon
      items: z.array(z.object({ title: z.string(), libraryAssetId: z.number().nullable() })),
    })),
  }).nullable(),
  upcoming: z.array(z.object({
    eventId: z.string().uuid(), title: z.string(), kind: z.enum(['color', 'kukkiwon']),
    date: z.string(), startTime: z.string().nullable(),     // "09:30", academy time
    location: z.string().nullable(), branchName: z.string().nullable(), // branchName null = all branches
    targetBelt: z.string(),
    registration: z.string().nullable(),   // null = not registered; otherwise a status below
  })),
  results: z.array(z.object({              // color tests only, after results are published
    eventId: z.string().uuid(), title: z.string(), date: z.string(), targetBelt: z.string(),
    overallPercent: z.number().nullable(),
    result: z.enum(['distinction', 'pass', 'retest', 'fail']),
    promoted: z.boolean(),
    sections: z.array(z.object({ kind: z.string(), title: z.string(), percent: z.number(), grade: z.enum(['A', 'B', 'C', 'D', 'F']), met: z.boolean() })),
    feedback: z.string().nullable(),
  })),
  kukkiwon: z.array(z.object({
    eventId: z.string().uuid(), title: z.string(), testDate: z.string(), location: z.string().nullable(), targetBelt: z.string(),
    poomOrDan: z.enum(['Poom', 'Dan']).nullable(),          // Poom under 15 on the test date, Dan from 15
    status: z.enum(['nominated', 'submitted', 'passed', 'failed', 'certified', 'promoted']),
    ctfSubmittedOn: z.string().nullable(),
    certificateNo: z.string().nullable(),  // only once certified
  })),
});
export type BeltTestsV1 = z.infer<typeof beltTestsV1>;
```

Numbers may arrive as JSON numbers; dates are `YYYY-MM-DD` in academy time (Asia/Phnom_Penh).

## Screens to build

1. **Next belt card**: `nextBelt.name`, and for Kukkiwon tracks a "Tested at Kukkiwon Cambodia" note.
2. **Eligibility checklist** (`eligibility.rules`). Suggested labels:
   - `current_belt`: Holds the previous belt
   - `active`: Active membership
   - `time_in_rank`: "{current} of {required} days since your last promotion"
   - `classes`: "{current} of {required} classes attended"
   - `skill_average`: "Coach skill average {current} (needs {required})" — progress on the 1–4 technique grades
   - `lessons`: "{current} of {required} syllabus lessons completed"
   Show "You're eligible" / "Not yet eligible" from `eligibility.status`. Do not offer a register button: say "Your coach registers you for the test day."
3. **Test curriculum** (`curriculum.sections[].items[]`): names only. For color tests show each section's weight and the pass mark. `libraryAssetId` lets you link to the lesson when that lesson is published in the learning library.
4. **Upcoming test days** (`upcoming`): date, time, location, branch; "Registered" when `registration` is not null.
5. **Results** (`results`): overall %, result (Distinction / Pass / Retest / Not yet), each section's % and grade, the coach's feedback, and "Promoted" once `promoted` is true.
6. **Kukkiwon timeline** (`kukkiwon`): Nominated → Submitted to CTF (`ctfSubmittedOn`) → Passed / Not passed → Certificate recorded (`certificateNo`) → Promoted. Show Poom or Dan.

## Replace the existing stubs

| Route | Change |
|---|---|
| `GET /api/student/exam-eligibility` | Return `eligibility` (plus `nextBelt`, `curriculum`). |
| `GET /api/student/exam-cohorts` | Return `upcoming` (and `results`, `kukkiwon` if you serve them here). |
| `POST /api/student/exam-register` | Keep disabled; respond that the coach registers students. |
| `GET /api/student/grading` | Keeps working. New columns on `grading_events`: `kind` (`color` / `kukkiwon`) and `syllabus_id`. Prefer `upcoming` from the RPC for test days created in Belt Tests. |
| `GET /api/student/readiness` | The readiness-policy tables are unused (0 rows). Switch the readiness view to `eligibility` from this RPC. |

## Privacy (already enforced by the RPC)

Students never receive item-level scores, examiner names, private notes, override reasons, other students' data, unpublished results, private draft test days, or cancelled test days.

## Status values you may see

`registration` / Kukkiwon `status`: `registered`, `scoring`, `finalized`, `promoted` (color); `nominated`, `submitted`, `passed`, `failed`, `certified`, `promoted` (Kukkiwon). Withdrawn candidates are omitted.

## Belt names

Belts use the names already stored everywhere: White, Yellow, Green, Blue, Brown, Red, 1st Poom/Dan, 2nd Poom/Dan, 3rd Poom/Dan, 4th Poom/Dan, 5th Dan, 6th Dan. Your `beltPathKey` already maps all of them.

## Activity entries

The academy adds `student_activity_events` (category `grading`) when a student is registered or withdrawn, results are published, a Kukkiwon result or certificate is recorded, and on promotion. Use them for notifications or a timeline if you show one.

## Availability

**Live since 2026-11-07** (admin migration `20261107095953_belt_test_system`). You can call `portal_student_belt_tests` now; it returns the shape above for every student. Until a head coach publishes a syllabus, `eligibility` and `curriculum` are `null`, and `upcoming`, `results` and `kukkiwon` are empty. The admin Belt Tests page (`/belt-tests`) ships with the next admin portal deployment.
