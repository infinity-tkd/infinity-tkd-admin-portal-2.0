'use client';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { copyText } from '@/lib/clipboard';
import { ContactActions, TelegramContactField } from './ContactActions';

import { dialogMotion } from '@/lib/motion';
import { academyDate } from '@/lib/dates';

import React, { useState } from 'react';
import { useAppStore, User, Role, StaffDanRecord } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeClosed } from '@phosphor-icons/react/dist/csr/EyeClosed';


import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';

import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { ChalkboardTeacher } from '@phosphor-icons/react/dist/csr/ChalkboardTeacher';
import { Heartbeat } from '@phosphor-icons/react/dist/csr/Heartbeat';
import { Medal } from '@phosphor-icons/react/dist/csr/Medal';
import { Certificate } from '@phosphor-icons/react/dist/csr/Certificate';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { ClockAfternoon } from '@phosphor-icons/react/dist/csr/ClockAfternoon';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { TrashSimple } from '@phosphor-icons/react/dist/csr/TrashSimple';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { cn, sanitizeStringInput, isValidEmail, isValidPhone, isValidDate } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';
import { CAMBODIA_LOCATIONS } from './DataLists';
import { useT } from '@/hooks/useTranslation';
import { calculateDanEligibility, formatDanRank, getDanStripes, KUKKIWON_DAN_RULES } from '@/lib/kukkiwon';

interface ManageStaffPanelProps {
  staff: User;
  onClose: () => void;
}

