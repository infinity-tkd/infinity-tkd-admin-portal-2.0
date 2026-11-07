import type { Atlas, Part, SceneState } from './anatomy';

export function requestedAtlasParts(atlas: Atlas, state: Pick<SceneState, 'visible' | 'selected' | 'isolate'>) {
  const selected = new Set(state.selected);
  const systems = new Set(state.visible);
  return atlas.parts.filter((part) => state.isolate ? selected.has(part.id) : systems.has(part.system) || selected.has(part.id));
}

/** Reject malformed ranges before typed-array construction or GPU upload. */
export function validatePartBuffer(part: Part, buffer: ArrayBuffer) {
  const ranges = [
    [part.positions, part.vertexCount * 3 * 4, 4],
    [part.normals, part.vertexCount * 3 * 2, 2],
    [part.indices, part.indexCount * 4, 4],
  ];
  if (!Number.isSafeInteger(part.vertexCount) || part.vertexCount < 1 ||
      !Number.isSafeInteger(part.indexCount) || part.indexCount < 3 || part.indexCount % 3 !== 0 ||
      ranges.some(([offset, size, alignment]) => !Number.isSafeInteger(offset) || offset < 0 || offset % alignment !== 0 || offset + size > buffer.byteLength)) {
    throw new Error('A training anatomy structure was invalid. Use the 2D view and retry the 3D viewer.');
  }
  const indices = new Uint32Array(buffer, part.indices, part.indexCount);
  for (const index of indices) if (index >= part.vertexCount) {
    throw new Error('A training anatomy structure was invalid. Use the 2D view and retry the 3D viewer.');
  }
}

export function anatomyPixelRatio(deviceRatio: number, compact: boolean) {
  return Math.min(Number.isFinite(deviceRatio) ? Math.max(1, deviceRatio) : 1, compact ? 1 : 1.5);
}

/** Yield between batches so navigation, progress and dismissal remain responsive. */
export function yieldToBrowser(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('The viewer was closed.', 'AbortError')); return; }
    const cancelled = () => { clearTimeout(timer); reject(new DOMException('The viewer was closed.', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, 0);
    signal.addEventListener('abort', cancelled, { once: true });
  });
}
