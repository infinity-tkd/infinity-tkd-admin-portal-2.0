'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { LoginView } from '@/components/LoginView';
import { BrandSplash } from '@/components/ui/States';

export default function RootPage() {
  const { state } = useAppStore();
  const router = useRouter();
  const userId = state.currentUser?.id;
  const role = state.currentUser?.role;

  useEffect(() => {
    if (userId && !state.isLoading) {
      if (role === 'Student') {
        router.replace('/lms');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [userId, role, state.isLoading, router]);

  if (state.isLoading) return <BrandSplash message="Initializing secure portal…" />;

  if (!state.currentUser) {
    return <LoginView />;
  }

  return <BrandSplash message="Establishing native session…" tone="success" />;
}
