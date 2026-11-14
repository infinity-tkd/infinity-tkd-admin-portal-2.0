import type { KeyboardEvent } from 'react';

/**
 * Props that make a clickable card, row or drop zone usable without a mouse: it becomes focusable, is announced as a button
 * (pressed or not, for a selectable choice) and is activated by Enter or Space. Use a real <button> where the markup allows;
 * this is for a container that holds other content and cannot be one.
 */
export function pressable(onActivate: () => void, pressed?: boolean) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    ...(pressed === undefined ? {} : { 'aria-pressed': pressed }),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // Keys typed into a field or pressed on a nested control are not activations of the container.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onActivate(); }
    },
  };
}
