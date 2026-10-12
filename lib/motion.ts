import type { HTMLMotionProps, Transition } from 'motion/react';

export const motionTransition: Transition = {
  type: 'tween',
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

export const panelTransition: Transition = { ...motionTransition, duration: 0.22 };

export const dialogMotion: HTMLMotionProps<'div'> = {
  initial: { opacity: 0, scale: 0.985, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.985, y: 4, transition: { duration: 0.12 } },
};
