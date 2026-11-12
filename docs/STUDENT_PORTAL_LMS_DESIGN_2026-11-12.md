# Student Portal LMS: Database and System Design

Nov 12, 2026 · @Moni

The student portal already runs the core of the LMS. To reach the six goals below, the admin portal needs to add seven data areas: a belt syllabus, technique steps, a Poomsae module, assignments and challenges, achievements, reminders and learning goals. This doc lists each table, contract and job, in build order.

## Goals and design rules

Every feature in this doc serves one of six goals:

1. Help students learn Taekwondo techniques faster.
2. Help students practise correctly at home.
3. Track each student's progress and skill development.
4. Prepare students for belt promotion exams.
5. Build discipline, consistency and motivation.
6. Make students confident and prepared before class.

Seven rules apply to every table and screen:

- **Belt first.** Lessons, forms, tasks and recommendations are filtered and ordered by the student's current belt and the next belt's requirements.
- **Personal improvement, not competition.** Rewards compare a student with their own past. No practice leaderboards; the existing medal standings stay separate and keep their opt-out.
- **The academy is the source of truth.** Coaches and staff own grades, requirements, exam dates and feedback. Anything a student reports (practice logs, self-checks, self-assessments) is labelled as self-reported and never changes an official record.
- **One content model, three languages.** English is the base text; Khmer and Chinese are overlays that fall back to English field by field, as library-v2 already does.
- **Works without the admin portal online.** The admin portal writes published rows to the shared database; the student portal reads them directly or through a versioned contract. Neither portal needs the other running.
- **Safe for children.** Records are private to the student, their guardian account and their coaches. Video submissions need consent and are deleted on a schedule.
- **Small, repeat-safe writes.** Students write only through one server function with a request key, so a retry on a bad connection never counts twice.

## What students have today

The screens for most LMS basics are live, but almost every learning table is still empty, so students see little yet. Counts are from the shared database on 12 Nov 2026; only 1 of 77 active students has a portal login so far.

| Area | What the student sees | Data it reads | Live data |
| --- | --- | --- | --- |
| Learning library (library-v2) | Category tiles, translated lessons with sections, poomsae floor plan, flashcards from Korean terms | `curriculum`, `library_published_content`, `library_categories`, `belts`, `portal_student_library_page()` | 81 published lessons, 9 categories, 24 translated; 91 drafts |
| Lesson practice | Practice timer, repetition log, mark as self-completed | `student_portal_events` (kind `lesson`), `student_portal_progress` | 0 logs |
| Training streak | Current and longest streak, week strip, 5-week heatmap | Practice logs (`lesson`, `workout` events) | 0 logs |
| Weekly goal | Target days per week | Stored on the student's phone only | Not in the database |
| Practice level and badges | XP level and 5 badges | Worked out in the browser from practice records | Not stored |
| Games | Call-out drill (logs reps), Know your terms quiz | Practice logs; quiz best score on the phone only | Not stored |
| Training & assessments | Coach grades on the 4-level scale, measurements, routines, workout history | `student_physical_evaluations`, `student_body_compositions`, `student_training_plans`, `workout_templates` | 3 grades (old labels), 1 measurement, 0 plans |
| Belt journey | Next belt, eligibility rules, next belt's syllabus linked to lessons, test days, results, certificates | `portal_student_belt_tests()` over `belt_test_syllabi/sections/items`, `grading_events`, `grading_candidates`; `belt_histories` | 0 syllabi, 0 exams; 48 promotions |
| Schedule | Weekly timetable, next class, dated sessions | `class_sessions`, `class_enrollments`, `class_occurrences` + roster | 10 classes, 0 dated sessions |
| Notices | Inbox and phone push for academy events and belt tests | `portal_notifications`, `portal_notification_preferences`, `portal_push_subscriptions` | 420 notices |
| Achievements | Competition results and 9 milestones | `achievements` | 55 results |

Three learning records live only on the phone today: the weekly goal, the quiz best score and the level-up state. They do not follow the student to another device, and coaches cannot see them.

## Feature map

The 32 rows below group the requested features: 5 are live, 12 are partly there (mostly a screen waiting for data), and 15 are new. Letters (A–G) point to the table groups under New database tables.

