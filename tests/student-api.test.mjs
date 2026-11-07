import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const actor = '50000000-0000-4000-8000-000000000001';
const security = loadTs('lib/backend-security.ts', {
  './env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fictional-public', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service' } },
  '@/lib/supabase': { supabase: {} },
});
const { createStudentPayload, updateStudentPayload } = loadTs('lib/student-payload.ts');
const { unwrapApiError, readApiResponse } = loadTs('lib/api-response.ts');
const fixture = { englishName: 'Fixture Athlete', khmerName: 'Fixture', gender: 'Male', dob: '2010-01-01', registrationDate: '2025-01-01', homeBranchId: 1, scholarshipId: 1, heightCm: 0, weightKg: 0, classId: '', addressLine1: '', country: 'Cambodia', address: { line1: '', city: '', country: 'Cambodia' } };
function route(file, { result = { data: { id: 'STU-M-003', enrollmentId: 4 }, error: null }, lookup = { data: { id: 'STU-M-003', student_status: 'Active' }, error: null } } = {}) {
  const calls = []; const audits = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return result; }, from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => lookup }; return query;
  } };
  const routes = loadTs(file, { '@/lib/dates': loadTs('lib/dates.ts'), '@/lib/backend-security': {
    ...security, verifyCaller: async () => ({ context: { userId: actor, role: 'Admin' }, adminSupabase: client }),
    logSecurityAuditEvent: async event => audits.push(event),
  } });
  return { routes, calls, audits };
}
const request = body => new Request('https://portal.example/api/admin/create-student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('registration and bulk-import form state produce a valid strict API request', async () => {
  const { routes, calls } = route('app/api/admin/create-student/route.ts');
  const payload = createStudentPayload(fixture);
  assert.equal(payload.heightCm, null); assert.equal(payload.weightKg, null);
  for (const field of ['classId', 'addressLine1', 'country', 'address']) assert.ok(!(field in payload));
  assert.equal((await routes.POST(request({ studentData: payload }))).status, 200);
  assert.equal(calls[0].args.p_actor, actor); assert.equal(calls[0].args.p_address, null);
  assert.equal(calls[0].args.p_student.height_cm, null);
  const withAddress = createStudentPayload({ ...fixture, heightCm: '172.5', weightKg: 65, initialClassId: 2, address: { id: 99, line1: '123 Fixture', city: 'Fixture city', country: 'Cambodia' } });
  assert.equal((await routes.POST(request({ studentData: withAddress }))).status, 200);
  assert.equal(calls[1].args.p_class_id, 2); assert.equal(calls[1].args.p_student.height_cm, 172.5);
  assert.equal(calls[1].args.p_address.address_line1, '123 Fixture');
});

test('invalid student values and unsupported identities never reach a database mutation', async () => {
  const { routes, calls } = route('app/api/admin/create-student/route.ts');
  const payload = createStudentPayload(fixture);
  for (const change of [{ dob: '2026-02-30' }, { dob: '2200-01-01' }, { registrationDate: '2200-01-01' }, { gender: 'Other' }, { studentStatus: 'Unknown' }, { homeBranchId: '1wrong' }, { heightCm: -1 }, { heightCm: '12wrong' }, { weightKg: 601 }, { englishName: ' ' }, { id: 'Spoofed' }, { profileId: actor }, { address: { line1: '', city: 'Entered city' } }]) {
    assert.equal((await routes.POST(request({ studentData: { ...payload, ...change } }))).status, 422, JSON.stringify(change));
  }
  // Malformed numeric strings must remain invalid after client serialization.
  assert.equal(createStudentPayload({ ...fixture, heightCm: '12wrong' }).heightCm, '12wrong');
  assert.equal(calls.length, 0);
});

test('editing strips read-only fields and permits students with unrecorded measurements', async () => {
  const { routes, calls } = route('app/api/admin/update-student/route.ts');
  const data = updateStudentPayload({ ...fixture, id: 'STU-M-003', profileId: actor, statusChangedAt: 'Spoofed', classEnrollmentDate: '2025-01-01', enrollmentId: 4 });
  assert.ok(!('id' in data)); assert.ok(!('profileId' in data)); assert.ok(!('statusChangedAt' in data));
  assert.equal((await routes.POST(request({ id: 'STU-M-003', data }))).status, 200);
  assert.equal(calls[0].name, 'portal_update_student_with_enrollment');
  assert.equal(calls[0].args.p_changes.height_cm, null); assert.equal(calls[0].args.p_enrollment, 4);
  assert.equal((await routes.POST(request({ id: 'STU-M-003', data: { ...data, profileId: actor } }))).status, 422);
  assert.equal(calls.length, 1);
});

