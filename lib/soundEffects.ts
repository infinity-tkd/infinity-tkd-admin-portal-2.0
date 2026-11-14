/**
 * Infinity TKD Web Audio API Sound Synthesizer
 * Zero network dependencies, zero external audio assets, works completely offline.
 */

// One audio context for the whole page. Building a new one for every chime starts an audio thread each time (slow, and it ran inside the
// click that raised the notice), is never released, and browsers cap how many may exist at once, after which chimes go silent.
let shared: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!shared || shared.state === 'closed') shared = new AudioContextClass();
  return shared;
}

function schedule(ctx: AudioContext, type: 'success' | 'alert' | 'scan' | 'bell') {
  if (type === 'success' || type === 'scan') {
    // Pleasant double harmonic chime (E5 -> A5)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.1); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now); // E6
    osc2.frequency.exponentialRampToValueAtTime(1760.00, now + 0.1); // A6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } else if (type === 'bell') {
    // Warm zen bell chime
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'alert') {
    // Subtle warning double blip
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(330, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }
}

export function playChime(type: 'success' | 'alert' | 'scan' | 'bell' = 'success') {
  if (typeof window === 'undefined') return;

  try {
    if (!isAudioEnabled()) return;

    const ctx = audioContext();
    if (!ctx) return;

    // A context that browser autoplay rules have not let start is asked to resume. If that only succeeds later (after the person's next tap)
    // the chime is dropped rather than played late, out of step with what happened on screen.
    const requested = Date.now();
    const play = () => { if (Date.now() - requested <= 400) schedule(ctx, type); };
    if (ctx.state === 'running') play();
    else ctx.resume().then(play, () => { /* still blocked: stay silent */ });
  } catch {
    // Graceful fallback if audio is autoplay-blocked
  }
}

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem('infinity_audio_feedback') !== 'false'; } catch { return true; }
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem('infinity_audio_feedback', enabled ? 'true' : 'false'); } catch { /* Storage can be disabled by browser policy. */ }
}
