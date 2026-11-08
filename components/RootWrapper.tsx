'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { BrandSplash } from '@/components/ui/States';

// The portal frame (navigation, notifications, install and diagnostics panels) is not needed to
// sign in, so it loads in its own chunk the first time a portal page opens. Client-only like the
// page views: server-rendered dynamic chunks are emitted without the CSP nonce and get blocked.
const PortalLayout = dynamic(() => import('@/components/PortalLayout').then(module => module.PortalLayout), {
  ssr: false,
  loading: () => <BrandSplash message="Opening the portal…" />,
});
import { DataLists } from '@/components/DataLists';
import { SystemNotificationModal } from '@/components/SystemNotificationModal';
import { SystemConfirmModal } from '@/components/SystemConfirmModal';
import { useAppStore } from '@/lib/store';
import { NetworkStatusProvider } from '@/components/providers/NetworkStatusProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { PortalMotionProvider } from '@/components/providers/PortalMotionProvider';
import { AdminMfaBoundary } from './AdminMfaBoundary';
import { PerformanceReporter } from './operations/PerformanceReporter';

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
        <AdminMfaBoundary><PerformanceReporter/>{isPlainPath ? <>{children}</> : <PortalLayout>{children}</PortalLayout>}<DataLists /></AdminMfaBoundary>
        <SystemNotificationModal />
        <SystemConfirmModal />
      </ToastProvider>
    </NetworkStatusProvider>
    </PortalMotionProvider>
  );
}