test('missing students, database outages and unconfirmed transactions never report a save', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [lookup, status] of [[{ data: null, error: null }, 404], [{ data: null, error: { code: '42P01', message: 'Fixture schema failure' } }, 503]]) {
    const { routes, calls, audits } = route('app/api/admin/update-student/route.ts', { lookup });
    assert.equal((await routes.POST(request({ id: 'STU-M-003', data: { englishName: 'Changed' } }))).status, status);
    assert.equal(calls.length, 0); assert.equal(audits.length, 0);
  }
  for (const result of [{ data: null, error: { code: '23505', message: 'Student already registered' } }, { data: null, error: { code: 'PGRST202', message: 'Unavailable' } }]) {
    const { routes, audits } = route('app/api/admin/create-student/route.ts', { result });
    assert.ok((await routes.POST(request({ studentData: createStudentPayload(fixture) }))).status >= 400);
    assert.equal(audits.length, 0);
  }
});

test('validation responses identify nested fields without echoing arbitrary keys or enum input', async () => {
  const { routes } = route('app/api/admin/create-student/route.ts');
  const response = await routes.POST(request({ studentData: { ...createStudentPayload(fixture), dob: '2026-02-30', gender: 'SECRET_VALUE', SECRET_KEY: 'SECRET_VALUE' } }));
  const body = await response.json();
  assert.ok(body.error.issues.some(issue => issue.field === 'studentData.dob'));
  assert.match(unwrapApiError(body), /Dob: Enter a valid birth date/);
  assert.ok(!JSON.stringify(body).includes('SECRET'));
});

test('malformed and oversized JSON are rejected before field validation', async () => {
  const { z } = await import('zod');
  const malformed = new Request('https://portal.example', { method: 'POST', body: '{' });
  assert.equal((await security.validateRequestBody(z.object({}), malformed)).errorResponse.status, 400);
  const oversized = new Request('https://portal.example', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(1048576) }) });
  assert.equal((await security.validateRequestBody(z.object({}), oversized)).errorResponse.status, 413);
});

test('proxy HTML, empty responses and expired sessions produce useful errors', async () => {
  await assert.rejects(readApiResponse(new Response('<html>Internal stacktrace</html>', { status: 502 })), /check whether your changes were saved/);
  await assert.rejects(readApiResponse(new Response('', { status: 401 })), /sign in again/);
  await assert.rejects(readApiResponse(Response.json([])), /unreadable response/);
  assert.deepEqual(await readApiResponse(Response.json({ success: true, data: { id: 1 } })), { success: true, data: { id: 1 } });
  await assert.rejects(readApiResponse(Response.json({ success: false, error: { message: 'Save declined' } })), /Save declined/);
});

test('student contact input is canonicalized and invalid links cannot reach the database', async () => {
  const creation = route('app/api/admin/create-student/route.ts');
  assert.equal((await creation.routes.POST(request({ studentData: createStudentPayload({ ...fixture, telegramUsername: 'https://t.me/Fixture_Athlete' }) }))).status, 200);
  assert.equal(creation.calls[0].args.p_student.telegram_username, 'fixture_athlete');
  assert.equal((await creation.routes.POST(request({ studentData: createStudentPayload({ ...fixture, telegramUsername: 'https://evil.example/athlete' }) }))).status, 422);
  assert.equal(creation.calls.length, 1);
  const editing = route('app/api/admin/update-student/route.ts');
  for (const [value, expected] of [['@New_Athlete', 'new_athlete'], ['', null], [null, null]]) {
    assert.equal((await editing.routes.POST(request({ id: 'STU-M-003', data: { telegramUsername: value } }))).status, 200);
    assert.equal(editing.calls.at(-1).args.p_changes.telegram_username, expected);
  }
  assert.equal((await editing.routes.POST(request({ id: 'STU-M-003', data: { phone: '012345678' } }))).status, 200);
  assert.ok(!('telegram_username' in editing.calls.at(-1).args.p_changes), 'unrelated edits retain the existing contact');
});
