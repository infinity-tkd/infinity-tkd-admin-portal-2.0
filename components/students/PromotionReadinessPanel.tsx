'use client';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Checks } from '@phosphor-icons/react/dist/csr/Checks';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';


interface PromotionReadinessPanelProps {
  setFilterEligibility: React.Dispatch<React.SetStateAction<"Ready" | "Developing" | "Needs Work" | "all">>;
  filterEligibility: "Ready" | "Developing" | "Needs Work" | "all";
  totalReadyCandidates: number;
  totalDevelopingCandidates: number;
  avgPri: number;
  setBeltCenterSubTab: React.Dispatch<React.SetStateAction<"readiness" | "history" | "curriculum">>;
  recentPromotionsCount: number;
  filteredPromoCandidates: { startDate: string; daysElapsed: number; daysRequired: number; daysProgress: number; daysEligible: boolean; attendanceSince: number; attendanceRequired: number; attendanceProgress: number; attendanceEligible: boolean; syllabusCompletedPct: number; syllabusRequiredPct: number; syllabusEligible: boolean; totalVideos: number; completedVideos: number; skillsGradedCount: number; totalSkillsCount: number; physicalAverageScore: number; physicalAverageGradeLabel: "Needs Work" | "Developing" | "Proficient" | "Outstanding" | "Unrated"; physicalEligible: boolean; pri: number; eligibilityStatus: "Ready" | "Developing" | "Needs Work"; rank: "Gold" | "Silver" | "Bronze"; latestPromotion: any | null; student: Student; }[];
  selectedBeltPipelineFilter: string | null;
  promotionSearch: string;
  setPromotionSearch: React.Dispatch<React.SetStateAction<string>>;
  filterBranchPromo: number | "all";
  setFilterBranchPromo: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  t: ReturnType<typeof useT>;
  selectedStudentsForPromotion: string[];
  setShowPromotionModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleSelectAllPromo: (checked: boolean) => void;
  getNextBeltRank: (currentBelt: string) => string;
  handleSelectPromo: (studentId: string, checked: boolean) => void;
  handleOpenSinglePromote: (studentId: string) => void;
  setSelectedStudentForCurriculum: React.Dispatch<React.SetStateAction<string | null>>;
}

