'use client';

import React, { useState } from 'react';
import { useAppStore, BeltHistory, getMembershipBillingStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { HouseholdManagementModal } from './HouseholdManagementModal';
import { 
  MagnifyingGlass, ShieldCheck, Trophy, Checks, Calendar, GraduationCap, 
  Trash, Clock, Info, CheckCircle, Warning, UserCircle, Plus, CaretRight,
  PencilSimple, Globe, Copy, Check, House, ArrowsClockwise,
  DownloadSimple, CaretLeft, Phone, Envelope, Funnel, X,
  ArrowRight, FileCsv, Sparkle
} from '@phosphor-icons/react';
import { cn, formatBelt, isBeltMatch, calculatePromotionReadiness, getBeltKey, DEFAULT_BELT_TECHNIQUES, BELT_REQUIREMENTS } from '@/lib/utils';
import dynamic from 'next/dynamic';

import { AddStudentModal } from './AddStudentModal';
import { BulkImportStudentModal } from './BulkImportStudentModal';
import { ManageStudentPanel } from './ManageStudentPanel';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { Portal } from './Portal';
import { supabase } from '@/lib/supabase';

export function DirectoryView() {
  const { state, updateStudent, reconcileAllStudentBelts, addBeltHistory, upsertPhysicalEvaluation, showNotification, showConfirm, can } = useAppStore();
  const t = useT();

  // Quick Status Management Modal state
  const [selectedStudentForStatus, setSelectedStudentForStatus] = useState<any | null>(null);
  const [quickStatusForm, setQuickStatusForm] = useState<{
    studentStatus: 'Active' | 'Paused' | 'Inactive' | 'Suspended' | 'Graduated';
    statusReason: string;
    pauseEndDate: string;
  }>({
    studentStatus: 'Active',
    statusReason: '',
    pauseEndDate: ''
  });
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'roster' | 'beltCenter'>('roster');
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);

  // --- Roster View States ---
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<number | 'all'>('all');
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [filterBelt, setFilterBelt] = useState<string | 'all'>('all');
  const [filterGender, setFilterGender] = useState<string | 'all'>('all');
  const [filterScholarship, setFilterScholarship] = useState<number | 'all'>('all');
  const [filterDivision, setFilterDivision] = useState<string | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string | 'all'>('Active');
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'khmerName' | 'belt' | 'regDate'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- Belt Promotion Center States ---
  const [beltCenterSubTab, setBeltCenterSubTab] = useState<'readiness' | 'history' | 'curriculum'>('readiness');
  const [selectedBeltPipelineFilter, setSelectedBeltPipelineFilter] = useState<string | null>(null);
  // System certificate viewing removed as requested
  const [selectedStudentForCurriculum, setSelectedStudentForCurriculum] = useState<string | null>(null);

  const [promotionSearch, setPromotionSearch] = useState('');
  const [filterEligibility, setFilterEligibility] = useState<'all' | 'Ready' | 'Developing' | 'Needs Work'>('all');
  const [selectedStudentsForPromotion, setSelectedStudentsForPromotion] = useState<string[]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionForm, setPromotionForm] = useState({
    targetBeltMode: 'next' as 'next' | 'fixed',
    fixedTargetBelt: 'Yellow' as string,
    testScore: 80,
    program: 'Standard Class',
    promotionDate: new Date().toISOString().split('T')[0],
    certificateUrl: ''
  });

  const [copiedHistoryId, setCopiedHistoryId] = useState<number | null>(null);
  
  // Edit Log States
  const [editingHistory, setEditingHistory] = useState<BeltHistory | null>(null);
  const [editHistoryForm, setEditHistoryForm] = useState({
    beltLevel: 'Yellow',
    promotionDate: '',
    testScore: 80,
    program: 'Standard Class',
    certificateRef: '',
    kukkiwonDanCardId: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [stateRevision, setStateRevision] = useState(0);

  const handleCopyLink = (historyId: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedHistoryId(historyId);
    setTimeout(() => setCopiedHistoryId(null), 2000);
  };

  const handleOpenEditHistory = (h: BeltHistory) => {
    setEditingHistory(h);
    setEditHistoryForm({
      beltLevel: h.beltLevel,
      promotionDate: h.promotionDate,
      testScore: h.testScore || 80,
      program: h.program || 'Standard Class',
      certificateRef: h.certificateRef || '',
      kukkiwonDanCardId: h.kukkiwonDanCardId || ''
    });
  };
  
  const handleSaveEditHistorySubmit = async () => {
    if (!editingHistory) return;
    
    // Uniqueness validation on certificateRef
    if (editHistoryForm.certificateRef) {
      const normalizedRef = editHistoryForm.certificateRef.trim().toUpperCase();
      const isDuplicate = state.beltHistories.some(
        b => b.id !== editingHistory.id && b.certificateRef && b.certificateRef.trim().toUpperCase() === normalizedRef
      );
      if (isDuplicate) {
        showNotification(t('dir_err_cert_ref_exists').replace('{ref}', editHistoryForm.certificateRef), 'error');
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase.from('belt_histories').update({
        belt_level: editHistoryForm.beltLevel,
        promotion_date: editHistoryForm.promotionDate,
        test_score: Number(editHistoryForm.testScore),
        program: editHistoryForm.program.trim(),
        certificate_id: editHistoryForm.certificateRef.trim() || null,
        kukkiwon_dan_card_id: editHistoryForm.kukkiwonDanCardId.trim() || null
      }).eq('id', editingHistory.id);

      if (error) throw error;

      // Update local state
      state.beltHistories = state.beltHistories.map(h => 
        h.id === editingHistory.id 
          ? { 
              ...h, 
              beltLevel: editHistoryForm.beltLevel,
              promotionDate: editHistoryForm.promotionDate || new Date().toISOString().split('T')[0],
              testScore: Number(editHistoryForm.testScore) || 80,
              program: editHistoryForm.program.trim() || 'Standard Class',
              certificateRef: editHistoryForm.certificateRef.trim() || undefined,
              kukkiwonDanCardId: editHistoryForm.kukkiwonDanCardId.trim() || undefined
            } 
          : h
      );

      // Reconcile student belts to automatically heal current belts in profile and state!
      await reconcileAllStudentBelts();
      
      setStateRevision(prev => prev + 1);
      showNotification(t('dir_msg_log_updated'), 'success');
      setEditingHistory(null);
    } catch (e: any) {
      showNotification(t('dir_err_update_failed').replace('{error}', e.message), 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // History Ledger States
  const [historySearch, setHistorySearch] = useState('');
  const [isDeletingHistory, setIsDeletingHistory] = useState<number | null>(null);

  // New Readiness Directory branch filter
  const [filterBranchPromo, setFilterBranchPromo] = useState<number | 'all'>('all');

  // New History Ledger filters
  const [filterBranchHistory, setFilterBranchHistory] = useState<number | 'all'>('all');
  const [filterBeltHistory, setFilterBeltHistory] = useState<string | 'all'>('all');
  const [filterProgramHistory, setFilterProgramHistory] = useState<string | 'all'>('all');

  // Reconciliation diagnostic states
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    scanned: number;
    corrected: number;
    details: string[];
  } | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const canCreateStudent = can('action:student_create');
  const canEditStudent = can('action:student_edit');
  const canDeleteStudent = can('action:student_delete');
  const canManageStudents = canCreateStudent || canEditStudent;
  const isDirectoryReadOnly = !canManageStudents;

  // --- Promotion Helper Rules & Calculations ---
  const BELT_RANK_ORDER = [
    'White',
    'Yellow',
    'Green',
    'Blue',
    'Brown',
    'Red',
    '1st Poom/Dan',
    '2nd Poom/Dan',
    '3rd Poom/Dan',
    '4th Poom/Dan'
  ];

  const getNextBeltRank = (currentBelt: string) => {
    const idx = BELT_RANK_ORDER.indexOf(currentBelt);
    if (idx >= 0 && idx < BELT_RANK_ORDER.length - 1) {
      return BELT_RANK_ORDER[idx + 1];
    }
    return currentBelt;
  };

  const getStudentPromotionData = (student: typeof state.students[0]) => {
    return calculatePromotionReadiness(
      student,
      state.attendanceRecords,
      state.videoProgress,
      state.curriculumVideos,
      state.beltHistories,
      state.physicalEvaluations,
      state.beltTechniques
    );
  };

  const handleOpenSinglePromote = (studentId: string) => {
    setSelectedStudentsForPromotion([studentId]);
    setShowPromotionModal(true);
  };

  const handleVoidPromotion = async (historyId: number) => {
    showConfirm(
      t('dir_confirm_void_promotion'),
      async () => {
        setIsDeletingHistory(historyId);
        try {
          const { error } = await supabase.from('belt_histories').delete().eq('id', historyId);
          if (error) throw error;
          
          // Update local state by removing the history entry
          state.beltHistories = state.beltHistories.filter(h => h.id !== historyId);
          
          // Call reconcileAllStudentBelts to auto-heal the student's active belt!
          await reconcileAllStudentBelts();
          setStateRevision(prev => prev + 1);
          showNotification(t('dir_msg_promotion_voided'), 'success');
        } catch (e: any) {
          showNotification(t('dir_err_void_failed').replace('{error}', e.message), 'error');
        } finally {
          setIsDeletingHistory(null);
        }
      }
    );
  };

  const handleBulkPromoteSubmit = async () => {
    if (selectedStudentsForPromotion.length === 0) return;
    
    let successCount = 0;
    
    for (const studentId of selectedStudentsForPromotion) {
      const student = state.students.find(s => s.id === studentId);
      if (!student) continue;

      let targetBelt = promotionForm.fixedTargetBelt;
      if (promotionForm.targetBeltMode === 'next') {
        targetBelt = getNextBeltRank(student.currentBelt);
      }

      // Generate a collision-free certificate reference
      const promotionDate = promotionForm.promotionDate || new Date().toISOString().split('T')[0];
      const cleanDate = promotionDate.replace(/-/g, '');
      const cleanId = student.id.replace(/[^a-zA-Z0-9]/g, '');
      const rand = Math.floor(100 + Math.random() * 900);
      const certificateRef = `INF-${cleanDate}-${cleanId}-${rand}`;

      try {
        await addBeltHistory({
          studentId: student.id,
          beltLevel: targetBelt,
          promotionDate: promotionDate,
          testScore: Number(promotionForm.testScore) || 80,
          program: promotionForm.program || 'Standard Class',
          certificateRef,
          kukkiwonDanCardId: promotionForm.certificateUrl || undefined
        });
        successCount++;
      } catch (e) {
        console.error(`Failed to promote student ${student.id}:`, e);
      }
    }

    showNotification(t('dir_msg_bulk_promoted').replace('{count}', String(successCount)), 'success');
    setSelectedStudentsForPromotion([]);
    setShowPromotionModal(false);
    setPromotionForm(prev => ({ ...prev, certificateUrl: '' }));
  };

  const filteredStudents = state.students.filter(s => {
    const matchesSearch = s.englishName.toLowerCase().includes(search.toLowerCase()) || 
                          s.id.toLowerCase().includes(search.toLowerCase()) ||
                          s.khmerName.includes(search);
    const matchesBranch = filterBranch === 'all' || s.homeBranchId === filterBranch;
    const matchesBelt = filterBelt === 'all' || s.currentBelt === filterBelt;
    const matchesGender = filterGender === 'all' || s.gender === filterGender;
    const matchesScholarship = filterScholarship === 'all' || s.scholarshipId === filterScholarship;
    const matchesStatus = filterStatus === 'all' || s.studentStatus === filterStatus;
    
    let matchesClass = true;
    if (filterClass !== 'all') {
      matchesClass = state.classEnrollments.some(e => e.studentId === s.id && e.classId === filterClass);
    }

    let matchesDivision = true;
    if (filterDivision !== 'all') {
      const birthYear = new Date(s.dob).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      
      if (filterDivision === 'Kid') matchesDivision = age >= 6 && age <= 11;
      else if (filterDivision === 'Cadet') matchesDivision = age >= 12 && age <= 14;
      else if (filterDivision === 'Junior') matchesDivision = age >= 15 && age <= 17;
      else if (filterDivision === 'Senior') matchesDivision = age >= 18;
    }

    return matchesSearch && matchesBranch && matchesBelt && matchesGender && matchesScholarship && matchesDivision && matchesClass && matchesStatus;
  });

  const handleSort = (field: 'id' | 'name' | 'khmerName' | 'belt' | 'regDate') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const BELT_RANK_ORDER = [
      'White',
      'Yellow',
      'Green',
      'Blue',
      'Brown',
      'Red',
      '1st Poom/Dan',
      '2nd Poom/Dan',
      '3rd Poom/Dan',
      '4th Poom/Dan'
    ];

    let comparison = 0;

    if (sortBy === 'id') {
      const getNum = (id: string) => {
        const parts = id.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      };
      comparison = getNum(a.id) - getNum(b.id);
    } else if (sortBy === 'name') {
      comparison = a.englishName.localeCompare(b.englishName);
    } else if (sortBy === 'khmerName') {
      comparison = a.khmerName.localeCompare(b.khmerName);
    } else if (sortBy === 'regDate') {
      const dateA = new Date(a.registrationDate || 0).getTime();
      const dateB = new Date(b.registrationDate || 0).getTime();
      comparison = dateA - dateB;
    } else if (sortBy === 'belt') {
      const idxA = BELT_RANK_ORDER.indexOf(a.currentBelt);
      const idxB = BELT_RANK_ORDER.indexOf(b.currentBelt);
      comparison = idxA - idxB;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // --- Student Roster Pagination & Copy States ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = sortedStudents.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handleCopyContact = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedContact(text);
    setTimeout(() => setCopiedContact(null), 1800);
  };

  const getStudentAge = (dob?: string) => {
    if (!dob) return null;
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getStudentDivisionLabel = (age: number | null) => {
    if (age === null) return 'N/A';
    if (age < 6) return 'Under 6';
    if (age <= 11) return 'Kid';
    if (age <= 14) return 'Cadet';
    if (age <= 17) return 'Junior';
    return 'Senior';
  };

  const handleExportCsv = () => {
    if (sortedStudents.length === 0) {
      showNotification('No student records to export.', 'warning');
      return;
    }
    const headers = [
      'Student ID',
      'English Name',
      'Khmer Name',
      'Gender',
      'Date of Birth',
      'Belt Rank',
      'Status',
      'Branch',
      'Enrolled Class',
      'Phone',
      'Email',
      'Emergency Contact',
      'Emergency Phone',
      'Registration Date'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = sortedStudents.map(s => {
      const branchName = state.branches.find(b => b.id === s.homeBranchId)?.name || 'Unassigned';
      const enroll = state.classEnrollments.find(e => e.studentId === s.id);
      const className = enroll ? state.classSessions.find(c => c.id === enroll.classId)?.name || 'Enrolled' : 'Unenrolled';
      return [
        escapeCsv(s.id),
        escapeCsv(s.englishName),
        escapeCsv(s.khmerName || ''),
        escapeCsv(s.gender || ''),
        escapeCsv(s.dob || ''),
        escapeCsv(formatBelt(s.currentBelt, s.dob)),
        escapeCsv(s.studentStatus || 'Active'),
        escapeCsv(branchName),
        escapeCsv(className),
        escapeCsv(s.phone || ''),
        escapeCsv(s.email || ''),
        escapeCsv(s.emergencyContactName || ''),
        escapeCsv(s.emergencyContactPhone || ''),
        escapeCsv(s.registrationDate || '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinitytkd-students-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${sortedStudents.length} student records to CSV.`, 'success');
  };

  // --- Derived Promotion Stats & Mappings ---
  const studentsWithPromoData = React.useMemo(() => {
    return state.students.map(s => ({
      student: s,
      ...getStudentPromotionData(s)
    }));
  }, [state.students, state.attendanceRecords, state.videoProgress, state.curriculumVideos, state.beltHistories, state.physicalEvaluations, state.beltTechniques, stateRevision]);

  const totalColorBelts = state.students.filter(s => 
    ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red'].includes(s.currentBelt)
  ).length;

  const totalBlackBelts = state.students.filter(s => 
    s.currentBelt.toLowerCase().includes('poom') || 
    s.currentBelt.toLowerCase().includes('dan') || 
    s.currentBelt.toLowerCase() === 'black'
  ).length;

  const totalReadyCandidates = studentsWithPromoData.filter(x => x.eligibilityStatus === 'Ready').length;
  const totalDevelopingCandidates = studentsWithPromoData.filter(x => x.eligibilityStatus === 'Developing').length;

  const activeCandidates = studentsWithPromoData.filter(x => x.student.studentStatus === 'Active');
  const avgPri = activeCandidates.length > 0 
    ? Math.round(activeCandidates.reduce((acc, c) => acc + c.pri, 0) / activeCandidates.length)
    : 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPromotionsCount = state.beltHistories.filter(h => new Date(h.promotionDate) >= thirtyDaysAgo).length;

  // Filter promotion roster candidates
  const filteredPromoCandidates = React.useMemo(() => {
    return studentsWithPromoData.filter(item => {
      const q = promotionSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        item.student.englishName.toLowerCase().includes(q) ||
        item.student.id.toLowerCase().includes(q) ||
        (item.student.khmerName && item.student.khmerName.toLowerCase().includes(q));
      const matchesEligibility = filterEligibility === 'all' || item.eligibilityStatus === filterEligibility;
      const matchesPipeline = !selectedBeltPipelineFilter || item.student.currentBelt === selectedBeltPipelineFilter;
      const matchesBranch = filterBranchPromo === 'all' || item.student.homeBranchId === filterBranchPromo;
      return matchesSearch && matchesEligibility && matchesPipeline && matchesBranch;
    });
  }, [studentsWithPromoData, promotionSearch, filterEligibility, selectedBeltPipelineFilter, filterBranchPromo]);

  // Filter promotion history ledger
  const filteredHistory = React.useMemo(() => {
    return state.beltHistories.filter(history => {
      const student = state.students.find(s => s.id === history.studentId);
      if (!student) return false;
      const q = historySearch.toLowerCase().trim();
      const matchesSearch = !q || 
        student.englishName.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q) ||
        (history.certificateRef && history.certificateRef.toLowerCase().includes(q));
      
      const matchesBranch = filterBranchHistory === 'all' || student.homeBranchId === filterBranchHistory;
      const matchesBelt = filterBeltHistory === 'all' || history.beltLevel === filterBeltHistory;
      const matchesProgram = filterProgramHistory === 'all' || (history.program && history.program === filterProgramHistory) || (filterProgramHistory === 'Standard Class' && !history.program);
      
      return matchesSearch && matchesBranch && matchesBelt && matchesProgram;
    }).sort((a, b) => {
      return new Date(b.promotionDate).getTime() - new Date(a.promotionDate).getTime();
    });
  }, [state.beltHistories, state.students, historySearch, filterBranchHistory, filterBeltHistory, filterProgramHistory]);

  const handleExportHistoryCsv = () => {
    if (filteredHistory.length === 0) {
      showNotification('No promotion history records to export.', 'warning');
      return;
    }
    const headers = [
      'Student ID',
      'Student Name',
      'Branch',
      'Promoted Belt Level',
      'Promotion Date',
      'Test Score',
      'Program',
      'Certificate Ref',
      'Certificate / Dan Card URL'
    ];
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = filteredHistory.map(h => {
      const student = state.students.find(s => s.id === h.studentId);
      const branch = student ? state.branches.find(b => b.id === student.homeBranchId)?.name || 'Unassigned' : 'N/A';
      return [
        escapeCsv(h.studentId),
        escapeCsv(student ? student.englishName : 'N/A'),
        escapeCsv(branch),
        escapeCsv(h.beltLevel),
        escapeCsv(h.promotionDate),
        escapeCsv(h.testScore || 80),
        escapeCsv(h.program || 'Standard Class'),
        escapeCsv(h.certificateRef || ''),
        escapeCsv(h.kukkiwonDanCardId || '')
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinitytkd-promotion-history-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredHistory.length} promotion records to CSV.`, 'success');
  };

  const handleSelectAllPromo = (checked: boolean) => {
    if (checked) {
      const activeIds = filteredPromoCandidates
        .filter(item => item.student.studentStatus === 'Active')
        .map(item => item.student.id);
      setSelectedStudentsForPromotion(activeIds);
    } else {
      setSelectedStudentsForPromotion([]);
    }
  };

  const handleSelectPromo = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudentsForPromotion(prev => [...prev, studentId]);
    } else {
      setSelectedStudentsForPromotion(prev => prev.filter(id => id !== studentId));
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setFilterBranch('all');
    setFilterClass('all');
    setFilterBelt('all');
    setFilterGender('all');
    setFilterScholarship('all');
    setFilterDivision('all');
    setFilterStatus('all');
    setCurrentPage(1);
  };

  return (
    <div className="bg-white dark:bg-[#141414] rounded-[8px] flex flex-col min-h-[calc(100dvh-8rem)] shadow-sm border border-neutral-200 dark:border-[#262626] relative overflow-hidden">
      
      {/* Top Navigation Tabs */}
      <div className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex px-3 sm:px-4 gap-3 sm:gap-6 shrink-0 z-20 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveViewTab('roster')} 
          className={cn(
            "py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0", 
            activeViewTab === 'roster' ? "border-[#EF2F38] text-neutral-900 dark:text-white font-black" : "border-transparent text-neutral-500 dark:text-[#666] hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          Student Roster
        </button>
        <button 
          onClick={() => setActiveViewTab('beltCenter')} 
          className={cn(
            "py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0", 
            activeViewTab === 'beltCenter' ? "border-[#EF2F38] text-neutral-900 dark:text-white font-black" : "border-transparent text-neutral-500 dark:text-[#666] hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full bg-[#EF2F38] inline-block", activeViewTab !== 'beltCenter' && "animate-pulse")}></span>
          Belt Promotion Center
        </button>
      </div>

      {activeViewTab === 'roster' ? (
        <>
          <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-[#262626] flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414]">
            {/* Top Toolbar: Full-width native search on mobile, flex row on desktop */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
              {/* Search Bar - Native styling, compact text-xs, clear button */}
              <div className="relative w-full md:max-w-md">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-[#666]"/>
                <input 
                  type="text" 
                  placeholder={t('dir_search_placeholder')} 
                  value={search} 
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs h-9 sm:h-10 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-sans"
                />
                {search && (
                  <button 
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer active:scale-90 transition-transform"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Toolbar: Horizontal swipeable rail on mobile, flex-nowrap row on desktop */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x -mx-3 px-3 sm:mx-0 sm:px-0 md:flex-wrap shrink-0">
                {canManageStudents && (
                  <button 
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="h-8 sm:h-9 px-2.5 sm:px-3.5 bg-[#EF2F38] hover:bg-[#D9222B] active:scale-95 touch-manipulation text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider shadow-sm shadow-[#EF2F38]/20 whitespace-nowrap flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus size={13} weight="bold" />
                    <span>Add</span>
                    <span className="hidden xs:inline">&nbsp;Student</span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "h-8 sm:h-9 px-2.5 sm:px-3 rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation border",
                    showFilters 
                      ? "bg-[#EF2F38] text-white border-[#EF2F38]" 
                      : "bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white"
                  )}
                >
                  <Funnel size={12} weight={showFilters ? "fill" : "bold"} />
                  <span>{t('act_filters')}</span>
                  {(filterBranch !== 'all' || filterClass !== 'all' || filterBelt !== 'all' || filterGender !== 'all' || filterScholarship !== 'all' || filterDivision !== 'all') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38] inline-block" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation"
                  title="Export filtered student roster to CSV"
                >
                  <DownloadSimple size={12} weight="bold" />
                  <span>CSV</span>
                </button>

                {canManageStudents && (
                  <>
                    <button 
                      type="button"
                      onClick={() => setIsHouseholdModalOpen(true)}
                      className="h-8 sm:h-9 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[#EF2F38] rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation"
                    >
                      <House size={12} weight="bold" />
                      <span>Household</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsBulkImporting(true)}
                      className="h-8 sm:h-9 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer shrink-0 active:scale-95 touch-manipulation"
                    >
                      <span className="xs:hidden">Import</span>
                      <span className="hidden xs:inline">{t('dir_bulk_import')}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={async () => {
                        setIsReconciling(true);
                        try {
                          const res = await reconcileAllStudentBelts();
                          setReconcileResult(res);
                        } catch (e: any) {
                          showNotification(t('dir_err_reconcile_failed').replace('{error}', e.message), 'error');
                        } finally {
                          setIsReconciling(false);
                        }
                      }}
                      disabled={isReconciling}
                      className="h-8 sm:h-9 px-2.5 sm:px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-500 rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0 active:scale-95 touch-manipulation"
                    >
                      <span className="xs:hidden">{isReconciling ? 'Syncing...' : 'Reconcile'}</span>
                      <span className="hidden xs:inline">{isReconciling ? t('dir_reconciling') : t('dir_reconcile_ranks')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Quick Status Filter Segment Pills */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar touch-pan-x -mx-3 px-3 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
              {[
                { id: 'Active', label: 'Active', count: state.students.filter(s => s.studentStatus === 'Active').length, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/40 font-black' },
                { id: 'Paused', label: 'Paused', count: state.students.filter(s => s.studentStatus === 'Paused').length, color: 'text-amber-700 dark:text-amber-400 bg-amber-500/15 border-amber-500/40 font-black' },
                { id: 'Inactive', label: 'Inactive', count: state.students.filter(s => s.studentStatus === 'Inactive').length, color: 'text-neutral-700 dark:text-neutral-300 bg-neutral-500/15 border-neutral-500/40 font-black' },
                { id: 'Suspended', label: 'Suspended', count: state.students.filter(s => s.studentStatus === 'Suspended').length, color: 'text-red-700 dark:text-red-400 bg-red-500/15 border-red-500/40 font-black' },
                { id: 'Graduated', label: 'Graduated', count: state.students.filter(s => s.studentStatus === 'Graduated').length, color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/15 border-indigo-500/40 font-black' },
                { id: 'all', label: 'All Students', count: state.students.length, color: 'text-neutral-900 dark:text-white bg-neutral-200 dark:bg-[#1A1A1A] border-neutral-300 dark:border-[#333] font-black' }
              ].map(pill => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setFilterStatus(pill.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-[6px] sm:rounded-[8px] text-[9.5px] sm:text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer select-none shrink-0 active:scale-95 touch-manipulation",
                    filterStatus === pill.id
                      ? pill.color
                      : "border-neutral-200 dark:border-transparent text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A]"
                  )}
                >
                  <span>{pill.label}</span>
                  <span className="px-1.5 py-0.2 text-[9px] rounded font-mono bg-neutral-200 dark:bg-black/50 text-neutral-800 dark:text-white font-bold">{pill.count}</span>
                </button>
              ))}
            </div>

            {showFilters && (
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px] space-y-2.5 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    <Funnel size={13} weight="bold" className="text-[#EF2F38]" />
                    <span>Filter Directory</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[10px] text-[#EF2F38] hover:underline font-bold uppercase tracking-wider cursor-pointer active:scale-95"
                  >
                    Reset All Filters
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  <select value={filterBranch} onChange={(e) => {
                    setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                    setFilterClass('all');
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_branches')}</option>
                    {state.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <select value={filterClass} onChange={(e) => {
                    setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value));
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer truncate"
                    disabled={filterBranch === 'all'}
                  >
                    <option value="all">{t('dir_all_classes')}</option>
                    {filterBranch !== 'all' && state.classSessions.filter(c => c.branchId === filterBranch).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select value={filterBelt} onChange={(e) => {
                    setFilterBelt(e.target.value);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_belts')}</option>
                    <option value="White">White</option>
                    <option value="Yellow">Yellow</option>
                    <option value="Green">Green</option>
                    <option value="Blue">Blue</option>
                    <option value="Brown">Brown</option>
                    <option value="Red">Red</option>
                    <option value="1st Poom/Dan">1st Poom/Dan</option>
                    <option value="2nd Poom/Dan">2nd Poom/Dan</option>
                    <option value="3rd Poom/Dan">3rd Poom/Dan</option>
                    <option value="4th Poom/Dan">4th Poom/Dan</option>
                  </select>
                  <select value={filterGender} onChange={(e) => {
                    setFilterGender(e.target.value);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_genders')}</option>
                    <option value="Male">{t('stu_male')}</option>
                    <option value="Female">{t('stu_female')}</option>
                  </select>
                  <select value={filterScholarship} onChange={(e) => {
                    setFilterScholarship(Number(e.target.value === 'all' ? 'all' : e.target.value));
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_scholarships')}</option>
                    {state.scholarships.map(s => (
                      <option key={s.id} value={s.id}>{s.typeName}</option>
                    ))}
                  </select>
                  <select value={filterDivision} onChange={(e) => {
                    setFilterDivision(e.target.value);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none focus:border-[#EF2F38] cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_divisions')}</option>
                    <option value="Kid">Kid (6-11)</option>
                    <option value="Cadet">Cadet (12-14)</option>
                    <option value="Junior">Junior (15-17)</option>
                    <option value="Senior">Senior (18+)</option>
                  </select>
                  <select value={filterStatus} onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-red-600 dark:text-red-500 border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                  <select value={`${sortBy}-${sortOrder}`} onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-amber-600 dark:text-amber-500 border border-amber-500/30 rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
                  >
                    <option value="id-asc">Sort: ID (Oldest)</option>
                    <option value="id-desc">Sort: ID (Newest)</option>
                    <option value="name-asc">Sort: Name (A-Z)</option>
                    <option value="name-desc">Sort: Name (Z-A)</option>
                    <option value="khmerName-asc">Sort: Khmer (A-Z)</option>
                    <option value="khmerName-desc">Sort: Khmer (Z-A)</option>
                    <option value="belt-asc">Sort: Belt (Lowest)</option>
                    <option value="belt-desc">Sort: Belt (Highest)</option>
                    <option value="regDate-asc">Sort: Reg (Oldest)</option>
                    <option value="regDate-desc">Sort: Reg (Newest)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {state.isLoading ? (
              /* Loading Skeleton State */
              <div className="p-4 space-y-4">
                {/* Desktop skeleton */}
                <div className="hidden md:block space-y-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#1A1A1A]/40 border border-[#262626] rounded-[8px] animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#262626]" />
                        <div className="space-y-1.5">
                          <div className="w-28 h-3.5 bg-[#262626] rounded" />
                          <div className="w-16 h-2.5 bg-[#202020] rounded" />
                        </div>
                      </div>
                      <div className="w-16 h-5 bg-[#262626] rounded-full" />
                      <div className="w-20 h-7 bg-[#262626] rounded-[8px]" />
                    </div>
                  ))}
                </div>
                {/* Mobile skeleton */}
                <div className="block md:hidden space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-3.5 bg-[#1A1A1A]/40 border border-[#262626] rounded-[8px] space-y-3 animate-pulse">
                      <div className="flex justify-between items-center">
                        <div className="w-16 h-3 bg-[#262626] rounded" />
                        <div className="w-14 h-4 bg-[#262626] rounded" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#262626]" />
                        <div className="space-y-1.5 flex-1">
                          <div className="w-32 h-4 bg-[#262626] rounded" />
                          <div className="w-20 h-3 bg-[#202020] rounded" />
                        </div>
                      </div>
                      <div className="w-full h-11 bg-[#262626] rounded-[8px]" />
                    </div>
                  ))}
                </div>
              </div>
            ) : sortedStudents.length === 0 ? (
              /* Dedicated Zero Data State */
              <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[300px]">
                <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center mb-3">
                  <UserCircle className="w-8 h-8 text-neutral-400 dark:text-[#666]" weight="duotone" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">{t('att_no_students')}</h3>
                <p className="text-xs text-neutral-500 dark:text-[#666] max-w-xs mb-4">No student records match your active search filters or query.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black text-xs font-bold uppercase tracking-wider rounded-[8px] flex items-center gap-2 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                >
                  <ArrowsClockwise className="w-4 h-4" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <>
                {/* Desktop View: Wide Data Table with Sticky Actions */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-neutral-50 dark:bg-[#0F0F0F] sticky top-0 z-20 text-neutral-500 dark:text-[#888] uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                      <tr>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={() => handleSort('id')}>
                          <div className="flex items-center gap-1.5">
                            <span>{t('stu_id')}</span>
                            {sortBy === 'id' && (
                              <span className="text-[10px] text-[#EF2F38] font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-1.5">
                            <span>{t('stu_english_name')} / {t('stu_khmer_name')}</span>
                            {(sortBy === 'name' || sortBy === 'khmerName') && (
                              <span className="text-[10px] text-[#EF2F38] font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={() => handleSort('belt')}>
                          <div className="flex items-center gap-1.5">
                            <span>{t('stu_belt')}</span>
                            {sortBy === 'belt' && (
                              <span className="text-[10px] text-[#EF2F38] font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-5 py-3">Branch & Class</th>
                        <th className="px-5 py-3">Contact Details</th>
                        <th className="px-5 py-3">Age / Gender</th>
                        <th className="px-5 py-3">Status & Billing</th>
                        <th className="px-5 py-3 text-right sticky right-0 bg-neutral-50 dark:bg-[#0F0F0F] z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.4)] border-l border-neutral-200 dark:border-[#262626]">
                          {t('act_actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                      {paginatedStudents.map(student => (
                        <tr 
                          key={student.id} 
                          onClick={() => setSelectedStudentId(student.id)} 
                          className="group hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] cursor-pointer transition-colors text-neutral-800 dark:text-[#E4E4E4]"
                        >
                          {/* 1. Student ID */}
                          <td className="px-5 py-3.5 font-mono font-bold text-[#EF2F38] tracking-tight">
                            {student.id}
                          </td>

                          {/* 2. Student Avatar & Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <SafeImage 
                                src={student.profilePicturePath} 
                                alt={student.englishName} 
                                containerClassName="w-8 h-8 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0 shadow-xs"
                              />
                              <div className="min-w-0">
                                <div className="text-neutral-900 dark:text-white font-bold text-xs truncate">
                                  {student.englishName}
                                </div>
                                {student.khmerName && (
                                  <div className="text-neutral-500 dark:text-[#888] text-[10px] font-khmer truncate">
                                    {student.khmerName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. Belt Rank Badge */}
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wider uppercase inline-flex items-center gap-1 shadow-xs",
                              student.currentBelt.toLowerCase().includes('poom') || student.currentBelt.toLowerCase().includes('dan') || student.currentBelt.toLowerCase() === 'black'
                                ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700"
                                : student.currentBelt === 'Red'
                                ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                                : student.currentBelt === 'Brown'
                                ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30"
                                : student.currentBelt === 'Blue'
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                : student.currentBelt === 'Green'
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : student.currentBelt === 'Yellow'
                                ? "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40"
                                : "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20"
                            )}>
                              {formatBelt(student.currentBelt, student.dob)}
                            </span>
                          </td>

                          {/* 4. Branch & Class */}
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              <div className="text-neutral-900 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38] shrink-0" />
                                <span className="truncate max-w-[130px]">{state.branches.find(b => b.id === student.homeBranchId)?.name || 'Main Branch'}</span>
                              </div>
                              <div className="text-neutral-500 dark:text-[#888] text-[10px] font-mono truncate max-w-[140px]">
                                {(() => {
                                  const enroll = state.classEnrollments.find(e => e.studentId === student.id);
                                  if (!enroll) return <span className="italic text-neutral-400">Unenrolled</span>;
                                  const cl = state.classSessions.find(c => c.id === enroll.classId);
                                  return cl ? cl.name : 'Enrolled';
                                })()}
                              </div>
                            </div>
                          </td>

                          {/* 5. Contact Details (Phone & Email with click-to-copy) */}
                          <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                            <div className="space-y-1">
                              {student.phone ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyContact(student.phone!, e)}
                                  className="group/btn flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] text-[11px] font-mono transition-colors cursor-pointer"
                                  title="Click to copy phone number"
                                >
                                  <Phone size={11} className="text-neutral-400 group-hover/btn:text-[#EF2F38]" />
                                  <span>{student.phone}</span>
                                  {copiedContact === student.phone ? (
                                    <span className="text-[9px] text-emerald-500 font-bold ml-1">Copied!</span>
                                  ) : (
                                    <Copy size={10} className="opacity-0 group-hover/btn:opacity-100 text-neutral-400" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 italic">No phone</span>
                              )}
                              {student.email ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyContact(student.email!, e)}
                                  className="group/btn flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-[#EF2F38] text-[10px] font-mono transition-colors cursor-pointer max-w-[170px] truncate"
                                  title="Click to copy email address"
                                >
                                  <Envelope size={11} className="text-neutral-400 group-hover/btn:text-[#EF2F38] shrink-0" />
                                  <span className="truncate">{student.email}</span>
                                  {copiedContact === student.email && (
                                    <span className="text-[9px] text-emerald-500 font-bold ml-1 shrink-0">Copied!</span>
                                  )}
                                </button>
                              ) : null}
                            </div>
                          </td>

                          {/* 6. Age / Gender */}
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase",
                                  student.gender === 'Male' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                                  student.gender === 'Female' ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20" :
                                  "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700"
                                )}>
                                  {student.gender ? (student.gender === 'Male' ? 'M' : student.gender === 'Female' ? 'F' : 'O') : '—'}
                                </span>
                                <span className="text-neutral-900 dark:text-white font-mono text-xs font-semibold">
                                  {getStudentAge(student.dob) !== null ? `${getStudentAge(student.dob)} yrs` : '—'}
                                </span>
                              </div>
                              <div className="text-[9px] font-mono text-neutral-500 dark:text-[#888]">
                                {getStudentDivisionLabel(getStudentAge(student.dob))}
                              </div>
                            </div>
                          </td>

                          {/* 7. Status & Billing */}
                          <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1 items-start">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentForStatus(student);
                                  setQuickStatusForm({
                                    studentStatus: student.studentStatus || 'Active',
                                    statusReason: student.statusReason || '',
                                    pauseEndDate: student.pauseEndDate || ''
                                  });
                                }}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border cursor-pointer hover:scale-105 transition-all flex items-center gap-1",
                                  student.studentStatus === 'Active' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                                  student.studentStatus === 'Paused' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" :
                                  student.studentStatus === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700" :
                                  student.studentStatus === 'Suspended' ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" :
                                  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
                                )}
                                title={student.statusReason ? `Note: ${student.statusReason} ${student.pauseEndDate ? `(Until ${student.pauseEndDate})` : ''} - Click to change status` : 'Click to change status'}
                              >
                                {student.studentStatus === 'Paused' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                <span>{student.studentStatus || 'Active'}</span>
                              </button>

                              {(() => {
                                if (student.studentStatus !== 'Active') return null;
                                const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments);
                                if (billing.status === 'Current') return null;
                                return (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider animate-pulse",
                                    billing.status === 'Overdue' 
                                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30" 
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  )} title={billing.status === 'Overdue' ? `Overdue since ${billing.nextRenewalDate}` : `Renewal due on ${billing.nextRenewalDate}`}>
                                    {billing.status}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>

                          {/* 8. Sticky Action Button */}
                          <td className="px-5 py-3.5 text-right sticky right-0 bg-white dark:bg-[#141414] group-hover:bg-neutral-50 dark:group-hover:bg-[#1A1A1A] z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.4)] border-l border-neutral-200 dark:border-[#262626]">
                            <button 
                              type="button"
                              className="text-xs text-white bg-[#EF2F38] hover:bg-[#D9222B] px-3 py-1.5 min-h-[34px] rounded-[6px] transition-colors inline-flex items-center justify-center font-bold uppercase tracking-wider cursor-pointer shadow-xs" 
                              onClick={(e) => { e.stopPropagation(); setSelectedStudentId(student.id); }}
                            >
                              {t('act_details')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Responsive Card Grid / List */}
                <div className="block md:hidden p-2.5 sm:p-3 space-y-2.5">
                  {paginatedStudents.map(student => (
                    <div 
                      key={student.id} 
                      onClick={() => setSelectedStudentId(student.id)}
                      className="bg-white dark:bg-[#141414] hover:bg-neutral-50/80 dark:hover:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[10px] p-3 space-y-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] touch-manipulation"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-[#222] pb-2">
                        <span className="font-mono text-[11px] font-bold text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[5px] border border-red-500/20">{student.id}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForStatus(student);
                              setQuickStatusForm({
                                studentStatus: student.studentStatus || 'Active',
                                statusReason: student.statusReason || '',
                                pauseEndDate: student.pauseEndDate || ''
                              });
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border cursor-pointer flex items-center gap-1 active:scale-95",
                              student.studentStatus === 'Active' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                              student.studentStatus === 'Paused' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" :
                              student.studentStatus === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700" :
                              student.studentStatus === 'Suspended' ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" :
                              "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
                            )}
                          >
                            {student.studentStatus === 'Paused' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            <span>{student.studentStatus || 'Active'}</span>
                          </button>
                          {(() => {
                            if (student.studentStatus !== 'Active') return null;
                            const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments);
                            if (billing.status === 'Current') return null;
                            return (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider animate-pulse",
                                billing.status === 'Overdue' 
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30" 
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              )}>
                                {billing.status}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <SafeImage 
                          src={student.profilePicturePath} 
                          alt={student.englishName} 
                          containerClassName="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0 shadow-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-neutral-900 dark:text-white font-bold text-xs truncate leading-snug">{student.englishName}</h4>
                          {student.khmerName && (
                            <p className="text-neutral-500 dark:text-[#888] text-[11px] font-khmer truncate mt-0.5">{student.khmerName}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={cn("px-2 py-0.5 rounded-full text-[8.5px] font-bold border tracking-wider uppercase inline-block", student.currentBelt.toLowerCase().includes('poom') || student.currentBelt.toLowerCase().includes('dan') || student.currentBelt.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : student.currentBelt === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : student.currentBelt === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : student.currentBelt === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : student.currentBelt === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : student.currentBelt === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
                              {formatBelt(student.currentBelt, student.dob)}
                            </span>
                            <span className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                              {state.branches.find(b => b.id === student.homeBranchId)?.name || 'Main Branch'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Native Mobile Action Footer Bar */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-[#222] flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                          {student.phone ? (
                            <button
                              type="button"
                              onClick={(e) => handleCopyContact(student.phone!, e)}
                              className="flex items-center gap-1 text-[10px] font-mono text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-[6px] border border-neutral-200/60 dark:border-[#262626] active:scale-95 transition-all truncate"
                            >
                              <Phone size={10} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{student.phone}</span>
                              {copiedContact === student.phone && <span className="text-[8px] text-emerald-500 font-bold ml-0.5 shrink-0">Copied!</span>}
                            </button>
                          ) : student.email ? (
                            <button
                              type="button"
                              onClick={(e) => handleCopyContact(student.email!, e)}
                              className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 hover:text-[#EF2F38] bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-[6px] border border-neutral-200/60 dark:border-[#262626] active:scale-95 transition-all truncate max-w-[170px]"
                            >
                              <Envelope size={10} className="shrink-0" />
                              <span className="truncate">{student.email}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-neutral-400 dark:text-[#666]">No contact info</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(student.id)}
                          className="h-7.5 px-3 bg-red-500/10 hover:bg-[#EF2F38] text-[#EF2F38] hover:text-white border border-red-500/25 rounded-[6px] text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
                        >
                          <span>{t('act_details')}</span>
                          <CaretRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination & Summary Bar */}
                <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50/70 dark:bg-[#0F0F0F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-neutral-600 dark:text-[#888]">
                    <span>
                      Showing <span className="font-bold text-neutral-900 dark:text-white">{sortedStudents.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-neutral-900 dark:text-white">{Math.min(safeCurrentPage * pageSize, sortedStudents.length)}</span> of <span className="font-bold text-neutral-900 dark:text-white">{sortedStudents.length}</span> students
                    </span>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200 dark:border-[#262626]">
                      <span className="text-[11px]">Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded px-2 py-1 text-xs font-mono focus:outline-none cursor-pointer"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-[6px] border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] text-neutral-800 dark:text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CaretLeft size={12} weight="bold" />
                      <span>Prev</span>
                    </button>

                    {/* Page indicator pills */}
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1)
                        .map((page, idx, arr) => {
                          const prev = arr[idx - 1];
                          const hasGap = prev && page - prev > 1;
                          return (
                            <React.Fragment key={page}>
                              {hasGap && <span className="px-1 text-neutral-400 font-mono">...</span>}
                              <button
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={cn(
                                  "min-w-[28px] h-7 px-2 rounded-[6px] text-xs font-mono font-bold transition-all cursor-pointer",
                                  safeCurrentPage === page
                                    ? "bg-[#EF2F38] text-white shadow-xs"
                                    : "bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#262626]"
                                )}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1.5 rounded-[6px] border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] text-neutral-800 dark:text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Next</span>
                      <CaretRight size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex-grow overflow-y-auto bg-white dark:bg-[#0A0A0A] p-3.5 sm:p-6 space-y-4 sm:space-y-6 flex flex-col">
          
          {/* Dashboard Sub-Tabs */}
          <div className="flex bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-1 shrink-0 z-20 shadow-inner">
            <button 
              onClick={() => setBeltCenterSubTab('readiness')} 
              className={cn(
                "flex-grow py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-widest rounded-[6px] sm:rounded-[8px] transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer active:scale-95 touch-manipulation", 
                beltCenterSubTab === 'readiness' ? "bg-[#EF2F38] text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <Checks className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">Readiness</span>
              <span className="hidden sm:inline">{t('dir_tab_readiness')}</span>
            </button>
            <button 
              onClick={() => setBeltCenterSubTab('history')} 
              className={cn(
                "flex-grow py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-widest rounded-[6px] sm:rounded-[8px] transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer active:scale-95 touch-manipulation", 
                beltCenterSubTab === 'history' ? "bg-[#EF2F38] text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">History</span>
              <span className="hidden sm:inline">{t('dir_tab_history')}</span>
            </button>
            <button 
              onClick={() => setBeltCenterSubTab('curriculum')} 
              className={cn(
                "flex-grow py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-widest rounded-[6px] sm:rounded-[8px] transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer active:scale-95 touch-manipulation", 
                beltCenterSubTab === 'curriculum' ? "bg-[#EF2F38] text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">Curriculum</span>
              <span className="hidden sm:inline">{t('dir_tab_curriculum')}</span>
            </button>
          </div>

          {/* Academy Rank Progression Pipeline (Global Visual Dashboard) */}
          {beltCenterSubTab !== 'history' && (
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 sm:p-3 shrink-0 space-y-1.5 sm:space-y-2 shadow-sm animate-in slide-in-from-top-1 fade-in">
              <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-2">
                  <h4 className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-black tracking-widest">Rank Pipeline</h4>
                  <p className="text-[8px] text-neutral-400 dark:text-[#666] font-mono hidden xs:block">Filter candidates by clicking capsules</p>
                </div>
                {selectedBeltPipelineFilter && (
                  <button 
                    onClick={() => setSelectedBeltPipelineFilter(null)} 
                    className="text-[8px] text-[#EF2F38] uppercase font-bold tracking-widest hover:underline flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x -mx-2.5 px-2.5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 md:grid-cols-10">
                {BELT_RANK_ORDER.map(belt => {
                  const count = state.students.filter(s => s.currentBelt === belt).length;
                  const readyCount = studentsWithPromoData.filter(c => c.student.currentBelt === belt && c.eligibilityStatus === 'Ready').length;
                  const isSelected = selectedBeltPipelineFilter === belt;
                  
                  const beltColorClass = 
                    belt === 'White' ? 'bg-white border border-neutral-300 dark:border-[#333]' :
                    belt === 'Yellow' ? 'bg-yellow-400' :
                    belt === 'Green' ? 'bg-green-500' :
                    belt === 'Blue' ? 'bg-blue-500' :
                    belt === 'Brown' ? 'bg-amber-800' :
                    belt === 'Red' ? 'bg-red-500' :
                    'bg-neutral-900 border border-neutral-600 dark:border-[#444]'; // Dan/Poom
                    
                  return (
                    <button 
                      key={belt}
                      type="button"
                      onClick={() => setSelectedBeltPipelineFilter(isSelected ? null : belt)}
                      className={cn(
                        "bg-white dark:bg-[#0F0F0F] border px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-[6px] sm:rounded-[8px] flex items-center justify-between transition-all duration-200 group relative overflow-hidden text-xs active:scale-95 touch-manipulation cursor-pointer shrink-0 min-w-[84px] sm:min-w-0 shadow-xs",
                        isSelected 
                          ? "border-[#EF2F38] bg-red-500/10 dark:bg-[#EF2F38]/15 shadow-sm shadow-[#EF2F38]/15 ring-1 ring-[#EF2F38]" 
                          : "border-neutral-200 dark:border-[#262626] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] hover:border-neutral-300 dark:hover:border-neutral-700"
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 shadow-xs", beltColorClass)} />
                        <span className={cn(
                          "text-[8.5px] sm:text-[9px] font-black tracking-wider uppercase truncate",
                          isSelected ? "text-[#EF2F38] dark:text-white" : "text-neutral-700 dark:text-[#999] group-hover:text-black dark:group-hover:text-white"
                        )}>
                          {belt === '1st Poom/Dan' ? '1st Dan' :
                           belt === '2nd Poom/Dan' ? '2nd Dan' :
                           belt === '3rd Poom/Dan' ? '3rd Dan' :
                           belt === '4th Poom/Dan' ? '4th Dan' : belt}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className={cn(
                          "text-[8.5px] sm:text-[9px] font-mono font-black",
                          isSelected ? "text-[#EF2F38]" : "text-neutral-500 dark:text-neutral-400 group-hover:text-[#EF2F38]"
                        )}>
                          {count}
                        </span>
                        {readyCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" title={`${readyCount} candidates ready for test`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Readiness Tab Directory */}
          {beltCenterSubTab === 'readiness' && (
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
                    <p className="text-[8px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                      <span>Test-Ready</span>
                      {filterEligibility === 'Ready' && <span className="text-[7px] px-1 py-0.2 bg-emerald-500 text-white rounded font-mono font-black">ACTIVE</span>}
                    </p>
                    <h4 className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                      {totalReadyCandidates}
                      {totalReadyCandidates > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />}
                    </h4>
                    <p className="text-[8px] text-neutral-400 dark:text-[#666] font-mono truncate hidden sm:block">Eligible for promotion</p>
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
                    <p className="text-[8px] sm:text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                      <span>Developing</span>
                      {filterEligibility === 'Developing' && <span className="text-[7px] px-1 py-0.2 bg-amber-500 text-black rounded font-mono font-black">ACTIVE</span>}
                    </p>
                    <h4 className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                      {totalDevelopingCandidates}
                    </h4>
                    <p className="text-[8px] text-neutral-400 dark:text-[#666] font-mono truncate hidden sm:block">In-progress candidates</p>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 ml-1">
                    <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" weight="bold" />
                  </div>
                </button>

                {/* 3. Average PRI Score across active roster */}
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 sm:p-4 flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1 pr-2">
                    <p className="text-[8px] sm:text-[10px] text-neutral-500 dark:text-[#888] font-bold uppercase tracking-wider truncate">Avg Roster PRI</p>
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
                    <p className="text-[8px] sm:text-[10px] text-neutral-500 dark:text-[#888] font-bold uppercase tracking-wider truncate">Recent Promoted</p>
                    <h4 className="text-base sm:text-2xl font-black text-neutral-900 dark:text-white font-mono">{recentPromotionsCount}</h4>
                    <p className="text-[8px] text-[#EF2F38] font-mono truncate hidden sm:block">View history ledger →</p>
                  </div>
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-[6px] sm:rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-500 shrink-0 ml-1">
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
                    <p className="text-[9px] text-neutral-500 dark:text-[#666] font-mono mt-0.5">
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
                        className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs h-8.5 sm:h-9 focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                      <select 
                        value={filterBranchPromo} 
                        onChange={(e) => setFilterBranchPromo(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 py-1 sm:py-1.5 h-8.5 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
                      >
                        <option value="all">All Branches</option>
                        {state.branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>

                      <select 
                        value={filterEligibility} 
                        onChange={(e) => setFilterEligibility(e.target.value as any)}
                        className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 py-1 sm:py-1.5 h-8.5 sm:h-9 focus:outline-none font-bold cursor-pointer truncate"
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
                        className="w-full sm:w-auto px-3.5 py-1.5 h-8.5 sm:h-9 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 touch-manipulation animate-in fade-in"
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
                            className="accent-[#EF2F38] rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626]"
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
                                isSelected && "bg-red-500/5 dark:bg-[#EF2F38]/5"
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
                                  className="accent-[#EF2F38] rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626] disabled:opacity-30 cursor-pointer"
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
                                    <div className="text-[10px] text-neutral-500 dark:text-[#666] font-mono leading-tight mt-0.5">
                                      {student.id} • {state.branches.find(b => b.id === student.homeBranchId)?.name || 'Branch'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase", student.currentBelt.toLowerCase().includes('poom') || student.currentBelt.toLowerCase().includes('dan') || student.currentBelt.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : student.currentBelt === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : student.currentBelt === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : student.currentBelt === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : student.currentBelt === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : student.currentBelt === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
                                    {student.currentBelt}
                                  </span>
                                  <CaretRight className="w-3 h-3 text-neutral-400 dark:text-[#666]" />
                                  <span className="px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-mono">
                                    {targetBelt}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {/* Time in Grade bar */}
                                <div className="space-y-1 w-28">
                                  <div className="flex justify-between text-[9px] text-neutral-500 dark:text-neutral-400 font-mono leading-none">
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
                                  <div className="flex justify-between text-[9px] text-neutral-500 dark:text-neutral-400 font-mono leading-none">
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
                                  <div className="flex justify-between text-[9px] text-neutral-500 dark:text-neutral-400 font-mono leading-none">
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
                                  "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold border",
                                  pri >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                                  pri >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                                  "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                                )}>
                                  {pri}% PRI
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn(
                                  "inline-block px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
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
                                    className="px-2 py-1 rounded bg-[#EF2F38] hover:bg-[#D9222B] disabled:opacity-40 text-white font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation shadow-xs"
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
                      const { student, daysElapsed, daysRequired, daysProgress, attendanceSince, attendanceRequired, attendanceProgress, syllabusCompletedPct, completedVideos, totalVideos, skillsGradedCount, totalSkillsCount, pri, eligibilityStatus } = candidate;
                      const targetBelt = getNextBeltRank(student.currentBelt);
                      const isSelected = selectedStudentsForPromotion.includes(student.id);

                      return (
                        <div 
                          key={student.id}
                          className={cn(
                            "p-3.5 space-y-3 transition-colors",
                            isSelected ? "bg-red-500/5 dark:bg-[#EF2F38]/5" : "bg-white dark:bg-[#141414]"
                          )}
                        >
                          {/* Card Top Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input 
                                type="checkbox" 
                                disabled={student.studentStatus !== 'Active'}
                                className="accent-[#EF2F38] rounded bg-white dark:bg-[#0F0F0F] border-neutral-300 dark:border-[#262626] w-4 h-4 shrink-0 cursor-pointer"
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
                                <div className="text-[10px] text-neutral-500 dark:text-[#666] font-mono truncate">
                                  {student.id} • {state.branches.find(b => b.id === student.homeBranchId)?.name || 'Branch'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border",
                                pri >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
                                pri >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                                "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                              )}>
                                {pri}% PRI
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
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
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-[#777] uppercase tracking-wider">Advancement</span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white">
                                {student.currentBelt}
                              </span>
                              <CaretRight className="w-3.5 h-3.5 text-neutral-400 dark:text-[#666]" />
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-red-500/10 dark:bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400 font-mono">
                                {targetBelt}
                              </span>
                            </div>
                          </div>

                          {/* 4-Vector Mini Progress Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
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
                              className="flex-1 h-8 sm:h-8.5 bg-[#EF2F38] hover:bg-[#D9222B] disabled:opacity-40 text-white rounded-[6px] text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer shadow-xs"
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
                              className="px-3 h-8 sm:h-8.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#AAA] rounded-[6px] text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer"
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
          )}

          {/* Promotion History tab */}
          {beltCenterSubTab === 'history' && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col flex-1 min-h-[380px] overflow-hidden animate-in fade-in shadow-xs">
              <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">{t('dir_history_title')}</h3>
                  <p className="text-[9px] text-neutral-500 dark:text-[#666] font-mono mt-0.5">
                    {filteredHistory.length} recorded promotions | Kukkiwon & Academy Log
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full xl:w-auto xl:justify-end">
                  <div className="relative w-full sm:w-48 xl:w-56">
                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                    <input 
                      type="text" 
                      placeholder={t('dir_history_search_placeholder')} 
                      value={historySearch} 
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-8 pr-2 h-8 sm:h-9 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0">
                    <select 
                      value={filterBranchHistory} 
                      onChange={(e) => setFilterBranchHistory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-8 sm:h-9 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_branches')}</option>
                      {state.branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>

                    <select 
                      value={filterBeltHistory} 
                      onChange={(e) => setFilterBeltHistory(e.target.value)}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-8 sm:h-9 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_ranks')}</option>
                      {BELT_RANK_ORDER.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    <select 
                      value={filterProgramHistory} 
                      onChange={(e) => setFilterProgramHistory(e.target.value)}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-8 sm:h-9 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_programs')}</option>
                      {Array.from(new Set(state.beltHistories.map(h => h.program || 'Standard Class'))).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleExportHistoryCsv}
                      className="px-2.5 sm:px-3 h-8 sm:h-9 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#DDD] hover:text-neutral-900 dark:hover:text-white rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 touch-manipulation"
                      title="Export History to CSV"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block flex-1 overflow-auto">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-500 dark:text-[#666] uppercase tracking-widest font-bold sticky top-0 z-10 border-b border-neutral-200 dark:border-[#262626]">
                    <tr>
                      <th className="px-4 py-2.5">{t('dir_student_context')}</th>
                      <th className="px-4 py-2.5">{t('dir_target_rank')}</th>
                      <th className="px-4 py-2.5">{t('dir_promotion_date')}</th>
                      <th className="px-4 py-2.5">{t('dir_grade')}</th>
                      <th className="px-4 py-2.5">{t('dir_cert_ref_hash')}</th>
                      <th className="px-4 py-2.5 w-28 text-center">{t('dir_cert_link_label').replace(/\s*\(.*\)/, '')}</th>
                      <th className="px-4 py-2.5 w-20 text-center">{t('lib_bulk_action_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#141414]">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-[#666] font-mono">
                          {t('dir_no_history')}
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map(history => {
                        const student = state.students.find(s => s.id === history.studentId);
                        return (
                          <tr key={history.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]">
                            <td className="px-4 py-2.5">
                              <button 
                                type="button"
                                onClick={() => { if (student) setSelectedStudentId(student.id); }}
                                className="flex items-center gap-2.5 text-left group/st cursor-pointer"
                              >
                                {student && (
                                  <SafeImage 
                                    src={student.profilePicturePath} 
                                    alt={student.englishName} 
                                    containerClassName="w-7 h-7 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                                  />
                                )}
                                <div>
                                  <div className="font-bold text-xs text-neutral-900 dark:text-white group-hover/st:text-[#EF2F38] transition-colors">
                                    {student ? student.englishName : history.studentId}
                                  </div>
                                  <div className="text-[10px] text-neutral-500 dark:text-[#666] font-mono">
                                    {history.studentId} {student?.homeBranchId && `• ${state.branches.find(b => b.id === student.homeBranchId)?.name}`}
                                  </div>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase", history.beltLevel.toLowerCase().includes('poom') || history.beltLevel.toLowerCase().includes('dan') || history.beltLevel.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : history.beltLevel === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : history.beltLevel === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : history.beltLevel === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : history.beltLevel === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : history.beltLevel === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
                                {history.beltLevel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-neutral-600 dark:text-[#999]">{history.promotionDate}</td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-200">
                              {t('dir_test_score').replace(/\s*\(.*\)/, '')}: <span className="font-bold text-amber-600 dark:text-amber-400">{history.testScore || 80}</span> • {history.program || 'Standard'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-neutral-500 dark:text-[#888] tracking-wider">
                              {history.certificateRef || 'N/A'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {history.kukkiwonDanCardId && (history.kukkiwonDanCardId.startsWith('http') || history.kukkiwonDanCardId.includes('drive.google.com')) ? (
                                  <>
                                    <a 
                                      href={history.kukkiwonDanCardId} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/25 hover:border-transparent text-emerald-700 dark:text-emerald-400 hover:text-white rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 active:scale-95 touch-manipulation cursor-pointer"
                                      title="Open Uploaded Infinity TKD Certificate"
                                    >
                                      <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                                      View
                                    </a>
                                    <button 
                                      onClick={() => handleCopyLink(history.id, history.kukkiwonDanCardId!)}
                                      className={cn(
                                        "p-1.5 rounded transition-all flex items-center justify-center border cursor-pointer active:scale-95 touch-manipulation",
                                        copiedHistoryId === history.id 
                                          ? "bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400" 
                                          : "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 dark:bg-[#1C1C1C] dark:border-[#262626] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white"
                                      )}
                                      title="Copy Share Link to Clipboard"
                                    >
                                      {copiedHistoryId === history.id ? (
                                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </>
                                ) : history.kukkiwonDanCardId ? (
                                  <span className="font-mono text-[9px] text-neutral-700 dark:text-[#999] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] px-1.5 py-0.5 rounded" title="Kukkiwon ID / Custom Card ID">
                                    ID: {history.kukkiwonDanCardId}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHistory(history)}
                                    className="text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                  >
                                    + Add Link
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleOpenEditHistory(history)}
                                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  title="Edit Promotion Log"
                                >
                                  <PencilSimple className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  disabled={isDeletingHistory === history.id}
                                  onClick={() => handleVoidPromotion(history.id)}
                                  className="p-1 rounded hover:bg-red-500/10 text-neutral-400 hover:text-red-600 dark:text-[#666] dark:hover:text-red-500 disabled:opacity-30 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  title="Void Promotion"
                                >
                                  <Trash className="w-3.5 h-3.5" />
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

              {/* Mobile Native History Cards */}
              <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626] overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="py-10 text-center text-neutral-500 dark:text-[#666] font-mono text-xs">
                    {t('dir_no_history')}
                  </div>
                ) : (
                  filteredHistory.map(history => {
                    const student = state.students.find(s => s.id === history.studentId);
                    return (
                      <div key={history.id} className="p-3.5 space-y-2.5 bg-white dark:bg-[#141414]">
                        <div className="flex items-center justify-between">
                          <button 
                            type="button"
                            onClick={() => { if (student) setSelectedStudentId(student.id); }}
                            className="font-bold text-xs text-neutral-900 dark:text-white hover:text-[#EF2F38] text-left transition-colors cursor-pointer"
                          >
                            {student ? student.englishName : history.studentId}
                            <span className="text-[10px] text-neutral-500 font-mono font-normal ml-1">({history.studentId})</span>
                          </button>
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white">
                            {history.beltLevel}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-600 dark:text-[#999] bg-neutral-50 dark:bg-[#0D0D0D] p-2 rounded border border-neutral-200/60 dark:border-[#202020]">
                          <div>Date: <span className="font-bold text-neutral-900 dark:text-white">{history.promotionDate}</span></div>
                          <div>Score: <span className="font-bold text-amber-600 dark:text-amber-400">{history.testScore || 80}</span></div>
                          <div className="truncate">Prog: {history.program || 'Standard'}</div>
                          <div className="truncate font-mono">Ref: {history.certificateRef || 'N/A'}</div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            {history.kukkiwonDanCardId && (history.kukkiwonDanCardId.startsWith('http') || history.kukkiwonDanCardId.includes('drive.google.com')) ? (
                              <div className="flex items-center gap-1.5">
                                <a 
                                  href={history.kukkiwonDanCardId}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/25 hover:border-transparent text-emerald-700 dark:text-emerald-400 hover:text-white rounded text-[9px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1"
                                >
                                  <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>View Cert</span>
                                </a>
                                <button 
                                  onClick={() => handleCopyLink(history.id, history.kukkiwonDanCardId!)}
                                  className="p-1 rounded bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400"
                                >
                                  {copiedHistoryId === history.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : history.kukkiwonDanCardId ? (
                              <span className="text-[9px] font-mono text-neutral-600 dark:text-neutral-400">ID: {history.kukkiwonDanCardId}</span>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => handleOpenEditHistory(history)}
                                className="text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                + Add Cert Link
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => handleOpenEditHistory(history)}
                              className="p-1.5 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#242424] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                              title="Edit Log"
                            >
                              <PencilSimple className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button"
                              disabled={isDeletingHistory === history.id}
                              onClick={() => handleVoidPromotion(history.id)}
                              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors cursor-pointer disabled:opacity-30"
                              title="Void Promotion"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Curriculum requirements audit tab */}
          {beltCenterSubTab === 'curriculum' && (() => {
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
                              "px-2 py-0.5 rounded text-[8px] uppercase tracking-wider shrink-0 border",
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
                            <span className="text-[8px] text-neutral-500 dark:text-[#888] uppercase block font-semibold">{t('dir_current_rank')}</span>
                            <span className="text-[10px] text-neutral-900 dark:text-white uppercase tracking-widest font-black">{activeStudentObj.currentBelt}</span>
                          </div>
                          <CaretRight className="w-4 h-4 text-neutral-400 dark:text-[#666]" />
                          <div className="text-center space-y-0.5">
                            <span className="text-[8px] text-[#EF2F38] uppercase block font-black">{t('dir_target_rank')}</span>
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
                              ? `All time, attendance, syllabus, and technique requirements satisfied for ${targetBelt} Belt Exam.`
                              : auditData.eligibilityStatus === 'Developing'
                              ? `Candidate is progressing well towards ${targetBelt}. Continue training on incomplete requirements.`
                              : `Candidate has not yet completed prerequisite attendance or time-in-grade cycles.`}
                          </p>
                        </div>

                        {auditData.eligibilityStatus === 'Ready' && activeStudentObj.studentStatus === 'Active' && (
                          <button
                            type="button"
                            onClick={() => handleOpenSinglePromote(activeStudentObj.id)}
                            className="w-full sm:w-auto px-4 h-8 sm:h-9 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[6px] text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer shrink-0"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Promote Now</span>
                          </button>
                        )}
                      </div>

                      {/* Multi-Vector Requirements Overview Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Requirement 1: Time in Grade */}
                        <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-[#AAA] tracking-wider">Time in Grade</span>
                            <span className={cn(
                              "text-[8px] font-black px-1.5 py-0.2 rounded uppercase border",
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
                              "text-[8px] font-black px-1.5 py-0.2 rounded uppercase border",
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
                              "text-[8px] font-black px-1.5 py-0.2 rounded uppercase border",
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
                              "text-[8px] font-black px-1.5 py-0.2 rounded uppercase border",
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
                            .filter(v => isBeltMatch(v.minBeltLevel, activeStudentObj.currentBelt) && v.minBeltLevel !== 'Fitness')
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
                                    "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border shrink-0",
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
          })()}
        </div>
      )}

      {/* Slide-out Panels & Modals */}
      <AnimatePresence>
        {selectedStudentId && (
          <ManageStudentPanel studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />
        )}
        {isAdding && (
          <AddStudentModal onClose={() => setIsAdding(false)} />
        )}
        {isBulkImporting && (
          <BulkImportStudentModal onClose={() => setIsBulkImporting(false)} />
        )}
        
        {/* Bulk Promotion Modal */}
        {showPromotionModal && (
          <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white max-h-[90dvh]"
              >
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#EF2F38]" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_bulk_promotion_title')}</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPromotionModal(false)}
                    className="px-3 py-1.5 min-h-[40px] text-xs font-bold rounded-[8px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                </div>

                <div className="p-6 space-y-4 bg-white dark:bg-[#0A0A0A] overflow-y-auto flex-1">
                  <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed">
                    {t('dir_bulk_promotion_desc').split('{count}')[0]}
                    <span className="font-mono text-neutral-900 dark:text-white font-bold bg-neutral-100 dark:bg-[#141414] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#262626]">{selectedStudentsForPromotion.length}</span>
                    {t('dir_bulk_promotion_desc').split('{count}')[1]}
                  </p>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_mode')}</label>
                    <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-[#141414] p-1 border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                      <button 
                        type="button"
                        onClick={() => setPromotionForm(prev => ({ ...prev, targetBeltMode: 'next' }))}
                        className={cn(
                          "py-1.5 rounded text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation",
                          promotionForm.targetBeltMode === 'next' 
                            ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm font-extrabold" 
                            : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                        )}
                      >
                        {t('dir_next_rank_dynamic')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPromotionForm(prev => ({ ...prev, targetBeltMode: 'fixed' }))}
                        className={cn(
                          "py-1.5 rounded text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation",
                          promotionForm.targetBeltMode === 'fixed' 
                            ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm font-extrabold" 
                            : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                        )}
                      >
                        {t('dir_fixed_rank')}
                      </button>
                    </div>
                  </div>

                  {promotionForm.targetBeltMode === 'fixed' && (
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_target_belt')}</label>
                      <select 
                        value={promotionForm.fixedTargetBelt}
                        onChange={(e) => setPromotionForm(prev => ({ ...prev, fixedTargetBelt: e.target.value }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                      >
                        {BELT_RANK_ORDER.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_test_score')}</label>
                      <input 
                        type="number"
                        min="1"
                        max="100"
                        value={promotionForm.testScore}
                        onChange={(e) => setPromotionForm(prev => ({ ...prev, testScore: Number(e.target.value) }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_date')}</label>
                      <input 
                        type="date"
                        value={promotionForm.promotionDate}
                        onChange={(e) => setPromotionForm(prev => ({ ...prev, promotionDate: e.target.value }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_curriculum_program')}</label>
                    <input 
                      type="text"
                      value={promotionForm.program}
                      onChange={(e) => setPromotionForm(prev => ({ ...prev, program: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_url_label')}</label>
                    <input 
                      type="url"
                      placeholder="e.g. https://drive.google.com/file/d/..."
                      value={promotionForm.certificateUrl || ''}
                      onChange={(e) => setPromotionForm(prev => ({ ...prev, certificateUrl: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={() => setShowPromotionModal(false)}
                    className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1A1A1A] text-neutral-700 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {t('act_cancel')}
                  </button>
                  <button 
                    onClick={handleBulkPromoteSubmit}
                    className="px-5 py-2 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-[#EF2F38]/20 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {t('dir_confirm_promotion')}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {reconcileResult && (
          <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white max-h-[90dvh]"
              >
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_diagnostics_title')}</h3>
                  </div>
                  <button 
                    onClick={() => setReconcileResult(null)} 
                    className="text-neutral-500 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white text-xs uppercase font-bold tracking-wider cursor-pointer"
                  >
                    {t('act_close')}
                  </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-white dark:bg-[#0A0A0A]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 rounded-[8px] text-center shadow-sm">
                      <p className="text-[9px] text-neutral-500 dark:text-[#666] uppercase font-bold tracking-wider">{t('dir_scanned')}</p>
                      <p className="text-2xl font-black text-neutral-900 dark:text-white font-mono mt-1">{reconcileResult.scanned}</p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 rounded-[8px] text-center shadow-sm">
                      <p className="text-[9px] text-neutral-500 dark:text-[#666] uppercase font-bold tracking-wider">{t('dir_corrected')}</p>
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-500 font-mono mt-1">{reconcileResult.corrected}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-black tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2">{t('dir_audit_logs')}</h4>
                    {reconcileResult.details.length === 0 ? (
                      <div className="p-4 rounded-[8px] bg-green-500/10 border border-green-500/20 text-center text-xs text-green-700 dark:text-green-400 font-bold uppercase tracking-widest">
                        {t('dir_diagnostics_success')}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                        {reconcileResult.details.map((log, i) => (
                          <div key={i} className="p-3 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex items-center justify-between gap-4 shadow-sm">
                            <span className="text-neutral-900 dark:text-white text-[11px] font-medium leading-relaxed">{log}</span>
                            <span className="shrink-0 text-[8px] font-black tracking-widest text-amber-700 dark:text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-bold">{t('dir_healed')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end shrink-0">
                  <button 
                    onClick={() => setReconcileResult(null)} 
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-[#262626] dark:hover:bg-[#333] rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors shadow-md shadow-black/20 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {t('dir_diagnostics_close')}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {/* System-generated Certificate Preview Modal removed as requested. Manual certificates are viewed via external Drive links. */}

        {/* Edit Promotion Log Modal */}
        {editingHistory && (
          <Portal>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white max-h-[90dvh] animate-in zoom-in-95 duration-150"
              >
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_edit_log_title')}</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEditingHistory(null)}
                    className="px-3 py-1.5 min-h-[40px] text-xs font-bold rounded-[8px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                </div>

                <div className="p-6 space-y-4 bg-white dark:bg-[#0A0A0A] overflow-y-auto max-h-[70dvh]">
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] tracking-wider mb-1">{t('dir_student_context')}</span>
                    <div className="bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-700 dark:text-[#999] font-bold">
                      {state.students.find(s => s.id === editingHistory.studentId)?.englishName || editingHistory.studentId} ({editingHistory.studentId})
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_target_belt')}</label>
                      <select 
                        value={editHistoryForm.beltLevel}
                        onChange={(e) => setEditHistoryForm(prev => ({ ...prev, beltLevel: e.target.value }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                      >
                        {BELT_RANK_ORDER.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_date')}</label>
                      <input 
                        type="date"
                        value={editHistoryForm.promotionDate}
                        onChange={(e) => setEditHistoryForm(prev => ({ ...prev, promotionDate: e.target.value }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_test_score')}</label>
                      <input 
                        type="number"
                        min="1"
                        max="100"
                        value={editHistoryForm.testScore}
                        onChange={(e) => setEditHistoryForm(prev => ({ ...prev, testScore: Number(e.target.value) }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_curriculum_program')}</label>
                      <input 
                        type="text"
                        value={editHistoryForm.program}
                        onChange={(e) => setEditHistoryForm(prev => ({ ...prev, program: e.target.value }))}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_ref_hash')}</label>
                    <input 
                      type="text"
                      value={editHistoryForm.certificateRef}
                      onChange={(e) => setEditHistoryForm(prev => ({ ...prev, certificateRef: e.target.value.toUpperCase() }))}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono uppercase"
                      placeholder="e.g. INF-YYYYMMDD-ID-RAND"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_link_label')}</label>
                    <input 
                      type="text"
                      value={editHistoryForm.kukkiwonDanCardId}
                      onChange={(e) => setEditHistoryForm(prev => ({ ...prev, kukkiwonDanCardId: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                      placeholder="e.g. https://drive.google.com/file/... or DAN-XXXX"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2">
                  <button 
                    onClick={() => setEditingHistory(null)}
                    className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1A1A1A] text-neutral-700 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {t('act_cancel')}
                  </button>
                  <button 
                    onClick={handleSaveEditHistorySubmit}
                    disabled={isSavingEdit}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-55 text-black font-extrabold rounded-[8px] text-xs uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {isSavingEdit ? t('act_saving') : t('act_save_changes')}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
      {/* Quick Status Management Modal */}
      {selectedStudentForStatus && (
        <Portal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 max-w-md w-full shadow-2xl space-y-4 text-neutral-900 dark:text-white animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">Manage Membership Status</h3>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">{selectedStudentForStatus.englishName} ({selectedStudentForStatus.id})</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedStudentForStatus(null)} 
                  aria-label="Close status modal"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors text-sm font-bold cursor-pointer active:scale-95 touch-manipulation"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1.5">Select New Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Active', 'Paused', 'Inactive', 'Suspended', 'Graduated'] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setQuickStatusForm({ ...quickStatusForm, studentStatus: st })}
                        className={cn(
                          "px-3 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider border text-center transition-all cursor-pointer select-none",
                          quickStatusForm.studentStatus === st
                            ? st === 'Active' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500 font-black"
                              : st === 'Paused' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500 font-black"
                              : st === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-400 dark:border-neutral-600 font-black"
                              : st === 'Suspended' ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500 font-black"
                              : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500 font-black"
                            : "bg-neutral-100 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#1A1A1A]"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {(quickStatusForm.studentStatus === 'Paused' || quickStatusForm.studentStatus === 'Inactive' || quickStatusForm.studentStatus === 'Suspended') && (
                  <div className="space-y-3 bg-neutral-50 dark:bg-[#0F0F0F] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626] animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1">Status Reason / Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Medical leave (knee injury), School exam break, Moving away"
                        value={quickStatusForm.statusReason}
                        onChange={e => setQuickStatusForm({ ...quickStatusForm, statusReason: e.target.value })}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-3 py-2 text-xs focus:outline-none focus:border-[#EF2F38]"
                      />
                    </div>

                    {quickStatusForm.studentStatus === 'Paused' && (
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1">Expected Return Date</label>
                        <input
                          type="date"
                          value={quickStatusForm.pauseEndDate}
                          onChange={e => setQuickStatusForm({ ...quickStatusForm, pauseEndDate: e.target.value })}
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-3 py-2 text-xs focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-[#262626] pt-3">
                <button 
                  type="button"
                  onClick={() => setSelectedStudentForStatus(null)} 
                  className="px-4 py-2 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] text-xs font-bold text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#262626] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingStatus}
                  onClick={async () => {
                    setIsSavingStatus(true);
                    try {
                      await updateStudent(selectedStudentForStatus.id, {
                        studentStatus: quickStatusForm.studentStatus,
                        statusReason: quickStatusForm.statusReason,
                        pauseEndDate: quickStatusForm.pauseEndDate
                      });
                      showNotification(`Updated status for ${selectedStudentForStatus.englishName} to ${quickStatusForm.studentStatus}`, 'success');
                      setSelectedStudentForStatus(null);
                    } catch (e: any) {
                      showNotification(`Failed to update status: ${e.message}`, 'error');
                    } finally {
                      setIsSavingStatus(false);
                    }
                  }}
                  className="px-4 py-2 rounded-[8px] bg-[#EF2F38] text-xs font-bold text-white uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-[#EF2F38]/20"
                >
                  {isSavingStatus ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Household Management Modal */}
      <HouseholdManagementModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
      />
    </div>
  );
}

