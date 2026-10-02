'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore, Student, getMembershipBillingStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Phone, 
  Envelope, 
  MapPin, 
  Heart, 
  ShieldWarning, 
  GraduationCap, 
  Trophy, 
  Key, 
  Calendar, 
  IdentificationCard, 
  Certificate,
  Clock,
  Globe,
  GenderMale,
  GenderFemale,
  Check,
  Plus,
  Trash,
  Pencil,
  WarningCircle,
  ArrowsOut,
  ArrowsIn,
  Coins,
  Warning,
  Lock,
  Eye,
  EyeClosed,
  ShieldCheck,
  Copy,
  ArrowSquareOut,
  FileText
} from '@phosphor-icons/react';
import { cn, formatBelt, formatBeltLocalized } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { supabase } from '@/lib/supabase';
import { SafeImage } from '@/components/SafeImage';
import { CAMBODIA_LOCATIONS } from './DataLists';
import { useT } from '@/hooks/useTranslation';
import { StudentDossierModal } from '@/components/StudentDossierModal';
import dynamic from 'next/dynamic';

const Anatomical3DModel = dynamic(
  () => import('./Anatomical3DModel').then(mod => mod.Anatomical3DModel),
  { ssr: false }
);
import { Biomechanical2DScanner } from './2d/Biomechanical2DScanner';

