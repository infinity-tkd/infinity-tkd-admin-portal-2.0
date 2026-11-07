'use client';
import { copyText } from '@/lib/clipboard';
import {useModalFocus} from '@/hooks/use-modal-focus';
import React, { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { FileCsv } from '@phosphor-icons/react/dist/csr/FileCsv';
import { Checks } from '@phosphor-icons/react/dist/csr/Checks';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { cn, normalizeCategory, getCategoryTranslationKey, getYouTubeId } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import Papa from 'papaparse';
import { runImportRows, validateImportSize, importFailureCsv, ImportFailure, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '@/lib/imports';
import { TKD_CATEGORIES, FITNESS_CATEGORIES, DANCE_CATEGORIES, BELTS, getBeltTranslationKey } from '@/lib/library-catalog';
import { canonicalImportBelt, validateLibraryImportRecord, validateLibraryImportRows, type LibraryImportRecord } from '@/lib/library-import';

interface BulkImportAssetModalProps {
  activeTab: 'tkd' | 'fitness' | 'dance' | 'routines';
  onClose: () => void;
}

interface ParsedAssetRow {
  index: number;
  data: {
    title: string;
    description: string;
    category: string;
    minBeltLevel: string;
    videoUrl: string;
  };
  errors: string[];
  isValid: boolean;
}

export function BulkImportAssetModal({ activeTab, onClose }: BulkImportAssetModalProps) {
  const { state, addCurriculumVideo, showNotification } = useAppStore();
  const t = useT();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,()=>{if(!isProcessing)onClose();});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const completedImports=useRef(new Set<string>());
  const importRunning=useRef(false);
  const [importFailures,setImportFailures]=useState<ImportFailure[]>([]);
  const downloadImportFailures=()=>{
    const errors=[...parsedRows.filter(r=>!r.isValid).map(r=>({row:r.index,message:r.errors.join('; ')})),...importFailures];
    const url=URL.createObjectURL(new Blob([importFailureCsv(errors)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='library-import-errors.csv';link.click();URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvHeaders = activeTab === 'tkd' 
    ? "Title,Description,Category,Target Belt,Video URL"
    : "Title,Description,Category,Video URL";

  const csvExampleRow = activeTab === 'tkd'
    ? "Taegeuk Il Jang, WT First Taekwondo pattern for beginners,Poomsae,White,https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view"
    : "Box Squats,Explosive power and leg strengthening exercises,Strength,https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view";

  const handleCopyTemplate = async () => {
    if (!(await copyText(`${csvHeaders}\n${csvExampleRow}`))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddManualRow = () => {
    if(parsedRows.length>=MAX_IMPORT_ROWS){showNotification('Import at most 500 rows per batch.','warning');return;}
    const nextIndex = parsedRows.length > 0 ? Math.max(...parsedRows.map(r => r.index)) + 1 : 1;
    const newEmptyRow: ParsedAssetRow = {
      index: nextIndex,
      data: {
        title: '',
        description: '',
        category: activeTab === 'tkd' ? 'Forms (Poomsae)' : activeTab === 'dance' ? 'Dance: Hiphop' : 'Strength',
        minBeltLevel: activeTab === 'tkd' ? 'White' : activeTab === 'dance' ? 'Dance' : 'Fitness',
        videoUrl: ''
      },
      errors: ['Title and description are required.'],
      isValid: false
    };
    setParsedRows(prev => [...prev, newEmptyRow]);
  };

  const headerMap: Record<string, string> = {
    'title': 'title',
    'asset title': 'title',
    'asset_title': 'title',
    'name': 'title',
    'description': 'description',
    'details': 'description',
    'guidelines': 'description',
    'category': 'category',
    'subcategory': 'category',
    'type': 'category',
    'belt': 'minBeltLevel',
    'belt level': 'minBeltLevel',
    'belt_level': 'minBeltLevel',
    'target belt': 'minBeltLevel',
    'target_belt': 'minBeltLevel',
    'video url': 'videoUrl',
    'video_url': 'videoUrl',
    'videourl': 'videoUrl',
    'link': 'videoUrl',
    'video link': 'videoUrl',
    'video_link': 'videoUrl'
  };

  // Matches the save API: HTTPS-only links, title length, known categories and belts,
  // no repeat of an existing lesson, and (across rows) no repeat within this import.
  const validateRecord = (data: LibraryImportRecord): string[] => validateLibraryImportRecord(data, activeTab, state.curriculumVideos);
  const revalidate = (rows: ParsedAssetRow[]) => validateLibraryImportRows(rows, validateRecord);

  const handleProcessCSV = (textToParse: string) => {
    if(importRunning.current)return;
    try {validateImportSize(textToParse);}catch(error){setParsedRows([]);showNotification(error instanceof Error?error.message:'Import is too large.','error');return;}
    completedImports.current.clear();setImportFailures([]);setImportSummary(null);
    if (!textToParse.trim()) {
      setParsedRows([]);
      return;
    }

    const parsed=Papa.parse<string[]>(textToParse,{skipEmptyLines:'greedy'});
    if(parsed.errors.length){setParsedRows([]);showNotification('CSV could not be read: '+parsed.errors[0].message,'error');return;}
    const lines=parsed.data;
    try {validateImportSize('',Math.max(0,lines.length-1));}catch(error){setParsedRows([]);showNotification(error instanceof Error?error.message:'Too many rows.','error');return;}
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const rawHeaders = lines[0];
    const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim());
    const matchedFields = normalizedHeaders.map(h => headerMap[h] || h);

    const rows: ParsedAssetRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i];
      if (values.length === 1 && values[0] === '') continue;

      const rawData: any = {};
      matchedFields.forEach((field, index) => {
        if (field) {
          rawData[field] = values[index] || '';
        }
      });

      const defaultCategory = activeTab === 'tkd' 
        ? 'Forms (Poomsae)' 
        : activeTab === 'dance' 
        ? 'Dance: Hiphop' 
        : 'Strength';

      let parsedCategory = (rawData.category || defaultCategory).trim();
      if (activeTab === 'tkd') {
        parsedCategory = normalizeCategory(parsedCategory);
      } else if (activeTab === 'dance') {
        const cleanCat = parsedCategory.replace('Dance: ', '').trim().toLowerCase();
        if (cleanCat === 'hiphop') parsedCategory = 'Dance: Hiphop';
        else if (cleanCat === 'popping') parsedCategory = 'Dance: Popping';
        else if (cleanCat === 'tutorials') parsedCategory = 'Dance: Tutorials';
        else if (cleanCat === 'resources') parsedCategory = 'Dance: Resources';
        else parsedCategory = 'Dance: Hiphop';
      }

      const parsedData = {
        title: (rawData.title || '').trim(),
        description: (rawData.description || '').trim(),
        category: parsedCategory,
        minBeltLevel: activeTab === 'tkd'
          ? canonicalImportBelt(rawData.minBeltLevel || 'White')
          : activeTab === 'dance' 
          ? 'Dance' 
          : 'Fitness',
        videoUrl: (rawData.videoUrl || '').trim()
      };

      const errors = validateRecord(parsedData);

      rows.push({
        index: i,
        data: parsedData,
        errors,
        isValid: errors.length === 0
      });
    }

    setParsedRows(revalidate(rows));
  };

  const handleEditRow = (index: number, field: string, value: any) => {
    // Revalidate every row: an edit can create or clear a duplicate elsewhere in the batch.
    setParsedRows(prev => revalidate(prev.map(row => row.index !== index ? row : { ...row, data: { ...row.data, [field]: value } })));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if(importRunning.current)return;
    if(file.size>MAX_IMPORT_BYTES){showNotification('Import files must be 2 MB or smaller.','error');return;}
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      handleProcessCSV(text);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(e.target.value);
    handleProcessCSV(e.target.value);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      processFile(file);
    }
  };

  const handleStartImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0 || importRunning.current) return;
    importRunning.current=true;

    setIsProcessing(true);
    setImportSummary(null);
    setCurrentIndex(0);

    try {
      const summary=await runImportRows(validRows,completedImports.current,async row=>{

      let categoryToSave = row.data.category;
      let beltToSave = row.data.minBeltLevel;

      if (activeTab === 'fitness') {
        categoryToSave = `Fitness: ${row.data.category}`;
        beltToSave = 'Fitness';
      } else if (activeTab === 'dance') {
        categoryToSave = row.data.category;
        beltToSave = 'Dance';
      }

      // Auto-resolve YouTube high-res thumbnail cover if omitted
      const ytId = getYouTubeId(row.data.videoUrl);
      let resolvedThumbnail = '';
      if (ytId) {
        resolvedThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }

      const descriptionJson = JSON.stringify({
        text: row.data.description,
        difficulty: 'Beginner',
        instructions: [],
        focusZones: [],
        repsSets: '',
        thumbnailUrl: resolvedThumbnail,
        actualCategory: categoryToSave,
        principles: [],
        prerequisites: [],
        drillingMethods: [],
        mistakes: [],
        performance: [],
        fitnessSolutions: []
      });

      try {
        await addCurriculumVideo({
          title: row.data.title,
          description: descriptionJson,
          category: categoryToSave,
          minBeltLevel: beltToSave,
          videoUrl: row.data.videoUrl || undefined
        });
        return {success:true};
      } catch (err) {
        return {success:false,error:err instanceof Error?err.message:'Asset save failed.'};
      }
      },done=>setCurrentIndex(done));
      setImportFailures(summary.failures);setImportSummary({success:summary.success,failed:summary.failed});
    }catch(error){showNotification(error instanceof Error?error.message:'Import failed.','error');}
    finally {importRunning.current=false;setIsProcessing(false);}
  };

  const totalValid = parsedRows.filter(r => r.isValid).length;
  const totalErrors = parsedRows.filter(r => !r.isValid).length;

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Import learning materials" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        .bulk-table-control {
          background-color: transparent !important;
          border: 1px solid transparent !important;
          color: #111827 !important;
        }
        .dark .bulk-table-control {
          color: #FFFFFF !important;
          background-color: transparent !important;
          border-color: transparent !important;
        }
        .bulk-table-control:hover {
          background-color: #F3F4F6 !important;
          border-color: #E5E7EB !important;
        }
        .dark .bulk-table-control:hover {
          background-color: rgba(38, 38, 38, 0.3) !important;
          border-color: rgba(63, 63, 70, 0.4) !important;
        }
        .bulk-table-control:focus {
          background-color: #FFFFFF !important;
          border-color: #EF2F38 !important;
          box-shadow: 0 0 0 1px rgba(239, 47, 56, 0.3) !important;
        }
        .dark .bulk-table-control:focus {
          background-color: #0F0F0F !important;
          border-color: #EF2F38 !important;
          box-shadow: 0 0 0 1px rgba(239, 47, 56, 0.3) !important;
        }
      `}} />
      <div className="w-full max-w-5xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl flex flex-col my-8 max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white">

        {/* Header */}
        <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F]">
          <div className="flex items-center gap-2.5">
            <FileCsv className="w-6 h-6 text-[#EF2F38]" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-white">{t('lib_bulk_title')}</h2>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('lib_bulk_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHelp(true)} 
              className="p-2 min-h-[36px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] text-neutral-600 dark:text-[#999] hover:text-neutral-950 dark:hover:text-white hover:border-neutral-300 dark:hover:border-[#444] transition-all flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 cursor-pointer active:scale-95 touch-manipulation"
            >
              <Question className="w-3.5 h-3.5" /> {t('bulk_tutorial_btn')}
            </button>
            <button 
              disabled={isProcessing} onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors active:scale-95 touch-manipulation cursor-pointer"
              title={t('act_close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-[#0A0A0A]">
          {/* Phase 1: Upload or Paste */}
          {!importSummary && !isProcessing && parsedRows.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drag and Drop File Selector */}
              <div 
                onClick={() => fileInputRef.current?.click()} 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed border-neutral-300 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#141414]/50 rounded-[8px] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#EF2F38]/40 dark:hover:border-[#EF2F38]/40 hover:bg-neutral-100/60 dark:hover:bg-[#181818]/60 transition-all group relative overflow-hidden",
                  fileName && "border-[#EF2F38]/30 bg-[#EF2F38]/[0.02]",
                  isDragging && "border-[#EF2F38] bg-[#EF2F38]/[0.05] scale-[0.99] shadow-inner"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv,.txt" 
                  className="hidden" 
                />
                <div className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 mb-4 group-hover:scale-105 transition-transform text-neutral-600 dark:text-white shadow-sm">
                  <UploadSimple className={cn("w-5 h-5", isDragging && "animate-bounce")} />
                </div>
                {fileName ? (
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white font-mono truncate max-w-[280px]">{fileName}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-500 font-mono mt-1 uppercase tracking-widest font-black">{t('lib_bulk_file_loaded')}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">{t('lib_bulk_drag_drop')}</p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono leading-relaxed">{t('lib_bulk_drag_drop_desc')}</p>
                  </div>
                )}
                <AnimatePresence>
                  {isDragging && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#EF2F38]/[0.08] backdrop-blur-[1px] flex items-center justify-center pointer-events-none"
                    >
                      <span className="text-[#EF2F38] font-bold uppercase tracking-widest text-xs border border-[#EF2F38] bg-white dark:bg-black px-4 py-2 rounded-full shadow-lg">{t('lib_bulk_drop_here')}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Paste Area */}
              <div className="flex flex-col space-y-2">
                <label className="block text-[11px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_paste_label')}</label>
                <textarea 
                  value={csvText} 
                  onChange={handlePasteChange}
                  placeholder={activeTab === 'tkd'
                    ? "Title,Description,Category,Target Belt,Video URL\nTaegeuk Ee Jang,Second Taekwondo Form,Poomsae,Yellow,https://..."
                    : "Push Ups,Standard core upper body pushing,Strength,https://..."
                  }
                  className="w-full h-[154px] bg-neutral-50 dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/25 resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-all shadow-inner"
                />
              </div>

              {/* Manual spreadsheet grid entry */}
              <div className="col-span-1 md:col-span-2 border border-dashed border-neutral-300 dark:border-[#262626] bg-neutral-50/30 dark:bg-[#141414]/30 rounded-[8px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shrink-0 shadow-sm">
                    <PencilSimple className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('lib_bulk_manual_grid')}</p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">{t('lib_bulk_manual_grid_desc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-widest rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-md shrink-0"
                >
                  {t('lib_bulk_add_row')}
                </button>
              </div>
            </div>
          )}

          {/* Live spreadsheet Verification table */}
          {parsedRows.length > 0 && !isProcessing && !importSummary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {t('lib_bulk_verify_title')}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="px-3.5 py-1.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5"/> {t('lib_bulk_add_row')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setCsvText('');
                      setFileName('');
                    }}
                    className="px-3.5 py-1.5 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#262626] text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5"/> Clear & Restart
                  </button>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-[8px]">
                    {totalValid} {t('lib_bulk_ready_to_import')}
                  </span>
                  {totalErrors > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 px-2.5 py-0.5 rounded-[8px] animate-pulse">
                      {totalErrors} {t('lib_bulk_errors_found')}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1 font-mono font-semibold">
                <PencilSimple className="w-3.5 h-3.5 text-[#EF2F38]" /> {t('lib_bulk_verify_desc')}
              </div>

              <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] max-h-[350px] overflow-auto">
                <table className="w-full text-left text-xs border-collapse min-w-max">
                  <thead className="bg-neutral-100 dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 uppercase tracking-wider font-mono text-[10px] sticky top-0 z-10">
                    <tr className="border-b border-neutral-200 dark:border-[#262626]">
                      <th className="px-4 py-3 w-16 text-center">{t('lib_bulk_row_label')}</th>
                      <th className="px-4 py-3 min-w-[200px]">{t('lib_bulk_title_col')}</th>
                      <th className="px-4 py-3 min-w-[300px]">{t('lib_bulk_desc_col')}</th>
                      <th className="px-4 py-3 min-w-[140px] w-40">{t('lib_bulk_category_col')}</th>
                      {activeTab === 'tkd' && <th className="px-4 py-3 min-w-[140px] w-40">{t('lib_bulk_belt_col')}</th>}
                      <th className="px-4 py-3 min-w-[250px]">{t('lib_bulk_link_col')}</th>
                      <th className="px-4 py-3 min-w-[180px]">{t('lib_bulk_status_col')}</th>
                      <th className="px-4 py-3 w-20 text-center">{t('lib_bulk_action_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-[#141414]">
                    {parsedRows.map((row) => (
                      <tr key={row.index} className={cn(
                        "hover:bg-neutral-100 dark:hover:bg-[#1C1C1C]/40 transition-colors",
                        !row.isValid && "bg-red-500/[0.02] dark:bg-red-500/[0.01]"
                      )}>
                        <td className="px-4 py-3 font-mono text-neutral-500 dark:text-neutral-400 text-center font-bold">{row.index}</td>

                        {/* Title Input */}
                        <td className="px-3 py-2 min-w-[200px]">
                          <input 
                            type="text" 
                            value={row.data.title} 
                            onChange={e => handleEditRow(row.index, 'title', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                          />
                        </td>

                        {/* Description Input */}
                        <td className="px-3 py-2 min-w-[300px]">
                          <input 
                            type="text" 
                            value={row.data.description} 
                            onChange={e => handleEditRow(row.index, 'description', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-semibold"
                          />
                        </td>

                        {/* Category Select */}
                        <td className="px-3 py-2 min-w-[140px] w-40">
                          <select 
                            value={row.data.category} 
                            onChange={e => handleEditRow(row.index, 'category', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                          >
                            {activeTab === 'tkd' ? (
                              TKD_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            ) : activeTab === 'dance' ? (
                              DANCE_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')}</option>)
                            ) : (
                              FITNESS_CATEGORIES.map(c => <option key={c} value={c} className="text-black dark:text-white dark:bg-neutral-900">{t(getCategoryTranslationKey(c)) || c}</option>)
                            )}
                          </select>
                        </td>

                        {/* Target Belt Select */}
                        {activeTab === 'tkd' && (
                          <td className="px-3 py-2 min-w-[140px] w-40">
                            <select 
                              value={row.data.minBeltLevel} 
                              onChange={e => handleEditRow(row.index, 'minBeltLevel', e.target.value)}
                              className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-bold"
                            >
                              {BELTS.slice(1).map(b => <option key={b} value={b} className="text-black dark:text-white dark:bg-neutral-900">{t(getBeltTranslationKey(b))}</option>)}
                            </select>
                          </td>
                        )}

                        {/* Video URL Input */}
                        <td className="px-3 py-2 min-w-[250px]">
                          <input 
                            type="text" 
                            value={row.data.videoUrl} 
                            onChange={e => handleEditRow(row.index, 'videoUrl', e.target.value)}
                            className="w-full bulk-table-control rounded px-2 py-1 text-xs focus:outline-none transition-all font-mono"
                          />
                        </td>

                        {/* Errors / Status Column */}
                        <td className="px-4 py-3 min-w-[180px]">
                          {row.isValid ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> {t('lib_bulk_verified')}</span>
                          ) : (
                            <div className="space-y-0.5">
                              {row.errors.map((err, idx) => (
                                <span key={idx} className="text-[9px] font-semibold text-red-500 block leading-tight">• {err}</span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Delete Row Action */}
                        <td className="px-4 py-3 text-center">
                          <button 
                            type="button"
                            onClick={() => setParsedRows(prev => revalidate(prev.filter(r => r.index !== row.index)))}
                            className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash className="w-4 h-4"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 3: Controlled Progress Screen */}
          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-neutral-100 dark:border-neutral-800 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#EF2F38] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <FileCsv className="w-6 h-6 text-[#EF2F38] animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{t('lib_bulk_uploading')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1 font-semibold">{t('lib_bulk_processing_record').replace('{current}', String(currentIndex)).replace('{total}', String(parsedRows.filter(r => r.isValid).length))}</p>
              </div>
            </div>
          )}

          {/* Phase 4: Import Summary */}
          {importFailures.length>0 && <button type="button" onClick={downloadImportFailures} className="min-h-11 rounded border px-3 text-xs">Download failed rows</button>}
          {importSummary && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <Checks className="w-8 h-8"/>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider">{t('lib_bulk_completed_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">{t('lib_bulk_completed_desc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                  <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_successful')}</span>
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{importSummary.success}</span>
                </div>
                <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                  <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">{t('lib_bulk_failed')}</span>
                  <span className="text-2xl font-black font-mono text-red-500">{importSummary.failed}</span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  setImportSummary(null);
                  setParsedRows([]);
                  setCsvText('');
                  setFileName('');
                  onClose();
                }}
                className="px-6 py-2.5 bg-neutral-950 dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-[10px] rounded-[8px] hover:opacity-90 transition-all shadow-sm"
              >
                {t('lib_bulk_close_wizard')}
              </button>
            </div>
          )}
        </div>

        {/* Footer controls */}
        {!importSummary && !isProcessing && (
          <div className="p-4 md:p-5 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row justify-between items-center gap-3 bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
            <button 
              type="button" 
              onClick={handleCopyTemplate}
              className="w-full sm:w-auto px-4 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold uppercase tracking-wider text-[10px] rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5"/> {copied ? "Copied!" : t('lib_bulk_copy_template')}
            </button>
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button 
                type="button" 
                onClick={() => {
                  setParsedRows([]);
                  setCsvText('');
                  setFileName('');
                  onClose();
                }} 
                className="flex-1 sm:flex-initial px-5 py-2 min-h-[40px] bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-all active:scale-95 touch-manipulation cursor-pointer"
              >
                {t('lib_bulk_cancel')}
              </button>
              <button 
                type="button" 
                onClick={handleStartImport}
                disabled={totalValid === 0}
                className={cn(
                  "flex-1 sm:flex-initial px-5 py-2 min-h-[40px] text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 touch-manipulation cursor-pointer",
                  totalValid === 0 
                    ? "bg-neutral-300 dark:bg-[#262626] text-neutral-400 dark:text-neutral-600 border-transparent cursor-not-allowed shadow-none" 
                    : "bg-[#EF2F38] hover:bg-[#d6262f] shadow-[#EF2F38]/20"
                )}
              >
                {t('lib_bulk_import_btn').replace('{count}', String(totalValid))}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scoped Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] shadow-2xl p-6 text-neutral-900 dark:text-white max-h-[85dvh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-3 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-neutral-800 dark:text-white">
                  <Question className="w-4.5 h-4.5 text-[#EF2F38]"/> {t('bulk_tutorial_title')}
                </h3>
                <button 
                  onClick={() => setShowHelp(false)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                  title={t('act_close')}
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="text-xs space-y-4 leading-relaxed text-neutral-600 dark:text-neutral-300">
                <p>{t('lib_bulk_tutorial_desc')}</p>
                <ul className="space-y-2 list-disc pl-4 font-semibold text-neutral-700 dark:text-neutral-200">
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_title_col').replace(' *', '')} *</strong>: Required. Syllabus movement or exercise name.
                  </li>
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_desc_col').replace(' *', '')} *</strong>: Required. Details, mechanics, focus zones.
                  </li>
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_category_col')}</strong>: Optional. Defaults to Poomsae or Strength. Valid options:
                    {activeTab === 'tkd' 
                      ? " " + TKD_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c).join(', ')
                      : activeTab === 'dance'
                      ? " " + DANCE_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c.replace('Dance: ', '')).join(', ')
                      : " " + FITNESS_CATEGORIES.map(c => t(getCategoryTranslationKey(c)) || c).join(', ')
                    }
                  </li>
                  {activeTab === 'tkd' && (
                    <li>
                      <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_belt_col')}</strong>: Optional. Valid values: {BELTS.slice(1).map(b => t(getBeltTranslationKey(b))).join(', ')}. Defaults to White.
                    </li>
                  )}
                  <li>
                    <strong className="text-neutral-900 dark:text-white font-mono">{t('lib_bulk_link_col').replace('Google Drive / ', '')}</strong>: Optional Google Drive share link or YouTube link.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

