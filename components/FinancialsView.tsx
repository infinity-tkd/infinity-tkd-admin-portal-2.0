'use client';
import { TUITION_MONTHS as monthsListGlobal, isMonthBeforeEnrollment, prepaymentSchedule, tuitionMonth } from '@/lib/tuition-payments';
import { copyText } from '@/lib/clipboard';
import dynamic from 'next/dynamic';


import { billingDueDate, billingDueDay, billingBaseDate, tuitionAmount } from '@/lib/billing';
import { tuitionCycle } from '@/lib/tuition-cycle';
import { invoiceStatus } from '@/lib/invoice-status';
import { useRouter } from 'next/navigation';
import { useNotificationTarget } from '@/hooks/use-notification-target';
import { tuitionCollectionStats } from '@/lib/financial-reporting';
import Link from 'next/link';


import { toCsv } from '@/lib/csv';
import { academyDate } from '@/lib/dates';
import React, { useState } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { AnimatePresence } from 'motion/react';




import { ChartLine } from '@phosphor-icons/react/dist/csr/ChartLine';
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';




import { FileText } from '@phosphor-icons/react/dist/csr/FileText';







import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';




import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';














import { PageHeader, SegmentedTabs } from './ui/PageHeader';
import { buttonClass } from './ui/styles';
import { cn } from '@/lib/utils';



const TuitionReceiptDialogs = dynamic(
  () => import('./finance/TuitionReceiptDialogs').then(module => module.TuitionReceiptDialogs),
  { ssr: false },
);





