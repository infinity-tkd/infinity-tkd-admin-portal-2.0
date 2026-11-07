# Student portal preparation

Admin workflow · 1 November 2026

The academy handoff separates approved student-facing publications from private official data. This release adds the admin preparation workspace and trusted lesson-observation path. It does not publish a readiness policy or ranking, populate consent evidence, backdate results or promote students.

## Where staff work

The `StudentPortalAdminPanel` belongs in **Operations → Student portal**, behind `page:lms`. Root, Super Root, Admin and Head Coach can prepare private drafts. Coach and Assistant Coach can use the lesson-observation workflow. Mutations additionally require `action:evaluations_grade`; explicit permission denies are preserved by the API and database actor guard.

### Readiness drafts

Choose the current belt the requirements apply to, a proposed version, minimum days, physical average, attendance threshold and counting basis. Map actual active `curriculum` IDs and exact physical skill names. Add approved English, Khmer and Chinese labels to each requirement.

The initial White values come from the handoff's unapproved documented baseline. Attendance basis remains undecided, mappings are empty, and the mapping-review checkbox starts unchecked. Warnings remain visible for missing decisions and labels. Saving stores only a private draft. An intentional empty requirement list must be reviewed; it is not a replacement for unmapped syllabus content.

### Ranking drafts

Enter the actual season, reviewed athletes, approved display names and real consent/evidence references. Gold, silver and bronze counts are entered explicitly; unknown counts start blank. A private draft can retain a pending consent reference and shows a review warning. No private achievement list is automatically copied into a ranking.

The methodology remains medal order. This workspace has no publication action. An empty list is permitted only as an unpublished preparation draft; it is not a valid published ranking.

### Coach lesson observations

Select a student. The form is available only when there is one valid currently published readiness policy matching the current belt and actual lesson requirements.

Record Passed or Needs work, a genuine observation/evidence reference and confirmation that the observation was made now. The server supplies the actor and timestamp. The API rejects supplied confirmer/timestamp fields. The database rechecks active actor permissions, policy window, active approver, current rank history and the exact active lesson key.

Historical self-completion and `lms_progress` are not imported as trusted coach outcomes. Physical skills remain in their physical-assessment workflow. A lesson result can support readiness for coach review; it does not award a belt.

The original recording coach or an academy reviewer can withdraw an invalid confirmation with a reason. The row remains in history with `revoked_at`; an older pass is never restored by deleting or filtering out the latest withdrawn result. The student reader must retain this ordering/withdrawal interpretation.

## Data and migration

`supabase/migrations/20261101030518_student_portal_admin_preparation.sql` was created with the Supabase CLI. It requires the shared, already-established student publication tables and the existing `portal_assert_actor` helper. Reconcile the shared migration history before deploying; do not replay obsolete setup scripts.

The migration adds:

- `student_portal_admin_drafts`: service-only private readiness/ranking drafts, optimistic revisions, actor references, timestamps and archive state.
- `portal_student_publication_admin`: a service-only invoker RPC for draft save/archive and current lesson confirmation/withdrawal.

The draft table has RLS enabled and no anonymous/authenticated browser grants. The RPC is callable only by the server role, checks staff/permission boundaries, serializes request keys, and writes its audit record transactionally. Existing published tables and their private approval/consent references keep their existing protection. There are no publication operations or inserted baseline records in the migration.

`GET/POST /api/admin/student-portal-preparation` exposes the staff workflow through the existing authenticated server boundary. It is not a student endpoint. Drafts must never be added to the student calendar/readiness/ranking reader.

## Verification

`node --test tests/student-portal-preparation.test.mjs` covers draft/approval validation, duplicate/stale requests, actual service-role execution, direct browser grant denial, explicit permission denial, current policy/lesson checks, actor/time spoofing rejection, and retaining a withdrawn latest result. Test records exist only in isolated PGlite fixtures.

The prepared UI reuses Operations forms/cards and existing theme styling. Draft forms retain their values after saving or uncertain writes. Account/student-scoped read snapshots prevent old student data appearing when the selection changes. Browser and physical-device acceptance should be included with the final integrated Operations/calendar release.
