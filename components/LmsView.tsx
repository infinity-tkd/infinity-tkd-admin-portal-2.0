'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppStore, CurriculumVideo } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  VideoCamera, MagnifyingGlass, CheckCircle, Lock, PlayCircle, Eye, 
  Trash, ShieldWarning, X, UserCircle, Calendar, Clock, Barbell, Check,
  BookOpen, CaretRight, GraduationCap, CheckSquare, Sparkle, ArrowSquareOut,
  Stack, Flame, ArrowsOut
} from '@phosphor-icons/react';
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
import { cn, formatBelt, formatBeltLocalized, isBeltMatch, calculatePromotionReadiness, normalizeCategory, getCategoryTranslationKey, parseAssetDescription, getYouTubeId, getEmbedVideoUrl, AssetDetails } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';

const BELTS = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'];

export function LmsView() {
  const { state, toggleVideoProgress, markVideoWatched, showNotification, showConfirm } = useAppStore();
  const t = useT();
  const role = state.currentUser?.role;
  const isElevated = role === 'Root' || role === 'Super Root' || role === 'Admin' || role === 'Head Coach' || role === 'Coach';

  const [activeTab, setActiveTab] = useState<'syllabus' | 'analytics'>('syllabus');
  const [activePlayVideo, setActivePlayVideo] = useState<CurriculumVideo | null>(null);
  const [playerTab, setPlayerTab] = useState<'overview' | 'guidance' | 'drills' | 'mistakes' | 'biomechanics'>('overview');
  const [show3DStudio, setShow3DStudio] = useState(false);
  const [selected3DAsset, setSelected3DAsset] = useState<CurriculumVideo | null>(null);

  const currentUser = state.currentUser;
  const currentStudent = currentUser?.role === 'Student' 
    ? state.students.find(s => 
        (s.profileId && s.profileId === currentUser.id) ||
        (currentUser.studentId && s.id === currentUser.studentId) ||
        (s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) || 
        s.id.toLowerCase().replace(/-/g, '_') === currentUser.username.toLowerCase() ||
        s.id.toLowerCase() === currentUser.username.toLowerCase()
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

  const effectiveStudent = selectedStudentId !== 'all'
    ? state.students.find(s => s.id === selectedStudentId) || currentStudent
    : currentStudent;

  const handlePlayVideo = (video: CurriculumVideo) => {
    setActivePlayVideo(video);
    setPlayerTab('overview');
    if (effectiveStudent) {
      markVideoWatched(effectiveStudent.id, video.id);
    }
  };

  // Filter only Taekwondo Curriculum assets (not fitness/dance routines)
  const tkdCurriculum = state.curriculumVideos.filter(
    v => !(v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:') || v.category?.startsWith('Dance:'))
  );

  // Belts syllabus videos for progress stats
  const trackBeltVideos = selectedTrackBelt === 'All' 
    ? tkdCurriculum 
    : tkdCurriculum.filter(v => v.minBeltLevel === selectedTrackBelt);

  // Filtered for display
  const displayedVideos = trackBeltVideos.filter(v => {
    if (categoryFilter !== 'All' && normalizeCategory(v.category) !== normalizeCategory(categoryFilter)) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Calculate student watch progress
  const studentWatchedIds = new Set(
    effectiveStudent
      ? state.videoProgress
          .filter(p => p.studentId === effectiveStudent.id && p.status === 'Completed')
          .map(p => p.videoId)
      : []
  );

  const totalTrackRequired = trackBeltVideos.length;
  const completedInTrack = trackBeltVideos.filter(v => studentWatchedIds.has(v.id)).length;
  const trackCompletionPct = totalTrackRequired > 0 ? Math.round((completedInTrack / totalTrackRequired) * 100) : 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6 pb-12 font-sans">
      {/* Top Header Panel */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm">
            <GraduationCap className="w-6 h-6 text-[#EF2F38]" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[6px] text-[10px] font-bold uppercase tracking-wider font-mono">
                E-Learning & Curriculum
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight mt-0.5">
              {t('lms_title')}
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tracking-wide mt-0.5">
              {t('lms_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isElevated && (
            <>
              <Link
                href="/library"
                className="px-4 py-2 min-h-[42px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 active:scale-95 touch-manipulation"
              >
                <BookOpen className="w-4 h-4 text-[#EF2F38]" weight="bold" />
                <span>{t('lms_manage_in_library')}</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSelected3DAsset(null);
                  setShow3DStudio(true);
                }}
                className="px-4 py-2 min-h-[42px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 cursor-pointer active:scale-95 touch-manipulation"
                title={t('lib_3d_studio')}
              >
                <Stack className="w-4 h-4 text-[#EF2F38]" weight="bold" />
                <span>{t('lib_3d_studio')}</span>
              </button>
            </>
          )}

          <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-1 gap-1">
            <button
              onClick={() => setActiveTab('syllabus')}
              className={cn(
                "px-4 py-2 min-h-[42px] rounded-[6px] text-xs font-bold transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1.5",
                activeTab === 'syllabus'
                  ? "bg-white dark:bg-[#1A1A1A] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-[#333]"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <VideoCamera className="w-4 h-4 text-[#EF2F38]" />
              <span>{t('lms_tab_syllabus')}</span>
            </button>
            {role !== 'Student' && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "px-4 py-2 min-h-[42px] rounded-[6px] text-xs font-bold transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1.5",
                  activeTab === 'analytics'
                    ? "bg-white dark:bg-[#1A1A1A] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-[#333]"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <CheckSquare className="w-4 h-4 text-[#EF2F38]" />
                <span>{t('lms_tab_testing')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
                      "px-4 py-2 min-h-[42px] rounded-[8px] text-xs font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-2 active:scale-95 touch-manipulation",
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
                  "px-4 py-2 min-h-[42px] rounded-[8px] text-xs font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer shrink-0 border active:scale-95 touch-manipulation",
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
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer max-w-[220px] truncate"
                  >
                    <option value="all" className="dark:bg-[#1C1C1C]">Overview (No Student)</option>
                    {state.students.map(s => (
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
                    initial={{ width: 0 }}
                    animate={{ width: String(trackCompletionPct) + "%" }}
                  />
                </div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none"/>
                <input 
                  type="text" 
                  placeholder={t('act_search')} 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 min-h-[42px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium"
                />
              </div>

              <select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-64 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[8px] px-3.5 min-h-[42px] text-xs focus:outline-none focus:border-[#EF2F38] font-bold cursor-pointer shadow-sm"
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

          {/* Curriculum Lesson Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
            {displayedVideos.map(video => {
              const isWatched = studentWatchedIds.has(video.id);
              const parsed = parseAssetDescription(video.description);
              let bgImage = parsed.thumbnailUrl;
              if (!bgImage && video.videoUrl) {
                const ytId = getYouTubeId(video.videoUrl);
                if (ytId) bgImage = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
              }
              if (!bgImage) bgImage = `https://picsum.photos/seed/${video.id}/400/200`;

              return (
                <div 
                  key={video.id} 
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden group flex flex-col hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-lg transition-all duration-300 shadow-sm"
                >
                  {/* Thumbnail Card */}
                  <div 
                    onClick={() => handlePlayVideo(video)} 
                    className="aspect-video bg-neutral-900 relative flex items-center justify-center border-b border-neutral-200 dark:border-[#262626] cursor-pointer overflow-hidden"
                  >
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-60 blur-[0.5px] transition-transform duration-500 group-hover:scale-105" 
                      style={{ backgroundImage: `url('${bgImage}')` }}
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors z-10" />
                    
                    <PlayCircle className="w-12 h-12 text-white/90 z-20 group-hover:scale-110 group-hover:text-[#EF2F38] transition-all duration-300 shadow-lg"/>
                    
                    <div className="absolute top-3 left-3 z-20 flex gap-1.5">
                       <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-[6px] text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 shadow-sm">
                         {video.minBeltLevel} Belt
                       </span>
                    </div>

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
                         {t.translateText(parsed.text || video.description)}
                       </p>
                     </div>

                     <div className="border-t border-neutral-100 dark:border-[#262626] pt-3 mt-auto space-y-2.5">
                       {/* Completion & Action Row */}
                       <div className="flex items-center justify-between gap-2">
                         {effectiveStudent ? (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleVideoProgress(effectiveStudent.id, video.id, !isWatched);
                             }}
                             className={cn(
                               "flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer active:scale-95 touch-manipulation",
                               isWatched
                                 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                 : "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-300 dark:border-[#333] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-400"
                             )}
                             title={isWatched ? t('lms_mark_incomplete') : t('lms_mark_complete')}
                           >
                             {isWatched ? <Check className="w-3.5 h-3.5" weight="bold"/> : <Clock className="w-3.5 h-3.5"/>}
                             <span>{isWatched ? t('lms_completed') : t('lms_pending')}</span>
                           </button>
                         ) : (
                           <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono">
                             <Lock className="w-3.5 h-3.5"/>
                             {video.minBeltLevel}+ {t('lms_belt_req_suffix')}
                           </span>
                         )}

                         <button
                           onClick={() => handlePlayVideo(video)}
                           className="px-3.5 py-1.5 min-h-[36px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-neutral-900 dark:text-white text-[10px] font-bold uppercase tracking-wider rounded-[6px] border border-neutral-300 dark:border-[#262626] transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1"
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

      {/* Theatre Mode Player Overlay */}
      <AnimatePresence>
        {activePlayVideo && (() => {
          const parsed = parseAssetDescription(activePlayVideo.description);
          const isTkd = activePlayVideo.category && !activePlayVideo.category.startsWith('Fitness:') && activePlayVideo.minBeltLevel !== 'Fitness';
          const isWatched = effectiveStudent ? studentWatchedIds.has(activePlayVideo.id) : false;
          
          return (
            <Portal>
              <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 20 }}
                  className="w-full max-w-6xl h-[88vh] min-h-[500px] bg-[#0F0F0F] border border-[#262626] rounded-[10px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative"
                >
                  {/* Close Button */}
                  <button 
                    onClick={() => setActivePlayVideo(null)} 
                    className="absolute top-4 right-4 z-50 p-2.5 bg-black/70 hover:bg-black/95 text-white rounded-full transition-all border border-white/10 active:scale-95 touch-manipulation cursor-pointer shadow-md"
                    title={t('act_close')}
                  >
                    <X className="w-4 h-4"/>
                  </button>

                  {/* Left Column: Player & Basic Info */}
                  <div className="flex-1 flex flex-col bg-black h-full overflow-hidden">
                    <div className="w-full bg-black relative flex items-center justify-center aspect-video shrink-0">
                      {getEmbedVideoUrl(activePlayVideo.videoUrl) ? (
                        <iframe 
                          src={getEmbedVideoUrl(activePlayVideo.videoUrl)}
                          title={activePlayVideo.title}
                          className="w-full h-full border-0 absolute inset-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-[#666]">
                          <VideoCamera className="w-12 h-12 mb-3 opacity-50"/>
                          <h4 className="text-white text-sm font-bold mb-1">{t('lms_no_resource')}</h4>
                          <p className="text-[11px] max-w-md mb-3">{t('lms_no_resource_desc').replace('{url}', activePlayVideo.videoUrl || '')}</p>
                          {activePlayVideo.videoUrl && (
                            <a href={activePlayVideo.videoUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white text-black font-bold uppercase text-[9px] tracking-widest rounded-[8px] hover:bg-neutral-200 transition-colors">
                              {t('lms_open_external')}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Basic Info (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-[#141414] border-t border-[#262626] space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2.5 py-1 bg-red-500/10 text-[#EF2F38] border border-red-500/20 rounded-[6px] text-[9px] font-bold uppercase tracking-wider inline-block">
                            {t(getCategoryTranslationKey(activePlayVideo.category)) || activePlayVideo.category}
                          </span>
                          <h2 className="text-base md:text-lg font-bold text-white mt-2 tracking-tight">{t.translateText(activePlayVideo.title)}</h2>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] uppercase font-bold text-[#777] block tracking-wider">{t('lms_belt_req')}</span>
                          <span className="text-xs font-mono font-bold text-white mt-0.5 inline-block bg-[#1A1A1A] border border-[#262626] px-2 py-0.5 rounded-[6px]">{activePlayVideo.minBeltLevel} Belt</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-[#666] tracking-wider">Mechanics & Guidelines</span>
                        <p className="text-xs text-[#AAA] leading-relaxed font-sans">{t.translateText(parsed.text || activePlayVideo.description)}</p>
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
                        {effectiveStudent && (
                          <button
                            type="button"
                            onClick={() => toggleVideoProgress(effectiveStudent.id, activePlayVideo.id, !isWatched)}
                            className={cn(
                              "px-4 py-2.5 rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border min-h-[40px] cursor-pointer touch-manipulation active:scale-95",
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
                          className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider transition-colors min-h-[40px] cursor-pointer touch-manipulation active:scale-95"
                        >
                          {t('act_close')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Detailed Tab Info Panel */}
                  <div className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-[#262626] bg-[#0A0A0A] flex flex-col h-full overflow-hidden">
                    {/* Tab Buttons */}
                    <div className="flex border-b border-[#262626] p-2 bg-[#0F0F0F] shrink-0 overflow-x-auto gap-1">
                      <button 
                        onClick={() => setPlayerTab('overview')}
                        className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer min-h-[32px]", playerTab === 'overview' ? "bg-[#222] text-white border border-white/10" : "text-[#777] hover:text-white")}
                      >
                        Overview
                      </button>
                      {isTkd && (
                        <>
                          <button 
                            onClick={() => setPlayerTab('guidance')}
                            className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer min-h-[32px]", playerTab === 'guidance' ? "bg-[#222] text-white border border-white/10" : "text-[#777] hover:text-white")}
                          >
                            Guidance
                          </button>
                          <button 
                            onClick={() => setPlayerTab('drills')}
                            className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer min-h-[32px]", playerTab === 'drills' ? "bg-[#222] text-white border border-white/10" : "text-[#777] hover:text-white")}
                          >
                            Drills
                          </button>
                          <button 
                            onClick={() => setPlayerTab('mistakes')}
                            className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer min-h-[32px]", playerTab === 'mistakes' ? "bg-[#222] text-white border border-white/10" : "text-[#777] hover:text-white")}
                          >
                            Mistakes
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setPlayerTab('biomechanics')}
                        className={cn("px-3 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1.5 min-h-[32px]", playerTab === 'biomechanics' ? "bg-[#222] text-[#EF2F38] border border-[#EF2F38]/30" : "text-[#777] hover:text-white")}
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
                            <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider mb-1">Target Reps & Sets</span>
                            <span className="text-xs font-bold text-neutral-300 font-mono">{parsed.repsSets || t('lib_self_paced')}</span>
                          </div>

                          {/* Focus Zones */}
                          {parsed.focusZones && parsed.focusZones.length > 0 && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px]">
                              <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider mb-2">Target Focus Areas</span>
                              <div className="flex flex-wrap gap-1">
                                {parsed.focusZones.map((zone, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-[#262626] text-[#999] border border-white/5 text-[8px] font-black uppercase tracking-wider rounded">{zone}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Instructions */}
                          {parsed.instructions && parsed.instructions.length > 0 && (
                            <div className="space-y-2">
                              <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider">Execution Steps</span>
                              <ol className="space-y-2">
                                {parsed.instructions.map((step, idx) => {
                                  const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '');
                                  return (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-[#999] leading-relaxed">
                                      <span className="w-4 h-4 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
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
                              <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider">Core Principles</span>
                              <ul className="space-y-1 text-xs text-[#999]">
                                {parsed.principles.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parsed.prerequisites && parsed.prerequisites.length > 0 && (
                            <div className="p-3 bg-[#141414] border border-[#262626] rounded-[8px] space-y-1.5">
                              <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider">Prerequisites</span>
                              <ul className="space-y-1 text-xs text-[#999]">
                                {parsed.prerequisites.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {playerTab === 'drills' && isTkd && (
                        <div className="space-y-3">
                          {parsed.drillingMethods && parsed.drillingMethods.length > 0 && (
                            <div className="p-3.5 bg-[#141414] border border-[#262626] rounded-[8px] space-y-2">
                              <span className="block text-[8px] uppercase font-black text-[#555] tracking-wider">Drilling Methods</span>
                              <ul className="space-y-1.5">
                                {parsed.drillingMethods.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-[#999]">
                                    <span className="w-4 h-4 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
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
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 text-[8px] font-black uppercase tracking-wider mb-1.5 w-max">Mistake</span>
                                  <span className="text-[#E4E4E4] font-medium leading-relaxed font-sans">{item.mistake || "—"}</span>
                                </div>
                                <div className="p-3 bg-emerald-500/[0.02] flex flex-col">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[8px] font-black uppercase tracking-wider mb-1.5 w-max">Correction</span>
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
                                    <span className="text-[8px] uppercase font-black text-red-400 tracking-wider flex items-center gap-1">
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
                                    <span className="text-[8px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1">
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

                                <div className="h-[280px] w-full rounded-[8px] overflow-hidden border border-[#262626] bg-[#0A0A0A] relative">
                                  <Anatomical3DModel
                                    muscleLoads={muscleLoads}
                                    maxLoad={1.0}
                                    gender="Male"
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
                </motion.div>
              </div>
            </Portal>
          );
        })()}
      </AnimatePresence>
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
  const { state, toggleVideoProgress, upsertPhysicalEvaluation, addBeltTechnique, deleteBeltTechnique, showNotification, showConfirm } = useAppStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [beltFilter, setBeltFilter] = useState('All');
  const [scheduleFilter, setScheduleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [genderFilter, setGenderFilter] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [physicalGrades, setPhysicalGrades] = useState<Record<string, Record<string, string>>>({});

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
          setNewCategory(selected.category);
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

  useEffect(() => {
    const cached = localStorage.getItem('infinity_lms_physical_grades');
    if (cached) {
      try {
        setPhysicalGrades(JSON.parse(cached));
      } catch (e) {}
    }
  }, []);

  const getSkillGrade = (studentId: string, skill: string) => {
    const dbMatch = state.physicalEvaluations?.find(x => x.studentId === studentId && x.skillName === skill);
    if (dbMatch) return dbMatch.grade;
    return physicalGrades[studentId]?.[skill] || 'Unrated';
  };

  const handleGradePhysical = (studentId: string, skill: string, beltLevel: string, grade: string) => {
    // 1. Update local storage (offline cache)
    setPhysicalGrades(prev => {
      const studentSkills = prev[studentId] || {};
      const updated = {
        ...prev,
        [studentId]: {
          ...studentSkills,
          [skill]: grade
        }
      };
      localStorage.setItem('infinity_lms_physical_grades', JSON.stringify(updated));
      return updated;
    });

    // 2. Synchronize to Supabase cloud database
    upsertPhysicalEvaluation(studentId, skill, beltLevel, grade);
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
    if (branchFilter !== 'All' && s.homeBranchId.toString() !== branchFilter) return false;
    
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

  const role = state.currentUser?.role;
  const canManageTechniques = role === 'Root' || role === 'Super Root' || role === 'Admin' || role === 'Head Coach' || role === 'Coach' || role === 'Assistant Coach';

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
              className="px-4 py-2 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#E4E4E4] hover:text-[#EF2F38] hover:border-[#EF2F38]/40 font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors min-h-[38px] cursor-pointer touch-manipulation active:scale-95"
            >
              {showManager ? t('lms_close_editor') : t('lms_edit_belt_skills')}
            </button>
          </div>

          {showManager && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 dark:border-[#262626]">
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
                              setNewCategory(asset.category);
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
                            <span className="text-[8px] text-neutral-500 dark:text-[#666] shrink-0 font-mono bg-neutral-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#262626] uppercase">
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
                  className="w-full py-2.5 min-h-[42px] bg-[#EF2F38] text-white font-bold uppercase tracking-wider text-[11px] rounded-[8px] hover:bg-[#d6262f] transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
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
                  const report = calculatePromotionReadiness(
                    student,
                    state.attendanceRecords,
                    state.videoProgress,
                    state.curriculumVideos,
                    state.beltHistories,
                    state.physicalEvaluations,
                    state.beltTechniques
                  );
                  
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
                                     <span className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors">{student.englishName}</span>
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
                                    "px-2 py-0.5 rounded-[6px] text-[8px] font-bold uppercase tracking-wider border",
                                    eligibilityStatus === 'Ready' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" :
                                    eligibilityStatus === 'Developing' ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400" :
                                    "bg-neutral-100 dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-[#666]"
                                  )}>
                                    {eligibilityStatus === 'Ready' ? 'Ready' : eligibilityStatus === 'Developing' ? 'Developing' : 'Needs Work'}
                                  </span>
                               </div>
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
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="w-full max-w-2xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden"
                >
                   {/* Modal Header */}
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414]">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{t('lms_progress_status')}</h2>
                        <p className="text-xs text-neutral-500 dark:text-[#999] mt-0.5">{selectedStudent.englishName} ({selectedStudent.id})</p>
                      </div>
                      <button 
                        onClick={() => setSelectedStudentId(null)} 
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
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
                                       .map(c => `${c!.name} (${c!.dayOfWeek} ${c!.startTime.substring(0, 5)}-{c!.endTime.substring(0, 5)})`)
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
                         const report = calculatePromotionReadiness(
                           selectedStudent,
                           state.attendanceRecords,
                           state.videoProgress,
                           state.curriculumVideos,
                           state.beltHistories,
                           state.physicalEvaluations,
                           state.beltTechniques
                         );
                         
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
                                           "px-2.5 py-1 rounded-[6px] text-[8px] font-bold uppercase tracking-wider border transition-all duration-300",
                                           report.eligibilityStatus === 'Ready' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-md shadow-amber-500/5" :
                                           report.eligibilityStatus === 'Developing' ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400" :
                                           "bg-neutral-100 dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-[#666]"
                                        )}>
                                           {report.eligibilityStatus === 'Ready' ? `★ ${t('dir_ready_for_test')}` : report.eligibilityStatus === 'Developing' ? t('dir_developing') : t('dir_needs_work')}
                                        </span>
                                     </div>
                                  </div>

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
                                                             {(['Needs Work', 'Developing', 'Proficient', 'Outstanding'] as const).map(level => {
                                                                const isActive = studentGrade === level;
                                                                return (
                                                                   <button
                                                                      key={level}
                                                                      type="button"
                                                                      onClick={() => handleGradePhysical(selectedStudent.id, skillName, selectedStudent.currentBelt, level)}
                                                                      className={cn(
                                                                         "px-3 py-1.5 rounded-[6px] border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[34px] touch-manipulation active:scale-95",
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

                      {/* Required Videos Checklist */}
                      <div className="space-y-4">
                         <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t.translateText("Required Videos Checklist")}</h3>
                         <div className="space-y-3">
                           {state.curriculumVideos.map(video => {
                              const progress = state.videoProgress.find(p => p.videoId === video.id && p.studentId === selectedStudent.id);
                              const isCompleted = progress?.status === 'Completed';
                              const isCurrentBeltRequirement = isBeltMatch(video.minBeltLevel, selectedStudent.currentBelt);

                              return (
                                <div key={video.id} className={cn("border rounded-[8px] p-4 flex items-center justify-between transition-all", isCurrentBeltRequirement ? "bg-red-500/5 border-red-500/30" : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626]")}>
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{t.translateText(video.title)}</h4>
                                        {isCurrentBeltRequirement && (
                                          <span className="px-2 py-0.5 bg-red-500/10 text-[#EF2F38] border border-red-500/20 rounded-[6px] text-[8px] font-bold uppercase tracking-wider">
                                            {t.translateText("Current Syllabus")}
                                          </span>
                                        )}
                                     </div>
                                      <p className="text-[10px] text-neutral-500 dark:text-[#666] uppercase font-bold tracking-wider mt-1">
                                        {t(getCategoryTranslationKey(video.category)) || video.category} • {t('lms_belt_req')}: {video.minBeltLevel}
                                      </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer select-none">
                                      <input 
                                        type="checkbox" 
                                        checked={isCompleted} 
                                        onChange={(e) => toggleVideoProgress(selectedStudent.id, video.id, e.target.checked)}
                                        className="sr-only peer" 
                                      />
                                      <div className="w-9 h-5 bg-neutral-200 dark:bg-[#262626] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-[#666] peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                                    </label>
                                    <span className={cn("text-[10px] font-bold tracking-wider uppercase w-16 text-right", isCompleted ? "text-emerald-600 dark:text-emerald-500" : "text-neutral-400 dark:text-[#666]")}>
                                      {isCompleted ? t('lms_completed') : t('lms_pending')}
                                     </span>
                                  </div>
                                </div>
                              )
                            })}
                            {state.curriculumVideos.length === 0 && (
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
