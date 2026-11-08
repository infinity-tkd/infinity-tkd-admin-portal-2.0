import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { loadTs } from './load-ts.mjs';

// The module (and its in-memory counters) is shared between tests, so each test uses its own address.
const { middleware } = loadTs('middleware.ts');
const call = (address, pathname, headers) => middleware(new NextRequest('https://academy.test' + pathname, { headers: { 'x-forwarded-for': address, ...headers } }));

test('students reaching the API through one gateway address get their own per-route limits', () => {
  for (let index = 0; index < 60; index++) assert.equal(call('203.0.113.7', '/api/portal/notifications', { Authorization: 'Bearer student-a' }).status, 200);
  assert.equal(call('203.0.113.7', '/api/portal/notifications', { Authorization: 'Bearer student-b' }).status, 200, 'a second student is not blocked by the first');
  const limited = call('203.0.113.7', '/api/portal/notifications', { Authorization: 'Bearer student-a' });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('one address is still capped across all sessions and sign-in stays limited per address', () => {
  let blocked = 0;
  for (let index = 0; index < 1250; index++) if (call('203.0.113.8', '/api/portal/calendar', { Authorization: `Bearer session-${index}` }).status === 429) blocked++;
  assert.equal(blocked, 50, 'requests beyond 1,200 a minute from one address are refused');
  for (let index = 0; index < 15; index++) call('203.0.113.9', '/api/auth/login', { Authorization: `Bearer rotating-${index}` });
  assert.equal(call('203.0.113.9', '/api/auth/login', { Authorization: 'Bearer another' }).status, 429, 'rotating tokens does not bypass the sign-in limit');
});
