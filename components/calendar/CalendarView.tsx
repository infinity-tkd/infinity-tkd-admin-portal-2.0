'use client';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { addCalendarDays, academyDate } from '@/lib/dates';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import { useNotificationTarget } from '@/hooks/use-notification-target';
import { EventAgenda, EventMonthGrid, EventRow, UpcomingEvents } from './CalendarDisplay';
import { EventDetails } from './EventDetails';
import { EventEditor } from './EventEditor';
import { EventPublishReview } from './EventPublishReview';
import { EventNotifyReview } from './EventNotifyReview';
import { dateLabel, monthDays, shiftMonth } from './calendar-dates';
import { useCalendarEvents } from './use-calendar-events';
import { eventTypes, typeNames, type CalendarData, type EventDraft, type EventRecord, type EventType } from './types';
import styles from './calendar.module.css';

const empty: CalendarData = { events: [], lookups: { branches: [], classes: [], students: [] }, permissions: { create: false, edit: false, publish: false, notify: false } };
const compactQuery = '(max-width: 760px)';
function subscribeCompact(callback: () => void) { const media = window.matchMedia(compactQuery); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); }
const compactSnapshot = () => window.matchMedia(compactQuery).matches;

export function CalendarView() {
  const { state } = useAppStore();
  return <CalendarWorkspace key={state.currentUser?.id ?? 'signed-out'}/>;
}

