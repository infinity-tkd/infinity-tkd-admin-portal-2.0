'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { CheckSquare } from '@phosphor-icons/react/dist/csr/CheckSquare';
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { Calendar } from '@phosphor-icons/react/dist/csr/Calendar';
import { Gear } from '@phosphor-icons/react/dist/csr/Gear';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { ShoppingBag } from '@phosphor-icons/react/dist/csr/ShoppingBag';
import { Handshake } from '@phosphor-icons/react/dist/csr/Handshake';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginView } from './LoginView';
import { AccountSecurityPanel } from './AccountSecurityPanel';
import { SafeImage } from '@/components/SafeImage';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

import { BirthdayWishModal } from '@/components/BirthdayWishModal';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';
import { PwaDiagnosticsModal } from '@/components/pwa/PwaDiagnosticsModal';
import layoutStyles from './PortalLayout.module.css';
import { PageTransition } from './PageTransition';
import { DataLoadNotice } from './DataLoadNotice';
import { usePortalScroll } from '@/hooks/use-portal-scroll';
import { panelTransition } from '@/lib/motion';
import { PORTAL_COMPACT_MEDIA } from '@/lib/navigation';
import { useNetworkStatus } from '@/components/providers/NetworkStatusProvider';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { state, logout, can } = useAppStore();
  const { isSyncing, queuedCount } = useNetworkStatus();
  const t = useT();
  const pathname = usePathname() || '/dashboard';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showStatusToast, setShowStatusToast] = useState<'none' | 'online' | 'offline'>('none');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const { containerRef: scrollContainerRef, progressRef, onScroll: handleScroll, isNavVisible, isCompactNavigation, showScrollTop, revealNavigation, scrollToTop } = usePortalScroll(pathname, sidebarOpen, !state.isLoading && !!state.currentUser);
  const sidebarRef = React.useRef<HTMLElement>(null);
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Client-side online/offline network event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    let timer: NodeJS.Timeout;

    const handleOnline = () => {
      setIsOnline(true);
      setShowStatusToast('online');
      clearTimeout(timer);
      timer = setTimeout(() => setShowStatusToast('none'), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatusToast('offline');
      clearTimeout(timer);
      timer = setTimeout(() => setShowStatusToast('none'), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, []);

  // Client-side unauthorized guest redirect guard
  useEffect(() => {
    if (!state.isLoading && !state.currentUser && pathname !== '/') {
      router.push('/');
    }
  }, [state.isLoading, state.currentUser, pathname, router]);

  // Mobile drawers own focus while open; hidden navigation cannot receive Tab.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const media = window.matchMedia(PORTAL_COMPACT_MEDIA);
    const sync = () => {
      sidebar.inert = media.matches && !sidebarOpen;
      if (!media.matches) { setSidebarOpen(false); revealNavigation(); }
    };
    sync();
    media.addEventListener('change', sync);
    if (!sidebarOpen || !media.matches) return () => media.removeEventListener('change', sync);
    const previousFocus = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    controls()[0]?.focus({ preventScroll: true });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setSidebarOpen(false); }
      if (e.key === 'Tab') {
        const items = controls();
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      media.removeEventListener('change', sync);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [sidebarOpen, state.isLoading, state.currentUser?.id, revealNavigation]);

  // Secure Auth Guard: if user is not logged in and not loading, block access and render Login
  if (state.isLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white text-neutral-900 dark:bg-[#0A0A0A] dark:text-[#E4E4E4] font-sans selection:bg-red-500/30 relative overflow-hidden">
        {/* Background radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="flex flex-col items-center space-y-6 relative z-10">
          <div className="w-14 h-14 relative flex items-center justify-center">
            <img 
              src="/icons/logo.svg" 
              alt="Infinity Logo" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(239,47,56,0.35)] animate-pulse" 
            />
          </div>

          <div className="flex flex-col items-center space-y-1 text-center">
            <h1 className="text-[10px] font-black tracking-[0.25em] text-white uppercase leading-none">INFINITY TKD</h1>
            <p className="text-[8px] text-[#EF2F38] tracking-[0.18em] uppercase font-mono animate-pulse mt-1">Synchronizing Database...</p>
          </div>

          {/* Premium Linear Shimmer Loading Tracker */}
          <div className="w-32 bg-[#141414] h-[2px] rounded-full overflow-hidden border border-[#262626] relative">
            <div className="bg-[#EF2F38] h-full rounded-full w-1/2 absolute left-0 top-0 animate-shimmer" />
          </div>
        </div>

      </div>
    );
  }

  if (!state.currentUser) {
    return <LoginView />;
  }

  const tabs = [
    { id: 'dashboard', href: '/dashboard', icon: GraduationCap, label: t('nav_dashboard') },
    { id: 'directory', href: '/students', icon: Users, label: t('nav_students') },
    { id: 'staff', href: '/members', icon: UserCircle, label: t('nav_members') },
    { id: 'attendance', href: '/attendance', icon: CheckSquare, label: t('nav_attendance') },
    { id: 'financials', href: '/financials', icon: CreditCard, label: t('nav_financials') },
    { id: 'pos', href: '/pos', icon: ShoppingBag, label: t('nav_pos') },
    { id: 'lms', href: '/lms', icon: VideoCamera, label: t('nav_lms') },
    { id: 'library', href: '/library', icon: BookOpen, label: t('nav_library') },
    { id: 'schedule', href: '/schedule', icon: Calendar, label: t('nav_schedule') },
    { id: 'partners', href: '/partners', icon: Handshake, label: t('nav_partners') },
    { id: 'settings', href: '/settings', icon: Gear, label: t('nav_settings') },
  ] as const;

  // Dynamic RBAC checks powered by System Owner Access Matrix
  const canViewDashboard = can('page:dashboard');
  const canViewFinancials = can('page:financials');
  const canViewPOS = can('page:pos');
  const canViewStaff = can('page:staff');
  const canViewSchedule = can('page:schedule');
  const canViewDirectory = can('page:directory');
  const canViewAttendance = can('page:attendance');
  const canViewPartners = can('page:partners');
  const canViewSettings = can('page:settings');
  const canViewLms = can('page:lms');
  const canViewLibrary = can('page:library');

  const visibleTabs = tabs.filter(tItem => {
    if (tItem.id === 'dashboard' && !canViewDashboard) return false;
    if (tItem.id === 'financials' && !canViewFinancials) return false;
    if (tItem.id === 'pos' && !canViewPOS) return false;
    if (tItem.id === 'staff' && !canViewStaff) return false;
    if (tItem.id === 'schedule' && !canViewSchedule) return false;
    if (tItem.id === 'directory' && !canViewDirectory) return false;
    if (tItem.id === 'attendance' && !canViewAttendance) return false;
    if (tItem.id === 'partners' && !canViewPartners) return false;
    if (tItem.id === 'settings' && !canViewSettings) return false;
    if (tItem.id === 'lms' && !canViewLms) return false;
    if (tItem.id === 'library' && !canViewLibrary) return false;
    return true;
  });

  // Access check for active route
  let isAuthorized = true;
  if (pathname.startsWith('/dashboard') && !canViewDashboard) isAuthorized = false;
  if (pathname.startsWith('/financials') && !canViewFinancials) isAuthorized = false;
  if ((pathname.startsWith('/pos') || pathname.startsWith('/pro-shop')) && !canViewPOS) isAuthorized = false;
  if (pathname.startsWith('/members') && !canViewStaff) isAuthorized = false;
  if (pathname.startsWith('/schedule') && !canViewSchedule) isAuthorized = false;
  if (pathname.startsWith('/students') && !canViewDirectory) isAuthorized = false;
  if (pathname.startsWith('/attendance') && !canViewAttendance) isAuthorized = false;
  if (pathname.startsWith('/partners') && !canViewPartners) isAuthorized = false;
  if (pathname.startsWith('/settings') && !canViewSettings) isAuthorized = false;
  if (pathname.startsWith('/lms') && !canViewLms) isAuthorized = false;
  if (pathname.startsWith('/library') && !canViewLibrary) isAuthorized = false;

  // Calculate current page title
  const activeTab = pathname === '/profile' ? { label: 'My account' } : tabs.find(tItem => pathname === tItem.href || pathname.startsWith(tItem.href + '/')) || (pathname.startsWith('/pro-shop') ? tabs.find(t => t.id === 'pos') : undefined) || tabs[0];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div data-portal-shell data-navigation-visible={isNavVisible} className={cn(layoutStyles.shell, "flex h-dvh w-full overflow-hidden bg-white text-neutral-900 dark:bg-[#0A0A0A] dark:text-[#E4E4E4] font-sans selection:bg-red-500/30")}>
      {/* Mobile Sidebar Overlay */}
      <div aria-hidden="true" data-open={sidebarOpen} onClick={() => setSidebarOpen(false)}
        className={cn(layoutStyles.drawerOverlay, "fixed inset-0 bg-black/50")}
      />

      {/* Sidebar Drawer */}
      <aside ref={sidebarRef} aria-label="Main navigation" data-open={sidebarOpen} className={cn(layoutStyles.sidebar, "inset-y-0 left-0 w-60 bg-white dark:bg-[#0f0f0f] border-r border-neutral-200 dark:border-[#262626] flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)]")}>
        <div className="p-6 border-b border-neutral-200 dark:border-[#262626] flex items-center gap-3">
          <div className="w-10 h-10 bg-transparent flex items-center justify-center shrink-0">
            <img 
              src="/icons/logo.svg" 
              alt="Infinity TKD Logo" 
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(239,47,56,0.3)]" 
            />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest text-neutral-900 dark:text-white leading-none">INFINITY</h1>
            <p className="text-[10px] font-bold text-red-600 dark:text-[#EF2F38] uppercase tracking-tighter mt-1">{t('nav_admin_portal')}</p>
          </div>
          <button type="button" aria-label="Close Navigation Menu" onClick={() => setSidebarOpen(false)} className={cn(layoutStyles.compactOnly, "ml-auto min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-300")}>×</button>
        </div>

        <nav aria-label="Portal navigation" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleTabs.map(tItem => {
            const isActive = pathname === tItem.href || pathname.startsWith(tItem.href + '/');
            return (
              <Link key={tItem.id} href={tItem.href} aria-current={isActive ? 'page' : undefined} onClick={() => setSidebarOpen(false)}
                className={cn(
                  "w-full min-h-11 flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-900 dark:text-white font-bold" 
                    : "text-neutral-600 dark:text-[#999] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <tItem.icon className="w-5 h-5 opacity-70"/>
                {tItem.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200 dark:border-[#262626] space-y-3">
          <Link href="/profile" aria-label="Open my account" className="flex items-center gap-3 mb-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            <SafeImage 
              src={state.currentUser?.profilePicturePath} 
              alt={state.currentUser?.displayName} 
              containerClassName="w-9 h-9 rounded-[8px] bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
              fallback={<UserCircle className="w-5 h-5 text-neutral-500 dark:text-[#888]"/>}
            />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{state.currentUser?.displayName}</p>
              <p className="text-[10px] font-black text-red-600 dark:text-[#EF2F38] truncate uppercase mt-0.5">{state.currentUser?.role}</p>
            </div>
          </Link>
          <button 
            onClick={handleLogout} 
            className="w-full min-h-[44px] flex items-center justify-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-[8px] transition-all cursor-pointer border border-neutral-300 dark:border-[#262626] bg-neutral-100 hover:bg-red-600 hover:text-white hover:border-red-600 dark:bg-[#141414] text-neutral-800 dark:text-neutral-200 dark:hover:bg-red-600 dark:hover:text-white dark:hover:border-red-600 shadow-xs active:scale-[0.98]"
          >
            <SignOut className="w-4 h-4 shrink-0" weight="bold"/>
            <span>{t('nav_sign_out')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 min-h-0 flex-1 flex flex-col h-full overflow-hidden relative">
        <header data-portal-header data-portal-navigation data-visible={isNavVisible} inert={!isNavVisible && isCompactNavigation} onFocusCapture={revealNavigation} className={cn(layoutStyles.header,
          "border-b border-neutral-200 dark:border-[#262626] bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md flex items-center justify-between pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] shrink-0"
        )}>
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <button 
              onClick={() => setSidebarOpen(true)}
              className={cn(layoutStyles.compactOnly, "p-2 rounded-[8px] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors min-h-[44px] min-w-[44px] items-center justify-center cursor-pointer")}
              aria-label="Open Navigation Menu"
            >
              <List className="w-6 h-6"/>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img 
                src="/icons/logo.svg" 
                alt="Infinity Logo" 
                className={cn(layoutStyles.compactOnly, "w-6 h-6 object-contain filter drop-shadow-[0_1px_4px_rgba(239,47,56,0.3)]")} 
              />
              <h2 className="truncate text-xs sm:text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] font-sans">
                {activeTab ? activeTab.label : t('nav_dashboard')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            {isOnline ? (
              <button 
                type="button"
                onClick={() => setShowDiagnostics(true)}
                title="PWA & Offline Diagnostics"
                aria-label="Open PWA and offline diagnostics"
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 dark:border-green-500/20 px-2.5 py-1 rounded-[8px] text-emerald-700 dark:text-green-400 cursor-pointer transition-colors active:scale-95"
              >
                <span className="relative flex h-1.5 w-1.5">
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600 dark:bg-green-500"></span>
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest hidden sm:inline">Sync: Cloud Online</span>
                <span className="text-[9px] uppercase font-bold tracking-widest sm:hidden">Online</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setShowDiagnostics(true)}
                title="PWA & Offline Diagnostics"
                aria-label="Open PWA and offline diagnostics"
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-[8px] text-amber-800 dark:text-amber-400 cursor-pointer transition-colors active:scale-95"
              >
                <span className="relative flex h-1.5 w-1.5">
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600 dark:bg-amber-500"></span>
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest hidden sm:inline">Sync: Offline Cache</span>
                <span className="text-[9px] uppercase font-bold tracking-widest sm:hidden">Offline</span>
              </button>
            )}
          </div>

          {/* Subtle Hairline Scroll Progress Indicator */}
          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-neutral-200/40 dark:bg-white/5 pointer-events-none overflow-hidden">
            <div 
              ref={progressRef}
              data-scroll-progress
              className="h-full bg-[#EF2F38] origin-left"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </header>

        <div 
          ref={scrollContainerRef}
          data-portal-scroll
          onScrollCapture={handleScroll}
          className={cn(layoutStyles.scrollContainer, "flex-1 overflow-y-auto overscroll-contain pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.25rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.25rem,env(safe-area-inset-right,0px))] md:pl-[max(1.5rem,env(safe-area-inset-left,0px))] md:pr-[max(1.5rem,env(safe-area-inset-right,0px))] xl:px-8 space-y-6")}
        >
          <PageTransition identity={pathname} className="w-full max-w-[1600px] mx-auto min-h-full">
            <DataLoadNotice />
            {state.currentUser?.mustChangePassword ? (<><div role="alert" className="mb-4 rounded-lg border border-amber-500 p-4">Change your temporary password to activate portal access.</div><AccountSecurityPanel /></>) : isAuthorized ? (
              children
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 relative">
                {/* Radial glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,47,56,0.03)_0%,transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-md bg-white dark:bg-[#0f0f0f] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl">
                  <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-[#EF2F38] rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6V9m0-6H6.22C4.52 3 3.12 4.3 3.02 6.02L2.52 14.7c-.1 1.7 1.25 3.3 2.98 3.3H18.5c1.73 0 3.08-1.6 2.98-3.3l-.5-8.68c-.1-1.72-1.5-3.02-3.2-3.02H12z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black tracking-widest text-neutral-900 dark:text-white uppercase mb-2">Access Restricted</h3>
                  <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed mb-6 font-mono">
                    Your account system role does not have permission to view this section. Please contact an administrator if you believe this is an error.
                  </p>
                  <Link
                    href="/dashboard"
                    className="px-6 py-3 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors shadow-lg shadow-red-950/40 min-h-[44px] flex items-center justify-center active:scale-95 touch-manipulation"
                  >
                    Return to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </PageTransition>
        </div>

        {/* Mobile & Tablet Native Bottom Navigation Bar */}
        <nav aria-label="Quick navigation" data-portal-bottom-nav data-portal-navigation data-visible={isNavVisible} inert={!isNavVisible && isCompactNavigation} onFocusCapture={revealNavigation} className={cn(layoutStyles.bottomNav,
          "bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.25)] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] items-center justify-around"
        )}>
          {visibleTabs.slice(0, 5).map(tItem => {
            const isActive = pathname === tItem.href || pathname.startsWith(tItem.href + '/');
            return (
              <Link 
                key={tItem.id} 
                href={tItem.href} 
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "relative flex-1 min-w-0 max-w-24 flex flex-col items-center justify-center py-1 px-1 rounded-[8px] text-[10px] font-bold tracking-tight transition-colors min-h-[48px] touch-manipulation",
                  isActive 
                    ? "text-[#EF2F38] font-black" 
                    : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                )}
              >
                {isActive && (
                  <span className="absolute -top-1.5 w-6 h-0.5 bg-[#EF2F38] rounded-full" />
                )}
                <tItem.icon className={cn("w-5 h-5 mb-0.5", isActive ? "text-[#EF2F38]" : "opacity-70")} />
                <span className="truncate max-w-full">{tItem.label}</span>
              </Link>
            );
          })}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="flex-1 min-w-0 max-w-24 flex flex-col items-center justify-center py-1 px-1 rounded-[8px] text-[10px] font-bold text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white transition-colors min-h-[48px] touch-manipulation cursor-pointer"
            aria-label="Open More Navigation Menu"
          >
            <List className="w-5 h-5 mb-0.5 opacity-70" />
            <span>More</span>
          </button>
        </nav>
      </main>

      {/* Tactile Quick-Elevate (Scroll to Top) Floating Controller */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            onClick={scrollToTop}
            className={cn(
              "fixed right-4 sm:right-6 z-40 p-2.5 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-[#141414]/95 border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white shadow-xl hover:bg-[#EF2F38] hover:text-white hover:border-[#EF2F38] dark:hover:bg-[#EF2F38] dark:hover:text-white dark:hover:border-[#EF2F38] transition-all cursor-pointer backdrop-blur-md flex items-center justify-center active:scale-90 touch-manipulation group",
              layoutStyles.floatingControl
            )}
            title="Scroll to Top"
            aria-label="Scroll to top of page"
          >
            <CaretUp className="w-4 h-4 font-bold group-hover:-translate-y-0.5 transition-transform" weight="bold" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Global Modals */}
      <BirthdayWishModal />
      <SessionTimeoutModal />
      <PwaDiagnosticsModal isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} />

      {/* Floating Connectivity Status Toast Notification */}
      <AnimatePresence>
        {showStatusToast !== 'none' && !isSyncing && !(showStatusToast === 'offline' && queuedCount > 0) && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={panelTransition}
            className={cn(
              "fixed right-4 sm:right-6 max-w-[calc(100vw-2rem)] pointer-events-none px-4 py-3 rounded-[8px] shadow-2xl border flex items-center gap-3 backdrop-blur-md",
              layoutStyles.floatingNotice,
              showStatusToast === 'online'
                ? "bg-green-950/80 border-green-500/30 text-green-300"
                : "bg-amber-950/80 border-amber-500/30 text-amber-300"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                showStatusToast === 'online' ? "bg-green-500" : "bg-amber-500"
              )}></span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                {showStatusToast === 'online' ? 'Connection restored' : 'Connection offline'}
              </span>
              <span className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                {showStatusToast === 'online' 
                  ? 'Connection restored. Check any interrupted save before retrying.' 
                  : 'Reconnect before saving. Check uncertain saves before retrying.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Datalists for Comboboxes */}
      <datalist id="nationalities">
        <option value="Cambodian" />
        <option value="American" />
        <option value="Australian" />
        <option value="British" />
        <option value="Canadian" />
        <option value="Chinese" />
        <option value="Filipino" />
        <option value="French" />
        <option value="German" />
        <option value="Indian" />
        <option value="Indonesian" />
        <option value="Japanese" />
        <option value="Korean" />
        <option value="Malaysian" />
        <option value="Singaporean" />
        <option value="Thai" />
        <option value="Vietnamese" />
      </datalist>
    </div>
  );
}