export function ManageStudentPanel({ studentId, onClose }: { studentId: string, onClose: () => void }) {
  const { state, updateStudent, deleteStudent, addBeltHistory, updateBeltHistory, deleteBeltHistory, addAchievement, deleteAchievement, updateAchievement, addUser, updateUser, showNotification, showConfirm, enrollStudent, unenrollStudent, addBodyComposition, payInvoice } = useAppStore();
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
    recordedDate: new Date().toISOString().split('T')[0],
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
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
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
  const [provisionPassword, setProvisionPassword] = useState('Student1234567!');
  const [showProvisionPasswordText, setShowProvisionPasswordText] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);

  interface BulkBeltRow {
    beltLevel: string;
    promotionDate: string;
    testScore: string;
    program: string;
    certificateRef: string;
    kukkiwonDanCardId: string;
    isManualCert: boolean;
  }

  interface BulkAchievementRow {
    eventName: string;
    category: string;
    division: string;
    medalRank: string;
    date: string;
    notes: string;
  }

  const [bulkBelts, setBulkBelts] = useState<BulkBeltRow[]>([]);
  const [bulkAchvs, setBulkAchvs] = useState<BulkAchievementRow[]>([]);
  const [isSavingBulkBelt, setIsSavingBulkBelt] = useState(false);
  const [isSavingBulkAchv, setIsSavingBulkAchv] = useState(false);

  // Forms for new data
  const [beltForm, setBeltForm] = useState({ beltLevel: 'Yellow', promotionDate: new Date().toISOString().split('T')[0], testScore: '', program: 'Standard Class', certificateRef: '', kukkiwonDanCardId: '' });
  const [achvForm, setAchvForm] = useState({ eventName: '', date: new Date().toISOString().split('T')[0] });
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
    const defaultDate = new Date().toISOString().split('T')[0];
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

  const role = state.currentUser?.role;
  const canEdit = role === 'Root' || role === 'Super Root' || role === 'Admin';

  const handleSaveStudentPassword = async (targetUserId: string) => {
    if (!newPassword || newPassword.length < 6) {
      showNotification('Password must be at least 6 characters long.', 'warning');
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
    if (!provisionPassword || provisionPassword.length < 6) {
      showNotification('Initial password must be at least 6 characters long.', 'warning');
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

  // Muscle heatmap calculation helpers
  const getMuscleHeatmapData = () => {
    const loads: Record<string, number> = {};
    const completedProgress = state.videoProgress.filter(
      vp => vp.studentId === student.id && vp.status === 'Completed'
    );
    completedProgress.forEach(progress => {
      const relations = state.assetMuscleRelations.filter(
        r => r.assetId === progress.videoId
      );
      relations.forEach(rel => {
        const muscle = state.muscles.find(m => m.id === rel.muscleId);
        if (muscle) {
          const weight = rel.role === 'Primary' ? 1.0 : 0.5;
          loads[muscle.name] = (loads[muscle.name] || 0) + weight;
        }
      });
    });
    return loads;
  };

  const muscleLoads = getMuscleHeatmapData();
  const maxLoad = Math.max(...Object.values(muscleLoads), 1);



  const getMuscleDisplayName = (muscleName: string) => {
    const muscle = state.muscles.find(m => m.name === muscleName);
    if (!muscle) return muscleName;
    if (state.language === 'kh') return muscle.nameKh || muscle.name;
    if (state.language === 'zh') return muscle.nameZh || muscle.name;
    return muscle.name;
  };





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
      
      const primaryEnroll = state.classEnrollments.find(e => e.studentId === student.id);
      if (primaryEnroll && editForm.classEnrollmentDate && editForm.classEnrollmentDate !== primaryEnroll.enrollmentDate?.split('T')[0]) {
        const { error } = await supabase.from('class_enrollments').update({
          enrollment_date: editForm.classEnrollmentDate
        }).eq('id', primaryEnroll.id);
        if (error) {
          console.error("Failed to update class enrollment date:", error.message);
          showNotification(t('dir_err_update_failed').replace('{error}', error.message), 'error');
          return;
        }
      }

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

  const [isDeleting, setIsDeleting] = useState(false);

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
  const initBulkBeltRow = (level = 'Yellow', dateStr = new Date().toISOString().split('T')[0]): BulkBeltRow => {
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
      date: new Date().toISOString().split('T')[0],
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
    const validRows = bulkBelts.filter(r => r.beltLevel && r.promotionDate);
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
    
    setIsSavingBulkBelt(true);
    try {
      await Promise.all(validRows.map(row => {
        return addBeltHistory({
          studentId: student.id,
          beltLevel: row.beltLevel,
          promotionDate: row.promotionDate,
          testScore: row.testScore ? Number(row.testScore) : undefined,
          program: row.program || undefined,
          certificateRef: row.certificateRef || undefined,
          kukkiwonDanCardId: row.kukkiwonDanCardId || undefined
        });
      }));
      setShowBulkBeltModal(false);
    } catch (e: any) {
      console.error("Bulk belts save failed:", e);
      showNotification("Failed to save some belt promotions. Please try again.", "error");
    } finally {
      setIsSavingBulkBelt(false);
    }
  };

  const handleSaveBulkAchvs = async () => {
    const validRows = bulkAchvs.filter(r => r.eventName.trim() !== '' && r.date);
    if (validRows.length === 0) {
      showNotification("Please add at least one tournament achievement with an event name.", "warning");
      return;
    }
    
    setIsSavingBulkAchv(true);
    try {
      await Promise.all(validRows.map(row => 
        addAchievement({
          studentId: student.id,
          eventName: row.eventName,
          category: row.category,
          division: row.division,
          medalRank: row.medalRank,
          date: row.date,
          notes: row.notes || undefined
        })
      ));
      setShowBulkAchvModal(false);
    } catch (e: any) {
      console.error("Bulk achievements save failed:", e);
      showNotification("Failed to save some tournament achievements. Please try again.", "error");
    } finally {
      setIsSavingBulkAchv(false);
    }
  };


  const handleAddAchievement = async () => {
    if (!achvForm.eventName || achvEvents.length === 0) return;
    
    try {
      if (editingAchievementId !== null) {
        // Edit mode (multi-event update/insert/delete)
        // 1. Process deletes
        if (deletedAchvIds.length > 0) {
          await Promise.all(deletedAchvIds.map(id => deleteAchievement(id)));
        }

        // 2. Process updates and new additions
        await Promise.all(achvEvents.map(event => {
          if (event.id) {
            // Update existing achievement
            return updateAchievement(event.id, {
              eventName: achvForm.eventName,
              date: achvForm.date,
              category: event.category,
              division: event.division,
              medalRank: event.medalRank === 'Participant' ? 'Participation' : event.medalRank,
              notes: event.notes,
              ageDivision: event.ageDivision,
              beltDivision: event.beltDivision
            });
          } else {
            // Insert new achievement
            return addAchievement({
              studentId: student.id,
              eventName: achvForm.eventName,
              date: achvForm.date,
              category: event.category,
              division: event.division,
              medalRank: event.medalRank === 'Participant' ? 'Participation' : event.medalRank,
              notes: event.notes,
              ageDivision: event.ageDivision,
              beltDivision: event.beltDivision
            });
          }
        }));
      } else {
        // Add mode (bulk inserts)
        await Promise.all(achvEvents.map(event => 
          addAchievement({
            studentId: student.id,
            eventName: achvForm.eventName,
            date: achvForm.date,
            category: event.category,
            division: event.division,
            medalRank: event.medalRank === 'Participant' ? 'Participation' : event.medalRank,
            notes: event.notes,
            ageDivision: event.ageDivision,
            beltDivision: event.beltDivision
          })
        ));
      }
      
      // Reset form
      setAchvForm({
        eventName: '',
        date: new Date().toISOString().split('T')[0]
      });
      setAchvEvents([
        { category: 'Recognized Poomsae', division: 'Male Division', medalRank: 'Gold', notes: '', ageDivision: 'No Age Requirement', beltDivision: 'No Belt Requirement' }
      ]);
      setEditingAchievementId(null);
      setDeletedAchvIds([]);
      setShowAchievementModal(false);
    } catch (e) {
      console.error("Failed to save achievements:", e);
    }
  };

  const handleCloseAchievementModal = () => {
    setEditingAchievementId(null);
    setDeletedAchvIds([]);
    setAchvForm({
      eventName: '',
      date: new Date().toISOString().split('T')[0]
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
        transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
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
          if (!student) return null;
          const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments);
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
              <button
                type="button"
                onClick={async () => {
                  const currentMonthIdx = new Date().getMonth();
                  const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
                  const currentYear = new Date().getFullYear();
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
              </button>
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
          {activeTab === 'profile' && (
            isEditing ? (
              <div className="space-y-4">
                {/* 1. Demographics & Identity */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <User className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">1. Demographics &amp; Identity</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_english_name')} *</label>
                      <input 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.englishName || ''} 
                        onChange={e => setEditForm({...editForm, englishName: e.target.value})} 
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_khmer_name')}</label>
                      <input 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-khmer" 
                        value={editForm.khmerName || ''} 
                        onChange={e => setEditForm({...editForm, khmerName: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_gender')}</label>
                      <select 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.gender || 'Male'} 
                        onChange={e => setEditForm({...editForm, gender: e.target.value as 'Male' | 'Female'})}
                      >
                        <option value="Male">{t('stu_male')}</option>
                        <option value="Female">{t('stu_female')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_dob')}</label>
                      <input 
                        type="date" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]" 
                        value={editForm.dob || ''} 
                        onChange={e => setEditForm({...editForm, dob: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_nationality')}</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.nationality || ''} 
                        onChange={e => setEditForm({...editForm, nationality: e.target.value})} 
                        placeholder="e.g. Cambodian"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_profile_pic_link')}</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] flex-1" 
                          value={editForm.profilePicturePath || ''} 
                          onChange={e => setEditForm({...editForm, profilePicturePath: e.target.value})} 
                          placeholder={t('panel_profile_pic_placeholder')} 
                        />
                        {editForm.profilePicturePath && (
                          <SafeImage 
                            src={editForm.profilePicturePath} 
                            alt="Preview" 
                            containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0"
                            fallback={<User className="w-4 h-4 text-neutral-400" />}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Contact Details & Emergency Dossier */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <IdentificationCard className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">2. Contact &amp; Family Dossier</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_phone')}</label>
                      <input 
                        type="tel" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-mono" 
                        value={editForm.phone || ''} 
                        onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                        placeholder="+855 ..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_email')}</label>
                      <input 
                        type="email" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.email || ''} 
                        onChange={e => setEditForm({...editForm, email: e.target.value})} 
                        placeholder="student@example.com"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                      <p className="text-[10px] text-[#EF2F38] uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                        <ShieldWarning className="w-3.5 h-3.5" />
                        <span>{t('panel_guardian_emergency')}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_contact')}</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.emergencyContactName || ''} 
                        onChange={e => setEditForm({...editForm, emergencyContactName: e.target.value})} 
                        placeholder="Guardian full name"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_phone')}</label>
                      <input 
                        type="tel" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-mono" 
                        value={editForm.emergencyContactPhone || ''} 
                        onChange={e => setEditForm({...editForm, emergencyContactPhone: e.target.value})} 
                        placeholder="+855 ..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_relation')}</label>
                      <select 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                        value={editForm.emergencyContactRelation || ''} 
                        onChange={e => setEditForm({...editForm, emergencyContactRelation: e.target.value})}
                      >
                        <option value="">{t('panel_emergency_relation_placeholder')}</option>
                        <option value="Father">{t('panel_relation_father')}</option>
                        <option value="Mother">{t('panel_relation_mother')}</option>
                        <option value="Grandparent">{t('panel_relation_grandparent')}</option>
                        <option value="Sibling">{t('panel_relation_sibling')}</option>
                        <option value="Uncle/Aunt">{t('panel_relation_uncle_aunt')}</option>
                        <option value="Other">{t('panel_relation_other')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Structured Home Address */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <MapPin className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">3. Residential Address</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_street_address')}</label>
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                          value={editForm.address?.line1 || ''} 
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, line1: e.target.value }})} 
                          placeholder="Street address..." 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_apt_suite')}</label>
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]" 
                          value={editForm.address?.line2 || ''} 
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, line2: e.target.value }})} 
                          placeholder="Apartment, unit, etc." 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_state_province')}</label>
                        {editForm.address?.stateProvince && !CAMBODIA_LOCATIONS[editForm.address.stateProvince] ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                              value={editForm.address.stateProvince === 'Other Custom' ? '' : editForm.address.stateProvince}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, stateProvince: e.target.value }})}
                              placeholder={t('panel_custom_address')}
                            />
                            <button 
                              type="button" 
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, stateProvince: '', city: '' }})} 
                              className="px-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-[10px] text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <select 
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.stateProvince || ''}
                            onChange={e => {
                              const newProv = e.target.value;
                              if (newProv === 'Other') {
                                setEditForm({ ...editForm, address: { ...editForm.address, stateProvince: 'Other Custom', city: '' } });
                              } else {
                                const dists = CAMBODIA_LOCATIONS[newProv] || [];
                                setEditForm({ ...editForm, address: { ...editForm.address, stateProvince: newProv, city: dists[0] || '' } });
                              }
                            }}
                          >
                            <option value="">{t('panel_select_province')}</option>
                            {Object.keys(CAMBODIA_LOCATIONS).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                            <option value="Other">{t('panel_relation_other')}</option>
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_district_commune')}</label>
                        {editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince] && (editForm.address.city === 'Other Custom' || (editForm.address.city !== '' && !CAMBODIA_LOCATIONS[editForm.address.stateProvince].includes(editForm.address.city))) ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                              value={editForm.address.city === 'Other Custom' ? '' : editForm.address.city}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                              placeholder={t('panel_custom_district')}
                            />
                            <button 
                              type="button" 
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, city: CAMBODIA_LOCATIONS[editForm.address.stateProvince][0] || '' }})} 
                              className="px-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-[10px] text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince]) ? (
                          <select 
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.city || ''}
                            onChange={e => {
                              if (e.target.value === 'Other') {
                                setEditForm({ ...editForm, address: { ...editForm.address, city: 'Other Custom' } });
                              } else {
                                setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }});
                              }
                            }}
                          >
                            <option value="">{t('panel_select_district')}</option>
                            {CAMBODIA_LOCATIONS[editForm.address.stateProvince].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                            <option value="Other">{t('panel_relation_other')}</option>
                          </select>
                        ) : (
                          <input 
                            type="text" 
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.city || ''}
                            onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                            placeholder={t('panel_custom_district')}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_postal_code')}</label>
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]" 
                          value={editForm.address?.postalCode || ''} 
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, postalCode: e.target.value }})} 
                          placeholder="e.g. 12000"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_country')}</label>
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]" 
                          value={editForm.address?.country || 'Cambodia'} 
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, country: e.target.value }})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Academy & Membership */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <GraduationCap className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">4. Academy Status &amp; Schedules</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_branch')}</label>
                      <select 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]" 
                        value={editForm.homeBranchId || 1} 
                        onChange={e => setEditForm({...editForm, homeBranchId: Number(e.target.value)})}
                      >
                        {state.branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_scholarship')}</label>
                      <select 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]" 
                        value={editForm.scholarshipId || 1} 
                        onChange={e => setEditForm({...editForm, scholarshipId: Number(e.target.value)})}
                      >
                        {state.scholarships.map(s => (
                          <option key={s.id} value={s.id}>{s.typeName} ({s.discountPercentage}%)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_status')}</label>
                      <select 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]" 
                        value={editForm.studentStatus || 'Active'} 
                        onChange={e => setEditForm({...editForm, studentStatus: e.target.value as any})}
                      >
                        <option value="Active">{t('act_active')}</option>
                        <option value="Paused">Paused (Hold)</option>
                        <option value="Inactive">{t('act_inactive')}</option>
                        <option value="Suspended">{t('act_suspended')}</option>
                        <option value="Graduated">{t('act_graduated')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_kukkiwon_card')}</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono" 
                        value={editForm.kukkiwonId || ''} 
                        onChange={e => setEditForm({...editForm, kukkiwonId: e.target.value})} 
                        placeholder="e.g. 05123456 or GDrive Link" 
                      />
                    </div>

                    {(editForm.studentStatus === 'Paused' || editForm.studentStatus === 'Inactive' || editForm.studentStatus === 'Suspended') && (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">Status Reason / Note</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Medical leave, Exam break, Vacation" 
                            className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.statusReason || ''} 
                            onChange={e => setEditForm({...editForm, statusReason: e.target.value})} 
                          />
                        </div>
                        {editForm.studentStatus === 'Paused' && (
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">Expected Return Date</label>
                            <input 
                              type="date" 
                              className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]"
                              value={editForm.pauseEndDate || ''} 
                              onChange={e => setEditForm({...editForm, pauseEndDate: e.target.value})} 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_reg_date_academy')}</label>
                      <input 
                        type="date" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]" 
                        value={editForm.registrationDate || ''} 
                        onChange={e => setEditForm({...editForm, registrationDate: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_class_enroll_date')}</label>
                      <input 
                        type="date" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-50" 
                        value={editForm.classEnrollmentDate || ''} 
                        onChange={e => setEditForm({...editForm, classEnrollmentDate: e.target.value})} 
                        disabled={!primaryEnrollment}
                      />
                      {!primaryEnrollment && (
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-medium">{t('panel_class_enroll_date_hint')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Health Bio & Admin Notes */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <Heart className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">5. Health Bio &amp; Administrative Notes</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_height')} (cm)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono" 
                        value={editForm.heightCm || ''} 
                        onChange={e => setEditForm({...editForm, heightCm: Number(e.target.value)})} 
                        placeholder="e.g. 150"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_weight')} (kg)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono" 
                        value={editForm.weightKg || ''} 
                        onChange={e => setEditForm({...editForm, weightKg: Number(e.target.value)})} 
                        placeholder="e.g. 45"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_medical_notes')}</label>
                      <textarea 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none" 
                        value={editForm.medicalNotes || ''} 
                        onChange={e => setEditForm({...editForm, medicalNotes: e.target.value})} 
                        placeholder="Any health or physical conditions..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_allergies')}</label>
                      <textarea 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none" 
                        value={editForm.allergies || ''} 
                        onChange={e => setEditForm({...editForm, allergies: e.target.value})} 
                        placeholder="Known allergies or dietary restrictions..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_migration_notes')}</label>
                      <textarea 
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none" 
                        value={editForm.notes || ''} 
                        onChange={e => setEditForm({...editForm, notes: e.target.value})} 
                        placeholder={t('panel_migration_placeholder')} 
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky Action Bar */}
                <div className="pt-2 sticky bottom-0 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-sm pb-2 z-10 flex gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowSaveConfirm(true)} 
                    disabled={isSavingProfile}
                    className="flex-1 py-2.5 min-h-[44px] bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {isSavingProfile ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t('act_saving')}</span>
                      </>
                    ) : (
                      t('act_save')
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)} 
                    disabled={isSavingProfile}
                    className="flex-1 py-2.5 min-h-[44px] bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {isMinor && (
                  <div className="bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-[8px] p-4 flex gap-3 items-start shadow-sm">
                    <ShieldWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">{t('panel_minor_alert')}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium">
                        {t('panel_minor_desc').replace('{age}', String(calculateAge()))}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* 4-Metric Quick Dashboard Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('nav_attendance')}</span>
                      <Calendar className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {totalClasses > 0 ? t('panel_classes_count').replace('{attended}', String(attendedClasses)).replace('{total}', String(totalClasses)) : t('panel_no_logs')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_belt')}</span>
                      <Certificate className="w-4 h-4 text-[#EF2F38]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {formatBeltLocalized(student.currentBelt, student.dob, t)}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {beltPromotionsCount > 0 ? t('panel_promotions_count').replace('{count}', String(beltPromotionsCount)) : t('panel_white_belt_level')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_medals_label')}</span>
                      <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {achievementsCount}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {totalCount > 0 ? `${goldCount}G • ${silverCount}S • ${bronzeCount}B` : t('panel_tournament_awards')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('nav_schedule')}</span>
                      <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {activeEnrollmentsCount}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {t('panel_enrolled_sessions')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Structured Student Profile Cards */}
                <div className="space-y-4">
                  {/* Card 1: Demographics & Identity */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#EF2F38]" />
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          1. {t('panel_tab_profile')} {t('panel_overview')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(student.id, 'Student ID')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-400 text-[10px] font-mono font-bold transition-colors cursor-pointer border border-neutral-200 dark:border-[#333]"
                        title="Copy Student ID"
                      >
                        {copiedField === 'Student ID' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{student.id}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_english_name')}</p>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{student.englishName}</p>
                      </div>
                      <div className="space-y-0.5 font-khmer">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider font-sans">{t('stu_khmer_name')}</p>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{student.khmerName || '—'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_dob')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-mono font-bold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{student.dob || '—'}</span>
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-normal">
                            ({calculateAge()} yrs, {getAgeDivision()})
                          </span>
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_nationality')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{student.nationality || 'Cambodian'}</span>
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_gender')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold flex items-center gap-1.5">
                          {student.gender === 'Male' ? (
                            <>
                              <GenderMale className="w-3.5 h-3.5 text-blue-500 font-bold" />
                              <span>{t('stu_male')}</span>
                            </>
                          ) : (
                            <>
                              <GenderFemale className="w-3.5 h-3.5 text-pink-500 font-bold" />
                              <span>{t('stu_female')}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_reg_date')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-mono font-bold">{student.registrationDate || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Contact & Family Dossier */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <IdentificationCard className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        2. {t('panel_contacts_dossier')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_phone')}</p>
                          {student.phone ? (
                            <a href={`tel:${student.phone}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5 truncate">
                              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>{student.phone}</span>
                            </a>
                          ) : (
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                          )}
                        </div>
                        {student.phone && (
                          <button
                            type="button"
                            onClick={() => handleCopy(student.phone!, 'Student Phone')}
                            className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                            title="Copy Phone"
                          >
                            {copiedField === 'Student Phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_email')}</p>
                          {student.email ? (
                            <a href={`mailto:${student.email}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5 truncate" title={student.email}>
                              <Envelope className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">{student.email}</span>
                            </a>
                          ) : (
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                          )}
                        </div>
                        {student.email && (
                          <button
                            type="button"
                            onClick={() => handleCopy(student.email!, 'Student Email')}
                            className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                            title="Copy Email"
                          >
                            {copiedField === 'Student Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Guardian Contact */}
                    <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_guardian_contact')}</span>
                        <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold uppercase tracking-wider px-2 py-0.5 rounded-[8px] flex items-center gap-1">
                          <ShieldWarning className="w-3 h-3" /> {t('stu_emergency_contact')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_guardian_name')}</p>
                          <p className="text-xs text-neutral-900 dark:text-white font-bold mt-0.5">{student.emergencyContactName || '—'}</p>
                          {student.emergencyContactRelation && (
                            <span className="inline-block mt-1 text-[8px] bg-neutral-100 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[8px] border border-neutral-200 dark:border-[#333]">
                              {student.emergencyContactRelation}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_guardian_phone')}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            {student.emergencyContactPhone ? (
                              <a href={`tel:${student.emergencyContactPhone}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{student.emergencyContactPhone}</span>
                              </a>
                            ) : (
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                            )}
                            {student.emergencyContactPhone && (
                              <button
                                type="button"
                                onClick={() => handleCopy(student.emergencyContactPhone!, 'Guardian Phone')}
                                className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                                title="Copy Guardian Phone"
                              >
                                {copiedField === 'Guardian Phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Residential Address */}
                    <div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{t('stf_home_address')}</span>
                      </p>
                      {student.address?.line1 ? (
                        <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px] text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                          <p className="font-bold text-neutral-900 dark:text-white">{student.address.line1}</p>
                          {student.address.line2 && <p className="text-neutral-500 dark:text-neutral-400">{student.address.line2}</p>}
                          <p>{student.address.city}{student.address.stateProvince ? `, ${student.address.stateProvince}` : ''} {student.address.postalCode}</p>
                          <p className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 mt-1 pt-1 border-t border-neutral-100 dark:border-[#262626]">{student.address.country || 'Cambodia'}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{t('panel_address_not_provided')}</p>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Physical & Health Bio */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <Heart className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        3. {t('panel_medical_bio')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_height')}</p>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">{student.heightCm ? `${student.heightCm} cm` : '—'}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_weight')}</p>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">{student.weightKg ? `${student.weightKg} kg` : '—'}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_bmi')}</p>
                        {(() => {
                          const heightM = student.heightCm ? student.heightCm / 100 : 0;
                          const bmiVal = (heightM > 0 && student.weightKg) ? Number((student.weightKg / (heightM * heightM)).toFixed(1)) : null;
                          if (!bmiVal) return <p className="text-sm text-neutral-400 dark:text-neutral-500 italic mt-1">—</p>;
                          
                          const getBmiInfo = (val: number) => {
                            if (val < 18.5) return { label: 'Underweight', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' };
                            if (val < 25) return { label: 'Normal', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
                            if (val < 30) return { label: 'Overweight', color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20' };
                            return { label: 'Obese', color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' };
                          };
                          const info = getBmiInfo(bmiVal);
                          return (
                            <div className="mt-1 flex flex-col items-center gap-1">
                              <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white">{bmiVal}</p>
                              <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", info.color)}>
                                {info.label}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38]"></span>
                          <span>{t('stu_medical_notes')}</span>
                        </p>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                          {student.medicalNotes || <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_medical')}</span>}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>{t('stu_allergies')}</span>
                        </p>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                          {student.allergies || <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_allergies')}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Academy Status & Schedules */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <GraduationCap className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        4. {t('panel_status_schedules')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_branch')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold">
                          {state.branches.find(b => b.id === student.homeBranchId)?.name || t('stu_unassigned_branch')}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_scholarship')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold">
                          {(() => {
                            const sch = state.scholarships.find(s => s.id === student.scholarshipId);
                            if (!sch || sch.typeName === 'None') return t('panel_none');
                            return `${sch.typeName} (${sch.discountPercentage}%)`;
                          })()}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_status')}</p>
                        <div>
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border inline-block",
                            student.studentStatus === 'Active' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                            student.studentStatus === 'Paused' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                            student.studentStatus === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700" :
                            student.studentStatus === 'Suspended' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                            "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          )}>
                            {student.studentStatus}
                          </span>
                        </div>
                        {student.statusReason && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            {student.statusReason} {student.pauseEndDate && `(Until ${student.pauseEndDate})`}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-2 md:col-span-3 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-1.5">{t('panel_kukkiwon_card')}</p>
                        {student.kukkiwonId ? (
                          student.kukkiwonId.startsWith('http://') || student.kukkiwonId.startsWith('https://') || student.kukkiwonId.includes('drive.google.com') ? (
                            <a
                              href={student.kukkiwonId}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#EF2F38]/10 hover:bg-[#EF2F38]/20 border border-[#EF2F38]/20 text-[#EF2F38] text-xs font-bold transition-colors"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>{t('panel_open_gdrive_cert')}</span>
                              <ArrowSquareOut className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                            </a>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626]">
                              <span className="w-2 h-2 rounded-full bg-[#EF2F38]"></span>
                              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">{student.kukkiwonId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(student.kukkiwonId!, 'Kukkiwon ID')}
                                className="p-1 hover:text-[#EF2F38] text-neutral-400 transition-colors cursor-pointer"
                                title="Copy ID"
                              >
                                {copiedField === 'Kukkiwon ID' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )
                        ) : (student.currentBelt.includes('Poom') || student.currentBelt.includes('Dan')) ? (
                          <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider inline-block">{t('panel_missing_id')}</span>
                        ) : (
                          <span className="text-[9px] bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-400 dark:text-neutral-500 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider inline-block">{t('panel_not_applicable')}</span>
                        )}
                      </div>
                    </div>

                    {/* Class Schedules & Manager */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-[#262626] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_active_schedule_coach')}</p>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setShowScheduleManager(!showScheduleManager)}
                            className="text-[10px] font-bold uppercase tracking-wider text-[#EF2F38] hover:opacity-80 cursor-pointer"
                          >
                            {showScheduleManager ? t('panel_close_manager') : t('panel_manage_schedules')}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {state.classEnrollments.filter(e => e.studentId === student.id).length > 0 ? (
                          state.classEnrollments.filter(e => e.studentId === student.id).map(e => {
                            const cls = state.classSessions.find(c => c.id === e.classId);
                            if (!cls) return null;
                            const coach = state.users.find(u => u.id === cls.coachId);
                            const coachName = coach ? coach.displayName : t('act_tba');

                            return (
                              <div key={e.id} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#1A1A1A] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38] shrink-0"></span>
                                  <span className="font-bold text-neutral-900 dark:text-white">{cls.name}</span>
                                  <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                                    ({cls.daysOfWeek?.join(', ') || cls.dayOfWeek} • {cls.startTime} - {cls.endTime})
                                  </span>
                                  {e.enrollmentDate && (
                                    <span className="text-[9px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#333]">
                                      {t('sch_enrolled')}: {e.enrollmentDate.split('T')[0]}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-bold">{t('panel_coach_label')}</span>
                                  <span className="text-[10px] font-bold text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[8px] border border-red-500/10">{coachName}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 italic flex items-center gap-1.5 py-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{t('panel_no_enrolled_classes')}</span>
                          </p>
                        )}
                      </div>

                      {showScheduleManager && (
                        <div className="mt-3 p-4 bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-3">
                          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Class Enrollment Manager</span>
                            <span className="text-[9px] font-mono text-neutral-400">Branch Classes</span>
                          </div>

                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                            {state.classSessions.filter(c => c.branchId === student.homeBranchId).length === 0 ? (
                              <p className="text-xs text-neutral-400 italic text-center py-4">No class sessions scheduled for this student's branch.</p>
                            ) : (
                              state.classSessions.filter(c => c.branchId === student.homeBranchId).map(c => {
                                const isEnrolled = state.classEnrollments.some(e => e.studentId === student.id && e.classId === c.id);
                                const enrolledCount = state.classEnrollments.filter(e => e.classId === c.id && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
                                const isFull = enrolledCount >= c.capacity;
                                const capacityPct = c.capacity > 0 ? Math.min(100, Math.round((enrolledCount / c.capacity) * 100)) : 0;
                                const conflicts = getConflictsForClass(c.id);

                                return (
                                  <div
                                    key={c.id}
                                    className={cn(
                                      "p-3 rounded-[8px] border text-xs flex flex-col justify-between gap-2.5 bg-neutral-50 dark:bg-[#141414] transition-all",
                                      isEnrolled
                                        ? "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-500/5 shadow-sm"
                                        : conflicts.length > 0
                                          ? "border-red-500/20 bg-red-500/5"
                                          : "border-neutral-200 dark:border-[#262626]"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-neutral-900 dark:text-white">{c.name}</span>
                                          <span className={cn(
                                            "px-1.5 py-0.5 rounded-[8px] text-[8px] font-bold uppercase tracking-wider border",
                                            c.classType === 'Elite Team' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                            c.classType === 'Kid Class' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' :
                                            c.classType === 'Private Class' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                          )}>
                                            {c.classType}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                                          {c.daysOfWeek?.join(', ') || c.dayOfWeek} • {c.startTime} - {c.endTime}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isFull && !isEnrolled}
                                        onClick={async () => {
                                          if (isEnrolled) {
                                            await unenrollStudent(student.id, c.id);
                                          } else {
                                            await enrollStudent(student.id, c.id);
                                          }
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 rounded-[8px] text-[9px] font-bold uppercase tracking-wider transition-all select-none border disabled:opacity-40 cursor-pointer",
                                          isEnrolled
                                            ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                                            : "bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-[#EF2F38] hover:text-white border-transparent"
                                        )}
                                      >
                                        {isEnrolled ? 'Remove' : 'Enroll'}
                                      </button>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                                        <span>Occupancy: {enrolledCount} / {c.capacity}</span>
                                        <span>{capacityPct}%</span>
                                      </div>
                                      <div className="w-full bg-neutral-200 dark:bg-[#262626] rounded-full h-1 overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all duration-300",
                                            capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                          )}
                                          style={{ width: `${capacityPct}%` }}
                                        />
                                      </div>
                                    </div>

                                    {conflicts.length > 0 && !isEnrolled && (
                                      <div className="flex flex-col gap-1">
                                        {conflicts.map((conf, idx) => (
                                          <div key={idx} className="flex items-center gap-1 text-[9px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-[8px] font-medium">
                                            <WarningCircle className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{t('panel_schedule_overlap').replace('{conf}', conf)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 5: Portal Access & Security */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    {(() => {
                      const studentAccount = state.users.find(u => 
                        (student.profileId && u.id === student.profileId) ||
                        (u.studentId && u.studentId === student.id) ||
                        (u.email && u.email.toLowerCase() === student.email?.toLowerCase()) || 
                        u.username === student.id.toLowerCase().replace(/-/g, '_')
                      );

                      if (studentAccount) {
                        const isLinkedToId = studentAccount.studentId === student.id || student.profileId === studentAccount.id;
                        return (
                          <>
                            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-[#EF2F38]" />
                                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_portal_access')}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border flex items-center gap-1",
                                  isLinkedToId
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                )}>
                                  <ShieldCheck className="w-3 h-3" />
                                  {isLinkedToId ? "Linked (Student ID)" : "Email Matched"}
                                </span>
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border",
                                  studentAccount.isActive
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                )}>
                                  {studentAccount.isActive ? t('act_active') : t('act_blocked')}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_username_id')}</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-neutral-800 dark:text-white font-mono text-xs flex items-center justify-between">
                                  <span className="truncate">@{studentAccount.username}</span>
                                  <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 font-mono shrink-0 ml-1">[{student.id}]</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">Account Email</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-neutral-700 dark:text-neutral-300 font-mono text-xs truncate" title={studentAccount.email}>
                                  {studentAccount.email}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_system_role')}</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-[#EF2F38] font-mono text-xs font-bold">
                                  {studentAccount.role === 'Admin' ? t('role_admin') :
                                   studentAccount.role === 'Head Coach' ? t('role_head_coach') :
                                   studentAccount.role === 'Coach' ? t('role_coach') :
                                   studentAccount.role === 'Assistant Coach' ? t('role_assistant_coach') :
                                   studentAccount.role === 'Student' ? t('role_student') :
                                   studentAccount.role === 'Root' || studentAccount.role === 'Super Root' ? t('role_root') :
                                   studentAccount.role}
                                </div>
                              </div>
                            </div>

                            {canEdit && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={studentAccount.isActive} 
                                    onChange={async (e) => {
                                      try {
                                        await updateUser(studentAccount.id, { isActive: e.target.checked });
                                        showNotification(`Student portal access ${e.target.checked ? 'activated' : 'deactivated'}.`, 'success');
                                      } catch (err: any) {
                                        showNotification(err.message || 'Failed to toggle portal access', 'error');
                                      }
                                    }}
                                    className="w-4 h-4 bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded text-[#EF2F38] focus:ring-[#EF2F38] cursor-pointer"
                                  />
                                  <span className="text-xs text-neutral-700 dark:text-neutral-300 uppercase font-bold tracking-wider">{t('panel_enable_portal')}</span>
                                </label>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setNewPassword('');
                                      setShowPasswordModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-[#EF2F38]/10 hover:bg-[#EF2F38]/20 border border-[#EF2F38]/30 text-[#EF2F38] text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Set / Change Password</span>
                                  </button>
                                  {student.email && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        showConfirm(t('panel_send_reset').replace('{name}', student.englishName).replace('{email}', student.email || ''), async () => {
                                          const { error } = await supabase.auth.resetPasswordForEmail(student.email!, {
                                            redirectTo: `${window.location.origin}/reset-password`
                                          });
                                          if (error) {
                                            showNotification(t('panel_reset_failed').replace('{error}', error.message), 'error');
                                          } else {
                                            showNotification(t('panel_reset_success').replace('{email}', student.email || ''), 'success');
                                          }
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all cursor-pointer"
                                    >
                                      {t('panel_reset_password')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      } else {
                        return (
                          <>
                            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-[#EF2F38]" />
                                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_portal_access')}</h3>
                              </div>
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider">{t('panel_no_account')}</span>
                            </div>
                            <div className="text-center py-3 space-y-3">
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md mx-auto">
                                Student has no active Portal account. Provisioning will allow the student to log in using their Student ID (<span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{student.id}</span>).
                              </p>
                              {canEdit && (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setProvisionUsername(student.id.toLowerCase().replace(/-/g, '_'));
                                    setProvisionEmail(student.email || `${student.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@portal.infinitytkd.com`);
                                    setProvisionPassword('Student1234567!');
                                    setShowProvisionModal(true);
                                  }}
                                  className="px-4 py-2 bg-[#EF2F38] hover:bg-[#EF2F38]/90 text-white text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 inline-flex items-center gap-2 cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>{t('panel_btn_provision_portal')}</span>
                                </button>
                              )}
                            </div>
                          </>
                        );
                      }
                    })()}
                  </div>

                  {/* Card 6: Administrative Notes */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_migration_notes')}</h3>
                    </div>
                    <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                      {student.notes ? (
                        <p className="whitespace-pre-wrap">{student.notes}</p>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_admin_notes')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="pt-4 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowDossierModal(true)} 
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black py-2.5 px-4 min-h-[44px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                  >
                    <IdentificationCard className="w-4 h-4 shrink-0" />
                    <span>{t('panel_tab_profile') === 'ប្រវត្តិរូប' ? 'ទាញយកប្រវត្តិរូបសិស្ស' : t('panel_tab_profile') === '个人资料' ? '下载学生档案' : 'Download Student Dossier'}</span>
                  </button>

                  {canEdit && (
                    <div className="flex flex-1 gap-2">
                      <button 
                        type="button"
                        onClick={() => setIsEditing(true)} 
                        className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-800 dark:text-white py-2.5 px-4 min-h-[44px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all border border-neutral-200 dark:border-[#262626] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t('panel_edit_student_profile')}</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="px-4 py-2.5 min-h-[44px] bg-red-500/10 hover:bg-[#EF2F38] text-[#EF2F38] hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all border border-red-500/20 hover:border-[#EF2F38] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>{t('act_delete')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {activeTab === 'belts' && (
            <div className="space-y-6">
               <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-100 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-white">{t('panel_tab_belts')}</h3>
                   {canEdit && (
                     <div className="flex gap-2">
                       <button onClick={handleOpenBulkBeltModal} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         {t('panel_bulk_log_btn')}
                       </button>
                       <button onClick={handleOpenBeltModal} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         + {t('panel_add_belt_btn')}
                       </button>
                     </div>
                   )}
                 </div>
                 <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                   {beltHistory.length === 0 ? (
                     <p className="p-4 text-xs text-neutral-500 dark:text-[#666] text-center italic">{t('panel_no_promotion_records')}</p>
                   ) : beltHistory.map((h, i) => (
                     <div key={h.id} className="p-4 flex flex-col gap-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#1A1A1A] transition-colors relative group">
                       <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                             <span className={cn(
                              "w-3 h-3 rounded-full border shadow-sm shrink-0",
                              h.beltLevel.includes('Poom') || h.beltLevel.includes('Dan') ? "bg-black border-[#444]" : 
                              h.beltLevel === 'Red' ? "bg-red-500 border-red-600" :
                              h.beltLevel === 'Brown' ? "bg-[rgb(139,69,19)] border-[rgb(101,67,33)]" :
                              h.beltLevel === 'Blue' ? "bg-blue-500 border-blue-600" :
                              h.beltLevel === 'Green' ? "bg-green-500 border-green-600" :
                              h.beltLevel === 'White' ? "bg-white border-[#E4E4E4]" :
                              "bg-yellow-500 border-yellow-600"
                           )} />
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                {state.language === 'en' ? `${formatBeltLocalized(h.beltLevel, student.dob, t)} Belt` : formatBeltLocalized(h.beltLevel, student.dob, t)}
                              </p>
                              {i === 0 && <p className="text-[10px] text-green-600 dark:text-green-500 uppercase tracking-widest font-bold">{t('panel_current_rank')}</p>}
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <p className="text-xs font-mono text-neutral-500 dark:text-[#666] group-hover:opacity-0 transition-opacity">{h.promotionDate}</p>
                           {canEdit && (
                             <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button
                                 onClick={() => handleStartEditBelt(h)}
                                 className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors"
                                 title="Edit Promotion"
                               >
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 onClick={() => {
                                   showConfirm("Are you sure you want to delete this promotion record? This will revert the student's current belt to the highest remaining logged promotion rank.", async () => {
                                     try {
                                       await deleteBeltHistory(h.id, student.id);
                                       showNotification("Promotion record deleted.", 'success');
                                     } catch (err: any) {
                                       showNotification(err.message || "Failed to delete promotion record.", 'error');
                                     }
                                   });
                                 }}
                                 className="text-neutral-400 hover:text-red-500 p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors cursor-pointer"
                                 title="Delete Promotion"
                               >
                                 <X className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           )}
                         </div>
                       </div>
                       
                       {(h.testScore !== undefined || h.program || h.certificateRef) && (
                         <div className="ml-6 mt-2 pt-2 border-t border-neutral-200 dark:border-[#262626] grid grid-cols-2 gap-2 text-xs">
                           {h.program && (
                             <div className="text-neutral-600 dark:text-[#999]"><span className="text-neutral-400 dark:text-[#666]">{t('panel_program')}:</span> <span className="text-neutral-900 dark:text-white font-medium">{h.program}</span></div>
                           )}
                           {h.testScore !== undefined && (
                             <div className="text-neutral-600 dark:text-[#999]"><span className="text-neutral-400 dark:text-[#666]">{t('panel_score')}:</span> <span className="text-emerald-500 dark:text-emerald-400 font-mono font-bold">{h.testScore}/100</span></div>
                           )}
                           {h.certificateRef && (
                             <div className="text-neutral-600 dark:text-[#999] col-span-2 mt-1">
                               <span className="text-neutral-400 dark:text-[#666] text-[10px] uppercase font-bold tracking-widest mr-2 inline-block">{t('panel_certificate_ref')}:</span> 
                               <span className="font-mono text-neutral-800 dark:text-white text-[10px] tracking-tight bg-neutral-200 dark:bg-[#262626] px-2 py-0.5 rounded font-bold">{h.certificateRef}</span>
                             </div>
                           )}
                           {h.kukkiwonDanCardId && (
                              <div className="text-neutral-600 dark:text-[#999] col-span-2 mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-red-500 dark:text-red-400 text-[10px] uppercase font-bold tracking-widest mr-2 inline-block">{h.kukkiwonDanCardId.startsWith('http') || h.kukkiwonDanCardId.includes('drive.google.com') ? `${t('panel_certificate_ref')}:` : `${t('panel_kukkiwon_card')}:`}</span> 
                                {h.kukkiwonDanCardId.startsWith('http') || h.kukkiwonDanCardId.includes('drive.google.com') ? (
                                  <a 
                                    href={h.kukkiwonDanCardId} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400 font-bold hover:underline bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded"
                                  >
                                    <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                    {t('panel_open_gdrive_cert')}
                                  </a>
                                ) : (
                                  <span className="font-mono text-red-500 dark:text-red-400 text-[10px] tracking-tight bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-bold">{h.kukkiwonDanCardId}</span>
                                )}
                              </div>
                            )}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6">
               <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-100 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('panel_tournament_achievements')}</h3>
                   {canEdit && (
                     <div className="flex gap-2">
                       <button onClick={handleOpenBulkAchvModal} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         {t('panel_bulk_log_btn')}
                       </button>
                       <button onClick={() => setShowAchievementModal(true)} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         + {t('panel_add_achv_btn')}
                       </button>
                     </div>
                   )}
                 </div>

                 {/* Total Medals Dashboard */}
                 <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/30 dark:bg-[#141414]/30 divide-x divide-neutral-200 dark:divide-[#262626] text-center">
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-[9px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Total</span>
                      <span className="text-lg font-black text-neutral-800 dark:text-white mt-1 font-mono">{totalCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Gold
                      </span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">{goldCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Silver
                      </span>
                      <span className="text-lg font-black text-slate-600 dark:text-slate-300 mt-1 font-mono">{silverCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center">
                      <span className="text-[9px] uppercase font-bold text-orange-600 dark:text-orange-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Bronze
                      </span>
                      <span className="text-lg font-black text-orange-600 dark:text-orange-400 mt-1 font-mono">{bronzeCount}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-center items-center col-span-2 sm:col-span-1 border-t sm:border-t-0 border-neutral-200 dark:border-[#262626]">
                      <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-500 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Participate
                      </span>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">{participantCount}</span>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#111] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search event, notes..."
                        value={achvSearch}
                        onChange={e => setAchvSearch(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-3 pr-8 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                      />
                      {achvSearch && (
                        <button
                          onClick={() => setAchvSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-950 dark:hover:text-white text-[10px] font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div>
                      <select
                        value={achvMedalFilter}
                        onChange={e => setAchvMedalFilter(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="all">All Medals / Ranks</option>
                        <option value="Gold">Gold Medal</option>
                        <option value="Silver">Silver Medal</option>
                        <option value="Bronze">Bronze Medal</option>
                        <option value="Participant">Participation / Ribbon</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={achvYearFilter}
                        onChange={e => setAchvYearFilter(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="all">All Years</option>
                        {uniqueYears.map(yr => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={achvSort}
                        onChange={e => setAchvSort(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="medal-desc">Medal: High to Low</option>
                        <option value="medal-asc">Medal: Low to High</option>
                        <option value="name-asc">Event: A to Z</option>
                      </select>
                    </div>
                  </div>

                 <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                   {achievements.length === 0 ? (
                     <p className="p-4 text-xs text-neutral-500 dark:text-neutral-500 text-center italic">{t('panel_no_tournament_achievements')}</p>
                   ) : (() => {
                     const MEDAL_STYLES: Record<string, { badge: string; text: string; icon: string }> = {
                       'Gold': {
                         badge: 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/30 dark:border-amber-500/10 text-amber-600 dark:text-amber-400',
                         text: 'text-amber-600 dark:text-amber-400',
                         icon: 'text-amber-500 animate-pulse'
                       },
                       'Silver': {
                         badge: 'bg-neutral-500/10 dark:bg-neutral-500/5 border-neutral-500/30 dark:border-neutral-500/10 text-neutral-600 dark:text-neutral-400',
                         text: 'text-neutral-600 dark:text-neutral-400',
                         icon: 'text-neutral-400'
                       },
                       'Bronze': {
                         badge: 'bg-orange-500/10 dark:bg-orange-500/5 border-orange-500/30 dark:border-orange-500/10 text-orange-600 dark:text-orange-400',
                         text: 'text-orange-600 dark:text-orange-400',
                         icon: 'text-orange-500'
                       },
                       'Participant': {
                         badge: 'bg-blue-500/10 dark:bg-blue-500/5 border-blue-500/30 dark:border-blue-500/10 text-blue-600 dark:text-blue-400',
                         text: 'text-blue-600 dark:text-blue-400',
                         icon: 'text-blue-500'
                       },
                       'Participation': {
                         badge: 'bg-blue-500/10 dark:bg-blue-500/5 border-blue-500/30 dark:border-blue-500/10 text-blue-600 dark:text-blue-400',
                         text: 'text-blue-600 dark:text-blue-400',
                         icon: 'text-blue-500'
                       }
                     };
                     
                     return achievements.map((a) => {
                       const medalStyle = MEDAL_STYLES[a.medalRank] || MEDAL_STYLES['Participant'];
                       return (
                         <div key={a.id} className="p-4 bg-neutral-50 hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#1A1A1A] transition-colors relative group">
                           {canEdit && (
                              <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingAchievementId(a.id);
                                    setAchvForm({
                                      eventName: a.eventName,
                                      date: a.date
                                    });
                                    // Load all events for this student from the same tournament and date
                                    const siblings = state.achievements.filter(x => x.studentId === student.id && x.eventName === a.eventName && x.date === a.date);
                                    setAchvEvents(siblings.map(s => ({
                                      id: s.id,
                                      category: s.category,
                                      division: s.division,
                                      medalRank: s.medalRank === 'Participation' ? 'Participant' : s.medalRank,
                                      notes: s.notes || '',
                                      ageDivision: s.ageDivision || 'No Age Requirement',
                                      beltDivision: s.beltDivision || 'No Belt Requirement'
                                    })));
                                    setDeletedAchvIds([]);
                                    setShowAchievementModal(true);
                                  }}
                                  className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors"
                                  title="Edit Achievement"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirm(t('panel_confirm_delete_achv'), async () => {
                                      try {
                                        await deleteAchievement(a.id);
                                        showNotification("Tournament achievement deleted.", 'success');
                                      } catch (err: any) {
                                        showNotification(err.message || "Failed to delete achievement.", 'error');
                                      }
                                    });
                                  }}
                                  className="text-neutral-400 hover:text-red-500 p-1 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors cursor-pointer"
                                  title="Delete Achievement"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                           <p className="text-sm font-bold text-neutral-900 dark:text-white pr-8 tracking-tight">{a.eventName}</p>
                           <div className="flex flex-wrap items-center gap-2 mt-2 mb-2.5">
                             <span className={cn("px-2 py-0.5 rounded-[8px] text-[8px] font-black uppercase tracking-widest border flex items-center gap-1 shadow-sm", medalStyle.badge)}>
                               <Trophy className={cn("w-3 h-3", medalStyle.icon)} weight="fill" />
                               <span>
                                 {a.medalRank === 'Gold' ? t('panel_medal_gold') :
                                  a.medalRank === 'Silver' ? t('panel_medal_silver') :
                                  a.medalRank === 'Bronze' ? t('panel_medal_bronze') :
                                  a.medalRank === 'Participant' ? t('panel_medal_participant') :
                                  a.medalRank}
                               </span>
                             </span>
                             <span className="text-[9px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded-[8px] font-bold uppercase tracking-wider font-mono">
                               {a.category === 'Recognized Poomsae' ? t('panel_event_poomsae') :
                                a.category === 'Freestyle Poomsae' ? t('panel_event_freestyle') :
                                a.category === 'Demonstration' ? t('panel_event_demo') :
                                a.category === 'Tricking' ? t('panel_event_tricking') :
                                a.category}
                             </span>
                           </div>
                           <div className="text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-medium">
                             <div className="flex items-center gap-1.5">
                               <span className="text-neutral-400 dark:text-neutral-500 uppercase text-[9px] font-bold tracking-widest">{t('stu_division')}:</span>
                               <span>
                                  {a.division === 'Male Individual' || a.division === 'Male Division' ? t('panel_div_male_indiv') :
                                   a.division === 'Female Individual' || a.division === 'Female Division' ? t('panel_div_female_indiv') :
                                   a.division === 'Pair' ? t('panel_div_pair') :
                                   a.division === 'Team' ? t('panel_div_team') :
                                   a.division}
                               </span>
                             </div>
                             {a.ageDivision && a.ageDivision !== 'No Age Requirement' && (
                               <div className="flex items-center gap-1.5">
                                 <span className="text-neutral-300 dark:text-[#262626]">•</span>
                                 <span className="text-neutral-400 dark:text-neutral-500 uppercase text-[9px] font-bold tracking-widest">Age:</span>
                                 <span>{a.ageDivision}</span>
                               </div>
                             )}
                             {a.beltDivision && a.beltDivision !== 'No Belt Requirement' && (
                               <div className="flex items-center gap-1.5">
                                 <span className="text-neutral-300 dark:text-[#262626]">•</span>
                                 <span className="text-neutral-400 dark:text-neutral-500 uppercase text-[9px] font-bold tracking-widest">Belt:</span>
                                 <span>{a.beltDivision}</span>
                               </div>
                             )}
                           </div>
                           {a.notes && (
                             <div className="mt-2.5 p-3 rounded-[8px] bg-neutral-100/50 dark:bg-[#0F0F0F] border border-neutral-200/50 dark:border-transparent text-xs text-neutral-600 dark:text-neutral-400 italic font-medium leading-relaxed">
                               &quot;{a.notes}&quot;
                             </div>
                           )}
                           <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 mt-3">{a.date}</p>
                         </div>
                       );
                     });
                   })()}
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'biometrics' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-neutral-900 dark:text-white">
              {/* Visualization Card */}
              <div className="xl:col-span-5 flex flex-col space-y-4">
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100 dark:border-[#262626]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                      {t('bio_muscle_loading_heatmap')}
                    </h3>
                    
                    <div className="flex items-center">
                      {/* Segmented picker */}
                      <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-[8px] border border-neutral-200 dark:border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setViewMode('2d')}
                          className={cn(
                            "px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[8px] transition-all",
                            viewMode === '2d'
                              ? "bg-[#EF2F38] text-white shadow-sm"
                              : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                          )}
                        >
                          2D
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('3d')}
                          className={cn(
                            "px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[8px] transition-all",
                            viewMode === '3d'
                              ? "bg-[#EF2F38] text-white shadow-sm"
                              : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                          )}
                        >
                          3D
                        </button>
                      </div>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={() => setIsFullScreen(true)}
                        className="p-1 bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white rounded-[8px] border border-neutral-200 dark:border-neutral-800 transition-colors ml-2"
                        title="Fullscreen Mode"
                      >
                        <ArrowsOut size={13} weight="bold" />
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic Area */}
                  {viewMode === '2d' ? (
                    <div className="flex justify-around items-center py-4 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626]/50 rounded-[8px] relative min-h-[300px]">
                      <Biomechanical2DScanner
                        muscleLoads={muscleLoads}
                        maxLoad={maxLoad}
                        gender={student.gender}
                        scale={0.9}
                        interactive={true}
                        onHoverMuscle={setHoveredMuscle}
                      />
                    </div>
                  ) : (
                    <div className="min-h-[300px] flex items-center justify-center bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626]/50 rounded-[8px] p-2 relative">
                      <Anatomical3DModel muscleLoads={muscleLoads} maxLoad={maxLoad} gender={student.gender} />
                    </div>
                  )}

                  {/* Color Key legend */}
                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2 p-3 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626]/50 rounded-[8px] text-[9px] font-mono text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-[8px]" />
                      <span>Resting (0)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-orange-500/50 border border-orange-500 rounded-[8px]" />
                      <span>Developing (Low)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-red-600/85 border border-red-500 rounded-[8px]" />
                      <span>Targeted (High)</span>
                    </div>
                  </div>

                  {Object.keys(muscleLoads).length === 0 && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-[8px] text-[10px] leading-relaxed font-mono">
                      {t('bio_no_load_warning')}
                    </div>
                  )}
                </div>
              </div>

              {/* Form and History Section */}
              <div className="xl:col-span-7 space-y-6">
                {/* Form Container */}
                {canEdit && (
                  <form onSubmit={handleSaveBiometrics} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm space-y-4">
                    <div className="border-b border-neutral-100 dark:border-[#262626] pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                        Record Biometrics & Composition
                      </h3>
                      <p className="text-[10px] text-neutral-400 dark:text-[#666] uppercase font-bold tracking-wider mt-0.5">Time-Series Snapshot Logger</p>
                    </div>
                    
                    {/* SECTION 1: Vitals */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_date')}</label>
                        <input 
                          type="date"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.recordedDate}
                          onChange={e => setBiometricsForm({...biometricsForm, recordedDate: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_height')} *</label>
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="cm"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.heightCm}
                          onChange={e => setBiometricsForm({...biometricsForm, heightCm: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_weight')} *</label>
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="kg"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.weightKg}
                          onChange={e => setBiometricsForm({...biometricsForm, weightKg: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {/* SECTION 2: Composition */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100 dark:border-[#262626] pt-3">
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_body_fat')} (%)</label>
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="e.g. 15.5"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.bodyFatPercentage}
                          onChange={e => setBiometricsForm({...biometricsForm, bodyFatPercentage: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_skeletal_muscle')} (kg)</label>
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="e.g. 32.0"
                          className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={biometricsForm.skeletalMuscleMassKg}
                          onChange={e => setBiometricsForm({...biometricsForm, skeletalMuscleMassKg: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* SECTION 3: Torso Girths */}
                    <div className="border-t border-neutral-100 dark:border-[#262626] pt-4">
                      <h4 className="text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] font-mono tracking-wider mb-2">// Torso Circumferences</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_neck')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.neckCm}
                            onChange={e => setBiometricsForm({...biometricsForm, neckCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_shoulder_width')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.shoulderWidthCm}
                            onChange={e => setBiometricsForm({...biometricsForm, shoulderWidthCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_chest')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.chestCm}
                            onChange={e => setBiometricsForm({...biometricsForm, chestCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_waist')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.waistCm}
                            onChange={e => setBiometricsForm({...biometricsForm, waistCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_hips')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="cm"
                            value={biometricsForm.hipsCm}
                            onChange={e => setBiometricsForm({...biometricsForm, hipsCm: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: Limbs Girths */}
                    <div className="border-t border-neutral-100 dark:border-[#262626] pt-4">
                      <h4 className="text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] font-mono tracking-wider mb-2">// Limbs Circumferences</h4>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_left_arm')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Arm cm"
                            value={biometricsForm.leftArmCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftArmCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('bio_right_arm')}</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Arm cm"
                            value={biometricsForm.rightArmCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightArmCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">L Thigh</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Thigh cm"
                            value={biometricsForm.leftThighCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftThighCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">R Thigh</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Thigh cm"
                            value={biometricsForm.rightThighCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightThighCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">L Calf</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="L Calf cm"
                            value={biometricsForm.leftCalfCm}
                            onChange={e => setBiometricsForm({...biometricsForm, leftCalfCm: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">R Calf</label>
                          <input 
                            type="number"
                            step="0.1"
                            className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            placeholder="R Calf cm"
                            value={biometricsForm.rightCalfCm}
                            onChange={e => setBiometricsForm({...biometricsForm, rightCalfCm: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        className="px-6 py-2.5 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest text-xs shadow-md shadow-[#EF2F38]/20 flex items-center gap-2"
                        disabled={isSavingBiometrics}
                      >
                        {isSavingBiometrics ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('act_saving')}
                          </>
                        ) : (
                          t('bio_save')
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* History Timeline */}
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm flex flex-col">
                  <div className="border-b border-neutral-100 dark:border-[#262626] pb-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                      Measurement Log History
                    </h3>
                    <p className="text-[10px] text-neutral-400 dark:text-[#666] uppercase font-bold tracking-wider mt-0.5">Chronological Athletic Record</p>
                  </div>

                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-[#262626] text-[9px] uppercase font-mono font-bold text-neutral-400 dark:text-[#666]">
                          <th className="py-2.5 px-3">{t('bio_date')}</th>
                          <th className="py-2.5 px-3">{t('stu_height')}</th>
                          <th className="py-2.5 px-3">{t('stu_weight')}</th>
                          <th className="py-2.5 px-3">{t('bio_body_fat')}</th>
                          <th className="py-2.5 px-3">{t('bio_skeletal_muscle')}</th>
                          <th className="py-2.5 px-3 font-mono">{t('bio_recorded_by')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] text-xs">
                        {studentCompositions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-neutral-500 italic font-mono text-[11px]">
                              No biometric history logs found.
                            </td>
                          </tr>
                        ) : (
                          studentCompositions.map((bc, index) => {
                            const prevBc = studentCompositions[index + 1];
                            const heightDiff = prevBc ? bc.heightCm - prevBc.heightCm : 0;
                            const weightDiff = prevBc ? bc.weightKg - prevBc.weightKg : 0;

                            return (
                              <tr key={bc.id || index} className="hover:bg-neutral-50 dark:hover:bg-[#1C1C1C]/30 text-neutral-700 dark:text-neutral-300 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white font-mono text-[11px]">
                                  {bc.recordedDate}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{bc.heightCm} cm</span>
                                    {heightDiff !== 0 && (
                                      <span className={cn("text-[9px] font-bold px-1 rounded-[8px]", heightDiff > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-500/10 text-neutral-500")}>
                                        {heightDiff > 0 ? `+${heightDiff.toFixed(1)}` : heightDiff.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{bc.weightKg} kg</span>
                                    {weightDiff !== 0 && (
                                      <span className={cn("text-[9px] font-bold px-1 rounded-[8px]", weightDiff > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-500")}>
                                        {weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {bc.bodyFatPercentage !== null ? `${bc.bodyFatPercentage}%` : '-'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {bc.skeletalMuscleMassKg !== null ? `${bc.skeletalMuscleMassKg} kg` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-[9px] text-neutral-400 dark:text-neutral-500 font-mono">
                                  {bc.recordedBy === state.currentUser?.id ? 'You' : 'Coach'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FULL SCREEN INTERACTIVE DIAGNOSTIC PORTAL OVERLAY */}
          {activeTab === 'biometrics' && isFullScreen && (
            <Portal>
              <div className="fixed inset-0 z-[999] bg-[#F9FAFB] dark:bg-[#050505] text-neutral-900 dark:text-white flex flex-col p-6 font-sans select-none animate-in fade-in duration-200">
                {/* Sci-fi scanner decorative grid & scanlines */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-5 dark:opacity-15" />
                
                {/* Header */}
                <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-4 mb-6 relative z-10">
                  <div>
                    <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest block mb-1">
                      Diagnostic Scanner // Athlete Development Profile
                    </span>
                    <h2 className="text-xl font-bold uppercase tracking-wider flex items-center gap-3">
                      <span>{student.englishName}</span>
                      {student.khmerName && (
                        <span className="text-neutral-500 text-sm font-normal">({student.khmerName})</span>
                      )}
                      <span className="text-xs bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded font-mono uppercase tracking-widest">
                        {student.id}
                      </span>
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* View Switcher inside Fullscreen */}
                    <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                      <button
                        type="button"
                        onClick={() => setViewMode('2d')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all",
                          viewMode === '2d'
                            ? "bg-[#EF2F38] text-white shadow-sm"
                            : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                        )}
                      >
                        2D Heatmap
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('3d')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all",
                          viewMode === '3d'
                            ? "bg-[#EF2F38] text-white shadow-sm"
                            : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                        )}
                      >
                        3D Wireframe
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFullScreen(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] dark:hover:bg-neutral-800 rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors text-neutral-800 dark:text-white"
                    >
                      <ArrowsIn size={14} weight="bold" />
                      <span>Exit Fullscreen</span>
                    </button>
                  </div>
                </div>

                {/* Main Dual Pane Layout */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 relative z-10">
                  {/* Left Pane - Visual Diagnostic */}
                  <div className="lg:col-span-8 bg-white dark:bg-black/50 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px] shadow-sm">
                    {/* Crosshair accents */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-red-600/30" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-red-600/30" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-red-600/30" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-red-600/30" />
                    
                    {hoveredMuscle && (
                      <div className="absolute top-4 left-4 right-4 bg-neutral-900/95 dark:bg-neutral-950/95 rounded-[8px] p-3 text-xs border border-neutral-700 dark:border-neutral-800 flex justify-between items-center z-10 backdrop-blur-md">
                        <span className="font-bold uppercase tracking-wider text-white-override">
                          {getMuscleDisplayName(hoveredMuscle.name)}
                        </span>
                        <span className="font-mono text-red-400 font-bold">
                          Heat Intensity: {hoveredMuscle.score.toFixed(1)} check-ins
                        </span>
                      </div>
                    )}

                    {viewMode === '2d' ? (
                      <div className="w-full h-full flex items-center justify-center max-w-3xl">
                        <Biomechanical2DScanner
                          muscleLoads={muscleLoads}
                          maxLoad={maxLoad}
                          gender={student.gender}
                          scale={1.25}
                          interactive={true}
                          onHoverMuscle={setHoveredMuscle}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full max-w-3xl flex items-center justify-center">
                        <div className="w-full h-[520px]">
                          <Anatomical3DModel muscleLoads={muscleLoads} maxLoad={maxLoad} gender={student.gender} />
                        </div>
                      </div>
                    )}
                    
                    {/* Color Key legend */}
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-4 py-2.5 rounded-[8px] text-[9px] font-mono tracking-wider backdrop-blur-md max-w-md mx-auto shadow-sm">
                      <span className="text-neutral-500 uppercase tracking-wider">Diagnostic Intensity:</span>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                          <div className="w-2.5 h-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-[8px]" />
                          <span>Rest (0)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                          <div className="w-2.5 h-2.5 bg-orange-500/50 border border-orange-500 rounded-[8px]" />
                          <span>Med (Low)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                          <div className="w-2.5 h-2.5 bg-red-600/80 border border-red-500 rounded-[8px]" />
                          <span>High (Targeted)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Pane - Report Data */}
                  <div className="lg:col-span-4 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 flex flex-col gap-6 overflow-y-auto shadow-sm">
                    <div>
                      <h3 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2 mb-3">
                        Muscular Load Report
                      </h3>
                      {Object.keys(muscleLoads).length === 0 ? (
                        <p className="text-xs text-neutral-500 italic">
                          {t('bio_no_load_warning')}
                        </p>
                      ) : (
                        <div className="space-y-3.5 font-mono">
                          {Object.entries(muscleLoads)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, score]) => {
                              const ratio = Math.min(score / maxLoad, 1);
                              return (
                                <div key={name} className="text-xs">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-neutral-800 dark:text-neutral-300 font-bold uppercase tracking-wide">
                                      {getMuscleDisplayName(name)}
                                    </span>
                                    <span className="text-red-600 dark:text-red-400 font-bold">{score.toFixed(1)} loads</span>
                                  </div>
                                  <div className="w-full bg-neutral-100 dark:bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]">
                                    <div 
                                      className="bg-gradient-to-r from-orange-500 to-[#EF2F38] h-full rounded-full transition-all duration-500"
                                      style={{ width: `${ratio * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2 mb-3">
                        Latest Biometric Snapshot
                      </h3>
                      {studentCompositions.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic font-mono">No composition history logged.</p>
                      ) : (
                        (() => {
                          const latest = studentCompositions[0];
                          return (
                            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                              <div className="bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px]">
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Height</span>
                                <span className="text-neutral-900 dark:text-white font-bold text-sm">{latest.heightCm} cm</span>
                              </div>
                              <div className="bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px]">
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Weight</span>
                                <span className="text-neutral-900 dark:text-white font-bold text-sm">{latest.weightKg} kg</span>
                              </div>
                              {latest.bodyFatPercentage && (
                                <div className="bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px]">
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Body Fat</span>
                                  <span className="text-neutral-900 dark:text-white font-bold text-sm">{latest.bodyFatPercentage}%</span>
                                </div>
                              )}
                              {latest.skeletalMuscleMassKg && (
                                <div className="bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px]">
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Muscle Mass</span>
                                  <span className="text-neutral-900 dark:text-white font-bold text-sm">{latest.skeletalMuscleMassKg} kg</span>
                                </div>
                              )}
                              <div className="col-span-2 bg-neutral-50/50 dark:bg-[#1A1A1A]/40 border border-neutral-200 dark:border-[#262626]/60 p-3 rounded-[8px] flex flex-col gap-2 mt-1">
                                <span className="text-[9px] text-red-500 uppercase tracking-widest font-bold font-mono">Girth Details</span>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                                  {latest.neckCm && <div>Neck: <span className="text-neutral-900 dark:text-white font-semibold">{latest.neckCm} cm</span></div>}
                                  {latest.shoulderWidthCm && <div>Shoulders: <span className="text-neutral-900 dark:text-white font-semibold">{latest.shoulderWidthCm} cm</span></div>}
                                  {latest.chestCm && <div>Chest: <span className="text-neutral-900 dark:text-white font-semibold">{latest.chestCm} cm</span></div>}
                                  {latest.waistCm && <div>Waist: <span className="text-neutral-900 dark:text-white font-semibold">{latest.waistCm} cm</span></div>}
                                  {latest.hipsCm && <div>Hips: <span className="text-neutral-900 dark:text-white font-semibold">{latest.hipsCm} cm</span></div>}
                                  {latest.leftArmCm && <div>Left Arm: <span className="text-neutral-900 dark:text-white font-semibold">{latest.leftArmCm} cm</span></div>}
                                  {latest.rightArmCm && <div>Right Arm: <span className="text-neutral-900 dark:text-white font-semibold">{latest.rightArmCm} cm</span></div>}
                                  {latest.leftThighCm && <div>Left Thigh: <span className="text-neutral-900 dark:text-white font-semibold">{latest.leftThighCm} cm</span></div>}
                                  {latest.rightThighCm && <div>Right Thigh: <span className="text-neutral-900 dark:text-white font-semibold">{latest.rightThighCm} cm</span></div>}
                                  {latest.leftCalfCm && <div>Left Calf: <span className="text-neutral-900 dark:text-white font-semibold">{latest.leftCalfCm} cm</span></div>}
                                  {latest.rightCalfCm && <div>Right Calf: <span className="text-neutral-900 dark:text-white font-semibold">{latest.rightCalfCm} cm</span></div>}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 p-4 rounded-[8px] text-xs flex flex-col gap-2 font-sans mt-auto">
                      <span className="text-red-600 dark:text-red-400 font-bold uppercase tracking-widest font-mono text-[9px]">// Diagnostic Analytics Summary</span>
                      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px]">
                        {Object.keys(muscleLoads).length > 0 
                          ? `System registers active load checks in ${Object.keys(muscleLoads).length} muscular sectors. Sync with curriculum checks regularly to monitor student development.`
                          : "No completed check-ins registered. Perform movement watch logs to construct an athlete load index."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Portal>
          )}
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
                <div className="w-full max-w-3xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-white max-h-[90dvh]">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest">
                         {editingAchievementId !== null ? "Edit Tournament Achievement" : t('panel_log_tournament_achievement')}
                      </h2>
                      <button onClick={handleCloseAchievementModal} className="p-1 text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>
                   <div className="p-6 overflow-y-auto space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-500 mb-1">{t('panel_event_name')} *</label>
                         <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-neutral-700" 
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
                   </div>

                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2 text-xs bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                     <button onClick={handleCloseAchievementModal} className="px-4 py-2 min-h-[44px] text-neutral-500 hover:text-neutral-950 dark:hover:text-white font-bold uppercase tracking-widest active:scale-95 touch-manipulation flex items-center justify-center">{t('act_cancel')}</button>
                     <button onClick={handleAddAchievement} className="px-5 py-2 min-h-[44px] bg-[#EF2F38] hover:opacity-90 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 active:scale-95 touch-manipulation flex items-center justify-center">{editingAchievementId !== null ? t('act_save') : t('panel_add_achv_btn')}</button>
                   </div>
                </div>
              </div>
            </Portal>
          )}
         {showBulkBeltModal && (
            <Portal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="w-full h-full md:h-auto md:max-w-5xl bg-white dark:bg-[#0F0F0F] border-0 md:border md:border-neutral-200 md:dark:border-[#262626] rounded-none md:rounded-[8px] shadow-2xl flex flex-col max-h-full md:max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Certificate className="w-5 h-5 text-red-500" />
                        {t('panel_bulk_log_belts_title')}
                      </h2>
                      <button onClick={() => setShowBulkBeltModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>
                   
                   {/* Table / Card area */}
                   <div className="flex-1 overflow-auto p-4 md:p-6">
                     {/* Desktop Spreadsheet view */}
                     <div className="hidden md:block min-w-[800px] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden">
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr className="bg-neutral-100 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_next_belt_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[16%]">{t('panel_promotion_date_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[12%]">{t('panel_col_score_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_program')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_cert_ref_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_cert_url_id')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] text-center w-[6%]">{t('panel_col_act')}</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                           {bulkBelts.map((row, index) => (
                             <tr key={index} className="bg-white dark:bg-[#0A0A0A] hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors">
                               <td className="p-2">
                                 <select 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.beltLevel} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'beltLevel', e.target.value)}
                                 >
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
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="date" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                   value={row.promotionDate} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'promotionDate', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="number" 
                                   min="0" 
                                   max="100" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white font-mono"
                                   placeholder={t('panel_placeholder_score')}
                                   value={row.testScore} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'testScore', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <select 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.program} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'program', e.target.value)}
                                 >
                                   <option value="Standard Class">{t('panel_program_standard')}</option>
                                   <option value="Elite Team">{t('panel_program_elite')}</option>
                                   <option value="Private Camp">{t('panel_program_private')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="text" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white font-mono uppercase"
                                   placeholder={t('panel_placeholder_autogen')}
                                   value={row.certificateRef} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'certificateRef', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="text" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white font-mono"
                                   placeholder={t('panel_placeholder_cert_url_or_dan')}
                                   value={row.kukkiwonDanCardId} 
                                   onChange={e => handleUpdateBulkBeltCell(index, 'kukkiwonDanCardId', e.target.value)}
                                 />
                               </td>
                               <td className="p-2 text-center">
                                 <button 
                                   onClick={() => handleRemoveBulkBeltRow(index)}
                                   className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                   disabled={bulkBelts.length <= 1}
                                   title={t('panel_title_delete_row')}
                                 >
                                   <X className="w-4 h-4 mx-auto" />
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>

                     {/* Mobile Card list view */}
                     <div className="block md:hidden space-y-4">
                       {bulkBelts.map((row, index) => (
                         <div key={index} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#0A0A0A] space-y-3 relative shadow-sm">
                           <button 
                             onClick={() => handleRemoveBulkBeltRow(index)}
                             className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                             disabled={bulkBelts.length <= 1}
                             title={t('panel_title_delete_row')}
                           >
                             <X className="w-4 h-4" />
                           </button>
                           <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">{t('bulk_table_row')} #{index + 1}</div>
                           
                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_next_belt_req')}</label>
                               <select 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-red-500"
                                 value={row.beltLevel} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'beltLevel', e.target.value)}
                               >
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
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_promotion_date_req')}</label>
                               <input 
                                 type="date" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                 value={row.promotionDate} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'promotionDate', e.target.value)}
                               />
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_score_opt')}</label>
                               <input 
                                 type="number" 
                                 min="0" 
                                 max="100" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white font-mono"
                                 placeholder={t('panel_placeholder_score')}
                                 value={row.testScore} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'testScore', e.target.value)}
                               />
                             </div>
                             
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_program')}</label>
                               <select 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.program} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'program', e.target.value)}
                               >
                                 <option value="Standard Class">{t('panel_program_standard')}</option>
                                 <option value="Elite Team">{t('panel_program_elite')}</option>
                                 <option value="Private Camp">{t('panel_program_private')}</option>
                               </select>
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-1 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_cert_ref_opt')}</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white font-mono uppercase"
                                 placeholder={t('panel_placeholder_autogen')}
                                 value={row.certificateRef} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'certificateRef', e.target.value)}
                               />
                             </div>
                             
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_cert_link_or_kukkiwon')}</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white font-mono"
                                 placeholder={t('panel_cert_link_or_kukkiwon')}
                                 value={row.kukkiwonDanCardId} 
                                 onChange={e => handleUpdateBulkBeltCell(index, 'kukkiwonDanCardId', e.target.value)}
                               />
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     <button 
                       onClick={handleAddBulkBeltRow}
                       className="mt-4 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-1"
                     >
                       {t('panel_add_row_btn')}
                     </button>
                   </div>
                   
                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                     <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">* Required fields must be populated.</p>
                     <div className="flex gap-2 text-xs">
                       <button 
                         onClick={() => setShowBulkBeltModal(false)} 
                         className="px-4 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold uppercase tracking-widest"
                         disabled={isSavingBulkBelt}
                       >
                         {t('act_cancel')}
                       </button>
                       <button 
                         onClick={handleSaveBulkBelts} 
                         className="px-5 py-2 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 flex items-center gap-2"
                         disabled={isSavingBulkBelt}
                       >
                         {isSavingBulkBelt ? (
                           <>
                             <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                             {t('act_saving')}
                           </>
                         ) : (
                           t('act_save')
                         )}
                       </button>
                     </div>
                   </div>
                </div>
              </div>
             </Portal>
           )}
                 {showBulkAchvModal && (
            <Portal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="w-full h-full md:h-auto md:max-w-5xl bg-white dark:bg-[#0F0F0F] border-0 md:border md:border-neutral-200 md:dark:border-[#262626] rounded-none md:rounded-[8px] shadow-2xl flex flex-col max-h-full md:max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        {t('panel_bulk_log_achvs_title')}
                      </h2>
                      <button onClick={() => setShowBulkAchvModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>
                   
                   {/* Table / Card area */}
                   <div className="flex-1 overflow-auto p-4 md:p-6">
                     {/* Desktop Spreadsheet view */}
                     <div className="hidden md:block min-w-[800px] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden">
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr className="bg-neutral-100 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[26%]">{t('panel_event_name_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[16%]">{t('panel_col_category')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_division')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_medal_rank')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[12%]">{t('panel_date_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_notes_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] text-center w-[4%]">{t('panel_col_act')}</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                           {bulkAchvs.map((row, index) => (
                             <tr key={index} className="bg-white dark:bg-[#0A0A0A] hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors">
                               <td className="p-2">
                                 <input 
                                   type="text" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   placeholder={t('panel_placeholder_tournament_event')}
                                   value={row.eventName} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'eventName', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <select 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.category} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'category', e.target.value)}
                                 >
                                   <option value="Recognized Poomsae">{t('panel_event_poomsae')}</option>
                                   <option value="Freestyle Poomsae">{t('panel_event_freestyle')}</option>
                                   <option value="Demonstration">{t('panel_event_demo')}</option>
                                   <option value="Tricking">{t('panel_event_tricking')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <select 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.division} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'division', e.target.value)}
                                 >
                                   <option value="Male Division">{t('panel_div_male_indiv')}</option>
                                   <option value="Female Division">{t('panel_div_female_indiv')}</option>
                                   <option value="Pair">{t('panel_div_pair')}</option>
                                   <option value="Team">{t('panel_div_team')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <select 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.medalRank} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'medalRank', e.target.value)}
                                 >
                                   <option value="Gold">{t('panel_medal_gold')}</option>
                                   <option value="Silver">{t('panel_medal_silver')}</option>
                                   <option value="Bronze">{t('panel_medal_bronze')}</option>
                                   <option value="Participant">{t('panel_medal_participant')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="date" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                   value={row.date} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'date', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                   type="text" 
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white"
                                   placeholder={t('panel_col_notes_opt')}
                                   value={row.notes} 
                                   onChange={e => handleUpdateBulkAchvCell(index, 'notes', e.target.value)}
                                 />
                               </td>
                               <td className="p-2 text-center">
                                 <button 
                                   onClick={() => handleRemoveBulkAchvRow(index)}
                                   className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                   disabled={bulkAchvs.length <= 1}
                                   title={t('panel_title_delete_row')}
                                 >
                                   <X className="w-4 h-4 mx-auto" />
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>

                     {/* Mobile Card list view */}
                     <div className="block md:hidden space-y-4">
                       {bulkAchvs.map((row, index) => (
                         <div key={index} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#0A0A0A] space-y-3 relative shadow-sm">
                           <button 
                             onClick={() => handleRemoveBulkAchvRow(index)}
                             className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                             disabled={bulkAchvs.length <= 1}
                             title={t('panel_title_delete_row')}
                           >
                             <X className="w-4 h-4" />
                           </button>
                           <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{t('bulk_table_row')} #{index + 1}</div>
                           
                           <div className="space-y-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_event_name_req')}</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 placeholder={t('panel_placeholder_tournament_event')}
                                 value={row.eventName} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'eventName', e.target.value)}
                               />
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_category')}</label>
                               <select 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.category} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'category', e.target.value)}
                               >
                                 <option value="Recognized Poomsae">{t('panel_event_poomsae')}</option>
                                 <option value="Freestyle Poomsae">{t('panel_event_freestyle')}</option>
                                 <option value="Demonstration">{t('panel_event_demo')}</option>
                                 <option value="Tricking">{t('panel_event_tricking')}</option>
                               </select>
                             </div>
                             
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_division')}</label>
                               <select 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.division} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'division', e.target.value)}
                               >
                                 <option value="Male Division">{t('panel_div_male_indiv')}</option>
                                 <option value="Female Division">{t('panel_div_female_indiv')}</option>
                                 <option value="Pair">{t('panel_div_pair')}</option>
                                 <option value="Team">{t('panel_div_team')}</option>
                               </select>
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_medal_rank')}</label>
                               <select 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.medalRank} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'medalRank', e.target.value)}
                               >
                                 <option value="Gold">{t('panel_medal_gold')}</option>
                                 <option value="Silver">{t('panel_medal_silver')}</option>
                                 <option value="Bronze">{t('panel_medal_bronze')}</option>
                                 <option value="Participant">{t('panel_medal_participant')}</option>
                               </select>
                             </div>
                             
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_date_req')}</label>
                               <input 
                                 type="date" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                 value={row.date} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'date', e.target.value)}
                               />
                             </div>
                           </div>
                           
                           <div className="space-y-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_notes_opt')}</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white"
                                 placeholder={t('panel_col_notes_opt')}
                                 value={row.notes} 
                                 onChange={e => handleUpdateBulkAchvCell(index, 'notes', e.target.value)}
                               />
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     <button 
                       onClick={handleAddBulkAchvRow}
                       className="mt-4 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-1"
                     >
                       {t('panel_add_row_btn')}
                     </button>
                   </div>
                   
                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                     <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_required_hint')}</p>
                     <div className="flex gap-2 text-xs">
                       <button 
                         onClick={() => setShowBulkAchvModal(false)} 
                         className="px-4 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold uppercase tracking-widest"
                         disabled={isSavingBulkAchv}
                       >
                         {t('act_cancel')}
                       </button>
                       <button 
                         onClick={handleSaveBulkAchvs} 
                         className="px-5 py-2 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 flex items-center gap-2"
                         disabled={isSavingBulkAchv}
                       >
                         {isSavingBulkAchv ? (
                           <>
                             <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                             {t('act_saving')}
                           </>
                         ) : (
                           t('act_save')
                         )}
                       </button>
                     </div>
                   </div>
                 </div>
               </div>
             </Portal>
           )}
           {showDossierModal && (
             <StudentDossierModal studentId={student.id} onClose={() => setShowDossierModal(false)} />
           )}
            {showPasswordModal && (
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
                            placeholder="Min 6 characters (e.g. Student1234!)"
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

            {showProvisionModal && (
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
                            placeholder="Min 6 characters"
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
