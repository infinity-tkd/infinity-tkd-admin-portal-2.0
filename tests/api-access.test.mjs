import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './load-ts.mjs';
const actor = '50000000-0000-4000-8000-000000000001';
const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fictional-public', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service' };
function fixture(role = 'Coach', options = {}) {
  const reads = []; const writes = [];
  const profile = { id: actor, email: 'fixture@example.test', role, is_active: true, must_change_password: false, student_id: 'STU-M-001', ...options.profile };
  const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) }, rpc: async name => {
    if (name === 'portal_take_rate_slot') return { data: true, error: null };
    writes.push(name); throw new Error('Unexpected database mutation');
  }, from: table => {
    const filters = {};
    const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; }, in: (key, value) => { filters[key] = value; return query; }, or: () => query, order: () => query, range: () => query,
      single: async () => ({ data: profile, error: null }),
      maybeSingle: async () => {
        reads.push({ table, filters });
        if (table === 'profiles') return { data: profile, error: null };
        if (table === 'students') return { data: { id: 'STU-M-001' }, error: null };
        if (options.permissionFailure) return { data: null, error: { code: '08006' } };
        const granted = table === 'user_permissions' ? options.userGrant : options.roleGrant;
        return { data: typeof granted === 'boolean' ? { is_granted: granted } : null, error: null };
      },
    };
    query.then = (resolve,reject) => {
      reads.push({table,filters});
      const granted = table === 'user_permissions' ? options.userGrant : options.roleGrant;
      return Promise.resolve(options.permissionFailure ? {data:null,error:{code:'08006'}} : {data:typeof granted==='boolean'?(filters.permission_key??[]).map(permission_key=>({permission_key,is_granted:granted})):[],error:null}).then(resolve,reject);
    };
    for (const method of ['insert', 'update', 'delete', 'upsert']) query[method] = () => { writes.push(`${table}:${method}`); throw new Error('Unexpected database mutation'); };
    return query;
  } };
  const stubs = { '@supabase/supabase-js': { createClient: () => client }, './env': { env }, '@/lib/env': { env }, '@/lib/supabase': { supabase: {} }, '@/lib/data-access': { fetchAllRows: async () => ({ data: [], error: null }) } };
  const security = loadTs('lib/backend-security.ts', stubs);
  return { security, reads, writes, route: file => loadTs(file, { ...stubs, '@/lib/backend-security': security }) };
}
const request = (url, method = 'GET', body, authenticated = true) => new Request(`https://portal.example${url}`, { method, headers: authenticated ? { Authorization: 'Bearer '+Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url')+'.fixture', 'Content-Type': 'application/json' } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
function routeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? routeFiles(path.join(directory, entry.name)) : entry.name === 'route.ts' ? [path.join(directory, entry.name)] : []);
}

test('every administrative and shop REST handler rejects unauthenticated requests before any database mutation', async () => {
  const check = fixture(); let count = 0;
  for (const file of [...routeFiles('app/api/admin'), 'app/api/shop/order/route.ts']) {
    const routes = check.route(file); const url = '/' + file.replaceAll('\\', '/').replace(/^app\//, '').replace(/\/route.ts$/, '');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) if (typeof routes[method] === 'function') {
      const response = await routes[method](request(url, method, ['GET', 'DELETE'].includes(method) ? undefined : {}, false));
      assert.equal(response.status, 401, `${method} ${url}`); count++;
    }
  }
  assert.ok(count >= 40, `Covered ${count} handlers`); assert.deepEqual(check.writes, []); assert.deepEqual(check.reads, []);
});

test('staff CRUD permissions, owner-only access and individual denials are enforced on the server', async () => {
  for (const [role, url, method, allowed] of [
    ['Coach', '/api/admin/classes', 'GET', true], ['Coach', '/api/admin/classes', 'POST', false],
    ['Assistant Coach', '/api/admin/library-assets', 'POST', false], ['Coach', '/api/admin/library-assets', 'POST', true],
    ['Head Coach', '/api/admin/payments', 'POST', false], ['Admin', '/api/admin/payments', 'POST', true],
    ['Admin', '/api/admin/delete-student', 'POST', false], ['Admin', '/api/admin/user-permissions', 'POST', false],
    ['Admin', '/api/admin/permissions', 'POST', false], ['Root', '/api/admin/export', 'GET', true],
    ['Admin', '/api/admin/export', 'GET', false], ['Student', '/api/admin/partners', 'GET', false],
  ]) {
    const check = fixture(role);
    const result = await check.security.verifyCaller(request(url, method), url.endsWith('/export') || url.endsWith('/permissions') || url.endsWith('/user-permissions') ? ['Root', 'Super Root'] : ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach']);
    assert.equal(Boolean(result.context), allowed, `${role} ${method} ${url}`);
    assert.deepEqual(check.writes, []);
  }
  for (const options of [{ userGrant: false, roleGrant: true }, { permissionFailure: true }]) {
    assert.equal((await fixture('Admin', options).security.verifyCaller(request('/api/admin/create-student', 'POST'))).errorResponse.status, 403);
  }
  assert.equal((await fixture('Unrecognized', { userGrant: true }).security.verifyCaller(request('/api/admin/create-student', 'POST'))).errorResponse.status, 403);
});

test('the shop endpoint cannot bypass staff POS permissions or a user-level denial', async () => {
  for (const [role, options] of [['Coach', {}], ['Assistant Coach', {}], ['Admin', { userGrant: false }]]) {
    const check = fixture(role, options); const route = check.route('app/api/shop/order/route.ts');
    assert.equal((await route.GET(request('/api/shop/order'))).status, 403);
    assert.equal((await route.POST(request('/api/shop/order', 'POST', {}))).status, 403);
    assert.deepEqual(check.writes, []);
    assert.ok(!check.reads.some(read => read.table === 'students'));
  }
});

test('memory rate limiting remains bounded and cannot erase an active caller limit under pressure', () => {
  const { checkApiRateLimit } = fixture().security;
  assert.equal(checkApiRateLimit('target', 1).allowed, true);
  for (let i = 0; i < 4999; i++) assert.equal(checkApiRateLimit(`pressure:${i}`).allowed, true);
  assert.equal(checkApiRateLimit('overflow').allowed, false);
  assert.equal(checkApiRateLimit('target', 1).allowed, false);
  assert.equal(checkApiRateLimit('pressure:0').allowed, true);
});
