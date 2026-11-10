'use client';
import type { User as PortalUser } from '@/lib/store';
import { ContactActions } from '@/components/ContactActions';
import { generatePassword } from '@/lib/passwords';
import React from 'react';
import { useAppStore } from '@/lib/store';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Envelope } from '@phosphor-icons/react/dist/csr/Envelope';
import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { Calendar } from '@phosphor-icons/react/dist/csr/Calendar';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { Certificate } from '@phosphor-icons/react/dist/csr/Certificate';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { GenderMale } from '@phosphor-icons/react/dist/csr/GenderMale';
import { GenderFemale } from '@phosphor-icons/react/dist/csr/GenderFemale';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Pencil } from '@phosphor-icons/react/dist/csr/Pencil';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { FileText } from '@phosphor-icons/react/dist/csr/FileText';
import { cn, formatBeltLocalized } from '@/lib/utils';
import { RankingOptOutToggle } from './RankingOptOutToggle';

import { supabase } from '@/lib/supabase';
import { studentPasswordResetUrl } from '@/lib/student-portal-url';
import { useT } from '@/hooks/useTranslation';
import type { Student } from '@/lib/store';

const studentResetUrl = studentPasswordResetUrl();

interface StudentProfileOverviewProps {
  canDeleteStudent: boolean;
  isMinor: boolean;
  t: ReturnType<typeof useT>;
  calculateAge: () => number;
  attendanceRate: number | null;
  totalClasses: number;
  attendedClasses: number;
  student: Student;
  beltPromotionsCount: number;
  achievementsCount: number;
  totalCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  activeEnrollmentsCount: number;
  handleCopy: (text: string, label: string) => void;
  copiedField: string | null;
  getAgeDivision: () => string;
  state: ReturnType<typeof useAppStore>['state'];
  canEdit: boolean;
  setShowScheduleManager: React.Dispatch<React.SetStateAction<boolean>>;
  showScheduleManager: boolean;
  getConflictsForClass: (targetClassId: number) => string[];
  unenrollStudent: (studentId: string, classId: number) => Promise<{ success: boolean; error?: string; }>;
  enrollStudent: (studentId: string, classId: number) => Promise<{ success: boolean; error?: string; }>;
  updateUser: (id: string, data: Partial<PortalUser> & { password?: string; }) => Promise<void>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  setNewPassword: React.Dispatch<React.SetStateAction<string>>;
  setShowPasswordModal: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirm: (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => void;
  setProvisionUsername: React.Dispatch<React.SetStateAction<string>>;
  setProvisionEmail: React.Dispatch<React.SetStateAction<string>>;
  setProvisionPassword: React.Dispatch<React.SetStateAction<string>>;
  setShowProvisionModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDossierModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
}

export function StudentProfileOverview({ canDeleteStudent, isMinor, t, calculateAge, attendanceRate, totalClasses, attendedClasses, student, beltPromotionsCount, achievementsCount, totalCount, goldCount, silverCount, bronzeCount, activeEnrollmentsCount, handleCopy, copiedField, getAgeDivision, state, canEdit, setShowScheduleManager, showScheduleManager, getConflictsForClass, unenrollStudent, enrollStudent, updateUser, showNotification, setNewPassword, setShowPasswordModal, showConfirm, setProvisionUsername, setProvisionEmail, setProvisionPassword, setShowProvisionModal, setShowDossierModal, setIsEditing, setShowDeleteConfirm }: StudentProfileOverviewProps) {
  const { can } = useAppStore();
  const canManageAccounts = can('action:staff_manage');
  const canManageSchedule = can('action:schedule_manage');
  return <>{(
              <div className="space-y-6">
                {isMinor && (
                  <div className="bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-[8px] p-4 flex gap-3 items-start shadow-sm">
                    <ShieldWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">{t('panel_minor_alert')}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium">
                        {t('panel_minor_desc').replace('{age}', String(calculateAge()))}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4-Metric Quick Dashboard Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('nav_attendance')}</span>
                      <Calendar className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {totalClasses > 0 ? t('panel_classes_count').replace('{attended}', String(attendedClasses)).replace('{total}', String(totalClasses)) : t('panel_no_logs')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_belt')}</span>
                      <Certificate className="w-4 h-4 text-[#EF2F38]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {formatBeltLocalized(student.currentBelt, student.dob, t)}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {beltPromotionsCount > 0 ? t('panel_promotions_count').replace('{count}', String(beltPromotionsCount)) : t('panel_white_belt_level')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_medals_label')}</span>
                      <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {achievementsCount}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {totalCount > 0 ? `${goldCount}G • ${silverCount}S • ${bronzeCount}B` : t('panel_tournament_awards')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('nav_schedule')}</span>
                      <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                        {activeEnrollmentsCount}
                      </p>
                      <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                        {t('panel_enrolled_sessions')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Structured Student Profile Cards */}
                <div className="space-y-4">
                  {/* Card 1: Demographics & Identity */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#EF2F38]" />
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          1. {t('panel_tab_profile')} {t('panel_overview')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(student.id, 'Student ID')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-400 text-[10px] font-mono font-bold transition-colors cursor-pointer border border-neutral-200 dark:border-[#333]"
                        title="Copy Student ID"
                      >
                        {copiedField === 'Student ID' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{student.id}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_english_name')}</p>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{student.englishName}</p>
                      </div>
                      <div className="space-y-0.5 font-khmer">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider font-sans">{t('stu_khmer_name')}</p>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{student.khmerName || '—'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_dob')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-mono font-bold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{student.dob || '—'}</span>
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-normal">
                            ({calculateAge()} yrs, {getAgeDivision()})
                          </span>
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_nationality')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{student.nationality || 'Cambodian'}</span>
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_gender')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold flex items-center gap-1.5">
                          {student.gender === 'Male' ? (
                            <>
                              <GenderMale className="w-3.5 h-3.5 text-blue-500 font-bold" />
                              <span>{t('stu_male')}</span>
                            </>
                          ) : (
                            <>
                              <GenderFemale className="w-3.5 h-3.5 text-pink-500 font-bold" />
                              <span>{t('stu_female')}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_reg_date')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-mono font-bold">{student.registrationDate || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <ContactActions contact={student} name={student.englishName} />
                  {/* Card 2: Contact & Family Dossier */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <IdentificationCard className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        2. {t('panel_contacts_dossier')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_phone')}</p>
                          {student.phone ? (
                            <a href={`tel:${student.phone}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5 truncate">
                              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>{student.phone}</span>
                            </a>
                          ) : (
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                          )}
                        </div>
                        {student.phone && (
                          <button
                            type="button"
                            onClick={() => handleCopy(student.phone!, 'Student Phone')}
                            className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                            title="Copy Phone"
                          >
                            {copiedField === 'Student Phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_email')}</p>
                          {student.email ? (
                            <a href={`mailto:${student.email}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5 truncate" title={student.email}>
                              <Envelope className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">{student.email}</span>
                            </a>
                          ) : (
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                          )}
                        </div>
                        {student.email && (
                          <button
                            type="button"
                            onClick={() => handleCopy(student.email!, 'Student Email')}
                            className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                            title="Copy Email"
                          >
                            {copiedField === 'Student Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Guardian Contact */}
                    <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_guardian_contact')}</span>
                        <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold uppercase tracking-wider px-2 py-0.5 rounded-[8px] flex items-center gap-1">
                          <ShieldWarning className="w-3 h-3" /> {t('stu_emergency_contact')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_guardian_name')}</p>
                          <p className="text-xs text-neutral-900 dark:text-white font-bold mt-0.5">{student.emergencyContactName || '—'}</p>
                          {student.emergencyContactRelation && (
                            <span className="inline-block mt-1 text-[9px] bg-neutral-100 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[8px] border border-neutral-200 dark:border-[#333]">
                              {student.emergencyContactRelation}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_guardian_phone')}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            {student.emergencyContactPhone ? (
                              <a href={`tel:${student.emergencyContactPhone}`} className="text-xs font-mono font-bold text-neutral-900 dark:text-white hover:text-[#EF2F38] transition-colors flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{student.emergencyContactPhone}</span>
                              </a>
                            ) : (
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">—</p>
                            )}
                            {student.emergencyContactPhone && (
                              <button
                                type="button"
                                onClick={() => handleCopy(student.emergencyContactPhone!, 'Guardian Phone')}
                                className="p-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700 transition-colors shrink-0 cursor-pointer"
                                title="Copy Guardian Phone"
                              >
                                {copiedField === 'Guardian Phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Residential Address */}
                    <div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{t('stf_home_address')}</span>
                      </p>
                      {student.address?.line1 ? (
                        <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px] text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                          <p className="font-bold text-neutral-900 dark:text-white">{student.address.line1}</p>
                          {student.address.line2 && <p className="text-neutral-500 dark:text-neutral-400">{student.address.line2}</p>}
                          <p>{student.address.city}{student.address.stateProvince ? `, ${student.address.stateProvince}` : ''} {student.address.postalCode}</p>
                          <p className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 mt-1 pt-1 border-t border-neutral-100 dark:border-[#262626]">{student.address.country || 'Cambodia'}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{t('panel_address_not_provided')}</p>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Physical & Health Bio */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <Heart className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        3. {t('panel_medical_bio')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_height')}</p>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">{student.heightCm ? `${student.heightCm} cm` : '—'}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_weight')}</p>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">{student.weightKg ? `${student.weightKg} kg` : '—'}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-center">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_bmi')}</p>
                        {(() => {
                          const heightM = student.heightCm ? student.heightCm / 100 : 0;
                          const bmiVal = (heightM > 0 && student.weightKg) ? Number((student.weightKg / (heightM * heightM)).toFixed(1)) : null;
                          if (!bmiVal) return <p className="text-sm text-neutral-400 dark:text-neutral-500 italic mt-1">—</p>;

                          const getBmiInfo = (val: number) => {
                            if (val < 18.5) return { label: 'Underweight', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' };
                            if (val < 25) return { label: 'Normal', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
                            if (val < 30) return { label: 'Overweight', color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20' };
                            return { label: 'Obese', color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' };
                          };
                          const info = getBmiInfo(bmiVal);
                          return (
                            <div className="mt-1 flex flex-col items-center gap-1">
                              <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white">{bmiVal}</p>
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", info.color)}>
                                {info.label}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38]"></span>
                          <span>{t('stu_medical_notes')}</span>
                        </p>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                          {student.medicalNotes || <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_medical')}</span>}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>{t('stu_allergies')}</span>
                        </p>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                          {student.allergies || <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_allergies')}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Academy Status & Schedules */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <GraduationCap className="w-4 h-4 text-[#EF2F38]" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        4. {t('panel_status_schedules')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_branch')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold">
                          {state.branches.find(b => b.id === student.homeBranchId)?.name || t('stu_unassigned_branch')}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_scholarship')}</p>
                        <p className="text-xs text-neutral-900 dark:text-white font-bold">
                          {(() => {
                            const sch = state.scholarships.find(s => s.id === student.scholarshipId);
                            if (!sch || sch.typeName === 'None') return t('panel_none');
                            return `${sch.typeName} (${sch.discountPercentage}%)`;
                          })()}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('stu_status')}</p>
                        <div>
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border inline-block",
                            student.studentStatus === 'Active' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                            student.studentStatus === 'Paused' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                            student.studentStatus === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700" :
                            student.studentStatus === 'Suspended' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                            "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          )}>
                            {student.studentStatus}
                          </span>
                        </div>
                        {student.statusReason && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            {student.statusReason} {student.pauseEndDate && `(Until ${student.pauseEndDate})`}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-2 md:col-span-3 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-1.5">{t('panel_kukkiwon_card')}</p>
                        {student.kukkiwonId ? (
                          student.kukkiwonId.startsWith('http://') || student.kukkiwonId.startsWith('https://') || student.kukkiwonId.includes('drive.google.com') ? (
                            <a
                              href={student.kukkiwonId}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#EF2F38]/10 hover:bg-[#EF2F38]/20 border border-[#EF2F38]/20 text-[#EF2F38] text-xs font-bold transition-colors"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>{t('panel_open_gdrive_cert')}</span>
                              <ArrowSquareOut className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                            </a>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626]">
                              <span className="w-2 h-2 rounded-full bg-[#EF2F38]"></span>
                              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">{student.kukkiwonId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(student.kukkiwonId!, 'Kukkiwon ID')}
                                className="p-1 hover:text-[#EF2F38] text-neutral-400 transition-colors cursor-pointer"
                                title="Copy ID"
                              >
                                {copiedField === 'Kukkiwon ID' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )
                        ) : (student.currentBelt.includes('Poom') || student.currentBelt.includes('Dan')) ? (
                          <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider inline-block">{t('panel_missing_id')}</span>
                        ) : (
                          <span className="text-[9px] bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-400 dark:text-neutral-500 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider inline-block">{t('panel_not_applicable')}</span>
                        )}
                      </div>
                    </div>

                    {/* Class Schedules & Manager */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-[#262626] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_active_schedule_coach')}</p>
                        {canManageSchedule && (
                          <button
                            type="button"
                            onClick={() => setShowScheduleManager(!showScheduleManager)}
                            className="text-[10px] font-bold uppercase tracking-wider text-[#EF2F38] hover:opacity-80 cursor-pointer"
                          >
                            {showScheduleManager ? t('panel_close_manager') : t('panel_manage_schedules')}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {state.classEnrollments.filter(e => e.studentId === student.id).length > 0 ? (
                          state.classEnrollments.filter(e => e.studentId === student.id).map(e => {
                            const cls = state.classSessions.find(c => c.id === e.classId);
                            if (!cls) return null;
                            const coach = state.users.find(u => u.id === cls.coachId);
                            const coachName = coach ? coach.displayName : t('act_tba');

                            return (
                              <div key={e.id} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#1A1A1A] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF2F38] shrink-0"></span>
                                  <span className="font-bold text-neutral-900 dark:text-white">{cls.name}</span>
                                  <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                                    ({cls.daysOfWeek?.join(', ') || cls.dayOfWeek} • {cls.startTime} - {cls.endTime})
                                  </span>
                                  {e.enrollmentDate && (
                                    <span className="text-[9px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#333]">
                                      {t('sch_enrolled')}: {e.enrollmentDate.split('T')[0]}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-bold">{t('panel_coach_label')}</span>
                                  <span className="text-[10px] font-bold text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[8px] border border-red-500/10">{coachName}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 italic flex items-center gap-1.5 py-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{t('panel_no_enrolled_classes')}</span>
                          </p>
                        )}
                      </div>

                      {showScheduleManager && canManageSchedule && (
                        <div className="mt-3 p-4 bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-3">
                          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Class Enrollment Manager</span>
                            <span className="text-[9px] font-mono text-neutral-400">Branch Classes</span>
                          </div>

                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                            {state.classSessions.filter(c => c.branchId === student.homeBranchId).length === 0 ? (
                              <p className="text-xs text-neutral-400 italic text-center py-4">No class sessions scheduled for this student&apos;s branch.</p>
                            ) : (
                              state.classSessions.filter(c => c.branchId === student.homeBranchId).map(c => {
                                const isEnrolled = state.classEnrollments.some(e => e.studentId === student.id && e.classId === c.id);
                                const enrolledCount = state.classEnrollments.filter(e => e.classId === c.id && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
                                const isFull = enrolledCount >= c.capacity;
                                const capacityPct = c.capacity > 0 ? Math.min(100, Math.round((enrolledCount / c.capacity) * 100)) : 0;
                                const conflicts = getConflictsForClass(c.id);

                                return (
                                  <div
                                    key={c.id}
                                    className={cn(
                                      "p-3 rounded-[8px] border text-xs flex flex-col justify-between gap-2.5 bg-neutral-50 dark:bg-[#141414] transition-all",
                                      isEnrolled
                                        ? "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-500/5 shadow-sm"
                                        : conflicts.length > 0
                                          ? "border-red-500/20 bg-red-500/5"
                                          : "border-neutral-200 dark:border-[#262626]"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-neutral-900 dark:text-white">{c.name}</span>
                                          <span className={cn(
                                            "px-1.5 py-0.5 rounded-[8px] text-[9px] font-bold uppercase tracking-wider border",
                                            c.classType === 'Elite Team' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                            c.classType === 'Kid Class' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' :
                                            c.classType === 'Private Class' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                          )}>
                                            {c.classType}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                                          {c.daysOfWeek?.join(', ') || c.dayOfWeek} • {c.startTime} - {c.endTime}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isFull && !isEnrolled}
                                        onClick={async () => {
                                          if (isEnrolled) {
                                            await unenrollStudent(student.id, c.id);
                                          } else {
                                            await enrollStudent(student.id, c.id);
                                          }
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 rounded-[8px] text-[9px] font-bold uppercase tracking-wider transition-all select-none border disabled:opacity-40 cursor-pointer",
                                          isEnrolled
                                            ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                                            : "bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-[#EF2F38] hover:text-white border-transparent"
                                        )}
                                      >
                                        {isEnrolled ? 'Remove' : 'Enroll'}
                                      </button>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                                        <span>Occupancy: {enrolledCount} / {c.capacity}</span>
                                        <span>{capacityPct}%</span>
                                      </div>
                                      <div className="w-full bg-neutral-200 dark:bg-[#262626] rounded-full h-1 overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all duration-300",
                                            capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                          )}
                                          style={{ width: `${capacityPct}%` }}
                                        />
                                      </div>
                                    </div>

                                    {conflicts.length > 0 && !isEnrolled && (
                                      <div className="flex flex-col gap-1">
                                        {conflicts.map((conf, idx) => (
                                          <div key={idx} className="flex items-center gap-1 text-[9px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-[8px] font-medium">
                                            <WarningCircle className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{t('panel_schedule_overlap').replace('{conf}', conf)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 5: Portal Access & Security */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                    {(() => {
                      const studentAccount = state.users.find(u =>
                        (student.profileId && u.id === student.profileId) ||
                        (u.studentId && u.studentId === student.id) ||
                        (u.email && u.email.toLowerCase() === student.email?.toLowerCase()) ||
                        u.username === student.id.toLowerCase().replace(/-/g, '_')
                      );

                      if (studentAccount) {
                        const isLinkedToId = studentAccount.studentId === student.id || student.profileId === studentAccount.id;
                        return (
                          <>
                            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-[#EF2F38]" />
                                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_portal_access')}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border flex items-center gap-1",
                                  isLinkedToId
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                )}>
                                  <ShieldCheck className="w-3 h-3" />
                                  {isLinkedToId ? "Linked (Student ID)" : "Email Matched"}
                                </span>
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider border",
                                  studentAccount.isActive
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                )}>
                                  {studentAccount.isActive ? t('act_active') : t('act_blocked')}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_username_id')}</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-neutral-800 dark:text-white font-mono text-xs flex items-center justify-between">
                                  <span className="truncate">@{studentAccount.username}</span>
                                  <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 font-mono shrink-0 ml-1">[{student.id}]</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">Account Email</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-neutral-700 dark:text-neutral-300 font-mono text-xs truncate" title={studentAccount.email}>
                                  {studentAccount.email}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold tracking-wider">{t('panel_system_role')}</p>
                                <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-[#EF2F38] font-mono text-xs font-bold">
                                  {studentAccount.role === 'Admin' ? t('role_admin') :
                                   studentAccount.role === 'Head Coach' ? t('role_head_coach') :
                                   studentAccount.role === 'Coach' ? t('role_coach') :
                                   studentAccount.role === 'Assistant Coach' ? t('role_assistant_coach') :
                                   studentAccount.role === 'Student' ? t('role_student') :
                                   studentAccount.role === 'Root' || studentAccount.role === 'Super Root' ? t('role_root') :
                                   studentAccount.role}
                                </div>
                              </div>
                            </div>

                            {canManageAccounts && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={studentAccount.isActive}
                                    onChange={async (e) => {
                                      try {
                                        await updateUser(studentAccount.id, { isActive: e.target.checked });
                                        showNotification(`Student portal access ${e.target.checked ? 'activated' : 'deactivated'}.`, 'success');
                                      } catch (err: any) {
                                        showNotification(err.message || 'Failed to toggle portal access', 'error');
                                      }
                                    }}
                                    className="w-4 h-4 bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded text-[#EF2F38] focus:ring-[#EF2F38] cursor-pointer"
                                  />
                                  <span className="text-xs text-neutral-700 dark:text-neutral-300 uppercase font-bold tracking-wider">{t('panel_enable_portal')}</span>
                                </label>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewPassword('');
                                      setShowPasswordModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-[#EF2F38]/10 hover:bg-[#EF2F38]/20 border border-[#EF2F38]/30 text-[#EF2F38] text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Set / Change Password</span>
                                  </button>
                                  {/* The reset email goes to the sign-in address and opens the student portal's reset page; hidden until that portal's address is configured. */}
                                  {studentAccount.email && studentResetUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const accountEmail = studentAccount.email;
                                        showConfirm(t('panel_send_reset').replace('{name}', student.englishName).replace('{email}', accountEmail), async () => {
                                          const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, {
                                            redirectTo: studentResetUrl
                                          });
                                          if (error) {
                                            showNotification(t('panel_reset_failed').replace('{error}', error.message), 'error');
                                          } else {
                                            showNotification(t('panel_reset_success').replace('{email}', accountEmail), 'success');
                                          }
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all cursor-pointer"
                                    >
                                      {t('panel_reset_password')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      } else {
                        return (
                          <>
                            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-[#EF2F38]" />
                                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_portal_access')}</h3>
                              </div>
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-[8px] font-bold uppercase tracking-wider">{t('panel_no_account')}</span>
                            </div>
                            <div className="text-center py-3 space-y-3">
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md mx-auto">
                                Student has no active Portal account. Provisioning will allow the student to log in using their Student ID (<span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{student.id}</span>).
                              </p>
                              {canManageAccounts && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProvisionUsername(student.id.toLowerCase().replace(/-/g, '_'));
                                    setProvisionEmail(student.email || `${student.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@portal.infinitytkd.com`);
                                    setProvisionPassword(generatePassword());
                                    setShowProvisionModal(true);
                                  }}
                                  className="px-4 py-2 bg-[#EF2F38] hover:bg-[#EF2F38]/90 text-white text-[10px] font-bold uppercase tracking-wider rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 inline-flex items-center gap-2 cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>{t('panel_btn_provision_portal')}</span>
                                </button>
                              )}
                            </div>
                          </>
                        );
                      }
                    })()}
                  </div>

                  <RankingOptOutToggle student={student} />

                  {/* Card 6: Administrative Notes */}
                  <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3">
                    <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{t('panel_migration_notes')}</h3>
                    </div>
                    <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                      {student.notes ? (
                        <p className="whitespace-pre-wrap">{student.notes}</p>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500 italic">{t('panel_no_admin_notes')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="pt-4 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDossierModal(true)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black py-2.5 px-4 min-h-[44px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                  >
                    <IdentificationCard className="w-4 h-4 shrink-0" />
                    <span>{t('panel_tab_profile') === 'ប្រវត្តិរូប' ? 'ទាញយកប្រវត្តិរូបសិស្ស' : t('panel_tab_profile') === '个人资料' ? '下载学生档案' : 'Download Student Dossier'}</span>
                  </button>

                  {(canEdit || canDeleteStudent) && (
                    <div className="flex flex-1 gap-2">
                      {canEdit && (<button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-800 dark:text-white py-2.5 px-4 min-h-[44px] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all border border-neutral-200 dark:border-[#262626] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t('panel_edit_student_profile')}</span>
                      </button>)}

                      {canDeleteStudent && (<button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2.5 min-h-[44px] bg-red-500/10 hover:bg-[#EF2F38] text-[#EF2F38] hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-wider transition-all border border-red-500/20 hover:border-[#EF2F38] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>{t('act_delete')}</span>
                      </button>)}
                    </div>
                  )}
                </div>
              </div>
            )}</>;
}