### Dashboard

| Feature | Today | What it needs |
| --- | --- | --- |
| My Training Overview | Partial: practice sessions and attendance are counted on separate pages | Nothing new: the portal adds attendance marks and practice sessions together |
| Current Belt Level | Live | Nothing (`students.current_belt`) |
| Next Belt Goal | Partial: screen ready, no syllabus published | A published syllabus for every belt (A) |
| Learning Progress | Partial: % of all lessons self-completed | Syllabus items linked to lessons, so progress = % of the next belt's items done (A) |
| Weekly Training Goal | Partial: kept on the phone only | `student_goals` (B) |
| Upcoming Classes | Partial: weekly timetable only | Dated `class_occurrences` with their roster (tables exist, still empty) |
| Upcoming Exams | Partial: screen ready, 0 exams | Published `grading_events` per belt (table exists, still empty) |
| Pending Tasks | New | Assignments and challenges with each student's status (E) |
| Daily Training Recommendation | New | The skill signals in What should I practise today |
| Achievement Summary | Partial: competition milestones and practice badges worked out in the browser | Achievement catalogue and awards (F) |
| Instructor Announcements | Live for academy events and belt tests | A general `announcement` notice type for any staff message |
| Training Streak | Live | Nothing |

### Technique learning (the Roundhouse Kick example)

| Feature | Today | What it needs |
| --- | --- | --- |
| 8 steps: stance, chamber, pivot, hip turn, extension, contact, retraction, return | Partial: lessons have text-only `steps` sections | A `technique-steps` section type (Contracts) |
| A video for each step | New | A clip per step: one lesson video plus start and end seconds, or its own clip |
| Common mistakes for each step | Partial: mistakes are listed per lesson, not per step | Mistakes inside each step (Contracts) |
| Practice checklist | New | A checklist per step and the student's ticks (`step_check` activity) |

### Poomsae module

| Feature | Today | What it needs |
| --- | --- | --- |
| Poomsae library, forms by belt | Partial: Poomsae category and floor plans exist; the belt link is missing | Form registry linking form, lesson and belt (C) |
| Step-by-step, movement counter, sequence and direction guide, practice mode | Live: the floor plan steps through every movement with stance, direction, techniques and auto-play | Publish the 8 Taegeuk drafts; their floor plans are already written |
| Video demonstration and slow motion | New | A clip per movement; slow motion is the video player's speed control (0.5×, 0.25×) |
| Poomsae quiz | New | Question bank and attempts (C) |
| Self-assessment | New | Self-assessments (C) |
| Video submission, instructor assessment and feedback | New | Submissions, reviews and private storage (D) |
| Poomsae progress and completion | New | Form progress: learning, practising, ready for review, mastered (only a coach sets mastered) (C) |
| Common mistakes | Live as lesson sections | Mistakes per movement (Contracts) |

### Assignments and challenges

| Feature | Today | What it needs |
| --- | --- | --- |
| Instructor, practical, written and video assignments | New | Assignments with targets (E) and submissions (D) |
| Deadlines, submission history, instructor feedback | New | Due dates, submissions and reviews (D, E); deadline reminders |
| Weekly challenges, completion tracking, rewards | New | Challenges with progress (E), points and badges (F) |

### Motivation

| Feature | Today | What it needs |
| --- | --- | --- |
| Achievements (first 10 lessons, 7-day streak, Poomsae beginner, kicking master, 100 home sessions, belt exam ready, perfect attendance month) | Partial: 5 practice badges and 9 competition milestones, no shared catalogue | Achievement catalogue with rules and awards (F) |
| Points | New | A personal points ledger, never ranked between students (F) |

### Reminders and the personal learning path

| Feature | Today | What it needs |
| --- | --- | --- |
| 10 reminder types with preferences | Partial: inbox, phone push, per-category mute and quiet hours exist for events and belt tests | New categories and a scheduler (Notifications and reminders) |
| Learning path, skill gaps, weaknesses, recommended lessons and exercises, weekly plan, difficulty tracking | New | Worked out by the student portal from existing signals (What should I practise today) |
| Goal setting | New | Student goals (B); coach-set weekly plans (B) |

