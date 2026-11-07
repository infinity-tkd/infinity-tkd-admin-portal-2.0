'use client';

import { TelegramLogo } from '@phosphor-icons/react/dist/csr/TelegramLogo';
import { EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { contactLinks, type ContactDetails } from '@/lib/contacts';

export function ContactActions({ contact, name, compact = false, emailSubject }: { contact: ContactDetails; name: string; compact?: boolean; emailSubject?: string }) {
  const links = contactLinks(contact, emailSubject);
  if (!links.length) return null;
  const icons = { telegram: TelegramLogo, email: EnvelopeSimple, phone: Phone };
  return <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Contact ${name}`}>
    {links.map(link => {
      const Icon = icons[link.kind];
      return <a key={link.kind} href={link.href} target={link.kind === 'telegram' ? '_blank' : undefined} rel={link.kind === 'telegram' ? 'noopener noreferrer' : undefined}
        onClick={event => event.stopPropagation()} title={`${link.label}: ${name}`} aria-label={`Contact ${name} via ${link.label}`}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EF2F38] dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{!compact && link.label}
      </a>;
    })}
  </div>;
}

export function TelegramContactField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  return <div>
    <label htmlFor={id} className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Telegram username</label>
    <input id={id} type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} value={value} onChange={event => onChange(event.target.value)} placeholder="@username or https://t.me/username"
      aria-describedby={`${id}-hint`} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] dark:border-neutral-700 dark:bg-[#1A1A1A] dark:text-white" />
    <p id={`${id}-hint`} className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Optional. Use the person’s public Telegram username.</p>
  </div>;
}
