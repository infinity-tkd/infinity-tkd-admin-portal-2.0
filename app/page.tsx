'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { LoginView } from '@/components/LoginView';

export default function RootPage() {
  const { state } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (state.currentUser && !state.isLoading) {
      if (state.currentUser.role === 'Student') {
        router.push('/lms');
      } else {
        router.push('/dashboard');
      }
    }
  }, [state.currentUser, state.isLoading, router]);

  if (state.isLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] font-sans selection:bg-red-500/30 relative overflow-hidden">
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
            <p className="text-[8px] text-[#EF2F38] tracking-[0.18em] uppercase font-mono animate-pulse mt-1">Initializing Secure Portal...</p>
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

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] font-sans selection:bg-red-500/30 relative overflow-hidden">
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
          <p className="text-[8px] text-green-500 tracking-[0.18em] uppercase font-mono animate-pulse mt-1">Establishing Native Session...</p>
        </div>

        {/* Premium Linear Shimmer Loading Tracker */}
        <div className="w-32 bg-[#141414] h-[2px] rounded-full overflow-hidden border border-[#262626] relative">
          <div className="bg-green-500 h-full rounded-full w-1/2 absolute left-0 top-0 animate-[shimmer_1.4s_infinite_ease-in-out]" />
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