## System design

&#91;embedded content: System design · 2 portals, 1 shared database, 2 background jobs\]

Staff write through the admin portal and students through the student portal's server. Neither portal calls the other, so either can be down without breaking the other's screens. Reminders and phone push run as background jobs on the same database.

## Tables the student portal reads today

Renaming or reshaping any of these breaks a live student screen. Add columns freely; tell the student portal team before removing or renaming one. All reads run on the student portal's server with the service role, always filtered to the signed-in student.

| Area | Tables and functions | The portal relies on |
| --- | --- | --- |
| Learning | `curriculum`, `library_published_content`, `library_categories`, `library_assets`, `belts`, `portal_student_library_page()` | Published lessons, snapshot documents, active categories, belt order |
| Practice records | `student_portal_record_event()`, `student_portal_events`, `student_portal_progress`, `lms_progress` | Request-keyed writes; event kinds `lesson`, `workout`, `template`, `stat` |
| Training | `student_physical_evaluations`, `student_body_compositions`, `student_training_plans`, `workout_templates` | Grades on the 4-level scale (Needs Work, Developing, Proficient, Outstanding); 15 measurement columns |
| Belts and exams | `portal_student_belt_tests()` (belt-tests-v1) over `belt_test_syllabi`, `belt_test_sections`, `belt_test_items`, `grading_events`, `grading_candidates`; `belt_histories`, `student_portal_readiness_policies`, `student_portal_coach_confirmations` | `belt_test_items.library_asset_id` links a syllabus item to a lesson |
| Schedule | `class_sessions`, `class_enrollments`, `class_occurrences`, `class_occurrence_roster`, `attendance`, `makeup_attendance`, `academy_events` | Times in Asia/Phnom\_Penh; attendance marks Present, Late, Absent |
| Notices | `portal_notifications`, `portal_notification_preferences`, `portal_push_subscriptions`, `portal_calendar_inbox()` | `source_type`, `category`, `subject_student_id`, quiet hours, muted categories |
| Identity | `students`, `profiles`, `belts` | `students.current_belt`, `student_status`; a student profile links to one student |

One fix is needed in `student_portal_record_event()`: it treats only the exact words `All`, `All Belts`, `All Levels` and `Beginner` as open to every belt. The library's rule ignores case and spacing, so a lesson marked `all belts` shows to students but rejects their practice logs. Please match the library's rule.

## New database tables

The LMS needs 18 new tables and a few new columns, in 7 groups. These are sketches: rename freely, but keep the meaning of each column. Every new table gets row level security with no student policy; students reach them only through the student portal's server or a server-only function.

### A. Belt syllabus: publish the tables that exist

No new table. The `belt_test_syllabi`, `belt_test_sections` and `belt_test_items` tables already describe each belt's requirements, and the portal's Belt journey already reads them. Please publish one syllabus per belt (White to 3rd Poom/Dan), set `library_asset_id` on every item that has a lesson, and use section kind `poomsae` for forms. Two columns let the portal recommend practice:

```sql
alter table belt_test_items
  add column practice_target jsonb,  -- {"reps": 50, "timesPerWeek": 3}
  add column form_id uuid references poomsae_forms(id);  -- when the item is a form
```

### B. Goals and coach plans

```sql
create table student_goals (
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references students(id),
  kind text not null check (kind in ('weekly_days','weekly_minutes','lesson','form','belt_exam','custom')),
  target integer,                 -- days, minutes or reps
  subject_ref text,               -- lesson id or form id for kind lesson/form
  title text,                     -- custom goals, in the student's words
  set_by text not null check (set_by in ('student','coach')),
  coach_id uuid references profiles(id),
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active','done','dropped')),
  created_at timestamptz not null default now()
);
-- one active weekly goal of each kind per student
create unique index on student_goals (student_id, kind)
  where status = 'active' and kind in ('weekly_days','weekly_minutes');

create table student_learning_plans (  -- a coach's plan for one student's week
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references students(id),
  week_start date not null,            -- Monday, Asia/Phnom_Penh
  items jsonb not null,                -- [{"type":"lesson","id":12,"target":"3 x 10","day":1}]
  note text,
  created_by uuid not null references profiles(id),
  published_at timestamptz,
  unique (student_id, week_start)
);
```

