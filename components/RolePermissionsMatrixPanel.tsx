'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore, Role, User } from '@/lib/store';
import { 
  PERMISSION_DEFINITIONS, 
  ROLE_PERMISSIONS, 
  PermissionKey, 
  PermissionDefinition,
  hasPermission,
  MODULE_DEFINITIONS,
  ModuleDefinition
} from '@/lib/security';
import { 
  ShieldCheck, 
  Check, 
  X, 
  ArrowCounterClockwise, 
  FloppyDisk, 
  MagnifyingGlass, 
  Sliders, 
  Sparkle, 
  Info,
  LockKey,
  UsersThree,
  Eye,
  PencilSimple
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { playChime } from '@/lib/soundEffects';
import { UserPermissionsModal } from './UserPermissionsModal';

const EDITABLE_ROLES: { role: Role; label: string; badgeClass: string }[] = [
  { role: 'Admin', label: 'Admin', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  { role: 'Head Coach', label: 'Head Coach', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  { role: 'Coach', label: 'Coach', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  { role: 'Assistant Coach', label: 'Asst. Coach', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  { role: 'Student', label: 'Student', badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border-neutral-500/20' },
];

export function RolePermissionsMatrixPanel() {
  const { state, updateRolePermissionsBatch, showNotification } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [accessTypeFilter, setAccessTypeFilter] = useState<'all' | 'read' | 'write'>('all');
  const [presetTargetRole, setPresetTargetRole] = useState<Role>('Coach');
  const [showRolePresets, setShowRolePresets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserForOverride, setSelectedUserForOverride] = useState<User | null>(null);

  // Local working copy of permissions matrix: key format "role:permissionKey" => boolean
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, boolean>>({});

  // Get current active permission value considering store + pending overrides
  const getPermissionStatus = (role: Role, key: PermissionKey): boolean => {
    const overrideKey = `${role}:${key}`;
    if (typeof pendingOverrides[overrideKey] === 'boolean') {
      return pendingOverrides[overrideKey];
    }
    return hasPermission(role, key, state.rolePermissions);
  };

  // Toggle a single permission
  const handleToggle = (role: Role, key: PermissionKey) => {
    const overrideKey = `${role}:${key}`;
    const currentVal = getPermissionStatus(role, key);
    const nextVal = !currentVal;

    setPendingOverrides(prev => ({
      ...prev,
      [overrideKey]: nextVal,
    }));
    playChime('bell');
  };

  // Categories extracted from metadata
  const categories = useMemo(() => {
    const set = new Set<string>();
    PERMISSION_DEFINITIONS.forEach(p => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, []);

  // Filtered permission definitions
  const filteredPermissions = useMemo(() => {
    return PERMISSION_DEFINITIONS.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesAccessType = accessTypeFilter === 'all' || p.accessType === accessTypeFilter;
      const matchesSearch = 
        !search.trim() || 
        p.label.toLowerCase().includes(search.toLowerCase()) || 
        p.key.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesAccessType && matchesSearch;
    });
  }, [selectedCategory, accessTypeFilter, search]);

  // Set whole module access for a role (read / write / none)
  const handleSetRoleModuleAccess = (role: Role, mod: ModuleDefinition, level: 'none' | 'read' | 'write') => {
    setPendingOverrides(prev => {
      const next = { ...prev };
      if (level === 'none') {
        next[`${role}:${mod.readKey}`] = false;
        mod.writeKeys.forEach(k => { next[`${role}:${k}`] = false; });
      } else if (level === 'read') {
        next[`${role}:${mod.readKey}`] = true;
        mod.writeKeys.forEach(k => { next[`${role}:${k}`] = false; });
      } else if (level === 'write') {
        next[`${role}:${mod.readKey}`] = true;
        mod.writeKeys.forEach(k => { next[`${role}:${k}`] = true; });
      }
      return next;
    });
    playChime('bell');
  };

  // Count modified entries
  const modifiedCount = Object.keys(pendingOverrides).length;

  // Save changes to API & Supabase
  const handleSave = async () => {
    if (modifiedCount === 0) return;
    setIsSaving(true);
    try {
      const updates = Object.entries(pendingOverrides).map(([compositeKey, isGranted]) => {
        const [role, ...permParts] = compositeKey.split(':');
        const permissionKey = permParts.join(':');
        return {
          role: role as Role,
          permissionKey,
          isGranted,
        };
      });

      const res = await updateRolePermissionsBatch(updates);
      if (res.success) {
        setPendingOverrides({});
        playChime('success');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Reset local changes or restore defaults
  const handleDiscardLocalChanges = () => {
    setPendingOverrides({});
    showNotification('Discarded unsaved matrix modifications.', 'info');
  };

  const handleResetToBaselineDefaults = () => {
    const defaults: Record<string, boolean> = {};
    EDITABLE_ROLES.forEach(({ role }) => {
      PERMISSION_DEFINITIONS.forEach(p => {
        const baseline = (ROLE_PERMISSIONS[role] || []).includes(p.key);
        defaults[`${role}:${p.key}`] = baseline;
      });
    });
    setPendingOverrides(defaults);
    showNotification('Staged factory baseline permissions. Click "Save Matrix" to commit.', 'warning');
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & System Owner Notice Banner */}
      <div className="bg-gradient-to-r from-purple-900/10 via-purple-500/10 to-neutral-900/10 dark:from-purple-950/40 dark:via-purple-900/20 dark:to-neutral-900/40 border border-purple-500/30 rounded-[8px] p-4 sm:p-5 backdrop-blur-sm relative overflow-hidden transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400 shadow-sm">
              <LockKey className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white tracking-wide uppercase font-mono">
                  Central Role & Permission Matrix
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 font-mono">
                  Root Owner Control
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Configure dynamic authorization capabilities across pages, pro-shop operations, attendance, and finances. Changes apply in real-time.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {modifiedCount > 0 && (
              <button
                type="button"
                onClick={handleDiscardLocalChanges}
                className="px-3 py-2 text-xs font-mono font-bold rounded-[8px] border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
              >
                <X className="w-3.5 h-3.5" />
                <span>Discard ({modifiedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetToBaselineDefaults}
              className="px-3 py-2 text-xs font-mono font-bold rounded-[8px] border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
              title="Reset all roles to default factory security matrix"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || modifiedCount === 0}
              className={cn(
                "px-4 py-2 text-xs font-mono font-black uppercase tracking-wider rounded-[8px] flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation",
                modifiedCount > 0 
                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30" 
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-neutral-200 dark:border-neutral-700"
              )}
            >
              <FloppyDisk className="w-4 h-4" weight="bold" />
              <span>{isSaving ? 'Saving...' : `Save Matrix ${modifiedCount > 0 ? `(${modifiedCount})` : ''}`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Overrides Quick Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 rounded-[8px] p-3 transition-colors">
        <div className="flex items-center gap-2">
          <UsersThree className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" weight="bold" />
          <span className="text-xs text-neutral-800 dark:text-neutral-200 font-bold font-mono">
            Account-Level Overrides:
          </span>
          <span className="text-[11px] text-neutral-500 font-mono hidden md:inline">
            Override permissions for an individual staff member or student
          </span>
        </div>

        <select
          value=""
          onChange={e => {
            const u = state.users.find(x => x.id === e.target.value);
            if (u) setSelectedUserForOverride(u);
          }}
          className="bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-purple-500/30 rounded-[8px] px-3 py-1.5 text-xs text-neutral-900 dark:text-white font-mono cursor-pointer focus:outline-none focus:border-purple-500"
        >
          <option value="">-- Select Specific Account to Customize... --</option>
          {state.users
            .filter(u => u.role !== 'Root' && u.role !== 'Super Root')
            .map(u => (
              <option key={u.id} value={u.id}>
                {u.displayName} (@{u.username}) • {u.role}
              </option>
            ))}
        </select>
      </div>

      {/* Role-Level Module Presets */}
      <div className="bg-neutral-50 dark:bg-[#121212] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 space-y-2.5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono">
              Apply Module Access Preset:
            </span>
            <select
              value={presetTargetRole}
              onChange={e => setPresetTargetRole(e.target.value as Role)}
              className="bg-white dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#333] rounded-[8px] px-2.5 py-1 text-xs font-bold text-neutral-900 dark:text-white font-mono cursor-pointer"
            >
              {EDITABLE_ROLES.map(r => (
                <option key={r.role} value={r.role}>{r.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowRolePresets(!showRolePresets)}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-mono font-bold cursor-pointer self-start sm:self-auto"
          >
            {showRolePresets ? 'Hide Presets' : 'Show 1-Click Presets'}
          </button>
        </div>

        {showRolePresets && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-200 dark:border-[#222]">
            {MODULE_DEFINITIONS.map(mod => (
              <div 
                key={mod.module}
                className="p-2.5 rounded-[8px] bg-white dark:bg-[#181818] border border-neutral-200 dark:border-[#282828] flex items-center justify-between gap-2 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-neutral-800 dark:text-neutral-200">
                    {mod.label}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono truncate">
                    {mod.writeKeys.length} write actions
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetRoleModuleAccess(presetTargetRole, mod, 'read')}
                    title={`Grant ${presetTargetRole} Read-Only access`}
                    className="px-2 py-1 rounded-[6px] text-[10px] font-mono font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 cursor-pointer transition-colors active:scale-95"
                  >
                    Read
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetRoleModuleAccess(presetTargetRole, mod, 'write')}
                    title={`Grant ${presetTargetRole} Read & Write access`}
                    className="px-2 py-1 rounded-[6px] text-[10px] font-mono font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 cursor-pointer transition-colors active:scale-95"
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetRoleModuleAccess(presetTargetRole, mod, 'none')}
                    title={`Revoke all access for ${presetTargetRole}`}
                    className="px-1.5 py-1 rounded-[6px] text-[10px] font-mono font-bold bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/20 cursor-pointer transition-colors active:scale-95"
                  >
                    None
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Filters & Search Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 shadow-sm transition-colors">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar touch-pan-x">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-[8px] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer active:scale-95 touch-manipulation",
                selectedCategory === cat
                  ? "bg-purple-600 text-white shadow-xs font-black"
                  : "bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#282828]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Access Type Filter: All / Read / Write */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] shrink-0">
            <button
              type="button"
              onClick={() => setAccessTypeFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all cursor-pointer",
                accessTypeFilter === 'all'
                  ? "bg-white dark:bg-[#2A2A2A] text-neutral-900 dark:text-white shadow-xs font-black"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setAccessTypeFilter('read')}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer",
                accessTypeFilter === 'read'
                  ? "bg-blue-600 text-white shadow-xs font-black"
                  : "text-neutral-500 hover:text-blue-500"
              )}
            >
              <Eye className="w-3 h-3" weight="bold" /> Read
            </button>
            <button
              type="button"
              onClick={() => setAccessTypeFilter('write')}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer",
                accessTypeFilter === 'write'
                  ? "bg-amber-600 text-white shadow-xs font-black"
                  : "text-neutral-500 hover:text-amber-500"
              )}
            >
              <PencilSimple className="w-3 h-3" weight="bold" /> Write
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter capability..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#2c2c2c] rounded-[8px] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-purple-500 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3A. NATIVE MOBILE & TABLET VIEW: CAPABILITY CARDS (<1024px)              */}
      {/* ========================================================================= */}
      <div className="block lg:hidden space-y-3">
        {filteredPermissions.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 text-xs font-mono">
            No capabilities found matching your filter criteria.
          </div>
        ) : (
          filteredPermissions.map(p => {
            return (
              <div 
                key={p.key}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-xs space-y-3"
              >
                {/* Header */}
                <div className="space-y-1 border-b border-neutral-100 dark:border-[#202020] pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {p.accessType === 'read' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[9px] font-mono font-black uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                          <Eye className="w-2.5 h-2.5" weight="bold" /> READ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[9px] font-mono font-black uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <PencilSimple className="w-2.5 h-2.5" weight="bold" /> WRITE
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-[#202020] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#333]">
                        {p.category}
                      </span>
                    </div>

                    <span className="text-[9px] font-mono text-neutral-400 truncate max-w-[120px]">
                      {p.key}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white pt-1">
                    {p.label}
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-[#888] leading-relaxed">
                    {p.description}
                  </p>
                </div>

                {/* Role Toggles Grid */}
                <div>
                  <span className="block text-[9px] uppercase font-bold text-neutral-400 font-mono mb-2">
                    Role Access Matrix Toggles:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* Root Indicator */}
                    <div className="p-2 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase font-mono">
                        Root
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 font-mono">
                        <Check className="w-3 h-3" weight="bold" /> Locked
                      </span>
                    </div>

                    {/* Editable Roles */}
                    {EDITABLE_ROLES.map(({ role, label }) => {
                      const isGranted = getPermissionStatus(role, p.key);
                      const overrideKey = `${role}:${p.key}`;
                      const isLocallyModified = typeof pendingOverrides[overrideKey] === 'boolean';

                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleToggle(role, p.key)}
                          className={cn(
                            "p-2 rounded-[8px] border text-left flex items-center justify-between gap-2 transition-all cursor-pointer active:scale-95 touch-manipulation",
                            isGranted
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                              : "bg-neutral-50 dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-500 dark:text-[#777]",
                            isLocallyModified && "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-[#141414]"
                          )}
                        >
                          <span className="text-[10px] font-bold uppercase font-mono truncate">
                            {label}
                          </span>
                          <span className={cn(
                            "w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-black shrink-0 border",
                            isGranted 
                              ? "bg-emerald-500 text-white border-emerald-600" 
                              : "bg-neutral-200 dark:bg-[#242424] text-neutral-400 border-neutral-300 dark:border-[#333]"
                          )}>
                            {isGranted ? <Check className="w-3 h-3" weight="bold" /> : <X className="w-3 h-3" weight="bold" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3B. DESKTOP MATRIX TABLE (>=1024px)                                       */}
      {/* ========================================================================= */}
      <div className="hidden lg:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-[#181818] border-b border-neutral-200 dark:border-[#262626]">
                <th className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 min-w-[280px]">
                  Capability / Action
                </th>
                {/* Root Column (Pinned Readonly Full-Access) */}
                <th className="py-3.5 px-3 text-center text-xs font-black uppercase tracking-wider min-w-[90px]">
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    Root (Owner)
                  </span>
                </th>
                {/* Configurable Roles */}
                {EDITABLE_ROLES.map(({ role, label, badgeClass }) => (
                  <th key={role} className="py-3.5 px-3 text-center text-xs font-black uppercase tracking-wider min-w-[90px]">
                    <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border", badgeClass)}>
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-[#202020] text-xs">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500 font-mono">
                    No capabilities found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPermissions.map(p => {
                  return (
                    <tr 
                      key={p.key}
                      className="hover:bg-neutral-50/50 dark:hover:bg-[#171717] transition-colors"
                    >
                      {/* Capability Metadata */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 flex-wrap">
                          {p.accessType === 'read' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                              <Eye className="w-2.5 h-2.5" weight="bold" /> READ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <PencilSimple className="w-2.5 h-2.5" weight="bold" /> WRITE
                            </span>
                          )}
                          <span>{p.label}</span>
                          <span className="text-[10px] font-mono font-normal text-neutral-400 dark:text-neutral-500">
                            ({p.key})
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {p.description}
                        </div>
                      </td>

                      {/* Root Check (Always Granted & Locked) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] bg-red-500/10 text-red-500 border border-red-500/20">
                          <Check className="w-4 h-4" weight="bold" />
                        </div>
                      </td>

                      {/* Configurable Roles */}
                      {EDITABLE_ROLES.map(({ role }) => {
                        const isGranted = getPermissionStatus(role, p.key);
                        const overrideKey = `${role}:${p.key}`;
                        const isLocallyModified = typeof pendingOverrides[overrideKey] === 'boolean';

                        return (
                          <td key={role} className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggle(role, p.key)}
                              className={cn(
                                "w-7 h-7 rounded-[8px] transition-all inline-flex items-center justify-center cursor-pointer border active:scale-95 touch-manipulation",
                                isGranted 
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" 
                                  : "bg-neutral-100 dark:bg-[#1a1a1a] text-neutral-400 border-neutral-300 dark:border-[#2a2a2a] hover:bg-neutral-200 dark:hover:bg-[#252525]",
                                isLocallyModified && "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-[#141414]"
                              )}
                              title={`${role}: ${isGranted ? 'Granted' : 'Denied'} (Click to toggle)`}
                            >
                              {isGranted ? (
                                <Check className="w-3.5 h-3.5" weight="bold" />
                              ) : (
                                <X className="w-3.5 h-3.5" weight="bold" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix Footer Legend */}
        <div className="bg-neutral-50 dark:bg-[#181818] p-3 px-4 border-t border-neutral-200 dark:border-[#262626] flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-500 font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Granted Permission</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 inline-block" />
              <span>Denied / Restricted</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full ring-2 ring-purple-500 inline-block" />
              <span>Pending Local Override</span>
            </span>
          </div>

          <div>
            Showing <span className="font-bold text-neutral-800 dark:text-neutral-200">{filteredPermissions.length}</span> capabilities across <span className="font-bold text-neutral-800 dark:text-neutral-200">5</span> roles
          </div>
        </div>
      </div>

      {/* Account Specific Permissions Modal */}
      {selectedUserForOverride && (
        <UserPermissionsModal
          user={selectedUserForOverride}
          onClose={() => setSelectedUserForOverride(null)}
        />
      )}
    </div>
  );
}
