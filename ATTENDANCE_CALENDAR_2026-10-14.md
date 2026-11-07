# Student attendance calendar

## Where to find it

On the attendance page, open a student's attendance details. The new **Attendance calendar** tab is selected by default. **Attendance Insights** keeps the existing attendance statistics, progress and history.

Use the month arrows, **Today**, or the date field to choose a date. The calendar starts with the attendance page's selected date and class. **All classes** shows each recorded class separately; **Daily record** shows the independent daily marks used by older records and combined rosters.

## Editing a day

Choose a class or daily record to add a mark on an unmarked date. Select **Present**, **Late** or **Absent** to save it. Existing marks can also be changed from the all-class view, where each class has its own controls.

**Clear mark** asks for confirmation and deletes the selected record by its ID and student ID. It does not use the bulk date-reset operation, so other classes and daily marks on the same date remain intact. Clearing a record makes it unmarked; it does not mark the student absent.

New marks cannot precede registration or class enrollment, or fall after the academy's current date. For a class date outside its usual weekday schedule, explicitly select the make-up-session checkbox. Existing historical records remain correctable even when enrollment details have changed. Future records can be inspected or cleared, but cannot be marked as attendance in advance.

## Permissions and recovery

Status changes require `action:attendance_mark`; clearing requires `action:attendance_delete`. Browsing works for staff who have attendance read access. The database's existing row-level policies remain the final authority, including active-account and permission checks. Relevant incomplete-data notices disable editing until records are reloaded.

Writes update the calendar and insights only after a confirmed database response. Controls prevent repeat submissions, and requests have a 15-second timeout. Failed writes retain the last confirmed mark and show an error. They are not automatically replayed; reload records before repeating an operation whose result is uncertain.

No SQL migration is needed. The live database already has `attendance.class_id`, the three supported statuses, separate read/write/delete policies, and `UNIQUE NULLS NOT DISTINCT(student_id, date, class_id)`.

## Verification

The automated suite passed 101 tests, with no type or lint errors. Existing lint warnings remain. New unit tests cover Monday-first calendars, leap years, month boundaries, isolated student/class/daily records, enrollment limits and exact-row clearing, including failures and zero affected rows.

The production browser regression uses fictional data and intercepts every database write. It covers all three statuses, clearing and cancellation, preservation of other classes and students, failed saves and clears, repeat-click protection, make-up sessions, date limits, month navigation, permission overrides, keyboard focus and desktop/tablet/phone layouts. Real database checks in this task read schema metadata only.

Run the regression against a local server with:

```sh
npm run test:attendance-calendar-browser -- http://127.0.0.1:3000
```

The regression is included in the repository's quality workflow.
