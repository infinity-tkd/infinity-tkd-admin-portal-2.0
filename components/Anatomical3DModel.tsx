'use client';

import React, { useState } from 'react';
import {
  Maximize2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AnatomyAtlasExplorer } from './atlas/AnatomyAtlasExplorer';
import { Biomechanical2DScanner } from './2d/Biomechanical2DScanner';
import { Portal } from './Portal';

// Re-exports
export { AnatomyAtlasExplorer } from './atlas/AnatomyAtlasExplorer';
export { Biomechanical2DScanner } from './2d/Biomechanical2DScanner';
export { ANATOMY_DATABASE, TKD_KICK_PRESETS } from '@/lib/anatomyData';
export { useAnatomyStore } from '@/lib/useAnatomyStore';

export type AnatomicalGender = 'Male' | 'Female';

export interface Anatomical3DModelProps {
  muscleLoads?: Record<string, number>;
  maxLoad?: number;
  gender?: AnatomicalGender;
  modelUrl?: string; // Maintained for backwards-compatibility
  className?: string;
  studentStatus?: Record<string, any>;
  onSelectMuscle?: (muscle: string | null) => void;
  defaultViewMode?: '3d' | '2d';
}

const isWebGLSupported = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2', { powerPreference: 'default', failIfMajorPerformanceCaveat: false }) ||
       c.getContext('webgl', { powerPreference: 'default', failIfMajorPerformanceCaveat: false }) ||
       (c as any).getContext('experimental-webgl', { powerPreference: 'default', failIfMajorPerformanceCaveat: false }))
    );
  } catch {
    return false;
  }
};

export function Anatomical3DModel({
  muscleLoads = {},
  maxLoad = 1.0,
  gender = 'Male',
  modelUrl,
  className = 'h-[440px]',
  studentStatus,
  onSelectMuscle,
  defaultViewMode = '3d',
}: Anatomical3DModelProps) {
  const [hasWebGL] = useState<boolean>(isWebGLSupported);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(() => {
    if (!isWebGLSupported()) return '2d';
    return defaultViewMode;
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMuscleName, setSelectedMuscleName] = useState<string | null>(null);

  const handleSelect = (name: string | null) => {
    setSelectedMuscleName(name);
    if (onSelectMuscle) onSelectMuscle(name);
  };

  return (
    <div className={`relative w-full h-full min-h-[380px] bg-white dark:bg-[#0A0B0D] border border-neutral-200/80 dark:border-neutral-800/80 rounded-[8px] overflow-hidden flex flex-col shadow-xs ${className}`}>
      {/* Top HUD Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
        {/* 3D Atlas vs 2D Scanner Switcher */}
        <div className="flex items-center p-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-[8px] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs text-[10px] font-mono">
          <button
            type="button"
            onClick={() => hasWebGL && setViewMode('3d')}
            disabled={!hasWebGL}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] font-bold transition-all cursor-pointer ${
              !hasWebGL
                ? 'opacity-40 cursor-not-allowed text-neutral-400'
                : viewMode === '3d'
                ? 'bg-[#EF2F38] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
            title={!hasWebGL ? '3D requires WebGL hardware acceleration' : undefined}
          >
            <Layers size={12} />
            <span>3D BodyParts3D</span>
            {!hasWebGL && <span className="text-[8px] uppercase tracking-tighter opacity-70">(N/A)</span>}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] font-bold transition-all cursor-pointer ${
              viewMode === '2d'
                ? 'bg-[#EF2F38] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={12} />
            <span>2D Scanner</span>
          </button>
        </div>

        {/* View Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullScreen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 dark:bg-neutral-900/90 hover:bg-neutral-100 dark:hover:bg-neutral-800 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800/80 rounded-[8px] text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-300 transition-all cursor-pointer shadow-xs"
          title="Open Fullscreen Anatomy Explorer"
        >
          <Maximize2 size={13} />
          <span className="hidden sm:inline">EXPLORE FULLSCREEN</span>
        </button>
      </div>

      {/* Main Viewport Content */}
      <div className="w-full h-full flex-1 relative pt-12">
        {viewMode === '3d' ? (
          <AnatomyAtlasExplorer
            muscleLoads={muscleLoads}
            maxLoad={maxLoad}
            initialSelectedMuscle={selectedMuscleName || undefined}
            onSelectMuscle={handleSelect}
            className="w-full h-full"
            compact={true}
            onError={() => setViewMode('2d')}
            onFallbackTo2D={() => setViewMode('2d')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
            <Biomechanical2DScanner
              muscleLoads={muscleLoads}
              maxLoad={maxLoad}
              gender={gender}
              scale={1.1}
              interactive={true}
              onSelectMuscle={handleSelect}
              showControls={true}
            />
          </div>
        )}
      </div>

      {/* Fullscreen Modal Viewport */}
      {isFullScreen && (
        <Portal>
          <div className="fixed inset-0 z-[9999] bg-[#0A0B0D] flex flex-col animate-in fade-in duration-200">
            {/* Fullscreen Header Bar */}
            <header className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-[#0A0B0D]/95 backdrop-blur-md z-50">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF2F38] shadow-[0_0_10px_#EF2F38]" />
                <span className="text-sm font-bold tracking-wider text-white font-mono uppercase">
                  BodyParts3D Anatomy Explorer · Infinity TKD 2.0
                </span>
                <span className="text-xs text-neutral-500 font-mono hidden md:inline">
                  (2,234 Meshes · 15 Systems · 3,432 Concepts)
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* 3D vs 2D Switch in modal */}
                <div className="flex items-center p-1 bg-neutral-900 rounded-[8px] border border-neutral-800 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`px-3 py-1 rounded-[8px] font-bold transition-all cursor-pointer ${
                      viewMode === '3d' ? 'bg-[#EF2F38] text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    3D Atlas
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`px-3 py-1 rounded-[8px] font-bold transition-all cursor-pointer ${
                      viewMode === '2d' ? 'bg-[#EF2F38] text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    2D Scanner
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullScreen(false)}
                  className="p-2 rounded-[8px] bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Close Fullscreen (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* Modal Body */}
            <div className="flex-1 w-full h-full relative overflow-hidden">
              {viewMode === '3d' ? (
                <AnatomyAtlasExplorer
                  muscleLoads={muscleLoads}
                  maxLoad={maxLoad}
                  initialSelectedMuscle={selectedMuscleName || undefined}
                  onSelectMuscle={handleSelect}
                  className="w-full h-full"
                  compact={false}
                  onError={() => setViewMode('2d')}
                  onFallbackTo2D={() => setViewMode('2d')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6 bg-[#0A0B0D]">
                  <Biomechanical2DScanner
                    muscleLoads={muscleLoads}
                    maxLoad={maxLoad}
                    gender={gender}
                    scale={1.4}
                    interactive={true}
                    onSelectMuscle={handleSelect}
                    showControls={true}
                  />
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
