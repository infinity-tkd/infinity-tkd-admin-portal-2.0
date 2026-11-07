'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Layers, Maximize2, RotateCcw, X } from 'lucide-react';
import { Biomechanical2DScanner } from './2d/Biomechanical2DScanner';
import { Portal } from './Portal';
import { detectAnatomyWebGL } from '@/lib/anatomy-webgl';
import type { AnatomyContext } from '@/lib/anatomy-integration';

export { Biomechanical2DScanner } from './2d/Biomechanical2DScanner';
export { ANATOMY_DATABASE, TKD_KICK_PRESETS } from '@/lib/anatomyData';
export { useAnatomyStore } from '@/lib/useAnatomyStore';

const AnatomyAtlasExplorer = dynamic(
  () => import('./atlas/AnatomyAtlasExplorer').then((module) => module.AnatomyAtlasExplorer),
  { ssr: false, loading: () => <div role="status" className="flex h-full items-center justify-center p-6 text-sm text-neutral-500">Opening 3D anatomy…</div> },
);

class AnatomyViewBoundary extends React.Component<{ children: React.ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export type AnatomicalGender = 'Male' | 'Female';
export interface Anatomical3DModelProps {
  muscleLoads?: Record<string, number>;
  maxLoad?: number;
  gender?: AnatomicalGender;
  modelUrl?: string;
  className?: string;
  studentStatus?: Record<string, unknown>;
  onSelectMuscle?: (muscle: string | null) => void;
  defaultViewMode?: '3d' | '2d';
  active?: boolean;
  allowFullscreen?: boolean;
  focusedMuscle?: string | null;
  context?: AnatomyContext;
}

export function Anatomical3DModel({
  muscleLoads = {}, maxLoad = 1, gender = 'Male', className = 'h-[440px]',
  onSelectMuscle, defaultViewMode = '2d', active = true, allowFullscreen = true,
  focusedMuscle, context,
}: Anatomical3DModelProps) {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(defaultViewMode);
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(focusedMuscle ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => { setSelectedMuscle(focusedMuscle ?? null); }, [focusedMuscle]);
  useEffect(() => { if (!active) setIsFullScreen(false); }, [active]);
  useEffect(() => {
    if (!active || viewMode !== '3d' || hasWebGL !== null) return;
    const supported = detectAnatomyWebGL();
    setHasWebGL(supported);
    if (!supported) {
      setError('3D is unavailable on this device. The muscle map is ready to use.');
      setViewMode('2d');
    }
  }, [active, viewMode, hasWebGL]);
  useEffect(() => {
    if (!active || !isFullScreen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setIsFullScreen(false); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ) ?? []).filter((element) => element.getClientRects().length > 0);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [active, isFullScreen]);

  const selectMuscle = (name: string | null) => { setSelectedMuscle(name); onSelectMuscle?.(name); };
  const fail3D = () => {
    setError('The 3D view could not open. Your records are unchanged; use the muscle map or retry.');
    setViewMode('2d');
  };
  const open3D = () => {
    setError('');
    if (hasWebGL === false) setHasWebGL(null);
    setAttempt((value) => value + 1);
    setViewMode('3d');
  };
  const controls = (
    <div className="flex min-w-0 items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900" role="group" aria-label="Anatomy view">
      <button type="button" onClick={() => setViewMode('2d')} aria-pressed={viewMode === '2d'} className={`min-h-11 rounded-md px-3 text-xs font-semibold transition-colors ${viewMode === '2d' ? 'bg-white text-red-700 shadow-sm dark:bg-neutral-800 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>Muscle map</button>
      <button type="button" onClick={open3D} aria-pressed={viewMode === '3d'} className={`flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${viewMode === '3d' ? 'bg-white text-red-700 shadow-sm dark:bg-neutral-800 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}><Layers size={15} />3D anatomy</button>
    </div>
  );
  const viewport = (enlarged: boolean) => (
    <div className="relative min-h-0 flex-1 overflow-auto">
      {error && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"><span className="max-w-xl">{error}</span><button type="button" onClick={open3D} className="flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-red-700 dark:text-red-400"><RotateCcw size={14} />Retry 3D</button></div>}
      {viewMode === '3d' && hasWebGL === true ? (
        <AnatomyViewBoundary key={attempt} onFailure={fail3D}>
          <AnatomyAtlasExplorer muscleLoads={muscleLoads} maxLoad={maxLoad} initialSelectedMuscle={selectedMuscle ?? undefined} onSelectMuscle={selectMuscle} context={context} compact={!enlarged && allowFullscreen} className="h-full min-h-[360px] w-full" onError={fail3D} onFallbackTo2D={() => setViewMode('2d')} />
        </AnatomyViewBoundary>
      ) : viewMode === '3d' ? (
        <div role="status" className="flex h-full min-h-64 items-center justify-center p-6 text-sm text-neutral-500">Checking 3D availability…</div>
      ) : (
        <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center p-3 sm:p-5">
          <Biomechanical2DScanner muscleLoads={muscleLoads} maxLoad={maxLoad} gender={gender} selectedMuscle={selectedMuscle} scale={enlarged ? 1.2 : 1} interactive onSelectMuscle={selectMuscle} showControls />
        </div>
      )}
    </div>
  );

  if (!active) return null;
  return (
    <div className={`relative flex min-h-[320px] min-w-0 w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        {controls}
        {allowFullscreen && <button type="button" onClick={() => { setIsFullScreen(true); open3D(); }} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900" aria-label="Open enlarged anatomy view"><Maximize2 size={16} /><span className="hidden sm:inline">Expand</span></button>}
      </div>
      {/* Enlarged replaces inline: only one viewport, and one GPU scene, exists. */}
      {!isFullScreen && viewport(false)}
      {isFullScreen && <Portal><div className="fixed inset-0 z-[9999] bg-black/30 p-2 sm:p-5"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800"><h2 id={titleId} className="text-sm font-semibold">{context?.title ?? 'Infinity TKD · Muscle explorer'}</h2><div className="flex items-center gap-2">{controls}<button type="button" onClick={() => setIsFullScreen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900" aria-label="Close anatomy view"><X size={19} /></button></div></header>
        {viewport(true)}
      </div></div></Portal>}
    </div>
  );
}