### C. Poomsae, quizzes and self-checks

```sql
create table poomsae_forms (
  id uuid primary key default gen_random_uuid(),
  curriculum_id integer not null unique references curriculum(id),  -- its library lesson
  name text not null,
  korean_name text,
  series text not null,             -- 'Taegeuk', 'Black belt'
  belt_id integer references belts(id),  -- the belt that learns it
  movement_count integer not null,
  sort_order integer not null,
  published boolean not null default false
);

create table student_form_progress (
  student_id varchar not null references students(id),
  form_id uuid not null references poomsae_forms(id),
  status text not null default 'learning'
    check (status in ('learning','practising','ready_for_review','mastered')),
  practice_count integer not null default 0,
  best_quiz_percent smallint,
  last_practised_at timestamptz,
  mastered_by uuid references profiles(id),  -- only a coach sets mastered
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, form_id)
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('form','lesson','belt','terminology')),
  scope_ref text not null,          -- form id, lesson id or belt name
  kind text not null check (kind in ('next_movement','direction','stance','term','choice')),
  prompt text not null,
  choices jsonb not null,           -- ["...", "..."]
  answer jsonb not null,            -- the right index, or an ordered list
  translations jsonb not null default '{}',  -- {"km": {...}, "zh": {...}}
  published boolean not null default false
);

create table student_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references students(id),
  scope text not null,
  scope_ref text not null,
  score smallint not null,
  total smallint not null,
  missed uuid[] not null default '{}',  -- questions answered wrong
  created_at timestamptz not null default now()
);

create table student_self_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references students(id),
  subject_type text not null check (subject_type in ('lesson','step','form','movement')),
  subject_ref text not null,        -- '12', '12:chamber', a form id, '<form id>:7'
  rating smallint not null check (rating between 1 and 4),  -- same 4 levels as coach grades
  note text check (length(note) <= 500),
  created_at timestamptz not null default now()
);

create table student_step_checks (    -- ticks on a technique step's checklist
  student_id varchar not null references students(id),
  curriculum_id integer not null references curriculum(id),
  step_id text not null,            -- the step's id in the technique-steps section
  checked smallint[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (student_id, curriculum_id, step_id)
);
```

Students never write these tables directly: the student portal records an activity (see Student activity) and the database function updates the table in the same transaction.

### D. Submissions and coach feedback

Used by video assignments, Poomsae video submissions and written answers.

```sql
create table student_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references students(id),
  assignment_id uuid references assignments(id),
  subject_type text check (subject_type in ('lesson','form')),
  subject_ref text,
  kind text not null check (kind in ('video','text','practice')),
  text_answer text check (length(text_answer) <= 4000),
  video_path text,                  -- private bucket: student-submissions/<student>/<id>.mp4
  video_seconds smallint check (video_seconds <= 180),
  status text not null default 'uploading'
    check (status in ('uploading','submitted','reviewed','returned','withdrawn','expired')),
  consent_by uuid references profiles(id),  -- the account that agreed to the recording
  submitted_at timestamptz,
  delete_video_after date,          -- review date + 90 days
  created_at timestamptz not null default now()
);

create table submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references student_submissions(id),
  reviewer_id uuid not null references profiles(id),
  grade text check (grade in ('Needs Work','Developing','Proficient','Outstanding')),
  rubric jsonb not null default '[]',      -- [{"item":"Stance","grade":"Developing","note":"..."}]
  feedback text check (length(feedback) <= 4000),
  moments jsonb not null default '[]',     -- [{"second":12,"note":"Pivot the supporting foot"}]
  visible_to_student boolean not null default true,
  created_at timestamptz not null default now()
);
```

### E. Assignments and challenges