export function PromotionReadinessPanel({ setFilterEligibility, filterEligibility, totalReadyCandidates, totalDevelopingCandidates, avgPri, setBeltCenterSubTab, recentPromotionsCount, filteredPromoCandidates, selectedBeltPipelineFilter, promotionSearch, setPromotionSearch, filterBranchPromo, setFilterBranchPromo, state, t, selectedStudentsForPromotion, setShowPromotionModal, handleSelectAllPromo, getNextBeltRank, handleSelectPromo, handleOpenSinglePromote, setSelectedStudentForCurriculum }: PromotionReadinessPanelProps) {
  return <>{(
            <div className="flex flex-col flex-1 gap-3.5 sm:gap-6">
              {/* Tactical Metrics Grid (4 Interactive Cards) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 shrink-0">
                {/* 1. Test-Ready Candidates (Clickable filter) */}
                <button
                  type="button"
                  onClick={() => setFilterEligibility(prev => prev === 'Ready' ? 'all' : 'Ready')}
                  className={cn(
                    "bg-white dark:bg-[#141414] border rounded-[8px] p-2.5 sm:p-4 flex items-center justify-between text-left transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation shadow-xs",
                    filterEligibility === 'Ready'
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-neutral-200 dark:border-[#262626] hover:border-emerald-500/40"
                  )}
                >
                  <div className="space-y-0.5 sm:space-y-1 min-w-0">
                    <p className="text-micro sm:text-micro text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                      <span>Test-Ready</span>
                      {filterEligibility === 'Ready' && <span className="text-micro px-1 py-0.2 bg-emerald-500 text-white rounded font-mono font-black">ACTIVE</span>}
                    </p>
                    <h4 className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                      {totalReadyCandidates}
                      {totalReadyCandidates > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />}
                    </h4>
                    <p className="text-micro text-neutral-400 dark:text-[#666] font-mono truncate hidden sm:block">Eligible for promotion</p>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-emerald-500/10 dark:bg-green-500/10 border border-emerald-500/30 dark:border-green-500/20 flex items-center justify-center text-emerald-700 dark:text-green-400 shrink-0 ml-1">
                    <Checks className="w-3.5 h-3.5 sm:w-5 sm:h-5" weight="bold" />
                  </div>
                </button>

                {/* 2. Developing Candidates (Clickable filter) */}
                <button
                  type="button"
                  onClick={() => setFilterEligibility(prev => prev === 'Developing' ? 'all' : 'Developing')}
                  className={cn(
                    "bg-white dark:bg-[#141414] border rounded-[8px] p-2.5 sm:p-4 flex items-center justify-between text-left transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation shadow-xs",
                    filterEligibility === 'Developing'
                      ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                      : "border-neutral-200 dark:border-[#262626] hover:border-amber-500/40"
                  )}
                >
                  <div className="space-y-0.5 sm:space-y-1 min-w-0">
                    <p className="text-micro sm:text-micro text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                      <span>Developing</span>
                      {filterEligibility === 'Developing' && <span className="text-micro px-1 py-0.2 bg-amber-500 text-black rounded font-mono font-black">ACTIVE</span>}
                    </p>
                    <h4 className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                      {totalDevelopingCandidates}
                    </h4>
                    <p className="text-micro text-neutral-400 dark:text-[#666] font-mono truncate hidden sm:block">In-progress candidates</p>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 ml-1">
                    <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" weight="bold" />
                  </div>
                </button>

                {/* 3. Average PRI Score across active roster */}
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 sm:p-4 flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1 pr-2">
                    <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] font-bold uppercase tracking-wider truncate">Avg Roster PRI</p>
                    <h4 className="text-base sm:text-2xl font-black text-neutral-900 dark:text-white font-mono">{avgPri}%</h4>
                    <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1 sm:h-1.5 rounded-full overflow-hidden mt-1 max-w-[120px]">
                      <div
                        className={cn("h-full rounded-full transition-all", avgPri >= 75 ? "bg-emerald-500" : avgPri >= 50 ? "bg-amber-500" : "bg-neutral-500")}
                        style={{ width: `${avgPri}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5" weight="bold" />
                  </div>
                </div>

                {/* 4. Recent Promotions (30d) (Clickable shortcut to history) */}
                <button
                  type="button"
                  onClick={() => setBeltCenterSubTab('history')}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] hover:border-red-500/40 rounded-[8px] p-2.5 sm:p-4 flex items-center justify-between text-left transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation shadow-xs"
                >
                  <div className="space-y-0.5 sm:space-y-1 min-w-0">
                    <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] font-bold uppercase tracking-wider truncate">Recent Promoted</p>
                    <h4 className="text-base sm:text-2xl font-black text-neutral-900 dark:text-white font-mono">{recentPromotionsCount}</h4>
                    <p className="text-micro text-brand-ink font-mono truncate hidden sm:block">View history ledger →</p>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 ml-1">
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-5 sm:h-5" weight="bold" />
                  </div>
                </button>
              </div>

              {/* Roster Table & Mobile Card Panel */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col flex-1 min-h-[380px] overflow-hidden shadow-xs">
                {/* Toolbar */}
                <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row gap-2.5 sm:gap-4 sm:items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">Promotion Eligibility Directory</h3>
                    <p className="text-micro text-neutral-500 dark:text-[#666] font-mono mt-0.5">
                      Roster: {filteredPromoCandidates.length} matches
                      {selectedBeltPipelineFilter && ` | Rank: ${selectedBeltPipelineFilter}`}
                      {filterEligibility !== 'all' && ` | Status: ${filterEligibility}`}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:justify-end">
                    <div className="relative w-full sm:w-44">
                      <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                      <input
                        type="text"
                        placeholder="Search candidate..."
                        value={promotionSearch}
                        onChange={(e) => setPromotionSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[7px] sm:rounded-[8px] text-micro sm:text-xs h-8.5 sm:h-9 focus:outline-none focus:border-brand placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                      <select aria-label="Filter by branch"
                        value={filterBranchPromo}
                        onChange={(e) => setFilterBranchPromo(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[7px] sm:rounded-[8px] text-micro sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 py-1 sm:py-1.5 h-8.5 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
                      >
                        <option value="all">All Branches</option>
                        {state.branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>

                      <select aria-label="Filter by readiness"
                        value={filterEligibility}
                        onChange={(e) => setFilterEligibility(e.target.value as any)}
                        className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[7px] sm:rounded-[8px] text-micro sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 py-1 sm:py-1.5 h-8.5 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
                      >
                        <option value="all">All Readiness</option>
                        <option value="Ready">{t('dir_ready')}</option>
                        <option value="Developing">{t('dir_developing')}</option>
                        <option value="Needs Work">{t('dir_needs_work')}</option>
                      </select>
                    </div>

                    {selectedStudentsForPromotion.length > 0 && (
                      <button
                        onClick={() => setShowPromotionModal(true)}
                        className="w-full sm:w-auto px-3.5 py-1.5 h-8.5 sm:h-9 bg-brand hover:bg-brand-strong text-white rounded-[7px] sm:rounded-[8px] text-micro sm:text-micro font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-md shadow-brand/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 touch-manipulation animate-in fade-in"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t('dir_promote_selected').replace('{count}', String(selectedStudentsForPromotion.length))}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop & Tablet Matrix Table View (hidden on mobile) */}
                <div className="hidden md:block flex-1 overflow-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-500 dark:text-[#666] uppercase tracking-widest font-bold sticky top-0 z-10 border-b border-neutral-200 dark:border-[#262626]">
                      <tr>
                        <th className="px-4 py-2.5 w-12 text-center">
                          <input
                            type="checkbox"
                            className="accent-brand rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626]"
                            checked={
                              filteredPromoCandidates.length > 0 &&
                              filteredPromoCandidates.filter(c => c.student.studentStatus === 'Active').every(c => selectedStudentsForPromotion.includes(c.student.id))
                            }
                            onChange={(e) => handleSelectAllPromo(e.target.checked)}
                          />
                        </th>
                        <th className="px-4 py-2.5">{t('dir_student_context')}</th>
                        <th className="px-4 py-2.5">Advancement</th>
                        <th className="px-4 py-2.5">Time in Grade</th>
                        <th className="px-4 py-2.5">Attendance</th>
                        <th className="px-4 py-2.5">LMS Syllabus</th>
                        <th className="px-4 py-2.5 text-center">PRI Score</th>
                        <th className="px-4 py-2.5 text-center">{t('dir_tab_readiness').replace(' Directory', '')}</th>
                        <th className="px-4 py-2.5 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#141414]">
                      {filteredPromoCandidates.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-neutral-500 dark:text-[#666] font-mono">
                            {t('dir_no_candidates')}
                          </td>
                        </tr>
                      ) : (
                        filteredPromoCandidates.map((candidate) => {
                          const { student, daysElapsed, daysRequired, daysProgress, attendanceSince, attendanceRequired, attendanceProgress, syllabusCompletedPct, completedVideos, totalVideos, pri, eligibilityStatus } = candidate;
                          const targetBelt = getNextBeltRank(student.currentBelt);
                          const isSelected = selectedStudentsForPromotion.includes(student.id);

                          return (
                            <tr
                              key={student.id}
                              className={cn(
                                "hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer text-neutral-800 dark:text-[#E4E4E4]",
                                isSelected && "bg-red-500/5 dark:bg-brand/5"
                              )}
                              onClick={() => {
                                if (student.studentStatus === 'Active') {
                                  handleSelectPromo(student.id, !isSelected);
                                }
                              }}
                            >
                              <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  disabled={student.studentStatus !== 'Active'}
                                  className="accent-brand rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626] disabled:opacity-30 cursor-pointer"
                                  checked={isSelected}
                                  onChange={(e) => handleSelectPromo(student.id, e.target.checked)}
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <SafeImage
                                    src={student.profilePicturePath}
                                    alt={student.englishName}
                                    containerClassName="w-8 h-8 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                                  />
                                  <div>
                                    <div className="text-neutral-900 dark:text-white font-bold text-xs leading-tight">{student.englishName}</div>
                                    <div className="text-micro text-neutral-500 dark:text-[#666] font-mono leading-tight mt-0.5">
                                      {student.id} • {state.branches.find(b => b.id === student.homeBranchId)?.name || 'Branch'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("px-2 py-0.5 rounded text-micro font-bold border tracking-wider uppercase", student.currentBelt.toLowerCase().includes('poom') || student.currentBelt.toLowerCase().includes('dan') || student.currentBelt.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : student.currentBelt === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : student.currentBelt === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : student.currentBelt === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : student.currentBelt === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : student.currentBelt === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
                                    {student.currentBelt}
                                  </span>
                                  <CaretRight className="w-3 h-3 text-neutral-400 dark:text-[#666]" />
                                  <span className="px-2 py-0.5 rounded text-micro font-bold border tracking-wider uppercase bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-mono">
                                    {targetBelt}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {/* Time in Grade bar */}
                                <div className="space-y-1 w-28">
                                  <div className="flex justify-between text-micro text-neutral-500 dark:text-neutral-400 font-mono leading-none">
                                    <span>{daysElapsed}/{daysRequired}d</span>
                                    <span className="font-bold">{daysProgress}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-200 dark:bg-[#0F0F0F] h-1.5 rounded-full overflow-hidden border border-neutral-300 dark:border-[#262626]">
                                    <div
                                      className={cn("h-full rounded-full transition-all", daysElapsed >= daysRequired ? "bg-emerald-500" : "bg-neutral-500 dark:bg-neutral-600")}
                                      style={{ width: `${Math.min(100, daysProgress)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {/* Attendance progress bar */}
                                <div className="space-y-1 w-28">
                                  <div className="flex justify-between text-micro text-neutral-500 dark:text-neutral-400 font-mono leading-none">
                                    <span>{attendanceSince}/{attendanceRequired} cl</span>
                                    <span className="font-bold">{attendanceProgress}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-200 dark:bg-[#0F0F0F] h-1.5 rounded-full overflow-hidden border border-neutral-300 dark:border-[#262626]">
                                    <div
                                      className={cn("h-full rounded-full transition-all", attendanceSince >= attendanceRequired ? "bg-emerald-500" : "bg-neutral-500 dark:bg-neutral-600")}
                                      style={{ width: `${Math.min(100, attendanceProgress)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {/* LMS syllabus bar */}
                                <div className="space-y-1 w-28">
                                  <div className="flex justify-between text-micro text-neutral-500 dark:text-neutral-400 font-mono leading-none">
                                    <span>{completedVideos}/{totalVideos} vids</span>
                                    <span className="font-bold">{syllabusCompletedPct}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-200 dark:bg-[#0F0F0F] h-1.5 rounded-full overflow-hidden border border-neutral-300 dark:border-[#262626]">
                                    <div
                                      className={cn("h-full rounded-full transition-all", syllabusCompletedPct === 100 ? "bg-emerald-500" : "bg-indigo-500")}
                                      style={{ width: `${syllabusCompletedPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-micro font-mono font-bold border",
                                  pri >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                                  pri >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                                  "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                                )}>
                                  {pri}% PRI
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn(
                                  "inline-block px-2.5 py-0.5 rounded text-micro font-black uppercase tracking-wider border",
                                  eligibilityStatus === 'Ready' ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" :
                                  eligibilityStatus === 'Developing' ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/20" :
                                  "bg-neutral-200 dark:bg-neutral-500/10 text-neutral-600 dark:text-[#666] border-neutral-300 dark:border-transparent"
                                )}>
                                  {eligibilityStatus === 'Ready' ? t('dir_ready') : eligibilityStatus === 'Developing' ? t('dir_developing') : eligibilityStatus === 'Needs Work' ? t('dir_needs_work') : t('dir_ungraded')}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSinglePromote(student.id)}
                                    disabled={student.studentStatus !== 'Active'}
                                    className="px-2 py-1 rounded bg-brand hover:bg-brand-strong disabled:opacity-40 text-white font-bold text-micro uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation shadow-xs"
                                    title="Promote Candidate"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Promote</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedStudentForCurriculum(student.id);
                                      setBeltCenterSubTab('curriculum');
                                    }}
                                    className="p-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                                    title="View Curriculum Audit"
                                  >
                                    <Trophy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Native Candidate Cards (hidden on desktop/tablet) */}
                <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626] overflow-y-auto">
                  {filteredPromoCandidates.length === 0 ? (
                    <div className="py-10 text-center text-neutral-500 dark:text-[#666] font-mono text-xs">
                      {t('dir_no_candidates')}
                    </div>
                  ) : (
                    filteredPromoCandidates.map((candidate) => {
                      const { student, daysElapsed, daysRequired, daysProgress, attendanceSince, attendanceRequired, attendanceProgress, syllabusCompletedPct, skillsGradedCount, totalSkillsCount, pri, eligibilityStatus } = candidate;
                      const targetBelt = getNextBeltRank(student.currentBelt);
                      const isSelected = selectedStudentsForPromotion.includes(student.id);

                      return (
                        <div
                          key={student.id}
                          className={cn(
                            "p-3.5 space-y-3 transition-colors",
                            isSelected ? "bg-red-500/5 dark:bg-brand/5" : "bg-white dark:bg-[#141414]"
                          )}
                        >
                          {/* Card Top Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                disabled={student.studentStatus !== 'Active'}
                                className="accent-brand rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626] w-4 h-4 shrink-0 cursor-pointer"
                                checked={isSelected}
                                onChange={(e) => handleSelectPromo(student.id, e.target.checked)}
                              />
                              <SafeImage
                                src={student.profilePicturePath}
                                alt={student.englishName}
                                containerClassName="w-8 h-8 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-neutral-900 dark:text-white font-bold text-xs truncate">
                                  {student.englishName}
                                </div>
                                <div className="text-micro text-neutral-500 dark:text-[#666] font-mono truncate">
                                  {student.id} • {state.branches.find(b => b.id === student.homeBranchId)?.name || 'Branch'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-micro font-mono font-bold border",
                                pri >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                                pri >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                                "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                              )}>
                                {pri}% PRI
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-micro font-black uppercase tracking-wider border",
                                eligibilityStatus === 'Ready' ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" :
                                eligibilityStatus === 'Developing' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                                "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-[#777] border-neutral-200 dark:border-[#262626]"
                              )}>
                                {eligibilityStatus}
                              </span>
                            </div>
                          </div>

                          {/* Belt Advancement Row */}
                          <div className="flex items-center justify-between p-2 rounded-[6px] bg-neutral-50 dark:bg-[#0D0D0D] border border-neutral-200/60 dark:border-[#202020] text-xs">
                            <span className="text-micro font-bold text-neutral-500 dark:text-[#777] uppercase tracking-wider">Advancement</span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-micro font-bold border uppercase tracking-wider bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white">
                                {student.currentBelt}
                              </span>
                              <CaretRight className="w-3.5 h-3.5 text-neutral-400 dark:text-[#666]" />
                              <span className="px-2 py-0.5 rounded text-micro font-bold border uppercase tracking-wider bg-red-500/10 dark:bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400 font-mono">
                                {targetBelt}
                              </span>
                            </div>
                          </div>

                          {/* 4-Vector Mini Progress Grid */}
                          <div className="grid grid-cols-2 gap-2 text-micro font-mono">
                            {/* Days */}
                            <div className="p-2 rounded bg-neutral-50 dark:bg-[#0D0D0D] border border-neutral-200/60 dark:border-[#202020] space-y-1">
                              <div className="flex justify-between text-neutral-500 dark:text-[#777]">
                                <span>Days:</span>
                                <span className="font-bold text-neutral-900 dark:text-white">{daysElapsed}/{daysRequired}d</span>
                              </div>
                              <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", daysElapsed >= daysRequired ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600")}
                                  style={{ width: `${Math.min(100, daysProgress)}%` }}
                                />
                              </div>
                            </div>

                            {/* Attendance */}
                            <div className="p-2 rounded bg-neutral-50 dark:bg-[#0D0D0D] border border-neutral-200/60 dark:border-[#202020] space-y-1">
                              <div className="flex justify-between text-neutral-500 dark:text-[#777]">
                                <span>Classes:</span>
                                <span className="font-bold text-neutral-900 dark:text-white">{attendanceSince}/{attendanceRequired}</span>
                              </div>
                              <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", attendanceSince >= attendanceRequired ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600")}
                                  style={{ width: `${Math.min(100, attendanceProgress)}%` }}
                                />
                              </div>
                            </div>

                            {/* Syllabus */}
                            <div className="p-2 rounded bg-neutral-50 dark:bg-[#0D0D0D] border border-neutral-200/60 dark:border-[#202020] space-y-1">
                              <div className="flex justify-between text-neutral-500 dark:text-[#777]">
                                <span>Syllabus:</span>
                                <span className="font-bold text-neutral-900 dark:text-white">{syllabusCompletedPct}%</span>
                              </div>
                              <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", syllabusCompletedPct === 100 ? "bg-emerald-500" : "bg-indigo-500")}
                                  style={{ width: `${syllabusCompletedPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Skills */}
                            <div className="p-2 rounded bg-neutral-50 dark:bg-[#0D0D0D] border border-neutral-200/60 dark:border-[#202020] space-y-1">
                              <div className="flex justify-between text-neutral-500 dark:text-[#777]">
                                <span>Skills:</span>
                                <span className="font-bold text-neutral-900 dark:text-white">{skillsGradedCount}/{totalSkillsCount}</span>
                              </div>
                              <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", skillsGradedCount === totalSkillsCount && totalSkillsCount > 0 ? "bg-emerald-500" : "bg-amber-500")}
                                  style={{ width: `${totalSkillsCount > 0 ? Math.min(100, (skillsGradedCount / totalSkillsCount) * 100) : 100}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action Row */}
                          <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60 dark:border-[#202020]">
                            <button
                              type="button"
                              onClick={() => handleOpenSinglePromote(student.id)}
                              disabled={student.studentStatus !== 'Active'}
                              className="flex-1 h-8 sm:h-8.5 bg-brand hover:bg-brand-strong disabled:opacity-40 text-white rounded-[6px] text-micro sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer shadow-xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Promote</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentForCurriculum(student.id);
                                setBeltCenterSubTab('curriculum');
                              }}
                              className="px-3 h-8 sm:h-8.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#AAA] rounded-[6px] text-micro sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              <span>Audit</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}</>;
}
