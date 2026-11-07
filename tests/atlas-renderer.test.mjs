import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { loadTs } from './load-ts.mjs';

const { createDemandRenderLoop } = loadTs('lib/atlas/render-loop.ts');
const { requestedAtlasParts, validatePartBuffer, anatomyPixelRatio, yieldToBrowser } = loadTs('lib/atlas/model-loading.ts');
const { decodeModelResponse, loadModelChunk } = loadTs('lib/atlas/model-download.ts');

test('settled renderer stops scheduling; interactions coalesce and hidden/closed viewers stop', () => {
  let id = 0, frames = 0, moving = false;
  const pending = new Map();
  const loop = createDemandRenderLoop(() => { frames++; return moving; }, callback => { pending.set(++id, callback); return id; }, frame => pending.delete(frame));
  const tick = () => { const [key, callback] = pending.entries().next().value; pending.delete(key); callback(frames * 16); };
  loop.invalidate(); loop.invalidate();
  assert.equal(pending.size, 1);
  tick(); assert.equal(frames, 1); assert.equal(pending.size, 0);
  moving = true; loop.invalidate(); tick(); assert.equal(pending.size, 1);
  loop.pause(true); assert.equal(pending.size, 0);
  loop.invalidate(); assert.equal(pending.size, 0);
  moving = false; loop.pause(false); tick(); assert.equal(pending.size, 0);
  loop.invalidate(); loop.dispose(); assert.equal(pending.size, 0);
  loop.invalidate(); assert.equal(pending.size, 0);
});

test('model requests respect visible layers and selected/isolate structures; tablet/mobile DPR is bounded', () => {
  const atlas = { parts: [{ id: 'muscle', system: 'muscular' }, { id: 'bone', system: 'skeletal' }, { id: 'organ', system: 'digestive' }] };
  assert.deepEqual(requestedAtlasParts(atlas, { visible: ['muscular'], selected: ['bone'], isolate: false }).map(p => p.id), ['muscle', 'bone']);
  assert.deepEqual(requestedAtlasParts(atlas, { visible: ['muscular'], selected: ['bone'], isolate: true }).map(p => p.id), ['bone']);
  assert.equal(anatomyPixelRatio(3, true), 1);
  assert.equal(anatomyPixelRatio(3, false), 1.5);
  assert.equal(anatomyPixelRatio(NaN, true), 1);
});

test('gzip and already decoded host responses load without double decompression; malformed ranges never reach GPU', async () => {
  const payload = Buffer.from('training-anatomy');
  const gz = gzipSync(payload);
  assert.deepEqual(Buffer.from(await decodeModelResponse(new Response(gz), payload.length, true)), payload);
  assert.deepEqual(Buffer.from(await decodeModelResponse(new Response(payload), payload.length, true)), payload);
  await assert.rejects(decodeModelResponse(new Response('bad'), payload.length, false), /incomplete/);
  await assert.rejects(decodeModelResponse(new Response('', { status: 404 }), payload.length, true), /could not be loaded/);
  const buffer = new ArrayBuffer(68);
  new Uint32Array(buffer, 56, 3).set([0, 1, 2]);
  const part = { vertexCount: 3, indexCount: 3, positions: 0, normals: 36, indices: 56 };
  validatePartBuffer(part, buffer);
  assert.throws(() => validatePartBuffer({ ...part, positions: 2 }, buffer), /invalid/);
  assert.throws(() => validatePartBuffer({ ...part, indices: 64 }, buffer), /invalid/);
  new Uint32Array(buffer, 56, 3)[2] = 3;
  assert.throws(() => validatePartBuffer(part, buffer), /invalid/);
});

test('model reopening reuses static data, compressed host failures fall back once, and closing cancels work', async () => {
  const payload = Buffer.from('reopen-cache-fixture');
  const chunk = { url: '/test/anatomy-unique.bin', gzip: '/test/anatomy-unique.bin.gz', bytes: payload.length };
  const abort = new AbortController(); const urls = [];
  const fetcher = async url => { urls.push(url); return url.endsWith('.gz') ? new Response('', { status: 404 }) : new Response(payload); };
  await loadModelChunk(chunk, abort.signal, fetcher);
  await loadModelChunk(chunk, abort.signal, fetcher);
  assert.deepEqual(urls, [chunk.gzip, chunk.url]);
  abort.abort();
  await assert.rejects(loadModelChunk(chunk, abort.signal, fetcher), { name: 'AbortError' });
  await assert.rejects(yieldToBrowser(abort.signal), { name: 'AbortError' });
});

test('native training bundles retain every training structure/concept and validated geometry', () => {
  const source = JSON.parse(fs.readFileSync('public/models/atlas.json', 'utf8'));
  const expected = source.parts.filter(p => ['muscular', 'skeletal', 'connective'].includes(p.system));
  const sourceBuffers = source.chunks.map(chunk => fs.readFileSync('public' + chunk.url));
  for (const tier of ['', '/compact']) {
    const atlas = JSON.parse(fs.readFileSync(`public/models/training${tier}/atlas.json`, 'utf8'));
    assert.equal(atlas.source, source.source); assert.equal(atlas.sex, source.sex);
    assert.deepEqual(new Set(atlas.parts.map(p => p.id)), new Set(expected.map(p => p.id)));
    const buffers = atlas.chunks.map(chunk => {
      const file = fs.readFileSync('public' + chunk.url);
      assert.deepEqual(gunzipSync(fs.readFileSync('public' + chunk.gzip)), file);
      return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    });
    const ids = new Set(atlas.parts.map(p => p.id));
    assert.ok(atlas.concepts.every(concept => concept.elements.length && concept.elements.every(id => ids.has(id))));
    let triangles = 0;
    for (const part of atlas.parts) {
      validatePartBuffer(part, buffers[part.chunk]); triangles += part.indexCount / 3;
      const original = expected.find(p => p.id === part.id);
      assert.deepEqual(part.bounds, original.bounds); assert.equal(part.name, original.name);
      if (!tier) {
        for (const [key, bytes] of [['positions', part.vertexCount * 12], ['normals', part.vertexCount * 6], ['indices', part.indexCount * 4]]) {
          assert.deepEqual(Buffer.from(buffers[part.chunk], part[key], bytes), sourceBuffers[original.chunk].subarray(original[key], original[key] + bytes));
        }
      } else assert.ok(part.indexCount <= original.indexCount);
    }
    assert.equal(triangles, atlas.triangles);
    assert.ok(atlas.trainingBundle.maximumAdditionalRelativeError <= 0.003);
    assert.ok(atlas.triangles < source.triangles / 2);
  }
});

test('decoded reopen cache remains bounded rather than retaining every historical atlas chunk', async () => {
  const payload = new Uint8Array(8 * 1024 * 1024);
  const signal = new AbortController().signal;
  let downloads = 0;
  const fetcher = async () => { downloads++; return new Response(payload); };
  for (let index = 0; index < 4; index++) await loadModelChunk({ url: `/test/bounded-${index}.bin`, bytes: payload.length }, signal, fetcher);
  assert.equal(downloads, 4);
  await loadModelChunk({ url: '/test/bounded-3.bin', bytes: payload.length }, signal, fetcher);
  assert.equal(downloads, 4);
  await loadModelChunk({ url: '/test/bounded-0.bin', bytes: payload.length }, signal, fetcher);
  assert.equal(downloads, 5);
});