```sql
create table assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instructions text not null,
  kind text not null check (kind in ('practice','video','written','quiz','form')),
  subject_type text check (subject_type in ('lesson','form')),
  subject_ref text,
  target jsonb,                     -- {"reps":50} | {"sessions":3} | {"questions":[...]}
  due_at timestamptz,
  points smallint not null default 0,
  rubric jsonb not null default '[]',
  translations jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_by uuid not null references profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table assignment_targets (
  assignment_id uuid not null references assignments(id) on delete cascade,
  target_type text not null check (target_type in ('student','class','belt','branch','all')),
  target_ref text not null default '',  -- student id, class id, belt name, branch id; '' for all
  primary key (assignment_id, target_type, target_ref)
);

create table student_assignments (  -- one row per student, written when the assignment is published
  assignment_id uuid not null references assignments(id),
  student_id varchar not null references students(id),
  status text not null default 'open'
    check (status in ('open','in_progress','submitted','reviewed','done','excused')),
  progress jsonb not null default '{}',  -- {"reps": 30}
  done_at timestamptz,
  primary key (assignment_id, student_id)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  goal_kind text not null
    check (goal_kind in ('reps','sessions','streak_days','minutes','quiz_pass','form_mastered')),
  goal_target integer not null,
  subject_type text,
  subject_ref text,                 -- e.g. lesson 12 for "Practise 50 front kicks"
  starts_on date not null,
  ends_on date not null,
  audience jsonb not null default '{"all":true}',  -- {"belts":["White","Yellow"]}
  points smallint not null default 0,
  badge_code text references achievement_definitions(code),
  translations jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','closed'))
);

create table student_challenge_progress (
  challenge_id uuid not null references challenges(id),
  student_id varchar not null references students(id),
  progress integer not null default 0,
  completed_at timestamptz,
  primary key (challenge_id, student_id)
);
```

Challenge and assignment progress is counted by the database from recorded activity, in the same transaction, so a student cannot set it directly. The five example challenges map to `reps` (50 front kicks), `form_mastered` (memorise one Poomsae), `streak_days` with a stretching lesson (7 days), `sessions` (3 home sessions) and `quiz_pass` (terminology quiz).

### F. Achievements and points

```sql
create table achievement_definitions (
  code text primary key,            -- 'lessons_10', 'streak_7', 'poomsae_beginner'
  title text not null,
  description text not null,
  icon text not null,               -- same icon names as library categories
  rule jsonb not null,              -- {"kind":"lessons_completed","min":10}
  points smallint not null default 0,
  repeats text not null default 'once' check (repeats in ('once','monthly')),
  translations jsonb not null default '{}',
  active boolean not null default true
);

create table student_achievements (
  student_id varchar not null references students(id),
  code text not null references achievement_definitions(code),
  period text not null default '',  -- '' for once, '2026-11' for monthly ones
  earned_at timestamptz not null default now(),
  evidence jsonb,                   -- what counted, for the coach
  seen_at timestamptz,              -- the portal cheers once, then sets this
  primary key (student_id, code, period)
);

create table student_points (
  id bigint generated always as identity primary key,
  student_id varchar not null references students(id),
  delta integer not null,
  reason text not null,             -- 'assignment', 'challenge', 'achievement'
  ref text not null,                -- the source row's id
  created_at timestamptz not null default now(),
  unique (student_id, reason, ref)  -- never awarded twice
);
```

| Example achievement | Rule kind | Rule |
| --- | --- | --- |
| First 10 Lessons Completed | `lessons_completed` | 10 lessons self-completed |
| 7-Day Practice Streak | `streak_days` | 7 days in a row |
| Poomsae Beginner | `forms_mastered` | 1 form marked mastered by a coach |
| Kicking Technique Master | `category_completed` | Every lesson in the kicking categories for the student's belt |
| 100 Home Practice Sessions | `sessions_total` | 100 practice sessions |
| Belt Exam Ready | `belt_exam_ready` | Every rule in belt-tests-v1 met |
| Perfect Attendance Month | `attendance_month` | Present or Late at every dated class in a month |

Points are a personal total only. The portal never ranks students by points or practice.

### G. Reminder settings

No new table: reminders are rows in `portal_notifications` with new categories (see Notifications and reminders).

```sql
alter table portal_notification_preferences
  add column practice_reminder_time time,      -- null = no daily reminder
  add column practice_days smallint[],         -- 1 = Monday ... 7 = Sunday
  add column class_reminder_hours smallint not null default 2;
```

## Student activity

