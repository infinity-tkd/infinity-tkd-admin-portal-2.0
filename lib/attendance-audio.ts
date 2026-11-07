/** Reuse the kiosk's audio context and release short-lived sound nodes. */
export function createAttendanceAudio(createContext: () => AudioContext) {
  let context: AudioContext | null = null;
  return {
    async play(type: 'success' | 'error') {
      try {
        if (!context || context.state === 'closed') context = createContext();
        const active = context;
        if (active.state === 'suspended') await active.resume();
        if (active !== context || active.state === 'closed') return;
        const oscillator = active.createOscillator(), gain = active.createGain();
        oscillator.connect(gain);
        gain.connect(active.destination);
        const duration = type === 'success' ? .3 : .35;
        oscillator.type = type === 'success' ? 'sine' : 'sawtooth';
        oscillator.frequency.setValueAtTime(type === 'success' ? 587.33 : 220, active.currentTime);
        if (type === 'success') oscillator.frequency.setValueAtTime(880, active.currentTime + .08);
        gain.gain.setValueAtTime(type === 'success' ? .18 : .2, active.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, active.currentTime + duration);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start();
        oscillator.stop(active.currentTime + duration);
      } catch { /* Audio feedback is optional and must never fail a check-in. */ }
    },
    dispose() {
      const active = context;
      context = null;
      if (active && active.state !== 'closed') void active.close().catch(() => {});
    },
  };
}
