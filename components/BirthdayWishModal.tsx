'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X, Confetti } from '@phosphor-icons/react';
import { Portal } from '@/components/Portal';

export function BirthdayWishModal() {
  const { state } = useAppStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!state.currentUser || !state.currentUser.dob) return;

    const today = new Date();
    // Parse YYYY-MM-DD reliably without UTC offset shifts
    const dobParts = state.currentUser.dob.split('-');
    if (dobParts.length < 3) return;
    const dobMonth = parseInt(dobParts[1], 10);
    const dobDay = parseInt(dobParts[2], 10);
    
    // Check if it's their birthday today
    const isBirthday = (today.getMonth() + 1) === dobMonth && today.getDate() === dobDay;
    
    if (isBirthday) {
      const year = today.getFullYear();
      const storageKey = `birthday_wish_shown_${state.currentUser.id}_${year}`;
      const hasSeenToday = localStorage.getItem(storageKey);
      
      if (!hasSeenToday) {
        // Add a slight delay for better UX after login
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [state.currentUser]);

  const handleClose = () => {
    if (!state.currentUser) return;
    const year = new Date().getFullYear();
    const storageKey = `birthday_wish_shown_${state.currentUser.id}_${year}`;
    localStorage.setItem(storageKey, 'true');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <Portal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-sm bg-[#0F0F0F] border border-[#262626] rounded-[8px] shadow-2xl relative overflow-hidden flex flex-col items-center text-center p-8 max-h-[90dvh] overflow-y-auto"
            >
              {/* Confetti Background effect */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-yellow-500 rounded-full mix-blend-screen filter blur-[50px] animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-red-500 rounded-full mix-blend-screen filter blur-[50px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500 rounded-full mix-blend-screen filter blur-[50px] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              </div>

              <button 
                onClick={handleClose} 
                className="absolute top-4 right-4 p-2 text-[#666] hover:text-white bg-[#1A1A1A] hover:bg-[#262626] rounded-full transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-20 h-20 mb-6 bg-gradient-to-tr from-yellow-500 to-red-500 rounded-full p-1 shadow-[0_0_30px_rgba(239,47,56,0.3)] relative z-10">
                <div className="w-full h-full bg-[#0A0A0A] rounded-full flex items-center justify-center">
                  <span className="text-4xl">🎂</span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight mb-2 relative z-10">
                Happy Birthday!
              </h2>
              <p className="text-sm text-[#999] mb-8 relative z-10">
                Wishing you a fantastic day, <strong className="text-white">{state.currentUser?.displayName}</strong>! Thank you for being a part of the Infinity TKD team.
              </p>

              <button 
                onClick={handleClose}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-[0_4px_14px_rgba(239,47,56,0.4)] hover:shadow-[0_6px_20px_rgba(239,47,56,0.6)] relative z-10"
              >
                Thank You!
              </button>
            </motion.div>
          </div>
        </Portal>
      )}
    </AnimatePresence>
  );
}