const RenewalCalendarPanel = dynamic(() => import('@/components/finance/RenewalCalendarPanel').then(module => module.RenewalCalendarPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const RevenuePanel = dynamic(() => import('@/components/finance/RevenuePanel').then(module => module.RevenuePanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const TransactionsPanel = dynamic(() => import('@/components/finance/TransactionsPanel').then(module => module.TransactionsPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

const TuitionLedgerPanel = dynamic(() => import('@/components/finance/TuitionLedgerPanel').then(module => module.TuitionLedgerPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const RenewalDayDialog = dynamic(() => import('@/components/finance/RenewalDayDialog').then(module => module.RenewalDayDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentTuitionDialog = dynamic(() => import('@/components/finance/StudentTuitionDialog').then(module => module.StudentTuitionDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

export function FinancialsView() {
  const { state, payInvoice: recordFullPayment, prepayInvoiceBulk, showNotification, can } = useAppStore();
  const router=useRouter();
  const paymentFlight=React.useRef(false);
  const prepayFlight=React.useRef(false);
  const [paymentBusy,setPaymentBusy]=useState(false);
  const cycleFinance=React.useCallback((student:Student,month:string,year:number)=>tuitionCycle(
    student,`${year}-${String(monthsListGlobal.indexOf(month)+1).padStart(2,'0')}`,
    state.payments.find(row=>row.studentId===student.id&&row.year===year&&row.month===month),
    state.scholarships.find(row=>row.id===student.scholarshipId),state.classEnrollments,state.academyProfile,
  ),[state.payments,state.scholarships,state.classEnrollments,state.academyProfile]);
  const payInvoice=async(studentId:string,year:number,month:string,amount:number)=>{
    if(paymentFlight.current)return false;
    const cycle=tuitionMonth(month,year);
    const hasInvoice=state.students.find(row=>row.id===studentId)?.billingInvoices?.some(row=>row.cycleMonth.slice(0,7)===cycle);
    if(hasInvoice||cycle<academyDate().slice(0,7)){router.push('/operations?view=billing&student='+encodeURIComponent(studentId));return false;}
    paymentFlight.current=true;setPaymentBusy(true);
    try{await recordFullPayment(studentId,year,month,amount);return true;}
    finally{paymentFlight.current=false;setPaymentBusy(false);}
  };
  const canRecordPayment = can('action:finance_record_payment');
  const isReadOnlyLedger = !canRecordPayment;

  const getStudentEnrollDate = React.useCallback((st: Student) => {
    return billingBaseDate(st,state.classEnrollments);
  }, [state.classEnrollments]);

  const [activeTab, setActiveTab] = useState<'ledger' | 'revenue' | 'transactions' | 'calendar'>('ledger');

  const months = monthsListGlobal;
  const currentActualYear = Number(academyDate().slice(0,4));
  const currentActualMonthIndex = Number(academyDate().slice(5,7))-1;

  // Calendar View State
  const [calendarYear, setCalendarYear] = useState<number>(currentActualYear);
  const [calendarMonth, setCalendarMonth] = useState<string>(months[currentActualMonthIndex]);
  const [calendarFilterStatus, setCalendarFilterStatus] = useState<'all' | 'overdue' | 'pending' | 'paid' | 'waived'>('all');
  const [calendarSearch, setCalendarSearch] = useState<string>('');
  const [calendarFilterBranch, setCalendarFilterBranch] = useState<number | 'all'>('all');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{ year: number; month: string; day: number } | null>(null);
  const [selectedDaySearch, setSelectedDaySearch] = useState<string>('');
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'agenda'>('grid');

  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<number | 'all'>('all');
  const [filterScholarship, setFilterScholarship] = useState<number | 'all'>('all');
  const [filterYear, setFilterYear] = useState<number>(currentActualYear);
  const [filterMonth, setFilterMonth] = useState<string | 'all'>('all');

  const [searchTransactions, setSearchTransactions] = useState('');
  const [filterTransactionYear, setFilterTransactionYear] = useState<number | 'all'>('all');
  const [filterTransactionMonth, setFilterTransactionMonth] = useState<string | 'all'>('all');
  const [filterTransactionBranch, setFilterTransactionBranch] = useState<number | 'all'>('all');
  const [filterTransactionStatus, setFilterTransactionStatus] = useState<'all' | 'Paid' | 'Pending' | 'Unpaid'>('all');
  const [txnPage, setTxnPage] = useState<number>(1);
  const [txnPerPage, setTxnPerPage] = useState<number>(20);
  const [copiedTxnId, setCopiedTxnId] = useState<string | null>(null);

  // Aging Receivables Filters
  const [agingSearch, setAgingSearch] = useState('');
  const [agingSeverityFilter, setAgingSeverityFilter] = useState<'all' | '1m' | '2m_plus'>('all');

  // Ledger Matrix Filters & Pagination
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPerPage, setLedgerPerPage] = useState<number>(25);
  const [alertSearch, setAlertSearch] = useState<string>('');

  const [ledgerViewMode, setLedgerViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [isAlertsCollapsedMobile, setIsAlertsCollapsedMobile] = useState<boolean>(false);

  const [ledgerSortField, setLedgerSortField] = useState<'student' | 'branch' | 'plan' | 'dueDay' | null>(null);
  const [ledgerSortDirection, setLedgerSortDirection] = useState<'asc' | 'desc'>('asc');

  const [txnSortField, setTxnSortField] = useState<'student' | 'branch' | 'cycle' | 'refId' | 'amount' | null>(null);
  const [txnSortDirection, setTxnSortDirection] = useState<'asc' | 'desc'>('asc');

  const [studentDetailsId, setStudentDetailsId] = useState<string | null>(null);
  useNotificationTarget(url=>{const id=url.searchParams.get('student');if(url.pathname==='/financials'&&id&&state.students.some(student=>student.id===id))setStudentDetailsId(id);},state.students.length>0);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  const [prepayMonths, setPrepayMonths] = useState<number>(12);
  const [prepayStartMonth, setPrepayStartMonth] = useState<string>(months[currentActualMonthIndex]);
  const [prepayStartYear, setPrepayStartYear] = useState<number>(currentActualYear);
  const [prepayAmount, setPrepayAmount] = useState<string>('');
  const [showPrepayPanel, setShowPrepayPanel] = useState<boolean>(false);
  const [isProcessingPrepay, setIsProcessingPrepay] = useState<boolean>(false);

  const [showReceipt, setShowReceipt] = useState<{
    student: Student;
    month: string;
    year: number;
    amount: number;
  } | null>(null);

  // Auto-switch to mobile-optimized modes on initial load if screen is narrow
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setLedgerViewMode('cards');
      setCalendarViewMode('agenda');
      setIsAlertsCollapsedMobile(true);
    }
  }, []);

  const standardMonthlyFee = state.academyProfile.standardTuitionUsd;

  const filteredStudents = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = state.students.filter(s => {
      const matchesSearch = !q ||
                            s.englishName.toLowerCase().includes(q) ||
                            s.id.toLowerCase().includes(q) ||
                            (s.khmerName && s.khmerName.toLowerCase().includes(q));
      const matchesBranch = filterBranch === 'all' || s.homeBranchId === filterBranch;
      const matchesScholarship = filterScholarship === 'all' || s.scholarshipId === filterScholarship;

      if (!matchesSearch || !matchesBranch || !matchesScholarship || !['Active','Paused'].includes(s.studentStatus)) {
        return false;
      }

      if (ledgerStatusFilter !== 'all') {
        let monthsToCheck = months;
        if (filterYear === currentActualYear) {
          monthsToCheck = months.slice(0, currentActualMonthIndex + 1);
        } else if (filterYear > currentActualYear) {
          monthsToCheck = [];
        }

        let hasUnpaidMonth = false;
        {
          for (const m of monthsToCheck) {
            if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(s))) continue;
            if (cycleFinance(s,m,filterYear).balance>0) {
              hasUnpaidMonth = true;
              break;
            }
          }
        }

        if (ledgerStatusFilter === 'unpaid' && !hasUnpaidMonth) return false;
        if (ledgerStatusFilter === 'paid' && hasUnpaidMonth) return false;
      }

      return true;
    });

    if (!ledgerSortField) return list;

    return list.sort((a, b) => {
      let comparison = 0;
      if (ledgerSortField === 'student') {
        comparison = a.englishName.localeCompare(b.englishName);
      } else if (ledgerSortField === 'branch') {
        const branchA = state.branches.find(br => br.id === a.homeBranchId)?.name || '';
        const branchB = state.branches.find(br => br.id === b.homeBranchId)?.name || '';
        comparison = branchA.localeCompare(branchB);
      } else if (ledgerSortField === 'plan') {
        const planA = state.scholarships.find(sc => sc.id === a.scholarshipId)?.typeName || 'Standard';
        const planB = state.scholarships.find(sc => sc.id === b.scholarshipId)?.typeName || 'Standard';
        comparison = planA.localeCompare(planB);
      } else if (ledgerSortField === 'dueDay') {
        const getDueDayNum = (st: Student) => {
          return billingDueDay(st,state.classEnrollments,tuitionMonth(filterMonth==='all'?months[currentActualMonthIndex]:filterMonth,filterYear))??999;
        };
        comparison = getDueDayNum(a) - getDueDayNum(b);
      }
      return ledgerSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [search, state.students, state.scholarships, state.branches, ledgerSortField, filterBranch, filterScholarship, ledgerStatusFilter, months, filterYear, currentActualYear, currentActualMonthIndex, getStudentEnrollDate, ledgerSortDirection,cycleFinance, filterMonth,state.classEnrollments]);

  // Ledger Matrix Monthly Yields & Footer Computations
  const monthlyLedgerMatrixTotals = React.useMemo(() => {
    return months.map(m => {
      let totalCollected = 0;
      let totalExpected = 0;
      let paidCount = 0;
      let eligibleCount = 0;

      filteredStudents.forEach(student => {
        const enrollDate = getStudentEnrollDate(student);
        if (isMonthBeforeEnrollment(m, filterYear, enrollDate)) return;

        eligibleCount++;
        const cycle=cycleFinance(student,m,filterYear);
        totalExpected+=cycle.amount;
        totalCollected+=cycle.cash;
        if(cycle.settled)paidCount++;
      });

      const rate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

      return {
        month: m,
        totalCollected,
        totalExpected,
        paidCount,
        eligibleCount,
        rate
      };
    });
  }, [months, filteredStudents, getStudentEnrollDate, filterYear, cycleFinance]);

  const totalLedgerPages = Math.max(1, Math.ceil(filteredStudents.length / ledgerPerPage));
  const paginatedStudents = React.useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPerPage;
    return filteredStudents.slice(start, start + ledgerPerPage);
  }, [filteredStudents, ledgerPage, ledgerPerPage]);

  const exportLedgerMatrixToCsv = () => {
    const headers = [
      'Student ID',
      'Student Name',
      'Khmer Name',
      'Branch',
      'Scholarship Tier',
      'Due Day',
      ...months,
      'Total Paid (USD)',
      'Total Owed (USD)',
      'Status'
    ];

    const rows = filteredStudents.map(student => {
      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
      const enrollDate = getStudentEnrollDate(student);
      const dueDay=String(billingDueDay(student,state.classEnrollments,tuitionMonth(filterMonth==='all'?months[currentActualMonthIndex]:filterMonth,filterYear))??'-');

      let studentCollected = 0;
      let studentOwed = 0;
      let hasOverdue = false;

      const monthCols = months.map((m, idx) => {
        const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
        const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
        if (isBeforeEnroll) return 'Pre-Enroll';
        if (isFuture) return 'Upcoming';

        const cycle=cycleFinance(student,m,filterYear);
        studentCollected+=cycle.cash;studentOwed+=cycle.balance;
        if(cycle.waived)return 'Waived';
        if(cycle.settled)return `Settled; cash ${cycle.cash.toFixed(2)}`;
        hasOverdue=true;return `Outstanding ${cycle.balance.toFixed(2)}; cash ${cycle.cash.toFixed(2)}`;
      });

      const studentStatus = hasOverdue ? 'Overdue Dues' : 'Up to Date';

      return [
        student.id,
        student.englishName,
        student.khmerName || '',
        branchName,
        scholarship?.typeName || 'Standard',
        dueDay,
        ...monthCols,
        studentCollected.toFixed(2),
        studentOwed.toFixed(2),
        studentStatus
      ];
    });

    const csvContent = toCsv(headers, rows);
    const encodedUri = URL.createObjectURL(new Blob([csvContent],{type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InfinityTKD_Annual_Ledger_${filterYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
  };

  // --- Financial & Receivables Analytics ---
  let totalExpected = 0;
  let totalCollected = 0;
  let totalScholarshipDiscounts = 0;

  // Let's compute details for each student
  const studentRevenueData = state.students.map(student => {
    const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);

    let monthsToAnalyze = months;
    if (filterMonth !== 'all') {
      monthsToAnalyze = [filterMonth];
    } else if (filterYear === currentActualYear) {
      monthsToAnalyze = months.slice(0, currentActualMonthIndex + 1);
    }

    let studentExpected = 0;
    let studentDiscount = 0;
    let studentCollected = 0;
    let studentOwed = 0;
    const overdueMonthsList: string[] = [];

    monthsToAnalyze.forEach(m => {
      if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(student))) {
        return; // Ignore completely, student not enrolled yet!
      }

      const cycle=cycleFinance(student,m,filterYear);
      studentExpected+=cycle.gross;studentDiscount+=cycle.discount;studentCollected+=cycle.cash;studentOwed+=cycle.balance;
      if(cycle.balance>0)overdueMonthsList.push(m);
    });


    return {
      student,
      expected: studentExpected,
      discount: studentDiscount,
      collected: studentCollected,
      owed: studentOwed > 0 ? studentOwed : 0,
      overdueMonths: overdueMonthsList,
      branchName: state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang',
      scholarshipName: scholarship?.typeName || 'Standard'
    };
  });

  // Aggregate results for the selected year/filters
  studentRevenueData.forEach(item => {
    // Only aggregate if it matches branch/scholarship filters
    const matchesBranch = filterBranch === 'all' || item.student.homeBranchId === filterBranch;
    const matchesScholarship = filterScholarship === 'all' || item.student.scholarshipId === filterScholarship;
    if (matchesBranch && matchesScholarship && ['Active','Paused'].includes(item.student.studentStatus)) {
      totalExpected += item.expected;
      totalCollected += item.collected;
      totalScholarshipDiscounts += item.discount;
    }
  });

  const outstandingBalance = studentRevenueData.filter(item=>['Active','Paused'].includes(item.student.studentStatus)&&(filterBranch==='all'||item.student.homeBranchId===filterBranch)&&(filterScholarship==='all'||item.student.scholarshipId===filterScholarship)).reduce((sum,item)=>sum+item.owed,0);
  const collectionRate = (totalExpected - totalScholarshipDiscounts) > 0
    ? Math.round((totalCollected / (totalExpected - totalScholarshipDiscounts)) * 100)
    : 0;

  // Aging Receivables List (Owed > 0)
  const agingReceivables = studentRevenueData.filter(item => item.owed > 0 && ['Active','Paused'].includes(item.student.studentStatus));

  // Branch Revenue analytics
  const branchFinancials = state.branches.map(branch => {
    const branchItems = studentRevenueData.filter(item => item.student.homeBranchId === branch.id && ['Active','Paused'].includes(item.student.studentStatus));
    let branchExpected = 0;
    let branchCollected = 0;
    let branchDiscount = 0;
    branchItems.forEach(item => {
      branchExpected += item.expected;
      branchCollected += item.collected;
      branchDiscount += item.discount;
    });
    const netExpected = branchExpected - branchDiscount;
    const rate = netExpected > 0 ? Math.round((branchCollected / netExpected) * 100) : 0;
    return {
      branch,
      collected: branchCollected,
      expected: netExpected,
      outstanding: netExpected - branchCollected > 0 ? netExpected - branchCollected : 0,
      owed: branchItems.reduce((sum,item)=>sum+item.owed,0),
      discount: branchDiscount,
      rate,
      studentCount: branchItems.length
    };
  });

  // Filtered Aging Receivables with real-time search & severity capsule
  const filteredAgingReceivables = React.useMemo(() => {
    const q = agingSearch.toLowerCase().trim();
    return agingReceivables.filter(item => {
      if (q) {
        const matchesName = item.student.englishName.toLowerCase().includes(q);
        const matchesId = item.student.id.toLowerCase().includes(q);
        const matchesKhmer = item.student.khmerName && item.student.khmerName.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesKhmer) return false;
      }
      if (agingSeverityFilter === '1m' && item.overdueMonths.length !== 1) return false;
      if (agingSeverityFilter === '2m_plus' && item.overdueMonths.length < 2) return false;
      return true;
    });
  }, [agingReceivables, agingSearch, agingSeverityFilter]);

  const totalAgingOwed = React.useMemo(() => {
    return filteredAgingReceivables.reduce((acc, curr) => acc + curr.owed, 0);
  }, [filteredAgingReceivables]);

  // 12-Month Revenue & Collection Trajectory (Matrix for active filters)
  const monthlyRevenueTrajectory = React.useMemo(() => {
    return months.map(m => {
      let mExpected = 0;
      let mCollected = 0;
      let mDiscounts = 0;
      let mOwed = 0;

      state.students.forEach(student => {
        if (!['Active','Paused'].includes(student.studentStatus)) return;
        if (filterBranch !== 'all' && student.homeBranchId !== filterBranch) return;
        if (filterScholarship !== 'all' && student.scholarshipId !== filterScholarship) return;
        if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(student))) return;

        const cycle=cycleFinance(student,m,filterYear);
        mExpected+=cycle.gross;mDiscounts+=cycle.discount;mCollected+=cycle.cash;mOwed+=cycle.balance;
      });

      const netExpected = mExpected - mDiscounts;
      const rate = netExpected > 0 ? Math.round((mCollected / netExpected) * 100) : 0;
      const isPastOrCurrent = filterYear < currentActualYear || (filterYear === currentActualYear && months.indexOf(m) <= currentActualMonthIndex);

      return {
        month: m,
        expected: netExpected,
        collected: mCollected,
        owed: mOwed,
        discounts: mDiscounts,
        rate,
        isPastOrCurrent
      };
    });
  }, [months, state.students, cycleFinance, filterYear, currentActualYear, currentActualMonthIndex, filterBranch, filterScholarship, getStudentEnrollDate]);

  const peakRevenueMonth = React.useMemo(() => {
    const list = [...monthlyRevenueTrajectory].filter(m => m.collected > 0);
    if (list.length === 0) return null;
    return list.sort((a, b) => b.collected - a.collected)[0];
  }, [monthlyRevenueTrajectory]);

  // Scholarship Subsidies Financial Impact Analysis
  const scholarshipFinancialImpacts = React.useMemo(() => {
    return state.scholarships.map(sc => {
      const enrolledStudents = state.students.filter(s => s.scholarshipId === sc.id && s.studentStatus === 'Active');
      const isEarly = sc.typeName === 'Early Group Student';
      const basePrice = isEarly ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
      const discountPct = isEarly ? 0 : (sc.discountPercentage || 0);
      const monthlyDiscountPerStudent = basePrice * (discountPct / 100);
      const monthlyTotalWaived = enrolledStudents.length * monthlyDiscountPerStudent;
      const annualProjectedWaived = monthlyTotalWaived * 12;

      return {
        scholarship: sc,
        studentCount: enrolledStudents.length,
        discountPct,
        monthlyTotalWaived,
        annualProjectedWaived
      };
    }).filter(item => item.studentCount > 0 || item.discountPct > 0);
  }, [state.academyProfile.earlyGroupTuitionUsd, state.academyProfile.standardTuitionUsd, state.scholarships, state.students]);

  const activeStudentProfile = studentDetailsId ? state.students.find(s => s.id === studentDetailsId) : null;
  const activeStudentScholarship = activeStudentProfile ? state.scholarships.find(s => s.id === activeStudentProfile.scholarshipId) : null;
  const isEarlyGroupStudent = activeStudentScholarship?.typeName === 'Early Group Student';
  const studentBasePrice = isEarlyGroupStudent ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
  const activeDiscountPct = isEarlyGroupStudent ? 0 : (activeStudentScholarship?.discountPercentage || 0);
  const netMonthlyFee = tuitionAmount(activeStudentScholarship??undefined,state.academyProfile);

  const activeStudentEnrollDate = activeStudentProfile ? getStudentEnrollDate(activeStudentProfile) : null;
  const activeCycleDue = activeStudentProfile ? billingDueDate(activeStudentProfile, state.classEnrollments, academyDate().slice(0,7)) : '-';
  const activeBillingAnchorDay = activeCycleDue === '-' ? '-' : String(Number(activeCycleDue.slice(8,10)));

  const prepayPreviewList = React.useMemo(()=>{
    try{return prepaymentSchedule(prepayStartMonth,prepayStartYear,prepayMonths,netMonthlyFee,prepayAmount).entries;}
    catch{return [];}
  },[prepayStartMonth,prepayStartYear,prepayMonths,netMonthlyFee,prepayAmount]);

  const handleLedgerSort = (field: 'student' | 'branch' | 'plan' | 'dueDay') => {
    if (ledgerSortField === field) {
      setLedgerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLedgerSortField(field);
      setLedgerSortDirection('asc');
    }
  };

  const handleTxnSort = (field: 'student' | 'branch' | 'cycle' | 'refId' | 'amount') => {
    if (txnSortField === field) {
      setTxnSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTxnSortField(field);
      setTxnSortDirection('asc');
    }
  };

  const filteredTransactionsList = React.useMemo(() => {
    const q = searchTransactions.toLowerCase().trim();
    const list = state.payments.filter(p => {
      const student = state.students.find(s => s.id === p.studentId);
      if (!student) return false;

      const matchesSearch = !q ||
                            student.englishName.toLowerCase().includes(q) ||
                            student.id.toLowerCase().includes(q) ||
                            (student.khmerName && student.khmerName.toLowerCase().includes(q)) ||
                            `txn-pay-${p.id}`.includes(q) || (p.receiptNumber || `LEGACY-${p.id}`).toLowerCase().includes(q);
      const matchesBranch = filterTransactionBranch === 'all' || student.homeBranchId === filterTransactionBranch;
      const matchesYear = filterTransactionYear === 'all' || p.year === filterTransactionYear;
      const matchesMonth = filterTransactionMonth === 'all' || p.month === filterTransactionMonth;
      const matchesStatus = filterTransactionStatus === 'all' || p.status === filterTransactionStatus;

      return matchesSearch && matchesBranch && matchesYear && matchesMonth && matchesStatus;
    });

    if (txnSortField === null) {
      // Default sorting: newer years first, newer months first, higher ID first
      return list.sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }
        const aMonthIdx = monthsListGlobal.indexOf(a.month);
        const bMonthIdx = monthsListGlobal.indexOf(b.month);
        if (aMonthIdx !== bMonthIdx) {
          return bMonthIdx - aMonthIdx;
        }
        return b.id - a.id;
      });
    }

    return list.sort((a, b) => {
      let comparison = 0;
      if (txnSortField === 'student') {
        const studentA = state.students.find(s => s.id === a.studentId)?.englishName || '';
        const studentB = state.students.find(s => s.id === b.studentId)?.englishName || '';
        comparison = studentA.localeCompare(studentB);
      } else if (txnSortField === 'branch') {
        const studentA = state.students.find(s => s.id === a.studentId);
        const studentB = state.students.find(s => s.id === b.studentId);
        const branchA = studentA ? (state.branches.find(br => br.id === studentA.homeBranchId)?.name || '') : '';
        const branchB = studentB ? (state.branches.find(br => br.id === studentB.homeBranchId)?.name || '') : '';
        comparison = branchA.localeCompare(branchB);
      } else if (txnSortField === 'cycle') {
        if (a.year !== b.year) {
          comparison = a.year - b.year;
        } else {
          comparison = monthsListGlobal.indexOf(a.month) - monthsListGlobal.indexOf(b.month);
        }
      } else if (txnSortField === 'refId') {
        comparison = a.id - b.id;
      } else if (txnSortField === 'amount') {
        comparison = (a.amountUsd || 0) - (b.amountUsd || 0);
      }
      return txnSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [state.payments, state.students, state.branches, searchTransactions, filterTransactionBranch, filterTransactionYear, filterTransactionMonth, filterTransactionStatus, txnSortField, txnSortDirection]);

  const transactionStats = tuitionCollectionStats(filteredTransactionsList);

  const totalTxnPages = Math.max(1, Math.ceil(filteredTransactionsList.length / txnPerPage));
  const paginatedTransactions = React.useMemo(() => {
    const start = (txnPage - 1) * txnPerPage;
    return filteredTransactionsList.slice(start, start + txnPerPage);
  }, [filteredTransactionsList, txnPage, txnPerPage]);

  const exportTransactionsToCsv = () => {
    if (filteredTransactionsList.length === 0) {
      showNotification('No transactions to export for active filter criteria', 'info');
      return;
    }

    const headers = [
      'Transaction Ref',
      'Student Name',
      'Student ID',
      'Branch Facility',
      'Billing Month',
      'Billing Year',
      'Plan / Scholarship',
      'Status',
      'Amount Collected (USD)'
    ];

    const rows = filteredTransactionsList.map(p => {
      const student = state.students.find(s => s.id === p.studentId);
      const branchName = state.branches.find(b => b.id === student?.homeBranchId)?.name || 'Central Dojang';
      const scholarship = state.scholarships.find(s => s.id === student?.scholarshipId);
      return [
        p.receiptNumber || `LEGACY-${p.id}`,
        student?.englishName || 'Unknown',
        student?.id || '',
        branchName,
        p.month,
        p.year,
        scholarship?.typeName || 'Standard',
        p.status,
        (p.amountUsd || 0).toFixed(2)
      ];
    });

    const csvContent = toCsv(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `infinitytkd-transactions-${academyDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredTransactionsList.length} transactions to CSV`, 'success');
  };

  const handleCopyTxnId = async (idStr: string) => {
    if (!(await copyText(idStr))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopiedTxnId(idStr);
    setTimeout(() => setCopiedTxnId(null), 2000);
  };

  const handleProcessBulkPrepay = async () => {
    if(!activeStudentProfile||prepayFlight.current||!canRecordPayment)return;
    prepayFlight.current=true;setIsProcessingPrepay(true);
    try{
      const schedule=prepaymentSchedule(prepayStartMonth,prepayStartYear,prepayMonths,netMonthlyFee,prepayAmount);
      for(const entry of schedule.entries){
        const cycle=tuitionMonth(entry.month,entry.year);
        const existing=state.payments.find(payment=>payment.studentId===activeStudentProfile.id&&payment.year===entry.year&&payment.month===entry.month);
        if(existing?.status==='Paid'||existing?.status==='Waived')throw new Error(entry.month+' '+entry.year+' is already settled. Choose an unpaid range.');
        if(isMonthBeforeEnrollment(entry.month,entry.year,getStudentEnrollDate(activeStudentProfile)))throw new Error('Prepayment cannot include months before enrollment.');
        if(cycle<academyDate().slice(0,7)||activeStudentProfile.billingInvoices?.some(invoice=>invoice.cycleMonth.slice(0,7)===cycle)||activeStudentProfile.membershipPauses?.some(pause=>!pause.voidedAt)){
          router.push('/operations?view=billing&student='+encodeURIComponent(activeStudentProfile.id));
          showNotification('Review existing invoices, pauses and historical balances in the invoice ledger before recording payment.','info');return;
        }
      }
      await prepayInvoiceBulk(activeStudentProfile.id,schedule.entries);
      showNotification('Prepaid '+schedule.entries.length+' months ($'+schedule.total.toFixed(2)+' total).','success');
      setShowPrepayPanel(false);setPrepayAmount('');
    }catch(error){showNotification(error instanceof Error?error.message:'Payment could not be confirmed. Reload before retrying.','error');}
    finally{prepayFlight.current=false;setIsProcessingPrepay(false);}
  };

  const calendarData = React.useMemo(() => {
    const monthIdx = monthsListGlobal.indexOf(calendarMonth);
    if (monthIdx === -1) return { daysInMonth: 31, firstDayOffset: 0, dayMap: {}, stats: { total: 0, paid: 0, pending: 0, overdue: 0, waived: 0, expected: 0, collected: 0, outstanding: 0 } };

    const daysInMonth = new Date(calendarYear, monthIdx + 1, 0).getDate();

    // Monday start offset: 0 = Mon, 1 = Tue, ..., 6 = Sun
    const rawFirstDay = new Date(calendarYear, monthIdx, 1).getDay();
    const firstDayOffset = (rawFirstDay + 6) % 7;

    const dayMap: Record<number, Array<{
      student: Student;
      billingStatus: 'Paid' | 'Due Soon' | 'Due today' | 'Within grace' | 'Overdue' | 'Waived' | 'Upcoming';
      amountOwed: number;
      baseFee: number;
      discountPct: number;
      branchName: string;
      scholarshipName: string;
      dueDay: number;
    }>> = {};

    for (let d = 1; d <= daysInMonth; d++) {
      dayMap[d] = [];
    }

    let totalRenewals = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let totalWaived = 0;
    let expectedSum = 0;
    let collectedSum = 0;
    let outstandingSum = 0;

    state.students.forEach(student => {
      if (!['Active','Paused'].includes(student.studentStatus)) return;

      if (calendarFilterBranch !== 'all' && student.homeBranchId !== calendarFilterBranch) return;

      if (calendarSearch.trim()) {
        const q = calendarSearch.toLowerCase();
        if (!student.englishName.toLowerCase().includes(q) && !student.id.toLowerCase().includes(q)) return;
      }

      const enrollDateStr = getStudentEnrollDate(student);
      if (isMonthBeforeEnrollment(calendarMonth, calendarYear, enrollDateStr)) {
        return;
      }

      const cycleMonth = calendarYear + '-' + String(monthIdx + 1).padStart(2, '0');
      const dueDate = billingDueDate(student, state.classEnrollments, cycleMonth);
      const dueDay = dueDate === '-' ? 1 : Number(dueDate.slice(8, 10));

      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isEarlyGroup ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const cycle=cycleFinance(student,calendarMonth,calendarYear);
      const requiredPayment=cycle.amount,amountOwed=cycle.balance;
      const timing=invoiceStatus(dueDate,cycle.balance,academyDate(),state.academyProfile.renewalReminderDays??5,state.academyProfile.latePaymentGraceDays??5);
      const status: 'Paid' | 'Due Soon' | 'Due today' | 'Within grace' | 'Overdue' | 'Waived' | 'Upcoming'=cycle.waived?'Waived':cycle.settled?'Paid':timing==='Due soon'?'Due Soon':timing==='Settled'?'Paid':timing;

      // 1. Accumulate month totals across all active renewals
      totalRenewals++;
      expectedSum += requiredPayment;
      collectedSum += cycle.cash;
      outstandingSum += cycle.balance;

      if (status === 'Paid') {
        totalPaid++;
      } else if (status === 'Waived') {
        totalWaived++;
      } else if (status === 'Overdue') {
        totalOverdue++;
      } else {
        totalPending++;
      }

      // 2. Filter days by status for calendar grid & agenda list
      if (calendarFilterStatus === 'overdue' && status !== 'Overdue') return;
      if (calendarFilterStatus === 'pending' && !['Due Soon','Due today','Within grace'].includes(status)) return;
      if (calendarFilterStatus === 'paid' && status !== 'Paid') return;
      if (calendarFilterStatus === 'waived' && status !== 'Waived') return;

      const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
      const scholarshipName = scholarship?.typeName || 'Standard';

      if (!dayMap[dueDay]) dayMap[dueDay] = [];
      dayMap[dueDay].push({
        student,
        billingStatus: status,
        amountOwed,
        baseFee,
        discountPct,
        branchName,
        scholarshipName,
        dueDay
      });
    });

    return {
      daysInMonth,
      firstDayOffset,
      dayMap,
      stats: {
        total: totalRenewals,
        paid: totalPaid,
        pending: totalPending,
        overdue: totalOverdue,
        waived: totalWaived,
        expected: expectedSum,
        collected: collectedSum,
        outstanding: outstandingSum
      }
    };
  }, [calendarMonth, calendarYear, state.students, state.scholarships, state.academyProfile, state.branches, state.classEnrollments, calendarFilterBranch, calendarSearch, getStudentEnrollDate, calendarFilterStatus, cycleFinance]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12 sm:space-y-5">
      <PageHeader
        icon={<CreditCard weight="bold" />}
        eyebrow="Payment ledgers & receivables"
        title="Academy Tuition & Billing CRM"
        description="Monthly totals show tuition allocated to billing cycles, including verified partial allocations. Credits and waivers are not cash income. Unbilled cycles use current-rate estimates until their invoices are verified."
        actions={<Link href="/operations?view=reconciliation" className={cn(buttonClass(), 'whitespace-normal py-2 text-center')}>Cash collections and bank reconciliation</Link>}
      >
        {isReadOnlyLedger && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-micro font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Read-Only Mode
          </span>
        )}
      </PageHeader>
      <SegmentedTabs label="Financial views" value={activeTab} onChange={setActiveTab} className="grid grid-cols-2 lg:flex lg:w-fit" items={[
        { id: 'ledger', label: 'Ledger Grid', icon: <FileText /> },
        { id: 'revenue', label: 'Revenue Dashboard', icon: <ChartLine /> },
        { id: 'transactions', label: 'Transactions Log', icon: <Receipt /> },
        { id: 'calendar', label: 'Renewal Calendar', icon: <CalendarCheck /> },
      ]} />

      {activeTab === 'ledger' && <TuitionLedgerPanel filteredStudents={filteredStudents} filterYear={filterYear} search={search} setSearch={setSearch} setLedgerPage={setLedgerPage} setLedgerStatusFilter={setLedgerStatusFilter} ledgerStatusFilter={ledgerStatusFilter} setFilterYear={setFilterYear} currentActualYear={currentActualYear} filterMonth={filterMonth} setFilterMonth={setFilterMonth} months={months} filterBranch={filterBranch} setFilterBranch={setFilterBranch} state={state} filterScholarship={filterScholarship} setFilterScholarship={setFilterScholarship} setLedgerSortField={setLedgerSortField} setLedgerSortDirection={setLedgerSortDirection} standardMonthlyFee={standardMonthlyFee} alertSearch={alertSearch} setIsAlertsCollapsedMobile={setIsAlertsCollapsedMobile} isAlertsCollapsedMobile={isAlertsCollapsedMobile} setAlertSearch={setAlertSearch} setStudentDetailsId={setStudentDetailsId} setPaymentAmounts={setPaymentAmounts} isReadOnlyLedger={isReadOnlyLedger} paymentBusy={paymentBusy} payInvoice={payInvoice} showNotification={showNotification} totalCollected={totalCollected} outstandingBalance={outstandingBalance} totalScholarshipDiscounts={totalScholarshipDiscounts} setLedgerViewMode={setLedgerViewMode} ledgerViewMode={ledgerViewMode} exportLedgerMatrixToCsv={exportLedgerMatrixToCsv} paginatedStudents={paginatedStudents} getStudentEnrollDate={getStudentEnrollDate} currentActualMonthIndex={currentActualMonthIndex} cycleFinance={cycleFinance} handleLedgerSort={handleLedgerSort} ledgerSortField={ledgerSortField} ledgerSortDirection={ledgerSortDirection} monthlyLedgerMatrixTotals={monthlyLedgerMatrixTotals} ledgerPage={ledgerPage} ledgerPerPage={ledgerPerPage} setLedgerPerPage={setLedgerPerPage} totalLedgerPages={totalLedgerPages} />}

      {activeTab === 'revenue' && <RevenuePanel filterYear={filterYear} setFilterYear={setFilterYear} currentActualYear={currentActualYear} filterMonth={filterMonth} setFilterMonth={setFilterMonth} months={months} filterBranch={filterBranch} setFilterBranch={setFilterBranch} state={state} filterScholarship={filterScholarship} setFilterScholarship={setFilterScholarship} collectionRate={collectionRate} totalExpected={totalExpected} totalScholarshipDiscounts={totalScholarshipDiscounts} totalCollected={totalCollected} outstandingBalance={outstandingBalance} agingReceivables={agingReceivables} peakRevenueMonth={peakRevenueMonth} monthlyRevenueTrajectory={monthlyRevenueTrajectory} currentActualMonthIndex={currentActualMonthIndex} filteredAgingReceivables={filteredAgingReceivables} totalAgingOwed={totalAgingOwed} agingSearch={agingSearch} setAgingSearch={setAgingSearch} setAgingSeverityFilter={setAgingSeverityFilter} agingSeverityFilter={agingSeverityFilter} setStudentDetailsId={setStudentDetailsId} setPaymentAmounts={setPaymentAmounts} branchFinancials={branchFinancials} scholarshipFinancialImpacts={scholarshipFinancialImpacts} />}

      {activeTab === 'transactions' && <TransactionsPanel transactionStats={transactionStats} searchTransactions={searchTransactions} setSearchTransactions={setSearchTransactions} setTxnPage={setTxnPage} filterTransactionBranch={filterTransactionBranch} setFilterTransactionBranch={setFilterTransactionBranch} state={state} filterTransactionYear={filterTransactionYear} setFilterTransactionYear={setFilterTransactionYear} currentActualYear={currentActualYear} filterTransactionMonth={filterTransactionMonth} setFilterTransactionMonth={setFilterTransactionMonth} months={months} setFilterTransactionStatus={setFilterTransactionStatus} setTxnSortField={setTxnSortField} setTxnSortDirection={setTxnSortDirection} exportTransactionsToCsv={exportTransactionsToCsv} paginatedTransactions={paginatedTransactions} handleCopyTxnId={handleCopyTxnId} copiedTxnId={copiedTxnId} setShowReceipt={setShowReceipt} handleTxnSort={handleTxnSort} txnSortField={txnSortField} txnSortDirection={txnSortDirection} filteredTransactionsList={filteredTransactionsList} txnPage={txnPage} txnPerPage={txnPerPage} setTxnPerPage={setTxnPerPage} totalTxnPages={totalTxnPages} />}
      {activeTab === 'calendar' && <RenewalCalendarPanel calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} setCalendarYear={setCalendarYear} calendarYear={calendarYear} currentActualYear={currentActualYear} months={months} currentActualMonthIndex={currentActualMonthIndex} setCalendarViewMode={setCalendarViewMode} calendarViewMode={calendarViewMode} calendarSearch={calendarSearch} setCalendarSearch={setCalendarSearch} calendarFilterBranch={calendarFilterBranch} setCalendarFilterBranch={setCalendarFilterBranch} state={state} calendarData={calendarData} calendarFilterStatus={calendarFilterStatus} setCalendarFilterStatus={setCalendarFilterStatus} selectedCalendarDay={selectedCalendarDay} setSelectedCalendarDay={setSelectedCalendarDay} setStudentDetailsId={setStudentDetailsId} setPaymentAmounts={setPaymentAmounts} isReadOnlyLedger={isReadOnlyLedger} paymentBusy={paymentBusy} payInvoice={payInvoice} showNotification={showNotification} setShowReceipt={setShowReceipt} />}

      {/* Renewal Day Roster Drawer Modal */}
      <AnimatePresence>
        {selectedCalendarDay && <RenewalDayDialog selectedCalendarDay={selectedCalendarDay} calendarData={calendarData} setSelectedCalendarDay={setSelectedCalendarDay} selectedDaySearch={selectedDaySearch} setSelectedDaySearch={setSelectedDaySearch} setStudentDetailsId={setStudentDetailsId} setPaymentAmounts={setPaymentAmounts} isReadOnlyLedger={isReadOnlyLedger} paymentBusy={paymentBusy} payInvoice={payInvoice} showNotification={showNotification} setShowReceipt={setShowReceipt} />}
      </AnimatePresence>

      {/* Student Details Invoicing Modal */}
      <AnimatePresence>
        {studentDetailsId && activeStudentProfile && <StudentTuitionDialog activeStudentProfile={activeStudentProfile} filterYear={filterYear} setStudentDetailsId={setStudentDetailsId} activeStudentScholarship={activeStudentScholarship} activeDiscountPct={activeDiscountPct} netMonthlyFee={netMonthlyFee} studentBasePrice={studentBasePrice} activeBillingAnchorDay={activeBillingAnchorDay} activeStudentEnrollDate={activeStudentEnrollDate} isReadOnlyLedger={isReadOnlyLedger} paymentBusy={paymentBusy} setShowPrepayPanel={setShowPrepayPanel} showPrepayPanel={showPrepayPanel} prepayMonths={prepayMonths} setPrepayMonths={setPrepayMonths} setPrepayAmount={setPrepayAmount} prepayStartMonth={prepayStartMonth} setPrepayStartMonth={setPrepayStartMonth} months={months} prepayStartYear={prepayStartYear} setPrepayStartYear={setPrepayStartYear} currentActualYear={currentActualYear} prepayAmount={prepayAmount} prepayPreviewList={prepayPreviewList} handleProcessBulkPrepay={handleProcessBulkPrepay} isProcessingPrepay={isProcessingPrepay} getStudentEnrollDate={getStudentEnrollDate} state={state} cycleFinance={cycleFinance} currentActualMonthIndex={currentActualMonthIndex} paymentAmounts={paymentAmounts} setPaymentAmounts={setPaymentAmounts} payInvoice={payInvoice} showNotification={showNotification} setShowReceipt={setShowReceipt} />}
      </AnimatePresence>

      {showReceipt && <TuitionReceiptDialogs receipt={showReceipt} onClose={() => setShowReceipt(null)} />}
    </div>
  );
}
