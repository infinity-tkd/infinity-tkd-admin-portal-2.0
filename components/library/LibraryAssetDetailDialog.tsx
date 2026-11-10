'use client';
import NextImage from 'next/image';
import { dialogMotion } from '@/lib/motion';
import React from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { useAppStore, CurriculumVideo } from '@/lib/store';
import { motion } from 'motion/react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { PlayCircle } from '@phosphor-icons/react/dist/csr/PlayCircle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Article } from '@phosphor-icons/react/dist/csr/Article';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { resolveAssetMuscleLoads } from '@/lib/anatomyUtils';
import { cn, normalizeCategory, getCategoryTranslationKey, getYouTubeId, parseAssetDescription, MistakeCorrection, VocabularyItem, QuestionAnswerItem } from '@/lib/utils';
import { LessonMediaPlayer } from './LessonMediaPlayer';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';
import { TKD_CATEGORIES, FITNESS_CATEGORIES, DANCE_CATEGORIES, BELTS, getBeltTranslationKey } from '@/lib/library-catalog';
const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/60 rounded-[8px] p-8 border border-neutral-800 animate-pulse">
        <span className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-3" />
        <span className="text-xs text-neutral-400 font-mono uppercase tracking-widest">Loading 3D Engine...</span>
      </div>
    )
  }
);

interface LibraryAssetDetailDialogProps {
  isSaving: boolean;
  editAsset: any;
  handleSaveEditAsset: (e: React.FormEvent) => Promise<void>;
  t: ReturnType<typeof useT>;
  setEditAsset: React.Dispatch<any>;
  activeTab: "tkd" | "fitness" | "dance" | "routines";
  editMuscleDropdownRef: React.RefObject<HTMLDivElement | null>;
  editMuscleSearch: string;
  setEditMuscleSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowEditMuscleDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  setEditActiveMuscleIdx: React.Dispatch<React.SetStateAction<number>>;
  showEditMuscleDropdown: boolean;
  state: ReturnType<typeof useAppStore>['state'];
  editActiveMuscleIdx: number;
  editSelectedMuscles: { muscleId: number; role: "Primary" | "Secondary"; }[];
  setEditSelectedMuscles: React.Dispatch<React.SetStateAction<{ muscleId: number; role: "Primary" | "Secondary"; }[]>>;
  editInstructionSteps: string[];
  setDraggedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  draggedIndex: number | null;
  setEditInstructionSteps: React.Dispatch<React.SetStateAction<string[]>>;
  editFitnessSolutionsDropdownRef: React.RefObject<HTMLDivElement | null>;
  editFitnessSearch: string;
  setEditFitnessSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowEditFitnessDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  showEditFitnessDropdown: boolean;
  editSelectedFitnessSolutions: number[];
  setEditSelectedFitnessSolutions: React.Dispatch<React.SetStateAction<number[]>>;
  editPrerequisiteSteps: string[];
  setEditPrerequisiteSteps: React.Dispatch<React.SetStateAction<string[]>>;
  editPrincipleSteps: string[];
  setEditPrincipleSteps: React.Dispatch<React.SetStateAction<string[]>>;
  editDrillingSteps: string[];
  setEditDrillingSteps: React.Dispatch<React.SetStateAction<string[]>>;
  editMistakeSteps: MistakeCorrection[];
  setEditMistakeSteps: React.Dispatch<React.SetStateAction<MistakeCorrection[]>>;
  editPerformanceSteps: string[];
  setEditPerformanceSteps: React.Dispatch<React.SetStateAction<string[]>>;
  editTerminologyList: VocabularyItem[];
  setEditTerminologyList: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  editStudyGuideList: QuestionAnswerItem[];
  setEditStudyGuideList: React.Dispatch<React.SetStateAction<QuestionAnswerItem[]>>;
  selectedDetailAsset: CurriculumVideo;
  setSelectedDetailAsset: React.Dispatch<React.SetStateAction<CurriculumVideo | null>>;
  setSelected3DAsset: React.Dispatch<React.SetStateAction<CurriculumVideo | null>>;
  setShow3DStudio: React.Dispatch<React.SetStateAction<boolean>>;
  anatomicalGender: "Male" | "Female";
  show3DStudio: boolean;
  expandedStudyGuides: Record<number, boolean>;
  toggleStudyGuide: (idx: number) => void;
  isElevated: boolean;
  confirmDeleteVideo: (videoId: number, videoTitle: string, onCloseDetail?: () => void) => void;
  handleStartEdit: (video: CurriculumVideo) => void;
  /** Opens Library → Content & languages for this lesson. */
  onEditContent?: (id: number) => void;
}

