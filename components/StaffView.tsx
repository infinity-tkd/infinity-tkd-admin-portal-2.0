'use client';
import dynamic from 'next/dynamic';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { copyText } from '@/lib/clipboard';
import { ContactActions } from './ContactActions';

import { dialogMotion } from '@/lib/motion';
import React, { useState, useMemo } from 'react';
import { useAppStore, User } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple';
import { DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';

import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeClosed } from '@phosphor-icons/react/dist/csr/EyeClosed';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Checks } from '@phosphor-icons/react/dist/csr/Checks';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Medal } from '@phosphor-icons/react/dist/csr/Medal';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';




import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { calculateDanEligibility, formatDanRank, getDanStripes } from '@/lib/kukkiwon';

import { PageHeader } from './ui/PageHeader';
import { KpiCard } from './ui/KpiCard';
import { buttonClass, filterSelectClass, toolbarClass } from './ui/styles';
import { FilterRail, SearchField, ViewToggle } from './ui/Toolbar';
import { ManageStaffPanel } from './ManageStaffPanel';
import { SafeImage } from '@/components/SafeImage';
import { useT } from '@/hooks/useTranslation';

// Opened rarely: loaded on demand to keep this view's bundle small.
const AddStaffModal = dynamic(() => import('./AddStaffModal').then(module => module.AddStaffModal), { ssr: false });
const BulkImportStaffModal = dynamic(() => import('./BulkImportStaffModal').then(module => module.BulkImportStaffModal), { ssr: false });

const ROLE_HIERARCHY: Record<string, number> = {
    'Admin': 1,
    'Head Coach': 2,
    'Coach': 3,
    'Assistant Coach': 4,
  };

