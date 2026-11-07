'use client';
import { useCallback, useEffect, useRef } from 'react';
import { createAttendanceAudio } from '@/lib/attendance-audio';

export function useAttendanceAudio() {
  const feedback = useRef<ReturnType<typeof createAttendanceAudio> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; feedback.current?.dispose(); feedback.current = null; };
  }, []);
  return useCallback((type: 'success' | 'error') => {
    if (!mounted.current) return;
    if (!feedback.current) feedback.current = createAttendanceAudio(() => {
      const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) throw new Error('Audio is unavailable.');
      return new Context();
    });
    void feedback.current.play(type);
  }, []);
}
