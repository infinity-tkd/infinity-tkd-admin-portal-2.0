const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
const reservedPaths = new Set(['joinchat', 'share', 'addstickers', 'addemoji', 'proxy', 'login', 'contact', 'boost']);

/** Returns undefined for invalid input, null for an empty optional contact. */
export function normalizeTelegramUsername(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 120) return undefined;
  let username = value.trim();
  if (!username) return null;
  if (/^https:\/\//i.test(username)) {
    try {
      const url = new URL(username);
      if (!['t.me', 'telegram.me'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash) return undefined;
      username = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch { return undefined; }
  } else {
    username = username.replace(/^@/, '');
  }
  return usernamePattern.test(username) && !reservedPaths.has(username.toLowerCase()) ? username.toLowerCase() : undefined;
}

export interface ContactDetails {
  telegramUsername?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function contactLinks(contact: ContactDetails, emailSubject?: string) {
  const links: { kind: 'telegram' | 'email' | 'phone'; label: string; href: string }[] = [];
  const username = normalizeTelegramUsername(contact.telegramUsername);
  if (username) links.push({ kind: 'telegram', label: 'Telegram', href: `https://t.me/${username}` });
  const email = contact.email?.trim();
  if (email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
    links.push({ kind: 'email', label: 'Email', href: `mailto:${email}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ''}` });
  }
  const phone = contact.phone?.trim();
  if (phone && /^\+?[\d\s().-]{3,30}$/.test(phone)) links.push({ kind: 'phone', label: 'Call', href: `tel:${phone.replace(/[\s().-]/g, '')}` });
  return links;
}
