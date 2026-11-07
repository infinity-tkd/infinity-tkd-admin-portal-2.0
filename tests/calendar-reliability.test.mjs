import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

const migration = 'supabase/migrations/20261101042452_calendar_archive_and_inbox_reliability.sql';
const studentUser = '97000000-0000-4000-8000-000000000001';
const event = { title: 'Fixture competition', type: 'competition', lifecycle: 'scheduled', startDate: '2026-01-10', endDate: '2026-01-12', startsAt: null, endsAt: null, timezone: 'Asia/Phnom_Penh', location: '', description: 'Approved public copy', internalNotes: 'Private planning', audience: { mode: 'all', branchIds: [], classIds: [], studentIds: [] }, attachments: [], changeReason: '' };
async function database() {
  const db = await operationsDatabase();
  try {
    for (const file of ['supabase/migrations/20261012065927_portal_achievement_integrity.sql', 'supabase/migrations/20261101030526_academy_calendar_and_student_notices.sql', 'supabase/migrations/20261101033250_academy_event_achievement_links.sql', migration]) await db.exec(fs.readFileSync(file, 'utf8'));
    await db.exec(`INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true; INSERT INTO auth.users(id,email) VALUES('${studentUser}','student@example.test'); INSERT INTO profiles(id,username,email,display_name,role,student_id) VALUES('${studentUser}','student','student@example.test','Fixture student','Student','STU-M-001'); UPDATE students SET profile_id='${studentUser}' WHERE id='STU-M-001';`);
    return db;
  } catch (error) { await db.close(); throw error; }
}
async function mutate(db, action, id, payload, key = randomUUID(), actor = root) {
  return (await db.query('SELECT portal_calendar_mutate($1,$2,$3,$4,$5) result', [actor, action, id, payload, key])).rows[0].result;
}
async function published(db, source = event) {
  const created = await mutate(db, 'create', null, { event: source });
  return mutate(db, 'publish', created.event.id, { expectedRevision: created.event.revision, notifyStudents: true });
}
async function inbox(db, action = 'list', id = null, user = studentUser) {
  return (await db.query("SELECT portal_calendar_inbox($1,'STU-M-001',$2,$3) result", [user, action, id])).rows[0].result;
}

test('archive withdraws all student surfaces, freezes edits and preserves the event identity, revision, audit and achievement history', async () => {
  const db = await database();
  try {
    const current = await published(db), id = current.event.id;
    const entries = [{ eventId: id, eventName: event.title, date: '2026-01-10', category: 'Poomsae', division: 'Junior', medalRank: 'Gold' }];
    const result = (await db.query("SELECT portal_save_achievements($1,'STU-M-001',$2,'[]',$3) result", [root, entries, randomUUID()])).rows[0].result;
    const recorded = result.records[0];
    await assert.rejects(mutate(db, 'archive', id, { expectedRevision: current.event.revision, reason: 'No' }), /explain/i);
    await assert.rejects(mutate(db, 'archive', id, { expectedRevision: current.event.revision, reason: 'Withdrawn for review' }, randomUUID(), coach), /permission|owner/i);
    const key = randomUUID(), payload = { expectedRevision: current.event.revision, reason: 'Withdrawn for academy review' };
    const archived = await mutate(db, 'archive', id, payload, key);
    assert.deepEqual(await mutate(db, 'archive', id, payload, key), archived);
    assert.equal(archived.event.id, id);
    assert.equal(archived.event.revision, current.event.revision + 1);
    assert.equal(archived.event.published_revision, current.event.published_revision);
    assert.deepEqual(archived.event.published_payload, current.event.published_payload);
    assert.equal(archived.event.archived_by, root);
    assert.equal(archived.event.archived_reason, payload.reason);
    assert.ok(archived.event.archived_at);
    assert.equal((await db.query('SELECT * FROM portal_calendar_student_events($1,NULL,NULL,NULL,$2,1)', ['STU-M-001', id])).rows.length, 0);
    assert.deepEqual(await inbox(db), { rows: [], unreadCount: 0 });
    assert.equal((await db.query('SELECT count(*)::int n FROM academy_event_revisions WHERE event_id=$1', [id])).rows[0].n, 1);
    assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='CALENDAR_ARCHIVE' AND target_id=$1", [id])).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications WHERE source_id=$1', [id])).rows[0].n, 1, 'withdrawal preserves immutable recipient evidence');
    for (const action of ['save', 'publish', 'notice', 'archive']) await assert.rejects(mutate(db, action, id, { expectedRevision: archived.event.revision, event, notifyStudents: false, reason: 'Another archive attempt' }), /archived/i);
    const modified = [{ ...entries[0], id: recorded.id, eventName: 'A client rename', notes: 'Coach corrected the notes' }];
    const updated = (await db.query("SELECT portal_save_achievements($1,'STU-M-001',$2,'[]',$3) result", [root, modified, randomUUID()])).rows[0].result.records[0];
    assert.equal(updated.event_name, event.title);
    assert.equal(updated.event_id, id);
    await assert.rejects(db.query("SELECT portal_save_achievements($1,'STU-M-002',$2,'[]',$3)", [root, entries, randomUUID()]), /published competition/i);
    await db.query("UPDATE profiles SET role='Head Coach' WHERE id=$1", [coach]);
    await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted) VALUES($1,'action:events_publish',true)", [coach]);
    const coachEvent = await mutate(db, 'create', null, { event }, randomUUID(), coach);
    await assert.rejects(mutate(db, 'archive', coachEvent.event.id, { expectedRevision: coachEvent.event.revision, reason: 'Head coach reviewed this event' }, randomUUID(), coach), /administrator/i, 'a custom publishing grant does not grant administrative archive authority');
  } finally { await db.close(); }
});

