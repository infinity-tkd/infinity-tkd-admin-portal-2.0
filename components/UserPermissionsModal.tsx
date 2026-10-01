'use client';

import React, { useState, useMemo } from 'react';
import { User, Role, useAppStore } from '@/lib/store';
import { 
  PERMISSION_DEFINITIONS, 
  MODULE_DEFINITIONS,
  ModuleDefinition,
  PermissionKey, 
  AccessType,
  hasPermission 
} from '@/lib/security';
import { 
  ShieldCheck, 
  X, 
  MagnifyingGlass, 
  Check, 
  LockKey, 
  Warning, 
  ArrowCounterClockwise,
  FloppyDisk,
  Sparkle,
  Eye,
  PencilSimple,
  Sliders
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { playChime } from '@/lib/soundEffects';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';

interface UserPermissionsModalProps {
  user: User;
  onClose: () => void;
}

export function UserPermissionsModal({ user, onClose }: UserPermissionsModalProps) {
  const { state, updateUserPermissionsBatch, showNotification } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [accessTypeFilter, setAccessTypeFilter] = useState<'all' | 'read' | 'write'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showModulePresets, setShowModulePresets] = useState(true);

  // Staged overrides: key is permissionKey, value is boolean (explicit grant/deny) or null (inherit from role)
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, boolean | null>>(() => {
    const initial: Record<string, boolean | null> = {};
    PERMISSION_DEFINITIONS.forEach(p => {
      const compositeKey = `${user.id}:${p.key}`;
      if (typeof state.userPermissions[compositeKey] === 'boolean') {
        initial[p.key] = state.userPermissions[compositeKey];
      }
    });
    return initial;
  });

  // Categories extracted from metadata
  const categories = useMemo(() => {
    const set = new Set<string>();
    PERMISSION_DEFINITIONS.forEach(p => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, []);

  // Compute what the role baseline is (ignoring user overrides)
  const getRoleBaseline = (key: PermissionKey): boolean => {
    return hasPermission(user.role, key, state.rolePermissions);
  };

  // Compute effective permission considering staged override -> state user override -> role override -> baseline
  const getEffectivePermission = (key: PermissionKey): { isGranted: boolean; source: 'user_override' | 'role_default' } => {
    if (user.role === 'Root' || user.role === 'Super Root') {
      return { isGranted: true, source: 'role_default' };
    }

    if (stagedOverrides[key] !== undefined) {
      if (stagedOverrides[key] === null) {
        return { isGranted: getRoleBaseline(key), source: 'role_default' };
      }
      return { isGranted: stagedOverrides[key] as boolean, source: 'user_override' };
    }

    const compositeKey = `${user.id}:${key}`;
    if (typeof state.userPermissions[compositeKey] === 'boolean') {
      return { isGranted: state.userPermissions[compositeKey], source: 'user_override' };
    }

    return { isGranted: getRoleBaseline(key), source: 'role_default' };
  };

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

  // Compare staged overrides vs saved state.userPermissions to count actual changes
  const modifiedCount = useMemo(() => {
    let count = 0;
    PERMISSION_DEFINITIONS.forEach(p => {
      const compositeKey = `${user.id}:${p.key}`;
      const savedVal = typeof state.userPermissions[compositeKey] === 'boolean' 
        ? state.userPermissions[compositeKey] 
        : null;
      const currentVal = stagedOverrides[p.key] !== undefined 
        ? stagedOverrides[p.key] 
        : savedVal;

      if (currentVal !== savedVal) {
        count++;
      }
    });
    return count;
  }, [stagedOverrides, state.userPermissions, user.id]);

  // Set override state for a permission (true = allow, false = deny, null = inherit)
  const handleSetOverride = (key: PermissionKey, value: boolean | null) => {
    setStagedOverrides(prev => ({
      ...prev,
      [key]: value,
    }));
    playChime('bell');
  };

  // Set whole module access level (None / Read-Only / Read-Write / Inherit)
  const handleSetModuleAccess = (def: ModuleDefinition, level: 'none' | 'read' | 'write' | 'inherit') => {
    setStagedOverrides(prev => {
      const next = { ...prev };
      if (level === 'inherit') {
        next[def.readKey] = null;
        def.writeKeys.forEach(k => { next[k] = null; });
      } else if (level === 'none') {
        next[def.readKey] = false;
        def.writeKeys.forEach(k => { next[k] = false; });
      } else if (level === 'read') {
        next[def.readKey] = true;
        def.writeKeys.forEach(k => { next[k] = false; });
      } else if (level === 'write') {
        next[def.readKey] = true;
        def.writeKeys.forEach(k => { next[k] = true; });
      }
      return next;
    });
    playChime('bell');
  };

  // Determine current effective level of a module in the modal
  const getModuleCurrentLevel = (def: ModuleDefinition): 'none' | 'read' | 'write' | 'mixed' => {
    const readVal = getEffectivePermission(def.readKey).isGranted;
    if (!readVal) return 'none';
    const writes = def.writeKeys.map(k => getEffectivePermission(k).isGranted);
    if (writes.length === 0) return 'read';
    const allWriteTrue = writes.every(Boolean);
    const allWriteFalse = writes.every(w => !w);
    if (allWriteTrue) return 'write';
    if (allWriteFalse) return 'read';
    return 'mixed';
  };

  // Reset all to inherit from role
  const handleResetAllToRoleDefaults = () => {
    const cleared: Record<string, boolean | null> = {};
    PERMISSION_DEFINITIONS.forEach(p => {
      cleared[p.key] = null;
    });
    setStagedOverrides(cleared);
    playChime('alert');
    showNotification(`Reset all permissions for @${user.username} to inherit from ${user.role} role.`, 'info');
  };

  // Save changes
  const handleSave = async () => {
    if (modifiedCount === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const updates: { permissionKey: string; isGranted: boolean | null }[] = [];

      PERMISSION_DEFINITIONS.forEach(p => {
        const compositeKey = `${user.id}:${p.key}`;
        const savedVal = typeof state.userPermissions[compositeKey] === 'boolean' 
          ? state.userPermissions[compositeKey] 
          : null;
        const currentVal = stagedOverrides[p.key] !== undefined 
          ? stagedOverrides[p.key] 
          : savedVal;

        if (currentVal !== savedVal) {
          updates.push({
            permissionKey: p.key,
            isGranted: currentVal,
          });
        }
      });

      const res = await updateUserPermissionsBatch(user.id, updates);
      if (res.success) {
        playChime('success');
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Tally counts of custom overrides
  const customOverrideStats = useMemo(() => {
    let customGranted = 0;
    let customRevoked = 0;
    let inherited = 0;

    PERMISSION_DEFINITIONS.forEach(p => {
      const compositeKey = `${user.id}:${p.key}`;
      const savedVal = typeof state.userPermissions[compositeKey] === 'boolean' 
        ? state.userPermissions[compositeKey] 
        : null;
      const currentVal = stagedOverrides[p.key] !== undefined 
        ? stagedOverrides[p.key] 
        : savedVal;

      if (currentVal === true) customGranted++;
      else if (currentVal === false) customRevoked++;
      else inherited++;
    });

    return { customGranted, customRevoked, inherited };
  }, [stagedOverrides, state.userPermissions, user.id]);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
        <div className="w-full max-w-4xl max-h-[94dvh] my-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col text-neutral-900 dark:text-white overflow-hidden">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#141414] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[8px] overflow-hidden bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                {user.profilePicturePath ? (
                  <SafeImage 
                    src={user.profilePicturePath} 
                    alt={user.displayName}
                    containerClassName="w-full h-full object-cover"
                    fallback={<LockKey className="w-5 h-5 text-purple-500" weight="bold" />}
                  />
                ) : (
                  <LockKey className="w-5 h-5 text-purple-500" weight="bold" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                    {user.displayName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold bg-neutral-200 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300">
                    {user.role}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 font-mono">
                  @{user.username} • Account-Level Read / Write Permissions Engine
                </p>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 min-w-[38px] min-h-[38px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader KPI Banner */}
          <div className="px-4 py-2.5 bg-purple-950/20 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <Sparkle className="w-4 h-4 text-purple-400" weight="bold" />
              <span className="text-neutral-700 dark:text-neutral-300 font-medium text-[11px]">
                Overrides take immediate precedence over role baseline defaults for this specific account.
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                {customOverrideStats.customGranted} Custom Allowed
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold">
                {customOverrideStats.customRevoked} Custom Denied
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-400 font-bold">
                {customOverrideStats.inherited} Inheriting Role
              </span>
            </div>
          </div>

          {/* 1-Click Module Presets (Read-Only vs Read & Write) */}
          <div className="p-3 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/70 dark:bg-[#121212] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-500" />
                Quick Module Access Presets (Read-Only vs Read & Write)
              </span>
              <button
                type="button"
                onClick={() => setShowModulePresets(!showModulePresets)}
                className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-mono cursor-pointer"
              >
                {showModulePresets ? 'Collapse Presets' : 'Expand Presets'}
              </button>
            </div>

            {showModulePresets && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MODULE_DEFINITIONS.slice(0, 6).map(mod => {
                  const currentLevel = getModuleCurrentLevel(mod);
                  return (
                    <div 
                      key={mod.module}
                      className="p-2 rounded-[8px] bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[11px] truncate text-neutral-900 dark:text-white">
                          {mod.label}
                        </p>
                        <span className={cn(
                          "text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded",
                          currentLevel === 'write' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                          currentLevel === 'read' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          currentLevel === 'none' ? "bg-neutral-200 dark:bg-[#242424] text-neutral-500" :
                          "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        )}>
                          {currentLevel === 'write' ? 'Read & Write' :
                           currentLevel === 'read' ? 'Read-Only' :
                           currentLevel === 'none' ? 'No Access' : 'Custom'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetModuleAccess(mod, 'read')}
                          title="Grant view/read access only (write actions disabled)"
                          className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer",
                            currentLevel === 'read'
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#262626]"
                          )}
                        >
                          Read-Only
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetModuleAccess(mod, 'write')}
                          title="Grant full read and write access"
                          className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer",
                            currentLevel === 'write'
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#262626]"
                          )}
                        >
                          Full Write
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetModuleAccess(mod, 'none')}
                          title="Block all access"
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer",
                            currentLevel === 'none'
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-500 hover:text-red-500"
                          )}
                        >
                          None
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="p-3 border-b border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0 bg-white dark:bg-[#0F0F0F]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search permission or action..."
                className="w-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] pl-9 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Access Type Filter: All / Read Only / Write Actions */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-[6px] border border-neutral-200 dark:border-[#262626]">
              <button
                type="button"
                onClick={() => setAccessTypeFilter('all')}
                className={cn(
                  "px-2.5 py-1 rounded-[5px] text-[10px] font-bold font-mono transition-all cursor-pointer",
                  accessTypeFilter === 'all'
                    ? "bg-white dark:bg-[#2A2A2A] text-neutral-900 dark:text-white shadow-xs font-black"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                All Capabilities
              </button>
              <button
                type="button"
                onClick={() => setAccessTypeFilter('read')}
                className={cn(
                  "px-2.5 py-1 rounded-[5px] text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer",
                  accessTypeFilter === 'read'
                    ? "bg-blue-600 text-white shadow-xs font-black"
                    : "text-neutral-500 hover:text-blue-500"
                )}
              >
                <Eye className="w-3 h-3" weight="bold" /> Read-Only
              </button>
              <button
                type="button"
                onClick={() => setAccessTypeFilter('write')}
                className={cn(
                  "px-2.5 py-1 rounded-[5px] text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer",
                  accessTypeFilter === 'write'
                    ? "bg-amber-600 text-white shadow-xs font-black"
                    : "text-neutral-500 hover:text-amber-500"
                )}
              >
                <PencilSimple className="w-3 h-3" weight="bold" /> Write Actions
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2 py-1 rounded-[6px] text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer",
                    selectedCategory === cat
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions Scrollable List */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-2.5 max-h-[calc(94dvh-280px)]">
            {filteredPermissions.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-xs font-mono">
                No permissions matching query.
              </div>
            ) : (
              filteredPermissions.map(p => {
                const roleBaseline = getRoleBaseline(p.key);
                const effective = getEffectivePermission(p.key);
                const compositeKey = `${user.id}:${p.key}`;
                const savedVal = typeof state.userPermissions[compositeKey] === 'boolean' 
                  ? state.userPermissions[compositeKey] 
                  : null;
                const currentOverride = stagedOverrides[p.key] !== undefined 
                  ? stagedOverrides[p.key] 
                  : savedVal;

                const isModified = currentOverride !== savedVal;

                return (
                  <div 
                    key={p.key}
                    className={cn(
                      "p-3.5 rounded-[8px] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      isModified 
                        ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-500/40 shadow-xs" 
                        : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    {/* Left details */}
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Access Type Badge: READ vs WRITE */}
                        {p.accessType === 'read' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                            <Eye className="w-2.5 h-2.5" weight="bold" /> READ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <PencilSimple className="w-2.5 h-2.5" weight="bold" /> WRITE
                          </span>
                        )}

                        <span className="text-xs font-bold text-neutral-900 dark:text-white">
                          {p.label}
                        </span>

                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-[#1C1C1C] px-1.5 py-0.2 rounded border border-neutral-200 dark:border-[#262626]">
                          {p.key}
                        </span>

                        {/* Effective State Badge */}
                        <span className={cn(
                          "px-2 py-0.5 rounded-[6px] text-[9px] font-mono font-bold uppercase",
                          effective.isGranted 
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        )}>
                          {effective.isGranted ? 'Allowed' : 'Denied'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {p.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                        <span>Role Default: <strong>{roleBaseline ? 'Granted' : 'Denied'}</strong></span>
                        {currentOverride !== null && currentOverride !== undefined && (
                          <span className="text-purple-600 dark:text-purple-400 font-bold">
                            • Custom Override ({currentOverride ? 'Granted' : 'Denied'})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right 3-Way Segmented Control */}
                    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] p-1 rounded-[8px] border border-neutral-200 dark:border-[#262626] shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                      {/* 1. Inherit */}
                      <button
                        type="button"
                        onClick={() => handleSetOverride(p.key, null)}
                        className={cn(
                          "flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all cursor-pointer text-center active:scale-95 touch-manipulation",
                          (currentOverride === null || currentOverride === undefined)
                            ? "bg-white dark:bg-[#2A2A2A] text-neutral-900 dark:text-white shadow-xs border border-neutral-300 dark:border-neutral-700"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        )}
                        title={`Inherit baseline (${roleBaseline ? 'Granted' : 'Denied'})`}
                      >
                        Inherit
                      </button>

                      {/* 2. Allow (Grant) */}
                      <button
                        type="button"
                        onClick={() => handleSetOverride(p.key, true)}
                        className={cn(
                          "flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                          currentOverride === true
                            ? "bg-emerald-600 text-white shadow-xs font-black"
                            : "text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        )}
                      >
                        <Check className="w-3 h-3" weight="bold" /> Allow
                      </button>

                      {/* 3. Deny (Revoke) */}
                      <button
                        type="button"
                        onClick={() => handleSetOverride(p.key, false)}
                        className={cn(
                          "flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-[6px] text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                          currentOverride === false
                            ? "bg-red-600 text-white shadow-xs font-black"
                            : "text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                        )}
                      >
                        <X className="w-3 h-3" weight="bold" /> Deny
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetAllToRoleDefaults}
              className="text-xs text-neutral-500 hover:text-red-500 font-mono font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <ArrowCounterClockwise className="w-4 h-4" />
              <span>Reset All to Role Defaults</span>
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 min-h-[42px] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-800 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs rounded-[8px] hover:bg-neutral-300 dark:hover:bg-[#262626] cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || modifiedCount === 0}
                className="flex-1 sm:flex-none px-4 py-2 min-h-[42px] bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation"
              >
                <FloppyDisk className="w-4 h-4" weight="bold" />
                <span>{isSaving ? 'Saving...' : `Save Access (${modifiedCount} changes)`}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </Portal>
  );
}
