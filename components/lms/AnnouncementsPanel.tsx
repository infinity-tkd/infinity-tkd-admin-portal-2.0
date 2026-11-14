'use client';
import { useEffect, useState } from 'react';
import { Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { buttonClass, cardClass, fieldClass, sectionLabelClass } from '@/components/ui/styles';
import { EmptyState, ErrorBanner } from '@/components/ui/States';
import { portalRequest } from '@/lib/portal-api';
import { announcementInput, type LmsAudience } from '@/lib/lms-contract';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { AudiencePicker, audienceSummary, fmtDate, Labeled, StatusLine, TranslationFields, useSaving, type Overview } from './coaching-shared';

interface Sent { id: string; title: string; body: string; audience: LmsAudience; recipients: number; sent_at: string; profiles?: { display_name: string } | null }

export function AnnouncementsPanel({ overview, canSend }: { overview: Overview; canSend: boolean }) {
  const [sent, setSent] = useState<Sent[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<LmsAudience>({ all: true });
  const [translations, setTranslations] = useState<Record<string, any>>({});
  // One request key per draft: a retried send never posts twice.
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [version, setVersion] = useState(0);
  // A failed load says so, instead of looking like nothing was ever sent.
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    portalRequest<{ announcements: Sent[] }>('/api/admin/lms/announcements')
      .then(result => { if (alive) { setSent(Array.isArray(result?.announcements) ? result.announcements : []); setLoadError(null); } })
      .catch(error => { if (alive) setLoadError(error instanceof Error ? error.message : 'Sent announcements could not be loaded.'); });
    return () => { alive = false; };
  }, [version]);
  const { saving, message, setMessage, run } = useSaving(() => setVersion(v => v + 1));
  const { showConfirm } = useAppStore();
  const send = () => {
    const parsed = announcementInput.safeParse({ title, body, audience, translations });
    if (!parsed.success) { setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the announcement.' }); return; }
    const announcement = parsed.data;
    showConfirm(`Send "${announcement.title}" to ${audienceSummary(overview, announcement.audience)}?`, () => { void run(async () => {
      const result = await portalRequest<{ recipients: number }>('/api/admin/lms/announcements', { requestKey, announcement });
      setTitle(''); setBody(''); setTranslations({}); setRequestKey(crypto.randomUUID());
      setMessage({ tone: 'ok', text: `Sent to ${result.recipients} student account${result.recipients === 1 ? '' : 's'}.` });
    }); }, 'Send announcement');
  };
  return <div className="space-y-4">
    {canSend && <section className={cn(cardClass, 'space-y-2 p-3')}>
      <h2 className={sectionLabelClass}>New announcement</h2>
      <Labeled label="Title"><input className={fieldClass} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></Labeled>
      <Labeled label="Message"><textarea rows={4} maxLength={2000} className={cn(fieldClass, 'py-2')} value={body} onChange={e => setBody(e.target.value)} /></Labeled>
      <AudiencePicker overview={overview} value={audience} onChange={setAudience} />
      <TranslationFields fields={[{ key: 'title', label: 'Title', max: 160 }, { key: 'body', label: 'Message', multiline: true, max: 2000 }]} value={translations} onChange={setTranslations} />
      <p className="text-xs text-ink-muted">Goes to the student portal inbox in each family&apos;s language. Phone lock screens never show the message itself.</p>
      <button type="button" className={buttonClass({ variant: 'primary' })} disabled={saving} onClick={send}><PaperPlaneTilt className="size-4" weight="bold" /> Send</button>
      <StatusLine message={message} />
    </section>}
    <section className="space-y-2"><h2 className={sectionLabelClass}>Sent</h2>
      {loadError && <ErrorBanner title="Sent announcements unavailable" action={<button type="button" className={buttonClass({ size: 'sm' }) + ' pointer-coarse:min-h-11'} onClick={() => setVersion(v => v + 1)}>Retry</button>}>{loadError}</ErrorBanner>}
      {sent === null ? (loadError ? null : <EmptyState busy title="Loading…" />) : sent.length === 0 ? <EmptyState icon={<Megaphone />} title="No announcements yet" />
        : <ul className="space-y-2">{sent.map(a => <li key={a.id} className={cn(cardClass, 'p-3')}>
          <p className="text-sm font-bold text-ink">{a.title}</p><p className="whitespace-pre-wrap text-sm text-ink-muted">{a.body}</p>
          <p className="mt-1 text-xs text-ink-subtle">{audienceSummary(overview, a.audience)} · {a.recipients} recipients · {a.profiles?.display_name ?? 'Staff'} · {fmtDate(a.sent_at)}</p></li>)}</ul>}</section>
  </div>;
}
