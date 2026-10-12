'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building } from '@phosphor-icons/react/dist/csr/Building';
import { CurrencyDollar } from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { useAppStore, type AcademyProfile } from '@/lib/store';
import { academyProfileChanges } from '@/lib/academy-profile';
import { academySettingsSchema, changedAcademyFields, rebaseAcademyDraft } from '@/lib/academy-settings';
import { SafeImage } from '@/components/SafeImage';
import styles from './settings.module.css';

type Draft = Record<string, string | boolean>;
type Field = { key: keyof AcademyProfile; label: string; hint?: string; type?: 'email' | 'url' | 'number' | 'textarea' | 'checkbox'; min?: number; max?: number; step?: number; maxLength?: number; options?: [string, string][] };
const groups: { id: string; title: string; description: string; icon: typeof Building; fields: Field[] }[] = [
  { id: 'brand', title: 'Brand & identity', description: 'The academy details used across the portal.', icon: Building, fields: [
    { key: 'academyName', label: 'Academy name', maxLength: 255 }, { key: 'legalName', label: 'Legal name', maxLength: 255 },
    { key: 'tagline', label: 'Tagline', maxLength: 255 }, { key: 'taxId', label: 'Tax ID', maxLength: 100 },
    { key: 'logoUrl', label: 'Logo URL', hint: 'Use a local /path or a complete image URL.', maxLength: 500 },
    { key: 'websiteUrl', label: 'Website URL', type: 'url' }, { key: 'portalUrl', label: 'Student portal URL', type: 'url' },
  ] },
  { id: 'contact', title: 'Contact & locations', description: 'Help students and families reach the academy.', icon: MapPin, fields: [
    { key: 'contactPhone', label: 'Contact phone', maxLength: 50 }, { key: 'supportEmail', label: 'Support email', type: 'email' },
    { key: 'defaultBranchId', label: 'Default branch', hint: 'All locations keeps the academy profile independent of a branch.' },
    { key: 'primaryAddress', label: 'Primary address', type: 'textarea', maxLength: 500 },
  ] },
  { id: 'billing', title: 'Billing defaults', description: 'Unpaid dues use the current tuition defaults. Stored payment amounts are not rewritten.', icon: CurrencyDollar, fields: [
    { key: 'standardTuitionUsd', label: 'Standard monthly tuition (USD)', type: 'number', min: 0, max: 10000, step: .01 },
    { key: 'earlyGroupTuitionUsd', label: 'Early group monthly tuition (USD)', type: 'number', min: 0, max: 10000, step: .01 },
    { key: 'tuitionGracePeriodDays', label: 'Payment grace period (days)', type: 'number', min: 0, max: 60, hint: 'Days before an unpaid membership is marked overdue.' },
    { key: 'currency', label: 'Display currency', options: [['USD', 'USD — US dollar'], ['KHR', 'KHR — Khmer riel']], hint: 'Tuition and transaction amounts remain in USD; this does not convert prices.' },
    { key: 'currencySymbol', label: 'Display symbol', maxLength: 10 },
    { key: 'taxRatePercentage', label: 'Reference tax rate (%)', type: 'number', min: 0, max: 100, step: .01, hint: 'Stored for reference. Tax is not automatically added to transactions.' },
  ] },
  { id: 'training', title: 'Training references', description: 'These stored reference values do not automatically enforce exam eligibility or change existing classes.', icon: GraduationCap, fields: [
    { key: 'dateFormat', label: 'Preferred date format', options: [['YYYY-MM-DD', 'YYYY-MM-DD'], ['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY']], hint: 'Stored preference; current screens retain their existing date formats.' },
    { key: 'defaultClassDurationMins', label: 'Reference class duration (minutes)', type: 'number', min: 15, max: 360 },
    { key: 'examPassingScore', label: 'Reference exam passing score (%)', type: 'number', min: 50, max: 100 },
    { key: 'minAttendanceExamPct', label: 'Reference minimum attendance (%)', type: 'number', min: 0, max: 100 },
  ] },
  { id: 'portal', title: 'Portal & social', description: 'Public links and preferences for connected student portal deployments.', icon: ShareNetwork, fields: [
    { key: 'allowStudentPortalLogin', label: 'Student portal access preference', type: 'checkbox', hint: 'Stored preference. Enforcement requires the student portal to read this setting; staff sign-in is separate.' },
    { key: 'enableAudioChimes', label: 'Academy audio preference', type: 'checkbox', hint: 'Stored academy preference. Use Preferences to control sound in this browser.' },
    { key: 'facebookUrl', label: 'Facebook URL', type: 'url' }, { key: 'telegramChannel', label: 'Telegram channel URL', type: 'url' }, { key: 'instagramUrl', label: 'Instagram URL', type: 'url' },
  ] },
];
const numericKeys = new Set(groups.flatMap(group => group.fields.filter(field => field.type === 'number').map(field => field.key)));
function asDraft(profile: AcademyProfile): Draft {
  return Object.fromEntries(Object.entries(academyProfileChanges(profile)).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value ?? '')]));
}

