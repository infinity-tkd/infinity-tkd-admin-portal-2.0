import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { loadTs } from './load-ts.mjs';
const { observePortalSession, SESSION_VERIFICATION_TIMEOUT_MS } = loadTs('lib/auth-session.ts');
const session = id => ({ user: { id }, access_token: `token-${id}` });
const mfaSession = (id, aal, sessionId = 'fixture-session') => ({ user: { id }, access_token: `fixture.${Buffer.from(JSON.stringify({ aal, session_id: sessionId })).toString('base64url')}.fixture` });
function observe(getUser = async token => ({ data: { user: { id: token.slice(6) } }, error: null }), overrides = {}) {
  let callback;
  const events = [];
  const stop = observePortalSession({
    onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe: () => events.push('unsubscribe') } } }; },
    getUser,
    ...overrides,
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

test('MFA upgrades and downgrades replace protected snapshots, including cross-tab events', async () => {
  const observer = observe(async () => ({ data: { user: { id: 'A' } }, error: null }));
  observer.emit('SIGNED_IN', mfaSession('A', 'aal1'));
  await delay(15);
  observer.emit('MFA_CHALLENGE_VERIFIED', mfaSession('A', 'aal2'));
  assert.equal(observer.events.at(-1), 'clear', 'old assurance data clears before verification');
  await delay(15);
  assert.equal(observer.events.filter(event => event === 'session:A').length, 2);
  observer.emit('TOKEN_REFRESHED', mfaSession('A', 'aal2'));
  await delay(15);
  assert.equal(observer.events.filter(event => event === 'session:A').length, 2, 'ordinary refresh stays cheap');
  observer.emit('TOKEN_REFRESHED', mfaSession('A', 'aal1'));
  assert.equal(observer.events.at(-1), 'clear', 'downgrade removes the protected snapshot immediately');
  await delay(15);
  assert.equal(observer.events.filter(event => event === 'session:A').length, 3);
  observer.stop();
});

test('sign-out discards an in-flight MFA session upgrade', async () => {
  let release;
  const observer = observe(() => new Promise(resolve => { release = resolve; }));
  observer.emit('SIGNED_IN', mfaSession('A', 'aal1'));
  await delay(15);
  observer.emit('MFA_CHALLENGE_VERIFIED', mfaSession('A', 'aal2'));
  await delay(15);
  observer.emit('SIGNED_OUT', null);
  release({ data: { user: { id: 'A' } }, error: null });
  await delay(15);
  assert.ok(!observer.events.includes('session:A'));
  assert.equal(observer.events.at(-1), 'signed-out');
  observer.stop();
});

test('late SDK MFA responses after sign-out or a different login cannot restore an old session', async () => {
  for (const switchAccount of [false, true]) {
    const late = mfaSession('A', 'aal2', 'old-session');
    let localSignOuts = 0;
    const observer = observe(async () => ({ data: { user: { id: 'A' } }, error: null }), {
      getSession: async () => ({ data: { session: late }, error: null }),
      signOut: async ({ scope }) => { assert.equal(scope, 'local'); ++localSignOuts; return { error: null }; },
    });
    observer.emit('SIGNED_IN', mfaSession('A', 'aal1', 'old-session'));
    await delay(15);
    observer.emit('SIGNED_OUT', null);
    if (switchAccount) {
      observer.emit('SIGNED_IN', mfaSession('A', 'aal1', 'new-session'));
      await delay(15);
    }
    const previousLoads = observer.events.filter(event => event === 'session:A').length;
    observer.emit('MFA_CHALLENGE_VERIFIED', late);
    assert.equal(observer.events.at(-1), 'clear', 'stale verification closes the protected UI immediately');
    await delay(15);
    assert.equal(observer.events.filter(event => event === 'session:A').length, previousLoads);
    assert.equal(localSignOuts, 1);
    assert.equal(observer.events.at(-1), 'signed-out');
    observer.stop();
  }
});

test('discarding stale MFA never signs out a newer session committed before cleanup', async () => {
  let signOuts = 0;
  const observer = observe(async () => ({ data: { user: { id: 'B' } }, error: null }), {
    getSession: async () => ({ data: { session: mfaSession('B', 'aal1', 'new') }, error: null }),
    signOut: async () => { ++signOuts; return { error: null }; },
  });
  observer.emit('SIGNED_OUT', null);
  observer.emit('MFA_CHALLENGE_VERIFIED', mfaSession('A', 'aal2', 'old'));
  await delay(15);
  assert.equal(signOuts, 0);
  assert.equal(observer.events.at(-1), 'session:B', 'the newer verified account remains usable');
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
test('a stalled session verification ends in sign-out instead of an endless loading screen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const observer = observe(() => new Promise(() => {}));
  observer.emit('INITIAL_SESSION', session('A'));
  t.mock.timers.tick(0);
  await Promise.resolve();
  assert.deepEqual(observer.events, ['clear'], 'verification is still pending');
  t.mock.timers.tick(SESSION_VERIFICATION_TIMEOUT_MS);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(observer.events, ['clear', 'clear', 'signed-out', 'error']);
  observer.stop();
});
