'use client';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { copyText } from '@/lib/clipboard';
import dynamic from 'next/dynamic';

import { dialogMotion } from '@/lib/motion';
import { academyDate, isCalendarDate } from '@/lib/dates';
import { membershipDueText } from '@/lib/billing';
import { beltRank, nextBeltName } from '@/lib/belts';
import { useBeltOrder } from '@/hooks/use-belt-order';

import React, { useState } from 'react';
import { useAppStore, BeltHistory, Student, getMembershipBillingStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { HouseholdManagementModal } from './HouseholdManagementModal';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Checks } from '@phosphor-icons/react/dist/csr/Checks';







import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';


import { Copy } from '@phosphor-icons/react/dist/csr/Copy';

import { House } from '@phosphor-icons/react/dist/csr/House';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Envelope } from '@phosphor-icons/react/dist/csr/Envelope';
import { Funnel } from '@phosphor-icons/react/dist/csr/Funnel';
import { X } from '@phosphor-icons/react/dist/csr/X';



import { cn, formatBelt, calculatePromotionReadiness } from '@/lib/utils';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { PageHeader } from './ui/PageHeader';
import { useBeltEligibility } from '@/components/belt-tests/use-belt-eligibility';
import { mergeBeltEligibility } from '@/lib/belt-eligibility';


import { ManageStudentPanel } from './ManageStudentPanel';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { Portal } from './Portal';
import { StudentQuickStatusDialog } from '@/components/students/StudentQuickStatusDialog';
import { EditPromotionDialog } from '@/components/students/EditPromotionDialog';
import { BulkPromotionDialog } from '@/components/students/BulkPromotionDialog';

// Opened rarely: loaded on demand to keep this view's bundle small.
const AddStudentModal = dynamic(() => import('./AddStudentModal').then(module => module.AddStudentModal), { ssr: false });
const BulkImportStudentModal = dynamic(() => import('./BulkImportStudentModal').then(module => module.BulkImportStudentModal), { ssr: false });

