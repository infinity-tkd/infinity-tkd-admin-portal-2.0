/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error('An anatomy file could not be loaded.');
  const payload = await response.arrayBuffer();
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b;
  const buffer = gzip
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : payload;
  if (buffer.byteLength !== expectedBytes)
    throw new Error('An anatomy file was incomplete. Please reload the viewer.');
  return buffer;
}

// Keep a small LRU of decoded static chunks across modal reopenings. No geometries,
// scenes or user records are retained; oversized entries are never cached.
const CACHE_BYTES = 24 * 1024 * 1024;
const decoded = new Map<string, ArrayBuffer>();
let retainedBytes = 0;

export async function loadModelChunk(
  chunk: { url: string; bytes: number; gzip?: string },
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
) {
  const key = `${chunk.url}:${chunk.bytes}`;
  const cached = decoded.get(key);
  if (cached) {
    if (signal.aborted) throw new DOMException('The viewer was closed.', 'AbortError');
    decoded.delete(key);
    decoded.set(key, cached);
    return cached;
  }
  const compressed = !!chunk.gzip && typeof DecompressionStream !== 'undefined';
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) request.abort();
  const timeout = setTimeout(() => request.abort(), 30000);
  let buffer: ArrayBuffer;
  try {
    try {
      buffer = await decodeModelResponse(await fetcher(compressed ? chunk.gzip! : chunk.url, { signal: request.signal }), chunk.bytes, compressed);
    } catch (error) {
      if (!compressed || request.signal.aborted) throw error;
      // Some static hosts do not serve precompressed extensions. Fall back once.
      buffer = await decodeModelResponse(await fetcher(chunk.url, { signal: request.signal }), chunk.bytes, false);
    }
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
  if (signal.aborted) throw new DOMException('The viewer was closed.', 'AbortError');
  if (buffer.byteLength <= CACHE_BYTES) {
    while (retainedBytes + buffer.byteLength > CACHE_BYTES && decoded.size > 0) {
      const oldest = decoded.keys().next().value!;
      retainedBytes -= decoded.get(oldest)!.byteLength;
      decoded.delete(oldest);
    }
    // A second mounted viewer may have completed the same chunk while downloading.
    const previous = decoded.get(key);
    if (previous) retainedBytes -= previous.byteLength;
    decoded.set(key, buffer);
    retainedBytes += buffer.byteLength;
  }
  return buffer;
}
