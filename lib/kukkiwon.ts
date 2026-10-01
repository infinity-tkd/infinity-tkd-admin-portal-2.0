/**
 * INFINITY TAEKWONDO 2.0 - KUKKIWON BLACK BELT & PROMOTION ELIGIBILITY ENGINE
 * 
 * Implements official Kukkiwon (World Taekwondo Headquarters) standards:
 * - Mandatory time-in-grade waiting requirements:
 *     1st Dan -> 2nd Dan: 1 year
 *     2nd Dan -> 3rd Dan: 2 years
 *     3rd Dan -> 4th Dan: 3 years
 *     4th Dan -> 5th Dan: 4 years
 *     5th Dan -> 6th Dan: 5 years
 *     6th Dan -> 7th Dan: 6 years
 *     7th Dan -> 8th Dan: 8 years
 *     8th Dan -> 9th Dan: 9 years
 * - Kukkiwon minimum age requirements:
 *     1st Dan: 15+ | 2nd Dan: 16+ | 3rd Dan: 18+ | 4th Dan: 21+ (Master)
 *     5th Dan: 25+ | 6th Dan: 30+ | 7th Dan: 36+ | 8th Dan: 44+ | 9th Dan: 53+
 */

export interface KukkiwonDanRule {
  danLevel: number;
  nextDanLevel: number | null;
  waitYears: number;
  minAgeForCurrentDan: number;
  minAgeForNextDan: number | null;
  englishTitle: string;
  koreanTitle: string;
  romanization: string;
}

export const KUKKIWON_DAN_RULES: Record<number, KukkiwonDanRule> = {
  1: {
    danLevel: 1,
    nextDanLevel: 2,
    waitYears: 1,
    minAgeForCurrentDan: 15,
    minAgeForNextDan: 16,
    englishTitle: 'Assistant Instructor',
    koreanTitle: '조교',
    romanization: 'Jo-gyo'
  },
  2: {
    danLevel: 2,
    nextDanLevel: 3,
    waitYears: 2,
    minAgeForCurrentDan: 16,
    minAgeForNextDan: 18,
    englishTitle: 'Instructor',
    koreanTitle: '교사',
    romanization: 'Gyo-sa'
  },
  3: {
    danLevel: 3,
    nextDanLevel: 4,
    waitYears: 3,
    minAgeForCurrentDan: 18,
    minAgeForNextDan: 21,
    englishTitle: 'Chief Instructor',
    koreanTitle: '사범',
    romanization: 'Sa-beom'
  },
  4: {
    danLevel: 4,
    nextDanLevel: 5,
    waitYears: 4,
    minAgeForCurrentDan: 21,
    minAgeForNextDan: 25,
    englishTitle: 'Master Instructor',
    koreanTitle: '사범님',
    romanization: 'Sa-beom-nim'
  },
  5: {
    danLevel: 5,
    nextDanLevel: 6,
    waitYears: 5,
    minAgeForCurrentDan: 25,
    minAgeForNextDan: 30,
    englishTitle: 'Master',
    koreanTitle: '사범님',
    romanization: 'Sa-beom-nim'
  },
  6: {
    danLevel: 6,
    nextDanLevel: 7,
    waitYears: 6,
    minAgeForCurrentDan: 30,
    minAgeForNextDan: 36,
    englishTitle: 'Senior Master',
    koreanTitle: '고단자',
    romanization: 'Go-dan-ja'
  },
  7: {
    danLevel: 7,
    nextDanLevel: 8,
    waitYears: 8,
    minAgeForCurrentDan: 36,
    minAgeForNextDan: 44,
    englishTitle: 'Grandmaster',
    koreanTitle: '관장님',
    romanization: 'Gwan-jang-nim'
  },
  8: {
    danLevel: 8,
    nextDanLevel: 9,
    waitYears: 9,
    minAgeForCurrentDan: 44,
    minAgeForNextDan: 53,
    englishTitle: 'Senior Grandmaster',
    koreanTitle: '대사범',
    romanization: 'Dae-sa-beom'
  },
  9: {
    danLevel: 9,
    nextDanLevel: null,
    waitYears: 0,
    minAgeForCurrentDan: 53,
    minAgeForNextDan: null,
    englishTitle: 'Great Grandmaster',
    koreanTitle: '구단 대사범',
    romanization: 'Gu-dan Dae-sa-beom'
  }
};

export type DanEligibilityStatusCode = 
  | 'ELIGIBLE' 
  | 'TIME_PENDING' 
  | 'AGE_RESTRICTED' 
  | 'MAX_DAN' 
  | 'NO_DAN_DATA'
  | 'INVALID_DATE';

