import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'Idle' | 'Prepare' | 'Work' | 'Rest' | 'Completed';

interface TimerState {
  mode: TimerMode;
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;
}

export function useWorkoutTimer(config: {
  prepareSeconds: number;
  workSeconds: number;
  restSeconds: number;
  totalRounds: number;
}) {
  const [state, setState] = useState<TimerState>({
    mode: 'Idle',
    currentRound: 1,
    totalRounds: config.totalRounds,
    timeRemaining: config.prepareSeconds,
  });

  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    setIsActive(true);
    if (state.mode === 'Idle') {
      setState(prev => ({ ...prev, mode: 'Prepare', timeRemaining: config.prepareSeconds }));
    }
  };

  const pauseTimer = () => {
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resetTimer = () => {
    pauseTimer();
    setState({
      mode: 'Idle',
      currentRound: 1,
      totalRounds: config.totalRounds,
      timeRemaining: config.prepareSeconds,
    });
  };

  useEffect(() => {
    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timeRemaining > 1) {
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        }

        // Handle State transitions when countdown reaches 0
        if (prev.mode === 'Prepare') {
          // Transition: Prepare -> Work
          return { ...prev, mode: 'Work', timeRemaining: config.workSeconds };
        } 
        
        if (prev.mode === 'Work') {
          if (prev.currentRound < prev.totalRounds) {
            // Transition: Work -> Rest (More rounds remain)
            return { ...prev, mode: 'Rest', timeRemaining: config.restSeconds };
          } else {
            // Transition: Work -> Completed
            setIsActive(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return { ...prev, mode: 'Completed', timeRemaining: 0 };
          }
        } 
        
        if (prev.mode === 'Rest') {
          // Transition: Rest -> Work (Next Round)
          return { 
            ...prev, 
            mode: 'Work', 
            currentRound: prev.currentRound + 1, 
            timeRemaining: config.workSeconds 
          };
        }

        return prev;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, state.mode, state.currentRound, config.prepareSeconds, config.workSeconds, config.restSeconds]);

  const nextRound = () => {
    setState(prev => {
      if (prev.currentRound < prev.totalRounds) {
        return {
          ...prev,
          mode: 'Work',
          currentRound: prev.currentRound + 1,
          timeRemaining: config.workSeconds
        };
      } else {
        setIsActive(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return { ...prev, mode: 'Completed', timeRemaining: 0 };
      }
    });
  };

  const prevRound = () => {
    setState(prev => {
      const targetRound = Math.max(1, prev.currentRound - 1);
      return {
        ...prev,
        mode: 'Work',
        currentRound: targetRound,
        timeRemaining: config.workSeconds
      };
    });
  };

  return {
    ...state,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
    nextRound,
    prevRound,
  };
}