export function ManageStaffPanel({ staff, onClose }: ManageStaffPanelProps) {
  const { updateUser, deleteUser, state, can, showConfirm, showNotification, addStaffDanRecord, updateStaffDanRecord, deleteStaffDanRecord } = useAppStore();
  const t = useT();
  const [editForm, setEditForm] = useState<any>(staff ? {
    displayName: staff.displayName || '',
    email: staff.email || '',
    role: staff.role,
    isActive: staff.isActive,
    khmerName: staff.khmerName || '',
    englishName: staff.englishName || '',
    gender: staff.gender || 'Male',
    dob: staff.dob || '',
    phone: staff.phone || '',
    telegramUsername: staff.telegramUsername || '',
    emergencyContactName: staff.emergencyContactName || '',
    emergencyContactPhone: staff.emergencyContactPhone || '',
    emergencyContactRelation: staff.emergencyContactRelation || '',
    medicalNotes: staff.medicalNotes || '',
    allergies: staff.allergies || '',
    profilePicturePath: staff.profilePicturePath || '',
    nationality: staff.nationality || '',
    kukkiwonId: staff.kukkiwonId || '',
    currentDan: staff.currentDan ?? '',
    danIssueDate: staff.danIssueDate || '',
    danCertificateUrl: staff.danCertificateUrl || '',
    address: staff.address ? { ...staff.address } : { line1: '', line2: '', city: '', stateProvince: '', postalCode: '', country: 'Cambodia' }
  } : {});

  // Dan Promotion History Modal State
  const [showDanModal, setShowDanModal] = useState(false);
  const [editingDanRecord, setEditingDanRecord] = useState<StaffDanRecord | null>(null);
  const [danModalForm, setDanModalForm] = useState({
    danLevel: 1,
    issueDate: academyDate(),
    certificateNo: '',
    certificateUrl: '',
    examinerName: '',
    location: 'Infinity Taekwondo Academy',
    notes: ''
  });
  const [isSubmittingDan, setIsSubmittingDan] = useState(false);

  const staffDanRecords = state.staffDanRecords
    .filter(r => r.userId === staff.id)
    .sort((a, b) => a.danLevel - b.danLevel);

  const eligibility = calculateDanEligibility(
    editForm.currentDan ? Number(editForm.currentDan) : staff.currentDan,
    editForm.danIssueDate || staff.danIssueDate,
    editForm.dob || staff.dob
  );

  const canEdit = can('action:staff_manage');

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Password reset modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPasswordText, setShowStaffPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleCopy = async (text: string, fieldName: string) => {
    if (!text) return;
    if (!(await copyText(text))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopiedField(fieldName);
    showNotification(`${fieldName} copied to clipboard`, 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUpdateStaffPassword = async () => {
    if (!newStaffPassword || newStaffPassword.length < 6) {
      showNotification('Password must be at least 6 characters long.', 'warning');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updateUser(staff.id, { password: newStaffPassword });
      showNotification('Staff member portal password updated successfully!', 'success');
      setShowPasswordModal(false);
      setNewStaffPassword('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update staff password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSave = () => {
    const email = sanitizeStringInput(editForm.email);
    if (!email) {
      setError(t('usr_err_credentials_required') || 'Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError(t('usr_err_invalid_email') || 'Invalid email address.');
      return;
    }

    const phone = sanitizeStringInput(editForm.phone);
    if (phone && !isValidPhone(phone)) {
      setError(t('panel_err_invalid_student_phone') || 'Invalid phone format.');
      return;
    }

    const dob = sanitizeStringInput(editForm.dob);
    if (dob && !isValidDate(dob)) {
      setError(t('panel_err_invalid_dob') || 'Invalid DOB format (must be YYYY-MM-DD).');
      return;
    }

    const emergencyPhone = sanitizeStringInput(editForm.emergencyContactPhone);
    if (emergencyPhone && !isValidPhone(emergencyPhone)) {
      setError(t('panel_err_invalid_guardian_phone') || 'Invalid emergency contact phone format.');
      return;
    }

    setError('');
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    setShowSaveConfirm(false);
    setIsSaving(true);
    setError('');

    try {
      const sanitizedForm = {
        ...editForm,
        displayName: sanitizeStringInput(editForm.displayName),
        email: sanitizeStringInput(editForm.email),
        khmerName: sanitizeStringInput(editForm.khmerName),
        englishName: sanitizeStringInput(editForm.englishName),
        dob: sanitizeStringInput(editForm.dob),
        phone: sanitizeStringInput(editForm.phone),
        emergencyContactName: sanitizeStringInput(editForm.emergencyContactName),
        emergencyContactPhone: sanitizeStringInput(editForm.emergencyContactPhone),
        emergencyContactRelation: sanitizeStringInput(editForm.emergencyContactRelation),
        medicalNotes: sanitizeStringInput(editForm.medicalNotes),
        allergies: sanitizeStringInput(editForm.allergies),
        profilePicturePath: sanitizeStringInput(editForm.profilePicturePath),
        nationality: sanitizeStringInput(editForm.nationality),
        kukkiwonId: sanitizeStringInput(editForm.kukkiwonId),
        currentDan: editForm.currentDan !== '' && editForm.currentDan != null ? Number(editForm.currentDan) : null,
        danIssueDate: sanitizeStringInput(editForm.danIssueDate),
        danCertificateUrl: sanitizeStringInput(editForm.danCertificateUrl),
        address: {
          line1: sanitizeStringInput(editForm.address?.line1 || ''),
          line2: sanitizeStringInput(editForm.address?.line2 || ''),
          city: sanitizeStringInput(editForm.address?.city || ''),
          stateProvince: sanitizeStringInput(editForm.address?.stateProvince || ''),
          postalCode: sanitizeStringInput(editForm.address?.postalCode || ''),
          country: sanitizeStringInput(editForm.address?.country || 'Cambodia')
        }
      };

      await updateUser(staff.id, sanitizedForm);
      showNotification('Staff profile updated successfully!', 'success');
      onClose();
    } catch (err: any) {
      console.error("[ManageStaffPanel] Save error:", err);
      setError(err.message || 'Failed to update staff profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddDan = () => {
    const nextDan = editForm.currentDan ? Math.min(9, Number(editForm.currentDan) + 1) : 1;
    setEditingDanRecord(null);
    setDanModalForm({
      danLevel: nextDan,
      issueDate: academyDate(),
      certificateNo: editForm.kukkiwonId || '',
      certificateUrl: editForm.danCertificateUrl || '',
      examinerName: '',
      location: 'Infinity Taekwondo Academy',
      notes: ''
    });
    setShowDanModal(true);
  };

  const handleOpenEditDan = (record: StaffDanRecord) => {
    setEditingDanRecord(record);
    setDanModalForm({
      danLevel: record.danLevel,
      issueDate: record.issueDate,
      certificateNo: record.certificateNo || '',
      certificateUrl: record.certificateUrl || '',
      examinerName: record.examinerName || '',
      location: record.location || 'Infinity Taekwondo Academy',
      notes: record.notes || ''
    });
    setShowDanModal(true);
  };

  const handleSaveDanPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!danModalForm.issueDate || !isValidDate(danModalForm.issueDate)) {
      showNotification('Please enter a valid issue date (YYYY-MM-DD).', 'warning');
      return;
    }
    setIsSubmittingDan(true);
    try {
      if (editingDanRecord) {
        await updateStaffDanRecord(editingDanRecord.id, {
          danLevel: Number(danModalForm.danLevel),
          issueDate: danModalForm.issueDate,
          certificateNo: danModalForm.certificateNo ? sanitizeStringInput(danModalForm.certificateNo) : undefined,
          certificateUrl: danModalForm.certificateUrl ? sanitizeStringInput(danModalForm.certificateUrl) : undefined,
          examinerName: danModalForm.examinerName ? sanitizeStringInput(danModalForm.examinerName) : undefined,
          location: danModalForm.location ? sanitizeStringInput(danModalForm.location) : undefined,
          notes: danModalForm.notes ? sanitizeStringInput(danModalForm.notes) : undefined
        });
      } else {
        await addStaffDanRecord({
          userId: staff.id,
          danLevel: Number(danModalForm.danLevel),
          issueDate: danModalForm.issueDate,
          certificateNo: danModalForm.certificateNo ? sanitizeStringInput(danModalForm.certificateNo) : undefined,
          certificateUrl: danModalForm.certificateUrl ? sanitizeStringInput(danModalForm.certificateUrl) : undefined,
          examinerName: danModalForm.examinerName ? sanitizeStringInput(danModalForm.examinerName) : undefined,
          location: danModalForm.location ? sanitizeStringInput(danModalForm.location) : 'Infinity Taekwondo Academy',
          notes: danModalForm.notes ? sanitizeStringInput(danModalForm.notes) : undefined
        });
      }

      // Sync local editForm if new record has highest Dan
      if (Number(danModalForm.danLevel) >= Number(editForm.currentDan || 0)) {
        setEditForm((prev: any) => ({
          ...prev,
          currentDan: Number(danModalForm.danLevel),
          danIssueDate: danModalForm.issueDate,
          kukkiwonId: danModalForm.certificateNo || prev.kukkiwonId,
          danCertificateUrl: danModalForm.certificateUrl || prev.danCertificateUrl
        }));
      }

      setShowDanModal(false);
    } catch (err: any) {
      console.error("[ManageStaffPanel] Save Dan error:", err);
    } finally {
      setIsSubmittingDan(false);
    }
  };

  const handleDeleteDan = (record: StaffDanRecord) => {
    showConfirm(
      `Are you sure you want to delete the ${formatDanRank(record.danLevel)} promotion record? This action cannot be undone.`,
      async () => {
        try {
          await deleteStaffDanRecord(record.id, staff.id);
        } catch (err: any) {
          console.error("[ManageStaffPanel] Delete Dan error:", err);
        }
      },
      `Delete ${formatDanRank(record.danLevel)} Record`
    );
  };

  const handleDelete = () => {
    showConfirm(
      t('stf_confirm_delete_desc') || 'Are you sure you want to permanently delete this staff member? All class assignments will be cleared and the portal account removed.',
      async () => {
        setIsDeleting(true);
        try {
          await deleteUser(staff.id);
          onClose();
        } catch (err: any) {
          console.error("[ManageStaffPanel] Delete error:", err);
        } finally {
          setIsDeleting(false);
        }
      }
    );
  };

  const assignedClasses = state.classSessions.filter(c => c.coachId === staff.id);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <ModalA11y label="Staff profile" onClose={onClose} />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="relative w-full sm:w-[560px] max-w-full bg-white dark:bg-[#0F0F0F] border-l border-neutral-200 dark:border-[#262626] h-full flex flex-col shadow-2xl z-10 text-neutral-900 dark:text-white"
        >
          {/* Header Strip */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414] shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <SafeImage
                src={editForm.profilePicturePath || staff.profilePicturePath}
                alt={staff.displayName}
                containerClassName="w-12 h-12 rounded-[8px] bg-neutral-100 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
                fallback={<UserCircle className="w-8 h-8 text-neutral-400 dark:text-[#666]" weight="fill" />}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                    {editForm.displayName || staff.displayName}
                  </h2>
                  {staff.khmerName && (
                    <span className="text-xs text-neutral-500 dark:text-[#888] font-medium truncate hidden xs:inline">
                      ({staff.khmerName})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopy(staff.username, 'Username')}
                    title="Click to copy username"
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-[#999] font-mono hover:text-brand-ink transition-colors cursor-pointer group"
                  >
                    <span>@{staff.username}</span>
                    {copiedField === 'Username' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3 hover-reveal" />
                    )}
                  </button>
                  <span className={cn(
                    "px-2 py-0.5 rounded-[8px] text-micro font-bold uppercase tracking-widest border font-mono",
                    staff.role === 'Admin' ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" :
                    staff.role === 'Head Coach' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                    "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-[#999] border-neutral-300 dark:border-transparent"
                  )}>
                    {staff.role}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold uppercase tracking-wider font-mono border",
                    staff.isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", staff.isActive ? "bg-emerald-500" : "bg-red-500")} />
                    {staff.isActive ? "Active" : "Locked"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canEdit && (
                <button
                  type="button"
                  title="Direct Password Reset"
                  onClick={() => setShowPasswordModal(true)}
                  className="p-2 text-neutral-500 hover:text-brand-ink dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] rounded-[8px] transition-colors cursor-pointer"
                >
                  <Key className="w-4 h-4 text-brand-ink" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Staff Panel"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 dark:text-[#666] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white dark:bg-[#0F0F0F]">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[8px] text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
                <span>{error}</span>
              </div>
            )}

            {canEdit ? (
              // EDITABLE MODE FOR PRIVILEGED USERS
              <div className="space-y-6">
                {/* Card 1: Account Credentials & Access */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-ink" weight="bold" />
                      <span>{t('stf_edit_credentials') || 'Account Credentials & Role'}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setNewStaffPassword('');
                        setShowPasswordModal(true);
                      }}
                      className="px-2.5 py-1 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand-ink text-micro font-bold uppercase tracking-widest rounded-[8px] transition-all flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Reset Password</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="manage-staff-panel-usr_display_name" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('usr_display_name')}</label>
                      <input id="manage-staff-panel-usr_display_name"
                        type="text"
                        value={editForm.displayName}
                        onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_email" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_email')}</label>
                      <input id="manage-staff-panel-stu_email"
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="manage-staff-panel-usr_role" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('usr_role')}</label>
                      <select id="manage-staff-panel-usr_role"
                        value={editForm.role}
                        onChange={e => setEditForm({ ...editForm, role: e.target.value as Role })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand cursor-pointer font-mono font-bold"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Head Coach">Head Coach</option>
                        <option value="Coach">Coach</option>
                        <option value="Assistant Coach">Assistant Coach</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label htmlFor="isActiveToggle" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">Account Access State</label>
                      <div className="flex items-center gap-2.5 h-[38px] px-3 bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px]">
                        <input
                          type="checkbox"
                          id="isActiveToggle"
                          checked={editForm.isActive}
                          onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                          className="w-4 h-4 rounded text-brand-ink focus:ring-brand cursor-pointer accent-brand"
                        />
                        <label htmlFor="isActiveToggle" className="text-xs text-neutral-800 dark:text-neutral-200 cursor-pointer font-medium">
                          {editForm.isActive ? 'Active (Login Enabled)' : 'Locked (Access Suspended)'}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="manage-staff-panel-profile-picture-link" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">Profile Picture Link</label>
                    <div className="flex gap-3 items-center">
                      <input id="manage-staff-panel-profile-picture-link"
                        type="text"
                        value={editForm.profilePicturePath}
                        onChange={e => setEditForm({ ...editForm, profilePicturePath: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand flex-1 font-mono text-xs"
                        placeholder="Google Drive link or direct image URL"
                      />
                      {editForm.profilePicturePath && (
                        <SafeImage
                          src={editForm.profilePicturePath}
                          alt="Preview"
                          containerClassName="w-9 h-9 rounded-[8px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] overflow-hidden flex items-center justify-center shadow-sm shrink-0"
                          fallback={<span className="text-micro text-red-500 uppercase font-black">Err</span>}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Card 2: Personal Demographics */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-blue-500" weight="bold" />
                    <span>{t('stf_personal_info') || 'Personal Demographics'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="manage-staff-panel-stu_khmer_name" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_khmer_name')}</label>
                      <input id="manage-staff-panel-stu_khmer_name"
                        type="text"
                        value={editForm.khmerName}
                        onChange={e => setEditForm({ ...editForm, khmerName: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_english_name" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_english_name')}</label>
                      <input id="manage-staff-panel-stu_english_name"
                        type="text"
                        value={editForm.englishName}
                        onChange={e => setEditForm({ ...editForm, englishName: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_gender" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_gender')}</label>
                      <select id="manage-staff-panel-stu_gender"
                        value={editForm.gender}
                        onChange={e => setEditForm({ ...editForm, gender: e.target.value as 'Male' | 'Female' })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                      >
                        <option value="Male">{t('stu_male')}</option>
                        <option value="Female">{t('stu_female')}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_nationality" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_nationality')}</label>
                      <input id="manage-staff-panel-stu_nationality"
                        type="text"
                        value={editForm.nationality}
                        onChange={e => setEditForm({ ...editForm, nationality: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                        placeholder="Cambodian"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_dob" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_dob')}</label>
                      <input id="manage-staff-panel-stu_dob"
                        type="date"
                        value={editForm.dob}
                        onChange={e => setEditForm({ ...editForm, dob: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_phone" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_phone')}</label>
                      <input id="manage-staff-panel-stu_phone"
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                        placeholder="012 345 678"
                      />
                    </div>
                  </div>
                </div>

                <TelegramContactField id="edit-staff-telegram" value={editForm.telegramUsername || ''} onChange={telegramUsername => setEditForm({...editForm, telegramUsername})} />
                {/* Card: Kukkiwon Black Belt Certification & Promotion Eligibility Engine */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-[8px] bg-red-500/10 text-brand-ink flex items-center justify-center shrink-0">
                        <Medal className="w-5 h-5" weight="bold" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-100 font-mono">
                          Kukkiwon Black Belt & Promotion Engine
                        </h3>
                        <p className="text-micro text-neutral-500 dark:text-[#888] font-mono">
                          World Taekwondo Dan Tracking & Automated Eligibility Radar
                        </p>
                      </div>
                    </div>

                    {/* Live Legitimacy Badge */}
                    <div className="shrink-0">
                      {eligibility.status === 'ELIGIBLE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-micro font-bold uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono animate-pulse">
                          <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                          <span>Legit to Test for {eligibility.nextDanLabel}</span>
                        </span>
                      ) : eligibility.status === 'TIME_PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-micro font-bold uppercase tracking-widest bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono">
                          <ClockAfternoon className="w-3.5 h-3.5" weight="bold" />
                          <span>{eligibility.headline}</span>
                        </span>
                      ) : eligibility.status === 'AGE_RESTRICTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-micro font-bold uppercase tracking-widest bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-mono">
                          <Warning className="w-3.5 h-3.5" weight="bold" />
                          <span>Age {eligibility.minAgeForNextDan} Required</span>
                        </span>
                      ) : eligibility.status === 'MAX_DAN' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-micro font-bold uppercase tracking-widest bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-400 font-mono">
                          <Sparkle className="w-3.5 h-3.5" weight="bold" />
                          <span>9th Dan Grandmaster</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-micro font-bold uppercase tracking-widest bg-neutral-200 dark:bg-[#222] text-neutral-600 dark:text-[#888] font-mono">
                          <span>Unset / No Dan Record</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Credentials Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="manage-staff-panel-current-dan-rank-1st-9th-dan" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                        Current Dan Rank (1st - 9th Dan)
                      </label>
                      <select id="manage-staff-panel-current-dan-rank-1st-9th-dan"
                        value={editForm.currentDan ?? ''}
                        onChange={e => setEditForm({ ...editForm, currentDan: e.target.value ? Number(e.target.value) : '' })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand cursor-pointer"
                      >
                        <option value="">No Kukkiwon Dan (Unranked)</option>
                        {Object.values(KUKKIWON_DAN_RULES).map(rule => (
                          <option key={rule.danLevel} value={rule.danLevel}>
                            {formatDanRank(rule.danLevel)} ({getDanStripes(rule.danLevel)}) — {rule.englishTitle} ({rule.koreanTitle})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="manage-staff-panel-kukkiwon-id-cert-number" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                        Kukkiwon ID / Cert Number
                      </label>
                      <div className="flex gap-2 items-center">
                        <input id="manage-staff-panel-kukkiwon-id-cert-number"
                          type="text"
                          value={editForm.kukkiwonId}
                          onChange={e => setEditForm({ ...editForm, kukkiwonId: e.target.value })}
                          className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                          placeholder="e.g. 05123456"
                        />
                        {editForm.kukkiwonId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(editForm.kukkiwonId, 'Kukkiwon ID')}
                            title="Copy Kukkiwon ID"
                            className="p-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-[#333] text-neutral-700 dark:text-white rounded-[8px] transition-colors cursor-pointer shrink-0"
                          >
                            {copiedField === 'Kukkiwon ID' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="manage-staff-panel-current-dan-issue-date" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                        Current Dan Issue Date
                      </label>
                      <input id="manage-staff-panel-current-dan-issue-date"
                        type="date"
                        value={editForm.danIssueDate}
                        onChange={e => setEditForm({ ...editForm, danIssueDate: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand [color-scheme:light] dark:[color-scheme:dark] font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor="manage-staff-panel-certificate-document-cloud-url" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                        Certificate Document / Cloud URL
                      </label>
                      <div className="flex gap-2 items-center">
                        <input id="manage-staff-panel-certificate-document-cloud-url"
                          type="text"
                          value={editForm.danCertificateUrl}
                          onChange={e => setEditForm({ ...editForm, danCertificateUrl: e.target.value })}
                          className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono text-xs"
                          placeholder="https://..."
                        />
                        {editForm.danCertificateUrl && (
                          <a
                            href={editForm.danCertificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-[#333] text-neutral-700 dark:text-white rounded-[8px] transition-colors shrink-0"
                            title="Open Certificate Link"
                          >
                            <ArrowSquareOut className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Realtime Promotion Eligibility Radar Widget */}
                  {editForm.currentDan ? (
                    <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-[#2C2C2C] rounded-[8px] p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 font-mono">
                          <CalendarCheck className="w-4 h-4 text-brand-ink" />
                          <span>Promotion Pathway: {eligibility.currentDanLabel} → {eligibility.nextDanLabel || 'Max Rank'}</span>
                        </span>
                        <span className="text-micro font-mono text-neutral-500 dark:text-[#999]">
                          Mandatory Rule: Hold for {eligibility.requiredWaitYears} {eligibility.requiredWaitYears === 1 ? 'Year' : 'Years'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-micro font-mono text-neutral-500 dark:text-[#888]">
                          <span>Issued: {editForm.danIssueDate || 'Date unset'}</span>
                          <span className="font-bold text-neutral-900 dark:text-white">{eligibility.progressPercent}% Time Elapsed</span>
                          <span>Target: {eligibility.earliestTestDate || 'Pending'}</span>
                        </div>
                        <div className="w-full bg-neutral-200 dark:bg-[#2E2E2E] h-2.5 rounded-full overflow-hidden shadow-inner">
                          <motion.div
                            initial={false}
                            animate={{ scaleX: Math.min(1, Math.max(0, eligibility.progressPercent / 100)) }}
                            style={{ transformOrigin: 'left', width: '100%' }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              eligibility.status === 'ELIGIBLE'
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                : eligibility.status === 'AGE_RESTRICTED'
                                ? "bg-gradient-to-r from-amber-500 to-rose-500"
                                : "bg-gradient-to-r from-amber-500 to-emerald-500"
                            )}
                          />
                        </div>
                      </div>

                      {/* Metric Trio */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-100 dark:border-[#262626] text-center font-mono">
                        <div className="p-1.5 bg-neutral-50 dark:bg-[#141414] rounded-[6px]">
                          <span className="text-micro uppercase text-neutral-400 block">Days Elapsed</span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{eligibility.daysElapsed} d</span>
                        </div>
                        <div className="p-1.5 bg-neutral-50 dark:bg-[#141414] rounded-[6px]">
                          <span className="text-micro uppercase text-neutral-400 block">Countdown</span>
                          <span className={cn(
                            "text-xs font-bold truncate block",
                            eligibility.daysRemaining === 0 ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {eligibility.daysRemaining === 0 ? 'Eligible Now' : `${eligibility.daysRemaining} d left`}
                          </span>
                        </div>
                        <div className="p-1.5 bg-neutral-50 dark:bg-[#141414] rounded-[6px]">
                          <span className="text-micro uppercase text-neutral-400 block">Age Check</span>
                          <span className={cn(
                            "text-xs font-bold block",
                            eligibility.isAgeEligible ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {eligibility.minAgeForNextDan ? `Min ${eligibility.minAgeForNextDan} yrs (Is ${eligibility.currentAge ?? '?'})` : 'Satisfied'}
                          </span>
                        </div>
                      </div>

                      <p className="text-micro text-neutral-500 dark:text-[#888] font-mono leading-relaxed">
                        {eligibility.subtext}
                      </p>
                    </div>
                  ) : null}

                  {/* Dan Promotion History Log Sub-Panel */}
                  <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Certificate className="w-4 h-4 text-amber-500" weight="bold" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono">
                          Dan Promotion History ({staffDanRecords.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddDan}
                        className="px-2.5 py-1 bg-brand hover:bg-brand-strong text-white text-micro font-bold uppercase tracking-wider rounded-[6px] transition-colors flex items-center gap-1 cursor-pointer font-mono shadow-sm shadow-brand/20"
                      >
                        <Plus className="w-3 h-3" weight="bold" />
                        <span>Record Promotion</span>
                      </button>
                    </div>

                    {staffDanRecords.length === 0 ? (
                      <div className="p-3 bg-white dark:bg-[#1C1C1C] border border-dashed border-neutral-300 dark:border-[#333] rounded-[8px] text-center text-xs text-neutral-500 dark:text-[#777] font-mono">
                        No Dan promotion history recorded yet. Click &quot;Record Promotion&quot; to log past 1st Dan, 2nd Dan, etc.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {staffDanRecords.map(rec => (
                          <div
                            key={rec.id}
                            className="p-3 bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-[8px] bg-neutral-900 text-amber-400 font-mono font-black text-xs flex items-center justify-center border border-amber-500/30 shrink-0 shadow-sm">
                                {getDanStripes(rec.danLevel)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-neutral-900 dark:text-white">
                                    {formatDanRank(rec.danLevel)} Kukkiwon
                                  </span>
                                  {rec.certificateNo && (
                                    <span className="text-micro font-mono px-1.5 py-0.5 bg-neutral-100 dark:bg-[#262626] rounded text-neutral-600 dark:text-[#999] border border-neutral-200 dark:border-[#333]">
                                      #{rec.certificateNo}
                                    </span>
                                  )}
                                </div>
                                <p className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-0.5">
                                  Issued: {rec.issueDate} {rec.location ? `• ${rec.location}` : ''} {rec.examinerName ? `• Examiner: ${rec.examinerName}` : ''}
                                </p>
                                {rec.notes && (
                                  <p className="text-micro text-neutral-400 dark:text-[#777] italic mt-0.5 truncate">
                                    &quot;{rec.notes}&quot;
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {rec.certificateUrl && (
                                <a
                                  href={rec.certificateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Certificate"
                                  className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] rounded transition-colors"
                                >
                                  <ArrowSquareOut className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditDan(rec)}
                                title="Edit Dan Record"
                                className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] rounded transition-colors cursor-pointer"
                              >
                                <PencilSimple className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDan(rec)}
                                title="Delete Dan Record"
                                className="p-1.5 text-neutral-500 hover:text-red-500 dark:text-[#888] dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-[#262626] rounded transition-colors cursor-pointer"
                              >
                                <TrashSimple className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 4: Cambodia Residential Address */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500" weight="bold" />
                    <span>{t('stf_home_address') || 'Residential Address (Cambodia)'}</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="manage-staff-panel-panel_street_address" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_street_address')}</label>
                      <input id="manage-staff-panel-panel_street_address"
                        type="text"
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                        value={editForm.address?.line1 || ''}
                        onChange={e => setEditForm({...editForm, address: { ...editForm.address, line1: e.target.value }})}
                        placeholder="House / Street address..."
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-panel_apt_suite" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_apt_suite')}</label>
                      <input id="manage-staff-panel-panel_apt_suite"
                        type="text"
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                        value={editForm.address?.line2 || ''}
                        onChange={e => setEditForm({...editForm, address: { ...editForm.address, line2: e.target.value }})}
                        placeholder="Apartment, building, suite..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label htmlFor="manage-staff-panel-panel_state_province" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_state_province')}</label>
                        {editForm.address?.stateProvince && !CAMBODIA_LOCATIONS[editForm.address.stateProvince] ? (
                          <div className="flex gap-2">
                            <input id="manage-staff-panel-panel_state_province"
                              type="text"
                              className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                              value={editForm.address.stateProvince === 'Other Custom' ? '' : editForm.address.stateProvince}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, stateProvince: e.target.value }})}
                              placeholder="Custom Province"
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, stateProvince: '', city: '' }})}
                              className="px-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-[#333] text-micro text-neutral-900 dark:text-white rounded-[8px] font-bold uppercase shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <select id="manage-staff-panel-panel_state_province"
                            className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand cursor-pointer"
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
                            <option value="">Select Province / City</option>
                            {Object.keys(CAMBODIA_LOCATIONS).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                            <option value="Other">Other...</option>
                          </select>
                        )}
                      </div>

                      <div>
                        <label htmlFor="manage-staff-panel-panel_district_commune" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_district_commune')}</label>
                        {editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince] && (editForm.address.city === 'Other Custom' || (editForm.address.city !== '' && !CAMBODIA_LOCATIONS[editForm.address.stateProvince].includes(editForm.address.city))) ? (
                          <div className="flex gap-2">
                            <input id="manage-staff-panel-panel_district_commune"
                              type="text"
                              className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                              value={editForm.address.city === 'Other Custom' ? '' : editForm.address.city}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                              placeholder="Custom District"
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, city: CAMBODIA_LOCATIONS[editForm.address.stateProvince][0] || '' }})}
                              className="px-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-[#333] text-micro text-neutral-900 dark:text-white rounded-[8px] font-bold uppercase shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince]) ? (
                          <select id="manage-staff-panel-panel_district_commune"
                            className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand cursor-pointer"
                            value={editForm.address?.city || ''}
                            onChange={e => {
                              if (e.target.value === 'Other') {
                                setEditForm({ ...editForm, address: { ...editForm.address, city: 'Other Custom' } });
                              } else {
                                setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }});
                              }
                            }}
                          >
                            <option value="">Select District / Khan</option>
                            {CAMBODIA_LOCATIONS[editForm.address.stateProvince].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                            <option value="Other">Other...</option>
                          </select>
                        ) : (
                          <input id="manage-staff-panel-panel_district_commune"
                            type="text"
                            className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                            value={editForm.address?.city || ''}
                            onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                            placeholder="District / Khan"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label htmlFor="manage-staff-panel-panel_postal_code" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_postal_code')}</label>
                        <input id="manage-staff-panel-panel_postal_code"
                          type="text"
                          className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                          value={editForm.address?.postalCode || ''}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, postalCode: e.target.value }})}
                          placeholder="12000"
                        />
                      </div>
                      <div>
                        <label htmlFor="manage-staff-panel-panel_country" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('panel_country')}</label>
                        <input id="manage-staff-panel-panel_country"
                          type="text"
                          className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                          value={editForm.address?.country || 'Cambodia'}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, country: e.target.value }})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 4: Emergency Contacts & Health Bio */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono flex items-center gap-2">
                    <Heartbeat className="w-4 h-4 text-rose-500" weight="bold" />
                    <span>{t('panel_emergency_medical') || 'Emergency Contact & Health Bio'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="col-span-1 sm:col-span-2">
                      <label htmlFor="manage-staff-panel-stu_emergency_contact" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_emergency_contact')}</label>
                      <input id="manage-staff-panel-stu_emergency_contact"
                        type="text"
                        value={editForm.emergencyContactName}
                        onChange={e => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                        placeholder="Contact person full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_emergency_phone" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_emergency_phone')}</label>
                      <input id="manage-staff-panel-stu_emergency_phone"
                        type="tel"
                        value={editForm.emergencyContactPhone}
                        onChange={e => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                        placeholder="012 999 888"
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_emergency_relation" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_emergency_relation')}</label>
                      <input id="manage-staff-panel-stu_emergency_relation"
                        type="text"
                        value={editForm.emergencyContactRelation}
                        onChange={e => setEditForm({ ...editForm, emergencyContactRelation: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                        placeholder="Spouse / Parent / Sibling"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="manage-staff-panel-stu_medical_notes" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_medical_notes')}</label>
                      <textarea id="manage-staff-panel-stu_medical_notes"
                        value={editForm.medicalNotes}
                        onChange={e => setEditForm({ ...editForm, medicalNotes: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand resize-none h-20"
                        placeholder="Any relevant medical history..."
                      />
                    </div>
                    <div>
                      <label htmlFor="manage-staff-panel-stu_allergies" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">{t('stu_allergies')}</label>
                      <textarea id="manage-staff-panel-stu_allergies"
                        value={editForm.allergies}
                        onChange={e => setEditForm({ ...editForm, allergies: e.target.value })}
                        className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand resize-none h-20"
                        placeholder="Known allergies or sensitivities..."
                      />
                    </div>
                  </div>
                </div>

                {/* Card 5: Class Assignments */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-mono flex items-center gap-2">
                      <ChalkboardTeacher className="w-4 h-4 text-purple-500" weight="bold" />
                      <span>Assigned Classes ({assignedClasses.length})</span>
                    </h3>
                  </div>

                  {assignedClasses.length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-[#777] italic font-mono py-2">
                      No classes are currently assigned to this coach.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignedClasses.map(cls => (
                        <div
                          key={cls.id}
                          className="p-3 bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-neutral-900 dark:text-white">{cls.name}</p>
                            <p className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-0.5">
                              {cls.daysOfWeek?.join(', ')} • {cls.startTime} - {cls.endTime}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-micro font-bold uppercase font-mono">
                            Coach
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // READ-ONLY PRESENTATION MODE
              <div className="space-y-5">
                <ContactActions contact={staff} name={staff.displayName} />
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] font-mono">Account Dossier</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Email</span>
                      <span className="font-bold text-neutral-900 dark:text-white font-mono break-all">{staff.email}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Role</span>
                      <span className="font-bold text-neutral-900 dark:text-white font-mono">{staff.role}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] font-mono">Demographics & Contact</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">English Name</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{staff.englishName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Khmer Name</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{staff.khmerName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Gender</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{staff.gender || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Date of Birth</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{staff.dob || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Phone Number</span>
                      <span className="font-medium text-neutral-900 dark:text-white font-mono">{staff.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Card: Kukkiwon Dossier in Read-Only Mode */}
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] font-mono flex items-center gap-1.5">
                      <Medal className="w-4 h-4 text-brand-ink" weight="bold" />
                      <span>Kukkiwon Credentials & Eligibility</span>
                    </h3>
                    {eligibility.status === 'ELIGIBLE' && (
                      <span className="px-2 py-0.5 rounded text-micro font-bold uppercase font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Eligible for {eligibility.nextDanLabel}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Current Dan Rank</span>
                      <span className="font-bold text-neutral-900 dark:text-white font-mono">
                        {eligibility.currentDanLabel} {eligibility.currentDan ? `(${getDanStripes(eligibility.currentDan)})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Kukkiwon ID</span>
                      <span className="font-bold text-neutral-900 dark:text-white font-mono">{staff.kukkiwonId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Issue Date</span>
                      <span className="font-medium text-neutral-900 dark:text-white font-mono">{staff.danIssueDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold block font-mono">Earliest Test Date</span>
                      <span className="font-medium text-neutral-900 dark:text-white font-mono">{eligibility.earliestTestDate || 'N/A'}</span>
                    </div>
                  </div>
                  {eligibility.currentDan && (
                    <div className="pt-2 border-t border-neutral-200 dark:border-[#262626]">
                      <p className="text-micro font-mono text-neutral-600 dark:text-[#aaa]">
                        Status: <span className="font-bold text-neutral-900 dark:text-white">{eligibility.headline}</span> ({eligibility.progressPercent}% elapsed)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          {canEdit && (
            <div className="p-3.5 sm:p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#141414] shrink-0 flex items-center justify-between gap-2 sm:gap-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="h-8.5 sm:h-9 px-2.5 sm:px-3.5 bg-transparent border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 active:scale-95 touch-manipulation font-bold uppercase tracking-wider text-micro sm:text-xs rounded-[6px] sm:rounded-[8px] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{t('stf_delete_staff') || 'Delete Staff'}</span>
                    <span className="xs:hidden">Delete</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving || isDeleting}
                  className="h-8.5 sm:h-9 px-3 sm:px-4 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-800 dark:text-white font-bold uppercase tracking-wider text-micro sm:text-xs rounded-[6px] sm:rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 active:scale-95 touch-manipulation"
                >
                  {t('act_cancel') || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isDeleting}
                  className="h-8.5 sm:h-9 px-3.5 sm:px-5 bg-brand hover:bg-brand-strong text-white font-bold uppercase tracking-wider text-micro sm:text-xs rounded-[6px] sm:rounded-[8px] shadow-sm shadow-brand/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95 touch-manipulation"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden xs:inline">{t('act_save') || 'Save Changes'}</span>
                      <span className="xs:hidden">Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Confirmation Dialog Overlay */}
      <AnimatePresence>
        {showSaveConfirm && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <ModalA11y label="Confirm staff changes" onClose={() => setShowSaveConfirm(false)} />
              <motion.div
                {...dialogMotion}
                className="w-full max-w-sm bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 text-center shadow-2xl flex flex-col items-center text-neutral-900 dark:text-white"
              >
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-brand-ink mb-4">
                  <ShieldCheck className="w-6 h-6" weight="bold" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white mb-2">
                  {t('stf_confirm_updates_title') || 'Confirm Staff Changes'}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed mb-6 font-medium">
                  {t('stf_confirm_updates_desc') || 'Are you sure you want to update this staff member profile and synchronise credentials?'}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(false)}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white font-bold uppercase tracking-widest text-micro rounded-[8px] transition-colors cursor-pointer"
                  >
                    {t('act_cancel') || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={executeSave}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-brand hover:bg-brand-strong text-white font-bold uppercase tracking-widest text-micro rounded-[8px] transition-colors shadow-sm shadow-brand/20 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>{t('confirm_save_btn') || 'Save Now'}</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Staff Password Modal */}
      {showPasswordModal && (
        <Portal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <ModalA11y label="Reset staff password" onClose={() => setShowPasswordModal(false)} />
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#1A1A1A]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[8px] bg-brand/10 flex items-center justify-center text-brand-ink">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Set Staff Password</h3>
                    <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono">{staff.displayName} (@{staff.username})</p>
                  </div>
                </div>
                <button aria-label="Close"
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-[8px] transition-colors cursor-pointer min-h-6 min-w-6 inline-flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[calc(90dvh-130px)] overflow-y-auto overscroll-contain">
                <div className="bg-neutral-50 dark:bg-[#1E1E1E] p-3 rounded-[8px] border border-neutral-200 dark:border-[#333] text-xs text-neutral-600 dark:text-neutral-300">
                  Directly update the staff member&apos;s admin login password. They will be able to log into the Admin Portal immediately using this password.
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="manage-staff-panel-new-password" className="text-micro uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider font-mono">New Password</label>
                  <div className="relative">
                    <input id="manage-staff-panel-new-password"
                      type={showStaffPasswordText ? "text" : "password"}
                      value={newStaffPassword}
                      onChange={e => setNewStaffPassword(e.target.value)}
                      placeholder="Min 6 characters (e.g. Coach1234!)"
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#333] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-brand transition-colors pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPasswordText(!showStaffPasswordText)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors p-1 cursor-pointer"
                    >
                      {showStaffPasswordText ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStaffPassword(`Tkd${staff.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}!2026`)}
                    className="text-micro text-brand-ink hover:underline font-mono cursor-pointer"
                  >
                    Suggest: Tkd{staff.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}!2026
                  </button>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
                  disabled={isUpdatingPassword}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStaffPassword}
                  disabled={isUpdatingPassword || !newStaffPassword || newStaffPassword.length < 6}
                  className="px-5 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all shadow-md shadow-brand/20 flex items-center gap-2 cursor-pointer"
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

      {/* Dan Promotion History Modal */}
      {showDanModal && (
        <Portal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <ModalA11y label="Kukkiwon Dan record" onClose={() => setShowDanModal(false)} />
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#1A1A1A]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[8px] bg-red-500/10 flex items-center justify-center text-brand-ink">
                    <Medal className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                      {editingDanRecord ? `Edit ${formatDanRank(editingDanRecord.danLevel)} Promotion` : 'Record Dan Promotion'}
                    </h3>
                    <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono">
                      {staff.displayName} (@{staff.username})
                    </p>
                  </div>
                </div>
                <button aria-label="Close"
                  type="button"
                  onClick={() => setShowDanModal(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#262626] rounded-[8px] transition-colors cursor-pointer min-h-6 min-w-6 inline-flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDanPromotion} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="manage-staff-panel-dan-level-1st-9th-dan" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Dan Level (1st - 9th Dan)
                    </label>
                    <select id="manage-staff-panel-dan-level-1st-9th-dan"
                      value={danModalForm.danLevel}
                      onChange={e => setDanModalForm({ ...danModalForm, danLevel: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand cursor-pointer font-bold"
                    >
                      {Object.values(KUKKIWON_DAN_RULES).map(rule => (
                        <option key={rule.danLevel} value={rule.danLevel}>
                          {formatDanRank(rule.danLevel)} ({rule.englishTitle})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="manage-staff-panel-promotion-issue-date" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Promotion / Issue Date
                    </label>
                    <input id="manage-staff-panel-promotion-issue-date"
                      type="date"
                      required
                      value={danModalForm.issueDate}
                      onChange={e => setDanModalForm({ ...danModalForm, issueDate: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand [color-scheme:light] dark:[color-scheme:dark] font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="manage-staff-panel-kukkiwon-certificate-no" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Kukkiwon Certificate No.
                    </label>
                    <input id="manage-staff-panel-kukkiwon-certificate-no"
                      type="text"
                      value={danModalForm.certificateNo}
                      onChange={e => setDanModalForm({ ...danModalForm, certificateNo: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono"
                      placeholder="e.g. 05123456"
                    />
                  </div>

                  <div>
                    <label htmlFor="manage-staff-panel-examiner-grandmaster" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Examiner / Grandmaster
                    </label>
                    <input id="manage-staff-panel-examiner-grandmaster"
                      type="text"
                      value={danModalForm.examinerName}
                      onChange={e => setDanModalForm({ ...danModalForm, examinerName: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                      placeholder="e.g. GM Lee"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="manage-staff-panel-testing-location-venue" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Testing Location / Venue
                    </label>
                    <input id="manage-staff-panel-testing-location-venue"
                      type="text"
                      value={danModalForm.location}
                      onChange={e => setDanModalForm({ ...danModalForm, location: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                      placeholder="Infinity Taekwondo Academy / Kukkiwon Seoul"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="manage-staff-panel-certificate-scan-link-url" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Certificate Scan Link / URL
                    </label>
                    <input id="manage-staff-panel-certificate-scan-link-url"
                      type="text"
                      value={danModalForm.certificateUrl}
                      onChange={e => setDanModalForm({ ...danModalForm, certificateUrl: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand font-mono text-xs"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="manage-staff-panel-notes-comments" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] mb-1 font-mono">
                      Notes & Comments
                    </label>
                    <textarea id="manage-staff-panel-notes-comments"
                      rows={2}
                      value={danModalForm.notes}
                      onChange={e => setDanModalForm({ ...danModalForm, notes: e.target.value })}
                      className="w-full bg-white dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#2A2A2A] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand resize-none"
                      placeholder="Special achievements, test score, notes..."
                    />
                  </div>
                </div>

                <div className="p-4 -mx-5 -mb-5 bg-neutral-50 dark:bg-[#1A1A1A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDanModal(false)}
                    className="h-8.5 sm:h-9 px-3.5 sm:px-4 text-micro sm:text-xs font-bold text-neutral-600 dark:text-[#AAA] hover:text-neutral-900 dark:hover:text-white uppercase tracking-wider transition-colors cursor-pointer rounded-[6px] sm:rounded-[8px] active:scale-95 touch-manipulation"
                    disabled={isSubmittingDan}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDan}
                    className="h-8.5 sm:h-9 px-4 sm:px-5 bg-brand hover:bg-brand-strong disabled:opacity-50 text-white text-micro sm:text-xs font-bold uppercase tracking-wider rounded-[6px] sm:rounded-[8px] transition-all shadow-md shadow-brand/20 flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {isSubmittingDan ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingDanRecord ? 'Update Promotion' : 'Save Dan Promotion'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </Portal>
  );
}
