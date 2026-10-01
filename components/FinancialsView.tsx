'use client';

import React, { useState } from 'react';
import { useAppStore, Student, getMembershipBillingStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MagnifyingGlass, CheckSquare, X, Printer, ChartLine, 
  CreditCard, Warning, PhoneCall, Check, UsersThree, FileText,
  PaintBrush, QrCode, ShieldCheck, ArrowsOut, FilePdf, Image, Sparkle,
  Receipt, CaretUp, CaretDown, ArrowsDownUp, Coins,
  CalendarCheck, CaretLeft, CaretRight, User, Clock, ArrowRight, CheckCircle,
  SquaresFour, ListDashes, DownloadSimple, TrendUp, TrendDown, Funnel, ArrowClockwise, Copy
} from '@phosphor-icons/react';
import { cn, formatBelt } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';

const monthsListGlobal = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isMonthBeforeEnrollment = (monthStr: string, year: number, enrollmentDateStr: string | undefined) => {
  if (!enrollmentDateStr) return true; // Default to TRUE (before enrollment) if no enrollment date is set!
  const parts = enrollmentDateStr.split('-');
  if (parts.length < 2) return false;
  
  const enrollYear = parseInt(parts[0], 10);
  const enrollMonthIdx = parseInt(parts[1], 10) - 1; // 0-11
  
  const targetMonthIdx = monthsListGlobal.indexOf(monthStr);
  if (targetMonthIdx === -1) return false;
  
  if (year < enrollYear) return true;
  if (year === enrollYear && targetMonthIdx < enrollMonthIdx) return true;
  
  return false;
};

