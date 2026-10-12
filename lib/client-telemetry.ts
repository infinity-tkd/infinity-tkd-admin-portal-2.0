type TelemetryLevel = 'ERROR' | 'FATAL';
const recent = new Map<string, number>();
let windowStart = 0;
let reports = 0;

/** Keep runtime diagnostics useful without sending exception messages or query values. */
export function runtimeTelemetry(error: unknown, component: string, level: TelemetryLevel = 'ERROR', route = '') {
  const kind = error instanceof Error && /^[a-z]+error$/i.test(error.name) ? error.name : 'Error';
  const stack = error instanceof Error ? (error.stack || '').split('\n').slice(1, 5)
    .map(line => line.replace(/\?[^\s)]*/g, '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')).join('\n').slice(0, 1000) : '';
  return {
    message: `${component.slice(0, 100)} encountered ${kind}`.slice(0, 300),
    stack, component: component.slice(0, 100), level,
    route: route.split(/[?#]/)[0].slice(0, 100),
    type: kind.slice(0, 50), timestamp: new Date().toISOString(),
  };
}

/** Best-effort and bounded; failures in the logger never report themselves. */
export function reportClientError(error: unknown, component: string, level: TelemetryLevel = 'ERROR') {
  if (typeof window === 'undefined') return;
  const payload = runtimeTelemetry(error, component, level, window.location.pathname);
  const now = Date.now();
  if (now - windowStart >= 60000) { windowStart = now; reports = 0; recent.clear(); }
  const key = JSON.stringify([payload.component, payload.type, payload.stack, payload.route]);
  if (reports >= 5 || now - (recent.get(key) ?? -Infinity) < 10000) return;
  ++reports;
  recent.set(key, now);
  try {
    void fetch('/api/telemetry/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(5000), keepalive: true,
    }).catch(() => {});
  } catch { /* Telemetry must not interrupt error recovery. */ }
}
