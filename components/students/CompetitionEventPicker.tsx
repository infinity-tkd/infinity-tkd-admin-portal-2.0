'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { portalRequest } from '@/lib/portal-api';

type Competition = { id: string; title: string; startDate: string };
export function CompetitionEventPicker({ eventId, eventName, disabled, onChange }: {
  eventId?: string | null; eventName: string; disabled?: boolean; onChange: (id: string | null, title: string) => void;
}) {
  const { can } = useAppStore(); const permitted = can('page:calendar');
  const [searching, setSearching] = useState(Boolean(eventId)), [query, setQuery] = useState(''), [items, setItems] = useState<Competition[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!searching || !permitted) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setItems([]);
      portalRequest<{ competitions: Competition[] }>('/api/admin/events/competitions?' + new URLSearchParams({ q: query }))
        .then(result => { if (active) { setItems(result.competitions); setError(''); } })
        .catch(cause => { if (active) { setItems([]); setError(cause instanceof Error ? cause.message : 'Competition events could not be loaded. You can still enter the name manually.'); } })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [searching, permitted, query]);
  return <div className="mb-4 space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">Competition source</span><div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} aria-pressed={!searching && !eventId} className="operation-control" onClick={() => { setSearching(false); onChange(null, eventName); }}>Enter manually</button>
      {permitted && <button type="button" disabled={disabled} aria-pressed={searching} className="operation-control" onClick={() => setSearching(true)}>Link calendar competition</button>}
    </div></div>
    {eventId && <p className="text-xs text-neutral-500">Linked competition · {eventName}. The saved name is preserved when calendar wording changes.</p>}
    {searching && permitted && <><input className="operation-control w-full" aria-label="Search calendar competitions" value={query} maxLength={80} disabled={disabled} placeholder="Search published competition editions…" onChange={event => setQuery(event.target.value)}/>
      <select className="operation-control w-full" aria-label="Choose calendar competition" disabled={disabled || loading} value={eventId || ''} onChange={event => { const selected = items.find(item => item.id === event.target.value); if (selected) onChange(selected.id, selected.title); }}>
        <option value="">Choose a competition</option>{eventId && !items.some(item => item.id === eventId) && <option value={eventId}>{eventName} · saved link</option>}
        {items.map(item => <option key={item.id} value={item.id}>{item.title} · {item.startDate}</option>)}
      </select>{loading && <p role="status" className="text-xs text-neutral-500">Loading competition events…</p>}
      {!loading && !items.length && !error && <p className="text-xs text-neutral-500">No matching published competition. Enter its name manually if it is not in the calendar.</p>}
      {error && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}</>}
    {!searching && !eventId && <p className="text-xs text-neutral-500">Record the competition name below. A calendar event is optional.</p>}
  </div>;
}
