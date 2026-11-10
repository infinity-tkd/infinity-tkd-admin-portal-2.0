'use client';
import { useCallback, useEffect, useState } from 'react';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { Fire } from '@phosphor-icons/react/dist/csr/Fire';
import { Shield } from '@phosphor-icons/react/dist/csr/Shield';
import { Stack } from '@phosphor-icons/react/dist/csr/Stack';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Medal } from '@phosphor-icons/react/dist/csr/Medal';
import { Scroll } from '@phosphor-icons/react/dist/csr/Scroll';
import { Target } from '@phosphor-icons/react/dist/csr/Target';
import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { MusicNotes } from '@phosphor-icons/react/dist/csr/MusicNotes';
import { Hand } from '@phosphor-icons/react/dist/csr/Hand';
import { Footprints } from '@phosphor-icons/react/dist/csr/Footprints';
import { Brain } from '@phosphor-icons/react/dist/csr/Brain';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Star } from '@phosphor-icons/react/dist/csr/Star';
import { portalRequest } from '@/lib/portal-api';
import type { LibraryCategory } from '@/lib/library-content';

const ICONS = { BookOpen, Lightning, Fire, Shield, Stack, Sparkle, Medal, Scroll, Target, Barbell, MusicNotes, Hand, Footprints, Brain, Users, Star } as const;

/** The icon staff chose for a category (Library → Categories). */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? BookOpen;
  return <Icon aria-hidden="true" weight="bold" className={className} />;
}

/** Library categories from the admin API; `enabled` lets pages skip the request. */
export function useLibraryCategories(enabled = true) {
  const [categories, setCategories] = useState<LibraryCategory[] | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try { setCategories((await portalRequest<{ categories: LibraryCategory[] }>('/api/admin/library-categories')).categories); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Library categories could not load.'); }
  }, []);
  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  return { categories, error, reload };
}
