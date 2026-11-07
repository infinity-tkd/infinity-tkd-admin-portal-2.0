'use client';
import { TelegramContactField } from '@/components/ContactActions';
import React from 'react';
import { useAppStore } from '@/lib/store';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { SafeImage } from '@/components/SafeImage';
import { CAMBODIA_LOCATIONS } from '@/components/DataLists';
import { useT } from '@/hooks/useTranslation';
import type { ClassEnrollment } from '@/lib/store';


interface StudentProfileEditorProps {
  t: ReturnType<typeof useT>;
  editForm: any;
  setEditForm: React.Dispatch<any>;
  state: ReturnType<typeof useAppStore>['state'];
  primaryEnrollment: ClassEnrollment;
  setShowSaveConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  isSavingProfile: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

export function StudentProfileEditor({ t, editForm, setEditForm, state, primaryEnrollment, setShowSaveConfirm, isSavingProfile, setIsEditing }: StudentProfileEditorProps) {
  return <>{(
              <div className="space-y-4">
                {/* 1. Demographics & Identity */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <User className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">1. Demographics &amp; Identity</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_english_name')} *</label>
                      <input
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.englishName || ''}
                        onChange={e => setEditForm({...editForm, englishName: e.target.value})}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_khmer_name')}</label>
                      <input
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-khmer"
                        value={editForm.khmerName || ''}
                        onChange={e => setEditForm({...editForm, khmerName: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_gender')}</label>
                      <select
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.gender || 'Male'}
                        onChange={e => setEditForm({...editForm, gender: e.target.value as 'Male' | 'Female'})}
                      >
                        <option value="Male">{t('stu_male')}</option>
                        <option value="Female">{t('stu_female')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_dob')}</label>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]"
                        value={editForm.dob || ''}
                        onChange={e => setEditForm({...editForm, dob: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_nationality')}</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.nationality || ''}
                        onChange={e => setEditForm({...editForm, nationality: e.target.value})}
                        placeholder="e.g. Cambodian"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_profile_pic_link')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] flex-1"
                          value={editForm.profilePicturePath || ''}
                          onChange={e => setEditForm({...editForm, profilePicturePath: e.target.value})}
                          placeholder={t('panel_profile_pic_placeholder')}
                        />
                        {editForm.profilePicturePath && (
                          <SafeImage
                            src={editForm.profilePicturePath}
                            alt="Preview"
                            containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0"
                            fallback={<User className="w-4 h-4 text-neutral-400" />}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Contact Details & Emergency Dossier */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <IdentificationCard className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">2. Contact &amp; Family Dossier</h3>
                  </div>
                  <TelegramContactField id="edit-student-telegram" value={editForm.telegramUsername || ''} onChange={telegramUsername => setEditForm({...editForm, telegramUsername})} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_phone')}</label>
                      <input
                        type="tel"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-mono"
                        value={editForm.phone || ''}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        placeholder="+855 ..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_email')}</label>
                      <input
                        type="email"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.email || ''}
                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                        placeholder="student@example.com"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-neutral-200 dark:border-[#262626]">
                      <p className="text-[10px] text-[#EF2F38] uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                        <ShieldWarning className="w-3.5 h-3.5" />
                        <span>{t('panel_guardian_emergency')}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_contact')}</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.emergencyContactName || ''}
                        onChange={e => setEditForm({...editForm, emergencyContactName: e.target.value})}
                        placeholder="Guardian full name"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_phone')}</label>
                      <input
                        type="tel"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38] font-mono"
                        value={editForm.emergencyContactPhone || ''}
                        onChange={e => setEditForm({...editForm, emergencyContactPhone: e.target.value})}
                        placeholder="+855 ..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_emergency_relation')}</label>
                      <select
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                        value={editForm.emergencyContactRelation || ''}
                        onChange={e => setEditForm({...editForm, emergencyContactRelation: e.target.value})}
                      >
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
                </div>

                {/* 3. Structured Home Address */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <MapPin className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">3. Residential Address</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_street_address')}</label>
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                          value={editForm.address?.line1 || ''}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, line1: e.target.value }})}
                          placeholder="Street address..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_apt_suite')}</label>
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]"
                          value={editForm.address?.line2 || ''}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, line2: e.target.value }})}
                          placeholder="Apartment, unit, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_state_province')}</label>
                        {editForm.address?.stateProvince && !CAMBODIA_LOCATIONS[editForm.address.stateProvince] ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                              value={editForm.address.stateProvince === 'Other Custom' ? '' : editForm.address.stateProvince}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, stateProvince: e.target.value }})}
                              placeholder={t('panel_custom_address')}
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, stateProvince: '', city: '' }})}
                              className="px-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-[10px] text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <select
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.stateProvince || ''}
                            onChange={e => {
                              const newProv = e.target.value;
                              if (newProv === 'Other') {
                                setEditForm({ ...editForm, address: { ...editForm.address, stateProvince: 'Other Custom', city: '' } });
                              } else {
                                const dists = CAMBODIA_LOCATIONS[newProv] || [];
                                setEditForm({ ...editForm, address: { ...editForm.address, stateProvince: newProv, city: dists[0] || '' } });
                              }
                            }}
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
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_district_commune')}</label>
                        {editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince] && (editForm.address.city === 'Other Custom' || (editForm.address.city !== '' && !CAMBODIA_LOCATIONS[editForm.address.stateProvince].includes(editForm.address.city))) ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                              value={editForm.address.city === 'Other Custom' ? '' : editForm.address.city}
                              onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                              placeholder={t('panel_custom_district')}
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, address: { ...editForm.address, city: CAMBODIA_LOCATIONS[editForm.address.stateProvince][0] || '' }})}
                              className="px-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#262626] dark:hover:bg-[#333] text-[10px] text-neutral-700 dark:text-white rounded-[8px] font-bold uppercase transition-colors shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (editForm.address?.stateProvince && CAMBODIA_LOCATIONS[editForm.address.stateProvince]) ? (
                          <select
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.city || ''}
                            onChange={e => {
                              if (e.target.value === 'Other') {
                                setEditForm({ ...editForm, address: { ...editForm.address, city: 'Other Custom' } });
                              } else {
                                setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }});
                              }
                            }}
                          >
                            <option value="">{t('panel_select_district')}</option>
                            {CAMBODIA_LOCATIONS[editForm.address.stateProvince].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                            <option value="Other">{t('panel_relation_other')}</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.address?.city || ''}
                            onChange={e => setEditForm({...editForm, address: { ...editForm.address, city: e.target.value }})}
                            placeholder={t('panel_custom_district')}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_postal_code')}</label>
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={editForm.address?.postalCode || ''}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, postalCode: e.target.value }})}
                          placeholder="e.g. 12000"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_country')}</label>
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                          value={editForm.address?.country || 'Cambodia'}
                          onChange={e => setEditForm({...editForm, address: { ...editForm.address, country: e.target.value }})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Academy & Membership */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <GraduationCap className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">4. Academy Status &amp; Schedules</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_branch')}</label>
                      <select
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                        value={editForm.homeBranchId || 1}
                        onChange={e => setEditForm({...editForm, homeBranchId: Number(e.target.value)})}
                      >
                        {state.branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_scholarship')}</label>
                      <select
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                        value={editForm.scholarshipId || 1}
                        onChange={e => setEditForm({...editForm, scholarshipId: Number(e.target.value)})}
                      >
                        {state.scholarships.map(s => (
                          <option key={s.id} value={s.id}>{s.typeName} ({s.discountPercentage}%)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_status')}</label>
                      <select
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                        value={editForm.studentStatus || 'Active'}
                        onChange={e => setEditForm({...editForm, studentStatus: e.target.value as any})}
                      >
                        <option value="Active">{t('act_active')}</option>
                        <option value="Paused">Paused (Hold)</option>
                        <option value="Inactive">{t('act_inactive')}</option>
                        <option value="Suspended">{t('act_suspended')}</option>
                        <option value="Graduated">{t('act_graduated')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_kukkiwon_card')}</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                        value={editForm.kukkiwonId || ''}
                        onChange={e => setEditForm({...editForm, kukkiwonId: e.target.value})}
                        placeholder="e.g. 05123456 or GDrive Link"
                      />
                    </div>

                    {(editForm.studentStatus === 'Paused' || editForm.studentStatus === 'Inactive' || editForm.studentStatus === 'Suspended') && (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-[#1A1A1A] rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">Status Reason / Note</label>
                          <input
                            type="text"
                            placeholder="e.g. Medical leave, Exam break, Vacation"
                            className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#EF2F38]"
                            value={editForm.statusReason || ''}
                            onChange={e => setEditForm({...editForm, statusReason: e.target.value})}
                          />
                        </div>
                        {editForm.studentStatus === 'Paused' && (
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">Expected Return Date</label>
                            <input
                              type="date"
                              className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]"
                              value={editForm.pauseEndDate || ''}
                              onChange={e => setEditForm({...editForm, pauseEndDate: e.target.value})}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_reg_date_academy')}</label>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark]"
                        value={editForm.registrationDate || ''}
                        onChange={e => setEditForm({...editForm, registrationDate: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_class_enroll_date')}</label>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-50"
                        value={editForm.classEnrollmentDate || ''}
                        onChange={e => setEditForm({...editForm, classEnrollmentDate: e.target.value})}
                        disabled={!primaryEnrollment}
                      />
                      {!primaryEnrollment && (
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-medium">{t('panel_class_enroll_date_hint')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Health Bio & Admin Notes */}
                <div className="bg-neutral-50/50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-4 md:p-5 rounded-[8px] space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
                    <Heart className="w-4 h-4 text-[#EF2F38]" />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">5. Health Bio &amp; Administrative Notes</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_height')} (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                        value={editForm.heightCm || ''}
                        onChange={e => setEditForm({...editForm, heightCm: Number(e.target.value)})}
                        placeholder="e.g. 150"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_weight')} (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                        value={editForm.weightKg || ''}
                        onChange={e => setEditForm({...editForm, weightKg: Number(e.target.value)})}
                        placeholder="e.g. 45"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_medical_notes')}</label>
                      <textarea
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none"
                        value={editForm.medicalNotes || ''}
                        onChange={e => setEditForm({...editForm, medicalNotes: e.target.value})}
                        placeholder="Any health or physical conditions..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('stu_allergies')}</label>
                      <textarea
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none"
                        value={editForm.allergies || ''}
                        onChange={e => setEditForm({...editForm, allergies: e.target.value})}
                        placeholder="Known allergies or dietary restrictions..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 mb-1">{t('panel_migration_notes')}</label>
                      <textarea
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] h-20 resize-none"
                        value={editForm.notes || ''}
                        onChange={e => setEditForm({...editForm, notes: e.target.value})}
                        placeholder={t('panel_migration_placeholder')}
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky Action Bar */}
                <div className="pt-2 sticky bottom-0 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-sm pb-2 z-10 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(true)}
                    disabled={isSavingProfile}
                    className="flex-1 py-2.5 min-h-[44px] bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-all shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    {isSavingProfile ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t('act_saving')}</span>
                      </>
                    ) : (
                      t('act_save')
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSavingProfile}
                    className="flex-1 py-2.5 min-h-[44px] bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-white font-bold uppercase tracking-wider text-xs rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    {t('act_cancel')}
                  </button>
                </div>
              </div>
            )}</>;
}
