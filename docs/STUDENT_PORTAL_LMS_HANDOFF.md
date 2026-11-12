# LMS handoff: student portal

Reply to "Student Portal LMS: Database and System Design" (12 Nov 2026,
`docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md`). The admin side of all five
phases is built: the database tables and functions, the staff screens
(E-Learning page → **Coaching** tab), the reminder job and the feeds below.

> **Status: live since 12 Nov 2026.** Three migrations are applied to the
> shared database (`20261112130356_lms_learning_records`,
> `20261112130410_lms_tasks_and_rewards`,
> `20261112130425_lms_activity_and_reminders`). Every function below exists
> now; the academy has not created forms, assignments or challenges yet, so
> the feeds start empty.

Paste-ready schemas: `docs/student-portal/lms-contract.example.ts.txt` (feeds,
inbox topics, activity payloads) and the updated
`docs/student-portal/library-v2-contract.example.ts.txt`. Both are tested
against real output of the functions (`tests/lms-database.test.mjs`,
`tests/library-v2-handoff.test.mjs`). Neither uses `.strict()`.

## 1. Decisions on the open questions

| Question | Decision |
| --- | --- |
| Who creates assignments and challenges | Coaches and above (Coach, Head Coach, Admin, Root). Assistant coaches can view. Every write is checked again in SQL. |
| Targets in the first release | Yes: everyone, belts, branches, classes and single students, in any mix. |
| Video retention | 90 days after the review (`delete_video_after`). Written feedback is kept. |
| Guardian consent | In the portal at the first upload (your screen, `student_portal_video_consent`). Staff can also record consent given on paper. |
| Belt Exam Ready | A coach signs it off (achievement rule `manual`, once per belt). Never automatic. |
| Step clips | Both: `{start, end}` within the section video, or `{src}` for its own file. |
| Reminder job | Inside the admin portal's existing notifications job (`/api/jobs/notifications`, every minute). pg_cron is not needed. |
| Daily practice reminder | Off until the student picks a time. |
| Guardians seeing points | Points and achievements belong to the student record, so the family account (the student's login) sees them. Nobody else does. |
| Real rewards for points | Points are a personal record only for now. |

## 2. Release order

1. Done: the three migrations were applied on 12 Nov 2026. The admin portal
   release with the Coaching screens and the reminder job follows; until it is
   deployed no reminders are sent and staff cannot create LMS content yet.
2. Your release adopts the feeds and writes below. Nothing you have today changes
   until you call the new functions: `portal_calendar_inbox`, belt-tests-v1 and
   library-v2 keep their current shapes (new fields are additive).
3. When your service worker accepts `sourceType: "lms"` pushes, tell us; an admin
   switches on **Coaching → Attention → Student phone alerts for LMS notices**
   (`academy_profile.student_lms_push_enabled`). Until then LMS notices reach the
   new inbox only.

## 3. Changes to what you already read

### Practice logs: the belt rule is fixed

`student_portal_record_event` now treats `All`, `All Belts`, `All Levels` and
`Beginner` in any case or spacing as open to every belt, exactly like
`studentLessonEligible`. A lesson marked `all belts` no longer rejects practice
logs. Nothing else in the `lesson`, `workout`, `template` and `stat` kinds
changed, and the function still returns the stored event row.

### belt-tests-v1 curriculum items (additive)

```json
{ "title": "Front kicks", "libraryAssetId": 12, "practiceTarget": { "reps": 50, "timesPerWeek": 3 }, "formId": null }
```

`practiceTarget` (`reps`, `timesPerWeek`, `minutes`, each optional) or `null`;
`formId` is a published form (forms-v1) or `null`. Your belt-tests schema
already strips unknown keys, so this is safe before you use it.

### library-v2 (additive)

- **`formId`** on every lesson summary and lesson: the registered poomsae form
  behind the lesson (forms-v1), or `null`.
- **New section type `technique-steps`** (the Roundhouse Kick example). Sample:
  `docs/student-portal/library-v2-samples/lesson-roundhouse-technique-steps-en.json`.

  ```json
  { "id": "how-to", "type": "technique-steps", "title": "Step by step", "video": "https://www.youtube.com/watch?v=VIDEO_ID",
    "items": [ { "id": "chamber", "title": "Chamber position", "body": "Lift the knee to hip height.",
      "clip": { "start": 12.5, "end": 18 }, "mistakes": [ { "mistake": "Knee too low", "correction": "Lift the knee first" } ],
      "checklist": [ "Knee at hip height", "Supporting foot flat", "Guard up" ] } ] }
  ```

  `clip` is `{start, end}` in seconds within `video`, `{src}` (its own https
  file), or `null`. Step ids are fixed once published: checklist ticks are
  stored against them.
- **Poomsae diagram movements.** A `diagram` section may add `video` and
  `movements`: `movements[n]` is `{clip, mistakes}` for movement *n*
  (`data.steps[n]`, and item *n* of the lesson's `steps` section). We kept
  geometry in `data` and put the per-movement notes beside it, so the
  mistakes can be translated (`data` is a fixed key).
- **Translations.** Add `clip`, `video`, `start`, `end` and `src` to your
  `FIXED_KEYS` (ours: `id, type, style, tone, url, kind, data, clip, video, start, end, src`).
  Khmer and Chinese may change titles, bodies, mistakes and checklist lines only.
- **Slow motion** is the player's speed control (YouTube and academy MP4 support it;
  Google Drive embeds do not).

## 4. Feeds (server only)

Call with the service role from your server, passing the signed-in student's id
after your usual session and link checks. Each returns versioned JSON, or
`NULL` when the student does not exist. They refuse any other caller
(`Server only`).

| Function | Contract | Returns |
| --- | --- | --- |
| `portal_student_forms(p_student)` | forms-v1 | Published forms for the student's belt and below (form belt and lesson both open to the belt), each with progress: `learning`, `practising`, `ready_for_review`, `mastered` (only a coach sets mastered), practice count and seconds, best quiz %, review note. `isCurrentBelt` marks the forms of the current belt. |
| `portal_student_quiz(p_student, p_scope, p_scope_ref)` | quiz-v1 | Up to 100 published questions for a form, lesson, belt (current, lower or next) or terminology set. Includes the answers: quizzes are scored on the device and the score is self-reported. An unavailable scope returns `questions: []`. |
| `portal_student_learning(p_student)` | learning-state-v1 | Active goals (and those closed in the last 30 days), the coach's published plans for this and next week, checklist ticks, the latest self-check per subject (90 days), best quiz score per scope. `weekStart` is this Monday (Asia/Phnom_Penh). |
| `portal_student_tasks(p_student)` | tasks-v1 | Assignments given to the student (published, or closed in the last 30 days) with `status`, `progress` and the last submission; challenges for the student (running, starting within 7 days or ended within 14) with `progress` and `completedAt`. |
| `portal_student_submissions(p_student)` | submissions-v1 | Video consent and the last 100 submissions with the reviews coaches made visible (grade, rubric, feedback, timed notes `moments`, coach display name). |
| `portal_student_achievements(p_student)` | achievements-v1 | Active catalogue, earned awards (`seenAt` null = not cheered yet; `signedOff` = coach award) and the personal points total with the last 20 entries. Never ranked. |

Titles, instructions, descriptions and quiz text are English with
`translations: {"km": {...}, "zh": {...}}` overlays that fall back to English
field by field (quiz `choices` translate by index).

## 5. Writes

### Activity: `student_portal_record_event(p_actor, p_student, p_request, p_kind, p_payload)`

Same function, same request-key rule (a retry with the same key and payload
returns the first result; a different payload is `Request key reused`). Seven
new kinds, each updating its table in the same transaction:

| Kind | Payload | Effect | Refused when |
| --- | --- | --- | --- |
| `step_check` | `{lessonId, stepId, checked: [0, 2]}` | Replaces the ticks of that step (`student_step_checks`). | Lesson not open to the belt; step id not in the published `technique-steps`; index outside 0–49. |
| `self_assessment` | `{subjectType: lesson\|step\|form\|movement, subjectRef, rating: 1-4, note?}` | Adds a self-check. `subjectRef`: `"12"`, `"12:chamber"`, a form id, `"<form id>:7"`. Rating 1 is "still learning". Never changes a coach grade. | Subject not visible; movement outside 1–movement count; 200 a day. |
| `quiz_attempt` | `{scope, scopeRef, score, total, missed: [questionId]}` | Adds an attempt; for a form, raises `best_quiz_percent`. | Scope not allowed; score > total; total > 200. |
| `form_practice` | `{formId, mode: guided\|free, movements, durationSeconds}` | +1 practice, adds seconds, last practised; `learning` becomes `practising`. | Form not visible; duration > 7200 s. |
| `form_ready` | `{formId}` | Status `ready_for_review`; it appears in the coaches' review queue and staff get a notice. | Already mastered. |
| `assignment_progress` | `{assignmentId, reps}` | Adds reps and one session to a practice assignment; done (with its points) once the target is reached. | Not the student's published practice assignment, or already handed in. |
| `goal` | `{kind, target, subjectRef?, title?, endsOn?}` or `{goalId, status: done\|dropped}` | Sets a goal (a new weekly goal replaces the active one of the same kind), or closes a goal the student set. | Coach goals cannot be closed by the student; weekly days 1–7, minutes 5–5000; 30 active goals. |

After `lesson`, `workout`, `quiz_attempt`, `form_practice` and
`assignment_progress`, the same transaction runs
`student_portal_evaluate_rewards(p_student)`: challenge progress, practice and
quiz assignments, achievements, points and achievement notices. It is safe to
run any number of times. Practice days (streaks) are days with `lesson`,
`workout`, `form_practice` or `quiz_attempt` activity in Asia/Phnom_Penh.

### Video consent: `student_portal_video_consent(p_actor, p_student, p_payload)`

`{agree: true, guardianName, relationship: parent|guardian|self}` records
consent (`self` only for students aged 18 or over); `{agree: false}` withdraws
it. Returns `{studentId, consented, guardianName, relationship, consentedAt}`.
Ask before the first upload; submissions-v1 tells you whether consent exists.

### Submissions

1. **Start**: `student_portal_start_submission(p_actor, p_student, p_request, p_payload)`
   - `{kind: "video", assignmentId?, subjectType?, subjectRef?, mimeType, bytes, videoSeconds?}`:
     needs active consent; MP4, WebM or MOV; up to 200 MB and 180 s; 10 videos a
     day. Returns `{submission, bucket: "student-submissions", uploadPath}`.
     Without an assignment, `subjectType` (`lesson` or `form`) and `subjectRef`
     send a video for feedback.
   - `{kind: "text", assignmentId, textAnswer}` (written) or
     `{kind: "practice", assignmentId}` (practice marked done) are submitted at once.
   - Assignment kinds: `video`/`form` take a video, `written` takes text,
     `practice` takes practice or a video, `quiz` completes from quiz attempts.
2. **Upload** (video): from your server,
   `db.storage.from(bucket).createSignedUploadUrl(uploadPath)`; the browser uploads
   with `uploadToSignedUrl(uploadPath, token, file)`. The bucket is private; only
   the two portals' servers can sign.
3. **Finish**: `student_portal_finish_submission(p_actor, p_student, p_submission, {videoSeconds?})`
   checks the file is in storage and matches the started type and size, then
   marks it `submitted`. Finishing more than 2 hours after starting is refused
   (start again); abandoned uploads are deleted after a day.
4. **Withdraw** (before review): `student_portal_withdraw_submission(p_actor, p_student, p_submission)`.
5. **Playback**: read `video_path` from `student_submissions` for that id and
   student, then `createSignedUrl(video_path, 600)` (10 minutes).

Coach reviews set `reviewed` (accepted) or `returned` (try again: the
assignment opens again). Reviews may be hidden from the student; submissions-v1
never includes those.

### Seen awards: `student_portal_mark_achievements_seen(p_actor, p_student, [{code, period}])`

Cheer once for each award with `seenAt: null`, then mark them seen.

## 6. Notices and reminders

### Inbox: `portal_student_inbox(p_user, p_student, p_action, p_id, p_before, p_before_id)`

Same arguments and actions as `portal_calendar_inbox` (`list`, `read`,
`dismiss`, `mark-all`; 51 rows for paging), returning
`{contractVersion: "notices-v2", rows, unreadCount}`. Rows are academy events
(same rules as today) plus LMS notices from the last 90 days, each with:

- `source_type: "lms"`, `topic` (below), `title` and `body` in the account's
  language (`student_portal_preferences.language`), English otherwise.
- `source_id`: the related record (assignment, form, submission, class
  session, test day, announcement) when there is one, otherwise the notice id;
  `source_revision: 1`; `subject_ref` holds the raw reference.

`portal_calendar_inbox` is unchanged, so your current release keeps working.
Switch to `portal_student_inbox` when you add `"lms"` to
`NOTICE_SOURCE_TYPES`.

| Topic | Sent when | Timing (Asia/Phnom_Penh) |
| --- | --- | --- |
| `class_reminder` | A dated class on the student's roster | `class_reminder_hours` before (default 2; 0 = off) |
| `exam_reminder` | A published test day the student is registered for, or eligible for at the next belt | 14, 3 and 1 days before, from 08:00 |
| `assignment_due` | An open assignment not yet handed in | 48 h and 12 h before the due time |
| `practice_reminder` | The student's chosen days, unless they already practised | At `practice_reminder_time` (off until set), within 3 hours |
| `streak_reminder` | A streak of 3+ days and nothing logged today | From 19:00 |
| `new_material` | Lessons published for the student's belt since the last digest | One digest a day from 17:00 |
| `feedback` (+ `form_review`, `submission_review`) | A coach review is visible, or a form is reviewed | At once |
| `missed_class` | Marked Absent at yesterday's dated class | From 08:00 |
| `achievement` | An award is written | At once |
| `announcement` | A staff message to everyone, belts, branches, classes or students | At send |

Every notice has a per-account `source_key`, so a rerun never sends twice.

### Settings

`muted_categories` accepts `events` plus `class_reminder`, `exam_reminder`,
`assignment_due`, `practice_reminder`, `streak_reminder`, `new_material`,
`feedback`, `missed_class`, `achievement`, `announcement` (your schema already
keeps unknown categories). `portal_calendar_preferences` takes three optional
keys; a payload without them keeps the saved values:

| Key | Column | Values |
| --- | --- | --- |
| `practiceReminderTime` | `practice_reminder_time` | `"HH:MM"` or `null` (off) |
| `practiceDays` | `practice_days` | `[1..7]` (1 = Monday) or `null` (every day) |
| `classReminderHours` | `class_reminder_hours` | 0–24 (0 = off) |

### Phone alerts

LMS pushes carry references only:
`{"sourceType": "lms", "topic": "assignment_due", "sourceId": "<uuid>", "noticeId": "<uuid>", "language": "kh"}`.
Show your own generic lock-screen text, never a name or feedback. They are sent
only after the academy switches them on (section 2), within quiet hours and
mutes as today.

## 7. What should I practise today

No new function: compute it from belt-tests-v1 (with `practiceTarget` and
`formId`), learning-state-v1 (plans first, self-checks, quiz bests), tasks-v1
(due within 3 days, challenges ending), forms-v1, your practice logs and coach
grades (`student_physical_evaluations`). Coaches see the flagged items
("still learning" ×3, or a quiz failed twice within 14 days) in
Coaching → Attention (`coach_attention_items`).

## 8. Safety

- Every new table has row level security and no client policy. Your server
  passes the signed-in account and student; the functions re-check the account,
  the one-to-one student link, the belt and the request key.
- Self-reported records (self-checks, ticks, quiz scores, practice) never change
  coach grades, exam scores or mastered status.
- Points, achievements, streaks and form progress are never compared between
  students.
- Staff video playback is logged (`audit_logs`, `LMS_VIDEO_VIEW`).

## 9. Your checklist

- [ ] Add `clip`, `video`, `start`, `end`, `src` to `FIXED_KEYS`; render `technique-steps` (clip, mistakes, checklist ticks → `step_check`).
- [ ] Use `formId` and `movements` in the library and floor plan.
- [ ] Read forms-v1, quiz-v1, learning-state-v1, tasks-v1, submissions-v1, achievements-v1.
- [ ] Record the seven activity kinds; save the weekly goal with `goal` instead of on the phone.
- [ ] Consent, upload, finish and playback for videos.
- [ ] Move the inbox to `portal_student_inbox`; add `"lms"` and the topics; add the new categories and reminder settings to Settings.
- [ ] Accept `sourceType: "lms"` in `public/sw.js`, then ask us to switch phone alerts on.
