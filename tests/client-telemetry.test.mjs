import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { runtimeTelemetry, reportClientError } = loadTs('lib/client-telemetry.ts');

test('telemetry omits private error messages and URL queries and obeys payload bounds', () => {
  const error = new Error('Private student name and private@example.test');
  error.stack = 'Error: Private student name\n at render (https://example.test/file.js?token=secret:1:5)\n at private@example.test';
  const payload = runtimeTelemetry(error, 'Partners', 'ERROR', '/partners?email=private@example.test#secret');
  const body = JSON.stringify(payload);
  for (const secret of ['Private student', 'private@example.test', 'token=secret']) assert.ok(!body.includes(secret));
  assert.equal(payload.route, '/partners');
  assert.equal(payload.message, 'Partners encountered Error');
  assert.ok(payload.stack.length <= 1000);
});

test('repeated errors and telemetry failures cannot create an error-report loop', async t => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { pathname: '/dashboard' } };
  let reports = 0;
  t.mock.method(globalThis, 'fetch', async () => { ++reports; throw new Error('Logger offline'); });
  try {
    for (let i=0;i<20;i++) reportClientError(new Error('same'), 'Background');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(reports, 1);
    for (let i=0;i<20;i++) reportClientError(new Error('Other'), 'Component' + i);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(reports, 5, 'at most five reports per minute');
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});
