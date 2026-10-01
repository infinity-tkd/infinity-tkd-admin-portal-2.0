/**
 * Infinity TKD Web Audio API Sound Synthesizer
 * Zero network dependencies, zero external audio assets, works completely offline.
 */

export function playChime(type: 'success' | 'alert' | 'scan' | 'bell' = 'success') {
  if (typeof window === 'undefined') return;

  try {
    const isAudioEnabled = localStorage.getItem('infinity_audio_feedback') !== 'false';
    if (!isAudioEnabled) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

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
  } catch {
    // Graceful fallback if audio is autoplay-blocked
  }
}

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('infinity_audio_feedback') !== 'false';
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('infinity_audio_feedback', enabled ? 'true' : 'false');
}
