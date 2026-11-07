/**
 * Belt test scoring. Mirrors public.portal_belt_test_compute (SQL is the
 * authority for finalized results; this powers the live score-sheet preview).
 *
 * - Item: 0–10, one decimal.
 * - Section % = weighted average of its item scores × 10, rounded to 2 dp.
 * - Overall % = Σ(section % × section weight) / 100, rounded to 2 dp.
 * - Result: pending (not all items scored) · fail (overall < pass mark) ·
 *   retest (a section below its minimum, or a critical item below the critical
 *   minimum) · distinction (overall ≥ distinction mark) · pass.
 */
export type SectionKind = 'physical' | 'skill' | 'poomsae' | 'acrobatics' | 'custom';
export type BeltTestOutcome = 'pending' | 'distinction' | 'pass' | 'retest' | 'fail';
export type BeltTestTrack = 'color' | 'kukkiwon';

export interface ScoringItem { id: string; weight: number; critical: boolean }
export interface ScoringSection { id: string; kind: SectionKind; title: string; weight: number | null; minimum: number | null; items: ScoringItem[] }
export interface ScoringRules { passMark: number; distinctionMark: number; sectionMinimum: number; criticalMinimum: number }
export interface SectionOutcome { id: string; kind: SectionKind; title: string; weight: number | null; percent: number; minimum: number; met: boolean; grade: SectionGrade; items: number; scored: number }
export interface BeltTestComputation { overall: number; result: BeltTestOutcome; complete: boolean; scoredItems: number; totalItems: number; sections: SectionOutcome[]; retestSections: string[]; criticalFailures: string[] }
export type SectionGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export const SECTION_KINDS: readonly { kind: SectionKind; label: string }[] = [
  { kind: 'physical', label: 'Physical Test' },
  { kind: 'skill', label: 'Taekwondo Skill Test' },
  { kind: 'poomsae', label: 'Poomsae Test' },
  { kind: 'acrobatics', label: 'Acrobatic & Tricking Test' },
  { kind: 'custom', label: 'Other' },
];

/** Half-up rounding to 2 dp without binary-float drift (matches PostgreSQL numeric round for positive values). */
export const round2 = (value: number) => Math.round(Number((value * 100).toFixed(6))) / 100;

export function sectionGrade(percent: number): SectionGrade {
  return percent >= 90 ? 'A' : percent >= 80 ? 'B' : percent >= 70 ? 'C' : percent >= 60 ? 'D' : 'F';
}

/** The academy's existing 4-level scale, applied to a 0–10 item score. */
export function itemLevel(score: number): 'Outstanding' | 'Proficient' | 'Developing' | 'Needs Work' {
  return score >= 9 ? 'Outstanding' : score >= 7 ? 'Proficient' : score >= 5 ? 'Developing' : 'Needs Work';
}

/** A valid item score: 0–10 with at most one decimal. */
export function isItemScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

export function computeBeltTestResult(rules: ScoringRules, sections: readonly ScoringSection[], scores: Readonly<Record<string, number | undefined>>): BeltTestComputation {
  let totalItems = 0, scoredItems = 0, overall = 0;
  const failed = new Set<string>(), criticalFailures: string[] = [];
  const outcomes = sections.map(section => {
    const scored = section.items.filter(item => scores[item.id] !== undefined);
    const weightSum = scored.reduce((sum, item) => sum + item.weight, 0);
    const weighted = weightSum > 0 ? scored.reduce((sum, item) => sum + (scores[item.id] as number) * item.weight, 0) / weightSum : 0;
    const percent = round2(weighted * 10);
    const minimum = section.minimum ?? rules.sectionMinimum;
    totalItems += section.items.length; scoredItems += scored.length;
    overall += percent * (section.weight ?? 0) / 100;
    if (section.items.length > 0 && percent < minimum) failed.add(section.id);
    for (const item of section.items) {
      const score = scores[item.id];
      if (item.critical && score !== undefined && score < rules.criticalMinimum) { criticalFailures.push(item.id); failed.add(section.id); }
    }
    return { id: section.id, kind: section.kind, title: section.title, weight: section.weight, percent, minimum, met: percent >= minimum, grade: sectionGrade(percent), items: section.items.length, scored: scored.length };
  });
  overall = round2(overall);
  const retestSections = [...failed].sort();
  const result: BeltTestOutcome = totalItems === 0 || scoredItems < totalItems ? 'pending'
    : overall < rules.passMark ? 'fail'
    : retestSections.length > 0 ? 'retest'
    : overall >= rules.distinctionMark ? 'distinction' : 'pass';
  return { overall, result, complete: totalItems > 0 && scoredItems === totalItems, scoredItems, totalItems, sections: outcomes, retestSections, criticalFailures: criticalFailures.sort() };
}

