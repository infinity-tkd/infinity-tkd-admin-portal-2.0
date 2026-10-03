'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, Printer, ArrowsOutSimple, ArrowsInSimple, 
  Calendar, Phone, Envelope, MapPin, Heart, Trophy, Medal,
  ShieldCheck, Clock, Image as ImageIcon, GraduationCap, CheckCircle,
  FileText, Receipt, Notebook, ListChecks
} from '@phosphor-icons/react';
import { useAppStore } from '@/lib/store';
import { cn, formatBelt, formatBeltLocalized } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { Portal } from '@/components/Portal';

interface StudentDossierModalProps {
  studentId: string;
  onClose: () => void;
}

// Convert base64 data URLs to Blobs synchronously to avoid CSP network fetch blocks
function dataURLtoBlob(dataUrl: string) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function StudentDossierModal({ studentId, onClose }: StudentDossierModalProps) {
  const { state, showNotification } = useAppStore();
  const t = useT();
  const dossierRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scale, setScale] = useState(1);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [activePage, setActivePage] = useState(0);
  
  const student = state.students.find(s => s.id === studentId);

  // Set up resize observer to dynamically scale A4 preview pages
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateScale = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      // Allow padding around the page (80px total padding)
      const availableWidth = width - 80;
      if (availableWidth < 794) {
        setScale(Math.max(0.3, availableWidth / 794));
      } else {
        setScale(1);
      }
    };

    updateScale();
    const observer = new ResizeObserver(() => {
      updateScale();
    });
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [viewMode]); // Trigger scale update if view mode changes

  if (!student) return null;

  // Retrieve records from store
  const beltHistory = state.beltHistories
    .filter(b => b.studentId === student.id)
    .sort((a, b) => new Date(b.promotionDate).getTime() - new Date(a.promotionDate).getTime());
    
  const achievements = state.achievements
    .filter(a => a.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  const physicalEvals = state.physicalEvaluations
    .filter(e => e.studentId === student.id)
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());

  const attendance = state.attendanceRecords.filter(r => r.studentId === student.id);
  const attendedCount = attendance.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const attendanceRate = attendance.length > 0 ? Math.round((attendedCount / attendance.length) * 100) : null;

  // Calculate age
  const calculateAge = () => {
    if (!student.dob) return 0;
    const today = new Date();
    const dob = new Date(student.dob);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };
  const age = calculateAge();

  // BMI calculations
  const heightM = student.heightCm ? student.heightCm / 100 : 0;
  const bmiVal = (heightM > 0 && student.weightKg) ? Number((student.weightKg / (heightM * heightM)).toFixed(1)) : null;
  const getBmiInfo = (val: number) => {
    if (val < 18.5) return { label: t('panel_bmi_underweight') || 'Underweight', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (val < 25) return { label: t('panel_bmi_normal') || 'Normal Weight', color: 'text-green-600 bg-green-50 border-green-200' };
    if (val < 30) return { label: t('panel_bmi_overweight') || 'Overweight', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { label: t('panel_bmi_obese') || 'Obese', color: 'text-red-600 bg-red-50 border-red-200' };
  };
  const bmiInfo = bmiVal ? getBmiInfo(bmiVal) : null;

  // Enrolled class sessions
  const studentEnrollments = state.classEnrollments.filter(e => e.studentId === student.id);

  // Video progress checklist matching student's current belt level (LMS Curriculum)
  const curriculumVideos = state.curriculumVideos.filter(v => v.minBeltLevel === student.currentBelt);
  const watchedVideoIds = state.videoProgress.filter(p => p.studentId === student.id).map(p => p.videoId);
  const totalBeltVideosCount = curriculumVideos.length;
  const watchedBeltVideosCount = curriculumVideos.filter(v => watchedVideoIds.includes(v.id)).length;
  const lmsCompletionPct = totalBeltVideosCount > 0 ? Math.round((watchedBeltVideosCount / totalBeltVideosCount) * 100) : 100;

  // Physical skills techniques checklist matching student's current belt level
  const beltTechniques = state.beltTechniques.filter(t => t.beltLevel === student.currentBelt);

  // tuition fees payments
  const monthMap: Record<string, number> = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };
  const payments = state.payments
    .filter(p => p.studentId === student.id)
    .sort((a, b) => b.year - a.year || (monthMap[b.month] || 0) - (monthMap[a.month] || 0))
    .slice(0, 5); // display top 5 recent payment logs

  // Loops and generates image download for each page
  const handleDownloadImages = async () => {
    if (!dossierRef.current) return;
    setIsGenerating(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const pages = dossierRef.current.querySelectorAll('.dossier-page-canvas');
      if (pages.length === 0) return;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLDivElement;
        const wrapper = page.parentElement as HTMLDivElement;
        
        // Save current styles
        const originalStyle = page.style.transform;
        const originalPosition = page.style.position;
        const originalTop = page.style.top;
        const originalLeft = page.style.left;
        
        const originalWrapperWidth = wrapper.style.width;
        const originalWrapperHeight = wrapper.style.height;
        const originalWrapperOverflow = wrapper.style.overflow;
        const originalWrapperDisplay = wrapper.style.display;

        // Clear scaling and force visibility temporarily for a high-res capture
        page.style.transform = 'none';
        page.style.position = 'relative';
        page.style.top = 'auto';
        page.style.left = 'auto';
        
        wrapper.style.width = '794px';
        wrapper.style.height = '1123px';
        wrapper.style.overflow = 'visible';
        wrapper.style.setProperty('display', 'block', 'important'); // force display block override
        
        const canvas = await html2canvas(page, {
          scale: 2, // High resolution (300 DPI equivalent)
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#FFFFFF',
          logging: true
        });
        
        // Restore styles
        page.style.transform = originalStyle;
        page.style.position = originalPosition;
        page.style.top = originalTop;
        page.style.left = originalLeft;
        
        wrapper.style.width = originalWrapperWidth;
        wrapper.style.height = originalWrapperHeight;
        wrapper.style.overflow = originalWrapperOverflow;
        wrapper.style.display = originalWrapperDisplay;
        
        const dataUrl = canvas.toDataURL('image/png');
        const blob = dataURLtoBlob(dataUrl);
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `INFINITY_TKD_DOSSIER_${student.englishName.replace(/\s+/g, '_')}_${student.id}_Page_${i + 1}.png`;
        link.href = blobUrl;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        // Wait 350ms between downloads to avoid browser block triggers
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      showNotification("All dossier transcript pages successfully downloaded as PNG images.", "success");
    } catch (error: any) {
      console.error("Failed to generate image dossier pages:", error);
      showNotification("Failed to download dossier pages. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintPDF = () => {
    if (!dossierRef.current) return;
    
    const printWindow = window.open('', '_blank', 'width=950,height=1250');
    if (!printWindow) {
      showNotification("Popup blocker prevented printing. Please allow popups.", "warning");
      return;
    }

    const htmlContent = dossierRef.current.innerHTML;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    const safeTitle = (student.englishName || 'STUDENT').replace(/[<>&"']/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>INFINITY TKD STUDENT DOSSIER - ${safeTitle}</title>
          ${styles}
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            @media print {
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-scaler-wrapper {
                width: 794px !important;
                height: 1123px !important;
                overflow: visible !important;
                position: relative !important;
                display: block !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
              }
              .page-scaler-wrapper:last-child {
                page-break-after: avoid !important;
              }
              .dossier-page {
                transform: none !important;
                position: relative !important;
                top: auto !important;
                left: auto !important;
                width: 794px !important;
                max-width: 794px !important;
                height: 1123px !important;
                border: none !important;
                box-shadow: none !important;
                padding: 50px !important;
                margin: 0 auto !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                box-sizing: border-box !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
              }
              .no-print {
                display: none !important;
              }
            }
            body {
              font-family: 'Montserrat', 'Kantumruy Pro', sans-serif;
              background-color: white;
              padding: 0;
              margin: 0;
            }
            .page-scaler-wrapper {
              width: 794px;
              height: 1123px;
              overflow: visible;
              position: relative;
            }
            .dossier-page {
              width: 794px;
              height: 1123px;
              margin: 0 auto;
              background: white;
              padding: 50px;
              box-sizing: border-box;
              color: #111;
              position: relative;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${htmlContent}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getAgeDivision = () => {
    const a = calculateAge();
    if (a >= 6 && a <= 11) return t('dir_div_kid') || 'Kid (6-11)';
    if (a >= 12 && a <= 14) return t('dir_div_cadet') || 'Cadet (12-14)';
    if (a >= 15 && a <= 17) return t('dir_div_junior') || 'Junior (15-17)';
    if (a >= 18) return t('dir_div_senior') || 'Senior (18+)';
    return 'Under 6';
  };

  const currentYear = new Date().getFullYear();

  return (
    <Portal>
      {/* Dynamic Screen View Media stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .page-scaler-wrapper.inactive {
            display: none !important;
          }
          .dossier-page {
            background-color: #FFFFFF !important;
            color: #111827 !important;
          }
          .dossier-pill-dark {
            background-color: #111827 !important;
            color: #FFFFFF !important;
          }
        }
      `}} />

      {/* Background overlay screen */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))] bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        
        {/* Document Panel Container */}
        <div className={`relative bg-neutral-900 border border-neutral-800 rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[96dvh] transition-all duration-300 ${isFullScreen ? 'w-full h-full max-w-none' : 'w-full max-w-4xl h-[90dvh]'}`}>
          
          {/* Header Action Control Panel */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0 text-white z-10 shadow-md gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[8px] bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] shrink-0">
                <FileText weight="fill" className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono truncate">Student Transcript Dossier</h3>
                <p className="text-[9px] text-[#888] font-mono mt-0.5 truncate">{student.englishName} ({student.id})</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button 
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded-[8px] transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider font-mono"
              >
                {isFullScreen ? (
                  <>
                    <ArrowsInSimple className="w-4 h-4" />
                    <span className="hidden md:inline">Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <ArrowsOutSimple className="w-4 h-4" />
                    <span className="hidden md:inline">Fullscreen</span>
                  </>
                )}
              </button>

              <button 
                onClick={handleDownloadImages}
                disabled={isGenerating}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-[8px] transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-md shadow-emerald-600/10 font-mono"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{isGenerating ? "Saving..." : "Save PNG"}</span>
              </button>

              <button 
                onClick={handlePrintPDF}
                className="p-2 bg-[#EF2F38] hover:bg-red-600 text-white rounded-[8px] transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-md shadow-red-500/10 font-mono"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print / PDF</span>
              </button>

              <button 
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-[#666] hover:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Secondary Sub-Header: View Mode & Page Navigation */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between shrink-0 gap-2.5 text-white">
            {/* View Mode Switcher */}
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-[8px] p-0.5">
              <button 
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1.5 ${viewMode === 'single' ? 'bg-[#EF2F38] text-white shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Page-by-Page</span>
              </button>
              <button 
                onClick={() => setViewMode('scroll')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1.5 ${viewMode === 'scroll' ? 'bg-[#EF2F38] text-white shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                <Notebook className="w-3.5 h-3.5" />
                <span>Continuous Scroll</span>
              </button>
            </div>

            {/* Navigation Panel */}
            {viewMode === 'single' ? (
              <div className="flex items-center gap-2">
                <button 
                  disabled={activePage === 0}
                  onClick={() => setActivePage(p => Math.max(0, p - 1))}
                  className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-[8px] text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="flex bg-neutral-900 border border-neutral-800 rounded-[8px] p-0.5 gap-0.5">
                  <button 
                    onClick={() => setActivePage(0)}
                    className={`px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider rounded-[8px] transition-all ${activePage === 0 ? 'bg-neutral-800 text-white border border-neutral-700' : 'text-neutral-400 hover:text-white'}`}
                  >
                    1. Profile & Bio
                  </button>
                  <button 
                    onClick={() => setActivePage(1)}
                    className={`px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider rounded-[8px] transition-all ${activePage === 1 ? 'bg-neutral-800 text-white border border-neutral-700' : 'text-neutral-400 hover:text-white'}`}
                  >
                    2. Rank & Curriculum
                  </button>
                  <button 
                    onClick={() => setActivePage(2)}
                    className={`px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider rounded-[8px] transition-all ${activePage === 2 ? 'bg-neutral-800 text-white border border-neutral-700' : 'text-neutral-400 hover:text-white'}`}
                  >
                    3. Performance & Notes
                  </button>
                </div>

                <button 
                  disabled={activePage === 2}
                  onClick={() => setActivePage(p => Math.min(2, p + 1))}
                  className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-[8px] text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest font-mono mr-1">Quick Jump:</span>
                <div className="flex bg-neutral-900 border border-neutral-800 rounded-[8px] p-0.5 gap-0.5">
                  <button 
                    onClick={() => {
                      const wrappers = dossierRef.current?.querySelectorAll('.page-scaler-wrapper');
                      wrappers?.[0]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded text-neutral-400 hover:text-white transition-all hover:bg-neutral-800"
                  >
                    P1: Profile
                  </button>
                  <button 
                    onClick={() => {
                      const wrappers = dossierRef.current?.querySelectorAll('.page-scaler-wrapper');
                      wrappers?.[1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded text-neutral-400 hover:text-white transition-all hover:bg-neutral-800"
                  >
                    P2: Rank
                  </button>
                  <button 
                    onClick={() => {
                      const wrappers = dossierRef.current?.querySelectorAll('.page-scaler-wrapper');
                      wrappers?.[2]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded text-neutral-400 hover:text-white transition-all hover:bg-neutral-800"
                  >
                    P3: Performance
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Core Scroll View Container */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto p-8 bg-[#0F0F0F] flex flex-col items-center gap-6 custom-scrollbar w-full scroll-smooth"
          >
            
            {/* The 3 A4 Document Canvas sheets */}
            <div ref={dossierRef} className="flex flex-col gap-8 items-center w-full">
              
              {/* ========================================================================= */}
              {/* PAGE 1: ACADEMIC PROFILE & COURSE LOGISTICS */}
              {/* ========================================================================= */}
              <div 
                className={`page-scaler-wrapper shrink-0 ${viewMode === 'single' && activePage !== 0 ? 'inactive' : ''}`}
                style={{
                  width: `${794 * scale}px`,
                  height: `${1123 * scale}px`,
                  transition: 'width 0.15s ease-out, height 0.15s ease-out',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div 
                  className="dossier-page w-[794px] h-[1123px] bg-white text-black p-12 shadow-2xl relative flex flex-col justify-between select-none shrink-0 border border-neutral-200"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    boxSizing: 'border-box',
                    fontFamily: "'Montserrat', 'Kantumruy Pro', sans-serif",
                    backgroundColor: '#FFFFFF',
                    color: '#111827'
                  }}
                >
                  {/* Background Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] z-0">
                    <img src="/logo.svg" alt="Watermark Logo" className="w-[450px] h-[450px]" />
                  </div>

                  <div className="relative z-10 flex flex-col flex-grow">
                    {/* Official Header */}
                    <div className="flex justify-between items-center border-b-[3px] border-[#EF2F38] pb-4 mb-6">
                      <div className="flex items-center gap-4">
                        <img src="/logo.svg" alt="Infinity TKD Crest Logo" className="w-14 h-14 shrink-0 filter brightness-95" />
                        <div>
                          <h1 className="text-lg font-black tracking-widest text-[#EF2F38] leading-none uppercase">
                            INFINITY TAEKWONDO ACADEMY
                          </h1>
                          <h2 className="text-[10px] font-semibold text-neutral-700 font-khmer mt-1 leading-none">
                            សាលាតេក្វាន់ដូ អ៊ីនហ្វីនីធី
                          </h2>
                          <p className="text-[8px] text-neutral-600 font-mono tracking-wider mt-1.5 uppercase">
                            Phnom Penh, Cambodia | Tel: +855 12 345 678 | info@infinitytkd.com
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="inline-block dossier-pill-dark text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded font-mono">
                          Page 1: Dossier
                        </div>
                        <p className="text-[7px] text-neutral-600 font-mono mt-1">Printed: {new Date().toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h3 className="text-sm font-black tracking-widest uppercase text-neutral-900 leading-none">
                        OFFICIAL ATHLETE PROFILE & ACADEMY DOSSIER
                      </h3>
                      <div className="w-16 h-0.5 bg-neutral-300 mx-auto mt-1.5" />
                    </div>

                    {/* Profile & Registry Details Grid */}
                    <div className="grid grid-cols-4 gap-6 mb-6 items-start bg-neutral-100 p-5 rounded-[8px] border border-neutral-300">
                      <div className="col-span-1 flex flex-col items-center">
                        <div className="w-24 h-24 bg-white border border-neutral-300 rounded-[8px] overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                          <SafeImage 
                            src={student.profilePicturePath} 
                            alt={student.englishName} 
                            containerClassName="w-full h-full object-cover flex items-center justify-center text-2xl font-bold text-neutral-600 bg-neutral-200"
                            fallback={student.englishName.charAt(0)}
                            crossOrigin="anonymous"
                          />
                        </div>
                        <span className="text-[8px] font-mono font-bold text-neutral-600 mt-2 uppercase tracking-wide">STUDENT PROFILE</span>
                      </div>

                      <div className="col-span-3 grid grid-cols-2 gap-y-2.5 gap-x-6 text-[10px]">
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-600 tracking-wider">Student ID</span>
                          <span className="font-mono font-black text-[#EF2F38] text-xs">{student.id}</span>
                        </div>
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-600 tracking-wider">Active Belt Rank</span>
                          <span className="font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" 
                              style={{
                                backgroundColor: 
                                  student.currentBelt === 'White' ? '#E5E7EB' :
                                  student.currentBelt === 'Yellow' ? '#FBBF24' :
                                  student.currentBelt === 'Green' ? '#22C55E' :
                                  student.currentBelt === 'Blue' ? '#3B82F6' :
                                  student.currentBelt === 'Brown' ? '#92400E' :
                                  student.currentBelt === 'Red' ? '#EF4444' : '#111'
                              }} 
                            />
                            {student.currentBelt}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-600 tracking-wider">English Name</span>
                          <span className="font-extrabold text-neutral-950 uppercase">{student.englishName}</span>
                        </div>
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-600 tracking-wider">Khmer Name</span>
                          <span className="font-bold text-neutral-950 font-khmer">{student.khmerName || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-600 tracking-wider">Date of Birth / Age</span>
                          <span className="font-semibold text-neutral-900">
                            {student.dob || '—'} ({age} yrs, {getAgeDivision()})
                          </span>
                        </div>
                        <div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-800 tracking-wider">Gender / Nationality</span>
                          <span className="font-semibold text-black">{student.gender} / {student.nationality || 'Cambodian'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Contact details & Home address block */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300">
                        <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2 flex items-center gap-1 border-b border-neutral-300 pb-1">
                          <Phone className="w-3.5 h-3.5" />
                          <span>CONTACT INFORMATION</span>
                        </h4>
                        <div className="space-y-2 text-[10px]">
                          <div>
                            <span className="text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Student Phone</span>
                            <p className="font-mono text-black font-semibold">{student.phone || 'Not Registered'}</p>
                          </div>
                          <div>
                            <span className="text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Student Email</span>
                            <p className="font-medium text-black truncate">{student.email || 'Not Registered'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300">
                        <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2 flex items-center gap-1 border-b border-neutral-300 pb-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>RESIDENTIAL HOME ADDRESS</span>
                        </h4>
                        {student.address?.line1 ? (
                          <div className="text-[9px] text-black space-y-0.5 font-medium leading-tight">
                            <p className="font-bold text-black">{student.address.line1}</p>
                            {student.address.line2 && <p>{student.address.line2}</p>}
                            <p>{student.address.city}, {student.address.stateProvince} {student.address.postalCode}</p>
                            <p className="text-[8px] font-bold text-neutral-900 uppercase tracking-widest mt-1">{student.address.country}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-black italic">No primary residential address registered in index.</p>
                        )}
                      </div>
                    </div>

                    {/* Emergency & Guardian Information */}
                    <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300 mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 flex items-center gap-1 border-b border-neutral-300 pb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>GUARDIAN BIO & EMERGENCY CONTACTS</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-[10px] font-medium text-black">
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Primary Guardian</span>
                          <span className="font-bold text-black">{student.emergencyContactName || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Emergency Phone</span>
                          <span className="font-mono font-bold text-red-700">{student.emergencyContactPhone || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Family Relation</span>
                          <span className="font-semibold text-black">{student.emergencyContactRelation || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Enrollments & Branch Scheduling Matrix */}
                    <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300 mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 flex items-center gap-1 border-b border-neutral-300 pb-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>ACADEMY STATUS & TRAINING CLASS SCHEDULES</span>
                      </h4>
                      <div className="grid grid-cols-4 gap-4 text-[10px] mb-3 pb-3 border-b border-neutral-300">
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Registered Branch</span>
                          <span className="font-bold text-black">{state.branches.find(b => b.id === student.homeBranchId)?.name || 'Unassigned'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Registration Date</span>
                          <span className="font-mono text-black">{student.registrationDate || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Academy Status</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border inline-block mt-0.5",
                            student.studentStatus === 'Active' ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" :
                            student.studentStatus === 'Paused' ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
                            student.studentStatus === 'Inactive' ? "bg-neutral-500/10 text-neutral-700 border-neutral-500/30" :
                            student.studentStatus === 'Suspended' ? "bg-red-500/10 text-red-700 border-red-500/30" :
                            "bg-indigo-500/10 text-indigo-700 border-indigo-500/30"
                          )}>{student.studentStatus}</span>
                          {student.statusReason && (
                            <span className="block text-[8px] text-amber-700 font-mono mt-0.5">Note: {student.statusReason} {student.pauseEndDate && `(Until ${student.pauseEndDate})`}</span>
                          )}
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Scholarship Grade</span>
                          <span className="font-semibold text-black">
                            {state.scholarships.find(s => s.id === student.scholarshipId)?.typeName || 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="block text-[8px] uppercase font-bold text-neutral-800 tracking-wider">Active Scheduled Enrollments</span>
                        {studentEnrollments.length === 0 ? (
                          <p className="text-[10px] text-black italic">This student is not enrolled in any active class schedules.</p>
                        ) : (
                          studentEnrollments.map(e => {
                            const cls = state.classSessions.find(c => c.id === e.classId);
                            if (!cls) return null;
                            const coachName = state.users.find(u => u.id === cls.coachId)?.displayName || 'TBA';
                            return (
                              <div key={e.id} className="flex justify-between items-center bg-white border border-neutral-300 p-2 rounded text-[9px] font-medium">
                                <div>
                                  <span className="font-bold text-black">{cls.name}</span>
                                  <span className="text-neutral-700 font-mono text-[8px] ml-2">({cls.daysOfWeek?.join(', ')} {cls.startTime} - {cls.endTime})</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-neutral-800 text-[8px] uppercase font-semibold">Coach: </span>
                                  <span className="font-bold text-[#EF2F38]">{coachName}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Bottom layout: Attendance statistics left side, Tuition fees ledger right side */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      {/* Attendance Consistency Analytics */}
                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300">
                        <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 flex items-center gap-1 border-b border-neutral-300 pb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>ATTENDANCE METRICS SUMMARY</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 py-1 text-[10px]">
                          <div>
                            <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Total Checked</span>
                            <span className="text-xs font-mono font-black text-black">{attendance.length} Sessions</span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Present / Late</span>
                            <span className="text-xs font-mono font-black text-green-800">
                              {attendance.filter(r => r.status === 'Present').length} / {attendance.filter(r => r.status === 'Late').length}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Absences Logged</span>
                            <span className="text-xs font-mono font-black text-red-700">
                              {attendance.filter(r => r.status === 'Absent').length} Classes
                            </span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Consistency Rate</span>
                            <span className="text-xs font-mono font-black text-[#EF2F38]">
                              {attendanceRate !== null ? `${attendanceRate}%` : '100%'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tuition Payments Financial Ledger */}
                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300">
                        <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 flex items-center gap-1 border-b border-neutral-300 pb-1">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>RECENT TUITION FEES LEDGER</span>
                        </h4>
                        {payments.length === 0 ? (
                          <div className="flex items-center justify-center h-16">
                            <p className="text-[9px] text-black italic">No recent payment ledger records detected.</p>
                          </div>
                        ) : (
                          <table className="w-full text-left text-[8px] border-collapse mt-1">
                            <thead>
                              <tr className="bg-neutral-200 text-neutral-900 font-bold uppercase tracking-wider">
                                <th className="px-2 py-1 rounded-l-[8px]">Period</th>
                                <th className="px-2 py-1">Status</th>
                                <th className="px-2 py-1 rounded-r-[8px] text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-300 font-medium">
                              {payments.map(p => (
                                <tr key={p.id} className="hover:bg-neutral-200/50">
                                  <td className="px-2 py-1.5 font-bold text-black">{p.month} {p.year}</td>
                                  <td className="px-2 py-1.5">
                                    <span className={`inline-block px-1 py-0.5 rounded-[3px] text-[7px] font-bold border ${
                                      p.status === 'Paid' ? 'bg-green-100 text-green-900 border-green-300' :
                                      p.status === 'Pending' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                      'bg-red-100 text-red-900 border-red-300'
                                    }`}>
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono font-bold text-black">${p.amountUsd}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Page 1 Footer */}
                  <div className="border-t border-neutral-300 pt-3 flex justify-between items-center text-[7px] text-black font-mono uppercase tracking-wider">
                    <span>© {currentYear} Infinity Taekwondo Academy.</span>
                    <span>Page 1 of 3</span>
                    <span className="font-bold text-[#EF2F38]">Verification Code: {student.id.substring(0, 8)}-P1</span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* PAGE 2: BELT TRANSCRIPT & CURRICULUM PROGRESS */}
              {/* ========================================================================= */}
              <div 
                className={`page-scaler-wrapper shrink-0 ${viewMode === 'single' && activePage !== 1 ? 'inactive' : ''}`}
                style={{
                  width: `${794 * scale}px`,
                  height: `${1123 * scale}px`,
                  transition: 'width 0.15s ease-out, height 0.15s ease-out',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div 
                  className="dossier-page w-[794px] h-[1123px] bg-white text-black p-12 shadow-2xl relative flex flex-col justify-between select-none shrink-0 border border-neutral-200"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    boxSizing: 'border-box',
                    fontFamily: "'Montserrat', 'Kantumruy Pro', sans-serif",
                    backgroundColor: '#FFFFFF',
                    color: '#000000'
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] z-0">
                    <img src="/logo.svg" alt="Watermark Logo" className="w-[450px] h-[450px]" />
                  </div>

                  <div className="relative z-10 flex flex-col flex-grow">
                    {/* Official Header */}
                    <div className="flex justify-between items-center border-b-[3px] border-[#EF2F38] pb-4 mb-6">
                      <div className="flex items-center gap-4">
                        <img src="/logo.svg" alt="Infinity TKD Crest Logo" className="w-14 h-14 shrink-0 filter brightness-95" />
                        <div>
                          <h1 className="text-lg font-black tracking-widest text-[#EF2F38] leading-none uppercase">
                            INFINITY TAEKWONDO ACADEMY
                          </h1>
                          <h2 className="text-[10px] font-semibold text-neutral-700 font-khmer mt-1 leading-none">
                            សាលាតេក្វាន់ដូ អ៊ីនហ្វីនីធី
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="inline-block dossier-pill-dark text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded font-mono">
                          Page 2: Transcript
                        </div>
                        <p className="text-[7px] text-neutral-600 font-mono mt-1">Printed: {new Date().toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h3 className="text-sm font-black tracking-widest uppercase text-neutral-900 leading-none">
                        OFFICIAL TAEKWONDO RANK TRANSCRIPT
                      </h3>
                      <div className="w-16 h-0.5 bg-neutral-300 mx-auto mt-1.5" />
                    </div>

                    {/* Belt History Timeline */}
                    <div className="mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4" />
                        <span>OFFICIAL BELT PROMOTION HISTORY LEDGER</span>
                      </h4>
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-neutral-200 text-neutral-900 font-bold uppercase tracking-wider">
                            <th className="px-3 py-2 rounded-l-[8px]">Belt Level Rank</th>
                            <th className="px-3 py-2">Graduation Date</th>
                            <th className="px-3 py-2">Testing Score</th>
                            <th className="px-3 py-2">Curriculum Program</th>
                            <th className="px-3 py-2 rounded-r-[8px]">Certificate Reference / ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-300 font-medium">
                          {beltHistory.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-3.5 text-center text-black italic">
                                No rank graduation logs registered. Currently active at White Belt level.
                              </td>
                            </tr>
                          ) : (
                            beltHistory.map(log => (
                              <tr key={log.id} className="hover:bg-neutral-100">
                                <td className="px-3 py-2.5 font-bold text-black">{log.beltLevel}</td>
                                <td className="px-3 py-2.5 font-mono text-black">{log.promotionDate}</td>
                                <td className="px-3 py-2.5 font-mono text-[#EF2F38] font-black">{log.testScore || 80} pts</td>
                                <td className="px-3 py-2.5 text-black">{log.program || 'Standard Class'}</td>
                                <td className="px-3 py-2.5 font-mono text-black tracking-wider truncate max-w-[200px]" title={log.certificateRef || log.kukkiwonDanCardId}>
                                  {log.certificateRef || log.kukkiwonDanCardId || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Split section: LMS Video checkpoints on the left, Physical Techniques checklist on the right */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      {/* Left Side: LMS Video Checkpoint */}
                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>LMS VIDEO CHECKPOINT STATUS</span>
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-neutral-300 text-[8px] mb-3">
                            <div>
                              <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Belt Curriculum</span>
                              <span className="font-bold text-black uppercase">{student.currentBelt} Rank</span>
                            </div>
                            <div>
                              <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Completion Rate</span>
                              <span className="font-black text-[#EF2F38] font-mono">{watchedBeltVideosCount}/{totalBeltVideosCount} ({lmsCompletionPct}%)</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                            {curriculumVideos.length === 0 ? (
                              <p className="text-[9px] text-black italic py-2 text-center">No digital curriculum videos uploaded for this belt rank.</p>
                            ) : (
                              curriculumVideos.map(video => {
                                const isWatched = watchedVideoIds.includes(video.id);
                                return (
                                  <div key={video.id} className="flex justify-between items-center p-2 border border-neutral-300 rounded text-[8px] font-medium bg-white">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border shrink-0 ${isWatched ? 'bg-green-100 border-green-300 text-green-800' : 'bg-neutral-100 border-neutral-300 text-neutral-600'}`}>
                                        {isWatched ? '✓' : '•'}
                                      </span>
                                      <span className="font-bold text-black truncate" title={video.title}>{video.title}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Physical Techniques */}
                      <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>PHYSICAL SYLLABUS SKILLS (DOJANG)</span>
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-neutral-300 text-[8px] mb-3">
                            <div>
                              <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Required Skills</span>
                              <span className="font-bold text-black uppercase">{student.currentBelt} Belt</span>
                            </div>
                            <div>
                              <span className="block text-[7px] text-neutral-800 uppercase font-bold tracking-wider">Total Syllabus</span>
                              <span className="font-black text-[#EF2F38] font-mono">{beltTechniques.length} Techniques</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                            {beltTechniques.length === 0 ? (
                              <p className="text-[9px] text-black italic py-2 text-center">No physical syllabus techniques mapped for this belt rank.</p>
                            ) : (
                              beltTechniques.map(tech => (
                                <div key={tech.id} className="flex justify-between items-center p-2 border border-neutral-300 rounded text-[8px] font-medium bg-white">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38] shrink-0" />
                                    <span className="font-bold text-black truncate" title={tech.techniqueName}>{tech.techniqueName}</span>
                                  </div>
                                  <span className="text-[7px] font-mono text-neutral-700 uppercase shrink-0">{tech.category.split(' ')[0]}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Medical Bios & Physical Notes */}
                    <div className="p-4 bg-neutral-100 rounded-[8px] border border-neutral-300">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5" />
                        <span>HEALTH BIO & KUKKIWON REGISTRY</span>
                      </h4>
                      <div className="grid grid-cols-4 gap-4 text-[10px] mb-3 pb-3 border-b border-neutral-300">
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Height (cm)</span>
                          <span className="font-mono font-bold text-black">{student.heightCm ? `${student.heightCm} cm` : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Weight (kg)</span>
                          <span className="font-mono font-bold text-black">{student.weightKg ? `${student.weightKg} kg` : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">Body Mass Index (BMI)</span>
                          <span className="font-mono font-bold text-black">{bmiVal || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-neutral-800 uppercase font-bold tracking-wider">BMI Category</span>
                          <span className={`font-extrabold uppercase text-[8px] px-1.5 py-0.5 rounded border inline-block ${bmiInfo?.color || 'text-neutral-700 bg-neutral-100 border-neutral-300'}`}>
                            {bmiInfo?.label || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-[9px] font-medium leading-relaxed">
                        <div className="bg-white border border-neutral-300 p-2.5 rounded">
                          <span className="text-[8px] text-[#EF2F38] uppercase font-bold tracking-wider">Medical Remarks</span>
                          <p className="text-black mt-1">{student.medicalNotes || 'No health conditions registered.'}</p>
                        </div>
                        <div className="bg-white border border-neutral-300 p-2.5 rounded">
                          <span className="text-[8px] text-[#EF2F38] uppercase font-bold tracking-wider">Allergies Info</span>
                          <p className="text-black mt-1">{student.allergies || 'No allergies recorded.'}</p>
                        </div>
                        <div className="bg-white border border-neutral-300 p-2.5 rounded">
                          <span className="text-[8px] text-[#EF2F38] uppercase font-bold tracking-wider">Kukkiwon Credentials</span>
                          <p className="font-mono text-black font-bold mt-1">{student.kukkiwonId || 'No Kukkiwon ID Registered'}</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Page 2 Footer */}
                  <div className="border-t border-neutral-300 pt-3 flex justify-between items-center text-[7px] text-black font-mono uppercase tracking-wider">
                    <span>© {currentYear} Infinity Taekwondo Academy.</span>
                    <span>Page 2 of 3</span>
                    <span className="font-bold text-[#EF2F38]">Verification Code: {student.id.substring(0, 8)}-P2</span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* PAGE 3: ATHLETIC DEVELOPMENT & TOURNAMENT RECORD */}
              {/* ========================================================================= */}
              <div 
                className={`page-scaler-wrapper shrink-0 ${viewMode === 'single' && activePage !== 2 ? 'inactive' : ''}`}
                style={{
                  width: `${794 * scale}px`,
                  height: `${1123 * scale}px`,
                  transition: 'width 0.15s ease-out, height 0.15s ease-out',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div 
                  className="dossier-page w-[794px] h-[1123px] bg-white text-black p-12 shadow-2xl relative flex flex-col justify-between select-none shrink-0 border border-neutral-200"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    boxSizing: 'border-box',
                    fontFamily: "'Montserrat', 'Kantumruy Pro', sans-serif",
                    backgroundColor: '#FFFFFF',
                    color: '#000000'
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] z-0">
                    <img src="/logo.svg" alt="Watermark Logo" className="w-[450px] h-[450px]" />
                  </div>

                  <div className="relative z-10 flex flex-col flex-grow">
                    {/* Official Header */}
                    <div className="flex justify-between items-center border-b-[3px] border-[#EF2F38] pb-4 mb-6">
                      <div className="flex items-center gap-4">
                        <img src="/logo.svg" alt="Infinity TKD Crest Logo" className="w-14 h-14 shrink-0 filter brightness-95" />
                        <div>
                          <h1 className="text-lg font-black tracking-widest text-[#EF2F38] leading-none uppercase">
                            INFINITY TAEKWONDO ACADEMY
                          </h1>
                          <h2 className="text-[10px] font-semibold text-neutral-700 font-khmer mt-1 leading-none">
                            សាលាតេក្វាន់ដូ អ៊ីនហ្វីនីធី
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="inline-block dossier-pill-dark text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded font-mono">
                          Page 3: Performance
                        </div>
                        <p className="text-[7px] text-neutral-600 font-mono mt-1">Printed: {new Date().toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h3 className="text-sm font-black tracking-widest uppercase text-neutral-900 leading-none">
                        ATHLETIC DEVELOPMENT & TOURNAMENT HISTORY
                      </h3>
                      <div className="w-16 h-0.5 bg-neutral-300 mx-auto mt-1.5" />
                    </div>

                    {/* Physical Evaluations & Athlete Diagnostics */}
                    <div className="mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                        <Heart className="w-4 h-4" />
                        <span>ATHLETIC PHYSICAL EVALUATIONS DIAGNOSTICS</span>
                      </h4>
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-neutral-200 text-neutral-900 font-bold uppercase tracking-wider">
                            <th className="px-3 py-2 rounded-l-[8px]">Skill Area</th>
                            <th className="px-3 py-2">Test Rank</th>
                            <th className="px-3 py-2">Score Rating</th>
                            <th className="px-3 py-2">Grade</th>
                            <th className="px-3 py-2">Evaluation Date</th>
                            <th className="px-3 py-2 rounded-r-[8px]">Coach Assessment Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-300 font-medium">
                          {physicalEvals.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-black italic">
                                No physical diagnostic records logged by academy coaches.
                              </td>
                            </tr>
                          ) : (
                            physicalEvals.map(evalObj => (
                              <tr key={evalObj.id} className="hover:bg-neutral-100">
                                <td className="px-3 py-2.5 font-bold text-black">{evalObj.skillName}</td>
                                <td className="px-3 py-2.5 text-black">{evalObj.beltLevel}</td>
                                <td className="px-3 py-2.5 font-mono text-[#EF2F38] font-black">{evalObj.score || 0} pts</td>
                                <td className="px-3 py-2.5">
                                  <span className="font-mono font-black text-black bg-neutral-200 border border-neutral-300 px-1.5 py-0.5 rounded">
                                    {evalObj.grade}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-black">{evalObj.evaluatedAt || evalObj.updatedAt?.split('T')[0] || '—'}</td>
                                <td className="px-3 py-2.5 text-black italic truncate max-w-[200px]" title={evalObj.remarks || 'No notes'}>
                                  {evalObj.remarks || 'Cleared'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Tournament Competitions & Medals Shelf */}
                    <div className="mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        <span>TOURNAMENT COMPETITIONS & HONOURS CABINET</span>
                      </h4>
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-neutral-200 text-neutral-900 font-bold uppercase tracking-wider">
                            <th className="px-3 py-2 rounded-l-[8px]">Tournament Event</th>
                            <th className="px-3 py-2">Discipline Category</th>
                            <th className="px-3 py-2">Division Weight Group</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Medal Placement</th>
                            <th className="px-3 py-2 rounded-r-[8px]">Performance Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-300 font-medium">
                          {achievements.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-black italic">
                                No tournament entries or medal placements registered in profile.
                              </td>
                            </tr>
                          ) : (
                            achievements.map(ach => (
                              <tr key={ach.id} className="hover:bg-neutral-100">
                                <td className="px-3 py-2.5 font-bold text-black">{ach.eventName}</td>
                                <td className="px-3 py-2.5 text-black">{ach.category}</td>
                                <td className="px-3 py-2.5 text-black">
                                  <div className="flex flex-col gap-0.5">
                                    <span>{ach.division}</span>
                                    {((ach.ageDivision && ach.ageDivision !== 'No Age Requirement') || (ach.beltDivision && ach.beltDivision !== 'No Belt Requirement')) && (
                                      <span className="text-[8px] text-neutral-500 font-normal">
                                        {[
                                          ach.ageDivision !== 'No Age Requirement' && ach.ageDivision,
                                          ach.beltDivision !== 'No Belt Requirement' && ach.beltDivision
                                        ].filter(Boolean).join(' • ')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-black">{ach.date}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                    ach.medalRank === 'Gold' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                    ach.medalRank === 'Silver' ? 'bg-slate-100 text-slate-900 border-slate-300' :
                                    ach.medalRank === 'Bronze' ? 'bg-orange-100 text-orange-900 border-orange-300' :
                                    'bg-neutral-100 text-black border-neutral-300'
                                  }`}>
                                    {ach.medalRank}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-black italic truncate max-w-[150px]" title={ach.notes || '—'}>
                                  {ach.notes || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Administrative chronicle progress comments & notes */}
                    <div className="mb-6">
                      <h4 className="text-[9px] font-black uppercase text-[#EF2F38] tracking-widest mb-2.5 pb-1 border-b border-neutral-300 flex items-center gap-1.5">
                        <Notebook className="w-3.5 h-3.5" />
                        <span>ADMINISTRATIVE PROGRESS REMARKS & NOTES</span>
                      </h4>
                      <div className="bg-neutral-100 border border-neutral-300 p-4 rounded-[8px] text-[9px] leading-relaxed text-black min-h-[80px]">
                        {student.notes ? (
                          <p className="font-medium whitespace-pre-line">{student.notes}</p>
                        ) : (
                          <p className="text-black italic">No specific administrative chronicle remarks or progression comments logged for this student dossier period.</p>
                        )}
                      </div>
                    </div>

                    {/* Signatures & Seal Box */}
                    <div className="border-t border-neutral-300 pt-8 mt-auto">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        {/* Column 1: Student / Guardian */}
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-12 border-b border-neutral-300 flex items-center justify-center relative">
                            {student.esignPath ? (
                              <img src={student.esignPath} alt="Digital Esign" crossOrigin="anonymous" className="h-10 object-contain max-w-[100px] mix-blend-multiply" />
                            ) : (
                              <span className="font-mono text-[7px] text-neutral-500 italic">No Signature</span>
                            )}
                          </div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-700 tracking-wider mt-1.5">Student / Guardian</span>
                          <span className="block text-[5px] text-neutral-700 font-mono">Signature / Date Signed</span>
                        </div>

                        {/* Column 2: Registrar Department */}
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-12 border-b border-neutral-300 flex items-center justify-center">
                            {student.esignPath && (
                              <span className="font-mono text-[7px] text-emerald-900 font-bold tracking-widest border border-emerald-300 bg-emerald-50 px-1 py-0.5 rounded uppercase">VERIFIED</span>
                            )}
                          </div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-700 tracking-wider mt-1.5">Registrar Department</span>
                          <span className="block text-[5px] text-neutral-700 font-mono">Infinity Taekwondo HQ</span>
                        </div>
                        
                        {/* Column 3: Coach Inspector */}
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-12 border-b border-neutral-300" />
                          <span className="block text-[7px] uppercase font-bold text-neutral-700 tracking-wider mt-1.5">Coach Inspector</span>
                          <span className="block text-[5px] text-neutral-700 font-mono">Assigned Dojang Officer</span>
                        </div>

                        {/* Column 4: Head Coach */}
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-12 border-b border-neutral-300 flex items-end justify-center">
                            <span className="font-mono text-[7px] text-neutral-400 font-bold opacity-30 font-mono">INFINITY-SEAL</span>
                          </div>
                          <span className="block text-[7px] uppercase font-bold text-neutral-700 tracking-wider mt-1.5">Head Coach</span>
                          <span className="block text-[5px] text-neutral-700 font-mono">Academy Leadership</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Page 3 Footer */}
                  <div className="border-t border-neutral-300 pt-3 flex justify-between items-center text-[7px] text-black font-mono uppercase tracking-wider">
                    <span>© {currentYear} Infinity Taekwondo Academy.</span>
                    <span>Page 3 of 3</span>
                    <span className="font-bold text-[#EF2F38]">Verification Code: {student.id.substring(0, 8)}-P3</span>
                  </div>
                </div>
              </div>

            </div>
            
          </div>

        </div>
      </div>
    </Portal>
  );
}
