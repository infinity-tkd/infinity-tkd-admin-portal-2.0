'use client';
import { TuitionReceiptCard } from './TuitionReceiptCard';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { tuitionReceiptRecord } from '@/lib/tuition-receipt';
import { dialogMotion } from '@/lib/motion';
import React, { useState } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { PaintBrush } from '@phosphor-icons/react/dist/csr/PaintBrush';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf';
import { Image } from '@phosphor-icons/react/dist/csr/Image';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';

export interface TuitionReceiptSelection { student: Student; month: string; year: number; amount: number }
export function TuitionReceiptDialogs({ receipt: showReceipt, onClose }: {receipt:TuitionReceiptSelection|null;onClose:()=>void}) {
  const {state,showNotification}=useAppStore();
  const setShowReceipt=()=>onClose();
  const savedPayment=showReceipt?state.payments.find(payment=>payment.studentId===showReceipt.student.id&&payment.year===showReceipt.year&&payment.month===showReceipt.month):undefined;
  const currentStudent=showReceipt?(state.students.find(student=>student.id===showReceipt.student.id)??showReceipt.student):null;
  const receiptModel=showReceipt&&currentStudent?tuitionReceiptRecord(currentStudent,showReceipt.year+'-'+String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(showReceipt.month)+1).padStart(2,'0'),savedPayment,state.scholarships.find(row=>row.id===currentStudent.scholarshipId),state.classEnrollments,state.academyProfile):null;
  const receiptPaymentMethod=receiptModel?.method??'No cash collection';
  const receiptReferenceNumber=receiptModel?.reference??'PREVIEW-UNPAID';
  // Custom E-Receipt Customization States
  const [receiptAccentColor, setReceiptAccentColor] = useState<string>('#3B82F6'); // default: ABA Blue
  const [receiptShowLogo, setReceiptShowLogo] = useState<boolean>(true);
  const [receiptShowWatermark, setReceiptShowWatermark] = useState<boolean>(true);
  const [receiptCustomNotes, setReceiptCustomNotes] = useState<string>('');
  const [receiptFullscreen, setReceiptFullscreen] = useState<boolean>(false);

  React.useEffect(() => { setReceiptCustomNotes(''); }, [showReceipt]);

  const dialog=useRef<HTMLDivElement>(null),fullDialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,onClose,Boolean(showReceipt&&!receiptFullscreen));
  useModalFocus(fullDialog,()=>setReceiptFullscreen(false),Boolean(showReceipt&&receiptFullscreen));

  const handleSaveToAdmin = () => {
    showNotification('Payments are saved when recorded. This receipt is a view of the saved ledger.', 'info');
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
      if(!printWindow){showNotification('Allow pop-ups to open the receipt print preview.','warning');return;}

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

  const renderReceiptCard=(printId:string)=>showReceipt&&receiptModel?<TuitionReceiptCard printId={printId} receipt={showReceipt} model={receiptModel} branchName={state.branches.find(b=>b.id===showReceipt.student.homeBranchId)?.name??'Central Dojang'} accent={receiptAccentColor} showLogo={receiptShowLogo} showWatermark={receiptShowWatermark} notes={receiptCustomNotes}/>:null;

return <>
      {/* Premium E-Invoice / Receipt Designer Modal */}
      <AnimatePresence>
        {showReceipt && (
          <Portal>
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4">
              <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Tuition receipt preview" tabIndex={-1}
                {...dialogMotion}
                className="w-full max-w-5xl bg-[#0A0A0A] border border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[95dvh] md:max-h-[90dvh] h-full relative font-sans"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-[#262626] bg-[#0F0F0F] flex justify-between items-center z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-500" weight="fill" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-[#E4E4E4]">Interactive E-Receipt Designer</span>
                      <p className="text-[9px] text-[#666] font-mono mt-0.5">Preview recorded collections and clearly labelled unpaid drafts</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowReceipt()} 
                    aria-label="Close interactive receipt designer"
                    className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#666] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  >
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
                      <p className="text-[9px] text-[#666] font-mono leading-relaxed">Customize the appearance of this saved ledger summary.</p>
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
                        disabled
                        value={receiptPaymentMethod}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-[8px] px-3 py-2 text-xs text-[#E4E4E4] focus:outline-none focus:border-[#444]"
                      >
                        <option value={receiptPaymentMethod}>{receiptPaymentMethod}</option>
                      </select>
                    </div>

                    {/* Reference ID Input */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase font-bold text-[#888] tracking-wider">Transaction Reference ID</label>
                      <input 
                        type="text" 
                        readOnly
                        value={receiptReferenceNumber}
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
                        <span className="text-[10px] text-[#BBB]">Show collection status watermark</span>
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
                      onClick={() => setShowReceipt()} 
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-[#CCC] hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      Close Panel
                    </button>

                    <button 
                      onClick={handleSaveToAdmin}
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-green-500/20 text-[#10B981] hover:text-green-400 font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      Ledger information
                    </button>

                    <button 
                      onClick={handleSaveAsImage}
                      className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-[#1A1A1A] hover:bg-[#262626] border border-blue-500/20 text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <Image aria-label="Save image" alt="Save image" className="w-3.5 h-3.5" /> Save as Image
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
            <div ref={fullDialog} role="dialog" aria-modal="true" aria-label="Fullscreen tuition receipt" tabIndex={-1} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-200 font-sans">

              {/* Fullscreen Floating Top Header Bar */}
              <div className="w-full max-w-[500px] bg-[#141414]/80 backdrop-blur-md border border-[#262626] rounded-[8px] p-3 flex items-center justify-between shadow-2xl shrink-0 z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">Fullscreen Inspect Mode</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setReceiptFullscreen(false)}
                  aria-label="Exit Inspect Mode"
                  className="min-h-[44px] px-4 py-2 bg-[#262626] hover:bg-[#333] text-white hover:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
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
                  <Image aria-label="Save image" alt="Save image" className="w-3.5 h-3.5" /> Save Image
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
</>;
}