test('dismiss is idempotent, retains its first timestamp and never updates another recipient or a withdrawn source', async () => {
  const db = await database();
  try {
    const current = await published(db), notice = (await inbox(db)).rows[0];
    await inbox(db, 'read', notice.id);
    const readAt = (await db.query('SELECT read_at FROM portal_notifications WHERE id=$1', [notice.id])).rows[0].read_at;
    await inbox(db, 'dismiss', notice.id);
    const first = (await db.query('SELECT dismissed_at FROM portal_notifications WHERE id=$1', [notice.id])).rows[0].dismissed_at;
    assert.deepEqual(await inbox(db, 'dismiss', notice.id), { saved: true });
    const after = (await db.query('SELECT read_at,dismissed_at FROM portal_notifications WHERE id=$1', [notice.id])).rows[0];
    assert.equal(String(after.dismissed_at), String(first));
    assert.equal(String(after.read_at), String(readAt));
    assert.deepEqual(await inbox(db), { rows: [], unreadCount: 0 });
    await assert.rejects(inbox(db, 'dismiss', notice.id, coach), /not available/i);
    await mutate(db, 'archive', current.event.id, { expectedRevision: current.event.revision, reason: 'Withdrawn by the academy' });
    await assert.rejects(inbox(db, 'dismiss', notice.id), /not available/i);
  } finally { await db.close(); }
});

test('class and branch audiences use current effective enrollment; historical rosters alone grant no access', async () => {
  const db = await database();
  try {
    await db.exec("INSERT INTO branches(id,branch_name) VALUES(2,'Other fixture branch'); INSERT INTO class_sessions(id,branch_id,class_name,day_of_week,days_of_week,start_time,end_time) VALUES(81,2,'Fixture lesson','Monday',ARRAY['Monday'],'17:00','18:30'); INSERT INTO class_enrollments(student_id,class_id,enrollment_date) VALUES('STU-M-001',81,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date+1);");
    const classEvent = { ...event, audience: { mode: 'classes', classIds: [81], branchIds: [], studentIds: [] } };
    const branchEvent = { ...event, audience: { mode: 'branches', classIds: [], branchIds: [2], studentIds: [] } };
    const match = async source => (await db.query("SELECT portal_calendar_student_matches($1,'STU-M-001') allowed", [source])).rows[0].allowed;
    assert.equal(await match(classEvent), false);
    assert.equal(await match(branchEvent), false);
    await db.exec("UPDATE class_enrollments SET enrollment_date=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date WHERE class_id=81");
    assert.equal(await match(classEvent), true);
    assert.equal(await match(branchEvent), true);
    const occurrence = randomUUID();
    await db.query("INSERT INTO class_occurrences(id,class_id,source_date,starts_at,ends_at,class_name,branch_id,capacity) VALUES($1,81,'2026-01-10','2026-01-10T10:00:00Z','2026-01-10T11:00:00Z','Historical lesson',2,30);", [occurrence]);
    await db.query("INSERT INTO class_occurrence_roster(occurrence_id,student_id,enrolled_date) VALUES($1,'STU-M-001','2026-01-01')", [occurrence]);
    await db.exec("DELETE FROM class_enrollments WHERE class_id=81");
    assert.equal(await match(classEvent), false);
    assert.equal(await match(branchEvent), false);
    assert.equal((await db.query('SELECT count(*)::int n FROM class_occurrence_roster')).rows[0].n, 1, 'attendance history remains intact');
    assert.equal(await match({ ...event, audience: { mode: 'students', classIds: [], branchIds: [], studentIds: ['STU-M-001'] } }), true, 'staff may explicitly target an alumnus');
  } finally { await db.close(); }
});

