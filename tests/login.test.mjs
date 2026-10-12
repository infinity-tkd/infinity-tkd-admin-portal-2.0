import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
function loginRoute({ slot = true, slotError = null, profiles = [{ email: 'staff@example.test' }], role = 'Root', active = true, credentialsError = null } = {}) {
  const calls = [];
  const admin = {
    rpc: async (name, args) => { calls.push({ name, args }); return { data: slot, error: slotError }; },
    from: () => { const query = { select: () => query, eq: () => query, ilike: (_column, value) => { calls.push({ username: value }); return query; },
      limit: async () => ({ data: profiles, error: null }), single: async () => ({ data: { role, is_active: active }, error: null }) }; return query; },
  };
  const auth = {
    signInWithPassword: async value => { calls.push({ credentials: value }); return { data: { user: { id: 'staff' }, session: { access_token: 'test-access', refresh_token: 'test-refresh' } }, error: credentialsError }; },
    signOut: async () => { calls.push({ signedOut: true }); return { error: null }; },
  };
  const routes = loadTs('app/api/auth/login/route.ts', {
    '@supabase/supabase-js': { createClient: (_url, key) => key === 'service' ? admin : { auth } },
    '@/lib/env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'service' } },
    '@/lib/backend-security': {
      validateRequestOrigin: req => req.headers.get('origin') !== 'https://evil.test',
      checkApiRateLimit: () => ({ allowed: true }),
      validateRequestBody: async (schema, req) => { const result = schema.safeParse(await req.json()); return result.success ? { data: result.data } : { errorResponse: Response.json({ success: false }, { status: 422 }) }; },
    },
  });
  return { routes, calls };
}
const request = (identifier = 'STAFF_NAME', origin = 'https://portal.example') => new Request('https://portal.example/api/auth/login', {
  method: 'POST', headers: { origin }, body: JSON.stringify({ identifier, password: 'TestPassword' }),
});
test('login resolves exact usernames and returns a session only for active staff', async () => {
  const { routes, calls } = loginRoute();
  const response = await routes.POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.find(call => call.username)?.username, 'staff\\_name');
  assert.equal((await response.json()).data.access_token, 'test-access');
});
test('login rejects inactive, Student, unknown-role and incorrect-password accounts', async () => {
  for (const options of [{ active: false }, { role: 'Student' }, { role: 'Invented Admin' }, { credentialsError: new Error('Invalid credentials') }, { profiles: [{ email: 'a' }, { email: 'b' }] }]) {
    const { routes } = loginRoute(options);
    assert.equal((await routes.POST(request())).status, 401);
  }
});
test('login fails closed for missing database migration and gives retry guidance for throttling', async t => {
  t.mock.method(console, 'error', () => {});
  const missing = loginRoute({ slotError: { code: 'PGRST202' } });
  const unavailable = await missing.routes.POST(request());
  assert.equal(unavailable.status, 503);
  const missingBody = await unavailable.json();
  assert.match(missingBody.error.message, /database setup is incomplete/);
  assert.equal(missingBody.error.code, 'AUTH_DATABASE_SETUP_REQUIRED');
  assert.ok(!missing.calls.some(call => call.credentials));
  const outage = loginRoute({ slotError: { code: '08006' } });
  const outageResponse = await outage.routes.POST(request());
  assert.equal(outageResponse.status, 503);
  const outageBody = await outageResponse.json();
  assert.match(outageBody.error.message, /service is unavailable/);
  assert.equal(outageBody.error.code, undefined);
  assert.ok(!outage.calls.some(call => call.credentials));
  const limited = loginRoute({ slot: false });
  const response = await limited.routes.POST(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.ok(!limited.calls.some(call => call.credentials));
  assert.equal((await limited.routes.POST(request('staff', 'https://evil.test'))).status, 403);
});