Students keep writing through the one existing function, `student_portal_record_event(p_actor, p_student, p_request, p_kind, p_payload)`. Seven new kinds join the four it accepts. It already checks the account, the student link, belt eligibility and the request key, and caps a payload at 64 KB; each new kind needs its own payload check and its table update in the same transaction.

| Kind | The portal records it when | Payload | The database then updates |
| --- | --- | --- | --- |
| `lesson` (exists) | Reps are logged or a lesson is self-completed | `{lessonId, repetitionsCount, completed}` | `student_portal_progress` |
| `workout` (exists) | A timed routine finishes | `{templateId, durationSeconds, score}` | Nothing else |
| `template`, `stat` (exist) | A routine is saved; a personal best is set | As today | Nothing else |
| `step_check` | A technique step's checklist is ticked | `{lessonId, stepId, checked: [0, 2]}` | `student_step_checks` |
| `self_assessment` | A lesson, step, form or movement is rated | `{subjectType, subjectRef, rating: 1-4, note?}` | `student_self_assessments` |
| `quiz_attempt` | A quiz ends | `{scope, scopeRef, score, total, missed: [questionId]}` | `student_quiz_attempts`, `best_quiz_percent` |
| `form_practice` | A guided or free run through a form ends | `{formId, mode: 'guided' or 'free', movements, durationSeconds}` | `student_form_progress` (count, last practised; learning becomes practising) |
| `form_ready` | The student asks a coach to check a form | `{formId}` | Status ready\_for\_review, and a notice to the coach |
| `assignment_progress` | Reps are logged against a practice assignment | `{assignmentId, reps}` | `student_assignments.progress` |
| `goal` | The student sets a weekly goal | `{kind, target}` | `student_goals` |

After any of these, one function (for example `student_portal_evaluate_rewards(student_id)`) updates challenge progress, awards achievements and points, and writes an achievement notice. It must be safe to run twice.

Video submissions need two server-only functions, because the file uploads in between: one checks the student and the assignment, creates the row as `uploading` and returns a signed upload path; the other marks it `submitted` once the file is stored.

Practice days for the streak are days with any `lesson`, `workout`, `form_practice` or `quiz_attempt` activity, in Asia/Phnom\_Penh time.

## What should I practise today

The student portal picks 3 items a day and a weekly plan with plain rules, no machine learning, and every item shows its reason ("Your coach marked this Developing"). The student portal team builds this; the admin team only needs the data below to exist.

| Signal | Read from | Weight |
| --- | --- | --- |
| A coach's plan for this week | `student_learning_plans` | Always first |
| Assignment due within 3 days, or a challenge ending | `student_assignments`, `challenges` | +35 |
| Required for the next belt and not done | `belt_test_items` linked to lessons and forms; practice records | +40 |
| Coach grade Needs Work / Developing (latest for that skill) | `student_physical_evaluations` | +30 / +20 |
| Exam item scored below its pass mark | `grading_item_scores` (published results only) | +30 |
| Student rated it 1 or 2, or marked "still learning" | `student_self_assessments` | +15 |
| Best quiz score under 70% | `student_quiz_attempts` | +15 |
| Done before, not practised for 3, 7, 14 or 30 days | Practice records | +10 to +25 |
| Belt exam within 30 days | `grading_events` | Next-belt and exam items × 1.5 |
| Already practised today | Practice records | Skipped |

The day's 3 items mix kinds: one technique, one form or terms quiz, and one stretch or conditioning item, together about the student's daily minutes (weekly goal ÷ practice days). The weekly plan spreads the top items over the days the student chose.

A lesson is flagged for the coach when a student rates it "still learning" 3 times, or fails its quiz twice, within 14 days. A simple view (for example `coach_attention_items`) would let the admin portal show these per class.

Nothing is stored for the recommendation itself; it is worked out on each visit, so it changes as soon as the student improves or a coach grades them.

## Contracts

Lesson content stays in library-v2: two additions cover step-by-step techniques and poomsae video. The rules that made library-v2 safe still apply: no `.strict()` on the student side, unknown section types are dropped, links are https only, and Khmer and Chinese overlay English by section id.

