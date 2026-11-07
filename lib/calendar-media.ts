import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calendarFailure } from './calendar-cursor';
import type { StoredAttachment } from './calendar-contract';

const maximumBytes = 15 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
function allowed(url: URL) {
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
    ['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com', 'lh3.googleusercontent.com'].includes(url.hostname)
    || url.hostname.endsWith('.googleusercontent.com')
    || Boolean(project && url.origin === new URL(project).origin && url.pathname.startsWith('/storage/v1/object/'))
  );
}
function driveTarget(raw: URL) {
  if (!['drive.google.com', 'docs.google.com'].includes(raw.hostname)) return raw;
  const id = raw.pathname.match(/\/file\/d\/([\w-]{10,100})/)?.[1] || raw.searchParams.get('id');
  if (!id || !/^[\w-]{10,100}$/.test(id) || raw.pathname.includes('/folders/')) calendarFailure('Use an individual approved Drive file link.');
  const url = new URL('https://drive.google.com/uc'); url.searchParams.set('export', 'download'); url.searchParams.set('id', id);
  const resource = raw.searchParams.get('resourcekey'); if (resource && /^[\w-]{1,150}$/.test(resource)) url.searchParams.set('resourcekey', resource);
  return url;
}
function validSignature(bytes: Buffer, type: string) {
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
}
/** No client URL is fetched until the stored event and viewer have been authorized. */
export async function fetchCalendarFile(client: SupabaseClient, source: string, eventId: string) {
  let target = driveTarget(new URL(source));
  if (!allowed(target)) calendarFailure('This file host is not approved for student downloads. Use the academy Storage or an accessible individual Drive file.');
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (project && target.origin === new URL(project).origin) {
    const parts = target.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!parts) calendarFailure('Use a valid academy Storage object link.');
    const bucket = decodeURIComponent(parts[1]), path = decodeURIComponent(parts[2]);
    const objectName = path.slice(eventId.length + 1);
    if (bucket !== 'academy-events' || !/^[0-9a-f-]{36}$/i.test(eventId) || !path.startsWith(eventId + '/') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$/i.test(objectName)) calendarFailure('Use an approved attachment in this event’s private Storage folder.');
    const signed = await client.storage.from(bucket).createSignedUrl(path, 60);
    if (signed.error || !signed.data?.signedUrl) calendarFailure('The academy cannot access this Storage file.');
    target = new URL(signed.data.signedUrl);
  }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6500);
  try {
    let response: Response | undefined;
    for (let redirects = 0; redirects < 4; redirects++) {
      if (!allowed(target)) calendarFailure('The file redirected outside approved storage.');
      response = await fetch(target, { redirect: 'manual', signal: controller.signal, cache: 'no-store', headers: { Accept: 'image/jpeg,image/png,image/webp,application/pdf' } });
      if ([301,302,303,307,308].includes(response.status)) {
        const next = response.headers.get('location'); await response.body?.cancel();
        if (!next) calendarFailure('The file could not be opened.'); target = new URL(next, target); response = undefined; continue;
      }
      break;
    }
    if (!response?.ok || !response.body) calendarFailure('The file could not be accessed. Check its permissions before publishing.');
    const type = response.headers.get('content-type')?.split(';')[0].toLowerCase() || '';
    if (!allowedTypes.has(type)) { await response.body.cancel(); calendarFailure('The link must return an image or PDF, not a sign-in or sharing page.'); }
    if (Number(response.headers.get('content-length')) > maximumBytes) { await response.body.cancel(); calendarFailure('Event files must be 15 MB or smaller.'); }
    const reader = response.body.getReader(), chunks: Buffer[] = []; let size = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maximumBytes) calendarFailure('Event files must be 15 MB or smaller.'); chunks.push(Buffer.from(part.value)); }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks);
    if (!bytes.length || !validSignature(bytes, type)) calendarFailure('The file content does not match an approved image/PDF format.');
    return { bytes, type, checksum: createHash('sha256').update(bytes).digest('hex') };
  } finally { clearTimeout(timer); }
}
export async function verifyEventAttachments(client: SupabaseClient, items: StoredAttachment[], eventId: string) {
  // Two-at-a-time bounds transient memory and external requests during publication.
  const result: StoredAttachment[] = [];
  for (let start = 0; start < items.length; start += 2) {
    result.push(...await Promise.all(items.slice(start, start + 2).map(async item => {
      const file = await fetchCalendarFile(client, item.url, eventId);
      return { id: item.id || randomUUID(), label: item.label, url: item.url, mimeType: file.type, bytes: file.bytes.length, checksum: file.checksum, studentAvailable: true };
    })));
  }
  return result;
}