test('notices reference approved public revisions and public revision history cannot be rewritten', async () => {
  const db = await database();
  try {
    const current = await published(db), notice = (await inbox(db)).rows[0];
    await assert.rejects(db.query('UPDATE portal_notifications SET source_revision=999 WHERE id=$1', [notice.id]), /immutable/i);
    await assert.rejects(db.query('UPDATE portal_notifications SET subject_student_id=NULL WHERE id=$1', [notice.id]), /immutable/i);
    await assert.rejects(db.query("UPDATE portal_notifications SET title='Rewritten message' WHERE id=$1", [notice.id]), /immutable/i);
    const insert = 'INSERT INTO portal_notifications(user_id,source_key,category,title,body,href,source_type,source_id,source_revision,subject_student_id) VALUES($1,$2,\'events\',\'Unapproved\',\'Body\',\'/calendar\',\'academy_event\',$3,$4,$5)';
    await assert.rejects(db.query(insert, [studentUser, 'bad-revision', current.event.id, 999, 'STU-M-001']), /foreign key/i);
    await assert.rejects(db.query(insert, [studentUser, 'missing-subject', current.event.id, current.event.published_revision, null]), /check constraint/i);
    await assert.rejects(db.query("UPDATE academy_event_revisions SET public_payload='{}' WHERE event_id=$1", [current.event.id]), /immutable/i);
    assert.equal((await db.query('SELECT public_payload FROM academy_event_revisions WHERE event_id=$1', [current.event.id])).rows[0].public_payload.title, event.title);
    const classChange = await published(db, { ...event, type: 'class_change' });
    assert.equal(classChange.event.published_payload.type, 'class_change');
    assert.equal((await db.query('SELECT count(*)::int n FROM class_occurrences')).rows[0].n, 0, 'an informational class-change event does not edit the timetable');
    assert.equal((await db.query('SELECT count(*)::int n FROM membership_invoices')).rows[0].n, 0, 'an informational event does not alter tuition');
    await db.exec("UPDATE academy_profile SET allow_student_portal_login=false WHERE id='default'; INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('stray-settings','Other settings',true)");
    await assert.rejects(mutate(db, 'notice', current.event.id, { expectedRevision: current.event.revision }), /disabled/i, 'a noncanonical settings row cannot reopen the student switch');
  } finally { await db.close(); }
});

test('expired, future and wrong-scope calendar cursors are conflicts that clients can recover by reloading', () => {
  const cursor = loadTs('lib/calendar-cursor.ts');
  const previousKey = process.env.PORTAL_CURSOR_SECRET, before = Date.now;
  process.env.PORTAL_CURSOR_SECRET = 'fixture-cursor-key-for-reliability-only';
  try {
    let time = 2_000_000_000_000;
    Date.now = () => time;
    const value = cursor.encodeCalendarCursor('student-and-period', randomUUID());
    const conflict = error => error.code === '40001';
    assert.throws(() => cursor.decodeCalendarCursor(value, 'different-account'), conflict);
    time += 3_600_001;
    assert.throws(() => cursor.decodeCalendarCursor(value, 'student-and-period'), conflict);
    time -= 3_600_002;
    assert.throws(() => cursor.decodeCalendarCursor(value, 'student-and-period'), conflict);
    assert.throws(() => cursor.decodeCalendarCursor('malformed', 'student-and-period'), conflict);
  } finally { Date.now = before; if (previousKey === undefined) delete process.env.PORTAL_CURSOR_SECRET; else process.env.PORTAL_CURSOR_SECRET = previousKey; }
});
