'use client';
import { useAttendanceActions } from '@/hooks/use-attendance-actions';
import { activeClassEnrollmentCounts } from '@/lib/attendance-roster';
import { BirthdayWishActionModal } from '@/components/dashboard/BirthdayWishActionModal';

import { academyDate, addCalendarDays, MONTH_NAMES } from '@/lib/dates';
import { sessionMark } from '@/lib/attendance-index';
import { tuitionCycle } from '@/lib/tuition-cycle';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { useT } from '@/hooks/useTranslation';
import { AnimatePresence } from 'motion/react';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';

import { Crown } from '@phosphor-icons/react/dist/csr/Crown';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';

import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';

import { Sparkle as SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle';


import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';


import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { cn, formatBelt, calculatePromotionReadiness, calculateChurnRisk } from '@/lib/utils';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { PageHeader, SegmentedTabs } from './ui/PageHeader';
import { KpiCard } from './ui/KpiCard';
import { SafeImage } from '@/components/SafeImage';
import dynamic from 'next/dynamic';

// The Intelligence Center tab loads only when it is opened.
const IntelligenceCenter = dynamic(() => import('@/components/dashboard/IntelligenceCenter').then(module => module.IntelligenceCenter), {
  ssr: false,
  loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p>,
});
import { MetricGuideDialog } from '@/components/dashboard/MetricGuideDialog';
import { BirthdayPanel } from '@/components/dashboard/BirthdayPanel';
import { LiveRosterPanel } from '@/components/dashboard/LiveRosterPanel';


const WEEKDAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const monthsListGlobal = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isMonthBeforeEnrollment = (monthStr: string, year: number, enrollmentDateStr: string | undefined) => {
  if (!enrollmentDateStr) return true;
  const parts = enrollmentDateStr.split('-');
  if (parts.length < 2) return false;

  const enrollYear = parseInt(parts[0], 10);
  const enrollMonthIdx = parseInt(parts[1], 10) - 1; // 0-11

  // Format short month names comparison (handles both full and short formats)
  const shortMonthStr = monthStr.substring(0, 3);
  const targetMonthIdx = monthsListGlobal.findIndex(m => m.toLowerCase() === shortMonthStr.toLowerCase());
  if (targetMonthIdx === -1) return false;

  if (year < enrollYear) return true;
  if (year === enrollYear && targetMonthIdx < enrollMonthIdx) return true;

  return false;
};

export function DashboardView() {
  const { state, can, updateStudent, payInvoice, showNotification, showConfirm } = useAppStore();
  const attendanceActions=useAttendanceActions();
  const t = useT();
  const canViewFinancials = can('page:financials');
  const canApproveIntake = can('action:student_edit');
  const canMarkAttendance = can('action:attendance_mark');
  const canDeleteAttendance = can('action:attendance_delete');
  const activeEnrollmentCounts = useMemo(()=>activeClassEnrollmentCounts(state.students,state.classEnrollments),[state.students,state.classEnrollments]);
  const activeStudentIds = useMemo(()=>new Set(state.students.filter(student=>student.studentStatus==='Active').map(student=>student.id)),[state.students]);

  const translateBeltFormatted = (beltName: string, dob?: string) => {
    const formatted = formatBelt(beltName, dob);
    const lower = formatted.toLowerCase();
    if (lower.includes('dan')) {
      const num = lower.split(' ')[0]; // "1st", "2nd", etc.
      return `${num} ${t('nav_admin') === 'Admin' ? 'Dan' : t('nav_admin') === 'អភិបាល' ? 'ដាន' : '段'}`;
    }
    if (lower.includes('poom')) {
      const num = lower.split(' ')[0];
      return `${num} ${t('nav_admin') === 'Admin' ? 'Poom' : t('nav_admin') === 'អភិបាល' ? 'ពូម' : '品'}`;
    }
    const key = `belt_${lower.replace(/[\s/]+/g, '_')}`;
    const translated = t(key as any);
    return translated && translated !== key ? translated : formatted;
  };

  const getStudentEnrollDate = React.useCallback((st: Student) => {
    const enrollments = state.classEnrollments.filter(e => e.studentId === st.id);
    if (enrollments.length === 0) return st.registrationDate;
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length === 0) return st.registrationDate;
    return dates.sort()[0];
  }, [state.classEnrollments]);

  const [currentLocalTime, setCurrentLocalTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentLocalTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const academyToday = academyDate(currentLocalTime);
  const currentMonthIdx = Number(academyToday.slice(5,7))-1;
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const todayDateStr = academyToday.slice(8,10);
  const todayMonthStr = academyToday.slice(5,7);
  const currentYear = Number(academyToday.slice(0,4));

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [wishState, setWishState] = useState<Record<string, 'sending' | 'sent'>>({});
  const [wishStudent, setWishStudent] = useState<Student | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tab & Analytics states
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'intelligence'>('overview');
  const [forecastChurnRate, setForecastChurnRate] = useState<number>(10);
  const [priRankFilter, setPriRankFilter] = useState<'all' | 'Gold' | 'Silver' | 'Bronze'>('all');
  const [priSearch, setPriSearch] = useState('');
  const [churnFilter, setChurnFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [churnSearch, setChurnSearch] = useState('');
  const [activeHelpSection, setActiveHelpSection] = useState<'revenue' | 'turnout' | 'promotion' | 'retention' | null>(null);
  const [tuitionSearch, setTuitionSearch] = useState('');
  const [tuitionGroupFilter, setTuitionGroupFilter] = useState<'all' | 'early' | 'standard'>('all');

  // Active Session states
  const weekdays = WEEKDAY_NAMES_EN;
  const todayDayName = weekdays[new Date(academyToday+'T00:00:00Z').getUTCDay()];
  const todayDate = academyToday;

  const todayClasses = useMemo(() => {
    return state.classSessions.filter(c => {
      const days = Array.isArray(c.daysOfWeek) ? c.daysOfWeek : [c.dayOfWeek];
      return days.some(d => d.toLowerCase() === todayDayName.toLowerCase());
    });
  }, [state.classSessions, todayDayName]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  useEffect(() => {
    if (!todayClasses.some(session => session.id === selectedClassId)) setSelectedClassId(todayClasses[0]?.id ?? null);
  }, [todayClasses, selectedClassId]);

  // Active Session Hub Controls
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'all' | 'Unmarked' | 'Present' | 'Late' | 'Absent'>('all');

  const getLocalizedMonthName = (monthIndex: number, lang: string) => {
    if (lang === 'kh') {
      const khMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];
      return khMonths[monthIndex];
    } else if (lang === 'zh') {
      const zhMonths = [
        '一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'
      ];
      return zhMonths[monthIndex];
    }
    return MONTH_NAMES[monthIndex];
  };

  // --- DATA SCIENCE CALCULATORS ---

  // 1. Weekly Attendance heatmaps and densities
  const attendanceDensityStats = useMemo(() => {
    const records = state.attendanceRecords;
    if (records.length === 0) {
      return { optimalDay: 'No data', optimalRate: 0, lowDay: 'No data', lowRate: 0 };
    }

    const dayCounts = Array(7).fill(0);
    const dayPresents = Array(7).fill(0);

    records.forEach(r => {
      if (!r.date) return;
      const [year, month, day] = r.date.split('-').map(Number);
      const dayIdx = new Date(year, month - 1, day).getDay();
      dayCounts[dayIdx]++;
      if (r.status === 'Present' || r.status === 'Late') {
        dayPresents[dayIdx]++;
      }
    });

    const weekdayAverages = dayCounts.map((count, idx) => {
      return {
        day: weekdays[idx],
        rate: count > 0 ? Math.round((dayPresents[idx] / count) * 100) : 0,
        count
      };
    }).filter(d => d.count > 0);

    if (weekdayAverages.length === 0) {
      return { optimalDay: 'No data', optimalRate: 0, lowDay: 'No data', lowRate: 0 };
    }

    const sortedByTurnout = [...weekdayAverages].sort((a, b) => b.rate - a.rate);
    const optimal = sortedByTurnout[0];
    const lowest = sortedByTurnout[sortedByTurnout.length - 1];

    return {
      optimalDay: optimal.day,
      optimalRate: optimal.rate,
      lowDay: lowest.day,
      lowRate: lowest.rate
    };
  }, [state.attendanceRecords, weekdays]);

  // 2. Linear Regression Financial Forecaster
  const financialForecast = useMemo(() => {
    const currentMonthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
    const activeStudents = state.students.filter(s => s.studentStatus === 'Active');

    let expectedMonthlyRevenue = 0;
    let actualCollectedRevenue = 0;

    state.students.filter(student=>['Active','Paused'].includes(student.studentStatus)).forEach(student => {
      if (isMonthBeforeEnrollment(currentMonthName, currentYear, getStudentEnrollDate(student))) {
        return; // Skip, student was not enrolled in this billing month!
      }

      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const payment = state.payments.find(p => p.studentId === student.id && p.year === currentYear && p.month === currentMonthName);
      const cycle=tuitionCycle(student,`${currentYear}-${String(currentMonthIdx+1).padStart(2,'0')}`,payment,scholarship,state.classEnrollments,state.academyProfile);
      expectedMonthlyRevenue+=cycle.amount;actualCollectedRevenue+=cycle.cash;
    });

    const paidRecords = state.payments.filter(p => p.status === 'Paid');
    const unpaidRecords = state.payments.filter(p => p.status === 'Unpaid' || p.status === 'Pending');
    const totalPaymentsCount = paidRecords.length + unpaidRecords.length;
    const historicalEfficiency = totalPaymentsCount > 0 ? (paidRecords.length / totalPaymentsCount) : 0.88;

    const activeRatio = state.students.length > 0 ? (activeStudents.length / state.students.length) : 0.95;
    const predictedRevenue = expectedMonthlyRevenue * historicalEfficiency;

    return {
      expected: expectedMonthlyRevenue,
      actual: actualCollectedRevenue,
      predicted: predictedRevenue,
      historicalEfficiencyRate: Math.round(historicalEfficiency * 100),
      churnRatioPct: Math.round((1 - activeRatio) * 100)
    };
  }, [currentMonthIdx, state.students, state.payments, state.scholarships, state.classEnrollments, state.academyProfile, currentYear, getStudentEnrollDate]);

  const expectedMonthlyRevenue = financialForecast.expected;

  const predictedRevenueDynamic = useMemo(() => {
    const historicalEfficiency = financialForecast.historicalEfficiencyRate / 100;
    const sliderMultiplier = (100 - forecastChurnRate) / 100;
    return expectedMonthlyRevenue * historicalEfficiency * sliderMultiplier;
  }, [expectedMonthlyRevenue, financialForecast.historicalEfficiencyRate, forecastChurnRate]);

  // Unified SVG line coordinates & confidence bounds chart data
  const forecastChartData = useMemo(() => {
    const p1 = expectedMonthlyRevenue * 0.78;
    const p2 = expectedMonthlyRevenue * 0.82;
    const p3 = expectedMonthlyRevenue * 0.85;
    const p4 = financialForecast.actual > 0 ? financialForecast.actual : expectedMonthlyRevenue * 0.88;
    const p5 = predictedRevenueDynamic;

    const points = [p1, p2, p3, p4, p5];
    const maxVal = Math.max(...points, 1) * 1.15;

    const svgCoords = points.map((p, idx) => {
      const x = 10 + idx * 52;
      const y = 70 - (p / maxVal) * 55;
      return `${x},${y}`;
    }).join(' ');

    const lastCircleY = 70 - (p5 / maxVal) * 55;

    // Mathematically aligned shaded confidence bounds path
    const shadowPath = `M 10,${70 - (p1 * 0.95 / maxVal * 55)}
                        L 62,${70 - (p2 * 0.95 / maxVal * 55)}
                        L 114,${70 - (p3 * 0.95 / maxVal * 55)}
                        L 166,${70 - (p4 * 0.95 / maxVal * 55)}
                        L 218,${70 - (p5 * 1.1 / maxVal * 55)}
                        L 218,${70 - (p5 * 0.9 / maxVal * 55)}
                        L 166,${70 - (p4 * 1.05 / maxVal * 55)}
                        L 114,${70 - (p3 * 1.05 / maxVal * 55)}
                        L 62,${70 - (p2 * 1.05 / maxVal * 55)}
                        L 10,${70 - (p1 * 1.05 / maxVal * 55)} Z`;

    return {
      svgCoords,
      lastCircleY,
      shadowPath
    };
  }, [expectedMonthlyRevenue, financialForecast.actual, predictedRevenueDynamic]);

  const weeklyDensityBarData = useMemo(() => {
    const records = state.attendanceRecords;
    const dayCounts = Array(7).fill(0);
    const dayPresents = Array(7).fill(0);

    records.forEach(r => {
      if (!r.date) return;
      const [year, month, day] = r.date.split('-').map(Number);
      const dayIdx = new Date(year, month - 1, day).getDay();
      dayCounts[dayIdx]++;
      if (r.status === 'Present' || r.status === 'Late') {
        dayPresents[dayIdx]++;
      }
    });

    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayCounts.map((count, idx) => {
      const rate = count > 0 ? Math.round((dayPresents[idx] / count) * 100) : 0;
      return {
        dayName: shortDays[idx],
        rate,
        count
      };
    });
  }, [state.attendanceRecords]);

  const churnHazardRoster = useMemo(() => {
    const activeStudents = state.students.filter(s => s.studentStatus === 'Active');

    return activeStudents.map(student => {
      const riskReport = calculateChurnRisk(
        student,
        state.attendanceRecords,
        state.classEnrollments,
        state.classSessions,
        currentLocalTime
      );

      return {
        student,
        daysSinceLastClass: riskReport.daysSinceLastClass,
        lastDate: riskReport.lastDate,
        riskLevel: riskReport.riskLevel,
        cpi: riskReport.cpi,
        estimatedMissedClasses: riskReport.estimatedMissedClasses,
        recommendedAction: riskReport.recommendedAction,
        expectedWeeklyFrequency: riskReport.expectedWeeklyFrequency
      };
    })
    .filter(c => c.riskLevel === 'High' || c.riskLevel === 'Medium')
    .sort((a, b) => b.cpi - a.cpi);
  }, [state.students, state.attendanceRecords, state.classEnrollments, state.classSessions, currentLocalTime]);

  const helpContent = {
    revenue: {
      title: "Tuition Collection Forecaster (Linear Regression)",
      math: "Forecast = Expected Revenue × Historical Efficiency × (1 - Churn Rate)",
      read: [
        "Expected Revenue: Sum of active tuition contracts minus active waivers.",
        "Simulated Forecast: Projected collected revenue after applying compliance efficiency and churn multipliers.",
        "Predictive Line Chart: Plots data trend points. Shaded area represents standard deviation bounds."
      ],
      work: [
        "Use the simulator slider to stress-test your financials under high churn conditions (e.g., holidays).",
        "View outstanding alerts on the overview tab to collect overdue fees."
      ],
      story: "Tuition compliance determines academy runway. Early warnings flag payment friction before it affects operational budgets."
    },
    turnout: {
      title: "Attendance Density & Turnout Heatmap",
      math: "Turnout Density = (Present + Late / Scheduled Roster) × 100",
      read: [
        "Optimal Training Day: Day with the highest attendance rate.",
        "At-Risk Density Day: Day with the lowest turnout, showing engagement drop-offs.",
        "Weekly Density Bars: Day-by-day average turnout percentages."
      ],
      work: [
        "Optimize class schedule capacities: split overcrowded cohorts.",
        "Allocate extra assistant coaches to peak density days."
      ],
      story: "Mat congestion affects instruction quality. Turnout heatmap helps balance mat density and coach allocations."
    },
    promotion: {
      title: "Promotion Readiness Index (PRI) Analytics",
      math: "PRI = (Attendance Rate × 50%) + (Video Syllabus Progress × 50%)",
      read: [
        "Attendance Rate: Turnout frequency score over the past month.",
        "Syllabus Progress: Ratio of video lessons marked as completed.",
        "Tiers: Gold Candidate (PRI >= 80% - Ready), Silver Candidate (65%-79% - Needs Polishing), Bronze Candidate (< 65% - Unready)."
      ],
      work: [
        "Filter candidates by Belt Rank and Readiness Level.",
        "Click on Gold Candidates to review curriculum profiles and invite them to test."
      ],
      story: "Structured belt promotion maintains student motivation. PRI flags stuck students who are at high risk of losing interest."
    },
    retention: {
      title: "Student Churn Hazard & Retentivity Model",
      math: "Churn Hazard Risk = Days Since Last Logged Training Session",
      read: [
        "High Risk: Student has not checked into any class in 14+ days.",
        "Medium Risk: Student has not checked into a class in 7-13 days.",
        "Stable: Student attended a training session within the last 6 days."
      ],
      work: [
        "Filter list to isolate High Risk students.",
        "Access student emergency contacts to send a check-in message."
      ],
      story: "Member retention is key to academy growth. Spotting check-in gaps early lets you re-engage students before they withdraw."
    }
  };

  // 3. Promotion Readiness Index (PRI) dynamic analysis
  const promotionReadinessRoster = useMemo(() => {
    const activeStudents = state.students.filter(s => s.studentStatus === 'Active');

    const candidates = activeStudents.map(student => {
      const report = calculatePromotionReadiness(
        student,
        state.attendanceRecords,
        state.videoProgress,
        state.curriculumVideos,
        state.beltHistories,
        state.physicalEvaluations,
        state.beltTechniques
      );

      return {
        student,
        attendanceRate: report.attendanceProgress,
        syllabusProgress: report.syllabusCompletedPct,
        completedCount: report.completedVideos,
        pri: report.pri,
        rank: report.rank,
        report
      };
    });

    // Sort by PRI descending
    return candidates.sort((a, b) => b.pri - a.pri);
  }, [state.students, state.attendanceRecords, state.videoProgress, state.beltHistories, state.curriculumVideos, state.physicalEvaluations, state.beltTechniques]);

  // General KPIs
  const totalStudents = state.students.length;
  const activeStudents = state.students.filter(s => s.studentStatus === 'Active');
  const activeCount = activeStudents.length;
  const inactiveCount = totalStudents - activeCount;

  // Today's Attendance Snapshot
  const todayAttendance = state.attendanceRecords.filter(a => a.date === todayDate);
  const presentToday = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;

  let attendanceRate = 0;
  let isClassLoggedToday = true;

  if (todayAttendance.length === 0) {
    isClassLoggedToday = false;
    const sortedRecords = [...state.attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
    if (sortedRecords.length > 0) {
      const lastSessionDate = sortedRecords[0].date;
      const lastSessionAttendance = state.attendanceRecords.filter(a => a.date === lastSessionDate);
      const presentLastSession = lastSessionAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
      attendanceRate = lastSessionAttendance.length > 0 ? Math.round((presentLastSession / lastSessionAttendance.length) * 100) : 0;
    }
  } else {
    attendanceRate = todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : 0;
  }

  // 1.5. Turnout baseline & trend calculator
  const turnoutTrendStats = useMemo(() => {
    const records = state.attendanceRecords;
    if (records.length === 0) return { trend: 0, baseline: 75 };

    const activeSts = state.students.filter(s => s.studentStatus === 'Active');
    if (activeSts.length === 0) return { trend: 0, baseline: 75 };

    // Get list of records from past 30 days, excluding today to avoid today's partial check-in affecting baseline
    // Count back in academy calendar days so the window matches todayDate (UTC dates lag a day before 07:00 in Phnom Penh).
    const thirtyDaysAgoStr = addCalendarDays(todayDate, -30);

    const pastRecords = records.filter(r => r.date >= thirtyDaysAgoStr && r.date < todayDate);
    if (pastRecords.length === 0) return { trend: 0, baseline: 75 };

    // Group by date
    const recordsByDate: Record<string, { present: number; total: number }> = {};
    pastRecords.forEach(r => {
      if (!recordsByDate[r.date]) {
        recordsByDate[r.date] = { present: 0, total: 0 };
      }
      recordsByDate[r.date].total++;
      if (r.status === 'Present' || r.status === 'Late') {
        recordsByDate[r.date].present++;
      }
    });

    const rates = Object.values(recordsByDate).map(d => (d.present / d.total) * 100);
    const avgBaseline = rates.reduce((sum, val) => sum + val, 0) / rates.length;

    // Compare today's turnout with this baseline
    const trendDiff = attendanceRate - avgBaseline;

    return {
      trend: Number(trendDiff.toFixed(1)),
      baseline: Math.round(avgBaseline)
    };
  }, [state.attendanceRecords, state.students, attendanceRate, todayDate]);

  // Academy AI Health Score & 4 Core Pillars
  const healthScoreMetrics = useMemo(() => {
    // Both inputs already fall back to a neutral default when there is no data at all; a real
    // 0% (nobody attended, nothing collected) must stay 0 instead of reading as healthy.
    // Pillar 1: Turnout Attendance Score (0-100)
    const turnoutScore = Math.min(100, Math.max(0, turnoutTrendStats.baseline));

    // Pillar 2: Financial Compliance Efficiency (0-100)
    const financialScore = Math.min(100, Math.max(0, financialForecast.historicalEfficiencyRate));

    // Pillar 3: Testing Pipeline Readiness (0-100)
    const activeSts = state.students.filter(s => s.studentStatus === 'Active');
    const eligibleCount = promotionReadinessRoster.filter(c => c.rank === 'Gold' || c.rank === 'Silver').length;
    const testingPipelineScore = activeSts.length > 0 ? Math.min(100, Math.round((eligibleCount / activeSts.length) * 100)) : 70;

    // Pillar 4: Retention Guard (0-100)
    const highRiskCount = churnHazardRoster.filter(c => c.riskLevel === 'High').length;
    const highRiskPct = activeSts.length > 0 ? Math.round((highRiskCount / activeSts.length) * 100) : 0;
    const retentionScore = Math.max(0, 100 - highRiskPct * 2.5);

    // Overall Weighted AI Health Score (0-100)
    const compositeScore = Math.round(
      (turnoutScore * 0.3) +
      (financialScore * 0.3) +
      (testingPipelineScore * 0.2) +
      (retentionScore * 0.2)
    );

    let statusText = 'Optimal';
    let statusColor = 'text-green-600 dark:text-green-400';
    let badgeBg = 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
    if (compositeScore < 60) {
      statusText = 'Critical Alert';
      statusColor = 'text-red-600 dark:text-red-400';
      badgeBg = 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400';
    } else if (compositeScore < 75) {
      statusText = 'Needs Attention';
      statusColor = 'text-amber-600 dark:text-amber-400';
      badgeBg = 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400';
    } else if (compositeScore < 90) {
      statusText = 'Strong Performance';
      statusColor = 'text-blue-600 dark:text-blue-400';
      badgeBg = 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400';
    }

    return {
      overall: compositeScore,
      statusText,
      statusColor,
      badgeBg,
      turnoutScore,
      financialScore,
      testingPipelineScore,
      retentionScore,
      goldCount: promotionReadinessRoster.filter(c => c.rank === 'Gold').length,
      silverCount: promotionReadinessRoster.filter(c => c.rank === 'Silver').length,
      bronzeCount: promotionReadinessRoster.filter(c => c.rank === 'Bronze').length,
      highRiskCount,
      mediumRiskCount: churnHazardRoster.filter(c => c.riskLevel === 'Medium').length
    };
  }, [turnoutTrendStats.baseline, financialForecast.historicalEfficiencyRate, state.students, promotionReadinessRoster, churnHazardRoster]);

  const filteredPriCandidates = useMemo(() => {
    const q = priSearch.trim().toLowerCase();
    return promotionReadinessRoster.filter(c => {
      const matchesRank = priRankFilter === 'all' || c.rank === priRankFilter;
      const matchesSearch = !q ||
        c.student.englishName.toLowerCase().includes(q) ||
        (c.student.khmerName && c.student.khmerName.toLowerCase().includes(q)) ||
        c.student.id.toLowerCase().includes(q) ||
        (c.student.currentBelt && c.student.currentBelt.toLowerCase().includes(q));
      return matchesRank && matchesSearch;
    });
  }, [promotionReadinessRoster, priRankFilter, priSearch]);

  const filteredChurnHazards = useMemo(() => {
    const q = churnSearch.trim().toLowerCase();
    return churnHazardRoster.filter(h => {
      const matchesFilter = churnFilter === 'all' ||
        (churnFilter === 'high' ? h.riskLevel === 'High' : h.riskLevel === 'Medium');
      const matchesSearch = !q ||
        h.student.englishName.toLowerCase().includes(q) ||
        (h.student.khmerName && h.student.khmerName.toLowerCase().includes(q)) ||
        h.student.id.toLowerCase().includes(q) ||
        (h.student.currentBelt && h.student.currentBelt.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [churnHazardRoster, churnFilter, churnSearch]);

  const beltDistribution = useMemo(() => {
    const activeSts = state.students.filter(s => s.studentStatus === 'Active');
    const totalActive = activeSts.length || 1;

    const tiers = [
      { key: 'white', name: 'White', color: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200', barColor: 'bg-neutral-400 dark:bg-neutral-500' },
      { key: 'yellow', name: 'Yellow', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400', barColor: 'bg-yellow-500' },
      { key: 'green', name: 'Green', color: 'bg-green-500/20 text-green-700 dark:text-green-400', barColor: 'bg-green-500' },
      { key: 'blue', name: 'Blue', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400', barColor: 'bg-blue-500' },
      { key: 'brown_red', name: 'Brown / Red', color: 'bg-red-500/20 text-red-700 dark:text-red-400', barColor: 'bg-red-500' },
      { key: 'black_poom', name: 'Black / Poom', color: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900', barColor: 'bg-neutral-900 dark:bg-neutral-200' },
    ];

    const counts: Record<string, number> = {
      white: 0,
      yellow: 0,
      green: 0,
      blue: 0,
      brown_red: 0,
      black_poom: 0
    };

    activeSts.forEach(s => {
      const b = (s.currentBelt || '').toLowerCase();
      if (b.includes('dan') || b.includes('poom') || b.includes('black')) {
        counts.black_poom++;
      } else if (b.includes('red') || b.includes('brown')) {
        counts.brown_red++;
      } else if (b.includes('blue')) {
        counts.blue++;
      } else if (b.includes('green')) {
        counts.green++;
      } else if (b.includes('yellow')) {
        counts.yellow++;
      } else {
        counts.white++;
      }
    });

    return tiers.map(tier => ({
      ...tier,
      count: counts[tier.key],
      pct: Math.round((counts[tier.key] / totalActive) * 100)
    }));
  }, [state.students]);

  const getWhatsAppOutreachUrl = (student: Student, daysSince: number) => {
    const phone = student.emergencyContactPhone?.replace(/[^0-9]/g, '') || '';
    if (!phone) return null;
    const formattedPhone = phone.startsWith('0') ? `855${phone.slice(1)}` : phone;
    const message = encodeURIComponent(
      `Hello! We noticed that ${student.englishName} has missed recent Taekwondo sessions (${daysSince} days since last class) at Infinity TKD. We wanted to check in to see how everything is going and help get them back on the mat! 🥋`
    );
    return `https://wa.me/${formattedPhone}?text=${message}`;
  };

  // Pending Signups Intake Queue
  const pendingIntake = state.students.filter(s => s.studentStatus === 'Inactive');

  // Outstanding Payments List (Respects scholarship discounts and filters out 100% waivers)
  const unpaidTuition = state.students.filter(student => {
    if (student.studentStatus !== 'Active') return false;

    // Check if current month is before enrollment!
    const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
    if (isMonthBeforeEnrollment(currentMonthNameShort, currentYear, getStudentEnrollDate(student))) {
      return false; // Skip, student was not enrolled yet in this month!
    }

    const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
    const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
    const baseFee = isStudentEarlyGroup ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
    const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
    const requiredAmt = baseFee * (1 - discountPct / 100);

    if (requiredAmt <= 0) return false;
    const hasPaid = state.payments.some(p => p.studentId === student.id && p.month === ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx] && p.year === currentYear && p.status === 'Paid');
    return !hasPaid;
  });

  const filteredUnpaidTuition = useMemo(() => {
    return unpaidTuition.filter(student => {
      const matchesSearch = student.englishName.toLowerCase().includes(tuitionSearch.toLowerCase()) ||
                            (student.khmerName && student.khmerName.toLowerCase().includes(tuitionSearch.toLowerCase()));

      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const isEarly = scholarship?.typeName === 'Early Group Student';
      const matchesGroup = tuitionGroupFilter === 'all' ||
                            (tuitionGroupFilter === 'early' && isEarly) ||
                            (tuitionGroupFilter === 'standard' && !isEarly);

      return matchesSearch && matchesGroup;
    });
  }, [unpaidTuition, tuitionSearch, tuitionGroupFilter, state.scholarships]);

  const totalOutstandingAmount = useMemo(() => {
    return filteredUnpaidTuition.reduce((sum, student) => {
      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isStudentEarlyGroup ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
      const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const studentOwed = baseFee * (1 - discountPct / 100);
      return sum + studentOwed;
    }, 0);
  }, [filteredUnpaidTuition, state.academyProfile.earlyGroupTuitionUsd, state.academyProfile.standardTuitionUsd, state.scholarships]);

  // Student Birthday List Logic
  const getBirthdayMonth = (dob: string | undefined): number | null => {
    if (!dob) return null;
    const parts = dob.split('-');
    if (parts.length >= 2) {
      return parseInt(parts[1], 10) - 1;
    }
    return null;
  };

  const getBirthdayDay = (dob: string | undefined): string | null => {
    if (!dob) return null;
    const parts = dob.split('-');
    if (parts.length >= 3) {
      return parts[2];
    }
    return null;
  };

  const birthdayStudents = state.students.filter(s => {
    const bMonth = getBirthdayMonth(s.dob);
    return bMonth === selectedMonth;
  }).sort((a, b) => {
    const dayA = parseInt(getBirthdayDay(a.dob) || '0', 10);
    const dayB = parseInt(getBirthdayDay(b.dob) || '0', 10);
    return dayA - dayB;
  });

  const checkIsBirthdayToday = (dob: string | undefined): boolean => {
    if (!dob) return false;
    const parts = dob.split('-');
    if (parts.length >= 3) {
      return parts[1] === todayMonthStr && parts[2] === todayDateStr;
    }
    return false;
  };

  const calculateAge = (dob: string | undefined): number => {
    if (!dob) return 0;
    const birthYear = parseInt(dob.split('-')[0], 10);
    return currentYear - birthYear;
  };

  // Inactive means a student left or was deactivated (new students start Active), so this is a
  // reactivation that restarts monthly billing, not a sign-up approval: confirm it first.
  const handleApproveStudent = (studentId: string) => {
    const name = state.students.find(student => student.id === studentId)?.englishName ?? 'this student';
    showConfirm(`Reactivate ${name}? They return to class rosters and monthly tuition billing starts again from their next billing date.`, async () => {
      try {
        await updateStudent(studentId, { studentStatus: 'Active' });
        showNotification(`${name} is Active again.`, 'success');
      } catch (e) {
        console.error(e);
      }
    }, 'Reactivate student');
  };



  const activeClass = state.classSessions.find(c => c.id === selectedClassId);
  const enrolledStudentIds = state.classEnrollments
    .filter(e => e.classId === selectedClassId)
    .map(e => e.studentId);
  const classStudents = state.students.filter(s => enrolledStudentIds.includes(s.id) && s.studentStatus === 'Active');

  const presentCount = classStudents.filter(s => {
    const att = sessionMark(state.attendanceRecords, s.id, todayDate, selectedClassId);
    return att?.status === 'Present';
  }).length;
  const lateCount = classStudents.filter(s => {
    const att = sessionMark(state.attendanceRecords, s.id, todayDate, selectedClassId);
    return att?.status === 'Late';
  }).length;
  const absentCount = classStudents.filter(s => {
    const att = sessionMark(state.attendanceRecords, s.id, todayDate, selectedClassId);
    return att?.status === 'Absent';
  }).length;
  const unmarkedCount = classStudents.filter(s => {
    const att = sessionMark(state.attendanceRecords, s.id, todayDate, selectedClassId);
    return !att || !att.status;
  }).length;
  const attendedCount = presentCount + lateCount;
  const classTurnoutPct = classStudents.length > 0 ? Math.round((attendedCount / classStudents.length) * 100) : 0;

  const filteredClassStudents = useMemo(() => {
    return classStudents.filter(s => {
      const q = rosterSearch.trim().toLowerCase();
      const matchesSearch = !q ||
        s.englishName?.toLowerCase().includes(q) ||
        (s.khmerName && s.khmerName.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        (s.currentBelt && s.currentBelt.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const att = sessionMark(state.attendanceRecords, s.id, todayDate, selectedClassId);
      const status = att?.status || 'Unmarked';

      if (rosterStatusFilter === 'all') return true;
      if (rosterStatusFilter === 'Unmarked') return status === 'Unmarked';
      return status === rosterStatusFilter;
    });
  }, [classStudents, rosterSearch, rosterStatusFilter, state.attendanceRecords, todayDate, selectedClassId]);

  const handleMarkAllClassPresent = async () => {
    if(!canMarkAttendance||selectedClassId===null||attendanceActions.busy)return;
    const eligibleStudents=classStudents.filter(student=>{
      const enrollment=getStudentEnrollDate(student)?.split('T')[0];
      return !(enrollment&&todayDate<enrollment)&&sessionMark(state.attendanceRecords,student.id,todayDate,selectedClassId)?.status!=='Present';
    });
    if(!eligibleStudents.length){showNotification('No unmarked or non-present students need this change.','info');return;}
    if(await attendanceActions.markMany(eligibleStudents.map(student=>({studentId:student.id,date:todayDate,status:'Present',classId:selectedClassId}))))showNotification('Marked '+eligibleStudents.length+' students as Present.','success');
  };

  const handleUnmarkStudent = async (studentId: string) => {
    if(!canDeleteAttendance||selectedClassId===null)return;
    if(await attendanceActions.clear(todayDate,[studentId],selectedClassId))showNotification('Attendance status reset to Unmarked.','info');
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-12 text-neutral-900 dark:text-white sm:space-y-5">
      <PageHeader
        icon={<GraduationCap weight="bold" />}
        eyebrow={t('dash_center_title')}
        title={<>{t('dash_welcome_master')}, {state.currentUser?.displayName || 'Admin'}</>}
        description={t('dash_operations_sync')}
        actions={
          <div className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 shadow-xs">
            <CalendarBlank className="h-4 w-4 text-brand" aria-hidden="true" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
              {mounted ? currentLocalTime.toLocaleDateString(state.language === 'en' ? 'en-US' : state.language === 'zh' ? 'zh-CN' : 'km-KH', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
            </span>
          </div>
        }
      />

      <SegmentedTabs label="Dashboard views" value={dashboardTab} onChange={setDashboardTab} items={[
        { id: 'overview', label: t('dash_tab_roster_ops'), icon: <ChartBar /> },
        { id: 'intelligence', label: t('dash_tab_intelligence'), icon: <SparkleIcon className="text-brand" /> },
      ]} />

      {dashboardTab === 'overview' ? (
        <>
          {/* Core KPIs (2 columns on phones, 4 from tablets) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            <KpiCard
              label={t('dash_roster_strength')}
              value={<>{activeCount} <span className="text-xs font-medium text-ink-subtle">/ {totalStudents}</span></>}
              icon={<Users weight="bold" />}
              hint={<span className="flex flex-wrap justify-between gap-1 font-mono"><span className="font-bold text-emerald-700 dark:text-emerald-400">● {activeCount} {t('act_active')}</span><span>{inactiveCount} not active</span></span>}
            />
            {!canViewFinancials ? (
              <KpiCard
                label="Achievements"
                tone="amber"
                value={<>{state.achievements.length} <span className="text-xs font-medium text-ink-subtle">Placements</span></>}
                icon={<Crown weight="bold" />}
                hint={<span className="flex flex-wrap justify-between gap-1 font-mono"><span className="font-bold text-amber-700 dark:text-amber-400">● {state.achievements.filter(a => a.medalRank === 'Gold').length} Gold</span><span>{state.achievements.filter(a => a.medalRank === 'Silver' || a.medalRank === 'Bronze').length} S/B</span></span>}
              />
            ) : (
              <KpiCard
                label={t('dash_tuition_collection')}
                tone="green"
                value={<>{financialForecast.expected > 0 ? Math.round((financialForecast.actual / financialForecast.expected) * 100) : 100}% <span className="text-xs font-medium text-ink-subtle">{t('dash_collected')}</span></>}
                icon={<Coins weight="bold" />}
                hint={<span className="flex flex-wrap justify-between gap-1 font-mono"><span className="font-bold text-emerald-700 dark:text-emerald-400">${financialForecast.actual.toFixed(0)} {t('fin_paid')}</span><span>${(financialForecast.expected - financialForecast.actual).toFixed(0)} left</span></span>}
              />
            )}
            <KpiCard
              label={t('dash_turnout')}
              tone="blue"
              value={<span className="inline-flex items-baseline gap-1.5">{attendanceRate}%{turnoutTrendStats.trend !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[10px] font-bold leading-none",
                  turnoutTrendStats.trend > 0
                    ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "border-red-500/20 bg-red-500/15 text-red-700 dark:text-red-400"
                )}>
                  {turnoutTrendStats.trend > 0 ? '+' : ''}{turnoutTrendStats.trend}%
                  <TrendUp aria-hidden="true" className={cn("h-2.5 w-2.5", turnoutTrendStats.trend < 0 && "rotate-180")} />
                </span>
              )}</span>}
              icon={<CheckCircle weight="bold" />}
              hint={<span className="flex flex-wrap justify-between gap-1 font-mono">{isClassLoggedToday
                ? <><span className="font-bold text-blue-700 dark:text-blue-400">{presentToday} present</span><span>{activeCount - presentToday} unmarked</span></>
                : <><span className="text-blue-700 dark:text-blue-400">{t('dash_latest_session_turnout')}</span><span>no class</span></>}</span>}
            />
            <KpiCard
              label={t('dash_lms_engagement')}
              tone="violet"
              value={<>{state.videoProgress.filter(p => p.status === 'Completed').length} <span className="text-xs font-medium text-ink-subtle">done</span></>}
              icon={<Crown weight="bold" />}
              hint={<span className="flex flex-wrap justify-between gap-1 font-mono"><span className="font-bold text-violet-700 dark:text-violet-400">{state.curriculumVideos.length} syllabus</span><span>tracked</span></span>}
            />
          </div>

          {/* Live Session Command Hub & Active Roster */}
          <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] py-4 px-4 sm:px-5 relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,47,56,0.03)_0%,transparent_60%)] pointer-events-none" />

            {/* Header bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 dark:border-[#262626] pb-3 mb-4 gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EF2F38] animate-pulse"></span>
                  Live Session & Attendance Hub
                </h2>
                <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                  Select today&apos;s active training session, check in students, and review live attendance.
                </p>
              </div>

              {/* Quick session switch dropdown on mobile or selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono shrink-0">
                  {t('dash_select_session')}:
                </span>
                {todayClasses.length > 0 ? (
                  <select
                    aria-label="Dashboard class" value={selectedClassId || ''}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    className="w-full sm:w-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[8px] px-2.5 py-1.5 text-xs sm:text-[11px] min-h-[38px] sm:min-h-0 font-bold focus:outline-none focus:border-[#EF2F38]/50 shadow-sm cursor-pointer pointer-coarse:min-h-11"
                  >
                    {todayClasses.map(c => {
                      const enrolled = activeEnrollmentCounts.get(c.id) ?? 0;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.startTime} - {c.endTime}) • {enrolled}/{c.capacity || 0} Active
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 italic font-mono">
                    {t('dash_no_sessions_today')}
                  </span>
                )}
              </div>
            </div>

            {/* Two-Column Grid: Left 4 cols for Session Schedule cards, Right 8 cols for Live Roster Hub */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 4 Cols: Today's Scheduled Classes List */}
              <div className="lg:col-span-4 space-y-2.5 flex flex-col">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">
                    Today&apos;s Schedule ({todayClasses.length})
                  </span>
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono">
                    {new Date(todayDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-2 max-h-[190px] lg:max-h-[360px] overflow-y-auto pr-1">
                  {todayClasses.map(cls => {
                    const isSelected = cls.id === selectedClassId;
                    const enrolled = activeEnrollmentCounts.get(cls.id) ?? 0;

                    // Turnout for this specific class
                    const clsStudentIds = [...new Set(state.classEnrollments.filter(e => e.classId === cls.id && activeStudentIds.has(e.studentId)).map(e => e.studentId))];
                    const presentForCls = state.students.filter(s => clsStudentIds.includes(s.id) && s.studentStatus === 'Active').filter(s => {
                      const att = sessionMark(state.attendanceRecords, s.id, todayDate, cls.id);
                      return att?.status === 'Present' || att?.status === 'Late';
                    }).length;
                    const clsTurnoutPct = clsStudentIds.length > 0 ? Math.round((presentForCls / clsStudentIds.length) * 100) : 0;

                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={cn(
                          "p-3 rounded-[8px] border transition-all cursor-pointer text-left relative overflow-hidden group",
                          isSelected
                            ? "bg-white dark:bg-[#1A1A1A] border-[#EF2F38] shadow-sm ring-1 ring-[#EF2F38]/30"
                            : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-[#383838]"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#EF2F38]" />
                        )}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "text-xs font-bold truncate leading-tight",
                              isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-800 dark:text-neutral-200"
                            )}>
                              {cls.name}
                            </h4>
                            <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 shrink-0 text-[#EF2F38]" />
                              {cls.startTime} - {cls.endTime}
                              {cls.classType && <span>• {cls.classType}</span>}
                            </span>
                          </div>
                          <span className={cn(
                            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                            isSelected
                              ? "bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20"
                              : "bg-neutral-100 dark:bg-[#1E1E1E] text-neutral-600 dark:text-neutral-400"
                          )}>
                            {isSelected ? 'Active' : 'Select'}
                          </span>
                        </div>

                        {/* Occupancy and Turnout Bars */}
                        <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-[#222]">
                          <div className="flex items-center justify-between text-[9px] font-mono">
                            <span className="text-neutral-500 dark:text-neutral-400">
                              Enrolled: <strong className="text-neutral-800 dark:text-neutral-200">{enrolled}/{cls.capacity || '—'}</strong>
                            </span>
                            <span className="text-neutral-500 dark:text-neutral-400">
                              Turnout: <strong className={clsTurnoutPct >= 80 ? "text-green-600 dark:text-green-400" : "text-[#EF2F38]"}>{clsTurnoutPct}%</strong>
                            </span>
                          </div>
                          <div className="w-full h-1 bg-neutral-100 dark:bg-[#262626] rounded-full overflow-hidden flex">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                clsTurnoutPct >= 80 ? "bg-green-500" : clsTurnoutPct >= 50 ? "bg-amber-500" : "bg-[#EF2F38]"
                              )}
                              style={{ width: `${clsTurnoutPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {todayClasses.length === 0 && (
                    <div className="py-12 px-4 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-transparent">
                      <CalendarBlank className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        No classes scheduled for today.
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">
                        Check the Schedule Matrix to create or view sessions.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 8 Cols: Active Class Live Roster & Quick Actions */}
              <LiveRosterPanel
                absentCount={absentCount}
                activeClass={activeClass}
                attendanceActions={attendanceActions}
                canDeleteAttendance={canDeleteAttendance}
                canMarkAttendance={canMarkAttendance}
                classStudents={classStudents}
                classTurnoutPct={classTurnoutPct}
                filteredClassStudents={filteredClassStudents}
                getStudentEnrollDate={getStudentEnrollDate}
                handleMarkAllClassPresent={handleMarkAllClassPresent}
                handleUnmarkStudent={handleUnmarkStudent}
                lateCount={lateCount}
                presentCount={presentCount}
                rosterSearch={rosterSearch}
                rosterStatusFilter={rosterStatusFilter}
                selectedClassId={selectedClassId}
                setRosterSearch={setRosterSearch}
                setRosterStatusFilter={setRosterStatusFilter}
                state={state}
                t={t}
                todayDate={todayDate}
                translateBeltFormatted={translateBeltFormatted}
                unmarkedCount={unmarkedCount}
              />
            </div>
          </div>

          {/* Main Two-Column Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Covers 2 columns) */}
            {(canApproveIntake || canViewFinancials) ? (
              <div className="lg:col-span-2 space-y-6">
                {/* Pending Approvals Intake Queue */}
                {canApproveIntake && (
                  <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-sm">
                    <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-white dark:bg-[#0F0F0F] rounded-t-[8px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        <h2 className="text-xs font-bold uppercase tracking-widest">{t('dash_intake_queue')}</h2>
                      </div>
                      <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[9px] font-bold rounded-full font-mono">
                        {pendingIntake.length} {t('dash_waiting')}
                      </span>
                    </div>

                    <div className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-transparent">
                      {pendingIntake.slice(0, 4).map(student => (
                        <div key={student.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                          <div className="flex items-center gap-2.5">
                            <SafeImage
                              src={student.profilePicturePath}
                              alt={student.englishName}
                              containerClassName="w-7.5 h-7.5 rounded-[8px] bg-neutral-100 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                              fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                            />
                            <div>
                              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{student.englishName}</h4>
                              <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{student.id} • {t('stu_reg_date')} {student.registrationDate}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleApproveStudent(student.id)}
                            className="px-3 py-1.5 h-7.5 sm:h-8 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black text-[9px] font-black uppercase tracking-widest rounded-[6px] sm:rounded-[8px] transition-colors flex items-center justify-center sm:justify-start sm:w-fit gap-1 shadow-sm w-full cursor-pointer active:scale-95 touch-manipulation"
                          >
                            <span>{t('dash_approve_student')}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}

                      {pendingIntake.length === 0 && (
                        <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400 font-mono bg-white dark:bg-transparent rounded-b-[8px]">
                          {t('dash_no_pending')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Outstanding tuition alert logs */}
                {canViewFinancials && (
                  <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-sm">
                    <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#0F0F0F] rounded-t-[8px]">
                      <div className="flex items-center gap-2">
                        <div className="w-5.5 h-5.5 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
                          <Warning className="w-3 h-3 text-[#EF2F38] animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('dash_outstanding_tuition')}</h2>
                          <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('dash_ledger_sync')}</p>
                        </div>
                      </div>

                      {/* Summary Counter badge */}
                      <span className="px-1.5 py-0.5 bg-[#EF2F38]/5 border border-[#EF2F38]/15 text-[#EF2F38] text-[9px] font-bold rounded-full font-mono tracking-wide w-fit">
                        {filteredUnpaidTuition.length} Pending • ${totalOutstandingAmount.toFixed(2)} Outstanding
                      </span>
                    </div>

                    {/* Tuition Search & Filter Bar */}
                    <div className="px-3 py-2 bg-white dark:bg-[#070707] border-b border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row gap-2 items-center justify-between">
                      <div className="relative w-full sm:w-48">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                          <Users className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search name..."
                          value={tuitionSearch}
                          onChange={(e) => setTuitionSearch(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[6px] sm:rounded-[8px] pl-7 pr-2.5 h-8 sm:h-8.5 text-[11px] sm:text-xs font-semibold focus:outline-none focus:border-[#EF2F38]/50 placeholder-neutral-400 dark:placeholder-neutral-500 shadow-inner"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                        <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono">Group:</span>
                        <select
                          value={tuitionGroupFilter}
                          onChange={(e) => setTuitionGroupFilter(e.target.value as any)}
                          className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[6px] sm:rounded-[8px] px-2.5 h-8 sm:h-8.5 text-[11px] sm:text-xs font-bold focus:outline-none focus:border-[#EF2F38]/50 shadow-sm cursor-pointer"
                        >
                          <option value="all">{t('dash_all_groups')}</option>
                          <option value="Standard Class">Standard Class</option>
                          <option value="Special Class">Special Class</option>
                          <option value="Elite Team">Elite Team</option>
                          <option value="Scholarship Full">Scholarship Full</option>
                          <option value="Scholarship Half">Scholarship Half</option>
                        </select>
                      </div>
                    </div>

                    <div className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-transparent max-h-[350px] overflow-y-auto pr-1">
                      {filteredUnpaidTuition.map(student => {
                        const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                        const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
                        const baseFee = isStudentEarlyGroup ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
                        const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
                        const studentOwed = baseFee * (1 - discountPct / 100);

                        const getBeltColor = (belt: string) => {
                      const lower = belt.toLowerCase();
                      if (lower.includes('white')) return 'text-neutral-300 dark:text-neutral-600';
                      if (lower.includes('yellow')) return 'text-yellow-500';
                      if (lower.includes('green')) return 'text-green-500';
                      if (lower.includes('blue')) return 'text-blue-500';
                      if (lower.includes('brown')) return 'text-amber-700';
                      if (lower.includes('red')) return 'text-[#EF2F38]';
                      if (lower.includes('poom') || lower.includes('dan')) return 'text-neutral-900 dark:text-white';
                      return 'text-neutral-400';
                    };

                    const overdueDays = currentLocalTime.getDate();
                    const remindMessageText = `Hello! Friendly reminder from Infinity Taekwondo Academy: monthly tuition of $${studentOwed.toFixed(2)} for ${student.englishName} is currently outstanding for ${currentMonthName}. You can settle this during the next training class. Thank you! 🙏🥋`;

                    return (
                      <div
                        key={student.id}
                        className="group relative p-2 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] hover:border-red-500/30 dark:hover:border-red-500/25 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-l-3 border-l-[#EF2F38] dark:border-l-red-500/70"
                      >
                        {/* Student Identity and Information */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <SafeImage
                              src={student.profilePicturePath}
                              alt={student.englishName}
                              containerClassName="w-7.5 h-7.5 rounded-full bg-neutral-100 dark:bg-[#0A0A0A] border border-red-500/20 flex items-center justify-center overflow-hidden shadow-inner"
                              fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                            />
                            {/* Alert dot on avatar */}
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#EF2F38] border-2 border-white dark:border-[#0F0F0F] rounded-full animate-pulse" />
                          </div>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <h4 className="text-[11px] font-bold text-neutral-800 dark:text-neutral-300 leading-none truncate">{student.englishName}</h4>

                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-neutral-500 font-mono font-medium">
                              {/* Belt Rank with dot indicator */}
                              <span className="flex items-center gap-0.5">
                                <span className={cn("text-[9px] leading-none", getBeltColor(student.currentBelt))}>●</span>
                                <span>{translateBeltFormatted(student.currentBelt, student.dob)}</span>
                              </span>

                              <span className="text-neutral-300 dark:text-neutral-800">•</span>

                              {/* Billing Group */}
                              <span>
                                {isStudentEarlyGroup ? 'Early Group' : 'Standard'}
                              </span>

                              {/* Outreach Reminder Quick buttons */}
                              {student.emergencyContactPhone && (
                                <>
                                  <span className="text-neutral-300 dark:text-neutral-800">•</span>
                                  <div className="flex items-center gap-1 pl-0.5">
                                    <a
                                      href={`tel:${student.emergencyContactPhone}`}
                                      className="hover:text-[#EF2F38] transition-colors flex items-center gap-0.5"
                                      title={`Call Guardian: ${student.emergencyContactName} (${student.emergencyContactPhone})`}
                                    >
                                      <Phone className="w-2 h-2" />
                                      <span>Call {student.emergencyContactName}</span>
                                    </a>

                                    <a
                                      href={`https://api.whatsapp.com/send?phone=${student.emergencyContactPhone.replace(/\D/g, '')}&text=${encodeURIComponent(remindMessageText)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-green-600 dark:hover:text-green-400 transition-colors flex items-center gap-0.5"
                                      title={t('dash_remind')}
                                    >
                                      <PaperPlaneTilt className="w-2 h-2" />
                                      <span>{t('dash_remind')}</span>
                                    </a>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balance Due & Quick Pay Action */}
                        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 border-neutral-200 dark:border-[#262626] pt-1.5 md:pt-0 shrink-0">
                          <div className="text-left md:text-right">
                            <div className="flex items-center gap-1 md:justify-end">
                              <span className="text-[#EF2F38] font-bold text-xs font-mono tracking-tight leading-none">
                                ${studentOwed.toFixed(2)}
                              </span>
                              <span className="px-1 py-0.2 rounded bg-red-500/10 text-[#EF2F38] border border-red-500/20 text-[9px] font-bold uppercase tracking-wider font-mono">
                                {t('dash_overdue')}
                              </span>
                            </div>
                            <span className="block text-[9px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 font-bold">
                              {t('dash_unpaid_for')} {currentMonthName} • Overdue {overdueDays}d
                            </span>
                          </div>

                          {can('action:finance_record_payment') && <button
                            onClick={async () => {
                              const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
                              try {
                                  await payInvoice(student.id, currentYear, currentMonthNameShort, studentOwed);
                                  showNotification(`Successfully collected $${studentOwed.toFixed(2)} tuition for ${student.englishName}.`, 'success');
                              } catch (err) {
                                  console.error(err);
                              }
                            }}
                            className="px-2.5 sm:px-3 h-7.5 sm:h-8 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-[6px] sm:rounded-[8px] text-[9px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap touch-manipulation"
                            title="Quick Pay Invoice"
                          >
                            <Coins className="w-3 h-3" />
                            <span>{t('dash_quick_pay')}</span>
                          </button>}
                        </div>
                      </div>
                    );
                  })}

                  {filteredUnpaidTuition.length === 0 && (
                    <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400 font-mono border border-dashed border-neutral-200 dark:border-[#262626] bg-white dark:bg-transparent rounded-[8px]">
                      No matching outstanding tuition alerts found.
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            ) : null}

            {/* Right Column (Standard Sidebar Widgets) */}
            <div className="space-y-6">
              {/* THE BIRTHDAY CARD BOX */}
              <BirthdayPanel
                birthdayStudents={birthdayStudents}
                calculateAge={calculateAge}
                checkIsBirthdayToday={checkIsBirthdayToday}
                getBirthdayDay={getBirthdayDay}
                getLocalizedMonthName={getLocalizedMonthName}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                setWishStudent={setWishStudent}
                state={state}
                t={t}
                wishState={wishState}
              />

              {/* Dynamic Promotion eligibility widget using PRI */}
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-sm">
                <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] rounded-t-[8px] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-yellow-500" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('dash_promotion_readiness')}</h2>
                  </div>
                  <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono uppercase font-bold tracking-widest">
                    {t('dash_pri_ranked')}
                  </span>
                </div>

                <div className="p-3 space-y-2 bg-white dark:bg-transparent">
                  {promotionReadinessRoster.slice(0, 3).map(candidate => {
                    const report = (candidate as any).report;
                    return (
                      <div key={candidate.student.id} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-300 leading-none">{candidate.student.englishName}</span>
                            <span className={cn(
                              "px-1 py-0.2 rounded text-[9px] font-mono font-bold uppercase border",
                              candidate.rank === 'Gold' ? "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" :
                              candidate.rank === 'Silver' ? "bg-neutral-500/10 text-neutral-600 border-neutral-500/20" :
                              "bg-orange-500/10 text-orange-600 border-orange-500/20"
                            )}>
                              {t(`dash_${candidate.rank.toLowerCase()}_candidate` as any)} ({candidate.pri}%)
                            </span>
                          </div>
                          <span className="px-1 py-0.2 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[3px] text-[9px] font-bold uppercase font-mono">
                            {translateBeltFormatted(candidate.student.currentBelt, candidate.student.dob)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[9px] font-mono border-t border-neutral-100 dark:border-[#1A1A1A] pt-1.5">
                          <div className="flex items-center gap-1">
                            <Clock className={cn("w-3 h-3 shrink-0", report?.daysEligible ? "text-green-500" : "text-neutral-400")} />
                            <span className={report?.daysEligible ? "text-neutral-700 dark:text-neutral-300 font-bold" : "text-neutral-400"}>
                              Time: {report?.daysElapsed}d / {report?.daysRequired}d
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className={cn("w-3 h-3 shrink-0", report?.attendanceEligible ? "text-green-500" : "text-neutral-400")} />
                            <span className={report?.attendanceEligible ? "text-neutral-700 dark:text-neutral-300 font-bold" : "text-neutral-400"}>
                              Class: {report?.attendanceSince} / {report?.attendanceRequired}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Play className={cn("w-3 h-3 shrink-0", report?.syllabusEligible ? "text-green-500" : "text-neutral-400")} />
                            <span className={report?.syllabusEligible ? "text-neutral-700 dark:text-neutral-300 font-bold" : "text-neutral-400"}>
                              Videos: {report?.syllabusCompletedPct}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className={cn("w-3 h-3 shrink-0", report?.physicalEligible ? "text-green-500" : "text-neutral-400")} />
                            <span className={report?.physicalEligible ? "text-neutral-700 dark:text-neutral-300 font-bold" : "text-neutral-400"}>
                              Skills: {report?.skillsGradedCount}/{report?.totalSkillsCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {state.students.length === 0 && (
                    <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 italic py-4">{t('dash_no_students')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <IntelligenceCenter
          activeCount={activeCount}
          attendanceDensityStats={attendanceDensityStats}
          beltDistribution={beltDistribution}
          canViewFinancials={canViewFinancials}
          churnFilter={churnFilter}
          churnHazardRoster={churnHazardRoster}
          churnSearch={churnSearch}
          expectedMonthlyRevenue={expectedMonthlyRevenue}
          filteredChurnHazards={filteredChurnHazards}
          filteredPriCandidates={filteredPriCandidates}
          financialForecast={financialForecast}
          forecastChartData={forecastChartData}
          forecastChurnRate={forecastChurnRate}
          getWhatsAppOutreachUrl={getWhatsAppOutreachUrl}
          healthScoreMetrics={healthScoreMetrics}
          predictedRevenueDynamic={predictedRevenueDynamic}
          priRankFilter={priRankFilter}
          priSearch={priSearch}
          promotionReadinessRoster={promotionReadinessRoster}
          setActiveHelpSection={setActiveHelpSection}
          setChurnFilter={setChurnFilter}
          setChurnSearch={setChurnSearch}
          setForecastChurnRate={setForecastChurnRate}
          setPriRankFilter={setPriRankFilter}
          setPriSearch={setPriSearch}
          t={t}
          translateBeltFormatted={translateBeltFormatted}
          weeklyDensityBarData={weeklyDensityBarData}
        />
      )}
      {/* Guide Modals */}
      {activeHelpSection && (
        <MetricGuideDialog
          activeHelpSection={activeHelpSection}
          helpContent={helpContent}
          setActiveHelpSection={setActiveHelpSection}
          t={t}
        />
      )}

      {/* Birthday Greeting Modal */}
      <AnimatePresence>
        {wishStudent && (
          <BirthdayWishActionModal
            student={wishStudent}
            onClose={() => setWishStudent(null)}
            onMarkSent={() => {
              setWishState(prev => ({ ...prev, [wishStudent.id]: 'sent' }));
              setWishStudent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