const PromotionReadinessPanel = dynamic(() => import('@/components/students/PromotionReadinessPanel').then(module => module.PromotionReadinessPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const PromotionHistoryPanel = dynamic(() => import('@/components/students/PromotionHistoryPanel').then(module => module.PromotionHistoryPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const CurriculumAuditTab = dynamic(() => import('@/components/students/CurriculumAuditTab').then(module => module.CurriculumAuditTab), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

/** Whole years of age on an academy calendar date, read from a YYYY-MM-DD birth date (no device time zone). */
function ageOnDate(dob: string | undefined, today: string): number | null {
  const birth = dob?.slice(0, 10) ?? '';
  if (!isCalendarDate(birth)) return null;
  const [birthYear, birthMonth, birthDay] = birth.split('-').map(Number);
  const [year, month, day] = today.split('-').map(Number);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

/** The age division shown on each row; the division filter uses the same answer. */
function ageDivision(age: number | null): string {
  if (age === null) return 'N/A';
  if (age < 6) return 'Under 6';
  if (age <= 11) return 'Kid';
  if (age <= 14) return 'Cadet';
  if (age <= 17) return 'Junior';
  return 'Senior';
}

export function DirectoryView() {
  const { state, updateStudent, reconcileAllStudentBelts, addBeltHistory, updateBeltHistory, deleteBeltHistory, upsertPhysicalEvaluation, showNotification, showConfirm, can } = useAppStore();
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
    promotionDate: academyDate(),
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
  const [, setStateRevision] = useState(0);

  const handleCopyLink = async (historyId: number, url: string) => {
    if (!(await copyText(url))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
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
      await updateBeltHistory(editingHistory.id, {
        beltLevel: editHistoryForm.beltLevel,
        promotionDate: editHistoryForm.promotionDate,
        testScore: Number(editHistoryForm.testScore),
        program: editHistoryForm.program.trim(),
        certificateRef: editHistoryForm.certificateRef.trim(),
        kukkiwonDanCardId: editHistoryForm.kukkiwonDanCardId.trim(),
      });

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

  const canManageStudents = canCreateStudent || canEditStudent;


  // --- Promotion Helper Rules & Calculations ---
  // Ranks come from the belts table (built-in order until it loads).
  const BELT_RANK_ORDER = useBeltOrder();
  const getNextBeltRank = (currentBelt: string) => nextBeltName(currentBelt, BELT_RANK_ORDER);

  // Ready to test = the Belt Tests eligibility engine wherever a syllabus is published (the same answer the student portal shows).
  const beltEligibility = useBeltEligibility();
  const beltEntries = beltEligibility.entries;
  const getStudentPromotionData = React.useCallback((student: Student) => {
    return mergeBeltEligibility(calculatePromotionReadiness(
      student,
      state.attendanceRecords,
      state.videoProgress,
      state.curriculumVideos,
      state.beltHistories,
      state.physicalEvaluations,
      state.beltTechniques
    ), beltEntries[student.id]);
  }, [state.attendanceRecords, state.videoProgress, state.curriculumVideos, state.beltHistories, state.physicalEvaluations, state.beltTechniques, beltEntries]);

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
          const history=state.beltHistories.find(h=>h.id===historyId);
          if(!history)throw new Error('Promotion record not found. Refresh the directory.');
          await deleteBeltHistory(historyId,history.studentId);
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
      const promotionDate = promotionForm.promotionDate || academyDate();
      const cleanDate = promotionDate.replace(/-/g, '');
      const cleanId = student.id.replace(/[^a-zA-Z0-9]/g, '');
      const rand = crypto.randomUUID().replace(/-/g,'');
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

  const today = academyDate();
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

    const matchesDivision = filterDivision === 'all' || ageDivision(ageOnDate(s.dob, today)) === filterDivision;

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
      comparison = beltRank(a.currentBelt, BELT_RANK_ORDER) - beltRank(b.currentBelt, BELT_RANK_ORDER);
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

  const handleCopyContact = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await copyText(text))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopiedContact(text);
    setTimeout(() => setCopiedContact(null), 1800);
  };

  const getStudentAge = (dob?: string) => ageOnDate(dob, today);
  const getStudentDivisionLabel = ageDivision;

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
    link.setAttribute('download', `infinitytkd-students-${academyDate()}.csv`);
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
  }, [state.students, getStudentPromotionData]);





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
    link.setAttribute('download', `infinitytkd-promotion-history-${academyDate()}.csv`);
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
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-12 sm:space-y-5">
    <PageHeader
      icon={<UsersThree weight="bold" />}
      eyebrow="Academy roster"
      meta={`${state.students.length} students`}
      title="Student Directory"
      description="Search and manage student profiles, households, enrollment status and belt promotions."
    />
    <div className="bg-white dark:bg-[#141414] rounded-[8px] flex flex-col min-h-[60dvh] shadow-sm border border-neutral-200 dark:border-[#262626] relative overflow-hidden">

      {/* Top Navigation Tabs */}
      <div className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex px-3 sm:px-4 gap-3 sm:gap-6 shrink-0 z-20 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveViewTab('roster')}
          className={cn(
            "py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0",
            activeViewTab === 'roster' ? "border-brand text-neutral-900 dark:text-white font-black" : "border-transparent text-neutral-500 dark:text-[#666] hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          Student Roster
        </button>
        <button
          onClick={() => setActiveViewTab('beltCenter')}
          className={cn(
            "py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
            activeViewTab === 'beltCenter' ? "border-brand text-neutral-900 dark:text-white font-black" : "border-transparent text-neutral-500 dark:text-[#666] hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full bg-brand inline-block", activeViewTab !== 'beltCenter' && "animate-pulse")}></span>
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
                  className="w-full pl-9 pr-8 py-2 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs h-10 pointer-coarse:h-11 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-sans"
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
                    className="h-9 pointer-coarse:h-11 px-2.5 sm:px-3.5 bg-brand hover:bg-brand-strong active:scale-95 touch-manipulation text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider shadow-sm shadow-brand/20 whitespace-nowrap flex items-center justify-center gap-1 shrink-0 cursor-pointer"
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
                    "h-9 pointer-coarse:h-11 px-2.5 sm:px-3 rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation border",
                    showFilters
                      ? "bg-brand text-white border-brand"
                      : "bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white"
                  )}
                >
                  <Funnel size={12} weight={showFilters ? "fill" : "bold"} />
                  <span>{t('act_filters')}</span>
                  {(filterBranch !== 'all' || filterClass !== 'all' || filterBelt !== 'all' || filterGender !== 'all' || filterScholarship !== 'all' || filterDivision !== 'all') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="h-9 pointer-coarse:h-11 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation"
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
                      className="h-9 pointer-coarse:h-11 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-brand-ink rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95 touch-manipulation"
                    >
                      <House size={12} weight="bold" />
                      <span>Household</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBulkImporting(true)}
                      className="h-9 pointer-coarse:h-11 px-2.5 sm:px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer shrink-0 active:scale-95 touch-manipulation"
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
                      className="h-9 pointer-coarse:h-11 px-2.5 sm:px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-500 rounded-[7px] sm:rounded-[8px] text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0 active:scale-95 touch-manipulation"
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
                  aria-pressed={filterStatus === pill.id}
                  onClick={() => {
                    setFilterStatus(pill.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "min-h-8 pointer-coarse:min-h-9 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-[6px] sm:rounded-[8px] text-[9.5px] sm:text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer select-none shrink-0 active:scale-95 touch-manipulation",
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
                    <Funnel size={13} weight="bold" className="text-brand-ink" />
                    <span>Filter Directory</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[10px] text-brand-ink hover:underline font-bold uppercase tracking-wider cursor-pointer active:scale-95"
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
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand font-mono cursor-pointer truncate"
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
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand font-mono cursor-pointer truncate"
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
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_belts')}</option>
                    {BELT_RANK_ORDER.map(belt => <option key={belt} value={belt}>{belt}</option>)}
                  </select>
                  <select value={filterGender} onChange={(e) => {
                    setFilterGender(e.target.value);
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand cursor-pointer truncate"
                  >
                    <option value="all">{t('dir_all_genders')}</option>
                    <option value="Male">{t('stu_male')}</option>
                    <option value="Female">{t('stu_female')}</option>
                  </select>
                  <select value={filterScholarship} onChange={(e) => {
                    setFilterScholarship(Number(e.target.value === 'all' ? 'all' : e.target.value));
                    setCurrentPage(1);
                  }}
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand cursor-pointer truncate"
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
                    className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none focus:border-brand cursor-pointer truncate"
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
                    className="bg-white dark:bg-[#141414] text-red-600 dark:text-red-400 border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none font-bold cursor-pointer truncate"
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
                    className="bg-white dark:bg-[#141414] text-amber-600 dark:text-amber-500 border border-amber-500/30 rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 h-9 pointer-coarse:h-11 focus:outline-none font-bold cursor-pointer truncate"
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
                              <span className="text-[10px] text-brand-ink font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-1.5">
                            <span>{t('stu_english_name')} / {t('stu_khmer_name')}</span>
                            {(sortBy === 'name' || sortBy === 'khmerName') && (
                              <span className="text-[10px] text-brand-ink font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={() => handleSort('belt')}>
                          <div className="flex items-center gap-1.5">
                            <span>{t('stu_belt')}</span>
                            {sortBy === 'belt' && (
                              <span className="text-[10px] text-brand-ink font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
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
                          <td className="px-5 py-3.5 font-mono font-bold text-brand-ink tracking-tight">
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
                                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
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
                                  className="group/btn flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 hover:text-brand-ink text-[11px] font-mono transition-colors cursor-pointer"
                                  title="Click to copy phone number"
                                >
                                  <Phone size={11} className="text-neutral-400 group-hover/btn:text-brand-ink" />
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
                                  className="group/btn flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-brand-ink text-[10px] font-mono transition-colors cursor-pointer max-w-[170px] truncate"
                                  title="Click to copy email address"
                                >
                                  <Envelope size={11} className="text-neutral-400 group-hover/btn:text-brand-ink shrink-0" />
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
                                aria-label={`${student.studentStatus || 'Active'}: change status`}
                                className={cn(
                                  "min-h-6 pointer-coarse:min-h-8 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border cursor-pointer hover:scale-105 transition-all flex items-center gap-1",
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
                                const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments, state.academyProfile);
                                if (billing.status === 'Current') return null;
                                return (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse",
                                    billing.status === 'Overdue'
                                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  )} title={`${membershipDueText(billing)} · due ${billing.nextRenewalDate}`}>
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
                              className="text-xs text-white bg-brand hover:bg-brand-strong px-3 py-1.5 min-h-[34px] rounded-[6px] transition-colors inline-flex items-center justify-center font-bold uppercase tracking-wider cursor-pointer shadow-xs pointer-coarse:min-h-11"
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
                        <span className="font-mono text-[11px] font-bold text-brand-ink bg-red-500/10 px-2 py-0.5 rounded-[5px] border border-red-500/20">{student.id}</span>
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
                            aria-label={`${student.studentStatus || 'Active'}: change status`}
                            className={cn(
                              "min-h-6 pointer-coarse:min-h-8 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border cursor-pointer flex items-center gap-1 active:scale-95",
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
                            const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments, state.academyProfile);
                            if (billing.status === 'Current') return null;
                            return (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse",
                                billing.status === 'Overdue'
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              )} title={`${membershipDueText(billing)} · due ${billing.nextRenewalDate}`}>
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
                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border tracking-wider uppercase inline-block", student.currentBelt.toLowerCase().includes('poom') || student.currentBelt.toLowerCase().includes('dan') || student.currentBelt.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : student.currentBelt === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : student.currentBelt === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : student.currentBelt === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : student.currentBelt === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : student.currentBelt === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
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
                              className="flex items-center gap-1 text-[10px] font-mono text-neutral-700 dark:text-neutral-300 hover:text-brand-ink bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-[6px] border border-neutral-200/60 dark:border-[#262626] active:scale-95 transition-all truncate"
                            >
                              <Phone size={10} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{student.phone}</span>
                              {copiedContact === student.phone && <span className="text-[9px] text-emerald-500 font-bold ml-0.5 shrink-0">Copied!</span>}
                            </button>
                          ) : student.email ? (
                            <button
                              type="button"
                              onClick={(e) => handleCopyContact(student.email!, e)}
                              className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 hover:text-brand-ink bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-[6px] border border-neutral-200/60 dark:border-[#262626] active:scale-95 transition-all truncate max-w-[170px]"
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
                          className="h-7.5 px-3 bg-red-500/10 hover:bg-brand text-brand-ink hover:text-white border border-red-500/25 rounded-[6px] text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
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
                        className="min-h-8 pointer-coarse:min-h-9 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded px-2 py-1 text-xs font-mono focus:outline-none cursor-pointer"
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
                                  "min-w-[28px] h-7 px-2 rounded-[6px] text-xs font-mono font-bold transition-all cursor-pointer pointer-coarse:min-w-11",
                                  safeCurrentPage === page
                                    ? "bg-brand text-white shadow-xs"
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
                beltCenterSubTab === 'readiness' ? "bg-brand text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
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
                beltCenterSubTab === 'history' ? "bg-brand text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
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
                beltCenterSubTab === 'curriculum' ? "bg-brand text-white shadow-md font-black" : "text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
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
                  <p className="text-[9px] text-neutral-400 dark:text-[#666] font-mono hidden xs:block">Filter candidates by clicking capsules</p>
                </div>
                {selectedBeltPipelineFilter && (
                  <button
                    onClick={() => setSelectedBeltPipelineFilter(null)}
                    className="text-[9px] text-brand-ink uppercase font-bold tracking-widest hover:underline flex items-center gap-1 cursor-pointer active:scale-95"
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
                          ? "border-brand bg-red-500/10 dark:bg-brand/15 shadow-sm shadow-brand/15 ring-1 ring-brand"
                          : "border-neutral-200 dark:border-[#262626] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] hover:border-neutral-300 dark:hover:border-neutral-700"
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 shadow-xs", beltColorClass)} />
                        <span className={cn(
                          "text-[9px] font-black tracking-wider uppercase truncate",
                          isSelected ? "text-brand-ink dark:text-white" : "text-neutral-700 dark:text-[#999] group-hover:text-black dark:group-hover:text-white"
                        )}>
                          {belt === '1st Poom/Dan' ? '1st Dan' :
                           belt === '2nd Poom/Dan' ? '2nd Dan' :
                           belt === '3rd Poom/Dan' ? '3rd Dan' :
                           belt === '4th Poom/Dan' ? '4th Dan' : belt}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className={cn(
                          "text-[9px] font-mono font-black",
                          isSelected ? "text-brand-ink" : "text-neutral-500 dark:text-neutral-400 group-hover:text-brand-ink"
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
          {beltCenterSubTab === 'readiness' && <PromotionReadinessPanel setFilterEligibility={setFilterEligibility} filterEligibility={filterEligibility} totalReadyCandidates={totalReadyCandidates} totalDevelopingCandidates={totalDevelopingCandidates} avgPri={avgPri} setBeltCenterSubTab={setBeltCenterSubTab} recentPromotionsCount={recentPromotionsCount} filteredPromoCandidates={filteredPromoCandidates} selectedBeltPipelineFilter={selectedBeltPipelineFilter} promotionSearch={promotionSearch} setPromotionSearch={setPromotionSearch} filterBranchPromo={filterBranchPromo} setFilterBranchPromo={setFilterBranchPromo} state={state} t={t} selectedStudentsForPromotion={selectedStudentsForPromotion} setShowPromotionModal={setShowPromotionModal} handleSelectAllPromo={handleSelectAllPromo} getNextBeltRank={getNextBeltRank} handleSelectPromo={handleSelectPromo} handleOpenSinglePromote={handleOpenSinglePromote} setSelectedStudentForCurriculum={setSelectedStudentForCurriculum} />}

          {/* Promotion History tab */}
          {beltCenterSubTab === 'history' && <PromotionHistoryPanel t={t} filteredHistory={filteredHistory} historySearch={historySearch} setHistorySearch={setHistorySearch} filterBranchHistory={filterBranchHistory} setFilterBranchHistory={setFilterBranchHistory} state={state} filterBeltHistory={filterBeltHistory} setFilterBeltHistory={setFilterBeltHistory} BELT_RANK_ORDER={BELT_RANK_ORDER} filterProgramHistory={filterProgramHistory} setFilterProgramHistory={setFilterProgramHistory} handleExportHistoryCsv={handleExportHistoryCsv} setSelectedStudentId={setSelectedStudentId} handleCopyLink={handleCopyLink} copiedHistoryId={copiedHistoryId} handleOpenEditHistory={handleOpenEditHistory} isDeletingHistory={isDeletingHistory} handleVoidPromotion={handleVoidPromotion} />}

          {/* Curriculum requirements audit tab */}
          {beltCenterSubTab === 'curriculum' && <CurriculumAuditTab
            can={can}
            getNextBeltRank={getNextBeltRank}
            getStudentPromotionData={getStudentPromotionData}
            handleOpenSinglePromote={handleOpenSinglePromote}
            promotionSearch={promotionSearch}
            reconcileAllStudentBelts={reconcileAllStudentBelts}
            selectedBeltPipelineFilter={selectedBeltPipelineFilter}
            selectedStudentForCurriculum={selectedStudentForCurriculum}
            setPromotionSearch={setPromotionSearch}
            setSelectedStudentForCurriculum={setSelectedStudentForCurriculum}
            setStateRevision={setStateRevision}
            state={state}
            t={t}
            upsertPhysicalEvaluation={upsertPhysicalEvaluation}
          />}
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
          <BulkPromotionDialog
            BELT_RANK_ORDER={BELT_RANK_ORDER}
            handleBulkPromoteSubmit={handleBulkPromoteSubmit}
            promotionForm={promotionForm}
            selectedStudentsForPromotion={selectedStudentsForPromotion}
            setPromotionForm={setPromotionForm}
            setShowPromotionModal={setShowPromotionModal}
            t={t}
          />
        )}

        {reconcileResult && (
          <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <ModalA11y label="Reconciliation result" onClose={() => setReconcileResult(null)} />
              <motion.div
                {...dialogMotion}
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
                      <div className="space-y-2 max-h-[35dvh] overflow-y-auto pr-1">
                        {reconcileResult.details.map((log, i) => (
                          <div key={i} className="p-3 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex items-center justify-between gap-4 shadow-sm">
                            <span className="text-neutral-900 dark:text-white text-[11px] font-medium leading-relaxed">{log}</span>
                            <span className="shrink-0 text-[9px] font-black tracking-widest text-amber-700 dark:text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-bold">{t('dir_healed')}</span>
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
          <EditPromotionDialog
            BELT_RANK_ORDER={BELT_RANK_ORDER}
            editHistoryForm={editHistoryForm}
            editingHistory={editingHistory}
            handleSaveEditHistorySubmit={handleSaveEditHistorySubmit}
            isSavingEdit={isSavingEdit}
            setEditHistoryForm={setEditHistoryForm}
            setEditingHistory={setEditingHistory}
            state={state}
            t={t}
          />
        )}
      </AnimatePresence>
      {/* Quick Status Management Modal */}
      {selectedStudentForStatus && (
        <StudentQuickStatusDialog
          isSavingStatus={isSavingStatus}
          quickStatusForm={quickStatusForm}
          selectedStudentForStatus={selectedStudentForStatus}
          setIsSavingStatus={setIsSavingStatus}
          setQuickStatusForm={setQuickStatusForm}
          setSelectedStudentForStatus={setSelectedStudentForStatus}
          showNotification={showNotification}
          updateStudent={updateStudent}
        />
      )}

      {/* Household Management Modal */}
      <HouseholdManagementModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
      />
    </div>
    </div>
  );
}