export interface DanEligibilityDossier {
  currentDan: number | null;
  currentDanLabel: string;
  nextDan: number | null;
  nextDanLabel: string | null;
  currentTitle: string;
  nextTitle: string | null;
  requiredWaitYears: number;
  issueDate: string | null;
  earliestTestDate: string | null;
  daysElapsed: number;
  daysRequired: number;
  daysRemaining: number;
  yearsRemaining: number;
  monthsRemaining: number;
  progressPercent: number; // 0 - 100
  isTimeEligible: boolean;
  isAgeEligible: boolean;
  currentAge: number | null;
  minAgeForNextDan: number | null;
  status: DanEligibilityStatusCode;
  headline: string;
  subtext: string;
  badgeVariant: 'emerald' | 'amber' | 'rose' | 'purple' | 'neutral';
}

/**
 * Format Dan rank number into ordinal label, e.g. 1 -> "1st Dan", 2 -> "2nd Dan"
 */
export function formatDanRank(dan?: number | null): string {
  if (!dan || dan < 1) return 'Unranked';
  if (dan === 1) return '1st Dan';
  if (dan === 2) return '2nd Dan';
  if (dan === 3) return '3rd Dan';
  return `${dan}th Dan`;
}

/**
 * Get Roman numeral stripes for Dan belt visual styling (e.g. I, II, III, IV, V...)
 */
export function getDanStripes(dan?: number | null): string {
  if (!dan || dan < 1) return '';
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  return roman[dan] || `${dan}`;
}

/**
 * Helper to calculate age in full years from date of birth string
 */
export function calculateStaffAge(dob?: string | null, referenceDate = new Date()): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const m = referenceDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Helper to format remaining time nicely (e.g. "1 yr, 3 mos remaining")
 */
