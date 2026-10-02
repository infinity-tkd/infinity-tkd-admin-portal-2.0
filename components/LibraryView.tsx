'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, CurriculumVideo } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, MagnifyingGlass, Trash, PlayCircle, X, 
  UserCircle, Calendar, Clock, Barbell, Sparkle, Timer, 
  ListChecks, ArrowLeft, CheckCircle, ShieldWarning, FastForward,
  UploadSimple, FileCsv, Checks, Question, Info, Warning, Copy, PencilSimple,
  CaretDown, CaretUp, CaretRight, Check, MusicNotes, ArrowsOut, ArrowsIn,
  Stack, Flame
} from '@phosphor-icons/react';
import { AnatomyStudioModal } from '@/components/AnatomyStudioModal';
import { resolveAssetMuscleLoads } from '@/lib/anatomyUtils';
import { cn, normalizeCategory, getCategoryTranslationKey, getYouTubeId, getEmbedVideoUrl, parseAssetDescription, AssetDetails, MistakeCorrection, VocabularyItem, QuestionAnswerItem } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';

const Anatomical3DModel = dynamic(
  () => import('@/components/Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/60 rounded-[8px] p-8 border border-neutral-800 animate-pulse">
        <span className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-3" />
        <span className="text-xs text-neutral-400 font-mono uppercase tracking-widest">Loading 3D Engine...</span>
      </div>
    )
  }
);
import { useWorkoutTimer, TimerMode } from '@/hooks/useWorkoutTimer';


// Standard categories based on WT and Fitness systems
const TKD_CATEGORIES = [
  'Forms (Poomsae)',
  'Kicks (Chagi)',
  'Stances & Footwork (Seogi)',
  'Strikes (Jirugi/Chigi)',
  'Blocks (Makki)',
  'Sparring (Kyorugi)',
  'Breaking (Kyokpa)',
  'Self-Defense (Hosinsul)',
  'Tricking & Acrobatics',
  'Theory & Terminology'
] as const;
const FITNESS_CATEGORIES = ['Strength', 'Explosive', 'Speed', 'Agility', 'Control', 'Balance', 'Flexibility', 'Functional', 'Rotational', 'Core', 'Conditioning'] as const;
const DANCE_CATEGORIES = [
  'Dance: Hiphop',
  'Dance: Popping',
  'Dance: Tutorials',
  'Dance: Resources'
] as const;
const ROUTINE_TYPES = [
  'Taekwondo Workout',
  'Fitness Workout',
  'Hybrid Training',
  'Weight Loss',
  'Full Body Strength',
  'Taekwondo Cardio',
  'Hiphop Dance Workout',
  'Taekwondo Aerobic'
] as const;
const BELTS = ['All', 'White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'] as const;

const getBeltTranslationKey = (belt: string): any => {
  const b = belt.trim().toLowerCase();
  if (b.includes('white')) return 'belt_white';
  if (b.includes('yellow')) return 'belt_yellow';
  if (b.includes('green')) return 'belt_green';
  if (b.includes('blue')) return 'belt_blue';
  if (b.includes('brown')) return 'belt_brown';
  if (b.includes('red')) return 'belt_red';
  if (b.includes('1st')) return 'belt_1st_poom_dan';
  if (b.includes('2nd')) return 'belt_2nd_poom_dan';
  if (b.includes('3rd')) return 'belt_3rd_poom_dan';
  return 'belt_all';
};

const normalizeMuscleNameFor3D = (name: string): string => {
  const n = name.toLowerCase().trim();
  if (n.includes('quadriceps') || n.includes('quad')) return 'Quadriceps';
  if (n.includes('hamstring') || n.includes('biceps femoris') || n.includes('semitendinosus') || n.includes('semimembranosus')) return 'Hamstrings';
  if (n.includes('gluteus') || n.includes('glute')) return 'Glutes';
  if (n.includes('calf') || n.includes('calves') || n.includes('gastrocnemius') || n.includes('soleus')) return 'Calves';
  if (n.includes('rectus abdominis') || n.includes('abs') || n.includes('abdominis')) return 'Abs (Rectus Abdominis)';
  if (n.includes('oblique')) return 'Obliques';
  if (n.includes('lower back') || n.includes('erector spinae')) return 'Lower Back';
  if (n.includes('hip flexor') || n.includes('iliopsoas')) return 'Hip Flexors';
  if (n.includes('shoulder') || n.includes('deltoid')) return 'Shoulders (Deltoids)';
  if (n.includes('chest') || n.includes('pectoral')) return 'Chest (Pectorals)';
  if (n.includes('lats') || n.includes('latissimus dorsi') || n.includes('back (lats)')) return 'Back (Lats)';
  if (n.includes('biceps') || n.includes('brachialis') || n.includes('brachioradialis')) return 'Biceps';
  if (n.includes('triceps')) return 'Triceps';
  if (n.includes('trapezius')) return 'Trapezius';
  
  if (n.includes('forearm')) return 'Biceps';
  if (n.includes('rhomboid') || n.includes('teres major')) return 'Back (Lats)';
  if (n.includes('rotator cuff')) return 'Shoulders (Deltoids)';
  
  return name;
};

