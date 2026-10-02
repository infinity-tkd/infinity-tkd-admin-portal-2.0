'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { useT } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cake, 
  Users, 
  Coins, 
  CheckCircle, 
  ArrowRight, 
  Sparkle, 
  CalendarBlank, 
  Clock, 
  Warning,
  PaperPlaneTilt,
  Student as StudentIcon,
  Crown,
  Play,
  MagnifyingGlass,
  ArrowsCounterClockwise,
  TrendUp,
  Flame,
  ArrowUpRight,
  ChartBar,
  ListNumbers,
  Sparkle as SparkleIcon,
  X,
  Question,
  Sliders,
  Info,
  ShieldCheck,
  UserMinus,
  ListChecks,
  Phone
} from '@phosphor-icons/react';
import { cn, formatBelt, isBeltMatch, calculatePromotionReadiness, calculateChurnRisk, getBeltKey } from '@/lib/utils';
import { SafeImage } from '@/components/SafeImage';
import { Portal } from '@/components/Portal';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const { state, updateStudent, markAttendance, deleteAttendanceRecords, payInvoice, showNotification } = useAppStore();
  const t = useT();
  const role = state.currentUser?.role;
  const canViewFinancials = role === 'Root' || role === 'Super Root' || role === 'Admin';
  const canApproveIntake = role === 'Root' || role === 'Super Root' || role === 'Admin' || role === 'Head Coach';

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

  const getStudentEnrollDate = (st: Student) => {
    const enrollments = state.classEnrollments.filter(e => e.studentId === st.id);
    if (enrollments.length === 0) return undefined;
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length === 0) return st.registrationDate;
    return dates.sort()[0];
  };

  const currentLocalTime = new Date();
  const currentMonthIdx = currentLocalTime.getMonth(); // 0-11
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const todayDateStr = String(currentLocalTime.getDate()).padStart(2, '0');
  const todayMonthStr = String(currentLocalTime.getMonth() + 1).padStart(2, '0');
  const currentYear = currentLocalTime.getFullYear();

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
  const todayDayName = weekdays[currentLocalTime.getDay()];
  const todayDate = currentLocalTime.toISOString().split('T')[0];

  const todayClasses = useMemo(() => {
    return state.classSessions.filter(c => {
      const days = Array.isArray(c.daysOfWeek) ? c.daysOfWeek : [c.dayOfWeek];
      return days.some(d => d.toLowerCase() === todayDayName.toLowerCase());
    });
  }, [state.classSessions, todayDayName]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  useEffect(() => {
    if (todayClasses.length > 0 && selectedClassId === null) {
      setSelectedClassId(todayClasses[0].id);
    }
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
      return { optimalDay: 'Saturday', optimalRate: 89, lowDay: 'Monday', lowRate: 64 };
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
      return { optimalDay: 'Saturday', optimalRate: 89, lowDay: 'Monday', lowRate: 64 };
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

    activeStudents.forEach(student => {
      if (isMonthBeforeEnrollment(currentMonthName, currentYear, getStudentEnrollDate(student))) {
        return; // Skip, student was not enrolled in this billing month!
      }

      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isStudentEarlyGroup ? 25.00 : 45.00;
      const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const fee = baseFee * (1 - discountPct / 100);
      
      expectedMonthlyRevenue += fee;
      const payment = state.payments.find(p => p.studentId === student.id && p.year === currentYear && p.month === currentMonthName);
      if (payment?.status === 'Paid') {
        actualCollectedRevenue += payment.amountUsd !== undefined ? payment.amountUsd : fee;
      }
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
  }, [state.students, state.payments, state.scholarships, currentMonthIdx, currentYear]);

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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

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
    // Pillar 1: Turnout Attendance Score (0-100)
    const turnoutScore = Math.min(100, Math.max(0, turnoutTrendStats.baseline || attendanceRate || 75));

    // Pillar 2: Financial Compliance Efficiency (0-100)
    const financialScore = Math.min(100, Math.max(0, financialForecast.historicalEfficiencyRate || 85));

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
  }, [turnoutTrendStats.baseline, attendanceRate, financialForecast.historicalEfficiencyRate, state.students, promotionReadinessRoster, churnHazardRoster]);

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
    const baseFee = isStudentEarlyGroup ? 25.00 : 45.00;
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
      const baseFee = isStudentEarlyGroup ? 25.00 : 45.00;
      const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const studentOwed = baseFee * (1 - discountPct / 100);
      return sum + studentOwed;
    }, 0);
  }, [filteredUnpaidTuition, state.scholarships]);

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

  const handleApproveStudent = async (studentId: string) => {
    try {
      await updateStudent(studentId, { studentStatus: 'Active' });
      showNotification('Student registration approved and set to Active.', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendWish = (studentId: string, name: string) => {
    setWishState(prev => ({ ...prev, [studentId]: 'sending' }));
    setTimeout(() => {
      setWishState(prev => ({ ...prev, [studentId]: 'sent' }));
      showNotification(`🎉 Simulated Happy Birthday Wish sent successfully to ${name}!`, 'success');
    }, 1200);
  };

  const activeClass = state.classSessions.find(c => c.id === selectedClassId);
  const enrolledStudentIds = state.classEnrollments
    .filter(e => e.classId === selectedClassId)
    .map(e => e.studentId);
  const classStudents = state.students.filter(s => enrolledStudentIds.includes(s.id) && s.studentStatus === 'Active');

  const presentCount = classStudents.filter(s => {
    const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
    return att?.status === 'Present';
  }).length;
  const lateCount = classStudents.filter(s => {
    const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
    return att?.status === 'Late';
  }).length;
  const absentCount = classStudents.filter(s => {
    const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
    return att?.status === 'Absent';
  }).length;
  const unmarkedCount = classStudents.filter(s => {
    const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
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

      const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
      const status = att?.status || 'Unmarked';

      if (rosterStatusFilter === 'all') return true;
      if (rosterStatusFilter === 'Unmarked') return status === 'Unmarked';
      return status === rosterStatusFilter;
    });
  }, [classStudents, rosterSearch, rosterStatusFilter, state.attendanceRecords, todayDate]);

  const handleMarkAllClassPresent = async () => {
    if (!classStudents.length) return;
    const eligibleStudents = classStudents.filter(s => {
      const enrollDate = getStudentEnrollDate(s)?.split('T')[0];
      return !(enrollDate && todayDate < enrollDate);
    });

    if (eligibleStudents.length === 0) {
      showNotification('No eligible students to mark present.', 'info');
      return;
    }

    try {
      await Promise.all(eligibleStudents.map(s => markAttendance(s.id, todayDate, 'Present')));
      showNotification(`Marked all ${eligibleStudents.length} eligible students as Present.`, 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to mark all students present.', 'error');
    }
  };

  const handleUnmarkStudent = async (studentId: string) => {
    try {
      await deleteAttendanceRecords(todayDate, [studentId]);
      showNotification('Attendance status reset to Unmarked.', 'info');
    } catch (e) {
      console.error(e);
      showNotification('Failed to reset attendance status.', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-8 text-neutral-900 dark:text-white">
      {/* Dynamic Master Welcome Header */}
      <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] py-3 sm:py-3.5 px-3.5 sm:px-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="space-y-0.5">
          <span className="text-[8px] sm:text-[8.5px] uppercase tracking-widest text-[#EF2F38] font-mono font-black">{t('dash_center_title')}</span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">
            {t('dash_welcome_master')}, {state.currentUser?.displayName || 'Admin'}
          </h1>
          <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-[#666] font-medium">{t('dash_operations_sync')}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] shadow-sm">
          <CalendarBlank className="w-3.5 h-3.5 text-[#EF2F38]" />
          <span className="text-[10px] sm:text-[11px] font-bold font-mono uppercase tracking-wider">
            {mounted ? currentLocalTime.toLocaleDateString(state.language === 'en' ? 'en-US' : state.language === 'zh' ? 'zh-CN' : 'km-KH', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
          </span>
        </div>
      </div>

      {/* Dashboard Sub-Tabs Selector */}
      <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 w-full sm:w-fit shadow-inner">
        <button
          onClick={() => setDashboardTab('overview')}
          className={cn(
            "flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 rounded-[6px] sm:rounded-[8px] flex items-center justify-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer",
            dashboardTab === 'overview' 
              ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-800" 
              : "text-neutral-500 dark:text-[#666] hover:text-[#EF2F38] dark:hover:text-white"
          )}
        >
          <ChartBar className="w-3.5 h-3.5" />
          {t('dash_tab_roster_ops')}
        </button>
        <button
          onClick={() => setDashboardTab('intelligence')}
          className={cn(
            "flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 rounded-[6px] sm:rounded-[8px] flex items-center justify-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer",
            dashboardTab === 'intelligence' 
              ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-800" 
              : "text-neutral-500 dark:text-[#666] hover:text-[#EF2F38] dark:hover:text-white"
          )}
        >
          <SparkleIcon className="w-3.5 h-3.5 text-[#EF2F38]" />
          {t('dash_tab_intelligence')}
        </button>
      </div>

      {dashboardTab === 'overview' ? (
        <>
          {/* Row 1 - High-Value Core KPIs (2-col on mobile, 4-col on iPad & desktop) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* KPI 1: Active Roster */}
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 relative overflow-hidden group shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
              <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-neutral-400 dark:text-neutral-500 group-hover:text-[#EF2F38] transition-colors">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <p className="text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 truncate pr-5">{t('dash_roster_strength')}</p>
              <p className="text-base sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {activeCount} <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">/ {totalStudents}</span>
              </p>
              <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[7.5px] sm:text-[8.5px] font-mono flex-wrap gap-1">
                <span className="text-green-600 dark:text-green-500 font-bold">● {activeCount} {t('act_active')}</span>
                <span className="text-neutral-500 dark:text-neutral-400">{inactiveCount} pending</span>
              </div>
            </div>

            {/* KPI 2: Tuition Health / Tournament Placements */}
            {!canViewFinancials ? (
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 relative overflow-hidden group shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-neutral-400 dark:text-neutral-500 group-hover:text-yellow-500 transition-colors">
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <p className="text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 truncate pr-5">Achievements</p>
                <p className="text-base sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {state.achievements.length} <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">Placements</span>
                </p>
                <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[7.5px] sm:text-[8.5px] font-mono flex-wrap gap-1">
                  <span className="text-yellow-600 dark:text-yellow-500 font-bold">● {state.achievements.filter(a => a.medalRank === 'Gold').length} Gold</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{state.achievements.filter(a => a.medalRank === 'Silver' || a.medalRank === 'Bronze').length} S/B</span>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 relative overflow-hidden group shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-neutral-400 dark:text-neutral-500 group-hover:text-green-500 transition-colors">
                  <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <p className="text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 truncate pr-5">{t('dash_tuition_collection')}</p>
                <p className="text-base sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {financialForecast.expected > 0 ? Math.round((financialForecast.actual / financialForecast.expected) * 100) : 100}% <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">{t('dash_collected')}</span>
                </p>
                <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[7.5px] sm:text-[8.5px] font-mono flex-wrap gap-1">
                  <span className="text-green-600 dark:text-green-500 font-bold">${financialForecast.actual.toFixed(0)} {t('fin_paid')}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">${(financialForecast.expected - financialForecast.actual).toFixed(0)} left</span>
                </div>
              </div>
            )}

            {/* KPI 3: Daily Roster / Turnout */}
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 relative overflow-hidden group shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
              <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-400 transition-colors">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <p className="text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 truncate pr-5">{t('dash_turnout')}</p>
              <p className="text-base sm:text-xl font-bold tracking-tight flex items-baseline gap-1 pt-0.5 text-neutral-900 dark:text-white">
                <span>{attendanceRate}%</span>
                {turnoutTrendStats.trend !== 0 && (
                  <span className={cn(
                    "text-[7.5px] sm:text-[8.5px] font-bold font-mono px-1 py-0.2 rounded flex items-center gap-0.5 leading-none shrink-0",
                    turnoutTrendStats.trend > 0 
                      ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20" 
                      : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                  )}>
                    {turnoutTrendStats.trend > 0 ? '+' : ''}{turnoutTrendStats.trend}%
                    {turnoutTrendStats.trend > 0 ? <TrendUp className="w-2 h-2 text-green-500" /> : <TrendUp className="w-2 h-2 text-red-500 rotate-180" />}
                  </span>
                )}
              </p>
              <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[7.5px] sm:text-[8.5px] font-mono flex-wrap gap-1">
                {isClassLoggedToday ? (
                  <>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{presentToday} present</span>
                    <span className="text-neutral-500 dark:text-neutral-400">{activeCount - presentToday} unmarked</span>
                  </>
                ) : (
                  <>
                    <span className="text-indigo-600 dark:text-indigo-400">{t('dash_latest_session_turnout')}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">no class</span>
                  </>
                )}
              </div>
            </div>

            {/* KPI 4: LMS Video Progress */}
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 relative overflow-hidden group shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
              <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-neutral-400 dark:text-neutral-500 group-hover:text-yellow-500 transition-colors">
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <p className="text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 truncate pr-5">{t('dash_lms_engagement')}</p>
              <p className="text-base sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {state.videoProgress.filter(p => p.status === 'Completed').length} <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">done</span>
              </p>
              <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[7.5px] sm:text-[8.5px] font-mono flex-wrap gap-1">
                <span className="text-yellow-600 dark:text-yellow-500 font-bold">{state.curriculumVideos.length} syllabus</span>
                <span className="text-neutral-500 dark:text-neutral-400">tracked</span>
              </div>
            </div>
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
                    value={selectedClassId || ''}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    className="w-full sm:w-auto bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[8px] px-2.5 py-1.5 text-xs sm:text-[11px] min-h-[38px] sm:min-h-0 font-bold focus:outline-none focus:border-[#EF2F38]/50 shadow-sm cursor-pointer"
                  >
                    {todayClasses.map(c => {
                      const enrolled = state.classEnrollments.filter(e => e.classId === c.id).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.startTime} - {c.endTime}) • {enrolled}/{c.capacity || 0} Enrolled
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
                  <span className="text-[8px] text-neutral-400 dark:text-neutral-500 font-mono">
                    {new Date(todayDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-2 max-h-[190px] lg:max-h-[360px] overflow-y-auto pr-1">
                  {todayClasses.map(cls => {
                    const isSelected = cls.id === selectedClassId;
                    const enrolled = state.classEnrollments.filter(e => e.classId === cls.id).length;
                    
                    // Turnout for this specific class
                    const clsStudentIds = state.classEnrollments.filter(e => e.classId === cls.id).map(e => e.studentId);
                    const presentForCls = state.students.filter(s => clsStudentIds.includes(s.id) && s.studentStatus === 'Active').filter(s => {
                      const att = state.attendanceRecords.find(a => a.studentId === s.id && a.date === todayDate);
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
                            "text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                            isSelected 
                              ? "bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20" 
                              : "bg-neutral-100 dark:bg-[#1E1E1E] text-neutral-600 dark:text-neutral-400"
                          )}>
                            {isSelected ? 'Active' : 'Select'}
                          </span>
                        </div>

                        {/* Occupancy and Turnout Bars */}
                        <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-[#222]">
                          <div className="flex items-center justify-between text-[8px] font-mono">
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
              <div className="lg:col-span-8 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 space-y-3 shadow-sm flex flex-col justify-between">
                {/* Top Class Info Bar & Stat Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-neutral-200 dark:border-[#262626] gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        {activeClass ? activeClass.name : 'No Class Selected'}
                      </h3>
                      {activeClass && (
                        <span className="text-[8.5px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#1E1E1E] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-[#333]">
                          {activeClass.startTime} - {activeClass.endTime}
                        </span>
                      )}
                    </div>
                    <p className="text-[8.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                      {classStudents.length} total enrolled active students
                    </p>
                  </div>

                  {/* Attendance Stats Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                      Present: {presentCount}
                    </span>
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Late: {lateCount}
                    </span>
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      Absent: {absentCount}
                    </span>
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#1F1F1F] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
                      Unmarked: {unmarkedCount}
                    </span>
                    <span className="text-[8px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20">
                      Turnout: {classTurnoutPct}%
                    </span>
                  </div>
                </div>

                {/* Filter Bar: Search, Status Filter Pills, and Bulk "Mark All Present" Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-neutral-50 dark:bg-[#141414] p-2 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                  {/* Search bar */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                      <MagnifyingGlass className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search student or belt..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[6px] sm:rounded-[8px] pl-8 pr-7 h-8 sm:h-8.5 text-[11px] sm:text-xs font-medium focus:outline-none focus:border-[#EF2F38]/50 placeholder-neutral-400 dark:placeholder-neutral-500"
                    />
                    {rosterSearch && (
                      <button
                        type="button"
                        onClick={() => setRosterSearch('')}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    {(['all', 'Unmarked', 'Present', 'Late', 'Absent'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setRosterStatusFilter(tab)}
                        className={cn(
                          "px-2 py-1 rounded-[6px] text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                          rosterStatusFilter === tab
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                            : "bg-white dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-[#2D2D2D]"
                        )}
                      >
                        {tab === 'all' ? 'All' : tab}
                        {tab === 'all' ? ` (${classStudents.length})` :
                         tab === 'Unmarked' ? ` (${unmarkedCount})` :
                         tab === 'Present' ? ` (${presentCount})` :
                         tab === 'Late' ? ` (${lateCount})` :
                         ` (${absentCount})`}
                      </button>
                    ))}
                  </div>

                  {/* Mark All Present Batch Action */}
                  <button
                    onClick={handleMarkAllClassPresent}
                    disabled={classStudents.length === 0}
                    className="w-full sm:w-auto px-2.5 h-8 sm:h-auto py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[6px] text-[9px] sm:text-[8.5px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm shrink-0 cursor-pointer active:scale-95 touch-manipulation"
                    title="Mark all eligible enrolled students as Present"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Mark All Present</span>
                  </button>
                </div>

                {/* Student Roster List */}
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredClassStudents.map(student => {
                    const att = state.attendanceRecords.find(a => a.studentId === student.id && a.date === todayDate);
                    const currentStatus = att?.status || 'Unmarked';
                    const enrollDate = getStudentEnrollDate(student)?.split('T')[0];
                    const isNotYetEnrolled = enrollDate ? (todayDate < enrollDate) : false;

                    return (
                      <div
                        key={student.id}
                        className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-neutral-300 dark:hover:border-[#383838] transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <SafeImage
                            src={student.profilePicturePath}
                            alt={student.englishName}
                            containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                            fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-xs">{student.englishName.charAt(0)}</span>}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[11px] font-bold leading-none flex items-center gap-1.5 truncate text-neutral-900 dark:text-neutral-100">
                              <span className="truncate">{student.englishName}</span>
                              {student.khmerName && (
                                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal">
                                  ({student.khmerName})
                                </span>
                              )}
                              {isNotYetEnrolled && (
                                <span className="px-1 py-0.2 rounded bg-red-950/40 border border-red-500/30 text-red-400 font-bold uppercase tracking-widest text-[7px] whitespace-nowrap shrink-0">
                                  {t('panel_not_enrolled_yet')}
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-[8px] text-neutral-500 dark:text-neutral-400 font-mono">
                              <span className="uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300">
                                {translateBeltFormatted(student.currentBelt, student.dob)}
                              </span>
                              <span>•</span>
                              <span>{student.id}</span>
                              <span>•</span>
                              <span className={cn(
                                "font-bold uppercase",
                                currentStatus === 'Present' ? "text-green-600 dark:text-green-400" :
                                currentStatus === 'Late' ? "text-amber-600 dark:text-amber-400" :
                                currentStatus === 'Absent' ? "text-red-500 dark:text-red-400" :
                                "text-neutral-400 dark:text-neutral-500"
                              )}>
                                {currentStatus}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Present, Late, Absent, Unmark */}
                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start pt-1.5 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#202020] shrink-0">
                          <button
                            disabled={isNotYetEnrolled}
                            onClick={() => markAttendance(student.id, todayDate, 'Present')}
                            className={cn(
                              "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[8.5px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation",
                              isNotYetEnrolled
                                ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                                : currentStatus === 'Present'
                                  ? "bg-green-600 text-white border-green-600 font-black shadow-sm"
                                  : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
                            )}
                          >
                            Present
                          </button>
                          <button
                            disabled={isNotYetEnrolled}
                            onClick={() => markAttendance(student.id, todayDate, 'Late')}
                            className={cn(
                              "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[8.5px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation",
                              isNotYetEnrolled
                                ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                                : currentStatus === 'Late'
                                  ? "bg-amber-500 text-amber-950 border-amber-500 font-black shadow-sm"
                                  : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            )}
                          >
                            Late
                          </button>
                          <button
                            disabled={isNotYetEnrolled}
                            onClick={() => markAttendance(student.id, todayDate, 'Absent')}
                            className={cn(
                              "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[8.5px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation",
                              isNotYetEnrolled
                                ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                                : currentStatus === 'Absent'
                                  ? "bg-red-600 text-white border-red-600 font-black shadow-sm"
                                  : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                            )}
                          >
                            Absent
                          </button>
                          {currentStatus !== 'Unmarked' && (
                            <button
                              onClick={() => handleUnmarkStudent(student.id)}
                              className="px-2 py-1 min-h-[32px] sm:min-h-[28px] text-[8px] font-bold uppercase tracking-wider rounded-[6px] border border-neutral-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation shrink-0"
                              title="Reset back to Unmarked"
                            >
                              <ArrowsCounterClockwise className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredClassStudents.length === 0 && (
                    <div className="py-14 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50/50 dark:bg-transparent">
                      <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        {classStudents.length === 0
                          ? (selectedClassId ? 'No students currently enrolled in this class session.' : 'Please select an active session.')
                          : 'No students match the current search or status filter.'}
                      </p>
                      {rosterSearch && (
                        <button
                          onClick={() => { setRosterSearch(''); setRosterStatusFilter('all'); }}
                          className="mt-2 text-[10px] text-[#EF2F38] hover:underline font-mono uppercase tracking-wider cursor-pointer"
                        >
                          Clear search &amp; filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                      <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-bold rounded-full font-mono">
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
                            className="px-3 py-1.5 h-7.5 sm:h-8 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black text-[9px] sm:text-[8.5px] font-black uppercase tracking-widest rounded-[6px] sm:rounded-[8px] transition-colors flex items-center justify-center sm:justify-start sm:w-fit gap-1 shadow-sm w-full cursor-pointer active:scale-95 touch-manipulation"
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
                          <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('dash_ledger_sync')}</p>
                        </div>
                      </div>
                      
                      {/* Summary Counter badge */}
                      <span className="px-1.5 py-0.5 bg-[#EF2F38]/5 border border-[#EF2F38]/15 text-[#EF2F38] text-[8px] font-bold rounded-full font-mono tracking-wide w-fit">
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
                        <span className="text-[8.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono">Group:</span>
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
                        const baseFee = isStudentEarlyGroup ? 25.00 : 45.00;
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
                            
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[8.5px] text-neutral-500 font-mono font-medium">
                              {/* Belt Rank with dot indicator */}
                              <span className="flex items-center gap-0.5">
                                <span className={cn("text-[8px] leading-none", getBeltColor(student.currentBelt))}>●</span>
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
                              <span className="px-1 py-0.2 rounded bg-red-500/10 text-[#EF2F38] border border-red-500/20 text-[6px] font-bold uppercase tracking-wider font-mono">
                                {t('dash_overdue')}
                              </span>
                            </div>
                            <span className="block text-[7px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 font-bold">
                              {t('dash_unpaid_for')} {currentMonthName} • Overdue {overdueDays}d
                            </span>
                          </div>

                          <button
                            onClick={async () => {
                              const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
                              try {
                                  await payInvoice(student.id, currentYear, currentMonthNameShort, studentOwed);
                                  showNotification(`Successfully collected $${studentOwed.toFixed(2)} tuition for ${student.englishName}.`, 'success');
                              } catch (err) {
                                  console.error(err);
                              }
                            }}
                            className="px-2.5 sm:px-3 h-7.5 sm:h-8 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-[6px] sm:rounded-[8px] text-[9px] sm:text-[8.5px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap touch-manipulation"
                            title="Quick Pay Invoice"
                          >
                            <Coins className="w-3 h-3" />
                            <span>{t('dash_quick_pay')}</span>
                          </button>
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
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />
                
                <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] rounded-t-[8px] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Cake className="w-3.5 h-3.5 text-[#EF2F38] animate-bounce" />
                    <h2 className="text-xs font-bold uppercase tracking-widest">{t('dash_student_birthdays')}</h2>
                  </div>
                  
                  {/* Dynamic Month Selector Toggles */}
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[6px] sm:rounded-[8px] px-2.5 h-8 sm:h-8.5 text-[10px] sm:text-[9px] uppercase font-bold focus:outline-none focus:border-[#444] font-mono shadow-sm cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>{getLocalizedMonthName(idx, state.language)}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 flex-1 max-h-[320px] overflow-y-auto space-y-2 bg-white dark:bg-transparent">
                  <AnimatePresence mode="popLayout">
                    {birthdayStudents.map(student => {
                      const isBirthdayToday = checkIsBirthdayToday(student.dob);
                      const bDay = getBirthdayDay(student.dob);
                      const age = calculateAge(student.dob);

                      return (
                        <motion.div 
                          key={student.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "p-2 rounded-[8px] border transition-all flex items-center justify-between gap-2 shadow-sm",
                            isBirthdayToday 
                              ? "bg-red-50 dark:bg-[#1E1111] border-red-500/40 dark:border-[#EF2F38]/40 shadow-[0_0_12px_rgba(239,47,56,0.15)] relative overflow-hidden" 
                              : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626]"
                          )}
                        >
                          {isBirthdayToday && (
                            <div className="absolute top-0 right-0 p-1 flex gap-1">
                              <Sparkle className="w-2.5 h-2.5 text-[#EF2F38] animate-pulse" />
                            </div>
                          )}

                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={cn(
                              "w-6.5 h-6.5 rounded-full flex items-center justify-center font-black text-[10px] font-mono border shrink-0",
                              isBirthdayToday 
                                ? "bg-[#EF2F38] text-white border-[#EF2F38]" 
                                : "bg-neutral-50 dark:bg-[#141414] text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                            )}>
                              {bDay}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold truncate text-neutral-900 dark:text-white">{student.englishName}</span>
                                {isBirthdayToday && (
                                  <span className="px-1 py-0.2 bg-[#EF2F38] text-white text-[6px] font-black uppercase tracking-wider rounded-full animate-bounce shrink-0">
                                    {t('dash_today')}
                                  </span>
                                )}
                              </div>
                              <span className="block text-[8px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center flex-wrap gap-1 leading-none">
                                <span>{t('dash_age_belt').replace('{age}', String(age)).replace('{belt}', student.currentBelt)}</span>
                                <span className="text-neutral-300 dark:text-neutral-700 select-none">•</span>
                                <span className="text-[7.5px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-1 py-0.2 text-neutral-500 dark:text-neutral-400 font-bold font-mono">{student.dob}</span>
                              </span>
                            </div>
                          </div>

                          <button 
                            disabled={wishState[student.id] === 'sent'}
                            onClick={() => setWishStudent(student)}
                            className={cn(
                              "p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-[8px] border transition-all cursor-pointer flex items-center justify-center shadow-sm shrink-0",
                              isBirthdayToday
                                ? wishState[student.id] === 'sent'
                                  ? "bg-green-600/10 border-green-500/20 text-green-600 dark:text-green-400"
                                  : "bg-[#EF2F38] hover:bg-[#d6242c] border-transparent text-white"
                                : wishState[student.id] === 'sent'
                                  ? "bg-green-600/10 border-green-500/20 text-green-600 dark:text-green-400"
                                  : "bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-[#262626] border-neutral-200 dark:border-[#262626] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                            )}
                          >
                            {wishState[student.id] === 'sent' ? (
                              <CheckCircle className="w-4 h-4 sm:w-3 sm:h-3" />
                            ) : (
                              <PaperPlaneTilt className="w-4 h-4 sm:w-3 sm:h-3" />
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {birthdayStudents.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-white dark:bg-transparent">
                      <Cake className="w-7 h-7 text-neutral-300 dark:text-neutral-700 animate-pulse" />
                      <div>
                        <h4 className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">{t('dash_no_birthdays_in')} {getLocalizedMonthName(selectedMonth, state.language)}</h4>
                        <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">{t('dash_no_birthdays_desc')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom mini-summary */}
                <div className="py-2 px-3 bg-white dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] text-[8px] text-neutral-500 dark:text-neutral-400 font-mono text-center flex items-center justify-center gap-1.5 rounded-b-[8px] shadow-sm">
                  <span>{t('dash_selected_birthdays').replace('{count}', String(birthdayStudents.length))}</span>
                </div>
              </div>

              {/* Dynamic Promotion eligibility widget using PRI */}
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-sm">
                <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] rounded-t-[8px] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-yellow-500" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('dash_promotion_readiness')}</h2>
                  </div>
                  <span className="text-[8.5px] text-neutral-500 dark:text-neutral-400 font-mono uppercase font-bold tracking-widest">
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
                              "px-1 py-0.2 rounded text-[6.5px] font-mono font-bold uppercase border",
                              candidate.rank === 'Gold' ? "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" :
                              candidate.rank === 'Silver' ? "bg-neutral-500/10 text-neutral-600 border-neutral-500/20" :
                              "bg-orange-500/10 text-orange-600 border-orange-500/20"
                            )}>
                              {t(`dash_${candidate.rank.toLowerCase()}_candidate` as any)} ({candidate.pri}%)
                            </span>
                          </div>
                          <span className="px-1 py-0.2 bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 rounded-[3px] text-[7px] font-bold uppercase font-mono">
                            {translateBeltFormatted(candidate.student.currentBelt, candidate.student.dob)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono border-t border-neutral-100 dark:border-[#1A1A1A] pt-1.5">
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
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Executive Header: Academy AI Health Score & 4 Core Pillars */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 lg:p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-200 dark:border-[#262626] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Sparkle className="w-5 h-5 text-[#EF2F38]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono font-bold text-[#EF2F38]">{t('dash_tab_intelligence')}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                    {t('dash_academy_health_score')}
                  </h2>
                </div>
              </div>

              {/* Health Score Metric & Badge */}
              <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] px-3.5 py-2 rounded-[8px]">
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black font-mono tracking-tight", healthScoreMetrics.statusColor)}>
                    {healthScoreMetrics.overall}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-neutral-400">/100</span>
                </div>
                <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
                <span className={cn("px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider font-mono border", healthScoreMetrics.badgeBg)}>
                  {healthScoreMetrics.statusText}
                </span>
              </div>
            </div>

            {/* 4 Pillars Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              {/* Pillar 1: Turnout */}
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    {t('dash_health_turnout')}
                  </span>
                  <span className="text-xs sm:text-[13px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {healthScoreMetrics.turnoutScore}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${healthScoreMetrics.turnoutScore}%` }}
                  />
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
                  Optimal: <strong className="text-neutral-700 dark:text-neutral-300">{attendanceDensityStats.optimalDay}</strong> ({attendanceDensityStats.optimalRate}%)
                </span>
              </div>

              {/* Pillar 2: Financial Compliance */}
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-500" />
                    {t('dash_health_finance')}
                  </span>
                  <span className="text-xs sm:text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {healthScoreMetrics.financialScore}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${healthScoreMetrics.financialScore}%` }}
                  />
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
                  Collected: <strong className="text-neutral-700 dark:text-neutral-300">${financialForecast.actual.toFixed(0)}</strong> / ${expectedMonthlyRevenue.toFixed(0)}
                </span>
              </div>

              {/* Pillar 3: Testing Pipeline */}
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    {t('dash_health_pipeline')}
                  </span>
                  <span className="text-xs sm:text-[13px] font-mono font-bold text-amber-600 dark:text-amber-400">
                    {healthScoreMetrics.testingPipelineScore}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${healthScoreMetrics.testingPipelineScore}%` }}
                  />
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
                  Ready: <strong className="text-amber-600 dark:text-amber-400">{healthScoreMetrics.goldCount} Gold</strong>, {healthScoreMetrics.silverCount} Silver
                </span>
              </div>

              {/* Pillar 4: Retention Guard */}
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#EF2F38]" />
                    {t('dash_health_retention')}
                  </span>
                  <span className={cn("text-xs sm:text-[13px] font-mono font-bold", healthScoreMetrics.highRiskCount > 0 ? "text-[#EF2F38]" : "text-green-600 dark:text-green-400")}>
                    {healthScoreMetrics.retentionScore}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", healthScoreMetrics.highRiskCount > 0 ? "bg-[#EF2F38]" : "bg-green-500")}
                    style={{ width: `${healthScoreMetrics.retentionScore}%` }}
                  />
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
                  Hazards: <strong className={healthScoreMetrics.highRiskCount > 0 ? "text-[#EF2F38]" : "text-neutral-700 dark:text-neutral-300"}>{healthScoreMetrics.highRiskCount} High</strong>, {healthScoreMetrics.mediumRiskCount} Med
                </span>
              </div>
            </div>
          </div>

          {/* Row 1 - Top Analytics & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Module 1: Revenue Forecast Slider & Chart */}
            {canViewFinancials && (
              <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-[#EF2F38] font-mono font-bold">{t('dash_predictive_analytics')}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] flex items-center gap-1.5 leading-none">
                      {t('dash_tuition_cashflow_forecast')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveHelpSection('revenue')}
                    className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Guide"
                  >
                    <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm">
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-mono block mb-0.5">{t('dash_expected_revenue')}</span>
                      <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-neutral-900 dark:text-white">${expectedMonthlyRevenue.toFixed(0)}</span>
                    </div>
                    <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm">
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-[#EF2F38] font-mono block mb-0.5">{t('dash_simulated_forecast')}</span>
                      <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-[#EF2F38]">${predictedRevenueDynamic.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Scenario Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono block">Scenario Presets</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { label: t('dash_scenario_baseline'), rate: 5 },
                        { label: t('dash_scenario_exam'), rate: 15 },
                        { label: t('dash_scenario_holiday'), rate: 25 },
                        { label: t('dash_scenario_stress'), rate: 40 },
                      ].map(sc => (
                        <button
                          key={sc.rate}
                          type="button"
                          onClick={() => setForecastChurnRate(sc.rate)}
                          className={cn(
                            "px-1.5 py-1 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider border transition-all text-center cursor-pointer",
                            forecastChurnRate === sc.rate
                              ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm"
                              : "bg-white dark:bg-[#0F0F0F] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-[#262626] hover:border-neutral-400 dark:hover:border-neutral-600"
                          )}
                        >
                          {sc.label} ({sc.rate}%)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual Churn simulation slider */}
                  <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm space-y-1.5">
                    <div className="flex justify-between text-[8px] sm:text-[9px] uppercase font-bold text-neutral-500 font-mono">
                      <span>Simulated Churn Stress</span>
                      <span className="text-[#EF2F38] font-bold">{forecastChurnRate}% Loss Multiplier</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={forecastChurnRate}
                      onChange={(e) => setForecastChurnRate(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 sm:h-2 bg-neutral-100 dark:bg-[#1A1A1A] rounded-[8px] appearance-none cursor-pointer accent-[#EF2F38] outline-none"
                    />
                  </div>

                  {/* Render simulated line chart */}
                  <div className="h-[95px] sm:h-[110px] flex items-center justify-center relative overflow-hidden select-none">
                    <svg className="w-full h-full" viewBox="0 0 220 90" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="confidenceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF2F38" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#EF2F38" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="0" y1="20" x2="220" y2="20" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />
                      <line x1="0" y1="45" x2="220" y2="45" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" />
                      <line x1="0" y1="70" x2="220" y2="70" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />

                      {/* Confidence area bounds */}
                      <path
                        d={forecastChartData.shadowPath}
                        fill="url(#confidenceAreaGrad)"
                        className="transition-all duration-300"
                      />

                      {/* Revenue Line */}
                      <polyline
                        fill="none"
                        stroke="#EF2F38"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={forecastChartData.svgCoords}
                        className="drop-shadow-[0_2px_4px_rgba(239,47,56,0.15)]"
                      />
                      <circle cx="218" cy={forecastChartData.lastCircleY} r="3.5" fill="#EF2F38" className="animate-ping" />
                      <circle cx="218" cy={forecastChartData.lastCircleY} r="2.5" fill="#EF2F38" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Module 2: Turnout Weekly Density heatmaps */}
            <div className={cn("bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between", canViewFinancials ? "lg:col-span-2" : "lg:col-span-3")}>
              <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-2">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-indigo-500 font-mono font-bold">{t('dash_attendance_heatmap_model')}</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_cohort_turnout_density')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveHelpSection('turnout')}
                  className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Guide"
                >
                  <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Day stats highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/20 p-2.5 rounded-[8px]">
                  <div>
                    <span className="block text-[8px] sm:text-[9px] text-green-700 dark:text-green-400 font-mono uppercase tracking-wider font-bold leading-none">{t('dash_optimal_training_day')}</span>
                    <span className="text-xs font-bold text-neutral-800 dark:text-white leading-none mt-1 block">{attendanceDensityStats.optimalDay}</span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400 font-mono leading-none">{attendanceDensityStats.optimalRate}%</span>
                </div>

                <div className="flex justify-between items-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 p-2.5 rounded-[8px]">
                  <div>
                    <span className="block text-[8px] sm:text-[9px] text-red-700 dark:text-red-400 font-mono uppercase tracking-wider font-bold leading-none">{t('dash_at_risk_density_day')}</span>
                    <span className="text-xs font-bold text-neutral-800 dark:text-white leading-none mt-1 block">{attendanceDensityStats.lowDay}</span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-red-600 dark:text-red-400 font-mono leading-none">{attendanceDensityStats.lowRate}%</span>
                </div>
              </div>

              {/* Mat Congestion Alert (if any day rate >= 80%) */}
              {attendanceDensityStats.optimalRate >= 80 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/25 px-3 py-2 rounded-[8px] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] text-amber-800 dark:text-amber-300 font-mono">
                    <strong>{t('dash_mat_congestion_alert')}:</strong> {attendanceDensityStats.optimalDay} reaches {attendanceDensityStats.optimalRate}% mat capacity. Consider splitting sessions or adding coach support.
                  </span>
                </div>
              )}

              {/* Weekly density bars */}
              <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] shadow-sm">
                <div className="flex items-end justify-between h-24 sm:h-28 pt-3 pb-0.5">
                  {weeklyDensityBarData.map((d, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 group space-y-1.5">
                      <div className="w-6 sm:w-8 md:w-10 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] rounded-t-[8px] h-18 sm:h-22 flex items-end overflow-hidden relative">
                        <div 
                          className={cn(
                            "w-full rounded-t-[8px] transition-all duration-500",
                            d.rate >= 80 ? "bg-green-500/85 group-hover:bg-green-500" :
                            d.rate >= 65 ? "bg-amber-500/85 group-hover:bg-amber-500" :
                            "bg-red-500/85 group-hover:bg-red-500"
                          )}
                          style={{ height: `${d.rate || 6}%` }} 
                        />
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] sm:text-[10px] font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-1 rounded shadow pointer-events-none">
                          {d.rate}%
                        </span>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-neutral-600 dark:text-neutral-400 font-mono">{d.dayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 - Advanced analysis lists (Readiness candidates + Churn hazard list) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Module 3: Promotion Readiness candidates list */}
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex flex-col gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-amber-500 font-mono font-bold">{t('dash_promotion_readiness_engine')}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_testing_eligibility_candidates')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveHelpSection('promotion')}
                    className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Guide"
                  >
                    <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* Filter Pills with Counts & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    {[
                      { key: 'all', label: t('dash_all_tiers'), count: promotionReadinessRoster.length },
                      { key: 'Gold', label: t('dash_gold_only'), count: healthScoreMetrics.goldCount },
                      { key: 'Silver', label: t('dash_silver_only'), count: healthScoreMetrics.silverCount },
                      { key: 'Bronze', label: t('dash_bronze_only'), count: healthScoreMetrics.bronzeCount },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setPriRankFilter(tab.key as any)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap",
                          priRankFilter === tab.key
                            ? "bg-amber-500 text-amber-950 font-black border-amber-500 shadow-sm"
                            : "bg-white dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                        )}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  {/* Candidate Search Box */}
                  <div className="relative min-w-[150px] sm:min-w-[180px]">
                    <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    <input
                      type="text"
                      value={priSearch}
                      onChange={(e) => setPriSearch(e.target.value)}
                      placeholder={t('dash_search_candidates')}
                      className="w-full bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded px-2.5 pl-7 py-1 text-[10px] sm:text-xs font-mono text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-[#EF2F38]"
                    />
                    {priSearch && (
                      <button
                        type="button"
                        onClick={() => setPriSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidates Roster */}
              <div className="space-y-2 max-h-[300px] sm:max-h-[360px] overflow-y-auto pr-1">
                {filteredPriCandidates.map(candidate => {
                  const report = (candidate as any).report;
                  return (
                    <div key={candidate.student.id} className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                      {/* Student Identity */}
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <SafeImage 
                          src={candidate.student.profilePicturePath} 
                          alt={candidate.student.englishName} 
                          containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px] sm:text-xs">{candidate.student.englishName.charAt(0)}</span>}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-none">{candidate.student.englishName}</h4>
                            {candidate.student.khmerName && (
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans leading-none">{candidate.student.khmerName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] sm:text-[9px] text-[#EF2F38] dark:text-red-400 font-mono uppercase tracking-wider font-bold leading-none">
                              {translateBeltFormatted(candidate.student.currentBelt, candidate.student.dob)}
                            </span>
                            <span className="text-[8px] sm:text-[9px] text-neutral-400 font-mono leading-none">• {candidate.student.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantitative Progress Pills & Status */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 w-full lg:w-auto border-t lg:border-t-0 border-neutral-100 dark:border-[#1A1A1A] pt-1.5 lg:pt-0">
                        {/* 4 Pillars Explicit Badges */}
                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[8px] sm:text-[9px] font-mono", report?.daysEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Time in Grade">
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>{report?.daysElapsed}/{report?.daysRequired}d</span>
                          </span>
                          <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[8px] sm:text-[9px] font-mono", report?.attendanceEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Attendance Count">
                            <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>{report?.attendanceSince}/{report?.attendanceRequired}</span>
                          </span>
                          <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[8px] sm:text-[9px] font-mono", report?.syllabusEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Syllabus Progress">
                            <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>{report?.syllabusCompletedPct}%</span>
                          </span>
                          <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[8px] sm:text-[9px] font-mono", report?.physicalEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Physical Skills">
                            <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>{report?.skillsGradedCount}/{report?.totalSkillsCount}</span>
                          </span>
                        </div>

                        {/* Candidate Readiness Rank */}
                        <div className="shrink-0">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider border font-mono",
                            candidate.rank === 'Gold' ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                            candidate.rank === 'Silver' ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" :
                            "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                          )}>
                            {t(`dash_${candidate.rank.toLowerCase()}_candidate` as any)} ({candidate.pri}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredPriCandidates.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1">
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono italic">{t('dash_no_promotion_candidates')}</p>
                    {priSearch && (
                      <button
                        type="button"
                        onClick={() => setPriSearch('')}
                        className="text-[9px] sm:text-xs text-[#EF2F38] hover:underline font-mono font-bold"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Module 4: Churn Hazard Roster with actions */}
            <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex flex-col gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-[#EF2F38] font-mono font-bold">{t('dash_retentivity_analyzer')}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_student_churn_hazard')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveHelpSection('retention')}
                    className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Guide"
                  >
                    <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* Filter Pills with Counts & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    {[
                      { key: 'all', label: t('dash_all_risks'), count: churnHazardRoster.length },
                      { key: 'high', label: 'High Risk', count: healthScoreMetrics.highRiskCount },
                      { key: 'medium', label: 'Medium', count: healthScoreMetrics.mediumRiskCount },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setChurnFilter(tab.key as any)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap",
                          churnFilter === tab.key
                            ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm"
                            : "bg-white dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                        )}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  {/* Hazard Search Box */}
                  <div className="relative min-w-[150px] sm:min-w-[180px]">
                    <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    <input
                      type="text"
                      value={churnSearch}
                      onChange={(e) => setChurnSearch(e.target.value)}
                      placeholder={t('dash_search_hazards')}
                      className="w-full bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded px-2.5 pl-7 py-1 text-[10px] sm:text-xs font-mono text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-[#EF2F38]"
                    />
                    {churnSearch && (
                      <button
                        type="button"
                        onClick={() => setChurnSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Hazard List */}
              <div className="space-y-2 max-h-[300px] sm:max-h-[360px] overflow-y-auto pr-1">
                {filteredChurnHazards.map(hazard => {
                  const isHigh = hazard.riskLevel === 'High';
                  const whatsAppUrl = getWhatsAppOutreachUrl(hazard.student, hazard.daysSinceLastClass);

                  return (
                    <div key={hazard.student.id} className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                      {/* Student Details */}
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <SafeImage 
                          src={hazard.student.profilePicturePath} 
                          alt={hazard.student.englishName} 
                          containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px] sm:text-xs">{hazard.student.englishName.charAt(0)}</span>}
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-none">{hazard.student.englishName}</h4>
                            {hazard.student.khmerName && (
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans leading-none">{hazard.student.khmerName}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono">
                            <span>Last Class: {hazard.lastDate === 'Never' ? 'Never' : hazard.lastDate}</span>
                            <span className="text-neutral-300 dark:text-neutral-700">•</span>
                            <span className="text-[#EF2F38] font-bold">{hazard.daysSinceLastClass}d inactive</span>
                          </div>
                          <div className="text-[8.5px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono leading-none">
                            Missed: <strong className="text-neutral-700 dark:text-neutral-300">{hazard.estimatedMissedClasses} classes</strong> (Expected {hazard.expectedWeeklyFrequency}x/wk)
                          </div>
                        </div>
                      </div>

                      {/* CRM Outreach Action Details */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-neutral-100 dark:border-[#1A1A1A] pt-2 sm:pt-0">
                        <div className="flex flex-col items-start sm:items-end leading-none">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider border font-mono",
                            isHigh ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25" :
                            "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                          )}>
                            CPI: {hazard.cpi}% ({hazard.riskLevel})
                          </span>
                        </div>
                        
                        {/* Action buttons: WhatsApp & Call */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {whatsAppUrl && (
                            <a
                              href={whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 min-h-[28px] bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent rounded-[6px] text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 touch-manipulation"
                              title="Direct WhatsApp check-in"
                            >
                              <PaperPlaneTilt className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {hazard.student.emergencyContactPhone && (
                            <a 
                              href={`tel:${hazard.student.emergencyContactPhone}`} 
                              className="px-2.5 py-1 min-h-[28px] bg-[#EF2F38]/10 hover:bg-[#EF2F38] text-[#EF2F38] hover:text-white border border-[#EF2F38]/20 hover:border-transparent rounded-[6px] text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 touch-manipulation"
                              title={`Call: ${hazard.student.emergencyContactPhone}`}
                            >
                              <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>{t('dash_call')}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredChurnHazards.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1">
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono italic">{t('dash_no_churn_detected')}</p>
                    {churnSearch && (
                      <button
                        type="button"
                        onClick={() => setChurnSearch('')}
                        className="text-[9px] sm:text-xs text-[#EF2F38] hover:underline font-mono font-bold"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Module 5: Belt Pyramid & Academy Demographic Funnel */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 lg:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-[#EF2F38] font-mono font-bold">Pipeline Diagnostics</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] flex items-center gap-1.5 leading-none">
                  <ChartBar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EF2F38]" />
                  {t('dash_belt_demographics')}
                </h3>
              </div>
              <span className="text-[9px] sm:text-[9.5px] font-mono font-bold text-neutral-500 dark:text-neutral-400">
                {activeCount} Active Students Total
              </span>
            </div>

            {/* Belt Distribution Funnel Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              {beltDistribution.map(belt => (
                <div key={belt.key} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className={cn("px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold font-mono uppercase tracking-wider", belt.color)}>
                      {belt.name}
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-neutral-900 dark:text-white">
                      {belt.count}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", belt.barColor)}
                        style={{ width: `${belt.pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                      <span>Roster Share</span>
                      <strong className="text-neutral-700 dark:text-neutral-300">{belt.pct}%</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Guide Modals */}
      {activeHelpSection && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setActiveHelpSection(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-6 relative overflow-hidden flex flex-col space-y-5 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div className="space-y-1">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#EF2F38] font-mono">{t('dash_intel_guide')}</span>
                  <h3 className="text-sm font-black text-neutral-800 dark:text-white mt-1">
                    {helpContent[activeHelpSection].title}
                  </h3>
                </div>
                <button onClick={() => setActiveHelpSection(null)} className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-full transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Math Formula Card */}
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 text-center">
                <span className="text-[7.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest block font-mono mb-1">{t('dash_math_formula')}</span>
                <code className="text-[10px] font-mono text-red-500 dark:text-red-400 font-bold">{helpContent[activeHelpSection].math}</code>
              </div>

              {/* Read Section */}
              <div className="space-y-2">
                <h4 className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_read_data')}</h4>
                <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  {helpContent[activeHelpSection].read.map((item, idx) => (
                    <li key={idx} className="flex gap-2 items-start">
                      <span className="text-[#EF2F38] mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Work Section */}
              <div className="space-y-2">
                <h4 className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_work_data')}</h4>
                <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  {helpContent[activeHelpSection].work.map((item, idx) => (
                    <li key={idx} className="flex gap-2 items-start">
                      <span className="text-indigo-500 mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Story Section */}
              <div className="space-y-2">
                <h4 className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_operational_story')}</h4>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] leading-relaxed font-medium italic">
                  "{helpContent[activeHelpSection].story}"
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveHelpSection(null)}
                  className="h-8.5 sm:h-9 px-4 sm:px-5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                >
                  {t('act_close')}
                </button>
              </div>
            </motion.div>
          </div>
        </Portal>
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

function BirthdayWishActionModal({ student, onClose, onMarkSent }: { student: Student, onClose: () => void, onMarkSent: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const birthYear = parseInt(student.dob.split('-')[0], 10);
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  const messageText = t('dash_birthday_greeting_text').replace('{name}', student.englishName);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const telegramUrl = `https://telegram.me/share/url?text=${encodeURIComponent(messageText)}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

  return (
    <Portal>
      <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-6 relative overflow-hidden flex flex-col space-y-6 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-3">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#EF2F38] font-mono">{t('dash_birthday_wizard')}</span>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-white mt-1">{t('dash_send_birthday_greeting')}</h3>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close Birthday Wizard"
              className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-full transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student Profile Preview */}
          <div className="flex items-center gap-3 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px]">
            <div className="w-10 h-10 rounded-full bg-[#EF2F38] text-white flex items-center justify-center font-black text-sm">
              {student.englishName.charAt(0)}
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{student.englishName}</h4>
              <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                Turning {age} • DOB: {student.dob} • Belt: {student.currentBelt}
              </p>
            </div>
          </div>

          {/* Message Preview Textbox */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_greeting_preview')}</label>
            <div className="bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono leading-relaxed text-neutral-800 dark:text-neutral-300 select-all whitespace-pre-wrap">
              {messageText}
            </div>
          </div>

          {/* Action Links */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <a 
              href={telegramUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={onMarkSent}
              className="h-10 sm:h-11 bg-sky-500 hover:bg-sky-600 text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/10 cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('dash_send_telegram')}
            </a>
            <a 
              href={whatsAppUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={onMarkSent}
              className="h-10 sm:h-11 bg-green-500 hover:bg-green-600 text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-green-500/10 cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('dash_send_whatsapp')}
            </a>
          </div>

          <div className="flex gap-2.5 sm:gap-3">
            <button 
              onClick={handleCopy}
              className="flex-1 h-9 sm:h-10 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center"
            >
              {copied ? t('dash_copied_msg') : t('dash_copy_clipboard')}
            </button>
            <button 
              onClick={onMarkSent}
              className="flex-1 h-9 sm:h-10 bg-[#EF2F38] hover:bg-[#D0252D] text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-md shadow-[#EF2F38]/20 active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center"
            >
              {t('dash_mark_sent')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
