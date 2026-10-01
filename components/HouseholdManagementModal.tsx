'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { 
  Users, 
  UserPlus, 
  House, 
  Receipt, 
  QrCode, 
  CheckCircle, 
  X, 
  Trash, 
  Cake, 
  Crown, 
  Phone, 
  Envelope,
  Warning,
  Sparkle
} from '@phosphor-icons/react';
import { SafeImage } from '@/components/SafeImage';

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
  const { state, showNotification } = useAppStore();

  // Initial household groups
  const [households, setHouseholds] = useState<HouseholdGroup[]>([
    {
      id: 'hh-1',
      guardianName: 'Sokha Tan (Father)',
      guardianPhone: '+855 12 345 678',
      guardianEmail: 'sokha.tan@gmail.com',
      studentIds: state.students.slice(0, 2).map(s => s.id)
    }
  ]);

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(households[0]?.id || '');
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

  // Consolidated Tuition Calculations
  const familyTuitionSummary = useMemo(() => {
    if (linkedStudents.length === 0) return { expectedTotal: 0, unpaidStudentsCount: 0 };
    
    let total = 0;
    let unpaidCount = 0;

    linkedStudents.forEach(st => {
      const scholarship = state.scholarships.find(s => s.id === st.scholarshipId);
      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isEarlyGroup ? 25.00 : 45.00;
      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const fee = baseFee * (1 - discountPct / 100);
      
      total += fee;
      
      const payment = state.payments.find(p => p.studentId === st.id && p.status === 'Unpaid');
      if (payment) unpaidCount++;
    });

    return {
      expectedTotal: total,
      unpaidStudentsCount: unpaidCount
    };
  }, [linkedStudents, state.scholarships, state.payments]);

  // Household Checkout Modal
  const [familyReceipt, setFamilyReceipt] = useState<{
    txId: string;
    guardianName: string;
    siblings: { name: string; belt: string; fee: number }[];
    total: number;
  } | null>(null);

  const handleCreateHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuardian.name.trim() || !newGuardian.phone.trim()) {
      showNotification('Guardian Name and Phone are required.', 'error');
      return;
    }

    const created: HouseholdGroup = {
      id: `hh-${Date.now()}`,
      guardianName: newGuardian.name.trim(),
      guardianPhone: newGuardian.phone.trim(),
      guardianEmail: newGuardian.email.trim() || '',
      studentIds: initialStudentId ? [initialStudentId] : []
    };

    setHouseholds(prev => [...prev, created]);
    setSelectedHouseholdId(created.id);
    setIsCreatingHousehold(false);
    setNewGuardian({ name: '', phone: '', email: '' });
    showNotification('New Household profile created successfully!', 'success');
  };

  const handleAddSibling = () => {
    if (!activeHousehold || !addStudentId) return;

    if (activeHousehold.studentIds.includes(addStudentId)) {
      showNotification('Student is already linked to this household.', 'error');
      return;
    }

    setHouseholds(prev =>
      prev.map(h => {
        if (h.id === activeHousehold.id) {
          return { ...h, studentIds: [...h.studentIds, addStudentId] };
        }
        return h;
      })
    );

    setAddStudentId('');
    showNotification('Sibling student linked to household!', 'success');
  };

  const handleRemoveSibling = (studentId: string) => {
    if (!activeHousehold) return;

    setHouseholds(prev =>
      prev.map(h => {
        if (h.id === activeHousehold.id) {
          return { ...h, studentIds: h.studentIds.filter(id => id !== studentId) };
        }
        return h;
      })
    );

    showNotification('Sibling removed from household group.', 'success');
  };

  const handleFamilyCheckout = () => {
    if (!activeHousehold || linkedStudents.length === 0) return;

    const txId = `FAM-${Date.now().toString().slice(-6)}`;
    const siblingDetails = linkedStudents.map(st => {
      const scholarship = state.scholarships.find(s => s.id === st.scholarshipId);
      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
      const baseFee = isEarlyGroup ? 25.00 : 45.00;
      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
      const fee = baseFee * (1 - discountPct / 100);

      return {
        name: st.englishName,
        belt: st.currentBelt,
        fee
      };
    });

    setFamilyReceipt({
      txId,
      guardianName: activeHousehold.guardianName,
      siblings: siblingDetails,
      total: familyTuitionSummary.expectedTotal
    });

    showNotification('Family batch checkout initiated!', 'success');
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

          <button onClick={onClose} className="p-1.5 rounded-[8px] hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Layout (Left: Household List, Right: Active Household Details) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 overflow-y-auto pt-4 pr-1 scrollbar-thin">
          
          {/* LEFT: HOUSEHOLD PROFILES (4 Columns) */}
          <div className="md:col-span-4 flex flex-col space-y-3 border-r border-neutral-200 dark:border-neutral-850 pr-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black text-[#EF2F38] uppercase tracking-wider">// HOUSEHOLDS</span>
              <button
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
                      disabled={!addStudentId}
                      className="px-2.5 py-1.5 bg-[#EF2F38] disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white text-[10px] font-mono font-bold rounded-[8px] cursor-pointer"
                    >
                      LINK
                    </button>
                  </div>
                </div>

                {/* Linked Siblings Grid */}
                <div>
                  <span className="block text-[9px] font-mono font-black text-[#EF2F38] uppercase tracking-wider mb-2">
                    // LINKED SIBLINGS ({linkedStudents.length})
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
                      ${familyTuitionSummary.expectedTotal.toFixed(2)} / month
                    </span>
                  </div>

                  <p className="text-[11px] font-sans text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Combines tuition fees for all {linkedStudents.length} enrolled siblings into a single monthly invoice for parent convenience.
                  </p>

                  <button
                    onClick={handleFamilyCheckout}
                    disabled={linkedStudents.length === 0}
                    className="w-full py-2.5 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    <QrCode size={16} /> BATCH ABA KHQR FAMILY CHECKOUT (${familyTuitionSummary.expectedTotal.toFixed(2)})
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
              <h3 className="text-xs font-black tracking-wider text-[#EF2F38]">// CREATE HOUSEHOLD GUARDIAN</h3>
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
                className="px-4 py-1.5 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow cursor-pointer"
              >
                Create Household
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAMILY BATCH RECEIPT MODAL */}
      {familyReceipt && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 w-full max-w-sm rounded-[8px] p-6 font-mono shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="text-center border-b border-neutral-300 pb-3">
              <h2 className="text-sm font-black tracking-widest text-[#EF2F38]">INFINITY TAEKWONDO ACADEMY</h2>
              <p className="text-[9px] text-neutral-600 uppercase font-bold">CONSOLIDATED FAMILY TUITION RECEIPT</p>
              <p className="text-[9px] text-neutral-500 mt-1">TX #: {familyReceipt.txId}</p>
            </div>

            <div className="text-[10px] space-y-1">
              <p><strong>Guardian:</strong> {familyReceipt.guardianName}</p>
            </div>

            {/* Siblings Breakdown */}
            <div className="border-t border-b border-neutral-300 py-2 space-y-1 text-[10px]">
              {familyReceipt.siblings.map((sib, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{sib.name} ({sib.belt})</span>
                  <span>${sib.fee.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs font-black pt-1 border-t border-neutral-400">
              <span>TOTAL FAMILY TUITION:</span>
              <span className="text-[#EF2F38]">${familyReceipt.total.toFixed(2)}</span>
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
