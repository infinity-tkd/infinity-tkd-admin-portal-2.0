'use client';

import { dialogMotion } from '@/lib/motion';
import { academyDate } from '@/lib/dates';

import { supabase } from '@/lib/supabase';
import { generatePassword } from '@/lib/passwords';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore, User, Role } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { PageTransition } from './PageTransition';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { GithubLogo } from '@phosphor-icons/react/dist/csr/GithubLogo';
import { Link as LinkIcon } from '@phosphor-icons/react/dist/csr/Link';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { Checks } from '@phosphor-icons/react/dist/csr/Checks';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeClosed } from '@phosphor-icons/react/dist/csr/EyeClosed';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Sliders } from '@phosphor-icons/react/dist/csr/Sliders';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Building } from '@phosphor-icons/react/dist/csr/Building';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { HardDrives } from '@phosphor-icons/react/dist/csr/HardDrives';
import { LockKey } from '@phosphor-icons/react/dist/csr/LockKey';
import { Pulse } from '@phosphor-icons/react/dist/csr/Pulse';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { BulkImportStaffModal } from './BulkImportStaffModal';
import { AccountSecurityPanel } from '@/components/AccountSecurityPanel';
import { RolePermissionsMatrixPanel } from './RolePermissionsMatrixPanel';
import { UserPermissionsModal } from './UserPermissionsModal';
import { PwaDiagnosticsModal } from '@/components/pwa/PwaDiagnosticsModal';
import { playChime, isAudioEnabled, setAudioEnabled } from '@/lib/soundEffects';
import { AcademySettingsPanel } from './settings/AcademySettingsPanel';
import settingsStyles from './settings/settings.module.css';

const formatRoleLocalized = (roleName: string, t: any) => {
  if (roleName === 'Root' || roleName === 'Super Root') return t('role_root') || 'Root';
  if (roleName === 'Admin') return t('role_admin') || 'Admin';
  if (roleName === 'Head Coach') return t('role_head_coach') || 'Head Coach';
  if (roleName === 'Coach') return t('role_coach') || 'Coach';
  if (roleName === 'Assistant Coach') return t('role_assistant_coach') || 'Assistant Coach';
  if (roleName === 'Student') return t('role_student') || 'Student';
  return roleName;
};

