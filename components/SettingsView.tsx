'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, User, Role, AcademyProfile, DEFAULT_ACADEMY_PROFILE } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCircle, 
  Lock, 
  X, 
  Globe, 
  Moon, 
  Sun, 
  GithubLogo, 
  Link as LinkIcon, 
  ArrowSquareOut, 
  Checks, 
  XCircle, 
  UserPlus, 
  PencilSimple, 
  Key, 
  Eye, 
  EyeClosed,
  SquaresFour, 
  ListDashes, 
  UsersThree, 
  GraduationCap,
  ShieldCheck,
  Sliders,
  Info,
  Warning,
  DownloadSimple,
  ArrowsClockwise,
  Check,
  Copy,
  Building,
  Phone,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Database,
  CalendarBlank,
  Timer,
  CurrencyDollar,
  EnvelopeSimple,
  HardDrives,
  MapPin,
  FacebookLogo,
  TelegramLogo,
  InstagramLogo,
  FloppyDisk,
  ArrowCounterClockwise,
  Percent,
  Tag,
  ShareNetwork,
  LockKey,
  Pulse
} from '@phosphor-icons/react';
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
  const { state, setTheme, setLanguage, addUser, updateUser, showNotification, updateAcademyProfile } = useAppStore();
  const t = useT();

  // Active Tab: Preferences, Profile, Accounts, Permissions (Root), Security, Data
  const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'members' | 'permissions' | 'security' | 'data'>('general');
  const role = state.currentUser?.role;
  const isRoot = role === 'Root' || role === 'Super Root';
  const isAdmin = role === 'Admin' || isRoot;

  // Sound Feedback State
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [isPlayingTestChime, setIsPlayingTestChime] = useState(false);

  // Academy Profile State (Realtime Supabase + Local Cache)
  const [profileForm, setProfileForm] = useState<AcademyProfile>(state.academyProfile || DEFAULT_ACADEMY_PROFILE);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [profileSection, setProfileSection] = useState<'all' | 'brand' | 'contact' | 'financial' | 'curriculum' | 'portal'>('all');

  // Check if form has unsaved modifications
  const isProfileDirty = useMemo(() => {
    return JSON.stringify(profileForm) !== JSON.stringify(state.academyProfile || DEFAULT_ACADEMY_PROFILE);
  }, [profileForm, state.academyProfile]);

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

  // Filters & Search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('All');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'All' | 'Active' | 'Locked'>('All');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'staff' | 'students' | 'active' | null>(null);

  // Synchronize profile form when store hydrates or realtime updates arrive
  useEffect(() => {
    if (state.academyProfile) {
      setProfileForm(state.academyProfile);
    }
  }, [state.academyProfile]);

  // Load Preferences & Cache Size on Mount
  useEffect(() => {
    setSoundActive(isAudioEnabled());

    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('infinity_')) {
          const val = localStorage.getItem(key) || '';
          totalBytes += key.length + val.length;
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

  const handleSaveAcademyConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await updateAcademyProfile(profileForm);
      if (res.success) {
        playChime('bell');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetProfile = () => {
    setProfileForm(state.academyProfile || DEFAULT_ACADEMY_PROFILE);
    showNotification('Academy profile changes discarded.', 'info');
  };

  const activeBranch = useMemo(() => {
    if (profileForm.defaultBranchId && profileForm.defaultBranchId !== 'all') {
      return state.branches.find(b => b.id === profileForm.defaultBranchId) || state.branches[0];
    }
    return state.branches[0];
  }, [state.branches, profileForm.defaultBranchId]);

  const handleResetTargetPassword = async () => {
    if (!passwordTargetUser || !targetNewPassword || targetNewPassword.length < 6) {
      showNotification('Password must be at least 6 characters long.', 'warning');
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
    if (!userForm.username.trim()) {
      showNotification('Username is required.', 'warning');
      return;
    }
    if (!userForm.displayName.trim()) {
      showNotification('Display name is required.', 'warning');
      return;
    }
    if (showUserModal === 'new') {
      if (!userForm.password || userForm.password.length < 6) {
        showNotification('Initial password must be at least 6 characters long.', 'warning');
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
      await updateUser(showUserModal, userForm);
      showNotification("Account details updated successfully.", 'success');
      playChime('success');
    }
    setShowUserModal(null);
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

  const renderUserCard = (u: User) => {
    const isManageable = canManageUser(u);
    const student = (u.role === 'Student' || u.studentId) ? state.students.find(s => 
      s.id === u.studentId || 
      s.profileId === u.id || 
      (s.email && s.email.toLowerCase() === u.email?.toLowerCase())
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
                onClick={() => {
                  updateUser(u.id, { isActive: !u.isActive });
                  showNotification(`Account @${u.username} access toggled.`, 'info');
                }}
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

  const handleExportBackup = () => {
    try {
      const backupData = {
        exportTimestamp: new Date().toISOString(),
        version: '2.4.0',
        environment: 'Infinity TKD Production',
        counts: {
          students: state.students.length,
          branches: state.branches.length,
          classSessions: state.classSessions.length,
          attendanceRecords: state.attendanceRecords.length,
          payments: state.payments.length,
          users: state.users.length,
          workoutTemplates: state.workoutTemplates.length,
          beltTechniques: state.beltTechniques.length
        },
        academyProfile: profileForm,
        students: state.students,
        branches: state.branches,
        classSessions: state.classSessions,
        attendanceRecords: state.attendanceRecords,
        payments: state.payments,
        users: state.users,
        workoutTemplates: state.workoutTemplates,
        beltTechniques: state.beltTechniques
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infinity_tkd_complete_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification(t('set_backup_success'), 'success');
      playChime('bell');
    } catch {
      showNotification(t('set_backup_failed'), 'error');
    }
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
    <div className="w-full max-w-6xl mx-auto space-y-6 px-3 sm:px-6 py-4 transition-all">
      {/* 1. Refined Executive Header */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 shadow-sm transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] shrink-0">
            <Sliders className="w-5 h-5" weight="bold" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[6px] border border-red-500/20">
                INFINITY TKD · GOVERNANCE & SETTINGS
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-[6px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE · SUPABASE REALTIME
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
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex-1 sm:flex-none">
            <Building className="w-3.5 h-3.5 text-[#EF2F38] shrink-0" weight="bold" />
            <span className="text-neutral-500 dark:text-neutral-400">{t('set_active_branch')}:</span>
            <span className="font-bold text-neutral-900 dark:text-white truncate">{activeBranch?.name || 'All Locations'}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-mono flex-1 sm:flex-none">
            <UserCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" weight="bold" />
            <span className="text-neutral-500 dark:text-neutral-400">User:</span>
            <span className="font-bold text-neutral-900 dark:text-white truncate">@{state.currentUser?.username || 'admin'}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive 5-Tab Segmented Navigation */}
      <div className="flex gap-1.5 border-b border-neutral-200 dark:border-[#262626] -mx-3 px-3 sm:mx-0 sm:px-1 overflow-x-auto no-scrollbar touch-pan-x">
        {/* Tab 1: Preferences */}
        <button 
          onClick={() => setActiveTab('general')}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center gap-2 px-3.5 cursor-pointer active:scale-95 touch-manipulation",
            activeTab === 'general' 
              ? "border-[#EF2F38] text-[#EF2F38] dark:text-white font-black" 
              : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <Sliders className="w-4 h-4" weight={activeTab === 'general' ? 'bold' : 'regular'} />
          <span>{t('set_tab_general')}</span>
        </button>

        {/* Tab 2: Academy Profile */}
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center gap-2 px-3.5 cursor-pointer active:scale-95 touch-manipulation",
            activeTab === 'profile' 
              ? "border-[#EF2F38] text-[#EF2F38] dark:text-white font-black" 
              : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <Building className="w-4 h-4 text-[#EF2F38]" weight={activeTab === 'profile' ? 'bold' : 'regular'} />
          <span>{t('set_tab_profile')}</span>
        </button>

        {/* Tab 3: Accounts & RBAC (Admin/Root) */}
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('members')}
            className={cn(
              "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center gap-2 px-3.5 cursor-pointer active:scale-95 touch-manipulation",
              activeTab === 'members' 
                ? "border-[#EF2F38] text-[#EF2F38] dark:text-white font-black" 
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <UsersThree className="w-4 h-4" weight={activeTab === 'members' ? 'bold' : 'regular'} />
            <span>{t('set_tab_accounts')}</span>
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded-[8px] text-[10px] font-mono font-bold",
              activeTab === 'members' 
                ? "bg-[#EF2F38] text-white" 
                : "bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300"
            )}>
              {totalUsersCount}
            </span>
          </button>
        )}

        {/* Tab: Access Matrix (Root Only) */}
        {isRoot && (
          <button 
            onClick={() => setActiveTab('permissions')}
            className={cn(
              "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center gap-2 px-3.5 cursor-pointer active:scale-95 touch-manipulation",
              activeTab === 'permissions' 
                ? "border-purple-500 text-purple-600 dark:text-purple-400 font-black" 
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <LockKey className="w-4 h-4 text-purple-500" weight={activeTab === 'permissions' ? 'bold' : 'regular'} />
            <span>Access Matrix</span>
            <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              ROOT
            </span>
          </button>
        )}

        {/* Tab 4: Security & Sessions */}
        <button 
          onClick={() => setActiveTab('security')}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 min-h-[44px] px-3.5 cursor-pointer active:scale-95 touch-manipulation",
            activeTab === 'security' 
              ? "border-[#EF2F38] text-[#EF2F38] dark:text-white font-black" 
              : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" weight={activeTab === 'security' ? 'bold' : 'regular'} />
          <span>{t('set_tab_security')}</span>
        </button>

        {/* Tab 5: Data & System */}
        <button 
          onClick={() => setActiveTab('data')}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center gap-2 px-3.5 cursor-pointer active:scale-95 touch-manipulation",
            activeTab === 'data' 
              ? "border-[#EF2F38] text-[#EF2F38] dark:text-white font-black" 
              : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <Database className="w-4 h-4 text-blue-500" weight={activeTab === 'data' ? 'bold' : 'regular'} />
          <span>{t('set_tab_data')}</span>
        </button>
      </div>

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
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* 1. Hero Executive Branding Preview Banner */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-neutral-200 dark:border-[#262626] pb-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-[8px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {profileForm.logoUrl ? (
                    <SafeImage 
                      src={profileForm.logoUrl} 
                      alt={profileForm.academyName} 
                      width={64} 
                      height={64} 
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Building className="w-8 h-8 text-[#EF2F38]" weight="duotone" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[8px] border border-red-500/20">
                      OFFICIAL PROFILE
                    </span>
                    {isProfileDirty ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[8px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                        UNSAVED EDITS PENDING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-[8px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        SUPABASE CLOUD SYNCED
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-neutral-900 dark:text-white font-sans mt-1">
                    {profileForm.academyName || 'Infinity Taekwondo Academy'}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-sans">
                    {profileForm.tagline || profileForm.legalName || 'Discipline, Honor, Excellence'}
                  </p>
                </div>
              </div>

              {/* Quick KPI Status Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                <div className="px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <p className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Currency</p>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                    {profileForm.currency} ({profileForm.currencySymbol})
                  </p>
                </div>
                <div className="px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <p className="text-[9px] font-mono uppercase text-neutral-400 font-bold">HQ Branch</p>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white font-mono truncate max-w-[100px]">
                    {activeBranch?.name || 'All'}
                  </p>
                </div>
                <div className="px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <p className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Exam Pass</p>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                    {profileForm.examPassingScore}% Score
                  </p>
                </div>
                <div className="px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <p className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Portal Access</p>
                  <p className={cn(
                    "text-xs font-bold font-mono",
                    profileForm.allowStudentPortalLogin ? "text-emerald-500" : "text-neutral-400"
                  )}>
                    {profileForm.allowStudentPortalLogin ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Section Filter Pills */}
            <div className="flex items-center gap-1.5 pt-4 overflow-x-auto no-scrollbar touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
              {[
                { id: 'all', label: 'All Settings', icon: Sliders },
                { id: 'brand', label: 'Brand & Identity', icon: Tag },
                { id: 'contact', label: 'Contact & HQ', icon: MapPin },
                { id: 'financial', label: 'Financial Rules', icon: CurrencyDollar },
                { id: 'curriculum', label: 'Curriculum & Grading', icon: GraduationCap },
                { id: 'portal', label: 'Portal & Social', icon: ShareNetwork },
              ].map(sec => {
                const IconComponent = sec.icon;
                const isActive = profileSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setProfileSection(sec.id as any)}
                    className={cn(
                      "px-3.5 py-2 min-h-[40px] rounded-[8px] text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 touch-manipulation",
                      isActive
                        ? "bg-[#EF2F38] text-white shadow-sm shadow-[#EF2F38]/20"
                        : "bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#262626]"
                    )}
                  >
                    <IconComponent className="w-3.5 h-3.5" weight={isActive ? "bold" : "regular"} />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Brand & Identity */}
          {(profileSection === 'all' || profileSection === 'brand') && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Brand & Corporate Identity
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Public Facing & Legal</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Academy Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Academy Name <span className="text-[#EF2F38]">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.academyName}
                    onChange={(e) => setProfileForm({ ...profileForm, academyName: e.target.value })}
                    className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs sm:text-sm text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-[#EF2F38]"
                    placeholder="Infinity Taekwondo Academy"
                    required
                  />
                </div>

                {/* Legal Entity Name */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Legal Registered Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.legalName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                    className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs sm:text-sm text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-[#EF2F38]"
                    placeholder="e.g. Infinity Martial Arts Co., Ltd."
                  />
                </div>

                {/* Tagline / Motto */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Motto / Tagline
                  </label>
                  <input
                    type="text"
                    value={profileForm.tagline || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, tagline: e.target.value })}
                    className="w-full min-h-[42px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2 text-xs sm:text-sm text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-[#EF2F38]"
                    placeholder="Discipline, Honor, Excellence · Martial Arts & Character Building"
                  />
                </div>

                {/* Tax ID */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Tax / VAT Identification No.
                  </label>
                  <input
                    type="text"
                    value={profileForm.taxId || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, taxId: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                    placeholder="e.g. K008-902348123"
                  />
                </div>

                {/* Logo URL */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Logo Asset Path / URL
                  </label>
                  <input
                    type="text"
                    value={profileForm.logoUrl || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                    placeholder="/logo.svg or https://..."
                  />
                </div>

                {/* Public Website URL */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Official Website URL
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                    <input
                      type="url"
                      value={profileForm.websiteUrl || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-9 pr-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                      placeholder="https://infinitytkd.com"
                    />
                  </div>
                </div>

                {/* LMS Student Portal URL */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Student LMS Portal URL
                  </label>
                  <div className="relative flex items-center">
                    <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                    <input
                      type="url"
                      value={profileForm.portalUrl || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, portalUrl: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-9 pr-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                      placeholder="https://infinitytkd.com/lms"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Contact & Headquarters Location */}
          {(profileSection === 'all' || profileSection === 'contact') && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Contact & Dojo Headquarters
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Primary Communication Hub</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Contact Phone */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Official Contact Phone
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                    <input
                      type="tel"
                      value={profileForm.contactPhone || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, contactPhone: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-9 pr-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                      placeholder="+855 12 888 999"
                    />
                  </div>
                </div>

                {/* Support Email */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Official Inquiries Email
                  </label>
                  <div className="relative flex items-center">
                    <EnvelopeSimple className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                    <input
                      type="email"
                      value={profileForm.supportEmail || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, supportEmail: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-9 pr-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                      placeholder="contact@infinitytkd.com"
                    />
                  </div>
                </div>

                {/* Default Branch */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Headquarters / Default Branch
                  </label>
                  <select
                    value={profileForm.defaultBranchId || 'all'}
                    onChange={(e) => setProfileForm({ 
                      ...profileForm, 
                      defaultBranchId: e.target.value === 'all' ? 'all' : Number(e.target.value) 
                    })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="all">All Locations (Headquarters)</option>
                    {state.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Physical Address */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono">
                    Primary Physical Dojo Address
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={profileForm.primaryAddress || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, primaryAddress: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] pl-9 pr-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-[#EF2F38]"
                      placeholder="Street 2004, Sangkat Teuk Thla, Khan Sen Sok, Phnom Penh, Cambodia"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Financial & Operational Rules */}
          {(profileSection === 'all' || profileSection === 'financial') && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <CurrencyDollar className="w-4 h-4" /> Financial Policies & Billing Rules
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Tuition & Invoicing Defaults</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Operating Currency */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <CurrencyDollar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Operating Currency</span>
                  </label>
                  <select
                    value={profileForm.currency}
                    onChange={(e) => {
                      const newCurr = e.target.value as 'USD' | 'KHR';
                      setProfileForm({ 
                        ...profileForm, 
                        currency: newCurr,
                        currencySymbol: newCurr === 'USD' ? '$' : '៛'
                      });
                    }}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="KHR">KHR (៛) - Khmer Riel</option>
                  </select>
                </div>

                {/* 2. Currency Symbol */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-500" />
                    <span>Display Symbol</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.currencySymbol}
                    onChange={(e) => setProfileForm({ ...profileForm, currencySymbol: e.target.value })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38]"
                    placeholder="$ or ៛"
                    maxLength={5}
                  />
                </div>

                {/* 3. Tuition Grace Period */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-amber-500" />
                    <span>Grace Period (Days)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={profileForm.tuitionGracePeriodDays}
                    onChange={(e) => setProfileForm({ ...profileForm, tuitionGracePeriodDays: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>

                {/* 4. Tax Rate % */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-[#EF2F38]" />
                    <span>Default Tax Rate (%)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={profileForm.taxRatePercentage}
                    onChange={(e) => setProfileForm({ ...profileForm, taxRatePercentage: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Academic Curriculum & Belt Standards */}
          {(profileSection === 'all' || profileSection === 'curriculum') && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> Academic Curriculum & Belt Standards
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Pedagogy & Evaluation Rules</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Date Format */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <CalendarBlank className="w-3.5 h-3.5 text-blue-500" />
                    <span>Date Display Format</span>
                  </label>
                  <select
                    value={profileForm.dateFormat}
                    onChange={(e) => setProfileForm({ ...profileForm, dateFormat: e.target.value as any })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Standard)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                  </select>
                </div>

                {/* 2. Class Duration */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-amber-500" />
                    <span>Class Duration</span>
                  </label>
                  <select
                    value={profileForm.defaultClassDurationMins}
                    onChange={(e) => setProfileForm({ ...profileForm, defaultClassDurationMins: Number(e.target.value) })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value={45}>45 Minutes (Junior Tigers)</option>
                    <option value={60}>60 Minutes (Standard)</option>
                    <option value={90}>90 Minutes (Competition Prep)</option>
                    <option value={120}>120 Minutes (Dan Testing)</option>
                  </select>
                </div>

                {/* 3. Passing Score Threshold */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#EF2F38]" />
                    <span>Exam Passing Score</span>
                  </label>
                  <select
                    value={profileForm.examPassingScore}
                    onChange={(e) => setProfileForm({ ...profileForm, examPassingScore: Number(e.target.value) })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value={65}>65% Minimum Score</option>
                    <option value={70}>70% Score Required (Standard)</option>
                    <option value={75}>75% Score Required (Strict)</option>
                    <option value={80}>80% Score Required (Master Level)</option>
                  </select>
                </div>

                {/* 4. Minimum Attendance Requirement */}
                <div className="p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 font-mono flex items-center gap-1">
                    <Checks className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Min Attendance for Exam</span>
                  </label>
                  <select
                    value={profileForm.minAttendanceExamPct}
                    onChange={(e) => setProfileForm({ ...profileForm, minAttendanceExamPct: Number(e.target.value) })}
                    className="w-full min-h-[42px] bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value={60}>60% Attendance Required</option>
                    <option value={70}>70% Attendance Required</option>
                    <option value={80}>80% Attendance Required (Standard)</option>
                    <option value={85}>85% Attendance Required (High)</option>
                    <option value={90}>90% Attendance Required (Strict)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Portal Access & Social Ecosystem */}
          {(profileSection === 'all' || profileSection === 'portal') && (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <h3 className="text-xs text-[#EF2F38] uppercase font-bold tracking-widest font-mono flex items-center gap-2">
                  <ShareNetwork className="w-4 h-4" /> Portal Toggles & Social Ecosystem
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">System Flags & Channels</span>
              </div>

              {/* System Flags (Toggles) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allow Student Portal Login */}
                <div className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                      Student LMS Portal Access
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Allow enrolled students to log into their student profile and E-learning portal
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, allowStudentPortalLogin: !profileForm.allowStudentPortalLogin })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      profileForm.allowStudentPortalLogin ? "bg-[#EF2F38]" : "bg-neutral-300 dark:bg-[#262626]"
                    )}
                  >
                    <span 
                      className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm",
                        profileForm.allowStudentPortalLogin ? "left-6" : "left-0.5"
                      )} 
                    />
                  </button>
                </div>

                {/* Enable Audio Chimes */}
                <div className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                      Audio Chimes & Sound FX
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Play acoustic notifications on attendance scans, belt upgrades, and checkouts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, enableAudioChimes: !profileForm.enableAudioChimes })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      profileForm.enableAudioChimes ? "bg-emerald-500" : "bg-neutral-300 dark:bg-[#262626]"
                    )}
                  >
                    <span 
                      className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm",
                        profileForm.enableAudioChimes ? "left-6" : "left-0.5"
                      )} 
                    />
                  </button>
                </div>
              </div>

              {/* Social Channels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Facebook */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono flex items-center gap-1.5">
                    <FacebookLogo className="w-4 h-4 text-blue-600" weight="fill" />
                    <span>Facebook Page</span>
                  </label>
                  <input
                    type="url"
                    value={profileForm.facebookUrl || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, facebookUrl: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                    placeholder="https://facebook.com/..."
                  />
                </div>

                {/* Telegram */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono flex items-center gap-1.5">
                    <TelegramLogo className="w-4 h-4 text-sky-500" weight="fill" />
                    <span>Telegram Channel</span>
                  </label>
                  <input
                    type="url"
                    value={profileForm.telegramChannel || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, telegramChannel: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                    placeholder="https://t.me/..."
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1 font-mono flex items-center gap-1.5">
                    <InstagramLogo className="w-4 h-4 text-pink-500" weight="fill" />
                    <span>Instagram Profile</span>
                  </label>
                  <input
                    type="url"
                    value={profileForm.instagramUrl || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, instagramUrl: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-[#EF2F38]"
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sticky Bottom Control & Action Bar */}
          <div className="bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 sticky bottom-4 z-20 transition-colors pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              {isProfileDirty ? (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400">
                  <Warning className="w-4 h-4 shrink-0" weight="bold" />
                  <span>Unsaved changes in Academy Profile</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" weight="bold" />
                  <span>
                    Synchronized with Supabase
                    {profileForm.updatedAt ? ` · ${new Date(profileForm.updatedAt).toLocaleTimeString()}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetProfile}
                disabled={!isProfileDirty || isSavingConfig}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-neutral-100 dark:bg-[#1C1C1C] hover:bg-neutral-200 dark:hover:bg-[#262626] disabled:opacity-40 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] text-xs font-mono font-bold uppercase tracking-wider rounded-[8px] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 touch-manipulation"
              >
                <ArrowCounterClockwise className="w-4 h-4" />
                <span>Discard</span>
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveAcademyConfig}
                disabled={isSavingConfig}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-[#EF2F38] hover:bg-[#D0252D] disabled:opacity-50 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-[8px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-[#EF2F38]/20 active:scale-95 touch-manipulation"
              >
                {isSavingConfig ? (
                  <>
                    <ArrowsClockwise className="w-4 h-4 animate-spin" weight="bold" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <FloppyDisk className="w-4 h-4" weight="bold" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    password: manageableRoles[0] === 'Student' ? 'Student1234567!' : 'Admin123456!',
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
                                  s.profileId === u.id || 
                                  (s.email && s.email.toLowerCase() === u.email?.toLowerCase())
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
                                    onClick={() => {
                                      updateUser(u.id, { isActive: !u.isActive });
                                      showNotification(`Account @${u.username} status toggled.`, 'info');
                                    }}
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
                  <Database className="w-4 h-4" /> Live Dataset Ledger Health
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Real-time synchronized index counts across all branches</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono rounded-[8px] border border-emerald-500/20 w-fit">
                Live State Active
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
                    {t('set_offline_backup_title')}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {t('set_offline_backup_desc')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-[8px] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
              >
                <DownloadSimple className="w-4 h-4" weight="bold" /> 
                <span>{t('set_btn_export_backup')}</span>
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
      <AnimatePresence>
        {showUserModal && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
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
                      onClick={() => setShowUserModal(null)} 
                      aria-label="Close user modal"
                      className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <X className="w-5 h-5"/>
                    </button>
                 </div>

                 <div className="p-4 sm:p-6 space-y-4 max-h-[calc(92dvh-135px)] overflow-y-auto overscroll-contain flex-1">
                    {/* Display Name & Khmer Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 mb-1 font-mono">
                          {t('usr_display_name')} <span className="text-red-500">*</span>
                        </label>
                        <input 
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
                        value={userForm.role} 
                        onChange={(e) => {
                          const newRole = e.target.value as Role;
                          setUserForm(prev => ({
                            ...prev,
                            role: newRole,
                            password: prev.password || (newRole === 'Student' ? 'Student1234567!' : 'Admin123456!')
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
                              password: prev.password || 'Student1234567!'
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
                              password: prev.role === 'Student' ? 'Student1234567!' : 'Admin123456!' 
                            }))}
                            className="text-[10px] text-[#EF2F38] hover:underline font-mono cursor-pointer"
                          >
                            Suggest Default
                          </button>
                        </div>
                        <div className="relative">
                          <input 
                            type={showModalPasswordText ? "text" : "password"} 
                            value={userForm.password} 
                            onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                            placeholder="Min 6 characters (e.g. Tkd2026!)"
                            className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono pr-10"
                          />
                          <button
                            type="button"
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
                        checked={userForm.isActive} 
                        onChange={(e) => setUserForm({...userForm, isActive: e.target.checked})}
                        className="w-4 h-4 text-[#EF2F38] rounded-[4px] cursor-pointer accent-[#EF2F38]"
                      />
                    </div>
                 </div>

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
                      className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-[#EF2F38] text-white font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-[#D0252D] cursor-pointer shadow-sm shadow-[#EF2F38]/20 transition-colors active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      {t('usr_save_account')}
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
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
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
                    onClick={() => setPasswordTargetUser(null)} 
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
                        placeholder="Min 6 characters (e.g. Tkd2026!)"
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
                    disabled={isResettingPassword || !targetNewPassword || targetNewPassword.length < 6}
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
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
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
