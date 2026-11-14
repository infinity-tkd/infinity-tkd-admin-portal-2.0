'use client';
import { pressable } from '@/components/ui/pressable';
import React from 'react';
import { Student } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { PhoneCall } from '@phosphor-icons/react/dist/csr/PhoneCall';
import { Flame } from '@phosphor-icons/react/dist/csr/Flame';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { cn, formatBeltLocalized } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import type { Attendance, Branch, ClassSession } from '@/lib/store';


interface AttendanceAnalyticsPanelProps {
  t: ReturnType<typeof useT>;
  academyAttendanceRate: number;
  studentAttendanceRates: { student: Student; rate: number | null; attendedCount: number; absentCount: number; totalSessions: number; requiredSessions: number; progressPercent: number; streak: number; isReadyForPromotion: boolean; nextBelt: string; records: Attendance[]; }[];
  totalRecordsCount: number;
  discipline: { status: string; color: string; iconColor: string; };
  branchAnalytics: { branch: Branch; studentCount: number; attendanceRate: number; totalSessions: number; }[];
  classAnalytics: { cls: ClassSession; branchName: string; enrolledCount: number; utilizationRate: number; attendanceRate: number; }[];
  beltAnalytics: { belt: string; studentCount: number; attendanceRate: number; totalSessions: number; }[];
  atRiskStudents: { student: Student; rate: number | null; attendedCount: number; absentCount: number; totalSessions: number; requiredSessions: number; progressPercent: number; streak: number; isReadyForPromotion: boolean; nextBelt: string; records: Attendance[]; }[];
  setStatsStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  readyStudents: { student: Student; rate: number | null; attendedCount: number; absentCount: number; totalSessions: number; requiredSessions: number; progressPercent: number; streak: number; isReadyForPromotion: boolean; nextBelt: string; records: Attendance[]; }[];
  progressSearch: string;
  setProgressSearch: React.Dispatch<React.SetStateAction<string>>;
  progressBeltFilter: string;
  setProgressBeltFilter: React.Dispatch<React.SetStateAction<string>>;
  beltTiers: string[];
  progressStatusFilter: "all" | "ready" | "progress" | "risk";
  setProgressStatusFilter: React.Dispatch<React.SetStateAction<"all" | "ready" | "progress" | "risk">>;
  filteredStudentProgress: { student: Student; rate: number | null; attendedCount: number; absentCount: number; totalSessions: number; requiredSessions: number; progressPercent: number; streak: number; isReadyForPromotion: boolean; nextBelt: string; records: Attendance[]; }[];
}

