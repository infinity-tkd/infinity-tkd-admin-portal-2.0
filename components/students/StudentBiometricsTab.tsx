'use client';
import React from 'react';
import { useAppStore } from '@/lib/store';

import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';
import type { Student } from '@/lib/store';
const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  { ssr: false }
);

interface StudentBiometricsTabProps {
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  muscleLoads: Record<string, number>;
  maxLoad: number;
  student: Student;
  isFullScreen: boolean;
  setHoveredMuscle: React.Dispatch<React.SetStateAction<{ name: string; score: number; } | null>>;
  completedAssetIds: number[];
  hoveredMuscle: { name: string; score: number; } | null;
  canEdit: boolean;
  handleSaveBiometrics: (e: React.FormEvent) => Promise<void>;
  t: ReturnType<typeof useT>;
  biometricsForm: { recordedDate: string; heightCm: string; weightKg: string; bodyFatPercentage: string; skeletalMuscleMassKg: string; neckCm: string; shoulderWidthCm: string; chestCm: string; waistCm: string; hipsCm: string; leftArmCm: string; rightArmCm: string; leftThighCm: string; rightThighCm: string; leftCalfCm: string; rightCalfCm: string; };
  setBiometricsForm: React.Dispatch<React.SetStateAction<{ recordedDate: string; heightCm: string; weightKg: string; bodyFatPercentage: string; skeletalMuscleMassKg: string; neckCm: string; shoulderWidthCm: string; chestCm: string; waistCm: string; hipsCm: string; leftArmCm: string; rightArmCm: string; leftThighCm: string; rightThighCm: string; leftCalfCm: string; rightCalfCm: string; }>>;
  isSavingBiometrics: boolean;
  studentCompositions: any[];
  state: ReturnType<typeof useAppStore>['state'];
}

