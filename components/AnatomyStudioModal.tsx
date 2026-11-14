'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { CurriculumVideo, Student, useAppStore } from '@/lib/store';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { resolveAssetMuscleLoads } from '@/lib/anatomyUtils';
import { AnatomyContext, resolveStudentMuscleLoads } from '@/lib/anatomy-integration';
import { cn } from '@/lib/utils';

const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  { ssr: false, loading: () => <div role="status" className="flex h-full items-center justify-center text-sm text-neutral-500">Opening muscle explorer…</div> },
);

export interface AnatomyStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: CurriculumVideo | null;
  student?: Student | null;
  initialGender?: 'Male' | 'Female';
  onOpenMaterial?: (assetId: number) => void;
}

/** Shared teaching workspace for saved materials and student learning coverage. */
export function AnatomyStudioModal({ isOpen, onClose, asset = null, student = null, initialGender = 'Male', onOpenMaterial }: AnatomyStudioModalProps) {
  const { state } = useAppStore();
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [focusedMuscle, setFocusedMuscle] = useState<string | null>(null);
  const { muscles, assetMuscleRelations, videoProgress } = state;
  const material = useMemo(() => resolveAssetMuscleLoads(asset, { muscles, assetMuscleRelations }), [asset, muscles, assetMuscleRelations]);
  const coverage = useMemo(() => resolveStudentMuscleLoads(student?.id ?? '', { muscles, assetMuscleRelations, videoProgress }), [student?.id, videoProgress, muscles, assetMuscleRelations]);
  const studentView = Boolean(student && !asset);
  const loads = studentView ? coverage.muscleLoads : material.muscleLoads;
  const title = asset?.title ?? (student ? `${student.englishName} · Muscle explorer` : 'Muscle explorer');
  const sourceLabel = studentView ? 'Completed learning materials' : asset ? (material.source === 'database' ? 'Saved material mapping' : material.source === 'none' ? 'No muscle mapping saved' : 'Teaching reference') : 'Academy muscle library';
  const context: AnatomyContext = {
    kind: studentView ? 'student' : asset ? 'material' : 'library', title,
    studentId: student?.id, assetId: asset?.id,
    completedAssetIds: student ? coverage.completedAssetIds : undefined,
    sourceLabel,
    onOpenMaterial: id => {
      onCloseRef.current();
      if (onOpenMaterial) onOpenMaterial(id);
      else router.push(`/lms?material=${id}`);
    },
  };

  useEffect(() => { setFocusedMuscle(null); }, [isOpen, asset?.id, student?.id]);
  // The panel renders through <Portal>, which mounts a frame late: useModalFocus waits for it, then moves focus in,
  // traps Tab, closes on Escape and restores the opener.
  useModalFocus(dialogRef, () => onCloseRef.current(), isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;
  const chips = studentView ? Object.keys(loads).sort((a, b) => loads[b] - loads[a]) : [...material.primaryMuscles, ...material.secondaryMuscles];
  return <Portal>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-testid="anatomy-studio" className="fixed inset-0 z-[10000] flex h-[100dvh] min-h-0 flex-col bg-white font-sans text-neutral-900 dark:bg-[#0A0A0A] dark:text-white motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] dark:border-neutral-800 sm:px-6">
        <div className="min-w-0 border-l-4 border-brand pl-3">
          <p className="text-micro font-semibold uppercase tracking-wider text-neutral-500">Infinity TKD · {sourceLabel}</p>
          <h2 id={titleId} className="truncate text-base font-semibold sm:text-lg">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close muscle explorer" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-red-500 dark:border-neutral-800 dark:hover:bg-neutral-900"><X size={20} /></button>
      </header>
      <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6">
        <p className="text-xs leading-relaxed text-neutral-500">{studentView ? `${coverage.completedAssetIds.length} completed learning material${coverage.completedAssetIds.length === 1 ? '' : 's'}. Colour shows mapped training coverage, not measured muscle fatigue or strength.` : asset ? 'Explore the muscles used in this material, then open related learning resources.' : 'Select a muscle to explore its role in Taekwondo and the academy’s related learning materials.'}</p>
        {chips.length > 0 && <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" aria-label="Focus a mapped muscle">{chips.map(name => <button key={name} type="button" onClick={() => setFocusedMuscle(name)} aria-pressed={focusedMuscle === name} className={cn('min-h-11 rounded-lg border px-3 text-xs font-medium transition-colors', focusedMuscle === name ? 'border-brand bg-brand text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-red-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200')}>{name}</button>)}</div>}
      </div>
      <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <Anatomical3DModel muscleLoads={loads} maxLoad={studentView ? coverage.maxLoad : 1} gender={student?.gender ?? initialGender} defaultViewMode="3d" allowFullscreen={false} focusedMuscle={focusedMuscle} context={context} className="h-full w-full rounded-none border-0" />
      </div>
    </div>
  </Portal>;
}
