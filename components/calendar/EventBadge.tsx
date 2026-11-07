import { CalendarDays, Flag, Trophy, BookOpen, Wrench, GraduationCap } from 'lucide-react';
import { typeNames, type EventRecord, type EventType } from './types';
import styles from './calendar.module.css';
const icons = { holiday: Flag, competition: Trophy, workshop: BookOpen, maintenance: Wrench, academy: GraduationCap, class_change: CalendarDays };
export function EventBadge({ type }: { type: EventType }) { const Icon = icons[type]; return <span className={`${styles.badge} ${styles[type]}`}><Icon aria-hidden="true"/>{typeNames[type]}</span>; }
export function EventState({ event }: { event: EventRecord }) {
  const label = event.archivedAt ? 'Archived' : event.publishedRevision === null ? 'Draft' : event.hasUnpublishedChanges ? 'Unpublished changes' : event.lifecycle === 'cancelled' ? 'Cancelled' : event.lifecycle === 'completed' ? 'Completed' : event.lifecycle === 'postponed' ? 'Postponed' : 'Published';
  return <span className={styles.pill}>{label}</span>;
}
