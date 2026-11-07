import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const cursor = z.object({ scope: z.string(), after: z.string().min(1).max(64), at: z.number().int() }).strict();
export function domainFailure(message: string, code = '22023'): never {
  throw Object.assign(new Error(message), { code });
}
function signature(body: string) {
  const key = process.env.PORTAL_CURSOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) domainFailure('The portal service needs configuration.', 'PGRST202');
  return createHmac('sha256', key).update('portal-resource-v1:' + body).digest('base64url');
}
export function domainCursor(scope: string, after: string) {
  const body = Buffer.from(JSON.stringify({ scope, after, at: Date.now() })).toString('base64url');
  return body + '.' + signature(body);
}
export function readDomainCursor(raw: string | undefined, scope: string) {
  if (!raw) return null;
  try {
    if (raw.length > 4000) throw new Error();
    const [body, supplied, extra] = raw.split('.');
    if (!body || !supplied || extra) throw new Error();
    const expected = Buffer.from(signature(body)), actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
    const parsed = cursor.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    if (parsed.scope !== scope || parsed.at > Date.now() || Date.now() - parsed.at > 3600000) throw new Error();
    return parsed.after;
  } catch (error) {
    if((error as {code?:string})?.code==='PGRST202')throw error;
    return domainFailure('This page position changed or expired. Refresh the catalog.', '40001');
  }
}

