'use client';

import { MotionConfig } from 'motion/react';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { motionTransition } from '@/lib/motion';

export function PortalMotionProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const reduced = useReducedMotionPreference();
  return <MotionConfig nonce={nonce} reducedMotion="user" skipAnimations={reduced} transition={motionTransition}>{children}</MotionConfig>;
}
