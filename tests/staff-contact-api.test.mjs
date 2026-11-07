import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const actor = '85000000-0000-4000-8000-000000000001';
const target = '85000000-0000-4000-8000-000000000002';
const baseSecurity = loadTs('lib/backend-security.ts', {
  './env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fictional-public', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service' } },
  '@/lib/supabase': { supabase: {} },
});
function fixture({ role = 'Admin', self = false, privileged = true, provisionError = null } = {}) {
  const calls = []; const authCalls = [];
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { role: 'Coach' }, error: null }) };
  const client = { from: () => query, rpc: async (name, args) => { calls.push({ name, args }); return { error: provisionError }; },
    auth: { admin: {
      createUser: async data => { authCalls.push('create'); return { data: { user: { id: target, email: data.email } }, error: null }; },
      deleteUser: async () => { authCalls.push('delete'); return { error: null }; },
    } },
  };
  const security = { ...baseSecurity, verifyCaller: async () => ({ context: { userId: self ? target : actor, role }, adminSupabase: client }), callerHasPermission: async () => privileged, logSecurityAuditEvent: async () => {} };
  return { calls, authCalls, route: file => loadTs(file, { '@/lib/backend-security': security }) };
}
const request = body => new Request('https://portal.example/api/admin/update-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('staff contact edits accept the actual full form with unrecorded optional dates', async () => {
  const check = fixture(); const route = check.route('app/api/admin/update-user/route.ts');
  assert.equal((await route.POST(request({ id: target, data: { displayName: 'Coach', username: 'fixture_coach', dob: '', currentDan: null, danIssueDate: '', telegramUsername: 'https://t.me/Fixture_Coach', address: { line1: '', city: '', country: 'Cambodia' } } }))).status, 200);
  assert.equal(check.calls[0].name, 'portal_update_user');
  assert.equal(check.calls[0].args.p_member.telegram_username, 'fixture_coach');
  assert.equal(check.calls[0].args.p_member.dob, null);
  assert.equal(check.calls[0].args.p_address, null, 'contact edits cannot create an empty staff address');
  assert.equal(check.calls[0].args.p_profile.dan_issue_date, null);
  assert.equal((await route.POST(request({ id: target, data: { phone: '012345678' } }))).status, 200);
  assert.ok(!('telegram_username' in check.calls[1].args.p_member));
  assert.equal((await route.POST(request({ id: target, data: { telegramUsername: '' } }))).status, 200);
  assert.equal(check.calls[2].args.p_member.telegram_username, null);
});

test('contact updates preserve staff ownership and reject database-incompatible fields before writes', async () => {
  const denied = fixture({ role: 'Coach', privileged: false });
  assert.equal((await denied.route('app/api/admin/update-user/route.ts').POST(request({ id: target, data: { telegramUsername: '@Other_Coach' } }))).status, 403);
  assert.equal(denied.calls.length, 0);
  const own = fixture({ role: 'Coach', self: true, privileged: false });
  const route = own.route('app/api/admin/update-user/route.ts');
  assert.equal((await route.POST(request({ id: target, data: { telegramUsername: '@Own_Coach' } }))).status, 200);
  assert.equal((await route.POST(request({ id: target, data: { telegramUsername: '@Own_Coach', role: 'Root' } }))).status, 403);
  for (const data of [{ telegramUsername: 'javascript:alert(1)' }, { username: 'invalid-name' }, { username: 'x'.repeat(31) }, { gender: 'Other' }, { danIssueDate: '2026-02-30' }, { currentDan: 0 }]) {
    assert.equal((await route.POST(request({ id: target, data }))).status, 422);
  }
  assert.equal(own.calls.length, 1);
});

test('staff provisioning persists canonical contacts and compensates a failed database transaction', async t => {
  t.mock.method(console, 'error', () => {});
  const payload = { username: 'fixture_coach', email: 'coach@example.test', displayName: 'Coach', role: 'Coach', telegramUsername: '@Fixture_Coach', address: { line1: '', city: '', country: 'Cambodia' } };
  const check = fixture(); const route = check.route('app/api/admin/create-user/route.ts');
  assert.equal((await route.POST(request(payload))).status, 200);
  assert.equal(check.calls[0].args.p_member.telegram_username, 'fixture_coach');
  assert.equal(check.calls[0].args.p_address, null);
  for (const change of [{ username: 'invalid.name' }, { gender: 'Other' }, { telegramUsername: 'https://evil.example/coach' }]) assert.equal((await route.POST(request({ ...payload, ...change }))).status, 422);
  assert.deepEqual(check.authCalls, ['create']);
  const rollback = fixture({ provisionError: { code: '23514', message: 'Fixture constraint failure' } });
  assert.ok((await rollback.route('app/api/admin/create-user/route.ts').POST(request(payload))).status >= 400);
  assert.deepEqual(rollback.authCalls, ['create', 'delete']);
});
