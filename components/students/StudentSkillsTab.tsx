'use client';
import React from 'react';
import { useAppStore } from '@/lib/store';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Pencil } from '@phosphor-icons/react/dist/csr/Pencil';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import type { Student, Achievement } from '@/lib/store';


interface StudentSkillsTabProps {
  t: ReturnType<typeof useT>;
  canEdit: boolean;
  handleOpenBulkAchvModal: () => void;
  setShowAchievementModal: React.Dispatch<React.SetStateAction<boolean>>;
  totalCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  participantCount: number;
  achvSearch: string;
  setAchvSearch: React.Dispatch<React.SetStateAction<string>>;
  achvMedalFilter: string;
  setAchvMedalFilter: React.Dispatch<React.SetStateAction<string>>;
  achvYearFilter: string;
  setAchvYearFilter: React.Dispatch<React.SetStateAction<string>>;
  uniqueYears: string[];
  achvSort: string;
  setAchvSort: React.Dispatch<React.SetStateAction<string>>;
  achievements: Achievement[];
  setEditingAchievementId: React.Dispatch<React.SetStateAction<number | null>>;
  setAchvForm: React.Dispatch<React.SetStateAction<{ eventName: string; date: string; eventId?: string | null; }>>;
  state: ReturnType<typeof useAppStore>['state'];
  student: Student;
  setAchvEvents: React.Dispatch<React.SetStateAction<{ id?: number; category: string; division: string; medalRank: string; notes: string; ageDivision: string; beltDivision: string; }[]>>;
  setDeletedAchvIds: React.Dispatch<React.SetStateAction<number[]>>;
  showConfirm: (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => void;
  deleteAchievement: (id: number) => Promise<void>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
}

export function StudentSkillsTab({ t, canEdit, handleOpenBulkAchvModal, setShowAchievementModal, totalCount, goldCount, silverCount, bronzeCount, participantCount, achvSearch, setAchvSearch, achvMedalFilter, setAchvMedalFilter, achvYearFilter, setAchvYearFilter, uniqueYears, achvSort, setAchvSort, achievements, setEditingAchievementId, setAchvForm, state, student, setAchvEvents, setDeletedAchvIds, showConfirm, deleteAchievement, showNotification }: StudentSkillsTabProps) {
  return <>{(
            <div className="space-y-6">
               <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-100 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('panel_tournament_achievements')}</h3>
                   {canEdit && (
                     <div className="flex gap-2">
                       <button onClick={handleOpenBulkAchvModal} className="text-micro bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         {t('panel_bulk_log_btn')}
                       </button>
                       <button onClick={() => setShowAchievementModal(true)} className="text-micro bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         + {t('panel_add_achv_btn')}
                       </button>
                     </div>
                   )}
                 </div>

                 {/* Total Medals Dashboard */}
                 <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/30 dark:bg-[#141414]/30 divide-x divide-neutral-200 dark:divide-[#262626] text-center">
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-micro uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Total</span>
                      <span className="text-lg font-black text-neutral-800 dark:text-white mt-1 font-mono">{totalCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-micro uppercase font-bold text-amber-600 dark:text-amber-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Gold
                      </span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">{goldCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-micro uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Silver
                      </span>
                      <span className="text-lg font-black text-slate-600 dark:text-slate-300 mt-1 font-mono">{silverCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-micro uppercase font-bold text-orange-600 dark:text-orange-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Bronze
                      </span>
                      <span className="text-lg font-black text-orange-600 dark:text-orange-400 mt-1 font-mono">{bronzeCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center col-span-2 sm:col-span-1 border-t sm:border-t-0 border-neutral-200 dark:border-[#262626]">
                      <span className="text-micro uppercase font-bold text-blue-600 dark:text-blue-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Participate
                      </span>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">{participantCount}</span>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#111] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search event, notes..."
                        value={achvSearch}
                        onChange={e => setAchvSearch(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-3 pr-8 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                      />
                      {achvSearch && (
                        <button
                          onClick={() => setAchvSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-950 dark:hover:text-white text-micro font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div>
                      <select aria-label="Filter by medal or rank"
                        value={achvMedalFilter}
                        onChange={e => setAchvMedalFilter(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="all">All Medals / Ranks</option>
                        <option value="Gold">Gold Medal</option>
                        <option value="Silver">Silver Medal</option>
                        <option value="Bronze">Bronze Medal</option>
                        <option value="Participant">Participation / Ribbon</option>
                      </select>
                    </div>

                    <div>
                      <select aria-label="Filter by year"
                        value={achvYearFilter}
                        onChange={e => setAchvYearFilter(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="all">All Years</option>
                        {uniqueYears.map(yr => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select aria-label="Sort achievements"
                        value={achvSort}
                        onChange={e => setAchvSort(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="medal-desc">Medal: High to Low</option>
                        <option value="medal-asc">Medal: Low to High</option>
                        <option value="name-asc">Event: A to Z</option>
                      </select>
                    </div>
                  </div>

                 <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                   {achievements.length === 0 ? (
                     <p className="p-4 text-xs text-neutral-500 dark:text-neutral-500 text-center italic">{t('panel_no_tournament_achievements')}</p>
                   ) : (() => {
                     const MEDAL_STYLES: Record<string, { badge: string; text: string; icon: string }> = {
                       'Gold': {
                         badge: 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/30 dark:border-amber-500/10 text-amber-600 dark:text-amber-400',
                         text: 'text-amber-600 dark:text-amber-400',
                         icon: 'text-amber-500 animate-pulse'
                       },
                       'Silver': {
                         badge: 'bg-neutral-500/10 dark:bg-neutral-500/5 border-neutral-500/30 dark:border-neutral-500/10 text-neutral-600 dark:text-neutral-400',
                         text: 'text-neutral-600 dark:text-neutral-400',
                         icon: 'text-neutral-400'
                       },
                       'Bronze': {
                         badge: 'bg-orange-500/10 dark:bg-orange-500/5 border-orange-500/30 dark:border-orange-500/10 text-orange-600 dark:text-orange-400',
                         text: 'text-orange-600 dark:text-orange-400',
                         icon: 'text-orange-500'
                       },
                       'Participant': {
                         badge: 'bg-blue-500/10 dark:bg-blue-500/5 border-blue-500/30 dark:border-blue-500/10 text-blue-600 dark:text-blue-400',
                         text: 'text-blue-600 dark:text-blue-400',
                         icon: 'text-blue-500'
                       },
                       'Participation': {
                         badge: 'bg-blue-500/10 dark:bg-blue-500/5 border-blue-500/30 dark:border-blue-500/10 text-blue-600 dark:text-blue-400',
                         text: 'text-blue-600 dark:text-blue-400',
                         icon: 'text-blue-500'
                       }
                     };

                     return achievements.map((a) => {
                       const medalStyle = MEDAL_STYLES[a.medalRank] || MEDAL_STYLES['Participant'];
                       return (
                         <div key={a.id} className="p-4 bg-neutral-50 hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#1A1A1A] transition-colors relative group">
                           {canEdit && (
                              <div className="absolute top-4 right-4 flex gap-1.5 opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingAchievementId(a.id);
                                    setAchvForm({
                                      eventName: a.eventName, eventId: a.eventId ?? null,
                                      date: a.date
                                    });
                                    // Load all events for this student from the same tournament and date
                                    const siblings = state.achievements.filter(x => x.studentId === student.id && x.eventName === a.eventName && x.date === a.date && (x.eventId ?? null) === (a.eventId ?? null));
                                    setAchvEvents(siblings.map(s => ({
                                      id: s.id,
                                      category: s.category,
                                      division: s.division,
                                      medalRank: s.medalRank === 'Participation' ? 'Participant' : s.medalRank,
                                      notes: s.notes || '',
                                      ageDivision: s.ageDivision || 'No Age Requirement',
                                      beltDivision: s.beltDivision || 'No Belt Requirement'
                                    })));
                                    setDeletedAchvIds([]);
                                    setShowAchievementModal(true);
                                  }}
                                  className="min-h-11 min-w-11 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors"
                                  title="Edit Achievement" aria-label="Edit achievement"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirm(t('panel_confirm_delete_achv'), async () => {
                                      try {
                                        await deleteAchievement(a.id);
                                        showNotification("Tournament achievement deleted.", 'success');
                                      } catch (err: any) {
                                        showNotification(err.message || "Failed to delete achievement.", 'error');
                                      }
                                    });
                                  }}
                                  className="min-h-11 min-w-11 flex items-center justify-center text-neutral-400 hover:text-red-500 p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors cursor-pointer"
                                  title="Delete Achievement" aria-label="Delete achievement"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                           <p className="text-sm font-bold text-neutral-900 dark:text-white pr-28 tracking-tight">{a.eventName}</p>
                           <div className="flex flex-wrap items-center gap-2 mt-2 mb-2.5">
                             <span className={cn("px-2 py-0.5 rounded-[8px] text-micro font-black uppercase tracking-widest border flex items-center gap-1 shadow-sm", medalStyle.badge)}>
                               <Trophy className={cn("w-3 h-3", medalStyle.icon)} weight="fill" />
                               <span>
                                 {a.medalRank === 'Gold' ? t('panel_medal_gold') :
                                  a.medalRank === 'Silver' ? t('panel_medal_silver') :
                                  a.medalRank === 'Bronze' ? t('panel_medal_bronze') :
                                  a.medalRank === 'Participant' ? t('panel_medal_participant') :
                                  a.medalRank}
                               </span>
                             </span>
                             <span className="text-micro bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded-[8px] font-bold uppercase tracking-wider font-mono">
                               {a.category === 'Recognized Poomsae' ? t('panel_event_poomsae') :
                                a.category === 'Freestyle Poomsae' ? t('panel_event_freestyle') :
                                a.category === 'Demonstration' ? t('panel_event_demo') :
                                a.category === 'Tricking' ? t('panel_event_tricking') :
                                a.category}
                             </span>
                           </div>
                           <div className="text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-medium">
                             <div className="flex items-center gap-1.5">
                               <span className="text-neutral-400 dark:text-neutral-500 uppercase text-micro font-bold tracking-widest">{t('stu_division')}:</span>
                               <span>
                                  {a.division === 'Male Individual' || a.division === 'Male Division' ? t('panel_div_male_indiv') :
                                   a.division === 'Female Individual' || a.division === 'Female Division' ? t('panel_div_female_indiv') :
                                   a.division === 'Pair' ? t('panel_div_pair') :
                                   a.division === 'Team' ? t('panel_div_team') :
                                   a.division}
                               </span>
                             </div>
                             {a.ageDivision && a.ageDivision !== 'No Age Requirement' && (
                               <div className="flex items-center gap-1.5">
                                 <span className="text-neutral-300 dark:text-[#262626]">•</span>
                                 <span className="text-neutral-400 dark:text-neutral-500 uppercase text-micro font-bold tracking-widest">Age:</span>
                                 <span>{a.ageDivision}</span>
                               </div>
                             )}
                             {a.beltDivision && a.beltDivision !== 'No Belt Requirement' && (
                               <div className="flex items-center gap-1.5">
                                 <span className="text-neutral-300 dark:text-[#262626]">•</span>
                                 <span className="text-neutral-400 dark:text-neutral-500 uppercase text-micro font-bold tracking-widest">Belt:</span>
                                 <span>{a.beltDivision}</span>
                               </div>
                             )}
                           </div>
                           {a.notes && (
                             <div className="mt-2.5 p-3 rounded-[8px] bg-neutral-100/50 dark:bg-[#0F0F0F] border border-neutral-200/50 dark:border-transparent text-xs text-neutral-600 dark:text-neutral-400 italic font-medium leading-relaxed">
                               &quot;{a.notes}&quot;
                             </div>
                           )}
                           <p className="text-micro font-mono text-neutral-400 dark:text-neutral-500 mt-3">{a.date}</p>
                         </div>
                       );
                     });
                   })()}
                 </div>
               </div>
            </div>
          )}</>;
}
