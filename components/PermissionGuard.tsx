'use client';

import React, { ReactNode } from 'react';
import { useAppStore } from '@/lib/store';
import { PermissionKey, hasPermission } from '@/lib/security';
import { ShieldWarning } from '@phosphor-icons/react';

interface PermissionGuardProps {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
  showAccessDeniedBanner?: boolean;
}

/**
 * Component-level Least Privilege Permission Guard
 * Wraps sensitive actions, buttons, or views and ensures
 * unauthorized roles cannot see or interact with privileged UI.
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
  showAccessDeniedBanner = false,
}: PermissionGuardProps) {
  const { state } = useAppStore();
  const userRole = state.currentUser?.role;

  const isAuthorized = hasPermission(userRole, permission);

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showAccessDeniedBanner) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[8px] text-center my-4">
        <ShieldWarning className="w-8 h-8 text-[#EF2F38] mx-auto mb-2" />
        <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider">Access Restricted</h4>
        <p className="text-xs text-neutral-400 mt-1">
          Your role ({userRole || 'Guest'}) does not have permission to access this module.
        </p>
      </div>
    );
  }

  return null;
}
