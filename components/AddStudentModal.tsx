'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Check, Users } from '@phosphor-icons/react';
import { cn, sanitizeStringInput, isValidEmail, isValidPhone, isValidDate } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { CAMBODIA_LOCATIONS } from './DataLists';
import { SafeImage } from '@/components/SafeImage';
import { useT } from '@/hooks/useTranslation';

const CLASS_STYLES: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  'Private Class': {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/20',
    accent: 'border-amber-500 dark:border-amber-500'
  },
  'Kid Class': {
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    text: 'text-sky-800 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-500/20',
    accent: 'border-sky-500 dark:border-sky-500'
  },
  'General Class': {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-800 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    accent: 'border-emerald-500 dark:border-emerald-500'
  },
  'Elite Team': {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-800 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    accent: 'border-[#EF2F38] dark:border-[#EF2F38]'
  }
};

export function AddStudentModal({ onClose }: { onClose: () => void }) {
  const { addStudent, state } = useAppStore();
  const t = useT();
  const [form, setForm] = useState({
    englishName: '', khmerName: '', gender: 'Male', dob: '', 
    phone: '', email: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '', medicalNotes: '', allergies: '',
    studentStatus: 'Active',
    homeBranchId: 1, currentBelt: 'White', scholarshipId: 1, heightCm: 0, weightKg: 0,
    profilePicturePath: '', nationality: '', kukkiwonId: '',
    addressLine1: '', addressLine2: '', city: '', stateProvince: '', postalCode: '', country: 'Cambodia',
    classId: '',
    registrationDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Sanitize all string fields to prevent XSS / malicious scripts
    const englishName = sanitizeStringInput(form.englishName);
    const khmerName = sanitizeStringInput(form.khmerName);
    const dob = sanitizeStringInput(form.dob);
    const phone = sanitizeStringInput(form.phone);
    const email = sanitizeStringInput(form.email);
    const emergencyContactName = sanitizeStringInput(form.emergencyContactName);
    const emergencyContactPhone = sanitizeStringInput(form.emergencyContactPhone);
    const emergencyContactRelation = sanitizeStringInput(form.emergencyContactRelation);
    const medicalNotes = sanitizeStringInput(form.medicalNotes);
    const allergies = sanitizeStringInput(form.allergies);
    const currentBelt = sanitizeStringInput(form.currentBelt);
    const studentStatus = sanitizeStringInput(form.studentStatus);
    const nationality = sanitizeStringInput(form.nationality);
    const registrationDate = sanitizeStringInput(form.registrationDate);
    const notes = sanitizeStringInput(form.notes);

    // 2. Validate mandatory attributes
    if (!englishName || !khmerName || !dob) {
      setError(t('panel_err_name_dob_required'));
      return;
    }

    // 3. Date check
    if (!isValidDate(dob)) {
      setError(t('panel_err_invalid_dob'));
      return;
    }

    // 4. Student phone check
    if (phone && !isValidPhone(phone)) {
      setError(t('panel_err_invalid_student_phone'));
      return;
    }

    // 5. Student email check
    if (email && !isValidEmail(email)) {
      setError(t('panel_err_invalid_student_email'));
      return;
    }

    // 6. Guardian phone check
    if (emergencyContactPhone && !isValidPhone(emergencyContactPhone)) {
      setError(t('panel_err_invalid_guardian_phone'));
      return;
    }

    setError('');
    const result = await addStudent({
      ...form,
      englishName,
      khmerName,
      dob,
      phone,
      email,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      medicalNotes,
      allergies,
      currentBelt,
      studentStatus,
      address: {
        line1: sanitizeStringInput(form.addressLine1),
        line2: sanitizeStringInput(form.addressLine2),
        city: sanitizeStringInput(form.city),
        stateProvince: sanitizeStringInput(form.stateProvince),
        postalCode: sanitizeStringInput(form.postalCode),
        country: sanitizeStringInput(form.country)
      },
      nationality,
      homeBranchId: form.homeBranchId, 
      scholarshipId: form.scholarshipId, 
      heightCm: form.heightCm, 
      weightKg: form.weightKg,
      profilePicturePath: form.profilePicturePath ? sanitizeStringInput(form.profilePicturePath) : undefined,
      initialClassId: form.classId ? parseInt(form.classId) : undefined,
      registrationDate,
      notes
    } as any);

    if (result && !result.success) {
      const errMsg = typeof result.error === 'string'
        ? result.error
        : ((result.error as any)?.message || t('panel_err_failed_provision'));
      setError(errMsg);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <Portal>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="w-full max-w-sm bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-6 flex flex-col items-center text-center text-neutral-900 dark:text-white"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 dark:bg-green-500/20 text-emerald-600 dark:text-green-500 flex items-center justify-center mb-4 border border-emerald-500/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{t('usr_provision_account')}</h2>
            <p className="text-xs text-neutral-600 dark:text-[#999] mb-6">
              {t('usr_provision_success_desc').replace('{name}', form.englishName)}
            </p>
            <button 
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-[#262626] dark:hover:bg-[#333] rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation shadow-xs"
            >
              {t('act_close')}
            </button>
          </motion.div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-sm animate-in fade-in sm:overflow-y-auto">
         <div className="w-full max-w-2xl bg-white dark:bg-[#0F0F0F] sm:border border-neutral-200 dark:border-[#262626] sm:rounded-[8px] shadow-2xl flex flex-col sm:my-8 max-h-full sm:max-h-[90dvh] absolute sm:relative inset-0 sm:inset-auto overflow-hidden text-neutral-900 dark:text-white">
            <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] z-10 shrink-0">
             <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_add_student')}</h2>
             <button type="button" onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white"><X className="w-5 h-5"/></button>
          </div>
          <form onSubmit={submit} className="p-6 space-y-6 overflow-y-auto flex-1 bg-white dark:bg-[#0A0A0A]">
             {error && (
               <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-[8px] text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-widest text-center">
                 {error}
               </div>
             )}
             
             <div className="space-y-4">
                <h3 className="text-[10px] text-red-500 uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2">{t('usr_account_details')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_english_name')} *</label>
                    <input className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.englishName} onChange={(e) => setForm({...form, englishName: e.target.value})} placeholder={t('panel_english_name_placeholder')} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_khmer_name')} *</label>
                    <input className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 font-khmer" value={form.khmerName} onChange={(e) => setForm({...form, khmerName: e.target.value})} placeholder="កែវ មុនី" />
                  </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_gender')}</label>
                    <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value as 'Male' | 'Female'})}>
                      <option value="Male">{t('stu_male')}</option>
                      <option value="Female">{t('stu_female')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_nationality')}</label>
                    <input list="nationalities" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.nationality} onChange={(e) => setForm({...form, nationality: e.target.value})} placeholder={t('panel_nationality_placeholder')} />
                  </div>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_dob')} *</label>
                      <input type="date" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 [color-scheme:light] dark:[color-scheme:dark]" value={form.dob} onChange={(e) => setForm({...form, dob: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">Registration Date</label>
                      <input type="date" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 [color-scheme:light] dark:[color-scheme:dark]" value={form.registrationDate} onChange={(e) => setForm({...form, registrationDate: e.target.value})} />
                    </div>
                  </div>
                 <div>
                   <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_profile_pic_link')}</label>
                   <div className="flex gap-4 items-center">
                     <input className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 flex-1" value={form.profilePicturePath} onChange={(e) => setForm({...form, profilePicturePath: e.target.value})} placeholder={t('panel_profile_pic_placeholder')} />
                     {form.profilePicturePath && (
                       <div className="flex flex-col items-center shrink-0">
                         <SafeImage 
                           src={form.profilePicturePath} 
                           alt="Preview" 
                           containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] overflow-hidden flex items-center justify-center shadow-md dark:shadow-black/40"
                           fallback={<span className="text-[8px] text-red-500 uppercase font-black tracking-tighter bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded">Err / Private</span>}
                         />
                       </div>
                     )}
                   </div>
                 </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-neutral-200 dark:border-[#262626]">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 dark:text-[#666]">{t('usr_system_access')}</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_phone')}</label>
                    <input type="tel" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                       value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} placeholder="012 345 678" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_email')}</label>
                    <input type="email" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                       value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} placeholder="student@example.com" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-neutral-200 dark:border-[#262626]">
                <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 dark:text-[#666]">{t('stf_home_address') || 'Home Address'}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_address_line_1')} *</label>
                    <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                       value={form.addressLine1} onChange={e => setForm({...form, addressLine1: e.target.value})} placeholder={t('panel_address_line_1_placeholder')} required />
                  </div>
                  <div>
                     <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_address_line_2_opt')}</label>
                     <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                        value={form.addressLine2} onChange={e => setForm({...form, addressLine2: e.target.value})} placeholder={t('panel_address_line_2_placeholder')} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_state_province')} *</label>
                       {form.stateProvince && !CAMBODIA_LOCATIONS[form.stateProvince] ? (
                         <div className="flex gap-2">
                           <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                             value={form.stateProvince === 'Other Custom' ? '' : form.stateProvince}
                             onChange={e => setForm({...form, stateProvince: e.target.value})}
                             placeholder={t('panel_custom_address')}
                             required
                           />
                           <button type="button" onClick={() => setForm({...form, stateProvince: '', city: ''})} className="px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-xs text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0">{t('panel_address_list')}</button>
                         </div>
                       ) : (
                         <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                           value={form.stateProvince}
                           onChange={e => {
                             const newProv = e.target.value;
                             if (newProv === 'Other') {
                               setForm({ ...form, stateProvince: 'Other Custom', city: '' });
                             } else {
                               const dists = CAMBODIA_LOCATIONS[newProv] || [];
                               setForm({ ...form, stateProvince: newProv, city: dists[0] || '' });
                             }
                           }}
                           required
                         >
                           <option value="">{t('panel_select_province')}</option>
                           {Object.keys(CAMBODIA_LOCATIONS).map(p => (
                             <option key={p} value={p}>{p}</option>
                           ))}
                           <option value="Other">{t('panel_relation_other')}</option>
                         </select>
                       )}
                     </div>
                     <div>
                       <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_district_commune')} *</label>
                       {form.stateProvince && CAMBODIA_LOCATIONS[form.stateProvince] && (form.city === 'Other Custom' || (form.city !== '' && !CAMBODIA_LOCATIONS[form.stateProvince].includes(form.city))) ? (
                         <div className="flex gap-2">
                           <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                             value={form.city === 'Other Custom' ? '' : form.city}
                             onChange={e => setForm({...form, city: e.target.value})}
                             placeholder={t('panel_custom_district')}
                             required
                           />
                           <button type="button" onClick={() => setForm({...form, city: CAMBODIA_LOCATIONS[form.stateProvince][0] || ''})} className="px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-xs text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0">{t('panel_address_list')}</button>
                         </div>
                       ) : form.stateProvince && CAMBODIA_LOCATIONS[form.stateProvince] ? (
                         <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                           value={form.city}
                           onChange={e => {
                             if (e.target.value === 'Other') {
                               setForm({ ...form, city: 'Other Custom' });
                             } else {
                               setForm({...form, city: e.target.value});
                             }
                           }}
                           required
                         >
                           <option value="">{t('panel_select_district')}</option>
                           {CAMBODIA_LOCATIONS[form.stateProvince].map(d => (
                             <option key={d} value={d}>{d}</option>
                           ))}
                           <option value="Other">{t('panel_relation_other')}</option>
                         </select>
                       ) : (
                         <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                           value={form.city}
                           onChange={e => setForm({...form, city: e.target.value})}
                           placeholder={t('panel_custom_district')}
                           required
                         />
                       )}
                     </div>
                   </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_postal_code')}</label>
                      <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={form.postalCode} onChange={e => setForm({...form, postalCode: e.target.value})} placeholder="e.g. 12000" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_country')}</label>
                      <input list="countries" type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={form.country} onChange={e => setForm({...form, country: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
 
              <div className="space-y-4 pt-6 border-t border-neutral-200 dark:border-[#262626]">
                 <h3 className="text-[10px] text-red-500 uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2">{t('stu_emergency_contact')}</h3>
                 <div>
                   <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_emergency_contact')}</label>
                   <input className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.emergencyContactName} onChange={(e) => setForm({...form, emergencyContactName: e.target.value})} placeholder={t('panel_emergency_contact_placeholder')} />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_emergency_phone')}</label>
                     <input className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.emergencyContactPhone} onChange={(e) => setForm({...form, emergencyContactPhone: e.target.value})} placeholder="+855 ..." />
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_emergency_relation')}</label>
                     <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" value={form.emergencyContactRelation} onChange={(e) => setForm({...form, emergencyContactRelation: e.target.value})}>
                        <option value="">{t('panel_emergency_relation_placeholder')}</option>
                        <option value="Father">{t('panel_relation_father')}</option>
                        <option value="Mother">{t('panel_relation_mother')}</option>
                        <option value="Grandparent">{t('panel_relation_grandparent')}</option>
                        <option value="Sibling">{t('panel_relation_sibling')}</option>
                        <option value="Uncle/Aunt">{t('panel_relation_uncle_aunt')}</option>
                        <option value="Other">{t('panel_relation_other')}</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_medical_notes')}</label>
                   <textarea className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 resize-none h-16" value={form.medicalNotes} onChange={(e) => setForm({...form, medicalNotes: e.target.value})} placeholder={t('panel_emergency_medical_notes_placeholder')} />
                 </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_allergies')}</label>
                    <textarea className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 resize-none h-16" 
                       value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} placeholder={t('panel_emergency_allergies_placeholder')} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">Migration & Administration Notes</label>
                    <textarea className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 resize-none h-16" 
                       value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder={t('panel_migration_placeholder')} />
                  </div>
                </div>
 
                <div className="space-y-4 pt-6 border-t border-neutral-200 dark:border-[#262626]">
                   <h3 className="text-[10px] text-red-500 uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2">{t('usr_role_snapshot')}</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_branch')}</label>
                        <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                           value={form.homeBranchId} onChange={e => setForm({...form, homeBranchId: Number(e.target.value), classId: ''})}>
                           {state.branches.map(b => (
                             <option key={b.id} value={b.id}>{b.name}</option>
                           ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_belt')}</label>
                        <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                           value={form.currentBelt} onChange={e => setForm({...form, currentBelt: e.target.value})}>
                           <option value="White">White</option>
                           <option value="Yellow">Yellow</option>
                           <option value="Green">Green</option>
                           <option value="Blue">Blue</option>
                           <option value="Brown">Brown</option>
                           <option value="Red">Red</option>
                           <option value="1st Poom/Dan">1st Poom/Dan</option>
                           <option value="2nd Poom/Dan">2nd Poom/Dan</option>
                           <option value="3rd Poom/Dan">3rd Poom/Dan</option>
                           <option value="4th Poom/Dan">4th Poom/Dan</option>
                        </select>
                      </div>
                   </div>

                   {/* Visual Class Session selector */}
                   <div className="space-y-2">
                     <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('nav_schedule')} / class enrollment</label>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                       <div 
                         onClick={() => setForm({...form, classId: ''})}
                         className={cn(
                           "cursor-pointer p-3 rounded-[8px] border transition-all duration-200 flex flex-col justify-between h-[80px]",
                           form.classId === '' 
                             ? "bg-neutral-900 dark:bg-white border-neutral-950 dark:border-white text-white dark:text-black shadow-sm" 
                             : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-800"
                         )}
                       >
                         <div className="flex items-center justify-between">
                           <span className="text-[8px] font-black uppercase tracking-wider">Default</span>
                           {form.classId === '' && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>}
                         </div>
                         <div>
                           <p className="text-xs font-bold">{t('panel_assign_later')}</p>
                         </div>
                       </div>

                       {state.classSessions.filter(c => c.branchId === form.homeBranchId).map(c => {
                         const isSelected = form.classId === c.id.toString();
                         const enrolledCount = state.classEnrollments.filter(e => e.classId === c.id && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
                         const capacityPct = c.capacity > 0 ? Math.min(100, Math.round((enrolledCount / c.capacity) * 100)) : 0;
                         const isFull = enrolledCount >= c.capacity;
                         const style = CLASS_STYLES[c.classType || 'General Class'] || CLASS_STYLES['General Class'];
                         
                         return (
                           <div 
                             key={c.id}
                             onClick={() => setForm({...form, classId: c.id.toString()})}
                             className={cn(
                               "cursor-pointer p-3 rounded-[8px] border transition-all duration-200 flex flex-col justify-between h-[80px]",
                               isSelected 
                                 ? "bg-neutral-900 dark:bg-white border-neutral-950 dark:border-white text-white dark:text-black shadow-sm" 
                                 : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-800"
                             )}
                           >
                             <div className="flex items-center justify-between gap-1">
                               <span className={cn(
                                 "px-1.5 py-0.5 rounded-[8px] text-[7px] font-black uppercase tracking-wider border",
                                 isSelected ? "bg-white/10 border-white/20 text-white dark:bg-neutral-100 dark:border-neutral-200 dark:text-neutral-800" : `${style.bg} ${style.border} ${style.text}`
                               )}>
                                 {c.classType}
                               </span>
                               
                               <div className="flex items-center gap-1.5 shrink-0">
                                 {isFull && (
                                   <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-1 py-0.5 rounded-[8px] text-[7px] font-black tracking-wider leading-none">FULL</span>
                                 )}
                                 {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>}
                               </div>
                             </div>

                             <div className="mt-1">
                               <p className="text-xs font-black truncate">{c.name}</p>
                               <p className="text-[9px] opacity-75 font-mono truncate">
                                 {c.daysOfWeek?.join(', ') || c.dayOfWeek} • {c.startTime} - {c.endTime}
                               </p>
                             </div>

                             <div className="w-full bg-neutral-200 dark:bg-[#262626] rounded-full h-1 overflow-hidden mt-1 relative">
                               <div className={cn(
                                 "h-full rounded-full transition-all duration-300",
                                 isSelected 
                                   ? "bg-emerald-500" 
                                   : capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                )} style={{ width: `${capacityPct}%` }} />
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_scholarship')}</label>
                      <select className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={form.scholarshipId} onChange={e => setForm({...form, scholarshipId: Number(e.target.value)})}>
                         {state.scholarships.map(s => (
                           <option key={s.id} value={s.id}>{s.typeName} ({s.discountPercentage}%)</option>
                         ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_height')}</label>
                      <input type="number" step="0.1" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={form.heightCm || ''} onChange={e => setForm({...form, heightCm: Number(e.target.value)})} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_weight')}</label>
                      <input type="number" step="0.1" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={form.weightKg || ''} onChange={e => setForm({...form, weightKg: Number(e.target.value)})} placeholder="0" />
                    </div>
                    {(form.currentBelt.includes('Poom') || form.currentBelt.includes('Dan')) && (
                      <div>
                        <label className="block text-[10px] uppercase font-bold mb-1 transition-colors text-red-500">
                          {t('panel_kukkiwon_global_id')}
                        </label>
                        <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 font-mono" 
                           value={(form as any).kukkiwonId || ''} onChange={e => setForm({...form, kukkiwonId: e.target.value})} placeholder={t('panel_kukkiwon_placeholder')} />
                      </div>
                    )}
                  </div>
                </div>
             </form>
             <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 shrink-0">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation">{t('act_cancel')}</button>
                <button type="button" onClick={submit} className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation shadow-md shadow-red-500/20">{t('usr_provision_account')}</button>
             </div>
            </div>
         </div>
      </Portal>
  );
}
