'use client';
import { copyText } from '@/lib/clipboard';



import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { lessonThumbnailUrl } from '@/lib/lesson-media';
import { libraryLessonState } from '@/lib/library-publication';
import { SafeImage } from '@/components/SafeImage';
import { useLibraryTestUsage } from '@/components/belt-tests/use-belt-links';
import { lessonDeletionBlock, lessonUsageNote } from '@/lib/belt-test-links';
import { useManagedWorkouts } from '@/hooks/use-managed-workouts';
import { useAppStore, CurriculumVideo } from '@/lib/store';
import { AnimatePresence } from 'motion/react';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { PlayCircle } from '@phosphor-icons/react/dist/csr/PlayCircle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';

import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Timer } from '@phosphor-icons/react/dist/csr/Timer';



import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning';

import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';





import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';




import { MusicNotes } from '@phosphor-icons/react/dist/csr/MusicNotes';


import { Stack } from '@phosphor-icons/react/dist/csr/Stack';

import { AnatomyStudioModal } from '@/components/AnatomyStudioModal';

import { cn, normalizeCategory, getCategoryTranslationKey, getYouTubeId, parseAssetDescription, MistakeCorrection, VocabularyItem, QuestionAnswerItem } from '@/lib/utils';
import { PageHeader } from './ui/PageHeader';
import { buttonClass } from './ui/styles';
import { LessonMediaPlayer } from './library/LessonMediaPlayer';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';







const WorkoutTimerModal = dynamic(() => import('./library/WorkoutTimerModal').then(module => module.WorkoutTimerModal), { ssr: false });
const BulkImportAssetModal = dynamic(() => import('./library/BulkImportAssetModal').then(module => module.BulkImportAssetModal), { ssr: false });
import { TKD_CATEGORIES, FITNESS_CATEGORIES, DANCE_CATEGORIES, ROUTINE_TYPES, BELTS, getBeltTranslationKey } from '@/lib/library-catalog';

