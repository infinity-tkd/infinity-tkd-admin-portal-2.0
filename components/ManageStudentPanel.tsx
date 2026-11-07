'use client';
import { copyText } from '@/lib/clipboard';
import { MembershipSchedulePanel } from './MembershipSchedulePanel';
import { StudentTimeline } from './operations/StudentTimeline';
import { CompetitionEventPicker } from './students/CompetitionEventPicker';
import { StudentTrainingAssignments } from './students/StudentTrainingAssignments';


import { academyDate } from '@/lib/dates';


import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, getMembershipBillingStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { User } from '@phosphor-icons/react/dist/csr/User';



import { Heart } from '@phosphor-icons/react/dist/csr/Heart';


import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Key } from '@phosphor-icons/react/dist/csr/Key';

import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { Certificate } from '@phosphor-icons/react/dist/csr/Certificate';




import { Check } from '@phosphor-icons/react/dist/csr/Check';

import { Trash } from '@phosphor-icons/react/dist/csr/Trash';


import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { ArrowsIn } from '@phosphor-icons/react/dist/csr/ArrowsIn';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeClosed } from '@phosphor-icons/react/dist/csr/EyeClosed';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';


import { cn, formatBeltLocalized } from '@/lib/utils';
import { Portal } from '@/components/Portal';

import { SafeImage } from '@/components/SafeImage';

import { useT } from '@/hooks/useTranslation';
import { StudentDossierModal } from '@/components/StudentDossierModal';
import dynamic from 'next/dynamic';


import { AnatomyStudioModal } from './AnatomyStudioModal';
import { resolveStudentMuscleLoads } from '@/lib/anatomy-integration';

