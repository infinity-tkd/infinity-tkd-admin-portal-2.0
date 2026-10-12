'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, ReactNode } from 'react';

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