export function AttendanceAnalyticsPanel({ t, academyAttendanceRate, studentAttendanceRates, totalRecordsCount, discipline, branchAnalytics, classAnalytics, beltAnalytics, atRiskStudents, setStatsStudentId, readyStudents, progressSearch, setProgressSearch, progressBeltFilter, setProgressBeltFilter, beltTiers, progressStatusFilter, setProgressStatusFilter, filteredStudentProgress }: AttendanceAnalyticsPanelProps) {
  return <>{(
        <div className="space-y-6">
          {/* Overall Stats Grid (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_status')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{academyAttendanceRate}%</h2>
               <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full mt-2.5 sm:mt-3 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${academyAttendanceRate}%` }} />
               </div>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_perfect_attendance')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-amber-600 dark:text-amber-400 font-bold">
                 {studentAttendanceRates.filter(sar => sar.rate === 100 && sar.totalSessions >= 3).length}
               </h2>
               <p className="text-micro text-neutral-500 dark:text-[#888] mt-1.5 sm:mt-2 font-mono uppercase tracking-tight truncate">{t('att_min_3_sessions')}</p>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_total_classes')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-indigo-600 dark:text-indigo-400 font-bold">{totalRecordsCount}</h2>
               <p className="text-micro text-neutral-500 dark:text-[#888] mt-1.5 sm:mt-2 font-mono uppercase tracking-tight truncate">{t('att_lifetime_records')}</p>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
                <p className="text-micro sm:text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_discipline_status')}</p>
                <h2 className={cn("text-lg sm:text-xl font-mono font-bold flex items-center gap-1.5 mt-0.5 truncate", discipline.color)}>
                  <Trophy className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0", discipline.iconColor)}/>
                  <span className="truncate">{discipline.status}</span>
                </h2>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Branch and Class breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Branch Statistics */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                     <UsersThree className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/>
                     {t('att_branch_presence')}
                   </h3>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {branchAnalytics.map(ba => (
                    <div key={ba.branch.id} className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                      <div>
                         <p className="text-xs font-bold text-neutral-900 dark:text-[#E4E4E4]">{ba.branch.name}</p>
                         <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{ba.studentCount} {t('nav_students')} • {ba.totalSessions} {t('att_sessions_suffix')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-right">
                            <span className="text-xs font-mono text-neutral-900 dark:text-white font-bold">{ba.attendanceRate}%</span>
                            <p className="text-micro text-neutral-600 dark:text-neutral-400 uppercase font-bold">{t('nav_attendance')}</p>
                         </div>
                         <div className="w-16 h-1.5 bg-neutral-100 dark:bg-[#0F0F0F] rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                           <div className="h-full bg-brand" style={{ width: `${ba.attendanceRate}%` }} />
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Schedule Attendance Utilizations */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                     <CalendarCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/>
                     {t('att_scheduled_class_utilization')}
                   </h3>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs whitespace-nowrap">
                     <thead className="bg-neutral-50 dark:bg-[#0F0F0F] sticky top-0 z-10 text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                       <tr>
                         <th className="px-4 py-3">{t('att_scheduled_cohort')}</th>
                         <th className="px-4 py-3">{t('att_location')}</th>
                         <th className="px-4 py-3 text-center">{t('att_enrollment_rate')}</th>
                         <th className="px-4 py-3 text-right">{t('att_avg_attendance')}</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                       {classAnalytics.map(ca => (
                         <tr key={ca.cls.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]">
                           <td className="px-4 py-3">
                             <div className="font-bold text-neutral-900 dark:text-white">{ca.cls.name}</div>
                             <div className="text-micro text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{ca.cls.dayOfWeek} {ca.cls.startTime}-{ca.cls.endTime}</div>
                           </td>
                           <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">{ca.branchName}</td>
                           <td className="px-4 py-3 text-center font-mono">
                             <span className={cn(ca.utilizationRate >= 90 ? 'text-rose-700 dark:text-rose-400 font-bold' : ca.utilizationRate >= 70 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-600 dark:text-neutral-400')}>
                               {ca.enrolledCount} / {ca.cls.capacity} ({ca.utilizationRate}%)
                             </span>
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">{ca.attendanceRate}%</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>

            {/* Right: Belt analysis and Actionable Lists */}
            <div className="space-y-6">
              {/* Belt Rank Analysis */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2">{t('att_presence_by_belt')}</h3>
                 <div className="space-y-3">
                   {beltAnalytics.map(ba => {
                      if (ba.studentCount === 0) return null;
                      return (
                        <div key={ba.belt} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-8 h-2.5 rounded-[3px] shadow-sm relative overflow-hidden flex items-center justify-center shrink-0 border border-black/30",
                              ba.belt === 'White' ? 'bg-white' :
                              ba.belt === 'Yellow' ? 'bg-yellow-400' :
                              ba.belt === 'Green' ? 'bg-emerald-600' :
                              ba.belt === 'Blue' ? 'bg-blue-600' :
                              ba.belt === 'Brown' ? 'bg-amber-900' :
                              ba.belt === 'Red' ? 'bg-red-600' :
                              ba.belt === 'Poom' ? 'bg-gradient-to-b from-red-600 to-neutral-900' : 'bg-neutral-950 border border-neutral-800'
                            )}>
                              {ba.belt === 'Poom' && (
                                <div className="absolute inset-y-0.5 left-0 right-0 h-1/2 bg-red-600" />
                              )}
                              {ba.belt === 'Dan' && (
                                <div className="absolute inset-y-0.5 left-0 right-0 h-0.5 bg-yellow-500/80" />
                              )}
                            </span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{ba.belt} {t('stu_belt')}</span>
                            <span className="text-micro text-neutral-600 dark:text-neutral-400 font-mono">({ba.studentCount})</span>
                          </div>
                          <span className="font-mono text-neutral-900 dark:text-white font-bold">{ba.attendanceRate}%</span>
                        </div>
                      );
                    })}
                 </div>
              </div>

              {/* Actionable: At-Risk Students */}
              <div className="bg-white dark:bg-[#141414] border border-rose-500/30 rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400 border-b border-rose-500/20 pb-2 flex items-center gap-1.5">
                   <Warning className="w-4 h-4"/>
                   {t('att_at_risk_cohort')}
                 </h3>
                 <div className="space-y-3 max-h-[250px] overflow-y-auto divide-y divide-neutral-200 dark:divide-[#262626]/40">
                   {atRiskStudents.length === 0 ? (
                     <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono text-center py-4">{t('att_no_at_risk_students')}</p>
                   ) : atRiskStudents.map(ar => (
                     <div key={ar.student.id} className="pt-2 flex justify-between items-start text-xs group cursor-pointer" onClick={() => setStatsStudentId(ar.student.id)}>
                       <div className="flex items-center gap-2">
                         <SafeImage
                           src={ar.student.profilePicturePath}
                           alt={ar.student.englishName}
                           containerClassName="w-8 h-8 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-brand transition-colors"
                           fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{ar.student.englishName.charAt(0)}</span>}
                         />
                         <div>
                           <p className="font-bold text-neutral-900 dark:text-[#E4E4E4] group-hover:text-brand-ink dark:group-hover:text-white transition-colors">{ar.student.englishName}</p>
                           <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono">{ar.student.id} • {formatBeltLocalized(ar.student.currentBelt, ar.student.dob, t)}</p>
                           {ar.student.emergencyContactPhone && (
                             <a href={`tel:${ar.student.emergencyContactPhone}`} onClick={(e) => e.stopPropagation()} className="text-micro text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 mt-1">
                               <PhoneCall className="w-3 h-3"/> {t('stu_emergency_contact')}: {ar.student.emergencyContactPhone}
                             </a>
                           )}
                         </div>
                       </div>
                       <span className="font-mono text-rose-700 dark:text-rose-300 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-[8px]">{ar.rate}%</span>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Actionable: Excellent Attendance */}
              <div className="bg-white dark:bg-[#141414] border border-emerald-500/30 rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20 pb-2 flex items-center gap-1.5">
                   <Sparkle className="w-4 h-4 text-amber-600 dark:text-amber-400" weight="fill"/>
                   {t('att_exam_candidates')}
                 </h3>
                 <div className="space-y-3 max-h-[250px] overflow-y-auto divide-y divide-neutral-200 dark:divide-[#262626]/40">
                   {readyStudents.length === 0 ? (
                     <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono text-center py-4">{t('att_no_exam_candidates')}</p>
                   ) : readyStudents.map(rd => (
                     <div key={rd.student.id} className="pt-2 flex justify-between items-center text-xs group cursor-pointer" {...pressable(() => setStatsStudentId(rd.student.id))}>
                       <div className="flex items-center gap-2">
                         <SafeImage
                           src={rd.student.profilePicturePath}
                           alt={rd.student.englishName}
                           containerClassName="w-8 h-8 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-emerald-500 transition-colors"
                           fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{rd.student.englishName.charAt(0)}</span>}
                         />
                         <div>
                           <p className="font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-white transition-colors">{rd.student.englishName}</p>
                           <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono">{rd.student.id} • {formatBeltLocalized(rd.student.currentBelt, rd.student.dob, t)}</p>
                         </div>
                       </div>
                       <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[8px]">{rd.rate}%</span>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>

          {/* Detailed Student Progress & Belt Promotion Leaderboard */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm space-y-0">
            {/* Header & Quick KPI Badges */}
            <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('lms_student_progress')} — Belt Promotion Tracker
                </h3>
                <p className="text-micro text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">
                  Track training volume, belt qualification requirements, and attendance streaks
                </p>
              </div>

              {/* Fast Stats Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-[6px] bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-micro font-mono font-bold">
                  {studentAttendanceRates.length} Active Students
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-micro font-mono font-bold flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {studentAttendanceRates.filter(s => s.isReadyForPromotion).length} Ready for Exam
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-micro font-mono font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" weight="fill" />
                  {studentAttendanceRates.filter(s => s.streak >= 3).length} Streaks (3+)
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-micro font-mono font-bold flex items-center gap-1">
                  <Warning className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  {studentAttendanceRates.filter(s => s.rate !== null && s.rate < 75).length} At-Risk
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by student name or ID..."
                  value={progressSearch}
                  onChange={(e) => setProgressSearch(e.target.value)}
                  className="w-full pl-9 pr-8 h-9 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-neutral-100 rounded-[6px] text-xs focus:outline-none focus:border-brand placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {progressSearch && (
                  <button aria-label="Clear search"
                    onClick={() => setProgressSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white min-h-6 min-w-6 inline-flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select aria-label="Filter by belt rank"
                value={progressBeltFilter}
                onChange={(e) => setProgressBeltFilter(e.target.value)}
                className="w-full h-9 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Belt Ranks</option>
                {beltTiers.map(tier => (
                  <option key={tier} value={tier}>{tier} Belt</option>
                ))}
              </select>

              <select aria-label="Filter by promotion status"
                value={progressStatusFilter}
                onChange={(e) => setProgressStatusFilter(e.target.value as any)}
                className="w-full h-9 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Promotion Statuses</option>
                <option value="ready">🎓 Ready for Exam</option>
                <option value="progress">⚡ In Progress</option>
                <option value="risk">⚠️ At-Risk (&lt; 75%)</option>
              </select>
            </div>

            {/* Desktop / Tablet Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-bold text-micro">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Current Belt</th>
                    <th className="px-4 py-3">Target Belt</th>
                    <th className="px-4 py-3 min-w-[200px]">Promotion Readiness</th>
                    <th className="px-4 py-3 text-center">Discipline</th>
                    <th className="px-4 py-3 text-center">Streak</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredStudentProgress.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                        <p className="text-xs font-bold uppercase tracking-wider mb-1">No students match current filters</p>
                        <button
                          onClick={() => {
                            setProgressSearch('');
                            setProgressBeltFilter('all');
                            setProgressStatusFilter('all');
                          }}
                          className="text-micro text-rose-600 dark:text-rose-400 hover:underline cursor-pointer mt-1"
                        >
                          Clear Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredStudentProgress.map(st => (
                      <tr
                        key={st.student.id}
                        className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer group"
                        onClick={() => setStatsStudentId(st.student.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <SafeImage
                              src={st.student.profilePicturePath}
                              alt={st.student.englishName}
                              containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden shrink-0 group-hover:border-brand transition-colors"
                              fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{st.student.englishName.charAt(0)}</span>}
                            />
                            <div>
                              <div className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-ink dark:group-hover:text-white transition-colors">
                                {st.student.englishName}
                                {st.student.khmerName && (
                                  <span className="text-micro font-khmer text-neutral-500 dark:text-neutral-400 font-normal ml-1.5">
                                    {st.student.khmerName}
                                  </span>
                                )}
                              </div>
                              <div className="text-micro text-neutral-500 dark:text-neutral-400 font-mono">
                                {st.student.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">
                            {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 font-medium">
                            <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{st.nextBelt}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-micro font-mono">
                              <span className="text-neutral-600 dark:text-neutral-400">
                                {st.attendedCount} / {st.requiredSessions} sessions
                              </span>
                              <span className={cn(
                                "font-bold",
                                st.progressPercent >= 100
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {st.progressPercent}%
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  st.progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600 dark:bg-indigo-500"
                                )}
                                style={{ width: `${Math.min(st.progressPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "font-mono font-bold px-2 py-0.5 rounded-[4px] text-micro",
                            st.rate === null ? "text-neutral-400" :
                            st.rate >= 85 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20" :
                            st.rate >= 70 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20" :
                            "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20"
                          )}>
                            {st.rate !== null ? `${st.rate}%` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {st.streak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[4px] text-micro">
                              <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" weight="fill" />
                              {st.streak}
                            </span>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st.isReadyForPromotion ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-micro uppercase tracking-wider">
                              <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Exam Ready
                            </span>
                          ) : st.rate !== null && st.rate < 75 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-bold text-micro uppercase tracking-wider">
                              <Warning className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              At Risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-micro uppercase tracking-wider">
                              In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setStatsStudentId(st.student.id)}
                            className="px-2.5 py-1 text-micro font-bold uppercase tracking-wider rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#333] transition-colors cursor-pointer"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Native Mobile Card List (block md:hidden) */}
            <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626]">
              {filteredStudentProgress.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1">No students match current filters</p>
                  <button
                    onClick={() => {
                      setProgressSearch('');
                      setProgressBeltFilter('all');
                      setProgressStatusFilter('all');
                    }}
                    className="text-micro text-rose-600 dark:text-rose-400 hover:underline cursor-pointer mt-1"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredStudentProgress.map(st => (
                  <div
                    key={st.student.id}
                    onClick={() => setStatsStudentId(st.student.id)}
                    className="p-3.5 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer flex flex-col gap-2.5 active:bg-neutral-100 dark:active:bg-[#202020]"
                  >
                    {/* Top Row: Avatar, Student Info, Readiness Tag */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeImage
                          src={st.student.profilePicturePath}
                          alt={st.student.englishName}
                          containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden shrink-0"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{st.student.englishName.charAt(0)}</span>}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                            {st.student.englishName}
                            {st.student.khmerName && (
                              <span className="text-micro font-khmer text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                                {st.student.khmerName}
                              </span>
                            )}
                          </div>
                          <div className="text-micro text-neutral-500 dark:text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{st.student.id}</span>
                            <span>•</span>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                              {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="shrink-0">
                        {st.isReadyForPromotion ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-micro uppercase tracking-wider">
                            <GraduationCap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Exam Ready
                          </span>
                        ) : st.rate !== null && st.rate < 75 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-bold text-micro uppercase tracking-wider">
                            <Warning className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-micro uppercase tracking-wider">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Belt Progression Route */}
                    <div className="flex items-center justify-between text-micro bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 font-medium">
                      <span className="text-neutral-700 dark:text-neutral-300 font-bold">
                        {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 mx-2" />
                      <span className="text-neutral-900 dark:text-white font-bold">
                        {st.nextBelt}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-micro font-mono">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {st.attendedCount} / {st.requiredSessions} sessions
                        </span>
                        <span className={cn(
                          "font-bold",
                          st.progressPercent >= 100
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-neutral-800 dark:text-neutral-200"
                        )}>
                          {st.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            st.progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600 dark:bg-indigo-500"
                          )}
                          style={{ width: `${Math.min(st.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom Metadata & History Action Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-[#1F1F1F]">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono font-bold px-2 py-0.5 rounded-[4px] text-micro",
                          st.rate === null ? "text-neutral-400" :
                          st.rate >= 85 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20" :
                          st.rate >= 70 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20" :
                          "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20"
                        )}>
                          Rate: {st.rate !== null ? `${st.rate}%` : 'N/A'}
                        </span>
                        {st.streak > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[4px] text-micro font-mono">
                            <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" weight="fill" />
                            {st.streak} streak
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatsStudentId(st.student.id);
                        }}
                        className="px-3 py-1.5 text-micro font-bold uppercase tracking-wider rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#333] transition-colors cursor-pointer active:scale-95 touch-manipulation min-h-[32px] flex items-center gap-1 pointer-coarse:min-h-11"
                      >
                        History
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}</>;
}
