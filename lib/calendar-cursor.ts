import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { isCalendarDate } from './dates';

export function calendarFailure(message: string, code = '22023'): never { throw Object.assign(new Error(message), { code }); }
const cursorSchema = z.object({ scope: z.string(), after: z.string().uuid(), at: z.number(), before: z.string().datetime({ offset: true }).optional() }).strict();
function key() { const value = process.env.PORTAL_CURSOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY; if (!value) calendarFailure('Calendar service is not configured.', 'PGRST202'); return value; }
function sign(body: string) { return createHmac('sha256', key()).update('academy-calendar-v1:' + body).digest('base64url'); }
export function encodeCalendarCursor(scope: string, after: string, before?: string) {
  const body = Buffer.from(JSON.stringify({ scope, after, before, at: Date.now() })).toString('base64url'); return body + '.' + sign(body);
}
export function decodeCalendarCursor(raw: string | null, scope: string) {
  if (!raw) return null;
  try {
    if (raw.length > 4000) throw 0;
    const [body, signature, extra] = raw.split('.'); if (!body || !signature || extra) throw 0;
    const expected = Buffer.from(sign(body)), given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw 0;
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    if (parsed.scope !== scope || parsed.at > Date.now() || Date.now() - parsed.at > 3600000) throw 0;
    return parsed;
  } catch { return calendarFailure('Calendar position expired or is invalid. Reload the selected period.', '40001'); }
}
export function calendarPeriod(params: URLSearchParams) {
  const from = params.get('from') || '', to = params.get('to') || '';
  if (!isCalendarDate(from) || !isCalendarDate(to) || to <= from || Date.parse(to) - Date.parse(from) > 93 * 86400000) calendarFailure('Choose a valid period of at most 93 days.');
  return { from, to };
}
