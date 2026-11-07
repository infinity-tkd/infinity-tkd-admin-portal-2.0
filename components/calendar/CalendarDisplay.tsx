import { ArrowRight } from 'lucide-react';
import { EventBadge, EventState } from './EventBadge';
import { dateLabel, eventDates, eventTime, monthDays } from './calendar-dates';
import type { EventRecord } from './types';
import styles from './calendar.module.css';

export function EventRow({ event, onOpen, showDate = true }: { event: EventRecord; onOpen: (event: EventRecord) => void; showDate?: boolean }) {
  return <article className={styles.listRow}>
    {showDate && <div className={styles.dateTile}><small>{dateLabel(event.startDate, { month: 'short' })}</small><strong>{Number(event.startDate.slice(-2))}</strong></div>}
    <div className={styles.listContent}><div className={styles.row} style={{ flexWrap: 'wrap', gap: '.35rem' }}><EventBadge type={event.type}/><EventState event={event}/></div><h3>{event.title}</h3><p className={styles.muted}>{eventDates(event)} · {eventTime(event)}{event.location ? ` · ${event.location}` : ''}</p></div>
    <button type="button" data-calendar-event={event.id} className={styles.listOpen} onClick={() => onOpen(event)} aria-label={`Open ${event.title}`}><ArrowRight size={17}/></button>
  </article>;
}

export function EventMonthGrid({ month, today, events, onOpen, onMore }: {
  month: string; today: string; events: EventRecord[]; onOpen: (event: EventRecord) => void; onMore: (day: string) => void;
}) {
  return <section aria-label={dateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}>
    <div className={styles.weekdays} aria-hidden="true">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => <span key={day}>{day}</span>)}</div>
    <div className={styles.monthGrid}>{monthDays(month).map(day => {
      const dayEvents = events.filter(event => event.startDate <= day && event.endDate >= day);
      return <article key={day} className={`${styles.day} ${day.startsWith(month) ? '' : styles.outside}`} aria-label={dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}>
        <span className={`${styles.dayNumber} ${day === today ? styles.today : ''}`} aria-current={day === today ? 'date' : undefined}>{Number(day.slice(-2))}</span>
        {dayEvents.slice(0, 2).map(event => <button type="button" key={event.id} data-calendar-event={event.id} className={`${styles.event} ${styles[event.type]} ${event.publishedRevision === null ? styles.draft : ''} ${event.lifecycle === 'cancelled' ? styles.cancelled : ''} ${event.archivedAt ? styles.archived : ''}`} title={`${event.title} · ${eventDates(event)}`} aria-label={`${event.title} on ${day}${event.archivedAt ? ', archived' : event.lifecycle === 'cancelled' ? ', cancelled' : event.publishedRevision === null ? ', draft' : ''}`} onClick={() => onOpen(event)}>{event.archivedAt ? 'Archived · ' : event.publishedRevision === null ? 'Draft · ' : ''}{!event.archivedAt && event.lifecycle === 'cancelled' ? 'Cancelled · ' : ''}{event.title}</button>)}
        {dayEvents.length > 2 && <button type="button" className={styles.more} onClick={() => onMore(day)} aria-label={`View all ${dayEvents.length} events on ${dateLabel(day)}`}>+{dayEvents.length - 2} more</button>}
      </article>;
    })}</div>
  </section>;
}

export function EventAgenda({ events, month, day, onOpen }: { events: EventRecord[]; month: string; day?: string | null; onOpen: (event: EventRecord) => void }) {
  const first = `${month}-01`;
  const rows = events.filter(event => day ? event.startDate <= day && event.endDate >= day : event.startDate.slice(0, 7) <= month && event.endDate >= first);
  const groups = new Map<string, EventRecord[]>();
  for (const event of rows) {
    const group = day ?? (event.startDate < first ? first : event.startDate);
    groups.set(group, [...(groups.get(group) ?? []), event]);
  }
  if (!rows.length) return <div className={styles.empty}><strong>No events in this period</strong>Published events and private drafts will appear here.</div>;
  return <div>{[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, records]) => <section key={date}><h3 className={styles.agendaDay}>{dateLabel(date, { weekday: 'short', day: 'numeric', month: 'long' })}</h3>{records.map(event => <EventRow key={event.id} event={event} onOpen={onOpen} showDate={false}/>)}</section>)}</div>;
}

export function UpcomingEvents({ events, today, onOpen }: { events: EventRecord[]; today: string; onOpen: (event: EventRecord) => void }) {
  const upcoming = events.filter(event => !event.archivedAt && event.endDate >= today && event.lifecycle !== 'cancelled').slice(0, 4);
  return <aside className={styles.aside}><section className={styles.card}><h2 className={styles.asideHeading}>Coming up <span className={styles.pill}>{upcoming.length}</span></h2>{upcoming.map(event => <button type="button" key={event.id} className={styles.upcoming} onClick={() => onOpen(event)}><EventBadge type={event.type}/><strong>{event.title}</strong><span className={styles.muted}>{eventDates(event)}{event.location ? ` · ${event.location}` : ''}</span></button>)}{!upcoming.length && <p className={styles.asideNote}>No upcoming events in the selected period.</p>}</section><section className={`${styles.card} ${styles.asideNote}`}><strong>Keep the academy informed.</strong>Publish an event, then choose Notify students when an update needs their attention. Class changes stay in Dated classes.</section></aside>;
}
