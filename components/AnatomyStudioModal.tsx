'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Flame, Sparkle, Stack } from '@phosphor-icons/react';
import { Layers } from 'lucide-react';
import { CurriculumVideo, useAppStore } from '@/lib/store';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { resolveAssetMuscleLoads } from '@/lib/anatomyUtils';
import { cn, formatBeltLocalized } from '@/lib/utils';

// Dynamically import Anatomical3DModel with SSR disabled
const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 p-8">
        <span className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-4" />
        <span className="text-xs text-neutral-400 font-mono uppercase tracking-widest animate-pulse">
          Initializing 3D BodyParts3D Engine...
        </span>
        <span className="text-[10px] text-neutral-600 font-mono mt-2">Loading 2,234 anatomical meshes</span>
      </div>
    )
  }
);

export interface AnatomyStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: CurriculumVideo | null;
  initialGender?: 'Male' | 'Female';
}

export function AnatomyStudioModal({
  isOpen,
  onClose,
  asset = null,
  initialGender = 'Male',
}: AnatomyStudioModalProps) {
  const { state } = useAppStore();
  const t = useT();
  const [gender, setGender] = useState<'Male' | 'Female'>(initialGender);
  const [selectedMuscleToFocus, setSelectedMuscleToFocus] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { muscleLoads, primaryMuscles, secondaryMuscles } = resolveAssetMuscleLoads(asset, state);

  return (
    <Portal>
      <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
        {/* Top Studio Header Bar */}
        <header className="h-14 border-b border-neutral-800/90 px-4 sm:px-6 flex items-center justify-between bg-[#0A0B0D]/95 backdrop-blur-md shrink-0 z-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF2F38] shadow-[0_0_10px_#EF2F38] shrink-0" />
            <div className="flex items-center gap-2 truncate">
              {asset ? (
                <>
                  <span className="text-xs sm:text-sm font-black tracking-wide text-white uppercase truncate font-mono">
                    {asset.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-[#EF2F38] shrink-0">
                    {formatBeltLocalized(asset.minBeltLevel, state.language)}
                  </span>
                  <span className="hidden md:inline px-2 py-0.5 rounded-[6px] text-[9px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 shrink-0">
                    {asset.category}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs sm:text-sm font-bold tracking-wider text-white font-mono uppercase">
                    BodyParts3D Anatomy Explorer · Infinity TKD 2.0
                  </span>
                  <span className="text-xs text-neutral-500 font-mono hidden lg:inline">
                    (2,234 Meshes · 15 Systems · 3,432 Concepts)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Gender Switcher */}
            <div className="flex items-center p-0.5 bg-neutral-900 rounded-[8px] border border-neutral-800 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setGender('Male')}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-[6px] font-bold transition-all cursor-pointer",
                  gender === 'Male'
                    ? "bg-[#EF2F38] text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <User size={11} />
                <span>Male</span>
              </button>
              <button
                type="button"
                onClick={() => setGender('Female')}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-[6px] font-bold transition-all cursor-pointer",
                  gender === 'Female'
                    ? "bg-[#EF2F38] text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <User size={11} />
                <span>Female</span>
              </button>
            </div>

            {/* Close Studio Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-[8px] bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Close 3D Anatomy Studio (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Biomechanical HUD Bar (if technique asset is specified) */}
        {asset && (primaryMuscles.length > 0 || secondaryMuscles.length > 0) && (
          <div className="bg-[#121316] border-b border-neutral-800/80 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 overflow-x-auto shrink-0 z-40">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 flex-wrap">
              {/* Primary Muscles */}
              {primaryMuscles.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-mono font-black uppercase text-red-400 tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-[#EF2F38]" weight="fill" />
                    {t('lib_primary_muscles')}:
                  </span>
                  {primaryMuscles.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMuscleToFocus(m)}
                      className={cn(
                        "px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold transition-all border cursor-pointer",
                        selectedMuscleToFocus === m
                          ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-xs"
                          : "bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/20"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Secondary Stabilizers */}
              {secondaryMuscles.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-mono font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <Sparkle className="w-3 h-3 text-amber-500" weight="fill" />
                    {t('lib_secondary_muscles')}:
                  </span>
                  {secondaryMuscles.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMuscleToFocus(m)}
                      className={cn(
                        "px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold transition-all border cursor-pointer",
                        selectedMuscleToFocus === m
                          ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                          : "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[10px] text-neutral-500 font-mono hidden md:block shrink-0">
              {t('lib_tap_to_focus')}
            </div>
          </div>
        )}

        {/* Main Viewport Container */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0A0B0D]">
          <Anatomical3DModel
            muscleLoads={muscleLoads}
            maxLoad={1.0}
            gender={gender}
            className="w-full h-full border-0 rounded-none bg-transparent"
            onSelectMuscle={(m) => setSelectedMuscleToFocus(m)}
          />
        </div>
      </div>
    </Portal>
  );
}