const WorkoutRoutineEditor = dynamic(() => import('@/components/library/WorkoutRoutineEditor').then(module => module.WorkoutRoutineEditor), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const LibraryAssetCreateDialog = dynamic(() => import('@/components/library/LibraryAssetCreateDialog').then(module => module.LibraryAssetCreateDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const LibraryAssetDetailDialog = dynamic(() => import('@/components/library/LibraryAssetDetailDialog').then(module => module.LibraryAssetDetailDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const LibraryPublicationPanel = dynamic(() => import('@/components/library/LibraryPublicationPanel').then(module => module.LibraryPublicationPanel), { ssr: false });

export function LibraryView() {
  const { state, can, addCurriculumVideo, updateCurriculumVideo, deleteCurriculumVideo, addWorkoutTemplate, updateWorkoutTemplate, deleteWorkoutTemplate, showConfirm, showNotification } = useAppStore();
  const t = useT();
  const isElevated = can('action:curriculum_edit');
  // Which belt test syllabi name each lesson (badges on cards; guards deletion).
  const testUsage = useLibraryTestUsage();

  // Tabs: Taekwondo Technical vs Workout & Fitness vs Dance vs Routines
  const [activeTab, setActiveTab] = useState<'tkd' | 'fitness' | 'dance' | 'routines'>('tkd');
  const [showPublicationPanel, setShowPublicationPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);
  const guardedSave = async (event: React.FormEvent, save: (event: React.FormEvent) => Promise<void>) => {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true; setIsSaving(true);
    try { await save(event); }
    finally { saveLock.current = false; setIsSaving(false); }
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleAssetCount, setVisibleAssetCount] = useState(24);
  const [selectedBelt, setSelectedBelt] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [selectedRoutineType, setSelectedRoutineType] = useState<string>('All');
  const managedWorkouts = useManagedWorkouts(isElevated && activeTab === 'routines', searchQuery);
  useEffect(() => { setVisibleAssetCount(24); }, [activeTab, searchQuery, selectedBelt, selectedSubCategory]);

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
  const openedMaterialLink = useRef<number | null>(null);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('material'));
    if (!Number.isSafeInteger(id) || id <= 0 || openedMaterialLink.current === id) return;
    const material = state.curriculumVideos.find(row => row.id === id);
    if (material) { openedMaterialLink.current = id; setSelectedDetailAsset(material); }
  }, [state.curriculumVideos]);
  const [show3DStudio, setShow3DStudio] = useState(false);
  const [selected3DAsset, setSelected3DAsset] = useState<CurriculumVideo | null>(null);
  const [anatomicalGender] = useState<'Male' | 'Female'>('Male');
  const [editAsset, setEditAsset] = useState<any | null>(null);
  useEffect(() => {
    setSelectedDetailAsset(previous => previous ? state.curriculumVideos.find(row => row.id === previous.id) || null : null);
  }, [state.curriculumVideos]);

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
  const workoutTemplates = isElevated && activeTab === 'routines' ? managedWorkouts.templates : state.workoutTemplates || [];

  const searchText = searchQuery.trim().toLowerCase();
  const filteredTemplates = workoutTemplates.filter(template => {
    const matchesSearch = !searchText ||
      (template.title || '').toLowerCase().includes(searchText) ||
      (template.description || '').toLowerCase().includes(searchText);

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
    publishToStudents: false,
    publicationReason: '',
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

  // Parse each lesson's structured description once per data change, not per card render.
  const detailsById = useMemo(() => new Map(state.curriculumVideos.map(video => [video.id, parseAssetDescription(video.description)] as const)), [state.curriculumVideos]);
  const lessonDetails = (video: CurriculumVideo) => detailsById.get(video.id) ?? parseAssetDescription(video.description);

  // Split and filter technical assets based on type & prefix
  // Fitness exercises are curriculum entries where category starts with "Fitness:" or belt level is set to "Fitness"
  const filteredAssets = state.curriculumVideos.filter(video => {
    const isFitness = video.minBeltLevel === 'Fitness' || video.category.startsWith('Fitness:');
    const isDance = video.category.startsWith('Dance:');

    // Filter by general activeTab selection
    if (activeTab === 'tkd' && (isFitness || isDance)) return false;
    if (activeTab === 'fitness' && !isFitness) return false;
    if (activeTab === 'dance' && !isDance) return false;

    // Search the readable lesson text, never the stored JSON keys and links.
    const matchesSearch = !searchText ||
      video.title.toLowerCase().includes(searchText) ||
      lessonDetails(video).text.toLowerCase().includes(searchText) ||
      video.category.toLowerCase().includes(searchText);

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

    try { await addCurriculumVideo({
      title: newAsset.title,
      description: descriptionJson,
      category: categoryToSave,
      minBeltLevel: beltToSave,
      videoUrl: newAsset.videoUrl || undefined,
      muscleRelations: selectedMuscles
    }); } catch { return; }

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
    setSelectedDetailAsset(video);
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
      revision: video.revision,
      kind: video.minBeltLevel === 'Fitness' || video.category.startsWith('Fitness:') ? 'fitness' : video.category.startsWith('Dance:') ? 'dance' : 'tkd',
      metadata: (() => { try { const parsed = JSON.parse(video.description); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } })(),
      title: video.title,
      description: details.text,
      category: video.category.replace('Fitness: ', ''),
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
    if (editAsset.kind === 'fitness') {
      categoryToSave = `Fitness: ${editAsset.category}`;
      beltToSave = 'Fitness';
    } else if (editAsset.kind === 'dance') {
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
      ...editAsset.metadata,
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

    try { await updateCurriculumVideo(editAsset.id, {
      revision: editAsset.revision,
      title: editAsset.title,
      description: descriptionJson,
      category: categoryToSave,
      minBeltLevel: beltToSave,
      videoUrl: editAsset.videoUrl || undefined,
      muscleRelations: editSelectedMuscles
    }); } catch { return; }

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
    // A lesson a published belt test relies on cannot be deleted until the syllabus is revised.
    const blocked = lessonDeletionBlock(testUsage.byAsset.get(videoId));
    if (blocked) { showNotification(blocked, 'warning'); return; }
    const usageNote = lessonUsageNote(testUsage.byAsset.get(videoId));
    let title = 'Delete Video';
    let message = `Are you sure you want to delete "${videoTitle}"? This will permanently remove the video from the curriculum library.${usageNote ? ' ' + usageNote : ''}`;

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
        try { await deleteCurriculumVideo(videoId); if (onCloseDetail) onCloseDetail(); } catch { /* Store shows the save error. */ }
      },
      title
    );
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutine.title.trim()) return;

    const exercises = newRoutine.selectedExercises;

    const routineTemplate = {
      title: newRoutine.title,
      description: newRoutine.description,
      difficulty: newRoutine.difficulty,
      creator: editingRoutine?.creator || state.currentUser?.displayName || 'Coach',
      revision: editingRoutine?.revision ?? 0,
      publicationAction: newRoutine.publishToStudents ? 'PUBLISH' : 'SAVE_DRAFT',
      publicationReason: newRoutine.publicationReason,
      structure: {
        routineType: newRoutine.routineType,
        prepareSeconds: Number(newRoutine.prepareSeconds),
        workSeconds: Number(newRoutine.workSeconds),
        restSeconds: Number(newRoutine.restSeconds),
        rounds: Number(newRoutine.rounds),
        exercises
      }
    };

    try {
      if (editingRoutine) await updateWorkoutTemplate(editingRoutine.id,routineTemplate);
      else await addWorkoutTemplate(routineTemplate);
      await managedWorkouts.reload();
    }catch {return;}

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
      publishToStudents: false,
      publicationReason: '',
    });
  };

  const handleDeleteRoutine = (id: string, routineTitle: string) => {
    const routine = workoutTemplates.find(row => row.id === id);
    if (routine && 'publicationState' in routine && routine.publicationState !== 'draft') {
      showNotification('Published routines are retained for the student portal and existing assignments. Save an updated draft to revise one.', 'info');
      return;
    }
    const title = 'Archive private routine';
    const message = `Archive the private draft "${routineTitle}"? Published routines and existing student assignments are retained.`;

    showConfirm(
      message,
      async () => {
        try {await deleteWorkoutTemplate(id, routine?.revision); await managedWorkouts.reload();}catch { /* Store shows the save error. */ }
      },
      title
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-5 pb-12">
      <PageHeader
        icon={<BookOpen weight="bold" />}
        eyebrow="Curriculum & Training Library"
        title={t('nav_library')}
        description={t('lib_subtitle')}
        actions={(isElevated || activeTab !== 'routines') ? <>
          {isElevated && <button type="button" onClick={() => setShowPublicationPanel(true)} className={buttonClass()}>Student library</button>}
          {isElevated && activeTab !== 'routines' && (
            <button type="button" onClick={() => {
              setNewAsset(prev => ({
                ...prev,
                category: activeTab === 'tkd' ? 'Forms (Poomsae)' : activeTab === 'dance' ? 'Dance: Hiphop' : 'Strength',
                minBeltLevel: activeTab === 'tkd' ? 'White' : activeTab === 'dance' ? 'Dance' : 'Fitness'
              }));
              setShowAddModal(true);
            }} className={buttonClass({ variant: 'primary' })}>
              <Plus className="w-4 h-4" weight="bold"/> {t('lib_add_asset')}
            </button>
          )}
          {activeTab !== 'routines' && (
            <>
              <button type="button" onClick={() => { setSelected3DAsset(null); setShow3DStudio(true); }} className={buttonClass()} title={t('lib_3d_studio')}>
                <Stack className="w-4 h-4 text-brand" weight="bold"/> {t('lib_3d_studio')}
              </button>
              {isElevated && <button type="button" onClick={() => setShowBulkModal(true)} className={buttonClass()}>
                <UploadSimple className="w-4 h-4 text-brand"/> {t('lib_bulk_upload')}
              </button>}
            </>
          )}
          {isElevated && <button type="button" onClick={() => {
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
              publishToStudents: false,
              publicationReason: '',
            });
            setShowRoutineModal(true);
          }} className={buttonClass()}>
            <Timer className="w-4 h-4 text-amber-500 dark:text-amber-400" weight="bold"/> {t('lib_build_routine')}
          </button>}
        </> : undefined}
      />

      {/* Primary Dashboard Navigation Tabs */}
      {(() => {
        const tkdCount = state.curriculumVideos.filter(v => !(v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:') || v.category?.startsWith('Dance:'))).length;
        const fitnessCount = state.curriculumVideos.filter(v => v.minBeltLevel === 'Fitness' || v.category?.startsWith('Fitness:')).length;
        const danceCount = state.curriculumVideos.filter(v => v.category?.startsWith('Dance:')).length;
        const routinesCount = workoutTemplates.length;

        return (
          <div className="bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 shadow-sm">
             <button type="button" aria-pressed={activeTab === 'tkd'} onClick={() => { setActiveTab('tkd'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11",
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
             <button type="button" aria-pressed={activeTab === 'fitness'} onClick={() => { setActiveTab('fitness'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11",
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
             <button type="button" aria-pressed={activeTab === 'dance'} onClick={() => { setActiveTab('dance'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11",
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
             <button type="button" aria-pressed={activeTab === 'routines'} onClick={() => { setActiveTab('routines'); setSelectedSubCategory('All'); }}
               className={cn("py-2.5 px-3 min-h-[42px] text-xs font-bold uppercase tracking-wider rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11",
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
           <input type="search" aria-label={t('lib_search_placeholder')} placeholder={t('lib_search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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
      {activeTab === 'routines' && isElevated && managedWorkouts.loading && <p role="status" className="text-sm text-neutral-500">Loading routine drafts…</p>}
      {activeTab === 'routines' && isElevated && managedWorkouts.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{managedWorkouts.error}<button type="button" onClick={() => void managedWorkouts.reload()} className="ml-3 underline">Retry routines</button></div>}
      <div className={cn("grid gap-4 sm:gap-5", activeTab === 'routines' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5")}>
         {/* Routines View Mode */}
         {activeTab === 'routines' && filteredTemplates.map(template => (
           <div key={template.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 flex flex-col justify-between hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-md transition-all group duration-300 relative overflow-hidden shadow-sm">
             {isElevated && 'publicationState' in template && <span className="mb-3 self-start rounded-md bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{template.publicationState === 'draft' ? 'Private draft' : template.publicationState === 'changes' ? 'Published · draft changes' : 'Published to students'}</span>}
             {/* Decorative difficulty accent bar */}
             <div className={cn("absolute top-0 left-0 right-0 h-[3px]",
               template.difficulty === 'Elite' ? 'bg-purple-600' :
               template.difficulty === 'Advanced' ? 'bg-[#EF2F38]' :
               template.difficulty === 'Intermediate' ? 'bg-amber-500' : 'bg-emerald-500'
             )} />

             <div>
               <div className="flex items-center justify-between mb-3">
                 <div className="flex gap-1.5 flex-wrap">
                   <span className={cn("px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider border shadow-sm",
                     template.difficulty === 'Elite' ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400' :
                     template.difficulty === 'Advanced' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' :
                     template.difficulty === 'Intermediate' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                   )}>
                     {template.difficulty}
                   </span>
                   <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 shadow-sm">
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
                 <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-2">Sequence Flow ({template.structure.exercises.length} Exercises)</span>
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
                    className="bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-300 dark:border-neutral-700 text-amber-600 dark:text-amber-400 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
                            publishToStudents: false,
                            publicationReason: '',
                          });
                          setShowRoutineModal(true);
                        }}
                        className="bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                        title={t('lib_edit_routine')}
                      >
                        <PencilSimple className="w-4 h-4"/>
                      </button>
                      <button disabled={'publicationState' in template && template.publicationState !== 'draft'} onClick={() => handleDeleteRoutine(template.id, template.title)}
                        className="bg-neutral-100 hover:bg-red-50 dark:bg-[#1C1C1C] dark:hover:bg-red-950/20 border border-neutral-300 dark:border-neutral-700 text-red-600 dark:text-red-500 p-2.5 min-h-[38px] min-w-[38px] rounded-[8px] transition-all flex items-center justify-center shadow-sm cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                        title={'publicationState' in template && template.publicationState !== 'draft' ? 'Published routines are retained for students and assignment history' : 'Archive private draft'}
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
          {activeTab !== 'routines' && filteredAssets.slice(0, visibleAssetCount).map(video => {
            const details = lessonDetails(video);
            const thumbnail = lessonThumbnailUrl(details.thumbnailUrl, video.videoUrl);
            const publication = isElevated ? libraryLessonState(video) : 'legacy';
            return (
              <div key={video.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden flex flex-col justify-between hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:shadow-md transition-all group duration-300 shadow-sm">

                {/* Thumbnail card with dynamic play overlay */}
                <div className="aspect-video bg-neutral-100 dark:bg-[#1A1A1A] relative flex items-center justify-center border-b border-neutral-200 dark:border-[#262626] overflow-hidden">
                  <SafeImage src={thumbnail ?? undefined} alt="" width={480} height={270}
                    containerClassName="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallback={<BookOpen aria-hidden="true" className="h-10 w-10 text-neutral-400 dark:text-neutral-600" />} />

                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    {video.videoUrl ? (
                      <button type="button" aria-label={`Play ${video.title}`} onClick={(e) => { e.stopPropagation(); setActivePlayVideo(video); }} className="p-3 bg-[#EF2F38] text-white rounded-full hover:scale-110 transition-transform duration-300 shadow-xl shadow-red-950/40 cursor-pointer touch-manipulation active:scale-95">
                        <PlayCircle className="w-7 h-7" weight="fill"/>
                      </button>
                    ) : (
                      <div className="p-3 bg-[#1A1A1A] border border-[#333] text-neutral-400 rounded-full" title="No video attached">
                        <PlayCircle className="w-7 h-7" aria-hidden="true"/>
                      </div>
                    )}
                  </div>
                  {(publication === 'draft' || publication === 'changes') && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-[6px] border border-amber-400/40 bg-amber-950/80 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                      {publication === 'draft' ? 'Private draft' : 'Unpublished changes'}
                    </span>
                  )}

                  {/* Subcategory Label badge */}
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/75 backdrop-blur-sm border border-white/10 rounded-[6px] text-[9px] font-bold uppercase tracking-wider text-neutral-200">
                    {video.category.startsWith('Fitness:') || video.category.startsWith('Dance:')
                      ? (t(getCategoryTranslationKey(video.category)) || video.category.replace('Fitness: ', '').replace('Dance: ', ''))
                      : (t(getCategoryTranslationKey(normalizeCategory(video.category))) || video.category)}
                  </span>

                  {/* Belt label badge (TKD only) */}
                  {activeTab === 'tkd' && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-[6px] text-[9px] font-bold uppercase tracking-wider text-[#EF2F38]">
                      {video.minBeltLevel}
                    </span>
                  )}

                  {/* Difficulty Badge */}
                  {details.difficulty && (
                    <span className={cn("absolute top-3 left-3 px-2 py-0.5 border rounded-[6px] text-[9px] font-bold uppercase tracking-wider shadow-sm",
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
                    {/* The title is the keyboard and screen-reader entry point; the whole panel stays clickable for pointers. */}
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] dark:group-hover:text-[#EF2F38] transition-colors leading-tight">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedDetailAsset(video); }} className="text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF2F38]">{video.title}</button>
                    </h3>
                    {(testUsage.byAsset.get(video.id) ?? []).length > 0 && <ul aria-label="Used in belt tests" className="mt-1.5 flex flex-wrap gap-1">{[...new Map((testUsage.byAsset.get(video.id) ?? []).map(use => [use.syllabusId, use])).values()].map(use => <li key={use.syllabusId}
                      className={cn('rounded-[4px] border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', use.status === 'published' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300')}
                      title={`: ${use.item}`}>{use.status === 'published' ? '' : 'Draft '}{use.track === 'kukkiwon' ? 'Kukkiwon ' : ''}{use.targetBelt} test</li>)}</ul>}
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-2 line-clamp-3">{details.text || 'No description provided.'}</p>

                    {/* Focus Zones tags preview */}
                    {details.focusZones && details.focusZones.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {details.focusZones.slice(0, 3).map((zone, i) => (
                          <span key={i} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[9px] font-semibold rounded-[4px] font-sans uppercase tracking-wider">
                            {zone}
                          </span>
                        ))}
                        {details.focusZones.length > 3 && (
                          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium self-center ml-1">
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
                        className="text-neutral-500 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer flex items-center gap-1 touch-manipulation active:scale-95 pointer-coarse:min-h-11"
                        title={t('lib_3d_biomechanics')}
                      >
                        <Stack className="w-3.5 h-3.5 text-[#EF2F38]" weight="bold"/>
                        <span className="text-[9px] font-bold hidden sm:inline">3D</span>
                      </button>
                      {video.videoUrl && (
                        <button onClick={async (e) => {
                            e.stopPropagation();
                            if (!(await copyText(video.videoUrl || ''))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
                            showNotification("Video URL copied to clipboard!", 'success');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11"
                          title="Copy Video Link"
                        >
                          <Copy className="w-3.5 h-3.5"/>
                        </button>
                      )}
                      {isElevated && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleStartEdit(video); }}
                            className="text-neutral-500 hover:text-[#EF2F38] dark:hover:text-[#EF2F38] transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11"
                            title={t('act_edit')}
                          >
                            <PencilSimple className="w-3.5 h-3.5"/>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDeleteVideo(video.id, video.title); }}
                            className="text-neutral-500 hover:text-red-500 transition-colors p-1.5 min-h-[32px] rounded-[6px] hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer touch-manipulation active:scale-95 pointer-coarse:min-h-11"
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
      {activeTab !== 'routines' && filteredAssets.length > visibleAssetCount && <div className="flex justify-center"><button type="button" onClick={() => setVisibleAssetCount(value => value + 24)} className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-xs font-semibold dark:border-neutral-700 dark:bg-[#141414]">Show more lessons · {visibleAssetCount} of {filteredAssets.length}</button></div>}
      {activeTab === 'routines' && isElevated && managedWorkouts.hasMore && <div className="flex justify-center"><button type="button" disabled={managedWorkouts.loading} onClick={() => void managedWorkouts.loadMore()} className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700 dark:bg-[#141414]">{managedWorkouts.loading ? 'Loading…' : 'Load more routines'}</button></div>}
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
               className="mt-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-[8px] text-xs font-bold transition-all min-h-[36px] active:scale-95 touch-manipulation cursor-pointer inline-flex items-center gap-1.5 pointer-coarse:min-h-11"
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
        onOpenMaterial={id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) setSelectedDetailAsset(material); }}
      />

      {/* --- FLOATING WORKOUT PLAYBACK TIMER INTERACTIVE PORTAL --- */}
      <AnimatePresence>
        {runningWorkout && (
          <WorkoutTimerModal workout={runningWorkout} onClose={() => setRunningWorkout(null)} />
        )}
      </AnimatePresence>

      {showPublicationPanel && <LibraryPublicationPanel onClose={() => setShowPublicationPanel(false)} onOpenMaterial={id => { const material = state.curriculumVideos.find(row => row.id === id); if (material) { setShowPublicationPanel(false); setSelectedDetailAsset(material); } else showNotification('Refresh the library before reviewing this lesson.', 'warning'); }} />}
      {/* --- ADD ASSET MODAL DIALOG --- */}
      <AnimatePresence>
        {showAddModal && <LibraryAssetCreateDialog isSaving={isSaving} t={t} activeTab={activeTab} setShowAddModal={setShowAddModal} handleAddAsset={event => guardedSave(event, handleAddAsset)} newAsset={newAsset} setNewAsset={setNewAsset} addMuscleDropdownRef={addMuscleDropdownRef} muscleSearch={muscleSearch} setMuscleSearch={setMuscleSearch} setShowMuscleDropdown={setShowMuscleDropdown} setActiveMuscleIdx={setActiveMuscleIdx} showMuscleDropdown={showMuscleDropdown} state={state} activeMuscleIdx={activeMuscleIdx} selectedMuscles={selectedMuscles} setSelectedMuscles={setSelectedMuscles} instructionSteps={instructionSteps} setDraggedIndex={setDraggedIndex} draggedIndex={draggedIndex} setInstructionSteps={setInstructionSteps} addFitnessSolutionsDropdownRef={addFitnessSolutionsDropdownRef} fitnessSearch={fitnessSearch} setFitnessSearch={setFitnessSearch} setShowFitnessDropdown={setShowFitnessDropdown} showFitnessDropdown={showFitnessDropdown} selectedFitnessSolutions={selectedFitnessSolutions} setSelectedFitnessSolutions={setSelectedFitnessSolutions} prerequisiteSteps={prerequisiteSteps} setPrerequisiteSteps={setPrerequisiteSteps} principleSteps={principleSteps} setPrincipleSteps={setPrincipleSteps} drillingSteps={drillingSteps} setDrillingSteps={setDrillingSteps} mistakeSteps={mistakeSteps} setMistakeSteps={setMistakeSteps} performanceSteps={performanceSteps} setPerformanceSteps={setPerformanceSteps} terminologyList={terminologyList} setTerminologyList={setTerminologyList} studyGuideList={studyGuideList} setStudyGuideList={setStudyGuideList} />}
      </AnimatePresence>

      {/* --- BUILD ROUTINE TEMPLATE MODAL DIALOG --- */}
      <AnimatePresence>
        {showRoutineModal && <WorkoutRoutineEditor isSaving={isSaving} editingRoutine={editingRoutine} t={t} setShowRoutineModal={setShowRoutineModal} setEditingRoutine={setEditingRoutine} handleSaveRoutine={event => guardedSave(event, handleSaveRoutine)} newRoutine={newRoutine} setNewRoutine={setNewRoutine} exerciseSearch={exerciseSearch} setExerciseSearch={setExerciseSearch} setDropdownOpen={setDropdownOpen} dropdownOpen={dropdownOpen} filteredExercises={filteredExercises} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragEnd={handleDragEnd} draggedIndex={draggedIndex} handleMoveExercise={handleMoveExercise} />}
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
        {activePlayVideo && <LessonPlayerDialog video={activePlayVideo} t={t} onClose={() => setActivePlayVideo(null)} />}
      </AnimatePresence>
      {/* --- EXERCISE DETAIL & EDIT MODAL DIALOG --- */}
      <AnimatePresence>
        {selectedDetailAsset && <LibraryAssetDetailDialog isSaving={isSaving} editAsset={editAsset} handleSaveEditAsset={event => guardedSave(event, handleSaveEditAsset)} t={t} setEditAsset={setEditAsset} activeTab={(editAsset?.kind || activeTab) as typeof activeTab} editMuscleDropdownRef={editMuscleDropdownRef} editMuscleSearch={editMuscleSearch} setEditMuscleSearch={setEditMuscleSearch} setShowEditMuscleDropdown={setShowEditMuscleDropdown} setEditActiveMuscleIdx={setEditActiveMuscleIdx} showEditMuscleDropdown={showEditMuscleDropdown} state={state} editActiveMuscleIdx={editActiveMuscleIdx} editSelectedMuscles={editSelectedMuscles} setEditSelectedMuscles={setEditSelectedMuscles} editInstructionSteps={editInstructionSteps} setDraggedIndex={setDraggedIndex} draggedIndex={draggedIndex} setEditInstructionSteps={setEditInstructionSteps} editFitnessSolutionsDropdownRef={editFitnessSolutionsDropdownRef} editFitnessSearch={editFitnessSearch} setEditFitnessSearch={setEditFitnessSearch} setShowEditFitnessDropdown={setShowEditFitnessDropdown} showEditFitnessDropdown={showEditFitnessDropdown} editSelectedFitnessSolutions={editSelectedFitnessSolutions} setEditSelectedFitnessSolutions={setEditSelectedFitnessSolutions} editPrerequisiteSteps={editPrerequisiteSteps} setEditPrerequisiteSteps={setEditPrerequisiteSteps} editPrincipleSteps={editPrincipleSteps} setEditPrincipleSteps={setEditPrincipleSteps} editDrillingSteps={editDrillingSteps} setEditDrillingSteps={setEditDrillingSteps} editMistakeSteps={editMistakeSteps} setEditMistakeSteps={setEditMistakeSteps} editPerformanceSteps={editPerformanceSteps} setEditPerformanceSteps={setEditPerformanceSteps} editTerminologyList={editTerminologyList} setEditTerminologyList={setEditTerminologyList} editStudyGuideList={editStudyGuideList} setEditStudyGuideList={setEditStudyGuideList} selectedDetailAsset={selectedDetailAsset} setSelectedDetailAsset={setSelectedDetailAsset} setSelected3DAsset={setSelected3DAsset} setShow3DStudio={setShow3DStudio} anatomicalGender={anatomicalGender} show3DStudio={show3DStudio} expandedStudyGuides={expandedStudyGuides} toggleStudyGuide={toggleStudyGuide} isElevated={isElevated} confirmDeleteVideo={confirmDeleteVideo} handleStartEdit={handleStartEdit} />}
      </AnimatePresence>


    </div>
  );
}

/** Quick-play overlay: a real modal dialog, so Escape closes it and focus stays inside. */
function LessonPlayerDialog({ video, t, onClose }: { video: CurriculumVideo; t: ReturnType<typeof useT>; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose, true);
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="library-player-title" tabIndex={-1} className="w-full max-w-3xl bg-[#0A0A0A] border border-[#262626] rounded-[10px] overflow-hidden shadow-2xl flex flex-col max-h-[85dvh]">
          <div className="p-4 md:p-5 border-b border-[#262626] bg-[#0F0F0F] flex justify-between items-center gap-4">
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] rounded-[6px]">
                {t(getCategoryTranslationKey(video.category)) || video.category.replace('Fitness: ', '').replace('Dance: ', '')}
              </span>
              <h3 id="library-player-title" className="text-sm md:text-base font-bold text-white mt-1.5 leading-tight break-words">{video.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('act_close')}
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-[#1A1A1A] border border-[#262626] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
              title={t('act_close')}
            >
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className="flex-1 bg-black flex items-center justify-center p-2 min-h-[300px]">
            {video.videoUrl ? (
              <LessonMediaPlayer url={video.videoUrl} title={video.title} className="aspect-video rounded-[8px]" />
            ) : (
              <p className="text-xs text-neutral-400 font-mono">{t('lib_no_video_url')}</p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// Workout Timer Player Overlay Component
