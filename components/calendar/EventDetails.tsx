import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { Archive, CalendarDays, Clock3, MapPin, Users, Bell, Pencil } from 'lucide-react';
import { CalendarDialog } from './CalendarDialog';
import { EventBadge, EventState } from './EventBadge';
import { EventFiles } from './EventFiles';
import { dateLabel, eventDates, eventTime } from './calendar-dates';
import type { CalendarData, EventRecord } from './types';
import styles from './calendar.module.css';

export function audienceLabel(event: Pick<EventRecord, 'audience'>, lookups?: CalendarData['lookups']): string {
  const audience = event.audience;
  if (audience.mode === 'all') return 'All students';
  if (audience.mode === 'staff') return 'Staff only';
  if (audience.mode === 'branches') return audience.branchIds.map(id => lookups?.branches.find(row => row.id === id)?.name ?? `Branch ${id}`).join(', ');
  if (audience.mode === 'classes') return audience.classIds.map(id => lookups?.classes.find(row => row.id === id)?.name ?? `Class ${id}`).join(', ');
  return `${audience.studentIds.length} selected student${audience.studentIds.length === 1 ? '' : 's'}`;
}
export function EventDetails({ event, data, busy, error, onClose, onEdit, onPublish, onNotify, onArchive }: {
  event: EventRecord; data: CalendarData; busy: boolean; error?: string; onClose: () => void; onEdit: () => void; onPublish: () => void; onNotify: () => void; onArchive: (reason: string) => Promise<boolean>;
}) {
  const archiveFormId = useId();
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const archived = Boolean(event.archivedAt);
  const mayEdit = !archived && data.permissions.edit && event.editable !== false;
  const mayPublish = !archived && data.permissions.publish && event.editable !== false;
  const mayArchive = !archived && data.permissions.archive === true;
  const publishNeeded = event.publishedRevision === null || event.hasUnpublishedChanges;
  const notified = !publishNeeded && event.lastNotifiedRevision === event.publishedRevision;
  async function archive(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    const reason = archiveReason.trim();
    if (busy || !mayArchive || reason.length < 5 || reason.length > 1000) return;
    if (await onArchive(reason)) { setArchiving(false); setArchiveReason(''); }
  }
  return <CalendarDialog title={event.title} onClose={onClose} busy={busy} sheet subtitle={<div className={styles.row} style={{ flexWrap: 'wrap' }}><EventBadge type={event.type}/><EventState event={event}/></div>} footer={<>
    {archiving && !archived ? <>
      <button type="button" className={styles.button} disabled={busy} onClick={() => setArchiving(false)}>Keep event</button>
      <button type="submit" form={archiveFormId} className={`${styles.button} ${styles.primary}`} disabled={busy || !mayArchive || archiveReason.trim().length < 5}>Confirm archive</button>
    </> : <>
      {mayEdit && <button type="button" className={styles.button} disabled={busy} onClick={onEdit}><Pencil size={15}/>Edit</button>}
      {mayPublish && publishNeeded && <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={onPublish}>Review & publish</button>}
      {!archived && data.permissions.notify && event.editable !== false && !publishNeeded && event.audience.mode !== 'staff' && <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy || notified} onClick={onNotify}><Bell size={15}/>{notified ? 'Notification queued' : 'Notify students'}</button>}
      {mayArchive && <button type="button" className={styles.button} disabled={busy} onClick={() => setArchiving(true)}><Archive size={15} aria-hidden="true"/>Archive event</button>}
    </>}
    <button type="button" className={styles.button} disabled={busy} onClick={onClose}>Close</button>
  </>}>
    <div className={styles.dialogBody}>
      {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
      {archived && <div className={styles.notice}><div><strong>Archived · staff history</strong><p>This event is no longer available in the student calendar or inbox. Existing achievements and event history are retained.</p>{event.archiveReason && <p className={styles.description}>{event.archiveReason}</p>}</div></div>}
      {archiving && !archived && <form id={archiveFormId} onSubmit={archive} className={styles.notice}><div><strong>Archive this event?</strong><p>Withdraw it from the student calendar, event files and inbox. Event history and linked achievements will be retained. This action cannot be undone here.</p></div><label className={`${styles.field} ${styles.archiveReason}`}>Reason for archiving<textarea aria-label="Reason for archiving" value={archiveReason} onChange={input => setArchiveReason(input.target.value)} minLength={5} maxLength={1000} required disabled={busy} autoFocus aria-describedby={`${archiveFormId}-hint`}/><span id={`${archiveFormId}-hint`} className={styles.hint}>Record a clear reason for the staff activity history.</span></label></form>}
      {!archived && publishNeeded && event.publishedRevision !== null && <div className={styles.notice}>You are viewing working changes. Students still see the last published version.</div>}
      <div className={styles.detailLine}><CalendarDays size={18}/><div><strong>{eventDates(event)}</strong><span className={styles.muted}>{dateLabel(event.startDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div></div>
      <div className={styles.detailLine}><Clock3 size={18}/><div><strong>{eventTime(event)}</strong><span className={styles.muted}>{event.timezone}</span></div></div>
      <div className={styles.detailLine}><MapPin size={18}/><div><strong>{event.location || 'Location to be confirmed'}</strong></div></div>
      <div className={styles.detailLine}><Users size={18}/><div><strong>{audienceLabel(event, data.lookups)}</strong><span className={styles.muted}>Audience membership is checked when a notice is sent.</span></div></div>
      {event.previousStartDate && event.previousStartDate !== event.startDate && <div className={styles.notice}><div><strong>Date updated</strong><p>Previously {dateLabel(event.previousStartDate)} → now {dateLabel(event.startDate)}.</p>{event.changeReason && <p>{event.changeReason}</p>}</div></div>}
      <h3 className={styles.sectionTitle}>About this event</h3><p className={styles.description}>{event.description || 'No description has been added.'}</p>
      <h3 className={styles.sectionTitle}>Documents & pictures</h3>
      <EventFiles eventId={event.id} files={event.attachments}/>
      {event.internalNotes && <div className={styles.notice} style={{ marginTop: '1rem' }}><div><strong>Staff notes · private</strong><p className={styles.description}>{event.internalNotes}</p></div></div>}
      <h3 className={styles.sectionTitle}>Class schedule</h3><p className={styles.muted}>An event notice does not change class attendance or tuition. Review closures and rescheduling in <Link href="/operations?view=sessions" className="underline">Dated classes</Link>.</p>
      {event.type === 'competition' && <><h3 className={styles.sectionTitle}>Student data</h3><p className={styles.muted}>Record achievements in the student profile. Select this competition title there, or enter a name manually when no event exists.</p></>}
    </div>
  </CalendarDialog>;
}
