import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

// Repack exact source geometry by the three layers used in training. The compact
// tier keeps each source structure and its boundary with a bounded mesh error.
const root = path.resolve('public/models');
const source = JSON.parse(await fs.readFile(path.join(root, 'atlas.json'), 'utf8'));
const layers = ['muscular', 'skeletal', 'connective'];
const sourceBuffers = await Promise.all(source.chunks.map(chunk => fs.readFile(path.join(root, path.basename(chunk.url)))));
await MeshoptSimplifier.ready;
const alignment = size => (size + 3) & ~3;

for (const compact of [false, true]) {
  const folder = compact ? 'training/compact' : 'training';
  const output = path.join(root, folder);
  await fs.mkdir(output, { recursive: true });
  const parts = [], chunks = [];
  let maximumError = 0;
  for (const layer of layers) {
    let pieces = [], byteLength = 0, fileIndex = 0;
    async function flush() {
      if (!pieces.length) return;
      const buffer = Buffer.concat(pieces, byteLength);
      const gzip = gzipSync(buffer, { level: 9 });
      const name = `${layer}-${fileIndex++}.bin`;
      await fs.writeFile(path.join(output, name), buffer);
      await fs.writeFile(path.join(output, name + '.gz'), gzip);
      chunks.push({ url: `/models/${folder}/${name}`, bytes: buffer.length, gzip: `/models/${folder}/${name}.gz`, gzipBytes: gzip.length });
      pieces = []; byteLength = 0;
    }
    for (const part of source.parts.filter(part => part.system === layer)) {
      const original = sourceBuffers[part.chunk];
      let positions = new Float32Array(original.buffer, original.byteOffset + part.positions, part.vertexCount * 3);
      let normals = new Int16Array(original.buffer, original.byteOffset + part.normals, part.vertexCount * 3);
      let indices = new Uint32Array(original.buffer, original.byteOffset + part.indices, part.indexCount);
      let vertexCount = part.vertexCount;
      if (compact && indices.length > 300) {
        const target = Math.max(300, Math.floor(indices.length * 0.25 / 3) * 3);
        const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, 0.003, ['LockBorder']);
        if (simplified.length >= 3 && Number.isFinite(error) && error <= 0.003 && simplified.length < indices.length) {
          indices = simplified;
          maximumError = Math.max(maximumError, error);
        }
        const [remap, count] = MeshoptSimplifier.compactMesh(indices);
        const nextPositions = new Float32Array(count * 3), nextNormals = new Int16Array(count * 3);
        for (let old = 0; old < remap.length; old++) {
          const next = remap[old];
          if (next === 0xffffffff) continue;
          nextPositions.set(positions.subarray(old * 3, old * 3 + 3), next * 3);
          nextNormals.set(normals.subarray(old * 3, old * 3 + 3), next * 3);
        }
        positions = nextPositions; normals = nextNormals; vertexCount = count;
      }
      const positionBytes = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
      const normalBytes = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
      const indexBytes = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
      const partBytes = alignment(positionBytes.length) + alignment(normalBytes.length) + alignment(indexBytes.length);
      if (pieces.length && byteLength + partBytes > 4 * 1024 * 1024) await flush();
      const next = { ...part, chunk: chunks.length, positions: byteLength, normals: byteLength + alignment(positionBytes.length),
        indices: byteLength + alignment(positionBytes.length) + alignment(normalBytes.length), vertexCount, indexCount: indices.length };
      for (const bytes of [positionBytes, normalBytes, indexBytes]) {
        pieces.push(bytes);
        const padding = alignment(bytes.length) - bytes.length;
        if (padding) pieces.push(Buffer.alloc(padding));
      }
      byteLength += partBytes;
      parts.push(next);
    }
    await flush();
  }
  const identifiers = new Set(parts.map(part => part.id));
  const concepts = source.concepts.map(concept => ({ ...concept, elements: concept.elements.filter(id => identifiers.has(id)) })).filter(concept => concept.elements.length > 0);
  const atlas = { ...source, version: `${source.version}-training${compact ? '-compact' : ''}`, parts, chunks, concepts,
    triangles: parts.reduce((count, part) => count + part.indexCount / 3, 0),
    trainingBundle: { layers, tier: compact ? 'compact' : 'reference', sourceManifest: '/models/atlas.json',
      preservesStructureIds: true, preservesBoundaries: true, maximumAdditionalRelativeError: maximumError } };
  await fs.writeFile(path.join(output, 'atlas.json'), JSON.stringify(atlas));
  console.log(JSON.stringify({ manifest: `/models/${folder}/atlas.json`, structures: parts.length, triangles: atlas.triangles,
    decodedBytes: chunks.reduce((n, c) => n + c.bytes, 0), transferBytes: chunks.reduce((n, c) => n + c.gzipBytes, 0), maximumError }));
}
