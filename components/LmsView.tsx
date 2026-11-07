'use client';

import { dialogMotion } from '@/lib/motion';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { canMarkLibraryLessonComplete, isPrivateLibraryDraft } from '@/lib/library-publication';
import { lessonThumbnailUrl } from '@/lib/lesson-media';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { PageHeader, SegmentedTabs } from './ui/PageHeader';
import { buttonClass } from './ui/styles';
import { useAppStore, CurriculumVideo } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { PlayCircle } from '@phosphor-icons/react/dist/csr/PlayCircle';

import { Trash } from '@phosphor-icons/react/dist/csr/Trash';

import { X } from '@phosphor-icons/react/dist/csr/X';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';

import { Clock } from '@phosphor-icons/react/dist/csr/Clock';

import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';

import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { CheckSquare } from '@phosphor-icons/react/dist/csr/CheckSquare';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';

import { Stack } from '@phosphor-icons/react/dist/csr/Stack';
import { Flame } from '@phosphor-icons/react/dist/csr/Flame';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import dynamic from 'next/dynamic';
import { AnatomyStudioModal } from '@/components/AnatomyStudioModal';
import { resolveAssetMuscleLoads } from '@/lib/anatomyUtils';

const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/60 rounded-[8px] p-6 border border-neutral-800 animate-pulse">
        <span className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-2" />
        <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">Loading 3D Anatomy...</span>
      </div>
    )
  }
);
import { cn, formatBeltLocalized, isBeltMatch, calculatePromotionReadiness, normalizeCategory, getCategoryTranslationKey, parseAssetDescription, isAllBeltsLesson, isSyllabusLessonFor } from '@/lib/utils';
import { LessonMediaPlayer } from '@/components/library/LessonMediaPlayer';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { BELTS as LIBRARY_BELTS } from '@/lib/library-catalog';
import { academyDate } from '@/lib/dates';
import { CoachScoreInput } from '@/components/students/CoachScoreInput';
import { useBeltEligibility } from '@/components/belt-tests/use-belt-eligibility';
import { RuleChips } from '@/components/belt-tests/RuleChips';
import { NextBeltTestPanel, StudentBeltTestHistory } from '@/components/belt-tests/BeltTestLinks';
import { useNextBeltTest } from '@/components/belt-tests/use-belt-links';
import { mergeBeltEligibility, beltEligibilitySummary } from '@/lib/belt-eligibility';

const BELTS: readonly string[] = LIBRARY_BELTS.filter(name => name !== 'All');
const LibraryPublicationPanel = dynamic(() => import('@/components/library/LibraryPublicationPanel').then(module => module.LibraryPublicationPanel), { ssr: false });

