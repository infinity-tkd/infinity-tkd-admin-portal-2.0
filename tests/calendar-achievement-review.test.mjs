import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationsDatabase, root } from './fixtures/operations-db.mjs';

const calendarMigration = 'supabase/migrations/20261101030526_academy_calendar_and_student_notices.sql';
const achievementMigration = 'supabase/migrations/20261101033250_academy_event_achievement_links.sql';
const competition = {
  title: 'Historical championship', type: 'competition', lifecycle: 'scheduled',
  startDate: '2026-01-10', endDate: '2026-01-12', startsAt: null, endsAt: null,
  timezone: 'Asia/Phnom_Penh', location: 'Fixture dojo', description: '', internalNotes: '',
  audience: { mode: 'all', branchIds: [], classIds: [], studentIds: [] },
  attachments: [], changeReason: '',
};

async function database() {
  const db = await operationsDatabase();
  for (const file of [calendarMigration, 'supabase/migrations/20261012065927_portal_achievement_integrity.sql', achievementMigration]) {
    try { await db.exec(fs.readFileSync(file, 'utf8')); }
    catch (error) { await db.close(); throw new Error(`${file}: ${error.message} (${error.where ?? error.internalQuery ?? error.position ?? ''})`, { cause: error }); }
  }
  await db.exec('SET ROLE service_role');
  return db;
}

async function mutate(db, action, id, data) {
  return (await db.query('SELECT portal_calendar_mutate($1,$2,$3,$4,$5) result', [root, action, id, data, randomUUID()])).rows[0].result;
}

async function saveAchievement(db, eventId, date = '2026-01-10') {
  return db.query("SELECT portal_save_achievements($1,'STU-M-001',$2,'[]',$3) result", [root, [{
    eventId, eventName: competition.title, date,
    category: 'Recognized Poomsae', division: 'Junior', medalRank: 'Gold',
  }], randomUUID()]);
}

test('publication rechecks competition links added after a draft type change', async () => {
  const db = await database();
  try {
    const created = (await mutate(db, 'create', null, { event: competition })).event;
    const published = (await mutate(db, 'publish', created.id, { expectedRevision: created.revision, notifyStudents: false })).event;
    const edited = (await mutate(db, 'save', created.id, {
      expectedRevision: published.revision,
      event: { ...competition, type: 'workshop', changeReason: 'Draft classification correction' },
    })).event;
    await saveAchievement(db, created.id);
    await assert.rejects(
      mutate(db, 'publish', created.id, { expectedRevision: edited.revision, notifyStudents: false }),
      /competition|achievement/i,
    );
    const row = (await db.query('SELECT published_payload, revision FROM academy_events WHERE id=$1', [created.id])).rows[0];
    assert.equal(row.published_payload.type, 'competition', 'rejected publication retains the valid source');
    assert.equal(row.revision, edited.revision, 'failed publication does not advance the revision');
    assert.equal((await db.query('SELECT count(*)::int n FROM achievements WHERE event_id=$1', [created.id])).rows[0].n, 1);
  } finally { await db.close(); }
});

test('new competition links cannot attach an earlier achievement to a later edition', async () => {
  const db = await database();
  try {
    const laterEdition = { ...competition, startDate: '2026-02-10', endDate: '2026-02-12' };
    const created = (await mutate(db, 'create', null, { event: laterEdition })).event;
    await mutate(db, 'publish', created.id, { expectedRevision: created.revision, notifyStudents: false });
    await assert.rejects(saveAchievement(db, created.id, '2026-01-10'), /date|competition|event/i);
    assert.equal((await db.query('SELECT count(*)::int n FROM achievements')).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='ACHIEVEMENTS_SAVED'")).rows[0].n, 0, 'rejection leaves no success receipt');
    await saveAchievement(db, created.id, '2026-02-10');
    assert.equal((await db.query('SELECT count(*)::int n FROM achievements')).rows[0].n, 1, 'a result from the selected competition is accepted');
  } finally { await db.close(); }
});
