'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { EligibilityAll } from '@/lib/belt-test-contract';
import { useBeltTestView } from './use-belt-tests';

const EMPTY: EligibilityAll['entries'] = {};

/**
 * Belt Tests eligibility for every student whose next belt has a published
 * syllabus. Staff without grading permission get an empty map, and callers
 * fall back to the original readiness report.
 */
export function useBeltEligibility() {
  const { state, can } = useAppStore();
  const allowed = can('action:evaluations_grade');
  const view = useBeltTestView<EligibilityAll>(allowed ? { view: 'eligibility_all' } : null);
  // Attendance, grades and promotions change eligibility; refetch when they change.
  const signature = `${state.attendanceRecords.length}:${state.physicalEvaluations.length}:${state.beltHistories.length}:${state.students.length}:${state.videoProgress.length}`;
  const previous = useRef(signature);
  const { refresh } = view;
  useEffect(() => {
    if (previous.current === signature) return;
    previous.current = signature;
    const timer = setTimeout(() => void refresh(), 800);
    return () => clearTimeout(timer);
  }, [signature, refresh]);
  // An unexpected response leaves the original readiness in place rather than breaking the page.
  const entries = view.data?.entries && typeof view.data.entries === 'object' && !Array.isArray(view.data.entries) ? view.data.entries : EMPTY;
  return { entries, loaded: !!view.data, error: view.error };
}
