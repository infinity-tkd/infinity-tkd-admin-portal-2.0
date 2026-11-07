import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export const eventUploadFileLimit = 15 * 1024 * 1024;
export const eventUploadBodyLimit = 16 * 1024 * 1024;
const mimeExtensions: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class CalendarUploadError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
function invalid(message: string): never { throw new CalendarUploadError(422, 'INVALID_EVENT_UPLOAD', message); }
let uploadsInFlight = 0;
export function reserveEventUpload() {
  if (uploadsInFlight >= 2) throw new CalendarUploadError(429, 'EVENT_UPLOAD_BUSY', 'Two files are being processed. Retry this upload shortly.');
  uploadsInFlight++;
  let released = false;
  return () => { if (!released) { released = true; uploadsInFlight--; } };
}

async function boundedMultipart(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(type) || type.length > 1000) invalid('Send a multipart image or PDF upload.');
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) invalid('The upload length is invalid.');
  if (declared && Number(declared) > eventUploadBodyLimit) throw new CalendarUploadError(413, 'EVENT_UPLOAD_TOO_LARGE', 'The upload request exceeds 16 MB.');
  if (!req.body) invalid('Choose one image or PDF file.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0, timeout: ReturnType<typeof setTimeout> | undefined;
  const reading = async () => {
    while (true) {
      req.signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > eventUploadBodyLimit) throw new CalendarUploadError(413, 'EVENT_UPLOAD_TOO_LARGE', 'The upload request exceeds 16 MB.');
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  };
  try {
    const bytes = await Promise.race([reading(), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { reject(new CalendarUploadError(408, 'EVENT_UPLOAD_TIMEOUT', 'The upload took too long. Retry with a stable connection.')); void reader.cancel().catch(() => {}); }, 20000);
    })]);
    return await new Request('https://upload.internal.invalid', { method: 'POST', headers: { 'Content-Type': type }, body: new Uint8Array(bytes) }).formData();
  } finally {
    if (timeout) clearTimeout(timeout);
    await reader.cancel().catch(() => {});
  }
}

export function eventUploadSignature(bytes: Uint8Array, type: string) {
  const sample = Buffer.from(bytes);
  if (type === 'application/pdf') return sample.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return sample.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return sample[0] === 255 && sample[1] === 216 && sample[2] === 255;
  if (type === 'image/webp') return sample.subarray(0, 4).toString() === 'RIFF' && sample.subarray(8, 12).toString() === 'WEBP';
  return false;
}

export async function readEventUpload(req: Request) {
  let form: FormData;
  try { form = await boundedMultipart(req); }
  catch (error) { if (error instanceof CalendarUploadError) throw error; invalid('The multipart upload could not be read. Choose the file again.'); }
  if ([...form.keys()].some(key => !['file', 'label'].includes(key)) || form.getAll('file').length !== 1 || form.getAll('label').length > 1) invalid('Send one file and an optional display label.');
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) invalid('Choose one nonempty image or PDF file.');
  if (file.size > eventUploadFileLimit) throw new CalendarUploadError(413, 'EVENT_FILE_TOO_LARGE', 'Event files must be 15 MB or smaller.');
  const type = file.type.toLowerCase();
  if (!Object.hasOwn(mimeExtensions, type) || !eventUploadSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()), type)) invalid('The file must contain a matching PDF, JPEG, PNG or WebP image.');
  const suppliedLabel = form.get('label');
  if (suppliedLabel !== null && typeof suppliedLabel !== 'string') invalid('Use a text display label.');
  const label = (suppliedLabel === null ? file.name.split(/[\\/]/).at(-1)?.slice(0, 120) ?? 'Event file' : suppliedLabel).toWellFormed().replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!label || label.length > 120) invalid('Use a display label between 1 and 120 characters.');
  return { file, type, label, extension: mimeExtensions[type] };
}

export async function storeEventUpload(client: SupabaseClient, eventId: string, upload: Awaited<ReturnType<typeof readEventUpload>>, signal?: AbortSignal) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) invalid('Choose a valid saved event before uploading.');
  eventId = eventId.toLowerCase();
  const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (project.protocol !== 'https:' || project.username || project.password || !env.SUPABASE_SERVICE_ROLE_KEY) throw new CalendarUploadError(503, 'EVENT_STORAGE_UNAVAILABLE', 'Private event storage is not configured.');
  let bucketTimeout: ReturnType<typeof setTimeout> | undefined;
  const bucket = await Promise.race([client.storage.getBucket('academy-events'), new Promise<never>((_, reject) => {
    bucketTimeout = setTimeout(() => reject(new CalendarUploadError(503, 'EVENT_STORAGE_UNAVAILABLE', 'Private event storage could not be checked. Retry shortly.')), 10000);
  })]).finally(() => { if (bucketTimeout) clearTimeout(bucketTimeout); });
  if (bucket.error || !bucket.data || bucket.data.public !== false) throw new CalendarUploadError(503, 'EVENT_STORAGE_UNAVAILABLE', 'Private event storage is not ready. Contact the academy administrator.');
  const id = randomUUID(), objectPath = `${eventId}/${id}.${upload.extension}`;
  const target = new URL(`/storage/v1/object/academy-events/${objectPath}`, project.origin);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch(target, { method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal, headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': upload.type, 'Cache-Control': 'max-age=0', 'x-upsert': 'false',
    }, body: upload.file });
    // Confirm the exact stored object without forwarding upstream bodies/details.
    if (!response.ok || !response.body || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      await response.body?.cancel();
      throw new CalendarUploadError(503, 'EVENT_UPLOAD_NOT_CONFIRMED', 'The private upload was not confirmed. Keep the file and retry shortly.');
    }
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let confirmedBytes = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; confirmedBytes += next.value.byteLength; if (confirmedBytes > 32768) throw new Error('Invalid upload confirmation'); parts.push(next.value); }
    } finally { await reader.cancel().catch(() => {}); }
    const confirmation: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!confirmation || typeof confirmation !== 'object' || !('Key' in confirmation) || confirmation.Key !== `academy-events/${objectPath}`) throw new Error('Invalid upload confirmation');
    return { id, label: upload.label, url: new URL(`/storage/v1/object/authenticated/academy-events/${objectPath}`, project.origin).toString() };
  } catch (error) {
    if (error instanceof CalendarUploadError) throw error;
    throw new CalendarUploadError(503, 'EVENT_UPLOAD_NOT_CONFIRMED', 'The private upload was not confirmed. Check the connection before retrying.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
