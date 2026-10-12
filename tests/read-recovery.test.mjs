import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { createReadRecovery, settleReads } = loadTs('lib/read-recovery.ts');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('read recovery batches bursts, retains changes during a load, and stops on disposal', async () => {
  let count = 0, release;
  const recovery = createReadRecovery(async () => { ++count; if (count === 1) await new Promise(resolve => { release = resolve; }); }, () => true, 5);
  for (let i = 0; i < 20; i++) recovery.request();
  await pause(20);
  assert.equal(count, 1);
  for (let i = 0; i < 20; i++) recovery.request();
  release();
  await pause(20);
  assert.equal(count, 2, 'one reconciliation after an in-flight burst');
  recovery.request(); recovery.dispose();
  await pause(20);
  assert.equal(count, 2, 'disposed session never reloads');
});

test('offline recovery waits for availability and absorbs read failures without looping', async () => {
  let available = false, count = 0;
  const recovery = createReadRecovery(async () => { ++count; throw new Error('Offline'); }, () => available, 5);
  recovery.request(); await pause(20); assert.equal(count, 0);
  available = true; recovery.request(); await pause(20); assert.equal(count, 1);
  await pause(20); assert.equal(count, 1, 'no unbounded retries');
  recovery.dispose();
});

test('bounded startup reads retain ordering, independent failures and the concurrency limit', async () => {
  let running = 0, peak = 0;
  const reads = Array.from({ length: 20 }, (_, index) => async () => {
    ++running; peak = Math.max(peak, running);
    await pause(index % 2 ? 1 : 3); --running;
    if (index === 7) throw new Error('One dataset failed');
    return index;
  });
  const results = await settleReads(reads, 4);
  assert.equal(peak, 4);
  assert.equal(results[7].status, 'rejected');
  assert.deepEqual(results.filter(r => r.status === 'fulfilled').map(r => r.value), Array.from({length:20}, (_,i) => i).filter(i => i !== 7));
  await assert.rejects(settleReads(reads, 0), /positive integer/);
});
