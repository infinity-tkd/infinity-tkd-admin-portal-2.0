'use client';
import NextImage from 'next/image';
import { dialogMotion } from '@/lib/motion';
import React from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { useAppStore } from '@/lib/store';
import { motion } from 'motion/react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { cn, getCategoryTranslationKey, getYouTubeId, MistakeCorrection, VocabularyItem, QuestionAnswerItem } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { TKD_CATEGORIES, FITNESS_CATEGORIES, DANCE_CATEGORIES, BELTS, getBeltTranslationKey } from '@/lib/library-catalog';


interface LibraryAssetCreateDialogProps {
  isSaving: boolean;
  t: ReturnType<typeof useT>;
  activeTab: "tkd" | "fitness" | "dance" | "routines";
  setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddAsset: (e: React.FormEvent) => Promise<void>;
  newAsset: { title: string; description: string; category: string; minBeltLevel: string; videoUrl: string; difficulty: "Beginner" | "Intermediate" | "Advanced" | "Elite"; focusZones: string; instructions: string; repsSets: string; thumbnailUrl: string; };
  setNewAsset: React.Dispatch<React.SetStateAction<{ title: string; description: string; category: string; minBeltLevel: string; videoUrl: string; difficulty: "Beginner" | "Intermediate" | "Advanced" | "Elite"; focusZones: string; instructions: string; repsSets: string; thumbnailUrl: string; }>>;
  addMuscleDropdownRef: React.RefObject<HTMLDivElement | null>;
  muscleSearch: string;
  setMuscleSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowMuscleDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveMuscleIdx: React.Dispatch<React.SetStateAction<number>>;
  showMuscleDropdown: boolean;
  state: ReturnType<typeof useAppStore>['state'];
  activeMuscleIdx: number;
  selectedMuscles: { muscleId: number; role: "Primary" | "Secondary"; }[];
  setSelectedMuscles: React.Dispatch<React.SetStateAction<{ muscleId: number; role: "Primary" | "Secondary"; }[]>>;
  instructionSteps: string[];
  setDraggedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  draggedIndex: number | null;
  setInstructionSteps: React.Dispatch<React.SetStateAction<string[]>>;
  addFitnessSolutionsDropdownRef: React.RefObject<HTMLDivElement | null>;
  fitnessSearch: string;
  setFitnessSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowFitnessDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  showFitnessDropdown: boolean;
  selectedFitnessSolutions: number[];
  setSelectedFitnessSolutions: React.Dispatch<React.SetStateAction<number[]>>;
  prerequisiteSteps: string[];
  setPrerequisiteSteps: React.Dispatch<React.SetStateAction<string[]>>;
  principleSteps: string[];
  setPrincipleSteps: React.Dispatch<React.SetStateAction<string[]>>;
  drillingSteps: string[];
  setDrillingSteps: React.Dispatch<React.SetStateAction<string[]>>;
  mistakeSteps: MistakeCorrection[];
  setMistakeSteps: React.Dispatch<React.SetStateAction<MistakeCorrection[]>>;
  performanceSteps: string[];
  setPerformanceSteps: React.Dispatch<React.SetStateAction<string[]>>;
  terminologyList: VocabularyItem[];
  setTerminologyList: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  studyGuideList: QuestionAnswerItem[];
  setStudyGuideList: React.Dispatch<React.SetStateAction<QuestionAnswerItem[]>>;
}

