'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, ClassCategory } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, MapPin, Calendar, Clock, PencilSimple, Trash, 
  Users, WarningCircle, Check, X, ShieldWarning, MagnifyingGlass, ChartLine,
  CalendarCheck, CopySimple, CheckSquare, ArrowsDownUp, Funnel, UserPlus
} from '@phosphor-icons/react';
import { cn, formatBelt } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORIES: ClassCategory[] = ['General Class', 'Kid Class', 'Private Class', 'Elite Team'];

const getShortDayKey = (dayName: string) => {
  const d = dayName.toLowerCase().substring(0, 3);
  if (d === 'mon') return 'day_short_mon';
  if (d === 'tue') return 'day_short_tue';
  if (d === 'wed') return 'day_short_wed';
  if (d === 'thu') return 'day_short_thu';
  if (d === 'fri') return 'day_short_fri';
  if (d === 'sat') return 'day_short_sat';
  return 'day_short_sun';
};

const formatCategoryLocalized = (cat: string, t: any) => {
  if (cat === 'General Class') return t('cat_general_class');
  if (cat === 'Kid Class') return t('cat_kid_class');
  if (cat === 'Private Class') return t('cat_private_class');
  if (cat === 'Elite Team') return t('cat_elite_team');
  return cat;
};

export const CLASS_STYLES: Record<ClassCategory, { bg: string; text: string; border: string; accent: string }> = {
  'Private Class': {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/20',
    accent: 'border-amber-500 dark:border-amber-500'
  },
  'Kid Class': {
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    text: 'text-sky-800 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-500/20',
    accent: 'border-sky-500 dark:border-sky-500'
  },
  'General Class': {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-800 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    accent: 'border-emerald-500 dark:border-emerald-500'
  },
  'Elite Team': {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-800 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    accent: 'border-[#EF2F38] dark:border-[#EF2F38]'
  }
};

