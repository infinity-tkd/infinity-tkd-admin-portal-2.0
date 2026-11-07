import { directImageSource } from './google-drive-media';
import { lessonYouTubeId, resolveLessonMedia } from './lesson-media';
import { isPrivateLibraryDraft } from './library-publication';
import { physicalGradeScore } from './physical-grades';
import { academyDate, daysBetween, isCalendarDate } from './dates';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Coerces value to clean string and strips all HTML tags to prevent XSS injections
export function sanitizeStringInput(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Robust HTML tag stripping regex
  return str.replace(/<\/?[^>]+(>|$)/g, "");
}

// Strict email format validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Strict phone validation (digits, spaces, hyphens, and parentheses, requiring at least 7 digits)
export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Optional fields can be skipped, form level triggers require check
  const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
  return phoneRegex.test(phone);
}

// Checks calendar dates to prevent invalid values like February 30th
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
}

// High-security password complexity checker
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  if (password.length < 12) {
    errors.push('Minimum 12 characters required.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter required.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter required.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least one digit required.');
  }
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push('At least one special character required.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Converts generic URLs and Google Drive file shares into clean direct image links
export function getDirectImageUrl(url: string | null | undefined): string {
  return directImageSource(url);
}

// Dynamically formats black belts to Poom (under 15 years old) or Dan (15+ years old)
export function formatBelt(beltName: string, dob?: string): string {
  if (!beltName) return '';
  if (!dob) return beltName;

  try {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const isBlackBelt =
      beltName.includes('Poom/Dan') ||
      beltName.toLowerCase().includes('poom') ||
      beltName.toLowerCase().includes('dan') ||
      beltName.toLowerCase() === 'black';

    if (isBlackBelt) {
      const term = age < 15 ? 'Poom' : 'Dan';

      // Match formats like "1st Poom/Dan" or "1st Poom" or "1st Dan"
      const degreeMatch = beltName.match(/^(\d+)(st|nd|rd|th)?\s+(Poom\/Dan|Poom|Dan)/i);
      if (degreeMatch) {
        const degreeNumber = degreeMatch[1];
        const suffix = degreeMatch[2] || '';
        const suffixLabel = suffix ? `${degreeNumber}${suffix}` : degreeNumber;
        return `${suffixLabel} ${term}`;
      }

      return beltName.replace(/Poom\/Dan/i, term).replace(/Poom/i, term).replace(/Dan/i, term);
    }
  } catch (e) {
    console.warn('Error formatting belt:', e);
  }

  return beltName;
}

export function formatBeltLocalized(beltName: string, dob?: string, t?: (key: any) => string): string {
  if (!t) return formatBelt(beltName, dob);
  const formatted = formatBelt(beltName, dob);
  const lower = formatted.toLowerCase();
  if (lower.includes('white')) return t('belt_white');
  if (lower.includes('yellow')) return t('belt_yellow');
  if (lower.includes('green')) return t('belt_green');
  if (lower.includes('blue')) return t('belt_blue');
  if (lower.includes('brown')) return t('belt_brown');
  if (lower.includes('red')) return t('belt_red');
  if (lower.includes('1st')) return t('belt_1st_poom_dan');
  if (lower.includes('2nd')) return t('belt_2nd_poom_dan');
  if (lower.includes('3rd')) return t('belt_3rd_poom_dan');
  if (lower.includes('4th')) return t('belt_4th_poom_dan');
  return formatted;
}


// Centralized helper to check if a curriculum video belt level matches a student's current belt level
// Handles conversions and matches like "1st Poom" matching "1st Poom/Dan" or "1st Dan"
/** A lesson set for "All belts" (the same spellings the student portal accepts). */
export function isAllBeltsLesson(videoBelt: string | null | undefined): boolean {
  return ['all', 'allbelts', 'alllevels'].includes((videoBelt || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/**
 * Whether a lesson is part of the required syllabus for a belt: a published
 * (or legacy) Taekwondo lesson set for that belt or for all belts. Fitness and
 * dance materials and never-published private drafts are never required.
 */
export function isSyllabusLessonFor(
  video: { minBeltLevel: string; category?: string | null; studentCurriculumId?: number | null; publishedRevision?: number | null },
  belt: string,
): boolean {
  if (video.minBeltLevel === 'Fitness' || video.minBeltLevel === 'Dance') return false;
  if (video.category?.startsWith('Fitness:') || video.category?.startsWith('Dance:')) return false;
  if (isPrivateLibraryDraft(video)) return false;
  return isAllBeltsLesson(video.minBeltLevel) || isBeltMatch(video.minBeltLevel, belt);
}

export function isBeltMatch(videoBelt: string, studentBelt: string): boolean {
  if (!videoBelt || !studentBelt) return false;

  const vClean = videoBelt.toLowerCase().replace(' belt', '').trim();
  const sClean = studentBelt.toLowerCase().replace(' belt', '').trim();

  if (vClean === sClean) return true;

  // Extract degrees, e.g. "1st" in "1st Poom/Dan" or "1st Dan"
  const getDegree = (str: string) => {
    const m = str.match(/^(\d+)(st|nd|rd|th)?/i);
    return m ? m[1] : null;
  };

  const vDegree = getDegree(vClean);
  const sDegree = getDegree(sClean);

  if (vDegree && sDegree && vDegree === sDegree) {
    const isVBlack = vClean.includes('poom') || vClean.includes('dan') || vClean.includes('black');
    const isSBlack = sClean.includes('poom') || sClean.includes('dan') || sClean.includes('black');
    return isVBlack && isSBlack;
  }

  return false;
}

export interface BeltRequirement {
  days: number;
  classes: number;
  minPhysicalAverageScore: number;
}

export const BELT_REQUIREMENTS: Record<string, BeltRequirement> = {
  'White': { days: 60, classes: 16, minPhysicalAverageScore: 2.0 },
  'Yellow': { days: 90, classes: 24, minPhysicalAverageScore: 2.0 },
  'Green': { days: 90, classes: 24, minPhysicalAverageScore: 2.5 },
  'Blue': { days: 120, classes: 36, minPhysicalAverageScore: 2.5 },
  'Brown': { days: 120, classes: 36, minPhysicalAverageScore: 3.0 },
  'Red': { days: 150, classes: 48, minPhysicalAverageScore: 3.0 },
  '1st Poom/Dan': { days: 365, classes: 96, minPhysicalAverageScore: 3.5 },
  '2nd Poom/Dan': { days: 730, classes: 192, minPhysicalAverageScore: 3.5 },
  '3rd Poom/Dan': { days: 1095, classes: 288, minPhysicalAverageScore: 3.8 }
};

export const DEFAULT_BELT_TECHNIQUES: Record<string, string[]> = {
  'White': ['Ap Chagi (Front Kick Mastery)', 'Ap Seogi (Walking Stance Control)', 'Taegeuk Il Jang (Form 1 Execution)'],
  'Yellow': ['Dollyo Chagi (Roundhouse Mastery)', 'Ap Kubi (Forward Lunge Alignment)', 'Taegeuk Ee Jang (Form 2 Execution)'],
  'Green': ['Yop Chagi (Side Kick Mastery)', 'Dwit Kubi (Back Stance Balance)', 'Taegeuk Sam Jang (Form 3 Execution)'],
  'Blue': ['Bandal Chagi (Crescent Kick Control)', 'Dwit Kubi (Back Stance Transitions)', 'Taegeuk Sa Jang (Form 4 Execution)'],
  'Brown': ['Dwit Chagi (Back Kick Blind Chamber)', 'Beom Seogi (Tiger Stance Balance)', 'Taegeuk Oh Jang (Form 5 Execution)'],
  'Red': ['Duryeo Chagi (Spin Hook Kick Control)', 'Taegeuk Chil Jang (Form 7 Execution)', 'Special Board Breaking (Kyokpa)'],
  '1st Poom/Dan': ['Tornado Kick (360 Dollyo Chagi)', 'Koryo Poomsae Flow Mastery', 'WT Kyorugi Tactical Footwork'],
  '2nd Poom/Dan': ['540 Spinning Kick Mastery', 'Keumgang Poomsae Stance Hold', 'Tactical Cut-Kick Interception'],
  '3rd Poom/Dan': ['Special Acrobatics Demonstration', 'Taebaek Poomsae Technical Flow', 'High Performance WT Sparring Rules']
};

export function getBeltKey(belt: string): string {
  if (!belt) return 'White';
  const clean = belt.replace(/ belt/i, '').trim();
  if (clean.startsWith('1')) return '1st Poom/Dan';
  if (clean.startsWith('2')) return '2nd Poom/Dan';
  if (clean.startsWith('3')) return '3rd Poom/Dan';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export interface PromotionReadinessReport {
  startDate: string;
  daysElapsed: number;
  daysRequired: number;
  daysProgress: number;
  daysEligible: boolean;
  attendanceSince: number;
  attendanceRequired: number;
  attendanceProgress: number;
  attendanceEligible: boolean;
  syllabusCompletedPct: number;
  syllabusRequiredPct: number;
  syllabusEligible: boolean;
  totalVideos: number;
  completedVideos: number;
  skillsGradedCount: number;
  totalSkillsCount: number;
  physicalAverageScore: number;
  physicalAverageGradeLabel: 'Needs Work' | 'Developing' | 'Proficient' | 'Outstanding' | 'Unrated';
  physicalEligible: boolean;
  pri: number;
  eligibilityStatus: 'Ready' | 'Developing' | 'Needs Work';
  rank: 'Gold' | 'Silver' | 'Bronze';
  latestPromotion: any | null;
}

export function calculatePromotionReadiness(
  student: any,
  attendanceRecords: any[],
  videoProgress: any[],
  curriculumVideos: any[],
  beltHistories: any[],
  physicalEvaluations: any[],
  beltTechniques: any[]
): PromotionReadinessReport {
  const studentHistories = beltHistories.filter(h => h.studentId === student.id);

  let latestPromotion = null;
  if (studentHistories.length > 0) {
    latestPromotion = [...studentHistories].sort((a, b) => {
      const timeA = new Date(a.promotionDate).getTime();
      const timeB = new Date(b.promotionDate).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id - a.id;
    })[0];
  }

  // Promotion and attendance dates are academy calendar days, so elapsed time is
  // counted in the academy timezone rather than UTC or the staff device clock.
  const today = academyDate();
  const rawStartDate = String(latestPromotion ? latestPromotion.promotionDate : (student.registrationDate || today)).slice(0, 10);
  const startDate = isCalendarDate(rawStartDate) ? rawStartDate : today;

  const attendanceSince = attendanceRecords.filter(a =>
    a.studentId === student.id &&
    a.date >= startDate &&
    (a.status === 'Present' || a.status === 'Late')
  ).length;

  const daysElapsed = Math.max(0, daysBetween(startDate, today));

  const currentBeltVideos = curriculumVideos.filter(v => isSyllabusLessonFor(v, student.currentBelt));
  const currentBeltVideoIds = currentBeltVideos.map(v => v.id);
  const completedVideosCount = videoProgress.filter(
    p => p.studentId === student.id && p.status === 'Completed' && currentBeltVideoIds.includes(p.videoId)
  ).length;
  const totalAvailable = currentBeltVideos.length;
  const syllabusCompletedPct = totalAvailable > 0 ? Math.round((completedVideosCount / totalAvailable) * 100) : 100;

  const beltKey = getBeltKey(student.currentBelt);
  const req = BELT_REQUIREMENTS[beltKey] || { days: 90, classes: 24, minPhysicalAverageScore: 2.0 };

  // Get physical skills & evaluations
  const dynamicSkills = beltTechniques
    .filter(x => getBeltKey(x.beltLevel) === beltKey)
    .map(x => x.techniqueName);

  const targetSkills = dynamicSkills.length > 0 ? dynamicSkills : (DEFAULT_BELT_TECHNIQUES[beltKey] || []);

  let gradedCount = 0;
  let totalScore = 0;

  targetSkills.forEach(skillName => {
    const dbMatch = physicalEvaluations.find(e => e.studentId === student.id && e.skillName === skillName);
    const score = physicalGradeScore(dbMatch?.grade);
    if (score !== null) {
      gradedCount++;
      totalScore += score;
    }
  });

  const physicalAverageScore = gradedCount > 0 ? Number((totalScore / gradedCount).toFixed(2)) : 0;
  const physicalAverageGradeLabel =
    physicalAverageScore >= 3.5 ? 'Outstanding' :
    physicalAverageScore >= 2.5 ? 'Proficient' :
    physicalAverageScore >= 1.5 ? 'Developing' :
    physicalAverageScore > 0 ? 'Needs Work' : 'Unrated';

  const physicalEligible = targetSkills.length > 0
    ? (gradedCount === targetSkills.length && physicalAverageScore >= req.minPhysicalAverageScore)
    : true; // if no skills are defined, default to true

  // Days Eligibility
  const daysProgress = Math.min(100, Math.round((daysElapsed / req.days) * 100));
  const daysEligible = daysElapsed >= req.days;

  // Attendance Eligibility
  const attendanceProgress = Math.min(100, Math.round((attendanceSince / req.classes) * 100));
  const attendanceEligible = attendanceSince >= req.classes;

  // Syllabus Eligibility
  const syllabusEligible = totalAvailable > 0 ? (syllabusCompletedPct === 100) : true;

  // Promotion Readiness Index (PRI) Calculation (Weighted average of the 4 vectors)
  // Time progress (capped at 100)
  // Attendance progress (capped at 100)
  // Syllabus progress (capped at 100)
  // Physical grades progress (scaled to 100, i.e., averageScore / 4.0 * 100)
  const physicalProgress = targetSkills.length > 0
    ? Math.round((gradedCount / targetSkills.length) * 50 + (physicalAverageScore / 4.0) * 50)
    : 100;

  const pri = Math.round(
    daysProgress * 0.25 +
    attendanceProgress * 0.25 +
    syllabusCompletedPct * 0.25 +
    physicalProgress * 0.25
  );

  let eligibilityStatus: 'Ready' | 'Developing' | 'Needs Work' = 'Needs Work';
  if (student.studentStatus === 'Active') {
    if (daysEligible && attendanceEligible && syllabusEligible && physicalEligible) {
      eligibilityStatus = 'Ready';
    } else if (daysElapsed >= req.days * 0.5 || attendanceSince >= req.classes * 0.5 || syllabusCompletedPct >= 50 || gradedCount > 0) {
      eligibilityStatus = 'Developing';
    }
  }

  return {
    startDate,
    daysElapsed,
    daysRequired: req.days,
    daysProgress,
    daysEligible,
    attendanceSince,
    attendanceRequired: req.classes,
    attendanceProgress,
    attendanceEligible,
    syllabusCompletedPct,
    syllabusRequiredPct: 100,
    syllabusEligible,
    totalVideos: totalAvailable,
    completedVideos: completedVideosCount,
    skillsGradedCount: gradedCount,
    totalSkillsCount: targetSkills.length,
    physicalAverageScore,
    physicalAverageGradeLabel,
    physicalEligible,
    pri,
    eligibilityStatus,
    rank: eligibilityStatus === 'Ready' ? 'Gold' : eligibilityStatus === 'Developing' ? 'Silver' : 'Bronze',
    latestPromotion
  };
}

export interface ChurnRiskReport {
  daysSinceLastClass: number;
  lastDate: string;
  expectedWeeklyFrequency: number;
  estimatedMissedClasses: number;
  cpi: number; // Churn Probability Index (0-100)
  riskLevel: 'High' | 'Medium' | 'Stable';
  recommendedAction: string;
}

export function calculateChurnRisk(
  student: any,
  attendanceRecords: any[],
  classEnrollments: any[],
  classSessions: any[],
  currentLocalTime: Date
): ChurnRiskReport {
  const studentRecords = attendanceRecords
    .filter(r => r.studentId === student.id && (r.status === 'Present' || r.status === 'Late'))
    .sort((a, b) => b.date.localeCompare(a.date));

  let daysSinceLastClass = 999;
  let lastDate = 'Never';

  const todayLocalMidnight = new Date(
    currentLocalTime.getFullYear(),
    currentLocalTime.getMonth(),
    currentLocalTime.getDate()
  );

  if (studentRecords.length > 0) {
    lastDate = studentRecords[0].date;
    const [year, month, day] = lastDate.split('-').map(Number);
    const lastDateLocalMidnight = new Date(year, month - 1, day);
    const timeDiff = todayLocalMidnight.getTime() - lastDateLocalMidnight.getTime();
    daysSinceLastClass = Math.max(0, Math.round(timeDiff / (1000 * 3600 * 24)));
  } else {
    const enrollments = classEnrollments.filter(e => e.studentId === student.id);
    const enrollDates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    const enrollDate = enrollDates.length > 0 ? enrollDates.sort()[0] : student.registrationDate;

    if (enrollDate) {
      const [year, month, day] = enrollDate.split('-').map(Number);
      const enrollDateLocalMidnight = new Date(year, month - 1, day);
      const timeDiff = todayLocalMidnight.getTime() - enrollDateLocalMidnight.getTime();
      daysSinceLastClass = Math.max(0, Math.round(timeDiff / (1000 * 3600 * 24)));
    }
  }

  // Calculate expected weekly frequency based on enrolled classes
  const enrolledSessionIds = classEnrollments
    .filter(e => e.studentId === student.id)
    .map(e => e.classSessionId);

  const enrolledSessions = classSessions.filter(s => enrolledSessionIds.includes(s.id));

  let expectedWeeklyFrequency = 0;
  enrolledSessions.forEach(s => {
    const days = Array.isArray(s.daysOfWeek) ? s.daysOfWeek : [s.dayOfWeek || ''];
    expectedWeeklyFrequency += days.filter(Boolean).length;
  });

  // Fallback to average 2 classes per week if not enrolled or invalid
  if (expectedWeeklyFrequency === 0) {
    expectedWeeklyFrequency = 2;
  }

  // Estimate missed classes
  const weeksSinceLastClass = daysSinceLastClass / 7;
  const estimatedMissedClasses = Math.max(0, Math.floor(weeksSinceLastClass * expectedWeeklyFrequency));

  // Compute Churn Probability Index (CPI %)
  let cpi = 0;
  if (daysSinceLastClass >= 30) {
    cpi = 95;
  } else if (daysSinceLastClass >= 14) {
    cpi = Math.min(95, Math.round(75 + (daysSinceLastClass - 14) * 1.2));
  } else {
    cpi = Math.min(75, Math.round((daysSinceLastClass * 3.5) + (estimatedMissedClasses * 10)));
  }

  // Map to risk levels
  let riskLevel: 'High' | 'Medium' | 'Stable' = 'Stable';
  if (cpi >= 60) {
    riskLevel = 'High';
  } else if (cpi >= 30) {
    riskLevel = 'Medium';
  }

  // Recommended actions
  let recommendedAction = 'Maintain Standard Engagement';
  if (riskLevel === 'High') {
    recommendedAction = student.phone
      ? 'Call Emergency Contact / Instructor Outreach'
      : 'Send High-Priority Check-in Message';
  } else if (riskLevel === 'Medium') {
    recommendedAction = 'Send Class Catch-up / Support Message';
  } else if (daysSinceLastClass > 7) {
    recommendedAction = 'Standard Instructor Attendance Check';
  }

  return {
    daysSinceLastClass,
    lastDate,
    expectedWeeklyFrequency,
    estimatedMissedClasses,
    cpi,
    riskLevel,
    recommendedAction
  };
}

// Group legacy category variations into standard unified curriculum names
export function normalizeCategory(category: string | null | undefined): string {
  if (!category) return 'Forms (Poomsae)';
  const cat = category.trim().toLowerCase();

  // Handle Fitness categories
  if (cat.startsWith('fitness:')) {
    return category.trim();
  }

  // Handle Dance categories
  if (cat.startsWith('dance:')) {
    return category.trim();
  }

  if (cat.includes('poomsae') || cat.includes('form')) {
    return 'Forms (Poomsae)';
  }
  if (cat.includes('kyorugi') || cat.includes('sparring')) {
    return 'Sparring (Kyorugi)';
  }
  if (cat.includes('chagi') || cat.includes('kick')) {
    return 'Kicks (Chagi)';
  }
  if (cat.includes('hosinsul') || cat.includes('defense') || cat.includes('self-defense')) {
    return 'Self-Defense (Hosinsul)';
  }
  if (cat.includes('kyokpa') || cat.includes('breaking')) {
    return 'Breaking (Kyokpa)';
  }
  if (cat.includes('theory') || cat.includes('terminology')) {
    return 'Theory & Terminology';
  }
  if (cat.includes('acrobatics') || cat.includes('tricking')) {
    return 'Tricking & Acrobatics';
  }
  if (cat.includes('stance') || cat.includes('seogi') || cat.includes('footwork')) {
    return 'Stances & Footwork (Seogi)';
  }
  if (cat.includes('strike') || (cat.includes('jirugi') && !cat.includes('makki')) || cat.includes('chigi')) {
    return 'Strikes (Jirugi/Chigi)';
  }
  if (cat.includes('block') || (cat.includes('makki') && !cat.includes('jirugi'))) {
    return 'Blocks (Makki)';
  }

  return category.trim();
}

// Map a UI category string to the strict Postgres database taekwondo_category_enum values
export function mapCategoryToDbEnum(category: string | null | undefined): 'Poomsae' | 'Kyorugi' | 'Chagi' | 'Hosinsul' | 'Kyokpa' | 'Theory' {
  if (!category) return 'Poomsae';
  const cat = category.trim().toLowerCase();

  if (cat.includes('poomsae') || cat.includes('form') || cat.includes('stance') || cat.includes('seogi') || cat.includes('footwork') || cat.includes('strike') || cat.includes('block') || cat.includes('jirugi') || cat.includes('makki')) {
    return 'Poomsae';
  }
  if (cat.includes('kyorugi') || cat.includes('sparring')) {
    return 'Kyorugi';
  }
  if (cat.includes('chagi') || cat.includes('kick')) {
    return 'Chagi';
  }
  if (cat.includes('hosinsul') || cat.includes('defense') || cat.includes('self-defense')) {
    return 'Hosinsul';
  }
  if (cat.includes('kyokpa') || cat.includes('breaking') || cat.includes('acrobatics') || cat.includes('tricking')) {
    return 'Kyokpa';
  }
  return 'Theory';
}

// Convert a category string into a localized translation key reference
export function getCategoryTranslationKey(cat: string | null | undefined): any {
  if (!cat) return null;
  const c = cat.replace('Fitness: ', '').replace('Dance: ', '').trim().toLowerCase();

  if (c === 'hiphop') return 'cat_dance_hiphop';
  if (c === 'popping') return 'cat_dance_popping';
  if (c === 'tutorials') return 'cat_dance_tutorials';
  if (c === 'resources') return 'cat_dance_resources';

  if (c.includes('poomsae') || c.includes('forms')) return 'cat_poomsae';
  if (c.includes('kyorugi') || c.includes('sparring')) return 'cat_kyorugi';
  if (c.includes('chagi') || c.includes('kicks') || c.includes('kicking')) return 'cat_chagi';
  if (c.includes('hosinsul') || c.includes('self-defense') || c.includes('defense')) return 'cat_hosinsul';
  if (c.includes('kyokpa') || c.includes('breaking')) return 'cat_kyokpa';
  if (c.includes('theory') || c.includes('terminology')) return 'cat_theory';
  if (c.includes('seogi') || c.includes('stances') || c.includes('footwork')) return 'cat_seogi';
  if (c.includes('strikes') || c.includes('chigi') || (c.includes('jirugi') && !c.includes('makki') && !c.includes('block'))) return 'cat_strikes';
  if (c.includes('blocks') || (c.includes('makki') && !c.includes('jirugi') && !c.includes('strike'))) return 'cat_blocks';
  if (c.includes('jirugi') || c.includes('makki') || c.includes('strikes') || c.includes('blocks')) return 'cat_jirugi_makki';
  if (c.includes('tricking') || c.includes('acrobatics')) return 'cat_tricking_acrobatics';

  // Fitness categories
  if (c === 'strength') return 'cat_strength';
  if (c === 'explosive') return 'cat_explosive';
  if (c === 'speed') return 'cat_speed';
  if (c === 'agility') return 'cat_agility';
  if (c === 'control') return 'cat_control';
  if (c === 'balance') return 'cat_balance';
  if (c === 'flexibility') return 'cat_flexibility';
  if (c === 'functional') return 'cat_functional';
  if (c === 'rotational') return 'cat_rotational';
  if (c === 'core') return 'cat_core';
  if (c === 'conditioning') return 'cat_conditioning';

  return null;
}

export function getYouTubeId(url: string | null | undefined): string | null {
  return lessonYouTubeId(url);
}

export function getEmbedVideoUrl(url: string | null | undefined): string {
  const media = resolveLessonMedia(url);
  return media.kind === 'iframe' ? media.src : '';
}

export interface MistakeCorrection {
  mistake: string;
  correction: string;
}

export interface VocabularyItem {
  korean: string;
  english: string;
  khmer: string;
}

export interface QuestionAnswerItem {
  question: string;
  answer: string;
}

export interface AssetDetails {
  text: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  instructions?: string[];
  focusZones?: string[];
  repsSets?: string;
  thumbnailUrl?: string;
  principles?: string[];
  prerequisites?: string[];
  drillingMethods?: string[];
  mistakes?: MistakeCorrection[];
  performance?: string[];
  fitnessSolutions?: number[];
  terminology?: VocabularyItem[];
  studyGuide?: QuestionAnswerItem[];
}

const ASSET_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const;
const assetText = (value: unknown) => typeof value === 'string' ? value : '';
/** Text lists may be legacy newline-separated strings; non-text entries are dropped. */
const assetTextList = (value: unknown): string[] => typeof value === 'string'
  ? value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const assetRecords = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
  : [];

export function parseAssetDescription(description: string): AssetDetails {
  try {
    if (description && description.trim().startsWith('{') && description.trim().endsWith('}')) {
      const parsed = JSON.parse(description);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not lesson metadata.');

      let normalizedMistakes: MistakeCorrection[] = [];
      if (parsed.mistakes && Array.isArray(parsed.mistakes)) {
        normalizedMistakes = parsed.mistakes.map((item: any) => {
          if (typeof item === 'string') {
            if (item.includes('→')) {
              const parts = item.split('→');
              return {
                mistake: parts[0].trim(),
                correction: parts[1].trim()
              };
            }
            if (item.includes('â†’')) {
              const parts = item.split('â†’');
              return {
                mistake: parts[0].trim(),
                correction: parts[1].trim()
              };
            }
            return { mistake: item, correction: '' };
          }
          return {
            mistake: assetText(item?.mistake),
            correction: assetText(item?.correction)
          };
        });
      }

      // Every field the editors and viewers read is normalised here, so a
      // legacy or hand-imported row can be displayed and re-saved safely.
      return {
        ...parsed,
        text: assetText(parsed.text),
        difficulty: ASSET_DIFFICULTIES.includes(parsed.difficulty) ? parsed.difficulty : undefined,
        instructions: assetTextList(parsed.instructions),
        focusZones: assetTextList(parsed.focusZones),
        repsSets: assetText(parsed.repsSets),
        thumbnailUrl: assetText(parsed.thumbnailUrl),
        principles: assetTextList(parsed.principles),
        prerequisites: assetTextList(parsed.prerequisites),
        drillingMethods: assetTextList(parsed.drillingMethods),
        mistakes: normalizedMistakes,
        performance: assetTextList(parsed.performance),
        fitnessSolutions: Array.isArray(parsed.fitnessSolutions) ? parsed.fitnessSolutions.map(Number).filter(Number.isSafeInteger) : [],
        terminology: assetRecords(parsed.terminology).map(item => ({ korean: assetText(item.korean), english: assetText(item.english), khmer: assetText(item.khmer) })),
        studyGuide: assetRecords(parsed.studyGuide).map(item => ({ question: assetText(item.question), answer: assetText(item.answer) }))
      };
    }
  } catch {
    // ignore and fallback
  }
  return {
    text: description || '',
    difficulty: 'Beginner',
    instructions: [],
    focusZones: [],
    repsSets: '',
    thumbnailUrl: '',
    principles: [],
    prerequisites: [],
    drillingMethods: [],
    mistakes: [],
    performance: [],
    fitnessSolutions: [],
    terminology: [],
    studyGuide: []
  };
}




