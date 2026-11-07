'use client';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { nextBelt, usageByAsset } from '@/lib/belt-test-links';
import type { BeltTestOverview, LibraryUsageView, StudentTestsView, SyllabusDetail } from '@/lib/belt-test-contract';
import { useBeltTestView } from './use-belt-tests';

/** Belt test reads are for staff with grading permission; everyone else simply sees no links. */
function useAllowed() { return useAppStore().can('action:evaluations_grade'); }
/** These panels sit inside other pages: an unexpected response must hide them, never break the page. */
const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export function useLibraryTestUsage() {
  const allowed = useAllowed();
  const view = useBeltTestView<LibraryUsageView>(allowed ? { view: 'library_usage' } : null);
  const byAsset = useMemo(() => usageByAsset(list(view.data?.usage)), [view.data]);
  return { byAsset, loaded: !!view.data };
}

/** The published syllabus for the belt after `currentBelt`, i.e. what that belt's students will be tested on. */
export function useNextBeltTest(currentBelt: string | null) {
  const allowed = useAllowed();
  const overview = useBeltTestView<BeltTestOverview>(allowed && currentBelt ? { view: 'overview' } : null);
  const belts = list<BeltTestOverview['belts'][number]>(overview.data?.belts), syllabi = list<BeltTestOverview['syllabi'][number]>(overview.data?.syllabi);
  const next = nextBelt(currentBelt, belts);
  const syllabus = syllabi.find(row => row.target_belt_id === next?.id && row.status === 'published') ?? null;
  const detail = useBeltTestView<SyllabusDetail>(syllabus ? { view: 'syllabus', id: syllabus.id } : null);
  const valid = !!detail.data && Array.isArray(detail.data.sections) && Array.isArray(detail.data.items) && !!detail.data.syllabus;
  return { next, syllabus, detail: syllabus && valid ? detail.data : null, loaded: belts.length > 0 };
}

export function useStudentBeltTests(studentId: string | null) {
  const allowed = useAllowed();
  const view = useBeltTestView<StudentTestsView>(allowed && studentId ? { view: 'student_tests', studentId } : null);
  return { tests: list<StudentTestsView['tests'][number]>(view.data?.tests), loaded: !!view.data, error: view.error, allowed };
}