/**
 * Starting values when a head coach creates a syllabus. Days, classes and the
 * skill average come from the academy's existing promotion requirements
 * (BELT_REQUIREMENTS in lib/utils.ts, keyed by the belt being left).
 */
export const BELT_TEST_DEFAULTS: Record<string, { track: BeltTestTrack; minimumDays: number; minimumClasses: number; minimumSkillAverage: number; passMark?: number; weights?: [number, number, number, number] }> = {
  Yellow: { track: 'color', minimumDays: 60, minimumClasses: 16, minimumSkillAverage: 2.0, passMark: 70, weights: [25, 35, 30, 10] },
  Green: { track: 'color', minimumDays: 90, minimumClasses: 24, minimumSkillAverage: 2.0, passMark: 70, weights: [25, 30, 30, 15] },
  Blue: { track: 'color', minimumDays: 90, minimumClasses: 24, minimumSkillAverage: 2.5, passMark: 70, weights: [20, 30, 35, 15] },
  Brown: { track: 'color', minimumDays: 120, minimumClasses: 36, minimumSkillAverage: 2.5, passMark: 70, weights: [20, 30, 35, 15] },
  Red: { track: 'color', minimumDays: 120, minimumClasses: 36, minimumSkillAverage: 3.0, passMark: 75, weights: [20, 30, 35, 15] },
  '1st Poom/Dan': { track: 'kukkiwon', minimumDays: 150, minimumClasses: 48, minimumSkillAverage: 3.0 },
  '2nd Poom/Dan': { track: 'kukkiwon', minimumDays: 365, minimumClasses: 96, minimumSkillAverage: 3.5 },
};
export const DEFAULT_SCORING_RULES = { distinctionMark: 90, sectionMinimum: 60, criticalMinimum: 5, retestDays: 30 } as const;

/** Kukkiwon rank type on the test date: under 15 = Poom, 15 or older = Dan. */
export function poomOrDan(dob: string, testDate: string): 'Poom' | 'Dan' {
  const [by, bm, bd] = dob.split('-').map(Number), [ty, tm, td] = testDate.split('-').map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < 15 ? 'Poom' : 'Dan';
}

export const ELIGIBILITY_RULE_LABELS: Record<string, string> = {
  current_belt: 'Holds the previous belt', active: 'Active membership', time_in_rank: 'Days since last promotion',
  classes: 'Classes attended since last promotion', skill_average: 'Coach skill assessment average (1–4)', lessons: 'Syllabus lessons completed',
};

/** A CSV cell that cannot be read as a spreadsheet formula. */
function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export interface CtfNomination { studentId: string; legalNameEn: string | null; legalNameKh: string | null; gender: string | null; dob: string | null; poomOrDan: string | null; previousCertificateNo: string | null; currentBelt: string }
/** The nomination list the dojang submits to the Cambodia Taekwondo Federation. */
export function ctfNominationCsv(event: { title: string; examDate: string; targetBelt: string; location: string | null }, nominations: readonly CtfNomination[], dojang = 'Infinity Taekwondo Academy'): string {
  const header = ['No.', 'Full name (English)', 'Full name (Khmer)', 'Gender', 'Date of birth', 'Poom/Dan', 'Current rank', 'Applying for', 'Previous Kukkiwon certificate no.', 'Student ID', 'Dojang', 'Test date', 'Test location'];
  const rows = nominations.map((row, index) => [index + 1, row.legalNameEn, row.legalNameKh, row.gender, row.dob, row.poomOrDan, row.currentBelt, event.targetBelt, row.previousCertificateNo, row.studentId, dojang, event.examDate, event.location]);
  return '﻿' + [header, ...rows].map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
