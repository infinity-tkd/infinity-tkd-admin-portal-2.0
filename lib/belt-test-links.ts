import type { LibraryUsage, StudentTestRow } from './belt-test-contract';

/** Same normalisation as public.portal_belt_key: "White Belt" = "White", "Black 1st Dan" = "1st Poom/Dan". */
export function beltKey(name: string | null | undefined): string | null {
  const text = (name ?? '').toLowerCase().replace(/belt/g, '').replace(/[^a-z0-9]/g, '');
  if (['white', 'yellow', 'green', 'blue', 'brown', 'red'].includes(text)) return text;
  const degree = text.match(/^(?:black)?([1-9])(?:st|nd|rd|th)?(?:poomdan|dan|poom)(?:black)?$/);
  return degree ? 'dan-' + degree[1] : text || null;
}

/** The belt after `current` in the academy's belt order, or null at the top. */
export function nextBelt<B extends { belt_name: string; belt_order: number }>(current: string | null | undefined, belts: readonly B[]): B | null {
  const key = beltKey(current);
  const own = belts.find(belt => beltKey(belt.belt_name) === key);
  return own ? belts.find(belt => belt.belt_order === own.belt_order + 1) ?? null : null;
}

/** Library lessons referenced by draft or published syllabi; published first. */
export function libraryUsageRows(
  syllabi: readonly { id: string; target_belt_id: number; track: 'color' | 'kukkiwon'; status: string; version: number }[],
  sections: readonly { id: string; syllabus_id: string; title: string }[],
  items: readonly { section_id: string; title: string; library_asset_id: number | null }[],
  belts: readonly { id: number; belt_name: string }[],
): LibraryUsage[] {
  const syllabusById = new Map(syllabi.map(row => [row.id, row]));
  const sectionById = new Map(sections.map(row => [row.id, row]));
  const beltName = new Map(belts.map(row => [row.id, row.belt_name]));
  const rows: LibraryUsage[] = [];
  for (const item of items) {
    if (item.library_asset_id == null) continue;
    const section = sectionById.get(item.section_id); const syllabus = section && syllabusById.get(section.syllabus_id);
    if (!section || !syllabus || (syllabus.status !== 'draft' && syllabus.status !== 'published')) continue;
    rows.push({ libraryAssetId: item.library_asset_id, syllabusId: syllabus.id, targetBelt: beltName.get(syllabus.target_belt_id) ?? 'Belt ' + syllabus.target_belt_id,
      track: syllabus.track, status: syllabus.status, version: syllabus.version, section: section.title, item: item.title });
  }
  return rows.sort((a, b) => (a.status === b.status ? 0 : a.status === 'published' ? -1 : 1) || a.targetBelt.localeCompare(b.targetBelt));
}

export function usageByAsset(usage: readonly LibraryUsage[]): Map<number, LibraryUsage[]> {
  const map = new Map<number, LibraryUsage[]>();
  for (const row of usage) map.set(row.libraryAssetId, [...(map.get(row.libraryAssetId) ?? []), row]);
  return map;
}

/** Deleting a lesson a published test relies on would leave students a dead link and could make its lesson rule unmeetable. */
export function lessonDeletionBlock(usage: readonly LibraryUsage[] | undefined): string | null {
  const published = (usage ?? []).filter(row => row.status === 'published');
  if (!published.length) return null;
  const tests = [...new Set(published.map(row => row.targetBelt))].join(', ');
  return `This lesson is part of the published ${tests} belt test syllabus. Publish a new syllabus version without it in Belt Tests before deleting it.`;
}

export function lessonUsageNote(usage: readonly LibraryUsage[] | undefined): string | null {
  const drafts = (usage ?? []).filter(row => row.status === 'draft');
  return drafts.length ? `It is also used in the draft ${[...new Set(drafts.map(row => row.targetBelt))].join(', ')} belt test syllabus; that draft keeps the name only.` : null;
}

/** Staff view of one student's structured belt tests, newest first. */
export function studentTestRows(rows: readonly Record<string, any>[]): StudentTestRow[] {
  return rows.map(row => {
    const event = row.grading_events ?? {};
    const finalized = ['finalized', 'promoted'].includes(row.status);
    return {
      candidateId: row.id, eventId: row.event_id, title: event.title ?? '', kind: event.kind === 'kukkiwon' ? 'kukkiwon' as const : 'color' as const,
      examDate: event.exam_date ?? '', targetBelt: event.belts?.belt_name ?? '', status: row.status, result: finalized ? row.result ?? null : null,
      overallPercent: finalized && row.overall_percent != null ? Number(row.overall_percent) : null,
      sections: finalized && Array.isArray(row.section_results) ? row.section_results.map((section: any) => ({ title: String(section.title ?? ''), percent: Number(section.percent ?? 0), grade: String(section.grade ?? ''), met: !!section.met })) : [],
      resultsPublished: !!event.results_published_at, poomOrDan: row.poom_or_dan ?? null, certificateNo: row.certificate_no ?? null, cancelled: !!event.cancelled_at,
    };
  }).sort((a, b) => b.examDate.localeCompare(a.examDate));
}
