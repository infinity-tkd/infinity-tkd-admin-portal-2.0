'use client';
import {useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import { dialogMotion } from '@/lib/motion';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { FastForward } from '@phosphor-icons/react/dist/csr/FastForward';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { useWorkoutTimer, TimerMode } from '@/hooks/useWorkoutTimer';

export function WorkoutTimerModal({ workout, onClose }: { workout: any, onClose: () => void }) {
  const t = useT();
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,onClose);
  const exercises=Array.isArray(workout.structure.exercises)?workout.structure.exercises:[];
  const { mode, currentRound, totalRounds, timeRemaining, isActive, startTimer, pauseTimer, resetTimer, nextRound, prevRound } = useWorkoutTimer({
    prepareSeconds: workout.structure.prepareSeconds,
    workSeconds: workout.structure.workSeconds,
    restSeconds: workout.structure.restSeconds,
    totalRounds: workout.structure.rounds * Math.max(1, exercises.length),
  });

  // Get active exercise for current round
  const currentExercise=exercises.length?String(exercises[(currentRound-1)%exercises.length]):'Follow the assigned workout';

  // Colors based on timer modes
  const getThemeColor = () => {
    switch (mode) {
      case 'Prepare': return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' };
      case 'Work': return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', glow: 'shadow-green-500/20' };
      case 'Rest': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
      case 'Completed': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/20' };
      default: return { bg: 'bg-[#141414]', border: 'border-[#262626]', text: 'text-white', glow: 'shadow-transparent' };
    }
  };

  const theme = getThemeColor();

  const getModeLabel = (m: TimerMode) => {
    switch (m) {
      case 'Prepare': return t('lib_routine_prep_label').replace(/\s*\(.*\)/, '').trim();
      case 'Work': return t('lib_routine_work_label').replace(/\s*\(.*\)/, '').trim();
      case 'Rest': return t('lib_routine_rest_label').replace(/\s*\(.*\)/, '').trim();
      case 'Completed': return t('lib_timer_completed_label');
      default: return String(m);
    }
  };

  const diffTrans = workout.difficulty === 'Beginner' ? t('lib_diff_beginner') : workout.difficulty === 'Intermediate' ? t('lib_diff_intermediate') : workout.difficulty === 'Advanced' ? t('lib_diff_advanced') : workout.difficulty === 'Elite' ? t('lib_diff_elite') : workout.difficulty;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in">
        <motion.div {...dialogMotion} ref={dialog} role="dialog" aria-modal="true" aria-label="Workout timer" tabIndex={-1}
          className={cn("w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border rounded-[8px] p-6 shadow-2xl flex flex-col justify-between space-y-6 transition-all duration-300 bg-[#0A0A0A] dark-card-override", theme.border, `shadow-2xl ${theme.glow}`)}
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">{t('lib_difficulty_workout').replace('{difficulty}', diffTrans)}</span>
              <h3 className="text-sm font-bold text-white mt-0.5">{workout.title}</h3>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close workout timer"
              className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center bg-[#1A1A1A] border border-[#262626] text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>

          {/* Central Timer Face */}
          <div className={cn("rounded-[8px] p-8 flex flex-col items-center justify-center transition-all relative border border-transparent overflow-hidden", theme.bg)}>
            <span className="text-[9px] uppercase font-black tracking-[0.25em] text-neutral-400">{t('lib_timer_current_mode')}</span>

            {/* Massive mode flash text */}
            <motion.h1 key={mode} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("text-2xl font-black uppercase tracking-widest mt-1 mb-2 font-mono", theme.text)}>
              {getModeLabel(mode)}
            </motion.h1>

            {/* Huge numeric clock */}
            <motion.h2 key={timeRemaining} initial={{ scale: 0.9, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl font-black font-mono text-white leading-none tracking-tight">
              {timeRemaining}s
            </motion.h2>

            {/* Round info bar with interval navigation */}
            <div className="flex items-center justify-between w-full max-w-[240px] mt-4 px-3 py-1 bg-black/40 rounded-full border border-white/5 text-[10px] text-neutral-300 font-mono">
              <button 
                type="button" 
                onClick={prevRound} 
                className="hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none p-1 cursor-pointer transition-colors"
                disabled={currentRound <= 1}
                title="Previous Interval"
              >
                ◀ Prev
              </button>
              <span className="font-bold">{t('lib_timer_round')} {Math.ceil(currentRound / Math.max(1, exercises.length))} / {Math.ceil(totalRounds / Math.max(1, exercises.length))}</span>
              <button 
                type="button" 
                onClick={nextRound} 
                className="hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none p-1 cursor-pointer transition-colors"
                disabled={mode === 'Completed'}
                title="Next Interval"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Targeted Movement Guidance */}
          <div className="bg-[#141414] border border-[#262626] rounded-[8px] p-4 text-center">
            <span className="block text-[8px] uppercase font-bold text-neutral-400 tracking-wider mb-1">{t('lib_timer_target_action')}</span>
            {mode === 'Prepare' && <p className="text-xs text-neutral-300 font-bold font-mono">{t('lib_timer_prep_desc')}</p>}
            {mode === 'Rest' && <p className="text-xs text-neutral-300 font-bold font-mono">{t('lib_timer_rest_desc')}</p>}
            {mode === 'Completed' && <p className="text-xs text-green-400 font-bold font-mono">{t('lib_timer_completed_desc')}</p>}
            {mode === 'Work' && (
              <motion.p key={currentExercise} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-sm text-white font-bold leading-tight uppercase font-mono">
                {currentExercise}
              </motion.p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isActive && mode !== 'Completed' && (
              <button onClick={startTimer}
                className="flex-1 bg-green-500 text-black hover:bg-green-600 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                <FastForward className="w-4 h-4" weight="fill"/> {t('lib_timer_start')}
              </button>
            )}

            {isActive && (
              <button onClick={pauseTimer}
                className="flex-1 bg-[#1A1A1A] border border-[#333] hover:bg-[#222] text-amber-500 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors"
              >
                {t('lib_timer_pause')}
              </button>
            )}

            <button onClick={resetTimer}
              className="px-4 bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] text-neutral-400 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {t('lib_timer_reset')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
