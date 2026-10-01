'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { List, GraduationCap, Users, CheckSquare, CreditCard, VideoCamera, Calendar, Gear, SignOut, UserCircle, BookOpen, ShoppingBag, Handshake } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginView } from './LoginView';
import { SafeImage } from '@/components/SafeImage';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import dynamic from 'next/dynamic';

import { BirthdayWishModal } from '@/components/BirthdayWishModal';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';
import { PwaDiagnosticsModal } from '@/components/pwa/PwaDiagnosticsModal';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { state, logout, can } = useAppStore();
  const t = useT();
  const pathname = usePathname() || '/dashboard';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof window !== 'undefined' ? navigator.onLine : true);
  const [showStatusToast, setShowStatusToast] = useState<'none' | 'online' | 'offline'>('none');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Scroll direction detection for auto-hiding mobile & tablet header / bottom footer menu
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollTopRef = React.useRef(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Automatically reveal navigation and reset scroll position when route changes
  useEffect(() => {
    setIsNavVisible(true);
    lastScrollTopRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [pathname]);

  // Keep navigation visible when mobile drawer sidebar is opened
  useEffect(() => {
    if (sidebarOpen) {
      setIsNavVisible(true);
    }
  }, [sidebarOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Only auto-hide navigation on mobile screens (< 768px). Tablets & desktops have ample space.
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      if (!isNavVisible) setIsNavVisible(true);
      return;
    }

    const currentScrollTop = e.currentTarget.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    const delta = currentScrollTop - lastScrollTop;
    const scrollHeight = e.currentTarget.scrollHeight;
    const clientHeight = e.currentTarget.clientHeight;

    // 1. Always reveal navigation when at or near top
    if (currentScrollTop <= 60) {
      setIsNavVisible(true);
    }
    // 2. Always reveal navigation when reaching the bottom of scroll content
    else if (scrollHeight - currentScrollTop - clientHeight <= 60) {
      setIsNavVisible(true);
    }
    // 3. Deliberate scrolling down past threshold (> 40px delta and > 100px from top)
    else if (delta > 40 && currentScrollTop > 100) {
      setIsNavVisible(false);
    }
    // 4. Scrolling up past threshold (<-25px delta) -> smoothly reveal
    else if (delta < -25) {
      setIsNavVisible(true);
    }

    lastScrollTopRef.current = currentScrollTop;
  };

  // Client-side online/offline network event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

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

  // Body scroll lock and Escape key listener when mobile sidebar drawer is open
  useEffect(() => {
    if (!sidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

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
            <div className="bg-[#EF2F38] h-full rounded-full w-1/2 absolute left-0 top-0 animate-[shimmer_1.4s_infinite_ease-in-out]" />
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { left: -50%; }
            50% { left: 100%; }
            100% { left: -50%; }
          }
        `}} />
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

  const role = state.currentUser.role;

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
  const activeTab = tabs.find(tItem => pathname === tItem.href || pathname.startsWith(tItem.href + '/')) || (pathname.startsWith('/pro-shop') ? tabs.find(t => t.id === 'pos') : undefined) || tabs[0];

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-neutral-900 dark:bg-[#0A0A0A] dark:text-[#E4E4E4] font-sans selection:bg-red-500/30">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <motion.aside className={cn("fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-60 bg-white dark:bg-[#0f0f0f] border-r border-neutral-200 dark:border-[#262626] flex flex-col transition-transform duration-300 pt-[env(safe-area-inset-top,0px)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]", !sidebarOpen && "-translate-x-full lg:translate-x-0" )}>
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
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleTabs.map(tItem => {
            const isActive = pathname === tItem.href || pathname.startsWith(tItem.href + '/');
            return (
              <Link key={tItem.id} href={tItem.href} onClick={() => setSidebarOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors",
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
          <div className="flex items-center gap-3 mb-4">
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
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full min-h-[44px] flex items-center justify-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-[8px] transition-all cursor-pointer border border-neutral-300 dark:border-[#262626] bg-neutral-100 hover:bg-red-600 hover:text-white hover:border-red-600 dark:bg-[#141414] text-neutral-800 dark:text-neutral-200 dark:hover:bg-red-600 dark:hover:text-white dark:hover:border-red-600 shadow-xs active:scale-[0.98]"
          >
            <SignOut className="w-4 h-4 shrink-0" weight="bold"/>
            <span>{t('nav_sign_out')}</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className={cn(
          "fixed lg:static top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:h-14 pt-[env(safe-area-inset-top,0px)] lg:pt-0 border-b border-neutral-200 dark:border-[#262626] bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md flex items-center justify-between px-3.5 sm:px-6 shrink-0 z-30 transition-transform duration-300 ease-in-out will-change-transform",
          !isNavVisible ? "-translate-y-full lg:translate-y-0 pointer-events-none lg:pointer-events-auto" : "translate-y-0"
        )}>
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-[8px] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <List className="w-6 h-6"/>
            </button>
            <div className="flex items-center gap-2.5">
              <img 
                src="/icons/logo.svg" 
                alt="Infinity Logo" 
                className="w-6 h-6 object-contain lg:hidden filter drop-shadow-[0_1px_4px_rgba(239,47,56,0.3)]" 
              />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] font-sans">
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
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
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-[8px] text-amber-800 dark:text-amber-400 animate-pulse cursor-pointer transition-colors active:scale-95"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600 dark:bg-amber-500"></span>
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest hidden sm:inline">Sync: Offline Cache</span>
                <span className="text-[9px] uppercase font-bold tracking-widest sm:hidden">Offline</span>
              </button>
            )}
          </div>
        </header>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-5 md:px-6 lg:px-8 pt-[calc(4.375rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:pt-[calc(5rem+env(safe-area-inset-top,0px))] lg:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 space-y-6"
        >
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="w-full max-w-[1600px] mx-auto h-full">
            {isAuthorized ? (
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
          </motion.div>
        </div>

        {/* Mobile & Tablet Native Bottom Navigation Bar */}
        <div className={cn(
          "lg:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-xl border-t border-neutral-200 dark:border-[#262626] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)] z-30 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around transition-transform duration-300 ease-in-out will-change-transform",
          !isNavVisible ? "translate-y-full pointer-events-none" : "translate-y-0"
        )}>
          {visibleTabs.slice(0, 5).map(tItem => {
            const isActive = pathname === tItem.href || pathname.startsWith(tItem.href + '/');
            return (
              <Link 
                key={tItem.id} 
                href={tItem.href} 
                className={cn(
                  "relative flex flex-col items-center justify-center py-1 px-1.5 rounded-[8px] text-[10px] font-bold tracking-tight transition-all duration-200 min-h-[48px] min-w-[54px] active:scale-95 touch-manipulation",
                  isActive 
                    ? "text-[#EF2F38] font-black" 
                    : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                )}
              >
                {isActive && (
                  <span className="absolute -top-1.5 w-6 h-0.5 bg-[#EF2F38] rounded-full" />
                )}
                <tItem.icon className={cn("w-5 h-5 mb-0.5 transition-transform duration-200", isActive ? "text-[#EF2F38] scale-110" : "opacity-70")} />
                <span className="truncate max-w-[62px]">{tItem.label}</span>
              </Link>
            );
          })}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-1.5 rounded-[8px] text-[10px] font-bold text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white transition-all duration-200 min-h-[48px] min-w-[54px] active:scale-95 touch-manipulation cursor-pointer"
            aria-label="Open More Navigation Menu"
          >
            <List className="w-5 h-5 mb-0.5 opacity-70" />
            <span>More</span>
          </button>
        </div>
      </main>

      {/* Global Modals */}
      <BirthdayWishModal />
      <SessionTimeoutModal />
      <PwaDiagnosticsModal isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} />

      {/* Floating Connectivity Status Toast Notification */}
      <AnimatePresence>
        {showStatusToast !== 'none' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              "fixed right-4 sm:right-6 z-60 px-4 py-3 rounded-[8px] shadow-2xl border flex items-center gap-3 backdrop-blur-md transition-all duration-300 ease-in-out",
              isNavVisible
                ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
                : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:bottom-6",
              showStatusToast === 'online'
                ? "bg-green-950/80 border-green-500/30 text-green-300"
                : "bg-amber-950/80 border-amber-500/30 text-amber-300"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                showStatusToast === 'online' ? "bg-green-400" : "bg-amber-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                showStatusToast === 'online' ? "bg-green-500" : "bg-amber-500"
              )}></span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                {showStatusToast === 'online' ? 'Cloud Synchronization Online' : 'Offline Cache Mode Enabled'}
              </span>
              <span className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                {showStatusToast === 'online' 
                  ? 'All changes are actively saved to Supabase.' 
                  : 'Edits are cached locally and will sync upon reconnection.'}
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
