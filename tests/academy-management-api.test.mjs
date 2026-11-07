import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const actor = 'a3000000-0000-4000-8000-000000000001';
const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: 'fixture-server' };
const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url') + '.fixture';
const asset = { title: 'Fixture lesson', description: JSON.stringify({ text: 'Public guidance', instructions: ['A deliberate step'], staffNotes: 'Private staff notes' }), library_type: 'Taekwondo', tkd_category: 'Poomsae', fitness_category: null, target_level: 'White', video_url: '' };
function fixture(role = 'Coach', { denied = [], rpcError = null } = {}) {
  const calls = [], reads = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) }, from(table) {
    const filters = {}; const query = { select(columns) { reads.push({ table, columns }); return query; }, eq(key, value) { filters[key] = value; return query; }, in(key, value) { filters[key] = value; return query; }, async single() { return { data: { id: actor, role, is_active: true, must_change_password: false }, error: null }; }, async maybeSingle() { return { data: asset, error: null }; }, then(resolve, reject) { return Promise.resolve({ data: denied.filter(key => (filters.permission_key || []).includes(key)).map(permission_key => ({ permission_key, is_granted: false })), error: null }).then(resolve, reject); } }; return query;
  }, async rpc(name, args) {
    if (name === 'portal_take_rate_slot') return { data: true, error: null };
    calls.push({ name, args });
    if (rpcError) return { data: null, error: rpcError };
    if (name === 'portal_library_catalog') return { data: { contractVersion: 'academy-library-v1', items: [], hasMore: false, offset: args.p_offset }, error: null };
    return { data: { asset: { id: 1, student_curriculum_id: 1 }, studentLesson: { id: 1 }, relations: [] }, error: null };
  } };
  const security = loadTs('lib/backend-security.ts', { '@supabase/supabase-js': { createClient: () => client }, './env': { env } });
  const route = loadTs('app/api/admin/library-assets/route.ts', { '@/lib/backend-security': security });
  const request = (method, body, query = '') => new Request('https://portal.example/api/admin/library-assets' + query, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { route, calls, reads, request };
}

test('library management respects effective edit authority, including denied parents and read-only roles', async () => {
  for (const [role, options] of [['Assistant Coach', {}], ['Coach', { denied: ['page:library', 'page:lms'] }], ['Coach', { denied: ['action:curriculum_edit'] }]]) {
    const check = fixture(role, options);
    assert.equal((await check.route.GET(check.request('GET'))).status, 403);
    assert.equal((await check.route.POST(check.request('POST', { action: 'UNPUBLISH', id: 1, expectedRevision: 2, reason: 'Review this lesson' }))).status, 403);
    assert.equal(check.calls.length, 0);
  }
});

test('management filters and revision/reason inputs are strict before any content transaction', async () => {
  const check = fixture();
  for (const query of ['?limit=101', '?state=unknown', '?search=first&search=second', '?select=*']) assert.equal((await check.route.GET(check.request('GET', null, query))).status, 422);
  for (const body of [{ action: 'UPDATE', id: 1, asset }, { action: 'DELETE', id: 1 }, { action: 'PUBLISH', id: 1, expectedRevision: 1, reason: '' }, { action: 'UNPUBLISH', id: 1, expectedRevision: 0, reason: 'Review content' }]) assert.equal((await check.route.POST(check.request('POST', body))).status, 422);
  assert.equal(check.calls.length, 0);
  assert.equal((await check.route.GET(check.request('GET', null, '?search=kick&state=draft&limit=10&offset=20'))).status, 200);
  assert.deepEqual(check.calls[0], { name: 'portal_library_catalog', args: { p_actor: actor, p_search: 'kick', p_state: 'draft', p_limit: 10, p_offset: 20 } });
});

test('publishing uses the current authored draft and an allowlisted student snapshot, not caller-supplied metadata', async () => {
  const check = fixture();
  const response = await check.route.POST(check.request('POST', { action: 'PUBLISH', id: 1, expectedRevision: 3, reason: 'Coach approved technique' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  const sent = check.calls[0];
  assert.equal(sent.name, 'portal_save_library_asset'); assert.equal(sent.args.p_payload.expectedRevision, 3);
  assert.deepEqual(sent.args.p_payload.studentProjection.learning_content.instructions, ['A deliberate step']);
  assert.equal(JSON.stringify(sent).includes('Private staff notes'), false);
  assert.equal(check.reads.find(row => row.table === 'library_assets').columns, 'description,video_url,library_type,target_level,tkd_category,fitness_category');
  assert.equal((await check.route.POST(check.request('POST', { action: 'PUBLISH', id: 1, expectedRevision: 3, reason: 'Coach approved technique', studentProjection: {} }))).status, 422);
});

test('stale publishing is a conflict and missing release functions never report an empty successful catalog', async t => {
  t.mock.method(console, 'error', () => {});
  const conflict = fixture('Coach', { rpcError: { code: '40001', message: 'This lesson changed. Refresh before publishing again.' } });
  assert.equal((await conflict.route.POST(conflict.request('POST', { action: 'UNPUBLISH', id: 1, expectedRevision: 2, reason: 'Review technique' }))).status, 409);
  const unavailable = fixture('Coach', { rpcError: { code: 'PGRST202', message: 'Function not installed' } });
  assert.equal((await unavailable.route.GET(unavailable.request('GET'))).status, 503);
});