import type { BulkBeltRow, BulkAchievementRow } from '@/components/students/student-editor-types';
const StudentProfileEditor = dynamic(() => import('@/components/students/StudentProfileEditor').then(module => module.StudentProfileEditor), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentProfileOverview = dynamic(() => import('@/components/students/StudentProfileOverview').then(module => module.StudentProfileOverview), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentBeltsTab = dynamic(() => import('@/components/students/StudentBeltsTab').then(module => module.StudentBeltsTab), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentSkillsTab = dynamic(() => import('@/components/students/StudentSkillsTab').then(module => module.StudentSkillsTab), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentBiometricsTab = dynamic(() => import('@/components/students/StudentBiometricsTab').then(module => module.StudentBiometricsTab), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentBulkBeltDialog = dynamic(() => import('@/components/students/StudentBulkBeltDialog').then(module => module.StudentBulkBeltDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentBulkAchievementDialog = dynamic(() => import('@/components/students/StudentBulkAchievementDialog').then(module => module.StudentBulkAchievementDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

export function ManageStudentPanel({ studentId, onClose }: { studentId: string, onClose: () => void }) {
  const { state, updateStudent, deleteStudent, addBeltHistory, addBeltHistories, updateBeltHistory, deleteBeltHistory, saveAchievements, deleteAchievement, addUser, updateUser, showNotification, showConfirm, enrollStudent, unenrollStudent, addBodyComposition, payInvoice, can } = useAppStore();
  const t = useT();
  const student = state.students.find(s => s.id === studentId);
  const [isEditing, setIsEditing] = useState(false);
  const studentEnrollments = state.classEnrollments.filter(e => e.studentId === studentId);
  const primaryEnrollment = studentEnrollments[0];

  const [editForm, setEditForm] = useState<any>(student ? {
    ...student,
    address: student.address ? { ...student.address } : { line1: '', line2: '', city: '', stateProvince: '', postalCode: '', country: 'Cambodia' },
    classEnrollmentDate: primaryEnrollment?.enrollmentDate?.split('T')[0] || ''
  } : {});
  const [activeTab, setActiveTab] = useState<'profile' | 'belts' | 'skills' | 'biometrics'>('profile');

  const [biometricsForm, setBiometricsForm] = useState({
    recordedDate: academyDate(),
    heightCm: student?.heightCm ? String(student.heightCm) : '',
    weightKg: student?.weightKg ? String(student.weightKg) : '',
    bodyFatPercentage: '',
    skeletalMuscleMassKg: '',
    neckCm: '',
    shoulderWidthCm: '',
    chestCm: '',
    waistCm: '',
    hipsCm: '',
    leftArmCm: '',
    rightArmCm: '',
    leftThighCm: '',
    rightThighCm: '',
    leftCalfCm: '',
    rightCalfCm: ''
  });
  const [isSavingBiometrics, setIsSavingBiometrics] = useState(false);
  const [hoveredMuscle, setHoveredMuscle] = useState<{ name: string; score: number } | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    if (!(await copyText(text))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopiedField(label);
    showNotification(`Copied ${label} to clipboard`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };


  useEffect(() => {
    if (student) {
      setBiometricsForm(prev => ({
        ...prev,
        heightCm: student.heightCm ? String(student.heightCm) : prev.heightCm,
        weightKg: student.weightKg ? String(student.weightKg) : prev.weightKg
      }));
    }
  }, [student]);

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showBeltModal, setShowBeltModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const achievementSaveInFlight = React.useRef(false);
  const [isSavingAchievement, setIsSavingAchievement] = useState(false);

  // Bulk Modal spreadsheet states
  const [showBulkBeltModal, setShowBulkBeltModal] = useState(false);
  const [showBulkAchvModal, setShowBulkAchvModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Portal Account Password Management & Provisioning states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(true);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionUsername, setProvisionUsername] = useState('');
  const [provisionEmail, setProvisionEmail] = useState('');
  const [provisionPassword, setProvisionPassword] = useState('');
  const [showProvisionPasswordText, setShowProvisionPasswordText] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);





  const [bulkBelts, setBulkBelts] = useState<BulkBeltRow[]>([]);
  const [bulkAchvs, setBulkAchvs] = useState<BulkAchievementRow[]>([]);
  const bulkBeltSaveInFlight = React.useRef(false);
  const [isSavingBulkBelt, setIsSavingBulkBelt] = useState(false);
  const [isSavingBulkAchv, setIsSavingBulkAchv] = useState(false);

  // Forms for new data
  const [beltForm, setBeltForm] = useState({ beltLevel: 'Yellow', promotionDate: academyDate(), testScore: '', program: 'Standard Class', certificateRef: '', kukkiwonDanCardId: '' });
  const [achvForm, setAchvForm] = useState<{eventName:string;date:string;eventId?:string|null}>({ eventName: '', date: academyDate(), eventId:null });
  const [achvEvents, setAchvEvents] = useState<Array<{ id?: number; category: string; division: string; medalRank: string; notes: string; ageDivision: string; beltDivision: string }>>([
    { category: 'Recognized Poomsae', division: 'Male Division', medalRank: 'Gold', notes: '', ageDivision: 'No Age Requirement', beltDivision: 'No Belt Requirement' }
  ]);
  const [achvSearch, setAchvSearch] = useState('');
  const [achvMedalFilter, setAchvMedalFilter] = useState('all');
  const [achvYearFilter, setAchvYearFilter] = useState('all');
  const [achvSort, setAchvSort] = useState('date-desc');
  const [editingAchievementId, setEditingAchievementId] = useState<number | null>(null);
  const [editingBeltHistoryId, setEditingBeltHistoryId] = useState<number | null>(null);
  const [deletedAchvIds, setDeletedAchvIds] = useState<number[]>([]);
  const [isCertManual, setIsCertManual] = useState(false);


  const getBeltAbbreviation = (level: string) => {
    const isPoom = calculateAge() < 15;
    const pdSuffix = isPoom ? 'P' : 'D';
    switch (level) {
      case 'White': return 'WB';
      case 'Yellow': return 'YB';
      case 'Green': return 'GB';
      case 'Blue': return 'BB';
      case 'Brown': return 'BRB';
      case 'Red': return 'RB';
      case '1st Poom/Dan': return `1${pdSuffix}`;
      case '2nd Poom/Dan': return `2${pdSuffix}`;
      case '3rd Poom/Dan': return `3${pdSuffix}`;
      case '4th Poom/Dan': return `4${pdSuffix}`;
      default: return 'CB';
    }
  };

  const generateCertRef = (level: string, dateStr: string) => {
    const x = getBeltAbbreviation(level);
    const y = student?.gender === 'Female' ? 'F' : 'M';
    const uniqueId = Array.from({ length: 5 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
    const year = dateStr ? dateStr.split('-')[0] : new Date().getFullYear().toString();
    return `ITKD_CERT-${x}-${y}-${uniqueId}-${year}`;
  };

  const handleOpenBeltModal = () => {
    const defaultLevel = 'Yellow';
    const defaultDate = academyDate();
    const generated = generateCertRef(defaultLevel, defaultDate);
    setBeltForm({
      beltLevel: defaultLevel,
      promotionDate: defaultDate,
      testScore: '',
      program: 'Standard Class',
      certificateRef: generated,
      kukkiwonDanCardId: ''
    });
    setEditingBeltHistoryId(null);
    setIsCertManual(false);
    setShowBeltModal(true);
  };

  const handleStartEditBelt = (history: any) => {
    setBeltForm({
      beltLevel: history.beltLevel,
      promotionDate: history.promotionDate,
      testScore: history.testScore !== undefined && history.testScore !== null ? String(history.testScore) : '',
      program: history.program || 'Standard Class',
      certificateRef: history.certificateRef || '',
      kukkiwonDanCardId: history.kukkiwonDanCardId || ''
    });
    setEditingBeltHistoryId(history.id);
    setIsCertManual(true);
    setShowBeltModal(true);
  };

  const canEdit = can('action:student_edit');

  const handleSaveStudentPassword = async (targetUserId: string) => {
    if (!newPassword || newPassword.length < 12) {
      showNotification('Password must be at least 12 characters long.', 'warning');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updateUser(targetUserId, { password: newPassword });
      showNotification('Student portal password updated successfully!', 'success');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleProvisionStudentAccount = async () => {
    if (!student) return;
    const cleanUsername = provisionUsername.trim();
    if (!cleanUsername) {
      showNotification('Portal username is required.', 'warning');
      return;
    }
    if (!provisionPassword || provisionPassword.length < 12) {
      showNotification('Initial password must be at least 12 characters long.', 'warning');
      return;
    }
    const cleanEmail = provisionEmail.trim() || `${student.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@portal.infinitytkd.com`;

    setIsProvisioning(true);
    try {
      const result = await addUser({
        username: cleanUsername,
        email: cleanEmail,
        displayName: student.englishName,
        role: 'Student',
        isActive: true,
        password: provisionPassword,
        studentId: student.id,
      });

      if (result && !result.success) {
        showNotification(result.error || t('panel_err_failed_provision'), 'error');
      } else {
        showNotification('Portal account activated and linked to Student ID successfully!', 'success');
        setShowProvisionModal(false);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to activate portal account.', 'error');
    } finally {
      setIsProvisioning(false);
    }
  };

  const [showScheduleManager, setShowScheduleManager] = useState(false);

  const getConflictsForClass = (targetClassId: number) => {
    if (!student) return [];
    const targetClass = state.classSessions.find(c => c.id === targetClassId);
    if (!targetClass) return [];

    // Find all other classes the student is enrolled in
    const otherClassIds = state.classEnrollments
      .filter(e => e.studentId === student.id && e.classId !== targetClassId)
      .map(e => e.classId);

    const conflicts: string[] = [];
    otherClassIds.forEach(cid => {
      const oc = state.classSessions.find(c => c.id === cid);
      if (!oc) return;

      // Check day intersection
      const dayOverlap = oc.daysOfWeek && targetClass.daysOfWeek &&
        oc.daysOfWeek.some(d => targetClass.daysOfWeek.includes(d));
      if (!dayOverlap) return;

      // Parse times
      const parseTime = (tStr: string) => {
        if (!tStr) return 0;
        const [h, m] = tStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const start1 = parseTime(targetClass.startTime);
      const end1 = parseTime(targetClass.endTime);
      const start2 = parseTime(oc.startTime);
      const end2 = parseTime(oc.endTime);

      // Check overlap
      if (start1 < end2 && start2 < end1) {
        const daysAbbrev = oc.daysOfWeek ? oc.daysOfWeek.map(d => d.substring(0, 3)).join('/') : oc.dayOfWeek?.substring(0, 3);
        conflicts.push(`${oc.name} (${daysAbbrev} ${oc.startTime}-${oc.endTime})`);
      }
    });
    return conflicts;
  };

  // Security guard: immediately drop out of editing mode when student selection changes
  useEffect(() => {
    setIsEditing(false);
    setShowScheduleManager(false);
  }, [studentId]);

  // Real-time synchronization: sync form state with the reactive global store whenever not actively typing
  useEffect(() => {
    if (student && !isEditing) {
      const primaryEnroll = state.classEnrollments.find(e => e.studentId === student.id);
      setEditForm({
        ...student,
        address: student.address ? { ...student.address } : { line1: '', line2: '', city: '', stateProvince: '', postalCode: '', country: 'Cambodia' },
        classEnrollmentDate: primaryEnroll?.enrollmentDate?.split('T')[0] || ''
      });
    }
  }, [studentId, student, isEditing, state.classEnrollments]);

  const [isDeleting, setIsDeleting] = useState(false);
  const { videoProgress, muscles, assetMuscleRelations } = state;
  const { muscleLoads, maxLoad, completedAssetIds } = useMemo(
    () => resolveStudentMuscleLoads(studentId, { videoProgress, muscles, assetMuscleRelations }),
    [studentId, videoProgress, muscles, assetMuscleRelations],
  );
  if (!student) return null;

  const beltHistory = state.beltHistories.filter(b => b.studentId === student.id).sort((a,b) => new Date(b.promotionDate).getTime() - new Date(a.promotionDate).getTime());
  const rawAchievements = state.achievements.filter(a => a.studentId === student.id);

  // Calculate total medal counters
  const totalCount = rawAchievements.length;
  const goldCount = rawAchievements.filter(a => a.medalRank === 'Gold').length;
  const silverCount = rawAchievements.filter(a => a.medalRank === 'Silver').length;
  const bronzeCount = rawAchievements.filter(a => a.medalRank === 'Bronze').length;
  const participantCount = rawAchievements.filter(a => a.medalRank === 'Participant' || a.medalRank === 'Participation').length;

  // Extract unique years from achievements dates for the filter dropdown
  const uniqueYears = Array.from(new Set(rawAchievements.map(a => {
    try {
      return a.date ? new Date(a.date).getFullYear().toString() : null;
    } catch {
      return null;
    }
  }).filter(Boolean))).sort((a, b) => b!.localeCompare(a!)) as string[];

  // Filter & Sort rawAchievements
  const filteredAchievements = rawAchievements.filter(a => {
    // Search filter
    const searchLower = achvSearch.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      (a.eventName || '').toLowerCase().includes(searchLower) ||
      (a.category || '').toLowerCase().includes(searchLower) ||
      (a.division || '').toLowerCase().includes(searchLower) ||
      (a.ageDivision || '').toLowerCase().includes(searchLower) ||
      (a.beltDivision || '').toLowerCase().includes(searchLower) ||
      (a.notes || '').toLowerCase().includes(searchLower);

    // Medal filter
    const matchesMedal = achvMedalFilter === 'all' ||
      (achvMedalFilter === 'Participant' ? (a.medalRank === 'Participant' || a.medalRank === 'Participation') : a.medalRank === achvMedalFilter);

    // Year filter
    const matchesYear = achvYearFilter === 'all' ||
      (a.date && a.date.startsWith(achvYearFilter));

    return matchesSearch && matchesMedal && matchesYear;
  });

  // Sort logic
  const achievements = [...filteredAchievements].sort((a, b) => {
    if (achvSort === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (achvSort === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (achvSort === 'name-asc') {
      return (a.eventName || '').localeCompare(b.eventName || '');
    }

    // Medal weight mapping
    const MEDAL_WEIGHTS: Record<string, number> = {
      'Gold': 4,
      'Silver': 3,
      'Bronze': 2,
      'Participant': 1,
      'Participation': 1
    };
    const weightA = MEDAL_WEIGHTS[a.medalRank] || 0;
    const weightB = MEDAL_WEIGHTS[b.medalRank] || 0;

    if (achvSort === 'medal-desc') {
      return weightB - weightA;
    }
    if (achvSort === 'medal-asc') {
      return weightA - weightB;
    }
    return 0;
  });
  const studentCompositions = state.bodyCompositions
    .filter(bc => bc.studentId === student.id)
    .sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime());

  const handleSaveBiometrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biometricsForm.heightCm || !biometricsForm.weightKg) {
      showNotification("Height and Weight are required.", "warning");
      return;
    }

    setIsSavingBiometrics(true);
    try {
      await addBodyComposition({
        studentId: student.id,
        recordedDate: biometricsForm.recordedDate,
        heightCm: biometricsForm.heightCm,
        weightKg: biometricsForm.weightKg,
        bodyFatPercentage: biometricsForm.bodyFatPercentage || null,
        skeletalMuscleMassKg: biometricsForm.skeletalMuscleMassKg || null,
        neckCm: biometricsForm.neckCm || null,
        shoulderWidthCm: biometricsForm.shoulderWidthCm || null,
        chestCm: biometricsForm.chestCm || null,
        waistCm: biometricsForm.waistCm || null,
        hipsCm: biometricsForm.hipsCm || null,
        leftArmCm: biometricsForm.leftArmCm || null,
        rightArmCm: biometricsForm.rightArmCm || null,
        leftThighCm: biometricsForm.leftThighCm || null,
        rightThighCm: biometricsForm.rightThighCm || null,
        leftCalfCm: biometricsForm.leftCalfCm || null,
        rightCalfCm: biometricsForm.rightCalfCm || null
      });
      // Clear secondary values, keeping only height & weight
      setBiometricsForm(prev => ({
        ...prev,
        bodyFatPercentage: '',
        skeletalMuscleMassKg: '',
        neckCm: '',
        shoulderWidthCm: '',
        chestCm: '',
        waistCm: '',
        hipsCm: '',
        leftArmCm: '',
        rightArmCm: '',
        leftThighCm: '',
        rightThighCm: '',
        leftCalfCm: '',
        rightCalfCm: ''
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingBiometrics(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: any) => {
    if (!student || student.studentStatus === newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateStudent(student.id, { studentStatus: newStatus });
      showNotification(`Student status updated to ${newStatus}.`, 'success');
    } catch (e: any) {
      showNotification(`Failed to update status: ${e.message}`, 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getBeltColorBadge = (belt: string) => {
    if (!belt) return 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-[#1A1A1A] dark:text-neutral-400 dark:border-[#262626]';
    if (belt.includes('Poom')) return 'bg-neutral-900 text-red-400 border-red-600/50';
    if (belt.includes('Dan') || belt.toLowerCase().includes('black')) return 'bg-neutral-900 text-neutral-100 border-neutral-700';
    if (belt === 'Red') return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
    if (belt === 'Brown') return 'bg-amber-800/15 text-amber-800 dark:text-amber-500 border-amber-800/30';
    if (belt === 'Blue') return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    if (belt === 'Green') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    if (belt === 'Yellow') return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
    return 'bg-neutral-100 text-neutral-700 dark:bg-[#1A1A1A] dark:text-neutral-300 border-neutral-200 dark:border-[#262626]';
  };

  const handleSave = async () => {
    setIsSavingProfile(true);
    try {
      await updateStudent(student.id, editForm);

      showNotification('Student profile updated successfully!', 'success');
      setIsEditing(false);
      setShowSaveConfirm(false);
    } catch (err: any) {
      console.error("Failed to update student:", err);
      showNotification(err.message || 'Failed to update student profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };



  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteStudent(student.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (e: any) {
      console.error("Failed to delete student:", e);
      showNotification(e.message || "Failed to delete student record.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const isBirthday = () => {
    if (!student.dob) return false;
    const today = new Date();
    const dob = new Date(student.dob);
    return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();
  };

  const calculateAge = () => {
    if (!student.dob) return 0;
    const today = new Date();
    const dob = new Date(student.dob);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
  };

  const getAgeDivision = () => {
    const age = calculateAge();
    if (age >= 6 && age <= 11) return t('dir_div_kid');
    if (age >= 12 && age <= 14) return t('dir_div_cadet');
    if (age >= 15 && age <= 17) return t('dir_div_junior');
    if (age >= 18) return t('dir_div_senior');
    return t('dir_div_under_6');
  };

  const isMinor = calculateAge() < 18;

  // Real-time Dashboard Analytics & Metrics
  const studentAttendance = state.attendanceRecords.filter(r => r.studentId === student.id);
  const totalClasses = studentAttendance.length;
  const attendedClasses = studentAttendance.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const attendanceRate = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : null;
  const activeEnrollmentsCount = state.classEnrollments.filter(e => e.studentId === student.id).length;
  const beltPromotionsCount = beltHistory.length;
  const achievementsCount = achievements.length;

  const handleAddBelt = async () => {
    if (beltForm.certificateRef) {
      const normalizedRef = beltForm.certificateRef.trim().toUpperCase();
      const isDuplicate = state.beltHistories.some(
        b => b.id !== editingBeltHistoryId && b.certificateRef && b.certificateRef.trim().toUpperCase() === normalizedRef
      );
      if (isDuplicate) {
        showNotification(`Validation Error: Certificate Reference "${beltForm.certificateRef}" is already in use in the system. Please provide a unique reference.`, 'error');
        return;
      }
    }

    const payload = {
       studentId: student.id,
       beltLevel: beltForm.beltLevel,
       promotionDate: beltForm.promotionDate,
       testScore: beltForm.testScore ? Number(beltForm.testScore) : undefined,
       program: beltForm.program || undefined,
       certificateRef: beltForm.certificateRef || undefined,
       kukkiwonDanCardId: beltForm.kukkiwonDanCardId || undefined
    };

    try {
      if (editingBeltHistoryId !== null) {
        await updateBeltHistory(editingBeltHistoryId, payload);
      } else {
        await addBeltHistory(payload);
      }
      setShowBeltModal(false);
      setEditingBeltHistoryId(null);
    } catch (e: any) {
      console.error("Belt history save failed:", e);
      showNotification(e.message || "Failed to save promotion record.", 'error');
    }
  };

  // Spreadsheet initializers and event handlers
  const initBulkBeltRow = (level = 'Yellow', dateStr = academyDate()): BulkBeltRow => {
    return {
      beltLevel: level,
      promotionDate: dateStr,
      testScore: '',
      program: 'Standard Class',
      certificateRef: generateCertRef(level, dateStr),
      kukkiwonDanCardId: '',
      isManualCert: false
    };
  };

  const initBulkAchvRow = (): BulkAchievementRow => {
    return {
      eventName: '',
      category: 'Recognized Poomsae',
      division: student?.gender === 'Female' ? 'Female Division' : 'Male Division',
      medalRank: 'Gold',
      date: academyDate(),
      notes: ''
    };
  };

  const handleOpenBulkBeltModal = () => {
    setBulkBelts([initBulkBeltRow('Yellow')]);
    setShowBulkBeltModal(true);
  };

  const handleOpenBulkAchvModal = () => {
    setBulkAchvs([initBulkAchvRow()]);
    setShowBulkAchvModal(true);
  };

  const handleUpdateBulkBeltCell = (index: number, field: keyof BulkBeltRow, value: any) => {
    setBulkBelts(prev => {
      const copy = [...prev];
      const row = { ...copy[index] };

      if (field === 'beltLevel') {
        row.beltLevel = value;
        if (!row.isManualCert) {
          row.certificateRef = generateCertRef(value, row.promotionDate);
        }
      } else if (field === 'promotionDate') {
        row.promotionDate = value;
        if (!row.isManualCert) {
          row.certificateRef = generateCertRef(row.beltLevel, value);
        }
      } else if (field === 'certificateRef') {
        row.certificateRef = value.toUpperCase();
        row.isManualCert = true;
      } else {
        (row as any)[field] = value;
      }

      copy[index] = row;
      return copy;
    });
  };

  const handleUpdateBulkAchvCell = (index: number, field: keyof BulkAchievementRow, value: any) => {
    setBulkAchvs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddBulkBeltRow = () => {
    setBulkBelts(prev => [...prev, initBulkBeltRow('Yellow')]);
  };

  const handleRemoveBulkBeltRow = (index: number) => {
    setBulkBelts(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddBulkAchvRow = () => {
    setBulkAchvs(prev => [...prev, initBulkAchvRow()]);
  };

  const handleRemoveBulkAchvRow = (index: number) => {
    setBulkAchvs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveBulkBelts = async () => {
    if (bulkBeltSaveInFlight.current) return;
    const validRows = bulkBelts;
    if (validRows.some(row => !row.beltLevel || !row.promotionDate)) {
      showNotification('Complete or remove every belt row before saving the batch.', 'warning');
      return;
    }
    if (validRows.length === 0) {
      showNotification("Please add at least one valid belt record with level and date.", "warning");
      return;
    }

    // 1. Check for duplicate certificate references inside the spreadsheet itself
    const certRefsInBulk = validRows.map(r => r.certificateRef?.trim().toUpperCase()).filter(Boolean);
    const uniqueCertRefsInBulk = new Set(certRefsInBulk);
    if (certRefsInBulk.length !== uniqueCertRefsInBulk.size) {
      showNotification("Validation Error: You have duplicate Certificate References inside your spreadsheet rows. Each certificate must be unique.", "error");
      return;
    }

    // 2. Check for duplicate certificate references against the existing system database
    const dbDuplicates = [];
    for (const row of validRows) {
      if (row.certificateRef) {
        const normalized = row.certificateRef.trim().toUpperCase();
        const exists = state.beltHistories.some(
          b => b.certificateRef && b.certificateRef.trim().toUpperCase() === normalized
        );
        if (exists) {
          dbDuplicates.push(row.certificateRef);
        }
      }
    }

    if (dbDuplicates.length > 0) {
      showNotification(`Validation Error: The following Certificate References are already in use in the system:\n${dbDuplicates.join(', ')}\n\nPlease ensure all references are unique before saving.`, "error");
      return;
    }

    bulkBeltSaveInFlight.current = true;
    setIsSavingBulkBelt(true);
    try {
      await addBeltHistories(validRows.map(row => ({
          studentId: student.id,
          beltLevel: row.beltLevel,
          promotionDate: row.promotionDate,
          testScore: row.testScore ? Number(row.testScore) : undefined,
          program: row.program || undefined,
          certificateRef: row.certificateRef || undefined,
          kukkiwonDanCardId: row.kukkiwonDanCardId || undefined
        })));

      setShowBulkBeltModal(false);
    } catch (e: any) {
      console.error("Bulk belts save failed:", e);
      showNotification(e instanceof Error ? e.message : 'The belt batch was not saved. Review the rows and retry.', 'error');
    } finally {
      bulkBeltSaveInFlight.current = false;
      setIsSavingBulkBelt(false);
    }
  };

  const handleSaveBulkAchvs = async () => {
    if (achievementSaveInFlight.current) return;
    const validRows = bulkAchvs;
    if (validRows.some(row => !row.eventName.trim() || !row.date)) { showNotification('Complete or remove every achievement row before saving the batch.', 'warning'); return; }
    if (!validRows.length) { showNotification('Add at least one achievement with an event name and date.', 'warning'); return; }
    achievementSaveInFlight.current = true;
    setIsSavingBulkAchv(true);
    try {
      await saveAchievements(student.id, validRows.map(row => ({
        eventName: row.eventName, category: row.category, division: row.division,
        medalRank: row.medalRank === 'Participant' ? 'Participation' : row.medalRank, date: row.date, notes: row.notes || undefined,
      })));
      setShowBulkAchvModal(false);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Tournament achievements were not saved.', 'error');
    } finally { achievementSaveInFlight.current = false; setIsSavingBulkAchv(false); }
  };

  const handleAddAchievement = async () => {
    if (achievementSaveInFlight.current || !achvForm.eventName.trim() || !achvEvents.length) return;
    achievementSaveInFlight.current = true;
    setIsSavingAchievement(true);
    try {
      await saveAchievements(student.id, achvEvents.map(event => ({
        ...(event.id ? { id: event.id } : {}), eventName: achvForm.eventName, date: achvForm.date, ...(achvForm.eventId !== undefined ? {eventId:achvForm.eventId} : {}),
        category: event.category, division: event.division,
        medalRank: event.medalRank === 'Participant' ? 'Participation' : event.medalRank,
        notes: event.notes, ageDivision: event.ageDivision, beltDivision: event.beltDivision,
      })), editingAchievementId !== null ? deletedAchvIds : []);
      setAchvForm({ eventName: '', date: academyDate() });
      setAchvEvents([{ category: 'Recognized Poomsae', division: 'Male Division', medalRank: 'Gold', notes: '', ageDivision: 'No Age Requirement', beltDivision: 'No Belt Requirement' }]);
      setEditingAchievementId(null);
      setDeletedAchvIds([]);
      setShowAchievementModal(false);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Tournament achievements were not saved.', 'error');
    } finally { achievementSaveInFlight.current = false; setIsSavingAchievement(false); }
  };

  const handleCloseAchievementModal = () => {
    if (achievementSaveInFlight.current) return;
    setEditingAchievementId(null);
    setDeletedAchvIds([]);
    setAchvForm({
      eventName: '',
      date: academyDate()
    });
    setAchvEvents([
      { category: 'Recognized Poomsae', division: 'Male Division', medalRank: 'Gold', notes: '', ageDivision: 'No Age Requirement', beltDivision: 'No Belt Requirement' }
    ]);
    setShowAchievementModal(false);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[10vh] rounded-t-[8px] md:inset-x-auto md:top-0 md:inset-y-0 md:right-0 w-full bg-white dark:bg-[#0A0A0A] border-t md:border-t-0 md:border-l border-neutral-200 dark:border-[#262626] z-50 flex flex-col shadow-2xl md:rounded-none overflow-hidden text-neutral-900 dark:text-white transition-all duration-355 ease-in-out",
          (activeTab === 'biometrics' || isExpanded)
            ? "md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
            : "md:max-w-xl lg:max-w-2xl"
        )}
      >
        <div className="md:hidden flex justify-center py-3 bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
          <div className="w-10 h-1 bg-neutral-300 dark:bg-[#262626] rounded-full"/>
        </div>
        <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-[#0F0F0F] shrink-0">
          <div className="flex gap-3.5 items-center min-w-0">
            <div className={cn("p-0.5 rounded-[10px] border-2 shrink-0 shadow-xs", getBeltColorBadge(student.currentBelt))}>
              <SafeImage
                src={student.profilePicturePath}
                alt={student.englishName}
                containerClassName="w-13 h-13 bg-neutral-100 dark:bg-[#1A1A1A] rounded-[8px] flex items-center justify-center font-bold text-xl text-neutral-500 dark:text-neutral-400 overflow-hidden"
                fallback={student.englishName.charAt(0)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">
                  {student.englishName}
                </h2>
                {student.khmerName && (
                  <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 font-khmer">({student.khmerName})</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopy(student.id, 'Student ID')}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-[#EF2F38] border border-neutral-200 dark:border-[#262626] transition-colors cursor-pointer flex items-center gap-1"
                  title="Click to copy ID"
                >
                  <span>{student.id}</span>
                  {copiedField === 'Student ID' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                </button>

                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 font-sans">
                  {formatBeltLocalized(student.currentBelt, student.dob, t)}
                </span>

                <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">•</span>

                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  {getAgeDivision()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200 dark:border-[#262626]">
            {/* Quick Status Dropdown */}
            <div className="relative">
              <select
                value={student.studentStatus}
                disabled={!canEdit || isUpdatingStatus}
                onChange={e => handleQuickStatusChange(e.target.value)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-[6px] border outline-none cursor-pointer transition-all shadow-xs disabled:opacity-50",
                  student.studentStatus === 'Active' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" :
                  student.studentStatus === 'Paused' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20" :
                  student.studentStatus === 'Inactive' ? "bg-neutral-100 text-neutral-600 dark:bg-[#1A1A1A] dark:text-neutral-400 border-neutral-300 dark:border-neutral-700" :
                  student.studentStatus === 'Suspended' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                )}
                title="Change student status"
              >
                <option value="Active">{t('act_active')}</option>
                <option value="Paused">Paused</option>
                <option value="Inactive">{t('act_inactive')}</option>
                <option value="Suspended">{t('act_suspended')}</option>
                <option value="Graduated">{t('act_graduated')}</option>
              </select>
            </div>

            {/* Dossier action */}
            <button
              type="button"
              onClick={() => setShowDossierModal(true)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-300 rounded-[8px] border border-neutral-200 dark:border-[#262626] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              title="Download / Print Dossier"
            >
              <IdentificationCard className="w-4 h-4" />
            </button>

            {/* Expand / Collapse action */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden md:flex p-2 min-h-[44px] min-w-[44px] items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-300 rounded-[8px] border border-neutral-200 dark:border-[#262626] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              title={isExpanded ? "Collapse Panel" : "Expand Panel"}
              aria-label={isExpanded ? "Collapse Panel" : "Expand Panel"}
            >
              {isExpanded ? <ArrowsIn className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
            </button>

            {/* Close action */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-300 rounded-[8px] border border-neutral-200 dark:border-[#262626] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              title="Close"
              aria-label="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isBirthday() && (
           <div className="bg-yellow-500/20 border-b border-yellow-500/50 p-3 flex justify-center items-center">
             <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                <span className="text-lg animate-bounce">🎉</span> {t('panel_birthday_alert').replace('{age}', String(calculateAge()))}
             </span>
           </div>
        )}

        {(() => {
          if (!student || !can('page:financials')) return null;
          const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments, state.academyProfile);
          if (billing.status === 'Current') return null;

          return (
            <div className={cn(
              "border-b p-3 flex justify-between items-center text-xs",
              billing.status === 'Overdue'
                ? "bg-red-500/10 border-red-500/30 text-red-500"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500"
            )}>
              <div className="flex items-center gap-2">
                <Warning className="w-4 h-4 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold uppercase tracking-wider block text-[10px]">
                    {billing.status === 'Overdue'
                      ? 'Membership Overdue'
                      : 'Membership Renewal Due'}
                  </span>
                  <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400">
                    {billing.status === 'Overdue'
                      ? `Due was on ${billing.nextRenewalDate} (${Math.abs(billing.daysRemaining)}d overdue)`
                      : `Due on ${billing.nextRenewalDate} (${billing.daysRemaining}d remaining)`}
                  </span>
                </div>
              </div>

              {/* Quick Record Payment Action */}
              {can('action:finance_record_payment') && <button
                type="button"
                onClick={async () => {
                  const [currentYearValue,currentMonthValue]=academyDate().split('-').map(Number);
                  const currentMonthIdx = currentMonthValue-1;
                  const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
                  const currentYear = currentYearValue;
                  try {
                    await payInvoice(student.id, currentYear, currentMonthNameShort, billing.amountOwed);
                    showNotification(`Collected $${billing.amountOwed.toFixed(2)} membership tuition renewal for ${student.englishName}.`, 'success');
                  } catch (e: any) {
                    showNotification(`Payment logging failed: ${e.message}`, 'error');
                  }
                }}
                className="px-2.5 py-1 bg-white dark:bg-[#1A1A1A] hover:bg-neutral-100 dark:hover:bg-[#262626] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-white rounded-[8px] text-[9.5px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                Collect ${billing.amountOwed.toFixed(0)}
              </button>}
            </div>
          );
        })()}

        <div className="flex border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#0F0F0F] shrink-0 overflow-x-auto no-scrollbar touch-pan-x">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setIsExpanded(false); }}
            className={cn(
              "flex-1 py-3 px-3.5 min-h-[44px] text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation",
              activeTab === 'profile' ? "border-[#EF2F38] text-[#EF2F38]" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('panel_tab_profile')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('belts'); setIsExpanded(false); }}
            className={cn(
              "flex-1 py-3 px-3.5 min-h-[44px] text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation",
              activeTab === 'belts' ? "border-[#EF2F38] text-[#EF2F38]" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <Certificate className="w-3.5 h-3.5" />
            <span>{t('panel_tab_belts')}</span>
            {beltHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-mono font-bold">
                {beltHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('skills'); setIsExpanded(false); }}
            className={cn(
              "flex-1 py-3 px-3.5 min-h-[44px] text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation",
              activeTab === 'skills' ? "border-[#EF2F38] text-[#EF2F38]" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{t('panel_tab_skills')}</span>
            {achievements.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-mono font-bold">
                {achievements.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('biometrics'); setIsExpanded(true); }}
            className={cn(
              "flex-1 py-3 px-3.5 min-h-[44px] text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation",
              activeTab === 'biometrics' ? "border-[#EF2F38] text-[#EF2F38]" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>{t('panel_tab_biometrics')}</span>
            {studentCompositions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-mono font-bold">
                {studentCompositions.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {activeTab === 'profile' && !isEditing && <div className="mb-4 space-y-3"><MembershipSchedulePanel studentId={student.id} /><StudentTimeline studentId={student.id}/><StudentTrainingAssignments key={student.id} studentId={student.id}/></div>}
          {activeTab === 'profile' && (
            isEditing ? <StudentProfileEditor t={t} editForm={editForm} setEditForm={setEditForm} state={state} primaryEnrollment={primaryEnrollment} setShowSaveConfirm={setShowSaveConfirm} isSavingProfile={isSavingProfile} setIsEditing={setIsEditing} /> : <StudentProfileOverview canDeleteStudent={can('action:student_delete')} isMinor={isMinor} t={t} calculateAge={calculateAge} attendanceRate={attendanceRate} totalClasses={totalClasses} attendedClasses={attendedClasses} student={student} beltPromotionsCount={beltPromotionsCount} achievementsCount={achievementsCount} totalCount={totalCount} goldCount={goldCount} silverCount={silverCount} bronzeCount={bronzeCount} activeEnrollmentsCount={activeEnrollmentsCount} handleCopy={handleCopy} copiedField={copiedField} getAgeDivision={getAgeDivision} state={state} canEdit={canEdit} setShowScheduleManager={setShowScheduleManager} showScheduleManager={showScheduleManager} getConflictsForClass={getConflictsForClass} unenrollStudent={unenrollStudent} enrollStudent={enrollStudent} updateUser={updateUser} showNotification={showNotification} setNewPassword={setNewPassword} setShowPasswordModal={setShowPasswordModal} showConfirm={showConfirm} setProvisionUsername={setProvisionUsername} setProvisionEmail={setProvisionEmail} setProvisionPassword={setProvisionPassword} setShowProvisionModal={setShowProvisionModal} setShowDossierModal={setShowDossierModal} setIsEditing={setIsEditing} setShowDeleteConfirm={setShowDeleteConfirm} />
          )}

          {activeTab === 'belts' && <StudentBeltsTab t={t} canEdit={can('action:evaluations_grade')} handleOpenBulkBeltModal={handleOpenBulkBeltModal} handleOpenBeltModal={handleOpenBeltModal} beltHistory={beltHistory} state={state} student={student} handleStartEditBelt={handleStartEditBelt} showConfirm={showConfirm} deleteBeltHistory={deleteBeltHistory} showNotification={showNotification} />}

          {activeTab === 'skills' && <StudentSkillsTab t={t} canEdit={canEdit} handleOpenBulkAchvModal={handleOpenBulkAchvModal} setShowAchievementModal={setShowAchievementModal} totalCount={totalCount} goldCount={goldCount} silverCount={silverCount} bronzeCount={bronzeCount} participantCount={participantCount} achvSearch={achvSearch} setAchvSearch={setAchvSearch} achvMedalFilter={achvMedalFilter} setAchvMedalFilter={setAchvMedalFilter} achvYearFilter={achvYearFilter} setAchvYearFilter={setAchvYearFilter} uniqueYears={uniqueYears} achvSort={achvSort} setAchvSort={setAchvSort} achievements={achievements} setEditingAchievementId={setEditingAchievementId} setAchvForm={setAchvForm} state={state} student={student} setAchvEvents={setAchvEvents} setDeletedAchvIds={setDeletedAchvIds} showConfirm={showConfirm} deleteAchievement={deleteAchievement} showNotification={showNotification} />}

          {activeTab === 'biometrics' && <StudentBiometricsTab setIsFullScreen={setIsFullScreen} muscleLoads={muscleLoads} maxLoad={maxLoad} student={student} isFullScreen={isFullScreen} setHoveredMuscle={setHoveredMuscle} completedAssetIds={completedAssetIds} hoveredMuscle={hoveredMuscle} canEdit={canEdit} handleSaveBiometrics={handleSaveBiometrics} t={t} biometricsForm={biometricsForm} setBiometricsForm={setBiometricsForm} isSavingBiometrics={isSavingBiometrics} studentCompositions={studentCompositions} state={state} />}

          <AnatomyStudioModal isOpen={activeTab === 'biometrics' && isFullScreen} onClose={() => setIsFullScreen(false)} student={student} initialGender={student.gender} />
        </div>
      </motion.div>

      {/* Internal Modals */}
      <AnimatePresence>
         {showDeleteConfirm && (
           <Portal>
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
               <div className="w-full max-w-sm bg-white dark:bg-[#0F0F0F] border border-red-500/50 rounded-[8px] p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
                  <h3 className="text-lg font-bold text-red-500 mb-2">{t('confirm_delete_student_title')}</h3>
                  <p className="text-sm text-neutral-600 dark:text-[#E4E4E4] mb-6">{t('confirm_delete_student_desc').replace('Chan Dara', student.englishName)}</p>
                  <div className="flex gap-3">
                     <button
                       onClick={() => setShowDeleteConfirm(false)}
                       disabled={isDeleting}
                       className="flex-1 py-2.5 min-h-[44px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                     >
                       {t('act_cancel')}
                     </button>
                     <button
                       onClick={handleDelete}
                       disabled={isDeleting}
                       className="flex-1 py-2.5 min-h-[44px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-colors shadow-md shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer"
                     >
                       {isDeleting ? (
                         <>
                           <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                           <span>Deleting...</span>
                         </>
                       ) : (
                         t('confirm_delete_btn')
                       )}
                     </button>
                  </div>
                </div>
              </div>
            </Portal>
          )}
           {showSaveConfirm && (
             <Portal>
               <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                 <div className="w-full max-w-sm bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{t('confirm_save_student_title')}</h3>
                    <p className="text-sm text-neutral-500 dark:text-[#999] mb-6">{t('confirm_save_student_desc')}</p>
                    <div className="flex gap-3">
                       <button
                         onClick={() => setShowSaveConfirm(false)}
                         disabled={isSavingProfile}
                         className="flex-1 py-2.5 min-h-[44px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                       >
                         {t('act_cancel')}
                       </button>
                       <button
                         onClick={handleSave}
                         disabled={isSavingProfile}
                         className="flex-1 py-2.5 min-h-[44px] bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-colors shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-2 cursor-pointer"
                       >
                         {isSavingProfile ? (
                           <>
                             <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                             <span>{t('act_saving')}</span>
                           </>
                         ) : (
                           t('confirm_save_btn')
                         )}
                       </button>
                    </div>
                 </div>
               </div>
             </Portal>
           )}
         {showBeltModal && (
           <Portal>
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
               <div className="w-full max-w-md bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white">
                  <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                     <h2 className="text-sm font-bold uppercase tracking-widest">{editingBeltHistoryId !== null ? "Edit Belt Promotion" : t('panel_log_belt_promotion')}</h2>
                     <button onClick={() => { setShowBeltModal(false); setEditingBeltHistoryId(null); }} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4 overflow-y-auto">
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_pass_level_next')}</label>
                         <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500"
                            value={beltForm.beltLevel} onChange={e => {
                               const newLevel = e.target.value;
                               setBeltForm(prev => {
                                 const updated = { ...prev, beltLevel: newLevel };
                                 if (!isCertManual) {
                                   updated.certificateRef = generateCertRef(newLevel, prev.promotionDate);
                                 }
                                 return updated;
                               });
                            }}>
                            <option value="White">{formatBeltLocalized('White', undefined, t)}</option>
                            <option value="Yellow">{formatBeltLocalized('Yellow', undefined, t)}</option>
                            <option value="Green">{formatBeltLocalized('Green', undefined, t)}</option>
                            <option value="Blue">{formatBeltLocalized('Blue', undefined, t)}</option>
                            <option value="Brown">{formatBeltLocalized('Brown', undefined, t)}</option>
                            <option value="Red">{formatBeltLocalized('Red', undefined, t)}</option>
                            <option value="1st Poom/Dan">{formatBeltLocalized('1st Poom/Dan', undefined, t)}</option>
                            <option value="2nd Poom/Dan">{formatBeltLocalized('2nd Poom/Dan', undefined, t)}</option>
                            <option value="3rd Poom/Dan">{formatBeltLocalized('3rd Poom/Dan', undefined, t)}</option>
                            <option value="4th Poom/Dan">{formatBeltLocalized('4th Poom/Dan', undefined, t)}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_promotion_date')}</label>
                        <input type="date" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 [color-scheme:light] dark:[color-scheme:dark]"
                           value={beltForm.promotionDate} onChange={e => {
                             const newDate = e.target.value;
                             setBeltForm(prev => {
                               const updated = { ...prev, promotionDate: newDate };
                               if (!isCertManual) {
                                 updated.certificateRef = generateCertRef(prev.beltLevel, newDate);
                               }
                               return updated;
                             });
                           }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_col_score_opt')}</label>
                        <input type="number" min="0" max="100" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500"
                           value={beltForm.testScore} onChange={e => setBeltForm({...beltForm, testScore: e.target.value})} placeholder={t('panel_placeholder_score')} />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_program')}</label>
                        <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500"
                           value={beltForm.program} onChange={e => setBeltForm({...beltForm, program: e.target.value})}>
                           <option value="Standard Class">{t('panel_program_standard')}</option>
                           <option value="Elite Team">{t('panel_program_elite')}</option>
                           <option value="Private Camp">{t('panel_program_private')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_certificate_ref')} (Optional)</label>
                      <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 font-mono"
                         value={beltForm.certificateRef} onChange={e => {
                           const val = e.target.value.toUpperCase();
                           setIsCertManual(true);
                           setBeltForm(prev => ({ ...prev, certificateRef: val }));
                         }} placeholder={t('panel_placeholder_cert_ref')} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_cert_link_or_kukkiwon')}</label>
                      <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 font-mono"
                         value={beltForm.kukkiwonDanCardId} onChange={e => {
                           const val = e.target.value;
                           setBeltForm({...beltForm, kukkiwonDanCardId: val});
                         }} placeholder={t('panel_placeholder_cert_url')} />
                    </div>
                    <div className="pt-4 flex justify-end gap-2 text-xs">
                      <button onClick={() => { setShowBeltModal(false); setEditingBeltHistoryId(null); }} className="px-4 py-2 min-h-[44px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold uppercase tracking-widest active:scale-95 touch-manipulation flex items-center justify-center">{t('act_cancel')}</button>
                      <button onClick={handleAddBelt} className="px-5 py-2 min-h-[44px] bg-[#EF2F38] hover:opacity-90 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 active:scale-95 touch-manipulation flex items-center justify-center">{t('act_save')}</button>
                    </div>
                 </div>
              </div>
            </div>
           </Portal>
         )}
         {showAchievementModal && (
            <Portal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div role="dialog" aria-modal="true" aria-label="Tournament achievements" className="w-full max-w-3xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-white max-h-[90dvh]">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest">
                         {editingAchievementId !== null ? "Edit Tournament Achievement" : t('panel_log_tournament_achievement')}
                      </h2>
                      <button disabled={isSavingAchievement} onClick={handleCloseAchievementModal} className="p-1 text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>
                   <fieldset disabled={isSavingAchievement} className="p-6 overflow-y-auto space-y-6 min-w-0">
                     <CompetitionEventPicker eventId={achvForm.eventId} eventName={achvForm.eventName} disabled={isSavingAchievement} onChange={(eventId,eventName)=>setAchvForm(current=>({...current,eventId,eventName}))}/>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-500 mb-1">{t('panel_event_name')} *</label>
                         <input aria-label="Achievement event name" readOnly={Boolean(achvForm.eventId)} disabled={isSavingAchievement} type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-neutral-700"
                            value={achvForm.eventName} onChange={e => setAchvForm({...achvForm, eventName: e.target.value})} placeholder="e.g. Korean Ambassador's Cup" />
                       </div>
                       <div>
                         <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-500 mb-1">{t('att_date')} *</label>
                         <input type="date" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-neutral-700 [color-scheme:light] dark:[color-scheme:dark]"
                            value={achvForm.date} onChange={e => setAchvForm({...achvForm, date: e.target.value})} />
                       </div>
                     </div>

                     <div className="space-y-4">
                       <div className="flex justify-between items-center border-b border-neutral-100 dark:border-[#262626] pb-2">
                         <h3 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            {editingAchievementId !== null ? "Event Details" : "Events & Sub-categories"}
                         </h3>
                         {editingAchievementId === null && (
                           <button
                             type="button"
                             onClick={() => setAchvEvents([...achvEvents, { category: 'Recognized Poomsae', division: 'Male Division', medalRank: 'Gold', notes: '', ageDivision: 'No Age Requirement', beltDivision: 'No Belt Requirement' }])}
                             className="text-[9px] text-[#EF2F38] border border-[#EF2F38]/20 bg-[#EF2F38]/5 hover:bg-[#EF2F38]/10 px-2.5 py-1.5 rounded-[8px] font-bold uppercase tracking-wider transition-colors"
                           >
                             + Add Another Event
                           </button>
                         )}
                       </div>

                       <div className="space-y-3">
                         {achvEvents.map((event, idx) => (
                           <div key={idx} className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] relative group/row">
                             {achvEvents.length > 1 && (
                               <button
                                 type="button"
                                 onClick={() => {
                                   if (event.id) {
                                     setDeletedAchvIds(prev => [...prev, event.id!]);
                                   }
                                   setAchvEvents(achvEvents.filter((_, i) => i !== idx));
                                 }}
                                 className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors"
                               >
                                 <Trash className="w-3.5 h-3.5" />
                               </button>
                             )}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                               <div>
                                 <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Category</label>
                                 <select
                                   className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                   value={event.category}
                                   onChange={e => {
                                     const copy = [...achvEvents];
                                     copy[idx].category = e.target.value;
                                     setAchvEvents(copy);
                                   }}
                                 >
                                   <option value="Recognized Poomsae">Recognized Poomsae</option>
                                   <option value="Freestyle Poomsae">Freestyle Poomsae</option>
                                   <option value="Kyorugi (Sparring)">Kyorugi (Sparring)</option>
                                   <option value="Speedkick">Speedkick</option>
                                   <option value="VR TKD">VR TKD</option>
                                   <option value="Demo Team">Demo Team</option>
                                   <option value="Aerobic">Aerobic</option>
                                   <option value="Dance">Dance</option>
                                   <option value="Board Breaking">Board Breaking</option>
                                   <option value="Tricking">Tricking</option>
                                 </select>
                               </div>

                               <div>
                                 <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Division</label>
                                 <select
                                   className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                   value={event.division}
                                   onChange={e => {
                                     const copy = [...achvEvents];
                                     copy[idx].division = e.target.value;
                                     setAchvEvents(copy);
                                   }}
                                 >
                                   <option value="Male Division">Male Individual</option>
                                   <option value="Female Division">Female Individual</option>
                                   <option value="Pair">Pair</option>
                                   <option value="Team">Team</option>
                                   <option value="Mixed Pair">Mixed Pair</option>
                                 </select>
                               </div>

                               <div>
                                 <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Medal / Rank</label>
                                 <select
                                   className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                   value={event.medalRank}
                                   onChange={e => {
                                     const copy = [...achvEvents];
                                     copy[idx].medalRank = e.target.value;
                                     setAchvEvents(copy);
                                   }}
                                 >
                                   <option value="Gold">Gold Medal</option>
                                   <option value="Silver">Silver Medal</option>
                                   <option value="Bronze">Bronze Medal</option>
                                   <option value="Participation">Participant / Ribbon</option>
                                 </select>
                               </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                               <div>
                                 <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Age Division</label>
                                 <select
                                   className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                   value={event.ageDivision || 'No Age Requirement'}
                                   onChange={e => {
                                     const copy = [...achvEvents];
                                     copy[idx].ageDivision = e.target.value;
                                     setAchvEvents(copy);
                                   }}
                                 >
                                    <option value="No Age Requirement">No Age Requirement</option>
                                    <option value="Children (Under 12)">Children (Under 12)</option>
                                    <option value="Cadet (12-14)">Cadet (12-14)</option>
                                    <option value="Junior (15-17)">Junior (15-17)</option>
                                    <option value="Senior (17+)">Senior (17+)</option>
                                    <option value="Senior (18+)">Senior (18+)</option>
                                    <option value="Master (35+)">Master (35+)</option>
                                    <option value="Junior & Senior Mix">Junior & Senior Mix</option>
                                 </select>
                               </div>

                               <div>
                                 <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Belt Division</label>
                                 <select
                                   className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                   value={event.beltDivision || 'No Belt Requirement'}
                                   onChange={e => {
                                     const copy = [...achvEvents];
                                     copy[idx].beltDivision = e.target.value;
                                     setAchvEvents(copy);
                                   }}
                                 >
                                   <option value="No Belt Requirement">No Belt Requirement</option>
                                   <option value="White Belt">White Belt</option>
                                   <option value="Yellow Belt">Yellow Belt</option>
                                   <option value="Green Belt">Green Belt</option>
                                   <option value="Blue Belt">Blue Belt</option>
                                   <option value="Brown Belt">Brown Belt</option>
                                   <option value="Red Belt">Red Belt</option>
                                   <option value="Black Belt (Dan/Poom)">Black Belt (Dan/Poom)</option>
                                   <option value="Color Belt Mix">Color Belt Mix</option>
                                   <option value="Color Belt Only">Color Belt Only</option>
                                   <option value="Black Belt Only (1st Dan+)">Black Belt Only (1st Dan+)</option>
                                 </select>
                               </div>
                             </div>

                             <div className="mt-2.5">
                               <label className="block text-[8px] uppercase font-bold text-neutral-400 mb-1">Notes / Remarks</label>
                               <input
                                 type="text"
                                 className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                                 value={event.notes}
                                 onChange={e => {
                                    const copy = [...achvEvents];
                                    copy[idx].notes = e.target.value;
                                    setAchvEvents(copy);
                                 }}
                                 placeholder="e.g. Score: 7.82, 1st match win by K.O."
                               />
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </fieldset>

                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2 text-xs bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                     <button disabled={isSavingAchievement} onClick={handleCloseAchievementModal} className="px-4 py-2 min-h-[44px] text-neutral-500 hover:text-neutral-950 dark:hover:text-white font-bold uppercase tracking-widest active:scale-95 touch-manipulation flex items-center justify-center">{t('act_cancel')}</button>
                     <button disabled={isSavingAchievement} onClick={handleAddAchievement} className="px-5 py-2 min-h-[44px] bg-[#EF2F38] hover:opacity-90 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 active:scale-95 touch-manipulation flex items-center justify-center">{isSavingAchievement ? 'Saving…' : editingAchievementId !== null ? t('act_save') : t('panel_add_achv_btn')}</button>
                   </div>
                </div>
              </div>
            </Portal>
          )}
         {showBulkBeltModal && <StudentBulkBeltDialog t={t} setShowBulkBeltModal={setShowBulkBeltModal} bulkBelts={bulkBelts} handleUpdateBulkBeltCell={handleUpdateBulkBeltCell} handleRemoveBulkBeltRow={handleRemoveBulkBeltRow} handleAddBulkBeltRow={handleAddBulkBeltRow} isSavingBulkBelt={isSavingBulkBelt} handleSaveBulkBelts={handleSaveBulkBelts} />}
                 {showBulkAchvModal && <StudentBulkAchievementDialog t={t} setShowBulkAchvModal={setShowBulkAchvModal} bulkAchvs={bulkAchvs} handleUpdateBulkAchvCell={handleUpdateBulkAchvCell} handleRemoveBulkAchvRow={handleRemoveBulkAchvRow} handleAddBulkAchvRow={handleAddBulkAchvRow} isSavingBulkAchv={isSavingBulkAchv} handleSaveBulkAchvs={handleSaveBulkAchvs} />}
           {showDossierModal && (
             <StudentDossierModal studentId={student.id} onClose={() => setShowDossierModal(false)} />
           )}
            {showPasswordModal && can('action:staff_manage') && (
              <Portal>
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#1A1A1A] shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[#EF2F38]/10 flex items-center justify-center text-[#EF2F38]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Set Student Password</h3>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">{student.englishName} ({student.id})</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPasswordModal(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-[8px] transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4 overflow-y-auto">
                      <div className="bg-neutral-50 dark:bg-[#1E1E1E] p-3 rounded-[8px] border border-neutral-200 dark:border-[#333] text-xs text-neutral-600 dark:text-neutral-300">
                        Directly set the student&apos;s portal password. They will be able to log in immediately using this password with either their Student ID (<span className="font-mono font-bold text-[#EF2F38]">{student.id}</span>) or Username.
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">New Password</label>
                        <div className="relative">
                          <input
                            type={showPasswordText ? "text" : "password"}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="At least 12 characters"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#333] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] transition-colors pr-10"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswordText(!showPasswordText)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors p-1"
                          >
                            {showPasswordText ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPassword(`TKD${student.id.replace(/[^a-zA-Z0-9]/g, '')}!`)}
                          className="text-[10px] text-neutral-500 hover:text-[#EF2F38] dark:text-neutral-400 font-mono underline cursor-pointer"
                        >
                          Use default: TKD{student.id.replace(/[^a-zA-Z0-9]/g, '')}!
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(false)}
                        className="px-4 py-2 min-h-[44px] text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white uppercase tracking-wider transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                        disabled={isUpdatingPassword}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const targetAcc = state.users.find(u =>
                            (student.profileId && u.id === student.profileId) ||
                            (u.studentId && u.studentId === student.id) ||
                            (u.email && u.email.toLowerCase() === student.email?.toLowerCase()) ||
                            u.username === student.id.toLowerCase().replace(/-/g, '_')
                          );
                          if (targetAcc) {
                            handleSaveStudentPassword(targetAcc.id);
                          } else {
                            showNotification('Portal account not found', 'error');
                          }
                        }}
                        disabled={isUpdatingPassword || !newPassword}
                        className="px-5 py-2 min-h-[44px] bg-[#EF2F38] hover:bg-[#EF2F38]/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 flex items-center gap-2 active:scale-95 touch-manipulation"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <span>Update Password</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Portal>
            )}

            {showProvisionModal && can('action:staff_manage') && (
              <Portal>
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#1A1A1A] shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[#EF2F38]/10 flex items-center justify-center text-[#EF2F38]">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Activate Student Portal Account</h3>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">{student.englishName} • {student.id}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowProvisionModal(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-[8px] transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4 overflow-y-auto">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-[8px] text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Automatic Two-Way Linkage:</strong> This account will be linked to Student ID <span className="font-mono font-bold">{student.id}</span>. When the student logs in, they will only see their own attendance, grades, LMS, and shop orders.
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">Login Username / ID</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={provisionUsername}
                            onChange={e => setProvisionUsername(e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#333] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] transition-colors"
                          />
                        </div>
                        <p className="text-[9px] text-neutral-400 dark:text-[#666]">Student can log in using either this username or <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">{student.id}</span>.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">Portal Email Address</label>
                        <input
                          type="email"
                          value={provisionEmail}
                          onChange={e => setProvisionEmail(e.target.value)}
                          placeholder="e.g. name@portal.infinitytkd.com"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#333] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] transition-colors"
                        />
                        <p className="text-[9px] text-neutral-400 dark:text-[#666]">Used for auth identification. If student has no personal email, a dedicated portal address is auto-generated.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">Initial Password</label>
                        <div className="relative">
                          <input
                            type={showProvisionPasswordText ? "text" : "password"}
                            value={provisionPassword}
                            onChange={e => setProvisionPassword(e.target.value)}
                            placeholder="At least 12 characters"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#333] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] transition-colors pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowProvisionPasswordText(!showProvisionPasswordText)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors p-1"
                          >
                            {showProvisionPasswordText ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowProvisionModal(false)}
                        className="px-4 py-2 min-h-[44px] text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white uppercase tracking-wider transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                        disabled={isProvisioning}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleProvisionStudentAccount}
                        disabled={isProvisioning}
                        className="px-5 py-2 min-h-[44px] bg-[#EF2F38] hover:bg-[#EF2F38]/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 flex items-center gap-2 active:scale-95 touch-manipulation"
                      >
                        {isProvisioning ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Activating...</span>
                          </>
                        ) : (
                          <span>Activate &amp; Link Account</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Portal>
            )}
       </AnimatePresence>
    </>
  );
}
