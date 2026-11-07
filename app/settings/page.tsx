'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const SettingsView = dynamic(() => import('@/components/SettingsView').then(mod => mod.SettingsView), {
  ssr: false,
  loading: () => <PageLoader label="Loading settings…" />,
});

export default function SettingsPage() {
  return <SettingsView />;
}