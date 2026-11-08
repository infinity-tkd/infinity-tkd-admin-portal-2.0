'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BELT_ORDER, normalizeBeltOrder } from '@/lib/belts';

// The belts table is small and academy-wide, so one read serves every screen in the session.
let cached: readonly string[] | null = null;
let pending: Promise<readonly string[] | null> | null = null;

function loadBeltOrder(): Promise<readonly string[] | null> {
  pending ??= Promise.resolve(supabase.from('belts').select('belt_name,belt_order').order('belt_order'))
    .then(({ data, error }) => {
      // An empty answer (e.g. before the session is ready) is not cached, so a later screen retries.
      const names = error ? null : normalizeBeltOrder(data);
      if (names) cached = names;
      return names;
    })
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

/** Belt names from the belts table in belt_order; the built-in order until it loads or if it cannot be read. */
export function useBeltOrder(): readonly string[] {
  const [order, setOrder] = useState<readonly string[]>(() => cached ?? DEFAULT_BELT_ORDER);
  useEffect(() => {
    if (cached) return;
    let active = true;
    void loadBeltOrder().then(names => { if (active && names) setOrder(names); });
    return () => { active = false; };
  }, []);
  return order;
}