export function SettingsView() {
  const { state, setTheme, setLanguage, addUser, updateUser, showNotification, can } = useAppStore();
  const t = useT();

  // Active Tab: Preferences, Profile, Accounts, Permissions (Root), Security, Data
  const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'members' | 'permissions' | 'security' | 'data'>('general');
  const role = state.currentUser?.role;
  const isRoot = role === 'Root' || role === 'Super Root';
  const isAdmin = (role === 'Admin' || isRoot) && can('action:staff_manage');

  // Sound Feedback State
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [isPlayingTestChime, setIsPlayingTestChime] = useState(false);

  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const savingUser = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [busyUsers, setBusyUsers] = useState<Set<string>>(new Set());
  const busyUserIds = useRef(new Set<string>());

  // Storage Cache Size in KB
  const [cacheSizeKB, setCacheSizeKB] = useState<number>(0);
  const [showPwaDiagnostics, setShowPwaDiagnostics] = useState(false);

  // Account management state
  const [showUserModal, setShowUserModal] = useState<string | 'new' | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'cards'>('table');
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    displayName: '',
    khmerName: '',
    phone: '',
    role: 'Student' as Role,
    isActive: true,
    profilePicturePath: '',
    password: '',
    studentId: ''
  });

  // Password modal state
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [permissionTargetUser, setPermissionTargetUser] = useState<User | null>(null);
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [showTargetPasswordText, setShowTargetPasswordText] = useState(false);
  const [showModalPasswordText, setShowModalPasswordText] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalBusy = useRef(false); modalBusy.current = isSavingUser || isResettingPassword;
  const activeModal = showUserModal ? 'account' : passwordTargetUser ? 'password' : showPurgeConfirm ? 'cache' : null;
  useEffect(() => {
    if (!activeModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => modalRef.current?.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled)')?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]:not([inert])')) return;
      if (event.key === 'Escape' && !modalBusy.current) {
        setShowUserModal(null); setPasswordTargetUser(null); setTargetNewPassword(''); setShowPurgeConfirm(false);
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []).filter(element => element.getClientRects().length);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [activeModal]);

  // Filters & Search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('All');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'All' | 'Active' | 'Locked'>('All');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'staff' | 'students' | 'active' | null>(null);

  // Load Preferences & Cache Size on Mount
  useEffect(() => {
    setSoundActive(isAudioEnabled());

    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('infinity_')) {
          const val = localStorage.getItem(key) || '';
          totalBytes += 2 * (key.length + val.length);
        }
      }
      setCacheSizeKB(Math.round((totalBytes / 1024) * 10) / 10);
    } catch {}
  }, []);

  const handleToggleSound = (enabled: boolean) => {
    setSoundActive(enabled);
    setAudioEnabled(enabled);
    if (enabled) {
      playChime('bell');
    }
  };

  const handleTestChime = () => {
    setIsPlayingTestChime(true);
    playChime('success');
    setTimeout(() => setIsPlayingTestChime(false), 500);
  };

  const activeBranch = state.academyProfile.defaultBranchId === 'all' || !state.academyProfile.defaultBranchId
    ? undefined : state.branches.find(branch => branch.id === state.academyProfile.defaultBranchId);

  const handleResetTargetPassword = async () => {
    if (!passwordTargetUser || !targetNewPassword || targetNewPassword.length < 12) {
      showNotification('Password must be at least 12 characters long.', 'warning');
      return;
    }
    setIsResettingPassword(true);
    try {
      await updateUser(passwordTargetUser.id, { password: targetNewPassword });
      showNotification(`Password for @${passwordTargetUser.username} updated successfully!`, 'success');
      playChime('success');
      setPasswordTargetUser(null);
      setTargetNewPassword('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to reset password.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getManageableRoles = () => {
    if (isRoot) return ['Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Student'];
    if (isAdmin) return ['Head Coach', 'Coach', 'Assistant Coach', 'Student'];
    return [];
  };

  const manageableRoles = getManageableRoles();

  // Handle KPI Click Quick Filtering
  const handleKpiClick = (type: 'all' | 'staff' | 'students' | 'active') => {
    if (activeKpiFilter === type) {
      setActiveKpiFilter(null);
      setMemberRoleFilter('All');
      setMemberStatusFilter('All');
    } else {
      setActiveKpiFilter(type);
      if (type === 'all') {
        setMemberRoleFilter('All');
        setMemberStatusFilter('All');
      } else if (type === 'staff') {
        setMemberRoleFilter('StaffGroup');
        setMemberStatusFilter('All');
      } else if (type === 'students') {
        setMemberRoleFilter('Student');
        setMemberStatusFilter('All');
      } else if (type === 'active') {
        setMemberRoleFilter('All');
        setMemberStatusFilter('Active');
      }
    }
  };

  const filteredUsers = useMemo(() => {
    return state.users.filter(u => {
      const q = memberSearch.trim().toLowerCase();
      const matchesSearch = !q || 
        u.displayName.toLowerCase().includes(q) || 
        u.username.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.khmerName && u.khmerName.toLowerCase().includes(q));

      let matchesRole = true;
      if (memberRoleFilter === 'StaffGroup') {
        matchesRole = ['Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Root', 'Super Root'].includes(u.role);
      } else if (memberRoleFilter !== 'All') {
        matchesRole = u.role === memberRoleFilter;
      }

      let matchesStatus = true;
      if (memberStatusFilter === 'Active') {
        matchesStatus = u.isActive;
      } else if (memberStatusFilter === 'Locked') {
        matchesStatus = !u.isActive;
      }

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [state.users, memberSearch, memberRoleFilter, memberStatusFilter]);

  // KPI Metrics
  const totalUsersCount = state.users.length;
  const staffUsersCount = state.users.filter(u => ['Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Root', 'Super Root'].includes(u.role)).length;
  const studentUsersCount = state.users.filter(u => u.role === 'Student').length;
  const activeUsersCount = state.users.filter(u => u.isActive).length;

  const handleSaveUser = async () => {
    if (savingUser.current || !isAdmin) return;
    if (!userForm.username.trim()) {
      showNotification('Username is required.', 'warning');
      return;
    }
    if (!userForm.displayName.trim()) {
      showNotification('Display name is required.', 'warning');
      return;
    }
    savingUser.current = true; setIsSavingUser(true);
    try {
    if (showUserModal === 'new') {
      if (!userForm.password || userForm.password.length < 12) {
        showNotification('Initial password must be at least 12 characters long.', 'warning');
        return;
      }
      const result = await addUser(userForm);
      if (result && !result.success) {
        showNotification(result.error || t('panel_err_failed_provision'), 'error');
        return;
      } else {
        showNotification("Account created successfully.", 'success');
        playChime('success');
      }
    } else if (typeof showUserModal === 'string') {
      const profileChanges = { username: userForm.username, email: userForm.email, displayName: userForm.displayName, khmerName: userForm.khmerName, phone: userForm.phone, role: userForm.role, isActive: userForm.isActive, profilePicturePath: userForm.profilePicturePath, studentId: userForm.studentId };
      await updateUser(showUserModal, profileChanges);
      showNotification("Account details updated successfully.", 'success');
      playChime('success');
    }
    setShowUserModal(null);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Account could not be saved. Your edits are still here.', 'error');
    } finally { savingUser.current = false; setIsSavingUser(false); }
  };

  const handleEditUser = (u: User) => {
    setUserForm({
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      khmerName: u.khmerName || '',
      phone: u.phone || '',
      role: u.role,
      isActive: u.isActive,
      profilePicturePath: u.profilePicturePath || '',
      password: '',
      studentId: u.studentId || ''
    });
    setShowUserModal(u.id);
  };

  const canManageUser = (targetUser: User) => {
    if (isRoot) return true;
    if (isAdmin && targetUser.role !== 'Root' && targetUser.role !== 'Super Root' && targetUser.role !== 'Admin') return true;
    return false;
  };

  const handleToggleAccount = async (user: User) => {
    if (!canManageUser(user) || busyUserIds.current.has(user.id)) return;
    busyUserIds.current.add(user.id); setBusyUsers(new Set(busyUserIds.current));
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      showNotification('Account @' + user.username + (user.isActive ? ' locked.' : ' unlocked.'), 'success');
    } catch (error) { showNotification(error instanceof Error ? error.message : 'Account status could not be changed.', 'error'); }
    finally { busyUserIds.current.delete(user.id); setBusyUsers(new Set(busyUserIds.current)); }
  };

  const renderUserCard = (u: User) => {
    const isManageable = canManageUser(u);
    const student = (u.role === 'Student' || u.studentId) ? state.students.find(s => 
      s.id === u.studentId || 
      s.profileId === u.id
    ) : null;

    return (
      <div 
        key={u.id}
        className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-sm hover:border-[#EF2F38]/40 transition-all"
      >
        <div>
          {/* Top Row: Avatar, Names, and Access Status */}
          <div className="flex items-start justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <SafeImage 
                src={u.profilePicturePath} 
                alt={u.displayName} 
                containerClassName="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{u.displayName}</span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono truncate">@{u.username}</span>
              </div>
            </div>

            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono shrink-0 border",
              u.isActive 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-red-500")} />
              {u.isActive ? "Active" : "Locked"}
            </span>
          </div>

          {/* Role & Linked Entity Badges */}
          <div className="space-y-2 border-t border-neutral-100 dark:border-[#262626] pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono uppercase font-bold">Role:</span>
              <span className={cn(
                "px-2 py-0.5 rounded-[8px] text-[10px] font-bold uppercase tracking-widest border font-mono", 
                u.role === 'Root' || u.role === 'Super Root' ? "bg-red-500/15 text-red-700 dark:text-[#EF2F38] border-red-500/40" : 
                u.role === 'Admin' ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" : 
                u.role === 'Student' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-transparent" 
              )}>
                {formatRoleLocalized(u.role, t)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono uppercase font-bold shrink-0">Linked:</span>
              <div className="truncate">
                {(() => {
                  if (u.role === 'Student' || u.studentId) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[10px] font-bold font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 truncate">
                        <span>🎓</span>
                        <span className="truncate">{student ? `${student.englishName} (${student.id})` : (u.studentId || 'Portal Linked')}</span>
                      </span>
                    );
                  }
                  if (u.role === 'Root' || u.role === 'Super Root') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[10px] font-bold font-mono bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        <span>⚡</span>
                        <span>System Root</span>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 truncate">
                      <span>🥋</span>
                      <span className="truncate">Staff: {u.englishName || u.displayName}</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate" title={u.email}>
              {u.email}
            </div>

            {u.phone && (
              <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                <Phone className="w-3 h-3 text-emerald-500" />
                <span>{u.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-[#262626]">
          <span className="text-[10px] text-neutral-400 font-mono">
            {isManageable ? 'Manageable' : 'Protected'}
          </span>
          {isManageable && (
            <div className="flex items-center gap-1.5">
              {isRoot && (
                <button 
                  type="button"
                  title="Account Permissions & Overrides" 
                  onClick={() => setPermissionTargetUser(u)}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 rounded-[8px] border border-purple-500/30 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                >
                  <ShieldCheck className="w-4 h-4"/>
                </button>
              )}
              <button 
                type="button"
                title="Set / Change Password" 
                onClick={() => {
                  setTargetNewPassword('');
                  setPasswordTargetUser(u);
                }}
                className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-[#EF2F38] dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
              >
                <Key className="w-4 h-4 text-[#EF2F38]"/>
              </button>
              <button 
                type="button"
                title={t('act_edit')} 
                onClick={() => handleEditUser(u)}
                className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
              >
                <PencilSimple className="w-4 h-4"/>
              </button>
              <button 
                type="button"
                title={t('set_lock_unlock')} 
                onClick={() => handleToggleAccount(u)}
                disabled={busyUsers.has(u.id)}
                className={cn(
                  "p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-[8px] border transition-colors cursor-pointer active:scale-95 touch-manipulation", 
                  u.isActive 
                    ? "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-red-500 hover:border-red-500/50" 
                    : "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20"
                )}
              >
                <Lock className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleExportBackup = async () => {
    if (isExporting || !isRoot) return;
    setIsExporting(true);
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if(!session)throw new Error('Please sign in again.');
      const response = await fetch('/api/admin/export',{headers:{Authorization:'Bearer '+session.access_token}});
      if(!response.ok){const result=await response.json();throw new Error(result.error?.message || 'Export failed.');}
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;
      link.download='infinity_tkd_application_data_'+academyDate()+'.json';link.click();URL.revokeObjectURL(url);
      showNotification('Application data exported. Auth and Storage require separate backups.','success');
    }catch(e){showNotification(e instanceof Error ? e.message : 'Export failed.','error');}
    finally { setIsExporting(false); }
  };

  const handleExecutePurge = () => {
    const keys = [
      'infinity_cached_user',
      'infinity_cached_students',
      'infinity_cached_branches',
      'infinity_cached_videos',
      'infinity_cached_techniques',
      'infinity_lms_physical_grades',
      'infinity_remember_login'
    ];
    keys.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    window.location.reload();
  };

  return (
    <div className={cn(settingsStyles.workspace, "w-full max-w-7xl mx-auto space-y-6 px-3 sm:px-6 py-4")}>
      {/* 1. Refined Executive Header */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 shadow-sm transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] shrink-0">
            <Sliders className="w-5 h-5" weight="bold" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[6px] border border-red-500/20">
                INFINITY TKD · SETTINGS
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-[6px]">
                {state.isLoading ? 'LOADING SETTINGS' : state.dataLoadErrors?.length ? 'SOME DATA UNAVAILABLE' : 'ACADEMY WORKSPACE'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-neutral-900 dark:text-white font-sans">
              {t('set_title')}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-sans">
              {t('set_subtitle')}
            </p>
          </div>
        </div>

        {/* Quick Context Chips */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex-1 sm:flex-none">
            <Building className="w-3.5 h-3.5 text-[#EF2F38] shrink-0" weight="bold" />
            <span className="text-neutral-500 dark:text-neutral-400">{t('set_active_branch')}:</span>
            <span className="font-bold text-neutral-900 dark:text-white truncate">{activeBranch?.name || 'All Locations'}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex-1 sm:flex-none">
            <UserCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" weight="bold" />
            <span className="text-neutral-500 dark:text-neutral-400">User:</span>
            <span className="font-bold text-neutral-900 dark:text-white truncate">@{state.currentUser?.username || '—'}</span>
          </div>
        </div>
      </div>

      {state.dataLoadErrors?.length ? <div role="alert" className={settingsStyles.notice}><p className="text-sm font-semibold">Some settings data could not be loaded.</p><p className={settingsStyles.hint}>Loaded data may be incomplete. Refresh and retry before making changes.</p></div> : null}
      <div className={settingsStyles.shell}>
      <div className={settingsStyles.mobileNavigation}>
        <label htmlFor="settings-section" className="sr-only">Settings section</label>
        <select id="settings-section" className={settingsStyles.input} value={activeTab} onChange={event => setActiveTab(event.target.value as typeof activeTab)}>
          <option value="general">{t('set_tab_general')}</option><option value="profile">{t('set_tab_profile')}{isProfileDirty ? ' · Unsaved changes' : ''}</option>
          {isAdmin && <option value="members">{t('set_tab_accounts')}</option>}{isRoot && <option value="permissions">Access matrix</option>}
          <option value="security">{t('set_tab_security')}</option><option value="data">{t('set_tab_data')}</option>
        </select>
      </div>
      <nav className={settingsStyles.navigation} aria-label="Settings sections">
        {[
          { id: 'general', label: t('set_tab_general'), icon: Sliders },
          { id: 'profile', label: t('set_tab_profile'), icon: Building },
          ...(isAdmin ? [{ id: 'members', label: t('set_tab_accounts'), icon: UsersThree }] : []),
          ...(isRoot ? [{ id: 'permissions', label: 'Access matrix', icon: LockKey }] : []),
          { id: 'security', label: t('set_tab_security'), icon: ShieldCheck },
          { id: 'data', label: t('set_tab_data'), icon: Database },
        ].map(item => <button type="button" key={item.id} aria-current={activeTab === item.id ? 'page' : undefined}
          aria-controls="settings-content" onClick={() => setActiveTab(item.id as typeof activeTab)}>
          <item.icon size={16} aria-hidden="true" /><span>{item.label}</span>
          {item.id === 'profile' && isProfileDirty && <span className="ml-auto text-xs" aria-label="Unsaved changes">•</span>}
        </button>)}
      </nav>
      <PageTransition identity={activeTab} className={settingsStyles.content}>
      <div id="settings-content">
      {/* ========================================================================= */}
      {/* TAB 1: PREFERENCES (THEME, LANGUAGE, AUDIO CHIMES)                       */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm transition-colors space-y-6">
            <h2 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-3 font-mono flex items-center gap-2">
              <Sliders className="w-4 h-4" /> {t('set_tab_general')}
            </h2>

            {/* Visual Theme Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-[#262626]">
              <div className="max-w-md">
                <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">{t('set_theme')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('set_theme_desc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                <button 
                  type="button"
                  aria-pressed={state.theme === 'light'}
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-[8px] border text-xs font-bold transition-all cursor-pointer min-h-[48px] active:scale-95 touch-manipulation",
                    state.theme === 'light'
                      ? "bg-amber-500/10 border-amber-500/40 text-neutral-900 shadow-sm ring-2 ring-amber-500/20 font-black"
                      : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <Sun className="w-4 h-4 text-amber-500" weight="fill" />
                  <div className="text-left">
                    <span className="block">{t('set_theme_light')}</span>
                    <span className="text-[10px] text-neutral-400 font-mono block">Bright Day</span>
                  </div>
                  {state.theme === 'light' && <Check className="w-3.5 h-3.5 ml-auto text-amber-600" weight="bold" />}
                </button>

                <button 
                  type="button"
                  aria-pressed={state.theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-[8px] border text-xs font-bold transition-all cursor-pointer min-h-[48px] active:scale-95 touch-manipulation",
                    state.theme === 'dark'
                      ? "bg-red-500/10 border-red-500/40 text-white shadow-sm ring-2 ring-red-500/20 font-black"
                      : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <Moon className="w-4 h-4 text-indigo-400" weight="fill" />
                  <div className="text-left">
                    <span className="block">{t('set_theme_dark')}</span>
                    <span className="text-[10px] text-neutral-400 font-mono block">Night Ops</span>
                  </div>
                  {state.theme === 'dark' && <Check className="w-3.5 h-3.5 ml-auto text-red-500" weight="bold" />}
                </button>
              </div>
            </div>

            {/* Visual Language Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-[#262626]">
              <div className="max-w-md">
                <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">{t('set_language')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('set_language_desc')}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                <button 
                  type="button"
                  aria-pressed={state.language === 'en'}
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-[8px] border text-xs font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                    state.language === 'en'
                      ? "bg-red-500/10 border-red-500/50 text-[#EF2F38] dark:text-white ring-2 ring-red-500/20 font-black"
                      : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <span className="w-5 h-5 rounded-[6px] bg-red-500/15 text-[#EF2F38] text-[10px] font-black flex items-center justify-center font-mono shrink-0">EN</span>
                  <span className="truncate">English</span>
                </button>

                <button 
                  type="button"
                  aria-pressed={state.language === 'kh'}
                  onClick={() => setLanguage('kh')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-[8px] border text-xs font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                    state.language === 'kh'
                      ? "bg-red-500/10 border-red-500/50 text-[#EF2F38] dark:text-white ring-2 ring-red-500/20 font-black"
                      : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <span className="w-5 h-5 rounded-[6px] bg-blue-500/15 text-blue-500 text-[10px] font-black flex items-center justify-center font-mono shrink-0">KM</span>
                  <span className="truncate">ខ្មែរ</span>
                </button>

                <button 
                  type="button"
                  aria-pressed={state.language === 'zh'}
                  onClick={() => setLanguage('zh')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-[8px] border text-xs font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                    state.language === 'zh'
                      ? "bg-red-500/10 border-red-500/50 text-[#EF2F38] dark:text-white ring-2 ring-red-500/20 font-black"
                      : "bg-neutral-50 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <span className="w-5 h-5 rounded-[6px] bg-amber-500/15 text-amber-500 text-[10px] font-black flex items-center justify-center font-mono shrink-0">ZH</span>
                  <span className="truncate">中文</span>
                </button>
              </div>
            </div>

            {/* Sound & Audio Feedback Card */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="max-w-md">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('set_audio_feedback')}</p>
                  <span className={cn(
                    "px-2 py-0.5 text-[9px] font-bold font-mono rounded-[8px] uppercase tracking-wider",
                    soundActive 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                      : "bg-neutral-200 dark:bg-[#262626] text-neutral-500"
                  )}>
                    {soundActive ? 'Active' : 'Muted'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('set_audio_desc')}</p>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleTestChime}
                  disabled={!soundActive}
                  className="w-full sm:w-auto px-3.5 py-2.5 min-h-[44px] bg-neutral-100 dark:bg-[#1C1C1C] hover:bg-neutral-200 dark:hover:bg-[#262626] disabled:opacity-40 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 touch-manipulation"
                >
                  <Sparkle className={cn("w-3.5 h-3.5 text-amber-500", isPlayingTestChime && "animate-spin")} />
                  <span>{t('set_test_chime')}</span>
                </button>

                <button
                  type="button"
                  aria-pressed={soundActive}
                  aria-label="Audio feedback"
                  onClick={() => handleToggleSound(!soundActive)}
                  className={cn(
                    "w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-[8px] border text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 touch-manipulation",
                    soundActive
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-300 dark:border-[#262626] text-neutral-500"
                  )}
                >
                  {soundActive ? <SpeakerHigh className="w-4 h-4" weight="bold" /> : <SpeakerSlash className="w-4 h-4" />}
                  <span>{soundActive ? 'Enabled' : 'Muted'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 2: ACADEMY PROFILE & OPERATIONAL STANDARDS                           */}
      {/* ========================================================================= */}
      <div hidden={activeTab !== 'profile'}>
        <AcademySettingsPanel onDirtyChange={setIsProfileDirty} />
      </div>

      {/* ========================================================================= */}
      {/* TAB 3: ACCOUNTS & ACCESS (RBAC)                                          */}
      {/* ========================================================================= */}
      {activeTab === 'members' && isAdmin && (
        <div className="space-y-5">
          {/* Top Bar: Title & Primary Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-neutral-900 dark:text-white font-sans flex items-center gap-2">
                <UsersThree className="w-5 h-5 text-[#EF2F38]" /> {t('usr_title')}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-sans mt-0.5">
                {t('usr_subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button 
                type="button"
                onClick={() => setIsBulkImporting(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 min-h-[42px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <DownloadSimple className="w-4 h-4" />
                <span>{t('dir_bulk_import')}</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setUserForm({ 
                    username: '', 
                    email: '', 
                    displayName: '', 
                    khmerName: '',
                    phone: '',
                    role: manageableRoles[0] as Role, 
                    isActive: true, 
                    profilePicturePath: '',
                    password: generatePassword(),
                    studentId: ''
                  });
                  setShowUserModal('new');
                }}
                className="flex-1 sm:flex-none px-4 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-[#EF2F38]/20"
              >
                <UserPlus className="w-4 h-4" weight="bold" /> 
                <span>{t('usr_add_account')}</span>
              </button>
            </div>
          </div>

          {/* Interactive Account KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* 1. Total Accounts */}
            <button
              type="button"
              onClick={() => handleKpiClick('all')}
              className={cn(
                "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
                activeKpiFilter === 'all'
                  ? "ring-2 ring-[#EF2F38]/40 border-[#EF2F38] bg-red-500/[0.04] dark:bg-red-500/[0.08]"
                  : "border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider truncate">
                  {t('set_kpi_total')}
                </p>
                <p className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white font-mono mt-0.5">{totalUsersCount}</p>
              </div>
              <div className="w-10 h-10 rounded-[8px] bg-neutral-200/80 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-[#262626]">
                <UsersThree className="w-5 h-5" weight="bold" />
              </div>
            </button>

            {/* 2. Staff Members */}
            <button
              type="button"
              onClick={() => handleKpiClick('staff')}
              className={cn(
                "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
                activeKpiFilter === 'staff'
                  ? "ring-2 ring-orange-500/50 border-orange-500 bg-orange-500/[0.06]"
                  : "border-neutral-200 dark:border-[#262626] hover:border-orange-500/40"
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wider truncate">
                  {t('set_kpi_staff')}
                </p>
                <p className="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-400 font-mono mt-0.5">{staffUsersCount}</p>
              </div>
              <div className="w-10 h-10 rounded-[8px] bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                <ShieldCheck className="w-5 h-5" weight="bold" />
              </div>
            </button>

            {/* 3. Student Accounts */}
            <button
              type="button"
              onClick={() => handleKpiClick('students')}
              className={cn(
                "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
                activeKpiFilter === 'students'
                  ? "ring-2 ring-blue-500/50 border-blue-500 bg-blue-500/[0.06]"
                  : "border-neutral-200 dark:border-[#262626] hover:border-blue-500/40"
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider truncate">
                  {t('set_kpi_students')}
                </p>
                <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">{studentUsersCount}</p>
              </div>
              <div className="w-10 h-10 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <GraduationCap className="w-5 h-5" weight="bold" />
              </div>
            </button>

            {/* 4. Active Credentials */}
            <button
              type="button"
              onClick={() => handleKpiClick('active')}
              className={cn(
                "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
                activeKpiFilter === 'active'
                  ? "ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-500/[0.06]"
                  : "border-neutral-200 dark:border-[#262626] hover:border-emerald-500/40"
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider truncate">
                  {t('set_kpi_active')}
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{activeUsersCount}</p>
              </div>
              <div className="w-10 h-10 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Checks className="w-5 h-5" weight="bold" />
              </div>
            </button>
          </div>

          {/* Active KPI Filter Notification Pill */}
          {activeKpiFilter && (
            <div className="flex items-center justify-between p-2.5 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono">
              <span className="text-neutral-600 dark:text-neutral-400">
                {t('set_filter_active_tag')}: <b className="text-neutral-900 dark:text-white uppercase">{activeKpiFilter}</b>
              </span>
              <button
                type="button"
                onClick={() => handleKpiClick(activeKpiFilter)}
                className="text-[10px] text-[#EF2F38] hover:underline uppercase font-bold cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Members Search & Filter Toolbar */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm transition-colors">
            {/* Search Input */}
            <div className="relative flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] px-3 w-full md:max-w-xs shrink-0 min-h-[40px] items-center">
              <input 
                type="text" 
                placeholder={t('stf_search_placeholder')} 
                value={memberSearch} 
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full bg-transparent border-none text-neutral-900 dark:text-white text-xs py-1.5 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-mono pr-6"
              />
              {memberSearch && (
                <button 
                  type="button"
                  onClick={() => setMemberSearch('')}
                  className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Filters & Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto md:justify-end">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <select 
                  value={memberRoleFilter} 
                  onChange={(e) => {
                    setMemberRoleFilter(e.target.value);
                    setActiveKpiFilter(null);
                  }}
                  className="bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs text-neutral-900 dark:text-white px-3 py-2 min-h-[40px] focus:outline-none focus:border-[#EF2F38] w-full sm:w-auto cursor-pointer font-mono font-bold"
                >
                  <option value="All">{t('stf_all_roles')}</option>
                  <option value="StaffGroup">Staff & Coaches Group</option>
                  <option value="Root">{formatRoleLocalized('Root', t)}</option>
                  <option value="Admin">{formatRoleLocalized('Admin', t)}</option>
                  <option value="Head Coach">{formatRoleLocalized('Head Coach', t)}</option>
                  <option value="Coach">{formatRoleLocalized('Coach', t)}</option>
                  <option value="Assistant Coach">{formatRoleLocalized('Assistant Coach', t)}</option>
                  <option value="Student">{formatRoleLocalized('Student', t)}</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <select 
                  value={memberStatusFilter} 
                  onChange={(e) => {
                    setMemberStatusFilter(e.target.value as any);
                    setActiveKpiFilter(null);
                  }}
                  className="bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs text-neutral-900 dark:text-white px-3 py-2 min-h-[40px] focus:outline-none focus:border-[#EF2F38] w-full sm:w-auto cursor-pointer font-mono font-bold"
                >
                  <option value="All">{t('set_status_all')}</option>
                  <option value="Active">{t('set_status_active')}</option>
                  <option value="Locked">{t('set_status_locked')}</option>
                </select>
              </div>

              {/* View Mode Segmented Switcher (Tablet & Desktop) */}
              <div className="hidden md:flex items-center bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setAccountsViewMode('table')}
                  title="Table View"
                  className={cn(
                    "p-2 rounded-[8px] transition-all cursor-pointer",
                    accountsViewMode === 'table' 
                      ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-sm font-bold" 
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <ListDashes className="w-4 h-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => setAccountsViewMode('cards')}
                  title="Cards View"
                  className={cn(
                    "p-2 rounded-[8px] transition-all cursor-pointer",
                    accountsViewMode === 'cards' 
                      ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-sm font-bold" 
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <SquaresFour className="w-4 h-4" weight="bold" />
                </button>
              </div>

              {/* Counter Badge */}
              <div className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] px-3 py-2.5 rounded-[8px] shrink-0">
                {t('stf_total')}: <span className="text-neutral-900 dark:text-white font-bold">{filteredUsers.length}</span>
              </div>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredUsers.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col items-center justify-center">
              <UserCircle className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mb-2" weight="duotone" />
              <p className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">{t('stf_no_match')}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-4">No accounts match the selected role or search term.</p>
              {(memberSearch || memberRoleFilter !== 'All' || memberStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setMemberSearch('');
                    setMemberRoleFilter('All');
                    setMemberStatusFilter('All');
                    setActiveKpiFilter(null);
                  }}
                  className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 1. Native Mobile View (<md screens): Tactile User Cards */}
              <div className="block md:hidden space-y-3">
                {filteredUsers.map(renderUserCard)}
              </div>

              {/* 2. Tablet & Desktop View (>=md screens): Switchable Cards or Table */}
              <div className="hidden md:block">
                {accountsViewMode === 'cards' ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(renderUserCard)}
                  </div>
                ) : (
            /* TABLE VIEW MODE */
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626]">
                      <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest font-mono">{t('usr_account_details')}</th>
                      <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest font-mono">{t('usr_role_snapshot')}</th>
                      <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest font-mono">Linked Entity / Record</th>
                      <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest text-center font-mono">{t('usr_system_access')}</th>
                      <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest text-right font-mono">{t('act_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                    {filteredUsers.map(u => {
                      const isManageable = canManageUser(u);
                      return (
                        <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <SafeImage 
                                src={u.profilePicturePath} 
                                alt={u.displayName} 
                                containerClassName="w-8 h-8 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{u.displayName}</span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono truncate">@{u.username} • {u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-[8px] text-[10px] font-bold uppercase tracking-widest border font-mono whitespace-nowrap", 
                              u.role === 'Root' || u.role === 'Super Root' ? "bg-red-500/15 text-red-700 dark:text-[#EF2F38] border-red-500/40" : 
                              u.role === 'Admin' ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" : 
                              u.role === 'Student' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                              "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-transparent" 
                            )}>
                              {formatRoleLocalized(u.role, t)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              if (u.role === 'Student' || u.studentId) {
                                const student = state.students.find(s => 
                                  s.id === u.studentId || 
                                  s.profileId === u.id
                                );
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[10px] font-bold font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    <span>🎓</span>
                                    <span className="truncate">Student: {student ? `${student.englishName} (${student.id})` : (u.studentId || 'Portal Linked')}</span>
                                  </span>
                                );
                              }
                              if (u.role === 'Root' || u.role === 'Super Root') {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[10px] font-bold font-mono bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                    <span>⚡</span>
                                    <span>System Root / Superadmin</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <span>🥋</span>
                                  <span className="truncate">Staff: {u.englishName || u.displayName}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {u.isActive ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest font-mono">
                                <Checks className="w-3.5 h-3.5" weight="bold"/> {t('usr_active_access')}
                              </span>
                            ) : (
                              <span className="text-red-500 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest font-mono">
                                <XCircle className="w-3.5 h-3.5" weight="bold"/> {t('usr_locked_access')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isManageable ? (
                                <>
                                  {isRoot && (
                                    <button 
                                      type="button"
                                      title="Account Permissions & Overrides" 
                                      onClick={() => setPermissionTargetUser(u)}
                                      className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 rounded-[8px] border border-purple-500/30 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5"/>
                                    </button>
                                  )}
                                  <button 
                                    type="button"
                                    title="Set / Change Password" 
                                    onClick={() => {
                                      setTargetNewPassword('');
                                      setPasswordTargetUser(u);
                                    }}
                                    className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-[#EF2F38] dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  >
                                    <Key className="w-3.5 h-3.5 text-[#EF2F38]"/>
                                  </button>
                                  <button 
                                    type="button"
                                    title={t('act_edit')} 
                                    onClick={() => handleEditUser(u)}
                                    className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  >
                                    <PencilSimple className="w-3.5 h-3.5"/>
                                  </button>
                                  <button 
                                    type="button"
                                    title={t('set_lock_unlock')} 
                                    onClick={() => handleToggleAccount(u)}
                disabled={busyUsers.has(u.id)}
                                    className={cn(
                                      "p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-[8px] border transition-colors cursor-pointer active:scale-95 touch-manipulation", 
                                      u.isActive 
                                        ? "bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-red-500 hover:border-red-500/50" 
                                        : "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20"
                                    )}
                                  >
                                    <Lock className="w-3.5 h-3.5"/>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-neutral-400 font-mono italic">{t('usr_protected')}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>
)}

      {/* ========================================================================= */}
      {/* TAB: ACCESS MATRIX (ROOT ONLY DYNAMIC PERMISSIONS ENGINE)                 */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && isRoot && (
        <RolePermissionsMatrixPanel />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & SESSIONS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <AccountSecurityPanel />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DATA, LEDGER & SYSTEM DIAGNOSTICS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {/* Live Dataset Inventory Card */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm transition-colors space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-[#262626] pb-3">
              <div>
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <Database className="w-4 h-4" /> Loaded application data
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Records loaded in this session. Counts reflect your access and are not a database health check.</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono rounded-[8px] border border-emerald-500/20 w-fit">
                {state.isLoading ? 'Loading' : state.dataLoadErrors?.length ? 'Partial data' : 'Session data'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Students</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.students.length}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Branches</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.branches.length}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Classes</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.classSessions.length}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Attendance</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.attendanceRecords.length}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Payments</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.payments.length}</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Users</p>
                <p className="text-lg font-black text-neutral-900 dark:text-white mt-1">{state.users.length}</p>
              </div>
            </div>
          </div>

          {/* Backup & Local Storage Footprint */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1-Click JSON Backup */}
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <DownloadSimple className="w-4 h-4 text-emerald-500" weight="bold" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white font-mono">
                    Application Data Export
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Download all application tables from the server. Configure database, Auth, and Storage backups separately for disaster recovery.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={!isRoot || isExporting}
                className="w-full px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-[8px] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
              >
                <DownloadSimple className="w-4 h-4" weight="bold" /> 
                <span>{isExporting ? 'Exporting…' : 'Export application data'}</span>
              </button>
            </div>

            {/* Storage Footprint & Cache Vacuum */}
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrives className="w-4 h-4 text-[#EF2F38]" weight="bold" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white font-mono">
                      {t('set_storage_usage')}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-[#1A1A1A] px-2.5 py-1 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                    {cacheSizeKB} KB
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {t('set_cache_diag_desc')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setShowPwaDiagnostics(true)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] border border-neutral-200 dark:border-[#2D2D2D] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  <Pulse className="w-4 h-4 text-[#EF2F38]" weight="bold" />
                  <span>PWA Diagnostics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirm(true)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] bg-red-500/10 hover:bg-[#EF2F38] border border-red-500/30 hover:border-transparent text-red-600 dark:text-red-400 hover:text-white rounded-[8px] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  <ArrowsClockwise className="w-4 h-4" weight="bold" />
                  <span>{t('set_btn_purge_resync')}</span>
                </button>
              </div>
            </div>

            {/* PWA Diagnostics Modal */}
            <PwaDiagnosticsModal isOpen={showPwaDiagnostics} onClose={() => setShowPwaDiagnostics(false)} />
          </div>

          {/* Ecosystem & Version Info */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 shadow-sm space-y-4">
            <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-3 font-mono flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> {t('set_quick_links')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a 
                href="/lms" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex flex-col p-4 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] hover:border-[#EF2F38] transition-colors group"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-transparent flex items-center justify-center text-neutral-900 dark:text-white">
                    <UserCircle className="w-4 h-4 text-[#EF2F38]"/>
                  </div>
                  <ArrowSquareOut className="w-4 h-4 text-neutral-400 dark:text-neutral-400 group-hover:text-[#EF2F38] transition-colors"/>
                </div>
                <h4 className="font-bold text-xs text-neutral-900 dark:text-white uppercase tracking-wider mb-1">{t('set_student_portal')}</h4>
                <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">{t('set_student_portal_desc')}</p>
              </a>

              <a 
                href="https://infinitytkd.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex flex-col p-4 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] hover:border-[#EF2F38] transition-colors group"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-transparent flex items-center justify-center text-neutral-900 dark:text-white">
                    <Globe className="w-4 h-4 text-[#EF2F38]"/>
                  </div>
                  <ArrowSquareOut className="w-4 h-4 text-neutral-400 dark:text-neutral-400 group-hover:text-[#EF2F38] transition-colors"/>
                </div>
                <h4 className="font-bold text-xs text-neutral-900 dark:text-white uppercase tracking-wider mb-1">{t('set_official_web')}</h4>
                <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">{t('set_official_web_desc')}</p>
              </a>

              <div className="flex flex-col p-4 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <div className="flex justify-between items-center mb-2">
                  <div className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-transparent flex items-center justify-center text-neutral-900 dark:text-white">
                    <Sparkle className="w-4 h-4 text-emerald-500"/>
                  </div>
                  <span className="text-[9px] font-mono uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-[8px]">Active PWA</span>
                </div>
                <h4 className="font-bold text-xs text-neutral-900 dark:text-white uppercase tracking-wider mb-1">Architecture</h4>
                <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">Next.js 15 · React 19 · Serwist PWA · Tailwind 4</p>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-500 text-xs font-mono">
              <span className="text-[11px]">Infinity Taekwondo v2.4.0 Production Build</span>
              <div className="flex items-center gap-2">
                <span>{t('set_developed_by')} Keo Moni</span>
                <a href="https://github.com/monikeo" target="_blank" rel="noopener noreferrer" className="p-1 hover:text-[#EF2F38] transition-colors" title="GitHub">
                  <GithubLogo className="w-4 h-4"/>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS (STRICTLY 8PX BORDER RADIUS UNIFIED)                   */}
      {/* ========================================================================= */}

      {/* 1. Add / Edit Account Modal */}
      </div>
      </PageTransition>
      </div>
      <AnimatePresence>
        {showUserModal && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
              <motion.div 
                {...dialogMotion}
                ref={modalRef} role="dialog" aria-modal="true" aria-label="Account editor"
                className="w-full max-w-lg max-h-[92dvh] my-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col text-neutral-900 dark:text-white overflow-hidden"
              >
                 <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-[8px] bg-red-500/10 text-[#EF2F38] flex items-center justify-center">
                        <UserPlus className="w-4 h-4" weight="bold" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white font-sans">
                          {showUserModal === 'new' ? t('usr_provision_account') : t('usr_edit_account')}
                        </h3>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">Infinity TKD RBAC Authentication</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      disabled={isSavingUser}
                      onClick={() => setShowUserModal(null)} 
                      aria-label="Close user modal"
                      className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <X className="w-5 h-5"/>
                    </button>
                 </div>

                 <fieldset disabled={isSavingUser} className="p-4 sm:p-6 space-y-4 max-h-[calc(92dvh-135px)] overflow-y-auto overscroll-contain flex-1">
                    {/* Display Name & Khmer Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('usr_display_name')} <span className="text-red-500">*</span>
                        </label>
                        <input 
                          aria-label="Display name"
                          type="text" 
                          value={userForm.displayName} 
                          onChange={(e) => setUserForm({...userForm, displayName: e.target.value})}
                          placeholder="e.g. Master John Doe"
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('set_khmer_name')}
                        </label>
                        <input 
                          aria-label="Khmer name"
                          type="text" 
                          value={userForm.khmerName} 
                          onChange={(e) => setUserForm({...userForm, khmerName: e.target.value})}
                          placeholder="ឈ្មោះជាភាសាខ្មែរ"
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium"
                        />
                      </div>
                    </div>

                    {/* Profile Picture URL + Preview */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                        {t('panel_profile_pic_link')}
                      </label>
                      <div className="flex gap-3 items-center">
                        <input 
                          aria-label="Profile image URL"
                          type="text" 
                          value={userForm.profilePicturePath} 
                          onChange={(e) => setUserForm({...userForm, profilePicturePath: e.target.value})}
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] flex-1 font-medium"
                          placeholder={t('panel_profile_pic_placeholder')}
                        />
                        {userForm.profilePicturePath && (
                          <div className="shrink-0">
                            <SafeImage 
                              src={userForm.profilePicturePath} 
                              alt="Preview" 
                              containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] overflow-hidden flex items-center justify-center shadow-md"
                              fallback={<span className="text-[8px] text-red-500 uppercase font-black bg-red-500/10 px-1 py-0.5 rounded-[8px]">{t('set_err_private')}</span>}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Username, Email, Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('usr_username')} <span className="text-red-500">*</span>
                        </label>
                        <input 
                          aria-label="Username"
                          type="text" 
                          value={userForm.username} 
                          onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                          disabled={showUserModal !== 'new'}
                          placeholder="e.g. coach_sok"
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white disabled:opacity-50 focus:outline-none focus:border-[#EF2F38] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('stu_email')}
                        </label>
                        <input 
                          aria-label="Account email"
                          type="email" 
                          value={userForm.email} 
                          onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                          placeholder="staff@infinitytkd.com"
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('set_phone')}
                        </label>
                        <input 
                          aria-label="Account phone"
                          type="tel" 
                          value={userForm.phone} 
                          onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                          placeholder="012 345 678"
                          className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                        />
                      </div>
                    </div>

                    {/* Role Selector */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                        {t('usr_role')}
                      </label>
                      <select 
                        aria-label="Account role"
                          value={userForm.role}
                        onChange={(e) => {
                          const newRole = e.target.value as Role;
                          setUserForm(prev => ({
                            ...prev,
                            role: newRole,
                            password: prev.password || generatePassword()
                          }));
                        }}
                        className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer font-mono font-bold"
                      >
                        {manageableRoles.map(r => <option key={r} value={r}>{formatRoleLocalized(r, t)}</option>)}
                      </select>
                    </div>

                    {/* Student Record Linker (if Student role) */}
                    {userForm.role === 'Student' && (
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-[8px] space-y-2">
                        <label className="block text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 font-mono flex items-center gap-1.5">
                          <span>🎓</span> Link To Student Record
                        </label>
                        <select
                          aria-label="Linked student"
                          value={userForm.studentId}
                          onChange={(e) => {
                            const sid = e.target.value;
                            const matched = state.students.find(s => s.id === sid);
                            setUserForm(prev => ({
                              ...prev,
                              studentId: sid,
                              displayName: matched ? matched.englishName : prev.displayName,
                              username: matched ? matched.id.toLowerCase().replace(/-/g, '_') : prev.username,
                              email: (matched && matched.email) ? matched.email : (matched ? `${matched.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@portal.infinitytkd.com` : prev.email),
                              phone: (matched && matched.phone) ? matched.phone : prev.phone,
                              khmerName: matched ? matched.khmerName : prev.khmerName,
                              password: prev.password || generatePassword()
                            }));
                          }}
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer font-mono"
                        >
                          <option value="">-- Select Student to Link (Optional) --</option>
                          {state.students.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.englishName} ({s.id}) {s.currentBelt ? `• ${s.currentBelt}` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-blue-600/80 dark:text-blue-400/70 font-mono">
                          Linking connects this auth account to the student profile. Student accounts can only access the Student Portal.
                        </p>
                      </div>
                    )}

                    {/* Initial Password (only on creation) */}
                    {showUserModal === 'new' && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 font-mono">
                            Initial Password <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setUserForm(prev => ({ 
                              ...prev, 
                              password: generatePassword()
                            }))}
                            className="text-[10px] text-[#EF2F38] hover:underline font-mono cursor-pointer"
                          >
                            Generate Password
                          </button>
                        </div>
                        <div className="relative">
                          <input 
                            type={showModalPasswordText ? "text" : "password"} 
                            value={userForm.password} 
                            onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                            placeholder="At least 12 characters"
                            className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showModalPasswordText ? "Hide initial password" : "Show initial password"}
                            onClick={() => setShowModalPasswordText(!showModalPasswordText)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1 cursor-pointer"
                          >
                            {showModalPasswordText ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Account Status Toggle */}
                    <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                      <div>
                        <span className="text-xs font-bold text-neutral-900 dark:text-white block">System Access Active</span>
                        <span className="text-[10px] text-neutral-500 font-mono">Allow user to sign in to system</span>
                      </div>
                      <input 
                        type="checkbox" 
                        aria-label="System access active"
                        checked={userForm.isActive} 
                        onChange={(e) => setUserForm({...userForm, isActive: e.target.checked})}
                        className="w-4 h-4 text-[#EF2F38] rounded-[4px] cursor-pointer accent-[#EF2F38]"
                      />
                    </div>
                 </fieldset>

                 {/* Modal Footer */}
                 <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2.5 bg-neutral-50 dark:bg-[#0A0A0A]">
                    <button 
                      type="button"
                      onClick={() => setShowUserModal(null)} 
                      className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-800 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#262626] cursor-pointer transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      {t('act_cancel')}
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveUser}
                      disabled={isSavingUser}
                      className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-[#EF2F38] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-[#D0252D] cursor-pointer shadow-sm shadow-[#EF2F38]/20 transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      {isSavingUser ? 'Saving…' : t('usr_save_account')}
                    </button>
                 </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {/* 2. Password Reset Modal for Target User */}
        {passwordTargetUser && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
              <motion.div ref={modalRef} role="dialog" aria-modal="true" aria-label="Reset account password"
                {...dialogMotion}
                className="w-full max-w-md max-h-[92dvh] my-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col text-neutral-900 dark:text-white overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[8px] bg-red-500/10 flex items-center justify-center text-[#EF2F38]">
                      <Key className="w-4 h-4" weight="bold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Set Account Password</h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">@{passwordTargetUser.username} • {passwordTargetUser.displayName}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    disabled={isResettingPassword}
                    onClick={() => { setPasswordTargetUser(null); setTargetNewPassword(''); }}
                    aria-label="Close password modal"
                    className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] cursor-pointer active:scale-95 touch-manipulation transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4 max-h-[calc(92dvh-135px)] overflow-y-auto overscroll-contain flex-1">
                  <div className="bg-neutral-50 dark:bg-[#1A1A1A] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Directly update the login password for this account. The user will be able to log in with this new password immediately.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        type={showTargetPasswordText ? "text" : "password"} 
                        value={targetNewPassword}
                        onChange={e => {
                          setTargetNewPassword(e.target.value);
                          setCopiedPassword(false);
                        }}
                        placeholder="At least 12 characters"
                        className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] transition-colors pr-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowTargetPasswordText(!showTargetPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors p-1 cursor-pointer"
                      >
                        {showTargetPasswordText ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const generated = `Tkd${passwordTargetUser.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}!2026`;
                        setTargetNewPassword(generated);
                        setCopiedPassword(false);
                      }}
                      className="text-xs text-[#EF2F38] hover:underline font-mono cursor-pointer flex items-center gap-1 font-bold min-h-[38px] active:scale-95 touch-manipulation"
                    >
                      <Sparkle className="w-3.5 h-3.5" />
                      <span>{t('set_suggest_password')}</span>
                    </button>

                    {targetNewPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(targetNewPassword);
                            setCopiedPassword(true);
                            setTimeout(() => setCopiedPassword(false), 2000);
                          }
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-mono cursor-pointer flex items-center gap-1 font-bold min-h-[38px] active:scale-95 touch-manipulation"
                      >
                        {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPassword ? t('set_copied') : t('set_copy_password')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 dark:bg-[#0A0A0A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setPasswordTargetUser(null)}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-800 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#262626] cursor-pointer transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                  <button 
                    type="button"
                    onClick={handleResetTargetPassword}
                    disabled={isResettingPassword || !targetNewPassword || targetNewPassword.length < 12}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-[#EF2F38] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-[#D0252D] disabled:opacity-50 cursor-pointer shadow-sm shadow-[#EF2F38]/20 flex items-center justify-center gap-2 transition-colors active:scale-95 touch-manipulation"
                  >
                    {isResettingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {/* 3. Cache Purge Confirmation Dialog */}
        {showPurgeConfirm && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
              <motion.div ref={modalRef} role="dialog" aria-modal="true" aria-label="Clear local cache"
                {...dialogMotion}
                className="w-full max-w-md my-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-5 text-neutral-900 dark:text-white space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[8px] bg-red-500/10 text-[#EF2F38] flex items-center justify-center shrink-0">
                    <Warning className="w-5 h-5" weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider font-sans">{t('set_purge_confirm_title')}</h3>
                    <p className="text-[10px] text-neutral-500 font-mono">Local Storage Cleanup</p>
                  </div>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
                  {t('set_purge_confirm_desc')}
                </p>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                  <button
                    type="button"
                    onClick={() => setShowPurgeConfirm(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-800 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#262626] cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePurge}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] cursor-pointer shadow-sm shadow-[#EF2F38]/20 active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('set_btn_purge_resync')}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {/* 4. Bulk Staff Importer */}
        {isBulkImporting && (
          <BulkImportStaffModal onClose={() => setIsBulkImporting(false)} />
        )}

        {/* 5. User-Specific Permissions Modal (Root Only) */}
        {permissionTargetUser && (
          <UserPermissionsModal
            user={permissionTargetUser}
            onClose={() => setPermissionTargetUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
