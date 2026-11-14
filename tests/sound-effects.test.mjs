import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

// Chimes are raised inside the click that produced a notice. They must share one audio context (a context per chime is slow to build, is never
// released and runs into the browser's cap), obey the sound setting, and never play late.
const node = () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} });
function install({ state = 'running', enabled = true, lateResume = false } = {}) {
  const made = { contexts: [], oscillators: 0, release: () => {} };
  class FakeContext {
    constructor() { this.state = state; this.currentTime = 0; this.destination = {}; made.contexts.push(this); }
    createOscillator() { made.oscillators++; return node(); }
    createGain() { return node(); }
    // lateResume: the browser keeps the context suspended until the person's next tap, then resolves resume()
    resume() {
      if (!lateResume) { this.state = 'running'; return Promise.resolve(); }
      return new Promise(resolve => { made.release = () => { this.state = 'running'; resolve(); }; });
    }
  }
  globalThis.window = { AudioContext: FakeContext };
  globalThis.localStorage = { getItem: () => (enabled ? null : 'false'), setItem() {} };
  return made;
}
// A fresh copy of the module per test (any stub bypasses the loader's cache), because the shared audio context lives in module state.
const fresh = () => loadTs('lib/soundEffects.ts', { '__fresh__': {} }).playChime;
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const withClock = async run => {
  const realNow = Date.now; const clock = { now: realNow() };
  Date.now = () => clock.now;
  try { await run(clock); } finally { Date.now = realNow; }
};

test('every chime reuses one audio context', async () => {
  const made = install(); const playChime = fresh();
  for (const type of ['success', 'alert', 'bell', 'scan', 'success', 'alert']) playChime(type);
  await settle();
  assert.equal(made.contexts.length, 1);
  assert.ok(made.oscillators >= 6);
});

test('the sound setting turns chimes off without building a context', async () => {
  const made = install({ enabled: false }); const playChime = fresh();
  playChime('success');
  await settle();
  assert.equal(made.contexts.length, 0);
  assert.equal(made.oscillators, 0);
});

test('a context that resumes straight away still chimes', async () => {
  const made = install({ state: 'suspended' }); const playChime = fresh();
  playChime('bell');
  await settle();
  assert.ok(made.oscillators >= 1);
});

test('a chime the browser only lets start a moment later still plays', async () => {
  const made = install({ state: 'suspended', lateResume: true }); const playChime = fresh();
  await withClock(async clock => {
    playChime('success');
    clock.now += 100;
    made.release();
    await settle();
  });
  assert.ok(made.oscillators >= 2);
});

test('a chime the browser only lets start long afterwards is dropped, not played out of step', async () => {
  const made = install({ state: 'suspended', lateResume: true }); const playChime = fresh();
  await withClock(async clock => {
    playChime('success');
    clock.now += 2000;
    made.release();
    await settle();
  });
  assert.equal(made.oscillators, 0);
});