export function LibraryAssetCreateDialog({ isSaving, t, activeTab, setShowAddModal, handleAddAsset, newAsset, setNewAsset, addMuscleDropdownRef, muscleSearch, setMuscleSearch, setShowMuscleDropdown, setActiveMuscleIdx, showMuscleDropdown, state, activeMuscleIdx, selectedMuscles, setSelectedMuscles, instructionSteps, setDraggedIndex, draggedIndex, setInstructionSteps, addFitnessSolutionsDropdownRef, fitnessSearch, setFitnessSearch, setShowFitnessDropdown, showFitnessDropdown, selectedFitnessSolutions, setSelectedFitnessSolutions, prerequisiteSteps, setPrerequisiteSteps, principleSteps, setPrincipleSteps, drillingSteps, setDrillingSteps, mistakeSteps, setMistakeSteps, performanceSteps, setPerformanceSteps, terminologyList, setTerminologyList, studyGuideList, setStudyGuideList }: LibraryAssetCreateDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, () => { if (!isSaving) setShowAddModal(false); }, true);
  return <>{(
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
               <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create library lesson" {...dialogMotion}
                 className="w-full max-w-4xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
               >
                 <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-white">
                      {t('lib_add_asset')} - {activeTab === 'tkd' ? t('lib_tab_tkd') : activeTab === 'dance' ? t('lib_tab_dance') : t('lib_tab_fitness')}
                    </h2>
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                      title={t('act_close')}
                    >
                      <X className="w-5 h-5"/>
                    </button>
                 </div>
                 <form onSubmit={handleAddAsset} className="p-6 overflow-y-auto bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_asset_title')}</label>
                      <input type="text" value={newAsset.title} onChange={(e) => setNewAsset({ ...newAsset, title: e.target.value })} required
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder={t('lib_placeholder_asset_title')}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_desc_guidelines')}</label>
                      <textarea value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} required rows={2} maxLength={20000}
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder={t('lib_placeholder_asset_desc')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_category_col')}</label>
                        <select value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                        >
                          {activeTab === 'tkd' ? (
                            TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                          ) : activeTab === 'fitness' ? (
                            FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                          ) : (
                            DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{activeTab === 'tkd' ? t('lib_bulk_belt_col') : t('lib_routine_diff_label')}</label>
                        {activeTab === 'tkd' ? (
                          <select value={newAsset.minBeltLevel} onChange={(e) => setNewAsset({ ...newAsset, minBeltLevel: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                          </select>
                        ) : (
                          <select value={newAsset.difficulty} onChange={(e) => setNewAsset({ ...newAsset, difficulty: e.target.value as any })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {activeTab === 'tkd' && newAsset.category !== 'Theory & Terminology' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_diff_label')}</label>
                          <select value={newAsset.difficulty} onChange={(e) => setNewAsset({ ...newAsset, difficulty: e.target.value as any })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                          <input type="text" value={newAsset.repsSets} onChange={(e) => setNewAsset({ ...newAsset, repsSets: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="e.g. 3 sets x 15 reps"
                          />
                        </div>
                      </div>
                    )}

                    {activeTab === 'fitness' && (
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                        <input type="text" value={newAsset.repsSets} onChange={(e) => setNewAsset({ ...newAsset, repsSets: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          placeholder="e.g. 3 sets x 45 secs hold"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {newAsset.category !== 'Theory & Terminology' ? (
                        <div className="relative" ref={addMuscleDropdownRef}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_focus_zones')} / Muscles</label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Search or select muscles..."
                              value={muscleSearch}
                              onChange={(e) => {
                                setMuscleSearch(e.target.value);
                                setShowMuscleDropdown(true);
                                setActiveMuscleIdx(-1);
                              }}
                              onFocus={() => setShowMuscleDropdown(true)}
                              onKeyDown={(e) => {
                                if (!showMuscleDropdown) {
                                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    setShowMuscleDropdown(true);
                                    e.preventDefault();
                                  }
                                  return;
                                }

                                const query = muscleSearch.toLowerCase();
                                const filtered = state.muscles.filter(m => {
                                  if (!query) return true;
                                  return m.name.toLowerCase().includes(query) ||
                                         (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                         (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                         m.muscleGroup.toLowerCase().includes(query);
                                });

                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setActiveMuscleIdx(prev => filtered.length > 0 ? (prev + 1) % filtered.length : -1);
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setActiveMuscleIdx(prev => filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : -1);
                                } else if (e.key === 'Enter') {
                                  if (activeMuscleIdx >= 0 && activeMuscleIdx < filtered.length) {
                                    e.preventDefault();
                                    const targetMuscle = filtered[activeMuscleIdx];
                                    const isSelected = selectedMuscles.some(s => s.muscleId === targetMuscle.id);
                                    if (isSelected) {
                                      setSelectedMuscles(selectedMuscles.filter(s => s.muscleId !== targetMuscle.id));
                                    } else {
                                      setSelectedMuscles([...selectedMuscles, { muscleId: targetMuscle.id, role: 'Primary' }]);
                                    }
                                  }
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setShowMuscleDropdown(false);
                                  setActiveMuscleIdx(-1);
                                }
                              }}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowMuscleDropdown(!showMuscleDropdown)}
                              className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                            >
                              {showMuscleDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {showMuscleDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-25">
                              {(() => {
                                const query = muscleSearch.toLowerCase();
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

                                return filtered.map(m => {
                                  const isSelected = selectedMuscles.some(s => s.muscleId === m.id);

                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedMuscles(selectedMuscles.filter(s => s.muscleId !== m.id));
                                        } else {
                                          setSelectedMuscles([...selectedMuscles, { muscleId: m.id, role: 'Primary' }]);
                                        }
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                        isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]"
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
                            {selectedMuscles.map(sm => {
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
                                    setSelectedMuscles(selectedMuscles.map(x => x.muscleId === sm.muscleId ? { ...x, role: x.role === 'Primary' ? 'Secondary' : 'Primary' } : x));
                                  }}
                                  title="Click to toggle Primary vs Secondary"
                                >
                                  <span>{sm.role === 'Primary' ? '★ ' : '☆ '}{state.language === 'kh' && muscle.nameKh ? muscle.nameKh : (state.language === 'zh' && muscle.nameZh ? muscle.nameZh : muscle.name)}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMuscles(selectedMuscles.filter(x => x.muscleId !== sm.muscleId));
                                    }}
                                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div className={cn(newAsset.category === 'Theory & Terminology' ? "col-span-2" : "")}>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_cover_url')}</label>
                        <input type="text" value={newAsset.thumbnailUrl} onChange={(e) => setNewAsset({ ...newAsset, thumbnailUrl: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          placeholder="e.g. https://images.unsplash.com/..."
                        />
                        {(() => {
                          const ytId = getYouTubeId(newAsset.videoUrl);
                          const resolvedPreview = newAsset.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '');
                          if (!resolvedPreview) return null;
                          return (
                            <div className="mt-2 h-14 w-24 rounded-[8px] border border-neutral-200 dark:border-[#262626] overflow-hidden bg-neutral-100 dark:bg-[#1C1C1C] dark:bg-neutral-900 relative">
                              <NextImage unoptimized width={320} height={180} src={resolvedPreview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {newAsset.category !== 'Theory & Terminology' && (
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">{t('lib_form_instructions')}</label>
                        <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-80 overflow-y-auto">
                          {instructionSteps.map((step, idx) => (
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
                                const updated = [...instructionSteps];
                                const [draggedItem] = updated.splice(draggedIndex, 1);
                                updated.splice(idx, 0, draggedItem);
                                setInstructionSteps(updated);
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
                                id={`step-input-add-${idx}`}
                                type="text"
                                value={step}
                                placeholder="Enter instruction detail..."
                                onChange={(e) => {
                                  const updated = [...instructionSteps];
                                  updated[idx] = e.target.value;
                                  setInstructionSteps(updated);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const updated = [...instructionSteps];
                                    updated.splice(idx + 1, 0, '');
                                    setInstructionSteps(updated);
                                    setTimeout(() => {
                                      document.getElementById(`step-input-add-${idx + 1}`)?.focus();
                                    }, 30);
                                  } else if (e.key === 'Backspace' && !step && idx > 0) {
                                    e.preventDefault();
                                    const updated = [...instructionSteps];
                                    updated.splice(idx, 1);
                                    setInstructionSteps(updated);
                                    setTimeout(() => {
                                      document.getElementById(`step-input-add-${idx - 1}`)?.focus();
                                    }, 30);
                                  }
                                }}
                                className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                              />

                              {/* Remove button */}
                              {instructionSteps.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = instructionSteps.filter((_, i) => i !== idx);
                                    setInstructionSteps(updated);
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
                            setInstructionSteps([...instructionSteps, '']);
                            setTimeout(() => {
                              document.getElementById(`step-input-add-${instructionSteps.length}`)?.focus();
                            }, 30);
                          }}
                          className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Instruction Step
                        </button>
                      </div>
                    )}

                    {activeTab === 'tkd' && newAsset.category !== 'Theory & Terminology' && (
                      <div className="relative" ref={addFitnessSolutionsDropdownRef}>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">Linked Physical Training Solutions</label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Search physical training solutions..."
                            value={fitnessSearch}
                            onChange={(e) => {
                              setFitnessSearch(e.target.value);
                              setShowFitnessDropdown(true);
                            }}
                            onFocus={() => setShowFitnessDropdown(true)}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setShowFitnessDropdown(!showFitnessDropdown)}
                            className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                          >
                            {showFitnessDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                          </button>
                        </div>
                        {showFitnessDropdown && (
                          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-[200]">
                            {(() => {
                              const query = fitnessSearch.toLowerCase();
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
                                const isSelected = selectedFitnessSolutions.includes(f.id);
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedFitnessSolutions(selectedFitnessSolutions.filter(id => id !== f.id));
                                      } else {
                                        setSelectedFitnessSolutions([...selectedFitnessSolutions, f.id]);
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
                          {selectedFitnessSolutions.map(id => {
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
                                    setSelectedFitnessSolutions(selectedFitnessSolutions.filter(x => x !== id));
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

                    {(activeTab === 'tkd' || activeTab === 'dance') && (
                      <>
                        {/* Skill Prerequisites Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Skill Prerequisites</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {prerequisiteSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...prerequisiteSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPrerequisiteSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`prereq-step-add-${idx}`} type="text" value={step} placeholder="e.g. Ap Chagi (Front Kick)"
                                  onChange={(e) => { const u = [...prerequisiteSteps]; u[idx] = e.target.value; setPrerequisiteSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...prerequisiteSteps]; u.splice(idx + 1, 0, ''); setPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...prerequisiteSteps]; u.splice(idx, 1); setPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {prerequisiteSteps.length > 1 && (
                                  <button type="button" onClick={() => setPrerequisiteSteps(prerequisiteSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPrerequisiteSteps([...prerequisiteSteps, '']); setTimeout(() => document.getElementById(`prereq-step-add-${prerequisiteSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Prerequisite</button>
                        </div>

                        {/* Principle of the Skill Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Principle of the Skill</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {principleSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...principleSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPrincipleSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`principle-step-add-${idx}`} type="text" value={step} placeholder="e.g. Dynamic snap at knee joint"
                                  onChange={(e) => { const u = [...principleSteps]; u[idx] = e.target.value; setPrincipleSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...principleSteps]; u.splice(idx + 1, 0, ''); setPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...principleSteps]; u.splice(idx, 1); setPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {principleSteps.length > 1 && (
                                  <button type="button" onClick={() => setPrincipleSteps(principleSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPrincipleSteps([...principleSteps, '']); setTimeout(() => document.getElementById(`principle-step-add-${principleSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Principle</button>
                        </div>

                        {/* Drilling Methods Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Drilling Methods</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {drillingSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...drillingSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setDrillingSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`drilling-step-add-${idx}`} type="text" value={step} placeholder="e.g. 3 rounds of 10 rapid repetitions per leg..."
                                  onChange={(e) => { const u = [...drillingSteps]; u[idx] = e.target.value; setDrillingSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...drillingSteps]; u.splice(idx + 1, 0, ''); setDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...drillingSteps]; u.splice(idx, 1); setDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {drillingSteps.length > 1 && (
                                  <button type="button" onClick={() => setDrillingSteps(drillingSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setDrillingSteps([...drillingSteps, '']); setTimeout(() => document.getElementById(`drilling-step-add-${drillingSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Drilling Method</button>
                        </div>

                        {/* Common Mistakes & Corrections Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Common Mistakes & Corrections</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {mistakeSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...mistakeSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setMistakeSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-start gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1 mt-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center mt-1">#{idx + 1}</span>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <input id={`mistake-input-add-${idx}`} type="text" value={step.mistake} placeholder="Mistake (e.g. Dropping hands)"
                                    onChange={(e) => { const u = [...mistakeSteps]; u[idx] = { ...u[idx], mistake: e.target.value }; setMistakeSteps(u); }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById(`correction-input-add-${idx}`)?.focus();
                                      } else if (e.key === 'Backspace' && !step.mistake && idx > 0) {
                                        e.preventDefault();
                                        const u = [...mistakeSteps];
                                        u.splice(idx, 1);
                                        setMistakeSteps(u);
                                        setTimeout(() => document.getElementById(`correction-input-add-${idx - 1}`)?.focus(), 30);
                                      }
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-red-500/20 dark:border-red-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/10 font-medium"
                                  />
                                  <input id={`correction-input-add-${idx}`} type="text" value={step.correction} placeholder="Correction (e.g. Keep guard up)"
                                    onChange={(e) => { const u = [...mistakeSteps]; u[idx] = { ...u[idx], correction: e.target.value }; setMistakeSteps(u); }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const u = [...mistakeSteps];
                                        u.splice(idx + 1, 0, { mistake: '', correction: '' });
                                        setMistakeSteps(u);
                                        setTimeout(() => document.getElementById(`mistake-input-add-${idx + 1}`)?.focus(), 30);
                                      } else if (e.key === 'Backspace' && !step.correction) {
                                        e.preventDefault();
                                        document.getElementById(`mistake-input-add-${idx}`)?.focus();
                                      }
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-emerald-500/20 dark:border-emerald-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium"
                                  />
                                </div>
                                {mistakeSteps.length > 1 && (
                                  <button type="button" onClick={() => setMistakeSteps(mistakeSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent mt-1"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setMistakeSteps([...mistakeSteps, { mistake: '', correction: '' }]); setTimeout(() => document.getElementById(`mistake-input-add-${mistakeSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Mistake & Correction</button>
                        </div>

                        {/* Performance & Application Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Performance & Application</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {performanceSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...performanceSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPerformanceSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`performance-step-add-${idx}`} type="text" value={step} placeholder="e.g. Used for counter attacks in sparring..."
                                  onChange={(e) => { const u = [...performanceSteps]; u[idx] = e.target.value; setPerformanceSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...performanceSteps]; u.splice(idx + 1, 0, ''); setPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...performanceSteps]; u.splice(idx, 1); setPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {performanceSteps.length > 1 && (
                                  <button type="button" onClick={() => setPerformanceSteps(performanceSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPerformanceSteps([...performanceSteps, '']); setTimeout(() => document.getElementById(`performance-step-add-${performanceSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Performance Note</button>
                        </div>
                      </>
                    )}

                    {/* Custom builders for Theory & Terminology category */}
                    {activeTab === 'tkd' && newAsset.category === 'Theory & Terminology' && (
                      <div className="space-y-5 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/20 dark:bg-neutral-900/10">
                        {/* Terminology List Builder */}
                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Korean Vocabulary Glossary</label>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {terminologyList.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    value={item.korean}
                                    placeholder="Korean (e.g., Jirugi)"
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].korean = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <input
                                    type="text"
                                    value={item.english}
                                    placeholder="English (e.g., Punch)"
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].english = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <input
                                    type="text"
                                    value={item.khmer}
                                    placeholder="Khmer (e.g., ម៉ាត់)"
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].khmer = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                </div>
                                {terminologyList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setTerminologyList(terminologyList.filter((_, i) => i !== idx))}
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
                            onClick={() => setTerminologyList([...terminologyList, { korean: '', english: '', khmer: '' }])}
                            className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Vocabulary Term
                          </button>
                        </div>

                        {/* Study Guide Q&A Builder */}
                        <div className="space-y-2 border-t border-neutral-200 dark:border-[#262626] pt-4">
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Theoretical Q&A / Study Guide</label>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {studyGuideList.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-start bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                <div className="flex-1 space-y-2">
                                  <input
                                    type="text"
                                    value={item.question}
                                    placeholder="Question (e.g., Meaning of white belt?)"
                                    onChange={(e) => {
                                      const u = [...studyGuideList];
                                      u[idx].question = e.target.value;
                                      setStudyGuideList(u);
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <textarea
                                    value={item.answer}
                                    placeholder="Answer explanation..."
                                    rows={2}
                                    onChange={(e) => {
                                      const u = [...studyGuideList];
                                      u[idx].answer = e.target.value;
                                      setStudyGuideList(u);
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                </div>
                                {studyGuideList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setStudyGuideList(studyGuideList.filter((_, i) => i !== idx))}
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
                            onClick={() => setStudyGuideList([...studyGuideList, { question: '', answer: '' }])}
                            className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Q&A Card
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_link_col')} ({state.language === 'kh' ? 'ស្រេចចិត្ត' : (state.language === 'zh' ? '选填' : 'Optional')})</label>
                      <input type="text" value={newAsset.videoUrl} onChange={(e) => setNewAsset({ ...newAsset, videoUrl: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                        placeholder="e.g. https://drive.google.com/file/d/..."
                      />
                    </div>

                    <button type="submit" disabled={isSaving}
                      className="w-full bg-[#EF2F38] text-white hover:bg-[#d6262f] py-3 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all mt-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                    >
                      {t('lib_add_to_library')}
                    </button>
                 </form>
               </motion.div>
            </div>
          </Portal>
        )}</>;
}