**1. New section type `technique-steps`** (the Roundhouse Kick example: 8 steps, each with a clip, mistakes and a checklist):

```json
{
  "id": "how-to", "type": "technique-steps", "title": "Step by step",
  "video": "https://www.youtube.com/watch?v=VIDEO_ID",
  "items": [
    {
      "id": "chamber",
      "title": "Chamber position",
      "body": "Lift the knee to hip height, toes pulled back.",
      "clip": { "start": 12.5, "end": 18 },
      "mistakes": [ { "mistake": "Knee too low", "correction": "Lift the knee to hip height first" } ],
      "checklist": [ "Knee at hip height", "Supporting foot flat", "Guard up" ]
    }
  ]
}
```

- `clip` is either `{start, end}` in seconds within the section's `video`, or `{src}` for its own file. Times are numbers, never translated.
- Step `id`s must never change once published: the student's checklist ticks are stored against them.
- Translations may change `title`, `body`, `mistakes` and `checklist` text only. Add `clip`, `video`, `start`, `end` and `src` to the structure keys the translation merge skips (`FIXED_KEYS` in both portals).

**2. Poomsae movements** (the existing `diagram` section, kind `poomsae-walkthrough`): each step may add `clip` (as above) and `mistakes`. Movement *n* still matches item *n* of the lesson's `steps` section.

**3. Lesson summary**: add `formId` when the lesson is a registered poomsae form, so the library can show form progress on its card.

**4. Feeds for the new areas.** Like `portal_student_belt_tests()` (belt-tests-v1), the admin side owns who sees what, in server-only functions that return versioned JSON:

| Function | Contract | Returns |
| --- | --- | --- |
| `portal_student_tasks(p_student)` | tasks-v1 | Open and recent assignments and challenges, with the student's status and progress |
| `portal_student_achievements(p_student)` | achievements-v1 | Catalogue, earned awards and personal points total |
| `portal_student_forms(p_student)` | forms-v1 | Forms for the student's belts, with their progress and coach review state |
| `portal_student_submissions(p_student)` | submissions-v1 | Submission history with reviews visible to the student |

**Slow motion** is the player's speed control. YouTube embeds and academy-hosted MP4 files support it; Google Drive embeds do not. Please host technique and poomsae clips on YouTube (unlisted) or academy storage.

## Notifications and reminders

All eleven reminder types reuse the existing inbox and phone push: a scheduler writes `portal_notifications` rows, and the existing push worker delivers them within each student's settings. Times are Asia/Phnom\_Penh.

| Reminder | Category | Sent when | Timing | Default |
| --- | --- | --- | --- | --- |
| Upcoming class | `class_reminder` | A dated class on the student's roster | `class_reminder_hours` before (2 h) | On |
| Belt exam | `exam_reminder` | A published grading event the student is registered or eligible for | 14, 3 and 1 days before | On |
| Assignment deadline | `assignment_due` | An open assignment not yet submitted | 48 h and 12 h before the due time | On |
| Daily practice | `practice_reminder` | The student's chosen days | `practice_reminder_time` | Off until the student sets a time |
| Training streak | `streak_reminder` | A streak of 3+ days and nothing logged today | 19:00 | On |
| New learning material | `new_material` | A lesson or form published for the student's belt | One digest a day at 17:00 | On |
| Instructor feedback | `feedback` | A review becomes visible to the student | At once | On |
| Missed class | `missed_class` | Marked Absent at a dated class | Next day, 08:00 | On |
| New achievement | `achievement` | An award is written | At once | On |
| Competitions and events | `academy_event` (exists) | An academy event is published | At publish | On |
| Staff announcement | `announcement` | A staff message to a class, a belt or everyone | At publish | On |

How it runs:

