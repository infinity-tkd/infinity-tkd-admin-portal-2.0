'use client';
import { useAttendanceAudio } from '@/hooks/use-attendance-audio';
import { dialogMotion } from '@/lib/motion';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Barcode } from '@phosphor-icons/react/dist/csr/Barcode';
import { QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { formatBelt } from '@/lib/utils';
import { SafeImage } from '@/components/SafeImage';


interface AttendanceKioskDialogProps {
  setKioskSound: React.Dispatch<React.SetStateAction<boolean>>;
  kioskSound: boolean;
  setIsKioskOpen: React.Dispatch<React.SetStateAction<boolean>>;
  kioskBarcode: string;
  state: ReturnType<typeof useAppStore>['state'];
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  setKioskBarcode: React.Dispatch<React.SetStateAction<string>>;
  kioskInputRef: React.RefObject<HTMLInputElement | null>;
  markAttendance: (studentId: string, date: string, status: "Present" | "Absent" | "Late", classId?: number) => Promise<void>;
  selectedDate: string;
  filterClass: number | "all";
  setKioskRecentScans: React.Dispatch<React.SetStateAction<{ student: Student; time: string; status: string; }[]>>;
  kioskRecentScans: { student: Student; time: string; status: string; }[];
}

export function AttendanceKioskDialog({ setKioskSound, kioskSound, setIsKioskOpen, kioskBarcode, state, showNotification, setKioskBarcode, kioskInputRef, markAttendance, selectedDate, filterClass, setKioskRecentScans, kioskRecentScans }: AttendanceKioskDialogProps) {
  const playBeep = useAttendanceAudio();
  return <>{(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <motion.div
              {...dialogMotion}
              className="w-full max-w-lg max-h-[92dvh] bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white"
            >
              <div className="p-4 bg-emerald-600 text-white flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-white/20 flex items-center justify-center shrink-0">
                    <Barcode className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest leading-none">Instant Kiosk Check-In</h3>
                    <p className="text-[10px] text-white/80 font-mono mt-0.5">Scan Barcode / QR or type Student ID</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKioskSound(!kioskSound)}
                    title={kioskSound ? "Sound chime enabled (Click to mute)" : "Sound chime muted (Click to unmute)"}
                    className="p-1.5 hover:bg-emerald-700 rounded-[6px] transition-colors cursor-pointer text-white/90"
                  >
                    {kioskSound ? <SpeakerHigh className="w-4 h-4" /> : <SpeakerSlash className="w-4 h-4 text-emerald-200" />}
                  </button>
                  <button
                    onClick={() => setIsKioskOpen(false)}
                    className="p-1.5 hover:bg-emerald-700 rounded-[6px] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const query = kioskBarcode.trim().toUpperCase();
                    if (!query) return;

                    const student = state.students.find(s =>
                      s.id.toUpperCase() === query ||
                      s.englishName.toUpperCase().includes(query) ||
                      (s.khmerName && s.khmerName.toUpperCase().includes(query))
                    );

                    if (!student) {
                      if (kioskSound) playBeep('error');
                      showNotification(`Student ID/Barcode "${query}" not found!`, 'error');
                      setKioskBarcode('');
                      kioskInputRef.current?.focus();
                      return;
                    }

                    try {
                      await markAttendance(student.id, selectedDate, 'Present', filterClass === 'all' ? undefined : filterClass);
                      if (kioskSound) playBeep('success');
                      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setKioskRecentScans(prev => [{ student, time: nowTime, status: 'Present' }, ...prev.slice(0, 3)]);
                      setKioskBarcode('');
                      showNotification(`✅ Checked in ${student.englishName} (${student.id})!`, 'success');
                      kioskInputRef.current?.focus();
                    } catch (err: any) {
                      console.error(err);
                      if (kioskSound) playBeep('error');
                      showNotification(`Failed check-in: ${err.message || err}`, 'error');
                      kioskInputRef.current?.focus();
                    }
                  }}
                  className="space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-[#AAA]">
                    <span>Barcode / Student ID Scanner</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Ready for input
                    </span>
                  </div>
                  <div className="relative">
                    <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <input
                      ref={kioskInputRef}
                      type="text"
                      autoFocus
                      placeholder="e.g. STU-001 or scan membership card..."
                      value={kioskBarcode}
                      onChange={(e) => setKioskBarcode(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] text-sm font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                    💡 Tip: USB & Bluetooth hardware scanners trigger automatic Enter key submission.
                  </p>
                </form>

                {/* Recent Scanned Students Feed */}
                {kioskRecentScans.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-wider font-bold">
                      Recent Check-Ins ({kioskRecentScans.length})
                    </p>

                    {/* Latest primary scan card */}
                    {kioskRecentScans[0] && (
                      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-[8px] p-4 flex items-center gap-3.5 shadow-sm animate-in zoom-in-95 duration-200">
                        <SafeImage
                          src={kioskRecentScans[0].student.profilePicturePath}
                          alt={kioskRecentScans[0].student.englishName}
                          containerClassName="w-13 h-13 rounded-[8px] overflow-hidden border border-emerald-500/40 shrink-0"
                          fallback={<span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{kioskRecentScans[0].student.englishName.charAt(0)}</span>}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                            <h4 className="text-sm font-black text-neutral-900 dark:text-white truncate">
                              {kioskRecentScans[0].student.englishName}
                            </h4>
                          </div>
                          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5 truncate">
                            ID: {kioskRecentScans[0].student.id} • Belt: {formatBelt(kioskRecentScans[0].student.currentBelt, kioskRecentScans[0].student.dob)}
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-[4px]">
                            ✓ Checked In at {kioskRecentScans[0].time}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Secondary previous scans */}
                    {kioskRecentScans.slice(1).map((scan, idx) => (
                      <div key={`${scan.student.id}-${idx}`} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] px-3 py-2 flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-center gap-2 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="font-bold text-neutral-900 dark:text-white truncate">{scan.student.englishName}</span>
                          <span className="text-[10px] font-mono text-neutral-500 dark:text-[#888]">({scan.student.id})</span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 dark:text-[#888] shrink-0">{scan.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] flex justify-between items-center shrink-0">
                <span className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                  {kioskSound ? "🔊 Sound Enabled" : "🔇 Sound Muted"}
                </span>
                <button
                  onClick={() => setIsKioskOpen(false)}
                  className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-white rounded-[8px] text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Close Kiosk
                </button>
              </div>
            </motion.div>
          </div>
        )}</>;
}
