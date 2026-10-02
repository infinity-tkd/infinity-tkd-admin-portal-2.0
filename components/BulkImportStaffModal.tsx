'use client';

import React, { useState, useRef } from 'react';
import { useAppStore, User, Role } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UploadSimple, Question, Info, Checks, Warning, Copy, Trash, Play, CheckCircle
} from '@phosphor-icons/react';
import { cn, sanitizeStringInput, isValidEmail, isValidPhone, isValidDate } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';

interface BulkImportStaffModalProps {
  onClose: () => void;
}

interface ParsedStaffRow {
  index: number;
  data: {
    displayName: string;
    username: string;
    email: string;
    role: Role;
    phone: string;
    khmerName: string;
    gender: 'Male' | 'Female';
    dob: string;
    profilePicturePath: string;
    isActive: boolean;
  };
  errors: string[];
  isValid: boolean;
}

export function BulkImportStaffModal({ onClose }: BulkImportStaffModalProps) {
  const { addUser, state, showNotification } = useAppStore();
  const t = useT();
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedStaffRow[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseClipboard(text);
    };
    reader.readAsText(file);
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

  // Template headers & example data for clipboard
  const csvHeaders = "Display Name,Username,Email,Role,Phone,Khmer Name,Gender,Date of Birth,Profile Picture Path,Active Status";
  const csvExampleRow = "Keo Dara,dara_coach,dara@infinitytkd.com,Coach,012999888,កែវ ដារ៉ា,Male,1995-04-20,,True";
  
  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(`${csvHeaders}\n${csvExampleRow}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manual row addition and table pasting handlers are defined below validateRow

  const headerMap: Record<string, string> = {
    'display name': 'displayName',
    'display_name': 'displayName',
    'name': 'displayName',
    'full name': 'displayName',
    'fullname': 'displayName',
    'username': 'username',
    'user name': 'username',
    'user_name': 'username',
    'email': 'email',
    'role': 'role',
    'phone': 'phone',
    'phone number': 'phone',
    'phone_number': 'phone',
    'khmer name': 'khmerName',
    'khmer_name': 'khmerName',
    'khmername': 'khmerName',
    'gender': 'gender',
    'sex': 'gender',
    'date of birth': 'dob',
    'dob': 'dob',
    'date_of_birth': 'dob',
    'profile picture path': 'profilePicturePath',
    'profile_picture_path': 'profilePicturePath',
    'photo': 'profilePicturePath',
    'active': 'isActive',
    'active status': 'isActive',
    'active_status': 'isActive',
    'status': 'isActive'
  };

  const validateRow = (data: any): string[] => {
    const errors: string[] = [];
    if (!data.displayName || !data.displayName.trim()) {
      errors.push('Display name is required.');
    }
    if (!data.username || !data.username.trim()) {
      errors.push('Username is required.');
    } else if (data.username.length < 3) {
      errors.push('Username must be at least 3 characters.');
    } else {
      // Check local unique constraint against store users
      const exists = state.users.some(u => u.username?.toLowerCase() === data.username.toLowerCase().trim());
      if (exists) {
        errors.push(`Username "${data.username}" is already in use.`);
      }
    }

    if (!data.email || !data.email.trim()) {
      errors.push('Email is required.');
    } else if (!isValidEmail(data.email)) {
      errors.push('Invalid email syntax.');
    } else {
      // Check local unique constraint
      const exists = state.users.some(u => u.email?.toLowerCase() === data.email.toLowerCase().trim());
      if (exists) {
        errors.push(`Email "${data.email}" is already registered.`);
      }
    }

    const validRoles: Role[] = ['Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Student'];
    if (data.role && !validRoles.includes(data.role)) {
      errors.push(`Invalid role type: "${data.role}".`);
    }

    if (data.phone && !isValidPhone(data.phone)) {
      errors.push('Invalid phone format.');
    }

    if (data.dob && !isValidDate(data.dob)) {
      errors.push('Invalid DOB date format (must be YYYY-MM-DD).');
    }

    return errors;
  };

  const createDefaultRow = (index: number): ParsedStaffRow => {
    return {
      index,
      data: {
        displayName: '',
        username: '',
        email: '',
        role: 'Coach',
        phone: '',
        khmerName: '',
        gender: 'Male',
        dob: '',
        profilePicturePath: '',
        isActive: true
      },
      errors: ['Display Name, Username, and Email are required.'],
      isValid: false
    };
  };

  const handleAddManualRow = () => {
    const nextIndex = parsedRows.length > 0 ? Math.max(...parsedRows.map(r => r.index)) + 1 : 1;
    setParsedRows(prev => [...prev, createDefaultRow(nextIndex)]);
  };

  const handleTablePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    const rowIndexAttr = target.getAttribute('data-row-index');
    const colFieldAttr = target.getAttribute('data-column-field');

    if (!rowIndexAttr || !colFieldAttr) return;

    const text = e.clipboardData.getData('text');
    
    // Check if it's a spreadsheet paste (contains tabs or newlines)
    const rawLines = text.split(/\r?\n/);
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }
    
    const isMultiCell = rawLines.length > 1 || rawLines[0].includes('\t');
    if (!isMultiCell) {
      // Allow default single cell text paste
      return;
    }

    // Prevent default browser paste behavior
    e.preventDefault();

    const startRowIndex = parseInt(rowIndexAttr);
    const startColField = colFieldAttr;

    const columnsOrdered = [
      'displayName',
      'username',
      'email',
      'role',
      'gender',
      'dob'
    ];

    const startColIndex = columnsOrdered.indexOf(startColField);
    if (startColIndex === -1) return;

    // Parse the paste grid
    const pasteGrid = rawLines.map(line => line.split('\t'));

    setParsedRows(prev => {
      const rowMap = new Map<number, ParsedStaffRow>();
      prev.forEach(row => {
        rowMap.set(row.index, { ...row, data: { ...row.data } });
      });

      let maxIndex = prev.length > 0 ? Math.max(...prev.map(r => r.index)) : 0;

      const sortedRows = [...prev].sort((a, b) => a.index - b.index);
      const startRowObj = sortedRows.find(r => r.index === startRowIndex);
      if (!startRowObj) return prev;
      
      const startSortedRowIndex = sortedRows.indexOf(startRowObj);

      for (let r = 0; r < pasteGrid.length; r++) {
        const gridRow = pasteGrid[r];
        let targetRowIndex: number;

        const sortedRowIndex = startSortedRowIndex + r;
        if (sortedRowIndex < sortedRows.length) {
          targetRowIndex = sortedRows[sortedRowIndex].index;
        } else {
          maxIndex++;
          targetRowIndex = maxIndex;
          rowMap.set(targetRowIndex, createDefaultRow(targetRowIndex));
        }

        const currentRow = rowMap.get(targetRowIndex)!;

        for (let c = 0; c < gridRow.length; c++) {
          const colFieldIdx = startColIndex + c;
          if (colFieldIdx >= columnsOrdered.length) break;

          const fieldName = columnsOrdered[colFieldIdx];
          const rawValue = gridRow[c];

          let value: any = rawValue.trim();

          if (fieldName === 'gender') {
            const lowerGender = value.toLowerCase();
            if (lowerGender === 'male' || lowerGender === 'm') {
              value = 'Male';
            } else if (lowerGender === 'female' || lowerGender === 'f') {
              value = 'Female';
            } else {
              value = 'Male';
            }
          } else if (fieldName === 'role') {
            const rNorm = value.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rNorm === 'root' || rNorm === 'superroot') value = 'Root';
            else if (rNorm === 'admin') value = 'Admin';
            else if (rNorm === 'headcoach') value = 'Head Coach';
            else if (rNorm === 'coach') value = 'Coach';
            else if (rNorm === 'assistantcoach') value = 'Assistant Coach';
            else if (rNorm === 'student') value = 'Student';
            else value = 'Coach';
          } else {
            value = sanitizeStringInput(value);
          }

          (currentRow.data as any)[fieldName] = value;
        }

        currentRow.errors = validateRow(currentRow.data);
        currentRow.isValid = currentRow.errors.length === 0;
      }

      return Array.from(rowMap.values()).sort((a, b) => a.index - b.index);
    });
  };

  const parseClipboard = (text: string) => {
    if (!text.trim()) return;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Detect separator (Tab or Comma)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';
    
    // Simple CSV parser supporting quotes
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(firstLine).map(h => h.toLowerCase().trim());
    const matchedFields = headers.map(h => headerMap[h] || h);

    const newRows: ParsedStaffRow[] = [];
    let startIdx = 1;

    // Determine if first row is a header or data
    const isHeader = headers.some(h => headerMap[h] !== undefined);
    if (!isHeader) {
      startIdx = 0;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const rowData: any = {
        displayName: '',
        username: '',
        email: '',
        role: 'Coach',
        phone: '',
        khmerName: '',
        gender: 'Male',
        dob: '',
        profilePicturePath: '',
        isActive: true
      };

      if (isHeader) {
        matchedFields.forEach((field, index) => {
          if (field && index < values.length) {
            let val: any = values[index];
            if (field === 'isActive') {
              val = val.toLowerCase() === 'true' || val === '1';
            }
            rowData[field] = val;
          }
        });
      } else {
        // Fallback positional indexing if no clear header
        if (values[0]) rowData.displayName = values[0];
        if (values[1]) rowData.username = values[1];
        if (values[2]) rowData.email = values[2];
        if (values[3]) rowData.role = values[3];
        if (values[4]) rowData.phone = values[4];
        if (values[5]) rowData.khmerName = values[5];
        if (values[6]) rowData.gender = values[6] === 'Female' ? 'Female' : 'Male';
        if (values[7]) rowData.dob = values[7];
      }

      // Format role cleanly
      if (rowData.role) {
        const rNorm = rowData.role.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (rNorm === 'root' || rNorm === 'superroot') rowData.role = 'Root';
        else if (rNorm === 'admin') rowData.role = 'Admin';
        else if (rNorm === 'headcoach') rowData.role = 'Head Coach';
        else if (rNorm === 'coach') rowData.role = 'Coach';
        else if (rNorm === 'assistantcoach') rowData.role = 'Assistant Coach';
        else if (rNorm === 'student') rowData.role = 'Student';
      }

      // Format gender
      if (rowData.gender) {
        rowData.gender = rowData.gender.toLowerCase().startsWith('f') ? 'Female' : 'Male';
      }

      const errors = validateRow(rowData);
      newRows.push({
        index: newRows.length + 1,
        data: rowData,
        errors,
        isValid: errors.length === 0
      });
    }

    setParsedRows(newRows);
    setCsvText('');
  };

  const handleUpdateCell = (rowIndex: number, field: string, value: any) => {
    setParsedRows(prev => prev.map(row => {
      if (row.index !== rowIndex) return row;
      const updatedData = { ...row.data, [field]: value };
      
      // Secondary fields dependent updates
      if (field === 'isActive' && typeof value === 'string') {
        updatedData.isActive = value === 'true';
      }

      const errors = validateRow(updatedData);
      return {
        ...row,
        data: updatedData,
        errors,
        isValid: errors.length === 0
      };
    }));
  };

  const handleDeleteRow = (rowIndex: number) => {
    setParsedRows(prev => prev.filter(r => r.index !== rowIndex));
  };

  const handleImportAll = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showNotification('There are no valid rows to import. Please resolve validation errors.', 'warning');
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(0);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      setCurrentIndex(i + 1);
      const row = validRows[i];
      
      const result = await addUser({
        username: row.data.username,
        email: row.data.email,
        displayName: row.data.displayName,
        role: row.data.role,
        isActive: row.data.isActive,
        khmerName: row.data.khmerName || undefined,
        englishName: row.data.displayName || undefined,
        gender: row.data.gender,
        dob: row.data.dob || undefined,
        phone: row.data.phone || undefined,
        profilePicturePath: row.data.profilePicturePath || undefined
      } as any);

      if (result && result.success) {
        successCount++;
      } else {
        console.error(`Row ${row.index} import failed:`, result?.error);
        failedCount++;
      }
    }

    setImportSummary({ success: successCount, failed: failedCount });
    setIsProcessing(false);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
        <div className="w-full max-w-4xl bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col max-h-[94dvh] overflow-hidden text-neutral-900 dark:text-white">
          
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
            <div className="flex items-center gap-2">
              <UploadSimple className="w-5 h-5 text-[#EF2F38]" weight="bold" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-neutral-900 dark:text-white font-mono">Bulk Account Importer</h2>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close modal"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50/50 dark:bg-[#0A0A0A] flex flex-col gap-6">
            
            {/* Template Clipboard Widget */}
            {!parsedRows.length && !importSummary && (
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-white">
                    <Info className="w-4 h-4 text-[#EF2F38]" weight="bold" />
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">How to import from Excel</span>
                  </div>
                  <button 
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-[10px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white uppercase font-bold tracking-widest flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <Question className="w-4 h-4" /> Help instructions
                  </button>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Prepare your spreadsheet roster with the correct headers, select all cells in Excel, and **Copy** (`Ctrl+C`). Then, click in the box below and **Paste** (`Ctrl+V`) to parse.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleCopyTemplate}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] hover:border-neutral-400 dark:hover:border-neutral-700 text-neutral-800 dark:text-white rounded-[8px] py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied to Clipboard!' : 'Copy Grid Template'}
                  </button>
                  <button 
                    onClick={handleAddManualRow}
                    className="flex-1 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[8px] py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-all shadow-md shadow-[#EF2F38]/20 cursor-pointer active:scale-95 touch-manipulation"
                  >
                    + Add row manually
                  </button>
                </div>

                {showHelp && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] text-[11px] text-neutral-600 dark:text-neutral-400 space-y-2 leading-relaxed font-mono">
                    <p className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[10px]">Important Rules:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Required Fields:</strong> Full Name, Username, and a unique Email are mandatory.</li>
                      <li><strong>Username:</strong> Must be alphanumeric, no spaces, minimum 3 characters.</li>
                      <li><strong>Roles Supported:</strong> <code>Admin</code>, <code>Head Coach</code>, <code>Coach</code>, <code>Assistant Coach</code>, <code>Student</code>.</li>
                      <li><strong>Date of Birth:</strong> Must follow `YYYY-MM-DD` (e.g. 1998-05-12).</li>
                    </ul>
                  </motion.div>
                )}
              </div>
            )}

            {/* Drag and Drop & Paste Area */}
            {!parsedRows.length && !importSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Drag and Drop File Selector */}
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#141414]/50 rounded-[8px] p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-red-500/40 hover:bg-neutral-50 dark:hover:bg-[#181818]/60 transition-all group relative overflow-hidden shadow-xs",
                    fileName && "border-red-500/30 bg-red-500/[0.02]",
                    isDragging && "border-red-500 bg-red-500/[0.05] scale-[0.99] shadow-inner"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".csv,.txt" 
                    className="hidden" 
                  />
                  <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center border border-neutral-200 dark:border-[#262626] mb-3 group-hover:scale-105 transition-transform text-neutral-800 dark:text-white shadow-xs">
                    <UploadSimple className={cn("w-5 h-5 text-[#EF2F38]", isDragging && "animate-bounce")} />
                  </div>
                  {fileName ? (
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white font-mono truncate max-w-[280px]">{fileName}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-green-500 font-mono mt-1 uppercase tracking-widest font-black">File Loaded Successfully</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white mb-1">Drag and drop file here, or click to browse</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono leading-relaxed">Supports CSV or plain text lists with standard column structures.</p>
                    </div>
                  )}
                  <AnimatePresence>
                    {isDragging && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-500/[0.08] backdrop-blur-[1px] flex items-center justify-center pointer-events-none"
                      >
                        <span className="text-red-500 font-bold uppercase tracking-widest text-xs border border-red-500 bg-white dark:bg-black px-4 py-2 rounded-full shadow-lg">Drop File Here!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Clipboard Paste Box */}
                <div className="flex flex-col space-y-2">
                  <label className="block text-[11px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">Or Paste Raw CSV Data</label>
                  <textarea 
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      parseClipboard(e.target.value);
                    }}
                    className="w-full h-full min-h-[154px] bg-white dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] transition-all resize-none shadow-inner placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                    placeholder="Click here and PASTE (Ctrl+V) your Excel column data...
Example:
Display Name   Username    Email                  Role    Phone
Keo Moni       moni_coach  moni@infinitytkd.com   Coach   012333444"
                  />
                </div>
              </div>
            )}

            {/* Grid Review Table */}
            {parsedRows.length > 0 && !importSummary && !isProcessing && (
              <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-sm">
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest font-mono">Review & Edit Imported Accounts</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">Correct any highlighted validation conflicts before committing roster</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleAddManualRow}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] text-[10px] font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                    >
                      + Add Row
                    </button>
                    <button 
                      onClick={() => setParsedRows([])}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-500 rounded-[8px] text-[10px] font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                    >
                      Reset Grid
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[40dvh]">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse min-w-[800px]">
                    <thead className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold sticky top-0 z-10 border-b border-neutral-200 dark:border-[#262626] font-mono text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5 w-12 text-center">Row</th>
                        <th className="px-4 py-2.5">Display Name *</th>
                        <th className="px-4 py-2.5">Username *</th>
                        <th className="px-4 py-2.5">Email *</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5 w-24">Gender</th>
                        <th className="px-4 py-2.5 w-32">DOB</th>
                        <th className="px-4 py-2.5 w-12 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody 
                      onPaste={handleTablePaste}
                      className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#141414]"
                    >
                      {parsedRows.map((row) => (
                        <tr key={row.index} className={cn("hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors", !row.isValid && "bg-red-500/5")}>
                          <td className="px-4 py-2.5 text-center font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                            {!row.isValid ? (
                              <span title={row.errors.join('\n')}>
                                <Warning className="w-4 h-4 text-red-500 inline-block" />
                              </span>
                            ) : (
                              row.index
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <input 
                              type="text" 
                              value={row.data.displayName} 
                              onChange={(e) => handleUpdateCell(row.index, 'displayName', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="displayName"
                              className={cn(
                                "w-full bg-neutral-50 dark:bg-[#0F0F0F] border text-xs px-2 py-1 rounded-[6px] focus:outline-none text-neutral-900 dark:text-white font-medium",
                                !row.data.displayName.trim() ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-[#262626] focus:border-[#EF2F38]"
                              )}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input 
                              type="text" 
                              value={row.data.username} 
                              onChange={(e) => handleUpdateCell(row.index, 'username', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="username"
                              className={cn(
                                "w-full bg-neutral-50 dark:bg-[#0F0F0F] border text-xs px-2 py-1 rounded-[6px] focus:outline-none font-mono text-neutral-900 dark:text-white",
                                !row.data.username.trim() || row.data.username.length < 3 ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-[#262626] focus:border-[#EF2F38]"
                              )}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input 
                              type="email" 
                              value={row.data.email} 
                              onChange={(e) => handleUpdateCell(row.index, 'email', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="email"
                              className={cn(
                                "w-full bg-neutral-50 dark:bg-[#0F0F0F] border text-xs px-2 py-1 rounded-[6px] focus:outline-none font-mono text-neutral-900 dark:text-white",
                                !isValidEmail(row.data.email) ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-[#262626] focus:border-[#EF2F38]"
                              )}
                            />
                          </td>
                          <td className="px-2 py-1 w-40">
                            <select 
                              value={row.data.role} 
                              onChange={(e) => handleUpdateCell(row.index, 'role', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="role"
                              className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs px-2 py-1 rounded-[6px] focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-mono cursor-pointer"
                            >
                              <option value="Admin">Admin</option>
                              <option value="Head Coach">Head Coach</option>
                              <option value="Coach">Coach</option>
                              <option value="Assistant Coach">Assistant Coach</option>
                              <option value="Student">Student</option>
                            </select>
                          </td>
                          <td className="px-2 py-1 w-24">
                            <select 
                              value={row.data.gender} 
                              onChange={(e) => handleUpdateCell(row.index, 'gender', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="gender"
                              className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs px-2 py-1 rounded-[6px] focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white font-mono cursor-pointer"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </td>
                          <td className="px-2 py-1 w-32">
                            <input 
                              type="date" 
                              value={row.data.dob} 
                              onChange={(e) => handleUpdateCell(row.index, 'dob', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="dob"
                              className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs px-2 py-1 rounded-[6px] focus:outline-none focus:border-[#EF2F38] text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] font-mono"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button 
                              onClick={() => handleDeleteRow(row.index)}
                              className="text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Delete row"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedRows.some(r => !r.isValid) && (
                  <div className="p-3.5 bg-red-500/10 border-t border-neutral-200 dark:border-[#262626] text-[11px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider flex items-start gap-2 font-mono">
                    <Warning className="w-4 h-4 shrink-0 text-red-500" />
                    <div>
                      <span>Rows with errors will be bypassed. Hover over the warning icons on the left to see error details and fix them inline.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Spinner Progress Screen */}
            {isProcessing && (
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-8 sm:p-12 text-center flex flex-col items-center gap-5 justify-center flex-grow shadow-xs">
                <div className="w-14 h-14 relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
                  <UploadSimple className="w-6 h-6 text-[#EF2F38]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white font-mono">Importing Staff Roster</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Account provision progress: <span className="font-mono text-neutral-900 dark:text-white font-bold">{currentIndex}</span> of <span className="font-mono text-neutral-900 dark:text-white font-bold">{parsedRows.filter(r => r.isValid).length}</span>
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-48 bg-neutral-100 dark:bg-[#0F0F0F] h-2 rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]">
                  <div className="h-full bg-[#EF2F38] rounded-full transition-all duration-300" style={{ width: `${(currentIndex / parsedRows.filter(r => r.isValid).length) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Import Summary Results */}
            {importSummary && (
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 sm:p-8 text-center flex flex-col items-center gap-4 justify-center flex-grow shadow-xs">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" weight="bold" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white font-mono">Import Complete</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
                    Roster credentials successfully registered and parsed into our database.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs font-mono text-xs mt-2">
                  <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-center">
                    <p className="text-neutral-500 dark:text-neutral-400 uppercase text-[9px] font-bold font-sans">Created</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-green-400 mt-1">{importSummary.success}</p>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-center">
                    <p className="text-neutral-500 dark:text-neutral-400 uppercase text-[9px] font-bold font-sans">Skipped/Failed</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">{importSummary.failed}</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="w-full max-w-xs bg-neutral-900 hover:bg-black dark:bg-[#262626] dark:hover:bg-[#383838] text-white rounded-[8px] py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-colors shadow-md mt-4 cursor-pointer active:scale-95 touch-manipulation"
                >
                  Close & Refresh
                </button>
              </div>
            )}

          </div>

          {/* Footer Controls */}
          {parsedRows.length > 0 && !importSummary && !isProcessing && (
            <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50 dark:bg-[#0F0F0F] shrink-0 text-xs">
              <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 font-mono font-medium self-start sm:self-auto">
                <span>Valid: <strong className="text-emerald-600 dark:text-green-500">{parsedRows.filter(r => r.isValid).length}</strong></span>
                <span>•</span>
                <span>Errors: <strong className="text-red-500 dark:text-red-400">{parsedRows.filter(r => !r.isValid).length}</strong></span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 bg-neutral-200 dark:bg-[#1A1A1A] hover:bg-neutral-300 dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 rounded-[8px] font-bold font-mono uppercase tracking-widest cursor-pointer active:scale-95 touch-manipulation"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleImportAll}
                  disabled={parsedRows.filter(r => r.isValid).length === 0}
                  className="px-5 py-2 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[8px] font-bold font-mono uppercase tracking-widest disabled:opacity-50 transition-all shadow-md shadow-[#EF2F38]/20 flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
                >
                  <Play className="w-4 h-4" weight="fill" /> Run Import
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </Portal>
  );
}