export function FinancialsView() {
  const { state, payInvoice, prepayInvoiceBulk, showNotification, can } = useAppStore();
  const canRecordPayment = can('action:finance_record_payment');
  const isReadOnlyLedger = !canRecordPayment;
  
  const getStudentEnrollDate = (st: Student) => {
    const enrollments = state.classEnrollments.filter(e => e.studentId === st.id);
    if (enrollments.length === 0) return undefined;
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length === 0) return st.registrationDate;
    return dates.sort()[0];
  };

  const [activeTab, setActiveTab] = useState<'ledger' | 'revenue' | 'transactions' | 'calendar'>('ledger');
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentActualYear = new Date().getFullYear();
  const currentActualMonthIndex = new Date().getMonth();
  
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

  // Custom E-Receipt Customization States
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<'ABA Pay' | 'Cash' | 'ABA Mobile Transfer' | 'Credit Card' | 'Bakong' | 'Wing'>('ABA Mobile Transfer');
  const [receiptAccentColor, setReceiptAccentColor] = useState<string>('#3B82F6'); // default: ABA Blue
  const [receiptShowLogo, setReceiptShowLogo] = useState<boolean>(true);
  const [receiptShowWatermark, setReceiptShowWatermark] = useState<boolean>(true);
  const [receiptShowQrCode, setReceiptShowQrCode] = useState<boolean>(true);
  const [receiptCustomNotes, setReceiptCustomNotes] = useState<string>('');
  const [receiptReferenceNumber, setReceiptReferenceNumber] = useState<string>('');
  const [receiptFullscreen, setReceiptFullscreen] = useState<boolean>(false);

  // Auto-switch to mobile-optimized modes on initial load if screen is narrow
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setLedgerViewMode('cards');
      setCalendarViewMode('agenda');
      setIsAlertsCollapsedMobile(true);
    }
  }, []);

  React.useEffect(() => {
    if (showReceipt) {
      // Pre-fill a randomized, highly-detailed transaction reference ID
      const randomId = Math.floor(100000 + Math.random() * 900000);
      setReceiptReferenceNumber(`TXN-INF-${showReceipt.year}${showReceipt.month.substring(0, 3).toUpperCase()}-${randomId}`);
      setReceiptCustomNotes('');
    }
  }, [showReceipt]);

  // Admin Sync States
  const [isSavingAdmin, setIsSavingAdmin] = useState<boolean>(false);
  const [showAdminSuccess, setShowAdminSuccess] = useState<boolean>(false);

  const handleSaveToAdmin = () => {
    setIsSavingAdmin(true);
    setTimeout(() => {
      setIsSavingAdmin(false);
      setShowAdminSuccess(true);
      setTimeout(() => {
        setShowAdminSuccess(false);
        setShowReceipt(null);
      }, 1500);
    }, 800);
  };
  
  const handleSaveAsImage = async () => {
    const elementId = receiptFullscreen ? 'receipt-print-area-fullscreen' : 'receipt-print-area-core';
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: false, // Prevent canvas taint to ensure toDataURL succeeds securely
        scale: 2.5, // Crisp 2.5x high-res Retina scale
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedCard = clonedDoc.getElementById(elementId);
          if (clonedCard) {
            // Lock dimensions of the cloned card to exactly 380px for a beautiful slender aspect ratio
            clonedCard.style.width = '380px';
            clonedCard.style.maxWidth = '380px';
            clonedCard.style.minWidth = '380px';
            clonedCard.style.borderRadius = '16px';
            clonedCard.style.border = '1px solid #e5e7eb';
            clonedCard.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.08)';
            
            // Get the parent of the cloned card
            const parent = clonedCard.parentElement;
            if (parent) {
              // Create a beautiful, clean white wrapper frame with 32px padding and rounded corners
              const wrapper = clonedDoc.createElement('div');
              wrapper.style.padding = '32px';
              wrapper.style.backgroundColor = '#ffffff';
              wrapper.style.borderRadius = '16px';
              wrapper.style.display = 'flex';
              wrapper.style.justifyContent = 'center';
              wrapper.style.alignItems = 'center';
              wrapper.style.width = '444px'; // 380px card + 64px padding
              wrapper.style.boxSizing = 'border-box';
              
              // Replace the card in the parent with our wrapper, and append the card to the wrapper!
              parent.replaceChild(wrapper, clonedCard);
              wrapper.appendChild(clonedCard);
            }
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `E-Receipt-${showReceipt?.student.englishName.replace(/\s+/g, '-')}-${showReceipt?.month}-${showReceipt?.year}.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      console.error('Failed to export e-receipt image:', err);
      showNotification('Failed to generate high-quality image. Please try again.', 'error');
    }
  };

  const handleSaveAsPdf = () => {
    // Retrieve the outerHTML of the inner card itself to prevent nested boxes and double margins
    const elementId = receiptFullscreen ? 'receipt-print-area-fullscreen' : 'receipt-print-area-core';
    const printContent = document.getElementById(elementId)?.outerHTML;
    if (printContent) {
      const printWindow = window.open('', '', 'height=850,width=700');
      
      // Extract all active document stylesheets & inline styles to guarantee Tailwind grid/flex loads perfectly
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      printWindow?.document.write('<html><head><title>Payment Receipt</title>');
      printWindow?.document.write(styles); // Inject Tailwind and layout bundles
      printWindow?.document.write(`<style>
        @page { 
          size: auto; 
          margin: 0mm; /* Eliminates standard browser print header/footer texts */
        }
        body { 
          font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          padding: 0; 
          margin: 0; 
          background: #ffffff; 
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-wrapper {
          padding: 40px; /* Safe page margins */
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
        }
        #receipt-print-area-core, #receipt-print-area-fullscreen {
          width: 380px !important;
          max-width: 380px !important;
          min-width: 380px !important;
          border-radius: 16px !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08) !important;
          background-color: #ffffff !important;
          box-sizing: border-box !important;
        }
        @media print {
          body { background: #ffffff; min-height: auto; }
          .print-wrapper { padding: 30px; } /* Perfect vector alignment padding */
        }
      </style></head><body>`);
      printWindow?.document.write('<div class="print-wrapper">');
      
      // Convert all relative images (like logo.svg) to absolute urls to load correctly in print window
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const absolutePrintContent = printContent.replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`);
      
      printWindow?.document.write(absolutePrintContent);
      printWindow?.document.write('</div>');
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.focus();
      setTimeout(() => {
        printWindow?.print();
        printWindow?.close();
      }, 350);
    }
  };

  const renderReceiptCard = (printId: string) => {
    if (!showReceipt) return null;
    const scholarship = state.scholarships.find(s => s.id === showReceipt.student.scholarshipId);
    const isEarlyGroupReceipt = scholarship?.typeName === 'Early Group Student';
    const studentBaseFee = isEarlyGroupReceipt ? 25.00 : 45.00;
    const activeDiscountPct = isEarlyGroupReceipt ? 0 : (scholarship?.discountPercentage || 0);
    
    return (
      <div 
        id={printId} 
        className="w-full max-w-[380px] bg-white text-[#1f2937] font-sans p-6 sm:p-8 rounded-[8px] shadow-2xl relative overflow-hidden flex flex-col gap-6"
        style={{ 
          fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#ffffff',
          color: '#1f2937',
          position: 'relative',
          boxSizing: 'border-box',
          border: '1px solid #e5e7eb' // Clean, visible border to define the card edges against any white backgrounds
        }}
      >
        {/* Minimalist Premium Modern Watermark Stamp (Red Color, soft clean opacity) */}
        {receiptShowWatermark && (
          <div style={{ 
            position: 'absolute', 
            top: '55%', 
            left: '50%', 
            transform: 'translate(-50%, -50%) rotate(-12deg)', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            pointerEvents: 'none', 
            userSelect: 'none',
            zIndex: 0,
            opacity: 0.12 /* Elegant, clean, non-obstructive visual weighting */
          }}>
            <div style={{ 
              borderTop: '2px solid #EF2F38', 
              borderBottom: '2px solid #EF2F38', 
              padding: '6px 20px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <span style={{ 
                color: '#EF2F38', 
                fontSize: '32px', 
                fontWeight: '800', 
                letterSpacing: '10px', 
                textIndent: '10px', /* Centering text alignment */
                textTransform: 'uppercase', 
                fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: '1'
              }}>
                PAID
              </span>
              <span style={{ 
                color: '#EF2F38', 
                fontSize: '7px', 
                fontWeight: '600', 
                letterSpacing: '2px', 
                textIndent: '2px',
                textTransform: 'uppercase', 
                marginTop: '4px', 
                fontFamily: 'var(--font-mono), monospace' 
              }}>
                INFINITY ACADEMY
              </span>
            </div>
          </div>
        )}

        {/* Header Container */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${receiptAccentColor}`, paddingBottom: '16px', position: 'relative', zIndex: 1 }}>
          <div>
            {receiptShowLogo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <img 
                  src="/logo.svg" 
                  alt="Infinity Logo" 
                  style={{ width: '28px', height: '28px', objectFit: 'contain' }} 
                />
                <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1px', color: '#111827', margin: 0, fontFamily: 'var(--font-sans), sans-serif' }}>INFINITY</span>
              </div>
            )}
            <p style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', margin: 0 }}>TAEKWONDO ACADEMY</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '900', color: receiptAccentColor, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>E-RECEIPT</h1>
            {/* Realtime Synced Customizable Reference ID */}
            <p style={{ fontSize: '8px', color: '#6b7280', fontFamily: 'var(--font-mono), monospace', margin: '4px 0 0 0' }}>Ref: {receiptReferenceNumber}</p>
          </div>
        </div>

        {/* Metadata Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SafeImage 
              src={showReceipt.student.profilePicturePath} 
              alt={showReceipt.student.englishName} 
              containerClassName="w-10 h-10 rounded-[8px] bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
              crossOrigin="anonymous"
              fallback={<span className="font-bold text-gray-400 text-sm" style={{ fontWeight: 'bold', color: '#9ca3af', fontSize: '14px' }}>{showReceipt.student.englishName.charAt(0)}</span>}
            />
            <div>
              <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Billed To</span>
              <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', margin: '1px 0 0 0' }}>{showReceipt.student.englishName}</h4>
              <p style={{ fontSize: '9px', color: '#6b7280', fontFamily: 'var(--font-mono), monospace', margin: 0 }}>ID: {showReceipt.student.id}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Issued From</span>
            <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', margin: '1px 0 0 0' }}>{state.branches.find(b => b.id === showReceipt.student.homeBranchId)?.name || 'Central Dojang'}</h4>
            <p style={{ fontSize: '9px', color: '#6b7280', margin: 0 }}>Phnom Penh, Cambodia</p>
          </div>
        </div>

        {/* Transaction Table */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', width: '70%' }}>Description</th>
                <th style={{ padding: '8px 4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 4px', fontSize: '11px', color: '#1f2937' }}>
                  <div style={{ fontWeight: 'bold', color: '#111827' }}>Tuition Subscription</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>Monthly training access fee for {showReceipt.month} {showReceipt.year}</div>
                </td>
                <td style={{ padding: '12px 4px', fontSize: '11px', fontWeight: 'bold', color: '#111827', textAlign: 'right', fontFamily: 'var(--font-mono), monospace' }}>
                  ${studentBaseFee.toFixed(2)}
                </td>
              </tr>
              {activeDiscountPct > 0 && (
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 4px', fontSize: '11px', color: '#4f46e5' }}>
                    <div style={{ fontWeight: 'bold' }}>Scholarship Plan Offset ({activeDiscountPct}%)</div>
                    <div style={{ fontSize: '9px', color: '#6366f1', marginTop: '2px' }}>Tier Waiver applied automatically</div>
                  </td>
                  <td style={{ padding: '12px 4px', fontSize: '11px', fontWeight: 'bold', color: '#4f46e5', textAlign: 'right', fontFamily: 'var(--font-mono), monospace' }}>
                    -${(studentBaseFee * (activeDiscountPct / 100)).toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Paid Block */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '12px 16px',
          position: 'relative', 
          zIndex: 1 
        }}>
          <div>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Payment Method</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: receiptAccentColor }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827' }}>{receiptPaymentMethod}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Amount Collected</span>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: receiptAccentColor, margin: 0, fontFamily: 'var(--font-mono), monospace' }}>
              ${Number(showReceipt.amount).toFixed(2)}
            </h2>
          </div>
        </div>

        {/* Barcode & Footer Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', borderTop: '1px dashed #e5e7eb', paddingTop: '20px', gap: '4px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '1.5px', height: '24px', alignItems: 'center', marginBottom: '2px' }}>
            {[3,1,4,1,2,5,1,6,3,1,5,4,2,3,1,2,4,2,3,5,1,2,4,1,2,3].map((w, idx) => (
              <div key={idx} style={{ width: `${w}px`, height: '100%', backgroundColor: '#111827', opacity: idx % 3 === 0 ? 0.3 : 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '8px', color: '#9ca3af', fontFamily: 'var(--font-mono), monospace', letterSpacing: '2px' }}>{receiptReferenceNumber}</span>
          <p style={{ fontSize: '9px', color: '#6b7280', margin: '4px 0 0 0', fontStyle: 'italic', maxWidth: '320px', lineHeight: '1.4' }}>
            {receiptCustomNotes || `"Infinity is not a limit, it's a standard." Thank you for training with us!`}
          </p>
        </div>
      </div>
    );
  };

  const standardMonthlyFee = 45.00;

  const filteredStudents = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = state.students.filter(s => {
      const matchesSearch = !q || 
                            s.englishName.toLowerCase().includes(q) || 
                            s.id.toLowerCase().includes(q) ||
                            (s.khmerName && s.khmerName.toLowerCase().includes(q));
      const matchesBranch = filterBranch === 'all' || s.homeBranchId === filterBranch;
      const matchesScholarship = filterScholarship === 'all' || s.scholarshipId === filterScholarship;
      
      if (!matchesSearch || !matchesBranch || !matchesScholarship || s.studentStatus !== 'Active') {
        return false;
      }

      if (ledgerStatusFilter !== 'all') {
        const scholarship = state.scholarships.find(sc => sc.id === s.scholarshipId);
        const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
        const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);

        let monthsToCheck = months;
        if (filterYear === currentActualYear) {
          monthsToCheck = months.slice(0, currentActualMonthIndex + 1);
        } else if (filterYear > currentActualYear) {
          monthsToCheck = [];
        }

        let hasUnpaidMonth = false;
        if (discountPct < 100) {
          for (const m of monthsToCheck) {
            if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(s))) continue;
            const p = state.payments.find(pm => pm.studentId === s.id && pm.year === filterYear && pm.month === m);
            if (p?.status !== 'Paid') {
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
          const ed = getStudentEnrollDate(st);
          if (!ed) return 999;
          const d = new Date(ed.split('T')[0]);
          d.setDate(d.getDate() - 1);
          return d.getDate();
        };
        comparison = getDueDayNum(a) - getDueDayNum(b);
      }
      return ledgerSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [state.students, search, filterBranch, filterScholarship, ledgerStatusFilter, filterYear, currentActualYear, currentActualMonthIndex, ledgerSortField, ledgerSortDirection, state.branches, state.scholarships, state.payments]);

  // Ledger Matrix Monthly Yields & Footer Computations
  const monthlyLedgerMatrixTotals = React.useMemo(() => {
    return months.map((m, idx) => {
      let totalCollected = 0;
      let totalExpected = 0;
      let paidCount = 0;
      let eligibleCount = 0;

      filteredStudents.forEach(student => {
        const enrollDate = getStudentEnrollDate(student);
        if (isMonthBeforeEnrollment(m, filterYear, enrollDate)) return;

        eligibleCount++;
        const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
        const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
        const baseFee = isEarlyGroup ? 25.00 : 45.00;
        const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
        const reqPayment = baseFee * (1 - discountPct / 100);

        totalExpected += reqPayment;

        if (discountPct === 100) {
          paidCount++;
        } else {
          const payment = state.payments.find(p => p.studentId === student.id && p.year === filterYear && p.month === m);
          if (payment?.status === 'Paid') {
            paidCount++;
            totalCollected += (payment.amountUsd !== undefined ? payment.amountUsd : reqPayment);
          }
        }
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
  }, [months, filteredStudents, filterYear, state.payments, state.scholarships]);

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
      let dueDay = '-';
      if (enrollDate) {
        const d = new Date(enrollDate.split('T')[0]);
        d.setDate(d.getDate() - 1);
        dueDay = String(d.getDate());
      }

      let studentCollected = 0;
      let studentOwed = 0;
      let hasOverdue = false;

      const monthCols = months.map((m, idx) => {
        const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
        const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
        if (isBeforeEnroll) return 'Pre-Enroll';
        if (isFuture) return 'Upcoming';

        const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
        const baseFee = isEarlyGroup ? 25.00 : 45.00;
        const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
        const reqPayment = baseFee * (1 - discountPct / 100);

        const p = state.payments.find(pm => pm.studentId === student.id && pm.year === filterYear && pm.month === m);
        if (discountPct === 100) {
          return 'Waived (100%)';
        } else if (p?.status === 'Paid') {
          const amt = p.amountUsd !== undefined ? p.amountUsd : reqPayment;
          studentCollected += amt;
          return `Paid (${amt.toFixed(2)})`;
        } else {
          studentOwed += reqPayment;
          hasOverdue = true;
          return `Overdue (${reqPayment.toFixed(2)})`;
        }
      });

      const studentStatus = hasOverdue ? 'Overdue Dues' : 'Up to Date';

      return [
        student.id,
        `"${student.englishName.replace(/"/g, '""')}"`,
        `"${(student.khmerName || '').replace(/"/g, '""')}"`,
        `"${branchName.replace(/"/g, '""')}"`,
        `"${(scholarship?.typeName || 'Standard').replace(/"/g, '""')}"`,
        dueDay,
        ...monthCols.map(c => `"${c}"`),
        studentCollected.toFixed(2),
        studentOwed.toFixed(2),
        studentStatus
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InfinityTKD_Annual_Ledger_${filterYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Financial & Receivables Analytics ---
  let totalExpected = 0;
  let totalCollected = 0;
  let totalScholarshipDiscounts = 0;

  // Let's compute details for each student
  const studentRevenueData = state.students.map(student => {
    const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
    const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
    const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
    
    let monthsToAnalyze = months;
    if (filterMonth !== 'all') {
      monthsToAnalyze = [filterMonth];
    } else if (filterYear === currentActualYear) {
      monthsToAnalyze = months.slice(0, currentActualMonthIndex + 1);
    }

    let studentExpected = 0;
    let studentDiscount = 0;
    let studentCollected = 0;
    const overdueMonthsList: string[] = [];

    monthsToAnalyze.forEach((m, idx) => {
      if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(student))) {
        return; // Ignore completely, student not enrolled yet!
      }

      const fee = isStudentEarlyGroup ? 25.00 : 45.00;
      const discountAmount = fee * (discountPct / 100);
      const requiredPayment = fee - discountAmount;
      
      studentExpected += fee;
      studentDiscount += discountAmount;

      if (requiredPayment <= 0) {
        // Fully covered by scholarship
      } else {
        const payment = state.payments.find(p => p.studentId === student.id && p.year === filterYear && p.month === m);
        if (payment?.status === 'Paid') {
          studentCollected += (payment.amountUsd !== undefined ? payment.amountUsd : requiredPayment);
        } else {
          overdueMonthsList.push(m);
        }
      }
    });

    const studentOwed = (studentExpected - studentDiscount) - studentCollected;

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
    if (matchesBranch && matchesScholarship && item.student.studentStatus === 'Active') {
      totalExpected += item.expected;
      totalCollected += item.collected;
      totalScholarshipDiscounts += item.discount;
    }
  });

  const outstandingBalance = (totalExpected - totalScholarshipDiscounts) - totalCollected;
  const collectionRate = (totalExpected - totalScholarshipDiscounts) > 0 
    ? Math.round((totalCollected / (totalExpected - totalScholarshipDiscounts)) * 100) 
    : 0;

  // Aging Receivables List (Owed > 0)
  const agingReceivables = studentRevenueData.filter(item => item.owed > 0 && item.student.studentStatus === 'Active');

  // Branch Revenue analytics
  const branchFinancials = state.branches.map(branch => {
    const branchItems = studentRevenueData.filter(item => item.student.homeBranchId === branch.id && item.student.studentStatus === 'Active');
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
      owed: netExpected - branchCollected > 0 ? netExpected - branchCollected : 0,
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

      state.students.forEach(student => {
        if (student.studentStatus !== 'Active') return;
        if (filterBranch !== 'all' && student.homeBranchId !== filterBranch) return;
        if (filterScholarship !== 'all' && student.scholarshipId !== filterScholarship) return;
        if (isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(student))) return;

        const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
        const isEarly = scholarship?.typeName === 'Early Group Student';
        const fee = isEarly ? 25.0 : 45.0;
        const discount = fee * ((isEarly ? 0 : (scholarship?.discountPercentage || 0)) / 100);
        const netFee = fee - discount;

        mExpected += fee;
        mDiscounts += discount;

        const payment = state.payments.find(p => p.studentId === student.id && p.year === filterYear && p.month === m);
        if (payment?.status === 'Paid') {
          mCollected += (payment.amountUsd !== undefined ? payment.amountUsd : netFee);
        }
      });

      const netExpected = mExpected - mDiscounts;
      const rate = netExpected > 0 ? Math.round((mCollected / netExpected) * 100) : 0;
      const isPastOrCurrent = filterYear < currentActualYear || (filterYear === currentActualYear && months.indexOf(m) <= currentActualMonthIndex);

      return {
        month: m,
        expected: netExpected,
        collected: mCollected,
        owed: Math.max(0, netExpected - mCollected),
        discounts: mDiscounts,
        rate,
        isPastOrCurrent
      };
    });
  }, [state.students, state.payments, state.scholarships, filterYear, filterBranch, filterScholarship, currentActualYear, currentActualMonthIndex]);

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
      const basePrice = isEarly ? 25.0 : 45.0;
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
  }, [state.scholarships, state.students]);

  const activeStudentProfile = studentDetailsId ? state.students.find(s => s.id === studentDetailsId) : null;
  const activeStudentScholarship = activeStudentProfile ? state.scholarships.find(s => s.id === activeStudentProfile.scholarshipId) : null;
  const isEarlyGroupStudent = activeStudentScholarship?.typeName === 'Early Group Student';
  const studentBasePrice = isEarlyGroupStudent ? 25.00 : 45.00;
  const activeDiscountPct = isEarlyGroupStudent ? 0 : (activeStudentScholarship?.discountPercentage || 0);
  const netMonthlyFee = studentBasePrice * (1 - activeDiscountPct / 100);
  
  const activeStudentEnrollDate = activeStudentProfile ? getStudentEnrollDate(activeStudentProfile) : null;
  let activeBillingAnchorDay = '-';
  if (activeStudentProfile && activeStudentEnrollDate) {
    const d = new Date(activeStudentEnrollDate.split('T')[0]);
    d.setDate(d.getDate() - 1);
    activeBillingAnchorDay = `${d.getDate()}`;
  }

  const prepayPreviewList = (() => {
    const finalAmount = parseFloat(prepayAmount) || (netMonthlyFee * prepayMonths);
    const amountPerMonth = finalAmount / prepayMonths;
    const list = [];
    let curMonthIdx = months.indexOf(prepayStartMonth);
    if (curMonthIdx === -1) curMonthIdx = 0;
    let curYear = prepayStartYear;

    for (let i = 0; i < prepayMonths; i++) {
      list.push({
        year: curYear,
        month: months[curMonthIdx],
        amount: amountPerMonth
      });
      curMonthIdx++;
      if (curMonthIdx >= 12) {
        curMonthIdx = 0;
        curYear++;
      }
    }
    return list;
  })();

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
                            `txn-pay-${p.id}`.includes(q);
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

  const transactionStats = (() => {
    const count = filteredTransactionsList.length;
    const totalCollected = filteredTransactionsList.reduce((acc, curr) => acc + (curr.amountUsd || 0), 0);
    const avgVal = count > 0 ? totalCollected / count : 0;
    const maxVal = filteredTransactionsList.reduce((max, curr) => Math.max(max, curr.amountUsd || 0), 0);
    const paidCount = filteredTransactionsList.filter(p => p.status === 'Paid').length;
    return { count, totalCollected, avgVal, maxVal, paidCount };
  })();

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
        `"TXN-PAY-${p.id}"`,
        `"${(student?.englishName || 'Unknown').replace(/"/g, '""')}"`,
        `"${student?.id || ''}"`,
        `"${branchName.replace(/"/g, '""')}"`,
        `"${p.month}"`,
        p.year,
        `"${(scholarship?.typeName || 'Standard').replace(/"/g, '""')}"`,
        `"${p.status}"`,
        (p.amountUsd || 0).toFixed(2)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `infinitytkd-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredTransactionsList.length} transactions to CSV`, 'success');
  };

  const handleCopyTxnId = (idStr: string) => {
    navigator.clipboard.writeText(idStr);
    setCopiedTxnId(idStr);
    setTimeout(() => setCopiedTxnId(null), 2000);
  };

  const handleProcessBulkPrepay = async () => {
    if (!activeStudentProfile) return;
    const finalAmount = parseFloat(prepayAmount) || (netMonthlyFee * prepayMonths);
    const amountPerMonth = finalAmount / prepayMonths;

    const prepayList: { year: number; month: string; amount: number }[] = [];
    let curMonthIdx = months.indexOf(prepayStartMonth);
    if (curMonthIdx === -1) curMonthIdx = 0;
    let curYear = prepayStartYear;

    for (let i = 0; i < prepayMonths; i++) {
      prepayList.push({
        year: curYear,
        month: months[curMonthIdx],
        amount: amountPerMonth
      });
      curMonthIdx++;
      if (curMonthIdx >= 12) {
        curMonthIdx = 0;
        curYear++;
      }
    }

    setIsProcessingPrepay(true);
    try {
      await prepayInvoiceBulk(activeStudentProfile.id, prepayList);
      showNotification(`🎉 Successfully prepaid ${prepayMonths} months ($${finalAmount.toFixed(2)} total)!`, 'success');
      setShowPrepayPanel(false);
      setPrepayAmount('');
    } catch (e: any) {
      console.error(e);
      showNotification("Failed to complete bulk prepayment.", 'error');
    } finally {
      setIsProcessingPrepay(false);
    }
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
      billingStatus: 'Paid' | 'Due Soon' | 'Overdue' | 'Waived' | 'Upcoming';
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
      if (student.studentStatus !== 'Active') return;

      if (calendarFilterBranch !== 'all' && student.homeBranchId !== calendarFilterBranch) return;

      if (calendarSearch.trim()) {
        const q = calendarSearch.toLowerCase();
        if (!student.englishName.toLowerCase().includes(q) && !student.id.toLowerCase().includes(q)) return;
      }

      const enrollDateStr = getStudentEnrollDate(student);
      if (isMonthBeforeEnrollment(calendarMonth, calendarYear, enrollDateStr)) {
        return;
      }

      let anchorDay = 1;
      if (enrollDateStr) {
        const parts = enrollDateStr.split('T')[0].split('-');
        if (parts.length === 3) {
          const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          dObj.setDate(dObj.getDate() - 1);
          anchorDay = dObj.getDate();
        }
      } else if (student.registrationDate) {
        const parts = student.registrationDate.split('T')[0].split('-');
        if (parts.length === 3) {
          const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          dObj.setDate(dObj.getDate() - 1);
          anchorDay = dObj.getDate();
        }
      }

      const dueDay = Math.min(anchorDay, daysInMonth);

      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isEarlyGroup ? 25.00 : 45.00;
      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const requiredPayment = baseFee * (1 - discountPct / 100);

      let status: 'Paid' | 'Due Soon' | 'Overdue' | 'Waived' | 'Upcoming' = 'Upcoming';
      let amountOwed = requiredPayment;

      if (discountPct === 100) {
        status = 'Waived';
        amountOwed = 0;
      } else {
        const p = state.payments.find(pm => pm.studentId === student.id && pm.year === calendarYear && pm.month === calendarMonth);
        if (p?.status === 'Paid') {
          status = 'Paid';
          amountOwed = 0;
        } else {
          const isPastMonth = calendarYear < currentActualYear || (calendarYear === currentActualYear && monthIdx < currentActualMonthIndex);
          const isCurrentMonth = calendarYear === currentActualYear && monthIdx === currentActualMonthIndex;
          if (isPastMonth) {
            status = 'Overdue';
          } else if (isCurrentMonth) {
            const todayDate = new Date().getDate();
            if (todayDate > dueDay) {
              status = 'Overdue';
            } else {
              status = 'Due Soon';
            }
          } else {
            status = 'Upcoming';
          }
        }
      }

      // 1. Accumulate month totals across all active renewals
      totalRenewals++;
      expectedSum += requiredPayment;

      if (status === 'Paid') {
        totalPaid++;
        collectedSum += requiredPayment;
      } else if (status === 'Waived') {
        totalWaived++;
      } else if (status === 'Overdue') {
        totalOverdue++;
        outstandingSum += requiredPayment;
      } else {
        totalPending++;
        outstandingSum += requiredPayment;
      }

      // 2. Filter days by status for calendar grid & agenda list
      if (calendarFilterStatus === 'overdue' && status !== 'Overdue') return;
      if (calendarFilterStatus === 'pending' && status !== 'Due Soon') return;
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
  }, [state.students, state.payments, state.scholarships, state.branches, calendarYear, calendarMonth, calendarFilterStatus, calendarSearch, calendarFilterBranch, currentActualYear, currentActualMonthIndex]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12">
      {/* Top Header & Tab switcher */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#EF2F38]"/>
              Academy Tuition & Billing CRM
            </h1>
            <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono tracking-widest mt-0.5">Payment Ledgers & Receivables</p>
          </div>
          {isReadOnlyLedger && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
              <span>👁️</span> Read-Only Mode
            </span>
          )}
        </div>
        <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-1 shrink-0 flex-nowrap overflow-x-auto no-scrollbar scrollbar-none w-full md:w-auto gap-1">
          <button onClick={() => setActiveTab('ledger')}
            className={cn("px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 active:scale-95 touch-manipulation", activeTab === 'ledger' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <FileText className="w-3.5 h-3.5"/> Ledger Grid
          </button>
          <button onClick={() => setActiveTab('revenue')}
            className={cn("px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 active:scale-95 touch-manipulation", activeTab === 'revenue' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <ChartLine className="w-3.5 h-3.5"/> Revenue Dashboard
          </button>
          <button onClick={() => setActiveTab('transactions')}
            className={cn("px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 active:scale-95 touch-manipulation", activeTab === 'transactions' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <Receipt className="w-3.5 h-3.5"/> Transactions Log
          </button>
          <button onClick={() => setActiveTab('calendar')}
            className={cn("px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 active:scale-95 touch-manipulation", activeTab === 'calendar' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-[#EF2F38]"/> Renewal Calendar
          </button>
        </div>
      </div>

      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Controls & Renewal Alerts Left Column */}
            <div className="lg:col-span-1 space-y-4">
              {/* Financial CRM Controls */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col gap-3.5 sm:gap-4 shadow-sm">
                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-900 dark:text-[#E4E4E4] flex items-center justify-between">
                    <span>Financial CRM</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-600 dark:text-neutral-400 font-bold">
                      {filteredStudents.length} Active
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono leading-relaxed mt-1">
                    Manage tuition, track missing payments, and apply scholarship discounts for {filterYear}.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Search Student Input */}
                  <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-[#666]" />
                    <input 
                      type="text" 
                      placeholder="Search student or ID..." 
                      value={search} 
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setLedgerPage(1);
                      }}
                      className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                    />
                    {search && (
                      <button 
                        onClick={() => {
                          setSearch('');
                          setLedgerPage(1);
                        }} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Segmented Control */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">
                      Status Filter
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-[#0F0F0F] p-1 rounded-[6px] border border-neutral-200 dark:border-[#262626] text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('all');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center",
                          ledgerStatusFilter === 'all'
                            ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('unpaid');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center gap-1",
                          ledgerStatusFilter === 'unpaid'
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-rose-600"
                        )}
                      >
                        <span>Unpaid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('paid');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center gap-1",
                          ledgerStatusFilter === 'paid'
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-emerald-600"
                        )}
                      >
                        <span>Paid</span>
                      </button>
                    </div>
                  </div>

                  {/* Year & Month Selectors */}
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={filterYear} 
                      onChange={(e) => {
                        setFilterYear(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      <option value={currentActualYear}>{currentActualYear}</option>
                      <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                      <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
                    </select>

                    <select 
                      value={filterMonth} 
                      onChange={(e) => {
                        setFilterMonth(e.target.value);
                        setLedgerPage(1);
                      }}
                      className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      <option value="all">YTD / All</option>
                      {months.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Branch Filter */}
                  <select 
                    value={filterBranch} 
                    onChange={(e) => {
                      setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setLedgerPage(1);
                    }}
                    className="w-full bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="all">All Branches</option>
                    {state.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  {/* Scholarship Tier Filter */}
                  <select 
                    value={filterScholarship} 
                    onChange={(e) => {
                      setFilterScholarship(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setLedgerPage(1);
                    }}
                    className="w-full bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="all">Any Scholarship Tier</option>
                    {state.scholarships.map(s => (
                      <option key={s.id} value={s.id}>{s.typeName} ({s.discountPercentage}%)</option>
                    ))}
                  </select>

                  {/* Reset Filters Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilterYear(currentActualYear);
                      setFilterMonth('all');
                      setFilterBranch('all');
                      setFilterScholarship('all');
                      setLedgerStatusFilter('all');
                      setLedgerSortField(null);
                      setLedgerSortDirection('asc');
                      setLedgerPage(1);
                    }}
                    className="w-full h-9 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                  >
                    <ArrowClockwise className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>

                  {/* Base Monthly Tuition display */}
                  <div className="pt-2 border-t border-neutral-200 dark:border-[#262626]">
                    <label className="block text-[9px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1">
                      Base Standard Tuition
                    </label>
                    <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#888] rounded-[6px] text-xs px-3 py-1.5 font-mono flex items-center justify-between">
                      <span>Full Monthly Rate</span> 
                      <span className="text-neutral-900 dark:text-white font-bold">${standardMonthlyFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Membership Renewal Alerts Card (With Mobile Accordion Toggle) */}
              {(() => {
                const alerts = state.students
                  .filter(student => student.studentStatus === 'Active')
                  .map(student => {
                    const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments);
                    return { student, billing };
                  })
                  .filter(item => item.billing.status === 'Overdue' || item.billing.status === 'Due Soon')
                  .filter(item => {
                    if (!alertSearch) return true;
                    const q = alertSearch.toLowerCase();
                    return item.student.englishName.toLowerCase().includes(q) || item.student.id.toLowerCase().includes(q);
                  })
                  .sort((a, b) => {
                    if (a.billing.status === 'Overdue' && b.billing.status !== 'Overdue') return -1;
                    if (a.billing.status !== 'Overdue' && b.billing.status === 'Overdue') return 1;
                    return a.billing.daysRemaining - b.billing.daysRemaining;
                  });

                return (
                  <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm space-y-3">
                    <div 
                      className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2 cursor-pointer lg:cursor-default"
                      onClick={() => setIsAlertsCollapsedMobile(prev => !prev)}
                    >
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] uppercase tracking-widest text-[#EF2F38] font-mono font-bold">Billing CRM</span>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white leading-none">Renewal Alerts</h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-full text-[9px] font-bold font-mono">
                          {alerts.length} Pending
                        </span>
                        <span className="lg:hidden text-neutral-400 text-xs font-mono ml-1">
                          {isAlertsCollapsedMobile ? '▼' : '▲'}
                        </span>
                      </div>
                    </div>

                    <div className={cn("space-y-3", isAlertsCollapsedMobile && "hidden lg:block")}>
                      {alerts.length > 3 && (
                        <div className="relative">
                          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                          <input
                            type="text"
                            placeholder="Filter alerts..."
                            value={alertSearch}
                            onChange={(e) => setAlertSearch(e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded text-[10px] focus:outline-none focus:border-[#EF2F38]"
                          />
                        </div>
                      )}

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {alerts.length === 0 ? (
                          <div className="py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs font-mono">
                            <Check className="w-5 h-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400 opacity-60" />
                            <span>All renewals up to date!</span>
                          </div>
                        ) : (
                          alerts.map(({ student, billing }) => {
                            const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
                            return (
                              <div 
                                key={student.id}
                                className={cn(
                                  "p-2.5 rounded-[6px] border text-xs flex flex-col gap-2 relative group hover:border-[#EF2F38]/30 transition-all duration-150 shadow-xs",
                                  billing.status === 'Overdue' 
                                    ? "bg-rose-500/5 border-rose-500/20" 
                                    : "bg-amber-500/5 border-amber-500/20"
                                )}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                      className="font-bold text-neutral-900 dark:text-white leading-none hover:text-[#EF2F38] text-left cursor-pointer transition-colors"
                                    >
                                      {student.englishName}
                                    </button>
                                    <div className="text-[9px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">
                                      {student.id} • {branchName}
                                    </div>
                                  </div>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                                    billing.status === 'Overdue' 
                                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" 
                                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                                  )}>
                                    {billing.status}
                                  </span>
                                </div>

                                <div className="flex justify-between items-end border-t border-neutral-200 dark:border-[#262626] pt-2 mt-0.5">
                                  <div className="text-[9px] text-neutral-600 dark:text-neutral-400 leading-tight">
                                    <span className="block text-neutral-400 dark:text-[#666] font-mono uppercase tracking-wider text-[7px]">Target</span>
                                    {billing.status === 'Overdue' 
                                      ? `${Math.abs(billing.daysRemaining)}d overdue`
                                      : `Due in ${billing.daysRemaining}d`}
                                  </div>

                                  {!isReadOnlyLedger ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const currentMonthIdx = new Date().getMonth();
                                        const currentMonthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonthIdx];
                                        const currentYear = new Date().getFullYear();
                                        try {
                                          await payInvoice(student.id, currentYear, currentMonthNameShort, billing.amountOwed);
                                          showNotification(`Collected $${billing.amountOwed.toFixed(2)} renewal for ${student.englishName}.`, 'success');
                                        } catch (e: any) {
                                          showNotification(`Payment logging failed: ${e.message}`, 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-[6px] text-[8.5px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation"
                                    >
                                      <Coins className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      Pay ${billing.amountOwed.toFixed(0)}
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] text-neutral-500 rounded text-[8px] font-bold uppercase tracking-wider shrink-0">
                                      View Only
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Analytics & Ledger Matrix / Cards */}
            <div className="lg:col-span-3 space-y-4 min-w-0">
              {/* 3 Quick Analytics Boxes: Responsive 3-grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-widest mb-1">Collected Income</p>
                    <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${totalCollected.toFixed(2)}</h2>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Confirmed collections {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-widest mb-1">Outstanding Dues</p>
                    <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${outstandingBalance.toFixed(2)}</h2>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Pending balances {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase font-bold tracking-widest mb-1">Scholarship Subsidies</p>
                    <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${totalScholarshipDiscounts.toFixed(2)}</h2>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Fee waivers {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>
              </div>

              {/* Matrix Toolbar: View Mode Switcher, Legend & CSV Export */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Visual Legend */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] font-mono font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-[9px] mr-0.5">Legend:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Paid
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Due
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Warning className="w-2.5 h-2.5" /> Late
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
                    Pre-Join
                  </span>
                </div>

                {/* Right controls: View Switcher (Matrix vs Cards) & CSV Export */}
                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-200 dark:border-[#262626]">
                  {/* View Mode Toggle Button */}
                  <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] border border-neutral-200 dark:border-[#262626] p-0.5">
                    <button
                      type="button"
                      onClick={() => setLedgerViewMode('matrix')}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer",
                        ledgerViewMode === 'matrix' 
                          ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black" 
                          : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                      )}
                      title="Dense Table Matrix View"
                    >
                      <ListDashes className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Matrix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerViewMode('cards')}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer",
                        ledgerViewMode === 'cards' 
                          ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black" 
                          : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                      )}
                      title="Card Dossier View"
                    >
                      <SquaresFour className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={exportLedgerMatrixToCsv}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95 touch-manipulation"
                    title="Export 12-Month Matrix to CSV"
                  >
                    <DownloadSimple className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* View 1: Native Mobile / Responsive Student Dossier Cards */}
              {ledgerViewMode === 'cards' && (
                <div className="space-y-3">
                  {paginatedStudents.length === 0 ? (
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-8 text-center text-neutral-500 dark:text-[#666]">
                      <p className="font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] mb-1">No matching students</p>
                      <p className="font-mono text-xs">Adjust search term or filter status</p>
                    </div>
                  ) : (
                    paginatedStudents.map(student => {
                      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
                      const baseFee = isEarlyGroup ? 25.00 : 45.00;
                      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
                      const reqPayment = baseFee * (1 - discountPct / 100);

                      const enrollDate = getStudentEnrollDate(student);
                      let dueDay = '-';
                      if (enrollDate) {
                        const d = new Date(enrollDate.split('T')[0]);
                        d.setDate(d.getDate() - 1);
                        dueDay = String(d.getDate());
                      }

                      // Check student overdue status
                      let hasOverdue = false;
                      months.slice(0, currentActualMonthIndex + 1).forEach(m => {
                        if (isMonthBeforeEnrollment(m, filterYear, enrollDate)) return;
                        const p = state.payments.find(pm => pm.studentId === student.id && pm.year === filterYear && pm.month === m);
                        if (discountPct < 100 && p?.status !== 'Paid') {
                          hasOverdue = true;
                        }
                      });

                      return (
                        <div 
                          key={student.id} 
                          className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-3 hover:border-neutral-300 dark:hover:border-[#333] transition-all"
                        >
                          {/* Student Header Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SafeImage 
                                src={student.profilePicturePath} 
                                alt={student.englishName} 
                                containerClassName="w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                                fallback={<span className="font-bold text-neutral-400 dark:text-[#666] text-xs">{student.englishName.charAt(0)}</span>}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <span className="truncate">{student.englishName}</span>
                                  {student.khmerName && (
                                    <span className="text-[11px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                      {student.khmerName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5 flex flex-wrap items-center gap-1">
                                  <span>{student.id}</span>
                                  <span className="opacity-40">•</span>
                                  <span>{state.branches.find(b => b.id === student.homeBranchId)?.name}</span>
                                  <span className="opacity-40">•</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-200">Due: Day {dueDay}</span>
                                </div>
                              </div>
                            </div>

                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider shrink-0 border",
                              hasOverdue 
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" 
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            )}>
                              {hasOverdue ? 'Overdue Dues' : 'Up to Date'}
                            </span>
                          </div>

                          {/* Swipeable 12-Month Capsule Rail */}
                          <div className="pt-2 border-t border-neutral-100 dark:border-[#202020]">
                            <div className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between">
                              <span>12-Month Billing Timeline</span>
                              <span className="text-neutral-400">Swipe to view</span>
                            </div>
                            <div className="flex overflow-x-auto no-scrollbar scrollbar-none gap-1.5 pb-1">
                              {months.map((m, idx) => {
                                const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
                                const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
                                const payment = state.payments.find(p => p.studentId === student.id && p.year === filterYear && p.month === m);
                                const isPaid = payment?.status === 'Paid' || (scholarship && scholarship.discountPercentage === 100);
                                const isCurrent = filterYear === currentActualYear && idx === currentActualMonthIndex;

                                return (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                    className={cn(
                                      "min-w-[48px] py-1.5 px-1 rounded-[6px] border flex flex-col items-center justify-between text-center transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                                      isBeforeEnroll ? "opacity-35 bg-neutral-100 dark:bg-[#1A1A1A] border-transparent" :
                                      isPaid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" :
                                      isFuture ? "opacity-30 bg-neutral-100 dark:bg-[#141414] border-neutral-200 dark:border-[#262626]" :
                                      isCurrent ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 ring-1 ring-amber-500/30" :
                                      "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/35"
                                    )}
                                  >
                                    <span className="text-[9px] font-mono font-bold block">{m}</span>
                                    {isBeforeEnroll ? (
                                      <span className="text-[7px] font-mono text-neutral-400 uppercase mt-0.5">Pre</span>
                                    ) : isPaid ? (
                                      <Check className="w-3 h-3 stroke-[3] mt-0.5" />
                                    ) : isFuture ? (
                                      <span className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-600 mt-1.5 mb-1" />
                                    ) : (
                                      <span className="text-[7.5px] font-mono font-bold mt-0.5 uppercase">
                                        {isCurrent ? 'DUE' : 'LATE'}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Action Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-[#202020]">
                            <div className="font-mono text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Fee: </span>
                              <strong className="text-neutral-900 dark:text-white">${reqPayment.toFixed(2)}/mo</strong>
                              {scholarship && scholarship.discountPercentage > 0 && (
                                <span className="ml-1 text-[9px] text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                                  ({scholarship.discountPercentage}% off)
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90 active:scale-95 touch-manipulation cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <span>Dossier / Pay</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* View 2: Tablet & Desktop Dense Matrix Table */}
              {ledgerViewMode === 'matrix' && (
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                  {/* Mobile Tip for Matrix Mode */}
                  <div className="md:hidden px-3.5 py-2 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between text-[10px] text-neutral-500 dark:text-[#888]">
                    <span>Swipe horizontally for 12-month grid</span>
                    <button 
                      type="button"
                      onClick={() => setLedgerViewMode('cards')}
                      className="text-[#EF2F38] font-bold uppercase hover:underline cursor-pointer active:scale-95 touch-manipulation"
                    >
                      Cards View →
                    </button>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar max-h-[650px] relative">
                    <table className="w-full text-left text-xs whitespace-nowrap border-collapse min-w-[850px]">
                      <thead className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                        <tr>
                          {/* Sticky Left Header: Student / Plan */}
                          <th className="sticky left-0 top-0 z-30 bg-neutral-100 dark:bg-[#0F0F0F] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3.5 w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                            <div className="flex items-center justify-between">
                              <span>Student / Plan</span>
                              <div className="flex items-center gap-1 bg-white dark:bg-[#141414] rounded-[6px] px-1.5 py-0.5 text-[8px] font-mono border border-neutral-200 dark:border-[#262626]">
                                <span className="text-neutral-400 dark:text-[#666] select-none">SORT:</span>
                                <button 
                                  type="button"
                                  onClick={() => handleLedgerSort('student')}
                                  className={cn("hover:text-neutral-900 dark:hover:text-white transition-colors uppercase font-bold cursor-pointer px-0.5", ledgerSortField === 'student' ? "text-[#EF2F38]" : "text-neutral-500 dark:text-[#999]")}
                                >
                                  Name {ledgerSortField === 'student' && (ledgerSortDirection === 'asc' ? '▲' : '▼')}
                                </button>
                                <span className="text-neutral-300 dark:text-[#333] select-none">|</span>
                                <button 
                                  type="button"
                                  onClick={() => handleLedgerSort('dueDay')}
                                  className={cn("hover:text-neutral-900 dark:hover:text-white transition-colors uppercase font-bold cursor-pointer px-0.5", ledgerSortField === 'dueDay' ? "text-[#EF2F38]" : "text-neutral-500 dark:text-[#999]")}
                                >
                                  Due {ledgerSortField === 'dueDay' && (ledgerSortDirection === 'asc' ? '▲' : '▼')}
                                </button>
                              </div>
                            </div>
                          </th>

                          {/* 12 Month Headers */}
                          {months.map(m => (
                            <th key={m} className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0F0F0F] px-1.5 py-3.5 text-center w-16 min-w-[64px] font-mono font-bold text-[10px]">
                              {m}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                        {state.isLoading ? (
                          [1, 2, 3, 4, 5].map(i => (
                            <tr key={i} className="animate-pulse">
                              <td className="sticky left-0 bg-white dark:bg-[#141414] px-4 sm:px-5 py-3 border-r border-neutral-200 dark:border-[#262626] w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#262626]" />
                                  <div className="space-y-1.5 flex-1">
                                    <div className="w-28 h-3.5 bg-neutral-200 dark:bg-[#262626] rounded" />
                                    <div className="w-20 h-2.5 bg-neutral-100 dark:bg-[#202020] rounded" />
                                  </div>
                                </div>
                              </td>
                              {months.map(m => (
                                <td key={m} className="px-1.5 py-2 text-center w-16 min-w-[64px]">
                                  <div className="w-full h-8 rounded-[6px] bg-neutral-100 dark:bg-[#202020]" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : paginatedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-6 py-12 text-center text-neutral-500 dark:text-[#666]">
                              <p className="font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] mb-1">No matching students</p>
                              <p className="font-mono text-[10px]">Adjust search term or filter status</p>
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map(student => {
                            const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                            const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
                            const baseFee = isEarlyGroup ? 25.00 : 45.00;
                            const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
                            const reqPayment = baseFee * (1 - discountPct / 100);

                            const enrollDate = getStudentEnrollDate(student);
                            let dueDay = '-';
                            if (enrollDate) {
                              const d = new Date(enrollDate.split('T')[0]);
                              d.setDate(d.getDate() - 1);
                              dueDay = String(d.getDate());
                            }

                            return (
                              <tr key={student.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-900 dark:text-[#E4E4E4] group">
                                {/* Sticky Student Column */}
                                <td 
                                  className="sticky left-0 z-10 bg-white dark:bg-[#141414] group-hover:bg-neutral-50 dark:group-hover:bg-[#1A1A1A] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3 cursor-pointer transition-colors w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]"
                                  onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                >
                                  <div className="flex items-center gap-3">
                                    <SafeImage 
                                      src={student.profilePicturePath} 
                                      alt={student.englishName} 
                                      containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                                      fallback={<span className="font-bold text-neutral-400 dark:text-[#666] text-[10px]">{student.englishName.charAt(0)}</span>}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-xs text-neutral-900 dark:text-white group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors flex items-center gap-1.5 truncate">
                                        <span className="truncate">{student.englishName}</span>
                                        {student.khmerName && (
                                          <span className="text-[10px] font-khmer text-neutral-400 dark:text-neutral-500 font-normal shrink-0">
                                            {student.khmerName}
                                          </span>
                                        )}
                                        {scholarship && scholarship.discountPercentage > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-widest text-[7px] border border-indigo-500/20 shrink-0">
                                            {scholarship.typeName}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-neutral-500 dark:text-[#666] font-mono mt-0.5 tracking-tight flex items-center gap-1 truncate">
                                        <span>{student.id}</span>
                                        <span className="opacity-50">•</span>
                                        <span className="truncate">{state.branches.find(b => b.id === student.homeBranchId)?.name}</span>
                                        <span className="opacity-50">•</span>
                                        <span className="text-neutral-700 dark:text-neutral-300 font-bold">Due: Day {dueDay}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 12 Interactive Month Cells */}
                                {months.map((m, idx) => {
                                  const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
                                  const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
                                  const payment = state.payments.find(p => p.studentId === student.id && p.year === filterYear && p.month === m);
                                  const isPaid = payment?.status === 'Paid' || (scholarship && scholarship.discountPercentage === 100);
                                  const isCurrent = filterYear === currentActualYear && idx === currentActualMonthIndex;

                                  return (
                                    <td key={m} className="px-1.5 py-2 text-center w-16 min-w-[64px]">
                                      {isBeforeEnroll ? (
                                        <div 
                                          title={`Pre-Enrollment (Enrolled ${enrollDate || 'N/A'})`}
                                          className="w-full h-8 flex flex-col justify-center items-center opacity-30 select-none"
                                        >
                                          <span className="text-[7.5px] font-bold uppercase tracking-wider font-mono text-neutral-400 dark:text-[#666]">Pre-Join</span>
                                        </div>
                                      ) : isPaid ? (
                                        <button 
                                          type="button"
                                          onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                          title={`${m} ${filterYear}: Paid $${(payment?.amountUsd ?? reqPayment).toFixed(2)}`}
                                          className="w-full h-8 rounded-[6px] flex flex-col items-center justify-center transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]"/>
                                          <span className="text-[7.5px] font-mono font-bold mt-0.5">
                                            ${(payment?.amountUsd ?? reqPayment).toFixed(0)}
                                          </span>
                                        </button>
                                      ) : isFuture ? (
                                        <div 
                                          title={`${m} ${filterYear}: Upcoming billing cycle`}
                                          className="w-full h-8 flex flex-col justify-center items-center opacity-30 select-none"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600"></span>
                                        </div>
                                      ) : (
                                        <button 
                                          type="button"
                                          onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                          title={`${m} ${filterYear}: ${isCurrent ? 'Due Now' : 'Overdue'} ($${reqPayment.toFixed(2)})`}
                                          className={cn(
                                            "w-full h-8 rounded-[6px] flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs relative overflow-hidden active:scale-95 touch-manipulation",
                                            isCurrent 
                                              ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/35" 
                                              : "bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/35"
                                          )}
                                        >
                                          <span className="text-[7.5px] font-bold uppercase tracking-widest font-mono">
                                            {isCurrent ? 'DUE' : 'LATE'}
                                          </span>
                                          <span className="text-[7.5px] font-mono font-bold mt-0.5">
                                            ${reqPayment.toFixed(0)}
                                          </span>
                                          {isCurrent && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500"></span>}
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>

                      {/* Sticky Footer: Monthly Yield & Rate Matrix Row */}
                      <tfoot className="sticky bottom-0 z-20 bg-neutral-100 dark:bg-[#0F0F0F] border-t-2 border-neutral-300 dark:border-[#262626] font-mono text-xs">
                        <tr>
                          <td className="sticky left-0 z-30 bg-neutral-100 dark:bg-[#0F0F0F] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3 w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[10px]">
                                Total Monthly Yield
                              </span>
                              <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                                (Roster)
                              </span>
                            </div>
                          </td>
                          {monthlyLedgerMatrixTotals.map(totals => (
                            <td key={totals.month} className="px-1.5 py-2.5 text-center w-16 min-w-[64px]">
                              <div className="space-y-0.5">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[10px] block">
                                  ${totals.totalCollected.toFixed(0)}
                                </span>
                                <div className="text-[8px] text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-0.5">
                                  <span>{totals.paidCount}/{totals.eligibleCount}</span>
                                </div>
                                {totals.eligibleCount > 0 && (
                                  <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full",
                                        totals.rate >= 80 ? "bg-emerald-500" : totals.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                                      )}
                                      style={{ width: `${Math.min(totals.rate, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination & Per-Page Controls (Responsive) */}
              {filteredStudents.length > 0 && (
                <div className="p-3 border border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                    <span>
                      Showing {Math.min((ledgerPage - 1) * ledgerPerPage + 1, filteredStudents.length)}–{Math.min(ledgerPage * ledgerPerPage, filteredStudents.length)} of {filteredStudents.length} students
                    </span>
                    <span className="opacity-40">•</span>
                    <span>Rows:</span>
                    <select
                      value={ledgerPerPage}
                      onChange={(e) => {
                        setLedgerPerPage(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded px-1.5 py-0.5 text-neutral-900 dark:text-white font-mono cursor-pointer"
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                      disabled={ledgerPage <= 1}
                      className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px]"
                    >
                      <CaretLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="px-2 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      Page <strong className="text-neutral-900 dark:text-white">{ledgerPage}</strong> of {totalLedgerPages}
                    </span>

                    <button
                      onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                      disabled={ledgerPage >= totalLedgerPages}
                      className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px]"
                    >
                      <span>Next</span>
                      <CaretRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Integrated Filter Bar */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 shadow-sm">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white flex items-center gap-2">
                <ChartLine className="w-4 h-4 text-[#EF2F38]" />
                Revenue & Receivable Analytics
              </h2>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                Realized tuition yield, facility-level performance, and overdue receivable tracking
              </p>
            </div>

            {/* Quick Filter Capsule Controls (Responsive Grid on Mobile) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-mono font-bold focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value={currentActualYear}>{currentActualYear}</option>
                <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
              </select>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Months</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Branches</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={filterScholarship}
                onChange={(e) => setFilterScholarship(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Plans</option>
                {state.scholarships.map(s => (
                  <option key={s.id} value={s.id}>{s.typeName}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setFilterYear(currentActualYear);
                  setFilterMonth('all');
                  setFilterBranch('all');
                  setFilterScholarship('all');
                }}
                className="col-span-2 sm:col-span-1 h-9 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                title="Reset active revenue filters"
              >
                <ArrowClockwise className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Collection Rate</p>
               <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{collectionRate}%</h2>
               <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full mt-2.5 sm:mt-3 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      collectionRate >= 80 ? "bg-emerald-500" : collectionRate >= 60 ? "bg-amber-500" : "bg-rose-500"
                    )} 
                    style={{ width: `${Math.min(collectionRate, 100)}%` }} 
                  />
               </div>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">
                 ${(totalExpected - totalScholarshipDiscounts).toFixed(0)} Net Due
               </p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Realized Revenue</p>
               <h2 className="text-xl sm:text-2xl font-mono text-emerald-700 dark:text-emerald-400 font-bold">${totalCollected.toFixed(2)}</h2>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">Confirmed tuition yield</p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Outstanding Dues</p>
               <h2 className="text-xl sm:text-2xl font-mono text-rose-700 dark:text-rose-400 font-bold">${outstandingBalance.toFixed(2)}</h2>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">{agingReceivables.length} accounts overdue</p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Subsidies</p>
               <h2 className="text-xl sm:text-2xl font-mono text-indigo-600 dark:text-indigo-400 font-bold">${totalScholarshipDiscounts.toFixed(2)}</h2>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">Academy waivers</p>
             </div>
          </div>

          {/* 12-Month Revenue & Collection Trajectory (Responsive rail on Mobile, 12-col on Desktop) */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-3">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <TrendUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Monthly Tuition Trajectory & Velocity ({filterYear})
                </h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                  12-month receipt velocity comparing collected revenue against net billing obligations
                </p>
              </div>

              {peakRevenueMonth && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold shrink-0 self-start sm:self-auto">
                  <Sparkle className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                  Peak: {peakRevenueMonth.month} (${peakRevenueMonth.collected.toFixed(0)})
                </div>
              )}
            </div>

            {/* Trajectory Rail: Swipeable on mobile, 4-col on tablet, 12-col on desktop */}
            <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-12 overflow-x-auto sm:overflow-visible no-scrollbar scrollbar-none gap-2 pt-1 pb-1 snap-x">
              {monthlyRevenueTrajectory.map(item => {
                const isCurrentMonth = filterYear === currentActualYear && item.month === months[currentActualMonthIndex];
                return (
                  <div
                    key={item.month}
                    className={cn(
                      "p-2.5 rounded-[8px] border flex flex-col justify-between transition-all min-w-[76px] sm:min-w-0 shrink-0 snap-start",
                      isCurrentMonth
                        ? "bg-neutral-50 dark:bg-[#1C1C1C] border-[#EF2F38]/40 ring-1 ring-[#EF2F38]/20 shadow-sm"
                        : "bg-neutral-50/50 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn("text-xs font-mono font-bold", isCurrentMonth ? "text-[#EF2F38]" : "text-neutral-900 dark:text-neutral-100")}>
                        {item.month}
                      </span>
                      <span className={cn(
                        "text-[9px] font-mono font-bold px-1 py-0.2 rounded",
                        item.rate >= 80 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" :
                        item.rate >= 50 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" :
                        item.expected === 0 ? "text-neutral-400" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"
                      )}>
                        {item.expected > 0 ? `${item.rate}%` : '-'}
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 dark:bg-[#1F1F1F] rounded h-11 sm:h-12 overflow-hidden flex flex-col justify-end p-0.5 mb-2 border border-neutral-200 dark:border-[#262626]">
                      <div
                        className={cn(
                          "w-full rounded-sm transition-all duration-300",
                          item.rate >= 80 ? "bg-emerald-500" : item.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ height: `${Math.min(100, Math.max(8, item.rate))}%` }}
                        title={`${item.month}: ${item.collected.toFixed(2)} / ${item.expected.toFixed(2)} (${item.rate}%)`}
                      />
                    </div>

                    <div className="space-y-0.5 text-[8.5px] sm:text-[9px] font-mono">
                      <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                        <span>Rec:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">${item.collected.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-500">
                        <span>Due:</span>
                        <span>${item.expected.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Aging Receivables (Responsive Mobile Cards + Desktop Table) */}
            <div className="lg:col-span-2 space-y-4 min-w-0">
              <div className="bg-white dark:bg-[#141414] border border-rose-500/30 rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-3.5 sm:p-4 border-b border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                   <div>
                     <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2">
                       <Warning className="w-4 h-4"/>
                       Aging Receivables & Delinquent Dues
                     </h3>
                     <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                       Actionable accounts requiring tuition collection follow-up
                     </p>
                   </div>
                   <div className="flex items-center gap-1.5 sm:gap-2">
                     <span className="text-[9.5px] sm:text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 font-bold px-2 py-0.5 rounded-[6px] font-mono uppercase tracking-wider">
                       {filteredAgingReceivables.length} Overdue
                     </span>
                     <span className="text-[9.5px] sm:text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 font-bold px-2 py-0.5 rounded-[6px] font-mono">
                       ${totalAgingOwed.toFixed(2)}
                     </span>
                   </div>
                </div>

                {/* Aging Search & Severity Filters */}
                <div className="p-3 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                  <div className="relative w-full sm:w-64">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search overdue student..."
                      value={agingSearch}
                      onChange={(e) => setAgingSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#EF2F38]"
                    />
                    {agingSearch && (
                      <button onClick={() => setAgingSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      onClick={() => setAgingSeverityFilter('all')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px]",
                        agingSeverityFilter === 'all'
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      All ({agingReceivables.length})
                    </button>
                    <button
                      onClick={() => setAgingSeverityFilter('1m')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px]",
                        agingSeverityFilter === '1m'
                          ? "bg-amber-500 text-white font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      )}
                    >
                      1 Month ({agingReceivables.filter(a => a.overdueMonths.length === 1).length})
                    </button>
                    <button
                      onClick={() => setAgingSeverityFilter('2m_plus')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px]",
                        agingSeverityFilter === '2m_plus'
                          ? "bg-rose-600 text-white font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                      )}
                    >
                      2+ Months ({agingReceivables.filter(a => a.overdueMonths.length >= 2).length})
                    </button>
                  </div>
                </div>

                {/* Mobile View: Delinquent Cards (md:hidden) */}
                <div className="md:hidden divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredAgingReceivables.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">No overdue accounts!</p>
                      <p className="text-[10px] mt-0.5">All student accounts are currently settled.</p>
                    </div>
                  ) : (
                    filteredAgingReceivables.map(ar => {
                      const phone = ar.student.emergencyContactPhone || ar.student.phone;
                      return (
                        <div key={ar.student.id} className="p-3.5 space-y-2.5 bg-white dark:bg-[#141414]">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SafeImage 
                                src={ar.student.profilePicturePath} 
                                alt={ar.student.englishName} 
                                containerClassName="w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                                fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-xs">{ar.student.englishName.charAt(0)}</span>}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <span className="truncate">{ar.student.englishName}</span>
                                  {ar.student.khmerName && (
                                    <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                      {ar.student.khmerName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                                  {ar.student.id} • {ar.branchName}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-sm block">
                                ${ar.owed.toFixed(2)}
                              </span>
                              <span className="text-[8.5px] text-neutral-500 dark:text-neutral-400 font-mono">
                                Total Owed
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[9px] uppercase font-mono font-bold text-neutral-500 dark:text-neutral-400 mr-1">
                              Cycles:
                            </span>
                            {ar.overdueMonths.map(om => (
                              <span key={om} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 rounded text-[8.5px] font-mono font-bold">
                                {om}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                            {phone ? (
                              <a
                                href={`tel:${phone}`}
                                className="flex-1 py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Call Parent</span>
                              </a>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => { setStudentDetailsId(ar.student.id); setPaymentAmounts({}); }}
                              className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs active:scale-95 touch-manipulation cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tablet & Desktop View: High-Density Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                   <table className="w-full text-left text-xs whitespace-nowrap">
                     <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                       <tr>
                         <th className="px-4 py-3">Student</th>
                         <th className="px-4 py-3 text-center">Overdue Period</th>
                         <th className="px-4 py-3 text-right">Owed Balance</th>
                         <th className="px-4 py-3 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                       {filteredAgingReceivables.length === 0 ? (
                         <tr>
                           <td colSpan={4} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                             <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                             <p className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">No matching overdue accounts!</p>
                             <p className="text-[10px] mt-0.5">All student accounts are currently settled under active criteria.</p>
                           </td>
                         </tr>
                       ) : filteredAgingReceivables.map(ar => (
                         <tr key={ar.student.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4] group">
                           <td className="px-4 py-3">
                             <div className="flex items-center gap-3">
                               <SafeImage 
                                 src={ar.student.profilePicturePath} 
                                 alt={ar.student.englishName} 
                                 containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                                 fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px]">{ar.student.englishName.charAt(0)}</span>}
                               />
                               <div>
                                 <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors">
                                   {ar.student.englishName}
                                   {ar.student.khmerName && (
                                     <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal">
                                       {ar.student.khmerName}
                                     </span>
                                   )}
                                   <span className="text-[9px] text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] px-1.5 py-0.2 rounded font-mono">
                                     {ar.student.id}
                                   </span>
                                 </div>
                                 <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                   {ar.branchName} • Belt: {formatBelt(ar.student.currentBelt, ar.student.dob)} • Plan: {ar.scholarshipName}
                                 </p>
                               </div>
                             </div>
                           </td>
                           <td className="px-4 py-3 text-center">
                             <div className="flex items-center justify-center gap-1 flex-wrap">
                               {ar.overdueMonths.map(m => (
                                 <span key={m} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded font-mono font-bold text-[9px]">
                                   {m}
                                 </span>
                               ))}
                             </div>
                           </td>
                           <td className="px-4 py-3 text-right font-mono font-bold text-rose-700 dark:text-rose-400 text-xs">
                             ${ar.owed.toFixed(2)}
                           </td>
                           <td className="px-4 py-3 text-right">
                             <div className="flex items-center justify-end gap-1.5">
                               {ar.student.emergencyContactPhone && (
                                 <a 
                                   href={`tel:${ar.student.emergencyContactPhone}`}
                                   title={`Call Guardian: ${ar.student.emergencyContactPhone}`}
                                   className="p-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] border border-neutral-200 dark:border-[#333] text-neutral-600 dark:text-neutral-300 transition-colors"
                                 >
                                   <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                 </a>
                               )}
                               <button 
                                 onClick={() => { setStudentDetailsId(ar.student.id); setPaymentAmounts({}); }}
                                 className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer active:scale-95 touch-manipulation"
                               >
                                 Pay Dues
                               </button>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>

            {/* Right: Branch & Subsidy Financial Breakdown */}
            <div className="space-y-4">
              {/* Branch Facility Performance */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2 flex items-center gap-2">
                   <UsersThree className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                   Revenue by Facility
                 </h3>
                 <div className="space-y-3">
                   {branchFinancials.map(({ branch, expected, collected, outstanding, rate }) => {
                     return (
                       <div key={branch.id} className="p-2.5 rounded-[6px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs">
                          <div className="flex justify-between items-center mb-1">
                             <span className="font-bold text-neutral-900 dark:text-neutral-100">{branch.name}</span>
                             <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">${collected.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mb-2">
                             <span>Due: ${expected.toFixed(0)}</span>
                             <span>Pending: ${outstanding.toFixed(0)} ({rate}%)</span>
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${rate}%` }} />
                            <div className="h-full bg-rose-500 rounded-r-full" style={{ width: `${100 - rate}%` }} />
                          </div>
                       </div>
                     );
                   })}
                 </div>
              </div>

              {/* Scholarship Waivers Impact analysis */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2 flex items-center gap-2">
                   <ChartLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/>
                   Scholarship Subsidies & Valuation
                 </h3>
                 <div className="space-y-3">
                    {scholarshipFinancialImpacts.map(item => (
                      <div key={item.scholarship.id} className="p-2.5 rounded-[6px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs">
                         <div className="flex justify-between items-center mb-1">
                            <div>
                               <span className="font-bold text-neutral-900 dark:text-neutral-100">{item.scholarship.typeName}</span>
                               <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-1.5">({item.discountPct}% Discount)</span>
                            </div>
                            <span className="font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-200/60 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#333] px-2 py-0.5 rounded text-[10px] font-bold">
                              {item.studentCount} Students
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-mono text-neutral-600 dark:text-neutral-400 mt-1.5 pt-1.5 border-t border-neutral-200 dark:border-[#262626]">
                           <span>Waived Volume:</span>
                           <span className="font-bold text-indigo-600 dark:text-indigo-400">
                             ${item.monthlyTotalWaived.toFixed(2)}/mo (${item.annualProjectedWaived.toFixed(0)}/yr)
                           </span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {/* Quick Analytics Summary Box (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-widest mb-1 truncate">Realized Income</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.totalCollected.toFixed(2)}</h2>
              </div>
              <p className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Confirmed collections
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-widest mb-1 truncate">Transactions</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{transactionStats.count}</h2>
              </div>
              <p className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                {transactionStats.paidCount} settlements
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-widest mb-1 truncate">Avg Ticket</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.avgVal.toFixed(2)}</h2>
              </div>
              <p className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Avg per receipt
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-widest mb-1 truncate">Peak Payment</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.maxVal.toFixed(2)}</h2>
              </div>
              <p className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Highest payment
              </p>
            </div>
          </div>

          {/* Filtering & Export Controls */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 items-center">
              <div className="relative col-span-2">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500"/>
                <input 
                  type="text" 
                  placeholder="Search name, ID, or Ref ID..." 
                  value={searchTransactions} 
                  onChange={(e) => {
                    setSearchTransactions(e.target.value);
                    setTxnPage(1);
                  }}
                  className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {searchTransactions && (
                  <button onClick={() => setSearchTransactions('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select 
                value={filterTransactionBranch} 
                onChange={(e) => {
                  setFilterTransactionBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Branches</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select 
                value={filterTransactionYear} 
                onChange={(e) => {
                  setFilterTransactionYear(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Years</option>
                <option value={currentActualYear}>{currentActualYear}</option>
                <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
              </select>

              <select 
                value={filterTransactionMonth} 
                onChange={(e) => {
                  setFilterTransactionMonth(e.target.value);
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Months</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <div className="col-span-2 sm:col-span-1 flex gap-2">
                <button 
                  onClick={() => {
                    setSearchTransactions('');
                    setFilterTransactionBranch('all');
                    setFilterTransactionYear('all');
                    setFilterTransactionMonth('all');
                    setFilterTransactionStatus('all');
                    setTxnSortField(null);
                    setTxnSortDirection('asc');
                    setTxnPage(1);
                  }}
                  className="px-3 h-10 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#CCC] hover:text-neutral-900 dark:hover:text-white rounded-[6px] text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation"
                >
                  Reset
                </button>

                <button 
                  onClick={exportTransactionsToCsv}
                  className="flex-1 px-3 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition-all uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 touch-manipulation"
                  title="Export filtered transactions to CSV"
                >
                  <DownloadSimple className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Transactions List: Mobile Cards (md:hidden) */}
          <div className="md:hidden space-y-2.5">
            {paginatedTransactions.length === 0 ? (
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-8 text-center text-neutral-500 dark:text-neutral-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-400" />
                <p className="font-bold uppercase tracking-widest text-neutral-800 dark:text-[#E4E4E4] text-xs mb-1">No transaction records</p>
                <p className="font-mono text-[10px]">No payments match the active filter</p>
              </div>
            ) : (
              paginatedTransactions.map(p => {
                const student = state.students.find(s => s.id === p.studentId);
                if (!student) return null;
                const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
                const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                const refId = `TXN-PAY-${p.id}`;

                return (
                  <div key={p.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-2.5">
                    {/* Top row: Avatar, Name, Amount */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeImage 
                          src={student.profilePicturePath} 
                          alt={student.englishName} 
                          containerClassName="w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span className="truncate">{student.englishName}</span>
                            {student.khmerName && (
                              <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                {student.khmerName}
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                            ID: {student.id} • {branchName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-base block">
                          +${(p.amountUsd || 0).toFixed(2)}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400">
                          {p.month} {p.year}
                        </span>
                      </div>
                    </div>

                    {/* Middle row: Ref ID & Status */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-[#202020] text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                        <span>{refId}</span>
                        <button
                          onClick={() => handleCopyTxnId(refId)}
                          title="Copy Transaction ID"
                          className="p-1 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedTxnId === refId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white" />
                          )}
                        </button>
                      </div>

                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono font-bold text-[9px] uppercase tracking-wider",
                        p.status === 'Paid' 
                          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                      )}>
                        {p.status === 'Paid' ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                        {p.status}
                      </span>
                    </div>

                    {/* Action: Receipt */}
                    <button 
                      onClick={() => setShowReceipt({
                        student,
                        month: p.month,
                        year: p.year,
                        amount: p.amountUsd || 0
                      })}
                      className="w-full py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#333] text-neutral-800 dark:text-[#E4E4E4] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                    >
                      <Receipt className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400"/> 
                      <span>View E-Receipt</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Transactions Ledger: Tablet & Desktop Dense Table (hidden md:block) */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse min-w-[750px]">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626] text-[10px]">
                  <tr>
                    <th 
                      className="px-5 py-3.5 min-w-[220px] cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('student')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Student / ID</span>
                        {txnSortField === 'student' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-[#EF2F38]" /> : <CaretDown className="w-3.5 h-3.5 text-[#EF2F38]" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('branch')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Branch Facility</span>
                        {txnSortField === 'branch' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-[#EF2F38]" /> : <CaretDown className="w-3.5 h-3.5 text-[#EF2F38]" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('cycle')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Billing Cycle</span>
                        {txnSortField === 'cycle' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-[#EF2F38]" /> : <CaretDown className="w-3.5 h-3.5 text-[#EF2F38]" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('refId')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Reference ID</span>
                        {txnSortField === 'refId' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-[#EF2F38]" /> : <CaretDown className="w-3.5 h-3.5 text-[#EF2F38]" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th 
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none text-right"
                      onClick={() => handleTxnSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Amount</span>
                        {txnSortField === 'amount' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-[#EF2F38]" /> : <CaretDown className="w-3.5 h-3.5 text-[#EF2F38]" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-neutral-500 dark:text-neutral-400">
                         <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-400" />
                         <p className="font-bold uppercase tracking-widest text-neutral-800 dark:text-[#E4E4E4] text-xs mb-1">No transaction records found</p>
                         <p className="font-mono text-[10px]">No payments match the active filter criteria</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map(p => {
                      const student = state.students.find(s => s.id === p.studentId);
                      if (!student) return null;
                      const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
                      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                      const refId = `TXN-PAY-${p.id}`;

                      return (
                        <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4] group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <SafeImage 
                                src={student.profilePicturePath} 
                                alt={student.englishName} 
                                containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                                fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                              />
                              <div>
                                <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors">
                                  {student.englishName}
                                  {student.khmerName && (
                                    <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal">
                                      {student.khmerName}
                                    </span>
                                  )}
                                  {scholarship && scholarship.discountPercentage > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold uppercase text-[7px] border border-indigo-500/20">
                                      {scholarship.typeName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                                  ID: {student.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-neutral-600 dark:text-neutral-300">
                            {branchName}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] px-2.5 py-1 rounded-[6px] font-mono">
                              {p.month} {p.year}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[10px]">
                            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                              <span>{refId}</span>
                              <button
                                onClick={() => handleCopyTxnId(refId)}
                                title="Copy Transaction ID"
                                className="p-0.5 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedTxnId === refId ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-white" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono font-bold text-[9px] uppercase tracking-wider",
                              p.status === 'Paid' 
                                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            )}>
                              {p.status === 'Paid' ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                            ${(p.amountUsd || 0).toFixed(2)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button 
                              onClick={() => setShowReceipt({
                                student,
                                month: p.month,
                                year: p.year,
                                amount: p.amountUsd || 0
                              })}
                              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#333] hover:border-neutral-300 dark:hover:border-[#444] text-neutral-800 dark:text-[#E4E4E4] hover:text-neutral-900 dark:hover:text-white rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                            >
                              <Receipt className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400"/> 
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls (Responsive) */}
          {filteredTransactionsList.length > 0 && (
            <div className="p-3 border border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                <span>
                  Showing {Math.min((txnPage - 1) * txnPerPage + 1, filteredTransactionsList.length)}–{Math.min(txnPage * txnPerPage, filteredTransactionsList.length)} of {filteredTransactionsList.length} transactions
                </span>
                <span className="opacity-40">•</span>
                <span>Per page:</span>
                <select
                  value={txnPerPage}
                  onChange={(e) => {
                    setTxnPerPage(Number(e.target.value));
                    setTxnPage(1);
                  }}
                  className="bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded px-1.5 py-0.5 text-neutral-900 dark:text-white font-mono cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                  disabled={txnPage <= 1}
                  className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px]"
                >
                  <CaretLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-2 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                  Page <strong className="text-neutral-900 dark:text-white">{txnPage}</strong> of {totalTxnPages}
                </span>

                <button
                  onClick={() => setTxnPage(p => Math.min(totalTxnPages, p + 1))}
                  disabled={txnPage >= totalTxnPages}
                  className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px]"
                >
                  <span>Next</span>
                  <CaretRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Top Bar Header & Controls */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3 transition-colors">
            {/* Left Cluster: Month Navigator + Jump Today + View Switcher */}
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3">
              {/* Previous / Next Month Navigator */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button 
                  onClick={() => {
                    const monthIdx = monthsListGlobal.indexOf(calendarMonth);
                    if (monthIdx === 0) {
                      setCalendarMonth(monthsListGlobal[11]);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(monthsListGlobal[monthIdx - 1]);
                    }
                  }}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:hover:bg-[#1F1F1F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  title="Previous Month"
                  aria-label="Previous Month"
                >
                  <CaretLeft className="w-4 h-4" />
                </button>

                <div className="text-center min-w-[120px] sm:min-w-[130px]">
                  <div className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5 sm:gap-2">
                    <span>{calendarMonth}</span>
                    <span className="text-[#EF2F38] font-mono font-black">{calendarYear}</span>
                  </div>
                  <span className="text-[9px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-widest block font-semibold">
                    Renewal Schedule
                  </span>
                </div>

                <button 
                  onClick={() => {
                    const monthIdx = monthsListGlobal.indexOf(calendarMonth);
                    if (monthIdx === 11) {
                      setCalendarMonth(monthsListGlobal[0]);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(monthsListGlobal[monthIdx + 1]);
                    }
                  }}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:hover:bg-[#1F1F1F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  title="Next Month"
                  aria-label="Next Month"
                >
                  <CaretRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setCalendarYear(currentActualYear);
                    setCalendarMonth(months[currentActualMonthIndex]);
                  }}
                  className="px-3 h-9 bg-[#EF2F38] hover:bg-[#D0252D] text-white rounded-[8px] text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-[#EF2F38]/20 flex items-center gap-1.5 active:scale-95 touch-manipulation shrink-0"
                  title="Jump to Current Month"
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> TODAY
                </button>

                {/* View Mode Toggle: Grid vs Agenda List */}
                <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-0.5 shrink-0 h-9 items-center">
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('grid')}
                    title="Month Grid View"
                    className={cn(
                      "px-2.5 h-7.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                      calendarViewMode === 'grid'
                        ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-xs font-black"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                    )}
                  >
                    <SquaresFour className="w-3.5 h-3.5" weight="bold" />
                    <span className="hidden xs:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('agenda')}
                    title="Agenda Cohort Stream"
                    className={cn(
                      "px-2.5 h-7.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                      calendarViewMode === 'agenda'
                        ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-xs font-black"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                    )}
                  >
                    <ListDashes className="w-3.5 h-3.5" weight="bold" />
                    <span className="hidden xs:inline">Agenda</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Cluster: Quick Filters (Search + Branch + Status Segment Rail) */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[200px]">
                {/* Search */}
                <div className="relative flex-1 sm:w-40 md:w-44">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                  <input 
                    type="text" 
                    placeholder="Filter student..." 
                    value={calendarSearch} 
                    onChange={(e) => setCalendarSearch(e.target.value)}
                    className="w-full pl-8 pr-7 h-9 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-[11px] sm:text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-mono"
                  />
                  {calendarSearch && (
                    <button 
                      onClick={() => setCalendarSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Branch Filter */}
                <select 
                  value={calendarFilterBranch} 
                  onChange={(e) => setCalendarFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[11px] sm:text-xs h-9 px-2.5 focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer shrink-0 max-w-[125px] sm:max-w-none"
                >
                  <option value="all">All Branches</option>
                  {state.branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Segment Rail - Clean, perfectly sized, no overflow, with counts & semantic colors */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 h-9 overflow-x-auto no-scrollbar touch-pan-x max-w-full">
                {([
                  { key: 'all', label: 'All', count: calendarData.stats.total, dot: 'bg-neutral-400' },
                  { key: 'overdue', label: 'Overdue', count: calendarData.stats.overdue, dot: 'bg-red-500' },
                  { key: 'pending', label: 'Pending', count: calendarData.stats.pending, dot: 'bg-amber-500' },
                  { key: 'paid', label: 'Paid', count: calendarData.stats.paid, dot: 'bg-emerald-500' },
                  { key: 'waived', label: 'Waived', count: calendarData.stats.waived, dot: 'bg-purple-500' },
                ] as const).map(st => {
                  const isActive = calendarFilterStatus === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setCalendarFilterStatus(st.key)}
                      className={cn(
                        "h-7.5 px-2.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation whitespace-nowrap",
                        isActive
                          ? st.key === 'overdue'
                            ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 shadow-xs font-black"
                            : st.key === 'pending'
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs font-black"
                            : st.key === 'paid'
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs font-black"
                            : st.key === 'waived'
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-xs font-black"
                            : "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-xs font-black"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white border border-transparent"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
                      <span>{st.label}</span>
                      <span className={cn(
                        "px-1 py-0.2 rounded-full text-[9px] font-mono font-bold transition-colors",
                        isActive
                          ? st.key === 'overdue'
                            ? "bg-red-500/20 text-red-700 dark:text-red-300"
                            : st.key === 'pending'
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : st.key === 'paid'
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : st.key === 'waived'
                            ? "bg-purple-500/20 text-purple-700 dark:text-purple-300"
                            : "bg-neutral-200 dark:bg-[#333] text-neutral-800 dark:text-neutral-200"
                          : "bg-neutral-200/60 dark:bg-[#1E1E1E] text-neutral-500 dark:text-[#777]"
                      )}>
                        {st.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metrics Counter Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 shadow-xs">
              <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 dark:text-[#888] block font-bold truncate">Total Renewals</span>
              <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
                <span>{calendarData.stats.total}</span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-[#666]">Students</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-green-500/30 dark:border-green-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-green-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-green-600 dark:text-green-400 block font-bold truncate">Collected Income</span>
              <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mt-0.5 font-mono truncate">
                ${calendarData.stats.collected.toFixed(2)}
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-red-500/30 dark:border-red-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-red-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-red-600 dark:text-red-400 block font-bold truncate">Outstanding Dues</span>
              <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400 mt-0.5 font-mono truncate">
                ${calendarData.stats.outstanding.toFixed(2)}
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-purple-500/30 dark:border-purple-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-purple-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-purple-600 dark:text-purple-400 block font-bold truncate">Scholarship Waived</span>
              <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex items-baseline gap-1.5 font-mono">
                <span>{calendarData.stats.waived}</span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-[#666]">100% Free</span>
              </div>
            </div>
          </div>

          {/* VIEW SWITCHER CONTENT: Month Grid vs Agenda Stream */}
          {calendarViewMode === 'grid' ? (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm p-2 sm:p-3 md:p-4 transition-colors">
              {/* Weekday Headers (Monday Start) */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px] font-bold font-mono text-neutral-500 dark:text-[#888] uppercase tracking-wider pb-2 sm:pb-3 border-b border-neutral-200 dark:border-[#262626]">
                <div><span className="hidden xs:inline">MON</span><span className="xs:hidden">M</span></div>
                <div><span className="hidden xs:inline">TUE</span><span className="xs:hidden">T</span></div>
                <div><span className="hidden xs:inline">WED</span><span className="xs:hidden">W</span></div>
                <div><span className="hidden xs:inline">THU</span><span className="xs:hidden">T</span></div>
                <div><span className="hidden xs:inline">FRI</span><span className="xs:hidden">F</span></div>
                <div><span className="hidden xs:inline">SAT</span><span className="xs:hidden">S</span></div>
                <div><span className="hidden xs:inline">SUN</span><span className="xs:hidden">S</span></div>
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2 sm:pt-3">
                {/* Empty leading offset cells */}
                {Array.from({ length: calendarData.firstDayOffset }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="min-h-[56px] sm:min-h-[90px] md:min-h-[110px] bg-neutral-50 dark:bg-[#0A0A0A]/40 border border-neutral-200/60 dark:border-[#1A1A1A] rounded-[6px] sm:rounded-[8px] opacity-25" />
                ))}

                {/* Calendar Days */}
                {Array.from({ length: calendarData.daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dueStudents = calendarData.dayMap[dayNum] || [];
                  const isToday = calendarYear === currentActualYear && monthsListGlobal.indexOf(calendarMonth) === currentActualMonthIndex && dayNum === new Date().getDate();
                  const isSelected = selectedCalendarDay?.day === dayNum && selectedCalendarDay?.year === calendarYear && selectedCalendarDay?.month === calendarMonth;

                  const paidCount = dueStudents.filter(s => s.billingStatus === 'Paid').length;
                  const overdueCount = dueStudents.filter(s => s.billingStatus === 'Overdue').length;
                  const pendingCount = dueStudents.filter(s => s.billingStatus === 'Due Soon').length;
                  const waivedCount = dueStudents.filter(s => s.billingStatus === 'Waived').length;

                  const dayExpectedSum = dueStudents.reduce((acc, curr) => acc + curr.amountOwed, 0);

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => {
                        if (dueStudents.length > 0) {
                          setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum });
                        }
                      }}
                      className={cn(
                        "min-h-[56px] sm:min-h-[90px] md:min-h-[110px] p-1 sm:p-2 rounded-[6px] sm:rounded-[8px] border transition-all flex flex-col justify-between group active:scale-95 touch-manipulation",
                        dueStudents.length > 0 
                          ? "cursor-pointer hover:border-[#EF2F38]/60 dark:hover:border-[#555] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A]" 
                          : "opacity-60 bg-neutral-50/60 dark:bg-[#0F0F0F]/60 border-neutral-200/60 dark:border-[#1F1F1F]",
                        isToday && "border-[#EF2F38] bg-red-500/5 dark:bg-[#EF2F38]/10 ring-1 ring-[#EF2F38]/30",
                        isSelected && "ring-2 ring-[#EF2F38] border-[#EF2F38]"
                      )}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold font-mono flex items-center justify-center transition-colors",
                          isToday 
                            ? "bg-[#EF2F38] text-white font-black shadow-xs shadow-[#EF2F38]/30" 
                            : "text-neutral-800 dark:text-[#AAA] group-hover:text-neutral-900 dark:group-hover:text-white"
                        )}>
                          {dayNum}
                        </span>

                        {dueStudents.length > 0 && (
                          <span className="text-[8px] sm:text-[9px] font-bold font-mono px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-[4px] sm:rounded-[6px] bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-700 dark:text-[#CCC] border border-neutral-200 dark:border-[#262626]">
                            <span className="hidden sm:inline">{dueStudents.length} {dueStudents.length === 1 ? 'due' : 'dues'}</span>
                            <span className="sm:hidden">{dueStudents.length}</span>
                          </span>
                        )}
                      </div>

                      {/* Middle Section: Mobile Micro Dots vs Tablet/Desktop Badges */}
                      {dueStudents.length > 0 ? (
                        <>
                          {/* Mobile Micro Indicator Dots (< 640px) */}
                          <div className="flex sm:hidden items-center justify-center gap-1 my-auto">
                            {overdueCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title={`${overdueCount} Overdue`} />
                            )}
                            {pendingCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${pendingCount} Due Soon`} />
                            )}
                            {paidCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${paidCount} Paid`} />
                            )}
                            {waivedCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title={`${waivedCount} Waived`} />
                            )}
                          </div>

                          {/* Tablet / Desktop Avatars & Status Pills (>= 640px) */}
                          <div className="hidden sm:block my-1 space-y-1">
                            {/* Avatar stack */}
                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                              {dueStudents.slice(0, 3).map((st) => (
                                <SafeImage 
                                  key={st.student.id} 
                                  src={st.student.profilePicturePath} 
                                  alt={st.student.englishName} 
                                  className="w-5 h-5 rounded-full object-cover border border-white dark:border-[#141414] shrink-0" 
                                />
                              ))}
                              {dueStudents.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-[#262626] text-[8px] font-mono font-bold text-neutral-800 dark:text-white flex items-center justify-center border border-white dark:border-[#141414] shrink-0">
                                  +{dueStudents.length - 3}
                                </div>
                              )}
                            </div>

                            {/* Status Pills */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {overdueCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-red-500/10 text-red-600 dark:text-red-400 text-[8px] font-mono font-bold border border-red-500/20">
                                  <span className="w-1 h-1 rounded-full bg-red-500"></span> {overdueCount}
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-mono font-bold border border-amber-500/20">
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span> {pendingCount}
                                </span>
                              )}
                              {paidCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-green-500/10 text-green-600 dark:text-green-400 text-[8px] font-mono font-bold border border-green-500/20">
                                  <span className="w-1 h-1 rounded-full bg-green-500"></span> {paidCount}
                                </span>
                              )}
                              {waivedCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[8px] font-mono font-bold border border-purple-500/20">
                                  <span className="w-1 h-1 rounded-full bg-purple-500"></span> {waivedCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="my-auto text-center hidden sm:block">
                          <span className="text-[9px] text-neutral-400 dark:text-[#444] font-mono block select-none">No Dues</span>
                        </div>
                      )}

                      {/* Footer Amount */}
                      {dueStudents.length > 0 && (
                        <div className="text-[8px] sm:text-[9px] font-mono text-center sm:text-right text-neutral-600 dark:text-[#888] pt-0.5 sm:pt-1 border-t border-neutral-200/80 dark:border-[#1F1F1F] truncate">
                          {dayExpectedSum > 0 ? (
                            <span className="text-neutral-900 dark:text-white font-bold">${dayExpectedSum >= 1000 ? `${(dayExpectedSum/1000).toFixed(1)}k` : dayExpectedSum.toFixed(0)}</span>
                          ) : (
                            <span className="text-purple-600 dark:text-purple-400 font-bold">Waived</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* AGENDA / COHORT STREAM VIEW (NATIVE FOR MOBILE & TABLET) */
            <div className="space-y-3">
              {(() => {
                const activeDays = Object.keys(calendarData.dayMap)
                  .map(Number)
                  .filter(day => calendarData.dayMap[day]?.length > 0)
                  .sort((a, b) => a - b);

                if (activeDays.length === 0) {
                  return (
                    <div className="py-16 px-4 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414]">
                      <CalendarCheck className="w-10 h-10 text-neutral-400 dark:text-[#666] mx-auto mb-2" />
                      <p className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">No Renewals Found</p>
                      <p className="text-xs text-neutral-500 dark:text-[#666] font-mono">No students scheduled for renewal matching your filters in {calendarMonth} {calendarYear}.</p>
                    </div>
                  );
                }

                return activeDays.map(dayNum => {
                  const cohort = calendarData.dayMap[dayNum] || [];
                  const isToday = calendarYear === currentActualYear && monthsListGlobal.indexOf(calendarMonth) === currentActualMonthIndex && dayNum === new Date().getDate();

                  const paidCount = cohort.filter(s => s.billingStatus === 'Paid').length;
                  const overdueCount = cohort.filter(s => s.billingStatus === 'Overdue').length;
                  const pendingCount = cohort.filter(s => s.billingStatus === 'Due Soon').length;
                  const waivedCount = cohort.filter(s => s.billingStatus === 'Waived').length;
                  const totalAmount = cohort.reduce((acc, curr) => acc + curr.amountOwed, 0);

                  return (
                    <div 
                      key={`agenda-day-${dayNum}`}
                      className={cn(
                        "bg-white dark:bg-[#141414] border rounded-[8px] p-3.5 sm:p-4 shadow-sm transition-all",
                        isToday 
                          ? "border-[#EF2F38] bg-red-500/5 dark:bg-[#EF2F38]/5 ring-1 ring-[#EF2F38]/30" 
                          : "border-neutral-200 dark:border-[#262626]"
                      )}
                    >
                      {/* Agenda Day Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-[8px] flex flex-col items-center justify-center shrink-0 font-mono shadow-xs",
                            isToday 
                              ? "bg-[#EF2F38] text-white" 
                              : "bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-900 dark:text-white border border-neutral-200 dark:border-[#2A2A2A]"
                          )}>
                            <span className="text-xs font-black leading-none">{dayNum}</span>
                            <span className="text-[8px] uppercase tracking-wider font-bold opacity-80">{calendarMonth.slice(0, 3)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                                Day {dayNum} Cohort • {cohort.length} {cohort.length === 1 ? 'Student' : 'Students'}
                              </h3>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-[#EF2F38] text-white">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-neutral-500 dark:text-[#888]">
                              <span>Expected: <b className="text-neutral-900 dark:text-white">${totalAmount.toFixed(2)}</b></span>
                            </div>
                          </div>
                        </div>

                        {/* Status Tags & Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {overdueCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-mono font-bold border border-red-500/20">
                                {overdueCount} Overdue
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold border border-amber-500/20">
                                {pendingCount} Pending
                              </span>
                            )}
                            {paidCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
                                {paidCount} Paid
                              </span>
                            )}
                            {waivedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold border border-purple-500/20">
                                {waivedCount} Waived
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum })}
                            className="px-3 py-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation shrink-0"
                          >
                            <span>Cohort</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Students List in Cohort */}
                      <div className="divide-y divide-neutral-200 dark:divide-[#202020] pt-1">
                        {cohort.slice(0, 4).map(item => {
                          const { student, billingStatus, amountOwed, branchName, scholarshipName } = item;
                          return (
                            <div key={student.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <SafeImage
                                  src={student.profilePicturePath}
                                  alt={student.englishName}
                                  className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-[#262626] shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-neutral-900 dark:text-white truncate">{student.englishName}</span>
                                    <span className="text-[10px] font-mono text-neutral-400">({student.id})</span>
                                  </div>
                                  <p className="text-[10px] font-mono text-neutral-500 dark:text-[#777] truncate">
                                    {branchName} • {scholarshipName}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono font-bold text-neutral-900 dark:text-white block">
                                    ${amountOwed.toFixed(2)}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-mono font-bold uppercase",
                                    billingStatus === 'Paid' ? "text-emerald-600 dark:text-emerald-400" :
                                    billingStatus === 'Overdue' ? "text-red-600 dark:text-red-400" :
                                    billingStatus === 'Due Soon' ? "text-amber-600 dark:text-amber-400" :
                                    "text-purple-600 dark:text-purple-400"
                                  )}>
                                    {billingStatus}
                                  </span>
                                </div>

                                {billingStatus !== 'Paid' && billingStatus !== 'Waived' ? (
                                  !isReadOnlyLedger ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await payInvoice(student.id, calendarYear, calendarMonth, amountOwed);
                                          showNotification(`Recorded $${amountOwed.toFixed(2)} payment for ${student.englishName}!`, 'success');
                                        } catch (e: any) {
                                          console.error(e);
                                          showNotification("Failed to record payment.", 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-[10px] rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                    >
                                      Pay
                                    </button>
                                  ) : null
                                ) : billingStatus === 'Paid' ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowReceipt({
                                      student,
                                      month: calendarMonth,
                                      year: calendarYear,
                                      amount: amountOwed
                                    })}
                                    className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] text-neutral-700 dark:text-[#AAA] font-mono text-[10px] rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  >
                                    Receipt
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                        {cohort.length > 4 && (
                          <div className="pt-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum })}
                              className="text-[11px] font-mono text-[#EF2F38] hover:underline font-bold cursor-pointer"
                            >
                              + {cohort.length - 4} more students in Day {dayNum} cohort →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Renewal Day Roster Drawer Modal */}
      <AnimatePresence>
        {selectedCalendarDay && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl transition-colors"
              >
                {/* Modal Header */}
                <div className="p-4 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] font-mono font-bold text-sm">
                      {selectedCalendarDay.day}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span>Renewal Cohort - {selectedCalendarDay.month} {selectedCalendarDay.day}, {selectedCalendarDay.year}</span>
                      </h2>
                      <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono tracking-widest mt-0.5 font-semibold">
                        {calendarData.dayMap[selectedCalendarDay.day]?.length || 0} Students Scheduled For Billing Renewal
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedCalendarDay(null)}
                    className="p-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-700 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white rounded-[8px] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar inside Drawer */}
                <div className="p-3 bg-white dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                  <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                    <input 
                      type="text" 
                      placeholder="Search student in this cohort..." 
                      value={selectedDaySearch} 
                      onChange={(e) => setSelectedDaySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-mono"
                    />
                  </div>
                </div>

                {/* Cohort Student List */}
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
                  {(() => {
                    const cohort = (calendarData.dayMap[selectedCalendarDay.day] || []).filter(item => {
                      if (!selectedDaySearch.trim()) return true;
                      const q = selectedDaySearch.toLowerCase();
                      return item.student.englishName.toLowerCase().includes(q) || item.student.id.toLowerCase().includes(q);
                    });

                    if (cohort.length === 0) {
                      return (
                        <div className="py-12 text-center text-neutral-500 dark:text-[#666]">
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white mb-1">No matching students found</p>
                          <p className="text-[10px] font-mono">Try adjusting your search criteria</p>
                        </div>
                      );
                    }

                    return cohort.map(item => {
                      const { student, billingStatus, amountOwed, baseFee, discountPct, branchName, scholarshipName } = item;

                      return (
                        <div key={student.id} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-[#333] rounded-[8px] p-3 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left Student Info */}
                          <div className="flex items-center gap-3">
                            <SafeImage 
                              src={student.profilePicturePath} 
                              alt={student.englishName} 
                              className="w-10 h-10 rounded-full object-cover border border-neutral-300 dark:border-[#262626] shrink-0" 
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-neutral-900 dark:text-white tracking-tight">{student.englishName}</span>
                                {billingStatus === 'Paid' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold uppercase text-[8px] border border-green-500/30 flex items-center gap-1">
                                    <CheckCircle className="w-2.5 h-2.5" /> Paid
                                  </span>
                                )}
                                {billingStatus === 'Overdue' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 font-bold uppercase text-[8px] border border-red-500/30 flex items-center gap-1">
                                    <Warning className="w-2.5 h-2.5" /> Overdue
                                  </span>
                                )}
                                {billingStatus === 'Due Soon' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase text-[8px] border border-amber-500/30 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> Due Soon
                                  </span>
                                )}
                                {billingStatus === 'Waived' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold uppercase text-[8px] border border-purple-500/30">
                                    Waived (100%)
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>ID: {student.id}</span>
                                <span>•</span>
                                <span>{branchName}</span>
                                <span>•</span>
                                <span>{scholarshipName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Action & Amount */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t border-neutral-200/60 dark:border-[#1E1E1E] sm:border-t-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[9px] text-neutral-500 dark:text-[#666] font-mono uppercase block font-semibold">Monthly Fee</span>
                              <div className="text-xs font-bold font-mono text-neutral-900 dark:text-white">
                                {discountPct === 100 ? (
                                  <span className="text-purple-600 dark:text-purple-400">$0.00</span>
                                ) : (
                                  <span>${amountOwed.toFixed(2)}</span>
                                )}
                                {discountPct > 0 && discountPct < 100 && (
                                  <span className="text-[9px] text-green-600 dark:text-green-400 font-mono ml-1 font-bold">({discountPct}% Off)</span>
                                )}
                              </div>
                            </div>

                            {billingStatus !== 'Paid' && billingStatus !== 'Waived' ? (
                              !isReadOnlyLedger ? (
                                <button 
                                  onClick={async () => {
                                    try {
                                      await payInvoice(student.id, selectedCalendarDay.year, selectedCalendarDay.month, amountOwed);
                                      showNotification(`Recorded $${amountOwed.toFixed(2)} payment for ${student.englishName}!`, 'success');
                                    } catch (e: any) {
                                      console.error(e);
                                      showNotification("Failed to record payment.", 'error');
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1 shadow-md cursor-pointer"
                                >
                                  Record Payment
                                </button>
                              ) : (
                                <span className="text-[10px] font-mono text-neutral-400 dark:text-[#666] italic">View Only</span>
                              )
                            ) : billingStatus === 'Paid' ? (
                              <button 
                                onClick={() => setShowReceipt({
                                  student,
                                  month: selectedCalendarDay.month,
                                  year: selectedCalendarDay.year,
                                  amount: amountOwed
                                })}
                                className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] border border-neutral-300 dark:border-[#333] text-neutral-900 dark:text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#EF2F38]" /> E-Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#666] italic">No payment needed</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Modal Footer */}
                <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                  <span>Anniversary Due Date: Day {selectedCalendarDay.day}</span>
                  <button 
                    onClick={() => setSelectedCalendarDay(null)}
                    className="px-3 py-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-[#CCC] hover:text-neutral-900 dark:hover:text-white rounded-[8px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Close Drawer
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Student Details Invoicing Modal */}
      <AnimatePresence>
        {studentDetailsId && activeStudentProfile && (
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh]">
                  <div className="p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center z-10 sticky top-0 shrink-0">
                    <div className="flex items-center gap-3">
                      <SafeImage 
                        src={activeStudentProfile.profilePicturePath} 
                        alt={activeStudentProfile.englishName} 
                        containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                        fallback={<span className="font-bold text-[#666] text-xs">{activeStudentProfile.englishName.charAt(0)}</span>}
                      />
                      <div>
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2 leading-tight">
                          {activeStudentProfile.englishName}
                          <span className="text-xs font-mono text-[#666] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-700 dark:text-[#888] px-2 py-0.5 rounded-[8px]">{activeStudentProfile.id}</span>
                        </h2>
                        <p className="text-[10px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mt-1">Financial Dossier • FY {filterYear}</p>
                      </div>
                    </div>
                    <button onClick={() => setStudentDetailsId(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto space-y-6 bg-white dark:bg-[#0A0A0A] custom-scrollbar">
                     {/* Student Insight Cards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Scholarship / Plan</p>
                              <p className="text-sm text-neutral-900 dark:text-[#E4E4E4] font-bold">{activeStudentScholarship?.typeName || 'Standard'}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Discount Rate</p>
                              <p className="text-sm font-mono text-indigo-400">{activeDiscountPct}%</p>
                           </div>
                        </div>
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between">
                            <div>
                               <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Net Monthly Fee</p>
                               <p className="text-xl font-mono text-neutral-900 dark:text-white">${netMonthlyFee.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Base Price</p>
                               <p className="text-xs font-mono text-[#666] line-through">${studentBasePrice.toFixed(2)}</p>
                            </div>
                         </div>
                         <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between col-span-1 md:col-span-2">
                             <div>
                                <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Monthly Billing Anniversary</p>
                                <p className="text-xs text-neutral-800 dark:text-white">
                                  Due Day: <span className="font-bold text-red-500 font-mono">{activeBillingAnchorDay}th</span> of the month (enrollment date minus 1)
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="text-[10px] text-[#666] uppercase font-bold tracking-widest mb-1">Enrollment Base Date</p>
                                <p className="text-xs font-mono text-[#CCC]">{activeStudentEnrollDate || 'Not set'}</p>
                             </div>
                          </div>
                      </div>

                      {/* Rapid Prepayment Console */}
                      {!isReadOnlyLedger && (
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                          <button 
                            onClick={() => setShowPrepayPanel(!showPrepayPanel)}
                            className="w-full px-4 py-3 bg-neutral-100 dark:bg-[#0F0F0F] flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-400 hover:text-white transition-colors cursor-pointer"
                          >
                           <span className="flex items-center gap-2">
                             <Sparkle className="w-4 h-4 text-indigo-400"/>
                             ⭐ Rapid Multi-Month Prepayment Console
                           </span>
                           <span className="text-[10px] text-[#666] font-mono">
                             {showPrepayPanel ? 'Collapse ▲' : 'Expand ▼'}
                           </span>
                         </button>
                         
                         {showPrepayPanel && (
                           <div className="p-4 border-t border-neutral-200 dark:border-[#262626] space-y-4 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div>
                                    <label className="block text-[9px] uppercase font-bold text-[#666] mb-1.5">Prepay Term</label>
                                    <select 
                                      value={prepayMonths} 
                                      onChange={(e) => {
                                        const mCount = Number(e.target.value);
                                        setPrepayMonths(mCount);
                                        setPrepayAmount('');
                                      }}
                                      className="w-full bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 py-2.5 focus:outline-none focus:border-[#444]"
                                    >
                                      <option value={1}>1 Month</option>
                                      <option value={3}>3 Months (Quarterly)</option>
                                      <option value={6}>6 Months (Half-Year)</option>
                                      <option value={12}>12 Months (1 Year Plan)</option>
                                      <option value={24}>24 Months (2 Years Plan)</option>
                                    </select>
                                 </div>
                                 
                                 <div>
                                    <label className="block text-[9px] uppercase font-bold text-[#666] mb-1.5">Start Month / Year</label>
                                    <div className="flex gap-2">
                                       <select 
                                         value={prepayStartMonth} 
                                         onChange={(e) => setPrepayStartMonth(e.target.value)}
                                         className="flex-1 bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-2.5 py-2.5 focus:outline-none focus:border-[#444]"
                                       >
                                         {months.map(m => (
                                           <option key={m} value={m}>{m}</option>
                                         ))}
                                       </select>
                                       <select 
                                         value={prepayStartYear} 
                                         onChange={(e) => setPrepayStartYear(Number(e.target.value))}
                                         className="flex-1 bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-2.5 py-2.5 focus:outline-none focus:border-[#444]"
                                       >
                                         <option value={currentActualYear}>{currentActualYear}</option>
                                         <option value={currentActualYear + 1}>{currentActualYear + 1}</option>
                                       </select>
                                    </div>
                                 </div>
                                 
                                 <div>
                                    <label className="block text-[9px] uppercase font-bold text-[#666] mb-1.5">Total Prepaid Amount</label>
                                    <div className="relative">
                                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#666]">$</span>
                                       <input 
                                         type="number" 
                                         placeholder={(netMonthlyFee * prepayMonths).toFixed(2)}
                                         value={prepayAmount} 
                                         onChange={(e) => setPrepayAmount(e.target.value)}
                                         className="w-full pl-6 pr-3 py-2 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#444] transition-all placeholder:text-[#444] font-mono"
                                       />
                                    </div>
                                 </div>
                              </div>
                              
                              {/* Dynamic Prepayment Schedule Preview */}
                              <div className="border-t border-[#262626] pt-4 mt-2">
                                <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider mb-2">Prepayment Coverage Timeline</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                  {prepayPreviewList.map((item, idx) => (
                                    <div 
                                      key={idx} 
                                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 flex flex-col justify-between hover:border-[#333] transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[10px] font-bold text-white">{item.month} {item.year}</span>
                                        <span className="text-[8px] bg-indigo-500/20 text-indigo-400 font-mono font-bold px-1.5 py-0.5 rounded-[8px]">#{idx + 1}</span>
                                      </div>
                                      <div className="flex items-end justify-between mt-2.5">
                                        <span className="text-[8px] text-[#666] uppercase tracking-wider font-mono">Billed</span>
                                        <span className="text-[11px] font-bold text-green-400 font-mono">${item.amount.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px] flex items-center justify-between text-xs mt-3">
                                 <div>
                                    <span className="text-[#666] uppercase text-[9px] font-bold block mb-0.5">Prepayment breakdown</span>
                                    <span className="text-white font-mono">
                                      {prepayMonths} Months × ${(parseFloat(prepayAmount) ? (parseFloat(prepayAmount)/prepayMonths) : netMonthlyFee).toFixed(2)}/mo
                                    </span>
                                 </div>
                                 <button 
                                   onClick={handleProcessBulkPrepay}
                                   disabled={isProcessingPrepay}
                                   className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[8px] font-bold uppercase tracking-wider text-[10px] transition-colors shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                 >
                                   {isProcessingPrepay ? (
                                     <>
                                       <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                       Processing...
                                     </>
                                   ) : (
                                     'Process Prepayment'
                                   )}
                                 </button>
                              </div>
                           </div>
                         )}
                      </div>
                      )}

                      {/* Ledger Table */}
                      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-x-auto custom-scrollbar shadow-sm">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[500px]">
                           <thead className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                             <tr>
                                <th className="px-4 py-3">Billing Cycle</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Action</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                             {months.map((m, i) => {
                                const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(activeStudentProfile));
                                if (isBeforeEnroll) {
                                  return (
                                    <tr key={m} className="opacity-45 text-[#666] select-none">
                                      <td className="px-4 py-3">
                                        <div className="font-bold">{m} {filterYear}</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="px-2.5 py-1 bg-neutral-900 border border-[#262626] rounded-[8px] font-bold uppercase text-[9px] tracking-widest text-[#666] font-mono">
                                          Pre-Enrollment
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono">—</td>
                                      <td className="px-4 py-3 flex justify-end">—</td>
                                    </tr>
                                  );
                                }

                                const payment = state.payments.find(p => p.studentId === activeStudentProfile.id && p.year === filterYear && p.month === m);
                                const isPaid = payment?.status === 'Paid' || activeDiscountPct === 100;
                                const isCurrent = filterYear === currentActualYear && i === currentActualMonthIndex;
                                const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && i > currentActualMonthIndex);
                                const requiredAmt = netMonthlyFee;

                                return (
                                  <tr key={m} className={cn("hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]", isCurrent && !isPaid && "bg-yellow-500/5", isFuture && !isPaid && "opacity-70")}>
                                    <td className="px-4 py-3">
                                      <div className="font-bold flex items-center gap-2">
                                        {m} {filterYear}
                                        {isCurrent && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-[8px] uppercase tracking-widest font-bold">Current</span>}
                                        {isFuture && !isPaid && <span className="text-[9px] bg-[#262626] text-[#888] px-1.5 py-0.5 rounded-[8px] uppercase tracking-widest font-bold font-mono">Upcoming</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "px-2 py-1 rounded-[8px] font-bold uppercase text-[9px] tracking-widest border", 
                                        isPaid ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                                        (isCurrent ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                                        (isFuture ? "bg-neutral-900 text-[#888] border-neutral-800" : "bg-red-500/10 text-red-500 border-red-500/20")) 
                                      )}>
                                        {isPaid ? (activeDiscountPct === 100 ? 'Waived (100%)' : 'Paid') : (isFuture ? 'Upcoming' : 'Unpaid')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#999]">
                                      {isPaid ? (
                                        <span className="text-white font-bold">${Number(payment?.amountUsd || requiredAmt).toFixed(2)}</span>
                                      ) : (
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-[#666]">$</span>
                                          <input 
                                            type="number" 
                                            disabled={isReadOnlyLedger}
                                            value={paymentAmounts[m] !== undefined ? paymentAmounts[m] : requiredAmt.toFixed(2)} 
                                            onChange={(e) => setPaymentAmounts(prev => ({ ...prev, [m]: e.target.value }))}
                                            className="w-16 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1 text-xs text-neutral-800 dark:text-white text-right focus:outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 flex justify-end">
                                      {!isPaid && !isReadOnlyLedger && (
                                        <button onClick={() => {
                                             const inputAmt = parseFloat(paymentAmounts[m] !== undefined ? paymentAmounts[m] : String(requiredAmt));
                                             payInvoice(activeStudentProfile.id, filterYear, m, inputAmt || 0);
                                             showNotification(`Paid ${m} ${filterYear}: ${(inputAmt || 0).toFixed(2)}`, 'success');
                                          }}
                                          className="px-3.5 py-1.5 min-h-[32px] bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 rounded-[6px] text-[10px] font-bold uppercase tracking-widest transition-colors shadow-xs cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                                        >
                                          Mark Paid
                                        </button>
                                      )}
                                      {!isPaid && isReadOnlyLedger && (
                                        <span className="text-[9px] font-mono text-neutral-500 uppercase">View Only</span>
                                      )}
                                      {isPaid && (
                                        <button 
                                          onClick={() => setShowReceipt({
                                            student: activeStudentProfile,
                                            month: m,
                                            year: filterYear,
                                            amount: payment?.amountUsd !== undefined ? payment.amountUsd : requiredAmt
                                          })}
                                          className="px-3.5 py-1.5 min-h-[32px] bg-[#1A1A1A] hover:bg-[#262626] border border-[#333] hover:border-[#444] text-[#E4E4E4] hover:text-white rounded-[6px] text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                                        >
                                          <FileText className="w-3.5 h-3.5"/> E-Receipt
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                             })}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </motion.div>
              </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Premium E-Invoice / Receipt Designer Modal */}
      <AnimatePresence>
        {showReceipt && (
          <Portal>
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="w-full max-w-5xl bg-[#0A0A0A] border border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[95dvh] md:max-h-[90dvh] h-full relative font-sans"
              >
                {/* Save to Admin Success / Loading Screen Overlays */}
                <AnimatePresence>
                  {isSavingAdmin && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      className="absolute inset-0 bg-[#0F0F0F]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6"
                    >
                      <div className="w-10 h-10 border-2 border-t-red-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4" />
                      <span className="text-xs text-[#666] font-mono tracking-widest uppercase animate-pulse">Synchronizing Ledger Dossier...</span>
                    </motion.div>
                  )}
                  {showAdminSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0 }} 
                      className="absolute inset-0 bg-[#0F0F0F]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6"
                    >
                      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-[bounce_1s_infinite_alternate]">
                        <CheckSquare className="w-8 h-8" weight="fill" />
                      </div>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">Archived in Admin Portal</h3>
                      <p className="text-xs text-[#999] mt-2 max-w-xs leading-relaxed font-mono">
                        Transaction receipt logged, locked in financials ledger, and archived to student record.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Modal Header */}
                <div className="p-4 border-b border-[#262626] bg-[#0F0F0F] flex justify-between items-center z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-500" weight="fill" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-[#E4E4E4]">Interactive E-Receipt Designer</span>
                      <p className="text-[9px] text-[#666] font-mono mt-0.5">Customize, preview, and generate official student invoices</p>
                    </div>
                  </div>
                  <button onClick={() => setShowReceipt(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#666] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dashboard Grid Container */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden bg-[#0A0A0A]">
                  
                  {/* Left Column: Customization Controls */}
                  <div className="md:col-span-5 bg-[#0F0F0F] border-b md:border-b-0 md:border-r border-[#262626] p-5 flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar">
                    <div>
                      <h4 className="text-[10px] text-red-500 uppercase font-black tracking-widest flex items-center gap-1.5 mb-1">
                        <PaintBrush className="w-3.5 h-3.5" />
                        Branding & Layout
                      </h4>
                      <p className="text-[9px] text-[#666] font-mono leading-relaxed">Customize payment properties, styles, and visible items for this student invoice.</p>
                    </div>

                    {/* Accent Color Picker */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider">Accent Theme Color</label>
                      <div className="flex gap-2">
                        {[
                          { name: 'Red', hex: '#EF2F38', label: 'Infinity' },
                          { name: 'Blue', hex: '#3B82F6', label: 'ABA Pay' },
                          { name: 'Green', hex: '#10B981', label: 'Waiver' },
                          { name: 'Purple', hex: '#8B5CF6', label: 'Premium' }
                        ].map(color => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => setReceiptAccentColor(color.hex)}
                            className={cn(
                              "flex-1 py-1.5 rounded-[8px] text-[8px] font-bold uppercase tracking-wider transition-all border cursor-pointer",
                              receiptAccentColor === color.hex 
                                ? "bg-white text-black border-neutral-300 dark:border-white shadow-md shadow-neutral-200/50 dark:shadow-white/5" 
                                : "bg-[#1A1A1A] text-[#888] border-[#262626] hover:text-white"
                            )}
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: color.hex }} />
                            {color.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider">Payment Gateway</label>
                      <select 
                        value={receiptPaymentMethod} 
                        onChange={(e) => setReceiptPaymentMethod(e.target.value as any)}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-[8px] px-3 py-2 text-xs text-[#E4E4E4] focus:outline-none focus:border-[#444]"
                      >
                        <option value="ABA Mobile Transfer">ABA Mobile (Bank Transfer)</option>
                        <option value="ABA Pay">ABA PAY (KHQR Code)</option>
                        <option value="Cash">Cash (Manual Collector)</option>
                        <option value="Bakong">Bakong System (KHQR)</option>
                        <option value="Wing">Wing Wallet</option>
                        <option value="Credit Card">Credit Card (Visa / Master)</option>
                      </select>
                    </div>

                    {/* Reference ID Input */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider">Transaction Reference ID</label>
                      <input 
                        type="text" 
                        value={receiptReferenceNumber} 
                        onChange={(e) => setReceiptReferenceNumber(e.target.value)}
                        placeholder="e.g. TXN-ABA-182390231"
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-[#444] font-mono"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2 border-t border-[#262626] pt-3 mt-1">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider mb-2">Display Elements</label>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#BBB]">Include Institution Logo</span>
                        <button 
                          type="button"
                          onClick={() => setReceiptShowLogo(!receiptShowLogo)}
                          className={cn(
                            "w-8 h-4 rounded-full transition-colors relative cursor-pointer",
                            receiptShowLogo ? "bg-green-500" : "bg-[#262626]"
                          )}
                        >
                          <div className={cn("w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all shadow", receiptShowLogo ? "left-4" : "left-0.5")} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#BBB]">Print "PAID" Watermark Stamp</span>
                        <button 
                          type="button"
                          onClick={() => setReceiptShowWatermark(!receiptShowWatermark)}
                          className={cn(
                            "w-8 h-4 rounded-full transition-colors relative cursor-pointer",
                            receiptShowWatermark ? "bg-green-500" : "bg-[#262626]"
                          )}
                        >
                          <div className={cn("w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all shadow", receiptShowWatermark ? "left-4" : "left-0.5")} />
                        </button>
                      </div>
                    </div>

                    {/* Custom Notes */}
                    <div className="space-y-1.5 border-t border-[#262626] pt-3 mt-1 flex-1 flex flex-col justify-end">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider">Footnotes / Custom Notes</label>
                      <textarea 
                        value={receiptCustomNotes} 
                        onChange={(e) => setReceiptCustomNotes(e.target.value)}
                        placeholder="Type customized terms, thank you notes, or official staff names here..."
                        rows={2}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-[8px] p-2.5 text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-[#444] resize-none"
                      />
                    </div>
                  </div>

                  {/* Right Column: Live E-Receipt Canvas Preview */}
                  <div className="md:col-span-7 bg-[#121212] p-4 sm:p-6 flex flex-col items-center justify-start overflow-hidden select-none relative">
                    
                    {/* Live E-Invoice Title Bar */}
                    <div className="w-full max-w-[480px] mb-3 flex items-center justify-between text-[#666] font-mono text-[9px] uppercase tracking-widest px-1 shrink-0">
                      <span>Live Digital Preview</span>
                      <button 
                        onClick={() => setReceiptFullscreen(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 bg-[#1A1A1A] hover:bg-[#222] border border-[#262626] px-2 py-1 rounded-[8px] transition-colors cursor-pointer"
                      >
                        <ArrowsOut className="w-3 h-3" /> Fullscreen Preview
                      </button>
                    </div>

                    {/* Scrollable Receipt Preview Box (Fixed Scrollbar Clip Issue) */}
                    <div className="w-full max-w-[480px] flex-1 overflow-y-auto custom-scrollbar pr-2 py-2 flex flex-col items-center justify-start border border-[#262626] bg-[#0A0A0A] rounded-[8px] shadow-inner max-h-[56vh] md:max-h-[58vh]">
                      <div 
                        id="receipt-print-area" 
                        style={{
                          padding: '24px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          maxWidth: '380px',
                          boxSizing: 'border-box',
                          borderRadius: '8px'
                        }}
                      >
                        {renderReceiptCard('receipt-print-area-core')}
                      </div>
                    </div>

                    <div className="w-full max-w-[480px] mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#666] font-mono uppercase tracking-tight shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                      <span>Real-time customizing enabled</span>
                    </div>

                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="p-4 border-t border-[#262626] flex flex-wrap gap-2.5 bg-[#0F0F0F] shrink-0 print:hidden justify-between items-center z-10">
                  <div>
                    <span className="text-[10px] text-[#666] font-mono uppercase tracking-widest hidden sm:inline">Active Session Admin: {state.currentUser?.displayName}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setShowReceipt(null)} 
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-[#CCC] hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      Close Panel
                    </button>
                    
                    <button 
                      onClick={handleSaveToAdmin}
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-green-500/20 text-[#10B981] hover:text-green-400 font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      Sync to Admin DB
                    </button>

                    <button 
                      onClick={handleSaveAsImage}
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-blue-500/20 text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <Image className="w-3.5 h-3.5" /> Save as Image
                    </button>

                    <button 
                      onClick={handleSaveAsPdf} 
                      style={{ backgroundColor: receiptAccentColor }}
                      className="flex-1 sm:flex-none px-5 py-2 min-h-[38px] text-white text-white-override font-bold uppercase tracking-widest text-[10px] rounded-[8px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-md shadow-black/40 cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <FilePdf className="w-3.5 h-3.5 text-white" /> Save as PDF
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Immersive Fullscreen Preview Modal Portal */}
      <AnimatePresence>
        {receiptFullscreen && showReceipt && (
          <Portal>
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-200 font-sans">
              
              {/* Fullscreen Floating Top Header Bar */}
              <div className="w-full max-w-[500px] bg-[#141414]/80 backdrop-blur-md border border-[#262626] rounded-[8px] p-3 flex items-center justify-between shadow-2xl shrink-0 z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">Fullscreen Inspect Mode</span>
                </div>
                <button 
                  onClick={() => setReceiptFullscreen(false)}
                  className="px-3 py-1 bg-[#262626] hover:bg-[#333] text-white hover:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-[8px] transition-colors cursor-pointer"
                >
                  Exit Inspect
                </button>
              </div>

              {/* Fullscreen Document Canvas (Fixed overflow clipping on small viewports) */}
              <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center py-4 my-2">
                <div className="w-full max-w-[380px] scale-[0.9] sm:scale-100 origin-center transition-transform">
                  {renderReceiptCard('receipt-print-area-fullscreen')}
                </div>
              </div>

              {/* Fullscreen Floating Bottom Footer Bar */}
              <div className="w-full max-w-[500px] bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-[8px] p-3 flex gap-2.5 justify-center shadow-2xl shrink-0 z-10">
                <button 
                  onClick={handleSaveAsImage}
                  className="flex-1 px-4 py-2 bg-[#262626] hover:bg-[#333] border border-blue-500/20 text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest text-[9px] rounded-[8px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Image className="w-3.5 h-3.5" /> Save Image
                </button>

                <button 
                  onClick={handleSaveAsPdf}
                  style={{ backgroundColor: receiptAccentColor }}
                  className="flex-1 px-5 py-2 text-white text-white-override font-bold uppercase tracking-widest text-[9px] rounded-[8px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1 shadow-md cursor-pointer"
                >
                  <FilePdf className="w-3.5 h-3.5 text-white" /> Save PDF
                </button>
              </div>

            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