1. Every 15 minutes a job (the existing `portal_job_runs` and `portal_job_leases`, with pg\_cron or the admin portal's worker) finds due reminders.
2. It writes one `portal_notifications` row each, with a `source_key` such as `exam_reminder:<event id>:<student id>:3d`, so a rerun never sends twice.
3. The existing push worker sends it unless the category is muted or it is quiet hours; quiet-hour notices wait in the inbox.
4. Family accounts receive their children's reminders through `subject_student_id`.

Students already mute categories and set quiet hours in Settings; the portal will add the new categories and the daily reminder time.

## Security, privacy and video

Most students are children, so every new record is private by default and videos need a guardian's consent and expire.

- **Access.** Turn on row level security for every new table with no student policy. The student portal reads and writes through its server after checking the session and the student link; staff use the admin portal's role permissions.
- **Official vs self-reported.** Self-assessments, practice logs and checklists never change a coach grade, exam score or mastered status.
- **Video consent.** Before a student's first upload, a guardian (or the adult student) agrees in the portal; `consent_by` and the date are stored.
- **Video storage.** Use a private bucket `student-submissions`, with paths `<student id>/<submission id>.mp4`. Uploads use a signed upload URL valid 10 minutes, created by the server after it checks the student. Playback uses signed URLs valid 10 minutes, for that student, their guardian account and staff only.
- **Video limits.** 180 seconds, 200 MB, MP4, WebM or MOV; at most 10 uploads a day per student.
- **Retention.** A nightly job deletes each video 90 days after its review (`delete_video_after`) and keeps the written feedback.
- **No comparison.** Points, achievements, streaks and form progress are visible only to the student, their guardian and staff. The competition standings stay separate; please add the planned `students.ranking_opt_out` column so families can opt out.
- **Phone notifications** keep showing generic lock-screen text, never a child's name or a coach's feedback.
- **Audit.** Reviews, grades, assignment changes and mastered marks record who made them and when.
- **Two open database settings** from the last audit: turn on leaked-password protection in Supabase Auth, and review the 11 security-definer helper functions that signed-in users can call.

## Build order

Phase 1 needs no new tables and lights up screens students already have; each later phase ships on its own.

| Phase | Admin portal builds | Student portal builds | Students get |
| --- | --- | --- | --- |
| 1. Publish what has screens | A syllabus for every belt with items linked to lessons; grading events; belts for the 91 draft lessons; coach grades on the 4-level scale; dated class sessions; the belt-rule fix in `student_portal_record_event()` | Belt-based learning progress and upcoming exams on the overview | Next belt goal, exam dates, progress toward the next belt, all 8 Taegeuk floor plans |
| 2. Goals and step-by-step learning (B, part of C) | `student_goals`, `student_step_checks`, `student_self_assessments`; a `technique-steps` editor with clip times; new activity kinds | Weekly goal saved to the account, step clips with checklists, self-checks, "What should I practise today?" | A goal on every device, Roundhouse-style step learning, a daily plan |
| 3. Poomsae module (rest of C) | Form registry, clips and mistakes per movement, quiz bank editor, coach "mastered" review; forms-v1 | Forms by belt, slow motion, quizzes, form progress, "I'm ready" requests | The complete Poomsae module |
| 4. Assignments, challenges and feedback (D, E) | Assignment and challenge editors with targeting, a review queue with video and rubric, the private bucket and retention job; tasks-v1, submissions-v1 | Pending tasks, video upload, feedback with timed notes, challenge progress | Coach tasks, weekly challenges, video feedback |
| 5. Achievements and reminders (F, G) | Achievement catalogue, `student_portal_evaluate_rewards()`, the reminder job, new notice categories; achievements-v1 | Achievement summary, a one-time cheer for each new award, reminder settings | Badges, personal points, all 11 reminders |

## Open questions

- [ ] Who may create assignments and challenges: every coach, or the head coach only?
- [ ] Should assignments target classes, belts and single students from the first release?
- [ ] How long are submission videos kept after review? This doc proposes 90 days.
- [ ] How is guardian consent collected: in the portal at the first upload, or on the enrolment form?
- [ ] Is "Belt Exam Ready" automatic once every belt-tests-v1 rule is met, or does a coach sign it off?
- [ ] Does each technique step get its own clip, or start and end times in one lesson video?
- [ ] Where does the reminder job run: pg\_cron, a Supabase Edge Function or the admin portal's worker?
- [ ] Is the daily practice reminder off by default (proposed) or on at a set time?
- [ ] Should guardians see points and achievements in their own accounts?
- [ ] Are points only for the student's own record, or do they lead to real rewards (stickers, certificates)?