export function ScheduleView() {
  const { state, addBranch, addClassSession, updateClassSession, deleteClassSession, showConfirm, showNotification } = useAppStore();
  const t = useT();
  const role = state.currentUser?.role;
  const isAdminOrHead = role === 'Root' || role === 'Super Root' || role === 'Admin' || role === 'Head Coach';

  const [activeBranchId, setActiveBranchId] = useState<number>(state.branches[0]?.id || 0);
  const [showClassModal, setShowClassModal] = useState<number | 'new' | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState<number | null>(null);
  const [enrollModalTab, setEnrollModalTab] = useState<'unenrolled' | 'enrolled'>('unenrolled');
  const [activeTab, setActiveTab] = useState<'matrix' | 'capacity'>('matrix');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('All');
  const [capacityStatusFilter, setCapacityStatusFilter] = useState<'All' | 'Overcrowded' | 'Optimal' | 'Low'>('All');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-select initial branch once branches load from server
  useEffect(() => {
    if ((activeBranchId === 0 || !state.branches.some(b => b.id === activeBranchId)) && state.branches.length > 0) {
      setActiveBranchId(state.branches[0].id);
    }
  }, [state.branches, activeBranchId]);

  const [classForm, setClassForm] = useState({
    name: '',
    classType: 'General Class' as ClassCategory,
    daysOfWeek: ['Monday'] as string[],
    startTime: '17:00',
    endTime: '18:30',
    capacity: 30,
    coachId: ''
  });

  const [newBranchName, setNewBranchName] = useState('');
  const [showBranchInput, setShowBranchInput] = useState(false);

  const coaches = useMemo(() => 
    state.users.filter(u => u.role === 'Coach' || u.role === 'Head Coach' || u.role === 'Assistant Coach' || u.role === 'Root'),
    [state.users]
  );

  const calculateDuration = (start: string, end: string) => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (isNaN(diffMins) || diffMins <= 0) return '90m';
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hrs > 0 ? `${hrs}h ` : ''}${mins > 0 ? `${mins}m` : ''}`;
    } catch {
      return '90m';
    }
  };

  const calculateDurationMins = (start: string, end: string) => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      return isNaN(diffMins) || diffMins <= 0 ? 90 : diffMins;
    } catch {
      return 90;
    }
  };

  const handleSaveClass = async () => {
    if (!classForm.name.trim()) {
      showNotification(t('sch_session_name') + ' is required', 'error');
      return;
    }
    if (classForm.daysOfWeek.length === 0) {
      showNotification('Please select at least one recurrence day.', 'error');
      return;
    }
    if (Number(classForm.capacity) <= 0) {
      showNotification('Capacity must be at least 1.', 'error');
      return;
    }

    const [sh, sm] = classForm.startTime.split(':').map(Number);
    const [eh, em] = classForm.endTime.split(':').map(Number);
    if ((eh * 60 + em) <= (sh * 60 + sm)) {
      showNotification('End time must be strictly after start time.', 'error');
      return;
    }

    const durationMins = calculateDurationMins(classForm.startTime, classForm.endTime);
    
    const payload = {
      branchId: activeBranchId,
      name: classForm.name.trim(),
      classType: classForm.classType,
      daysOfWeek: classForm.daysOfWeek,
      dayOfWeek: classForm.daysOfWeek[0] || 'Monday',
      startTime: classForm.startTime,
      endTime: classForm.endTime,
      capacity: Number(classForm.capacity),
      coachId: classForm.coachId || undefined,
      standardDurationMins: durationMins
    };

    setIsSaving(true);
    try {
      let res;
      if (showClassModal === 'new') {
        res = await addClassSession(payload);
      } else if (typeof showClassModal === 'number') {
        res = await updateClassSession(showClassModal, payload);
      }
      if (res && res.success === false) {
        return;
      }
      setShowClassModal(null);
    } catch (err: any) {
      showNotification('Failed to save session: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClass = (c: any) => {
    setClassForm({
      name: c.name,
      classType: c.classType || 'General Class',
      daysOfWeek: c.daysOfWeek || [c.dayOfWeek || 'Monday'],
      startTime: c.startTime,
      endTime: c.endTime,
      capacity: c.capacity,
      coachId: c.coachId || ''
    });
    setShowClassModal(c.id);
  };

  const handleDuplicateClass = (c: any) => {
    setClassForm({
      name: `${c.name} (Copy)`,
      classType: c.classType || 'General Class',
      daysOfWeek: c.daysOfWeek || [c.dayOfWeek || 'Monday'],
      startTime: c.startTime,
      endTime: c.endTime,
      capacity: c.capacity,
      coachId: c.coachId || ''
    });
    setShowClassModal('new');
  };

  const handleDeleteClass = (id: number) => {
    showConfirm(
      t('sch_confirm_delete_class_desc'),
      () => deleteClassSession(id),
      t('sch_confirm_delete_class_title') || 'Delete Class Session'
    );
  };

  const handleQuickAdjustCapacity = async (classId: number, delta: number) => {
    const cls = state.classSessions.find(c => c.id === classId);
    if (!cls) return;
    const newCap = Math.max(1, cls.capacity + delta);
    await updateClassSession(classId, { capacity: newCap });
  };

  // Branch Specific Classes with Category & Search filtering
  const branchClasses = useMemo(() => {
    return state.classSessions
      .filter(c => {
        if (c.branchId !== activeBranchId) return false;
        if (categoryFilter !== 'All' && c.classType !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const coachName = coaches.find(u => u.id === c.coachId)?.displayName.toLowerCase() || '';
          const matchesName = c.name.toLowerCase().includes(q);
          const matchesCoach = coachName.includes(q);
          const matchesDay = c.daysOfWeek?.some(d => d.toLowerCase().includes(q)) || c.dayOfWeek?.toLowerCase().includes(q);
          if (!matchesName && !matchesCoach && !matchesDay) return false;
        }
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [state.classSessions, activeBranchId, categoryFilter, searchQuery, coaches]);

  const activeBranchName = state.branches.find(b => b.id === activeBranchId)?.name || t('sch_fallback_branch_name');
  
  // Total capacity calculations
  const totalBranchCapacity = branchClasses.reduce((acc, c) => acc + c.capacity, 0);
  
  const branchClassIds = useMemo(() => new Set(branchClasses.map(c => c.id)), [branchClasses]);
  const totalBranchEnrollments = useMemo(() => {
    return state.classEnrollments.filter(e => 
      branchClassIds.has(e.classId) && 
      state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
    ).length;
  }, [state.classEnrollments, branchClassIds, state.students]);
  
  const branchUtilizationRate = totalBranchCapacity > 0 
    ? Math.round((totalBranchEnrollments / totalBranchCapacity) * 100) 
    : 0;

  const overcrowdedClasses = useMemo(() => {
    return branchClasses.map(c => {
      const enrollCount = state.classEnrollments.filter(e => 
        e.classId === c.id && 
        state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
      ).length;
      const utilization = c.capacity > 0 ? Math.round((enrollCount / c.capacity) * 100) : 0;
      return {
        cls: c,
        enrollCount,
        utilization
      };
    }).filter(item => item.utilization >= 90);
  }, [branchClasses, state.classEnrollments, state.students]);

  // Coach workload breakdown
  const coachWorkloads = useMemo(() => {
    return coaches.map(coach => {
      const coachClasses = branchClasses.filter(c => c.coachId === coach.id);
      const totalCap = coachClasses.reduce((sum, c) => sum + c.capacity, 0);
      const coachClassIds = new Set(coachClasses.map(c => c.id));
      const totalEnrolled = state.classEnrollments.filter(e => 
        coachClassIds.has(e.classId) && 
        state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
      ).length;
      const util = totalCap > 0 ? Math.round((totalEnrolled / totalCap) * 100) : 0;
      return {
        coach,
        classesCount: coachClasses.length,
        totalCapacity: totalCap,
        totalEnrolled,
        utilization: util
      };
    }).filter(cw => cw.classesCount > 0);
  }, [coaches, branchClasses, state.classEnrollments, state.students]);

  // Detect time collision among sessions within the same day
  const getDayCollisions = (classesInDay: typeof branchClasses, currentClassId: number) => {
    const current = classesInDay.find(c => c.id === currentClassId);
    if (!current) return [];

    const parseTime = (tStr: string) => {
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    };
    const cStart = parseTime(current.startTime);
    const cEnd = parseTime(current.endTime);

    const collisions: string[] = [];
    classesInDay.forEach(other => {
      if (other.id === currentClassId) return;
      const oStart = parseTime(other.startTime);
      const oEnd = parseTime(other.endTime);

      if (cStart < oEnd && oStart < cEnd) {
        collisions.push(`${other.name} (${other.startTime}-${other.endTime})`);
      }
    });
    return collisions;
  };

  // Capacity Planner Filtered View
  const capacityFilteredClasses = useMemo(() => {
    return branchClasses.filter(c => {
      const enrollCount = state.classEnrollments.filter(e => 
        e.classId === c.id && 
        state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
      ).length;
      const util = c.capacity > 0 ? Math.round((enrollCount / c.capacity) * 100) : 0;
      
      if (capacityStatusFilter === 'Overcrowded') return util >= 90;
      if (capacityStatusFilter === 'Optimal') return util >= 60 && util < 90;
      if (capacityStatusFilter === 'Low') return util < 60;
      return true;
    });
  }, [branchClasses, capacityStatusFilter, state.classEnrollments, state.students]);

  // Branch session counts for navigation badges
  const branchSessionCounts = useMemo(() => {
    const map: Record<number, number> = {};
    state.classSessions.forEach(c => {
      map[c.branchId] = (map[c.branchId] || 0) + 1;
    });
    return map;
  }, [state.classSessions]);

  // Pre-filter capacity counts for filter pills
  const capacityStatusCounts = useMemo(() => {
    let overcrowded = 0;
    let optimal = 0;
    let low = 0;
    branchClasses.forEach(c => {
      const enrollCount = state.classEnrollments.filter(e => 
        e.classId === c.id && 
        state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
      ).length;
      const util = c.capacity > 0 ? Math.round((enrollCount / c.capacity) * 100) : 0;
      if (util >= 90) overcrowded++;
      else if (util >= 60) optimal++;
      else low++;
    });
    return {
      all: branchClasses.length,
      overcrowded,
      optimal,
      low
    };
  }, [branchClasses, state.classEnrollments, state.students]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12">
      {/* Top Header & Tab Switcher */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm">
            <Calendar className="w-6 h-6 text-[#EF2F38]" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[6px] text-[10px] font-bold uppercase tracking-wider font-mono">
                Facility & Rosters
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight mt-0.5 flex items-center gap-2">
              {t('sch_facility_schedule')}
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tracking-wide mt-0.5">
              {t('sch_facility_desc')}
            </p>
          </div>
        </div>

        <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-1 shrink-0 flex-nowrap overflow-x-auto no-scrollbar scrollbar-none w-full md:w-auto gap-1">
          <button 
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "px-4 py-2 min-h-[42px] rounded-[6px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation whitespace-nowrap", 
              activeTab === 'matrix' 
                ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black border border-neutral-200/60 dark:border-[#333]" 
                : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
            )}
          >
            <Calendar className="w-4 h-4 text-[#EF2F38]"/> {t('sch_weekly_matrix')}
          </button>
          <button 
            onClick={() => setActiveTab('capacity')}
            className={cn(
              "px-4 py-2 min-h-[42px] rounded-[6px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation whitespace-nowrap", 
              activeTab === 'capacity' 
                ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black border border-neutral-200/60 dark:border-[#333]" 
                : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
            )}
          >
            <ChartLine className="w-4 h-4 text-[#EF2F38]"/> {t('sch_capacity_planner')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
         {/* Sidebar Locations - Horizontal scrollable rail on mobile, stacked column on lg */}
         <div className="lg:col-span-1 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between pl-1">
              <h2 className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 uppercase font-black tracking-widest font-mono">{t('sch_branch_locations')}</h2>
              <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 font-bold">{state.branches.length} Dojang(s)</span>
            </div>
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible no-scrollbar pb-1 lg:pb-0 gap-2 -mx-1 px-1 sm:mx-0 sm:px-0">
               {state.branches.map(b => {
                 const count = branchSessionCounts[b.id] || 0;
                 return (
                   <button 
                     key={b.id} 
                     onClick={() => setActiveBranchId(b.id)}
                     className={cn(
                       "whitespace-nowrap shrink-0 lg:w-full text-left px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[44px] rounded-[8px] border transition-all duration-200 flex items-center justify-between gap-3 group shadow-sm cursor-pointer active:scale-95 touch-manipulation",
                       activeBranchId === b.id 
                         ? "bg-neutral-50 dark:bg-[#1C1C1C] border-[#EF2F38] text-neutral-900 dark:text-white pl-3.5 border-l-4 font-bold ring-1 ring-[#EF2F38]/20" 
                         : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-900 dark:hover:text-white pl-3.5 border-l-4 border-l-transparent hover:pl-4"
                     )}
                   >
                     <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                       <MapPin className={cn("w-4 h-4 shrink-0 transition-colors duration-200", activeBranchId === b.id ? "text-[#EF2F38]" : "text-neutral-400 group-hover:text-[#EF2F38]")}/>
                       <span className="text-xs sm:text-sm font-bold tracking-tight truncate">{b.name}</span>
                     </div>
                     <span className={cn(
                       "text-[9px] font-mono font-bold px-2 py-0.5 rounded-[6px] shrink-0",
                       activeBranchId === b.id ? "bg-[#EF2F38]/10 text-[#EF2F38] dark:bg-[#EF2F38]/20" : "bg-neutral-100 dark:bg-[#202020] text-neutral-500 dark:text-[#888]"
                     )}>
                       {count} {count === 1 ? 'class' : 'classes'}
                     </span>
                   </button>
                 );
               })}

               {isAdminOrHead && (
                 <>
                   {showBranchInput ? (
                      <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-150 shrink-0 min-w-[240px] lg:min-w-0 bg-white dark:bg-[#141414] p-1.5 rounded-[8px] border border-neutral-300 dark:border-[#262626] shadow-sm">
                        <input type="text" autoFocus value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)}
                          onKeyDown={e => {
                            if(e.key === 'Enter' && newBranchName.trim()) {
                              addBranch(newBranchName.trim());
                              setNewBranchName('');
                              setShowBranchInput(false);
                            }
                          }}
                          placeholder={t('sch_placeholder_branch_name')}
                          className="flex-1 bg-transparent px-2.5 py-1.5 min-h-[38px] text-xs text-neutral-900 dark:text-white focus:outline-none placeholder:text-neutral-400"
                        />
                        <button 
                          onClick={() => {
                            if (newBranchName.trim()) {
                              addBranch(newBranchName.trim());
                              setNewBranchName('');
                              setShowBranchInput(false);
                            }
                          }}
                          className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#EF2F38] hover:bg-[#d4252e] text-white rounded-[6px] cursor-pointer active:scale-90 touch-manipulation shadow-sm"
                          title="Save branch"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setShowBranchInput(false)} 
                          className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer active:scale-90 touch-manipulation"
                          title="Cancel"
                        >
                          <X className="w-4 h-4"/>
                        </button>
                      </div>
                   ) : (
                      <button onClick={() => setShowBranchInput(true)}
                        className="whitespace-nowrap shrink-0 lg:w-full text-left px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[44px] rounded-[8px] border border-dashed border-neutral-300 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:border-[#EF2F38] dark:hover:border-[#EF2F38] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] hover:text-neutral-900 dark:hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation"
                      >
                        <Plus className="w-4 h-4 shrink-0 text-[#EF2F38]"/> {t('sch_add_location')}
                      </button>
                   )}
                 </>
               )}
            </div>
         </div>

         {/* Main Content Area */}
         <div className="lg:col-span-3 space-y-4 sm:space-y-5">
            {activeTab === 'matrix' ? (
              <div className="space-y-3 sm:space-y-4">
                 {/* Top Controls: Search, Category, Add Session */}
                 <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                       {/* Search Box */}
                       <div className="relative flex-1 min-w-0 sm:max-w-xs">
                          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                          <input 
                            type="text"
                            placeholder="Search class or coach..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 h-10 min-h-[42px] bg-white dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                          />
                          {searchQuery && (
                            <button 
                              onClick={() => setSearchQuery('')} 
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white active:scale-90 touch-manipulation cursor-pointer"
                              title="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                       </div>

                       {/* Category Filter */}
                       <select 
                         value={categoryFilter}
                         onChange={e => setCategoryFilter(e.target.value)}
                         aria-label="Filter classes by category"
                         className="h-10 min-h-[42px] bg-white dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] px-3 text-xs focus:outline-none focus:border-[#EF2F38] font-semibold shadow-sm cursor-pointer"
                       >
                         <option value="All">{t('dir_all_classes')}</option>
                         {CATEGORIES.map(cat => <option key={cat} value={cat}>{formatCategoryLocalized(cat, t)}</option>)}
                       </select>
                    </div>

                    {isAdminOrHead && (
                       <button onClick={() => {
                           setClassForm({ name: '', classType: 'General Class', daysOfWeek: ['Monday'], startTime: '17:00', endTime: '18:30', capacity: 30, coachId: '' });
                           setShowClassModal('new');
                         }}
                         className="px-4 py-2 h-10 min-h-[42px] bg-[#EF2F38] hover:bg-[#d4252e] text-white transition-all duration-200 font-bold uppercase tracking-wider text-xs rounded-[8px] flex items-center gap-2 w-full sm:w-auto justify-center shadow-sm shrink-0 cursor-pointer active:scale-95 touch-manipulation"
                       >
                         <Plus className="w-4 h-4 shrink-0"/> {t('sch_book_session')}
                       </button>
                    )}
                 </div>

                 {/* Day Filter Pills */}
                 <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-nowrap -mx-1 px-1 sm:mx-0 sm:px-0 scroll-smooth">
                    <button
                      onClick={() => setSelectedDayFilter('All')}
                      className={cn(
                        "px-3.5 py-1.5 min-h-[40px] rounded-[8px] text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border shrink-0 cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center gap-2",
                        selectedDayFilter === 'All'
                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white shadow-sm font-black"
                          : "bg-white dark:bg-[#141414] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-700"
                      )}
                    >
                      <span>All Days</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-[9px] font-mono",
                        selectedDayFilter === 'All' ? "bg-white/20 text-white dark:bg-neutral-950/20 dark:text-neutral-950 font-bold" : "bg-neutral-100 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300"
                      )}>
                        {branchClasses.length}
                      </span>
                    </button>
                    {DAYS.map(day => {
                      const count = branchClasses.filter(c => c.daysOfWeek && c.daysOfWeek.includes(day)).length;
                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDayFilter(day)}
                          className={cn(
                            "px-3.5 py-1.5 min-h-[40px] rounded-[8px] text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border shrink-0 flex items-center gap-2 cursor-pointer active:scale-95 touch-manipulation",
                            selectedDayFilter === day
                              ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm font-black ring-2 ring-[#EF2F38]/20"
                              : count > 0
                                ? "bg-white dark:bg-[#141414] text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                                : "bg-white dark:bg-[#141414] text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white"
                          )}
                        >
                          <span>{day.substring(0, 3)}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold",
                            selectedDayFilter === day ? "bg-white/20 text-white" : "bg-neutral-100 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                 </div>

                 {/* Day Sessions List */}
                 <div className="grid grid-cols-1 gap-4">
                    {DAYS.map(day => {
                       if (selectedDayFilter !== 'All' && selectedDayFilter !== day) return null;
                       const dayClasses = branchClasses.filter(c => c.daysOfWeek && c.daysOfWeek.includes(day));
                       if (dayClasses.length === 0) return null;

                       return (
                         <div key={day} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                             <div className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-[#EF2F38]"/>
                                  <h3 className="text-xs font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{t(`day_${day.toLowerCase()}` as any)}</h3>
                                </div>
                                <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono font-bold tracking-tight">
                                  {dayClasses.length} {dayClasses.length === 1 ? t('sch_class_count_singular') : t('sch_class_count_plural')}
                                 </span>
                              </div>
                              <div className="divide-y divide-neutral-200/80 dark:divide-[#262626]">
                                 {dayClasses.map(c => {
                                   const enrolledCount = state.classEnrollments.filter(e => e.classId === c.id && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
                                   const isFull = enrolledCount >= c.capacity;
                                   const isOvercrowded = enrolledCount > c.capacity;
                                   const styles = CLASS_STYLES[c.classType || 'General Class'];
                                   const durationText = calculateDuration(c.startTime, c.endTime);
                                   const coach = coaches.find(u => u.id === c.coachId);
                                   const coachName = coach?.displayName;
                                   const collisions = getDayCollisions(dayClasses, c.id);
                                   const fillPct = c.capacity > 0 ? Math.min(100, Math.round((enrolledCount / c.capacity) * 100)) : 0;

                                   return (
                                     <motion.div 
                                       key={c.id} 
                                       whileHover={{ y: -0.5 }}
                                       className={cn(
                                         "p-3.5 sm:p-4 hover:bg-neutral-50/50 dark:hover:bg-[#1C1C1C]/40 bg-white dark:bg-[#141414] transition-all duration-200 group flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-l-4", 
                                         styles.accent
                                       )}
                                     >
                                        <div className="flex-1 min-w-0">
                                           <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                                              <h4 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight leading-tight group-hover:text-[#EF2F38] dark:group-hover:text-[#EF2F38] transition-colors">{c.name}</h4>
                                              <span className={cn("px-2 py-0.5 rounded-[6px] text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm", styles.text, styles.border, styles.bg)}>
                                                 {formatCategoryLocalized(c.classType || 'General Class', t)}
                                              </span>
                                              <span className="text-[9px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 font-mono px-2 py-0.5 rounded-[6px] font-bold uppercase tracking-wider shadow-sm">
                                                 {durationText}
                                              </span>
                                              {isFull && (
                                                <span className={cn("px-2 py-0.5 rounded-[6px] text-[8px] sm:text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm", isOvercrowded ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30" : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30" )}>
                                                  {isOvercrowded ? <ShieldWarning className="w-3 h-3"/> : <WarningCircle className="w-3 h-3"/>}
                                                  {isOvercrowded ? t('sch_overcrowded') : t('sch_full')}
                                                </span>
                                              )}
                                           </div>

                                           {/* Time Collision Warning Pill */}
                                           {collisions.length > 0 && (
                                             <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-[6px] font-semibold">
                                                <WarningCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                                <span>Mat Conflict: Overlaps with {collisions.join(', ')}</span>
                                             </div>
                                           )}

                                           <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1.5 sm:gap-y-2 mt-2.5">
                                              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 font-mono font-medium">
                                                <Clock className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0"/>
                                                {c.startTime} - {c.endTime}
                                              </div>

                                              {/* Occupancy Indicator with mini progress bar */}
                                              <div className="flex items-center gap-2 text-xs font-mono font-medium">
                                                <Users className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0"/>
                                                <span className={cn(isFull ? (isOvercrowded ? 'text-red-600 dark:text-red-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold') : 'text-neutral-600 dark:text-neutral-400')}>
                                                  {enrolledCount}/{c.capacity}
                                                </span>
                                                <div className="w-14 sm:w-18 h-1.5 bg-neutral-100 dark:bg-[#1C1C1C] rounded-full overflow-hidden border border-neutral-200/60 dark:border-neutral-800">
                                                  <div 
                                                    className={cn("h-full rounded-full transition-all duration-300", isOvercrowded ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-emerald-500")} 
                                                    style={{ width: `${fillPct}%` }} 
                                                  />
                                                </div>
                                                <span className={cn("text-[9px] font-bold", isOvercrowded ? "text-red-600 dark:text-red-400" : isFull ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400")}>
                                                  {fillPct}%
                                                </span>
                                              </div>

                                              {coachName && (
                                                <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 font-sans">
                                                   <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-[#202020] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-[9px] font-bold text-neutral-700 dark:text-neutral-300 shrink-0">
                                                     {coachName.charAt(0)}
                                                   </span>
                                                   <span className="font-bold text-neutral-500 dark:text-neutral-400 uppercase text-[9px] tracking-wider">{t('sch_coach_prefix')}:</span>
                                                   <span className="text-neutral-800 dark:text-neutral-200 font-bold">{coachName}</span>
                                                </div>
                                              )}
                                           </div>
                                        </div>

                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#262626] w-full md:w-auto justify-between sm:justify-start">
                                           <button onClick={() => { setEnrollModalTab('unenrolled'); setShowEnrollModal(c.id); }}
                                             className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2C2C2C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] rounded-[8px] text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 touch-manipulation whitespace-nowrap"
                                           >
                                             <Users className="w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400"/> {t('sch_cohort_roster')}
                                           </button>
                                           <button onClick={() => { setEnrollModalTab('enrolled'); setShowEnrollModal(c.id); }}
                                             className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2C2C2C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] rounded-[8px] text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 touch-manipulation whitespace-nowrap"
                                           >
                                             <CalendarCheck className="w-4 h-4 text-[#EF2F38] shrink-0"/> Take Attendance
                                           </button>
                                           {isAdminOrHead && (
                                             <div className="flex items-center gap-1 shrink-0">
                                               <button onClick={() => handleEditClass(c)} title={t('act_edit')}
                                                 className="min-w-[40px] min-h-[40px] p-2 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-[8px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2C2C2C] hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                               >
                                                 <PencilSimple className="w-4 h-4"/>
                                               </button>
                                               <button onClick={() => handleDuplicateClass(c)} title="Duplicate Session"
                                                 className="min-w-[40px] min-h-[40px] p-2 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] rounded-[8px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2C2C2C] hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                               >
                                                 <CopySimple className="w-4 h-4"/>
                                               </button>
                                               <button onClick={() => handleDeleteClass(c.id)} title={t('act_delete')}
                                                 className="min-w-[40px] min-h-[40px] p-2 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-red-500 rounded-[8px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2C2C2C] hover:bg-red-500/10 transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                               >
                                                 <Trash className="w-4 h-4"/>
                                               </button>
                                             </div>
                                           )}
                                        </div>
                                     </motion.div>
                                   )
                                 })}
                              </div>
                          </div>
                        )
                     })}


                     {branchClasses.length === 0 && (
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] p-12 flex flex-col items-center justify-center text-center shadow-inner">
                           <Calendar className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mb-3"/>
                           <p className="text-sm text-neutral-600 dark:text-neutral-400 font-bold tracking-tight">{t('sch_no_sessions_matching')}</p>
                           {(searchQuery || categoryFilter !== 'All') && (
                             <button
                               onClick={() => { setSearchQuery(''); setCategoryFilter('All'); }}
                               className="mt-3 px-3 py-1.5 min-h-[34px] text-xs text-[#EF2F38] font-bold uppercase tracking-wider hover:underline cursor-pointer active:scale-95 touch-manipulation"
                             >
                               Reset Filters
                             </button>
                           )}
                        </div>
                     )}
                 </div>
              </div>
            ) : (
              /* Capacity Planner Section */
              <div className="space-y-6 animate-in fade-in duration-200">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-500 dark:text-[#888] uppercase font-black tracking-widest">{t('sch_branch_occupancy')}</p>
                        <span className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[6px]",
                          branchUtilizationRate >= 90 ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                          branchUtilizationRate >= 70 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {branchUtilizationRate >= 90 ? 'High Load' : branchUtilizationRate >= 70 ? 'Optimal' : 'Light'}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold mt-1">{branchUtilizationRate}%</h2>
                      <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full mt-2.5 overflow-hidden">
                         <div className={cn(
                           "h-full bg-gradient-to-r rounded-full transition-all duration-300", 
                           branchUtilizationRate >= 90 ? 'from-red-500 to-rose-600' : branchUtilizationRate >= 70 ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500'
                         )} style={{ width: `${Math.min(100, branchUtilizationRate)}%` }} />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <p className="text-[10px] text-neutral-500 dark:text-[#888] uppercase font-black tracking-widest">{t('sch_total_allocated')}</p>
                      <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold mt-1">{totalBranchCapacity}</h2>
                      <p className="text-[9px] text-neutral-500 dark:text-[#888] mt-1 font-mono uppercase tracking-wider font-semibold">
                        {branchClasses.length} {branchClasses.length === 1 ? 'Scheduled Class' : 'Scheduled Classes'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <p className="text-[10px] text-neutral-500 dark:text-[#888] uppercase font-black tracking-widest">{t('sch_total_enrolled')}</p>
                      <h2 className="text-xl sm:text-2xl font-mono text-[#EF2F38] font-bold mt-1">{totalBranchEnrollments}</h2>
                      <p className="text-[9px] text-neutral-500 dark:text-[#888] mt-1 font-mono uppercase tracking-wider font-semibold">{t('sch_active_enrollments')}</p>
                    </div>
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-500 dark:text-[#888] uppercase font-black tracking-widest">Capacity Alerts</p>
                        {overcrowdedClasses.length > 0 && <ShieldWarning className="w-4 h-4 text-[#EF2F38]" />}
                      </div>
                      <h2 className={cn("text-xl sm:text-2xl font-mono font-bold mt-1", overcrowdedClasses.length > 0 ? "text-[#EF2F38]" : "text-emerald-600 dark:text-emerald-400")}>
                        {overcrowdedClasses.length}
                      </h2>
                      <p className="text-[9px] text-neutral-500 dark:text-[#888] mt-1 font-mono uppercase tracking-wider font-semibold">
                        {overcrowdedClasses.length > 0 ? 'Sessions ≥ 90% full' : 'All sessions healthy'}
                      </p>
                    </div>
                  </div>

                  {/* Filter Controls for Capacity Planner */}
                  <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                     <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] flex items-center gap-1">
                          <Funnel className="w-3.5 h-3.5 text-[#EF2F38]" /> Filter:
                       </span>
                       <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] p-1 rounded-[8px] border border-neutral-200 dark:border-[#262626] flex-wrap sm:flex-nowrap gap-1">
                         {(['All', 'Overcrowded', 'Optimal', 'Low'] as const).map(status => {
                           const count = status === 'All' ? capacityStatusCounts.all :
                                         status === 'Overcrowded' ? capacityStatusCounts.overcrowded :
                                         status === 'Optimal' ? capacityStatusCounts.optimal :
                                         capacityStatusCounts.low;
                           return (
                             <button
                               key={status}
                               onClick={() => setCapacityStatusFilter(status)}
                               className={cn(
                                 "px-3 py-1.5 min-h-[36px] rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation whitespace-nowrap",
                                 capacityStatusFilter === status
                                   ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black"
                                   : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                               )}
                             >
                               {status === 'Overcrowded' && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                               {status === 'Optimal' && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                               {status === 'Low' && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                               <span>{status}</span>
                               <span className={cn(
                                 "px-1.5 py-0.5 rounded-full text-[9px] font-mono",
                                 capacityStatusFilter === status ? "bg-neutral-100 dark:bg-[#262626] text-neutral-900 dark:text-white font-bold" : "bg-neutral-200/60 dark:bg-[#1C1C1C] text-neutral-600 dark:text-[#888]"
                               )}>
                                 {count}
                               </span>
                             </button>
                           );
                         })}
                       </div>
                    </div>

                    <div className="flex items-center gap-2">
                       <select 
                         value={categoryFilter}
                         onChange={e => setCategoryFilter(e.target.value)}
                         aria-label="Filter category in capacity planner"
                         className="w-full sm:w-auto bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] px-3 py-1.5 min-h-[38px] text-xs font-semibold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                       >
                         <option value="All">{t('dir_all_classes')}</option>
                         {CATEGORIES.map(cat => <option key={cat} value={cat}>{formatCategoryLocalized(cat, t)}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                   {/* Interactive Session Utilizations Table */}
                   <div className="lg:col-span-2 space-y-4">
                      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm animate-in fade-in">
                        <div className="p-3.5 sm:p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex items-center justify-between">
                          <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest">{t('sch_session_utilization')} - {activeBranchName}</h3>
                          <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono font-medium">{capacityFilteredClasses.length} session(s)</span>
                        </div>
                        <div className="divide-y divide-neutral-200/80 dark:divide-[#262626]">
                          {capacityFilteredClasses.length === 0 ? (
                            <p className="p-8 text-xs text-neutral-600 dark:text-neutral-400 font-mono text-center">{t('sch_no_sessions_scheduled')}</p>
                          ) : capacityFilteredClasses.map(c => {
                            const enrollCount = state.classEnrollments.filter(e => e.classId === c.id && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
                            const util = c.capacity > 0 ? Math.round((enrollCount / c.capacity) * 100) : 0;
                            return (
                              <div key={c.id} className="p-3.5 sm:p-4 bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-[#1C1C1C]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div>
                                   <div className="flex items-center gap-2">
                                     <p className="font-bold text-neutral-900 dark:text-white">{c.name}</p>
                                     <span className="text-[8px] px-1.5 py-0.5 rounded-[6px] bg-neutral-100 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider font-mono">
                                       {c.classType}
                                     </span>
                                   </div>
                                   <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5 font-medium">
                                     {c.daysOfWeek?.join(', ') || c.dayOfWeek} • {c.startTime}-{c.endTime}
                                   </p>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#262626]">
                                   <div className="text-left sm:text-right">
                                      <span className={cn("font-mono font-bold text-xs", util >= 90 ? 'text-[#EF2F38]' : 'text-neutral-900 dark:text-white')}>{enrollCount} / {c.capacity} ({util}%)</span>
                                      <p className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">{t('sch_occupancy')}</p>
                                   </div>
                                   <div className="w-16 h-1.5 bg-neutral-100 dark:bg-[#0F0F0F] rounded-full overflow-hidden shrink-0 border border-neutral-200/50 dark:border-transparent">
                                      <div className={cn(
                                        "h-full bg-gradient-to-r rounded-full transition-all duration-300", 
                                        util >= 90 ? 'from-red-500 to-rose-600' : util >= 70 ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500'
                                      )} style={{ width: `${util}%` }} />
                                   </div>
                                   
                                   {/* Quick Capacity Stepper & Roster Action */}
                                   <div className="flex items-center gap-1.5 shrink-0">
                                      {isAdminOrHead && (
                                        <div className="flex items-center bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-0.5">
                                          <button
                                            type="button"
                                            onClick={() => handleQuickAdjustCapacity(c.id, -5)}
                                            title="Reduce capacity by 5"
                                            className="min-w-[34px] min-h-[34px] flex items-center justify-center text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-500 rounded-[6px] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                          >
                                            -5
                                          </button>
                                          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">|</span>
                                          <button
                                            type="button"
                                            onClick={() => handleQuickAdjustCapacity(c.id, 5)}
                                            title="Expand capacity by 5"
                                            className="min-w-[34px] min-h-[34px] flex items-center justify-center text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 hover:text-emerald-500 rounded-[6px] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                          >
                                            +5
                                          </button>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => { setEnrollModalTab('unenrolled'); setShowEnrollModal(c.id); }}
                                        title="View Cohort Roster"
                                        className="min-w-[36px] min-h-[36px] flex items-center justify-center p-2 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-700 dark:text-neutral-300 rounded-[8px] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                      >
                                        <Users className="w-4 h-4" />
                                      </button>
                                      {isAdminOrHead && (
                                        <button
                                          type="button"
                                          onClick={() => handleEditClass(c)}
                                          title="Edit Session"
                                          className="min-w-[36px] min-h-[36px] flex items-center justify-center p-2 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-700 dark:text-neutral-300 rounded-[8px] transition-colors cursor-pointer active:scale-90 touch-manipulation"
                                        >
                                          <PencilSimple className="w-4 h-4" />
                                        </button>
                                      )}
                                   </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                   </div>

                   {/* Right Column: Overcrowded Alert & Coach Workloads */}
                   <div className="space-y-4 sm:space-y-6">
                      {/* Overcrowded alert card */}
                      <div className="bg-white dark:bg-[#141414] border-l-4 border-l-[#EF2F38] border-y border-r border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-sm animate-in fade-in">
                         <h3 className="text-xs font-bold uppercase tracking-widest text-[#EF2F38] dark:text-[#EF2F38] border-b border-neutral-100 dark:border-[#262626] pb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ShieldWarning className="w-4.5 h-4.5 text-[#EF2F38]"/>
                              {t('sch_overcrowded_classes')}
                            </span>
                            <span className="font-mono text-[10px] font-bold">{overcrowdedClasses.length}</span>
                         </h3>
                         <div className="space-y-3.5">
                            {overcrowdedClasses.length === 0 ? (
                              <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono text-center py-4">{t('sch_healthy_boundaries')}</p>
                            ) : overcrowdedClasses.map(oc => (
                              <div key={oc.cls.id} className="text-xs space-y-2 pb-3 border-b border-neutral-100 dark:border-[#262626] last:border-b-0 last:pb-0">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-neutral-800 dark:text-white">{oc.cls.name}</span>
                                  <span className="font-mono text-[#EF2F38] dark:text-[#EF2F38] font-bold">{oc.utilization}%</span>
                                </div>
                                <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono font-medium">
                                  {oc.cls.daysOfWeek?.join(', ') || oc.cls.dayOfWeek} • {oc.cls.startTime}-{oc.cls.endTime}
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                  {isAdminOrHead && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickAdjustCapacity(oc.cls.id, 5)}
                                      className="flex-1 sm:flex-initial px-3 py-1.5 min-h-[36px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-[8px] text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                                    >
                                      +5 Slots
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => { setEnrollModalTab('enrolled'); setShowEnrollModal(oc.cls.id); }}
                                    className="flex-1 sm:flex-initial px-3 py-1.5 min-h-[36px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-[9px] font-bold uppercase tracking-wider hover:bg-neutral-200 transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                                  >
                                    Manage Cohort
                                  </button>
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      {/* Instructor Workload Breakdown Card */}
                      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 space-y-4 shadow-sm animate-in fade-in">
                         <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white border-b border-neutral-100 dark:border-[#262626] pb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-[#EF2F38]" />
                              Instructor Load
                            </span>
                            <span className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400 font-bold">{coachWorkloads.length} Coach(es)</span>
                         </h3>
                         <div className="space-y-3">
                            {coachWorkloads.length === 0 ? (
                              <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono text-center py-2">No instructors assigned to classes in this branch.</p>
                            ) : coachWorkloads.map(cw => (
                              <div key={cw.coach.id} className="space-y-1 text-xs pb-2.5 border-b border-neutral-100 dark:border-[#262626] last:border-b-0 last:pb-0">
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-neutral-900 dark:text-white">{cw.coach.displayName}</span>
                                  <span className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400">{cw.totalEnrolled} / {cw.totalCapacity} ({cw.utilization}%)</span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                                  <span>{cw.classesCount} class session{cw.classesCount === 1 ? '' : 's'}</span>
                                  <span className={cn(cw.utilization >= 90 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-neutral-600 dark:text-neutral-400')}>{cw.utilization}% load</span>
                                </div>
                                <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-1 overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      cw.utilization >= 90 ? 'bg-red-500' : cw.utilization >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${Math.min(100, cw.utilization)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* Upgraded Class Form Modal */}
      <AnimatePresence>
        {showClassModal && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col my-auto max-h-[92dvh] overflow-hidden">
                  <div className="p-3.5 sm:p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                     <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-neutral-800 dark:text-white">
                       {showClassModal === 'new' ? t('sch_new_course') : t('sch_edit_course')}
                     </h2>
                     <button onClick={() => setShowClassModal(null)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-[8px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors cursor-pointer active:scale-90 touch-manipulation" aria-label="Close modal"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                     <div>
                       <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_session_name')}</label>
                       <input type="text" value={classForm.name} onChange={(e) => setClassForm({...classForm, name: e.target.value})}
                         className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                         placeholder={t('sch_session_placeholder')}
                       />
                     </div>

                     <div>
                       <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('lms_category')}</label>
                       <div className="grid grid-cols-2 gap-2">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setClassForm({ ...classForm, classType: cat })}
                              className={cn(
                                "px-3 py-2.5 min-h-[42px] border rounded-[8px] text-[10px] font-bold uppercase tracking-wider transition-all text-center shadow-sm cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center",
                                classForm.classType === cat 
                                  ? "bg-neutral-900 dark:bg-white border-neutral-950 dark:border-white text-white dark:text-black font-extrabold" 
                                  : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                              )}
                            >
                              {formatCategoryLocalized(cat, t)}
                            </button>
                          ))}
                       </div>
                     </div>

                     <div>
                       <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_recurrence_days')}</label>
                       <div className="flex flex-wrap gap-2">
                          {DAYS.map(day => {
                            const isSelected = classForm.daysOfWeek.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const updatedDays = isSelected
                                    ? classForm.daysOfWeek.filter(d => d !== day)
                                    : [...classForm.daysOfWeek, day];
                                  setClassForm({ ...classForm, daysOfWeek: updatedDays });
                                }}
                                className={cn(
                                  "px-3 py-1.5 min-h-[38px] rounded-[8px] text-[10px] font-bold uppercase tracking-wider border transition-all shadow-sm cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center",
                                  isSelected 
                                    ? "bg-[#EF2F38] border-[#EF2F38] text-white font-extrabold" 
                                    : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626]"
                                )}
                              >
                                {t(getShortDayKey(day) as any)}
                              </button>
                            );
                          })}
                       </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                           <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_assign_instructor')}</label>
                           <select 
                             value={classForm.coachId} 
                             onChange={e => setClassForm({...classForm, coachId: e.target.value})}
                             aria-label="Assign instructor"
                             className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold cursor-pointer"
                           >
                              <option value="" className="text-black dark:text-white dark:bg-neutral-900">{t('sch_no_instructor')}</option>
                              {coaches.map(c => (
                                <option key={c.id} value={c.id} className="text-black dark:text-white dark:bg-neutral-900">{c.displayName}</option>
                              ))}
                           </select>
                        </div>
                        <div>
                           <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_capacity_limit')}</label>
                           <input type="number" min={1} max={500} value={classForm.capacity} onChange={(e) => setClassForm({...classForm, capacity: Number(e.target.value)})}
                             className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-bold"
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                           <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_start_time')}</label>
                           <input type="time" value={classForm.startTime} onChange={(e) => setClassForm({...classForm, startTime: e.target.value})}
                             className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-mono font-bold [color-scheme:light] dark:[color-scheme:dark]"
                           />
                        </div>
                        <div>
                           <label className="block text-[10px] uppercase font-black text-neutral-600 dark:text-neutral-400 mb-1.5">{t('sch_end_time')}</label>
                           <input type="time" value={classForm.endTime} onChange={(e) => setClassForm({...classForm, endTime: e.target.value})}
                             className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-mono font-bold [color-scheme:light] dark:[color-scheme:dark]"
                           />
                        </div>
                     </div>
                  </div>
                  
                  <div className="p-3.5 sm:p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2.5 sm:gap-3 bg-neutral-50 dark:bg-[#0A0A0A] shrink-0">
                     <button 
                       disabled={isSaving} 
                       onClick={() => setShowClassModal(null)} 
                       className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-white font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                     >
                       {t('act_cancel')}
                     </button>
                     <button 
                       disabled={isSaving} 
                       onClick={handleSaveClass} 
                       className="flex-1 sm:flex-initial px-5 py-2.5 min-h-[44px] bg-[#EF2F38] hover:bg-[#d4252e] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation"
                     >
                       {isSaving && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                       {t('act_save')}
                     </button>
                  </div>
               </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Cohort Enrollment Modal */}
      <AnimatePresence>
        {showEnrollModal && (
          <Portal>
            <EnrollmentModal 
              classId={showEnrollModal} 
              initialTab={enrollModalTab}
              onClose={() => setShowEnrollModal(null)}
            />
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Enrollment Sub-component with Multi-Select Batch Actions & Rich Analytics
function EnrollmentModal({ classId, initialTab, onClose }: { classId: number, initialTab: 'unenrolled' | 'enrolled', onClose: () => void }) {
  const { state, enrollStudent, unenrollStudent, batchEnrollStudents, markAttendance, deleteAttendanceRecords, showConfirm, showNotification } = useAppStore();
  const t = useT();
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'unenrolled' | 'enrolled' | 'all'>(initialTab);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('All');
  const [selectedBeltFilter, setSelectedBeltFilter] = useState<string>('All');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBatchEnrolling, setIsBatchEnrolling] = useState(false);
  const [turnoutSort, setTurnoutSort] = useState<'default' | 'turnout-asc' | 'turnout-desc'>('default');

  const getStudentAttendanceStats = (studentId: string) => {
    const studentRecords = state.attendanceRecords.filter(r => r.studentId === studentId);
    const total = studentRecords.length;
    if (total === 0) return null;
    const attended = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
    const pct = Math.round((attended / total) * 100);
    return { count: attended, total, pct };
  };

  const handleQuickAttendance = async (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    const existing = state.attendanceRecords.find(r => r.studentId === studentId && r.date === selectedDate);
    if (existing?.status === status) {
      await deleteAttendanceRecords(selectedDate, [studentId]);
    } else {
      await markAttendance(studentId, selectedDate, status);
    }
  };

  const classObj = state.classSessions.find(c => c.id === classId);
  const enrolledStudentIds = useMemo(() => new Set(
    state.classEnrollments
      .filter(e => e.classId === classId && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active')
      .map(e => e.studentId)
  ), [state.classEnrollments, classId, state.students]);

  const enrolledCount = enrolledStudentIds.size;
  const isFull = enrolledCount >= (classObj?.capacity || 0);
  const classBranch = state.branches.find(b => b.id === classObj?.branchId);

  // Time overlap conflict checker
  const getConflicts = (studentId: string) => {
    if (!classObj) return [];
    const otherEnrollments = state.classEnrollments.filter(
      e => e.studentId === studentId && e.classId !== classId
    );
    const conflicts: string[] = [];
    otherEnrollments.forEach(e => {
      const oc = state.classSessions.find(c => c.id === e.classId);
      if (!oc) return;
      
      const dayOverlap = oc.daysOfWeek.some(d => classObj.daysOfWeek.includes(d));
      if (!dayOverlap) return;
      
      const parseTime = (tStr: string) => {
        const [h, m] = tStr.split(':').map(Number);
        return h * 60 + m;
      };
      
      const start1 = parseTime(classObj.startTime);
      const end1 = parseTime(classObj.endTime);
      const start2 = parseTime(oc.startTime);
      const end2 = parseTime(oc.endTime);
      
      if (start1 < end2 && start2 < end1) {
        conflicts.push(`${oc.name} (${oc.daysOfWeek.map(d => d.substring(0,3)).join('/')} ${oc.startTime}-${oc.endTime})`);
      }
    });
    return conflicts;
  };

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    return state.students
      .filter(s => {
        if (s.studentStatus !== 'Active') return false;
        
        const matchesSearch = s.englishName.toLowerCase().includes(search.toLowerCase()) ||
                              s.khmerName.toLowerCase().includes(search.toLowerCase()) ||
                              s.id.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;

        const isEnrolled = enrolledStudentIds.has(s.id);
        if (activeTab === 'enrolled' && !isEnrolled) return false;
        if (activeTab === 'unenrolled' && isEnrolled) return false;

        if (selectedBranchFilter !== 'All') {
          if (selectedBranchFilter === 'ClassBranch' && s.homeBranchId !== classObj?.branchId) return false;
          if (selectedBranchFilter !== 'ClassBranch' && s.homeBranchId.toString() !== selectedBranchFilter) return false;
        }

        if (selectedBeltFilter !== 'All' && s.currentBelt !== selectedBeltFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (activeTab === 'enrolled' && turnoutSort !== 'default') {
          const aPct = getStudentAttendanceStats(a.id)?.pct ?? -1;
          const bPct = getStudentAttendanceStats(b.id)?.pct ?? -1;
          if (turnoutSort === 'turnout-asc') return aPct - bPct;
          if (turnoutSort === 'turnout-desc') return bPct - aPct;
        }

        const aMatchesBranch = a.homeBranchId === classObj?.branchId;
        const bMatchesBranch = b.homeBranchId === classObj?.branchId;
        if (aMatchesBranch && !bMatchesBranch) return -1;
        if (!aMatchesBranch && bMatchesBranch) return 1;
        return a.englishName.localeCompare(b.englishName);
      });
  }, [state.students, search, enrolledStudentIds, activeTab, selectedBranchFilter, selectedBeltFilter, classObj, turnoutSort]);

  const handleToggleEnroll = async (studentId: string, isEnrolled: boolean) => {
    setIsProcessingId(studentId);
    try {
      if (isEnrolled) {
        await unenrollStudent(studentId, classId);
      } else {
        if (isFull) {
          showNotification(`Cannot enroll student: "${classObj?.name}" is at maximum capacity (${classObj?.capacity}).`, 'error');
          return;
        }
        await enrollStudent(studentId, classId);
      }
    } catch (e: any) {
      console.error(e);
      showNotification('Enrollment action failed: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleBatchEnroll = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsBatchEnrolling(true);
    try {
      const res = await batchEnrollStudents(Array.from(selectedStudentIds), classId);
      if (res.success) {
        setSelectedStudentIds(new Set());
      }
    } finally {
      setIsBatchEnrolling(false);
    }
  };

  const capacityPct = classObj && classObj.capacity > 0 ? Math.min(100, Math.round((enrolledCount / classObj.capacity) * 100)) : 0;
  const BELTS = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'];

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.96 }} 
        className="w-full max-w-2xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col my-auto max-h-[92dvh] overflow-hidden text-neutral-900 dark:text-white"
      >
         {/* Top Header Panel */}
         <div className="p-3.5 sm:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
            <div className="flex-1 min-w-0">
               <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-neutral-800 dark:text-white flex items-center gap-2 truncate">
                 <Users className="w-5 h-5 text-[#EF2F38] shrink-0" />
                 <span className="truncate">{t('sch_cohort_roster')}: {classObj?.name}</span>
               </h2>
                <div className="mt-2 space-y-1">
                   <div className="flex items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400 font-mono font-semibold">
                      <span>{t('att_capacity_utilization')}: {enrolledCount} / {classObj?.capacity}</span>
                      <span>{capacityPct}%</span>
                   </div>
                   <div className="w-full bg-neutral-200 dark:bg-[#1C1C1C] rounded-full h-1.5 overflow-hidden">
                      <div className={cn(
                        "h-full rounded-full transition-all duration-300", 
                        capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      )} style={{ width: `${capacityPct}%` }} />
                   </div>
                </div>
            </div>
            <button type="button" onClick={onClose} className="self-end sm:self-center min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-[8px] transition-colors cursor-pointer active:scale-90 touch-manipulation" aria-label="Close modal"><X className="w-5 h-5"/></button>
         </div>

         {/* Navigation Tabs */}
         <div className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex px-2 sm:px-4 shrink-0 overflow-x-auto no-scrollbar flex-nowrap">
            <button 
              onClick={() => { setActiveTab('unenrolled'); setSelectedStudentIds(new Set()); }} 
              className={cn(
                "py-2.5 sm:py-3 px-2.5 sm:px-3 min-h-[44px] text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 touch-manipulation whitespace-nowrap", 
                activeTab === 'unenrolled' ? "border-[#EF2F38] text-neutral-900 dark:text-white font-extrabold" : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              {t('sch_tab_unenrolled_candidates')}
              <span className="px-1.5 py-0.5 bg-neutral-200 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-[8px] font-mono font-bold">
                {state.students.filter(s => s.studentStatus === 'Active' && !enrolledStudentIds.has(s.id)).length}
              </span>
            </button>
            <button 
              onClick={() => { setActiveTab('enrolled'); setSelectedStudentIds(new Set()); }} 
              className={cn(
                "py-2.5 sm:py-3 px-2.5 sm:px-3 min-h-[44px] text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 touch-manipulation whitespace-nowrap", 
                activeTab === 'enrolled' ? "border-[#EF2F38] text-neutral-900 dark:text-white font-extrabold" : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              {t('sch_tab_enrolled_cohort')}
              <span className="px-1.5 py-0.5 bg-neutral-200 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-[8px] font-mono font-bold">
                {enrolledCount}
              </span>
            </button>
            <button 
              onClick={() => { setActiveTab('all'); setSelectedStudentIds(new Set()); }} 
              className={cn(
                "py-2.5 sm:py-3 px-2.5 sm:px-3 min-h-[44px] text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 touch-manipulation whitespace-nowrap", 
                activeTab === 'all' ? "border-[#EF2F38] text-neutral-900 dark:text-white font-extrabold" : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              {t('sch_tab_all_active')}
              <span className="px-1.5 py-0.5 bg-neutral-200 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-[8px] font-mono font-bold">
                {state.students.filter(s => s.studentStatus === 'Active').length}
              </span>
            </button>
         </div>

         {/* Smart Filter & Search Bar */}
         <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#141414] space-y-2.5 sm:space-y-3 shrink-0">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className={cn(activeTab === 'enrolled' ? "md:col-span-4" : "md:col-span-6", "relative")}>
                   <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-400"/>
                   <input 
                     type="text" 
                     placeholder={t('sch_search_placeholder')} 
                     value={search} 
                     onChange={(e) => setSearch(e.target.value)}
                     className="w-full pl-9 pr-3 py-2 min-h-[40px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                   />
                </div>
                
                <div className="md:col-span-3">
                   <select 
                     value={selectedBranchFilter} 
                     onChange={e => setSelectedBranchFilter(e.target.value)}
                     aria-label="Filter branch in cohort roster"
                     className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] px-3 py-2 min-h-[40px] text-xs focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                   >
                      <option value="All">{t('dir_all_branches')}</option>
                      <option value="ClassBranch">{t('sch_home_branch_only')}</option>
                      {state.branches.map(b => (
                        <option key={b.id} value={b.id.toString()}>{b.name}</option>
                      ))}
                   </select>
                </div>

                <div className={cn(activeTab === 'enrolled' ? "md:col-span-2" : "md:col-span-3")}>
                   <select 
                     value={selectedBeltFilter} 
                     onChange={e => setSelectedBeltFilter(e.target.value)}
                     aria-label="Filter belt in cohort roster"
                     className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] px-3 py-2 min-h-[40px] text-xs focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                   >
                      <option value="All">{t('dir_all_belts')}</option>
                      {BELTS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                   </select>
                </div>

                {activeTab === 'enrolled' && (
                  <div className="md:col-span-3">
                     <input 
                       type="date"
                       value={selectedDate}
                       onChange={e => setSelectedDate(e.target.value)}
                       aria-label="Select attendance date"
                       className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] px-3 py-2 min-h-[40px] text-xs focus:outline-none focus:border-[#EF2F38] font-mono [color-scheme:light] dark:[color-scheme:dark]"
                     />
                  </div>
                )}
             </div>
             
             <div className="flex flex-wrap items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400 gap-2 font-medium">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                   {/* Multi-Select Select All in Unenrolled tab */}
                   {activeTab === 'unenrolled' && filteredStudents.length > 0 && (
                     <button
                       type="button"
                       onClick={toggleSelectAll}
                       className="flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white cursor-pointer bg-neutral-100 dark:bg-[#1C1C1C] px-2.5 py-1.5 min-h-[34px] rounded-[8px] border border-neutral-200 dark:border-neutral-800 transition-colors active:scale-95 touch-manipulation"
                     >
                       <CheckSquare className="w-3.5 h-3.5 text-[#EF2F38]" />
                       <span>{selectedStudentIds.size === filteredStudents.length ? 'Deselect All' : `Select All (${filteredStudents.length})`}</span>
                     </button>
                   )}

                   {/* Attendance Sort in Enrolled tab */}
                   {activeTab === 'enrolled' && filteredStudents.length > 0 && (
                     <div className="flex items-center gap-1.5">
                       <ArrowsDownUp className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                       <select
                         value={turnoutSort}
                         onChange={e => setTurnoutSort(e.target.value as any)}
                         aria-label="Sort turnout"
                         className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] rounded-[8px] px-2.5 py-1 min-h-[34px] cursor-pointer focus:outline-none font-semibold"
                       >
                         <option value="default">Sort: Name (A-Z)</option>
                         <option value="turnout-asc">Sort: Lowest Turnout First</option>
                         <option value="turnout-desc">Sort: Highest Turnout First</option>
                       </select>
                     </div>
                   )}

                   <span>{t('sch_showing_candidates').replace('{count}', filteredStudents.length.toString())}</span>
                </div>

                <div className="flex items-center gap-3">
                   {activeTab === 'enrolled' && filteredStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                           showConfirm(
                             `Mark all ${filteredStudents.length} enrolled students as Present for ${selectedDate}?`,
                             async () => {
                                for (const student of filteredStudents) {
                                   await markAttendance(student.id, selectedDate, 'Present');
                                }
                                showNotification(`Marked ${filteredStudents.length} students as Present.`, 'success');
                             },
                             'Bulk Attendance Confirmation'
                           );
                        }}
                        className="text-[#EF2F38] hover:text-[#EF2F38]/80 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 cursor-pointer bg-[#EF2F38]/5 border border-[#EF2F38]/10 px-2.5 py-1.5 min-h-[34px] rounded-[8px] transition-colors active:scale-95 touch-manipulation"
                      >
                        <Check className="w-3 h-3"/> Mark All Present
                      </button>
                   )}
                   {classBranch && <span className="font-semibold text-neutral-600 dark:text-neutral-400 text-[10px]">{t('sch_class_branch_prefix').replace('{branch}', classBranch.name)}</span>}
                </div>
             </div>
         </div>
         
         {/* Students list */}
         <div className="flex-grow overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-neutral-50 dark:bg-[#0A0A0A]">
            <AnimatePresence mode="popLayout">
               {filteredStudents.map(student => {
                  const isEnrolled = enrolledStudentIds.has(student.id);
                  const isHomeBranch = student.homeBranchId === classObj?.branchId;
                  const conflicts = getConflicts(student.id);
                  const studentBranch = state.branches.find(b => b.id === student.homeBranchId);
                  const isSelected = selectedStudentIds.has(student.id);
                  
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      key={student.id} 
                      className={cn(
                        "bg-white dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-sm hover:shadow-md transition-all duration-200 border-l-4",
                        isEnrolled 
                          ? "border-l-emerald-500 border-neutral-200 dark:border-neutral-800" 
                          : conflicts.length > 0
                            ? "border-l-red-500 border-neutral-200 dark:border-[#262626]"
                            : isHomeBranch 
                              ? "border-l-[#EF2F38] border-neutral-200 dark:border-[#262626]" 
                              : "border-l-neutral-300 dark:border-l-neutral-700 border-neutral-200 dark:border-[#262626]"
                      )}
                    >
                       <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                          {/* Batch Selection Checkbox in Unenrolled Tab */}
                          {activeTab === 'unenrolled' && (
                            <div className="pt-1 shrink-0">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectStudent(student.id)}
                                aria-label={`Select ${student.englishName}`}
                                className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-[4px] border-neutral-300 dark:border-neutral-700 text-[#EF2F38] focus:ring-[#EF2F38]/20 cursor-pointer"
                              />
                            </div>
                          )}

                          <SafeImage 
                            src={student.profilePicturePath} 
                            alt={student.englishName} 
                            containerClassName="w-10 h-10 min-w-[40px] min-h-[40px] rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center font-bold text-sm text-neutral-600 dark:text-neutral-300 overflow-hidden shrink-0"
                            fallback={student.englishName.charAt(0)}
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                             <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">{student.englishName}</span>
                                {student.khmerName && (
                                   <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-khmer">{student.khmerName}</span>
                                )}
                                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[8px] font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                                   {formatBelt(student.currentBelt, student.dob)}
                                </span>
                             </div>
                             
                             <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">
                                <span>ID: {student.id}</span>
                                <span className="flex items-center gap-1">
                                   <MapPin className="w-3 h-3 text-[#EF2F38] shrink-0"/>
                                   {isHomeBranch ? (
                                     <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-[6px]">{t('sch_badge_home_branch')}</span>
                                   ) : (
                                     <span className="truncate">{studentBranch?.name || t('sch_external_branch')}</span>
                                   )}
                                </span>
                             </div>

                             {/* Attendance statistics */}
                             {(() => {
                                const stats = getStudentAttendanceStats(student.id);
                                return stats ? (
                                   <div className="text-[10px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
                                      <ChartLine className="w-3.5 h-3.5 text-[#EF2F38] shrink-0" />
                                      <span>Turnout:</span>
                                      <span className={cn("font-bold", stats.pct < 60 ? "text-red-600 dark:text-red-400" : stats.pct >= 80 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                                        {stats.pct}%
                                      </span>
                                      <span className="opacity-40">•</span>
                                      <span>{stats.count}/{stats.total} logged</span>
                                   </div>
                                ) : (
                                   <div className="text-[10px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
                                      <ChartLine className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                                      <span>No attendance logged yet</span>
                                   </div>
                                );
                             })()}

                             {/* Conflicts list */}
                             {conflicts.length > 0 && (
                               <div className="mt-1.5 flex flex-col gap-1">
                                 {conflicts.map((conf, idx) => (
                                   <div key={idx} className="flex items-center gap-1.5 text-[9px] text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-[8px] font-semibold">
                                      <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">{t('panel_schedule_overlap').replace('{conf}', conf)}</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                          </div>
                       </div>
                       
                       <div className="shrink-0 flex items-center justify-end sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#262626]">
                          {/* Quick Attendance Check-in Toolbar */}
                          {isEnrolled && (() => {
                             const record = state.attendanceRecords.find(r => r.studentId === student.id && r.date === selectedDate);
                             const currentStatus = record?.status;
                             return (
                                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-1 shadow-sm shrink-0 select-none">
                                   <button
                                     type="button"
                                     onClick={() => handleQuickAttendance(student.id, 'Present')}
                                     className={cn(
                                       "min-w-[38px] sm:min-w-[36px] min-h-[38px] sm:min-h-[36px] px-2.5 py-1.5 rounded-[6px] text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer border active:scale-90 touch-manipulation",
                                       currentStatus === 'Present'
                                         ? "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400 font-black shadow-sm"
                                         : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-500/10 font-bold"
                                     )}
                                     title="Present"
                                   >
                                     <Check className="w-4 h-4" />
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => handleQuickAttendance(student.id, 'Late')}
                                     className={cn(
                                       "min-w-[38px] sm:min-w-[36px] min-h-[38px] sm:min-h-[36px] px-2.5 py-1.5 rounded-[6px] text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer border active:scale-90 touch-manipulation",
                                       currentStatus === 'Late'
                                         ? "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400 font-black shadow-sm"
                                         : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-500/10 font-bold"
                                     )}
                                     title="Late"
                                   >
                                     <Clock className="w-4 h-4" />
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => handleQuickAttendance(student.id, 'Absent')}
                                     className={cn(
                                       "min-w-[38px] sm:min-w-[36px] min-h-[38px] sm:min-h-[36px] px-2.5 py-1.5 rounded-[6px] text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer border active:scale-90 touch-manipulation",
                                       currentStatus === 'Absent'
                                         ? "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-400 font-black shadow-sm"
                                         : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/10 font-bold"
                                     )}
                                     title="Absent"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                </div>
                             );
                          })()}

                          <button 
                            disabled={isProcessingId !== null || (isFull && !isEnrolled)}
                            onClick={() => handleToggleEnroll(student.id, isEnrolled)}
                            className={cn(
                              "w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-[8px] text-[11px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 border shadow-sm disabled:opacity-40 select-none cursor-pointer active:scale-95 touch-manipulation",
                              isEnrolled 
                                ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500"
                                : conflicts.length > 0
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-black hover:border-amber-500"
                                  : "bg-neutral-900 dark:bg-white border-neutral-950 dark:border-white text-white dark:text-black hover:bg-[#EF2F38] hover:text-white hover:border-[#EF2F38] dark:hover:bg-[#EF2F38] dark:hover:text-white dark:hover:border-[#EF2F38]"
                            )}
                          >

                            {isProcessingId === student.id ? (
                              <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : isEnrolled ? (
                              <><X className="w-3.5 h-3.5"/> {t('sch_remove')}</>
                            ) : (
                              <><Plus className="w-3.5 h-3.5"/> {t('sch_enroll')}</>
                            )}
                          </button>
                       </div>
                    </motion.div>
                  )
               })}
            </AnimatePresence>
            
            {filteredStudents.length === 0 && (
              <div className="text-center py-12 text-neutral-600 dark:text-neutral-400 text-xs font-mono bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm flex flex-col items-center justify-center gap-2">
                 <MagnifyingGlass className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
                 <span>{t('sch_no_candidates')}</span>
              </div>
            )}
         </div>

         {/* Floating Multi-Select Bottom Bar */}
         {activeTab === 'unenrolled' && selectedStudentIds.size > 0 && (
           <div className="p-3.5 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-t border-neutral-800 dark:border-neutral-200 flex items-center justify-between gap-3 shrink-0 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
             <div className="flex items-center gap-2">
               <span className="text-xs font-bold font-mono">
                 {selectedStudentIds.size} student{selectedStudentIds.size === 1 ? '' : 's'} selected
               </span>
               <button
                 type="button"
                 onClick={() => setSelectedStudentIds(new Set())}
                 className="text-[10px] text-neutral-300 dark:text-neutral-700 hover:text-white dark:hover:text-black underline cursor-pointer ml-1 p-1 active:scale-95 touch-manipulation"
               >
                 Clear
               </button>
             </div>
             <button
               type="button"
               disabled={isBatchEnrolling || isFull}
               onClick={handleBatchEnroll}
               className="px-4 py-2 min-h-[42px] bg-[#EF2F38] text-white rounded-[8px] text-[10px] font-black uppercase tracking-wider hover:bg-[#d4252e] transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation"
             >
               {isBatchEnrolling ? (
                 <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
               ) : (
                 <UserPlus className="w-3.5 h-3.5" />
               )}
               Enroll Selected ({selectedStudentIds.size})
             </button>
           </div>
         )}
      </motion.div>
    </div>
  );
}
