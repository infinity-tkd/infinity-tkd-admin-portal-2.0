import type { Eligibility } from './belt-test-contract';

type Status = 'Ready' | 'Developing' | 'Needs Work';

/**
 * One answer to "can this student test?" across the admin portal.
 *
 * When the student's next belt has a published Belt Tests syllabus, its
 * eligibility engine (the same one the student portal shows) decides Ready.
 * The client readiness report keeps its progress index (PRI) and its
 * Developing / Needs Work split for students who are not yet eligible.
 * Without a published syllabus the report is returned unchanged.
 */
export function mergeBeltEligibility<R extends { eligibilityStatus: Status }>(report: R, eligibility: Eligibility | null | undefined): R & { beltTest: Eligibility | null } {
  if (!eligibility) return { ...report, beltTest: null };
  const eligibilityStatus: Status = eligibility.status === 'eligible' ? 'Ready' : report.eligibilityStatus === 'Ready' ? 'Developing' : report.eligibilityStatus;
  // The report's medal rank is derived from the status, so it follows it.
  const rank = 'rank' in report ? { rank: eligibilityStatus === 'Ready' ? 'Gold' : eligibilityStatus === 'Developing' ? 'Silver' : 'Bronze' } : {};
  return { ...report, ...rank, eligibilityStatus, beltTest: eligibility };
}

/** "3 of 4 rules met" style summary for compact badges. */
export function beltEligibilitySummary(eligibility: Eligibility): string {
  const met = eligibility.rules.filter(rule => rule.met).length;
  return eligibility.status === 'eligible'
    ? `Eligible for the ${eligibility.targetBelt} test`
    : `${met} of ${eligibility.rules.length} ${eligibility.targetBelt} test rules met`;
}