export function AcademySettingsPanel({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { state, can, updateAcademyProfile } = useAppStore();
  const [draft, setDraft] = useState(() => asDraft(state.academyProfile));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseline = useRef(asDraft(state.academyProfile));
  const timestamp = useRef(state.academyProfile.updatedAt);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [section, setSection] = useState('all');
  const [search, setSearch] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const writable = can('action:staff_manage');
  const profileUnavailable = Boolean(state.dataLoadErrors?.includes('academy_profile'));
  const changed = changedAcademyFields(draft, baseline.current);
  const dirty = Object.keys(changed).length > 0;

  useEffect(() => {
    if (saving) return;
    const latest = asDraft(state.academyProfile);
    const rebased = rebaseAcademyDraft(draftRef.current, baseline.current, latest);
    // Persist conflicts until explicitly reviewed or discarded.
    setConflicts(previous => [...new Set([...previous, ...rebased.conflicts])]);
    baseline.current = latest;
    timestamp.current = state.academyProfile.updatedAt;
    draftRef.current = rebased.draft;
    setDraft(rebased.draft);
  }, [state.academyProfile, saving]);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const warnOnNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname !== window.location.pathname && !window.confirm('You have unsaved academy changes. Leave Settings and discard them?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', warnOnNavigation, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', warnOnNavigation, true); };
  }, [dirty]);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter(group => section === 'all' || section === group.id).map(group => ({ ...group,
      fields: group.fields.filter(field => !query || `${group.title} ${field.label} ${field.hint ?? ''}`.toLowerCase().includes(query)),
    })).filter(group => group.fields.length);
  }, [section, search]);

  const edit = (key: string, value: string | boolean) => {
    setDraft(current => ({ ...current, [key]: value, ...(key === 'currency' ? { currencySymbol: value === 'KHR' ? '៛' : '$' } : {}) }));
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setSaveError(''); setSaved(false);
  };
  const discard = () => {
    if (!window.confirm('Discard your unsaved academy changes and load the latest saved settings?')) return;
    baseline.current = asDraft(state.academyProfile); timestamp.current = state.academyProfile.updatedAt;
    setDraft(baseline.current); setErrors({}); setConflicts([]); setSaveError(''); setSaved(false);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writable || profileUnavailable || saveInFlight.current || !dirty || conflicts.length) return;
    const payload = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, numericKeys.has(key as keyof AcademyProfile) ? (value === '' ? NaN : Number(value)) : key === 'defaultBranchId' ? (value === 'all' ? 'all' : Number(value)) : value]));
    const parsed = academySettingsSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      setErrors(fieldErrors); setSaveError('Review the highlighted fields before saving.'); setSection('all'); setSearch('');
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`#setting-${Object.keys(fieldErrors)[0]}`)?.focus());
      return;
    }
    const normalizedBaseline = Object.fromEntries(Object.entries(baseline.current).map(([key, value]) => [key, numericKeys.has(key as keyof AcademyProfile) || key === 'defaultBranchId' && value !== 'all' ? Number(value) : value]));
    const patch = changedAcademyFields(parsed.data, normalizedBaseline);
    if (!Object.keys(patch).length) { setDraft(asDraft({ ...state.academyProfile, ...(parsed.data as Partial<AcademyProfile>) })); return; }
    saveInFlight.current = true;
    setSaving(true); setSaveError(''); setSaved(false);
    try {
      const result = await updateAcademyProfile(patch as Partial<AcademyProfile>, timestamp.current);
      if (!result.success) { setSaveError(result.error || 'Settings could not be saved. Your edits are still here.'); return; }
      if (result.profile) {
        baseline.current = asDraft(result.profile); timestamp.current = result.profile.updatedAt;
        setDraft(baseline.current);
      }
      setSaved(true); setErrors({});
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Settings could not be saved. Your edits are still here.'); }
    finally { saveInFlight.current = false; setSaving(false); }
  };

  return <form ref={form} onSubmit={save} noValidate className="space-y-5" aria-label="Academy settings">
    <div className={styles.panel}>
      <div className="flex items-start gap-4">
        <SafeImage src={String(draft.logoUrl || '')} alt="Academy logo preview" containerClassName="h-14 w-14 shrink-0 rounded-lg border overflow-hidden flex items-center justify-center" />
        <div className="min-w-0">
          <p className={`${styles.hint} uppercase tracking-widest`}>Academy profile</p>
          <h2 className="text-xl font-bold break-words mt-1">{String(draft.academyName || 'Your academy')}</h2>
          <p className={styles.hint}>Manage shared details and defaults. Edits stay here when you switch settings sections.</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <MagnifyingGlass className="shrink-0" aria-hidden="true" />
        <label htmlFor="settings-search" className="sr-only">Search academy settings</label>
        <input id="settings-search" type="search" className={styles.input} placeholder="Search settings, e.g. tuition or contact" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className={`${styles.mobileNavigation} mt-4`}><label htmlFor="settings-category" className="sr-only">Academy settings category</label><select id="settings-category" className={styles.input} value={section} onChange={event => setSection(event.target.value)}>{[{ id: 'all', title: 'All settings' }, ...groups].map(group => <option key={group.id} value={group.id}>{group.title}</option>)}</select></div>
      <div className={`${styles.filters} mt-4 hidden sm:flex`} aria-label="Academy settings categories">
        {[{ id: 'all', title: 'All settings' }, ...groups].map(group => <button type="button" className={styles.filter} aria-pressed={section === group.id} key={group.id} onClick={() => setSection(group.id)}>{group.title}</button>)}
      </div>
    </div>
    {!writable && <p className={`${styles.notice} ${styles.hint}`}>You have view access. Updating shared academy settings requires the staff management permission.</p>}
    {profileUnavailable && <p className={`${styles.notice} ${styles.hint}`} role="alert">Saved academy settings could not be loaded. Refresh and retry before editing; default values are shown below.</p>}
    {conflicts.length > 0 && <div className={styles.notice} role="alert">
      <p className="font-semibold text-sm">Saved settings changed while you were editing.</p>
      <p className={`${styles.hint} mt-1`}>Review these fields: {conflicts.map(key => groups.flatMap(group => group.fields).find(field => field.key === key)?.label || key).join(', ')}. Your edits have been kept.</p>
      <div className={`${styles.actions} mt-3`}><button type="button" className={styles.button} onClick={discard}>Load saved settings</button><button type="button" className={styles.button} disabled={!writable} onClick={() => setConflicts([])}>Keep my edits</button></div>
    </div>}
    <fieldset disabled={!writable || profileUnavailable || saving || state.isLoading} className="space-y-5 min-w-0">
      {visibleGroups.map(group => <section key={group.id} className={styles.panel} aria-labelledby={`settings-heading-${group.id}`}>
        <div className={styles.sectionHeading}><group.icon size={24} aria-hidden="true" /><div><h3 id={`settings-heading-${group.id}`}>{group.title}</h3><p className={styles.hint}>{group.description}</p></div></div>
        <div className={styles.fields}>{group.fields.map(field => {
          const id = `setting-${field.key}`;
          const describedBy = [field.hint ? `${id}-hint` : '', errors[field.key] ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
          const options = field.key === 'defaultBranchId' ? [['all', 'All locations'], ...state.branches.map(branch => [String(branch.id), branch.name])] : field.options;
          return <div key={field.key} className={styles.field}>
            <label htmlFor={id} className={styles.label}>{field.label}{field.key === 'academyName' ? ' *' : ''}</label>
            {field.type === 'checkbox' ? <div className="flex items-center gap-3 min-h-11"><input id={id} type="checkbox" className="h-5 w-5 accent-red-600" checked={Boolean(draft[field.key])} onChange={event => edit(field.key, event.target.checked)} aria-describedby={describedBy} /><span className={styles.hint}>{draft[field.key] ? 'Enabled' : 'Disabled'}</span></div>
              : options ? <select id={id} className={styles.input} value={String(draft[field.key] ?? '')} onChange={event => edit(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={describedBy}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{field.key === 'defaultBranchId' && !options.some(([value]) => value === String(draft.defaultBranchId)) && <option value={String(draft.defaultBranchId)}>Unavailable branch — choose a location</option>}</select>
              : field.type === 'textarea' ? <textarea id={id} className={styles.input} rows={3} maxLength={field.maxLength} value={String(draft[field.key] ?? '')} onChange={event => edit(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={describedBy} />
              : <input id={id} className={styles.input} type={field.type || 'text'} min={field.min} max={field.max} step={field.step ?? 1} maxLength={field.maxLength ?? (field.type === 'url' ? 500 : undefined)} required={field.key === 'academyName'} value={String(draft[field.key] ?? '')} onChange={event => edit(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={describedBy} />}
            {field.hint && <p id={`${id}-hint`} className={styles.hint}>{field.hint}</p>}
            {errors[field.key] && <p id={`${id}-error`} className={styles.error}>{errors[field.key]}</p>}
          </div>;
        })}</div>
      </section>)}
    </fieldset>
    {!visibleGroups.length && <div className={`${styles.panel} text-center`}><p className={styles.hint}>No settings match this search.</p><button type="button" className={`${styles.button} mt-3`} onClick={() => { setSearch(''); setSection('all'); }}>Show all settings</button></div>}
    {saveError && <p role="alert" className={styles.notice}>{saveError}</p>}
    <div className={`${styles.saveBar} ${!dirty || !visibleGroups.length ? styles.inFlow : ''}`}>
      <div aria-live="polite"><p className="text-sm font-semibold">{saving ? 'Saving settings…' : dirty ? `${Object.keys(changed).length} unsaved ${Object.keys(changed).length === 1 ? 'change' : 'changes'}` : saved ? 'Settings saved' : 'No unsaved changes'}</p><p className={styles.hint}>{state.isLoading ? 'Loading saved settings…' : 'Save applies changes across the academy.'}</p></div>
      <div className={styles.actions}><button type="button" className={styles.button} disabled={!dirty || saving} onClick={discard}>Discard</button><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!writable || profileUnavailable || !dirty || saving || state.isLoading || conflicts.length > 0}><span className="flex items-center justify-center gap-2"><FloppyDisk aria-hidden="true" />{saving ? 'Saving…' : 'Save changes'}</span></button></div>
    </div>
  </form>;
}
