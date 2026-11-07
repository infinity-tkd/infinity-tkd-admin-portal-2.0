import { audienceLabel } from './EventDetails';
import { studentNoticePreview } from './calendar-notice';
import type { CalendarData, EventRecord } from './types';
import styles from './calendar.module.css';

export function EventNoticePreview({ event, data }: { event: EventRecord; data: CalendarData }) {
  const preview = studentNoticePreview(event);
  return <section aria-label="Student notification preview" className={styles.notice}>
    <div className={styles.noticePreview}>
      <h4 className={styles.sectionTitle}>Student notification preview</h4>
      <strong className={styles.description}>{preview.title}</strong>
      <p className={styles.description}>{preview.body}</p>
      <h4 className={styles.sectionTitle}>Audience</h4>
      <p className={styles.description}>{audienceLabel(event, data.lookups)}</p>
      <p className={styles.hint}>Only eligible linked accounts receive an inbox notice. Device delivery and read status are recorded separately.</p>
    </div>
  </section>;
}
