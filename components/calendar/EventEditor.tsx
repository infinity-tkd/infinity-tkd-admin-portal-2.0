'use client';
import { useId, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addCalendarDays, isCalendarDate } from '@/lib/dates';
import { CalendarDialog } from './CalendarDialog';
import { EventFileUpload } from './EventFileUpload';
import { inputTime, venueDate, venueTimestamp } from './calendar-dates';
import { eventTypes, typeNames, type CalendarData, type EventAudience, type EventDraft, type EventRecord } from './types';
import styles from './calendar.module.css';

export function EventEditor({ event, initialDate, data, busy: saving, error, onClose, onSave }: {
  event: EventRecord | null; initialDate: string; data: CalendarData; busy: boolean; error: string;
  onClose: () => void; onSave: (draft: EventDraft) => Promise<boolean>;
}) {
  const id = useId();
  const [value, setValue] = useState<EventDraft>(() => event ? draftFields(event) : {
    title: '', type: 'academy', lifecycle: 'scheduled', startDate: initialDate, endDate: initialDate,
    startsAt: null, endsAt: null, timezone: 'Asia/Phnom_Penh', location: '', description: '', internalNotes: '',
    audience: { mode: 'all', branchIds: [], classIds: [], studentIds: [] }, attachments: [], changeReason: '',
  });
  const [allDay, setAllDay] = useState(!event?.startsAt);
  const [endInputDate, setEndInputDate] = useState(event?.endsAt ? venueDate(event.endsAt, value.timezone) : event?.endDate ?? initialDate);
  const [startTime, setStartTime] = useState(inputTime(event?.startsAt ?? null, value.timezone));
  const [endTime, setEndTime] = useState(event?.endsAt ? inputTime(event.endsAt, value.timezone) : '17:00');
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  const reasonRequired = event?.publishedRevision != null || ['cancelled', 'postponed'].includes(value.lifecycle);
  const set = <K extends keyof EventDraft>(key: K, next: EventDraft[K]) => setValue(previous => ({ ...previous, [key]: next }));
  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault(); if (busy) return; setFormError('');
    try {
      if (!value.title.trim()) throw new Error('Enter an event title.');
      const endInput = allDay ? value.endDate : endInputDate;
      if (!isCalendarDate(value.startDate) || !isCalendarDate(endInput) || endInput < value.startDate) throw new Error('The last day must be on or after the first day.');
      if (reasonRequired && value.changeReason.trim().length < 5) throw new Error('Explain the change in at least five characters.');
      if (value.audience.mode === 'branches' && !value.audience.branchIds.length || value.audience.mode === 'classes' && !value.audience.classIds.length || value.audience.mode === 'students' && !value.audience.studentIds.length) throw new Error('Select at least one recipient group for this audience.');
      const startsAt = allDay ? null : venueTimestamp(value.startDate, startTime, value.timezone);
      const endsAt = allDay ? null : venueTimestamp(endInputDate, endTime, value.timezone);
      if (startsAt && endsAt && endsAt <= startsAt) throw new Error('The end time must follow the start time.');
      const endDate = endsAt ? venueDate(Date.parse(endsAt) - 1, value.timezone) : value.endDate;
      if (Date.parse(endDate) - Date.parse(value.startDate) > 366 * 86400000) throw new Error('Choose an end date within one year of the first day.');
      if (value.lifecycle === 'completed' && (endsAt ? Date.parse(endsAt) > Date.now() : endDate > venueDate(Date.now(), value.timezone))) throw new Error('An event can be marked completed after it has ended.');
      const attachments = value.attachments.map(file => {
        const url = new URL(file.url);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || /^(localhost|127\.|0\.|\[)/i.test(url.hostname) || !file.label.trim()) throw new Error('Attachments need a label and an approved HTTPS link without credentials.');
        return { ...(file.id ? { id: file.id } : {}), label: file.label.trim(), url: url.href };
      });
      const saved = await onSave({ ...value, title: value.title.trim(), endDate, startsAt, endsAt, attachments });
      if (!saved) setFormError('The draft was not saved. Review the error below before retrying.');
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Review the event fields and try again.'); }
  }
  const errorMessage = error || formError;
  return <CalendarDialog title={event ? 'Edit event' : 'New event'} subtitle={<p className={styles.eyebrow}>Save a private draft first</p>} onClose={onClose} busy={busy} footer={<><button type="button" className={styles.button} onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form={id} className={`${styles.button} ${styles.primary}`} disabled={busy}>{uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save draft'}</button></>}>
    <form id={id} className={styles.form} onSubmit={submission => void submit(submission)}><div className={styles.dialogBody}><div className={styles.formGrid}>
      <label className={`${styles.field} ${styles.wide}`}>Event title<input aria-label="Event title" value={value.title} onChange={e => set('title', e.target.value)} required maxLength={200} disabled={busy} placeholder="e.g. Junior Poomsae workshop"/></label>
      <label className={styles.field}>Event type<select aria-label="Event type" value={value.type} onChange={e => set('type', e.target.value as EventDraft['type'])} disabled={busy}>{eventTypes.map(type => <option value={type} key={type}>{typeNames[type]}</option>)}</select>{value.type === 'class_change' && <span className={styles.hint}>This is an information notice. Confirm actual session changes in Dated classes before publishing.</span>}</label>
      <label className={styles.field}>Event status<select aria-label="Event status" value={value.lifecycle} onChange={e => set('lifecycle', e.target.value as EventDraft['lifecycle'])} disabled={busy}><option value="scheduled">Scheduled</option><option value="postponed">Postponed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></label>
      <label className={styles.field}>First day<input aria-label="First day" type="date" value={value.startDate} onChange={e => set('startDate', e.target.value)} required disabled={busy}/></label>
      <label className={styles.field}>{allDay ? 'Last day, inclusive' : 'End date'}<input aria-label={allDay ? 'Last day, inclusive' : 'End date'} type="date" value={allDay ? value.endDate : endInputDate} onChange={e => allDay ? set('endDate', e.target.value) : setEndInputDate(e.target.value)} min={value.startDate} required disabled={busy}/></label>
      <label className={`${styles.checkbox} ${styles.wide}`}><input type="checkbox" checked={allDay} onChange={e => { const next = e.target.checked; if (!next) setEndInputDate(endTime === '00:00' ? addCalendarDays(value.endDate, 1) : value.endDate); else { try { set('endDate', venueDate(Date.parse(venueTimestamp(endInputDate, endTime, value.timezone)) - 1, value.timezone)); } catch { set('endDate', endInputDate); } } setAllDay(next); }} disabled={busy}/><span>All-day event</span></label>
      {!allDay && <><label className={styles.field}>Start time<input aria-label="Start time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required disabled={busy}/></label><label className={styles.field}>End time<input aria-label="End time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required disabled={busy}/></label></>}
      <label className={`${styles.field} ${styles.wide}`}>Timezone<input aria-label="Timezone" value={value.timezone} readOnly/><span className={styles.hint}>Times use the event timezone, independent of your device.</span></label>
      <label className={`${styles.field} ${styles.wide}`}>Location<input aria-label="Location" value={value.location} onChange={e => set('location', e.target.value)} maxLength={240} disabled={busy}/></label>
      <label className={`${styles.field} ${styles.wide}`}>Description for students<textarea aria-label="Description for students" value={value.description} onChange={e => set('description', e.target.value)} maxLength={8000} disabled={busy} placeholder="What is happening, who it is for and what to bring."/></label>
      <AudienceEditor audience={value.audience} lookups={data.lookups} busy={busy} onChange={next => set('audience', next)}/>
      <label className={`${styles.field} ${styles.wide}`}>Staff notes · private<textarea aria-label="Staff notes · private" value={value.internalNotes} onChange={e => set('internalNotes', e.target.value)} maxLength={5000} disabled={busy}/><span className={styles.hint}>Excluded from student-facing content.</span></label>
      <fieldset className={`${styles.field} ${styles.wide}`}><legend>Pictures & documents</legend><span className={styles.hint}>Add approved HTTPS links. External file access remains controlled by its host; student downloads require backend verification. Do not make private student files public.</span>
        {value.attachments.map((file, index) => <div key={index} className={styles.attachment}><input aria-label={`Attachment ${index + 1} label`} placeholder="Document label" value={file.label} maxLength={120} disabled={busy} required onChange={e => set('attachments', value.attachments.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row))}/><input aria-label={`Attachment ${index + 1} HTTPS link`} type="url" readOnly={Boolean(file.id && file.url.includes('/storage/v1/object/authenticated/academy-events/'))} placeholder="https://…" value={file.url} maxLength={2048} disabled={busy} required onChange={e => set('attachments', value.attachments.map((row, rowIndex) => rowIndex === index ? { label: row.label, url: e.target.value } : row))}/><button className={styles.iconButton} type="button" disabled={busy} aria-label={`Remove attachment ${index + 1}`} onClick={() => set('attachments', value.attachments.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16}/></button></div>)}
        {value.attachments.length < 10 && <button type="button" className={styles.button} style={{ alignSelf: 'flex-start', marginTop: '.5rem' }} disabled={busy} onClick={() => set('attachments', [...value.attachments, { label: '', url: '' }])}><Plus size={15}/>Add link</button>}
        {event ? <EventFileUpload eventId={event.id} disabled={busy || value.attachments.length >= 10} onPending={setUploading} onUploaded={file => setValue(current => ({ ...current, attachments: current.attachments.some(row => row.id && row.id === file.id) ? current.attachments : [...current.attachments, file] }))}/> : <span className={styles.hint}>Save this draft first to upload private files.</span>}
        {uploading && <span role="status" className={styles.hint}>Uploading privately… Keep this event open until the upload finishes.</span>}
      </fieldset>
      <label className={`${styles.field} ${styles.wide}`}>Reason for change<input aria-label="Reason for change" value={value.changeReason} onChange={e => set('changeReason', e.target.value)} minLength={reasonRequired ? 5 : undefined} maxLength={1000} required={reasonRequired} disabled={busy}/><span className={styles.hint}>{reasonRequired ? 'Required for published changes, cancellations and postponements. ' : 'Optional public context. '}Visible to students in event changes and notifications. Use Staff notes for internal details.</span></label>
    </div>{errorMessage && <p className={`${styles.notice} ${styles.error}`} role="alert" style={{ marginTop: '1rem' }}>{errorMessage}</p>}<p className={styles.hint} style={{ marginTop: '1rem' }}>This saves event information only. Class closures and rescheduling are reviewed separately in Dated classes.</p></div></form>
  </CalendarDialog>;
}

function draftFields(event: EventRecord): EventDraft {
  return {
    title: event.title, type: event.type, lifecycle: event.lifecycle, startDate: event.startDate, endDate: event.endDate,
    startsAt: event.startsAt, endsAt: event.endsAt, timezone: event.timezone, location: event.location,
    description: event.description, internalNotes: event.internalNotes, audience: event.audience,
    attachments: event.attachments, changeReason: '',
  };
}

function AudienceEditor({ audience, lookups, busy, onChange }: { audience: EventAudience; lookups: CalendarData['lookups']; busy: boolean; onChange: (value: EventAudience) => void }) {
  const [query, setQuery] = useState('');
  const source = audience.mode === 'branches' ? lookups.branches : audience.mode === 'classes' ? lookups.classes : lookups.students;
  const selected: (string | number)[] = audience.mode === 'branches' ? audience.branchIds : audience.mode === 'classes' ? audience.classIds : audience.studentIds;
  const matches = source.filter(row => !query || row.name.toLowerCase().includes(query.toLowerCase()) || String(row.id).toLowerCase().includes(query.toLowerCase()));
  const records = matches.slice(0, 100);
  const toggle = (id: string | number) => {
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    onChange({ ...audience, ...(audience.mode === 'branches' ? { branchIds: next as number[] } : audience.mode === 'classes' ? { classIds: next as number[] } : { studentIds: next as string[] }) });
  };
  return <div className={`${styles.field} ${styles.wide}`}><label htmlFor="event-audience-mode">Audience</label><select id="event-audience-mode" value={audience.mode} disabled={busy} onChange={e => { setQuery(''); onChange({ mode: e.target.value as EventAudience['mode'], branchIds: [], classIds: [], studentIds: [] }); }}><option value="all">All students</option><option value="branches">Selected branches</option><option value="classes">Selected classes</option><option value="students">Selected students</option><option value="staff">Staff only</option></select>
    {!['all', 'staff'].includes(audience.mode) && <><input aria-label="Search audience options" type="search" placeholder="Search available recipients…" value={query} onChange={e => setQuery(e.target.value)} disabled={busy}/><div className={styles.choiceList}>{records.map(row => <label className={styles.checkbox} key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} disabled={busy}/><span>{row.name}</span></label>)}{!records.length && <p className={styles.hint}>No available records match. Try another group or search.</p>}</div><span className={styles.hint}>{selected.length} selected. Only recipients your role can access are listed.{matches.length > records.length ? ' Showing the first 100 matches; refine your search to see others.' : ''}</span></>}
    {audience.mode === 'branches' && <span className={styles.hint}>Includes students enrolled at a selected branch, even when their home branch differs.</span>}
  </div>;
}
