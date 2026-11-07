'use client';

import { academyDate } from '@/lib/dates';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, Partner, PartnerType, PartnerStatus } from '@/lib/store';
import { AnimatePresence } from 'motion/react';
import { Handshake } from '@phosphor-icons/react/dist/csr/Handshake';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { Envelope } from '@phosphor-icons/react/dist/csr/Envelope';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { FileText } from '@phosphor-icons/react/dist/csr/FileText';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Buildings } from '@phosphor-icons/react/dist/csr/Buildings';
import { User } from '@phosphor-icons/react/dist/csr/User';


import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';


import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { cn } from '@/lib/utils';
import { SafeImage } from './SafeImage';
import { PageHeader } from './ui/PageHeader';
import { KpiCard } from './ui/KpiCard';
import { EmptyState, ErrorBanner } from './ui/States';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './ui/Dialog';
import { buttonClass, fieldClass, filterSelectClass, labelClass } from './ui/styles';

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


  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'mou' | 'sponsor' | 'expiring' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsRefreshing(true);
    fetchPartners()
      .then(() => { if (active) setLoadError(null); })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'Partners could not be loaded. Please retry.'); })
      .finally(() => { if (active) setIsRefreshing(false); });
    return () => { active = false; };
  }, [fetchPartners]);

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
  const canCreate = can('action:partner_create');
  const canEdit = can('action:partner_edit');
  const canDelete = can('action:partner_delete');

  const copyToClipboard = async (text: string, identifier: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      showNotification('Copying is unavailable in this browser. Please select and copy the contact manually.', 'warning');
    }
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
      const raw = String(val ?? '');
      const str = (/^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""');
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
    link.setAttribute('download', `infinitytkd-partners-${academyDate()}.csv`);
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
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Partners could not be loaded. Please retry.');
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
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-12 sm:space-y-5">
      <PageHeader
        icon={<Handshake weight="bold" />}
        eyebrow="Infinity TKD · Institutional directory"
        meta={`${filteredPartners.length} of ${totalCount} Partners`}
        title="Partners & MOU Directory"
        description="Manage academy collaborations, institutional MOUs, sponsors, and key working contacts"
        actions={<>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Synchronize partners with database"
            aria-label="Synchronize partner directory"
            className={buttonClass()}
          >
            <ArrowsClockwise className={cn("w-4 h-4", isRefreshing && "motion-safe:animate-spin text-brand")} weight="bold" />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isRefreshing || Boolean(loadError && state.partners.length === 0)}
            className={buttonClass()}
          >
            <DownloadSimple className="w-4 h-4" weight="bold" />
            <span>Export CSV</span>
          </button>
          {canCreate && (
            <button type="button" onClick={handleOpenAdd} className={buttonClass({ variant: 'primary' })}>
              <Plus className="w-4 h-4" weight="bold" />
              <span>Add Partner</span>
            </button>
          )}
        </>}
      />

      {loadError && (
        <ErrorBanner
          title="Partner directory unavailable"
          action={<button type="button" onClick={handleRefresh} disabled={isRefreshing} className="min-h-11 rounded-lg border border-current px-4 font-semibold disabled:opacity-50">{isRefreshing ? 'Retrying…' : 'Retry'}</button>}
        >
          <p>{loadError}</p>
          {state.partners.length > 0 && <p className="mt-1 text-xs">Previously loaded records are shown. Changes may not be up to date.</p>}
        </ErrorBanner>
      )}

      {/* Metric cards double as quick filters */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-4">
        <KpiCard label="Total Partners" value={totalCount} icon={<Buildings weight="bold" />} active={activeKpiFilter === 'all'} onClick={() => handleKpiClick('all')} />
        <KpiCard label="Active MOUs" value={activeMouCount} tone="green" icon={<ShieldCheck weight="bold" />} active={activeKpiFilter === 'mou'} onClick={() => handleKpiClick('mou')} />
        <KpiCard label="Sponsors & Vendors" value={sponsorsSuppliersCount} tone="blue" icon={<Sparkle weight="bold" />} active={activeKpiFilter === 'sponsor'} onClick={() => handleKpiClick('sponsor')} />
        <KpiCard label="Renewal Attention" value={expiringSoonCount} tone="amber" icon={<Warning weight="bold" />} active={activeKpiFilter === 'expiring'} onClick={() => handleKpiClick('expiring')} />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col items-stretch justify-between gap-2.5 sm:gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            aria-label="Search partners"
            placeholder="Search partner, founder, contact person, Telegram..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(fieldClass, 'pl-10 pr-11 text-xs [&::-webkit-search-cancel-button]:hidden')}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-0.5 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-subtle hover:text-ink touch-manipulation"
              title="Clear Search"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-3.5 flex touch-pan-x items-center gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:px-0">
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} aria-label="Filter partner type" className={filterSelectClass}>
            <option value="all">All Types</option>
            {PARTNER_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} aria-label="Filter partner status" className={filterSelectClass}>
            <option value="all">All Statuses</option>
            {PARTNER_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
          {countryList.length > 0 && (
            <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} aria-label="Filter partner country" className={filterSelectClass}>
              <option value="all">All Countries</option>
              {countryList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div role="group" aria-label="Partner layout" className="flex min-h-11 shrink-0 items-center rounded-lg border border-line bg-control p-0.5">
            {([['grid', 'Grid Cards View', SquaresFour], ['table', 'List Table View', ListDashes]] as const).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                aria-label={label}
                title={label}
                className={cn(
                  "flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors touch-manipulation",
                  viewMode === mode ? "bg-surface text-ink shadow-2xs" : "text-ink-subtle hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" weight="bold" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div aria-busy={isRefreshing}>
        {filteredPartners.length === 0 ? (
          <EmptyState
            busy={isRefreshing}
            icon={<Handshake />}
            title={isRefreshing ? 'Loading partners…' : loadError ? 'Directory could not be verified' : 'No Partners Found'}
            description={loadError ? 'Use Retry above after the connection or account setup issue is resolved.' : isRefreshing ? 'Retrieving the latest partner records.' : 'No partner records matching your search or filters. Try adjusting your search query or add a new partner.'}
            action={canCreate && !loadError && !isRefreshing ? (
              <button type="button" onClick={handleOpenAdd} className={buttonClass({ variant: 'primary' })}>
                <Plus className="h-4 w-4" weight="bold" />
                <span>Add Partner</span>
              </button>
            ) : undefined}
          />
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredPartners.map(partner => {




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
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(partner, e)}
                            className="min-w-[36px] min-h-[36px] p-2 rounded-[6px] hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer active:scale-90 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                            title="Edit Partner"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={(e) => handleDeletePartner(partner, e)}
                              className="min-w-[36px] min-h-[36px] p-2 rounded-[6px] hover:bg-red-500/10 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-500 transition-colors cursor-pointer active:scale-90 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
                          className="min-h-[36px] px-2.5 py-1 bg-[#229ED9]/10 hover:bg-[#229ED9] text-[#229ED9] hover:text-white rounded-[6px] text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation border border-[#229ED9]/20 pointer-coarse:min-h-11"
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
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title={`Call: ${partner.phone}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}

                      {/* Email Quick-Action */}
                      {partner.email && (
                        <a
                          href={`mailto:${partner.email}`}
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
                          className="min-w-[36px] min-h-[36px] p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center transition-colors border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Visit Website"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailPartner(partner)}
                      className="min-h-[36px] px-2 text-xs font-bold font-mono text-[#EF2F38] hover:text-[#d4252e] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(partner, e)}
                          className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Edit"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePartner(partner, e)}
                          className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-red-500 rounded-[6px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
                          className="min-h-[34px] px-2 py-1 bg-[#229ED9]/10 text-[#229ED9] rounded-[6px] text-[10px] font-mono font-bold flex items-center gap-1 border border-[#229ED9]/20 active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                        >
                          <PaperPlaneTilt className="w-3 h-3" weight="fill" />
                          <span>@{partner.telegramUsername.replace(/^@/, '')}</span>
                        </a>
                      )}
                      {partner.phone && (
                        <a
                          href={`tel:${partner.phone}`}
                          className="min-w-[34px] min-h-[34px] p-1.5 bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {partner.email && (
                        <a
                          href={`mailto:${partner.email}`}
                          className="min-w-[34px] min-h-[34px] p-1.5 bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-700 dark:text-neutral-300 rounded-[6px] flex items-center justify-center border border-neutral-200 dark:border-[#262626] active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Email"
                        >
                          <Envelope className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailPartner(partner)}
                      className="min-h-[34px] px-2 text-xs font-bold font-mono text-[#EF2F38] hover:text-[#d4252e] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                              className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                              title="View Details"
                            >
                              <ArrowSquareOut className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenEdit(partner, e)}
                                className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                                title="Edit"
                              >
                                <PencilSimple className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => handleDeletePartner(partner, e)}
                                className="min-w-[34px] min-h-[34px] p-1.5 text-neutral-500 hover:text-red-500 rounded-[6px] transition-colors flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
          <Dialog onClose={() => setDetailPartner(null)} label={`${detailPartner.brandName || detailPartner.name} details`}>
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 bg-surface-inset border-b border-line flex items-center justify-between gap-3 shrink-0">
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
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = detailPartner;
                          setDetailPartner(null);
                          handleOpenEdit(p);
                        }}
                        className={buttonClass()}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailPartner(null)}
                      className="min-w-[44px] min-h-[44px] p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-[8px] flex items-center justify-center active:scale-90 touch-manipulation cursor-pointer"
                      title="Close"
                      aria-label="Close Partner Details"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <DialogBody className="space-y-5 text-xs">
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
                                className="text-[#229ED9] hover:underline font-bold min-h-[34px] flex items-center active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                                className="text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] min-h-[34px] flex items-center active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                                className="text-neutral-700 dark:text-neutral-300 hover:text-[#EF2F38] truncate max-w-[180px] min-h-[34px] flex items-center active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                            className="text-[#EF2F38] hover:underline font-bold truncate block min-h-[30px] flex items-center active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                          className="px-3.5 py-2 min-h-[38px] bg-[#EF2F38] text-white rounded-[8px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-[#d4252e] active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                </DialogBody>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Add / Edit Partner Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Dialog onClose={() => setIsAddModalOpen(false)} locked={isSaving}>
                <DialogHeader
                  icon={<Handshake weight="bold" />}
                  title={editingPartner ? 'Edit Partner / MOU' : 'Add New Partner / MOU'}
                  description="Register collaboration details, contacts, and agreement terms"
                  onClose={() => setIsAddModalOpen(false)}
                  closeLabel="Close Partner Form"
                />

                {/* Form Body */}
                <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
                <DialogBody className="space-y-4 text-xs sm:p-5">
                  {/* Section 1: Institution & Brand */}
                  <div className="space-y-3 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">1. Institution & Brand Identity</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelClass}>Legal / Organization Name *</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Korea National Sport University"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Brand / Display Name</span>
                        <input
                          type="text"
                          placeholder="e.g. KNSU Taekwondo"
                          value={formData.brandName || ''}
                          onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className={labelClass}>Collaboration Type</span>
                        <select
                          value={formData.partnerType}
                          onChange={(e) => setFormData({ ...formData, partnerType: e.target.value as PartnerType })}
                          className={cn(fieldClass, 'cursor-pointer font-bold')}
                        >
                          {PARTNER_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={labelClass}>Status</span>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as PartnerStatus })}
                          className={cn(fieldClass, 'cursor-pointer font-bold')}
                        >
                          {PARTNER_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={labelClass}>Country / Region</span>
                        <input
                          type="text"
                          placeholder="e.g. Cambodia, South Korea"
                          value={formData.country || ''}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className={labelClass}>Logo URL</span>
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={formData.logoUrl || ''}
                        onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                        className={fieldClass}
                      />
                    </label>

                    <label className="block">
                      <span className={labelClass}>MOU / Collaboration Scope</span>
                      <textarea
                        rows={3}
                        placeholder="Key deliverables, student training camps, referee certifications..."
                        value={formData.collaborationScope || ''}
                        onChange={(e) => setFormData({ ...formData, collaborationScope: e.target.value })}
                        className={cn(fieldClass, 'resize-none py-3 leading-relaxed')}
                      />
                    </label>
                  </div>

                  {/* Section 2: Contact Persons & Telegram */}
                  <div className="space-y-3 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">2. Working Contacts & Telegram (Liaison)</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelClass}>Contact Manager / Liaison Name</span>
                        <input
                          type="text"
                          placeholder="e.g. Sokha Mean"
                          value={formData.contactName || ''}
                          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Contact Title / Role</span>
                        <input
                          type="text"
                          placeholder="e.g. Partnership Director"
                          value={formData.contactRole || ''}
                          onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className={labelClass}><span className="text-[#229ED9] font-bold">✈ Telegram Username</span></span>
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
                          className={fieldClass}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Phone / Mobile</span>
                        <input
                          type="tel"
                          placeholder="e.g. +855 12 345 678"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Email / Gmail</span>
                        <input
                          type="email"
                          placeholder="partner@example.com"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <label className="block">
                        <span className={labelClass}>Founder / President Name</span>
                        <input
                          type="text"
                          placeholder="e.g. Grandmaster Kim"
                          value={formData.founderName || ''}
                          onChange={(e) => setFormData({ ...formData, founderName: e.target.value })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Website URL</span>
                        <input
                          type="text"
                          placeholder="https://example.com"
                          value={formData.websiteUrl || ''}
                          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Section 3: MOU Agreement & Validity */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] uppercase font-bold text-[#EF2F38] tracking-wider">3. Agreement Dates & Document Ref</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelClass}>MOU Signed Date</span>
                        <input
                          type="date"
                          value={formData.mouSignedDate || ''}
                          onChange={(e) => setFormData({ ...formData, mouSignedDate: e.target.value })}
                          className={cn(fieldClass, 'font-mono')}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>MOU Expiry / Renewal Date</span>
                        <input
                          type="date"
                          value={formData.mouExpiryDate || ''}
                          onChange={(e) => setFormData({ ...formData, mouExpiryDate: e.target.value })}
                          className={cn(fieldClass, 'font-mono')}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className={labelClass}>Contract Document URL (Google Drive / PDF)</span>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/file/d/..."
                        value={formData.contractDocumentUrl || ''}
                        onChange={(e) => setFormData({ ...formData, contractDocumentUrl: e.target.value })}
                        className={fieldClass}
                      />
                    </label>

                    {/* Tags input */}
                    <div>
                      <label htmlFor="partner-tag-input" className={labelClass}>Tags (press Enter to add)</label>
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {formData.tags?.map(t => (
                          <span key={t} className="px-2.5 py-1 rounded-md bg-control border border-line text-ink text-[11px] flex items-center gap-1">
                            <span>#{t}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t)}
                              aria-label={`Remove tag ${t}`}
                              className="-my-1 -mr-1.5 size-7 pointer-coarse:size-9 flex items-center justify-center text-ink-subtle hover:text-red-500 rounded touch-manipulation cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="partner-tag-input"
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
                          className={cn(fieldClass, 'flex-1')}
                        />
                        <button type="button" onClick={handleAddTag} className={buttonClass()}>
                          Add Tag
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className={labelClass}>Internal Notes</span>
                      <textarea
                        rows={3}
                        placeholder="Internal communication history, renewal terms, reminders..."
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className={cn(fieldClass, 'resize-none py-3 leading-relaxed')}
                      />
                    </label>
                  </div>
                </DialogBody>

                {/* Actions stay visible while the long form scrolls */}
                <DialogFooter>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} disabled={isSaving} className={buttonClass()}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className={buttonClass({ variant: 'primary' })}>
                    <span>{isSaving ? 'Saving…' : editingPartner ? 'Update Partner' : 'Save Partner'}</span>
                  </button>
                </DialogFooter>
                </form>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
