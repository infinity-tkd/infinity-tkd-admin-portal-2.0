'use client';

import React from 'react';
import { SegmentErrorFallback } from '@/components/errors/SegmentErrorFallback';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentErrorFallback error={error} reset={reset} sectionName="Settings & Configurations" />;
}
