'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Envelope } from '@phosphor-icons/react/dist/csr/Envelope';
import { supabase } from '@/lib/supabase';
import { SafeImage } from '@/components/SafeImage';
import { householdTuitionEntries } from '@/lib/billing';

interface HouseholdGroup {
  id: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  studentIds: string[];
}

export function HouseholdManagementModal({
  isOpen,
  onClose,
  initialStudentId
}: {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
}) {
  const { state, showNotification, refreshData, can } = useAppStore();

  const [households, setHouseholds] = useState<HouseholdGroup[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const api = async (method:string, payload?:any) => {
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again.');
    const response = await fetch('/api/admin/households', {method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:payload ? JSON.stringify(payload) : undefined});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Household could not be saved.');
    return result.data;
  };
  useEffect(() => {
    if (!isOpen) return;
    let active=true;
    api('GET').then(groups => { if(active) { setHouseholds(groups); setSelectedHouseholdId(groups.find((g:HouseholdGroup)=>g.studentIds.includes(initialStudentId || ''))?.id || groups[0]?.id || ''); } }).catch(e=>showNotification(e.message,'error'));
    return () => {active=false;};
  }, [isOpen, initialStudentId, showNotification]);
  const householdSaveKeys=useRef(new Map<string,string>());
  const householdSaving=useRef(false);
  const [savingHousehold,setSavingHousehold]=useState(false);
  const saveHousehold = async (household:Omit<HouseholdGroup,'id'> & {id?:string}) => {
    if(householdSaving.current)throw new Error('A household save is already in progress.');
    householdSaving.current=true;setSavingHousehold(true);
    try {
      const signature=JSON.stringify(household);
      const id=household.id || householdSaveKeys.current.get(signature) || crypto.randomUUID();
      householdSaveKeys.current.set(signature,id);
      const result=await api('POST',{...household,id});
      if(!result?.id)throw new Error('Household save was not confirmed.');
      householdSaveKeys.current.delete(signature);
      const saved={...household,id:result.id} as HouseholdGroup;
      setHouseholds(prev=>[...prev.filter(h=>h.id!==saved.id),saved]);
      return saved;
    }finally {householdSaving.current=false;setSavingHousehold(false);}

  };

  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
  const [newGuardian, setNewGuardian] = useState({
    name: '',
    phone: '',
    email: ''
  });

  const [addStudentId, setAddStudentId] = useState<string>('');

  const activeHousehold = useMemo(() => {
    return households.find(h => h.id === selectedHouseholdId) || null;
  }, [households, selectedHouseholdId]);

  const linkedStudents = useMemo(() => {
    if (!activeHousehold) return [];
    return state.students.filter(s => activeHousehold.studentIds.includes(s.id));
  }, [activeHousehold, state.students]);

  const familyEntries = useMemo(() => householdTuitionEntries(linkedStudents,state.payments,state.scholarships,state.classEnrollments,state.academyProfile), [linkedStudents,state.payments,state.scholarships,state.classEnrollments,state.academyProfile]);
  const familyTotal = familyEntries.reduce((sum,entry)=>sum+entry.amount,0);
  type Review = {householdId:string;guardianName:string;entries:typeof familyEntries;requestKey:string};
  type ReceiptData = {receipt_number:string;guardian_name:string;payment_method:string;external_reference?:string;transactions:{student_id:string;student_name:string;year:number;for_month:string;amount_usd:number;receipt_number:string}[]};
  const [paymentReview,setPaymentReview]=useState<Review|null>(null);
  const [familyReceipt,setFamilyReceipt]=useState<ReceiptData|null>(null);
  const [paymentMethod,setPaymentMethod]=useState('Cash');
  const [paymentReference,setPaymentReference]=useState('');
  const [paymentConfirmed,setPaymentConfirmed]=useState(false);
  const [collecting,setCollecting]=useState(false);
  const collectingRef=useRef(false);
  const retryPayload=useRef<string|null>(null);

  const handleCreateHousehold = async (e:React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await saveHousehold({guardianName:newGuardian.name.trim(),guardianPhone:newGuardian.phone.trim(),guardianEmail:newGuardian.email.trim(),studentIds:initialStudentId ? [initialStudentId] : []});
      setSelectedHouseholdId(created.id); setIsCreatingHousehold(false); setNewGuardian({name:'',phone:'',email:''});
      showNotification('Household saved.','success');
    } catch(e) {showNotification(e instanceof Error ? e.message : 'Save failed.','error');}
  };
  const handleAddSibling = async () => {
    if(!activeHousehold || !addStudentId || activeHousehold.studentIds.includes(addStudentId))return;
    try {await saveHousehold({...activeHousehold,studentIds:[...activeHousehold.studentIds,addStudentId]});setAddStudentId('');}catch(e){showNotification(e instanceof Error ? e.message : 'Save failed.','error');}
  };
  const handleRemoveSibling = async (studentId:string) => {
    if(!activeHousehold)return;
    try {await saveHousehold({...activeHousehold,studentIds:activeHousehold.studentIds.filter(id=>id!==studentId)});}catch(e){showNotification(e instanceof Error ? e.message : 'Save failed.','error');}
  };

  const handleFamilyCheckout = () => {
    if (!activeHousehold || !familyEntries.length || !can('action:finance_record_payment')) return;
    setPaymentReview({householdId:activeHousehold.id,guardianName:activeHousehold.guardianName,entries:familyEntries,requestKey:crypto.randomUUID()});
    setPaymentMethod('Cash');setPaymentReference('');setPaymentConfirmed(false);retryPayload.current=null;
  };
  const collectFamilyPayment = async () => {
    if(!paymentReview || !paymentConfirmed || collectingRef.current)return;
    collectingRef.current=true;setCollecting(true);
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Please sign in again.');
      const payload=retryPayload.current || JSON.stringify({householdId:paymentReview.householdId,requestKey:paymentReview.requestKey,method:paymentMethod,reference:paymentReference.trim(),entries:paymentReview.entries.map(({studentId,year,month,amount})=>({studentId,year,month,amount}))});
      retryPayload.current=payload;
      const response=await fetch('/api/admin/households/payments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:payload});
      const result=await response.json();
      if(!response.ok) { if(response.status<500)retryPayload.current=null; throw new Error(result.error?.message || 'Family collection was not confirmed. Retry the same request.'); }
      if(!result.data?.receipt_number || !Array.isArray(result.data.transactions))throw new Error('Family collection was not confirmed. Retry the same request.');
      setFamilyReceipt(result.data);setPaymentReview(null);retryPayload.current=null;
      showNotification('Family tuition recorded.','success');
      await refreshData();
    } catch(e) {showNotification(e instanceof Error?e.message:'Collection failed. Retry the same request.','error');}
    finally {collectingRef.current=false;setCollecting(false);}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white w-full max-w-4xl rounded-[8px] p-5 font-sans flex flex-col max-h-[90dvh] shadow-2xl overflow-hidden transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EF2F38]/10 border border-[#EF2F38]/30 rounded-[8px] text-[#EF2F38]">
              <House size={20} weight="bold" />
            </div>
            <div>
              <h2 className="text-sm font-black font-mono tracking-wider text-neutral-900 dark:text-white">FAMILY & MULTI-SIBLING HOUSEHOLD PORTAL</h2>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">CONSOLIDATED PARENT LINKAGE & INVOICING</p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer active:scale-95 touch-manipulation transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Layout (Left: Household List, Right: Active Household Details) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 overflow-y-auto pt-4 pr-1 scrollbar-thin">
          
          {/* LEFT: HOUSEHOLD PROFILES (4 Columns) */}
          <div className="md:col-span-4 flex flex-col space-y-3 border-r border-neutral-200 dark:border-neutral-850 pr-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black text-[#EF2F38] uppercase tracking-wider">{"// HOUSEHOLDS"}</span>
              <button
                disabled={savingHousehold || !can('action:student_edit')}
                onClick={() => setIsCreatingHousehold(true)}
                className="px-2 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-[#EF2F38] text-neutral-900 dark:text-white text-[9px] font-mono rounded-[8px] flex items-center gap-1 cursor-pointer"
              >
                <UserPlus size={12} /> NEW GUARDIAN
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-96 pr-1 scrollbar-thin">
              {households.map(hh => {
                const isSelected = hh.id === selectedHouseholdId;
                return (
                  <div
                    key={hh.id}
                    onClick={() => setSelectedHouseholdId(hh.id)}
                    className={`p-3 rounded-[8px] border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#EF2F38]/10 border-[#EF2F38] text-neutral-900 dark:text-white'
                        : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold font-sans">{hh.guardianName}</p>
                      <span className="text-[9px] font-mono bg-white dark:bg-neutral-950 px-1.5 py-0.5 rounded-[8px] border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {hh.studentIds.length} SIBLINGS
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 mt-1">{hh.guardianPhone}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: HOUSEHOLD SIBLINGS & INVOICING (8 Columns) */}
          <div className="md:col-span-8 flex flex-col justify-between space-y-4">
            {activeHousehold ? (
              <div className="space-y-4">
                
                {/* Guardian Details Card */}
                <div className="bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 p-3.5 rounded-[8px] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase font-bold">PRIMARY GUARDIAN PROFILE</span>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{activeHousehold.guardianName}</h3>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 pt-1">
                      <span className="flex items-center gap-1"><Phone size={10} /> {activeHousehold.guardianPhone}</span>
                      {activeHousehold.guardianEmail && (
                        <span className="flex items-center gap-1"><Envelope size={10} /> {activeHousehold.guardianEmail}</span>
                      )}
                    </div>
                  </div>

                  {/* Add Sibling Control */}
                  <div className="flex items-center gap-2">
                    <select
                      value={addStudentId}
                      onChange={e => setAddStudentId(e.target.value)}
                      className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-200 rounded-[8px] p-1.5 font-mono max-w-[160px]"
                    >
                      <option value="">+ Link Sibling...</option>
                      {state.students
                        .filter(s => !activeHousehold.studentIds.includes(s.id))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.englishName}</option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddSibling}
                      disabled={savingHousehold || !addStudentId || !can('action:student_edit')}
                      className="px-2.5 py-1.5 bg-[#EF2F38] disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white text-[10px] font-mono font-bold rounded-[8px] cursor-pointer"
                    >
                      LINK
                    </button>
                  </div>
                </div>

                {/* Linked Siblings Grid */}
                <div>
                  <span className="block text-[9px] font-mono font-black text-[#EF2F38] uppercase tracking-wider mb-2">
                    {"// LINKED SIBLINGS ("}{linkedStudents.length})
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedStudents.map(st => (
                      <div key={st.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 rounded-[8px] flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <SafeImage
                            src={st.profilePicturePath}
                            alt={st.englishName}
                            width={36}
                            height={36}
                            className="rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                          />
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-white">{st.englishName}</p>
                            <span className="text-[9px] font-mono text-[#EF2F38]">{st.currentBelt}</span>
                          </div>
                        </div>

                        <button
                          disabled={savingHousehold || !can('action:student_edit')}
                          onClick={() => handleRemoveSibling(st.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-[8px] hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                          title="Remove Sibling"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Family Consolidated Invoicing Card */}
                <div className="bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 rounded-[8px] space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                    <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                      <Receipt size={14} className="text-[#EF2F38]" /> CONSOLIDATED FAMILY TUITION
                    </span>
                    <span className="text-xs font-mono font-black text-[#EF2F38]">
                      ${familyTotal.toFixed(2)} outstanding
                    </span>
                  </div>

                  <p className="text-[11px] font-sans text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Collects one outstanding tuition cycle for each of {familyEntries.length} active siblings. Review each month before recording funds received.
                  </p>

                  <button
                    onClick={handleFamilyCheckout}
                    disabled={!familyEntries.length || !can('action:finance_record_payment')}
                    className="w-full py-2.5 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    <Receipt size={16} /> REVIEW FAMILY COLLECTION (${familyTotal.toFixed(2)})
                  </button>
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-xs font-mono text-neutral-500">
                Select or create a household profile to manage siblings.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* CREATE HOUSEHOLD MODAL */}
      {isCreatingHousehold && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreateHousehold} className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white w-full max-w-md rounded-[8px] p-5 font-mono space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-xs font-black tracking-wider text-[#EF2F38]">{"// CREATE HOUSEHOLD GUARDIAN"}</h3>
              <button type="button" onClick={() => setIsCreatingHousehold(false)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[9px] text-neutral-500 dark:text-neutral-400 mb-1">GUARDIAN FULL NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sokha Tan (Father)"
                  value={newGuardian.name}
                  onChange={e => setNewGuardian({ ...newGuardian, name: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                />
              </div>

              <div>
                <label className="block text-[9px] text-neutral-500 dark:text-neutral-400 mb-1">PRIMARY PHONE NUMBER</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +855 12 345 678"
                  value={newGuardian.phone}
                  onChange={e => setNewGuardian({ ...newGuardian, phone: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                />
              </div>

              <div>
                <label className="block text-[9px] text-neutral-500 dark:text-neutral-400 mb-1">EMAIL ADDRESS (OPTIONAL)</label>
                <input
                  type="email"
                  placeholder="e.g. parent@gmail.com"
                  value={newGuardian.email}
                  onChange={e => setNewGuardian({ ...newGuardian, email: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setIsCreatingHousehold(false)}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingHousehold}
                className="px-4 py-1.5 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow cursor-pointer"
              >
                Create Household
              </button>
            </div>
          </form>
        </div>
      )}

      {paymentReview && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white rounded-lg p-5 w-full max-w-md space-y-4 max-h-[90dvh] overflow-y-auto">
            <h3 className="font-bold">Review family collection: {paymentReview.guardianName}</h3>
            <ul className="text-sm space-y-2">{paymentReview.entries.map(entry=><li key={entry.studentId}>{entry.name} — {entry.month} {entry.year}: ${entry.amount.toFixed(2)}</li>)}</ul>
            <p className="font-bold">Total: ${paymentReview.entries.reduce((sum,e)=>sum+e.amount,0).toFixed(2)}</p>
            <label className="block text-sm">Payment method
              <select disabled={collecting || !!retryPayload.current} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="block w-full border rounded p-2 bg-transparent">
                {['Cash','Bank Transfer','Credit Card','ABA Bank KHQR'].map(method=><option key={method}>{method}</option>)}
              </select>
            </label>
            {paymentMethod!=='Cash' && <label className="block text-sm">Verified bank or card reference
              <input disabled={collecting || !!retryPayload.current} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} maxLength={100} className="block w-full border rounded p-2 bg-transparent" />
            </label>}
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={paymentConfirmed} disabled={collecting} onChange={e=>setPaymentConfirmed(e.target.checked)} />I verified that these funds were received.</label>
            <p className="text-xs text-neutral-500">Record cash or a completed bank/card payment. This screen does not initiate or verify a bank transfer.</p>
            {retryPayload.current && <p className="text-xs text-amber-600">An attempted collection is awaiting confirmation. Retry to retrieve its receipt.</p>}
            <div className="flex gap-3">
              <button disabled={collecting || !!retryPayload.current} onClick={()=>setPaymentReview(null)} className="border rounded px-3 py-2">Close</button>
              <button disabled={collecting || !paymentConfirmed || (paymentMethod!=='Cash' && paymentReference.trim().length<3)} onClick={collectFamilyPayment} className="bg-[#EF2F38] text-white rounded px-3 py-2 disabled:opacity-40">{collecting?'Recording…':retryPayload.current?'Retry collection':'Record collection'}</button>
            </div>
          </div>
        </div>
      )}

      {/* FAMILY TUITION RECEIPT MODAL */}
      {familyReceipt && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 w-full max-w-sm rounded-[8px] p-6 font-mono shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="text-center border-b border-neutral-300 pb-3">
              <h2 className="text-sm font-black tracking-widest text-[#EF2F38]">INFINITY TAEKWONDO ACADEMY</h2>
              <p className="text-[9px] text-neutral-600 uppercase font-bold">CONSOLIDATED FAMILY TUITION RECEIPT</p>
              <p className="text-[9px] text-neutral-500 mt-1">TX #: {familyReceipt.receipt_number}</p>
            </div>

            <div className="text-[10px] space-y-1">
              <p><strong>Guardian:</strong> {familyReceipt.guardian_name}</p>
              <p><strong>Method:</strong> {familyReceipt.payment_method}</p>
              {familyReceipt.external_reference && <p><strong>Reference:</strong> {familyReceipt.external_reference}</p>}
            </div>

            {/* Siblings Breakdown */}
            <div className="border-t border-b border-neutral-300 py-2 space-y-1 text-[10px]">
              {familyReceipt.transactions.map((sib, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{sib.student_name} ({sib.for_month} {sib.year})</span>
                  <span>${Number(sib.amount_usd).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs font-black pt-1 border-t border-neutral-400">
              <span>TOTAL FAMILY TUITION:</span>
              <span className="text-[#EF2F38]">${familyReceipt.transactions.reduce((sum,t)=>sum+Number(t.amount_usd),0).toFixed(2)}</span>
            </div>

            <button
              onClick={() => setFamilyReceipt(null)}
              className="w-full py-2 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-[10px] font-bold uppercase rounded-[8px] shadow cursor-pointer"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
