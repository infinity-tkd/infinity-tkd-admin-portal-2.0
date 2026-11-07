'use client';
import { useId, useState } from 'react';
import { CalendarDialog } from './CalendarDialog';
import { EventBadge } from './EventBadge';
import { EventNoticePreview } from './EventNoticePreview';
import type { CalendarData, EventRecord } from './types';
import styles from './calendar.module.css';

export function EventNotifyReview({ event, data, busy, error, onClose, onNotify }: {
  event: EventRecord; data: CalendarData; busy: boolean; error: string;
  onClose: () => void; onNotify: () => Promise<void>;
}) {
  const id = useId();
  const [reviewed, setReviewed] = useState(false);
  const eligible = !event.archivedAt && event.publishedRevision !== null && !event.hasUnpublishedChanges && event.audience.mode !== 'staff' && data.permissions.notify;
  return <CalendarDialog title="Review student notification" subtitle={<EventBadge type={event.type}/>} onClose={onClose} busy={busy} footer={<>
    <button type="button" className={styles.button} disabled={busy} onClick={onClose}>Back to event</button>
    <button form={id} type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy || !eligible}>{busy ? 'Notifying…' : 'Confirm notification'}</button>
  </>}>
    <form id={id} className={styles.form} onSubmit={submission => { submission.preventDefault(); if (reviewed && eligible && !busy) void onNotify(); }}><div className={styles.dialogBody}>
      <p className={styles.subtitle}>Review the current published revision before adding this message to student inboxes.</p>
      <EventNoticePreview event={event} data={data}/>
      <label className={styles.checkbox}><input type="checkbox" checked={reviewed} onChange={input => setReviewed(input.target.checked)} required disabled={busy || !eligible}/><span>I reviewed the message and intended audience.</span></label>
      {!eligible && <p role="alert" className={`${styles.notice} ${styles.error}`}>This revision is not available for student notification. Return to the event and refresh its saved state.</p>}
      {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
    </div></form>
  </CalendarDialog>;
}
