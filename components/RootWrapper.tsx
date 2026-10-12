'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PortalLayout } from '@/components/PortalLayout';
import { DataLists } from '@/components/DataLists';
import { SystemNotificationModal } from '@/components/SystemNotificationModal';
import { SystemConfirmModal } from '@/components/SystemConfirmModal';
import { useAppStore } from '@/lib/store';
import { NetworkStatusProvider } from '@/components/providers/NetworkStatusProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { PortalMotionProvider } from '@/components/providers/PortalMotionProvider';

export function RootWrapper({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const pathname = usePathname();
  const { reportError } = useAppStore();

  // Full-Auto Global Error & Promise Rejection Interceptor
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Ignore routine aborts
      if (event.reason?.name === 'AbortError') return;
      
      // Prevent browser default red crash overlay if event is cancelable
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      
      reportError(event.reason, 'Unhandled Background Exception');
    };

    const handleError = (event: ErrorEvent) => {
      // Ignore benign browser engine noise & extensions
      if (
        !event.message ||
        event.message.includes('ResizeObserver') || 
        event.message.includes('Script error') ||
        (event.filename && event.filename.includes('extension'))
      ) {
        return;
      }

      reportError(event.error || event.message, 'Runtime Exception');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [reportError]);

  // Paths that do not render the main dashboard portal wrapper (e.g. login screen)
  const isPlainPath = pathname === '/' || pathname === '/login';

  return (
    <PortalMotionProvider nonce={nonce}>
    <NetworkStatusProvider showConnectionBanners={isPlainPath}>
      <ToastProvider>
        {isPlainPath ? <>{children}</> : <PortalLayout>{children}</PortalLayout>}
        <DataLists />
        <SystemNotificationModal />
        <SystemConfirmModal />
      </ToastProvider>
    </NetworkStatusProvider>
    </PortalMotionProvider>
  );
}
