# Student Portal: belt test requests, test fees, ranking opt-out, lesson order

This is a paste-ready brief for the student portal team from the admin portal team, dated 2026-11-10. It extends `docs/STUDENT_PORTAL_BELT_TESTS_HANDOFF.md`. The contract stays `belt-tests-v1`. Every new field is optional and additive, so your current parser keeps working.

All of this landed with the admin migration `20261110062131_ranking_lesson_layout_belt_test_extras`, which is **live on the shared database since 2026-11-10**. The new columns and functions are available now. Requests and fees only appear once staff use them in the admin portal, so nothing changes for students until then.

## 1. Students can request a place on a belt test day

Head coaches and admins still decide who tests. Now an **eligible** student can ask for a place from the student portal. The request shows in the admin Belt Tests page, where a head coach or admin **approves** it (the student is registered) or **declines** it with a reason the student sees.

### New fields on `upcoming[]`

| Field | Type | Meaning |
|---|---|---|
| `registration` | string or null | Existing field. Can now also be `requested` (waiting for the coach) or `declined`. |
| `canRequest` | boolean | Show the **Request a place** button only when this is true. It is true when the student is eligible, has no request or registration yet (a request they cancelled doesn't count, but a coach withdrawal does), requests are open, there is a free place, and the test day is for their branch. |
| `requestsOpen` | boolean | False when the coach registers students directly, or once the request deadline has passed. |
| `requestDeadline` | string (date) or null | The last day to request. Requests close the day before the test. |
| `placesLeft` | number or null | Null means no limit. Pending requests hold a place. |
| `feeUsd` | number or null | The test fee. Null means no fee. |
| `feeStatus` | `unpaid`, `paid`, `waived` or null | Only present once the student is registered. |
| `declineReason` | string or null | Only present when `registration` is `declined`. |

Add these to your zod schema (`lib/belt-tests-contract.ts`, inside `upcoming`):

```ts
requestsOpen: z.boolean().optional(),
requestDeadline: z.string().nullable().optional(),
placesLeft: z.number().nullable().optional(),
canRequest: z.boolean().optional(),
feeUsd: z.number().nullable().optional(),
feeStatus: z.enum(["unpaid", "paid", "waived"]).nullable().optional(),
declineReason: z.string().nullable().optional(),
```

The `kukkiwon[]` list never contains requests, so its `status` enum does not change.

### New functions (service role only, called from your server after verifying the signed-in student)

Both follow the same identity rules as `student_portal_cancel_pending_order`. `p_actor` is the student's profile id, and it must be linked to `p_student`.

```sql
-- Request a place. p_request is a fresh UUID per attempt; reuse it when retrying the same attempt.
select public.student_portal_request_belt_test(p_actor uuid, p_student text, p_event uuid, p_request uuid);
-- → { "eventId": "…", "status": "requested" }   (repeating the same p_request returns the same result)

-- Cancel the student's own pending request. Safe to repeat.
select public.student_portal_cancel_belt_test_request(p_actor uuid, p_student text, p_event uuid);
-- → { "eventId": "…", "status": null }
```

Errors are `SQLSTATE 22023` and carry a readable message. Show the message to the student:

- **Event not available:** "This test day is not open"
- **Coach registers:** "Your coach registers students for this test day"
- **Deadline passed:** "Requests for this test day have closed"
- **Wrong branch:** "This test day is for another branch"
- **Not eligible:** "You are not yet eligible for this test"
- **No places left:** "This test day is full"
- **Already declined:** "Your coach declined this request. Talk to your coach before requesting again"
- **Withdrawn by the coach:** "You were withdrawn from this test day. Talk to your coach"
- **Already on the list:** "You are already on this test day"
- **Cancelling after approval:** "Ask your coach to change a registration"

Identity failures are `42501`.

### Screens

- **Request a place:** the test-day card shows this button when `canRequest` is true. Below it, show "Requests close on {requestDeadline}" and, when `placesLeft` is a number, "{placesLeft} places left".
- **Request pending:** when `registration` is `requested`, show "Waiting for your coach to approve" and a **Cancel request** button.
- **Request declined:** when `registration` is `declined`, show "Not approved this time" and the `declineReason`.
- **Registered states:** for `registered` and later states, keep "Registered". Add the fee line below.
- **Student portal register stub:** replace the `POST /api/student/exam-register` stub with a call to `student_portal_request_belt_test`. Add a cancel route that calls `student_portal_cancel_belt_test_request`.
- **Existing copy:** the line "Your coach registers you for the test day" is still right when `requestsOpen` is false.
- **Grading days list:** `app/api/student/grading/route.ts` sets `registered: day.registration != null`. Once students can request, that would show a pending or declined request as "registered". Treat only `registered` and the later states as registered. Its `grading_candidates.select("event_id")` lookup also returns `requested` and `declined` rows, so filter those by status too.

### Activity entries

New `student_activity_events` rows (category `grading`): "Requested a belt test", "Cancelled a belt test request", "Belt test request approved" and "Belt test request declined".

## 2. Test fees (shown, not paid online)

Each syllabus can carry a fee. The fee is copied onto each registration, and the office records it as **Paid** (method, date, reference) or **Waived**. Fees never block testing or promotion, and there is no online payment.

- **Before registering:** show `feeUsd` on the test-day card, for example "Test fee $25".
- **After registering:** show `feeStatus`: "Fee unpaid: pay at the academy", "Fee paid" or "Fee waived".

## 3. Ranking opt-out

`students.ranking_opt_out` (boolean, default false) now exists. Your `readLiveStandings` already honours it. The one-hour "column missing" fallback becomes dead code once the migration is live.

- **Students switch it themselves:** add a setting "Show me on the public leaderboards" (on by default):

  ```sql
  select public.student_portal_set_ranking_opt_out(p_actor uuid, p_student text, p_opt_out boolean);
  -- → { "studentId": "STU-…", "rankingOptOut": true }
  ```

- **Staff switch it too:** staff can change it from the student's profile in the admin portal. Every change is audited (`STUDENT_RANKING_OPT_OUT`, source `student` or `staff`).
- **Every board:** hide opted-out students on **every** board, both live standings and published season rankings. The admin ranking-draft review now warns when a draft includes an opted-out student.
- **Self view:** a student who opted out should still see their own position privately if you show one. Only the public listing hides them.

## 4. Lesson order and length

As you requested on 2026-11-07, item 5:

```sql
curriculum.sort_order       int null   -- 1–10000, position within the lesson's belt syllabus
curriculum.duration_seconds int null   -- 1–86400, video length
```

- **Who sets them:** staff set both in **Library → Lesson order**, belt by belt. Changes apply immediately, with no republishing.
- **learning-v1:** each lesson can include `position` (from `sort_order`) and `durationSeconds`. Both are null until staff set them. Your `publishedLessonSchema` is `.strict()`, so these fields stay **off** for now: the admin portal adds them only once its `LEARNING_V1_LAYOUT_FIELDS=on` setting is turned on. First add the two optional fields below to your schema and deploy. Then tell the admin team, and they switch the setting on.
- **Ordering:** order a belt's lessons by `position`, with nulls last and then by title. "Lesson 4 of 12" counts the published lessons for that belt.
- **Showing length:** show length as `m:ss` (or `h:mm:ss`) when `durationSeconds` is set.

Add to your lesson schema: `position: z.number().int().nullable().optional(), durationSeconds: z.number().int().nullable().optional()`.

## Privacy

Unchanged. The feed never includes other students' requests, item scores, examiner names, private notes, fee references or waiver reasons.