export function LibraryView() {
  const { state, addCurriculumVideo, updateCurriculumVideo, deleteCurriculumVideo, addWorkoutTemplate, updateWorkoutTemplate, deleteWorkoutTemplate, showConfirm, showNotification } = useAppStore();
  const t = useT();
  const role = state.currentUser?.role;
  const isElevated = role === 'Root' || role === 'Super Root' || role === 'Admin' || role === 'Head Coach' || role === 'Coach';

  // Tabs: Taekwondo Technical vs Workout & Fitness vs Dance vs Routines
  const [activeTab, setActiveTab] = useState<'tkd' | 'fitness' | 'dance' | 'routines'>('tkd');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBelt, setSelectedBelt] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [selectedRoutineType, setSelectedRoutineType] = useState<string>('All');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<any | null>(null);
  const [activePlayVideo, setActivePlayVideo] = useState<CurriculumVideo | null>(null);

  // Active workout timer sequence
  const [runningWorkout, setRunningWorkout] = useState<any>(null);

  // Add Asset Form state
  const [newAsset, setNewAsset] = useState({
    title: '',
    description: '',
    category: 'Forms (Poomsae)', // Default to TKD category
    minBeltLevel: 'White',
    videoUrl: '',
    difficulty: 'Beginner' as 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite',
    focusZones: '',
    instructions: '',
    repsSets: '',
    thumbnailUrl: '',
  });

  const [selectedDetailAsset, setSelectedDetailAsset] = useState<CurriculumVideo | null>(null);
  const [show3DStudio, setShow3DStudio] = useState(false);
  const [selected3DAsset, setSelected3DAsset] = useState<CurriculumVideo | null>(null);
  const [anatomicalGender, setAnatomicalGender] = useState<'Male' | 'Female'>('Male');
  const [editAsset, setEditAsset] = useState<any | null>(null);

  // Relational muscle picker form states
  const [selectedMuscles, setSelectedMuscles] = useState<{ muscleId: number; role: 'Primary' | 'Secondary' }[]>([]);
  const [muscleSearch, setMuscleSearch] = useState('');
  const [editSelectedMuscles, setEditSelectedMuscles] = useState<{ muscleId: number; role: 'Primary' | 'Secondary' }[]>([]);
  const [editMuscleSearch, setEditMuscleSearch] = useState('');

  // Step-by-step instructions state
  const [instructionSteps, setInstructionSteps] = useState<string[]>(['']);
  const [editInstructionSteps, setEditInstructionSteps] = useState<string[]>(['']);

  // Dynamic step builder states for TKD skill fields
  const [prerequisiteSteps, setPrerequisiteSteps] = useState<string[]>(['']);
  const [editPrerequisiteSteps, setEditPrerequisiteSteps] = useState<string[]>(['']);
  const [principleSteps, setPrincipleSteps] = useState<string[]>(['']);
  const [editPrincipleSteps, setEditPrincipleSteps] = useState<string[]>(['']);
  const [drillingSteps, setDrillingSteps] = useState<string[]>(['']);
  const [editDrillingSteps, setEditDrillingSteps] = useState<string[]>(['']);
  const [mistakeSteps, setMistakeSteps] = useState<MistakeCorrection[]>([{ mistake: '', correction: '' }]);
  const [editMistakeSteps, setEditMistakeSteps] = useState<MistakeCorrection[]>([{ mistake: '', correction: '' }]);
  const [performanceSteps, setPerformanceSteps] = useState<string[]>(['']);
  const [editPerformanceSteps, setEditPerformanceSteps] = useState<string[]>(['']);

  // Physical Training Solutions linking states
  const [selectedFitnessSolutions, setSelectedFitnessSolutions] = useState<number[]>([]);
  const [editSelectedFitnessSolutions, setEditSelectedFitnessSolutions] = useState<number[]>([]);

  // Dynamic builders for Theory & Terminology category
  const [terminologyList, setTerminologyList] = useState<VocabularyItem[]>([{ korean: '', english: '', khmer: '' }]);
  const [editTerminologyList, setEditTerminologyList] = useState<VocabularyItem[]>([{ korean: '', english: '', khmer: '' }]);
  const [studyGuideList, setStudyGuideList] = useState<QuestionAnswerItem[]>([{ question: '', answer: '' }]);
  const [editStudyGuideList, setEditStudyGuideList] = useState<QuestionAnswerItem[]>([{ question: '', answer: '' }]);

  const [expandedStudyGuides, setExpandedStudyGuides] = useState<Record<number, boolean>>({});
  const toggleStudyGuide = (idx: number) => {
    setExpandedStudyGuides(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Keyboard navigation active suggestion indices for muscle pickers
  const [activeMuscleIdx, setActiveMuscleIdx] = useState<number>(-1);
  const [editActiveMuscleIdx, setEditActiveMuscleIdx] = useState<number>(-1);

  // Muscle picker dropdown state
  const [showMuscleDropdown, setShowMuscleDropdown] = useState(false);
  const [showEditMuscleDropdown, setShowEditMuscleDropdown] = useState(false);

  // Fitness solutions picker dropdown states
  const [showFitnessDropdown, setShowFitnessDropdown] = useState(false);
  const [showEditFitnessDropdown, setShowEditFitnessDropdown] = useState(false);
  const [fitnessSearch, setFitnessSearch] = useState('');
  const [editFitnessSearch, setEditFitnessSearch] = useState('');

  // Refs for click outside
  const addMuscleDropdownRef = useRef<HTMLDivElement>(null);
  const editMuscleDropdownRef = useRef<HTMLDivElement>(null);
  const addFitnessSolutionsDropdownRef = useRef<HTMLDivElement>(null);
  const editFitnessSolutionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMuscleDropdownRef.current && !addMuscleDropdownRef.current.contains(event.target as Node)) {
        setShowMuscleDropdown(false);
      }
      if (editMuscleDropdownRef.current && !editMuscleDropdownRef.current.contains(event.target as Node)) {
        setShowEditMuscleDropdown(false);
      }
      if (addFitnessSolutionsDropdownRef.current && !addFitnessSolutionsDropdownRef.current.contains(event.target as Node)) {
        setShowFitnessDropdown(false);
      }
      if (editFitnessSolutionsDropdownRef.current && !editFitnessSolutionsDropdownRef.current.contains(event.target as Node)) {
        setShowEditFitnessDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Workout Routine Templates synced from global Supabase store
  const workoutTemplates = state.workoutTemplates || [];

  const filteredTemplates = workoutTemplates.filter(template => {
    const matchesSearch = 
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    const tType = template.structure?.routineType || 'Taekwondo Workout';
    if (selectedRoutineType !== 'All' && tType !== selectedRoutineType) return false;

    return true;
  });

  // Add Routine Form state
  const [newRoutine, setNewRoutine] = useState({
    title: '',
    description: '',
    routineType: 'Taekwondo Workout',
    difficulty: 'Intermediate',
    prepareSeconds: 10,
    workSeconds: 30,
    restSeconds: 15,
    rounds: 6,
    selectedExercises: [] as string[],
  });

  const [exerciseSearch, setExerciseSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const uniqueExercises = Array.from(
    new Set(state.curriculumVideos.map(video => video.title))
  ).filter(Boolean);

  const filteredExercises = uniqueExercises.filter(ex => 
    ex.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const items = [...newRoutine.selectedExercises];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setNewRoutine({ ...newRoutine, selectedExercises: items });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const items = [...newRoutine.selectedExercises];
    if (direction === 'up' && index > 0) {
      const temp = items[index];
      items[index] = items[index - 1];
      items[index - 1] = temp;
    } else if (direction === 'down' && index < items.length - 1) {
      const temp = items[index];
      items[index] = items[index + 1];
      items[index + 1] = temp;
    }
    setNewRoutine({ ...newRoutine, selectedExercises: items });
  };

  // Split and filter technical assets based on type & prefix
  // Fitness exercises are curriculum entries where category starts with "Fitness:" or belt level is set to "Fitness"
  const filteredAssets = state.curriculumVideos.filter(video => {
    const isFitness = video.minBeltLevel === 'Fitness' || video.category.startsWith('Fitness:');
    const isDance = video.category.startsWith('Dance:');
    
    // Filter by general activeTab selection
    if (activeTab === 'tkd' && (isFitness || isDance)) return false;
    if (activeTab === 'fitness' && !isFitness) return false;
    if (activeTab === 'dance' && !isDance) return false;

    // Search query match
    const matchesSearch = 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Belt / Level match (TKD only)
    if (activeTab === 'tkd' && selectedBelt !== 'All' && video.minBeltLevel !== selectedBelt) return false;

    // Subcategory match
    if (selectedSubCategory !== 'All') {
      if (activeTab === 'tkd' && normalizeCategory(video.category) !== normalizeCategory(selectedSubCategory)) return false;
      if (activeTab === 'fitness') {
        const cleanedCategory = video.category.replace('Fitness: ', '');
        if (cleanedCategory !== selectedSubCategory) return false;
      }
      if (activeTab === 'dance') {
        const cleanedCategory = video.category.replace('Dance: ', '');
        if (cleanedCategory !== selectedSubCategory) return false;
      }
    }

    return true;
  });

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.title.trim()) return;

    let categoryToSave = newAsset.category;
    let beltToSave = newAsset.minBeltLevel;

    // If adding a fitness movement, enforce standard category structure
    if (activeTab === 'fitness') {
      categoryToSave = `Fitness: ${newAsset.category}`;
      beltToSave = 'Fitness';
    } else if (activeTab === 'dance') {
      categoryToSave = newAsset.category;
      beltToSave = 'Dance';
    }

    // Auto-resolve YouTube high-res thumbnail cover if omitted
    const ytId = getYouTubeId(newAsset.videoUrl);
    let resolvedThumbnail = newAsset.thumbnailUrl;
    if (!resolvedThumbnail && ytId) {
      resolvedThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    // Map focusZones string array from selected muscle names for backwards compatibility
    const zones = selectedMuscles.map(sm => {
      const m = state.muscles.find(x => x.id === sm.muscleId);
      return m ? m.name : '';
    }).filter(Boolean);

    const descriptionJson = JSON.stringify({
      text: newAsset.description,
      difficulty: newAsset.difficulty,
      instructions: instructionSteps
        .map((s, idx) => s.trim() ? `Step ${idx + 1}: ${s.trim()}` : '')
        .filter(Boolean),
      focusZones: zones,
      repsSets: newAsset.repsSets,
      thumbnailUrl: resolvedThumbnail,
      actualCategory: categoryToSave,
      principles: principleSteps.filter(s => s.trim()),
      prerequisites: prerequisiteSteps.filter(s => s.trim()),
      drillingMethods: drillingSteps.filter(s => s.trim()),
      mistakes: mistakeSteps
        .filter(m => m.mistake.trim() || m.correction.trim())
        .map(m => ({ mistake: m.mistake.trim(), correction: m.correction.trim() })),
      performance: performanceSteps.filter(s => s.trim()),
      fitnessSolutions: selectedFitnessSolutions,
      terminology: categoryToSave === 'Theory & Terminology'
        ? terminologyList.filter(t => t.korean.trim() || t.english.trim() || t.khmer.trim())
        : [],
      studyGuide: categoryToSave === 'Theory & Terminology'
        ? studyGuideList.filter(s => s.question.trim() || s.answer.trim())
        : []
    });

    await addCurriculumVideo({
      title: newAsset.title,
      description: descriptionJson,
      category: categoryToSave,
      minBeltLevel: beltToSave,
      videoUrl: newAsset.videoUrl || undefined,
      muscleRelations: selectedMuscles
    });

    setNewAsset({
      title: '',
      description: '',
      category: activeTab === 'tkd' ? 'Forms (Poomsae)' : activeTab === 'dance' ? 'Dance: Hiphop' : 'Strength',
      minBeltLevel: activeTab === 'tkd' ? 'White' : activeTab === 'dance' ? 'Dance' : 'Fitness',
      videoUrl: '',
      difficulty: 'Beginner',
      focusZones: '',
      instructions: '',
      repsSets: '',
      thumbnailUrl: '',
    });
    setSelectedMuscles([]);
    setMuscleSearch('');
    setInstructionSteps(['']);
    setPrerequisiteSteps(['']);
    setPrincipleSteps(['']);
    setDrillingSteps(['']);
    setMistakeSteps([{ mistake: '', correction: '' }]);
    setPerformanceSteps(['']);
    setSelectedFitnessSolutions([]);
    setTerminologyList([{ korean: '', english: '', khmer: '' }]);
    setStudyGuideList([{ question: '', answer: '' }]);
    setShowAddModal(false);
  };

  const handleStartEdit = (video: CurriculumVideo) => {
    const details = parseAssetDescription(video.description);
    
    const relations = state.assetMuscleRelations
      .filter(r => r.assetId === video.id)
      .map(r => ({ muscleId: r.muscleId, role: r.role }));
    setEditSelectedMuscles(relations);

    const initialSteps = (details.instructions && details.instructions.length > 0)
      ? details.instructions.map(s => s.replace(/^Step\s+\d+:\s*/i, ''))
      : [''];
    setEditInstructionSteps(initialSteps);

    setEditPrerequisiteSteps(details.prerequisites && details.prerequisites.length > 0 ? [...details.prerequisites] : ['']);
    setEditPrincipleSteps(details.principles && details.principles.length > 0 ? [...details.principles] : ['']);
    setEditDrillingSteps(details.drillingMethods && details.drillingMethods.length > 0 ? [...details.drillingMethods] : ['']);
    setEditMistakeSteps(details.mistakes && details.mistakes.length > 0 ? [...details.mistakes] : [{ mistake: '', correction: '' }]);
    setEditPerformanceSteps(details.performance && details.performance.length > 0 ? [...details.performance] : ['']);
    setEditSelectedFitnessSolutions(details.fitnessSolutions || []);
    setEditTerminologyList(details.terminology && details.terminology.length > 0 ? [...details.terminology] : [{ korean: '', english: '', khmer: '' }]);
    setEditStudyGuideList(details.studyGuide && details.studyGuide.length > 0 ? [...details.studyGuide] : [{ question: '', answer: '' }]);

    setEditAsset({
      id: video.id,
      title: video.title,
      description: details.text,
      category: video.category.replace('Fitness: ', '').replace('Dance: ', ''),
      minBeltLevel: video.minBeltLevel,
      videoUrl: video.videoUrl || '',
      difficulty: details.difficulty || 'Beginner',
      focusZones: (details.focusZones || []).join(', '),
      instructions: (details.instructions || []).join('\n'),
      repsSets: details.repsSets || '',
      thumbnailUrl: details.thumbnailUrl || '',
    });
  };

  const handleSaveEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAsset || !editAsset.title.trim()) return;

    let categoryToSave = editAsset.category;
    let beltToSave = editAsset.minBeltLevel;

    // If adding a fitness movement, enforce standard category structure
    if (activeTab === 'fitness') {
      categoryToSave = `Fitness: ${editAsset.category}`;
      beltToSave = 'Fitness';
    } else if (activeTab === 'dance') {
      categoryToSave = editAsset.category;
      beltToSave = 'Dance';
    }

    // Auto-resolve YouTube high-res thumbnail cover if omitted
    const ytId = getYouTubeId(editAsset.videoUrl);
    let resolvedThumbnail = editAsset.thumbnailUrl;
    if (!resolvedThumbnail && ytId) {
      resolvedThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    // Map focusZones string array from selected muscle names for backwards compatibility
    const zones = editSelectedMuscles.map(sm => {
      const m = state.muscles.find(x => x.id === sm.muscleId);
      return m ? m.name : '';
    }).filter(Boolean);

    const descriptionJson = JSON.stringify({
      text: editAsset.description,
      difficulty: editAsset.difficulty,
      instructions: editInstructionSteps
        .map((s, idx) => s.trim() ? `Step ${idx + 1}: ${s.trim()}` : '')
        .filter(Boolean),
      focusZones: zones,
      repsSets: editAsset.repsSets,
      thumbnailUrl: resolvedThumbnail,
      actualCategory: categoryToSave,
      principles: editPrincipleSteps.filter(s => s.trim()),
      prerequisites: editPrerequisiteSteps.filter(s => s.trim()),
      drillingMethods: editDrillingSteps.filter(s => s.trim()),
      mistakes: editMistakeSteps
        .filter(m => m.mistake.trim() || m.correction.trim())
        .map(m => ({ mistake: m.mistake.trim(), correction: m.correction.trim() })),
      performance: editPerformanceSteps.filter(s => s.trim()),
      fitnessSolutions: editSelectedFitnessSolutions,
      terminology: categoryToSave === 'Theory & Terminology'
        ? editTerminologyList.filter(t => t.korean.trim() || t.english.trim() || t.khmer.trim())
        : [],
      studyGuide: categoryToSave === 'Theory & Terminology'
        ? editStudyGuideList.filter(s => s.question.trim() || s.answer.trim())
        : []
    });

    await updateCurriculumVideo(editAsset.id, {
      title: editAsset.title,
      description: descriptionJson,
      category: categoryToSave,
      minBeltLevel: beltToSave,
      videoUrl: editAsset.videoUrl || undefined,
      muscleRelations: editSelectedMuscles
    });

    // Sync state inside detail view if it is open
    setSelectedDetailAsset(prev => {
      if (prev && prev.id === editAsset.id) {
        return {
          ...prev,
          title: editAsset.title,
          description: descriptionJson,
          category: categoryToSave,
          minBeltLevel: beltToSave,
          videoUrl: editAsset.videoUrl,
        };
      }
      return prev;
    });

    setEditAsset(null);
    setEditSelectedMuscles([]);
    setEditMuscleSearch('');
    setEditInstructionSteps(['']);

    setEditPrerequisiteSteps(['']);
    setEditPrincipleSteps(['']);
    setEditDrillingSteps(['']);
    setEditMistakeSteps([{ mistake: '', correction: '' }]);
    setEditPerformanceSteps(['']);
    setEditSelectedFitnessSolutions([]);
    setEditTerminologyList([{ korean: '', english: '', khmer: '' }]);
    setEditStudyGuideList([{ question: '', answer: '' }]);
  };

  const confirmDeleteVideo = (videoId: number, videoTitle: string, onCloseDetail?: () => void) => {
    let title = 'Delete Video';
    let message = `Are you sure you want to delete "${videoTitle}"? This will permanently remove the video from the curriculum library.`;
    
    if (state.language === 'kh') {
      title = 'លុបវីដេអូ';
      message = `តើអ្នកពិតជាចង់លុប "${videoTitle}" មែនទេ? វានឹងលុបវីដេអូនេះចេញពីបណ្ណាល័យកម្មវិធីសិក្សាជាអចិន្ត្រៃយ៍។`;
    } else if (state.language === 'zh') {
      title = '删除视频';
      message = `您确定要删除 "${videoTitle}" 吗？这将永久从课程库中移除该视频。`;
    }

    showConfirm(
      message,
      async () => {
        if (onCloseDetail) onCloseDetail();
        await deleteCurriculumVideo(videoId);
      },
      title
    );
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutine.title.trim()) return;

    const exercises = newRoutine.selectedExercises;

    const numExercises = exercises.length || 1;
    const totalSeconds = Number(newRoutine.prepareSeconds) + (Number(newRoutine.workSeconds) + Number(newRoutine.restSeconds)) * numExercises * Number(newRoutine.rounds);
    const estimatedMinutes = Math.max(1, Math.round(totalSeconds / 60));

    const routineTemplate = {
      title: newRoutine.title,
      description: newRoutine.description,
      difficulty: newRoutine.difficulty,
      duration: estimatedMinutes,
      creator: editingRoutine?.creator || state.currentUser?.displayName || 'Coach',
      structure: {
        routineType: newRoutine.routineType,
        prepareSeconds: Number(newRoutine.prepareSeconds),
        workSeconds: Number(newRoutine.workSeconds),
        restSeconds: Number(newRoutine.restSeconds),
        rounds: Number(newRoutine.rounds),
        exercises: exercises.length > 0 ? exercises : ['General Stance Kicking Blocks', 'High Knee Core Runs']
      }
    };

    if (editingRoutine) {
      updateWorkoutTemplate(editingRoutine.id, routineTemplate);
    } else {
      addWorkoutTemplate(routineTemplate);
    }

    setShowRoutineModal(false);
    setEditingRoutine(null);
    setNewRoutine({
      title: '',
      description: '',
      routineType: 'Taekwondo Workout',
      difficulty: 'Intermediate',
      prepareSeconds: 10,
      workSeconds: 30,
      restSeconds: 15,
      rounds: 6,
      selectedExercises: [],
    });
  };

  const handleDeleteRoutine = (id: string, routineTitle: string) => {
    let title = 'Delete Routine';
    let message = `Are you sure you want to delete the routine "${routineTitle}"? This will permanently remove the routine template from the library.`;
    
    if (state.language === 'kh') {
      title = 'លុបលំហាត់ហ្វឹកហាត់';
      message = `តើអ្នកពិតជាចង់លុប "${routineTitle}" មែនទេ? វានឹងលុបគំរូលំហាត់ហ្វឹកហាត់នេះចេញពីបណ្ណាល័យជាអចិន្ត្រៃយ៍។`;
    } else if (state.language === 'zh') {
      title = '删除训练计划';
      message = `您确定要删除训练计划 "${routineTitle}" 吗？这将永久从库中移除该模板。`;
    }

    showConfirm(
      message,
      () => {
        deleteWorkoutTemplate(id);
      },
      title
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
         <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-6 h-6 text-[#EF2F38]" weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[6px] text-[10px] font-bold uppercase tracking-wider font-mono">
                  Curriculum & Training Library
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider mt-0.5">{t('nav_library')}</h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 uppercase tracking-wide">{t('lib_subtitle')}</p>
            </div>
         </div>
         {isElevated && (
            <div className="flex flex-wrap gap-2 items-center">
               {activeTab !== 'routines' && (
                 <button onClick={() => {
                   setNewAsset(prev => ({
                     ...prev, 
                     category: activeTab === 'tkd' ? 'Forms (Poomsae)' : activeTab === 'dance' ? 'Dance: Hiphop' : 'Strength',
                     minBeltLevel: activeTab === 'tkd' ? 'White' : activeTab === 'dance' ? 'Dance' : 'Fitness'
                   }));
                   setShowAddModal(true);
                 }}
                   className="bg-[#EF2F38] text-white hover:bg-[#d6262f] px-4 py-2 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer touch-manipulation active:scale-95"
                 >
                   <Plus className="w-4 h-4" weight="bold"/> {t('lib_add_asset')}
                 </button>
               )}
              {activeTab !== 'routines' && (
                <>
                  <button onClick={() => { setSelected3DAsset(null); setShow3DStudio(true); }}
                    className="bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#2C2C2C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] px-3.5 py-2 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer touch-manipulation active:scale-95"
                    title={t('lib_3d_studio')}
                  >
                    <Stack className="w-4 h-4 text-[#EF2F38]" weight="bold"/> {t('lib_3d_studio')}
                  </button>
                  <button onClick={() => setShowBulkModal(true)}
                    className="bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#2C2C2C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] px-3.5 py-2 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer touch-manipulation active:scale-95"
                  >
                    <UploadSimple className="w-4 h-4 text-[#EF2F38]"/> {t('lib_bulk_upload')}
                  </button>
                </>
              )}
              <button onClick={() => {
                setEditingRoutine(null);
                setNewRoutine({
                  title: '',
                  description: '',
                  routineType: 'Taekwondo Workout',
                  difficulty: 'Intermediate',
                  prepareSeconds: 10,
                  workSeconds: 30,
                  restSeconds: 15,
                  rounds: 6,
                  selectedExercises: [],
                });
                setShowRoutineModal(true);
              }}
                className="bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#2C2C2C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] px-3.5 py-2 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer touch-manipulation active:scale-95"
              >
                <Timer className="w-4 h-4 text-amber-500 dark:text-amber-400" weight="bold"/> {t('lib_build_routine')}
              </button>
            </div>
          )}
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      {(() => {
        const tkdCount = state.curriculumVideos.filter(v => !(v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:') || v.category?.startsWith('Dance:'))).length;
        const fitnessCount = state.curriculumVideos.filter(v => v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:')).length;
        const danceCount = state.curriculumVideos.filter(v => v.category?.startsWith('Dance:')).length;
        const routinesCount = (state.workoutTemplates || []).length;

        return (
          <div className="bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 shadow-sm">
             <button onClick={() => { setActiveTab('tkd'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95", 
                 activeTab === 'tkd' 
                   ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-neutral-800 font-black" 
                   : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40"
               )}
             >
               <Sparkle className="w-4 h-4 text-[#EF2F38]" weight="fill"/>
               <span>{t('lib_tab_tkd')}</span>
               <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono font-bold", activeTab === 'tkd' ? "bg-red-500/10 text-[#EF2F38]" : "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400")}>
                 {tkdCount}
               </span>
             </button>
             <button onClick={() => { setActiveTab('fitness'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95", 
                 activeTab === 'fitness' 
                   ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-neutral-800 font-black" 
                   : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40"
               )}
             >
               <Barbell className="w-4 h-4 text-sky-500 dark:text-sky-400" weight="fill"/>
               <span>{t('lib_tab_fitness')}</span>
               <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono font-bold", activeTab === 'fitness' ? "bg-sky-500/10 text-sky-500" : "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400")}>
                 {fitnessCount}
               </span>
             </button>
             <button onClick={() => { setActiveTab('dance'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95", 
                 activeTab === 'dance' 
                   ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-neutral-800 font-black" 
                   : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40"
               )}
             >
               <MusicNotes className="w-4 h-4 text-purple-500 dark:text-purple-400" weight="fill"/>
               <span>{t('lib_tab_dance')}</span>
               <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono font-bold", activeTab === 'dance' ? "bg-purple-500/10 text-purple-400" : "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400")}>
                 {danceCount}
               </span>
             </button>
             <button onClick={() => { setActiveTab('routines'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95", 
                 activeTab === 'routines' 
                   ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/60 dark:border-neutral-800 font-black" 
                   : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40"
               )}
             >
               <Timer className="w-4 h-4 text-amber-500 dark:text-amber-400" weight="fill"/>
               <span>{t('lib_tab_routines')}</span>
               <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono font-bold", activeTab === 'routines' ? "bg-amber-500/10 text-amber-500" : "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400")}>
                 {routinesCount}
               </span>
             </button>
          </div>
        );
      })()}

      {/* Dynamic Filter Controls Panel */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex flex-col md:flex-row gap-3 shadow-sm">
         {/* Text Search input */}
         <div className="relative flex-1">
           <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none"/>
           <input type="text" placeholder={t('lib_search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full pl-10 pr-4 h-11 min-h-[44px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium"
           />
         </div>

         {/* Routine Type Selector */}
         {activeTab === 'routines' && (
           <div className="flex gap-2">
             <select value={selectedRoutineType} onChange={(e) => setSelectedRoutineType(e.target.value)}
               className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 text-xs rounded-[8px] px-3.5 h-11 min-h-[44px] focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-semibold cursor-pointer shadow-sm"
             >
               <option value="All" className="text-black dark:text-white dark:bg-neutral-900">All Routine Types</option>
               {ROUTINE_TYPES.map(type => (
                 <option key={type} value={type} className="text-black dark:text-white dark:bg-neutral-900">{type}</option>
               ))}
             </select>
           </div>
         )}

         {/* Subcategory selectors */}
         {activeTab !== 'routines' && (
           <div className="flex gap-2 flex-wrap">
             {activeTab === 'tkd' && (
               <select value={selectedBelt} onChange={(e) => setSelectedBelt(e.target.value)}
                 className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 text-xs rounded-[8px] px-3.5 h-11 min-h-[44px] focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-semibold cursor-pointer shadow-sm"
               >
                 <option value="All" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_all_belts')}</option>
                 {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
               </select>
             )}

             <select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)}
               className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 text-xs rounded-[8px] px-3.5 h-11 min-h-[44px] focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-semibold cursor-pointer shadow-sm"
             >
               <option value="All" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_all_categories')}</option>
               {activeTab === 'tkd' ? (
                 TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
               ) : activeTab === 'fitness' ? (
                 FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
               ) : (
                 DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
               )}
             </select>
           </div>
         )}
      </div>

      {/* Content Rendering Grid */}
      <div className={cn("grid gap-4 sm:gap-5", activeTab === 'routines' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5")}>
         {/* Routines View Mode */}
         {activeTab === 'routines' && filteredTemplates.map(template => (
           <div key={template.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 flex flex-col justify-between hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-md transition-all group duration-300 relative overflow-hidden shadow-sm">
             {/* Decorative difficulty accent bar */}
             <div className={cn("absolute top-0 left-0 right-0 h-[3px]", 
               template.difficulty === 'Elite' ? 'bg-purple-600' :
               template.difficulty === 'Advanced' ? 'bg-[#EF2F38]' :
               template.difficulty === 'Intermediate' ? 'bg-amber-500' : 'bg-emerald-500'
             )} />
             
             <div>
               <div className="flex items-center justify-between mb-3">
                 <div className="flex gap-1.5 flex-wrap">
                   <span className={cn("px-2 py-0.5 rounded-[6px] text-[8px] font-bold uppercase tracking-wider border shadow-sm",
                     template.difficulty === 'Elite' ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400' :
                     template.difficulty === 'Advanced' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' :
                     template.difficulty === 'Intermediate' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                   )}>
                     {template.difficulty}
                   </span>
                   <span className="px-2 py-0.5 rounded-[6px] text-[8px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 shadow-sm">
                     {template.structure?.routineType || 'Taekwondo Workout'}
                   </span>
                 </div>
                 <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono font-bold flex items-center gap-1">
                   <Clock className="w-3.5 h-3.5"/> {template.duration} Min Session
                 </span>
               </div>
               
               <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] dark:group-hover:text-[#EF2F38] transition-colors leading-tight mb-2">{template.title}</h3>
               <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-3 mb-4">{template.description}</p>

               <div className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 mb-4">
                 <span className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-2">Sequence Flow ({template.structure.exercises.length} Exercises)</span>
                 <ul className="text-[10px] text-neutral-700 dark:text-neutral-300 space-y-1 font-mono">
                   {template.structure.exercises.slice(0, 3).map((ex: string, i: number) => (
                     <li key={i} className="truncate">• {ex}</li>
                   ))}
                   {template.structure.exercises.length > 3 && (
                     <li className="text-neutral-400 dark:text-neutral-500 italic">+ {template.structure.exercises.length - 3} more...</li>
                   )}
                 </ul>
               </div>
             </div>

             <div className="flex items-center justify-between border-t border-neutral-100 dark:border-[#262626] pt-3 mt-2">
               <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">
                 <UserCircle className="w-4 h-4 text-neutral-500"/>
                 <span>{template.creator}</span>
               </div>

                <div className="flex gap-2">
                  <button onClick={() => setRunningWorkout(template)}
                    className="bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-300 dark:border-neutral-700 text-amber-600 dark:text-amber-400 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95"
                    title={t('lib_title_start_timer')}
                  >
                    <Timer className="w-4 h-4" weight="fill"/>
                  </button>
                  {isElevated && (
                    <>
                      <button onClick={() => {
                          setEditingRoutine(template);
                          setNewRoutine({
                            title: template.title,
                            description: template.description || '',
                            routineType: template.structure?.routineType || 'Taekwondo Workout',
                            difficulty: template.difficulty || 'Intermediate',
                            prepareSeconds: template.structure?.prepareSeconds ?? 10,
                            workSeconds: template.structure?.workSeconds ?? 30,
                            restSeconds: template.structure?.restSeconds ?? 15,
                            rounds: template.structure?.rounds ?? 6,
                            selectedExercises: Array.isArray(template.structure?.exercises) ? [...template.structure.exercises] : [],
                          });
                          setShowRoutineModal(true);
                        }}
                        className="bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95"
                        title={t('lib_edit_routine')}
                      >
                        <PencilSimple className="w-4 h-4"/>
                      </button>
                      <button onClick={() => handleDeleteRoutine(template.id, template.title)}
                        className="bg-neutral-100 hover:bg-red-50 dark:bg-[#1C1C1C] dark:hover:bg-red-950/20 border border-neutral-300 dark:border-neutral-700 text-red-600 dark:text-red-500 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95"
                        title={t('lib_title_delete_template')}
                      >
                        <Trash className="w-4 h-4"/>
                      </button>
                    </>
                  )}
                </div>
             </div>
           </div>
         ))}

          {/* Technical & Fitness Assets View Mode */}
          {activeTab !== 'routines' && filteredAssets.map(video => {
            const details = parseAssetDescription(video.description);
            return (
              <div key={video.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden flex flex-col justify-between hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-md transition-all group duration-300 shadow-sm">
                
                {/* Thumbnail card with dynamic play overlay */}
                <div className="aspect-video bg-neutral-100 dark:bg-[#1A1A1A] relative flex items-center justify-center border-b border-neutral-200 dark:border-[#262626] overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" 
                    style={{ backgroundImage: `url('${details.thumbnailUrl || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=480&auto=format&fit=crop'}')` }}
                  />
                  
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    {video.videoUrl ? (
                      <button onClick={(e) => { e.stopPropagation(); setActivePlayVideo(video); }} className="p-3 bg-[#EF2F38] text-white rounded-full hover:scale-110 transition-transform duration-300 shadow-xl shadow-red-950/40 cursor-pointer touch-manipulation active:scale-95">
                        <PlayCircle className="w-7 h-7" weight="fill"/>
                      </button>
                    ) : (
                      <div className="p-3 bg-[#1A1A1A] border border-[#333] text-neutral-400 rounded-full">
                        <PlayCircle className="w-7 h-7"/>
                      </div>
                    )}
                  </div>

                  {/* Subcategory Label badge */}
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/75 backdrop-blur-sm border border-white/10 rounded-[6px] text-[8px] font-bold uppercase tracking-wider text-neutral-200">
                    {video.category.startsWith('Fitness:') || video.category.startsWith('Dance:')
                      ? (t(getCategoryTranslationKey(video.category)) || video.category.replace('Fitness: ', '').replace('Dance: ', ''))
                      : (t(getCategoryTranslationKey(normalizeCategory(video.category))) || video.category)}
                  </span>

                  {/* Belt label badge (TKD only) */}
                  {activeTab === 'tkd' && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-[6px] text-[8px] font-bold uppercase tracking-wider text-[#EF2F38]">
                      {video.minBeltLevel}
                    </span>
                  )}

                  {/* Difficulty Badge */}
                  {details.difficulty && (
                    <span className={cn("absolute top-3 left-3 px-2 py-0.5 border rounded-[6px] text-[8px] font-bold uppercase tracking-wider shadow-sm",
                      details.difficulty === 'Elite' ? 'bg-purple-950/70 border-purple-500/30 text-purple-400' :
                      details.difficulty === 'Advanced' ? 'bg-red-950/70 border-red-500/30 text-red-400' :
                      details.difficulty === 'Intermediate' ? 'bg-amber-950/70 border-amber-500/30 text-amber-400' : 'bg-emerald-950/70 border-emerald-500/30 text-emerald-400'
                    )}>
                      {details.difficulty}
                    </span>
                  )}
                </div>

                {/* Details text area (Clicking here opens Detail Modal) */}
                <div onClick={() => setSelectedDetailAsset(video)} className="p-5 flex-1 flex flex-col justify-between space-y-4 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] dark:group-hover:text-[#EF2F38] transition-colors leading-tight">{video.title}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-2 line-clamp-3">{details.text || 'No description provided.'}</p>
                    
                    {/* Focus Zones tags preview */}
                    {details.focusZones && details.focusZones.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {details.focusZones.slice(0, 3).map((zone, i) => (
                          <span key={i} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[8px] font-semibold rounded-[4px] font-sans uppercase tracking-wider">
                            {zone}
                          </span>
                        ))}
                        {details.focusZones.length > 3 && (
                          <span className="text-[8px] text-neutral-400 dark:text-neutral-500 font-medium self-center ml-1">
                            +{details.focusZones.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-100 dark:border-[#262626]/60 pt-3">
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono uppercase font-bold">Ref: {video.id}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelected3DAsset(video); 
                          setShow3DStudio(true); 
                        }}
                        className="text-neutral-500 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer flex items-center gap-1 touch-manipulation active:scale-95"
                        title={t('lib_3d_biomechanics')}
                      >
                        <Stack className="w-3.5 h-3.5 text-[#EF2F38]" weight="bold"/>
                        <span className="text-[9px] font-bold hidden sm:inline">3D</span>
                      </button>
                      {video.videoUrl && (
                        <button onClick={(e) => { 
                            e.stopPropagation(); 
                            navigator.clipboard.writeText(video.videoUrl || ''); 
                            showNotification("Video URL copied to clipboard!", 'success');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer touch-manipulation active:scale-95"
                          title="Copy Video Link"
                        >
                          <Copy className="w-3.5 h-3.5"/>
                        </button>
                      )}
                      {isElevated && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleStartEdit(video); }}
                            className="text-neutral-500 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer touch-manipulation active:scale-95"
                            title={t('act_edit')}
                          >
                            <PencilSimple className="w-3.5 h-3.5"/>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDeleteVideo(video.id, video.title); }}
                            className="text-neutral-500 hover:text-red-500 transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer touch-manipulation active:scale-95"
                            title={t('lib_title_remove_library')}
                          >
                            <Trash className="w-3.5 h-3.5"/>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Empty Fallback State */}
      {((activeTab === 'routines' && filteredTemplates.length === 0) || (activeTab !== 'routines' && filteredAssets.length === 0)) && (
        <div className="text-center py-12 bg-white dark:bg-[#141414] border border-dashed border-neutral-200 dark:border-[#262626] rounded-[10px] space-y-3 p-6 shadow-sm">
           <ShieldWarning className="w-10 h-10 text-neutral-400 dark:text-neutral-500 mx-auto"/>
           <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No items match your criteria</h4>
           <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">Try clearing search filters or selecting another category.</p>
           {(searchQuery || selectedBelt !== 'All' || selectedSubCategory !== 'All' || selectedRoutineType !== 'All') && (
             <button
               onClick={() => {
                 setSearchQuery('');
                 setSelectedBelt('All');
                 setSelectedSubCategory('All');
                 setSelectedRoutineType('All');
               }}
               className="mt-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-[8px] text-xs font-bold transition-all min-h-[36px] active:scale-95 touch-manipulation cursor-pointer inline-flex items-center gap-1.5"
             >
               Reset All Filters
             </button>
           )}
        </div>
      )}

      {/* --- GLOBAL 3D ANATOMY & BIOMECHANICS STUDIO MODAL --- */}
      <AnatomyStudioModal
        isOpen={show3DStudio}
        onClose={() => setShow3DStudio(false)}
        asset={selected3DAsset}
        initialGender={anatomicalGender}
      />

      {/* --- FLOATING WORKOUT PLAYBACK TIMER INTERACTIVE PORTAL --- */}
      <AnimatePresence>
        {runningWorkout && (
          <WorkoutTimerModal workout={runningWorkout} onClose={() => setRunningWorkout(null)} />
        )}
      </AnimatePresence>

      {/* --- ADD ASSET MODAL DIALOG --- */}
      <AnimatePresence>
        {showAddModal && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
               <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                 className="w-full max-w-4xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
               >
                 <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-white">
                      {t('lib_add_asset')} - {activeTab === 'tkd' ? t('lib_tab_tkd') : activeTab === 'dance' ? t('lib_tab_dance') : t('lib_tab_fitness')}
                    </h2>
                    <button 
                      onClick={() => setShowAddModal(false)} 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                      title={t('act_close')}
                    >
                      <X className="w-5 h-5"/>
                    </button>
                 </div>
                 <form onSubmit={handleAddAsset} className="p-6 overflow-y-auto bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_asset_title')}</label>
                      <input type="text" value={newAsset.title} onChange={(e) => setNewAsset({ ...newAsset, title: e.target.value })} required
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder={t('lib_placeholder_asset_title')}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_desc_guidelines')}</label>
                      <textarea value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} required rows={2}
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20"
                        placeholder={t('lib_placeholder_asset_desc')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_category_col')}</label>
                        <select value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                        >
                          {activeTab === 'tkd' ? (
                            TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                          ) : activeTab === 'fitness' ? (
                            FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                          ) : (
                            DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{activeTab === 'tkd' ? t('lib_bulk_belt_col') : t('lib_routine_diff_label')}</label>
                        {activeTab === 'tkd' ? (
                          <select value={newAsset.minBeltLevel} onChange={(e) => setNewAsset({ ...newAsset, minBeltLevel: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                          </select>
                        ) : (
                          <select value={newAsset.difficulty} onChange={(e) => setNewAsset({ ...newAsset, difficulty: e.target.value as any })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {activeTab === 'tkd' && newAsset.category !== 'Theory & Terminology' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_diff_label')}</label>
                          <select value={newAsset.difficulty} onChange={(e) => setNewAsset({ ...newAsset, difficulty: e.target.value as any })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                          <input type="text" value={newAsset.repsSets} onChange={(e) => setNewAsset({ ...newAsset, repsSets: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="e.g. 3 sets x 15 reps"
                          />
                        </div>
                      </div>
                    )}

                    {activeTab === 'fitness' && (
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                        <input type="text" value={newAsset.repsSets} onChange={(e) => setNewAsset({ ...newAsset, repsSets: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          placeholder="e.g. 3 sets x 45 secs hold"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {newAsset.category !== 'Theory & Terminology' ? (
                        <div className="relative" ref={addMuscleDropdownRef}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_focus_zones')} / Muscles</label>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              placeholder="Search or select muscles..."
                              value={muscleSearch}
                              onChange={(e) => {
                                setMuscleSearch(e.target.value);
                                setShowMuscleDropdown(true);
                                setActiveMuscleIdx(-1);
                              }}
                              onFocus={() => setShowMuscleDropdown(true)}
                              onKeyDown={(e) => {
                                if (!showMuscleDropdown) {
                                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    setShowMuscleDropdown(true);
                                    e.preventDefault();
                                  }
                                  return;
                                }

                                const query = muscleSearch.toLowerCase();
                                const filtered = state.muscles.filter(m => {
                                  if (!query) return true;
                                  return m.name.toLowerCase().includes(query) || 
                                         (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                         (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                         m.muscleGroup.toLowerCase().includes(query);
                                });

                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setActiveMuscleIdx(prev => filtered.length > 0 ? (prev + 1) % filtered.length : -1);
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setActiveMuscleIdx(prev => filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : -1);
                                } else if (e.key === 'Enter') {
                                  if (activeMuscleIdx >= 0 && activeMuscleIdx < filtered.length) {
                                    e.preventDefault();
                                    const targetMuscle = filtered[activeMuscleIdx];
                                    const isSelected = selectedMuscles.some(s => s.muscleId === targetMuscle.id);
                                    if (isSelected) {
                                      setSelectedMuscles(selectedMuscles.filter(s => s.muscleId !== targetMuscle.id));
                                    } else {
                                      setSelectedMuscles([...selectedMuscles, { muscleId: targetMuscle.id, role: 'Primary' }]);
                                    }
                                  }
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setShowMuscleDropdown(false);
                                  setActiveMuscleIdx(-1);
                                }
                              }}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowMuscleDropdown(!showMuscleDropdown)}
                              className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                            >
                              {showMuscleDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {showMuscleDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-25">
                              {(() => {
                                const query = muscleSearch.toLowerCase();
                                const filtered = state.muscles.filter(m => {
                                  if (!query) return true;
                                  return m.name.toLowerCase().includes(query) || 
                                         (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                         (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                         m.muscleGroup.toLowerCase().includes(query);
                                });
                                
                                if (filtered.length === 0) {
                                  return <div className="p-3 text-xs text-neutral-400 text-center">No muscles found</div>;
                                }
                                
                                return filtered.map((m, idx) => {
                                  const isSelected = selectedMuscles.some(s => s.muscleId === m.id);
                                  const isActive = activeMuscleIdx === idx;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedMuscles(selectedMuscles.filter(s => s.muscleId !== m.id));
                                        } else {
                                          setSelectedMuscles([...selectedMuscles, { muscleId: m.id, role: 'Primary' }]);
                                        }
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                        isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]"
                                      )}
                                    >
                                      <span>
                                        {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({m.muscleGroup})</span>
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedMuscles.map(sm => {
                              const muscle = state.muscles.find(m => m.id === sm.muscleId);
                              if (!muscle) return null;
                              return (
                                <span
                                  key={sm.muscleId}
                                  className={cn(
                                    "px-2 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-1 cursor-pointer select-none transition-all shadow-sm",
                                    sm.role === 'Primary'
                                      ? "bg-red-500/10 text-red-500 border border-red-500/30"
                                      : "bg-blue-500/10 text-blue-500 border border-dashed border-blue-500/30"
                                  )}
                                  onClick={() => {
                                    setSelectedMuscles(selectedMuscles.map(x => x.muscleId === sm.muscleId ? { ...x, role: x.role === 'Primary' ? 'Secondary' : 'Primary' } : x));
                                  }}
                                  title="Click to toggle Primary vs Secondary"
                                >
                                  <span>{sm.role === 'Primary' ? '★ ' : '☆ '}{state.language === 'kh' && muscle.nameKh ? muscle.nameKh : (state.language === 'zh' && muscle.nameZh ? muscle.nameZh : muscle.name)}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMuscles(selectedMuscles.filter(x => x.muscleId !== sm.muscleId));
                                    }}
                                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div className={cn(newAsset.category === 'Theory & Terminology' ? "col-span-2" : "")}>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_cover_url')}</label>
                        <input type="text" value={newAsset.thumbnailUrl} onChange={(e) => setNewAsset({ ...newAsset, thumbnailUrl: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          placeholder="e.g. https://images.unsplash.com/..."
                        />
                        {(() => {
                          const ytId = getYouTubeId(newAsset.videoUrl);
                          const resolvedPreview = newAsset.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '');
                          if (!resolvedPreview) return null;
                          return (
                            <div className="mt-2 h-14 w-24 rounded-[8px] border border-neutral-200 dark:border-[#262626] overflow-hidden bg-neutral-100 dark:bg-[#1C1C1C] dark:bg-neutral-900 relative">
                              <img src={resolvedPreview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {newAsset.category !== 'Theory & Terminology' && (
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">{t('lib_form_instructions')}</label>
                        <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-80 overflow-y-auto">
                          {instructionSteps.map((step, idx) => (
                            <div
                              key={idx}
                              draggable
                              onDragStart={(e) => {
                                setDraggedIndex(idx);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedIndex === null || draggedIndex === idx) return;
                                const updated = [...instructionSteps];
                                const [draggedItem] = updated.splice(draggedIndex, 1);
                                updated.splice(idx, 0, draggedItem);
                                setInstructionSteps(updated);
                                setDraggedIndex(null);
                              }}
                              onDragEnd={() => setDraggedIndex(null)}
                              className={cn(
                                "flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all",
                                draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]"
                              )}
                            >
                              {/* Drag Handle */}
                              <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1">
                                <ListChecks className="w-4 h-4" />
                              </div>
                              
                              {/* Step Badge */}
                              <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[50px] text-center">
                                Step {idx + 1}
                              </span>
                              
                              {/* Input Box */}
                              <input
                                id={`step-input-add-${idx}`}
                                type="text"
                                value={step}
                                placeholder="Enter instruction detail..."
                                onChange={(e) => {
                                  const updated = [...instructionSteps];
                                  updated[idx] = e.target.value;
                                  setInstructionSteps(updated);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const updated = [...instructionSteps];
                                    updated.splice(idx + 1, 0, '');
                                    setInstructionSteps(updated);
                                    setTimeout(() => {
                                      document.getElementById(`step-input-add-${idx + 1}`)?.focus();
                                    }, 30);
                                  } else if (e.key === 'Backspace' && !step && idx > 0) {
                                    e.preventDefault();
                                    const updated = [...instructionSteps];
                                    updated.splice(idx, 1);
                                    setInstructionSteps(updated);
                                    setTimeout(() => {
                                      document.getElementById(`step-input-add-${idx - 1}`)?.focus();
                                    }, 30);
                                  }
                                }}
                                className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                              />
                              
                              {/* Remove button */}
                              {instructionSteps.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = instructionSteps.filter((_, i) => i !== idx);
                                    setInstructionSteps(updated);
                                  }}
                                  className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInstructionSteps([...instructionSteps, '']);
                            setTimeout(() => {
                              document.getElementById(`step-input-add-${instructionSteps.length}`)?.focus();
                            }, 30);
                          }}
                          className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Instruction Step
                        </button>
                      </div>
                    )}

                    {activeTab === 'tkd' && newAsset.category !== 'Theory & Terminology' && (
                      <div className="relative" ref={addFitnessSolutionsDropdownRef}>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">Linked Physical Training Solutions</label>
                        <div className="relative flex items-center">
                          <input 
                            type="text" 
                            placeholder="Search physical training solutions..."
                            value={fitnessSearch}
                            onChange={(e) => {
                              setFitnessSearch(e.target.value);
                              setShowFitnessDropdown(true);
                            }}
                            onFocus={() => setShowFitnessDropdown(true)}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setShowFitnessDropdown(!showFitnessDropdown)}
                            className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                          >
                            {showFitnessDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                          </button>
                        </div>
                        {showFitnessDropdown && (
                          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-[200]">
                            {(() => {
                              const query = fitnessSearch.toLowerCase();
                              const fitnessAssets = state.curriculumVideos.filter(v => 
                                v.minBeltLevel === 'Fitness' || v.category.startsWith('Fitness:')
                              );
                              const filtered = fitnessAssets.filter(f => 
                                f.title.toLowerCase().includes(query) || 
                                f.category.toLowerCase().includes(query)
                              );
                              
                              if (filtered.length === 0) {
                                return <div className="p-3 text-xs text-neutral-400 text-center">No fitness skills found</div>;
                              }
                              
                              return filtered.map(f => {
                                const isSelected = selectedFitnessSolutions.includes(f.id);
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedFitnessSolutions(selectedFitnessSolutions.filter(id => id !== f.id));
                                      } else {
                                        setSelectedFitnessSolutions([...selectedFitnessSolutions, f.id]);
                                      }
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                      isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]"
                                    )}
                                  >
                                    <span>
                                      {f.title}
                                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({f.category.replace('Fitness: ', '')})</span>
                                    </span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedFitnessSolutions.map(id => {
                            const fSkill = state.curriculumVideos.find(v => v.id === id);
                            if (!fSkill) return null;
                            return (
                              <span
                                key={id}
                                className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-2 py-0.5 text-[9px] font-bold rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 select-none"
                              >
                                <span>{fSkill.title}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFitnessSolutions(selectedFitnessSolutions.filter(x => x !== id));
                                  }}
                                  className="text-neutral-400 hover:text-red-500 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(activeTab === 'tkd' || activeTab === 'dance') && (
                      <>
                        {/* Skill Prerequisites Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Skill Prerequisites</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {prerequisiteSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...prerequisiteSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPrerequisiteSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`prereq-step-add-${idx}`} type="text" value={step} placeholder="e.g. Ap Chagi (Front Kick)"
                                  onChange={(e) => { const u = [...prerequisiteSteps]; u[idx] = e.target.value; setPrerequisiteSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...prerequisiteSteps]; u.splice(idx + 1, 0, ''); setPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...prerequisiteSteps]; u.splice(idx, 1); setPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {prerequisiteSteps.length > 1 && (
                                  <button type="button" onClick={() => setPrerequisiteSteps(prerequisiteSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPrerequisiteSteps([...prerequisiteSteps, '']); setTimeout(() => document.getElementById(`prereq-step-add-${prerequisiteSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Prerequisite</button>
                        </div>

                        {/* Principle of the Skill Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Principle of the Skill</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {principleSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...principleSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPrincipleSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`principle-step-add-${idx}`} type="text" value={step} placeholder="e.g. Dynamic snap at knee joint"
                                  onChange={(e) => { const u = [...principleSteps]; u[idx] = e.target.value; setPrincipleSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...principleSteps]; u.splice(idx + 1, 0, ''); setPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...principleSteps]; u.splice(idx, 1); setPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {principleSteps.length > 1 && (
                                  <button type="button" onClick={() => setPrincipleSteps(principleSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPrincipleSteps([...principleSteps, '']); setTimeout(() => document.getElementById(`principle-step-add-${principleSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Principle</button>
                        </div>

                        {/* Drilling Methods Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Drilling Methods</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {drillingSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...drillingSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setDrillingSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`drilling-step-add-${idx}`} type="text" value={step} placeholder="e.g. 3 rounds of 10 rapid repetitions per leg..."
                                  onChange={(e) => { const u = [...drillingSteps]; u[idx] = e.target.value; setDrillingSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...drillingSteps]; u.splice(idx + 1, 0, ''); setDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...drillingSteps]; u.splice(idx, 1); setDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {drillingSteps.length > 1 && (
                                  <button type="button" onClick={() => setDrillingSteps(drillingSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setDrillingSteps([...drillingSteps, '']); setTimeout(() => document.getElementById(`drilling-step-add-${drillingSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Drilling Method</button>
                        </div>

                        {/* Common Mistakes & Corrections Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Common Mistakes & Corrections</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {mistakeSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...mistakeSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setMistakeSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-start gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1 mt-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center mt-1">#{idx + 1}</span>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <input id={`mistake-input-add-${idx}`} type="text" value={step.mistake} placeholder="Mistake (e.g. Dropping hands)"
                                    onChange={(e) => { const u = [...mistakeSteps]; u[idx] = { ...u[idx], mistake: e.target.value }; setMistakeSteps(u); }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById(`correction-input-add-${idx}`)?.focus();
                                      } else if (e.key === 'Backspace' && !step.mistake && idx > 0) {
                                        e.preventDefault();
                                        const u = [...mistakeSteps];
                                        u.splice(idx, 1);
                                        setMistakeSteps(u);
                                        setTimeout(() => document.getElementById(`correction-input-add-${idx - 1}`)?.focus(), 30);
                                      }
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-red-500/20 dark:border-red-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/10 font-medium"
                                  />
                                  <input id={`correction-input-add-${idx}`} type="text" value={step.correction} placeholder="Correction (e.g. Keep guard up)"
                                    onChange={(e) => { const u = [...mistakeSteps]; u[idx] = { ...u[idx], correction: e.target.value }; setMistakeSteps(u); }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const u = [...mistakeSteps];
                                        u.splice(idx + 1, 0, { mistake: '', correction: '' });
                                        setMistakeSteps(u);
                                        setTimeout(() => document.getElementById(`mistake-input-add-${idx + 1}`)?.focus(), 30);
                                      } else if (e.key === 'Backspace' && !step.correction) {
                                        e.preventDefault();
                                        document.getElementById(`mistake-input-add-${idx}`)?.focus();
                                      }
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-emerald-500/20 dark:border-emerald-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium"
                                  />
                                </div>
                                {mistakeSteps.length > 1 && (
                                  <button type="button" onClick={() => setMistakeSteps(mistakeSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent mt-1"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setMistakeSteps([...mistakeSteps, { mistake: '', correction: '' }]); setTimeout(() => document.getElementById(`mistake-input-add-${mistakeSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Mistake & Correction</button>
                        </div>

                        {/* Performance & Application Step Builder */}
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Performance & Application</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                            {performanceSteps.map((step, idx) => (
                              <div key={idx} draggable
                                onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...performanceSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setPerformanceSteps(updated); setDraggedIndex(null); }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                              >
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                <input id={`performance-step-add-${idx}`} type="text" value={step} placeholder="e.g. Used for counter attacks in sparring..."
                                  onChange={(e) => { const u = [...performanceSteps]; u[idx] = e.target.value; setPerformanceSteps(u); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...performanceSteps]; u.splice(idx + 1, 0, ''); setPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-add-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...performanceSteps]; u.splice(idx, 1); setPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-add-${idx - 1}`)?.focus(), 30); } }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                {performanceSteps.length > 1 && (
                                  <button type="button" onClick={() => setPerformanceSteps(performanceSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setPerformanceSteps([...performanceSteps, '']); setTimeout(() => document.getElementById(`performance-step-add-${performanceSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Performance Note</button>
                        </div>
                      </>
                    )}

                    {/* Custom builders for Theory & Terminology category */}
                    {activeTab === 'tkd' && newAsset.category === 'Theory & Terminology' && (
                      <div className="space-y-5 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/20 dark:bg-neutral-900/10">
                        {/* Terminology List Builder */}
                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Korean Vocabulary Glossary</label>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {terminologyList.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                  <input 
                                    type="text" 
                                    value={item.korean} 
                                    placeholder="Korean (e.g., Jirugi)" 
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].korean = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <input 
                                    type="text" 
                                    value={item.english} 
                                    placeholder="English (e.g., Punch)" 
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].english = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <input 
                                    type="text" 
                                    value={item.khmer} 
                                    placeholder="Khmer (e.g., ម៉ាត់)" 
                                    onChange={(e) => {
                                      const u = [...terminologyList];
                                      u[idx].khmer = e.target.value;
                                      setTerminologyList(u);
                                    }}
                                    className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                </div>
                                {terminologyList.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => setTerminologyList(terminologyList.filter((_, i) => i !== idx))}
                                    className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setTerminologyList([...terminologyList, { korean: '', english: '', khmer: '' }])}
                            className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Vocabulary Term
                          </button>
                        </div>

                        {/* Study Guide Q&A Builder */}
                        <div className="space-y-2 border-t border-neutral-200 dark:border-[#262626] pt-4">
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Theoretical Q&A / Study Guide</label>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {studyGuideList.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-start bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                <div className="flex-1 space-y-2">
                                  <input 
                                    type="text" 
                                    value={item.question} 
                                    placeholder="Question (e.g., Meaning of white belt?)" 
                                    onChange={(e) => {
                                      const u = [...studyGuideList];
                                      u[idx].question = e.target.value;
                                      setStudyGuideList(u);
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                  <textarea 
                                    value={item.answer} 
                                    placeholder="Answer explanation..." 
                                    rows={2}
                                    onChange={(e) => {
                                      const u = [...studyGuideList];
                                      u[idx].answer = e.target.value;
                                      setStudyGuideList(u);
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                  />
                                </div>
                                {studyGuideList.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => setStudyGuideList(studyGuideList.filter((_, i) => i !== idx))}
                                    className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent mt-1"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setStudyGuideList([...studyGuideList, { question: '', answer: '' }])}
                            className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Q&A Card
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_link_col')} ({state.language === 'kh' ? 'ស្រេចចិត្ត' : (state.language === 'zh' ? '选填' : 'Optional')})</label>
                      <input type="text" value={newAsset.videoUrl} onChange={(e) => setNewAsset({ ...newAsset, videoUrl: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                        placeholder="e.g. https://drive.google.com/file/d/..."
                      />
                    </div>

                    <button type="submit"
                      className="w-full bg-[#EF2F38] text-white hover:bg-[#d6262f] py-3 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all mt-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                    >
                      {t('lib_add_to_library')}
                    </button>
                 </form>
               </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* --- BUILD ROUTINE TEMPLATE MODAL DIALOG --- */}
      <AnimatePresence>
        {showRoutineModal && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
               <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
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

                    <div className="grid grid-cols-3 gap-4">
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
                        <input type="number" min={1} value={newRoutine.rounds} onChange={(e) => setNewRoutine({ ...newRoutine, rounds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 shadow-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_prep_label')}</label>
                        <input type="number" min={0} value={newRoutine.prepareSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, prepareSeconds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_work_label')}</label>
                        <input type="number" min={1} value={newRoutine.workSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, workSeconds: Number(e.target.value) })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_rest_label')}</label>
                        <input type="number" min={0} value={newRoutine.restSeconds} onChange={(e) => setNewRoutine({ ...newRoutine, restSeconds: Number(e.target.value) })} required
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
                                  <span>+ Add Custom: "{exerciseSearch.trim()}"</span>
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
                                    <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#EF2F38] transition-opacity" />
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

             <button type="submit"
               className="w-full bg-amber-500 text-black hover:bg-amber-600 py-3 min-h-[42px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all mt-2 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
             >
               {editingRoutine ? t('lib_save_routine') : t('lib_create_routine_title')}
             </button>
                 </form>
               </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* --- BULK IMPORT ASSETS MODAL DIALOG --- */}
      <AnimatePresence>
        {showBulkModal && (
          <Portal>
            <BulkImportAssetModal activeTab={activeTab} onClose={() => setShowBulkModal(false)} />
          </Portal>
        )}
      </AnimatePresence>

      {/* --- VIDEO PLAYER MODAL PORTAL --- */}
      <AnimatePresence>
        {activePlayVideo && (
          <Portal>
            <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <div className="w-full max-w-3xl bg-[#0A0A0A] border border-[#262626] rounded-[10px] overflow-hidden shadow-2xl flex flex-col max-h-[85dvh]">
                <div className="p-4 md:p-5 border-b border-[#262626] bg-[#0F0F0F] flex justify-between items-center">
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] rounded-[6px]">
                      {t(getCategoryTranslationKey(activePlayVideo.category)) || activePlayVideo.category.replace('Fitness: ', '').replace('Dance: ', '')}
                    </span>
                    <h3 className="text-sm md:text-base font-bold text-white mt-1.5 leading-tight">{activePlayVideo.title}</h3>
                  </div>
                  <button 
                    onClick={() => setActivePlayVideo(null)} 
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1A1A1A] border border-[#262626] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                    title={t('act_close')}
                  >
                    <X className="w-4 h-4"/>
                  </button>
                </div>
                
                <div className="flex-1 bg-black flex items-center justify-center p-2 min-h-[300px]">
                  {activePlayVideo.videoUrl ? (
                    <iframe 
                      src={getEmbedVideoUrl(activePlayVideo.videoUrl)} 
                      className="w-full h-full aspect-video border-0 rounded-[8px]"
                      allow="autoplay; encrypted-media" 
                      allowFullScreen
                    />
                  ) : (
                    <p className="text-xs text-neutral-400 font-mono">{t('lib_no_video_url')}</p>
                  )}
                </div>
              </div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
      {/* --- EXERCISE DETAIL & EDIT MODAL DIALOG --- */}
      <AnimatePresence>
        {selectedDetailAsset && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                className="w-full max-w-2xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
              >
                {editAsset ? (
                  /* --- EDIT MODE FORM --- */
                  <form onSubmit={handleSaveEditAsset} className="flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800 dark:text-white">
                        {t('lib_edit_asset_title')}
                      </h2>
                      <button type="button" onClick={() => setEditAsset(null)} className="text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white transition-colors cursor-pointer">
                        <X className="w-5 h-5"/>
                      </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_asset_title')}</label>
                        <input type="text" value={editAsset.title} onChange={(e) => setEditAsset({ ...editAsset, title: e.target.value })} required
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_desc_guidelines')}</label>
                        <textarea value={editAsset.description} onChange={(e) => setEditAsset({ ...editAsset, description: e.target.value })} required rows={2}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] dark:focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_category_col')}</label>
                          <select value={editAsset.category} onChange={(e) => setEditAsset({ ...editAsset, category: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                          >
                            {activeTab === 'tkd' ? (
                              TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            ) : activeTab === 'dance' ? (
                              DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                            ) : (
                              FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{activeTab === 'tkd' ? t('lib_bulk_belt_col') : t('lib_routine_diff_label')}</label>
                          {activeTab === 'tkd' ? (
                            <select value={editAsset.minBeltLevel} onChange={(e) => setEditAsset({ ...editAsset, minBeltLevel: e.target.value })}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                            >
                              {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                            </select>
                          ) : (
                            <select value={editAsset.difficulty} onChange={(e) => setEditAsset({ ...editAsset, difficulty: e.target.value })}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                            >
                              <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                              <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                              <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                              <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                            </select>
                          )}
                        </div>
                      </div>

                    {activeTab === 'tkd' && editAsset.category !== 'Theory & Terminology' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_routine_diff_label')}</label>
                          <select value={editAsset.difficulty} onChange={(e) => setEditAsset({ ...editAsset, difficulty: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] shadow-sm font-semibold text-black dark:text-white"
                          >
                            <option value="Beginner" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_beginner')}</option>
                            <option value="Intermediate" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_intermediate')}</option>
                            <option value="Advanced" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_advanced')}</option>
                            <option value="Elite" className="text-black dark:text-white dark:bg-neutral-900">{t('lib_diff_elite')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_reps_sets')}</label>
                          <input type="text" value={editAsset.repsSets} onChange={(e) => setEditAsset({ ...editAsset, repsSets: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                            placeholder="e.g. 3 sets x 12 reps"
                          />
                        </div>
                      </div>
                    )}

                      <div className="grid grid-cols-2 gap-4">
                        {editAsset.category !== 'Theory & Terminology' && (
                          <div className="relative" ref={editMuscleDropdownRef}>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_focus_zones')} / Muscles</label>
                            <div className="relative flex items-center">
                              <input 
                                type="text" 
                                placeholder="Search or select muscles..."
                                value={editMuscleSearch}
                                onChange={(e) => {
                                  setEditMuscleSearch(e.target.value);
                                  setShowEditMuscleDropdown(true);
                                  setEditActiveMuscleIdx(-1);
                                }}
                                onFocus={() => setShowEditMuscleDropdown(true)}
                                onKeyDown={(e) => {
                                  if (!showEditMuscleDropdown) {
                                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                      setShowEditMuscleDropdown(true);
                                      e.preventDefault();
                                    }
                                    return;
                                  }

                                  const query = editMuscleSearch.toLowerCase();
                                  const filtered = state.muscles.filter(m => {
                                    if (!query) return true;
                                    return m.name.toLowerCase().includes(query) || 
                                           (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                           (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                           m.muscleGroup.toLowerCase().includes(query);
                                  });

                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setEditActiveMuscleIdx(prev => filtered.length > 0 ? (prev + 1) % filtered.length : -1);
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setEditActiveMuscleIdx(prev => filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : -1);
                                  } else if (e.key === 'Enter') {
                                    if (editActiveMuscleIdx >= 0 && editActiveMuscleIdx < filtered.length) {
                                      e.preventDefault();
                                      const targetMuscle = filtered[editActiveMuscleIdx];
                                      const isSelected = editSelectedMuscles.some(s => s.muscleId === targetMuscle.id);
                                      if (isSelected) {
                                        setEditSelectedMuscles(editSelectedMuscles.filter(s => s.muscleId !== targetMuscle.id));
                                      } else {
                                        setEditSelectedMuscles([...editSelectedMuscles, { muscleId: targetMuscle.id, role: 'Primary' }]);
                                      }
                                    }
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setShowEditMuscleDropdown(false);
                                    setEditActiveMuscleIdx(-1);
                                  }
                                }}
                                className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditMuscleDropdown(!showEditMuscleDropdown)}
                                className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                              >
                                {showEditMuscleDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                              </button>
                            </div>
                            {showEditMuscleDropdown && (
                              <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-25">
                                {(() => {
                                  const query = editMuscleSearch.toLowerCase();
                                  const filtered = state.muscles.filter(m => {
                                    if (!query) return true;
                                    return m.name.toLowerCase().includes(query) || 
                                           (m.nameKh && m.nameKh.toLowerCase().includes(query)) ||
                                           (m.nameZh && m.nameZh.toLowerCase().includes(query)) ||
                                           m.muscleGroup.toLowerCase().includes(query);
                                  });
                                  
                                  if (filtered.length === 0) {
                                    return <div className="p-3 text-xs text-neutral-400 text-center">No muscles found</div>;
                                  }
                                  
                                  return filtered.map((m, idx) => {
                                    const isSelected = editSelectedMuscles.some(s => s.muscleId === m.id);
                                    const isActive = editActiveMuscleIdx === idx;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setEditSelectedMuscles(editSelectedMuscles.filter(s => s.muscleId !== m.id));
                                          } else {
                                            setEditSelectedMuscles([...editSelectedMuscles, { muscleId: m.id, role: 'Primary' }]);
                                          }
                                        }}
                                        className={cn(
                                          "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                          isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]",
                                          isActive && "bg-[#EF2F38]/15 dark:bg-[#EF2F38]/20"
                                        )}
                                      >
                                        <span>
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({m.muscleGroup})</span>
                                        </span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {editSelectedMuscles.map(sm => {
                                const muscle = state.muscles.find(m => m.id === sm.muscleId);
                                if (!muscle) return null;
                                return (
                                  <span
                                    key={sm.muscleId}
                                    className={cn(
                                      "px-2 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-1 cursor-pointer select-none transition-all shadow-sm",
                                      sm.role === 'Primary'
                                        ? "bg-red-500/10 text-red-500 border border-red-500/30"
                                        : "bg-blue-500/10 text-blue-500 border border-dashed border-blue-500/30"
                                    )}
                                    onClick={() => {
                                      setEditSelectedMuscles(editSelectedMuscles.map(x => x.muscleId === sm.muscleId ? { ...x, role: x.role === 'Primary' ? 'Secondary' : 'Primary' } : x));
                                    }}
                                    title="Click to toggle Primary vs Secondary"
                                  >
                                    <span>{sm.role === 'Primary' ? '★ ' : '☆ '}{state.language === 'kh' && muscle.nameKh ? muscle.nameKh : (state.language === 'zh' && muscle.nameZh ? muscle.nameZh : muscle.name)}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditSelectedMuscles(editSelectedMuscles.filter(x => x.muscleId !== sm.muscleId));
                                      }}
                                      className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className={cn(editAsset.category === 'Theory & Terminology' ? "col-span-2" : "")}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_form_cover_url')}</label>
                          <input type="text" value={editAsset.thumbnailUrl} onChange={(e) => setEditAsset({ ...editAsset, thumbnailUrl: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                          />
                          {(() => {
                            const ytId = getYouTubeId(editAsset.videoUrl);
                            const resolvedPreview = editAsset.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '');
                            if (!resolvedPreview) return null;
                            return (
                              <div className="mt-2 h-14 w-24 rounded-[8px] border border-neutral-200 dark:border-[#262626] overflow-hidden bg-neutral-100 dark:bg-neutral-900 relative">
                                <img src={resolvedPreview} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {editAsset.category !== 'Theory & Terminology' && (
                        <div>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">{t('lib_form_instructions')}</label>
                          <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-80 overflow-y-auto">
                            {editInstructionSteps.map((step, idx) => (
                              <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedIndex(idx);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedIndex === null || draggedIndex === idx) return;
                                  const updated = [...editInstructionSteps];
                                  const [draggedItem] = updated.splice(draggedIndex, 1);
                                  updated.splice(idx, 0, draggedItem);
                                  setEditInstructionSteps(updated);
                                  setDraggedIndex(null);
                                }}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={cn(
                                  "flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all",
                                  draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]"
                                )}
                              >
                                {/* Drag Handle */}
                                <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1">
                                  <ListChecks className="w-4 h-4" />
                                </div>
                                
                                {/* Step Badge */}
                                <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[50px] text-center">
                                  Step {idx + 1}
                                </span>
                                
                                {/* Input Box */}
                                <input
                                  id={`step-input-edit-${idx}`}
                                  type="text"
                                  value={step}
                                  placeholder="Enter instruction detail..."
                                  onChange={(e) => {
                                    const updated = [...editInstructionSteps];
                                    updated[idx] = e.target.value;
                                    setEditInstructionSteps(updated);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const updated = [...editInstructionSteps];
                                      updated.splice(idx + 1, 0, '');
                                      setEditInstructionSteps(updated);
                                      setTimeout(() => {
                                        document.getElementById(`step-input-edit-${idx + 1}`)?.focus();
                                      }, 30);
                                    } else if (e.key === 'Backspace' && !step && idx > 0) {
                                      e.preventDefault();
                                      const updated = [...editInstructionSteps];
                                      updated.splice(idx, 1);
                                      setEditInstructionSteps(updated);
                                      setTimeout(() => {
                                        document.getElementById(`step-input-edit-${idx - 1}`)?.focus();
                                      }, 30);
                                    }
                                  }}
                                  className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                                />
                                
                                {/* Remove button */}
                                {editInstructionSteps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = editInstructionSteps.filter((_, i) => i !== idx);
                                      setEditInstructionSteps(updated);
                                    }}
                                    className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditInstructionSteps([...editInstructionSteps, '']);
                              setTimeout(() => {
                                document.getElementById(`step-input-edit-${editInstructionSteps.length}`)?.focus();
                              }, 30);
                            }}
                            className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Instruction Step
                          </button>
                        </div>
                      )}

                      {activeTab === 'tkd' && (
                        <div className="relative" ref={editFitnessSolutionsDropdownRef}>
                          <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">Linked Physical Training Solutions</label>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              placeholder="Search physical training solutions..."
                              value={editFitnessSearch}
                              onChange={(e) => {
                                setEditFitnessSearch(e.target.value);
                                setShowEditFitnessDropdown(true);
                              }}
                              onFocus={() => setShowEditFitnessDropdown(true)}
                              className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-3.5 pr-8 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditFitnessDropdown(!showEditFitnessDropdown)}
                              className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer border-0 bg-transparent flex items-center justify-center"
                            >
                              {showEditFitnessDropdown ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {showEditFitnessDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-lg z-[200]">
                              {(() => {
                                const query = editFitnessSearch.toLowerCase();
                                const fitnessAssets = state.curriculumVideos.filter(v => 
                                  v.minBeltLevel === 'Fitness' || v.category.startsWith('Fitness:')
                                );
                                const filtered = fitnessAssets.filter(f => 
                                  f.title.toLowerCase().includes(query) || 
                                  f.category.toLowerCase().includes(query)
                                );
                                
                                if (filtered.length === 0) {
                                  return <div className="p-3 text-xs text-neutral-400 text-center">No fitness skills found</div>;
                                }
                                
                                return filtered.map(f => {
                                  const isSelected = editSelectedFitnessSolutions.includes(f.id);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setEditSelectedFitnessSolutions(editSelectedFitnessSolutions.filter(id => id !== f.id));
                                        } else {
                                          setEditSelectedFitnessSolutions([...editSelectedFitnessSolutions, f.id]);
                                        }
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-xs hover:bg-[#EF2F38]/10 text-neutral-700 dark:text-neutral-300 transition-colors flex justify-between items-center cursor-pointer border-0 bg-transparent",
                                        isSelected && "bg-[#EF2F38]/5 font-semibold text-[#EF2F38] dark:text-[#EF2F38]"
                                      )}
                                    >
                                      <span>
                                        {f.title}
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal ml-1">({f.category.replace('Fitness: ', '')})</span>
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-[#EF2F38]" />}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {editSelectedFitnessSolutions.map(id => {
                              const fSkill = state.curriculumVideos.find(v => v.id === id);
                              if (!fSkill) return null;
                              return (
                                <span
                                  key={id}
                                  className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-2 py-0.5 text-[9px] font-bold rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 select-none"
                                >
                                  <span>{fSkill.title}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditSelectedFitnessSolutions(editSelectedFitnessSolutions.filter(x => x !== id));
                                    }}
                                    className="text-neutral-400 hover:text-red-500 font-bold ml-0.5 border-0 bg-transparent cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(activeTab === 'tkd' || activeTab === 'dance') && editAsset.category !== 'Theory & Terminology' && (
                        <>
                          {/* Skill Prerequisites Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Skill Prerequisites</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrerequisiteSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrerequisiteSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrerequisiteSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`prereq-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Ap Chagi (Front Kick)" onChange={(e) => { const u = [...editPrerequisiteSteps]; u[idx] = e.target.value; setEditPrerequisiteSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx + 1, 0, ''); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx, 1); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrerequisiteSteps.length > 1 && (<button type="button" onClick={() => setEditPrerequisiteSteps(editPrerequisiteSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrerequisiteSteps([...editPrerequisiteSteps, '']); setTimeout(() => document.getElementById(`prereq-step-edit-${editPrerequisiteSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Prerequisite</button>
                          </div>

                          {/* Principle of the Skill Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Principle of the Skill</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrincipleSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrincipleSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrincipleSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`principle-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Dynamic snap at knee joint" onChange={(e) => { const u = [...editPrincipleSteps]; u[idx] = e.target.value; setEditPrincipleSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx + 1, 0, ''); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx, 1); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrincipleSteps.length > 1 && (<button type="button" onClick={() => setEditPrincipleSteps(editPrincipleSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrincipleSteps([...editPrincipleSteps, '']); setTimeout(() => document.getElementById(`principle-step-edit-${editPrincipleSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Principle</button>
                          </div>

                          {/* Drilling Methods Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Drilling Methods</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editDrillingSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editDrillingSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditDrillingSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`drilling-step-edit-${idx}`} type="text" value={step} placeholder="e.g. 3 rounds of 10 rapid repetitions per leg..." onChange={(e) => { const u = [...editDrillingSteps]; u[idx] = e.target.value; setEditDrillingSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx + 1, 0, ''); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx, 1); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editDrillingSteps.length > 1 && (<button type="button" onClick={() => setEditDrillingSteps(editDrillingSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditDrillingSteps([...editDrillingSteps, '']); setTimeout(() => document.getElementById(`drilling-step-edit-${editDrillingSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Drilling Method</button>
                          </div>

                          {/* Common Mistakes & Corrections Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Common Mistakes & Corrections</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editMistakeSteps.map((step, idx) => (
                                <div key={idx} draggable
                                  onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editMistakeSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditMistakeSteps(updated); setDraggedIndex(null); }}
                                  onDragEnd={() => setDraggedIndex(null)}
                                  className={cn("flex items-start gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}
                                >
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1 mt-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center mt-1">#{idx + 1}</span>
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <input id={`mistake-input-edit-${idx}`} type="text" value={step.mistake} placeholder="Mistake (e.g. Dropping hands)"
                                      onChange={(e) => { const u = [...editMistakeSteps]; u[idx] = { ...u[idx], mistake: e.target.value }; setEditMistakeSteps(u); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          document.getElementById(`correction-input-edit-${idx}`)?.focus();
                                        } else if (e.key === 'Backspace' && !step.mistake && idx > 0) {
                                          e.preventDefault();
                                          const u = [...editMistakeSteps];
                                          u.splice(idx, 1);
                                          setEditMistakeSteps(u);
                                          setTimeout(() => document.getElementById(`correction-input-edit-${idx - 1}`)?.focus(), 30);
                                        }
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-red-500/20 dark:border-red-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/10 font-medium"
                                    />
                                    <input id={`correction-input-edit-${idx}`} type="text" value={step.correction} placeholder="Correction (e.g. Keep guard up)"
                                      onChange={(e) => { const u = [...editMistakeSteps]; u[idx] = { ...u[idx], correction: e.target.value }; setEditMistakeSteps(u); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const u = [...editMistakeSteps];
                                          u.splice(idx + 1, 0, { mistake: '', correction: '' });
                                          setEditMistakeSteps(u);
                                          setTimeout(() => document.getElementById(`mistake-input-edit-${idx + 1}`)?.focus(), 30);
                                        } else if (e.key === 'Backspace' && !step.correction) {
                                          e.preventDefault();
                                          document.getElementById(`mistake-input-edit-${idx}`)?.focus();
                                        }
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-emerald-500/20 dark:border-emerald-500/10 rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium"
                                    />
                                  </div>
                                  {editMistakeSteps.length > 1 && (
                                    <button type="button" onClick={() => setEditMistakeSteps(editMistakeSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent mt-1"><Trash className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditMistakeSteps([...editMistakeSteps, { mistake: '', correction: '' }]); setTimeout(() => document.getElementById(`mistake-input-edit-${editMistakeSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Mistake & Correction</button>
                          </div>

                          {/* Performance & Application Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Performance & Application</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPerformanceSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPerformanceSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPerformanceSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[8px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`performance-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Used for counter attacks in sparring..." onChange={(e) => { const u = [...editPerformanceSteps]; u[idx] = e.target.value; setEditPerformanceSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx + 1, 0, ''); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx, 1); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPerformanceSteps.length > 1 && (<button type="button" onClick={() => setEditPerformanceSteps(editPerformanceSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPerformanceSteps([...editPerformanceSteps, '']); setTimeout(() => document.getElementById(`performance-step-edit-${editPerformanceSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Performance Note</button>
                          </div>
                        </>
                      )}

                      {/* Custom builders for Theory & Terminology category */}
                      {activeTab === 'tkd' && editAsset.category === 'Theory & Terminology' && (
                        <div className="space-y-5 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-neutral-50/20 dark:bg-neutral-900/10">
                          {/* Terminology List Builder */}
                          <div className="space-y-2">
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Korean Vocabulary Glossary</label>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {editTerminologyList.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                  <div className="flex-1 grid grid-cols-3 gap-2">
                                    <input 
                                      type="text" 
                                      value={item.korean} 
                                      placeholder="Korean (e.g., Jirugi)" 
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].korean = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <input 
                                      type="text" 
                                      value={item.english} 
                                      placeholder="English (e.g., Punch)" 
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].english = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <input 
                                      type="text" 
                                      value={item.khmer} 
                                      placeholder="Khmer (e.g., ម៉ាត់)" 
                                      onChange={(e) => {
                                        const u = [...editTerminologyList];
                                        u[idx].khmer = e.target.value;
                                        setEditTerminologyList(u);
                                      }}
                                      className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                  </div>
                                  {editTerminologyList.length > 1 && (
                                    <button 
                                      type="button" 
                                      onClick={() => setEditTerminologyList(editTerminologyList.filter((_, i) => i !== idx))}
                                      className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setEditTerminologyList([...editTerminologyList, { korean: '', english: '', khmer: '' }])}
                              className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Vocabulary Term
                            </button>
                          </div>

                          {/* Study Guide Q&A Builder */}
                          <div className="space-y-2 border-t border-neutral-200 dark:border-[#262626] pt-4">
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500">Theoretical Q&A / Study Guide</label>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {editStudyGuideList.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-start bg-white dark:bg-[#141414] border border-neutral-250 dark:border-[#262626] rounded-[8px] p-2.5 shadow-sm relative group">
                                  <div className="flex-1 space-y-2">
                                    <input 
                                      type="text" 
                                      value={item.question} 
                                      placeholder="Question (e.g., Meaning of white belt?)" 
                                      onChange={(e) => {
                                        const u = [...editStudyGuideList];
                                        u[idx].question = e.target.value;
                                        setEditStudyGuideList(u);
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                    <textarea 
                                      value={item.answer} 
                                      placeholder="Answer explanation..." 
                                      rows={2}
                                      onChange={(e) => {
                                        const u = [...editStudyGuideList];
                                        u[idx].answer = e.target.value;
                                        setEditStudyGuideList(u);
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                                    />
                                  </div>
                                  {editStudyGuideList.length > 1 && (
                                    <button 
                                      type="button" 
                                      onClick={() => setEditStudyGuideList(editStudyGuideList.filter((_, i) => i !== idx))}
                                      className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-0 bg-transparent mt-1"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setEditStudyGuideList([...editStudyGuideList, { question: '', answer: '' }])}
                              className="text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Q&A Card
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-1.5">{t('lib_bulk_link_col')}</label>
                        <input type="text" value={editAsset.videoUrl} onChange={(e) => setEditAsset({ ...editAsset, videoUrl: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="p-4 md:p-5 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2.5 shrink-0">
                      <button type="button" onClick={() => setEditAsset(null)}
                        className="px-4 py-2 min-h-[40px] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[8px] text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] transition-all cursor-pointer active:scale-95 touch-manipulation"
                      >
                        {t('lib_bulk_cancel')}
                      </button>
                      <button type="submit"
                        className="px-4 py-2 min-h-[40px] bg-[#EF2F38] text-white rounded-[8px] text-xs font-bold uppercase hover:bg-[#d6262f] transition-all shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                      >
                        {t('act_save_changes')}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* --- VIEW DETAILS MODE --- */
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#262626]/40 text-neutral-600 dark:text-neutral-400 rounded-[6px] shadow-sm">
                            {selectedDetailAsset.category.startsWith('Fitness:') || selectedDetailAsset.category.startsWith('Dance:')
                              ? (t(getCategoryTranslationKey(selectedDetailAsset.category)) || selectedDetailAsset.category.replace('Fitness: ', '').replace('Dance: ', ''))
                              : (t(getCategoryTranslationKey(normalizeCategory(selectedDetailAsset.category))) || selectedDetailAsset.category)}
                          </span>
                          {selectedDetailAsset.minBeltLevel !== 'Fitness' && selectedDetailAsset.minBeltLevel !== 'Dance' && (
                            <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] rounded-[6px] shadow-sm">
                              {t(getBeltTranslationKey(selectedDetailAsset.minBeltLevel))} {t('lms_belt_req_suffix')}
                            </span>
                          )}
                          {parseAssetDescription(selectedDetailAsset.description).difficulty && (
                            <span className={cn("text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-[6px] shadow-sm",
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Elite' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' :
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Advanced' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
                              parseAssetDescription(selectedDetailAsset.description).difficulty === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            )}>
                              {(() => {
                                const diff = parseAssetDescription(selectedDetailAsset.description).difficulty;
                                if (diff === 'Elite') return t('lib_diff_elite');
                                if (diff === 'Advanced') return t('lib_diff_advanced');
                                if (diff === 'Intermediate') return t('lib_diff_intermediate');
                                return t('lib_diff_beginner');
                              })()}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm md:text-base font-bold text-neutral-900 dark:text-white mt-1.5 leading-tight">{selectedDetailAsset.title}</h3>
                      </div>
                      <button 
                        onClick={() => setSelectedDetailAsset(null)} 
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        title={t('act_close')}
                      >
                        <X className="w-4 h-4"/>
                      </button>
                    </div>

                    {/* Scrollable details panel */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
                      {/* Video Player Section */}
                      {selectedDetailAsset.videoUrl ? (
                        <div className="aspect-video w-full bg-black rounded-[8px] overflow-hidden border border-neutral-200 dark:border-[#262626] shadow-md shrink-0">
                          <iframe 
                            src={getEmbedVideoUrl(selectedDetailAsset.videoUrl)} 
                            className="w-full h-full border-0"
                            allow="autoplay; encrypted-media" 
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="h-44 w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col items-center justify-center text-center p-6 text-neutral-400 dark:text-neutral-500">
                          <PlayCircle className="w-10 h-10 mb-2 opacity-50"/>
                          <p className="text-xs font-mono">{t('lib_no_video_desc')}</p>
                        </div>
                      )}

                      {/* Reps/Sets and Muscle Group Info cards */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-1">{t('lib_target_reps_sets')}</span>
                            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                              {parseAssetDescription(selectedDetailAsset.description).repsSets || t('lib_self_paced')}
                            </span>
                          </div>
                          <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-1">{t('lib_focus_areas')}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {parseAssetDescription(selectedDetailAsset.description).focusZones && parseAssetDescription(selectedDetailAsset.description).focusZones!.length > 0 ? (
                                parseAssetDescription(selectedDetailAsset.description).focusZones!.map((zone, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-neutral-200/50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[8px] font-bold rounded uppercase tracking-wider font-sans">
                                    {zone}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 font-sans">{t('lib_general_syllabus')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Anatomical Muscle Load section */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && (() => {
                        const relations = state.assetMuscleRelations.filter(r => r.assetId === selectedDetailAsset.id);
                        if (relations.length === 0) return null;

                        const primaryMuscles = relations
                          .filter(r => r.role === 'Primary')
                          .map(r => state.muscles.find(m => m.id === r.muscleId))
                          .filter(Boolean);

                        const secondaryMuscles = relations
                          .filter(r => r.role === 'Secondary')
                          .map(r => state.muscles.find(m => m.id === r.muscleId))
                          .filter(Boolean);

                        // Build 3D heatmap loads
                        const muscleLoads: Record<string, number> = {};
                        relations.forEach(r => {
                          const m = state.muscles.find(x => x.id === r.muscleId);
                          if (m) {
                            const normalized = normalizeMuscleNameFor3D(m.name);
                            muscleLoads[normalized] = r.role === 'Primary' ? 1.0 : 0.5;
                          }
                        });

                        return (
                          <div className="space-y-3 p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                            <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Anatomical Muscle Load Analysis</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left side: List of Target Muscles */}
                              <div className="space-y-4 flex flex-col justify-center">
                                {primaryMuscles.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="block text-[8px] uppercase font-black text-red-500 tracking-wide flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                      Primary Target
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {primaryMuscles.map((m: any) => (
                                        <span key={m.id} className="px-2.5 py-1 bg-red-500/10 text-red-500 border border-red-500/25 text-[9px] font-bold rounded-[8px] transition-all hover:bg-red-500/15">
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {secondaryMuscles.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="block text-[8px] uppercase font-black text-sky-500 dark:text-sky-400 tracking-wide flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                                      Secondary / Stabilizers
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {secondaryMuscles.map((m: any) => (
                                        <span key={m.id} className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-dashed border-blue-500/25 text-[9px] font-bold rounded-[8px] transition-all hover:bg-blue-500/15">
                                          {state.language === 'kh' && m.nameKh ? m.nameKh : (state.language === 'zh' && m.nameZh ? m.nameZh : m.name)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right side: 3D Holographic Model viewport */}
                              <div className="relative border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden bg-neutral-100/40 dark:bg-[#0A0A0A] flex flex-col justify-between min-h-[300px] h-[300px]">
                                <div className="flex justify-between items-center p-3 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#111111]/50 z-10">
                                  <span className="text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">3D Hologram Viewer</span>
                                  <div className="flex items-center gap-2">
                                    {/* Gender toggle */}
                                    <div className="flex bg-neutral-200/50 dark:bg-[#1C1C1C] p-0.5 rounded-[8px] gap-0.5 select-none">
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAnatomicalGender('Male'); }} 
                                        className={cn(
                                          "px-2 py-0.5 text-[8px] uppercase font-bold tracking-wider rounded-[8px] transition-all cursor-pointer border-0",
                                          anatomicalGender === 'Male' ? "bg-[#EF2F38] text-white" : "text-neutral-500 bg-transparent hover:text-neutral-800 dark:hover:text-white"
                                        )}
                                      >
                                        Male
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAnatomicalGender('Female'); }} 
                                        className={cn(
                                          "px-2 py-0.5 text-[8px] uppercase font-bold tracking-wider rounded-[8px] transition-all cursor-pointer border-0",
                                          anatomicalGender === 'Female' ? "bg-[#EF2F38] text-white" : "text-neutral-500 bg-transparent hover:text-neutral-800 dark:hover:text-white"
                                        )}
                                      >
                                        Female
                                      </button>
                                    </div>

                                    {/* Fullscreen toggle button */}
                                    <button 
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSelected3DAsset(selectedDetailAsset); setShow3DStudio(true); }}
                                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                                      title="View Fullscreen"
                                    >
                                      <ArrowsOut className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex-1 w-full relative">
                                  <Anatomical3DModel muscleLoads={muscleLoads} maxLoad={1.0} gender={anatomicalGender} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Description & Guidelines */}
                      <div className="space-y-2">
                        <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_guidelines_mechanics')}</span>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
                          {parseAssetDescription(selectedDetailAsset.description).text || t('lib_no_guidelines')}
                        </p>
                      </div>

                      {/* Step-by-Step Instructions */}
                      {selectedDetailAsset.category !== 'Theory & Terminology' && parseAssetDescription(selectedDetailAsset.description).instructions && parseAssetDescription(selectedDetailAsset.description).instructions!.length > 0 && (
                        <div className="space-y-3">
                          <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_execution_steps')}</span>
                          <ol className="space-y-2">
                            {parseAssetDescription(selectedDetailAsset.description).instructions!.map((step, idx) => {
                              const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '');
                              return (
                                <li key={idx} className="flex items-start gap-3 text-xs text-neutral-600 dark:text-neutral-300 font-sans">
                                  <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-relaxed">{cleanStep}</span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}

                      {/* Taekwondo Skill Details */}
                      {(activeTab === 'tkd' || activeTab === 'dance') && selectedDetailAsset.category !== 'Theory & Terminology' && (() => {
                        const parsed = parseAssetDescription(selectedDetailAsset.description);
                        const hasPrereqs = parsed.prerequisites && parsed.prerequisites.length > 0;
                        const hasPrinciples = parsed.principles && parsed.principles.length > 0;
                        const hasDrilling = parsed.drillingMethods && parsed.drillingMethods.length > 0;
                        const hasMistakes = parsed.mistakes && parsed.mistakes.length > 0;
                        const hasPerformance = parsed.performance && parsed.performance.length > 0;

                        if (!hasPrereqs && !hasPrinciples && !hasDrilling && !hasMistakes && !hasPerformance) {
                          return null;
                        }

                        return (
                          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
                            {/* Side-by-side: Prerequisites and Principles */}
                            {(hasPrereqs || hasPrinciples) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {hasPrereqs && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                    <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-3">Skill Prerequisites</span>
                                    <ul className="space-y-2">
                                      {parsed.prerequisites!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed font-sans">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {hasPrinciples && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                    <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-3">Principle of the Skill</span>
                                    <ul className="space-y-2">
                                      {parsed.principles!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed font-sans">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Drilling Methods */}
                            {hasDrilling && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Drilling Methods for Effective Training</span>
                                <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                  <ul className="space-y-2.5">
                                    {parsed.drillingMethods!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed font-sans">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Common Mistakes & Corrections */}
                            {hasMistakes && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Common Mistakes & Corrections</span>
                                <div className="space-y-3">
                                  {parsed.mistakes!.map((item, idx) => (
                                    <div key={idx} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm bg-neutral-50/50 dark:bg-[#111111]/30">
                                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-[#262626]">
                                        {/* Mistake Side */}
                                        <div className="bg-red-500/[0.015] dark:bg-red-500/[0.005] p-3.5 flex flex-col">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="px-2 py-0.5 rounded-[8px] bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-black uppercase tracking-wider">Mistake</span>
                                            <span className="text-[10px] font-mono font-bold text-neutral-400 dark:text-neutral-500">#{idx + 1}</span>
                                          </div>
                                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-medium">
                                            {item.mistake || "—"}
                                          </p>
                                        </div>
                                        {/* Correction Side */}
                                        <div className="bg-emerald-500/[0.015] dark:bg-emerald-500/[0.005] p-3.5 flex flex-col font-medium">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-wider">Correction</span>
                                          </div>
                                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-medium">
                                            {item.correction || "—"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Performance & Application */}
                            {hasPerformance && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Performance & Application</span>
                                <div className="p-4 bg-red-500/[0.02] dark:bg-red-500/[0.01] border border-red-500/10 dark:border-red-500/5 rounded-[8px] shadow-sm">
                                  <ul className="space-y-2.5">
                                    {parsed.performance!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed font-sans">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Linked Physical Solutions (Fitness Skills) */}
                            {parsed.fitnessSolutions && parsed.fitnessSolutions.length > 0 && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Physical Training Solutions for Skill Performance</span>
                                <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                                  <div className="flex flex-wrap gap-2">
                                    {parsed.fitnessSolutions.map(fsId => {
                                      const solution = state.curriculumVideos.find(v => v.id === fsId);
                                      if (!solution) return null;
                                      return (
                                        <button
                                          key={fsId}
                                          type="button"
                                          onClick={() => {
                                            setSelectedDetailAsset(solution);
                                          }}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-[#EF2F38]/10 dark:bg-neutral-800 dark:hover:bg-[#EF2F38]/15 border border-neutral-300 dark:border-neutral-700 hover:border-[#EF2F38]/30 dark:hover:border-[#EF2F38]/40 rounded-[8px] text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer"
                                        >
                                          <Barbell className="w-3.5 h-3.5 text-[#EF2F38]" />
                                          <span>{solution.title}</span>
                                          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal">({solution.category.replace('Fitness: ', '')})</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Theory & Terminology Dedicated Summary Interface */}
                      {selectedDetailAsset.category === 'Theory & Terminology' && (() => {
                        const parsed = parseAssetDescription(selectedDetailAsset.description);
                        const hasTerminology = parsed.terminology && parsed.terminology.length > 0;
                        const hasStudyGuide = parsed.studyGuide && parsed.studyGuide.length > 0;

                        if (!hasTerminology && !hasStudyGuide) return null;

                        return (
                          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
                            {/* Terminology Glossary */}
                            {hasTerminology && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Korean Vocabulary Glossary</span>
                                <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-neutral-50 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-neutral-400 font-bold">
                                        <th className="p-3">Korean Term</th>
                                        <th className="p-3">English Meaning</th>
                                        <th className="p-3">Khmer Translation</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-250 dark:divide-[#262626]">
                                      {parsed.terminology!.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-[#141414]/30 text-neutral-700 dark:text-neutral-300">
                                          <td className="p-3 font-semibold text-[#EF2F38] font-mono">{item.korean || "—"}</td>
                                          <td className="p-3 font-medium">{item.english || "—"}</td>
                                          <td className="p-3 font-medium font-sans">{item.khmer || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Study Guide Q&A */}
                            {hasStudyGuide && (
                              <div className="space-y-3">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Theoretical Q&A / Study Guide</span>
                                <div className="space-y-2">
                                  {parsed.studyGuide!.map((item, idx) => {
                                    const isExpanded = !!expandedStudyGuides[idx];
                                    return (
                                      <div key={idx} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden bg-neutral-50/30 dark:bg-[#111111]/10 shadow-sm transition-all">
                                        <button
                                          type="button"
                                          onClick={() => toggleStudyGuide(idx)}
                                          className="w-full p-4 text-left flex justify-between items-center gap-3 hover:bg-neutral-50 dark:hover:bg-[#141414]/40 transition-colors border-0 bg-transparent cursor-pointer"
                                        >
                                          <div className="flex items-start gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                              Q
                                            </span>
                                            <span className="text-xs font-bold text-neutral-850 dark:text-neutral-100 mt-0.5">{item.question || "—"}</span>
                                          </div>
                                          {isExpanded ? (
                                            <CaretDown className="w-4 h-4 text-neutral-400 shrink-0" />
                                          ) : (
                                            <CaretRight className="w-4 h-4 text-neutral-400 shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-4 pb-4 pt-1 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium border-t border-neutral-100 dark:border-[#262626] bg-white dark:bg-[#141414]/20 animate-in fade-in slide-in-from-top-1 duration-150">
                                            <div className="flex items-start gap-2.5">
                                              <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                A
                                              </span>
                                              <p className="mt-0.5 whitespace-pre-line">{item.answer || "—"}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer Actions */}
                    {isElevated && (
                      <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2 shrink-0">
                        <button onClick={() => { confirmDeleteVideo(selectedDetailAsset.id, selectedDetailAsset.title, () => setSelectedDetailAsset(null)); }}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-[8px] text-xs font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5"/> {t('act_delete')}
                        </button>
                        <button onClick={() => handleStartEdit(selectedDetailAsset)}
                          className="px-4 py-2 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-bold uppercase hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PencilSimple className="w-3.5 h-3.5 text-[#EF2F38]"/> {t('lib_edit_details')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>


    </div>
  );
}

// Workout Timer Player Overlay Component
function WorkoutTimerModal({ workout, onClose }: { workout: any, onClose: () => void }) {
  const t = useT();
  const { mode, currentRound, totalRounds, timeRemaining, isActive, startTimer, pauseTimer, resetTimer, nextRound, prevRound } = useWorkoutTimer({
    prepareSeconds: workout.structure.prepareSeconds,
    workSeconds: workout.structure.workSeconds,
    restSeconds: workout.structure.restSeconds,
    totalRounds: workout.structure.rounds,
  });

  // Get active exercise for current round
  const currentExercise = workout.structure.exercises[(currentRound - 1) % workout.structure.exercises.length];

  // Colors based on timer modes
  const getThemeColor = () => {
    switch (mode) {
      case 'Prepare': return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' };
      case 'Work': return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', glow: 'shadow-green-500/20' };
      case 'Rest': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
      case 'Completed': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/20' };
      default: return { bg: 'bg-[#141414]', border: 'border-[#262626]', text: 'text-white', glow: 'shadow-transparent' };
    }
  };

  const theme = getThemeColor();

  const getModeLabel = (m: TimerMode) => {
    switch (m) {
      case 'Prepare': return t('lib_routine_prep_label').replace(/\s*\(.*\)/, '').trim();
      case 'Work': return t('lib_routine_work_label').replace(/\s*\(.*\)/, '').trim();
      case 'Rest': return t('lib_routine_rest_label').replace(/\s*\(.*\)/, '').trim();
      case 'Completed': return t('lib_bulk_completed_title');
      default: return String(m);
    }
  };

  const diffTrans = workout.difficulty === 'Beginner' ? t('lib_diff_beginner') : workout.difficulty === 'Intermediate' ? t('lib_diff_intermediate') : workout.difficulty === 'Advanced' ? t('lib_diff_advanced') : workout.difficulty === 'Elite' ? t('lib_diff_elite') : workout.difficulty;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className={cn("w-full max-w-md border rounded-[8px] p-6 shadow-2xl flex flex-col justify-between space-y-6 transition-all duration-300 bg-[#0A0A0A] dark-card-override", theme.border, `shadow-2xl ${theme.glow}`)}
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">{t('lib_difficulty_workout').replace('{difficulty}', diffTrans)}</span>
              <h3 className="text-sm font-bold text-white mt-0.5">{workout.title}</h3>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close workout timer"
              className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center bg-[#1A1A1A] border border-[#262626] text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>

          {/* Central Timer Face */}
          <div className={cn("rounded-[8px] p-8 flex flex-col items-center justify-center transition-all relative border border-transparent overflow-hidden", theme.bg)}>
            <span className="text-[9px] uppercase font-black tracking-[0.25em] text-neutral-400">{t('lib_timer_current_mode')}</span>
            
            {/* Massive mode flash text */}
            <motion.h1 key={mode} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("text-2xl font-black uppercase tracking-widest mt-1 mb-2 font-mono", theme.text)}>
              {getModeLabel(mode)}
            </motion.h1>

            {/* Huge numeric clock */}
            <motion.h2 key={timeRemaining} initial={{ scale: 0.9, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl font-black font-mono text-white leading-none tracking-tight">
              {timeRemaining}s
            </motion.h2>

            {/* Round info bar with interval navigation */}
            <div className="flex items-center justify-between w-full max-w-[240px] mt-4 px-3 py-1 bg-black/40 rounded-full border border-white/5 text-[10px] text-neutral-300 font-mono">
              <button 
                type="button" 
                onClick={prevRound} 
                className="hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none p-1 cursor-pointer transition-colors"
                disabled={currentRound <= 1}
                title="Previous Interval"
              >
                ◀ Prev
              </button>
              <span className="font-bold">{t('lib_timer_round')} {currentRound} / {totalRounds}</span>
              <button 
                type="button" 
                onClick={nextRound} 
                className="hover:text-[#EF2F38] disabled:opacity-30 disabled:pointer-events-none p-1 cursor-pointer transition-colors"
                disabled={mode === 'Completed'}
                title="Next Interval"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Targeted Movement Guidance */}
          <div className="bg-[#141414] border border-[#262626] rounded-[8px] p-4 text-center">
            <span className="block text-[8px] uppercase font-bold text-neutral-400 tracking-wider mb-1">{t('lib_timer_target_action')}</span>
            {mode === 'Prepare' && <p className="text-xs text-neutral-300 font-bold font-mono">{t('lib_timer_prep_desc')}</p>}
            {mode === 'Rest' && <p className="text-xs text-neutral-300 font-bold font-mono">{t('lib_timer_rest_desc')}</p>}
            {mode === 'Completed' && <p className="text-xs text-green-400 font-bold font-mono">{t('lib_timer_completed_desc')}</p>}
            {mode === 'Work' && (
              <motion.p key={currentExercise} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-sm text-white font-bold leading-tight uppercase font-mono">
                {currentExercise}
              </motion.p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isActive && mode !== 'Completed' && (
              <button onClick={startTimer}
                className="flex-1 bg-green-500 text-black hover:bg-green-600 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                <FastForward className="w-4 h-4" weight="fill"/> {t('lib_timer_start')}
              </button>
            )}

            {isActive && (
              <button onClick={pauseTimer}
                className="flex-1 bg-[#1A1A1A] border border-[#333] hover:bg-[#222] text-amber-500 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors"
              >
                {t('lib_timer_pause')}
              </button>
            )}

            <button onClick={resetTimer}
              className="px-4 bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] text-neutral-400 py-3 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {t('lib_timer_reset')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}

interface BulkImportAssetModalProps {
  activeTab: 'tkd' | 'fitness' | 'dance' | 'routines';
  onClose: () => void;
}

interface ParsedAssetRow {
  index: number;
  data: {
    title: string;
    description: string;
    category: string;
    minBeltLevel: string;
    videoUrl: string;
  };
  errors: string[];
  isValid: boolean;
}

function BulkImportAssetModal({ activeTab, onClose }: BulkImportAssetModalProps) {
  const { state, addCurriculumVideo } = useAppStore();
  const t = useT();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvHeaders = activeTab === 'tkd' 
    ? "Title,Description,Category,Target Belt,Video URL"
    : "Title,Description,Category,Video URL";

  const csvExampleRow = activeTab === 'tkd'
    ? "Taegeuk Il Jang, WT First Taekwondo pattern for beginners,Poomsae,White,https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view"
    : "Box Squats,Explosive power and leg strengthening exercises,Strength,https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view";

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(`${csvHeaders}\n${csvExampleRow}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddManualRow = () => {
    const nextIndex = parsedRows.length > 0 ? Math.max(...parsedRows.map(r => r.index)) + 1 : 1;
    const newEmptyRow: ParsedAssetRow = {
      index: nextIndex,
      data: {
        title: '',
        description: '',
        category: activeTab === 'tkd' ? 'Forms (Poomsae)' : activeTab === 'dance' ? 'Dance: Hiphop' : 'Strength',
        minBeltLevel: activeTab === 'tkd' ? 'White' : activeTab === 'dance' ? 'Dance' : 'Fitness',
        videoUrl: ''
      },
      errors: ['Title and description are required.'],
      isValid: false
    };
    setParsedRows(prev => [...prev, newEmptyRow]);
  };

  const headerMap: Record<string, string> = {
    'title': 'title',
    'asset title': 'title',
    'asset_title': 'title',
    'name': 'title',
    'description': 'description',
    'details': 'description',
    'guidelines': 'description',
    'category': 'category',
    'subcategory': 'category',
    'type': 'category',
    'belt': 'minBeltLevel',
    'belt level': 'minBeltLevel',
    'belt_level': 'minBeltLevel',
    'target belt': 'minBeltLevel',
    'target_belt': 'minBeltLevel',
    'video url': 'videoUrl',
    'video_url': 'videoUrl',
    'videourl': 'videoUrl',
    'link': 'videoUrl',
    'video link': 'videoUrl',
    'video_link': 'videoUrl'
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(val => 
      val.startsWith('"') && val.endsWith('"') 
        ? val.substring(1, val.length - 1).trim() 
        : val
    );
  };

  const validateRecord = (data: any): string[] => {
    const errors: string[] = [];
    if (!data.title.trim()) errors.push("Title is required.");
    if (!data.description.trim()) errors.push("Description is required.");
    
    // Check if duplicate title exists under same category in library_assets
    const normalizeCatString = (cat: string) => {
      return cat.replace(/^Fitness:\s*/i, '').replace(/^Dance:\s*/i, '').trim().toLowerCase();
    };
    const exists = state.curriculumVideos.some((v: any) => 
      v.title.toLowerCase().trim() === data.title.toLowerCase().trim() &&
      normalizeCatString(v.category) === normalizeCatString(data.category)
    );
    if (exists) {
      errors.push("Asset already exists in this category.");
    }

    // Validate videoUrl starts with http/https
    if (data.videoUrl && !/^https?:\/\/.+/i.test(data.videoUrl)) {
      errors.push("Video link must start with http:// or https://");
    }
    
    if (activeTab === 'tkd') {
      const validCategories = [
        'Forms (Poomsae)',
        'Kicks (Chagi)',
        'Stances & Footwork (Seogi)',
        'Strikes (Jirugi/Chigi)',
        'Blocks (Makki)',
        'Sparring (Kyorugi)',
        'Breaking (Kyokpa)',
        'Self-Defense (Hosinsul)',
        'Tricking & Acrobatics',
        'Theory & Terminology'
      ];
      if (!validCategories.includes(data.category)) {
        errors.push(`Invalid Category. Choose from: ${validCategories.join(', ')}`);
      }
      const validBelts = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'];
      if (!validBelts.includes(data.minBeltLevel)) {
        errors.push("Invalid target belt level.");
      }
    } else if (activeTab === 'dance') {
      const validDance = ['Dance: Hiphop', 'Dance: Popping', 'Dance: Tutorials', 'Dance: Resources'];
      if (!validDance.includes(data.category)) {
        errors.push(`Invalid Category. Choose from: ${validDance.join(', ')}`);
      }
    } else {
      const validFitness = ['Strength', 'Explosive', 'Speed', 'Agility', 'Control', 'Balance', 'Flexibility', 'Functional', 'Rotational', 'Core', 'Conditioning'];
      if (!validFitness.includes(data.category)) {
        errors.push(`Invalid Category. Choose from: ${validFitness.join(', ')}`);
      }
    }
    return errors;
  };

  const handleProcessCSV = (textToParse: string) => {
    if (!textToParse.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = textToParse.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const rawHeaders = parseCSVLine(lines[0]);
    const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim());
    const matchedFields = normalizedHeaders.map(h => headerMap[h] || h);

    const rows: ParsedAssetRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 1 && values[0] === '') continue;

      const rawData: any = {};
      matchedFields.forEach((field, index) => {
        if (field) {
          rawData[field] = values[index] || '';
        }
      });

      const defaultCategory = activeTab === 'tkd' 
        ? 'Forms (Poomsae)' 
        : activeTab === 'dance' 
        ? 'Dance: Hiphop' 
        : 'Strength';

      let parsedCategory = (rawData.category || defaultCategory).trim();
      if (activeTab === 'tkd') {
        parsedCategory = normalizeCategory(parsedCategory);
      } else if (activeTab === 'dance') {
        const cleanCat = parsedCategory.replace('Dance: ', '').trim().toLowerCase();
        if (cleanCat === 'hiphop') parsedCategory = 'Dance: Hiphop';
        else if (cleanCat === 'popping') parsedCategory = 'Dance: Popping';
        else if (cleanCat === 'tutorials') parsedCategory = 'Dance: Tutorials';
        else if (cleanCat === 'resources') parsedCategory = 'Dance: Resources';
        else parsedCategory = 'Dance: Hiphop';
      }

      const parsedData = {
        title: (rawData.title || '').trim(),
        description: (rawData.description || '').trim(),
        category: parsedCategory,
        minBeltLevel: activeTab === 'tkd' 
          ? (rawData.minBeltLevel || 'White').trim() 
          : activeTab === 'dance' 
          ? 'Dance' 
          : 'Fitness',
        videoUrl: (rawData.videoUrl || '').trim()
      };

      const errors = validateRecord(parsedData);

      rows.push({
        index: i,
        data: parsedData,
        errors,
        isValid: errors.length === 0
      });
    }

    setParsedRows(rows);
  };

  const handleEditRow = (index: number, field: string, value: any) => {
    setParsedRows(prev => prev.map(row => {
      if (row.index !== index) return row;
      const updatedData = { ...row.data, [field]: value };
      const errors = validateRecord(updatedData);
      return {
        ...row,
        data: updatedData,
        errors,
        isValid: errors.length === 0
      };
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      handleProcessCSV(text);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(e.target.value);
    handleProcessCSV(e.target.value);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      processFile(file);
    }
  };

  const handleStartImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setImportSummary(null);
    setCurrentIndex(0);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      setCurrentIndex(i + 1);
      const row = validRows[i];

      let categoryToSave = row.data.category;
      let beltToSave = row.data.minBeltLevel;

      if (activeTab === 'fitness') {
        categoryToSave = `Fitness: ${row.data.category}`;
        beltToSave = 'Fitness';
      } else if (activeTab === 'dance') {
        categoryToSave = row.data.category;
        beltToSave = 'Dance';
      }

      // Auto-resolve YouTube high-res thumbnail cover if omitted
      const ytId = getYouTubeId(row.data.videoUrl);
      let resolvedThumbnail = '';
      if (ytId) {
        resolvedThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }

      const descriptionJson = JSON.stringify({
        text: row.data.description,
        difficulty: 'Beginner',
        instructions: [],
        focusZones: [],
        repsSets: '',
        thumbnailUrl: resolvedThumbnail,
        actualCategory: categoryToSave,
        principles: [],
        prerequisites: [],
        drillingMethods: [],
        mistakes: [],
        performance: [],
        fitnessSolutions: []
      });

      try {
        await addCurriculumVideo({
          title: row.data.title,
          description: descriptionJson,
          category: categoryToSave,
          minBeltLevel: beltToSave,
          videoUrl: row.data.videoUrl || undefined
        });
        successCount++;
      } catch (err) {
        failedCount++;
        console.error(err);
      }
    }

    setIsProcessing(false);
    setImportSummary({ success: successCount, failed: failedCount });
  };

  const totalValid = parsedRows.filter(r => r.isValid).length;
  const totalErrors = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        .bulk-table-control {
          background-color: transparent !important;
          border: 1px solid transparent !important;
          color: #111827 !important;
        }
        .dark .bulk-table-control {
          color: #FFFFFF !important;
          background-color: transparent !important;
          border-color: transparent !important;
        }
        .bulk-table-control:hover {
          background-color: #F3F4F6 !important;
          border-color: #E5E7EB !important;
        }
        .dark .bulk-table-control:hover {
          background-color: rgba(38, 38, 38, 0.3) !important;
          border-color: rgba(63, 63, 70, 0.4) !important;
        }
        .bulk-table-control:focus {
          background-color: #FFFFFF !important;
          border-color: #EF2F38 !important;
          box-shadow: 0 0 0 1px rgba(239, 47, 56, 0.3) !important;
        }
        .dark .bulk-table-control:focus {
          background-color: #0F0F0F !important;
          border-color: #EF2F38 !important;
          box-shadow: 0 0 0 1px rgba(239, 47, 56, 0.3) !important;
        }
      `}} />
      <div className="w-full max-w-5xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl flex flex-col my-8 max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F]">
          <div className="flex items-center gap-2.5">
            <FileCsv className="w-6 h-6 text-[#EF2F38]" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-white">{t('lib_bulk_title')}</h2>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('lib_bulk_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHelp(true)} 
              className="p-2 min-h-[36px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] text-neutral-600 dark:text-[#999] hover:text-neutral-950 dark:hover:text-white hover:border-neutral-300 dark:hover:border-[#444] transition-all flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 cursor-pointer active:scale-95 touch-manipulation"
            >
              <Question className="w-3.5 h-3.5" /> {t('bulk_tutorial_btn')}
            </button>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors active:scale-95 touch-manipulation cursor-pointer"
              title={t('act_close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-[#0A0A0A]">
          {/* Phase 1: Upload or Paste */}
          {!importSummary && !isProcessing && parsedRows.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drag and Drop File Selector */}
              <div 
                onClick={() => fileInputRef.current?.click()} 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed border-neutral-300 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#141414]/50 rounded-[8px] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:bg-neutral-100/60 dark:hover:bg-[#181818]/60 transition-all group relative overflow-hidden",
                  fileName && "border-[#EF2F38]/30 bg-[#EF2F38]/[0.02]",
                  isDragging && "border-[#EF2F38] bg-[#EF2F38]/[0.05] scale-[0.99] shadow-inner"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv,.txt" 
                  className="hidden" 
                />
                <div className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 mb-4 group-hover:scale-105 transition-transform text-neutral-600 dark:text-white shadow-sm">
                  <UploadSimple className={cn("w-5 h-5", isDragging && "animate-bounce")} />
                </div>
                {fileName ? (
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white font-mono truncate max-w-[280px]">{fileName}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-500 font-mono mt-1 uppercase tracking-widest font-black">{t('lib_bulk_file_loaded')}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">{t('lib_bulk_drag_drop')}</p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono leading-relaxed">{t('lib_bulk_drag_drop_desc')}</p>
                  </div>
                )}
                <AnimatePresence>
                  {isDragging && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#EF2F38]/[0.08] backdrop-blur-[1px] flex items-center justify-center pointer-events-none"
                    >
                      <span className="text-[#EF2F38] font-bold uppercase tracking-widest text-xs border border-[#EF2F38] bg-white dark:bg-black px-4 py-2 rounded-full shadow-lg">{t('lib_bulk_drop_here')}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Paste Area */}
              <div className="flex flex-col space-y-2">
                <label className="block text-[11px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_paste_label')}</label>
                <textarea 
                  value={csvText} 
                  onChange={handlePasteChange}
                  placeholder={activeTab === 'tkd'
                    ? "Title,Description,Category,Target Belt,Video URL\nTaegeuk Ee Jang,Second Taekwondo Form,Poomsae,Yellow,https://..."
                    : "Push Ups,Standard core upper body pushing,Strength,https://..."
                  }
                  className="w-full h-[154px] bg-neutral-50 dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/25 resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-all shadow-inner"
                />
              </div>

              {/* Manual spreadsheet grid entry */}
              <div className="col-span-1 md:col-span-2 border border-dashed border-neutral-300 dark:border-[#262626] bg-neutral-50/30 dark:bg-[#141414]/30 rounded-[8px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shrink-0 shadow-sm">
                    <PencilSimple className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('lib_bulk_manual_grid')}</p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">{t('lib_bulk_manual_grid_desc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-widest rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-md shrink-0"
                >
                  {t('lib_bulk_add_row')}
                </button>
              </div>
            </div>
          )}

          {/* Live spreadsheet Verification table */}
          {parsedRows.length > 0 && !isProcessing && !importSummary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {t('lib_bulk_verify_title')}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="px-3.5 py-1.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5"/> {t('lib_bulk_add_row')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setCsvText('');
                      setFileName('');
                    }}
                    className="px-3.5 py-1.5 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5"/> Clear & Restart
                  </button>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-[8px]">
                    {totalValid} {t('lib_bulk_ready_to_import')}
                  </span>
                  {totalErrors > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 px-2.5 py-0.5 rounded-[8px] animate-pulse">
                      {totalErrors} {t('lib_bulk_errors_found')}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1 font-mono font-semibold">
                <PencilSimple className="w-3.5 h-3.5 text-[#EF2F38]" /> {t('lib_bulk_verify_desc')}
              </div>

              <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] max-h-[350px] overflow-auto">
                <table className="w-full text-left text-xs border-collapse min-w-max">
                  <thead className="bg-neutral-100 dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 uppercase tracking-wider font-mono text-[10px] sticky top-0 z-10">
                    <tr className="border-b border-neutral-200 dark:border-[#262626]">
                      <th className="px-4 py-3 w-16 text-center">{t('lib_bulk_row_label')}</th>
                      <th className="px-4 py-3 min-w-[200px]">{t('lib_bulk_title_col')}</th>
                      <th className="px-4 py-3 min-w-[300px]">{t('lib_bulk_desc_col')}</th>
                      <th className="px-4 py-3 min-w-[140px] w-40">{t('lib_bulk_category_col')}</th>
                      {activeTab === 'tkd' && <th className="px-4 py-3 min-w-[140px] w-40">{t('lib_bulk_belt_col')}</th>}
                      <th className="px-4 py-3 min-w-[250px]">{t('lib_bulk_link_col')}</th>
                      <th className="px-4 py-3 min-w-[180px]">{t('lib_bulk_status_col')}</th>
                      <th className="px-4 py-3 w-20 text-center">{t('lib_bulk_action_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-[#141414]">
                    {parsedRows.map((row) => (
                      <tr key={row.index} className={cn(
                        "hover:bg-neutral-100 dark:hover:bg-[#1C1C1C]/40 transition-colors",
                        !row.isValid && "bg-red-500/[0.02] dark:bg-red-500/[0.01]"
                      )}>
                        <td className="px-4 py-3 font-mono text-neutral-500 dark:text-neutral-400 text-center font-bold">{row.index}</td>
                        
                        {/* Title Input */}
                        <td className="px-3 py-2 min-w-[200px]">
                          <input 
                            type="text" 
                            value={row.data.title} 
                            onChange={e => handleEditRow(row.index, 'title', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                          />
                        </td>

                        {/* Description Input */}
                        <td className="px-3 py-2 min-w-[300px]">
                          <input 
                            type="text" 
                            value={row.data.description} 
                            onChange={e => handleEditRow(row.index, 'description', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-semibold"
                          />
                        </td>

                        {/* Category Select */}
                        <td className="px-3 py-2 min-w-[140px] w-40">
                          <select 
                            value={row.data.category} 
                            onChange={e => handleEditRow(row.index, 'category', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                          >
                            {activeTab === 'tkd' ? (
                              TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            ) : activeTab === 'dance' ? (
                              DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                            ) : (
                              FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            )}
                          </select>
                        </td>

                        {/* Target Belt Select */}
                        {activeTab === 'tkd' && (
                          <td className="px-3 py-2 min-w-[140px] w-40">
                            <select 
                              value={row.data.minBeltLevel} 
                              onChange={e => handleEditRow(row.index, 'minBeltLevel', e.target.value)}
                              className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                            >
                              {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                            </select>
                          </td>
                        )}

                        {/* Video URL Input */}
                        <td className="px-3 py-2 min-w-[250px]">
                          <input 
                            type="text" 
                            value={row.data.videoUrl} 
                            onChange={e => handleEditRow(row.index, 'videoUrl', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-mono"
                          />
                        </td>

                        {/* Errors / Status Column */}
                        <td className="px-4 py-3 min-w-[180px]">
                          {row.isValid ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> {t('lib_bulk_verified')}</span>
                          ) : (
                            <div className="space-y-0.5">
                              {row.errors.map((err, idx) => (
                                <span key={idx} className="text-[9px] font-semibold text-red-500 block leading-tight">• {err}</span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Delete Row Action */}
                        <td className="px-4 py-3 text-center">
                          <button 
                            type="button"
                            onClick={() => setParsedRows(prev => prev.filter(r => r.index !== row.index))}
                            className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash className="w-4 h-4"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 3: Controlled Progress Screen */}
          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-neutral-100 dark:border-neutral-800 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#EF2F38] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <FileCsv className="w-6 h-6 text-[#EF2F38] animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{t('lib_bulk_uploading')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1 font-semibold">{t('lib_bulk_processing_record').replace('{current}', String(currentIndex)).replace('{total}', String(parsedRows.filter(r => r.isValid).length))}</p>
              </div>
            </div>
          )}

          {/* Phase 4: Import Summary */}
          {importSummary && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <Checks className="w-8 h-8"/>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider">{t('lib_bulk_completed_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">{t('lib_bulk_completed_desc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                  <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_successful')}</span>
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{importSummary.success}</span>
                </div>
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                  <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_failed')}</span>
                  <span className="text-2xl font-black font-mono text-red-500">{importSummary.failed}</span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  setImportSummary(null);
                  setParsedRows([]);
                  setCsvText('');
                  setFileName('');
                  onClose();
                }}
                className="px-6 py-2.5 bg-neutral-950 dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-[10px] rounded-[8px] hover:opacity-90 transition-all shadow-sm"
              >
                {t('lib_bulk_close_wizard')}
              </button>
            </div>
          )}
        </div>

        {/* Footer controls */}
        {!importSummary && !isProcessing && (
          <div className="p-4 md:p-5 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row justify-between items-center gap-3 bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
            <button 
              type="button" 
              onClick={handleCopyTemplate}
              className="w-full sm:w-auto px-4 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold uppercase tracking-wider text-[10px] rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5"/> {copied ? "Copied!" : t('lib_bulk_copy_template')}
            </button>
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button 
                type="button" 
                onClick={() => {
                  setParsedRows([]);
                  setCsvText('');
                  setFileName('');
                  onClose();
                }} 
                className="flex-1 sm:flex-initial px-5 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all active:scale-95 touch-manipulation cursor-pointer"
              >
                {t('lib_bulk_cancel')}
              </button>
              <button 
                type="button" 
                onClick={handleStartImport}
                disabled={totalValid === 0}
                className={cn(
                  "flex-1 sm:flex-initial px-5 py-2 min-h-[40px] text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer",
                  totalValid === 0 
                    ? "bg-neutral-300 dark:bg-[#262626] text-neutral-400 dark:text-neutral-600 border-transparent cursor-not-allowed shadow-none" 
                    : "bg-[#EF2F38] hover:bg-[#d6262f] shadow-[#EF2F38]/20"
                )}
              >
                {t('lib_bulk_import_btn').replace('{count}', String(totalValid))}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scoped Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl p-6 text-neutral-900 dark:text-white max-h-[85dvh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-3 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-neutral-800 dark:text-white">
                  <Question className="w-4.5 h-4.5 text-[#EF2F38]"/> {t('bulk_tutorial_title')}
                </h3>
                <button 
                  onClick={() => setShowHelp(false)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                  title={t('act_close')}
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="text-xs space-y-4 leading-relaxed text-neutral-600 dark:text-neutral-300">
                <p>{t('lib_bulk_tutorial_desc')}</p>
                <ul className="space-y-2 list-disc pl-4 font-semibold text-neutral-700 dark:text-neutral-200">
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_title_col').replace(' *', '')} *</strong>: Required. Syllabus movement or exercise name.
                  </li>
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_desc_col').replace(' *', '')} *</strong>: Required. Details, mechanics, focus zones.
                  </li>
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_category_col')}</strong>: Optional. Defaults to Poomsae or Strength. Valid options:
                    {activeTab === 'tkd' 
                      ? " " + TKD_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c).join(', ')
                      : activeTab === 'dance'
                      ? " " + DANCE_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')).join(', ')
                      : " " + FITNESS_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c).join(', ')
                    }
                  </li>
                  {activeTab === 'tkd' && (
                    <li>
                      <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_belt_col')}</strong>: Optional. Valid values: {BELTS.slice(1).map(b => t(getBeltTranslationKey(b))).join(', ')}. Defaults to White.
                    </li>
                  )}
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_link_col').replace('Google Drive / ', '')}</strong>: Optional Google Drive share link or YouTube link.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
