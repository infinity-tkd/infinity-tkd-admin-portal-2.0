/** Probe only on a 3D request, and release the temporary GPU context immediately. */
export function detectAnatomyWebGL(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const canvas = createCanvas();
    const options = { powerPreference: 'low-power' as const, failIfMajorPerformanceCaveat: true };
    context = canvas.getContext('webgl2', options) as WebGL2RenderingContext | null;
    return Boolean(context);
  } catch {
    return false;
  } finally {
    try { context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* A lost probe is already released. */ }
  }
}