export function formatRemainingWaitTime(years: number, months: number, days: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
  if (days > 0 && years === 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

  return parts.length > 0 ? parts.join(', ') : 'Eligible now';
}

/**
 * Core Kukkiwon Dan Promotion Eligibility Calculation
 */
export function calculateDanEligibility(
  currentDan?: number | null,
  issueDate?: string | null,
  dob?: string | null,
  referenceDate = new Date()
): DanEligibilityDossier {
  // Case 1: No Dan recorded or invalid
  if (!currentDan || currentDan < 1) {
    return {
      currentDan: null,
      currentDanLabel: 'Unranked',
      nextDan: 1,
      nextDanLabel: '1st Dan',
      currentTitle: 'Staff / Candidate',
      nextTitle: 'Assistant Instructor',
      requiredWaitYears: 0,
      issueDate: null,
      earliestTestDate: null,
      daysElapsed: 0,
      daysRequired: 0,
      daysRemaining: 0,
      yearsRemaining: 0,
      monthsRemaining: 0,
      progressPercent: 0,
      isTimeEligible: false,
      isAgeEligible: false,
      currentAge: calculateStaffAge(dob, referenceDate),
      minAgeForNextDan: 15,
      status: 'NO_DAN_DATA',
      headline: 'No Kukkiwon Record',
      subtext: 'Link Kukkiwon ID and issue date to enable eligibility tracking.',
      badgeVariant: 'neutral'
    };
  }

  // Case 2: Maximum Kukkiwon Dan (9th Dan Grandmaster)
  if (currentDan >= 9) {
    return {
      currentDan: 9,
      currentDanLabel: '9th Dan',
      nextDan: null,
      nextDanLabel: null,
      currentTitle: 'Great Grandmaster (구단 대사범)',
      nextTitle: null,
      requiredWaitYears: 0,
      issueDate: issueDate || null,
      earliestTestDate: null,
      daysElapsed: 0,
      daysRequired: 0,
      daysRemaining: 0,
      yearsRemaining: 0,
      monthsRemaining: 0,
      progressPercent: 100,
      isTimeEligible: true,
      isAgeEligible: true,
      currentAge: calculateStaffAge(dob, referenceDate),
      minAgeForNextDan: null,
      status: 'MAX_DAN',
      headline: '9th Dan Great Grandmaster',
      subtext: 'Highest rank achievable under Kukkiwon World Taekwondo regulation.',
      badgeVariant: 'purple'
    };
  }

  // Case 3: Missing issue date
  if (!issueDate) {
    const rule = KUKKIWON_DAN_RULES[currentDan] || KUKKIWON_DAN_RULES[1];
    return {
      currentDan,
      currentDanLabel: formatDanRank(currentDan),
      nextDan: rule.nextDanLevel,
      nextDanLabel: formatDanRank(rule.nextDanLevel),
      currentTitle: rule.englishTitle,
      nextTitle: rule.nextDanLevel ? KUKKIWON_DAN_RULES[rule.nextDanLevel]?.englishTitle : null,
      requiredWaitYears: rule.waitYears,
      issueDate: null,
      earliestTestDate: null,
      daysElapsed: 0,
      daysRequired: rule.waitYears * 365,
      daysRemaining: rule.waitYears * 365,
      yearsRemaining: rule.waitYears,
      monthsRemaining: 0,
      progressPercent: 0,
      isTimeEligible: false,
      isAgeEligible: false,
      currentAge: calculateStaffAge(dob, referenceDate),
      minAgeForNextDan: rule.minAgeForNextDan,
      status: 'NO_DAN_DATA',
      headline: 'Issue Date Missing',
      subtext: `Requires ${rule.waitYears} ${rule.waitYears === 1 ? 'year' : 'years'} time-in-grade. Set issue date to calculate test date.`,
      badgeVariant: 'amber'
    };
  }

  const issue = new Date(issueDate);
  if (isNaN(issue.getTime())) {
    return {
      currentDan,
      currentDanLabel: formatDanRank(currentDan),
      nextDan: currentDan + 1,
      nextDanLabel: formatDanRank(currentDan + 1),
      currentTitle: 'Coach',
      nextTitle: null,
      requiredWaitYears: 1,
      issueDate,
      earliestTestDate: null,
      daysElapsed: 0,
      daysRequired: 365,
      daysRemaining: 0,
      yearsRemaining: 0,
      monthsRemaining: 0,
      progressPercent: 0,
      isTimeEligible: false,
      isAgeEligible: false,
      currentAge: calculateStaffAge(dob, referenceDate),
      minAgeForNextDan: 16,
      status: 'INVALID_DATE',
      headline: 'Invalid Issue Date',
      subtext: 'The recorded issue date format is invalid.',
      badgeVariant: 'rose'
    };
  }

  const rule = KUKKIWON_DAN_RULES[currentDan] || KUKKIWON_DAN_RULES[1];
  const waitYears = rule.waitYears;

  // Calculate earliest eligible test date: issue date + waitYears
  const earliestTest = new Date(issue);
  earliestTest.setFullYear(earliestTest.getFullYear() + waitYears);

  const now = referenceDate;
  const totalRequiredMs = earliestTest.getTime() - issue.getTime();
  const elapsedMs = now.getTime() - issue.getTime();
  const remainingMs = earliestTest.getTime() - now.getTime();

  const daysElapsed = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const daysRequired = Math.max(1, Math.floor(totalRequiredMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / daysRequired) * 100)));
  const isTimeEligible = now.getTime() >= earliestTest.getTime();

  // Age eligibility verification
  const currentAge = calculateStaffAge(dob, now);
  const minAge = rule.minAgeForNextDan;
  const isAgeEligible = minAge === null || currentAge === null || currentAge >= minAge;

  // Rough year & month decomposition for remaining countdown
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30.4375) % 12);
  const yearsRemaining = Math.max(0, Math.floor(daysRemaining / 365.25));

  const earliestTestDateStr = earliestTest.toISOString().split('T')[0];
  const nextDanRank = rule.nextDanLevel;
  const nextDanLabel = formatDanRank(nextDanRank);
  const nextTitle = nextDanRank ? KUKKIWON_DAN_RULES[nextDanRank]?.englishTitle : null;

  // Determine final status
  let status: DanEligibilityStatusCode;
  let headline: string;
  let subtext: string;
  let badgeVariant: 'emerald' | 'amber' | 'rose' | 'purple' | 'neutral';

  if (isTimeEligible && isAgeEligible) {
    status = 'ELIGIBLE';
    headline = `Legit to Test for ${nextDanLabel}`;
    subtext = `Required ${waitYears}-year wait satisfied on ${earliestTestDateStr}. Ready for Kukkiwon promotion!`;
    badgeVariant = 'emerald';
  } else if (!isTimeEligible) {
    status = 'TIME_PENDING';
    const countdown = formatRemainingWaitTime(yearsRemaining, monthsRemaining, daysRemaining);
    headline = `${countdown} for ${nextDanLabel}`;
    subtext = `Requires ${waitYears} ${waitYears === 1 ? 'year' : 'years'} time-in-grade. Eligible on ${earliestTestDateStr} (${progressPercent}% elapsed).`;
    badgeVariant = 'amber';
  } else {
    // Time is satisfied, but staff is below the minimum age
    status = 'AGE_RESTRICTED';
    headline = `Min. Age ${minAge} Required for ${nextDanLabel}`;
    subtext = `Time-in-grade satisfied, but coach is currently age ${currentAge}. Must reach age ${minAge} to test.`;
    badgeVariant = 'rose';
  }

  return {
    currentDan,
    currentDanLabel: formatDanRank(currentDan),
    nextDan: nextDanRank,
    nextDanLabel,
    currentTitle: rule.englishTitle,
    nextTitle,
    requiredWaitYears: waitYears,
    issueDate,
    earliestTestDate: earliestTestDateStr,
    daysElapsed,
    daysRequired,
    daysRemaining,
    yearsRemaining,
    monthsRemaining,
    progressPercent,
    isTimeEligible,
    isAgeEligible,
    currentAge,
    minAgeForNextDan: minAge,
    status,
    headline,
    subtext,
    badgeVariant
  };
}
