import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { loadTs } from './load-ts.mjs';

const { middleware } = loadTs('middleware.ts');
const { canAccessRoute } = loadTs('lib/security.ts');

test('middleware authentication failures for admin APIs are private and never cached', async () => {
  for (const [pathname, headers] of [
    ['/api/admin/events', {}],
    ['/api/admin/events', { Authorization: 'Basic fixture' }],
    ['/api/admin/events/94000000-0000-4000-8000-000000000003/files/94000000-0000-4000-8000-000000000004', {}],
  ]) {
    const response = middleware(new NextRequest('https://academy.test' + pathname, { headers }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('vary'), /Authorization/i);
    assert.match(response.headers.get('vary'), /Cookie/i);
    assert.equal((await response.json()).error.code, 'AUTH_UNAUTHORIZED');
  }
});

test('the middleware still delegates valid bearer validation and normal pages to their existing handlers', () => {
  for (const [pathname, headers] of [['/api/admin/events', { Authorization: 'Bearer fixture' }], ['/calendar', {}]]) {
    const response = middleware(new NextRequest('https://academy.test' + pathname, { headers }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});

test('calendar route checks require the calendar page permission and retain adjacent route behaviour', () => {
  for (const pathname of ['/calendar', '/calendar/events']) {
    for (const role of ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach']) assert.equal(canAccessRoute(role, pathname), true, `${role} ${pathname}`);
    for (const role of [null, undefined, 'Student', 'Unknown']) assert.equal(canAccessRoute(role, pathname), false, `${role} ${pathname}`);
  }
  assert.equal(canAccessRoute('Student', '/lms'), false);
  assert.equal(canAccessRoute('Student', '/calendar-other'), false);
});
