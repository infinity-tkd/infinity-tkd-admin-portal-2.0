'use client';

import React, { useState } from 'react';
import { useAppStore, Role } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin } from '@phosphor-icons/react';
import { Portal } from '@/components/Portal';
import { sanitizeStringInput, isValidEmail, isValidPhone, isValidDate, checkPasswordStrength } from '@/lib/utils';
import { CAMBODIA_LOCATIONS } from './DataLists';
import { SafeImage } from '@/components/SafeImage';
import { useT } from '@/hooks/useTranslation';

interface AddStaffModalProps {
  onClose: () => void;
}

export function AddStaffModal({ onClose }: AddStaffModalProps) {
  const { addUser } = useAppStore();
  const t = useT();
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    role: 'Coach' as Role,
    isActive: true,
    password: '',
    khmerName: '',
    englishName: '',
    gender: 'Male' as 'Male' | 'Female',
    dob: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    medicalNotes: '',
    allergies: '',
    profilePicturePath: '',
    nationality: '',
    addressLine1: '', addressLine2: '', city: '', stateProvince: '', postalCode: '', country: 'Cambodia'
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // 1. Sanitize all string fields to prevent script tags / XSS injections
    const username = sanitizeStringInput(form.username);
    const email = sanitizeStringInput(form.email);
    const displayName = sanitizeStringInput(form.displayName);
    const password = sanitizeStringInput(form.password);
    const khmerName = sanitizeStringInput(form.khmerName);
    const englishName = sanitizeStringInput(form.englishName);
    const dob = sanitizeStringInput(form.dob);
    const phone = sanitizeStringInput(form.phone);
    const emergencyContactName = sanitizeStringInput(form.emergencyContactName);
    const emergencyContactPhone = sanitizeStringInput(form.emergencyContactPhone);
    const emergencyContactRelation = sanitizeStringInput(form.emergencyContactRelation);
    const medicalNotes = sanitizeStringInput(form.medicalNotes);
    const allergies = sanitizeStringInput(form.allergies);
    const nationality = sanitizeStringInput((form as any).nationality);

    // 2. Validate mandatory credentials
    if (!username || !email || !displayName) {
      setError(t('usr_err_credentials_required'));
      return;
    }

    // 3. Email structure check
    if (!isValidEmail(email)) {
      setError(t('usr_err_invalid_email'));
      return;
    }

    // 4. Double Password & Strength Check
    if (password) {
      if (password !== confirmPassword) {
        setError(t('usr_err_password_mismatch'));
        return;
      }
      const strength = checkPasswordStrength(password);
      if (!strength.isValid) {
        setError(`${t('usr_password_strength')} ${strength.errors.join(' ')}`);
        return;
      }
    }

    // 5. Date check
    if (dob && !isValidDate(dob)) {
      setError(t('panel_err_invalid_dob'));
      return;
    }

    // 6. Phone format checks
    if (phone && !isValidPhone(phone)) {
      setError(t('panel_err_invalid_student_phone'));
      return;
    }
    if (emergencyContactPhone && !isValidPhone(emergencyContactPhone)) {
      setError(t('panel_err_invalid_guardian_phone'));
      return;
    }

    setError('');
    setShowConfirm(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const username = sanitizeStringInput(form.username);
      const email = sanitizeStringInput(form.email);
      const displayName = sanitizeStringInput(form.displayName);
      const password = sanitizeStringInput(form.password);
      const khmerName = sanitizeStringInput(form.khmerName);
      const englishName = sanitizeStringInput(form.englishName);
      const dob = sanitizeStringInput(form.dob);
      const phone = sanitizeStringInput(form.phone);
      const emergencyContactName = sanitizeStringInput(form.emergencyContactName);
      const emergencyContactPhone = sanitizeStringInput(form.emergencyContactPhone);
      const emergencyContactRelation = sanitizeStringInput(form.emergencyContactRelation);
      const medicalNotes = sanitizeStringInput(form.medicalNotes);
      const allergies = sanitizeStringInput(form.allergies);
      const nationality = sanitizeStringInput((form as any).nationality);

      const result = await addUser({
        username,
        email,
        displayName,
        role: form.role,
        isActive: form.isActive,
        password: password || undefined,
        khmerName,
        englishName,
        gender: form.gender,
        dob,
        phone,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        medicalNotes,
        allergies,
        nationality,
        address: {
          line1: sanitizeStringInput((form as any).addressLine1),
          line2: sanitizeStringInput((form as any).addressLine2),
          city: sanitizeStringInput((form as any).city),
          stateProvince: sanitizeStringInput((form as any).stateProvince),
          postalCode: sanitizeStringInput((form as any).postalCode),
          country: sanitizeStringInput((form as any).country || 'Cambodia')
        },
        profilePicturePath: form.profilePicturePath ? sanitizeStringInput(form.profilePicturePath) : undefined
      });

      if (result && !result.success) {
        setError(result.error || t('panel_err_failed_provision'));
        setShowConfirm(false);
        return;
      }

      setShowConfirm(false);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create staff member.');
      setShowConfirm(false);
    } finally {
      setIsSaving(false);
    }
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
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-4 border border-green-500/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{t('usr_provision_account')}</h2>
            <p className="text-xs text-neutral-500 dark:text-[#999] mb-6">
              {t('usr_provision_staff_success_desc').replace('{name}', form.displayName)}
            </p>
            <button 
              onClick={onClose}
              className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-neutral-700 dark:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors"
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col max-h-[90dvh] text-neutral-900 dark:text-white"
        >
          <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414] shrink-0">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('usr_add_account')}</h2>
              <p className="text-[10px] text-neutral-500 dark:text-[#666] mt-0.5">{t('usr_add_account_desc')}</p>
            </div>
            <button onClick={onClose} className="p-1 text-neutral-500 hover:text-[#999] dark:hover:text-white transition-colors">
              <X className="w-5 h-5"/>
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-[#0A0A0A]">
            {error && (
              <div className="col-span-full p-3 bg-red-500/10 border border-red-500/50 rounded-[8px] text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            {/* Column 1: Credentials */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#EF2F38] border-b border-neutral-200 dark:border-[#262626] pb-2">1. {t('usr_account_details')}</h3>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('usr_username')} <span className="text-[#EF2F38]">*</span></label>
                <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  placeholder="e.g. coach_moni"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('usr_display_name')} <span className="text-[#EF2F38]">*</span></label>
                <input type="text" value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  placeholder={t('panel_english_name_placeholder')}
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_email')} <span className="text-[#EF2F38]">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  placeholder="e.g. moni@infinitytkd.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_profile_pic_link')}</label>
                <div className="flex gap-4 items-center">
                  <input type="text" value={form.profilePicturePath} onChange={e => setForm({...form, profilePicturePath: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 flex-1"
                    placeholder={t('panel_profile_pic_placeholder')}
                  />
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
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('usr_password_default_hint')}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('usr_confirm_password')}</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('usr_role')}</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                >
                  <option value="Admin">Admin</option>
                  <option value="Head Coach">Head Coach</option>
                  <option value="Coach">Coach</option>
                  <option value="Assistant Coach">Assistant Coach</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[4px] text-[#EF2F38] focus:ring-[#EF2F38]"
                />
                <label htmlFor="isActive" className="text-xs uppercase font-bold text-neutral-500 dark:text-[#999] tracking-wider">{t('usr_active_on_creation')}</label>
              </div>
            </div>
            
            {/* Column 2: Personal & Emergency info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#EF2F38] border-b border-neutral-200 dark:border-[#262626] pb-2">2. {t('usr_role_snapshot')}</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_khmer_name')}</label>
                  <input type="text" value={form.khmerName} onChange={e => setForm({...form, khmerName: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder="កែវ មុនី"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_english_name')}</label>
                  <input type="text" value={form.englishName} onChange={e => setForm({...form, englishName: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder={t('panel_english_name_placeholder')}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_gender')}</label>
                  <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value as 'Male' | 'Female'})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                  >
                    <option value="Male">{t('stu_male')}</option>
                    <option value="Female">{t('stu_female')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_nationality')}</label>
                  <input list="nationalities" type="text" value={(form as any).nationality || ''} onChange={e => setForm({...form, nationality: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder={t('panel_nationality_placeholder')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_dob')}</label>
                  <input type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_phone')}</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder="+855 ..."
                  />
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-[#262626]">
                <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#EF2F38]">{t('stf_home_address') || 'Home Address'}</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_address_line_1')} *</label>
                    <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                       value={(form as any).addressLine1} onChange={e => setForm({...form, addressLine1: e.target.value})} placeholder={t('panel_address_line_1_placeholder')} required />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_address_line_2_opt')}</label>
                    <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                       value={(form as any).addressLine2} onChange={e => setForm({...form, addressLine2: e.target.value})} placeholder={t('panel_address_line_2_placeholder')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_state_province')} *</label>
                      {form.stateProvince && !CAMBODIA_LOCATIONS[form.stateProvince] ? (
                        <div className="flex gap-2">
                          <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 rounded-[8px] px-3 py-2 text-sm"
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
                          <option value="Other">Other...</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_district_commune')} *</label>
                      {form.stateProvince && CAMBODIA_LOCATIONS[form.stateProvince] && (form.city === 'Other Custom' || (form.city !== '' && !CAMBODIA_LOCATIONS[form.stateProvince].includes(form.city))) ? (
                        <div className="flex gap-2">
                          <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 rounded-[8px] px-3 py-2 text-sm"
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
                          <option value="Other">Other...</option>
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
                         value={(form as any).postalCode} onChange={e => setForm({...form, postalCode: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_country')}</label>
                      <input type="text" className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600" 
                         value={(form as any).country} onChange={e => setForm({...form, country: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#EF2F38] pt-2 border-t border-neutral-200 dark:border-[#262626]">{t('stu_emergency_contact')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_emergency_contact')}</label>
                  <input type="text" value={form.emergencyContactName} onChange={e => setForm({...form, emergencyContactName: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder={t('panel_emergency_contact_placeholder')}
                  />
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
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_emergency_phone')}</label>
                  <input type="tel" value={form.emergencyContactPhone} onChange={e => setForm({...form, emergencyContactPhone: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600"
                    placeholder="+855 ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_medical_notes')}</label>
                  <textarea value={form.medicalNotes} onChange={e => setForm({...form, medicalNotes: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 resize-none h-16"
                    placeholder={t('panel_emergency_medical_notes_placeholder')}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('stu_allergies')}</label>
                  <textarea value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-red-500 dark:focus:border-red-600 focus:ring-1 focus:ring-red-500 dark:focus:ring-red-600 resize-none h-16"
                    placeholder={t('panel_emergency_allergies_placeholder')}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-3 bg-neutral-50 dark:bg-[#0A0A0A] shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-700 dark:text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] dark:hover:bg-[#262626] transition-colors">{t('act_cancel')}</button>
            <button onClick={handleSave} className="px-4 py-2 bg-[#EF2F38] text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] hover:opacity-90 transition-opacity">{t('usr_provision_account')}</button>
          </div>
         </motion.div>
      </div>

      {/* Confirmation Dialog Overlay */}
      <AnimatePresence>
        {showConfirm && (
          <Portal>
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 text-center shadow-2xl flex flex-col items-center text-neutral-900 dark:text-white"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center mb-4 text-[#EF2F38]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white mb-2">{t('usr_staff_confirm_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-[#999] leading-relaxed mb-6">
                  {t('usr_staff_confirm_desc')}
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors disabled:opacity-50"
                  >
                    {t('act_cancel')}
                  </button>
                  <button 
                    type="button"
                    onClick={executeSave}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-opacity flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <span>{t('usr_provision_account')}</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </Portal>
  );
}
