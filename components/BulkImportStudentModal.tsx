'use client';

import React, { useState, useRef } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UploadSimple, Question, Info, FileCsv, Checks, Warning, Copy, Trash, Play, CheckCircle, PencilSimple
} from '@phosphor-icons/react';
import { cn, sanitizeStringInput, isValidEmail, isValidPhone, isValidDate } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';
import { useT } from '@/hooks/useTranslation';

interface BulkImportStudentModalProps {
  onClose: () => void;
}

interface ParsedRow {
  index: number;
  data: any;
  errors: string[];
  isValid: boolean;
}

export function BulkImportStudentModal({ onClose }: BulkImportStudentModalProps) {
  const { addStudent, state } = useAppStore();
  const t = useT();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template headers & example data for clipboard
  const csvHeaders = "English Name,Khmer Name,Gender,Date of Birth,Phone,Email,Current Belt,Home Branch ID,Scholarship ID,Height Cm,Weight Kg,Profile Picture Path,Kukkiwon ID,Nationality,Address Line 1,District Commune,State Province City,Emergency Contact Name,Emergency Contact Phone,Emergency Contact Relation,Medical Notes,Allergies,Enrollment Date,Migration Notes";
  const csvExampleRow = "Chan Dara,ចាន់ ដារ៉ា,Male,2010-08-12,012345678,dara@gmail.com,Yellow,1,1,142,38,https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view,,Cambodian,St. 105 House 22B,Chamkar Mon,Phnom Penh,Chan Sothea,099888777,Father,None,Peanuts,2026-03-01,Migrated from old list";
  
  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(`${csvHeaders}\n${csvExampleRow}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manual row addition and table pasting handlers are defined below validateRecord

  // Maps fuzzy column names to standard state attributes
  const headerMap: Record<string, string> = {
    'english name': 'englishName',
    'english_name': 'englishName',
    'englishname': 'englishName',
    'name': 'englishName',
    'khmer name': 'khmerName',
    'khmer_name': 'khmerName',
    'khmername': 'khmerName',
    'gender': 'gender',
    'sex': 'gender',
    'date of birth': 'dob',
    'dob': 'dob',
    'date_of_birth': 'dob',
    'phone': 'phone',
    'tel': 'phone',
    'telephone': 'phone',
    'email': 'email',
    'current belt': 'currentBelt',
    'belt': 'currentBelt',
    'current_belt': 'currentBelt',
    'home branch id': 'homeBranchId',
    'home_branch_id': 'homeBranchId',
    'branch id': 'homeBranchId',
    'branch_id': 'homeBranchId',
    'branch': 'homeBranchId',
    'scholarship id': 'scholarshipId',
    'scholarship_id': 'scholarshipId',
    'scholarship': 'scholarshipId',
    'height cm': 'heightCm',
    'height_cm': 'heightCm',
    'height': 'heightCm',
    'weight kg': 'weightKg',
    'weight_kg': 'weightKg',
    'weight': 'weightKg',
    'profile picture path': 'profilePicturePath',
    'profile_picture_path': 'profilePicturePath',
    'profile picture': 'profilePicturePath',
    'profile_picture': 'profilePicturePath',
    'profile_url': 'profilePicturePath',
    'photo': 'profilePicturePath',
    'esign path': 'esignPath',
    'esign_path': 'esignPath',
    'esign': 'esignPath',
    'esignpath': 'esignPath',
    'e-sign path': 'esignPath',
    'e-sign_path': 'esignPath',
    'e-sign': 'esignPath',
    'signature path': 'esignPath',
    'signature_path': 'esignPath',
    'signature': 'esignPath',
    'kukkiwon id': 'kukkiwonId',
    'kukkiwon_id': 'kukkiwonId',
    'nationality': 'nationality',
    'address line 1': 'addressLine1',
    'address_line_1': 'addressLine1',
    'address': 'addressLine1',
    'address line 2': 'addressLine2',
    'address_line_2': 'addressLine2',
    'district commune': 'city',
    'district_commune': 'city',
    'district': 'city',
    'district/commune': 'city',
    'commune': 'city',
    'state province city': 'stateProvince',
    'state_province_city': 'stateProvince',
    'province': 'stateProvince',
    'state': 'stateProvince',
    'city': 'stateProvince',
    'state/province/city': 'stateProvince',
    'postal code': 'postalCode',
    'postal_code': 'postalCode',
    'country': 'country',
    'class id': 'classId',
    'class_id': 'classId',
    'class': 'classId',
    'emergency contact name': 'emergencyContactName',
    'emergency_contact_name': 'emergencyContactName',
    'emergency name': 'emergencyContactName',
    'guardian name': 'emergencyContactName',
    'emergency contact phone': 'emergencyContactPhone',
    'emergency_contact_phone': 'emergencyContactPhone',
    'emergency phone': 'emergencyContactPhone',
    'guardian phone': 'emergencyContactPhone',
    'emergency contact relation': 'emergencyContactRelation',
    'emergency_contact_relation': 'emergencyContactRelation',
    'emergency relation': 'emergencyContactRelation',
    'guardian relation': 'emergencyContactRelation',
    'medical notes': 'medicalNotes',
    'medical_notes': 'medicalNotes',
    'medical': 'medicalNotes',
    'allergies': 'allergies',
    'registration date': 'registrationDate',
    'registration_date': 'registrationDate',
    'registrationdate': 'registrationDate',
    'enroll date': 'registrationDate',
    'enroll_date': 'registrationDate',
    'enrolldate': 'registrationDate',
    'enrollment date': 'registrationDate',
    'enrollment_date': 'registrationDate',
    'enrollmentdate': 'registrationDate',
    'notes': 'notes',
    'migration notes': 'notes',
    'migration_notes': 'notes',
    'migrationnotes': 'notes',
    'comment': 'notes',
    'comments': 'notes'
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(val => 
      val.startsWith('"') && val.endsWith('"') 
        ? val.substring(1, val.length - 1).trim() 
        : val
    );
  };

  // Central validation checklist logic
  const validateRecord = (data: any): string[] => {
    const errors: string[] = [];
    if (!data.englishName) errors.push(t('panel_err_name_dob_required'));
    if (!data.khmerName) errors.push(t('panel_err_name_dob_required'));
    
    if (!data.dob) {
      errors.push(t('panel_err_name_dob_required'));
    } else if (!isValidDate(data.dob)) {
      errors.push(t('panel_err_invalid_dob'));
    }

    if (data.phone && !isValidPhone(data.phone)) {
      errors.push(t('panel_err_invalid_student_phone'));
    }
    if (data.email && !isValidEmail(data.email)) {
      errors.push(t('panel_err_invalid_student_email'));
    }
    if (data.emergencyContactPhone && !isValidPhone(data.emergencyContactPhone)) {
      errors.push(t('panel_err_invalid_guardian_phone'));
    }

    const lowerGender = String(data.gender).toLowerCase().trim();
    if (lowerGender !== 'male' && lowerGender !== 'female') {
      errors.push("Gender must be 'Male' or 'Female'.");
    }
    if (data.registrationDate && !isValidDate(data.registrationDate)) {
      errors.push("Invalid Enrollment Date format (YYYY-MM-DD).");
    }
    return errors;
  };

  const createDefaultRow = (index: number): ParsedRow => {
    return {
      index,
      data: {
        englishName: '',
        khmerName: '',
        gender: 'Male',
        dob: '',
        phone: '',
        email: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        medicalNotes: '',
        allergies: '',
        studentStatus: 'Active',
        homeBranchId: 1,
        currentBelt: 'White',
        scholarshipId: 1,
        heightCm: 0,
        weightKg: 0,
        profilePicturePath: '',
        esignPath: '',
        kukkiwonId: '',
        nationality: 'Cambodian',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: 'Cambodia',
        classId: '',
        registrationDate: new Date().toISOString().split('T')[0],
        notes: ''
      },
      errors: [t('panel_err_name_dob_required') || 'Name and Date of Birth are required.'],
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
      'englishName',
      'khmerName',
      'gender',
      'dob',
      'phone',
      'email',
      'heightCm',
      'weightKg',
      'currentBelt',
      'nationality',
      'profilePicturePath',
      'esignPath',
      'registrationDate',
      'notes'
    ];

    const startColIndex = columnsOrdered.indexOf(startColField);
    if (startColIndex === -1) return;

    // Parse the paste grid
    const pasteGrid = rawLines.map(line => line.split('\t'));

    setParsedRows(prev => {
      const rowMap = new Map<number, ParsedRow>();
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
          } else if (fieldName === 'heightCm' || fieldName === 'weightKg') {
            value = value && !isNaN(parseFloat(value)) ? parseFloat(value) : 0;
          } else {
            value = sanitizeStringInput(value);
          }

          currentRow.data[fieldName] = value;
        }

        currentRow.errors = validateRecord(currentRow.data);
        currentRow.isValid = currentRow.errors.length === 0;
      }

      return Array.from(rowMap.values()).sort((a, b) => a.index - b.index);
    });
  };

  const handleProcessCSV = (textToParse: string) => {
    if (!textToParse.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = textToParse.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    // Parse headers
    const rawHeaders = parseCSVLine(lines[0]);
    const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim());
    const matchedFields = normalizedHeaders.map(h => headerMap[h] || h);

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      // Skip completely empty lines
      if (values.length === 1 && values[0] === '') continue;

      const rawData: any = {};
      matchedFields.forEach((field, index) => {
        if (field) {
          rawData[field] = values[index] || '';
        }
      });

      // Construct and clean final student record
      const parsedData = {
        englishName: sanitizeStringInput(rawData.englishName || ''),
        khmerName: sanitizeStringInput(rawData.khmerName || ''),
        gender: (rawData.gender || 'Male').trim(),
        dob: sanitizeStringInput(rawData.dob || ''),
        phone: sanitizeStringInput(rawData.phone || ''),
        email: sanitizeStringInput(rawData.email || ''),
        emergencyContactName: sanitizeStringInput(rawData.emergencyContactName || ''),
        emergencyContactPhone: sanitizeStringInput(rawData.emergencyContactPhone || ''),
        emergencyContactRelation: sanitizeStringInput(rawData.emergencyContactRelation || ''),
        medicalNotes: sanitizeStringInput(rawData.medicalNotes || ''),
        allergies: sanitizeStringInput(rawData.allergies || ''),
        studentStatus: 'Active',
        homeBranchId: rawData.homeBranchId && !isNaN(parseInt(rawData.homeBranchId)) ? parseInt(rawData.homeBranchId) : 1,
        currentBelt: sanitizeStringInput(rawData.currentBelt || 'White'),
        scholarshipId: rawData.scholarshipId && !isNaN(parseInt(rawData.scholarshipId)) ? parseInt(rawData.scholarshipId) : 1,
        heightCm: rawData.heightCm && !isNaN(parseFloat(rawData.heightCm)) ? parseFloat(rawData.heightCm) : 0,
        weightKg: rawData.weightKg && !isNaN(parseFloat(rawData.weightKg)) ? parseFloat(rawData.weightKg) : 0,
        profilePicturePath: sanitizeStringInput(rawData.profilePicturePath || ''),
        esignPath: sanitizeStringInput(rawData.esignPath || ''),
        kukkiwonId: sanitizeStringInput(rawData.kukkiwonId || ''),
        nationality: sanitizeStringInput(rawData.nationality || 'Cambodian'),
        addressLine1: sanitizeStringInput(rawData.addressLine1 || ''),
        addressLine2: sanitizeStringInput(rawData.addressLine2 || ''),
        city: sanitizeStringInput(rawData.city || ''),
        stateProvince: sanitizeStringInput(rawData.stateProvince || ''),
        postalCode: sanitizeStringInput(rawData.postalCode || ''),
        country: sanitizeStringInput(rawData.country || 'Cambodia'),
        classId: rawData.classId || '',
        registrationDate: rawData.registrationDate ? sanitizeStringInput(rawData.registrationDate) : new Date().toISOString().split('T')[0],
        notes: rawData.notes ? sanitizeStringInput(rawData.notes) : ''
      };

      // Perform validation checks
      const errors = validateRecord(parsedData);

      // Validate Gender choice
      const lowerGender = parsedData.gender.toLowerCase();
      if (lowerGender === 'male' || lowerGender === 'm') {
        parsedData.gender = 'Male';
      } else if (lowerGender === 'female' || lowerGender === 'f') {
        parsedData.gender = 'Female';
      }

      rows.push({
        index: i,
        data: parsedData,
        errors,
        isValid: errors.length === 0
      });
    }

    setParsedRows(rows);
  };

  const handleEditRow = (index: number, field: string, value: any) => {
    setParsedRows(prev => prev.map(row => {
      if (row.index !== index) return row;
      const updatedData = { ...row.data, [field]: value };
      
      // Auto-coerce gender if editing gender
      if (field === 'gender') {
        const lowerGender = String(value).toLowerCase().trim();
        if (lowerGender === 'male' || lowerGender === 'm') {
          updatedData.gender = 'Male';
        } else if (lowerGender === 'female' || lowerGender === 'f') {
          updatedData.gender = 'Female';
        }
      }

      const errors = validateRecord(updatedData);
      return {
        ...row,
        data: updatedData,
        errors,
        isValid: errors.length === 0
      };
    }));
  };

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
      handleProcessCSV(text);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(e.target.value);
    handleProcessCSV(e.target.value);
  };

  // Drag and Drop Event Listeners
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
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setImportSummary(null);
    setCurrentIndex(0);

    let successCount = 0;
    let failedCount = 0;

    let runningCount = state.students.length;

    for (let i = 0; i < validRows.length; i++) {
      setCurrentIndex(i + 1);
      const row = validRows[i];
      runningCount++;

      const prefix = row.data.gender === 'Male' ? 'M' : 'F';
      const generatedId = `STU-${prefix}-${String(runningCount).padStart(3, '0')}`;

      const payload = {
        ...row.data,
        id: generatedId,
        address: {
          line1: row.data.addressLine1,
          line2: row.data.addressLine2,
          city: row.data.city,
          stateProvince: row.data.stateProvince,
          postalCode: row.data.postalCode,
          country: row.data.country
        },
        initialClassId: row.data.classId ? parseInt(row.data.classId) : undefined
      };

      const result = await addStudent(payload);
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        console.error(`[Bulk Import Failure] Row ${row.index} (${row.data.englishName || 'Unnamed'}):`, result.error);
      }
    }

    setIsProcessing(false);
    setImportSummary({ success: successCount, failed: failedCount });
  };

  const totalValid = parsedRows.filter(r => r.isValid).length;
  const totalErrors = parsedRows.filter(r => !r.isValid).length;

  const renderTutorialList = () => {
    const locale = state.language || 'en';
    if (locale === 'kh') {
      return (
        <ul className="space-y-2 list-disc pl-4">
          <li>
            <strong className="text-neutral-900 dark:text-white">English Name * (ឈ្មោះអង់គ្លេស)</strong>: ត្រូវតែមាន។ ឈ្មោះសិស្សជាភាសាអង់គ្លេស។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Khmer Name * (ឈ្មោះខ្មែរ)</strong>: ត្រូវតែមាន។ ឈ្មោះសិស្សជាភាសាខ្មែរ។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Gender * (ភេទ)</strong>: ត្រូវតែមាន។ តម្លៃអនុញ្ញាត៖ <code className="text-red-600 dark:text-red-400 font-mono">Male</code>, <code className="text-red-600 dark:text-red-400 font-mono">Female</code>, <code className="text-red-600 dark:text-red-400 font-mono">M</code>, ឬ <code className="text-red-600 dark:text-red-400 font-mono">F</code>។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Date of Birth * (ថ្ងៃខែឆ្នាំកំណើត)</strong>: ត្រូវតែមាន។ ទម្រង់ទិន្នន័យ៖ <code className="text-red-600 dark:text-red-400 font-mono">YYYY-MM-DD</code> (ឧទាហរណ៍៖ <code className="text-neutral-600 dark:text-neutral-300 font-mono">2010-08-12</code>)។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Current Belt (ខ្សែក្រវាត់បច្ចុប្បន្ន)</strong>: មិនបង្ខំ។ ឧទាហរណ៍៖ <code className="text-neutral-600 dark:text-neutral-300 font-mono">White</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Yellow</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Green</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Blue</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Brown</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Red</code>, ឬ <code className="text-neutral-600 dark:text-neutral-300 font-mono">1st Poom/Dan</code>។ លំនាំដើមគឺ White (ខ្សែក្រវាត់ស)។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Home Branch ID (អត្តសញ្ញាណសាខា)</strong>: មិនបង្ខំ。 លេខសម្គាល់សាខាហ្វឹកហាត់ (ឧទាហរណ៍៖ <code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code>)។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Scholarship ID (អត្តសញ្ញាណអាហារូបករណ៍)</strong>: មិនបង្ខំ。 លេខសម្គាល់អាហារូបករណ៍ (ឧទាករណ៍៖ <code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code> សម្រាប់គ្មាន)។
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Profile Picture Path (រូបថតប្រវត្តិរូប)</strong>: មិនបង្ខំ។ លីងរូបភាពផ្ទាល់ ឬលីងចែករំលែក Google Drive (ប្រព័ន្ធនឹងបម្លែងដោយស្វ័យប្រវត្តិតែម្តង!)។
          </li>
        </ul>
      );
    }
    if (locale === 'zh') {
      return (
        <ul className="space-y-2 list-disc pl-4">
          <li>
            <strong className="text-neutral-900 dark:text-white">English Name * (英文姓名)</strong>: 必填。英文拼写。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Khmer Name * (高棉姓名)</strong>: 必填。高棉语字形拼写。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Gender * (性别)</strong>: 必填。可选值：<code className="text-red-600 dark:text-red-400 font-mono">Male</code>（男）, <code className="text-red-600 dark:text-red-400 font-mono">Female</code>（女）, <code className="text-red-600 dark:text-red-400 font-mono">M</code>, 或 <code className="text-red-600 dark:text-red-400 font-mono">F</code>。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Date of Birth * (出生日期)</strong>: 必填。标准日期格式：<code className="text-red-600 dark:text-red-400 font-mono">YYYY-MM-DD</code>（例如，<code className="text-neutral-600 dark:text-neutral-300 font-mono">2010-08-12</code>）。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Current Belt (腰带等级)</strong>: 选填。例如：<code className="text-neutral-600 dark:text-neutral-300 font-mono">White</code>（白带）, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Yellow</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Green</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Blue</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Brown</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Red</code>, 或 <code className="text-neutral-600 dark:text-neutral-300 font-mono">1st Poom/Dan</code>。默认：White（白带）。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Home Branch ID (分校 ID)</strong>: 选填。场馆的整数 ID（例如，<code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code>）。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Scholarship ID (奖学金 ID)</strong>: 选填。奖学金类别的整数 ID（例如，<code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code> 代表无）。
          </li>
          <li>
            <strong className="text-neutral-900 dark:text-white">Profile Picture Path (照片链接)</strong>: 选填。图片直连或谷歌云端硬盘分享链接（系统将在运行时自动解析预览！）。
          </li>
        </ul>
      );
    }
    // Default English
    return (
      <ul className="space-y-2 list-disc pl-4">
        <li>
          <strong className="text-neutral-900 dark:text-white">English Name *</strong>: Required. English representation of student name.
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Khmer Name *</strong>: Required. Khmer alphabet representation.
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Gender *</strong>: Required. Valid entries: <code className="text-red-600 dark:text-red-400 font-mono">Male</code>, <code className="text-red-600 dark:text-red-400 font-mono">Female</code>, <code className="text-red-600 dark:text-red-400 font-mono">M</code>, or <code className="text-red-600 dark:text-red-400 font-mono">F</code>.
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Date of Birth *</strong>: Required. Strict calendar representation. Format: <code className="text-red-600 dark:text-red-400 font-mono">YYYY-MM-DD</code> (e.g., <code className="text-neutral-600 dark:text-neutral-300 font-mono">2010-08-12</code>).
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Current Belt</strong>: Optional. e.g. <code className="text-neutral-600 dark:text-neutral-300 font-mono">White</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Yellow</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Green</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Blue</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Brown</code>, <code className="text-neutral-600 dark:text-neutral-300 font-mono">Red</code>, or <code className="text-neutral-600 dark:text-neutral-300 font-mono">1st Poom/Dan</code>. Defaults to White.
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Home Branch ID</strong>: Optional. Integer ID of the training facility (e.g., <code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code>).
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Scholarship ID</strong>: Optional. Integer ID (e.g., <code className="text-neutral-600 dark:text-neutral-300 font-mono">1</code> for None).
        </li>
        <li>
          <strong className="text-neutral-900 dark:text-white">Profile Picture Path</strong>: Optional. Direct image URL or **Google Drive share link** (which will auto-parse at runtime!).
        </li>
      </ul>
    );
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
        <style dangerouslySetInnerHTML={{ __html: `
          /* Scoped overrides to protect interactive table controls from global light-theme input overrides */
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
        <div className="w-full max-w-5xl bg-[#0F0F0F] border border-[#262626] rounded-[8px] shadow-2xl flex flex-col my-8 max-h-[90dvh] overflow-hidden">
          
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414]">
            <div className="flex items-center gap-2.5">
              <FileCsv className="w-6 h-6 text-red-500" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_bulk_import')}</h2>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{t('bulk_desc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowHelp(true)} 
                className="p-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[8px] text-neutral-600 dark:text-[#999] hover:text-neutral-950 dark:hover:text-white hover:border-neutral-300 dark:hover:border-[#444] transition-all flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3"
              >
                <Question className="w-3.5 h-3.5" /> {t('bulk_tutorial_btn')}
              </button>
              <button 
                type="button"
                onClick={onClose} 
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:text-[#666] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0A0A0A]">
            
            {/* Phase 1: Upload or Paste */}
            {!importSummary && !isProcessing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Drag and Drop File Selector */}
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed border-[#262626] bg-[#141414]/50 rounded-[8px] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-red-500/40 hover:bg-[#181818]/60 transition-all group relative overflow-hidden",
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
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 mb-4 group-hover:scale-105 transition-transform text-neutral-600 dark:text-white">
                    <UploadSimple className={cn("w-5 h-5", isDragging && "animate-bounce")} />
                  </div>
                  {fileName ? (
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white font-mono truncate max-w-[280px]">{fileName}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-500 font-mono mt-1 uppercase tracking-widest font-black">{t('bulk_file_loaded')}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">{t('bulk_drag_drop_click')}</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono leading-relaxed">{t('bulk_drag_drop_desc')}</p>
                    </div>
                  )}

                  {/* Active Drag Backdrop indicator */}
                  <AnimatePresence>
                    {isDragging && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-500/[0.08] backdrop-blur-[1px] flex items-center justify-center pointer-events-none"
                      >
                        <span className="text-red-500 font-bold uppercase tracking-widest text-xs border border-red-500 bg-white dark:bg-black px-4 py-2 rounded-full shadow-lg shadow-black/80">Drop File Here!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Paste Area */}
                <div className="flex flex-col space-y-2">
                  <label className="block text-[11px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('bulk_or_paste')}</label>
                  <textarea 
                    value={csvText} 
                    onChange={handlePasteChange}
                    placeholder={`English Name,Khmer Name,Gender,Date of Birth\nChan Dara,ចាន់ ដារ៉ា,Male,2010-08-12\nSophal Phalla,សុផល ផាឡា,Female,2012-05-19`}
                    className="w-full h-[154px] bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/25 resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-all shadow-inner"
                  />
                </div>

                {/* Manual Spreadsheet Entry option */}
                <div className="col-span-1 md:col-span-2 border border-dashed border-[#262626] bg-[#141414]/30 rounded-[8px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shrink-0">
                      <PencilSimple className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">Manual Spreadsheet Roster</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">Don't have a CSV file? Start with a blank Excel-like grid to type in student rows manually!</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-widest rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#EF2F38]/20 shrink-0"
                  >
                    + Start Blank Grid
                  </button>
                </div>
              </div>
            )}

            {/* Phase 2: Live Row Verification Table with Interactive Inline Editing */}
            {parsedRows.length > 0 && !isProcessing && !importSummary && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {t('bulk_integrity_checks')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddManualRow}
                      className="px-4 py-1.5 bg-[#EF2F38] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-all flex items-center gap-1.5 shadow-md shadow-[#EF2F38]/20 mr-2"
                    >
                      + Add Row
                    </button>
                    <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-[8px]">
                      {totalValid} {t('bulk_ready_to_import')}
                    </span>
                    {totalErrors > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 px-2.5 py-0.5 rounded-[8px] animate-pulse">
                        {t('bulk_malformed_rows').replace('{count}', String(totalErrors))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-mono font-bold italic">
                  <PencilSimple className="w-3.5 h-3.5 text-[#EF2F38]" /> Double-click or select any cell to fix typos and validation errors inline!
                </div>

                <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] max-h-[350px] overflow-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-max">
                    <thead className="bg-neutral-100 dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 uppercase tracking-wider font-mono text-[10px] sticky top-0 z-10">
                      <tr className="border-b border-neutral-200 dark:border-[#262626]">
                        <th className="px-4 py-3 w-16 text-center">Row</th>
                        <th className="px-4 py-3 min-w-[160px]">{t('stu_english_name')}</th>
                        <th className="px-4 py-3 min-w-[160px]">{t('stu_khmer_name')}</th>
                        <th className="px-4 py-3 min-w-[100px] w-28">{t('stu_gender')}</th>
                        <th className="px-4 py-3 min-w-[120px] w-32">{t('stu_dob')}</th>
                        <th className="px-4 py-3 min-w-[130px] w-36">{t('stu_phone')}</th>
                        <th className="px-4 py-3 min-w-[200px]">{t('stu_email')}</th>
                        <th className="px-4 py-3 min-w-[90px] w-24">Height (Cm)</th>
                        <th className="px-4 py-3 min-w-[90px] w-24">Weight (Kg)</th>
                        <th className="px-4 py-3 min-w-[120px] w-32">{t('stu_belt')}</th>
                        <th className="px-4 py-3 min-w-[120px] w-32">{t('stu_nationality')}</th>
                        <th className="px-4 py-3 min-w-[220px]">Profile Pic Link</th>
                        <th className="px-4 py-3 min-w-[220px]">E-Signature Link</th>
                        <th className="px-4 py-3 min-w-[125px] w-32">Enrollment Date</th>
                        <th className="px-4 py-3 min-w-[200px]">Migration Notes</th>
                        <th className="px-4 py-3 min-w-[160px]">{t('bulk_table_integrity')}</th>
                        <th className="px-4 py-3 w-20 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody 
                      onPaste={handleTablePaste}
                      className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-neutral-50/30 dark:bg-[#0A0A0A]/50"
                    >
                      {parsedRows.map((row) => (
                        <tr key={row.index} className={cn(
                          "hover:bg-neutral-100 dark:hover:bg-[#121212]/50 transition-colors",
                          !row.isValid && "bg-red-500/[0.02] dark:bg-red-500/[0.01] hover:bg-red-500/[0.04] dark:hover:bg-red-500/[0.03]"
                        )}>
                          <td className="px-4 py-3 font-mono text-neutral-500 dark:text-neutral-400 text-center font-bold w-16">{row.index}</td>
                          
                          {/* English Name Input */}
                          <td className="px-3 py-2 min-w-[160px]">
                            <input 
                              type="text" 
                              value={row.data.englishName} 
                              onChange={e => handleEditRow(row.index, 'englishName', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="englishName"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-bold"
                            />
                          </td>

                          {/* Khmer Name Input */}
                          <td className="px-3 py-2 min-w-[160px]">
                            <input 
                              type="text" 
                              value={row.data.khmerName} 
                              onChange={e => handleEditRow(row.index, 'khmerName', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="khmerName"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-khmer font-bold"
                            />
                          </td>

                          {/* Gender Select */}
                          <td className="px-3 py-2 min-w-[100px] w-28">
                            <select 
                              value={row.data.gender} 
                              onChange={e => handleEditRow(row.index, 'gender', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="gender"
                              className="w-full bulk-table-control rounded px-1 py-0.5 text-xs focus:outline-none transition-all font-bold"
                            >
                              <option value="Male" className="text-black dark:text-white dark:bg-neutral-900">{t('stu_male')}</option>
                              <option value="Female" className="text-black dark:text-white dark:bg-neutral-900">{t('stu_female')}</option>
                            </select>
                          </td>

                          {/* DOB Input */}
                          <td className="px-3 py-2 min-w-[120px] w-32">
                            <input 
                              type="text" 
                              value={row.data.dob} 
                              onChange={e => handleEditRow(row.index, 'dob', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              data-row-index={row.index}
                              data-column-field="dob"
                              className={cn(
                                "w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono font-bold",
                                (!row.data.dob || !isValidDate(row.data.dob)) && "text-red-600 dark:text-red-400 font-bold border-b border-red-500/40"
                              )}
                            />
                          </td>

                          {/* Phone Input */}
                          <td className="px-3 py-2 min-w-[130px] w-36">
                            <input 
                              type="text" 
                              value={row.data.phone} 
                              onChange={e => handleEditRow(row.index, 'phone', e.target.value)}
                              placeholder="—"
                              data-row-index={row.index}
                              data-column-field="phone"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono font-bold"
                            />
                          </td>

                          {/* Email Input */}
                          <td className="px-3 py-2 min-w-[200px]">
                            <input 
                              type="email" 
                              value={row.data.email} 
                              onChange={e => handleEditRow(row.index, 'email', e.target.value)}
                              placeholder="—"
                              data-row-index={row.index}
                              data-column-field="email"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono font-bold"
                            />
                          </td>

                          {/* Height Cm Input */}
                          <td className="px-3 py-2 min-w-[90px] w-24">
                            <input 
                              type="number" 
                              value={row.data.heightCm || ''} 
                              onChange={e => handleEditRow(row.index, 'heightCm', parseFloat(e.target.value) || 0)}
                              placeholder="—"
                              data-row-index={row.index}
                              data-column-field="heightCm"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono text-center font-bold"
                            />
                          </td>

                          {/* Weight Kg Input */}
                          <td className="px-3 py-2 min-w-[90px] w-24">
                            <input 
                              type="number" 
                              value={row.data.weightKg || ''} 
                              onChange={e => handleEditRow(row.index, 'weightKg', parseFloat(e.target.value) || 0)}
                              placeholder="—"
                              data-row-index={row.index}
                              data-column-field="weightKg"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono text-center font-bold"
                            />
                          </td>

                          {/* Current Belt Input */}
                          <td className="px-3 py-2 min-w-[120px] w-32">
                            <input 
                              type="text" 
                              value={row.data.currentBelt} 
                              onChange={e => handleEditRow(row.index, 'currentBelt', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="currentBelt"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-bold"
                            />
                          </td>

                          {/* Nationality Input */}
                          <td className="px-3 py-2 min-w-[120px] w-32">
                            <input 
                              type="text" 
                              value={row.data.nationality} 
                              onChange={e => handleEditRow(row.index, 'nationality', e.target.value)}
                              data-row-index={row.index}
                              data-column-field="nationality"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-bold"
                            />
                          </td>

                          {/* Profile Picture Path Input */}
                          <td className="px-3 py-2 min-w-[220px]">
                            <input 
                              type="text" 
                              value={row.data.profilePicturePath} 
                              onChange={e => handleEditRow(row.index, 'profilePicturePath', e.target.value)}
                              placeholder={t('panel_profile_pic_placeholder')}
                              data-row-index={row.index}
                              data-column-field="profilePicturePath"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono text-neutral-400"
                            />
                          </td>

                          {/* E-Signature Path Input */}
                          <td className="px-3 py-2 min-w-[220px]">
                            <input 
                              type="text" 
                              value={row.data.esignPath} 
                              onChange={e => handleEditRow(row.index, 'esignPath', e.target.value)}
                              placeholder={t('panel_profile_pic_placeholder')}
                              data-row-index={row.index}
                              data-column-field="esignPath"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono text-neutral-400"
                            />
                          </td>

                          {/* Enrollment Date Input */}
                          <td className="px-3 py-2 min-w-[125px] w-32">
                            <input 
                              type="text" 
                              value={row.data.registrationDate} 
                              onChange={e => handleEditRow(row.index, 'registrationDate', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              data-row-index={row.index}
                              data-column-field="registrationDate"
                              className={cn(
                                "w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all font-mono font-bold",
                                (!row.data.registrationDate || !isValidDate(row.data.registrationDate)) && "text-red-600 dark:text-red-400 font-bold border-b border-red-500/40"
                              )}
                            />
                          </td>

                          {/* Migration Notes Input */}
                          <td className="px-3 py-2 min-w-[200px]">
                            <input 
                              type="text" 
                              value={row.data.notes} 
                              onChange={e => handleEditRow(row.index, 'notes', e.target.value)}
                              placeholder={t('panel_migration_notes')}
                              data-row-index={row.index}
                              data-column-field="notes"
                              className="w-full bulk-table-control rounded px-1.5 py-0.5 text-xs focus:outline-none transition-all"
                            />
                          </td>

                          {/* Validation Status */}
                          <td className="px-4 py-3 min-w-[160px]">
                            {row.isValid ? (
                              <span className="dark:bg-emerald-500/15 dark:text-emerald-400 bg-emerald-50 text-emerald-700 border border-emerald-500/20 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-[8px] font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                                <Checks className="w-3.5 h-3.5 text-green-600 dark:text-green-500" /> {t('bulk_status_validated')}
                              </span>
                            ) : (
                              <div className="text-red-600 dark:text-red-400 flex flex-col space-y-0.5 max-w-[280px]">
                                {row.errors.map((err, errIdx) => (
                                  <span key={errIdx} className="flex items-start gap-1 font-mono text-[9px] leading-tight dark:bg-red-950/40 dark:text-red-300 bg-red-50 text-red-800 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/30">
                                    <Warning className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /> {err}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Row Actions (Prune/Delete Row) */}
                          <td className="px-3 py-2 text-center w-20">
                            <button
                              type="button"
                              onClick={() => {
                                setParsedRows(prev => prev.filter(r => r.index !== row.index));
                              }}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-[8px] transition-colors inline-flex items-center justify-center"
                              title={t('act_delete')}
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Phase 3: Live Progress Tracker */}
            {isProcessing && (
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 bg-white dark:bg-[#0F0F0F]">
                <div className="w-16 h-16 rounded-full border-4 border-neutral-200 dark:border-[#262626] border-t-red-500 animate-spin flex items-center justify-center" />
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">{t('bulk_importing_title')}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                    {t('bulk_processing_record').replace('{current}', String(currentIndex)).replace('{total}', String(totalValid))}
                  </p>
                </div>
                <div className="w-full max-w-sm bg-neutral-100 dark:bg-[#141414] h-2 rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]">
                  <div 
                    className="bg-[#EF2F38] h-full rounded-full transition-all duration-300"
                    style={{ width: `${(currentIndex / totalValid) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Phase 4: Import Complete Summary */}
            {importSummary && (
              <div className="p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 bg-white dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                <div className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center justify-center shadow-lg shadow-black/40">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t('bulk_completed_title')}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">{t('bulk_completed_desc')}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                    <span className="block text-2xl font-black text-green-500 font-mono">{importSummary.success}</span>
                    <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('bulk_success')}</span>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-center">
                    <span className="block text-2xl font-black text-red-500 font-mono">{importSummary.failed}</span>
                    <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider">{t('bulk_failed')}</span>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="w-full py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-[8px] hover:bg-gray-200 transition-colors"
                >
                  {t('act_close')}
                </button>
              </div>
            )}

          </div>

          {/* Action Footer */}
          {!isProcessing && !importSummary && (
            <div className="p-4 border-t border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414]">
              <div>
                {parsedRows.length > 0 && (
                  <button 
                    onClick={() => {
                      setParsedRows([]);
                      setCsvText('');
                      setFileName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }} 
                    className="text-xs text-red-500 hover:text-red-600 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <Trash className="w-4 h-4" /> {t('act_delete')}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#999] hover:text-neutral-950 dark:hover:text-white rounded-[8px] text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  {t('act_cancel')}
                </button>
                <button 
                  disabled={totalValid === 0}
                  onClick={handleStartImport} 
                  className={cn(
                    "px-5 py-2 rounded-[8px] text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-lg shadow-black/20",
                    totalValid > 0 
                      ? "bg-[#EF2F38] text-white hover:bg-red-600 active:scale-95 cursor-pointer" 
                      : "bg-neutral-100 text-neutral-400 dark:bg-[#1E1E1E] dark:text-[#666] border border-neutral-200 dark:border-neutral-800 cursor-not-allowed"
                  )}
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> {t('dir_bulk_import')} ({totalValid})
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Expandable Help Modal overlay */}
      <AnimatePresence>
        {showHelp && (
          <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[85dvh]"
              >
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#141414]">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-red-500" /> {t('bulk_tutorial_title')}
                  </h3>
                  <button onClick={() => setShowHelp(false)} className="p-1 text-neutral-400 hover:text-neutral-800 dark:text-[#666] dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1.5 text-[10px]">{t('bulk_tutorial_req_title')}</h4>
                    <p>{t('bulk_tutorial_req_desc')}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2 text-[10px]">{t('bulk_tutorial_mappings_title')}</h4>
                    {renderTutorialList()}
                  </div>

                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2 text-[10px]">{t('bulk_tutorial_sample_title')}</h4>
                    <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 font-mono text-[9px] text-neutral-500 dark:text-[#666] overflow-x-auto whitespace-pre space-y-2">
                      <div className="text-neutral-900 dark:text-white font-bold">{csvHeaders}</div>
                      <div>{csvExampleRow}</div>
                    </div>
                  </div>

                </div>

                <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-end gap-3">
                  <button 
                    onClick={handleCopyTemplate} 
                    className="px-4 py-2 bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-[#262626] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-white rounded-[8px] text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Checks className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('bulk_copied_success') : t('bulk_copy_template')}
                  </button>
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="px-4 py-2 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-colors cursor-pointer"
                  >
                    {t('bulk_got_it')}
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
