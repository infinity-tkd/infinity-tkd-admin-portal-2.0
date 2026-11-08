'use client';

import type React from 'react';
import { getBeltKey, DEFAULT_BELT_TECHNIQUES, cn, isSyllabusLessonFor } from '@/lib/utils';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { SafeImage } from '@/components/SafeImage';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { RuleChips } from '@/components/belt-tests/RuleChips';
import Link from 'next/link';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { StudentBeltTestHistory } from '@/components/belt-tests/BeltTestLinks';
import { CoachScoreInput } from '@/components/students/CoachScoreInput';
import type { AppState, Student } from '@/lib/store';
import type { PromotionReadinessReport } from '@/lib/utils';
import type { Eligibility } from '@/lib/belt-test-contract';
import type { TranslatorFn } from '@/hooks/useTranslation';

export interface CurriculumAuditTabProps {
  can: (permissionKey: string, targetUserId?: string | undefined) => boolean;
  getNextBeltRank: (currentBelt: string) => string;
  getStudentPromotionData: (student: Student) => PromotionReadinessReport & { beltTest: Eligibility | null; };
  handleOpenSinglePromote: (studentId: string) => void;
  promotionSearch: string;
  reconcileAllStudentBelts: () => Promise<{ success: boolean; scanned: number; corrected: number; details: string[]; }>;
  selectedBeltPipelineFilter: string | null;
  selectedStudentForCurriculum: string | null;
  setPromotionSearch: React.Dispatch<React.SetStateAction<string>>;
  setSelectedStudentForCurriculum: React.Dispatch<React.SetStateAction<string | null>>;
  setStateRevision: React.Dispatch<React.SetStateAction<number>>;
  state: AppState;
  t: TranslatorFn;
  upsertPhysicalEvaluation: (studentId: string, skillName: string, beltLevel: string, grade: string, score?: number | null | undefined) => Promise<void>;
}