function CalendarWorkspace() {
  const today = academyDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [tab, setTab] = useState<'calendar' | 'events'>('calendar');
  const [display, setDisplay] = useState<'month' | 'agenda' | null>(null);
  const [type, setType] = useState<EventType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [editor, setEditor] = useState<{ event: EventRecord | null } | null>(null);
  const [review, setReview] = useState<'publish' | 'notify' | null>(null);
  const [targetError, setTargetError] = useState('');
  const target = useRef(0);
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false);
  const mode = display ?? (compact ? 'agenda' : 'month');
  const days = monthDays(month);
  const api = useCalendarEvents(days[0], addCalendarDays(days[41], 1));
  const data = api.data ?? empty;
  const events = useMemo(() => data.events.filter(event => (type === 'all' || event.type === type) && (!search || `${event.title} ${event.location}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title)), [data.events, type, search]);

  useNotificationTarget(url => {
    const id = url.searchParams.get('event');
    if (url.pathname !== '/calendar' || !id) return;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) { setTargetError('This event link is invalid.'); return; }
    const request = ++target.current;
    void portalRequest<{ event: EventRecord }>(`/api/admin/events/${encodeURIComponent(id)}`).then(result => {
      if (request !== target.current) return;
      setTargetError(''); setMonth(result.event.startDate.slice(0, 7)); setSelected(result.event);
    }).catch(cause => { if (request === target.current) setTargetError(cause instanceof Error ? cause.message : 'The event could not be opened.'); });
  });

  function open(event: EventRecord) { target.current++; setSelected(event); setTargetError(''); }
  function close() {
    if (api.busy) return;
    target.current++;
    const id = selected?.id;
    setSelected(null); setEditor(null); setReview(null);
    if (id) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-calendar-event="${CSS.escape(id)}"]`)?.focus());
  }
  function changeMonth(delta: number) { target.current++; setMonth(previous => shiftMonth(previous, delta)); setSelectedDay(null); }
  async function save(draft: EventDraft): Promise<boolean> {
    const original = editor?.event;
    const saved = await api.run(original ? `/api/admin/events/${original.id}` : '/api/admin/events', { ...draft, ...(original ? { expectedRevision: original.revision } : {}) }, original ? 'PATCH' : 'POST');
    if (!saved) return false;
    setMonth(saved.startDate.slice(0, 7)); setSelected(saved); setEditor(null); setReview(null);
    return true;
  }
  async function publish(notifyStudents: boolean) {
    if (!selected) return;
    const saved = await api.run(`/api/admin/events/${selected.id}/publications`, { expectedRevision: selected.revision, notifyStudents });
    if (saved) { setSelected(saved); setReview(null); }
  }
  async function notify() {
    if (!selected) return;
    const saved = await api.run(`/api/admin/events/${selected.id}/notices`, { expectedRevision: selected.revision });
    if (saved) { setSelected(saved); setReview(null); }
  }
  async function archive(reason: string): Promise<boolean> {
    if (!selected) return false;
    const saved = await api.run(`/api/admin/events/${selected.id}/archive`, { expectedRevision: selected.revision, reason });
    if (!saved) return false;
    setSelected(saved);
    return true;
  }
  const error = targetError || api.error;
  return <div className={`${styles.theme} ${styles.workspace}`}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Academy life, in one place</p><h1 className={styles.heading}>Calendar & Events</h1><p className={styles.subtitle}>Plan clearly. Keep students informed.</p></div><div className={styles.actions}><button type="button" className={styles.iconButton} disabled={api.loading || api.busy} onClick={() => void api.refresh()} aria-label="Refresh calendar"><RefreshCw size={17}/></button>{data.permissions.create && <button type="button" className={`${styles.button} ${styles.primary}`} disabled={api.busy} onClick={() => { setSelected(null); setEditor({ event: null }); }}><Plus size={17}/>New event</button>}</div></header>
    <nav className={styles.tabs} role="tablist" aria-label="Calendar workspace">{(['calendar', 'events'] as const).map(view => <button type="button" key={view} id={`calendar-tab-${view}`} role="tab" tabIndex={tab === view ? 0 : -1} aria-selected={tab === view} aria-controls="calendar-workspace-content" className={styles.tab} onClick={() => { setTab(view); setSearch(''); setSelectedDay(null); }} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 'calendar' : event.key === 'End' ? 'events' : view === 'calendar' ? 'events' : 'calendar'; setTab(next); setSearch(''); setSelectedDay(null); document.getElementById(`calendar-tab-${next}`)?.focus(); }}>{view === 'calendar' ? 'Calendar' : 'Events'}</button>)}</nav>
    {error && !selected && !editor && <div className={`${styles.notice} ${styles.error}`} role="alert"><span>{error}</span><button type="button" className={styles.button} onClick={() => void api.refresh()} disabled={api.loading || api.busy}>Retry</button></div>}
    {api.feedback && !selected && !editor && <p role="status" className={`${styles.notice} ${styles.success}`}>{api.feedback}</p>}
    <div id="calendar-workspace-content" role="tabpanel" aria-labelledby={`calendar-tab-${tab}`} aria-busy={api.loading}>
      <div className={tab === 'calendar' ? styles.layout : ''}><section className={styles.card}>
        <div className={styles.toolbar}><div className={styles.row}><button type="button" className={styles.iconButton} aria-label="Previous month" disabled={api.busy || month <= '2000-01'} onClick={() => changeMonth(-1)}><ChevronLeft size={17}/></button><h2>{dateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}</h2><button type="button" className={styles.iconButton} aria-label="Next month" disabled={api.busy || month >= '2100-12'} onClick={() => changeMonth(1)}><ChevronRight size={17}/></button><button type="button" className={styles.button} disabled={api.busy} onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(null); }}>Today</button></div>{tab === 'calendar' && <div className={styles.segments} aria-label="Calendar display"><button type="button" className={styles.segment} aria-pressed={mode === 'month'} onClick={() => { setDisplay('month'); setSelectedDay(null); }}>Month</button><button type="button" className={styles.segment} aria-pressed={mode === 'agenda'} onClick={() => setDisplay('agenda')}>Agenda</button></div>}</div>
        <div className={styles.filters}><button type="button" className={styles.filter} aria-pressed={type === 'all'} onClick={() => setType('all')}>All types</button>{eventTypes.map(kind => <button type="button" key={kind} className={`${styles.filter} ${styles[kind]}`} aria-pressed={type === kind} onClick={() => setType(kind)}><span className={styles.dot} aria-hidden="true"/>{typeNames[kind]}</button>)}</div>
        {selectedDay && mode === 'agenda' && <div className={styles.notice} style={{ marginInline: '1rem' }}><span>Events on {dateLabel(selectedDay)}</span><button type="button" className={styles.button} onClick={() => setSelectedDay(null)}>Show month</button></div>}
        {tab === 'events' && <div className={styles.search} style={{ paddingInline: '1rem' }}><input aria-label="Search events in selected period" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events in this period…"/></div>}
        {api.loading && !api.data ? <div role="status" className={styles.skeleton}><p className={styles.muted}>Loading academy events…</p>{[1, 2, 3, 4].map(row => <div key={row} className={styles.skeletonLine}/>)}</div> : !api.data && api.error ? <div className={styles.empty}><strong>Events could not be loaded</strong>Use Retry above to reconnect to the academy calendar.</div> : tab === 'calendar' ? mode === 'month' ? <EventMonthGrid month={month} today={today} events={events} onOpen={open} onMore={day => { setSelectedDay(day); setDisplay('agenda'); }}/>: <EventAgenda month={month} day={selectedDay} events={events} onOpen={open}/> : events.length ? events.map(event => <EventRow key={event.id} event={event} onOpen={open}/>) : <div className={styles.empty}><strong>No events found</strong>{search ? 'Try another search or date period.' : 'Create an event to start planning the academy calendar.'}</div>}
        <div className={styles.legend}><span>{!api.data && api.error ? 'Events unavailable' : api.loading && api.data ? 'Refreshing…' : `${events.length} event${events.length === 1 ? '' : 's'} in view`}</span><span>Academy time · Drafts stay private</span></div>
        {data.nextCursor && <div style={{ padding: '0 1rem 1rem' }}><button type="button" className={styles.button} disabled={api.loading || api.busy} onClick={() => void api.refresh(data.nextCursor ?? undefined)}>{api.loading ? 'Loading…' : 'Load more events'}</button></div>}
      </section>{tab === 'calendar' && api.data && <UpcomingEvents events={events} today={today} onOpen={open}/>}</div>
    </div>
    {editor && <EventEditor key={editor.event?.id ?? 'new'} event={editor.event} initialDate={selectedDay ?? (month === today.slice(0, 7) ? today : `${month}-01`)} data={data} busy={api.busy} error={api.error} onClose={() => { if (!api.busy) setEditor(null); }} onSave={save}/>}
    {selected && !editor && !review && <EventDetails event={selected} data={data} busy={api.busy} error={api.error} onClose={close} onEdit={() => setEditor({ event: selected })} onPublish={() => setReview('publish')} onNotify={() => setReview('notify')} onArchive={archive}/>}
    {selected && review === 'publish' && !editor && <EventPublishReview key={`${selected.id}:${selected.revision}`} event={selected} data={data} busy={api.busy} error={api.error} onClose={() => { if (!api.busy) setReview(null); }} onPublish={publish}/>}
    {selected && review === 'notify' && !editor && <EventNotifyReview key={`${selected.id}:${selected.revision}`} event={selected} data={data} busy={api.busy} error={api.error} onClose={() => { if (!api.busy) setReview(null); }} onNotify={notify}/>}
  </div>;
}
