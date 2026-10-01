'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, Partner, PartnerType, PartnerStatus } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Handshake, 
  MagnifyingGlass, 
  Plus, 
  X, 
  PencilSimple, 
  Trash, 
  Phone, 
  Envelope, 
  PaperPlaneTilt, 
  Globe, 
  FileText, 
  Copy, 
  Check, 
  DownloadSimple, 
  Buildings, 
  User, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Warning, 
  Sparkle, 
  ArrowSquareOut,
  ListDashes,
  SquaresFour,
  Funnel,
  Tag,
  ArrowsClockwise
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';
import { SafeImage } from './SafeImage';
import { useT } from '@/hooks/useTranslation';

const PARTNER_TYPES: PartnerType[] = [
  'MOU',
  'Sponsor',
  'Educational',
  'Supplier',
  'Affiliated Dojang',
  'Media & Marketing',
  'Federation',
  'Healthcare',
  'Government/NGO',
  'Other'
];

const PARTNER_STATUSES: PartnerStatus[] = [
  'Active',
  'MOU Signed',
  'Pending Discussion',
  'Under Renewal',
  'Expired',
  'Terminated'
];

export function PartnersView() {
  const { state, createPartner, updatePartner, deletePartner, fetchPartners, showNotification, showConfirm, can } = useAppStore();
  const t = useT();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'mou' | 'sponsor' | 'expiring' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPartners();
  }, []);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const initialFormState: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    brandName: '',
    logoUrl: '',
    partnerType: 'MOU',
    status: 'Active',
    description: '',
    collaborationScope: '',
    benefitsSummary: '',
    founderName: '',
    founderContact: '',
    contactName: '',
    contactRole: '',
    email: '',
    phone: '',
    telegramUsername: '',
    telegramLink: '',
    secondaryContactName: '',
    secondaryContactPhone: '',
    secondaryContactTelegram: '',
    websiteUrl: '',
    address: '',
    country: 'Cambodia',
    mouSignedDate: '',
    mouExpiryDate: '',
    contractDocumentUrl: '',
    notes: '',
    tags: []
  };

  const [formData, setFormData] = useState(initialFormState);
  const [tagInput, setTagInput] = useState('');

  // Permissions
  const canManage = can('action:partner_create') || can('action:partner_edit') || state.currentUser?.role === 'Root' || state.currentUser?.role === 'Admin';
  const canDelete = can('action:partner_delete') || state.currentUser?.role === 'Root' || state.currentUser?.role === 'Admin';

  const copyToClipboard = (text: string, identifier: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Filtered Partners
  const filteredPartners = useMemo(() => {
    return state.partners.filter(p => {
      if (activeKpiFilter === 'mou' && !(p.status === 'Active' || p.status === 'MOU Signed')) return false;
      if (activeKpiFilter === 'sponsor' && !(p.partnerType === 'Sponsor' || p.partnerType === 'Supplier')) return false;
      if (activeKpiFilter === 'expiring') {
        if (!p.mouExpiryDate) return false;
        const expiry = new Date(p.mouExpiryDate).getTime();
        const now = Date.now();
        const daysLeft = (expiry - now) / (1000 * 60 * 60 * 24);
        if (!(daysLeft > 0 && daysLeft <= 90)) return false;
      }

      const q = search.trim().toLowerCase();
      const matchesSearch = !q || (
        p.name.toLowerCase().includes(q) ||
        (p.brandName && p.brandName.toLowerCase().includes(q)) ||
        (p.founderName && p.founderName.toLowerCase().includes(q)) ||
        (p.contactName && p.contactName.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.telegramUsername && p.telegramUsername.toLowerCase().includes(q)) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );

      const matchesType = selectedType === 'all' || p.partnerType === selectedType;
      const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
      const matchesCountry = selectedCountry === 'all' || p.country === selectedCountry;

      return matchesSearch && matchesType && matchesStatus && matchesCountry;
    });
  }, [state.partners, search, selectedType, selectedStatus, selectedCountry, activeKpiFilter]);

  const handleKpiClick = (type: 'all' | 'mou' | 'sponsor' | 'expiring') => {
    if (activeKpiFilter === type) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(type === 'all' ? null : type);
      if (type === 'all') {
        setSelectedType('all');
        setSelectedStatus('all');
        setSelectedCountry('all');
      }
    }
  };

  // Derived Countries List
  const countryList = useMemo(() => {
    const set = new Set<string>();
    state.partners.forEach(p => {
      if (p.country) set.add(p.country);
    });
    return Array.from(set).sort();
  }, [state.partners]);

  // Metric KPIs
  const totalCount = state.partners.length;
  const activeMouCount = state.partners.filter(p => p.status === 'Active' || p.status === 'MOU Signed').length;
  const sponsorsSuppliersCount = state.partners.filter(p => p.partnerType === 'Sponsor' || p.partnerType === 'Supplier').length;
  const expiringSoonCount = state.partners.filter(p => {
    if (!p.mouExpiryDate) return false;
    const expiry = new Date(p.mouExpiryDate).getTime();
    const now = Date.now();
    const daysLeft = (expiry - now) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 90;
  }).length;

  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setEditingPartner(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (partner: Partner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      brandName: partner.brandName || '',
      logoUrl: partner.logoUrl || '',
      partnerType: partner.partnerType,
      status: partner.status,
      description: partner.description || '',
      collaborationScope: partner.collaborationScope || '',
      benefitsSummary: partner.benefitsSummary || '',
      founderName: partner.founderName || '',
      founderContact: partner.founderContact || '',
      contactName: partner.contactName || '',
      contactRole: partner.contactRole || '',
      email: partner.email || '',
      phone: partner.phone || '',
      telegramUsername: partner.telegramUsername || '',
      telegramLink: partner.telegramLink || '',
      secondaryContactName: partner.secondaryContactName || '',
      secondaryContactPhone: partner.secondaryContactPhone || '',
      secondaryContactTelegram: partner.secondaryContactTelegram || '',
      websiteUrl: partner.websiteUrl || '',
      address: partner.address || '',
      country: partner.country || 'Cambodia',
      mouSignedDate: partner.mouSignedDate || '',
      mouExpiryDate: partner.mouExpiryDate || '',
      contractDocumentUrl: partner.contractDocumentUrl || '',
      notes: partner.notes || '',
      tags: partner.tags || []
    });
    setIsAddModalOpen(true);
  };

  const handleDeletePartner = (partner: Partner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      `Are you sure you want to remove "${partner.name}" from the partner directory?`,
      async () => {
        await deletePartner(partner.id);
        if (detailPartner?.id === partner.id) setDetailPartner(null);
      },
      'Confirm Deletion'
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('Please enter the partner/institution name.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPartner) {
        const res = await updatePartner(editingPartner.id, formData);
        if (res.success) {
          setIsAddModalOpen(false);
          setEditingPartner(null);
        }
      } else {
        const res = await createPartner(formData);
        if (res.success) {
          setIsAddModalOpen(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!formData.tags?.includes(clean)) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), clean] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tagToRemove) || []
    }));
  };

  const handleExportCsv = () => {
    if (filteredPartners.length === 0) {
      showNotification('No partner records to export.', 'warning');
      return;
    }

    const headers = [
      'Name',
      'Brand Name',
      'Type',
      'Status',
      'Founder',
      'Contact Person',
      'Contact Role',
      'Email',
      'Phone',
      'Telegram',
      'Country',
      'MOU Signed Date',
      'MOU Expiry Date',
      'Website',
      'Collaboration Scope'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredPartners.map(p => [
      escapeCsv(p.name),
      escapeCsv(p.brandName || ''),
      escapeCsv(p.partnerType),
      escapeCsv(p.status),
      escapeCsv(p.founderName || ''),
      escapeCsv(p.contactName || ''),
      escapeCsv(p.contactRole || ''),
      escapeCsv(p.email || ''),
      escapeCsv(p.phone || ''),
      escapeCsv(p.telegramUsername || ''),
      escapeCsv(p.country || ''),
      escapeCsv(p.mouSignedDate || ''),
      escapeCsv(p.mouExpiryDate || ''),
      escapeCsv(p.websiteUrl || ''),
      escapeCsv(p.collaborationScope || '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinitytkd-partners-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredPartners.length} partner records.`, 'success');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPartners();
      showNotification('Partner directory synchronized.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status: PartnerStatus) => {
    switch (status) {
      case 'Active':
      case 'MOU Signed':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Pending Discussion':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Under Renewal':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'Expired':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'Terminated':
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
    }
  };

  const getTypeBadge = (type: PartnerType) => {
    switch (type) {
      case 'MOU':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Educational':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'Supplier':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'Sponsor':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Federation':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'Healthcare':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Affiliated Dojang':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      default:
        return 'bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-[#262626]';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0A0A0A] overflow-y-auto">
      {/* Top Banner & KPI Summary */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-[#262626] space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] shrink-0">
              <Handshake className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#EF2F38] bg-red-500/10 px-2 py-0.5 rounded-[6px] border border-red-500/20">
                  INFINITY TKD · INSTITUTIONAL DIRECTORY
                </span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                  {filteredPartners.length} of {totalCount} Partners
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-neutral-900 dark:text-white mt-1">
                Partners & MOU Directory
              </h1>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                Manage academy collaborations, institutional MOUs, sponsors, and key working contacts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Synchronize partners with database"
              aria-label="Synchronize partner directory"
              className="flex-1 sm:flex-none min-h-[42px] px-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation transition-all disabled:opacity-50"
            >
              <ArrowsClockwise className={cn("w-4 h-4", isRefreshing && "animate-spin text-[#EF2F38]")} weight="bold" />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex-1 sm:flex-none min-h-[42px] px-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[8px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation transition-all"
            >
              <DownloadSimple className="w-4 h-4" weight="bold" />
              <span>Export CSV</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex-1 sm:flex-none min-h-[42px] px-4 bg-[#EF2F38] hover:bg-[#d4252e] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" weight="bold" />
                <span>Add Partner</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Metric KPI Cards with Click-to-Filter Interaction */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={() => handleKpiClick('all')}
            className={cn(
              "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
              activeKpiFilter === 'all'
                ? "ring-2 ring-[#EF2F38]/40 border-[#EF2F38] bg-red-500/[0.04] dark:bg-red-500/[0.08]"
                : "border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-[#383838]"
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">Total Partners</p>
              <p className="text-xl sm:text-2xl font-black font-mono text-neutral-900 dark:text-white mt-0.5">{totalCount}</p>
            </div>
            <div className="w-9 h-9 rounded-[8px] bg-neutral-200/80 dark:bg-[#1C1C1C] flex items-center justify-center text-neutral-700 dark:text-neutral-300 shrink-0 border border-neutral-200 dark:border-[#262626]">
              <Buildings className="w-4 h-4" weight="bold" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('mou')}
            className={cn(
              "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
              activeKpiFilter === 'mou'
                ? "ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-500/[0.06]"
                : "border-neutral-200 dark:border-[#262626] hover:border-emerald-500/40"
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">Active MOUs</p>
              <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{activeMouCount}</p>
            </div>
            <div className="w-9 h-9 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" weight="bold" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('sponsor')}
            className={cn(
              "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
              activeKpiFilter === 'sponsor'
                ? "ring-2 ring-blue-500/50 border-blue-500 bg-blue-500/[0.06]"
                : "border-neutral-200 dark:border-[#262626] hover:border-blue-500/40"
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">Sponsors & Vendors</p>
              <p className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">{sponsorsSuppliersCount}</p>
            </div>
            <div className="w-9 h-9 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Sparkle className="w-4 h-4" weight="bold" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('expiring')}
            className={cn(
              "w-full text-left bg-neutral-50 dark:bg-[#141414] border rounded-[8px] p-3 sm:p-4 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-95 touch-manipulation",
              activeKpiFilter === 'expiring'
                ? "ring-2 ring-amber-500/50 border-amber-500 bg-amber-500/[0.06]"
                : "border-neutral-200 dark:border-[#262626] hover:border-amber-500/40"
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">Renewal Attention</p>
              <p className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">{expiringSoonCount}</p>
            </div>
            <div className="w-9 h-9 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Warning className="w-4 h-4" weight="bold" />
            </div>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between pt-1">
          {/* Search Box with Clear Button */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search partner, founder, contact person, Telegram..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 min-h-[40px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 transition-all font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-white rounded-[6px] active:scale-90 touch-manipulation cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter partner type"
              className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs text-neutral-800 dark:text-neutral-200 px-3 min-h-[40px] shrink-0 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-bold font-mono cursor-pointer active:scale-95 touch-manipulation"
            >
              <option value="all">All Types</option>
              {PARTNER_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter partner status"
              className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs text-neutral-800 dark:text-neutral-200 px-3 min-h-[40px] shrink-0 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-bold font-mono cursor-pointer active:scale-95 touch-manipulation"
            >
              <option value="all">All Statuses</option>
              {PARTNER_STATUSES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Country Filter */}
            {countryList.length > 0 && (
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                aria-label="Filter partner country"
                className="bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-xs text-neutral-800 dark:text-neutral-200 px-3 min-h-[40px] shrink-0 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-bold font-mono cursor-pointer active:scale-95 touch-manipulation"
              >
                <option value="all">All Countries</option>
                {countryList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-0.5 shrink-0 min-h-[40px]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation",
                  viewMode === 'grid'
                    ? "bg-white dark:bg-[#2A2A2A] text-neutral-900 dark:text-white shadow-2xs font-bold"
                    : "text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                )}
                title="Grid Cards View"
              >
                <SquaresFour className="w-4 h-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  "min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation",
                  viewMode === 'table'
                    ? "bg-white dark:bg-[#2A2A2A] text-neutral-900 dark:text-white shadow-2xs font-bold"
                    : "text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                )}
                title="List Table View"
              >
                <ListDashes className="w-4 h-4" weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 flex-1">
        {filteredPartners.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50/50 dark:bg-[#141414]">
            <Handshake className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">No Partners Found</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1 max-w-sm mx-auto">
              No partner records matching your search or filters. Try adjusting your search query or add a new partner.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-4 px-4 py-2 bg-[#EF2F38] hover:bg-[#d4252e] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
              >
                <Plus className="w-4 h-4" weight="bold" />
                <span>Add Partner</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredPartners.map(partner => {
              const isTelegramCopied = copiedId === `tg-${partner.id}`;
              const isPhoneCopied = copiedId === `ph-${partner.id}`;
              const isEmailCopied = copiedId === `em-${partner.id}`;

              return (
                <div
                  key={partner.id}
                  onClick={() => setDetailPartner(partner)}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 rounded-[8px] p-4 flex flex-col justify-between shadow-xs transition-all cursor-pointer group hover:shadow-md"
                >
                  {/* Top Partner Brand & Type */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {partner.logoUrl ? (
                          <SafeImage
                            src={partner.logoUrl}
                            alt={partner.name}
                            className="w-12 h-12 rounded-[8px] object-cover border border-neutral-200 dark:border-[#262626] shrink-0 bg-neutral-100 dark:bg-[#1A1A1A]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-[8px] bg-[#EF2F38]/10 border border-[#EF2F38]/20 flex items-center justify-center text-[#EF2F38] font-black text-sm font-mono shrink-0">
                            {partner.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate group-hover:text-[#EF2F38] transition-colors">
                            {partner.brandName || partner.name}
                          </h3>
                          {partner.brandName && (
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                              {partner.name}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getTypeBadge(partner.partnerType))}>
                              {partner.partnerType}
                            </span>
                            <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getStatusBadge(partner.status))}>
                              {partner.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Menu */}
                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(partner, e)}
                            className="min-w-[36px] min-h-[36px] p-2 rounded-[6px] hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer active:scale-90 touch-manipulation flex items-center justify-center"
                            title="Edit Partner"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={(e) => handleDeletePartner(partner, e)}
                              className="min-w-[36px] min-h-[36px] p-2 rounded-[6px] hover:bg-red-500/10 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-500 transition-colors cursor-pointer active:scale-90 touch-manipulation flex items-center justify-center"
                              title="Delete Partner"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Collaboration Scope / Description Preview */}
                    {partner.collaborationScope && (
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-relaxed">
                        {partner.collaborationScope}
                      </p>
                    )}

                    {/* Key Contacts Snapshot */}
                    <div className="bg-neutral-50 dark:bg-[#0F0F0F] rounded-[8px] p-2.5 border border-neutral-200/80 dark:border-[#262626] space-y-1.5 text-[11px] font-mono">
                      {partner.contactName && (
                        <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Liaison:</span>
                          <span className="font-bold truncate ml-2">
                            {partner.contactName} {partner.contactRole && `(${partner.contactRole})`}
                          </span>
                        </div>
                      )}
                      {partner.founderName && (
                        <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Founder:</span>
                          <span className="truncate ml-2">{partner.founderName}</span>
                        </div>
                      )}
                      {partner.country && (
                        <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Region:</span>
                          <span>{partner.country}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Quick-Action Buttons (Telegram, Phone, Email, Site) */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-[#262626] mt-3 flex items-center justify-between gap-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Telegram Quick-Action (Crucial for Cambodia / Asia) */}
                      {partner.telegramUsername && (
                        <a
                          href={partner.telegramLink || `https://t.me/${partner.telegramUsername.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[36px] px-2.5 py-1 bg-[#229ED9]/10 hover:bg-[#229ED9] text-[#229ED9] hover:text-white rounded-[6px] text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation border border-[#229ED9]/20"
                          title={`Open Telegram: @${partner.telegramUsername.replace(/^@/, '')}`}
                        >
                          <PaperPlaneTilt className="w-3.5 h-3.5" weight="fill" />
                          <span>Telegram</span>
                        </a>
                      )}

                      {/* Phone Quick-Action */}
                      {partner.phone && (
                        <a
                          href={`tel:${partner.phone}`}
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation"
                          title={`Call: ${partner.phone}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}

                      {/* Email Quick-Action */}
                      {partner.email && (
                        <a
                          href={`mailto:${partner.email}`}
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation"
                          title={`Email: ${partner.email}`}
                        >
                          <Envelope className="w-4 h-4" />
                        </a>
                      )}

                      {/* Website Quick-Action */}
                      {partner.websiteUrl && (
                        <a
                          href={partner.websiteUrl.startsWith('http') ? partner.websiteUrl : `https://${partner.websiteUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation"
                          title="Visit Website"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailPartner(partner)}
                      className="min-h-[36px] px-2 text-xs font-bold font-mono text-[#EF2F38] hover:text-[#d4252e] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <span>Details</span>
                      <ArrowSquareOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW MODE */
          <>
            {/* Native Mobile Compact Cards (<md) */}
            <div className="block md:hidden space-y-3">
              {filteredPartners.map(partner => (
                <div
                  key={partner.id}
                  onClick={() => setDetailPartner(partner)}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 space-y-3 shadow-xs active:scale-[0.99] touch-manipulation cursor-pointer"
                >
                  {/* Top: Logo, Name, Badges, and Menu */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {partner.logoUrl ? (
                        <SafeImage
                          src={partner.logoUrl}
                          alt={partner.name}
                          className="w-10 h-10 rounded-[6px] object-cover border border-neutral-200 dark:border-[#262626] shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-[6px] bg-[#EF2F38]/10 text-[#EF2F38] font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                          {partner.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-neutral-900 dark:text-white block truncate">
                          {partner.brandName || partner.name}
                        </span>
                        {partner.brandName && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block truncate font-mono">
                            {partner.name}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getTypeBadge(partner.partnerType))}>
                            {partner.partnerType}
                          </span>
                          <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getStatusBadge(partner.status))}>
                            {partner.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(partner, e)}
                          className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                          title="Edit"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePartner(partner, e)}
                          className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-red-500 rounded-[6px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contact Summary */}
                  <div className="bg-neutral-50 dark:bg-[#0F0F0F] rounded-[6px] p-2 text-[11px] font-mono space-y-1 border border-neutral-100 dark:border-[#262626]">
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Liaison:</span>
                      <span className="font-bold truncate ml-2">
                        {partner.contactName || '—'} {partner.contactRole && `(${partner.contactRole})`}
                      </span>
                    </div>
                    {partner.country && (
                      <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Region:</span>
                        <span>{partner.country}</span>
                      </div>
                    )}
                    {partner.mouExpiryDate && (
                      <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Expiry:</span>
                        <span className="text-[#EF2F38] font-bold">{partner.mouExpiryDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Contact Pills */}
                  <div className="flex items-center justify-between pt-1 gap-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {partner.telegramUsername && (
                        <a
                          href={partner.telegramLink || `https://t.me/${partner.telegramUsername.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] px-2 py-1 bg-[#229ED9]/10 text-[#229ED9] rounded-[6px] text-[10px] font-mono font-bold flex items-center gap-1 border border-[#229ED9]/20 active:scale-95 touch-manipulation"
                        >
                          <PaperPlaneTilt className="w-3 h-3" weight="fill" />
                          <span>@{partner.telegramUsername.replace(/^@/, '')}</span>
                        </a>
                      )}
                      {partner.phone && (
                        <a
                          href={`tel:${partner.phone}`}
                          className="min-w-[34px] min-h-[34px] p-1.5 bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {partner.email && (
                        <a
                          href={`mailto:${partner.email}`}
                          className="min-w-[34px] min-h-[34px] p-1.5 bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation"
                          title="Email"
                        >
                          <Envelope className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailPartner(partner)}
                      className="min-h-[34px] px-2 text-xs font-bold font-mono text-[#EF2F38] hover:text-[#d4252e] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <span>Details</span>
                      <ArrowSquareOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Full Table View (>=md) */}
            <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase font-mono font-bold tracking-wider border-b border-neutral-200 dark:border-[#262626]">
                    <tr>
                      <th className="px-4 py-3">Partner / Organization</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Key Contact</th>
                      <th className="px-4 py-3">Telegram</th>
                      <th className="px-4 py-3">Phone / Email</th>
                      <th className="px-4 py-3">Country</th>
                      <th className="px-4 py-3">MOU Expiry</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] font-mono">
                    {filteredPartners.map(partner => (
                      <tr
                        key={partner.id}
                        onClick={() => setDetailPartner(partner)}
                        className="hover:bg-neutral-50 dark:hover:bg-[#1C1C1C] transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {partner.logoUrl ? (
                              <SafeImage
                                src={partner.logoUrl}
                                alt={partner.name}
                                className="w-8 h-8 rounded-[6px] object-cover border border-neutral-200 dark:border-[#262626] shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-[6px] bg-[#EF2F38]/10 text-[#EF2F38] font-bold text-xs flex items-center justify-center shrink-0">
                                {partner.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-neutral-900 dark:text-white block font-sans truncate">
                                {partner.brandName || partner.name}
                              </span>
                              {partner.brandName && (
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block truncate font-mono">
                                  {partner.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase border", getTypeBadge(partner.partnerType))}>
                            {partner.partnerType}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase border", getStatusBadge(partner.status))}>
                            {partner.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200">
                          <div>
                            <span className="font-bold block">{partner.contactName || '—'}</span>
                            {partner.contactRole && <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">{partner.contactRole}</span>}
                          </div>
                        </td>

                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {partner.telegramUsername ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={partner.telegramLink || `https://t.me/${partner.telegramUsername.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#229ED9] hover:underline font-bold flex items-center gap-1"
                              >
                                <PaperPlaneTilt className="w-3 h-3" weight="fill" />
                                <span>@{partner.telegramUsername.replace(/^@/, '')}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(`@${partner.telegramUsername?.replace(/^@/, '')}`, `tg-t-${partner.id}`)}
                                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-0.5 cursor-pointer"
                                title="Copy Telegram"
                              >
                                {copiedId === `tg-t-${partner.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-500">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="space-y-0.5">
                            {partner.phone && (
                              <a href={`tel:${partner.phone}`} className="text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] block text-[11px]">
                                {partner.phone}
                              </a>
                            )}
                            {partner.email && (
                              <a href={`mailto:${partner.email}`} className="text-neutral-500 dark:text-neutral-400 hover:text-[#EF2F38] block text-[10px] truncate max-w-[160px]">
                                {partner.email}
                              </a>
                            )}
                            {!partner.phone && !partner.email && <span className="text-neutral-400 dark:text-neutral-500">—</span>}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                          {partner.country || 'Cambodia'}
                        </td>

                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {partner.mouExpiryDate || '—'}
                        </td>

                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailPartner(partner)}
                              className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                              title="View Details"
                            >
                              <ArrowSquareOut className="w-4 h-4" />
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenEdit(partner, e)}
                                className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                                title="Edit"
                              >
                                <PencilSimple className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => handleDeletePartner(partner, e)}
                                className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-red-500 rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                                title="Delete"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Slide-Over Drawer Modal */}
      <AnimatePresence>
        {detailPartner && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-2xl max-h-[92dvh] my-auto flex flex-col overflow-hidden shadow-2xl text-neutral-900 dark:text-white"
              >
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {detailPartner.logoUrl ? (
                      <SafeImage
                        src={detailPartner.logoUrl}
                        alt={detailPartner.name}
                        className="w-12 h-12 rounded-[8px] object-cover border border-neutral-200 dark:border-[#262626] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-[8px] bg-[#EF2F38]/10 text-[#EF2F38] font-black text-base flex items-center justify-center shrink-0 font-mono">
                        {detailPartner.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                        {detailPartner.brandName || detailPartner.name}
                      </h2>
                      {detailPartner.brandName && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">{detailPartner.name}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getTypeBadge(detailPartner.partnerType))}>
                          {detailPartner.partnerType}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border", getStatusBadge(detailPartner.status))}>
                          {detailPartner.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = detailPartner;
                          setDetailPartner(null);
                          handleOpenEdit(p);
                        }}
                        className="min-h-[38px] px-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailPartner(null)}
                      className="min-w-[36px] min-h-[36px] p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-[8px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
                  {/* Overview / Scope */}
                  {detailPartner.description && (
                    <div>
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Organization Overview</h4>
                      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{detailPartner.description}</p>
                    </div>
                  )}

                  {detailPartner.collaborationScope && (
                    <div className="bg-neutral-50 dark:bg-[#0F0F0F] p-3.5 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#EF2F38] mb-1">MOU / Collaboration Scope</h4>
                      <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">{detailPartner.collaborationScope}</p>
                    </div>
                  )}

                  {detailPartner.benefitsSummary && (
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 rounded-[8px] border border-emerald-500/20">
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Benefits & Mutual Perks</h4>
                      <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed">{detailPartner.benefitsSummary}</p>
                    </div>
                  )}

                  {/* Key Contacts Grid */}
                  <div>
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Key Operational Contacts</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Liaison Manager */}
                      <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1.5 font-mono">
                        <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 text-[10px] uppercase font-bold">
                          <User className="w-3.5 h-3.5" />
                          <span>Primary Manager / Liaison</span>
                        </div>
                        <p className="font-bold text-sm text-neutral-900 dark:text-white font-sans">
                          {detailPartner.contactName || 'No contact specified'}
                        </p>
                        {detailPartner.contactRole && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{detailPartner.contactRole}</p>
                        )}

                        <div className="pt-2 border-t border-neutral-200 dark:border-[#262626] space-y-2 text-[11px]">
                          {detailPartner.telegramUsername && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 dark:text-neutral-500">Telegram:</span>
                              <a
                                href={detailPartner.telegramLink || `https://t.me/${detailPartner.telegramUsername.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#229ED9] hover:underline font-bold min-h-[34px] flex items-center active:scale-95 touch-manipulation"
                              >
                                @{detailPartner.telegramUsername.replace(/^@/, '')}
                              </a>
                            </div>
                          )}
                          {detailPartner.phone && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 dark:text-neutral-500">Phone:</span>
                              <a 
                                href={`tel:${detailPartner.phone}`} 
                                className="text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] min-h-[34px] flex items-center active:scale-95 touch-manipulation"
                              >
                                {detailPartner.phone}
                              </a>
                            </div>
                          )}
                          {detailPartner.email && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 dark:text-neutral-500">Email:</span>
                              <a 
                                href={`mailto:${detailPartner.email}`} 
                                className="text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] truncate max-w-[180px] min-h-[34px] flex items-center active:scale-95 touch-manipulation"
                              >
                                {detailPartner.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Founder / President */}
                      <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-1.5 font-mono">
                        <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 text-[10px] uppercase font-bold">
                          <Buildings className="w-3.5 h-3.5" />
                          <span>Founder & Leadership</span>
                        </div>
                        <p className="font-bold text-sm text-neutral-900 dark:text-white font-sans">
                          {detailPartner.founderName || 'Founder unlisted'}
                        </p>
                        {detailPartner.founderContact && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{detailPartner.founderContact}</p>
                        )}
                        {detailPartner.country && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
                            Headquarters: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{detailPartner.country}</span>
                          </p>
                        )}
                        {detailPartner.address && (
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{detailPartner.address}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Dates & Document Links */}
                  <div className="p-3.5 bg-neutral-50 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] space-y-2 font-mono text-[11px]">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Contract & Document Records</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">Signed Date:</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{detailPartner.mouSignedDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">Renewal / Expiry:</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{detailPartner.mouExpiryDate || 'Ongoing'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">Official Website:</span>
                        {detailPartner.websiteUrl ? (
                          <a
                            href={detailPartner.websiteUrl.startsWith('http') ? detailPartner.websiteUrl : `https://${detailPartner.websiteUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#EF2F38] hover:underline font-bold truncate block min-h-[30px] flex items-center active:scale-95 touch-manipulation"
                          >
                            Open Link ↗
                          </a>
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-500">N/A</span>
                        )}
                      </div>
                    </div>

                    {detailPartner.contractDocumentUrl && (
                      <div className="pt-2 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-neutral-500 dark:text-neutral-400">MOU Contract Agreement File:</span>
                        <a
                          href={detailPartner.contractDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 min-h-[38px] bg-[#EF2F38] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-[#d4252e] active:scale-95 touch-manipulation"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View Document</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {detailPartner.tags && detailPartner.tags.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">Tags</h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {detailPartner.tags.map(t => (
                          <span key={t} className="px-2.5 py-1 rounded-[6px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Internal Notes */}
                  {detailPartner.notes && (
                    <div>
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Internal Notes</h4>
                      <p className="text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-[#1C1C1C] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626] font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                        {detailPartner.notes}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Add / Edit Partner Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Portal>
            <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-2xl max-h-[92dvh] my-auto flex flex-col overflow-hidden shadow-2xl text-neutral-900 dark:text-white"
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[#EF2F38]/10 text-[#EF2F38] flex items-center justify-center font-bold">
                      <Handshake className="w-4 h-4" weight="bold" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        {editingPartner ? 'Edit Partner / MOU' : 'Add New Partner / MOU'}
                      </h2>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                        Register collaboration details, contacts, and agreement terms
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="min-w-[36px] min-h-[36px] p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-[8px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-mono">
                  {/* Section 1: Institution & Brand */}
                  <div className="space-y-3 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">1. Institution & Brand Identity</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Legal / Organization Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Korea National Sport University"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Brand / Display Name</label>
                        <input
                          type="text"
                          placeholder="e.g. KNSU Taekwondo"
                          value={formData.brandName || ''}
                          onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Collaboration Type</label>
                        <select
                          value={formData.partnerType}
                          onChange={(e) => setFormData({ ...formData, partnerType: e.target.value as PartnerType })}
                          className="w-full px-3 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-bold cursor-pointer active:scale-95 touch-manipulation"
                        >
                          {PARTNER_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Status</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as PartnerStatus })}
                          className="w-full px-3 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 font-bold cursor-pointer active:scale-95 touch-manipulation"
                        >
                          {PARTNER_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Country / Region</label>
                        <input
                          type="text"
                          placeholder="e.g. Cambodia, South Korea"
                          value={formData.country || ''}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Logo URL</label>
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={formData.logoUrl || ''}
                        onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                        className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">MOU / Collaboration Scope</label>
                      <textarea
                        rows={3}
                        placeholder="Key deliverables, student training camps, referee certifications..."
                        value={formData.collaborationScope || ''}
                        onChange={(e) => setFormData({ ...formData, collaborationScope: e.target.value })}
                        className="w-full p-3 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 resize-none leading-relaxed text-xs sm:text-sm font-sans"
                      />
                    </div>
                  </div>

                  {/* Section 2: Contact Persons & Telegram */}
                  <div className="space-y-3 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">2. Working Contacts & Telegram (Liaison)</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Contact Manager / Liaison Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Sokha Mean"
                          value={formData.contactName || ''}
                          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Contact Title / Role</label>
                        <input
                          type="text"
                          placeholder="e.g. Partnership Director"
                          value={formData.contactRole || ''}
                          onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">
                          <span className="text-[#229ED9] font-bold">✈ Telegram Username</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. @sokhamean"
                          value={formData.telegramUsername || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({
                              ...formData,
                              telegramUsername: val,
                              telegramLink: val ? `https://t.me/${val.replace(/^@/, '')}` : ''
                            });
                          }}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Phone / Mobile</label>
                        <input
                          type="tel"
                          placeholder="e.g. +855 12 345 678"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Email / Gmail</label>
                        <input
                          type="email"
                          placeholder="partner@example.com"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Founder / President Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Grandmaster Kim"
                          value={formData.founderName || ''}
                          onChange={(e) => setFormData({ ...formData, founderName: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Website URL</label>
                        <input
                          type="text"
                          placeholder="https://example.com"
                          value={formData.websiteUrl || ''}
                          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: MOU Agreement & Validity */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">3. Agreement Dates & Document Ref</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">MOU Signed Date</label>
                        <input
                          type="date"
                          value={formData.mouSignedDate || ''}
                          onChange={(e) => setFormData({ ...formData, mouSignedDate: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-mono [color-scheme:light] dark:[color-scheme:dark]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">MOU Expiry / Renewal Date</label>
                        <input
                          type="date"
                          value={formData.mouExpiryDate || ''}
                          onChange={(e) => setFormData({ ...formData, mouExpiryDate: e.target.value })}
                          className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-mono [color-scheme:light] dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Contract Document URL (Google Drive / PDF)</label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/file/d/..."
                        value={formData.contractDocumentUrl || ''}
                        onChange={(e) => setFormData({ ...formData, contractDocumentUrl: e.target.value })}
                        className="w-full px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                      />
                    </div>

                    {/* Tags input */}
                    <div>
                      <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Tags (press Enter to add)</label>
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {formData.tags?.map(t => (
                          <span key={t} className="px-2.5 py-1 rounded-[6px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 text-[11px] flex items-center gap-1">
                            <span>#{t}</span>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTag(t)} 
                              className="min-w-[20px] min-h-[20px] flex items-center justify-center text-neutral-400 hover:text-red-500 rounded-[4px] active:scale-90 touch-manipulation cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. equipment, discounts, university"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          className="flex-1 px-3.5 min-h-[42px] bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 text-xs sm:text-sm font-sans"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-4 min-h-[42px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] text-xs font-bold active:scale-95 touch-manipulation cursor-pointer"
                        >
                          Add Tag
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-600 dark:text-neutral-400 mb-1 font-semibold">Internal Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Internal communication history, renewal terms, reminders..."
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full p-3 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[8px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 resize-none leading-relaxed text-xs sm:text-sm font-sans"
                      />
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="pt-3 border-t border-neutral-200 dark:border-[#262626] flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-[8px] bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] font-bold uppercase tracking-wider text-xs hover:bg-neutral-200 dark:hover:bg-[#262626] active:scale-95 touch-manipulation flex items-center justify-center cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] rounded-[8px] bg-[#EF2F38] hover:bg-[#d4252e] text-white font-bold uppercase tracking-wider text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-[#EF2F38]/20 active:scale-95 touch-manipulation"
                    >
                      <span>{isSaving ? 'Saving...' : editingPartner ? 'Update Partner' : 'Save Partner'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
