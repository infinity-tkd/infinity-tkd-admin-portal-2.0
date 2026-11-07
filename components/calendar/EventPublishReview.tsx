'use client';
import { useId, useState } from 'react';
import { CalendarDialog } from './CalendarDialog';
import { EventBadge } from './EventBadge';
import { EventNoticePreview } from './EventNoticePreview';
import { audienceLabel } from './EventDetails';
import { eventDates, eventTime } from './calendar-dates';
import type { CalendarData, EventRecord } from './types';
import styles from './calendar.module.css';

export function EventPublishReview({ event, data, busy, error, onClose, onPublish }: { event: EventRecord; data: CalendarData; busy: boolean; error: string; onClose: () => void; onPublish: (notify: boolean) => Promise<void> }) {
  const id = useId();
  const [reviewed, setReviewed] = useState(false), [notify, setNotify] = useState(false);
  return <CalendarDialog title="Review & publish" subtitle={<EventBadge type={event.type}/>} onClose={onClose} busy={busy} footer={<><button type="button" className={styles.button} disabled={busy} onClick={onClose}>Keep editing</button><button form={id} type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? 'Publishing…' : 'Publish event'}</button></>}>
    <form id={id} className={styles.form} onSubmit={submission => { submission.preventDefault(); if (reviewed) void onPublish(notify); }}><div className={styles.dialogBody}>
      <h3 style={{ fontWeight: 700 }}>{event.title}</h3><p className={styles.subtitle}>{eventDates(event)} · {eventTime(event)} · {event.timezone}</p>
      <h4 className={styles.sectionTitle}>Visible to</h4><p className={styles.description}>{audienceLabel(event, data.lookups)}</p>
      <h4 className={styles.sectionTitle}>Public description</h4><p className={styles.description}>{event.description || 'No description.'}</p>
      {event.attachments.length > 0 && <><h4 className={styles.sectionTitle}>Linked resources</h4><ul className={styles.muted}>{event.attachments.map((file, index) => <li key={file.id ?? index}>{file.label}{!file.studentAvailable ? ' · student access pending verification' : ''}</li>)}</ul></>}
      <div className={styles.notice} style={{ marginTop: '1rem' }}>This publishes the saved event revision. Regular classes, attendance and tuition remain unchanged.</div>
      <label className={styles.checkbox}><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} required disabled={busy}/><span>I reviewed the public content, audience and event dates.</span></label>
      {data.permissions.notify && event.audience.mode !== 'staff' && <label className={styles.checkbox}><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} disabled={busy}/><span>Notify students after publishing<span className={styles.hint}>Queue an update for the eligible audience using the existing notification service.</span></span></label>}
      {data.permissions.notify && event.audience.mode !== 'staff' && <EventNoticePreview event={event} data={data}/>}
      {event.audience.mode === 'staff' && <p className={styles.hint}>Staff-only content is excluded from student notifications.</p>}
      {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
    </div></form>
  </CalendarDialog>;
}
