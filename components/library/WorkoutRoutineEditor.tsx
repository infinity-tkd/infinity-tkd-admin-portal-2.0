'use client';
import { dialogMotion } from '@/lib/motion';
import React from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { motion } from 'motion/react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { ROUTINE_TYPES } from '@/lib/library-catalog';


interface WorkoutRoutineEditorProps {
  isSaving: boolean;
  editingRoutine: any;
  t: ReturnType<typeof useT>;
  setShowRoutineModal: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingRoutine: React.Dispatch<any>;
  handleSaveRoutine: (e: React.FormEvent) => Promise<void>;
  newRoutine: { title: string; description: string; routineType: string; difficulty: string; prepareSeconds: number; workSeconds: number; restSeconds: number; rounds: number; selectedExercises: string[]; publishToStudents: boolean; publicationReason: string; };
  setNewRoutine: React.Dispatch<React.SetStateAction<{ title: string; description: string; routineType: string; difficulty: string; prepareSeconds: number; workSeconds: number; restSeconds: number; rounds: number; selectedExercises: string[]; publishToStudents: boolean; publicationReason: string; }>>;
  exerciseSearch: string;
  setExerciseSearch: React.Dispatch<React.SetStateAction<string>>;
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dropdownOpen: boolean;
  filteredExercises: string[];
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  draggedIndex: number | null;
  handleMoveExercise: (index: number, direction: "up" | "down") => void;
}

