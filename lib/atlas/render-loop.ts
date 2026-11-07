/** One scheduled frame at most; a settled viewer consumes no animation frames. */
export function createDemandRenderLoop(
  draw: (time: number) => boolean,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame
) {
  let frame: number | null = null;
  let paused = false;
  let disposed = false;
  const tick: FrameRequestCallback = (time) => {
    frame = null;
    if (paused || disposed) return;
    if (draw(time)) invalidate();
  };
  const invalidate = () => {
    if (!disposed && !paused && frame === null) frame = request(tick);
  };
  return {
    invalidate,
    pause(value: boolean) {
      paused = value;
      if (paused && frame !== null) { cancel(frame); frame = null; }
      if (!paused) invalidate();
    },
    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}