export function CurriculumAuditTab({ can, getNextBeltRank, getStudentPromotionData, handleOpenSinglePromote, promotionSearch, reconcileAllStudentBelts, selectedBeltPipelineFilter, selectedStudentForCurriculum, setPromotionSearch, setSelectedStudentForCurriculum, setStateRevision, state, t, upsertPhysicalEvaluation }: CurriculumAuditTabProps) {
  const activeId = selectedStudentForCurriculum || (state.students.length > 0 ? state.students[0].id : null);
  const activeStudentObj = state.students.find(s => s.id === activeId);
  const auditData = activeStudentObj ? getStudentPromotionData(activeStudentObj) : null;
  const targetBelt = activeStudentObj ? getNextBeltRank(activeStudentObj.currentBelt) : 'Yellow';
  const targetBeltKey = getBeltKey(targetBelt);

  // Dynamically load techniques from state.beltTechniques, fallback to DEFAULT_BELT_TECHNIQUES
  const dynamicSkills = state.beltTechniques
    .filter(x => getBeltKey(x.beltLevel) === targetBeltKey)
    .map(x => ({ name: x.techniqueName, category: x.category || 'Kicks (Chagi)' }));

  const targetSkills = dynamicSkills.length > 0 ? dynamicSkills : (DEFAULT_BELT_TECHNIQUES[targetBeltKey] || []).map(name => {
    let category = 'Kicks (Chagi)';
    if (name.includes('Form') || name.includes('Poomsae') || name.includes('Jang')) category = 'Forms (Poomsae)';
    else if (name.includes('Stance') || name.includes('Seogi') || name.includes('Kubi')) category = 'Stances & Footwork';
    else if (name.includes('Sparring') || name.includes('Kyorugi') || name.includes('Footwork')) category = 'Sparring (Kyorugi)';
    else if (name.includes('Breaking') || name.includes('Kyokpa')) category = 'Breaking (Kyokpa)';
    else if (name.includes('Acrobatics') || name.includes('Demonstration')) category = 'Special Techniques';
    return { name, category };
  });

  // Group skills by category
  const groupedSkills = targetSkills.reduce((acc, skill) => {
    const cat = skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill.name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 flex-1 overflow-hidden animate-in fade-in">

      {/* Left side student selector */}
      <div className="w-full md:w-80 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 flex flex-col max-h-[190px] md:max-h-full transition-colors shadow-xs shrink-0">
        <div className="mb-2 sm:mb-3">
          <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">{t('dir_select_student')}</h3>
          <p className="text-[9px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">Select candidate to inspect curriculum audit</p>
        </div>

        <div className="relative mb-2.5 shrink-0">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
          <input
            type="text"
            placeholder="Filter student..."
            value={promotionSearch}
            onChange={(e) => setPromotionSearch(e.target.value)}
            className="w-full pl-8 pr-2 h-8 md:h-9 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[6px] md:rounded-[8px] text-[11px] md:text-xs focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-[#666]"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {state.students
            .filter(s => {
              const matchesSearch = s.englishName.toLowerCase().includes(promotionSearch.toLowerCase()) || s.id.toLowerCase().includes(promotionSearch.toLowerCase());
              const matchesBelt = !selectedBeltPipelineFilter || s.currentBelt === selectedBeltPipelineFilter;
              return matchesSearch && matchesBelt;
            })
            .map(student => {
              const isSelected = activeId === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentForCurriculum(student.id)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-[8px] border text-xs flex items-center justify-between transition-all font-bold cursor-pointer active:scale-95 touch-manipulation",
                    isSelected
                      ? "bg-[#EF2F38] border-[#EF2F38] text-white shadow-md shadow-[#EF2F38]/20"
                      : "bg-neutral-50 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A]"
                  )}
                >
                  <div className="truncate pr-2">
                    <div className={cn("text-xs font-bold", isSelected ? "text-white" : "text-neutral-900 dark:text-white")}>
                      {student.englishName}
                    </div>
                    <div className={cn("text-[9px] font-mono mt-0.5", isSelected ? "text-white/80" : "text-neutral-500 dark:text-neutral-400")}>
                      {student.id}
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] uppercase tracking-wider shrink-0 border",
                    isSelected ? "bg-white/20 border-white/30 text-white" : "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200"
                  )}>
                    {student.currentBelt}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Right side audit details */}
      <div className="flex-1 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-6 overflow-y-auto flex flex-col space-y-5 sm:space-y-6 transition-colors shadow-xs">
        {activeStudentObj && auditData ? (
          <>
            {/* Dossier Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-[#262626] pb-4">
              <div className="flex items-center gap-3">
                <SafeImage
                  src={activeStudentObj.profilePicturePath}
                  alt={activeStudentObj.englishName}
                  containerClassName="w-12 h-12 rounded-[8px] overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">{activeStudentObj.englishName}</h2>
                    {activeStudentObj.khmerName && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-khmer">{activeStudentObj.khmerName}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5 font-semibold">
                    {t('dir_dossier_id')}: {activeStudentObj.id} • {state.branches.find(b => b.id === activeStudentObj.homeBranchId)?.name} • Reg: {activeStudentObj.registrationDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-neutral-50 dark:bg-[#0F0F0F] px-4 py-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] font-bold">
                <div className="text-center space-y-0.5">
                  <span className="text-[9px] text-neutral-500 dark:text-[#888] uppercase block font-semibold">{t('dir_current_rank')}</span>
                  <span className="text-[10px] text-neutral-900 dark:text-white uppercase tracking-widest font-black">{activeStudentObj.currentBelt}</span>
                </div>
                <CaretRight className="w-4 h-4 text-neutral-400 dark:text-[#666]" />
                <div className="text-center space-y-0.5">
                  <span className="text-[9px] text-[#EF2F38] uppercase block font-black">{t('dir_target_rank')}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-widest font-black">{targetBelt}</span>
                </div>
              </div>
            </div>

            {/* Promotion Readiness Index (PRI) Banner */}
            <div className={cn(
              "p-3.5 sm:p-4 rounded-[8px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs",
              auditData.eligibilityStatus === 'Ready'
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                : auditData.eligibilityStatus === 'Developing'
                ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                : "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-300"
            )}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-white dark:bg-[#141414] border border-current shadow-xs">
                    {auditData.pri}% PRI SCORE
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider">
                    Status: {auditData.eligibilityStatus}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {auditData.eligibilityStatus === 'Ready'
                    ? (auditData.beltTest ? `Meets every published ${auditData.beltTest.targetBelt} test rule. Register them on a ${auditData.beltTest.targetBelt} test day in Belt Tests.` : `All time, attendance, syllabus, and technique requirements satisfied for ${targetBelt} Belt Exam.`)
                    : auditData.eligibilityStatus === 'Developing'
                    ? `Candidate is progressing well towards ${targetBelt}. Continue training on incomplete requirements.`
                    : `Candidate has not yet completed prerequisite attendance or time-in-grade cycles.`}
                </p>
                {auditData.beltTest && <div className="space-y-1.5 pt-1"><RuleChips entry={{ eligibility: auditData.beltTest }} /><Link href="/belt-tests" className="inline-block text-[11px] font-semibold underline">Open Belt Tests</Link></div>}
              </div>

              {auditData.eligibilityStatus === 'Ready' && activeStudentObj.studentStatus === 'Active' && (
                <button
                  type="button"
                  onClick={() => handleOpenSinglePromote(activeStudentObj.id)}
                  className="w-full sm:w-auto px-4 h-9 pointer-coarse:h-11 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[6px] text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Promote Now</span>
                </button>
              )}
            </div>

            <StudentBeltTestHistory studentId={activeStudentObj.id} />

            {/* Multi-Vector Requirements Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Requirement 1: Time in Grade */}
              <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#AAA] tracking-wider">Time in Grade</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.2 rounded uppercase border",
                    auditData.daysEligible ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-[#888] border-neutral-300 dark:border-transparent"
                  )}>
                    {auditData.daysEligible ? 'PASSED' : 'PENDING'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-neutral-900 dark:text-white">
                    <span>{auditData.daysElapsed}/{auditData.daysRequired}d</span>
                    <span>{auditData.daysProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", auditData.daysEligible ? "bg-emerald-500" : "bg-neutral-500")}
                      style={{ width: `${Math.min(100, auditData.daysProgress)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Requirement 2: Class Attendance */}
              <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#AAA] tracking-wider">Attendance</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.2 rounded uppercase border",
                    auditData.attendanceEligible ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-[#888] border-neutral-300 dark:border-transparent"
                  )}>
                    {auditData.attendanceEligible ? 'PASSED' : 'PENDING'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-neutral-900 dark:text-white">
                    <span>{auditData.attendanceSince}/{auditData.attendanceRequired} cl</span>
                    <span>{auditData.attendanceProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", auditData.attendanceEligible ? "bg-emerald-500" : "bg-neutral-500")}
                      style={{ width: `${Math.min(100, auditData.attendanceProgress)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Requirement 3: LMS Video Syllabus */}
              <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#AAA] tracking-wider">LMS Syllabus</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.2 rounded uppercase border",
                    auditData.syllabusEligible ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-[#888] border-neutral-300 dark:border-transparent"
                  )}>
                    {auditData.syllabusEligible ? 'PASSED' : 'PENDING'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-neutral-900 dark:text-white">
                    <span>{auditData.completedVideos}/{auditData.totalVideos} vids</span>
                    <span>{auditData.syllabusCompletedPct}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", auditData.syllabusEligible ? "bg-emerald-500" : "bg-indigo-500")}
                      style={{ width: `${auditData.syllabusCompletedPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Requirement 4: Physical Technique Skills */}
              <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#AAA] tracking-wider">Skill Rating</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.2 rounded uppercase border",
                    auditData.physicalEligible ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-[#888] border-neutral-300 dark:border-transparent"
                  )}>
                    {auditData.physicalEligible ? 'PASSED' : 'PENDING'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-neutral-900 dark:text-white">
                    <span>{auditData.skillsGradedCount}/{auditData.totalSkillsCount} rated</span>
                    <span className="truncate">{auditData.physicalAverageGradeLabel}</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", auditData.physicalEligible ? "bg-emerald-500" : "bg-amber-500")}
                      style={{ width: `${auditData.totalSkillsCount > 0 ? Math.min(100, (auditData.skillsGradedCount / auditData.totalSkillsCount) * 100) : 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Technique Checklist Assessment */}
            <div className="space-y-4">
              <div className="border-b border-neutral-200 dark:border-[#262626] pb-2">
                <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Physical Technique Assessment ({targetBelt})
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-[#777] font-mono mt-0.5">
                  Grade each core skill to determine promotion eligibility. Ratings save instantly.
                </p>
              </div>

              {Object.entries(groupedSkills).map(([category, skills]) => (
                <div key={category} className="space-y-2">
                  <h5 className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {category}
                  </h5>
                  <div className="grid grid-cols-1 gap-2">
                    {skills.map(techName => {
                      const evalObj = state.physicalEvaluations.find(e => e.studentId === activeStudentObj.id && e.skillName === techName);
                      const currentGrade = evalObj?.grade;

                      return (
                        <div
                          key={techName}
                          className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-300 dark:hover:border-[#333] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center border text-[9px] shrink-0 font-black",
                              evalObj && ['Outstanding', 'Proficient', 'Developing', 'A', 'B', 'C'].includes(evalObj.grade)
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
                            )}>
                              ✓
                            </div>
                            <span className="text-xs text-neutral-900 dark:text-white font-bold truncate">
                              {techName}
                            </span>
                          </div>

                          {/* 4-Tier Interactive Grade Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {(['Needs Work', 'Developing', 'Proficient', 'Outstanding'] as const).map(level => {
                              const isMatch = currentGrade === level ||
                                (level === 'Outstanding' && currentGrade === 'A') ||
                                (level === 'Proficient' && currentGrade === 'B') ||
                                (level === 'Developing' && currentGrade === 'C') ||
                                (level === 'Needs Work' && currentGrade === 'F');

                              return (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await upsertPhysicalEvaluation(activeStudentObj.id, techName, targetBelt, level);
                                      await reconcileAllStudentBelts();
                                      setStateRevision(prev => prev + 1);
                                    } catch (err) {
                                      console.error('Failed to grade:', err);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 sm:px-2.5 py-1 rounded-[6px] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 touch-manipulation border shrink-0",
                                    isMatch
                                      ? (level === 'Outstanding' ? 'bg-emerald-600 border-emerald-500 text-white font-black shadow-xs' :
                                         level === 'Proficient' ? 'bg-indigo-600 border-indigo-500 text-white font-black shadow-xs' :
                                         level === 'Developing' ? 'bg-amber-500 border-amber-400 text-black font-black shadow-xs' :
                                         'bg-rose-600 border-rose-500 text-white font-black shadow-xs')
                                      : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-[#383838]"
                                  )}
                                >
                                  <span className="sm:hidden">{level === 'Outstanding' ? 'A' : level === 'Proficient' ? 'B' : level === 'Developing' ? 'C' : 'F'}</span>
                                  <span className="hidden sm:inline">
                                    {level === 'Outstanding' ? 'A (Outstanding)' :
                                     level === 'Proficient' ? 'B (Proficient)' :
                                     level === 'Developing' ? 'C (Developing)' :
                                     'F (Needs Work)'}
                                  </span>
                                </button>
                              );
                            })}
                            {can('action:evaluations_grade') && (
                              <CoachScoreInput
                                skill={techName}
                                score={evalObj?.score}
                                onSave={score => upsertPhysicalEvaluation(activeStudentObj.id, techName, targetBelt, currentGrade || 'Unrated', score)}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Required Videos Checklist */}
            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-[#262626]">
              <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                Required LMS Curriculum Videos ({activeStudentObj.currentBelt})
              </h4>
              <div className="space-y-2">
                {state.curriculumVideos
                  .filter(v => isSyllabusLessonFor(v, activeStudentObj.currentBelt))
                  .map(video => {
                    const progress = state.videoProgress.find(p => p.videoId === video.id && p.studentId === activeStudentObj.id);
                    const isCompleted = progress?.status === 'Completed';

                    return (
                      <div key={video.id} className="flex items-center justify-between p-2.5 rounded-[6px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <div className={cn("w-2 h-2 rounded-full", isCompleted ? "bg-emerald-500" : "bg-neutral-400")} />
                          <span className="font-bold text-neutral-900 dark:text-white truncate">{video.title}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">({video.category})</span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0",
                          isCompleted ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-500 border-neutral-200 dark:border-[#262626]"
                        )}>
                          {isCompleted ? 'Completed' : 'Not Watched'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

          </>
        ) : (
          <div className="text-center py-16 text-neutral-500 dark:text-[#666] font-mono text-xs">
            {t('dir_register_prompt')}
          </div>
        )}
      </div>

    </div>
  );
}
