import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { loadTs } from './load-ts.mjs';
const { observePortalSession } = loadTs('lib/auth-session.ts');
const session = id => ({ user: { id }, access_token: `token-${id}` });
function observe(getUser = async token => ({ data: { user: { id: token.slice(6) } }, error: null })) {
  let callback;
  const events = [];
  const stop = observePortalSession({
    onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe: () => events.push('unsubscribe') } } }; },
    getUser,
  }, {
    onIdentityChange: () => events.push('clear'),
    onSession: id => events.push(`session:${id}`),
    onSignedOut: () => events.push('signed-out'),
    onError: () => events.push('error'),
  });
  return { events, stop, emit: (event, value) => callback(event, value) };
}
test('auth verification runs outside the subscriber and avoids full reloads on refresh', async () => {
  const observer = observe();
  assert.equal(observer.emit('INITIAL_SESSION', session('A')), undefined);
  assert.deepEqual(observer.events, ['clear']);
  await delay(15);
  assert.deepEqual(observer.events, ['clear', 'session:A']);
  observer.emit('TOKEN_REFRESHED', session('A'));
  observer.emit('SIGNED_IN', session('A'));
  await delay(15);
  assert.equal(observer.events.filter(event => event === 'session:A').length, 1);
  observer.emit('USER_UPDATED', session('A'));
  await delay(15);
  assert.equal(observer.events.filter(event => event === 'session:A').length, 2);
  observer.stop();
});
test('sign-out and switching accounts discard late session verification', async () => {
  let release;
  const observer = observe(token => token === 'token-A' ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ data: { user: { id: 'B' } }, error: null }));
  observer.emit('SIGNED_IN', session('A'));
  await delay(15);
  observer.emit('SIGNED_OUT', null);
  observer.emit('SIGNED_IN', session('B'));
  release({ data: { user: { id: 'A' } }, error: null });
  await delay(15);
  assert.ok(!observer.events.includes('session:A'));
  assert.ok(observer.events.includes('session:B'));
  observer.stop();
});
test('auth verification rejection is handled and disposed subscriptions cannot restore a session', async () => {
  const failed = observe(async () => { throw new Error('Provider offline'); });
  failed.emit('INITIAL_SESSION', session('A'));
  await delay(15);
  assert.deepEqual(failed.events, ['clear', 'clear', 'signed-out', 'error']);
  failed.stop();
  const disposed = observe();
  disposed.emit('SIGNED_IN', session('A'));
  disposed.stop();
  await delay(15);
  disposed.emit('SIGNED_IN', session('B'));
  assert.deepEqual(disposed.events, ['clear', 'unsubscribe']);
});
test('Fast Refresh reuses the browser auth client without changing SDK coordination', () => {
  const previous = globalThis.window;
  globalThis.window = {};
  try {
    let clients = 0;
    const stubs = {
      './env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key' } },
      '@supabase/supabase-js': { createClient: (_url, _key, options) => {
        assert.equal(options.auth.lock, undefined);
        ++clients;
        return { auth: { dispose() {} } };
      } },
    };
    const first = loadTs('lib/supabase.ts', stubs).supabase;
    const second = loadTs('lib/supabase.ts', stubs).supabase;
    assert.equal(first, second);
    assert.equal(clients, 1);
  } finally { globalThis.window = previous; }
});