export function LmsView() {
  const { state, can, toggleVideoProgress } = useAppStore();
  const t = useT();
  const role = state.currentUser?.role;
  const isElevated = can('page:directory') || can('action:evaluations_grade');
  const canGradeProgress = can('action:evaluations_grade');

  const [activeTab, setActiveTab] = useState<'syllabus' | 'analytics'>('syllabus');
  const [activePlayVideo, setActivePlayVideo] = useState<CurriculumVideo | null>(null);
  const [playerTab, setPlayerTab] = useState<'overview' | 'guidance' | 'drills' | 'mistakes' | 'study' | 'biomechanics'>('overview');
  const [show3DStudio, setShow3DStudio] = useState(false);
  const [showPublicationPanel, setShowPublicationPanel] = useState(false);
  const [visibleLessonCount, setVisibleLessonCount] = useState(24);
  const lessonDialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(lessonDialogRef, () => setActivePlayVideo(null), !!activePlayVideo && !show3DStudio);
  const [selected3DAsset, setSelected3DAsset] = useState<CurriculumVideo | null>(null);

  const currentUser = state.currentUser;
  const currentStudent = currentUser?.role === 'Student'
    ? state.students.find(s =>
        (s.profileId && s.profileId === currentUser.id) ||
        (currentUser.studentId && s.id === currentUser.studentId)
      )
    : null;

  // Track student progress selector (for coaches to inspect a student or for student self-view)
  const [selectedStudentId, setSelectedStudentId] = useState<string>(currentStudent?.id || 'all');

  // Track belt filter (default to student's current belt if available, else White)
  const [selectedTrackBelt, setSelectedTrackBelt] = useState<string>(
    currentStudent?.currentBelt && BELTS.includes(currentStudent.currentBelt) ? currentStudent.currentBelt : 'White'
  );

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  useEffect(() => { setVisibleLessonCount(24); }, [search, categoryFilter, selectedTrackBelt]);

  const effectiveStudent = selectedStudentId !== 'all'
    ? state.students.find(s => s.id === selectedStudentId) || currentStudent
    : currentStudent;

  const handlePlayVideo = (video: CurriculumVideo) => {
    setActivePlayVideo(video);
    setPlayerTab('overview');
  };

  const openedMaterialLink = useRef<number | null>(null);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('material'));
    if (!Number.isSafeInteger(id) || id <= 0 || openedMaterialLink.current === id) return;
    const material = state.curriculumVideos.find(row => row.id === id);
    if (material) { openedMaterialLink.current = id; setActivePlayVideo(material); setPlayerTab('overview'); }
  }, [state.curriculumVideos]);

  // Parse each lesson's structured description once per data change.
  const detailsById = useMemo(() => new Map(state.curriculumVideos.map(video => [video.id, parseAssetDescription(video.description)] as const)), [state.curriculumVideos]);
  const lessonDetails = (video: CurriculumVideo) => detailsById.get(video.id) ?? parseAssetDescription(video.description);

  // Filter only Taekwondo Curriculum assets (not fitness/dance routines).
  // Students never see private drafts; staff see them labelled for review.
  const tkdCurriculum = state.curriculumVideos.filter(
    v => !(v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:') || v.category?.startsWith('Dance:')) && (role !== 'Student' || !isPrivateLibraryDraft(v))
  );

  // Belts syllabus videos for display
  const trackBeltVideos = selectedTrackBelt === 'All'
    ? tkdCurriculum
    : tkdCurriculum.filter(v => isAllBeltsLesson(v.minBeltLevel) || isBeltMatch(v.minBeltLevel, selectedTrackBelt));
  // Progress counts only lessons a student can actually be graded on.
  const requiredTrackVideos = trackBeltVideos.filter(v => !isPrivateLibraryDraft(v));

  // Filtered for display
  const searchText = search.trim().toLowerCase();
  const displayedVideos = trackBeltVideos.filter(v => {
    if (categoryFilter !== 'All' && normalizeCategory(v.category) !== normalizeCategory(categoryFilter)) return false;
    if (searchText && !v.title.toLowerCase().includes(searchText) && !lessonDetails(v).text.toLowerCase().includes(searchText)) return false;
    return true;
  });
  const sortedStudents = useMemo(() => [...state.students].sort((a, b) => (a.englishName || a.khmerName || '').localeCompare(b.englishName || b.khmerName || '')), [state.students]);
  // What this track's students are tested on at their next belt test (staff only).
  const nextTest = useNextBeltTest(isElevated && selectedTrackBelt !== 'All' ? selectedTrackBelt : null);
  const nextTestLessons = useMemo(() => new Set((nextTest.detail?.items ?? []).map(item => item.library_asset_id).filter((id): id is number => id != null)), [nextTest.detail]);

  // Calculate student watch progress
  const studentWatchedIds = new Set(
    effectiveStudent
      ? state.videoProgress
          .filter(p => p.studentId === effectiveStudent.id && p.status === 'Completed')
          .map(p => p.videoId)
      : []
  );

  const totalTrackRequired = requiredTrackVideos.length;
  const completedInTrack = requiredTrackVideos.filter(v => studentWatchedIds.has(v.id)).length;
  const trackCompletionPct = totalTrackRequired > 0 ? Math.round((completedInTrack / totalTrackRequired) * 100) : 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-5 pb-12 font-sans">
      <PageHeader
        icon={<GraduationCap weight="bold" />}
        eyebrow="E-Learning & Curriculum"
        title={t('lms_title')}
        description={t('lms_subtitle')}
        actions={(can('action:curriculum_edit') || isElevated) ? <>
          {can('action:curriculum_edit') && <button type="button" onClick={() => setShowPublicationPanel(true)} className={buttonClass()}>Student library</button>}
          {isElevated && can('page:library') && (
            <Link href="/library" className={buttonClass()}>
              <BookOpen className="h-4 w-4 text-brand" weight="bold" />
              <span>{can('action:curriculum_edit') ? t('lms_manage_in_library') : t('nav_library')}</span>
            </Link>
          )}
          {isElevated && (
            <button type="button" onClick={() => { setSelected3DAsset(null); setShow3DStudio(true); }} className={buttonClass()} title={t('lib_3d_studio')}>
              <Stack className="h-4 w-4 text-brand" weight="bold" />
              <span>{t('lib_3d_studio')}</span>
            </button>
          )}
        </> : undefined}
      />

      <SegmentedTabs label="E-learning views" value={activeTab} onChange={setActiveTab} items={[
        { id: 'syllabus', label: t('lms_tab_syllabus'), icon: <VideoCamera /> },
        { id: 'analytics', label: t('lms_tab_testing'), icon: <CheckSquare />, hidden: role === 'Student' },
      ]} />

      {activeTab === 'syllabus' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Belt Track Selector Strip */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-mono">
                Curriculum Belt Progression Track
              </span>
              <span className="text-[10px] sm:text-xs text-neutral-400 font-mono font-bold">
                {displayedVideos.length} Lessons Available
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              {BELTS.map(belt => {
                const isActive = selectedTrackBelt === belt;
                return (
                  <button
                    key={belt}
                    onClick={() => setSelectedTrackBelt(belt)}
                    className={cn(
                      "px-4 py-2 min-h-[42px] rounded-[8px] text-xs font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-2 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      isActive
                        ? "bg-[#EF2F38] text-white shadow-sm ring-2 ring-[#EF2F38]/20 font-black"
                        : "bg-neutral-50 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#252525] border border-neutral-200 dark:border-[#262626]"
                    )}
                  >
                    <span>{formatBeltLocalized(belt, undefined, t)}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedTrackBelt('All')}
                className={cn(
                  "px-4 py-2 min-h-[42px] rounded-[8px] text-xs font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer shrink-0 border active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                  selectedTrackBelt === 'All'
                    ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm ring-2 ring-[#EF2F38]/20 font-black"
                    : "bg-neutral-50 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#252525] border-neutral-200 dark:border-[#262626]"
                )}
              >
                {t('lib_all_belts')}
              </button>
            </div>
          </div>

          {/* Belt Track Hero & Filter Bar */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4 sm:space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[6px] text-[10px] font-bold uppercase tracking-wider font-mono">
                    {selectedTrackBelt === 'All' ? 'Complete Syllabus' : `${selectedTrackBelt} Belt Track`}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                    {totalTrackRequired} {t('lms_total_required')}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mt-1.5 tracking-tight">
                  {selectedTrackBelt === 'All' ? t('lms_tab_syllabus') : `${formatBeltLocalized(selectedTrackBelt, undefined, t)} Curriculum Progression`}
                </h2>
              </div>

              {/* Student Progress Badge or Selector */}
              {isElevated ? (
                <div className="flex items-center gap-2.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 min-h-[42px] shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 shrink-0 font-mono">
                    Track Student:
                  </span>
                  <select
                    aria-label="Track student"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer max-w-[220px] truncate"
                  >
                    <option value="all" className="dark:bg-[#1C1C1C]">Overview (No Student)</option>
                    {sortedStudents.map(s => (
                      <option key={s.id} value={s.id} className="dark:bg-[#1C1C1C]">
                        {s.englishName || s.khmerName} ({s.currentBelt})
                      </option>
                    ))}
                  </select>
                </div>
              ) : effectiveStudent ? (
                <div className="flex items-center gap-3 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-4 min-h-[42px] shadow-sm">
                  <UserCircle className="w-5 h-5 text-[#EF2F38]" weight="fill"/>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono">My Student Progress</span>
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {effectiveStudent.englishName || effectiveStudent.khmerName} ({effectiveStudent.currentBelt})
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Progress Bar (when student is tracked) */}
            {effectiveStudent && (
              <div className="pt-3 border-t border-neutral-200 dark:border-[#262626] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">
                    {t('lms_belt_progress')}: {completedInTrack} of {totalTrackRequired} Lessons Completed
                  </span>
                  <span className="font-mono font-bold text-[#EF2F38] text-sm">
                    {trackCompletionPct}%
                  </span>
                </div>
                <div className="w-full h-3 bg-neutral-100 dark:bg-[#0A0A0A] rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]">
                  <motion.div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      trackCompletionPct === 100 ? "bg-emerald-500" : trackCompletionPct >= 50 ? "bg-[#EF2F38]" : "bg-amber-500"
                    )}
                    initial={false}
                    animate={{ scaleX: Math.min(1, Math.max(0, trackCompletionPct / 100)) }}
                    style={{ transformOrigin: 'left', width: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none"/>
                <input
                  type="search"
                  aria-label={t('act_search')}
                  placeholder={t('act_search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium"
                />
              </div>

              <select
                aria-label={t('lib_all_categories')}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-64 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[8px] px-3.5 min-h-[42px] text-xs focus:outline-none focus:border-[#EF2F38] font-bold cursor-pointer shadow-sm pointer-coarse:min-h-11"
              >
                <option value="All">{t('lib_all_categories')}</option>
                <option value="Forms (Poomsae)">{t('cat_poomsae')}</option>
                <option value="Kicks (Chagi)">{t('cat_chagi')}</option>
                <option value="Stances & Footwork (Seogi)">{t('cat_seogi')}</option>
                <option value="Strikes (Jirugi/Chigi)">{t('cat_strikes')}</option>
                <option value="Blocks (Makki)">{t('cat_blocks')}</option>
                <option value="Sparring (Kyorugi)">{t('cat_kyorugi')}</option>
                <option value="Breaking (Kyokpa)">{t('cat_kyokpa')}</option>
                <option value="Self-Defense (Hosinsul)">{t('cat_hosinsul')}</option>
                <option value="Tricking & Acrobatics">{t('cat_tricking_acrobatics')}</option>
                <option value="Theory & Terminology">{t('cat_theory')}</option>
              </select>
            </div>
          </div>

          {isElevated && selectedTrackBelt !== 'All' && <NextBeltTestPanel test={nextTest} hasLesson={id => state.curriculumVideos.some(video => video.id === id)} onOpenLesson={id => { const lesson = state.curriculumVideos.find(video => video.id === id); if (lesson) handlePlayVideo(lesson); }} />}

          {/* Curriculum Lesson Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
            {displayedVideos.slice(0, visibleLessonCount).map(video => {
              const isWatched = studentWatchedIds.has(video.id);
              const parsed = lessonDetails(video);
              const thumbnail = lessonThumbnailUrl(parsed.thumbnailUrl, video.videoUrl);
              const isDraft = isPrivateLibraryDraft(video);

              return (
                <div
                  key={video.id}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden group flex flex-col hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-lg transition-all duration-300 shadow-sm"
                >
                  {/* Thumbnail Card (pointer shortcut; the Watch button is the accessible control) */}
                  <div
                    onClick={() => handlePlayVideo(video)}
                    className="aspect-video bg-neutral-900 relative flex items-center justify-center border-b border-neutral-200 dark:border-[#262626] cursor-pointer overflow-hidden"
                  >
                    <SafeImage src={thumbnail ?? undefined} alt="" width={480} height={270}
                      containerClassName="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-black"
                      className="h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
                      fallback={<span aria-hidden="true" />} />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors z-10" />

                    <PlayCircle className="w-12 h-12 text-white/90 z-20 group-hover:scale-110 group-hover:text-[#EF2F38] transition-all duration-300 shadow-lg"/>

                    <div className="absolute top-3 left-3 z-20 flex gap-1.5">
                       <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-[6px] text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 shadow-sm">
                         {isAllBeltsLesson(video.minBeltLevel) ? t('lib_all_belts') : `${video.minBeltLevel} Belt`}
                       </span>
                    </div>
                    {isDraft && (
                      <span className="absolute bottom-3 left-3 z-20 px-2 py-0.5 rounded-[6px] border border-amber-400/40 bg-amber-950/80 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                        Private draft · not counted
                      </span>
                    )}
                    {nextTestLessons.has(video.id) && (
                      <span className="absolute bottom-3 right-3 z-20 px-2 py-0.5 rounded-[6px] border border-emerald-400/40 bg-emerald-950/80 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                        On the {nextTest.next?.belt_name} test
                      </span>
                    )}

                    <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                       <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-[6px] text-[10px] font-bold uppercase tracking-wider text-red-300 border border-white/10 shadow-sm">
                         {t(getCategoryTranslationKey(video.category)) || video.category}
                       </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                     <div>
                       <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight line-clamp-2 mb-1.5 group-hover:text-[#EF2F38] transition-colors leading-snug">
                         {t.translateText(video.title)}
                       </h3>
                       <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                         {parsed.text ? t.translateText(parsed.text) : 'No description provided.'}
                       </p>
                     </div>

                     <div className="border-t border-neutral-100 dark:border-[#262626] pt-3 mt-auto space-y-2.5">
                       {/* Completion & Action Row */}
                       <div className="flex items-center justify-between gap-2">
                         {effectiveStudent && canGradeProgress ? (
                           <button
                             type="button"
                             disabled={!isWatched && !canMarkLibraryLessonComplete(video)}
                             onClick={(e) => {
                               e.stopPropagation();
                               void toggleVideoProgress(effectiveStudent.id, video.id, !isWatched).catch(() => {});
                             }}
                             className={cn(
                               "flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                               isWatched
                                 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                 : "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-300 dark:border-[#333] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-400"
                             )}
                             title={!isWatched && !canMarkLibraryLessonComplete(video) ? 'Publish this private draft before grading completion.' : isWatched ? t('lms_mark_incomplete') : t('lms_mark_complete')}
                           >
                             {isWatched ? <Check className="w-3.5 h-3.5" weight="bold"/> : <Clock className="w-3.5 h-3.5"/>}
                             <span>{isWatched ? t('lms_completed') : t('lms_pending')}</span>
                           </button>
                         ) : (
                           <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono">
                             {effectiveStudent ? (isWatched ? t('lms_completed') : t('lms_pending')) : <><Lock className="w-3.5 h-3.5"/>{video.minBeltLevel}+ {t('lms_belt_req_suffix')}</>}
                           </span>
                         )}

                         <button
                           type="button"
                           aria-label={`${t('lms_watch')}: ${video.title}`}
                           onClick={() => handlePlayVideo(video)}
                           className="px-3.5 py-1.5 min-h-[36px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-neutral-900 dark:text-white text-[10px] font-bold uppercase tracking-wider rounded-[6px] border border-neutral-300 dark:border-[#262626] transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1 pointer-coarse:min-h-11"
                         >
                           <PlayCircle size={14} className="text-[#EF2F38]" weight="fill" />
                           <span>{t('lms_watch')}</span>
                         </button>
                       </div>
                     </div>
                  </div>
                </div>
              );
            })}

            {displayedVideos.length > visibleLessonCount && <div className="col-span-full flex justify-center"><button type="button" onClick={() => setVisibleLessonCount(value => value + 24)} className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-xs font-semibold dark:border-neutral-700 dark:bg-[#141414]">Show more lessons · {visibleLessonCount} of {displayedVideos.length}</button></div>}
            {displayedVideos.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-[#141414] rounded-[10px] border border-dashed border-neutral-300 dark:border-[#262626] p-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-[#1C1C1C] flex items-center justify-center text-neutral-400 dark:text-neutral-500">
                  <VideoCamera className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white">{t('lms_no_videos')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
                  Try adjusting your search query, selecting another category, or viewing another belt syllabus.
                </p>
                {(search || categoryFilter !== 'All' || selectedTrackBelt !== 'All') && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('All');
                      setSelectedTrackBelt('All');
                    }}
                    className="px-4 py-2 bg-neutral-100 dark:bg-[#1C1C1C] hover:bg-neutral-200 dark:hover:bg-[#252525] text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <LmsAnalyticsTab/>
      )}

      {showPublicationPanel && <LibraryPublicationPanel onClose={() => setShowPublicationPanel(false)} onOpenMaterial={id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) { setShowPublicationPanel(false); handlePlayVideo(material); } }} />}
      {/* Theatre Mode Player Overlay */}
      <AnimatePresence>
        {activePlayVideo && (() => {
          const parsed = lessonDetails(activePlayVideo);
          const isTkd = activePlayVideo.category && !activePlayVideo.category.startsWith('Fitness:') && activePlayVideo.minBeltLevel !== 'Fitness';
          const isWatched = effectiveStudent ? studentWatchedIds.has(activePlayVideo.id) : false;
          const hasStudyContent = !!(parsed.terminology?.length || parsed.studyGuide?.length || parsed.performance?.length);
          const tabClass = (tab: typeof playerTab) => cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer min-h-[32px] pointer-coarse:min-h-11", playerTab === tab ? "bg-[#222] text-white border border-white/10" : "text-[#777] hover:text-white");
          const emptyTab = (message: string) => <p className="text-[10px] text-[#555] italic text-center py-6">{message}</p>;

          return (
            <Portal>
              <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                <motion.div
                  {...dialogMotion}
                  ref={lessonDialogRef} role="dialog" aria-modal="true" aria-labelledby="lesson-viewer-title" tabIndex={-1}
                  className="w-full max-w-6xl h-[88dvh] min-h-0 bg-[#0F0F0F] border border-[#262626] rounded-[10px] shadow-2xl flex flex-col overflow-hidden relative"
                >
                  {/* Close Button */}
                  <button
                    onClick={() => setActivePlayVideo(null)}
                    aria-label="Close lesson viewer"
                    className="absolute top-3 right-3 z-50 min-h-11 min-w-11 p-2.5 flex items-center justify-center bg-black/70 hover:bg-black/95 text-white rounded-full transition-all border border-white/10 active:scale-95 touch-manipulation cursor-pointer shadow-md"
                    title={t('act_close')}
                  >
                    <X className="w-4 h-4"/>
                  </button>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:flex-row md:overflow-hidden">
                  {/* Left Column: Player & Basic Info */}
                  <div className="flex shrink-0 flex-col bg-black md:h-full md:min-w-0 md:flex-1 md:overflow-hidden">
                    <div className="w-full bg-black relative flex items-center justify-center aspect-video shrink-0">
                      <LessonMediaPlayer url={activePlayVideo.videoUrl} title={activePlayVideo.title} className="absolute inset-0" />
                    </div>

                    {/* Basic Info (Scrollable) */}
                    <div className="p-5 md:flex-1 md:overflow-y-auto md:p-6 bg-[#141414] border-t border-[#262626] space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2.5 py-1 bg-red-500/10 text-[#EF2F38] border border-red-500/20 rounded-[6px] text-[9px] font-bold uppercase tracking-wider inline-block">
                            {t(getCategoryTranslationKey(activePlayVideo.category)) || activePlayVideo.category}
                          </span>
                          <h2 id="lesson-viewer-title" className="text-base md:text-lg font-bold text-white mt-2 tracking-tight">{t.translateText(activePlayVideo.title)}</h2>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] uppercase font-bold text-[#777] block tracking-wider">{t('lms_belt_req')}</span>
                          <span className="text-xs font-mono font-bold text-white mt-0.5 inline-block bg-[#1A1A1A] border border-[#262626] px-2 py-0.5 rounded-[6px]">{activePlayVideo.minBeltLevel} Belt</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-[#666] tracking-wider">Mechanics & Guidelines</span>
                        <p className="text-xs text-[#AAA] leading-relaxed font-sans whitespace-pre-line">{parsed.text ? t.translateText(parsed.text) : 'No description provided.'}</p>
                      </div>
                    </div>

                    {/* Dedicated Player Footer Bar */}
                    <div className="p-4 border-t border-[#262626] bg-[#0A0A0A] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        {effectiveStudent ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#888]">
                              {effectiveStudent.englishName || effectiveStudent.khmerName}:
                            </span>
                            <span className={cn(
                              "px-2.5 py-1 rounded-[6px] text-xs font-bold flex items-center gap-1.5 border",
                              isWatched
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-[#1A1A1A] border-[#333] text-[#888]"
                            )}>
                              {isWatched ? (
                                <><CheckCircle className="w-4 h-4 text-emerald-400" weight="fill"/> {t('lms_completed')}</>
                              ) : (
                                <><Clock className="w-4 h-4"/> {t('lms_pending')}</>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#666] font-mono">Curriculum Syllabus Preview</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {effectiveStudent && canGradeProgress && (
                          <button
                            type="button"
                            disabled={!isWatched && !canMarkLibraryLessonComplete(activePlayVideo)}
                            onClick={() => void toggleVideoProgress(effectiveStudent.id, activePlayVideo.id, !isWatched).catch(() => {})}
                            className={cn(
                              "px-4 py-2.5 rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border min-h-[40px] cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11",
                              isWatched
                                ? "bg-[#1A1A1A] border-[#333] text-[#AAA] hover:text-white hover:bg-[#252525]"
                                : "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-950/40"
                            )}
                          >
                            <Check className="w-4 h-4" weight="bold"/>
                            {isWatched ? t('lms_mark_incomplete') : t('lms_mark_complete')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActivePlayVideo(null)}
                          className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider transition-colors min-h-[40px] cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11"
                        >
                          {t('act_close')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Detailed Tab Info Panel */}
                  <div className="w-full shrink-0 min-h-64 md:w-[380px] md:min-h-0 border-t md:border-t-0 md:border-l border-[#262626] bg-[#0A0A0A] flex flex-col md:h-full overflow-hidden">
                    {/* Tab Buttons */}
                    <div className="flex border-b border-[#262626] p-2 bg-[#0F0F0F] shrink-0 overflow-x-auto gap-1">
                      <button type="button" aria-pressed={playerTab === 'overview'} onClick={() => setPlayerTab('overview')} className={tabClass('overview')}>
                        Overview
                      </button>
                      {isTkd && (
                        <>
                          <button type="button" aria-pressed={playerTab === 'guidance'} onClick={() => setPlayerTab('guidance')} className={tabClass('guidance')}>
                            Guidance
                          </button>
                          <button type="button" aria-pressed={playerTab === 'drills'} onClick={() => setPlayerTab('drills')} className={tabClass('drills')}>
                            Drills
                          </button>
                          <button type="button" aria-pressed={playerTab === 'mistakes'} onClick={() => setPlayerTab('mistakes')} className={tabClass('mistakes')}>
                            Mistakes
                          </button>
                        </>
                      )}
                      {hasStudyContent && (
                        <button type="button" aria-pressed={playerTab === 'study'} onClick={() => setPlayerTab('study')} className={tabClass('study')}>
                          Study
                        </button>
                      )}
                      <button
                        type="button"
                        aria-pressed={playerTab === 'biomechanics'}
                        onClick={() => setPlayerTab('biomechanics')}
                        className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1.5 min-h-[32px] pointer-coarse:min-h-11", playerTab === 'biomechanics' ? "bg-[#222] text-[#EF2F38] border border-[#EF2F38]/30" : "text-[#777] hover:text-white")}
                      >
                        <Stack className="w-3.5 h-3.5 text-[#EF2F38]" weight="bold"/>
                        <span>3D Studio</span>
                      </button>
                    </div>

                    {/* Tab Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {playerTab === 'overview' && (
                        <div className="space-y-4">
                          {/* Sets & Reps */}
                          <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px]">
                            <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider mb-1">Target Reps & Sets</span>
                            <span className="text-xs font-bold text-neutral-300 font-mono">{parsed.repsSets || t('lib_self_paced')}</span>
                          </div>

                          {/* Focus Zones */}
                          {parsed.focusZones && parsed.focusZones.length > 0 && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px]">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider mb-2">Target Focus Areas</span>
                              <div className="flex flex-wrap gap-1">
                                {parsed.focusZones.map((zone, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-[#262626] text-[#999] border border-white/5 text-[9px] font-black uppercase tracking-wider rounded">{zone}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Instructions */}
                          {parsed.instructions && parsed.instructions.length > 0 && (
                            <div className="space-y-2">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Execution Steps</span>
                              <ol className="space-y-2">
                                {parsed.instructions.map((step, idx) => {
                                  const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '');
                                  return (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-[#999] leading-relaxed">
                                      <span className="w-4 h-4 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                      <span>{cleanStep}</span>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          )}
                        </div>
                      )}

                      {playerTab === 'guidance' && isTkd && (
                        <div className="space-y-3">
                          {parsed.principles && parsed.principles.length > 0 && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-1.5">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Core Principles</span>
                              <ul className="space-y-1 text-xs text-[#999]">
                                {parsed.principles.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parsed.prerequisites && parsed.prerequisites.length > 0 && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-1.5">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Prerequisites</span>
                              <ul className="space-y-1 text-xs text-[#999]">
                                {parsed.prerequisites.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {!parsed.principles?.length && !parsed.prerequisites?.length && emptyTab('No principles or prerequisites have been added for this lesson.')}
                        </div>
                      )}

                      {playerTab === 'drills' && isTkd && (
                        <div className="space-y-3">
                          {parsed.drillingMethods && parsed.drillingMethods.length > 0 && (
                            <div className="p-3.5 bg-[#141414] border border-[#262626] rounded-[8px] space-y-2">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Drilling Methods</span>
                              <ul className="space-y-1.5">
                                {parsed.drillingMethods.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-[#999]">
                                    <span className="w-4 h-4 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {!parsed.drillingMethods?.length && emptyTab('No drilling methods have been added for this lesson.')}
                        </div>
                      )}

                      {playerTab === 'study' && hasStudyContent && (
                        <div className="space-y-3">
                          {!!parsed.performance?.length && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-1.5">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Performance criteria</span>
                              <ul className="space-y-1 text-xs text-[#999]">
                                {parsed.performance.map((item, idx) => <li key={idx} className="flex items-start gap-1.5">• {item}</li>)}
                              </ul>
                            </div>
                          )}
                          {!!parsed.terminology?.length && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-2">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Terminology</span>
                              <dl className="space-y-2 text-xs">
                                {parsed.terminology.map((term, idx) => (
                                  <div key={idx} className="border-b border-[#262626] pb-2 last:border-0 last:pb-0">
                                    <dt className="font-bold text-neutral-200">{term.korean || term.english}</dt>
                                    <dd className="text-[#999]">{[term.english, term.khmer].filter(value => value && value !== (term.korean || term.english)).join(' · ')}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                          {!!parsed.studyGuide?.length && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-2">
                              <span className="block text-[9px] uppercase font-black text-[#555] tracking-wider">Study guide</span>
                              {parsed.studyGuide.map((item, idx) => (
                                <details key={idx} className="rounded-[6px] border border-[#262626] bg-[#0F0F0F] p-2.5 text-xs">
                                  <summary className="cursor-pointer font-semibold text-neutral-200">{item.question || 'Question'}</summary>
                                  <p className="mt-2 text-[#999] whitespace-pre-line">{item.answer || '—'}</p>
                                </details>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {playerTab === 'mistakes' && isTkd && (
                        <div className="space-y-3">
                          {parsed.mistakes && parsed.mistakes.length > 0 ? (
                            parsed.mistakes.map((item, idx) => (
                              <div key={idx} className="border border-[#262626] rounded-[8px] overflow-hidden bg-[#111]/30 text-xs">
                                <div className="p-3 bg-red-500/[0.02] border-b border-[#262626] flex flex-col">
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 text-[9px] font-black uppercase tracking-wider mb-1.5 w-max">Mistake</span>
                                  <span className="text-[#E4E4E4] font-medium leading-relaxed font-sans">{item.mistake || "—"}</span>
                                </div>
                                <div className="p-3 bg-emerald-500/[0.02] flex flex-col">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase tracking-wider mb-1.5 w-max">Correction</span>
                                  <span className="text-[#E4E4E4] font-medium leading-relaxed font-sans">{item.correction || "—"}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-[#555] italic text-center py-6">No common mistakes logged for this skill.</p>
                          )}
                        </div>
                      )}

                      {playerTab === 'biomechanics' && (
                        <div className="space-y-4">
                          <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">3D Biomechanics View</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected3DAsset(activePlayVideo);
                                setShow3DStudio(true);
                              }}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-[#EF2F38] border border-red-500/30 rounded-[6px] text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <ArrowsOut className="w-3 h-3" />
                              <span>{t('lib_3d_fullscreen')}</span>
                            </button>
                          </div>

                          {(() => {
                            const { primaryMuscles, secondaryMuscles, muscleLoads } = resolveAssetMuscleLoads(activePlayVideo, state);
                            return (
                              <div className="space-y-3">
                                {primaryMuscles.length > 0 && (
                                  <div className="p-3 bg-[#141414] border border-red-500/20 rounded-[8px] space-y-1.5">
                                    <span className="text-[9px] uppercase font-black text-red-400 tracking-wider flex items-center gap-1">
                                      <Flame className="w-3 h-3 text-[#EF2F38]" weight="fill" />
                                      {t('lib_primary_muscles')}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {primaryMuscles.map(m => (
                                        <span key={m} className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold bg-red-500/10 border border-red-500/30 text-red-300">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {secondaryMuscles.length > 0 && (
                                  <div className="p-3 bg-[#141414] border border-amber-500/20 rounded-[8px] space-y-1.5">
                                    <span className="text-[9px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1">
                                      <Sparkle className="w-3 h-3 text-amber-500" weight="fill" />
                                      {t('lib_secondary_muscles')}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {secondaryMuscles.map(m => (
                                        <span key={m} className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="h-[420px] w-full rounded-[8px] overflow-hidden border border-[#262626] bg-[#0A0A0A] relative">
                                  <Anatomical3DModel
                                    muscleLoads={muscleLoads}
                                    maxLoad={1.0}
                                    gender={effectiveStudent?.gender ?? 'Male'}
                                    active={!show3DStudio}
                                    allowFullscreen={false}
                                    defaultViewMode="2d"
                                    context={{ kind: 'material', title: activePlayVideo.title, assetId: activePlayVideo.id, studentId: effectiveStudent?.id, sourceLabel: 'Material muscle focus', onOpenMaterial: id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) handlePlayVideo(material); } }}
                                    className="w-full h-full border-0 rounded-none bg-transparent"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </motion.div>
              </div>
            </Portal>
          );
        })()}
      </AnimatePresence>
      <AnatomyStudioModal isOpen={show3DStudio} onClose={() => setShow3DStudio(false)} asset={selected3DAsset} student={effectiveStudent} initialGender={effectiveStudent?.gender ?? 'Male'} onOpenMaterial={id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) handlePlayVideo(material); }} />
    </div>
  );
}

const BELT_TECHNIQUES: Record<string, string[]> = {
  'White': ['Ap Chagi (Front Kick Mastery)', 'Ap Seogi (Walking Stance Control)', 'Taegeuk Il Jang (Form 1 Execution)'],
  'Yellow': ['Dollyo Chagi (Roundhouse Mastery)', 'Ap Kubi (Forward Lunge Alignment)', 'Taegeuk Ee Jang (Form 2 Execution)'],
  'Green': ['Yop Chagi (Side Kick Mastery)', 'Dwit Kubi (Back Stance Balance)', 'Taegeuk Sam Jang (Form 3 Execution)'],
  'Blue': ['Bandal Chagi (Crescent Kick Control)', 'Dwit Kubi (Back Stance Transitions)', 'Taegeuk Sa Jang (Form 4 Execution)'],
  'Brown': ['Dwit Chagi (Back Kick Blind Chamber)', 'Beom Seogi (Tiger Stance Balance)', 'Taegeuk Oh Jang (Form 5 Execution)'],
  'Red': ['Duryeo Chagi (Spin Hook Kick Control)', 'Taegeuk Chil Jang (Form 7 Execution)', 'Special Board Breaking (Kyokpa)'],
  '1st Poom/Dan': ['Tornado Kick (360 Dollyo Chagi)', 'Koryo Poomsae Flow Mastery', 'WT Kyorugi Tactical Footwork'],
  '2nd Poom/Dan': ['540 Spinning Kick Mastery', 'Keumgang Poomsae Stance Hold', 'Tactical Cut-Kick Interception'],
  '3rd Poom/Dan': ['Special Acrobatics Demonstration', 'Taebaek Poomsae Technical Flow', 'High Performance WT Sparring Rules']
};

function LmsAnalyticsTab() {
  const { state, can, toggleVideoProgress, upsertPhysicalEvaluation, addBeltTechnique, deleteBeltTechnique, showNotification, showConfirm } = useAppStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [beltFilter, setBeltFilter] = useState('All');
  const [scheduleFilter, setScheduleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [genderFilter, setGenderFilter] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);


  // Dynamic technique management states
  const [manageBelt, setManageBelt] = useState('1st Poom/Dan');
  const [newTechnique, setNewTechnique] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [isSubmittingTech, setIsSubmittingTech] = useState(false);

  // Smart searchable dropdown states & refs
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [activeTechIdx, setActiveTechIdx] = useState(-1);
  const techDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  const SYLLABUS_CATEGORIES = [
    'Kicks (Chagi)',
    'Stances & Footwork (Seogi)',
    'Strikes (Jirugi/Chigi)',
    'Blocks (Makki)',
    'Forms (Poomsae)',
    'Sparring (Kyorugi)',
    'Breaking (Kyokpa)',
    'Self-Defense (Hosinsul)',
    'Tricking & Acrobatics',
    'Theory & Terminology'
  ];
  const [newCategory, setNewCategory] = useState('Kicks (Chagi)');

  // Filter Taekwondo assets (excluding Fitness library items)
  const taekwondoAssets = state.curriculumVideos.filter(
    v => !(v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:'))
  );

  // Filter options based on the currently selected Category in the form
  const categoryAssets = taekwondoAssets.filter(
    v => normalizeCategory(v.category) === normalizeCategory(newCategory)
  );

  const filteredAssets = newTechnique.trim()
    ? categoryAssets.filter(v => v.title.toLowerCase().includes(newTechnique.toLowerCase()))
    : categoryAssets;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (techDropdownRef.current && !techDropdownRef.current.contains(event.target as Node)) {
        setShowTechDropdown(false);
        setActiveTechIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll active dropdown item into view
  useEffect(() => {
    if (activeTechIdx >= 0 && dropdownListRef.current) {
      const activeEl = dropdownListRef.current.children[activeTechIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeTechIdx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showTechDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowTechDropdown(true);
        setActiveTechIdx(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveTechIdx(prev => (filteredAssets.length === 0 ? -1 : (prev + 1) % filteredAssets.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveTechIdx(prev => (filteredAssets.length === 0 ? -1 : (prev - 1 + filteredAssets.length) % filteredAssets.length));
        break;
      case 'Enter':
        if (activeTechIdx >= 0 && activeTechIdx < filteredAssets.length) {
          e.preventDefault();
          const selected = filteredAssets[activeTechIdx];
          setNewTechnique(selected.title);
          setNewCategory(normalizeCategory(selected.category));
          setShowTechDropdown(false);
          setActiveTechIdx(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowTechDropdown(false);
        setActiveTechIdx(-1);
        break;
      case 'Tab':
        setShowTechDropdown(false);
        setActiveTechIdx(-1);
        break;
      default:
        break;
    }
  };

  const getSkillGrade = (studentId: string, skill: string) => state.physicalEvaluations?.find(x => x.studentId === studentId && x.skillName === skill)?.grade || 'Unrated';
  const getSkillScore = (studentId: string, skill: string): number | null => state.physicalEvaluations?.find(x => x.studentId === studentId && x.skillName === skill)?.score ?? null;
  const handleGradePhysical = async (studentId: string, skill: string, beltLevel: string, grade: string) => {
    try { await upsertPhysicalEvaluation(studentId, skill, beltLevel, grade); }
    catch(error) { showNotification(error instanceof Error ? error.message : 'Grade was not saved.','error'); }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return 0;
    const today = new Date();
    const dobDate = new Date(dob);
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
    }
    return age;
  };

  const filteredStudents = state.students.filter(s => {
    // Status Filter
    if (statusFilter !== 'All' && s.studentStatus !== statusFilter) return false;

    // Branch Filter
    if (branchFilter !== 'All' && String(s.homeBranchId ?? '') !== branchFilter) return false;

    // Belt Filter
    if (beltFilter !== 'All' && s.currentBelt !== beltFilter) return false;

    // Gender Filter
    if (genderFilter !== 'All' && s.gender !== genderFilter) return false;

    // Schedule Filter
    if (scheduleFilter !== 'All') {
      const isEnrolled = state.classEnrollments.some(e => e.studentId === s.id && e.classId.toString() === scheduleFilter);
      if (!isEnrolled) return false;
    }

    // Search filter (English name, Khmer name, or Student ID)
    if (search) {
      const q = search.toLowerCase();
      const matchEnglish = s.englishName?.toLowerCase().includes(q);
      const matchKhmer = s.khmerName?.toLowerCase().includes(q);
      const matchId = s.id?.toLowerCase().includes(q);
      if (!matchEnglish && !matchKhmer && !matchId) return false;
    }

    return true;
  });

  const selectedStudent = selectedStudentId ? state.students.find(s => s.id === selectedStudentId) : null;
  const progressDialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(progressDialogRef, () => setSelectedStudentId(null), !!selectedStudent);

  // One readiness report per student per data change, instead of one per row on every keystroke.
  const today = academyDate();
  const readinessByStudent = useMemo(() => {
    void today; // Time-in-grade changes at the academy's midnight even when no data does.
    return new Map(state.students.map(student => [student.id, calculatePromotionReadiness(
      student, state.attendanceRecords, state.videoProgress, state.curriculumVideos, state.beltHistories, state.physicalEvaluations, state.beltTechniques,
    )] as const));
  }, [state.students, state.attendanceRecords, state.videoProgress, state.curriculumVideos, state.beltHistories, state.physicalEvaluations, state.beltTechniques, today]);
  // Ready to test = the Belt Tests eligibility engine wherever a syllabus is published (the same answer the student portal shows).
  const beltEligibility = useBeltEligibility();
  const readinessFor = (student: (typeof state.students)[number]) => mergeBeltEligibility(readinessByStudent.get(student.id) ?? calculatePromotionReadiness(
    student, state.attendanceRecords, state.videoProgress, state.curriculumVideos, state.beltHistories, state.physicalEvaluations, state.beltTechniques,
  ), beltEligibility.entries[student.id]);

  const canManageTechniques = can('action:curriculum_edit');
  const canGrade = can('action:evaluations_grade');

  const handleAddTechnique = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTechnique.trim();
    if (!cleanName) return;

    // Validation 1: Enforce selection from the library
    const matchedAsset = taekwondoAssets.find(v => v.title.toLowerCase() === cleanName.toLowerCase());
    if (!matchedAsset) {
      showNotification("The selected technique must exist in the library.", 'error');
      return;
    }

    // Validation 2: Prevent duplicates/overlaps (no data overlap)
    const exactTitle = matchedAsset.title; // use canonical title
    const overlapMatch = state.beltTechniques.find(
      x => x.techniqueName.toLowerCase() === exactTitle.toLowerCase()
    );

    if (overlapMatch) {
      if (getBeltKeyLocal(overlapMatch.beltLevel) === getBeltKeyLocal(manageBelt)) {
        showNotification("Technique is already in the syllabus for this belt.", 'error');
      } else {
        showNotification(`Technique is already assigned to ${overlapMatch.beltLevel} syllabus.`, 'error');
      }
      return;
    }

    setIsSubmittingTech(true);
    try {
      await addBeltTechnique(manageBelt, exactTitle, newCategory);
      setNewTechnique('');
      setShowTechDropdown(false);
      setActiveTechIdx(-1);
    } catch (err: any) {
      showNotification(err.message || 'Failed to add technique.', 'error');
    } finally {
      setIsSubmittingTech(false);
    }
  };

  const handleDeleteTech = async (id: string) => {
    showConfirm('Are you sure you want to delete this dynamic requirement?', async () => {
      try {
        await deleteBeltTechnique(id);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete technique.', 'error');
      }
    });
  };

  const getBeltKeyLocal = (belt: string) => {
    if (!belt) return 'White';
    const clean = belt.trim();
    if (clean.startsWith('1')) return '1st Poom/Dan';
    if (clean.startsWith('2')) return '2nd Poom/Dan';
    if (clean.startsWith('3')) return '3rd Poom/Dan';
    return clean;
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Technique Rubric Manager (Coaches Only) */}
      {canManageTechniques && (
        <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight uppercase">{t('lms_skills_syllabus')}</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('lms_skills_syllabus_desc')}</p>
            </div>
            <button
              onClick={() => setShowManager(!showManager)}
              className="px-4 py-2 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#E4E4E4] hover:text-[#EF2F38] hover:border-[#EF2F38]/40 font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors min-h-[38px] cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11"
            >
              {showManager ? t('lms_close_editor') : t('lms_edit_belt_skills')}
            </button>
          </div>

          {showManager && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 dark:border-[#262626]">
              {/* Form Column */}
              <form onSubmit={handleAddTechnique} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">{t('lms_choose_belt')}</label>
                  <select
                    value={manageBelt}
                    onChange={e => setManageBelt(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38] min-h-[42px]"
                  >
                    {BELTS.map(b => <option key={b} value={b}>{formatBeltLocalized(b, undefined, t)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">{t('lms_category')}</label>
                  <select
                    value={newCategory}
                    onChange={e => {
                      setNewCategory(e.target.value);
                      setNewTechnique('');
                      setShowTechDropdown(false);
                      setActiveTechIdx(-1);
                    }}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38] min-h-[42px]"
                  >
                    {SYLLABUS_CATEGORIES.map(cat => <option key={cat} value={cat}>{t(getCategoryTranslationKey(cat)) || cat}</option>)}
                  </select>
                </div>

                <div className="relative" ref={techDropdownRef}>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">{t('lms_new_skill_name')}</label>
                  <input
                    type="text"
                    value={newTechnique}
                    onChange={e => {
                      setNewTechnique(e.target.value);
                      setShowTechDropdown(true);
                      setActiveTechIdx(0);
                    }}
                    onFocus={() => {
                      setShowTechDropdown(true);
                      setActiveTechIdx(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t('lms_placeholder_tornado_kick')}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-[#555] min-h-[42px]"
                  />
                  {showTechDropdown && filteredAssets.length > 0 && (
                    <div
                      ref={dropdownListRef}
                      className="absolute left-0 right-0 mt-1 max-h-[220px] overflow-y-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-xl z-50 py-1"
                    >
                      {filteredAssets.map((asset, idx) => {
                        const isHighlighted = idx === activeTechIdx;
                        return (
                          <div
                            key={asset.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setNewTechnique(asset.title);
                              setNewCategory(normalizeCategory(asset.category));
                              setShowTechDropdown(false);
                              setActiveTechIdx(-1);
                            }}
                            className={cn(
                              "px-3 py-2 text-xs cursor-pointer flex justify-between items-center transition-colors",
                              isHighlighted
                                ? "bg-red-50 dark:bg-[#1A1A1A] text-[#EF2F38] dark:text-white font-bold"
                                : "text-neutral-700 dark:text-[#999] hover:bg-neutral-100 dark:hover:bg-[#141414] hover:text-neutral-900 dark:hover:text-[#E4E4E4]"
                            )}
                          >
                            <span className="truncate pr-2">{asset.title}</span>
                            <span className="text-[9px] text-neutral-500 dark:text-[#666] shrink-0 font-mono bg-neutral-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#262626] uppercase">
                              {t(getCategoryTranslationKey(asset.category)) || asset.category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {showTechDropdown && filteredAssets.length === 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-xl z-50 p-3 text-center text-xs text-neutral-400 dark:text-[#555] italic">
                      No matching techniques in library.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTech}
                  className="w-full py-2.5 min-h-[42px] bg-[#EF2F38] text-white font-bold uppercase tracking-wider text-[11px] rounded-[8px] hover:bg-[#d6262f] transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  {isSubmittingTech ? t('act_saving') : t('lms_add_skill_to_belt')}
                </button>
              </form>

              {/* Active Requirements List Column */}
              <div className="space-y-3 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-4 rounded-[10px] max-h-[340px] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2 mb-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-800 dark:text-[#E4E4E4] tracking-wider">{manageBelt} Requirements</span>
                  <span className="px-2 py-0.5 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-[9px] text-neutral-500 dark:text-[#666] font-mono rounded-[6px]">
                    {state.beltTechniques.filter(x => getBeltKeyLocal(x.beltLevel) === getBeltKeyLocal(manageBelt)).length} items
                  </span>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const beltTechs = state.beltTechniques.filter(x => getBeltKeyLocal(x.beltLevel) === getBeltKeyLocal(manageBelt));
                    const categories = Array.from(new Set(beltTechs.map(t => t.category || 'Kicks (Chagi)')));

                    if (beltTechs.length === 0) {
                      return (
                        <div className="text-center py-8 text-neutral-400 dark:text-[#555] italic text-xs">
                          No custom techniques configured. Defaulting to system fallback list.
                        </div>
                      );
                    }

                    return categories.map(cat => (
                      <div key={cat} className="space-y-1.5">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#EF2F38] mb-1">{cat}</div>
                        <div className="space-y-1.5">
                          {beltTechs
                            .filter(t => (t.category || 'Kicks (Chagi)') === cat)
                            .map(tech => (
                              <div key={tech.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                                <span className="text-xs text-neutral-800 dark:text-neutral-200 font-semibold">{tech.techniqueName}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTech(tech.id)}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                                  title={t('act_delete')}
                                >
                                  <Trash className="w-4 h-4"/>
                                </button>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Premium Filter Controls Grid */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 space-y-4 shadow-sm">
        {/* Row 1: Search and Status / Gender filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-[#666]" />
            <input
              type="text"
              placeholder={t('dir_search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-sm focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666]"
            />
          </div>

          <div className="md:col-span-3">
             <select
               value={statusFilter}
               onChange={e => setStatusFilter(e.target.value)}
               className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38]"
             >
               <option value="All">{t.translateText('All Statuses')}</option>
               <option value="Active">{t.translateText('Active')}</option>
               <option value="Inactive">{t.translateText('Inactive')}</option>
               <option value="Suspended">{t.translateText('Suspended')}</option>
               <option value="Graduated">{t.translateText('Graduated')}</option>
             </select>
          </div>

          <div className="md:col-span-3">
             <select
               value={genderFilter}
               onChange={e => setGenderFilter(e.target.value)}
               className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38]"
             >
               <option value="All">{t.translateText('All Genders')}</option>
               <option value="Male">{t.translateText('Male')}</option>
               <option value="Female">{t.translateText('Female')}</option>
             </select>
          </div>
        </div>

        {/* Row 2: Branch, Schedule, and Belt filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
             <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">Branch</label>
             <select
               value={branchFilter}
               onChange={e => {
                 setBranchFilter(e.target.value);
                 setScheduleFilter('All');
               }}
               className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38]"
             >
               <option value="All">{t('att_all_branches')}</option>
               {state.branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
             </select>
          </div>

          <div>
             <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">{t('sch_title')}</label>
             <select
               value={scheduleFilter}
               onChange={e => setScheduleFilter(e.target.value)}
               className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38]"
             >
               <option value="All">{t.translateText('All Schedules')}</option>
               {state.classSessions
                 .filter(c => branchFilter === 'All' || c.branchId.toString() === branchFilter)
                 .map(c => {
                   const branchName = state.branches.find(b => b.id === c.branchId)?.name || '';
                   const prefix = branchFilter === 'All' && branchName ? `[${branchName}] ` : '';
                   return (
                     <option key={c.id} value={c.id.toString()}>
                       {prefix}{c.name} ({c.dayOfWeek} {c.startTime.substring(0, 5)}-{c.endTime.substring(0, 5)})
                     </option>
                   );
                 })}
             </select>
          </div>

          <div>
             <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5">{t('stu_belt')}</label>
             <select
               value={beltFilter}
               onChange={e => setBeltFilter(e.target.value)}
               className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#EF2F38]"
             >
               <option value="All">{t('dir_all_belts')}</option>
               {BELTS.map(b => <option key={b} value={b}>{formatBeltLocalized(b, undefined, t)}</option>)}
             </select>
          </div>
        </div>
      </div>

      {/* Table Listing */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
             <thead>
                <tr className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626]">
                   <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest">{t('fin_student')}</th>
                   <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest text-center">{t.translateText("Modules Completed")}</th>
                   <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest text-center">{t('stu_belt')}</th>
                   <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest text-right">{t('lms_belt_eligibility')}</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-neutral-100 dark:divide-[#262626]">
                {filteredStudents.map(student => {
                  const report = readinessFor(student);

                  const completedCount = report.completedVideos;
                  const totalAvailable = report.totalVideos;
                  const eligibilityStatus = report.eligibilityStatus;
                  const pri = report.pri;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer group"
                    >
                         <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                               <SafeImage
                                  src={student.profilePicturePath}
                                  alt={student.englishName}
                                  containerClassName="w-10 h-10 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex items-center justify-center font-bold text-sm text-neutral-500 dark:text-[#666] overflow-hidden shrink-0"
                                  fallback={student.englishName.charAt(0)}
                               />
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <button type="button" onClick={event => { event.stopPropagation(); setSelectedStudentId(student.id); }} className="text-left text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF2F38]">{student.englishName}</button>
                                     {student.khmerName && (
                                        <span className="text-xs text-neutral-500 dark:text-[#999] font-khmer">{student.khmerName}</span>
                                     )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-500 dark:text-[#666] font-mono">
                                     <span>{student.id}</span>
                                     <span>•</span>
                                     <span className="capitalize">{student.gender?.toLowerCase() || 'N/A'}</span>
                                     {student.dob && (
                                        <>
                                           <span>•</span>
                                           <span>{calculateAge(student.dob)} y/o</span>
                                        </>
                                     )}
                                  </div>
                               </div>
                            </div>
                         </td>
                         <td className="px-4 py-3 text-center">
                            <span className="text-xs font-mono font-bold text-neutral-800 dark:text-[#E4E4E4]">{completedCount} <span className="text-neutral-400 dark:text-[#666] font-normal">/ {totalAvailable}</span></span>
                         </td>
                         <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-[#999]">
                              {formatBeltLocalized(student.currentBelt, student.dob, t)}
                            </span>
                         </td>
                         <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 font-mono">PRI: {pri}%</span>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider border",
                                    eligibilityStatus === 'Ready' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" :
                                    eligibilityStatus === 'Developing' ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400" :
                                    "bg-neutral-100 dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-[#666]"
                                  )}>
                                    {eligibilityStatus === 'Ready' ? 'Ready' : eligibilityStatus === 'Developing' ? 'Developing' : 'Needs Work'}
                                  </span>
                               </div>
                               {report.beltTest && <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{beltEligibilitySummary(report.beltTest)}</span>}
                               <div className="w-32 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-full h-1.5 overflow-hidden relative">
                                  <div className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    eligibilityStatus === 'Ready' ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                                    eligibilityStatus === 'Developing' ? "bg-gradient-to-r from-sky-500 to-indigo-500" :
                                    "bg-neutral-400 dark:bg-neutral-600"
                                  )} style={{ width: `${pri}%` }} />
                                </div>
                            </div>
                         </td>
                      </tr>
                  )
                })}
             </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div className="text-center py-10 text-neutral-400 dark:text-[#666] text-xs font-mono border-t border-neutral-200 dark:border-[#262626]">{t('lms_no_students_match')}</div>
          )}
        </div>
      </div>

      {/* Student Progress Detail Modal with Premium Profile Card */}
      <AnimatePresence>
        {selectedStudent && (
          <Portal>
             <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                <motion.div
                   {...dialogMotion}
                   ref={progressDialogRef} role="dialog" aria-modal="true" aria-labelledby="lms-progress-title" tabIndex={-1}
                   className="w-full max-w-2xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden"
                >
                   {/* Modal Header */}
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414]">
                      <div>
                        <h2 id="lms-progress-title" className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{t('lms_progress_status')}</h2>
                        <p className="text-xs text-neutral-500 dark:text-[#999] mt-0.5">{selectedStudent.englishName} ({selectedStudent.id})</p>
                      </div>
                      <button
                        type="button"
                        aria-label={t('act_close')}
                        onClick={() => setSelectedStudentId(null)}
                        className="min-h-10 min-w-10 flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        title={t('act_close')}
                      >
                        <X className="w-5 h-5" />
                      </button>
                   </div>

                   {/* Modal Content Frame (Scrollable) */}
                   <div className="p-5 md:p-6 overflow-y-auto space-y-6">

                      {/* Premium Student Profile Overview Card */}
                      <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 flex flex-col md:flex-row gap-5 items-start">
                        <SafeImage
                           src={selectedStudent.profilePicturePath}
                           alt={selectedStudent.englishName}
                           containerClassName="w-20 h-20 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[10px] flex items-center justify-center font-bold text-3xl text-neutral-400 dark:text-[#666] overflow-hidden shrink-0 shadow-md"
                           fallback={selectedStudent.englishName.charAt(0)}
                        />
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                           <div className="sm:col-span-2 md:col-span-3 border-b border-neutral-200 dark:border-[#262626] pb-2 mb-1 flex items-center justify-between">
                              <div>
                                 <div className="flex items-center gap-3">
                                    <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">{selectedStudent.englishName}</h3>
                                    {selectedStudent.khmerName && (
                                       <span className="text-sm text-neutral-500 dark:text-[#999] font-khmer">{selectedStudent.khmerName}</span>
                                    )}
                                 </div>
                                 <p className="text-[10px] text-neutral-400 dark:text-[#666] font-mono mt-0.5 uppercase">ID: {selectedStudent.id}</p>
                              </div>
                              <span className="px-2.5 py-1 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-[10px] font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4]">
                                 {formatBeltLocalized(selectedStudent.currentBelt, selectedStudent.dob, t)}
                              </span>
                           </div>

                           <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('lms_status_gender')}</span>
                              <span className="text-xs text-neutral-800 dark:text-[#E4E4E4] font-medium flex items-center gap-1.5 mt-0.5">
                                 <span className={cn(
                                   "inline-block w-1.5 h-1.5 rounded-full",
                                   selectedStudent.studentStatus === 'Active' ? 'bg-green-500' :
                                   selectedStudent.studentStatus === 'Inactive' ? 'bg-gray-400' :
                                   selectedStudent.studentStatus === 'Suspended' ? 'bg-red-500' : 'bg-blue-500'
                                 )} />
                                 {selectedStudent.studentStatus === 'Active' ? t('act_active') :
                                  selectedStudent.studentStatus === 'Inactive' ? t('act_inactive') :
                                  selectedStudent.studentStatus === 'Suspended' ? t('act_suspended') :
                                  selectedStudent.studentStatus === 'Graduated' ? t('act_graduated') :
                                  selectedStudent.studentStatus} • {
                                    !selectedStudent.gender ? 'N/A' :
                                    selectedStudent.gender === 'Male' ? t('stu_male') :
                                    selectedStudent.gender === 'Female' ? t('stu_female') :
                                    selectedStudent.gender
                                  }
                              </span>
                           </div>

                           <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('lms_age_dob')}</span>
                              <span className="text-xs text-neutral-800 dark:text-[#E4E4E4] font-medium mt-0.5 block">
                                 {selectedStudent.dob ? `${calculateAge(selectedStudent.dob)} ${(state.language || 'en') === 'kh' ? 'ឆ្នាំ' : (state.language || 'en') === 'zh' ? '岁' : 'y/o'} (${selectedStudent.dob})` : 'N/A'}
                              </span>
                           </div>

                           <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('lms_home_branch')}</span>
                              <span className="text-xs text-neutral-800 dark:text-[#E4E4E4] font-medium mt-0.5 block">
                                 {state.branches.find(b => b.id === selectedStudent.homeBranchId)?.name || 'Unknown'}
                              </span>
                           </div>

                           <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('lms_contact_info')}</span>
                              <span className="text-xs text-neutral-800 dark:text-[#E4E4E4] font-medium mt-0.5 block font-mono">
                                 {selectedStudent.phone || t('stf_no_phone')}
                              </span>
                           </div>

                           <div className="sm:col-span-2">
                              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('lms_enrolled_schedules')}</span>
                              <span className="text-xs text-neutral-800 dark:text-[#E4E4E4] mt-0.5 block font-medium">
                                 {state.classEnrollments.filter(e => e.studentId === selectedStudent.id).length > 0 ? (
                                    state.classEnrollments
                                       .filter(e => e.studentId === selectedStudent.id)
                                       .map(e => state.classSessions.find(c => c.id === e.classId))
                                       .filter(Boolean)
                                       .map(c => `${c!.name} (${c!.dayOfWeek} ${c!.startTime.substring(0, 5)}-${c!.endTime.substring(0, 5)})`)
                                       .join(', ')
                                 ) : (
                                    <span className="text-neutral-400 dark:text-[#555] italic">{t('lms_not_enrolled')}</span>
                                 )}
                              </span>
                           </div>
                        </div>
                      </div>

                      {/* 1. Dynamic Promotion Readiness Scoreboard */}
                      {(() => {
                         const report = readinessFor(selectedStudent);

                         const startDate = report.startDate;
                         const daysElapsedCount = report.daysElapsed;
                         const attendanceSinceCount = report.attendanceSince;
                         const syllabusCompletedPct = report.syllabusCompletedPct;

                         const daysPct = report.daysProgress;
                         const attendPct = report.attendanceProgress;

                         const getBeltKey = (belt: string) => {
                           if (!belt) return 'White';
                           const clean = belt.trim();
                           if (clean.startsWith('1')) return '1st Poom/Dan';
                           if (clean.startsWith('2')) return '2nd Poom/Dan';
                           if (clean.startsWith('3')) return '3rd Poom/Dan';
                           return clean;
                         };

                         const targetSkillsKey = getBeltKey(selectedStudent.currentBelt);

                         // Load techniques dynamically from database with category, fallback to static defaults if empty
                         const dynamicSkills = state.beltTechniques
                           .filter(x => getBeltKey(x.beltLevel) === targetSkillsKey)
                           .map(x => ({ name: x.techniqueName, category: x.category || 'Kicks (Chagi)' }));

                         const targetSkills = dynamicSkills.length > 0 ? dynamicSkills : (BELT_TECHNIQUES[targetSkillsKey] || []).map(name => {
                           let category = 'Kicks (Chagi)';
                           if (name.includes('Form') || name.includes('Poomsae') || name.includes('Execution')) category = 'Forms (Poomsae)';
                           else if (name.includes('Stance') || name.includes('Alignment') || name.includes('Seogi') || name.includes('Kubi')) category = 'Stances & Footwork (Seogi)';
                           else if (name.includes('Sparring') || name.includes('Footwork') || name.includes('Interception') || name.includes('Rules')) category = 'Sparring (Kyorugi)';
                           else if (name.includes('Breaking') || name.includes('Kyokpa')) category = 'Breaking (Kyokpa)';
                           else if (name.includes('Acrobatics') || name.includes('Demonstration')) category = 'Tricking & Acrobatics';
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
                            <>
                               {/* Readiness Scoreboard Panel */}
                               <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 space-y-4">
                                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-neutral-200 dark:border-[#262626] pb-3 gap-3">
                                     <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{t('lms_pri_scorecard')}</h3>
                                        <p className="text-[10px] text-neutral-500 dark:text-[#666] mt-0.5 font-mono">Evaluation date since: {startDate}</p>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-neutral-900 dark:text-white font-mono bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] px-2.5 py-0.5 rounded-[6px]">PRI: {report.pri}%</span>
                                        <span className={cn(
                                           "px-2.5 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider border transition-all duration-300",
                                           report.eligibilityStatus === 'Ready' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-md shadow-amber-500/5" :
                                           report.eligibilityStatus === 'Developing' ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400" :
                                           "bg-neutral-100 dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-[#666]"
                                        )}>
                                           {report.eligibilityStatus === 'Ready' ? `★ ${t('dir_ready_for_test')}` : report.eligibilityStatus === 'Developing' ? t('dir_developing') : t('dir_needs_work')}
                                        </span>
                                     </div>
                                  </div>
                                  {report.beltTest ? <div className="space-y-2 rounded-[8px] border border-neutral-200 bg-white p-3 dark:border-[#262626] dark:bg-[#0F0F0F]">
                                     <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">Belt test eligibility · {report.beltTest.targetBelt}</span><Link href="/belt-tests" className="text-[10px] font-semibold text-[#EF2F38] underline">Open Belt Tests</Link></div>
                                     <RuleChips entry={{ eligibility: report.beltTest }} />
                                     <p className="text-[10px] text-neutral-500">Ready is decided by the published {report.beltTest.targetBelt} test rules, the same check students see in the student portal. The index above still shows overall progress.</p>
                                  </div> : <p className="text-[10px] text-neutral-500">No published belt test syllabus for this student&apos;s next belt yet, so readiness uses the academy&apos;s standard requirements.</p>}

                                  {/* Sleek Overall PRI Progress Bar */}
                                  <div className="space-y-1.5 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px]">
                                     <div className="flex justify-between items-center text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">
                                        <span>{t('lms_overall_progress')}</span>
                                        <span>{report.pri === 100 ? t('lms_mastery_achieved') : report.pri >= 80 ? t('lms_excellent') : report.pri >= 50 ? t('dir_developing') : t('lms_beginning')}</span>
                                     </div>
                                     <div className="w-full bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-full h-2.5 overflow-hidden relative">
                                        <div className={cn(
                                           "h-full rounded-full transition-all duration-500",
                                           report.eligibilityStatus === 'Ready' ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500" :
                                           report.eligibilityStatus === 'Developing' ? "bg-gradient-to-r from-sky-500 to-indigo-500" :
                                           "bg-red-500/60"
                                        )} style={{ width: `${report.pri}%` }} />
                                     </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                     <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-4 rounded-[8px]">
                                        <div className="flex justify-between items-center mb-1">
                                           <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] tracking-wider">{t('lms_time_in_grade_min').replace('{days}', String(report.daysRequired))}</span>
                                           <span className={cn("text-xs font-mono font-bold", report.daysEligible ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>{daysElapsedCount} / {report.daysRequired}d</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#141414] rounded-full overflow-hidden">
                                           <div className={cn("h-full rounded-full transition-all", report.daysEligible ? 'bg-green-500' : 'bg-red-500')} style={{ width: `${daysPct}%` }} />
                                        </div>
                                     </div>

                                     <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-4 rounded-[8px]">
                                        <div className="flex justify-between items-center mb-1">
                                           <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] tracking-wider">{t('lms_attendance_min').replace('{count}', String(report.attendanceRequired))}</span>
                                           <span className={cn("text-xs font-mono font-bold", report.attendanceEligible ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>{attendanceSinceCount} / {report.attendanceRequired}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#141414] rounded-full overflow-hidden">
                                           <div className={cn("h-full rounded-full transition-all", report.attendanceEligible ? 'bg-green-500' : 'bg-red-500')} style={{ width: `${attendPct}%` }} />
                                        </div>
                                     </div>

                                     <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-4 rounded-[8px]">
                                        <div className="flex justify-between items-center mb-1">
                                           <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] tracking-wider">{t('lms_syllabus_videos_req')}</span>
                                           <span className={cn("text-xs font-mono font-bold", syllabusCompletedPct === 100 ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500')}>{syllabusCompletedPct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#141414] rounded-full overflow-hidden">
                                           <div className={cn("h-full rounded-full transition-all", syllabusCompletedPct === 100 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${syllabusCompletedPct}%` }} />
                                        </div>
                                     </div>
                                  </div>
                               </div>

                               {/* Physical Techniques Assessment Matrix */}
                               {Object.keys(groupedSkills).length > 0 && (
                                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-5 space-y-4">
                                     <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{t('lms_skill_grading_title')}</h3>
                                        <p className="text-[10px] text-neutral-500 dark:text-[#666] mt-0.5">{t('lms_skill_grading_desc')}</p>
                                     </div>

                                     <div className="space-y-6">
                                        {Object.entries(groupedSkills).map(([category, skills]) => (
                                           <div key={category} className="space-y-2">
                                              <h4 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider border-b border-neutral-200 dark:border-[#262626] pb-1.5 mb-2">
                                                 {t(getCategoryTranslationKey(category)) || category}
                                              </h4>
                                              <div className="space-y-2">
                                                 {skills.map(skillName => {
                                                    const studentGrade = getSkillGrade(selectedStudent.id, skillName);
                                                    const getLocalizedLevel = (lvl: string) => {
                                                       if (lvl === 'Needs Work') return t('dir_needs_work');
                                                       if (lvl === 'Developing') return t('dir_developing');
                                                       if (lvl === 'Proficient') return t('lms_proficient');
                                                       if (lvl === 'Outstanding') return t('lms_outstanding');
                                                       return lvl;
                                                    };
                                                    return (
                                                       <div key={skillName} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] gap-2 hover:border-neutral-300 dark:hover:border-[#333] transition-colors">
                                                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{skillName}</span>

                                                          <div className="flex gap-1.5 flex-wrap">
                                                             {!canGrade && <span className="text-xs text-neutral-600 dark:text-neutral-300">{getLocalizedLevel(studentGrade)}{getSkillScore(selectedStudent.id, skillName) != null ? ` · ${getSkillScore(selectedStudent.id, skillName)}/10` : ''}</span>}
                                                             {canGrade && <CoachScoreInput skill={skillName} score={getSkillScore(selectedStudent.id, skillName)} onSave={score => upsertPhysicalEvaluation(selectedStudent.id, skillName, selectedStudent.currentBelt, getSkillGrade(selectedStudent.id, skillName), score)} />}
                                                             {canGrade && (['Needs Work', 'Developing', 'Proficient', 'Outstanding'] as const).map(level => {
                                                                const isActive = studentGrade === level;
                                                                return (
                                                                   <button
                                                                      key={level}
                                                                      type="button"
                                                                      onClick={() => handleGradePhysical(selectedStudent.id, skillName, selectedStudent.currentBelt, level)}
                                                                      className={cn(
                                                                         "px-3 py-1.5 rounded-[6px] border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[34px] touch-manipulation active:scale-95 pointer-coarse:min-h-11",
                                                                         isActive
                                                                            ? (level === 'Outstanding' ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' :
                                                                               level === 'Proficient' ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' :
                                                                               level === 'Developing' ? 'bg-sky-600 border-sky-500 text-white shadow-sm' :
                                                                               'bg-red-600 border-red-500 text-white shadow-sm')
                                                                            : "bg-neutral-100 dark:bg-[#141414] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#777] hover:text-neutral-900 dark:hover:text-[#AAA]"
                                                                      )}
                                                                   >
                                                                      {getLocalizedLevel(level)}
                                                                   </button>
                                                                );
                                                             })}
                                                          </div>
                                                       </div>
                                                    );
                                                 })}
                                              </div>
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               )}
                            </>
                         );
                      })()}

                      <StudentBeltTestHistory studentId={selectedStudent.id} />

                      {/* Required Videos Checklist */}
                      <div className="space-y-4">
                         <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t.translateText("Required Videos Checklist")}</h3>
                         <div className="space-y-3">
                           {/* Taekwondo syllabus only, with the student's current-belt requirements first. */}
                           {taekwondoAssets
                             .filter(video => !video.category?.startsWith('Dance:'))
                             .map(video => ({ video, current: isSyllabusLessonFor(video, selectedStudent.currentBelt) }))
                             .sort((a, b) => Number(b.current) - Number(a.current))
                             .map(({ video, current: isCurrentBeltRequirement }) => {
                              const progress = state.videoProgress.find(p => p.videoId === video.id && p.studentId === selectedStudent.id);
                              const isCompleted = progress?.status === 'Completed';
                              const isDraft = isPrivateLibraryDraft(video);

                              return (
                                <div key={video.id} className={cn("border rounded-[8px] p-4 flex items-center justify-between transition-all", isCurrentBeltRequirement ? "bg-red-500/5 border-red-500/30" : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626]")}>
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{t.translateText(video.title)}</h4>
                                        {isCurrentBeltRequirement && !isDraft && (
                                          <span className="px-2 py-0.5 bg-red-500/10 text-[#EF2F38] border border-red-500/20 rounded-[6px] text-[9px] font-bold uppercase tracking-wider">
                                            {t.translateText("Current Syllabus")}
                                          </span>
                                        )}
                                        {isDraft && (
                                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-[6px] text-[9px] font-bold uppercase tracking-wider">
                                            Private draft
                                          </span>
                                        )}
                                     </div>
                                      <p className="text-[10px] text-neutral-500 dark:text-[#666] uppercase font-bold tracking-wider mt-1">
                                        {t(getCategoryTranslationKey(video.category)) || video.category} • {t('lms_belt_req')}: {video.minBeltLevel}
                                      </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {canGrade && <label className="relative inline-flex items-center cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isCompleted}
                                        disabled={!isCompleted && !canMarkLibraryLessonComplete(video)}
                                        aria-label={`Mark ${video.title} completed`}
                                        onChange={(e) => void toggleVideoProgress(selectedStudent.id, video.id, e.target.checked).catch(() => {})}
                                        className="sr-only peer"
                                      />
                                      <div className="w-9 h-5 bg-neutral-200 dark:bg-[#262626] rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-[#EF2F38] peer-disabled:opacity-40 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-[#666] peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                                    </label>}
                                    <span className={cn("text-[10px] font-bold tracking-wider uppercase w-16 text-right", isCompleted ? "text-emerald-600 dark:text-emerald-500" : "text-neutral-400 dark:text-[#666]")}>
                                      {isCompleted ? t('lms_completed') : t('lms_pending')}
                                     </span>
                                  </div>
                                </div>
                              )
                            })}
                            {taekwondoAssets.length === 0 && (
                              <div className="text-center py-6 text-neutral-400 dark:text-[#666] text-xs font-mono">{t('lms_no_videos_available')}</div>
                            )}
                         </div>
                      </div>
                   </div>
                </motion.div>
             </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
