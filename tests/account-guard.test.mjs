import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const id = '50000000-0000-4000-8000-000000000001';
const profile = { id, email: 'guard@example.test', role: 'Root', is_active: true, must_change_password: false };
function guard(result) {
  let reads = 0; let slots = 0;
  const query = { select() { ++reads; return query; }, eq() { return query; }, single: async () => result };
  const client = { auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, from: () => query, rpc: async () => { ++slots; return { data: true, error: null }; } };
  const { verifyCaller } = loadTs('lib/backend-security.ts', {
    '@supabase/supabase-js': { createClient: () => client },
    './env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fictional-public', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service' } },
    '@/lib/supabase': { supabase: {} },
  });
  return { verify: () => verifyCaller(new Request('https://portal.example/api/admin/partners', { headers: { Authorization: 'Bearer fictional-token' } })), counts: () => ({ reads, slots }) };
}

test('missing account security columns produce an actionable setup error and never bypass verification', async () => {
  for (const code of ['42703', 'PGRST204']) {
    const check = guard({ data: null, error: { code, message: 'Internal schema detail' } });
    const result = await check.verify();
    assert.equal(result.errorResponse.status, 503);
    const body = await result.errorResponse.json();
    assert.equal(body.error.code, 'AUTH_DATABASE_SETUP_REQUIRED');
    assert.match(body.error.message, /profile security SQL repair/);
    assert.ok(!JSON.stringify(body).includes('Internal schema detail'));
    assert.equal(result.context, undefined);
    assert.deepEqual(check.counts(), { reads: 1, slots: 0 }, 'no fallback query or authorized work');
  }
});

test('a missing account differs from an account database outage', async () => {
  for (const [error, status, code] of [[{ code: 'PGRST116' }, 403, 'AUTH_PROFILE_NOT_FOUND'], [null, 403, 'AUTH_PROFILE_NOT_FOUND'], [{ code: '08006' }, 503, 'AUTH_PROFILE_UNAVAILABLE']]) {
    const result = await guard({ data: null, error }).verify();
    assert.equal(result.errorResponse.status, status);
    assert.equal((await result.errorResponse.json()).error.code, code);
  }
});

test('valid accounts can load partners while suspended and temporary-password accounts stay blocked', async () => {
  const check = guard({ data: profile, error: null });
  assert.equal((await check.verify()).context.userId, id);
  assert.equal(check.counts().slots, 1);
  for (const change of [{ is_active: false }, { must_change_password: true }]) {
    const blocked = guard({ data: { ...profile, ...change }, error: null });
    assert.equal((await blocked.verify()).errorResponse.status, 403);
    assert.equal(blocked.counts().slots, 0);
  }
});