export function StaffView() {
  const { state, can, updateUser, showNotification } = useAppStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [danFilter, setDanFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'role' | 'name-asc' | 'name-desc' | 'dan-desc' | 'status'>('role');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string, label: string) => {
    if (!text) return;
    if (!(await copyText(text))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopiedId(id);
    showNotification(`${label} copied to clipboard!`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const canEditStaff = can('action:staff_manage');

  // Fast password reset modal state
  const [passwordTargetStaff, setPasswordTargetStaff] = useState<User | null>(null);
  const [staffNewPassword, setStaffNewPassword] = useState('');
  const [showStaffPasswordText, setShowStaffPasswordText] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleResetStaffPassword = async () => {
    if (!passwordTargetStaff || !staffNewPassword || staffNewPassword.length < 12) {
      showNotification('Password must be at least 12 characters long.', 'warning');
      return;
    }
    setIsResettingPassword(true);
    try {
      await updateUser(passwordTargetStaff.id, { password: staffNewPassword });
      showNotification(`Password for ${passwordTargetStaff.displayName} updated successfully!`, 'success');
      setPasswordTargetStaff(null);
      setStaffNewPassword('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update staff password.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const allStaff = useMemo(() => {
    return state.users.filter(u => {
      // Exclude system accounts: Super Root and Root are system accounts ('acc'), not members
      if (u.role === 'Root' || u.role === 'Super Root' || u.role === 'Student') {
        return false;
      }
      return u.role === 'Admin' || u.role === 'Head Coach' || u.role === 'Coach' || u.role === 'Assistant Coach';
    });
  }, [state.users]);



  const staffMembers = useMemo(() => {
    const filtered = allStaff.filter(u => {
      const matchesSearch =
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
        (u.kukkiwonId && u.kukkiwonId.toLowerCase().includes(search.toLowerCase()));

      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' ||
        (statusFilter === 'Active' ? u.isActive : !u.isActive);

      const matchesDan = danFilter === 'All'
        ? true
        : danFilter === 'Eligible'
        ? (() => {
            if (!u.currentDan || !u.danIssueDate) return false;
            return calculateDanEligibility(u.currentDan, u.danIssueDate, u.dob).status === 'ELIGIBLE';
          })()
        : danFilter === '1'
        ? u.currentDan === 1
        : danFilter === '2'
        ? u.currentDan === 2
        : danFilter === '3'
        ? u.currentDan === 3
        : danFilter === '4+'
        ? (u.currentDan != null && u.currentDan >= 4)
        : danFilter === 'Unranked'
        ? (!u.currentDan || u.currentDan < 1)
        : true;

      return matchesSearch && matchesRole && matchesStatus && matchesDan;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'role') {
        const orderA = ROLE_HIERARCHY[a.role] ?? 99;
        const orderB = ROLE_HIERARCHY[b.role] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'name-asc') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'name-desc') {
        return b.displayName.localeCompare(a.displayName);
      }
      if (sortBy === 'dan-desc') {
        const danA = a.currentDan || 0;
        const danB = b.currentDan || 0;
        if (danA !== danB) return danB - danA;
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'status') {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }
      return 0;
    });
  }, [allStaff, search, roleFilter, statusFilter, danFilter, sortBy]);

  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const openEditor = (u: User) => {
    setEditingStaff(u);
  };

  // KPI Metrics
  const totalStaffCount = allStaff.length;
  const headCoachesCount = allStaff.filter(u => u.role === 'Head Coach').length;
  const activeStaffCount = allStaff.filter(u => u.isActive).length;

  const blackBeltsCount = allStaff.filter(u => u.currentDan && u.currentDan >= 1).length;
  const eligibleForTestCount = allStaff.filter(u => {
    if (!u.currentDan || !u.danIssueDate) return false;
    return calculateDanEligibility(u.currentDan, u.danIssueDate, u.dob).status === 'ELIGIBLE';
  }).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-12 sm:space-y-5">
      <PageHeader
        icon={<UsersThree weight="bold" />}
        eyebrow="Academy team"
        meta={`${totalStaffCount} staff`}
        title={t('stf_title')}
        description={t('stf_subtitle')}
        actions={canEditStaff ? <>
          <button type="button" onClick={() => setIsBulkImporting(true)} className={buttonClass()}>
            Bulk Import
          </button>
          <button type="button" onClick={() => setIsAdding(true)} className={buttonClass({ variant: 'primary' })}>
            + {t('stf_add_staff')}
          </button>
        </> : undefined}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <KpiCard label="Total Staff" value={totalStaffCount} tone="brand" icon={<UsersThree weight="bold" />} />
        <KpiCard label="Head Coaches" value={headCoachesCount} tone="blue" icon={<ShieldCheck weight="bold" />} />
        <KpiCard label="Active Access" value={activeStaffCount} tone="green" icon={<Checks weight="bold" />} />
        <KpiCard label="Black Belts" value={blackBeltsCount} tone="amber" icon={<Medal weight="bold" />} />
        <KpiCard label="Test-Ready" value={eligibleForTestCount} tone="green" icon={<CalendarCheck weight="bold" />} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Advanced Filters & Device View Controls */}
      <div className={toolbarClass}>
        <SearchField value={search} onChange={setSearch} placeholder={t('stf_search_placeholder')} className="w-full md:max-w-sm md:shrink-0" />

        <FilterRail className="md:justify-end">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={filterSelectClass}
            aria-label="Filter staff by role"
          >
            <option value="All">{t('stf_all_roles')}</option>
            <option value="Admin">Admin</option>
            <option value="Head Coach">Head Coach</option>
            <option value="Coach">Coach</option>
            <option value="Assistant Coach">Assistant Coach</option>
          </select>

          {/* Kukkiwon Dan Filter */}
          <select
            value={danFilter}
            onChange={(e) => setDanFilter(e.target.value)}
            className={filterSelectClass}
            aria-label="Filter staff by Kukkiwon Dan rank"
          >
            <option value="All">All Dan Ranks</option>
            <option value="Eligible">✅ Legit to Test</option>
            <option value="1">1st Dan</option>
            <option value="2">2nd Dan</option>
            <option value="3">3rd Dan</option>
            <option value="4+">4th+ Dan (Master)</option>
            <option value="Unranked">Unranked / None</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={filterSelectClass}
            aria-label="Filter staff by account status"
          >
            <option value="All">{t('stf_all_accounts')}</option>
            <option value="Active">{t('stf_active_only')}</option>
            <option value="Inactive">{t('stf_inactive_only')}</option>
          </select>

          {/* Sort Selector: Default Sort by Role Hierarchy */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className={filterSelectClass}
            aria-label="Sort staff members"
          >
            <option value="role">Sort: Role (Default)</option>
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="dan-desc">Sort: Dan Rank</option>
            <option value="status">Sort: Active First</option>
          </select>

          <ViewToggle label="Staff layout" value={viewMode} onChange={setViewMode} options={[
            { id: 'grid', label: 'Grid view', title: 'Grid Cards View', icon: <SquaresFour weight="bold" /> },
            { id: 'table', label: 'Table view', title: 'Detailed Table View', icon: <ListDashes weight="bold" /> },
          ]} />

          <div className="flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-control px-3 font-mono text-[10px] font-bold uppercase text-ink-muted">
            {t('stf_total')}: <span className="ml-1 font-bold text-ink">{staffMembers.length}</span>
          </div>
        </FilterRail>
      </div>

      {/* Directory Content Area */}
      {state.isLoading ? (
        /* Animated Pulse Skeleton for Staff */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col space-y-4 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-[8px] bg-neutral-200 dark:bg-[#262626] shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="w-24 h-4 bg-neutral-200 dark:bg-[#262626] rounded" />
                    <div className="w-14 h-3 bg-neutral-100 dark:bg-[#202020] rounded" />
                  </div>
                </div>
                <div className="w-8 h-8 rounded-[8px] bg-neutral-200 dark:bg-[#262626]" />
              </div>
              <div className="border-t border-neutral-200 dark:border-[#262626] pt-3 space-y-2">
                <div className="w-32 h-3 bg-neutral-200 dark:bg-[#262626] rounded" />
                <div className="w-24 h-3 bg-neutral-100 dark:bg-[#202020] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : staffMembers.length === 0 ? (
        <div className="py-16 px-4 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col items-center justify-center">
          <UserCircle className="w-12 h-12 text-neutral-400 dark:text-[#666] mb-3" weight="duotone" />
          <p className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">{t('stf_no_match')}</p>
          <p className="text-xs text-neutral-500 dark:text-[#666] max-w-sm mb-4">No staff members match the selected role or search keyword.</p>
          {(search || roleFilter !== 'All' || statusFilter !== 'All' || danFilter !== 'All' || sortBy !== 'role') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setRoleFilter('All');
                setStatusFilter('All');
                setDanFilter('All');
                setSortBy('role');
              }}
              className="px-4 py-2 min-h-[44px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider rounded-[8px] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowsClockwise className="w-4 h-4" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW MODE */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {staffMembers.map(staff => {
            const assignedClassesCount = state.classSessions.filter(c => c.coachId === staff.id).length;
            return (
              <div
                key={staff.id}
                onClick={() => openEditor(staff)}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group cursor-pointer hover:border-brand/50 hover:shadow-md transition-all duration-200 shadow-sm"
              >
                <div>
                  {/* Card Header with Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <SafeImage
                        src={staff.profilePicturePath}
                        alt={staff.displayName}
                        containerClassName="w-11 h-11 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center text-neutral-500 dark:text-[#999] group-hover:border-brand/30 transition-colors overflow-hidden shrink-0 shadow-inner"
                        fallback={<UserCircle className="w-7 h-7 text-neutral-400" weight="fill"/>}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight group-hover:text-brand-ink transition-colors truncate">{staff.displayName}</h3>
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-[#777] font-mono truncate">@{staff.username}</p>
                      </div>
                    </div>

                    {/* Active/Inactive Status Dot */}
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono shrink-0 border",
                      staff.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", staff.isActive ? "bg-emerald-500" : "bg-red-500")} />
                      {staff.isActive ? "Active" : "Locked"}
                    </span>
                  </div>

                  {/* Role & Classes Tags */}
                  <div className="flex flex-wrap gap-1.5 items-center mb-3">
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-[8px] text-[9px] font-bold uppercase tracking-widest border font-mono",
                      staff.role === 'Admin' ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" :
                      staff.role === 'Head Coach' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                      "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-[#999] border-neutral-300 dark:border-transparent"
                    )}>
                      {staff.role}
                    </span>
                    {assignedClassesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-[8px] text-[9px] font-bold uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono">
                        {assignedClassesCount} {assignedClassesCount === 1 ? 'Class' : 'Classes'}
                      </span>
                    )}
                  </div>

                  {/* Kukkiwon Dan & Legitimacy Radar Strip */}
                  {staff.currentDan ? (
                    (() => {
                      const el = calculateDanEligibility(staff.currentDan, staff.danIssueDate, staff.dob);
                      return (
                        <div className="mb-3 p-2.5 rounded-[8px] bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                              <Medal className="w-3.5 h-3.5 text-brand-ink" weight="bold" />
                              <span>{formatDanRank(staff.currentDan)} ({getDanStripes(staff.currentDan)})</span>
                            </span>
                            {el.status === 'ELIGIBLE' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                                ✅ Legit to Test
                              </span>
                            ) : el.status === 'TIME_PENDING' ? (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold truncate max-w-[130px]" title={el.headline}>
                                ⏳ {el.headline}
                              </span>
                            ) : el.status === 'AGE_RESTRICTED' ? (
                              <span className="text-[9px] text-rose-500 font-semibold">
                                Age {el.minAgeForNextDan} Req
                              </span>
                            ) : el.status === 'MAX_DAN' ? (
                              <span className="text-[9px] text-purple-400 font-semibold">
                                9th Dan Max
                              </span>
                            ) : null}
                          </div>

                          {/* Progress bar if awaiting time */}
                          {el.status === 'TIME_PENDING' && (
                            <div className="w-full bg-neutral-200 dark:bg-[#2C2C2C] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full transition-all"
                                style={{ width: `${el.progressPercent}%` }}
                              />
                            </div>
                          )}

                          {staff.kukkiwonId && (
                            <div className="flex items-center justify-between text-[9px] text-neutral-400 dark:text-[#777]">
                              <span>ID: #{staff.kukkiwonId}</span>
                              {el.earliestTestDate && (
                                <span>Target: {el.earliestTestDate}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (staff.role === 'Coach' || staff.role === 'Assistant Coach' || staff.role === 'Head Coach') ? (
                    <div className="mb-3 px-2.5 py-1.5 rounded-[8px] border border-dashed border-neutral-200 dark:border-[#262626] flex items-center justify-between text-[10px] font-mono text-neutral-400 dark:text-[#777]">
                      <span>No Kukkiwon ID</span>
                      <span className="text-[9px] text-brand-ink hover:underline cursor-pointer" onClick={() => openEditor(staff)}>
                        + Add Dan
                      </span>
                    </div>
                  ) : null}

                  {/* Contact Info */}
                  <div className="space-y-1.5 border-t border-neutral-200 dark:border-[#262626] pt-3 text-xs font-mono">
                    <ContactActions contact={{telegramUsername:staff.telegramUsername}} name={staff.displayName} />
                    <div className="flex items-center justify-between gap-1 text-neutral-600 dark:text-[#999] min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <EnvelopeSimple className="w-3.5 h-3.5 text-neutral-400 dark:text-[#666] shrink-0"/>
                        <a
                          href={`mailto:${staff.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate hover:text-brand-ink hover:underline transition-colors"
                          title={staff.email}
                        >
                          {staff.email || 'N/A'}
                        </a>
                      </div>
                      {staff.email && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(staff.email, `grid-email-${staff.id}`, 'Email');
                          }}
                          title="Copy Email"
                          className="p-1 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                        >
                          {copiedId === `grid-email-${staff.id}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 text-neutral-600 dark:text-[#999] min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DeviceMobile className="w-3.5 h-3.5 text-neutral-400 dark:text-[#666] shrink-0"/>
                        {staff.phone ? (
                          <a
                            href={`tel:${staff.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-brand-ink hover:underline transition-colors truncate"
                          >
                            {staff.phone}
                          </a>
                        ) : (
                          <span className="text-neutral-400 dark:text-[#666]">{t('stf_no_phone')}</span>
                        )}
                      </div>
                      {staff.phone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(staff.phone!, `grid-phone-${staff.id}`, 'Phone');
                          }}
                          title="Copy Phone"
                          className="p-1 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                        >
                          {copiedId === `grid-phone-${staff.id}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Toolbar */}
                {canEditStaff && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                    {staff.phone && (
                      <a
                        href={`tel:${staff.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Call Staff Member"
                        aria-label="Call staff member"
                        className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-[6px] sm:rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-[#AAA] hover:text-brand-ink dark:hover:text-white active:scale-95 touch-manipulation transition-all"
                      >
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      title="Set / Change Password"
                      aria-label="Set or change password"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStaffNewPassword('');
                        setPasswordTargetStaff(staff);
                      }}
                      className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-[6px] sm:rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-[#AAA] hover:text-brand-ink dark:hover:text-white active:scale-95 touch-manipulation transition-all cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-ink" />
                    </button>
                    <button
                      type="button"
                      title={t('act_edit')}
                      aria-label="Edit staff profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(staff);
                      }}
                      className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-[6px] sm:rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-[#AAA] hover:text-neutral-900 dark:hover:text-white active:scale-95 touch-manipulation transition-all cursor-pointer"
                    >
                      <PencilSimple className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW MODE (Multi-device high-density) */
        <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm transition-colors">
          {/* Desktop & Tablet Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626]">
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono">Staff Member</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono">Role</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono">Kukkiwon Dan</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono text-center">Classes</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono">Direct Contact</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-widest font-mono text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                {staffMembers.map(staff => {
                  const assignedClassesCount = state.classSessions.filter(c => c.coachId === staff.id).length;
                  return (
                    <tr
                      key={staff.id}
                      onClick={() => openEditor(staff)}
                      className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={staff.profilePicturePath}
                            alt={staff.displayName}
                            containerClassName="w-9 h-9 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0"
                            fallback={<UserCircle className="w-5 h-5 text-neutral-400" weight="fill"/>}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{staff.displayName}</span>
                            <ContactActions contact={staff} name={staff.displayName} compact />
                            <span className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">@{staff.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2.5 py-1 rounded-[8px] text-[10px] font-bold uppercase tracking-widest border font-mono whitespace-nowrap",
                          staff.role === 'Admin' ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" :
                          staff.role === 'Head Coach' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                          "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-[#999] border-neutral-300 dark:border-transparent"
                        )}>
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {staff.currentDan ? (
                          (() => {
                            const el = calculateDanEligibility(staff.currentDan, staff.danIssueDate, staff.dob);
                            return (
                              <div className="flex flex-col gap-1 min-w-[130px]">
                                <div className="flex items-center gap-1.5">
                                  <Medal className="w-3.5 h-3.5 text-brand-ink shrink-0" weight="bold" />
                                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                                    {formatDanRank(staff.currentDan)}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">({getDanStripes(staff.currentDan)})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {el.status === 'ELIGIBLE' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                      ✅ Legit to Test
                                    </span>
                                  ) : el.status === 'TIME_PENDING' ? (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold truncate max-w-[140px]" title={el.headline}>
                                      ⏳ {el.headline}
                                    </span>
                                  ) : el.status === 'AGE_RESTRICTED' ? (
                                    <span className="text-[9px] text-rose-500 font-semibold">
                                      Age {el.minAgeForNextDan} Req
                                    </span>
                                  ) : el.status === 'MAX_DAN' ? (
                                    <span className="text-[9px] text-purple-400 font-semibold">
                                      9th Dan Max
                                    </span>
                                  ) : null}
                                </div>
                                {staff.kukkiwonId && (
                                  <span className="text-[9px] text-neutral-400 dark:text-[#666]">
                                    #{staff.kukkiwonId}
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : (staff.role === 'Coach' || staff.role === 'Assistant Coach' || staff.role === 'Head Coach') ? (
                          <span className="text-[10px] text-neutral-400 dark:text-[#666] italic">
                            Unranked
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 dark:text-[#666]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                          {assignedClassesCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                              {assignedClassesCount} {assignedClassesCount === 1 ? 'class' : 'classes'}
                            </span>
                          ) : (
                            <span className="text-neutral-400 dark:text-[#666] text-[10px]">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-[#999]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[200px]" title={staff.email}>
                              <a href={`mailto:${staff.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-ink hover:underline">
                                {staff.email || 'N/A'}
                              </a>
                            </span>
                            {staff.email && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(staff.email, `tbl-email-${staff.id}`, 'Email');
                                }}
                                title="Copy Email"
                                className="p-0.5 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                              >
                                {copiedId === `tbl-email-${staff.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          {staff.phone && (
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-[#777]">
                              <a href={`tel:${staff.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-ink">
                                {staff.phone}
                              </a>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(staff.phone!, `tbl-phone-${staff.id}`, 'Phone');
                                }}
                                title="Copy Phone"
                                className="p-0.5 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                              >
                                {copiedId === `tbl-phone-${staff.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {staff.isActive ? (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest font-mono">
                            <Checks className="w-3.5 h-3.5"/> Active
                          </span>
                        ) : (
                          <span className="text-red-500 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest font-mono">
                            <XCircle className="w-3.5 h-3.5"/> Locked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Set / Change Password"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffNewPassword('');
                              setPasswordTargetStaff(staff);
                            }}
                            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-brand-ink dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5 text-brand-ink"/>
                          </button>
                          <button
                            type="button"
                            title={t('act_edit')}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditor(staff);
                            }}
                            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <PencilSimple className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Native Mobile High-Density Card List (< md) */}
          <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626]">
            {staffMembers.map(staff => {
              const assignedClassesCount = state.classSessions.filter(c => c.coachId === staff.id).length;
              const el = staff.currentDan ? calculateDanEligibility(staff.currentDan, staff.danIssueDate, staff.dob) : null;

              return (
                <div
                  key={staff.id}
                  onClick={() => openEditor(staff)}
                  className="p-3.5 space-y-3 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                >
                  {/* Top Bar: Avatar, Names, and Status */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <SafeImage
                        src={staff.profilePicturePath}
                        alt={staff.displayName}
                        containerClassName="w-9 h-9 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0"
                        fallback={<UserCircle className="w-5 h-5 text-neutral-400" weight="fill" />}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {staff.displayName}
                          </span>
                          {staff.khmerName && (
                            <span className="text-[10px] text-neutral-400 dark:text-[#777] font-normal truncate">
                              ({staff.khmerName})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 dark:text-[#888] font-mono block">
                          @{staff.username}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {staff.isActive ? (
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider font-mono bg-emerald-500/10 px-2 py-0.5 rounded-[6px] border border-emerald-500/20">
                          <Checks className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-red-500 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider font-mono bg-red-500/10 px-2 py-0.5 rounded-[6px] border border-red-500/20">
                          <XCircle className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges Row: Role, Dan, Classes */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider border font-mono whitespace-nowrap",
                        staff.role === 'Admin'
                          ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30"
                          : staff.role === 'Head Coach'
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                          : "bg-neutral-100 dark:bg-[#262626] text-neutral-800 dark:text-[#999] border-neutral-300 dark:border-transparent"
                      )}
                    >
                      {staff.role}
                    </span>

                    {staff.currentDan && (
                      <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-bold font-mono bg-brand/10 text-brand-ink border border-brand/20 flex items-center gap-1">
                        <Medal className="w-3 h-3 shrink-0" weight="bold" />
                        <span>{formatDanRank(staff.currentDan)}</span>
                        {el?.status === 'ELIGIBLE' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black">✓ Ready</span>
                        )}
                      </span>
                    )}

                    {assignedClassesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {assignedClassesCount} {assignedClassesCount === 1 ? 'class' : 'classes'}
                      </span>
                    )}
                  </div>

                  {/* Direct Contact Links */}
                  <ContactActions contact={staff} name={staff.displayName} />
                  {(staff.email || staff.phone) && (
                    <div className="flex flex-col gap-1 text-[11px] font-mono text-neutral-600 dark:text-[#999] pt-1 border-t border-neutral-100 dark:border-[#1E1E1E]">
                      {staff.email && (
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`mailto:${staff.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-brand-ink hover:underline truncate"
                          >
                            {staff.email}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(staff.email, `m-email-${staff.id}`, 'Email');
                            }}
                            title="Copy Email"
                            className="p-1 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                          >
                            {copiedId === `m-email-${staff.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                      {staff.phone && (
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`tel:${staff.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-brand-ink hover:underline"
                          >
                            {staff.phone}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(staff.phone!, `m-phone-${staff.id}`, 'Phone');
                            }}
                            title="Copy Phone"
                            className="p-1 hover:text-brand-ink text-neutral-400 dark:text-[#666] cursor-pointer"
                          >
                            {copiedId === `m-phone-${staff.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Bar */}
                  {canEditStaff && (
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-neutral-100 dark:border-[#1E1E1E]">
                      {staff.phone && (
                        <a
                          href={`tel:${staff.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Call Staff Member"
                          className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-[#AAA] hover:text-brand-ink dark:hover:text-white text-[10px] font-bold uppercase tracking-wider font-mono active:scale-95 touch-manipulation transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                      <button
                        type="button"
                        title="Set / Change Password"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStaffNewPassword('');
                          setPasswordTargetStaff(staff);
                        }}
                        className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-[#AAA] hover:text-brand-ink dark:hover:text-white text-[10px] font-bold uppercase tracking-wider font-mono active:scale-95 touch-manipulation transition-all cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-brand-ink" />
                        <span>Pass</span>
                      </button>
                      <button
                        type="button"
                        title={t('act_edit')}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(staff);
                        }}
                        className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-[6px] bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black text-[10px] font-bold uppercase tracking-wider font-mono active:scale-95 touch-manipulation transition-all cursor-pointer"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Staff Password Reset Modal */}
      <AnimatePresence>
        {passwordTargetStaff && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
              <ModalA11y label="Reset staff password" onClose={() => setPasswordTargetStaff(null)} />
              <motion.div
                {...dialogMotion}
                className="w-full max-w-md max-h-[90dvh] bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col text-neutral-900 dark:text-white overflow-hidden"
              >
                <div className="p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[8px] bg-brand/10 flex items-center justify-center text-brand-ink">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Set Staff Password</h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">@{passwordTargetStaff.username} • {passwordTargetStaff.displayName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPasswordTargetStaff(null)}
                    className="p-1 text-neutral-400 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4 max-h-[calc(90dvh-130px)] overflow-y-auto overscroll-contain flex-1">
                  <div className="bg-neutral-50 dark:bg-[#1A1A1A] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-600 dark:text-neutral-300">
                    Directly update this staff member&apos;s admin login password. They can use this new password immediately to log into the Admin Portal.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider font-mono">New Password</label>
                    <div className="relative">
                      <input
                        type={showStaffPasswordText ? "text" : "password"}
                        value={staffNewPassword}
                        onChange={e => setStaffNewPassword(e.target.value)}
                        placeholder="Min 6 characters (e.g. Coach1234!)"
                        className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-brand transition-colors pr-10"
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
                      onClick={() => setStaffNewPassword(`Tkd${passwordTargetStaff.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}!2026`)}
                      className="text-[10px] text-brand-ink hover:underline font-mono cursor-pointer"
                    >
                      Suggest: Tkd{passwordTargetStaff.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}!2026
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 dark:bg-[#0A0A0A] border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordTargetStaff(null)}
                    className="h-9 pointer-coarse:h-11 px-3.5 sm:px-4 bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-800 dark:text-[#AAA] font-bold uppercase tracking-wider text-[11px] sm:text-xs rounded-[6px] sm:rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#262626] active:scale-95 touch-manipulation cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetStaffPassword}
                    disabled={isResettingPassword || !staffNewPassword}
                    className="h-9 pointer-coarse:h-11 px-3.5 sm:px-4 bg-brand text-white font-bold uppercase tracking-wider text-[11px] sm:text-xs rounded-[6px] sm:rounded-[8px] hover:bg-brand-strong disabled:opacity-50 active:scale-95 touch-manipulation cursor-pointer shadow-sm shadow-brand/20 flex items-center gap-1.5 transition-all"
                  >
                    {isResettingPassword ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}

        {editingStaff && (
          <ManageStaffPanel staff={editingStaff} onClose={() => setEditingStaff(null)} />
        )}
        {isAdding && (
          <AddStaffModal onClose={() => setIsAdding(false)} />
        )}
        {isBulkImporting && (
          <BulkImportStaffModal onClose={() => setIsBulkImporting(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default StaffView;