export function WorkoutRoutineEditor({ isSaving, editingRoutine, t, setShowRoutineModal, setEditingRoutine, handleSaveRoutine, newRoutine, setNewRoutine, exerciseSearch, setExerciseSearch, setDropdownOpen, dropdownOpen, filteredExercises, handleDragStart, handleDragOver, handleDragEnd, draggedIndex, handleMoveExercise }: WorkoutRoutineEditorProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, () => { if (!isSaving) { setShowRoutineModal(false); setEditingRoutine(null); } }, true);
  return <>{(
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
               <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label={editingRoutine ? "Edit routine" : "Create routine"} {...dialogMotion}
                 className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
               >
                 <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-white">{editingRoutine ? t('lib_edit_routine') : t('lib_create_routine_title')}</h2>
                    <button
                      onClick={() => { setShowRoutineModal(false); setEditingRoutine(null); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                      title={t('act_close')}
                    >
                      <X className="w-5 h-5"/>
                    </button>
                 </div>

                 <form onSubmit={handleSaveRoutine} className="p-6 space-y-4 overflow-y-auto bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_title_label')}</label>
                      <input type="text" value={newRoutine.title} onChange={(e) => setNewRoutine({ ...newRoutine, title: e.target.value })} required
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder="e.g. Rapid Footwork & Leg Conditioning"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_desc_label')}</label>
                      <textarea value={newRoutine.description} onChange={(e) => setNewRoutine({ ...newRoutine, description: e.target.value })} required rows={2}
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder={t('lib_placeholder_routine_desc')}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">Routine Type</label>
                        <select value={newRoutine.routineType} onChange={(e) => setNewRoutine({ ...newRoutine, routineType: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold"
                        >
                          {ROUTINE_TYPES.map(type => (
                            <option key={type} value={type} className="text-black dark:text-white dark:bg-neutral-900">{type}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_diff_label')}</label>
                        <select value={newRoutine.difficulty} onChange={(e) => setNewRoutine({ ...newRoutine, difficulty: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold"
                        >
                          <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                          <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                          <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                          <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_rounds_label')}</label>
                        <input type="number" min={1} max={20} step={1} value={newRoutine.rounds} onChange={(e) => setNewRoutine({ ...newRoutine, rounds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_prep_label')}</label>
                        <input type="number" min={0} max={300} step={1} value={newRoutine.prepareSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, prepareSeconds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_work_label')}</label>
                        <input type="number" min={1} max={3600} step={1} value={newRoutine.workSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, workSeconds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_rest_label')}</label>
                        <input type="number" min={0} max={1800} step={1} value={newRoutine.restSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, restSeconds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="relative">
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">
                          {t('lib_routine_sequence_label')}
                        </label>

                        {/* Search input container */}
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                            <MagnifyingGlass className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                          </span>
                          <input
                            type="text"
                            placeholder="Search curriculum exercises or type custom step..."
                            value={exerciseSearch}
                            onChange={(e) => {
                              setExerciseSearch(e.target.value);
                              setDropdownOpen(true);
                            }}
                            onFocus={() => setDropdownOpen(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = exerciseSearch.trim();
                                if (val) {
                                  setNewRoutine(prev => ({
                                    ...prev,
                                    selectedExercises: [...prev.selectedExercises, val]
                                  }));
                                  setExerciseSearch('');
                                  setDropdownOpen(false);
                                }
                              }
                            }}
                            className="w-full pl-10 pr-10 py-2.5 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 transition-all font-medium placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                          />
                          {exerciseSearch && (
                            <button
                              type="button"
                              onClick={() => {
                                  setExerciseSearch('');
                                  setDropdownOpen(false);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Autocomplete Dropdown overlay */}
                        {dropdownOpen && (
                          <>
                            {/* Click outside backdrop to close dropdown */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setDropdownOpen(false)}
                            />
                            <div className="absolute left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-xl z-20 divide-y divide-neutral-100 dark:divide-[#262626] scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700">
                              {exerciseSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewRoutine(prev => ({
                                      ...prev,
                                      selectedExercises: [...prev.selectedExercises, exerciseSearch.trim()]
                                    }));
                                    setExerciseSearch('');
                                    setDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-xs text-[#EF2F38] hover:bg-[#EF2F38]/5 dark:hover:bg-[#EF2F38]/10 transition-colors flex justify-between items-center group font-bold border-b border-neutral-100 dark:border-[#262626] cursor-pointer"
                                >
                                  <span>+ Add Custom: &quot;{exerciseSearch.trim()}&quot;</span>
                                  <Plus className="w-3.5 h-3.5 text-[#EF2F38]" />
                                </button>
                              )}
                              {filteredExercises.length > 0 ? (
                                filteredExercises.map((exercise, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setNewRoutine(prev => ({
                                        ...prev,
                                        selectedExercises: [...prev.selectedExercises, exercise]
                                      }));
                                      setExerciseSearch('');
                                      setDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-[#EF2F38]/5 hover:text-[#EF2F38] dark:hover:bg-[#EF2F38]/10 dark:hover:text-[#EF2F38] transition-colors flex justify-between items-center group font-medium cursor-pointer"
                                  >
                                    <span>{exercise}</span>
                                    <Plus aria-hidden="true" className="hover-reveal w-3.5 h-3.5 text-[#EF2F38]" />
                                  </button>
                                ))
                              ) : !exerciseSearch.trim() ? (
                                <div className="px-4 py-3 text-xs text-neutral-400 dark:text-neutral-500 italic text-center font-mono">
                                  Type an exercise to search or add custom...
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                      {/* Selected exercises list container */}
                      <div className="mt-4 space-y-2">
                        <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">
                          Routine Exercise Sequence ({newRoutine.selectedExercises.length} items)
                        </span>

                        {newRoutine.selectedExercises.length > 0 ? (
                          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {newRoutine.selectedExercises.map((exercise, index) => (
                              <div
                                key={index}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  "flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#1C1C1C] border rounded-[8px] transition-all group",
                                  draggedIndex === index
                                    ? "opacity-40 border-dashed border-[#EF2F38] bg-red-500/5"
                                    : "border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-800"
                                )}
                              >
                                {/* Left section: drag handle + exercise title */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {/* Drag Handle Icon */}
                                  <div
                                    className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400 flex items-center justify-center shrink-0"
                                    title="Drag to reorder"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                                    </svg>
                                  </div>

                                  {/* Index badge */}
                                  <span className="w-5 h-5 flex items-center justify-center bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full text-[9px] font-mono font-bold shrink-0">
                                    {index + 1}
                                  </span>

                                  <span className="text-xs text-neutral-800 dark:text-neutral-200 font-medium truncate">
                                    {exercise}
                                  </span>
                                </div>

                                {/* Right section: move buttons + delete */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Reorder Buttons (Manual controls for mobile/accessibility) */}
                                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => handleMoveExercise(index, 'up')}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#2C2C2C] text-neutral-500 dark:text-neutral-400 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
                                      title="Move up"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === newRoutine.selectedExercises.length - 1}
                                      onClick={() => handleMoveExercise(index, 'down')}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#2C2C2C] text-neutral-500 dark:text-neutral-400 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
                                      title="Move down"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>

                                  {/* Trash button to delete item */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = newRoutine.selectedExercises.filter((_, i) => i !== index);
                                      setNewRoutine({ ...newRoutine, selectedExercises: updated });
                                    }}
                                    className="p-1 text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all ml-1 cursor-pointer"
                                    title="Remove exercise"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="border border-dashed border-neutral-300 dark:border-[#262626] rounded-[8px] p-5 text-center bg-neutral-50/50 dark:bg-neutral-900/10">
                            <svg className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                              No exercises added yet. Use the search input above to construct your sequence.
                            </p>
                          </div>
                        )}
                      </div>

                    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <label className="flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={newRoutine.publishToStudents} onChange={event => setNewRoutine({ ...newRoutine, publishToStudents: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#EF2F38]" />Publish this version to the student portal</label>
                      <p className="text-xs leading-relaxed text-neutral-500">Drafts stay in Academy management. Publishing makes this approved routine available to students; existing student assignments retain their saved version.</p>
                      {newRoutine.publishToStudents && <label className="block text-xs font-medium">Publication reason<textarea required minLength={5} maxLength={500} rows={2} value={newRoutine.publicationReason} onChange={event => setNewRoutine({ ...newRoutine, publicationReason: event.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" /></label>}
                    </div>
             <button type="submit" disabled={isSaving || !newRoutine.selectedExercises.length || (newRoutine.publishToStudents && newRoutine.publicationReason.trim().length < 5)}
               className="w-full bg-amber-500 text-black hover:bg-amber-600 py-3 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all mt-2 cursor-pointer shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
             >
               {isSaving ? 'Saving…' : newRoutine.publishToStudents ? 'Publish routine' : 'Save private draft'}
             </button>
                 </form>
               </motion.div>
            </div>
          </Portal>
        )}</>;
}