export function StudentBiometricsTab({ setIsFullScreen, muscleLoads, maxLoad, student, isFullScreen, setHoveredMuscle, completedAssetIds, hoveredMuscle, canEdit, handleSaveBiometrics, t, biometricsForm, setBiometricsForm, isSavingBiometrics, studentCompositions, state }: StudentBiometricsTabProps) {
  return <>{(
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-neutral-900 dark:text-white">
              {/* Visualization Card */}
              <div className="xl:col-span-5 flex flex-col space-y-4">
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100 dark:border-[#262626]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                      Training muscle coverage
                    </h3>

                    <div className="flex items-center">
                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={() => setIsFullScreen(true)}
                        className="min-h-11 min-w-11 flex items-center justify-center bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white rounded-[8px] border border-neutral-200 dark:border-neutral-800 transition-colors ml-2"
                        title="Open muscle explorer"
                        aria-label="Open student muscle explorer"
                      >
                        <ArrowsOut size={13} weight="bold" />
                      </button>
                    </div>
                  </div>

                  <div className="h-[400px] min-h-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <Anatomical3DModel muscleLoads={muscleLoads} maxLoad={maxLoad} gender={student.gender} active={!isFullScreen} defaultViewMode="2d" allowFullscreen={false} className="h-full w-full border-0" onSelectMuscle={name => setHoveredMuscle(name ? { name, score: muscleLoads[name] ?? 0 } : null)} context={{ kind: 'student', title: student.englishName, studentId: student.id, completedAssetIds, sourceLabel: 'Completed learning materials' }} />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-neutral-500">Based on {completedAssetIds.length} completed learning materials. This shows teaching coverage, not measured fatigue or strength.</p>
                  {/* Color Key legend */}
                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2 p-3 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626]/50 rounded-[8px] text-[9px] font-mono text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-[8px]" />
                      <span>Not represented</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-orange-500/50 border border-orange-500 rounded-[8px]" />
                      <span>Less represented</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-red-600/85 border border-red-500 rounded-[8px]" />
                      <span>More represented</span>
                    </div>
                  </div>

                  {hoveredMuscle && <p className="mt-2 text-xs text-neutral-500">{hoveredMuscle.name} · {hoveredMuscle.score.toFixed(1)} weighted material references</p>}
                  {Object.keys(muscleLoads).length === 0 && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-[8px] text-[10px] leading-relaxed font-mono">
                      Complete learning materials with saved muscle mappings to build this student’s training coverage.
                    </div>
                  )}
                </div>
              </div>

              {/* Form and History Section */}
              <div className="xl:col-span-7 space-y-6">
                {/* Form Container */}
                {canEdit && (
                  <form onSubmit={handleSaveBiometrics} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm space-y-4">
                    <div className="border-b border-neutral-100 dark:border-[#262626] pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                        Record Biometrics & Composition
                      </h3>
                      <p className="text-[10px] text-neutral-400 dark:text-[#666] uppercase font-bold tracking-wider mt-0.5">Time-Series Snapshot Logger</p>
                    </div>

                    {/* SECTION 1: Vitals */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_date')}</label>
                        <input
                          type="date"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.recordedDate}
                          onChange={e => setBiometricsForm({...biometricsForm, recordedDate: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_height')} *</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="cm"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.heightCm}
                          onChange={e => setBiometricsForm({...biometricsForm, heightCm: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_weight')} *</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="kg"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.weightKg}
                          onChange={e => setBiometricsForm({...biometricsForm, weightKg: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {/* SECTION 2: Composition */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100 dark:border-[#262626] pt-3">
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_body_fat')} (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 15.5"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.bodyFatPercentage}
                          onChange={e => setBiometricsForm({...biometricsForm, bodyFatPercentage: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_skeletal_muscle')} (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 32.0"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.skeletalMuscleMassKg}
                          onChange={e => setBiometricsForm({...biometricsForm, skeletalMuscleMassKg: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* SECTION 3: Torso Girths */}
                    <div className="border-t border-neutral-100 dark:border-[#262626] pt-4">
                      <h4 className="text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] font-mono tracking-wider mb-2">{"// Torso Circumferences"}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_neck')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.neckCm}
                            onChange={e => setBiometricsForm({...biometricsForm, neckCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_shoulder_width')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.shoulderWidthCm}
                            onChange={e => setBiometricsForm({...biometricsForm, shoulderWidthCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_chest')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.chestCm}
                            onChange={e => setBiometricsForm({...biometricsForm, chestCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_waist')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.waistCm}
                            onChange={e => setBiometricsForm({...biometricsForm, waistCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_hips')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.hipsCm}
                            onChange={e => setBiometricsForm({...biometricsForm, hipsCm: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: Limbs Girths */}
                    <div className="border-t border-neutral-100 dark:border-[#262626] pt-4">
                      <h4 className="text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] font-mono tracking-wider mb-2">{"// Limbs Circumferences"}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_left_arm')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Arm cm"
                            value={biometricsForm.leftArmCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftArmCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_right_arm')}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Arm cm"
                            value={biometricsForm.rightArmCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightArmCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">L Thigh</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Thigh cm"
                            value={biometricsForm.leftThighCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftThighCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">R Thigh</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Thigh cm"
                            value={biometricsForm.rightThighCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightThighCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">L Calf</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Calf cm"
                            value={biometricsForm.leftCalfCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftCalfCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">R Calf</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Calf cm"
                            value={biometricsForm.rightCalfCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightCalfCm: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest text-xs shadow-md shadow-[#EF2F38]/20 flex items-center gap-2"
                        disabled={isSavingBiometrics}
                      >
                        {isSavingBiometrics ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('act_saving')}
                          </>
                        ) : (
                          t('bio_save')
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* History Timeline */}
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm flex flex-col">
                  <div className="border-b border-neutral-100 dark:border-[#262626] pb-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                      Measurement Log History
                    </h3>
                    <p className="text-[10px] text-neutral-400 dark:text-[#666] uppercase font-bold tracking-wider mt-0.5">Chronological Athletic Record</p>
                  </div>

                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-[#262626] text-[9px] uppercase font-mono font-bold text-neutral-400 dark:text-[#666]">
                          <th className="py-2.5 px-3">{t('bio_date')}</th>
                          <th className="py-2.5 px-3">{t('stu_height')}</th>
                          <th className="py-2.5 px-3">{t('stu_weight')}</th>
                          <th className="py-2.5 px-3">{t('bio_body_fat')}</th>
                          <th className="py-2.5 px-3">{t('bio_skeletal_muscle')}</th>
                          <th className="py-2.5 px-3 font-mono">{t('bio_recorded_by')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] text-xs">
                        {studentCompositions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-neutral-500 italic font-mono text-[11px]">
                              No biometric history logs found.
                            </td>
                          </tr>
                        ) : (
                          studentCompositions.map((bc, index) => {
                            const prevBc = studentCompositions[index + 1];
                            const heightDiff = prevBc ? bc.heightCm - prevBc.heightCm : 0;
                            const weightDiff = prevBc ? bc.weightKg - prevBc.weightKg : 0;

                            return (
                              <tr key={bc.id || index} className="hover:bg-neutral-50 dark:hover:bg-[#1C1C1C]/30 text-neutral-700 dark:text-neutral-300 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white font-mono text-[11px]">
                                  {bc.recordedDate}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{bc.heightCm} cm</span>
                                    {heightDiff !== 0 && (
                                      <span className={cn("text-[9px] font-bold px-1 rounded-[8px]", heightDiff > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-500/10 text-neutral-500")}>
                                        {heightDiff > 0 ? `+${heightDiff.toFixed(1)}` : heightDiff.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{bc.weightKg} kg</span>
                                    {weightDiff !== 0 && (
                                      <span className={cn("text-[9px] font-bold px-1 rounded-[8px]", weightDiff > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-500")}>
                                        {weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {bc.bodyFatPercentage !== null ? `${bc.bodyFatPercentage}%` : '-'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {bc.skeletalMuscleMassKg !== null ? `${bc.skeletalMuscleMassKg} kg` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-[9px] text-neutral-400 dark:text-neutral-500 font-mono">
                                  {bc.recordedBy === state.currentUser?.id ? 'You' : 'Coach'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}</>;
}
