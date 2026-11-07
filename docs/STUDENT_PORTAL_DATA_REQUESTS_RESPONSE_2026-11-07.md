# Admin Portal → Student Portal: reply to the data requests (2026-11-07)

Reply to `docs/admin-data-requests-2026-11-07.md` in the student portal. Everything below is in migration `supabase/migrations/20261107090148_student_portal_data_requests.sql`, **applied to the live database on 2026-11-07** (version 20261107090148). After applying: 12 belts, all 86 active students linked by `belt_id`, and the 7 new columns are live.

## 1. `belts` table: filled, with one naming change

The belt names match what every existing record already stores (86 students, 48 promotions, 81 lessons and the technique syllabus all use them), not the "White Belt" / "Black 1st Dan" form in the request:

| belt_order | belt_name | belt_type | color_hex |
|---|---|---|---|
| 1–6 | White, Yellow, Green, Blue, Brown, Red | color | as requested |
| 7–10 | 1st Poom/Dan, 2nd Poom/Dan, 3rd Poom/Dan, 4th Poom/Dan | black | #000000 |
| 11–12 | 5th Dan, 6th Dan | black | #000000 |

Your `beltPathKey` already maps all of these (for example "1st Poom/Dan" → black-1), and grading promotions write `belts.belt_name` into `students.current_belt`, so this keeps both portals on one spelling. `students.belt_id` is now kept in step with `current_belt` automatically.

## 2. Coach assessment score: added

`student_physical_evaluations.score numeric(3,1)`, 0–10, exactly as specified. Coaches enter it next to the letter grade (LMS testing tab and student directory). `updated_at` is set by the database on every save. `skill_name` values are the academy's technique names, not the five generic skills.

## 3. Grading days: added

`grading_events.published_at`, `branch_id`, `start_time`, `location` and `cancelled_at`, exactly as specified. New grading days start **private**; staff publish them from Operations → Exams and promotions, where they can also set branch, time and location, and cancel (cancellation is permanent and blocked once a promotion is recorded). There are 0 grading events today, so nothing visible changes when the column appears.

## 4. Branch opening hours: added

`branches.opening_hours jsonb`, array of at most 7 entries in your format. Staff edit them in Settings → Academy profile → Branch opening hours. The admin portal only writes short day names (`Mon`…`Sun`), `HH:MM`, and `closes` after `opens`.

## 5. Lesson order and length: not done yet

`sort_order` and `duration_seconds` are not added. They need authoring fields in the library editor, the publish step and the learning-v1 `position` field together; we will plan that with you.

## 6. Contract checks

A new admin test (`tests/student-portal-contract.test.mjs`) runs admin learning-v1 and shop-v1 output through your `published-catalog-contract.ts`. It found and the admin portal now fixes three cases your contract rejects (each would have failed a student's whole lesson page): lesson text over 20,000 characters, an `autoplay` parameter on a direct video source, and HTTPS links with a custom port. None exist in live data today.

Lesson thumbnails for YouTube videos use `img.youtube.com` / `i.ytimg.com`. `publishedImage` drops those hosts unless they are listed in `ACADEMY_PORTAL_IMAGE_HOSTS` on the student portal server.

## 7. Published lesson content

All 81 lessons students can see have an empty description, no guidance and no video: they are legacy rows that were never published through the new publish step. The text and steps exist in the admin library. Staff need to publish them (Library → Student library) before students see any lesson content.