export function LibraryAssetDetailDialog({ isSaving, editAsset, handleSaveEditAsset, t, setEditAsset, activeTab, editMuscleDropdownRef, editMuscleSearch, setEditMuscleSearch, setShowEditMuscleDropdown, setEditActiveMuscleIdx, showEditMuscleDropdown, state, editActiveMuscleIdx, editSelectedMuscles, setEditSelectedMuscles, editInstructionSteps, setDraggedIndex, draggedIndex, setEditInstructionSteps, editFitnessSolutionsDropdownRef, editFitnessSearch, setEditFitnessSearch, setShowEditFitnessDropdown, showEditFitnessDropdown, editSelectedFitnessSolutions, setEditSelectedFitnessSolutions, editPrerequisiteSteps, setEditPrerequisiteSteps, editPrincipleSteps, setEditPrincipleSteps, editDrillingSteps, setEditDrillingSteps, editMistakeSteps, setEditMistakeSteps, editPerformanceSteps, setEditPerformanceSteps, editTerminologyList, setEditTerminologyList, editStudyGuideList, setEditStudyGuideList, selectedDetailAsset, setSelectedDetailAsset, setSelected3DAsset, setShow3DStudio, anatomicalGender, show3DStudio, expandedStudyGuides, toggleStudyGuide, isElevated, confirmDeleteVideo, handleStartEdit, onEditContent }: LibraryAssetDetailDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, () => { if (!isSaving) { if (editAsset) setEditAsset(null); else setSelectedDetailAsset(null); } }, !show3DStudio);
  return <>{(
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label={editAsset ? "Edit library lesson" : selectedDetailAsset.title} {...dialogMotion}
                className="w-full max-w-2xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
              >
                {editAsset ? (
                  /* --- EDIT MODE FORM --- */
                  <form onSubmit={handleSaveEditAsset} className="flex min-h-0 flex-col overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800 dark:text-white">
                        {t('lib_edit_asset_title')}
                      </h2>
                      <button type="button" aria-label={t('lib_bulk_cancel')} title={t('lib_bulk_cancel')} onClick={() => setEditAsset(null)} className="min-h-10 min-w-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white transition-colors cursor-pointer">
                        <X className="w-5 h-5"/>
                      </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_asset_title')}</label>
                        <input type="text" value={editAsset.title} onChange={(e) => setEditAsset({ ...editAsset, title: e.target.value })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_desc_guidelines')}</label>
                        <textarea value={editAsset.description} onChange={(e) => setEditAsset({ ...editAsset, description: e.target.value })} required rows={2} maxLength={20000}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_category_col')}</label>
                          <select value={editAsset.category} onChange={(e) => setEditAsset({ ...editAsset, category: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                          >
                            {activeTab === 'tkd' ? (
                              TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            ) : activeTab === 'dance' ? (
                              DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                            ) : (
                              FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{activeTab === 'tkd' ? t('lib_bulk_belt_col') : t('lib_routine_diff_label')}</label>
                          {activeTab === 'tkd' ? (
                            <select value={editAsset.minBeltLevel} onChange={(e) => setEditAsset({ ...editAsset, minBeltLevel: e.target.value })}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                            >
                              {editAsset.minBeltLevel === 'Unassigned' && <option value="Unassigned" className="text-black dark:text-white dark:bg-neutral-900">No belt yet (choose one to publish)</option>}
                              {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                            </select>
                          ) : (
                            <select value={editAsset.difficulty} onChange={(e) => setEditAsset({ ...editAsset, difficulty: e.target.value })}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                            >
                              <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                              <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                              <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                              <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                            </select>
                          )}
                        </div>
                      </div>

                    {activeTab === 'tkd' && editAsset.category !== 'Theory & Terminology' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_diff_label')}</label>
                          <select value={editAsset.difficulty} onChange={(e) => setEditAsset({ ...editAsset, difficulty: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                          <input type="text" value={editAsset.repsSets} onChange={(e) => setEditAsset({ ...editAsset, repsSets: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                            placeholder="e.g. 3 sets x 12 reps"
                          />
                        </div>
                      </div>
                    )}

                      <div className="grid grid-cols-2 gap-4">
                        {editAsset.category !== 'Theory & Terminology' && (
                          <div className="relative" ref={editMuscleDropdownRef}>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_focus_zones')} / Muscles</label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                placeholder="Search or select muscles..."
                                value={editMuscleSearch}
                                onChange={(e) => {
                                  setEditMuscleSearch(e.target.value);
                                  setShowEditMuscleDropdown(true);
                                  setEditActiveMuscleIdx(-1);
                                }}
                                onFocus={() => setShowEditMuscleDropdown(true)}
                                onKeyDown={(e) => {
                                  if (!showEditMuscleDropdown) {
                                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                      setShowEditMuscleDropdown(true);
                                      e.preventDefault();
                                    }
                                    return;
                                  }

                                  const query = editMuscleSearch.toLowerCase();
                                  const filtered = state.muscles.filter(m => {
                                    if (!query) return true;
                                    return m.name.toLowerCase().includes(query) ||
                                           (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                           (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                           m.muscleGroup.toLowerCase().includes(query);
                                  });

                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setEditActiveMuscleIdx(prev => filtered.length > 0 ? (prev + 1) % filtered.length : -1);
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setEditActiveMuscleIdx(prev => filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : -1);
                                  } else if (e.key === 'Enter') {
                                    if (editActiveMuscleIdx >= 0 && editActiveMuscleIdx < filtered.length) {
                                      e.preventDefault();
                                      const targetMuscle = filtered[editActiveMuscleIdx];
                                      const isSelected = editSelectedMuscles.some(s => s.muscleId === targetMuscle.id);
                                      if (isSelected) {
                                        setEditSelectedMuscles(editSelectedMuscles.filter(s => s.muscleId !== targetMuscle.id));
                                      } else {
                                        setEditSelectedMuscles([...editSelectedMuscles, { muscleId: targetMuscle.id, role: 'Primary' }]);
                                      }
                                    }
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setShowEditMuscleDropdown(false);
                                    setEditActiveMuscleIdx(-1);
                                  }
                                }}
                                className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditMuscleDropdown(!showEditMuscleDropdown)}
                                className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                              >
                                {showEditMuscleDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                              </button>
                            </div>
                            {showEditMuscleDropdown && (
                              <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-25">
                                {(() => {
                                  const query = editMuscleSearch.toLowerCase();
                                  const filtered = state.muscles.filter(m => {
                                    if (!query) return true;
                                    return m.name.toLowerCase().includes(query) ||
                                           (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                           (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                           m.muscleGroup.toLowerCase().includes(query);
                                  });

                                  if (filtered.length === 0) {
                                    return <div className="p-3 text-xs text-neutral-400 text-center">No muscles found</div>;
                                  }

                                  return filtered.map((m, idx) => {
                                    const isSelected = editSelectedMuscles.some(s => s.muscleId === m.id);
                                    const isActive = editActiveMuscleIdx === idx;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setEditSelectedMuscles(editSelectedMuscles.filter(s => s.muscleId !== m.id));
                                          } else {
                                            setEditSelectedMuscles([...editSelectedMuscles, { muscleId: m.id, role: 'Primary' }]);
                                          }
                                        }}
                                        className={cn(
                                          "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                          isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]",
                                          isActive && "bg-[#EF2F38]/15 dark:bg-[#EF2F38]/20"
                                        )}
                                      >
                                        <span>
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({m.muscleGroup})</span>
                                        </span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {editSelectedMuscles.map(sm => {
                                const muscle = state.muscles.find(m => m.id === sm.muscleId);
                                if (!muscle) return null;
                                return (
                                  <span
                                    key={sm.muscleId}
                                    className={cn(
                                      "px-2 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-1 cursor-pointer select-none transition-all shadow-sm",
                                      sm.role === 'Primary'
                                        ? "bg-red-500/10 text-red-500 border border-red-500/30"
                                        : "bg-blue-500/10 text-blue-500 border border-dashed border-blue-500/30"
                                    )}
                                    onClick={() => {
                                      setEditSelectedMuscles(editSelectedMuscles.map(x => x.muscleId === sm.muscleId ? { ...x, role: x.role === 'Primary' ? 'Secondary' : 'Primary' } : x));
                                    }}
                                    title="Click to toggle Primary vs Secondary"
                                  >
                                    <span>{sm.role === 'Primary' ? '★ ' : '☆ '}{state.language === 'kh' && muscle.nameKh ? muscle.nameKh : (state.language === 'zh' && muscle.nameZh ? muscle.nameZh : muscle.name)}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditSelectedMuscles(editSelectedMuscles.filter(x => x.muscleId !== sm.muscleId));
                                      }}
                                      className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className={cn(editAsset.category === 'Theory & Terminology' ? "col-span-2" : "")}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_cover_url')}</label>
                          <input type="text" value={editAsset.thumbnailUrl} onChange={(e) => setEditAsset({ ...editAsset, thumbnailUrl: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                          />
                          {(() => {
                            const ytId = getYouTubeId(editAsset.videoUrl);
                            const resolvedPreview = editAsset.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '');
                            if (!resolvedPreview) return null;
                            return (
                              <div className="mt-2 h-14 w-24 rounded-[8px] border border-neutral-200 dark:border-[#262626] overflow-hidden bg-neutral-100 dark:bg-neutral-900 relative">
                                <NextImage unoptimized width={320} height={180} src={resolvedPreview} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {editAsset.category !== 'Theory & Terminology' && (
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">{t('lib_form_instructions')}</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-80 overflow-y-auto">
                            {editInstructionSteps.map((step, idx) => (
                              <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedIndex(idx);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedIndex === null || draggedIndex === idx) return;
                                  const updated = [...editInstructionSteps];
                                  const [draggedItem] = updated.splice(draggedIndex, 1);
                                  updated.splice(idx, 0, draggedItem);
                                  setEditInstructionSteps(updated);
                                  setDraggedIndex(null);
                                }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn(
                                  "flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all",
                                  draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]"
                                )}
                              >
                                {/* Drag Handle */}
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1">
                                  <ListChecks className="w-4 h-4" />
                                </div>

                                {/* Step Badge */}
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[50px] text-center">
                                  Step {idx + 1}
                                </span>

                                {/* Input Box */}
                                <input
                                  id={`step-input-edit-${idx}`}
                                  type="text"
                                  value={step}
                                  placeholder="Enter instruction detail..."
                                  onChange={(e) => {
                                    const updated = [...editInstructionSteps];
                                    updated[idx] = e.target.value;
                                    setEditInstructionSteps(updated);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const updated = [...editInstructionSteps];
                                      updated.splice(idx + 1, 0, '');
                                      setEditInstructionSteps(updated);
                                      setTimeout(() => {
                                        document.getElementById(`step-input-edit-${idx + 1}`)?.focus();
                                      }, 30);
                                    } else if (e.key === 'Backspace' && !step && idx > 0) {
                                      e.preventDefault();
                                      const updated = [...editInstructionSteps];
                                      updated.splice(idx, 1);
                                      setEditInstructionSteps(updated);
                                      setTimeout(() => {
                                        document.getElementById(`step-input-edit-${idx - 1}`)?.focus();
                                      }, 30);
                                    }
                                  }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />

                                {/* Remove button */}
                                {editInstructionSteps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = editInstructionSteps.filter((_, i) => i !== idx);
                                      setEditInstructionSteps(updated);
                                    }}
                                    className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditInstructionSteps([...editInstructionSteps, '']);
                              setTimeout(() => {
                                document.getElementById(`step-input-edit-${editInstructionSteps.length}`)?.focus();
                              }, 30);
                            }}
                            className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Instruction Step
                          </button>
                        </div>
                      )}

                      {activeTab === 'tkd' && (
                        <div className="relative" ref={editFitnessSolutionsDropdownRef}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">Linked Physical Training Solutions</label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Search physical training solutions..."
                              value={editFitnessSearch}
                              onChange={(e) => {
                                setEditFitnessSearch(e.target.value);
                                setShowEditFitnessDropdown(true);
                              }}
                              onFocus={() => setShowEditFitnessDropdown(true)}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditFitnessDropdown(!showEditFitnessDropdown)}
                              className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                            >
                              {showEditFitnessDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {showEditFitnessDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-[200]">
                              {(() => {
                                const query = editFitnessSearch.toLowerCase();
                                const fitnessAssets = state.curriculumVideos.filter(v =>
                                  v.minBeltLevel === 'Fitness' || v.category.startsWith('Fitness:')
                                );
                                const filtered = fitnessAssets.filter(f =>
                                  f.title.toLowerCase().includes(query) ||
                                  f.category.toLowerCase().includes(query)
                                );

                                if (filtered.length === 0) {
                                  return <div className="p-3 text-xs text-neutral-400 text-center">No fitness skills found</div>;
                                }

                                return filtered.map(f => {
                                  const isSelected = editSelectedFitnessSolutions.includes(f.id);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setEditSelectedFitnessSolutions(editSelectedFitnessSolutions.filter(id => id !== f.id));
                                        } else {
                                          setEditSelectedFitnessSolutions([...editSelectedFitnessSolutions, f.id]);
                                        }
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                        isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]"
                                      )}
                                    >
                                      <span>
                                        {f.title}
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({f.category.replace('Fitness: ', '')})</span>
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {editSelectedFitnessSolutions.map(id => {
                              const fSkill = state.curriculumVideos.find(v => v.id === id);
                              if (!fSkill) return null;
                              return (
                                <span
                                  key={id}
                                  className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-2 py-0.5 text-[9px] font-bold rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 select-none"
                                >
                                  <span>{fSkill.title}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditSelectedFitnessSolutions(editSelectedFitnessSolutions.filter(x => x !== id));
                                    }}
                                    className="text-neutral-400 hover:text-red-500 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(activeTab === 'tkd' || activeTab === 'dance') && editAsset.category !== 'Theory & Terminology' && (
                        <>
                          {/* Skill Prerequisites Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Skill Prerequisites</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrerequisiteSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrerequisiteSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrerequisiteSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`prereq-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Ap Chagi (Front Kick)" onChange={(e) => { const u = [...editPrerequisiteSteps]; u[idx] = e.target.value; setEditPrerequisiteSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx + 1, 0, ''); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx, 1); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrerequisiteSteps.length > 1 && (<button type="button" onClick={() => setEditPrerequisiteSteps(editPrerequisiteSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrerequisiteSteps([...editPrerequisiteSteps, '']); setTimeout(() => document.getElementById(`prereq-step-edit-${editPrerequisiteSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Prerequisite</button>
                          </div>

                          {/* Principle of the Skill Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Principle of the Skill</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrincipleSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrincipleSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrincipleSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`principle-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Dynamic snap at knee joint" onChange={(e) => { const u = [...editPrincipleSteps]; u[idx] = e.target.value; setEditPrincipleSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx + 1, 0, ''); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx, 1); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrincipleSteps.length > 1 && (<button type="button" onClick={() => setEditPrincipleSteps(editPrincipleSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrincipleSteps([...editPrincipleSteps, '']); setTimeout(() => document.getElementById(`principle-step-edit-${editPrincipleSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Principle</button>
                          </div>

                          {/* Drilling Methods Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Drilling Methods</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editDrillingSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editDrillingSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditDrillingSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`drilling-step-edit-${idx}`} type="text" value={step} placeholder="e.g. 3 rounds of 10 rapid repetitions per leg..." onChange={(e) => { const u = [...editDrillingSteps]; u[idx] = e.target.value; setEditDrillingSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx + 1, 0, ''); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx, 1); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editDrillingSteps.length > 1 && (<button type="button" onClick={() => setEditDrillingSteps(editDrillingSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditDrillingSteps([...editDrillingSteps, '']); setTimeout(() => document.getElementById(`drilling-step-edit-${editDrillingSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Drilling Method</button>
                          </div>

                          {/* Common Mistakes & Corrections Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Common Mistakes & Corrections</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editMistakeSteps.map((step, idx) => (
                                <div key={idx} draggable
                                  onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editMistakeSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditMistakeSteps(updated); setDraggedIndex(null); }}
                                  onDragEnd={() => setDraggedIndex(null)}
                                  className={cn("flex items-start gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                                >
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1 mt-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center mt-1">#{idx + 1}</span>
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <input id={`mistake-input-edit-${idx}`} type="text" value={step.mistake} placeholder="Mistake (e.g. Dropping hands)"
                                      onChange={(e) => { const u = [...editMistakeSteps]; u[idx] = { ...u[idx], mistake: e.target.value }; setEditMistakeSteps(u); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          document.getElementById(`correction-input-edit-${idx}`)?.focus();
                                        } else if (e.key === 'Backspace' && !step.mistake && idx > 0) {
                                          e.preventDefault();
                                          const u = [...editMistakeSteps];
                                          u.splice(idx, 1);
                                          setEditMistakeSteps(u);
                                          setTimeout(() => document.getElementById(`correction-input-edit-${idx - 1}`)?.focus(), 30);
                                        }
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-red-500/20 dark:border-red-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/10 font-medium"
                                    />
                                    <input id={`correction-input-edit-${idx}`} type="text" value={step.correction} placeholder="Correction (e.g. Keep guard up)"
                                      onChange={(e) => { const u = [...editMistakeSteps]; u[idx] = { ...u[idx], correction: e.target.value }; setEditMistakeSteps(u); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const u = [...editMistakeSteps];
                                          u.splice(idx + 1, 0, { mistake: '', correction: '' });
                                          setEditMistakeSteps(u);
                                          setTimeout(() => document.getElementById(`mistake-input-edit-${idx + 1}`)?.focus(), 30);
                                        } else if (e.key === 'Backspace' && !step.correction) {
                                          e.preventDefault();
                                          document.getElementById(`mistake-input-edit-${idx}`)?.focus();
                                        }
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-emerald-500/20 dark:border-emerald-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium"
                                    />
                                  </div>
                                  {editMistakeSteps.length > 1 && (
                                    <button type="button" onClick={() => setEditMistakeSteps(editMistakeSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent mt-1"><Trash className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditMistakeSteps([...editMistakeSteps, { mistake: '', correction: '' }]); setTimeout(() => document.getElementById(`mistake-input-edit-${editMistakeSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Mistake & Correction</button>
                          </div>

                          {/* Performance & Application Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Performance & Application</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPerformanceSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPerformanceSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPerformanceSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`performance-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Used for counter attacks in sparring..." onChange={(e) => { const u = [...editPerformanceSteps]; u[idx] = e.target.value; setEditPerformanceSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx + 1, 0, ''); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx, 1); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPerformanceSteps.length > 1 && (<button type="button" onClick={() => setEditPerformanceSteps(editPerformanceSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPerformanceSteps([...editPerformanceSteps, '']); setTimeout(() => document.getElementById(`performance-step-edit-${editPerformanceSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Performance Note</button>
                          </div>
                        </>
                      )}

                      {/* Custom builders for Theory & Terminology category */}
                      {activeTab === 'tkd' && editAsset.category === 'Theory & Terminology' && (
                        <div className="space-y-5 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/20 dark:bg-neutral-900/10">
                          {/* Terminology List Builder */}
                          <div className="space-y-2">
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Korean Vocabulary Glossary</label>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {editTerminologyList.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                  <div className="flex-1 grid grid-cols-3 gap-2">
                                    <input
                                      type="text"
                                      value={item.korean}
                                      placeholder="Korean (e.g., Jirugi)"
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].korean = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <input
                                      type="text"
                                      value={item.english}
                                      placeholder="English (e.g., Punch)"
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].english = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <input
                                      type="text"
                                      value={item.khmer}
                                      placeholder="Khmer (e.g., ម៉ាត់)"
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].khmer = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                  </div>
                                  {editTerminologyList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setEditTerminologyList(editTerminologyList.filter((_, i) => i !== idx))}
                                      className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditTerminologyList([...editTerminologyList, { korean: '', english: '', khmer: '' }])}
                              className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Vocabulary Term
                            </button>
                          </div>

                          {/* Study Guide Q&A Builder */}
                          <div className="space-y-2 border-t border-neutral-200 dark:border-[#262626] pt-4">
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Theoretical Q&A / Study Guide</label>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {editStudyGuideList.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-start bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                  <div className="flex-1 space-y-2">
                                    <input
                                      type="text"
                                      value={item.question}
                                      placeholder="Question (e.g., Meaning of white belt?)"
                                      onChange={(e) => {
                                        const u = [...editStudyGuideList];
                                        u[idx].question = e.target.value;
                                        setEditStudyGuideList(u);
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <textarea
                                      value={item.answer}
                                      placeholder="Answer explanation..."
                                      rows={2}
                                      onChange={(e) => {
                                        const u = [...editStudyGuideList];
                                        u[idx].answer = e.target.value;
                                        setEditStudyGuideList(u);
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                  </div>
                                  {editStudyGuideList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setEditStudyGuideList(editStudyGuideList.filter((_, i) => i !== idx))}
                                      className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent mt-1"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditStudyGuideList([...editStudyGuideList, { question: '', answer: '' }])}
                              className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Q&A Card
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_link_col')}</label>
                        <input type="text" value={editAsset.videoUrl} onChange={(e) => setEditAsset({ ...editAsset, videoUrl: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="p-4 md:p-5 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2.5 shrink-0">
                      <button type="button" onClick={() => setEditAsset(null)}
                        className="px-4 py-2 min-h-[40px] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] transition-all cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                      >
                        {t('lib_bulk_cancel')}
                      </button>
                      <button type="submit" disabled={isSaving}
                        className="px-4 py-2 min-h-[40px] bg-[#EF2F38] text-white rounded-[8px] text-xs font-bold uppercase hover:bg-[#d6262f] transition-all shadow-sm cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                      >
                        {t('act_save_changes')}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* --- VIEW DETAILS MODE --- */
                  <div className="flex min-h-0 flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#262626]/40 text-neutral-600 dark:text-neutral-400 rounded-[6px] shadow-sm">
                            {selectedDetailAsset.category.startsWith('Fitness:') || selectedDetailAsset.category.startsWith('Dance:')
                              ? (t(getCategoryTranslationKey(selectedDetailAsset.category)) || selectedDetailAsset.category.replace('Fitness: ', '').replace('Dance: ', ''))
                              : (t(getCategoryTranslationKey(normalizeCategory(selectedDetailAsset.category))) || selectedDetailAsset.category)}
                          </span>
                          {selectedDetailAsset.minBeltLevel !== 'Fitness' && selectedDetailAsset.minBeltLevel !== 'Dance' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] rounded-[6px] shadow-sm">
                              {t(getBeltTranslationKey(selectedDetailAsset.minBeltLevel))} {t('lms_belt_req_suffix')}
                            </span>
                          )}
                          {parseAssetDescription(selectedDetailAsset.description).difficulty && (
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-[6px] shadow-sm",
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Elite' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' :
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Advanced' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            )}>
                              {(() => {
                                const diff = parseAssetDescription(selectedDetailAsset.description).difficulty;
                                if (diff === 'Elite') return t('lib_diff_elite');
                                if (diff === 'Advanced') return t('lib_diff_advanced');
                                if (diff === 'Intermediate') return t('lib_diff_intermediate');
                                return t('lib_diff_beginner');
                              })()}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm md:text-base font-bold text-neutral-900 dark:text-white mt-1.5 leading-tight">{selectedDetailAsset.title}</h3>
                      </div>
                      <button
                        type="button"
                        aria-label={t('act_close')}
                        onClick={() => setSelectedDetailAsset(null)}
                        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        title={t('act_close')}
                      >
                        <X className="w-4 h-4"/>
                      </button>
                    </div>

                    {/* Scrollable details panel */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                      {/* Video Player Section */}
                      {selectedDetailAsset.videoUrl ? (
                        <div className="aspect-video w-full bg-black rounded-[8px] overflow-hidden border border-neutral-200 dark:border-[#262626] shadow-md shrink-0">
                          <LessonMediaPlayer url={selectedDetailAsset.videoUrl} title={selectedDetailAsset.title} />
                        </div>
                      ) : (
                        <div className="h-44 w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col items-center justify-center text-center p-6 text-neutral-400 dark:text-neutral-500">
                          <PlayCircle className="w-10 h-10 mb-2 opacity-50"/>
                          <p className="text-xs font-mono">{t('lib_no_video_desc')}</p>
                        </div>
                      )}

                      {/* Reps/Sets and Muscle Group Info cards */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-1">{t('lib_target_reps_sets')}</span>
                            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                              {parseAssetDescription(selectedDetailAsset.description).repsSets || t('lib_self_paced')}
                            </span>
                          </div>
                          <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-1">{t('lib_focus_areas')}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {parseAssetDescription(selectedDetailAsset.description).focusZones && parseAssetDescription(selectedDetailAsset.description).focusZones!.length > 0 ? (
                                parseAssetDescription(selectedDetailAsset.description).focusZones!.map((zone, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-neutral-200/50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[9px] font-bold rounded uppercase tracking-wider font-sans">
                                    {zone}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 font-sans">{t('lib_general_syllabus')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Anatomical Muscle Load section */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && (() => {
                        const relations = state.assetMuscleRelations.filter(r => r.assetId === selectedDetailAsset.id);
                        if (relations.length === 0) return null;

                        const primaryMuscles = relations
                          .filter(r => r.role === 'Primary')
                          .map(r => state.muscles.find(m => m.id === r.muscleId))
                          .filter(Boolean);

                        const secondaryMuscles = relations
                          .filter(r => r.role === 'Secondary')
                          .map(r => state.muscles.find(m => m.id === r.muscleId))
                          .filter(Boolean);

                        const { muscleLoads } = resolveAssetMuscleLoads(selectedDetailAsset, state);

                        return (
                          <div className="space-y-3 p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Material muscle focus</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left side: List of Target Muscles */}
                              <div className="space-y-4 flex flex-col justify-center">
                                {primaryMuscles.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="block text-[9px] uppercase font-black text-red-500 tracking-wide flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                      Primary Target
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {primaryMuscles.map((m: any) => (
                                        <span key={m.id} className="px-2.5 py-1 bg-red-500/10 text-red-500 border border-red-500/25 text-[9px] font-bold rounded-[8px] transition-all hover:bg-red-500/15">
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {secondaryMuscles.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="block text-[9px] uppercase font-black text-sky-500 dark:text-sky-400 tracking-wide flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                                      Secondary / Stabilizers
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {secondaryMuscles.map((m: any) => (
                                        <span key={m.id} className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-dashed border-blue-500/25 text-[9px] font-bold rounded-[8px] transition-all hover:bg-blue-500/15">
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right side: 3D Holographic Model viewport */}
                              <div className="relative border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden bg-neutral-100/40 dark:bg-[#0A0A0A] flex flex-col justify-between min-h-[420px] h-[420px]">
                                <div className="flex justify-between items-center p-3 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#111111]/50 z-10">
                                  <span className="text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Muscle reference</span>
                                  <div className="flex items-center gap-2">
                                    {/* Fullscreen toggle button */}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSelected3DAsset(selectedDetailAsset); setShow3DStudio(true); }}
                                      className="min-h-11 min-w-11 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                                      title="View Fullscreen"
                                    >
                                      <ArrowsOut className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex-1 w-full relative">
                                  <Anatomical3DModel muscleLoads={muscleLoads} maxLoad={1.0} gender={anatomicalGender} active={!show3DStudio} defaultViewMode="2d" allowFullscreen={false} className="h-full w-full border-0" context={{ kind: 'material', title: selectedDetailAsset.title, assetId: selectedDetailAsset.id, sourceLabel: 'Saved material mapping', onOpenMaterial: id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) setSelectedDetailAsset(material); } }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Description & Guidelines */}
                      <div className="space-y-2">
                        <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_guidelines_mechanics')}</span>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
                          {parseAssetDescription(selectedDetailAsset.description).text || t('lib_no_guidelines')}
                        </p>
                      </div>

                      {/* Step-by-Step Instructions */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && parseAssetDescription(selectedDetailAsset.description).instructions && parseAssetDescription(selectedDetailAsset.description).instructions!.length > 0 && (
                        <div className="space-y-3">
                          <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_execution_steps')}</span>
                          <ol className="space-y-2">
                            {parseAssetDescription(selectedDetailAsset.description).instructions!.map((step, idx) => {
                              const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '');
                              return (
                                <li key={idx} className="flex items-start gap-3 text-xs text-neutral-600 dark:text-neutral-300 font-sans">
                                  <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-relaxed">{cleanStep}</span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}

                      {/* Taekwondo Skill Details */}
                      {(activeTab === 'tkd' || activeTab === 'dance') && selectedDetailAsset.category !== 'Theory & Terminology' && (() => {
                        const parsed = parseAssetDescription(selectedDetailAsset.description);
                        const hasPrereqs = parsed.prerequisites && parsed.prerequisites.length > 0;
                        const hasPrinciples = parsed.principles && parsed.principles.length > 0;
                        const hasDrilling = parsed.drillingMethods && parsed.drillingMethods.length > 0;
                        const hasMistakes = parsed.mistakes && parsed.mistakes.length > 0;
                        const hasPerformance = parsed.performance && parsed.performance.length > 0;

                        if (!hasPrereqs && !hasPrinciples && !hasDrilling && !hasMistakes && !hasPerformance) {
                          return null;
                        }

                        return (
                          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
                            {/* Side-by-side: Prerequisites and Principles */}
                            {(hasPrereqs || hasPrinciples) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {hasPrereqs && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                    <span className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-3">Skill Prerequisites</span>
                                    <ul className="space-y-2">
                                      {parsed.prerequisites!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed font-sans">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {hasPrinciples && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                    <span className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-3">Principle of the Skill</span>
                                    <ul className="space-y-2">
                                      {parsed.principles!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed font-sans">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Drilling Methods */}
                            {hasDrilling && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Drilling Methods for Effective Training</span>
                                <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                  <ul className="space-y-2.5">
                                    {parsed.drillingMethods!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed font-sans">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Common Mistakes & Corrections */}
                            {hasMistakes && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Common Mistakes & Corrections</span>
                                <div className="space-y-3">
                                  {parsed.mistakes!.map((item, idx) => (
                                    <div key={idx} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm bg-neutral-50/50 dark:bg-[#111111]/30">
                                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-[#262626]">
                                        {/* Mistake Side */}
                                        <div className="bg-red-500/[0.015] dark:bg-red-500/[0.005] p-3.5 flex flex-col">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="px-2 py-0.5 rounded-[8px] bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-wider">Mistake</span>
                                            <span className="text-[10px] font-mono font-bold text-neutral-400 dark:text-neutral-500">#{idx + 1}</span>
                                          </div>
                                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-medium">
                                            {item.mistake || "—"}
                                          </p>
                                        </div>
                                        {/* Correction Side */}
                                        <div className="bg-emerald-500/[0.015] dark:bg-emerald-500/[0.005] p-3.5 flex flex-col font-medium">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider">Correction</span>
                                          </div>
                                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-medium">
                                            {item.correction || "—"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Performance & Application */}
                            {hasPerformance && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Performance & Application</span>
                                <div className="p-4 bg-red-500/[0.02] dark:bg-red-500/[0.01] border border-red-500/10 dark:border-red-500/5 rounded-[8px] shadow-sm">
                                  <ul className="space-y-2.5">
                                    {parsed.performance!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed font-sans">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Linked Physical Solutions (Fitness Skills) */}
                            {parsed.fitnessSolutions && parsed.fitnessSolutions.length > 0 && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Physical Training Solutions for Skill Performance</span>
                                <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                  <div className="flex flex-wrap gap-2">
                                    {parsed.fitnessSolutions.map(fsId => {
                                      const solution = state.curriculumVideos.find(v => v.id === fsId);
                                      if (!solution) return null;
                                      return (
                                        <button
                                          key={fsId}
                                          type="button"
                                          onClick={() => {
                                            setSelectedDetailAsset(solution);
                                          }}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-[#EF2F38]/10 dark:bg-neutral-800 dark:hover:bg-[#EF2F38]/15 border border-neutral-300 dark:border-neutral-700 hover:border-[#EF2F38]/30 dark:hover:border-[#EF2F38]/40 rounded-[8px] text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer"
                                        >
                                          <Barbell className="w-3.5 h-3.5 text-[#EF2F38]" />
                                          <span>{solution.title}</span>
                                          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal">({solution.category.replace('Fitness: ', '')})</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Theory & Terminology Dedicated Summary Interface */}
                      {selectedDetailAsset.category === 'Theory & Terminology' && (() => {
                        const parsed = parseAssetDescription(selectedDetailAsset.description);
                        const hasTerminology = parsed.terminology && parsed.terminology.length > 0;
                        const hasStudyGuide = parsed.studyGuide && parsed.studyGuide.length > 0;

                        if (!hasTerminology && !hasStudyGuide) return null;

                        return (
                          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
                            {/* Terminology Glossary */}
                            {hasTerminology && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Korean Vocabulary Glossary</span>
                                <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-neutral-50 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-neutral-400 font-bold">
                                        <th className="p-3">Korean Term</th>
                                        <th className="p-3">English Meaning</th>
                                        <th className="p-3">Khmer Translation</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-250 dark:divide-[#262626]">
                                      {parsed.terminology!.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-[#141414]/30 text-neutral-700 dark:text-neutral-300">
                                          <td className="p-3 font-semibold text-[#EF2F38] font-mono">{item.korean || "—"}</td>
                                          <td className="p-3 font-medium">{item.english || "—"}</td>
                                          <td className="p-3 font-medium font-sans">{item.khmer || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Study Guide Q&A */}
                            {hasStudyGuide && (
                              <div className="space-y-3">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Theoretical Q&A / Study Guide</span>
                                <div className="space-y-2">
                                  {parsed.studyGuide!.map((item, idx) => {
                                    const isExpanded = !!expandedStudyGuides[idx];
                                    return (
                                      <div key={idx} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden bg-neutral-50/30 dark:bg-[#111111]/10 shadow-sm transition-all">
                                        <button
                                          type="button"
                                          onClick={() => toggleStudyGuide(idx)}
                                          className="w-full p-4 text-left flex justify-between items-center gap-3 hover:bg-neutral-50 dark:hover:bg-[#141414]/40 transition-colors border-0 bg-transparent cursor-pointer"
                                        >
                                          <div className="flex items-start gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                              Q
                                            </span>
                                            <span className="text-xs font-bold text-neutral-850 dark:text-neutral-100 mt-0.5">{item.question || "—"}</span>
                                          </div>
                                          {isExpanded ? (
                                            <CaretDown className="w-4 h-4 text-neutral-400 shrink-0" />
                                          ) : (
                                            <CaretRight className="w-4 h-4 text-neutral-400 shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-4 pb-4 pt-1 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium border-t border-neutral-100 dark:border-[#262626] bg-white dark:bg-[#141414]/20 animate-in fade-in slide-in-from-top-1 duration-150">
                                            <div className="flex items-start gap-2.5">
                                              <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                A
                                              </span>
                                              <p className="mt-0.5 whitespace-pre-line">{item.answer || "—"}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer Actions */}
                    {isElevated && (
                      <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2 shrink-0">
                        <button onClick={() => { confirmDeleteVideo(selectedDetailAsset.id, selectedDetailAsset.title, () => setSelectedDetailAsset(null)); }}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-[8px] text-xs font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5"/> {t('act_delete')}
                        </button>
                        {onEditContent && <button type="button" onClick={() => onEditContent(selectedDetailAsset.id)}
                          className="px-4 py-2 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-bold uppercase hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Article className="w-3.5 h-3.5 text-[#EF2F38]"/> Content &amp; languages
                        </button>}
                        <button onClick={() => handleStartEdit(selectedDetailAsset)}
                          className="px-4 py-2 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-bold uppercase hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PencilSimple className="w-3.5 h-3.5 text-[#EF2F38]"/> {t('lib_edit_details')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </Portal>
        )}</>;
}
