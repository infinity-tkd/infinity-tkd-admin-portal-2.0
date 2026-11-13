'use client';
import {useAttendanceActions} from '@/hooks/use-attendance-actions';
import { dialogMotion } from '@/lib/motion';
import { StudentAttendanceCalendar } from '@/components/StudentAttendanceCalendar';
import React, { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { useAppStore, Student } from '@/lib/store';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Calendar } from '@phosphor-icons/react/dist/csr/Calendar';
import { cn, formatBeltLocalized } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { Portal } from '@/components/Portal';



interface StudentAttendanceDialogProps {
  studentAttendanceRecords: import("@/lib/store").Attendance[];
  state: ReturnType<typeof useAppStore>['state'];
  t: ReturnType<typeof useT>;
  statsStudent: Student;
  showConfirm: (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => void;
  markAttendance: (studentId: string, date: string, status: "Present" | "Absent" | "Late", classId?: number) => Promise<void>;
  setUpdateTrigger: React.Dispatch<React.SetStateAction<number>>;
  presentCount: number;
  lateCount: number;
  calendarBusy: boolean;
  setStatsStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  studentDetailsTab: "calendar" | "insights";
  setStudentDetailsTab: React.Dispatch<React.SetStateAction<"calendar" | "insights">>;
  selectedDate: string;
  filterClass: number | "all";
  canMarkAttendance: boolean;
  can: ReturnType<typeof useAppStore>['can'];
  lang: "en" | "kh" | "zh";
  deleteAttendanceRecord: (id: number, studentId: string) => Promise<void>;
  setCalendarBusy: React.Dispatch<React.SetStateAction<boolean>>;
  absentCount: number;
  totalCount: number;
  updateTrigger: number;
}

export function StudentAttendanceDialog({ studentAttendanceRecords, state, t, statsStudent, showConfirm, markAttendance, setUpdateTrigger, presentCount, lateCount, calendarBusy, setStatsStudentId, studentDetailsTab, setStudentDetailsTab, selectedDate, filterClass, canMarkAttendance, can, lang, deleteAttendanceRecord, setCalendarBusy, absentCount, totalCount, updateTrigger }: StudentAttendanceDialogProps) {
  const attendanceActions=useAttendanceActions();
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,()=>{if(!calendarBusy)setStatsStudentId(null);});
  return <>{(() => {
        const recentRecords = [...studentAttendanceRecords]
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 15)
          .reverse();

        const getFormattedDate = (dateStr: string) => {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr;
          const options: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          };
          const lang = state.language === 'kh' ? 'km-KH' : state.language === 'zh' ? 'zh-CN' : 'en-US';
          return d.toLocaleDateString(lang, options);
        };

        const handleStatusChange = (r: any, newStatus: 'Present' | 'Late' | 'Absent') => {
          if (newStatus === r.status) return;

          const oldLabel = r.status === 'Present' ? t('att_present') : r.status === 'Late' ? t('att_late') : t('att_absent');
          const newLabel = newStatus === 'Present' ? t('att_present') : newStatus === 'Late' ? t('att_late') : t('att_absent');

          let title = 'Update Attendance';
          let message = `Are you sure you want to change ${statsStudent.englishName}'s status on ${r.date} from "${oldLabel}" to "${newLabel}"?`;

          if (state.language === 'kh') {
            title = 'ធ្វើបច្ចុប្បន្នភាពវត្តមាន';
            message = `តើអ្នកពិតជាចង់ផ្លាស់ប្តូរស្ថានភាពវត្តមានរបស់ ${statsStudent.englishName} នៅថ្ងៃ ${r.date} ពី "${oldLabel}" ទៅ "${newLabel}" មែនទេ?`;
          } else if (state.language === 'zh') {
            title = '更新考勤状态';
            message = `您确定要将 ${statsStudent.englishName} 在 ${r.date} 的考勤状态从 "${oldLabel}" 更改为 "${newLabel}" 吗？`;
          }

          showConfirm(
            message,
            async () => {
              if(!await attendanceActions.mark(statsStudent.id, r.date, newStatus, r.classId))setUpdateTrigger(previous=>previous+1);
            },
            title,
            () => {
              // Re-render select key to reset select dropdown visuals
              setUpdateTrigger(prev => prev + 1);
            }
          );
        };

        const currentStreak = (() => {
          const sorted = [...studentAttendanceRecords].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          let streak = 0;
          for (const rec of sorted) {
            if (rec.status === 'Present' || rec.status === 'Late') {
              streak++;
            } else {
              break;
            }
          }
          return streak;
        })();

        const requiredSessions = (() => {
          const lower = (statsStudent.currentBelt || '').toLowerCase();
          if (lower.includes('white')) return 12;
          if (lower.includes('yellow')) return 16;
          if (lower.includes('green')) return 20;
          if (lower.includes('blue')) return 24;
          if (lower.includes('brown')) return 30;
          if (lower.includes('red')) return 36;
          return 40;
        })();
        const accumulatedSessions = presentCount + lateCount;
        const progressPercent = Math.min(Math.round((accumulatedSessions / requiredSessions) * 100), 100);

        return (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="fixed inset-0" onClick={() => {if (!calendarBusy) setStatsStudentId(null);}} />
              <motion.div ref={dialog} {...dialogMotion} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="attendance-student-title" className="relative w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-2xl overflow-hidden max-h-[90dvh] z-10">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F]">
               <div className="flex items-center gap-3">
                 <SafeImage
                   src={statsStudent.profilePicturePath}
                   alt={statsStudent.englishName}
                   containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                   fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-sm">{statsStudent.englishName.charAt(0)}</span>}
                 />
                 <div>
                   <h2 id="attendance-student-title" className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] leading-tight">{statsStudent.englishName}</h2>
                   <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono tracking-widest mt-0.5">{t('att_insights_title')}</p>
                 </div>
               </div>
               <button type="button" aria-label="Close attendance details" disabled={calendarBusy} onClick={() => setStatsStudentId(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40">
                 <X className="w-4 h-4"/>
               </button>
             </div>

             <div role="tablist" aria-label={t('att_insights_title')} className="flex shrink-0 border-b border-neutral-200 px-4 dark:border-neutral-700" onKeyDown={event => {
               if (!calendarBusy && ['ArrowLeft','ArrowRight'].includes(event.key)) {event.preventDefault();const next=studentDetailsTab==='calendar'?'insights':'calendar';setStudentDetailsTab(next);document.getElementById(`attendance-${next}-tab`)?.focus();}
             }}>
               {(['calendar','insights'] as const).map(tab => <button key={tab} type="button" role="tab" id={`attendance-${tab}-tab`} aria-controls={`attendance-${tab}-panel`} aria-selected={studentDetailsTab===tab} tabIndex={studentDetailsTab===tab?0:-1} disabled={calendarBusy} onClick={() => setStudentDetailsTab(tab)} className={cn('min-h-[44px] flex-1 border-b-2 px-2 text-xs font-semibold transition-colors disabled:opacity-40', studentDetailsTab===tab?'border-brand text-brand-ink':'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white')}>{t(tab==='calendar'?'att_calendar':'att_insights_title')}</button>)}
             </div>
             <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 custom-scrollbar">
               <div role="tabpanel" id="attendance-calendar-panel" aria-labelledby="attendance-calendar-tab" hidden={studentDetailsTab!=='calendar'}>
                 <StudentAttendanceCalendar key={statsStudent.id} student={statsStudent} records={studentAttendanceRecords} classes={state.classSessions} enrollments={state.classEnrollments} initialDate={selectedDate} initialClass={filterClass} canMark={canMarkAttendance} canDelete={can('action:attendance_delete')} dataReady={!state.isLoading && !(state.dataLoadIssues || []).some(issue => ['attendance','students','class_sessions','class_enrollments'].includes(issue.dataset))} language={lang} onMark={markAttendance} onDelete={deleteAttendanceRecord} onBusyChange={setCalendarBusy} />
               </div>
               <div role="tabpanel" id="attendance-insights-panel" aria-labelledby="attendance-insights-tab" hidden={studentDetailsTab!=='insights'} className="space-y-4 sm:space-y-6">
               <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                 <div className="bg-white dark:bg-[#141414] border border-emerald-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-emerald-700 dark:text-emerald-400 font-bold mb-0.5 sm:mb-1">{presentCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_present')}</p>
                 </div>
                 <div className="bg-white dark:bg-[#141414] border border-amber-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-amber-700 dark:text-amber-400 font-bold mb-0.5 sm:mb-1">{lateCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_late')}</p>
                 </div>
                 <div className="bg-white dark:bg-[#141414] border border-rose-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-rose-700 dark:text-rose-400 font-bold mb-0.5 sm:mb-1">{absentCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_absent')}</p>
                 </div>
               </div>

               {/* Visual Attendance Progress (Streak, Milestone, History) */}
               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-4 shadow-sm">
                 <div className="flex items-center justify-between">
                   <div>
                     <h4 className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-widest">{t('att_training_progress')}</h4>
                     <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{t('att_active_milestones')}</p>
                   </div>
                   {currentStreak > 0 && (
                     <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[8px] animate-pulse">
                       {t('att_class_streak').replace('{count}', String(currentStreak))}
                     </span>
                   )}
                 </div>

                 {/* Promotion milestone bar */}
                 <div className="space-y-1.5 pt-1">
                   <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                     <span>{t('att_belt_threshold').replace('{belt}', formatBeltLocalized(statsStudent.currentBelt, statsStudent.dob, t))}</span>
                     <span className="font-bold text-neutral-900 dark:text-white">{accumulatedSessions} / {requiredSessions} {t('att_classes_suffix')} ({progressPercent}%)</span>
                   </div>
                   <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2.5 overflow-hidden border border-neutral-200 dark:border-[#262626]/40 shadow-inner">
                     <div
                       className={cn(
                         "h-full rounded-full transition-all duration-300",
                         progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                       )}
                       style={{ width: `${progressPercent}%` }}
                     />
                   </div>
                   {progressPercent >= 100 ? (
                     <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">{t('lms_target_attendance_achieved')}</p>
                   ) : (
                     <p className="text-[9px] text-neutral-600 dark:text-neutral-400">{t('lms_req_more_sessions').replace('{count}', String(requiredSessions - accumulatedSessions))}</p>
                   )}
                 </div>

                 {/* Last 15 Sessions Grid */}
                 <div className="border-t border-neutral-200 dark:border-[#262626]/40 pt-3.5">
                   <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-wider mb-2">{t('att_checkin_history')}</p>
                   <div className="flex flex-wrap gap-1.5">
                     {Array.from({ length: 15 }).map((_, i) => {
                       const rec = recentRecords[i];
                       if (!rec) {
                         return (
                           <div
                             key={i}
                             className="w-6 h-6 rounded-[4px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center text-[9px] font-mono text-neutral-400 dark:text-[#444] select-none"
                             title={t('att_no_training_record')}
                           >
                             -
                           </div>
                         );
                       }
                       return (
                         <div
                           key={i}
                           className={cn(
                             "w-6 h-6 rounded-[4px] flex items-center justify-center text-[9px] font-black uppercase shadow-sm cursor-help transition-all duration-200 hover:scale-110",
                             rec.status === 'Present' ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300" :
                             rec.status === 'Late' ? "bg-amber-500/20 border border-amber-500/50 text-amber-800 dark:text-amber-300" :
                             "bg-rose-500/20 border border-rose-500/50 text-rose-800 dark:text-rose-300"
                           )}
                           title={`${rec.date} - ${rec.status}`}
                         >
                           {rec.status.charAt(0)}
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>

               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm">
                 <h4 className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2 mb-4">{t('att_discipline_metrics')}</h4>
                 <div className="space-y-4">
                   <div>
                     <div className="flex justify-between items-center mb-1">
                       <p className="text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold">{t('att_status')}</p>
                       <p className="text-xs font-mono text-neutral-900 dark:text-white font-bold">{totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0}%</p>
                     </div>
                     <div className="h-2 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalCount > 0 ? ((presentCount + lateCount) / totalCount) * 100 : 0}%` }} />
                     </div>
                   </div>
                 </div>

                 {/* Smart Analyze Box */}
                 <div className="mt-6 p-4 rounded-[8px] bg-rose-500/10 border border-rose-500/20">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400 mb-2">{t('att_smart_analysis')}</p>
                   {totalCount === 0 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4]">{t('att_no_records_to_analyze').replace('{name}', statsStudent.englishName)}</p>
                   ) : ((presentCount + lateCount) / totalCount) > 0.85 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_excellent').replace('{name}', statsStudent.englishName)}
                     </p>
                   ) : ((presentCount + lateCount) / totalCount) > 0.6 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_consistent').replace('{belt}', formatBeltLocalized(statsStudent.currentBelt, statsStudent.dob, t))}
                     </p>
                   ) : (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_risk').replace('{name}', statsStudent.englishName)}
                     </p>
                   )}
                 </div>
               </div>

               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <table className="w-full text-left">
                   <thead className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 tracking-widest">
                     <tr>
                       <th className="px-4 py-3 font-medium">{t('att_date')}</th>
                       <th className="px-4 py-3 font-medium text-right">{t('att_status')}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] text-xs">
                     {studentAttendanceRecords.length === 0 && (
                       <tr>
                         <td colSpan={2} className="px-4 py-8 text-center text-neutral-600 dark:text-neutral-400 font-mono">{t('att_no_records_found')}</td>
                       </tr>
                     )}
                     {studentAttendanceRecords
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(r => (
                          <tr key={r.id || `${r.studentId}-${r.date}`} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A]/30 transition-colors">
                            <td className="px-4 py-3 text-neutral-800 dark:text-[#E4E4E4] font-medium font-sans">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                                <span>{getFormattedDate(r.date)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <select
                                key={`${r.id || r.date}-${r.status}-${updateTrigger}`}
                                value={r.status}
                                disabled={!canMarkAttendance}
                                onChange={(e) => handleStatusChange(r, e.target.value as 'Present' | 'Late' | 'Absent')}
                                className={cn(
                                  "border text-[10px] font-black uppercase tracking-wider rounded-[6px] px-2.5 py-1 focus:outline-none transition-all cursor-pointer font-sans appearance-none text-center pr-6 relative inline-block select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                                  r.status === 'Present' ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" :
                                  r.status === 'Late' ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" :
                                  "border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                                )}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                  backgroundPosition: 'right 0.5rem center',
                                  backgroundSize: '1em',
                                  backgroundRepeat: 'no-repeat'
                                }}
                              >
                                <option value="Present" className="bg-white dark:bg-[#141414] text-emerald-700 dark:text-emerald-400 font-bold">{t('att_present')}</option>
                                <option value="Late" className="bg-white dark:bg-[#141414] text-amber-700 dark:text-amber-400 font-bold">{t('att_late')}</option>
                                <option value="Absent" className="bg-white dark:bg-[#141414] text-rose-700 dark:text-rose-400 font-bold">{t('att_absent')}</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                   </tbody>
                 </table>
               </div>
               </div>
             </div>
          </motion.div>
            </div>
          </Portal>
        );
      })()}</>;
}
