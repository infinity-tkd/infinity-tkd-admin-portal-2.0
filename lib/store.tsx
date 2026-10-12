'use client';
import { academyProfileChanges } from '@/lib/academy-profile';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { fetchAllRows } from './data-access';
import { dataLoadIssue, preserveUnavailableData, type DataLoadIssue } from './data-load-status';
import { membershipBilling } from './billing';
import { invoiceKey, indexPaymentReceipts } from './payment-receipts';
import { academyDate } from './dates';
import { partnerField } from './partners';
import { supabase } from './supabase';
import { observePortalSession } from './auth-session';
import { createReadRecovery, settleReads, PORTAL_REALTIME_TABLES } from './read-recovery';
import { sanitizeStringInput, mapCategoryToDbEnum, normalizeCategory } from './utils';
import { normalizeError, NormalizedError } from './error-handler';
import { reportClientError } from './client-telemetry';
import { 
  hasPermission, 
  SecurityModule, 
  AccessLevel, 
  MODULE_DEFINITIONS, 
  getModuleAccessLevel 
} from './security';

// --- Cryptographic Cache Codecs (XOR + UTF-8 Byte Stream) ---
const CACHE_SECRET = 'INFINITY_TKD_SECURE_SALT_99182!';

export function encryptCache(data: any): string {
  try {
    if (!data) return '';
    const jsonStr = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const encryptedBytes = new Uint8Array(utf8Bytes.length);
    for (let i = 0; i < utf8Bytes.length; i++) {
      const saltCode = CACHE_SECRET.charCodeAt(i % CACHE_SECRET.length);
      encryptedBytes[i] = utf8Bytes[i] ^ saltCode;
    }
    let binString = '';
    const len = encryptedBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binString += String.fromCharCode(encryptedBytes[i]);
    }
    return btoa(binString);
  } catch (e) {
    console.error('Cache encryption failed:', e);
    return '';
  }
}

export function decryptCache(encryptedStr: string | null): any {
  if (!encryptedStr) return null;
  try {
    const binString = atob(encryptedStr);
    const len = binString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const saltCode = CACHE_SECRET.charCodeAt(i % CACHE_SECRET.length);
      bytes[i] = binString.charCodeAt(i) ^ saltCode;
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Cache decryption failed:', e);
    return null;
  }
}

export function unwrapApiError(errData: any, fallback = 'Operation failed'): string {
  if (!errData) return fallback;
  if (typeof errData === 'string') return errData;
  if (typeof errData?.error === 'string') return errData.error;
  if (typeof errData?.error?.message === 'string') return errData.error.message;
  if (typeof errData?.message === 'string') return errData.message;
  if (typeof errData?.error?.code === 'string') return `${errData.error.code}: ${fallback}`;
  return fallback;
}

// --- Types based on Schema ---

export type Role = 'Root' | 'Super Root' | 'Admin' | 'Head Coach' | 'Coach' | 'Assistant Coach' | 'Student';

export interface StructuredAddress {
  id?: number;
  line1: string;
  line2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface SystemNotification {
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  code?: string;
  details?: string;
  timestamp?: number;
}

export interface SystemConfirm {
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface User {
  mustChangePassword?: boolean;
  id: string; // UUID from auth.users
  username: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  studentId?: string;
  khmerName?: string;
  englishName?: string;
  gender?: 'Male' | 'Female';
  dob?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  medicalNotes?: string;
  allergies?: string;
  profilePicturePath?: string;
  address?: StructuredAddress;
  nationality?: string;
  kukkiwonId?: string;
  currentDan?: number; // 1 to 9
  danIssueDate?: string; // YYYY-MM-DD
  danCertificateUrl?: string;
}

export interface StaffDanRecord {
  id: string;
  userId: string;
  danLevel: number;
  issueDate: string; // YYYY-MM-DD
  certificateNo?: string;
  certificateUrl?: string;
  examinerName?: string;
  location?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StudentStatus = 'Active' | 'Paused' | 'Inactive' | 'Suspended' | 'Graduated';

export interface Student {
  id: string;
  profileId?: string;
  khmerName: string;
  englishName: string;
  gender: 'Male' | 'Female';
  dob: string;
  registrationDate: string;
  scholarshipId: number;
  heightCm: number;
  weightKg: number;
  homeBranchId: number;
  currentBelt: string;
  studentStatus: StudentStatus;
  statusReason?: string;
  statusChangedAt?: string;
  pauseEndDate?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  medicalNotes?: string;
  allergies?: string;
  profilePicturePath?: string;
  esignPath?: string;
  kukkiwonId?: string;
  address?: StructuredAddress;
  nationality?: string;
  notes?: string;
}

export interface BeltHistory {
  id: number;
  studentId: string;
  beltLevel: string;
  promotionDate: string;
  testScore?: number;
  program?: string;
  certificateRef?: string;
  kukkiwonDanCardId?: string;
}

export interface Achievement {
  id: number;
  studentId: string;
  eventName: string;
  date: string;
  category: string;
  division: string;
  medalRank: string;
  notes?: string;
  ageDivision?: string;
  beltDivision?: string;
}

export interface Attendance {
  classId?: number;
  id: number;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Late';
}

export interface Payment {
  receiptNumber?: string;
  paymentMethod?: string;
  paymentDate?: string;
  id: number;
  studentId: string;
  year: number;
  month: string; // 'Jan', 'Feb', etc.
  status: 'Paid' | 'Unpaid' | 'Pending';
  amountUsd: number;
}

export interface Branch {
  id: number;
  name: string;
}

export type ClassCategory = 'General Class' | 'Kid Class' | 'Private Class' | 'Elite Team';

export interface ClassSession {
  id: number;
  branchId: number;
  name: string;
  classType: ClassCategory;
  daysOfWeek: string[]; // e.g. ['Monday', 'Wednesday']
  dayOfWeek: string;    // legacy dayOfWeek for backwards compatibility
  startTime: string;
  endTime: string;
  capacity: number;
  coachId?: string;     // UUID from Profiles
  standardDurationMins: number;
}

export interface AcademyProfile {
  id: string;
  academyName: string;
  legalName?: string;
  tagline?: string;
  logoUrl?: string;
  websiteUrl?: string;
  portalUrl?: string;
  taxId?: string;
  contactPhone?: string;
  supportEmail?: string;
  primaryAddress?: string;
  defaultBranchId?: number | 'all';
  currency: 'USD' | 'KHR';
  currencySymbol: string;
  tuitionGracePeriodDays: number;
  earlyGroupTuitionUsd: number;
  standardTuitionUsd: number;
  taxRatePercentage: number;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  defaultClassDurationMins: number;
  examPassingScore: number;
  minAttendanceExamPct: number;
  allowStudentPortalLogin: boolean;
  enableAudioChimes: boolean;
  facebookUrl?: string;
  telegramChannel?: string;
  instagramUrl?: string;
  updatedAt?: string;
}

export const DEFAULT_ACADEMY_PROFILE: AcademyProfile = {
  id: 'default',
  academyName: 'Infinity Taekwondo Academy',
  legalName: 'Infinity Martial Arts Club Co., Ltd.',
  tagline: 'Discipline, Honor, Excellence · Martial Arts & Character Building',
  logoUrl: '/logo.svg',
  websiteUrl: 'https://infinitytkd.com',
  portalUrl: 'https://infinitytkd.com/lms',
  taxId: '',
  contactPhone: '+855 12 888 999',
  supportEmail: 'contact@infinitytkd.com',
  primaryAddress: 'Street 2004, Sen Sok, Phnom Penh, Cambodia',
  defaultBranchId: 'all',
  currency: 'USD',
  currencySymbol: '$',
  tuitionGracePeriodDays: 5,
  earlyGroupTuitionUsd: 25,
  standardTuitionUsd: 45,
  taxRatePercentage: 0,
  dateFormat: 'YYYY-MM-DD',
  defaultClassDurationMins: 60,
  examPassingScore: 70,
  minAttendanceExamPct: 80,
  allowStudentPortalLogin: true,
  enableAudioChimes: true,
  facebookUrl: 'https://facebook.com/infinitytaekwondo',
  telegramChannel: 'https://t.me/infinitytkd',
  instagramUrl: 'https://instagram.com/infinitytaekwondo'
};

export function mapDbRowToAcademyProfile(row: any): AcademyProfile {
  if (!row) return DEFAULT_ACADEMY_PROFILE;
  return {
    id: row.id || 'default',
    academyName: row.academy_name || DEFAULT_ACADEMY_PROFILE.academyName,
    legalName: row.legal_name === undefined ? DEFAULT_ACADEMY_PROFILE.legalName : (row.legal_name ?? ''),
    tagline: row.tagline === undefined ? DEFAULT_ACADEMY_PROFILE.tagline : (row.tagline ?? ''),
    logoUrl: row.logo_url === undefined ? DEFAULT_ACADEMY_PROFILE.logoUrl : (row.logo_url ?? ''),
    websiteUrl: row.website_url === undefined ? DEFAULT_ACADEMY_PROFILE.websiteUrl : (row.website_url ?? ''),
    portalUrl: row.portal_url === undefined ? DEFAULT_ACADEMY_PROFILE.portalUrl : (row.portal_url ?? ''),
    taxId: row.tax_id || '',
    contactPhone: row.contact_phone === undefined ? DEFAULT_ACADEMY_PROFILE.contactPhone : (row.contact_phone ?? ''),
    supportEmail: row.support_email === undefined ? DEFAULT_ACADEMY_PROFILE.supportEmail : (row.support_email ?? ''),
    primaryAddress: row.primary_address === undefined ? DEFAULT_ACADEMY_PROFILE.primaryAddress : (row.primary_address ?? ''),
    defaultBranchId: row.default_branch_id ?? 'all',
    currency: (row.currency as 'USD' | 'KHR') || 'USD',
    currencySymbol: row.currency_symbol || (row.currency === 'KHR' ? '៛' : '$'),
    tuitionGracePeriodDays: row.tuition_grace_period_days ?? 5,
    earlyGroupTuitionUsd: Number(row.early_group_tuition_usd ?? 25),
    standardTuitionUsd: Number(row.standard_tuition_usd ?? 45),
    taxRatePercentage: Number(row.tax_rate_percentage) || 0,
    dateFormat: (row.date_format as any) || 'YYYY-MM-DD',
    defaultClassDurationMins: row.default_class_duration_mins ?? 60,
    examPassingScore: row.exam_passing_score ?? 70,
    minAttendanceExamPct: row.min_attendance_exam_pct ?? 80,
    allowStudentPortalLogin: row.allow_student_portal_login ?? true,
    enableAudioChimes: row.enable_audio_chimes ?? true,
    facebookUrl: row.facebook_url === undefined ? DEFAULT_ACADEMY_PROFILE.facebookUrl : (row.facebook_url ?? ''),
    telegramChannel: row.telegram_channel === undefined ? DEFAULT_ACADEMY_PROFILE.telegramChannel : (row.telegram_channel ?? ''),
    instagramUrl: row.instagram_url === undefined ? DEFAULT_ACADEMY_PROFILE.instagramUrl : (row.instagram_url ?? ''),
    updatedAt: row.updated_at
  };
}

export interface ClassEnrollment {
  id: number;
  studentId: string;
  classId: number;
  enrollmentDate?: string;
}

export interface Scholarship {
  id: number;
  typeName: string;
  discountPercentage: number;
}

export interface Belt {
  id: number;
  beltName: string;
}

export interface CurriculumVideo {
  id: number;
  title: string;
  description: string;
  category: string; 
  minBeltLevel: string;
  videoUrl?: string; 
  createdAt: string;
}

export interface StudentVideoProgress {
  id: number;
  studentId: string;
  videoId: number;
  status: 'Started' | 'Completed';
  lastWatchedAt: string;
}

export interface Muscle {
  id: number;
  name: string;
  nameKh?: string;
  nameZh?: string;
  muscleGroup: string;
  targetFunction?: string;
  diagramUrl?: string;
  description?: string;
  conceptId?: string;
  elementIds?: string[];
  system?: string;
  latinName?: string;
  tkdRelevance?: string;
}

export interface AssetMuscleRelation {
  assetId: number;
  muscleId: number;
  role: 'Primary' | 'Secondary';
}

export type PartnerType =
  | 'MOU'
  | 'Sponsor'
  | 'Educational'
  | 'Supplier'
  | 'Affiliated Dojang'
  | 'Media & Marketing'
  | 'Federation'
  | 'Healthcare'
  | 'Government/NGO'
  | 'Other';

export type PartnerStatus =
  | 'Active'
  | 'Pending Discussion'
  | 'MOU Signed'
  | 'Under Renewal'
  | 'Expired'
  | 'Terminated';

export interface Partner {
  id: string;
  name: string;
  brandName?: string;
  logoUrl?: string;
  partnerType: PartnerType;
  status: PartnerStatus;
  description?: string;
  collaborationScope?: string;
  benefitsSummary?: string;
  founderName?: string;
  founderContact?: string;
  contactName?: string;
  contactRole?: string;
  email?: string;
  phone?: string;
  telegramUsername?: string;
  telegramLink?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  secondaryContactTelegram?: string;
  websiteUrl?: string;
  address?: string;
  country?: string;
  mouSignedDate?: string;
  mouExpiryDate?: string;
  contractDocumentUrl?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SAMPLE_PARTNERS: Partner[] = [];

// --- Context ---

interface AppState {
  dataLoadErrors?: string[];
  dataLoadIssues?: DataLoadIssue[];
  isRefreshingData?: boolean;
  currentUser: User | null;
  users: User[];
  theme: 'light' | 'dark';
  language: 'en' | 'kh' | 'zh';
  students: Student[];
  branches: Branch[];
  classSessions: ClassSession[];
  classEnrollments: ClassEnrollment[];
  scholarships: Scholarship[];
  attendanceRecords: Attendance[];
  payments: Payment[];
  beltHistories: BeltHistory[];
  achievements: Achievement[];
  curriculumVideos: CurriculumVideo[];
  videoProgress: StudentVideoProgress[];
  muscles: Muscle[];
  assetMuscleRelations: AssetMuscleRelation[];
  isLoading: boolean;
  workoutTemplates: any[];
  physicalEvaluations: any[];
  beltTechniques: any[];
  bodyCompositions: any[];
  academyProfile: AcademyProfile;
  rolePermissions: Record<string, boolean>;
  permissionsReady?: boolean;
  userPermissions: Record<string, boolean>;
  staffDanRecords: StaffDanRecord[];
  partners: Partner[];
  systemNotification: SystemNotification | null;
  systemConfirm: SystemConfirm | null;
}

interface AppContextType {
  state: AppState;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'kh' | 'zh') => void;
  can: (permissionKey: string, targetUserId?: string) => boolean;
  canWrite: (module: SecurityModule, specificAction?: string, targetUserId?: string) => boolean;
  getAccessLevel: (module: SecurityModule, targetUserId?: string) => AccessLevel;
  updateRolePermissionsBatch: (updates: { role: Role; permissionKey: string; isGranted: boolean }[]) => Promise<{ success: boolean; error?: string }>;
  updateUserPermissionsBatch: (userId: string, updates: { permissionKey: string; isGranted: boolean | null }[]) => Promise<{ success: boolean; error?: string }>;
  fetchStaffDanHistory: (userId: string) => Promise<StaffDanRecord[]>;
  addStaffDanRecord: (record: Omit<StaffDanRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; data?: StaffDanRecord; error?: string }>;
  updateStaffDanRecord: (id: string, updates: Partial<StaffDanRecord>) => Promise<{ success: boolean; error?: string }>;
  deleteStaffDanRecord: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  createPartner: (partner: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; data?: Partner; error?: string }>;
  updatePartner: (id: string, updates: Partial<Partner>) => Promise<{ success: boolean; error?: string }>;
  deletePartner: (id: string) => Promise<{ success: boolean; error?: string }>;
  fetchPartners: () => Promise<Partner[]>;
  markAttendance: (studentId: string, date: string, status: 'Present' | 'Absent' | 'Late', classId?: number) => Promise<void>;
  deleteAttendanceRecords: (date: string, studentIds: string[], classId?: number) => Promise<void>;
  payInvoice: (studentId: string, year: number, month: string, amount: number, method?: string) => Promise<void>;
  prepayInvoiceBulk: (studentId: string, prepayments: { year: number; month: string; amount: number }[]) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'registrationDate'>) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addBeltHistory: (history: Omit<BeltHistory, 'id'>) => Promise<void>;
  updateBeltHistory: (id: number, data: Partial<BeltHistory>) => Promise<void>;
  deleteBeltHistory: (id: number, studentId: string) => Promise<void>;
  addAchievement: (achievement: Omit<Achievement, 'id'>) => Promise<void>;
  saveAchievements: (studentId: string, entries: Array<Omit<Achievement, 'id' | 'studentId'> & { id?: number }>, deletedIds?: number[]) => Promise<void>;
  deleteAchievement: (id: number) => Promise<void>;
  updateAchievement: (id: number, achievement: Partial<Omit<Achievement, 'id'>>) => Promise<void>;
  addBranch: (name: string) => Promise<void>;
  addClassSession: (session: Omit<ClassSession, 'id'>) => Promise<{ success: boolean; error?: string }>;
  updateClassSession: (id: number, data: Partial<ClassSession>) => Promise<{ success: boolean; error?: string }>;
  deleteClassSession: (id: number) => Promise<{ success: boolean; error?: string }>;
  enrollStudent: (studentId: string, classId: number) => Promise<{ success: boolean; error?: string }>;
  unenrollStudent: (studentId: string, classId: number) => Promise<{ success: boolean; error?: string }>;
  batchEnrollStudents: (studentIds: string[], classId: number) => Promise<{ success: boolean; enrolledCount: number; error?: string }>;
  addCurriculumVideo: (video: Omit<CurriculumVideo, 'id' | 'createdAt'> & { muscleRelations?: Omit<AssetMuscleRelation, 'assetId'>[] }) => Promise<void>;
  updateCurriculumVideo: (id: number, video: Partial<CurriculumVideo> & { muscleRelations?: Omit<AssetMuscleRelation, 'assetId'>[] }) => Promise<void>;
  deleteCurriculumVideo: (id: number) => Promise<void>;
  markVideoWatched: (studentId: string, videoId: number) => Promise<void>;
  toggleVideoProgress: (studentId: string, videoId: number, isCompleted: boolean) => Promise<void>;
  addUser: (user: Omit<User, 'id'> & { password?: string; studentId?: string }) => Promise<{ success: boolean; error?: string; temporaryPassword?: string }>;
  updateUser: (id: string, data: Partial<User> & { password?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  commitRoster: (date: string, branchId: number | 'all', classId: number | 'all') => Promise<{ count: number }>;
  addWorkoutTemplate: (template: any) => Promise<void>;
  updateWorkoutTemplate: (id: string, template: any) => Promise<void>;
  deleteWorkoutTemplate: (id: string) => Promise<void>;
  upsertPhysicalEvaluation: (studentId: string, skillName: string, beltLevel: string, grade: string) => Promise<void>;
  addBodyComposition: (composition: any) => Promise<void>;
  addBeltTechnique: (beltLevel: string, techniqueName: string, category: string) => Promise<void>;
  deleteBeltTechnique: (id: string) => Promise<void>;
  reconcileAllStudentBelts: () => Promise<{ success: boolean; scanned: number; corrected: number; details: string[] }>;
  showNotification: (
    message: string, 
    type?: 'success' | 'error' | 'info' | 'warning', 
    title?: string,
    code?: string,
    details?: string
  ) => void;
  reportError: (error: unknown, fallbackTitle?: string, fallbackMessage?: string) => NormalizedError;
  hideNotification: () => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => void;
  refreshData: () => Promise<void>;
  hideConfirm: () => void;
  updateAcademyProfile: (updates: Partial<AcademyProfile>, expectedUpdatedAt?: string) => Promise<{ success: boolean; error?: string; profile?: AcademyProfile }>;
}

export const normalizePartnerType = (t?: string): PartnerType => {
  if (!t) return 'MOU';
  const lower = t.toLowerCase();
  if (lower === 'mou') return 'MOU';
  if (lower === 'sponsor') return 'Sponsor';
  if (lower === 'school' || lower === 'university' || lower === 'educational') return 'Educational';
  if (lower === 'vendor' || lower === 'supplier') return 'Supplier';
  if (lower === 'affiliated dojang') return 'Affiliated Dojang';
  if (lower === 'media' || lower === 'media & marketing') return 'Media & Marketing';
  if (lower === 'federation') return 'Federation';
  if (lower === 'medical' || lower === 'healthcare') return 'Healthcare';
  if (lower === 'ngo' || lower === 'government/ngo') return 'Government/NGO';
  return 'Other';
};

export const normalizePartnerStatus = (s?: string): PartnerStatus => {
  if (!s) return 'Active';
  const lower = s.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'expired') return 'Expired';
  if (lower === 'terminated') return 'Terminated';
  if (lower.includes('renewal')) return 'Under Renewal';
  if (lower.includes('pending')) return 'Pending Discussion';
  if (lower.includes('signed')) return 'MOU Signed';
  return 'Active';
};

export const mapPartnerRow = (p: any): Partner => ({
  id: p.id,
  name: p.name,
  brandName: p.brandName || p.brand_name || undefined,
  logoUrl: p.logoUrl || p.logo_url || undefined,
  partnerType: normalizePartnerType(p.partnerType || p.partner_type),
  status: normalizePartnerStatus(p.status),
  description: p.description || undefined,
  collaborationScope: p.collaborationScope || p.collaboration_scope || undefined,
  benefitsSummary: p.benefitsSummary || p.benefits_summary || undefined,
  founderName: p.founderName || p.founder_name || undefined,
  founderContact: p.founderContact || p.founder_contact || undefined,
  contactName: partnerField(p,'contactName','contact_name',p.contact_person) || undefined,
  contactRole: p.contactRole || p.contact_role || undefined,
  email: p.email || undefined,
  phone: p.phone || undefined,
  telegramUsername: p.telegramUsername || p.telegram_username || undefined,
  telegramLink: partnerField(p,'telegramLink','telegram_link',p.telegram_url) || undefined,
  secondaryContactName: partnerField(p,'secondaryContactName','secondary_contact_name',p.secondary_contacts?.[0]?.name) || undefined,
  secondaryContactPhone: partnerField(p,'secondaryContactPhone','secondary_contact_phone',p.secondary_contacts?.[0]?.phone) || undefined,
  secondaryContactTelegram: partnerField(p,'secondaryContactTelegram','secondary_contact_telegram',p.secondary_contacts?.[0]?.telegram) || undefined,
  websiteUrl: partnerField(p,'websiteUrl','website_url',p.website) || undefined,
  address: partnerField(p,'address','address',p.city) || undefined,
  country: p.country || 'Cambodia',
  mouSignedDate: p.mouSignedDate || p.mou_signed_date || undefined,
  mouExpiryDate: p.mouExpiryDate || p.mou_expiry_date || undefined,
  contractDocumentUrl: partnerField(p,'contractDocumentUrl','contract_document_url',p.document_url) || undefined,
  notes: partnerField(p,'notes','notes',p.internal_notes) || undefined,
  tags: Array.isArray(p.tags) ? p.tags : [],
  createdAt: p.createdAt || p.created_at,
  updatedAt: p.updatedAt || p.updated_at
});

const AppContext = createContext<AppContextType | undefined>(undefined);

function initialAppState(): AppState {
  return {
    currentUser: null,
    users: [],
    theme: 'light',
    language: 'en',
    students: [],
    branches: [],
    classSessions: [],
    classEnrollments: [],
    scholarships: [],
    attendanceRecords: [],
    payments: [],
    beltHistories: [],
    achievements: [],
    curriculumVideos: [],
    videoProgress: [],
    muscles: [],
    assetMuscleRelations: [],
    isLoading: true,
    workoutTemplates: [],
    physicalEvaluations: [],
    beltTechniques: [],
    bodyCompositions: [],
    academyProfile: DEFAULT_ACADEMY_PROFILE,
    rolePermissions: {},
    permissionsReady: false,
    userPermissions: {},
    staffDanRecords: [],
    partners: [],
    systemNotification: null,
    systemConfirm: null
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const sessionRevision = React.useRef(0);
  const logoutInFlight = React.useRef<Promise<void> | null>(null);
  const refreshInFlight = React.useRef<Promise<void> | null>(null);
  const loadController = React.useRef<AbortController | null>(null);
  const invalidateSessionLoads = useCallback(() => {
    ++sessionRevision.current;
    loadController.current?.abort();
    refreshInFlight.current = null;
  }, []);
  const clearSessionState = useCallback((isLoading = false) => {
    invalidateSessionLoads();
    setState(s => ({ ...initialAppState(), theme: s.theme, language: s.language, academyProfile: s.academyProfile, isLoading }));
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('infinity_cached_')) sessionStorage.removeItem(key);
      }
    } catch { /* Storage may be disabled by the browser. */ }
  }, [invalidateSessionLoads]);

  const fetchInitialData = useCallback(async (userId: string) => {
    const revision = ++sessionRevision.current;
    const isCurrentSession = () => revision === sessionRevision.current;
    let failureDataset = 'profiles';
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const dataSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]);
    const profileSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    // Stale-While-Revalidate: Only block if we do not already have a cached session loaded in memory.
    setState(s => ({ ...s, isLoading: s.currentUser ? false : true, isRefreshingData: true }));

    // Safety Timeout Guard: prevent permanent loading hang
    const timeoutId = setTimeout(() => {
      if (!isCurrentSession()) return;
      setState(s => {
        if (s.isLoading) {
          console.warn("Fetch initial data timed out. Forcing portal load with available cache/state.");
          return { ...s, isLoading: false };
        }
        return s;
      });
    }, 4500); // 4.5s safety timeout

    try {
      // 1. Fetch Current User Profile & Member Details (independently, members 500 must not block login)
      const [profileResult, memberResult] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', userId).abortSignal(profileSignal).single(),
        supabase.from('members').select('*').eq('id', userId).abortSignal(profileSignal).maybeSingle() as any
      ]);

      if (!isCurrentSession()) return;

      const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
      const memberProfile = memberResult.status === 'fulfilled' ? memberResult.value.data : null;
      // An outage is not evidence that an account was deleted or suspended.
      if (profileResult.status === 'rejected') throw profileResult.reason;
      if (profileResult.value.error && profileResult.value.error.code !== 'PGRST116') throw profileResult.value.error;

      if (memberResult.status === 'rejected' || (memberResult.status === 'fulfilled' && memberResult.value.error)) {
        console.warn('[Store] Members fetch error (non-blocking):', 
          memberResult.status === 'rejected' ? memberResult.reason : memberResult.value.error?.message);
      }

      if (!profile || !profile.is_active || !['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'].includes(profile.role)) {
        clearTimeout(timeoutId);
        await supabase.auth.signOut({ scope: 'local' });
        if (isCurrentSession()) clearSessionState();
        return;
      }
      const mSelf = (memberProfile || {}) as any;
      const currentUser: User = {
        id: profile?.id || userId,
        username: profile.username || profile.email?.split('@')[0] || 'User',
        email: profile.email || '',
        displayName: profile.display_name || profile.username || profile.email?.split('@')[0] || 'User',
        role: profile.role as Role,
        mustChangePassword:profile.must_change_password ?? false,
        isActive: profile?.is_active ?? true,
        studentId: profile?.student_id || undefined,
        khmerName: mSelf.khmer_name || '',
        englishName: mSelf.english_name || '',
        gender: mSelf.gender,
        dob: mSelf.dob || '',
        phone: mSelf.phone || '',
        emergencyContactName: mSelf.emergency_contact_name || '',
        emergencyContactPhone: mSelf.emergency_contact_phone || '',
        emergencyContactRelation: mSelf.emergency_contact_relation || '',
        medicalNotes: mSelf.medical_notes || '',
        allergies: mSelf.allergies || '',
        profilePicturePath: mSelf.profile_picture_path || '',
        address: mSelf.address || '',
        kukkiwonId: profile?.kukkiwon_id || undefined,
        currentDan: profile?.current_dan != null ? Number(profile?.current_dan) : undefined,
        danIssueDate: profile?.dan_issue_date || undefined,
        danCertificateUrl: profile?.dan_certificate_url || undefined
      };


      // Set currentUser and clear loading state immediately so user is authenticated instantly without waiting for global table downloads
      setState(s => ({ ...s, currentUser, isLoading: false }));

      // 2. Bound simultaneous database requests while retaining independent failures.
      failureDataset = 'data';
      const globalResults = await settleReads<any>([
        () => fetchAllRows(supabase.from('profiles').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('members').select('*, member_addresses(*)').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('students').select('*, student_addresses(*)').is('deleted_at', null).abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('branches').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('class_sessions').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('class_enrollments').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('scholarships').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('attendance').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('payments').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('belt_histories').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('achievements').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('library_assets').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('lms_progress').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('workout_templates').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('student_physical_evaluations').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('belt_techniques').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('muscles').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('library_asset_muscles').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('student_body_compositions').select('*').abortSignal(dataSignal)),
        () => supabase.from('academy_profile').select('*').abortSignal(dataSignal).maybeSingle(),
        () => fetchAllRows(supabase.from('role_permissions').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('user_permissions').select('*').abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('staff_dan_history').select('*').order('dan_level', { ascending: true }).abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('partners').select('*').order('created_at', { ascending: false }).abortSignal(dataSignal)),
        () => fetchAllRows(supabase.from('payment_transactions').select('*').abortSignal(dataSignal))
      ]);

      if (!isCurrentSession()) return;
      const loadIssues: DataLoadIssue[] = [];
      const getVal = (res: PromiseSettledResult<any>, tableName?: string) => {
        if (res.status === 'fulfilled') {
          if (res.value.error) {
            const issue = dataLoadIssue(tableName || 'data', res.value.error);
            loadIssues.push(issue);
            console.warn('[Portal data unavailable]', issue.dataset, issue.code, issue.reason);
            return null;
          }
          return res.value.data;
        }
        const issue = dataLoadIssue(tableName || 'data', res.reason);
        loadIssues.push(issue);
        console.warn('[Portal data unavailable]', issue.dataset, issue.code, issue.reason);
        return null;
      };

      const profilesData = getVal(globalResults[0], 'profiles');
      const membersData = getVal(globalResults[1], 'members');
      const studentsData = getVal(globalResults[2], 'students');
      const branchesData = getVal(globalResults[3], 'branches');
      const classesData = getVal(globalResults[4], 'class_sessions');
      const enrollmentsData = getVal(globalResults[5], 'class_enrollments');
      const scholarshipsData = getVal(globalResults[6], 'scholarships');
      const attendanceData = getVal(globalResults[7], 'attendance');
      const paymentsData = getVal(globalResults[8], 'payments');
      const beltHistoryData = getVal(globalResults[9], 'belt_histories');
      const achievementsData = getVal(globalResults[10], 'achievements');
      const curriculumData = getVal(globalResults[11], 'library_assets');
      const progressData = getVal(globalResults[12], 'lms_progress');
      const templatesData = getVal(globalResults[13], 'workout_templates');
      const physicalEvalData = getVal(globalResults[14], 'student_physical_evaluations');
      const techniquesData = getVal(globalResults[15], 'belt_techniques');
      const musclesData = getVal(globalResults[16], 'muscles');
      const assetMuscleRelationsData = getVal(globalResults[17], 'library_asset_muscles');
      const bodyCompositionsData = getVal(globalResults[18], 'student_body_compositions');
      const academyProfileData = getVal(globalResults[19], 'academy_profile');
      const rolePermissionsData = getVal(globalResults[20], 'role_permissions');
      const userPermissionsData = getVal(globalResults[21], 'user_permissions');
      const staffDanData = getVal(globalResults[22], 'staff_dan_history');
      const partnersData = getVal(globalResults[23], 'partners');
      const transactionsData = getVal(globalResults[24], 'payment_transactions');
      const receiptsByInvoice = indexPaymentReceipts(transactionsData || []);

      const mappedStaffDanRecords: StaffDanRecord[] = Array.isArray(staffDanData) ? staffDanData.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        danLevel: d.dan_level,
        issueDate: d.issue_date,
        certificateNo: d.certificate_no || undefined,
        certificateUrl: d.certificate_url || undefined,
        examinerName: d.examiner_name || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      })) : [];




      const mappedPartners: Partner[] = Array.isArray(partnersData)
        ? partnersData.map(mapPartnerRow)
        : [];

      let finalPartners = mappedPartners;
      if (finalPartners.length === 0 && userId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const apiRes = await fetch('/api/admin/partners', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: 'no-store', signal: AbortSignal.timeout(15000),
            });
            if (apiRes.ok) {
              const apiJson = await apiRes.json();
              if (apiJson.success === true && Array.isArray(apiJson.data)) {
                finalPartners = apiJson.data.map(mapPartnerRow);
                const issueIndex = loadIssues.findIndex(issue => issue.dataset === 'partners');
                if (issueIndex !== -1) loadIssues.splice(issueIndex, 1);
              }
            }
          }
        } catch (e) {
          console.warn('[Store] API partners fallback check:', e);
        }
      }

      const mappedRolePermissions: Record<string, boolean> = {};
      if (Array.isArray(rolePermissionsData)) {
        rolePermissionsData.forEach((rp: any) => {
          mappedRolePermissions[`${rp.role}:${rp.permission_key}`] = rp.is_granted;
        });
      }

      const mappedUserPermissions: Record<string, boolean> = {};
      if (Array.isArray(userPermissionsData)) {
        userPermissionsData.forEach((up: any) => {
          mappedUserPermissions[`${up.user_id}:${up.permission_key}`] = up.is_granted;
        });
      }

      const membersMap = new Map(((membersData as any[]) || []).map((m: any) => [m.id, m]));

      let mappedUsers: User[] = [];
      if (profilesData && profilesData.length > 0) {
        mappedUsers = profilesData.map((u: any) => {
          const m = (membersMap.get(u.id) || {}) as any;
          const ma = Array.isArray(m.member_addresses) ? m.member_addresses.find((a: any) => a.is_primary) || m.member_addresses[0] : null;
          const addressObj = ma ? { id: ma.address_id, line1: ma.address_line1, line2: ma.address_line2, city: ma.district_commune, stateProvince: ma.state_province_city, postalCode: ma.postal_code, country: ma.country } : undefined;
          return { 
            id: u.id, 
            username: u.username, 
            email: u.email, 
            displayName: u.display_name, 
            role: u.role as Role, 
            isActive: u.is_active,
            studentId: u.student_id || undefined,
            khmerName: m.khmer_name || '',
            englishName: m.english_name || '',
            gender: m.gender,
            dob: m.dob || '',
            phone: m.phone || '',
            emergencyContactName: m.emergency_contact_name || '',
            emergencyContactPhone: m.emergency_contact_phone || '',
            emergencyContactRelation: m.emergency_contact_relation || '',
            medicalNotes: m.medical_notes || '',
            allergies: m.allergies || '',
            profilePicturePath: m.profile_picture_path || '',
            nationality: m.nationality || '',
            address: addressObj,
            kukkiwonId: u.kukkiwon_id || undefined,
            currentDan: u.current_dan != null ? Number(u.current_dan) : undefined,
            danIssueDate: u.dan_issue_date || undefined,
            danCertificateUrl: u.dan_certificate_url || undefined
          };
        });
      }

      const mappedStudents = (studentsData || []).map((s: any) => {
        const sa = Array.isArray(s.student_addresses) ? s.student_addresses.find((a: any) => a.is_primary) || s.student_addresses[0] : null;
        const addressObj = sa ? { id: sa.address_id, line1: sa.address_line1, line2: sa.address_line2, city: sa.district_commune, stateProvince: sa.state_province_city, postalCode: sa.postal_code, country: sa.country } : undefined;

        return {
          id: s.id,
          profileId: s.profile_id || undefined,
          khmerName: s.khmer_name,
          englishName: s.english_name,
          gender: s.gender,
          dob: s.dob,
          registrationDate: s.registration_date,
          scholarshipId: s.scholarship_id,
          heightCm: s.height_cm,
          weightKg: s.weight_kg,
          homeBranchId: s.home_branch_id,
          currentBelt: s.current_belt,
          studentStatus: s.student_status,
          statusReason: s.status_reason,
          statusChangedAt: s.status_changed_at,
          pauseEndDate: s.pause_end_date,
          email: s.email,
          phone: s.phone,
          emergencyContactName: s.emergency_contact_name,
          emergencyContactPhone: s.emergency_contact_phone,
          emergencyContactRelation: s.emergency_contact_relation,
          medicalNotes: s.medical_notes,
          allergies: s.allergies,
          address: addressObj,
          nationality: s.nationality,
          profilePicturePath: s.profile_picture_path,
          esignPath: s.esign_path,
          kukkiwonId: s.kukkiwon_id,
          notes: s.notes
        };
      });

      const mappedBranches = (branchesData || []).map((b: any) => ({ id: b.id, name: b.branch_name }));
      const mappedVideos = (curriculumData || []).map((c: any) => {
        const isFitness = c.library_type === 'Fitness';
        let actualCategory = isFitness ? `Fitness: ${c.fitness_category}` : c.tkd_category;
        
        if (c.description) {
          try {
            if (c.description.trim().startsWith('{') && c.description.trim().endsWith('}')) {
              const details = JSON.parse(c.description);
              if (details.actualCategory) {
                actualCategory = details.actualCategory;
              }
            }
          } catch (e) {
            // ignore
          }
        }
        
        if (!isFitness && actualCategory) {
          actualCategory = normalizeCategory(actualCategory);
        }

        return {
          id: c.id,
          title: c.title,
          description: c.description || '',
          category: actualCategory,
          minBeltLevel: isFitness ? 'Fitness' : c.target_level,
          videoUrl: c.video_url || '',
          createdAt: c.created_at || new Date().toISOString()
        };
      });

      const mappedTemplates = (templatesData || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        difficulty: t.difficulty,
        duration: t.duration_mins || 15,
        creator: t.creator_name || 'Coach',
        structure: t.structure
      }));

      const mappedMuscles = (musclesData || []).map((m: any) => {
        let meta: any = {};
        if (m.description && m.description.startsWith('{')) {
          try {
            meta = JSON.parse(m.description);
          } catch {
            meta = {};
          }
        }
        return {
          id: m.id,
          name: m.name,
          nameKh: m.name_kh || '',
          nameZh: m.name_zh || '',
          muscleGroup: m.muscle_group,
          targetFunction: m.target_function || '',
          diagramUrl: m.diagram_url || '',
          description: m.description || '',
          conceptId: m.concept_id || meta.conceptId || undefined,
          elementIds: m.element_ids || meta.elements || [],
          system: m.system || meta.system || 'muscular',
          latinName: m.latin_name || meta.latinName || undefined,
          tkdRelevance: m.tkd_relevance || meta.tkdRelevance || undefined,
        };
      });

      const mappedAssetMuscleRelations = (assetMuscleRelationsData || []).map((r: any) => ({
        assetId: r.asset_id,
        muscleId: r.muscle_id,
        role: r.role as 'Primary' | 'Secondary'
      }));

      if (!isCurrentSession()) return;
      // Commit only while the authenticated session that started this load still owns it.

      clearTimeout(timeoutId);
      setState(s => preserveUnavailableData(s, {
        ...s,
        currentUser,
        users: mappedUsers,
        students: mappedStudents,
        branches: mappedBranches,
        classSessions: (classesData || []).map((c: any) => ({
          id: c.id,
          branchId: c.branch_id,
          name: c.class_name,
          classType: (c.class_type || 'General Class') as ClassCategory,
          daysOfWeek: (c.days_of_week && c.days_of_week.length > 0) ? c.days_of_week : [c.day_of_week || 'Monday'],
          dayOfWeek: c.day_of_week || (c.days_of_week && c.days_of_week[0]) || 'Monday',
          startTime: c.start_time,
          endTime: c.end_time,
          capacity: c.capacity,
          coachId: c.coach_id || undefined,
          standardDurationMins: c.standard_duration_mins || 90
        })),
        classEnrollments: (enrollmentsData || []).map((e: any) => ({ id: e.id, studentId: e.student_id, classId: e.class_id, enrollmentDate: e.enrollment_date })),
        scholarships: (scholarshipsData || []).map((sc: any) => ({ id: sc.id, typeName: sc.type_name, discountPercentage: sc.discount_percentage })),
        attendanceRecords: (attendanceData || []).map((a: any) => ({ id: a.id, studentId: a.student_id, date: a.date, status: a.status, classId:a.class_id ?? undefined })),
        payments: (paymentsData || []).map((p: any) => {
          const receipt = receiptsByInvoice.get(invoiceKey(p.student_id, p.year, p.for_month));
          return { id: p.id, studentId: p.student_id, year: p.year, month: p.for_month, status: p.status, amountUsd: p.amount_usd, paymentDate: p.payment_date, receiptNumber: receipt?.receipt_number, paymentMethod: receipt?.payment_method };
        }),
        beltHistories: (beltHistoryData || []).map((b: any) => ({ 
          id: b.id, 
          studentId: b.student_id, 
          beltLevel: b.belt_level, 
          promotionDate: b.promotion_date, 
          testScore: b.test_score,
          program: b.program,
          certificateRef: b.certificate_id,
          kukkiwonDanCardId: b.kukkiwon_dan_card_id
        })),
        achievements: (achievementsData || []).map((a: any) => ({ id: a.id, studentId: a.student_id, eventName: a.event_name, date: a.date, category: a.category, division: a.division, medalRank: a.medal_rank, notes: a.notes, ageDivision: a.age_division || undefined, beltDivision: a.belt_division || undefined })),
        curriculumVideos: mappedVideos,
        videoProgress: (progressData || []).map((p: any) => ({ id: p.id, studentId: p.student_id, videoId: p.curriculum_id, status: p.status, lastWatchedAt: p.last_watched_at })),
        workoutTemplates: mappedTemplates,
        physicalEvaluations: (physicalEvalData || []).map((pe: any) => ({
          id: pe.id,
          studentId: pe.student_id,
          skillName: pe.skill_name,
          beltLevel: pe.belt_level,
          grade: pe.grade,
          evaluatedBy: pe.evaluated_by,
          updatedAt: pe.updated_at
        })),
        bodyCompositions: (bodyCompositionsData || []).map((bc: any) => ({
           id: bc.id,
           studentId: bc.student_id,
           recordedDate: bc.recorded_date,
           heightCm: bc.height_cm,
           weightKg: bc.weight_kg,
           bodyFatPercentage: bc.body_fat_percentage,
           skeletalMuscleMassKg: bc.skeletal_muscle_mass_kg,
           neckCm: bc.neck_cm,
           shoulderWidthCm: bc.shoulder_width_cm,
           chestCm: bc.chest_cm,
           waistCm: bc.waist_cm,
           hipsCm: bc.hips_cm,
           leftArmCm: bc.left_arm_cm,
           rightArmCm: bc.right_arm_cm,
           leftThighCm: bc.left_thigh_cm,
           rightThighCm: bc.right_thigh_cm,
           leftCalfCm: bc.left_calf_cm,
           rightCalfCm: bc.right_calf_cm,
           recordedBy: bc.recorded_by,
           createdAt: bc.created_at
        })),
        beltTechniques: (techniquesData || []).map((bt: any) => ({
          id: bt.id,
          beltLevel: bt.belt_level,
          techniqueName: bt.technique_name,
          category: bt.category || 'Kicks (Chagi)',
          createdAt: bt.created_at,
          createdBy: bt.created_by
        })),
        muscles: mappedMuscles,
        assetMuscleRelations: mappedAssetMuscleRelations,
        academyProfile: mapDbRowToAcademyProfile(academyProfileData),
        rolePermissions: mappedRolePermissions,
        permissionsReady: !loadIssues.some(issue => ['role_permissions', 'user_permissions'].includes(issue.dataset)),
        userPermissions: mappedUserPermissions,
        staffDanRecords: mappedStaffDanRecords,
        dataLoadErrors: loadIssues.map(issue => issue.dataset),
        dataLoadIssues: loadIssues,
        partners: finalPartners,
        isLoading: false
      }, loadIssues));

      if (academyProfileData && typeof window !== 'undefined') {
        try { localStorage.setItem('infinity_academy_profile', JSON.stringify(mapDbRowToAcademyProfile(academyProfileData))); }
        catch { /* Disabled browser storage must not mark a successful download as failed. */ }
      }

    } catch (error) {
      if (!isCurrentSession()) return;
      const issue = dataLoadIssue(failureDataset, error);
      console.warn('[Portal data unavailable]', issue.dataset, issue.code, issue.reason);
      setState(s => {
        const issues = [issue, ...(s.dataLoadIssues || []).filter(item => item.dataset !== issue.dataset)];
        return { ...s, isLoading: false, dataLoadIssues: issues, dataLoadErrors: issues.map(item => item.dataset) };
      });
    } finally {
      clearTimeout(timeoutId);
      if (isCurrentSession()) setState(s => ({ ...s, isRefreshingData: false }));
    }
  }, [clearSessionState]);

  const refreshData = useCallback((): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const revision = sessionRevision.current;
    const pending = (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (revision !== sessionRevision.current) return;
      if (error || !session) throw new Error('Please sign in again to reload records.');
      await fetchInitialData(session.user.id);
    })();
    refreshInFlight.current = pending;
    void pending.finally(() => {
      if (refreshInFlight.current === pending) refreshInFlight.current = null;
    }).catch(() => {});
    return pending;
  }, [fetchInitialData]);

  useEffect(() => {
    // 1. Try to load cached user immediately from sessionStorage to skip blocking loaders
    if (typeof window !== 'undefined') {
      try {
        // Clean up any legacy sensitive data from localStorage
        localStorage.removeItem('infinity_cached_user');
        localStorage.removeItem('infinity_cached_students');
        localStorage.removeItem('infinity_cached_branches');
        localStorage.removeItem('infinity_cached_videos');
        localStorage.removeItem('infinity_cached_techniques');
        localStorage.removeItem('infinity_cached_muscles');
        localStorage.removeItem('infinity_cached_asset_muscle_relations');
        localStorage.removeItem('infinity_cached_body_compositions');
      localStorage.removeItem('infinity_pos_sales_v2');
      localStorage.removeItem('infinity_pos_catalog_v2');
      localStorage.removeItem('infinity_lms_physical_grades');

        const cachedTheme = (localStorage.getItem('infinity_theme') as 'light' | 'dark') || 'light';
        const cachedLang = (localStorage.getItem('infinity_lang') as 'en' | 'kh' | 'zh') || 'en';
        setState(s => ({ ...s, theme: cachedTheme, language: cachedLang, isLoading: true }));

      } catch (e) {
        console.warn('Storage parse failed:', e);
      }
    }

    const stop = observePortalSession(supabase.auth, {
      onIdentityChange: () => clearSessionState(true),
      onSession: userId => { void fetchInitialData(userId); },
      onSignedOut: clearSessionState,
      onError: () => setState(s => ({ ...s, systemNotification: {
        type: 'error', message: 'Your session could not be verified. Please sign in again.', timestamp: Date.now(),
      } })),
    });
    return () => {
      stop();
      invalidateSessionLoads();
    };
  }, [clearSessionState, fetchInitialData, invalidateSessionLoads]);

  // Realtime events invalidate the canonical RLS snapshot. Partial event rows
  // cannot safely reconstruct joined addresses, receipts or revoked visibility.
  const realtimeUserId = state.currentUser?.id;
  useEffect(() => {
    if (!realtimeUserId) return;
    let active = true;
    let reconnecting = false;
    const recovery = createReadRecovery(refreshData,
      () => active && navigator.onLine !== false && document.visibilityState !== 'hidden');
    const channel = supabase.channel('infinity_realtime_sync:' + realtimeUserId);
    for (const table of PORTAL_REALTIME_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, recovery.request);
    }
    channel.subscribe(status => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        if (reconnecting) recovery.request();
        reconnecting = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reconnecting = true;
      }
    });
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') recovery.request();
    };
    window.addEventListener('online', recovery.request);
    document.addEventListener('visibilitychange', onVisible);
    // Realtime delivery is not guaranteed, and an archived row may no longer
    // pass SELECT RLS. Reconcile while visible without polling hidden tabs.
    const interval = setInterval(recovery.request, 60000);
    return () => {
      active = false;
      recovery.dispose();
      clearInterval(interval);
      window.removeEventListener('online', recovery.request);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [realtimeUserId, refreshData]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  useEffect(() => {
    if (state.language === 'kh') {
      document.documentElement.classList.add('font-khmer');
      document.documentElement.classList.remove('font-zh');
      document.documentElement.lang = 'km';
    } else if (state.language === 'zh') {
      document.documentElement.classList.remove('font-khmer');
      document.documentElement.classList.add('font-zh');
      document.documentElement.lang = 'zh';
    } else {
      document.documentElement.classList.remove('font-khmer');
      document.documentElement.classList.remove('font-zh');
      document.documentElement.lang = 'en';
    }
  }, [state.language]);

  const reportError = useCallback((error: unknown, fallbackTitle?: string, fallbackMessage?: string): NormalizedError => {
    const normalized = normalizeError(error, fallbackTitle, fallbackMessage);
    if (!normalized.isOperational) {
      console.warn('[AutoError: Technical]', normalized.title, normalized.details || normalized.message);
      reportClientError(error, fallbackTitle || 'Background operation');
    } else {
      console.info('[AutoNotice: Operational]', normalized.title, normalized.message);
    }
    setState(s => ({
      ...s,
      systemNotification: {
        title: normalized.title,
        message: normalized.message,
        type: normalized.severity,
        code: normalized.code,
        details: normalized.details,
        timestamp: normalized.timestamp,
      }
    }));
    return normalized;
  }, []);

  const showNotification = useCallback((
    message: string, 
    type: 'success' | 'error' | 'info' | 'warning' = 'info', 
    title?: string,
    code?: string,
    details?: string
  ) => {
    setState(s => ({
      ...s,
      systemNotification: { message, type, title, code, details, timestamp: Date.now() }
    }));
  }, []);

  const hideNotification = useCallback(() => {
    setState(s => ({
      ...s,
      systemNotification: null
    }));
  }, []);

  const showConfirm = (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => {
    setState(s => ({
      ...s,
      systemConfirm: { message, onConfirm, title, onCancel }
    }));
  };

  const hideConfirm = useCallback(() => {
    setState(s => ({
      ...s,
      systemConfirm: null
    }));
  }, []);

  const login = async (identifier: string, pass: string) => {
    try {
      // An older sign-out must finish before a new session can be established.
      await logoutInFlight.current;
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password: pass }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || !result.success) return { success: false, error: result.error?.message || 'Unable to sign in.' };
      const { error } = await supabase.auth.setSession(result.data);
      if (error) return { success: false, error: 'Unable to establish a secure session.' };
      return { success: true };
    } catch { return { success: false, error: 'The sign-in service is unavailable. Please retry.' }; }
  };

  const logout = () => {
    if (logoutInFlight.current) return logoutInFlight.current;
    const task = (async () => {
      invalidateSessionLoads();
      try {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) throw error;
      } catch {
        showNotification('Could not confirm sign-out on all devices. Please sign in again and retry from Account Security.', 'error');
        return;
      }
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('infinity_cached_') || ['infinity_pos_sales_v2', 'infinity_pos_catalog_v2', 'infinity_lms_physical_grades'].includes(key)) localStorage.removeItem(key);
        }
      } catch { /* A blocked storage API must not prevent sign-out. */ }
      clearSessionState();
    })();
    logoutInFlight.current = task;
    void task.then(() => { logoutInFlight.current = null; }, () => { logoutInFlight.current = null; });
    return task;
  };

  const markAttendance = async (studentId:string,date:string,status:'Present'|'Absent'|'Late',classId?:number) => {
    if(!can('action:attendance_mark')) throw new Error('You do not have permission to mark attendance.');
    const {data,error}=await supabase.from('attendance').upsert({student_id:studentId,date,status,class_id:classId || null,marked_by:state.currentUser?.id},{onConflict:'student_id,date,class_id'}).select().single();
    if(error || !data){showNotification('Attendance was not saved. Please retry.','error');throw error || new Error('Attendance was not saved.');}
    const record={id:data.id,studentId:data.student_id,date:data.date,status:data.status,classId:data.class_id ?? undefined};
    setState(prev=>({...prev,attendanceRecords:[...prev.attendanceRecords.filter(r=>!(r.studentId===studentId && r.date===date && r.classId===record.classId)),record]}));
  };

  const deleteAttendanceRecords = async (date:string,studentIds:string[],classId?:number) => {
    if(!can('action:attendance_delete'))throw new Error('Permission denied.');
    let query=supabase.from('attendance').delete().eq('date',date).in('student_id',studentIds);
    if(classId)query=query.eq('class_id',classId);
    const {error}=await query;if(error)throw error;
    setState(prev=>({...prev,attendanceRecords:prev.attendanceRecords.filter(r=>!(r.date===date&&studentIds.includes(r.studentId)&&(!classId||r.classId===classId)))}));
  };

  const pendingPaymentKeys = React.useRef(new Map<string, string>());
  const pendingMeasurementKeys = React.useRef(new Map<string, string>());
  const recordPayments = async (studentId: string, entries: { year: number; month: string; amount: number }[], method = 'Cash') => {
    if (!can('action:finance_record_payment')) throw new Error('You do not have permission to record payments.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again.');
    const signature = JSON.stringify({ studentId, entries, method });
    const requestKey = pendingPaymentKeys.current.get(signature) || crypto.randomUUID();
    pendingPaymentKeys.current.set(signature, requestKey);
    const response = await fetch('/api/admin/payments', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ studentId, entries, method, requestKey }) });
    const result = await response.json();
    if (!response.ok) throw new Error(unwrapApiError(result, 'Payment was not recorded.'));
    pendingPaymentKeys.current.delete(signature);
    await fetchInitialData(session.user.id);
  };
  const payInvoice = async (studentId: string, year: number, month: string, amount: number, method = 'Cash') => recordPayments(studentId, [{year,month,amount}], amount === 0 ? 'Waived' : method);
  const prepayInvoiceBulk = async (studentId: string, prepayments: { year: number; month: string; amount: number }[]) => recordPayments(studentId, prepayments);

  const addStudent = async (student: Omit<Student, 'id' | 'registrationDate'>) => {
    const role = state.currentUser?.role;
    if (!can('action:student_create')) {
      return { success: false, error: 'Unauthorized Access: You do not have permission to provision new student accounts.' };
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return { success: false, error: 'Authentication session expired. Please log in again.' };

      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ studentData: { ...student } })
      });
      const resData = await res.json();
      if (!res.ok) {
        const errStr = unwrapApiError(resData, 'Failed to create student.');
        const normalized = reportError(errStr, 'Failed to Register Student');
        return { success: false, error: normalized.message };
      }
      const d = resData.data;
      setState(t => {
        const newStu = {
          ...student,
          id: d.id,
          registrationDate: d.registrationDate,
          khmerName: d.khmerName,
          englishName: d.englishName,
          dob: d.dob,
          email: d.email,
          phone: d.phone,
          emergencyContactName: d.emergencyContactName,
          emergencyContactPhone: d.emergencyContactPhone,
          emergencyContactRelation: d.emergencyContactRelation,
          medicalNotes: d.medicalNotes,
          allergies: d.allergies,
          currentBelt: d.currentBelt
        } as Student;
        const nextState = {
          ...t,
          students: [...t.students.filter(x => x.id !== d.id), newStu]
        };
        if (d.enrollmentId && (student as any).initialClassId) {
          nextState.classEnrollments = [...t.classEnrollments, {
            id: d.enrollmentId,
            studentId: d.id,
            classId: (student as any).initialClassId
          }];
        }
        return nextState;
      });
      return { success: true };
    } catch (e: any) {
      const normalized = reportError(e, 'Failed to Register Student');
      return { success: false, error: normalized.message };
    }
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    const role = state.currentUser?.role;
    if (!can('action:student_edit')) {
      showNotification('Unauthorized Access: You do not have permissions to modify student records.', 'warning');
      throw new Error('You do not have permission to edit student records.');
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/update-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, data: {...data,...((data as any).classEnrollmentDate?{enrollmentId:state.classEnrollments.find(e=>e.studentId===id)?.id}: {})} })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to update student details.'));

      const existing=state.students.find(s=>s.id===id);
      const profileUser=state.users.find(u=>u.role==='Student' && (u.id===existing?.profileId || u.studentId===id));
      setState(s => {
        const students = s.students.map(x => x.id === id ? { ...x, ...data } : x);
        let users = s.users;
        if (profileUser) {
          users = s.users.map(u => u.id === profileUser.id ? {
            ...u,
            displayName: data.englishName ?? u.displayName,
            isActive: data.studentStatus==='Suspended'?false:u.isActive
          } : u);
        }
        const enrollmentDate=(data as any).classEnrollmentDate;
        const enrollmentId=state.classEnrollments.find(e=>e.studentId===id)?.id;
        return { ...s, students, users,classEnrollments:enrollmentDate?s.classEnrollments.map(e=>e.id===enrollmentId?{...e,enrollmentDate}:e):s.classEnrollments };
      });
    } catch (e: any) {
      showNotification('Failed to update student: ' + e.message, 'error');
      throw e;
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/delete-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to delete student record.'));

      const existing=state.students.find(s=>s.id===id);
      const profileUser=state.users.find(u=>u.role==='Student' && (u.id===existing?.profileId || u.studentId===id));
      setState(s => ({
        ...s,
        students: s.students.filter(x => x.id !== id),
        classEnrollments: s.classEnrollments.filter(e => e.studentId !== id),
        beltHistories: s.beltHistories.filter(b => b.studentId !== id),
        users: profileUser ? s.users.map(u => u.id === profileUser.id ? { ...u, isActive: false } : u) : s.users
      }));
      showNotification("Student archived successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteStudent error:", e);
      showNotification("Failed to archive student: " + (e.message || e), 'error');
      throw e;
    }
  };

  const refreshStudentBelt = async (studentId:string) => {
    const {data,error}=await supabase.from('students').select('current_belt').eq('id',studentId).single();
    if(error){showNotification('Promotion was saved, but the displayed rank could not refresh. Reload the student profile.','warning');return;}
    setState(prev=>({...prev,students:prev.students.map(student=>student.id===studentId?{...student,currentBelt:data.current_belt}:student)}));
  };
  const beltHistoryPayload = (history:Partial<BeltHistory>) => {
    const row:any={};
    const keys={studentId:'student_id',beltLevel:'belt_level',promotionDate:'promotion_date',testScore:'test_score',program:'program',certificateRef:'certificate_id',kukkiwonDanCardId:'kukkiwon_dan_card_id'};
    for(const [key,column] of Object.entries(keys))if(history[key as keyof BeltHistory]!==undefined) {
      const value = history[key as keyof BeltHistory];
      row[column] = (key === 'certificateRef' || key === 'kukkiwonDanCardId') && value === '' ? null : value;
    }
    return row;
  };
  const mapBeltHistory = (row:any):BeltHistory => ({id:row.id,studentId:row.student_id,beltLevel:row.belt_level,promotionDate:row.promotion_date,testScore:row.test_score,program:row.program,certificateRef:row.certificate_id,kukkiwonDanCardId:row.kukkiwon_dan_card_id});
  const addBeltHistory = async (history:Omit<BeltHistory,'id'>) => {
    if(!can('action:evaluations_grade'))throw new Error('Permission denied.');
    const {data,error}=await supabase.from('belt_histories').insert(beltHistoryPayload(history)).select().single();
    if(error || !data)throw error || new Error('Promotion was not saved.');
    setState(prev=>({...prev,beltHistories:[...prev.beltHistories.filter(h=>h.id!==data.id),mapBeltHistory(data)]}));
    await refreshStudentBelt(history.studentId);
    showNotification('Promotion logged successfully.','success');
  };
  const updateBeltHistory = async (id:number,history:Partial<BeltHistory>) => {
    if(!can('action:evaluations_grade'))throw new Error('Permission denied.');
    const {data,error}=await supabase.from('belt_histories').update(beltHistoryPayload(history)).eq('id',id).select().single();
    if(error || !data)throw error || new Error('Promotion was not saved.');
    setState(prev=>({...prev,beltHistories:prev.beltHistories.map(h=>h.id===id?mapBeltHistory(data):h)}));
    await refreshStudentBelt(data.student_id);
    showNotification('Promotion record updated successfully.','success');
  };
  const deleteBeltHistory = async (id:number,studentId:string) => {
    if(!can('action:evaluations_grade'))throw new Error('Permission denied.');
    const {data,error}=await supabase.from('belt_histories').delete().eq('id',id).eq('student_id',studentId).select('id');
    if(error || !data?.length)throw error || new Error('Promotion was already removed or could not be deleted.');
    setState(prev=>({...prev,beltHistories:prev.beltHistories.filter(h=>h.id!==id)}));
    await refreshStudentBelt(studentId);
    showNotification('Promotion record deleted successfully.','success');
  };
  const reconcileAllStudentBelts = async () => {
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)throw new Error('Please sign in again.');
    const response=await fetch('/api/admin/promotions/reconcile',{method:'POST',headers:{Authorization:'Bearer '+session.access_token}});
    const result=await response.json();
    if(!response.ok)throw new Error(unwrapApiError(result,'Belts could not be reconciled.'));
    await fetchInitialData(session.user.id);
    return result.data;
  };

  const pendingAchievementKeys = React.useRef(new Map<string, string>());
  const saveAchievements = async (studentId: string, entries: Array<Omit<Achievement, 'id' | 'studentId'> & { id?: number }>, deletedIds: number[] = []) => {
    if (!can('action:student_edit')) throw new Error('You do not have permission to edit achievements.');
    const revision = sessionRevision.current;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again.');
    const signature = JSON.stringify([session.user.id, studentId, entries, deletedIds]);
    const requestKey = pendingAchievementKeys.current.get(signature) || crypto.randomUUID();
    pendingAchievementKeys.current.set(signature, requestKey);
    const response = await fetch('/api/admin/achievements', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      signal: AbortSignal.timeout(15000), body: JSON.stringify({ studentId, entries, deletedIds, requestKey }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(unwrapApiError(result, 'Achievements were not saved.'));
    if (result?.success !== true || !Array.isArray(result.data?.records) || result.data.records.length !== entries.length) throw new Error('Achievement save was not confirmed.');
    pendingAchievementKeys.current.delete(signature);
    if (revision !== sessionRevision.current) throw new Error('Your session changed. Reload to verify the saved achievements.');
    const records: Achievement[] = result.data.records.map((row: any) => ({
      id: row.id, studentId: row.student_id, eventName: row.event_name, date: row.date, category: row.category,
      division: row.division, medalRank: row.medal_rank, notes: row.notes ?? undefined,
      ageDivision: row.age_division ?? undefined, beltDivision: row.belt_division ?? undefined,
    }));
    const affected = new Set([...deletedIds, ...records.map(row => row.id)]);
    setState(previous => ({ ...previous, achievements: [...previous.achievements.filter(row => !affected.has(row.id)), ...records] }));
    showNotification('Tournament achievements saved successfully.', 'success');
  };

  const addAchievement = async ({ studentId, ...entry }: Omit<Achievement, 'id'>) => saveAchievements(studentId, [entry]);
  const deleteAchievement = async (id: number) => {
    const existing = state.achievements.find(row => row.id === id);
    if (!existing) throw new Error('Achievement not found. Reload before retrying.');
    await saveAchievements(existing.studentId, [], [id]);
  };
  const updateAchievement = async (id: number, changes: Partial<Omit<Achievement, 'id'>>) => {
    const existing = state.achievements.find(row => row.id === id);
    if (!existing || (changes.studentId !== undefined && changes.studentId !== existing.studentId)) throw new Error('Achievement not found for this student.');
    const { studentId, ...entry } = { ...existing, ...changes };
    await saveAchievements(studentId, [entry]);
  };

  const addBranch = async (name: string) => {
    if (!can('action:schedule_manage')) throw new Error('You do not have permission to add branches.');
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({ branch_name: name.trim() })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Branch save was not confirmed.');
      if (data) {
        const newBranch = { id: data.id, name: data.branch_name };
        setState(s => ({
          ...s,
          branches: [...s.branches.filter(x => x.id !== data.id), newBranch]
        }));
        showNotification("Branch added successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addBranch error:", e);
      showNotification("Failed to add branch: " + e.message, 'error');
      throw e;
    }
  };

  const addClassSession = async (session: Omit<ClassSession, 'id'>): Promise<{ success: boolean; error?: string }> => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach') {
      showNotification("Permission Denied: Only Head Coaches or Admins can add class sessions.", 'error');
      return { success: false, error: 'Permission denied' };
    }
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.access_token}`
        },
        body: JSON.stringify(session)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(data, 'Failed to add class session.'));

      const newSession = { ...session, id: data.data.id };
      setState(s => ({
        ...s,
        classSessions: [...s.classSessions.filter(x => x.id !== data.data.id), newSession]
      }));
      showNotification("Class session added successfully.", 'success');
      return { success: true };
    } catch (e: any) {
      showNotification("Failed to add class session: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const updateClassSession = async (id: number, data: Partial<ClassSession>): Promise<{ success: boolean; error?: string }> => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach') {
      showNotification("Permission Denied: Only Head Coaches or Admins can update class sessions.", 'error');
      return { success: false, error: 'Permission denied' };
    }
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/classes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.access_token}`
        },
        body: JSON.stringify({ id, data })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to update class session.'));

      setState(s => ({
        ...s,
        classSessions: s.classSessions.map(x => x.id === id ? { ...x, ...data } : x)
      }));
      showNotification("Class session updated successfully.", 'success');
      return { success: true };
    } catch (e: any) {
      showNotification("Failed to update class session: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const deleteClassSession = async (id: number): Promise<{ success: boolean; error?: string }> => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach') {
      showNotification("Permission Denied: Only Head Coaches or Admins can delete class sessions.", 'error');
      return { success: false, error: 'Permission denied' };
    }
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/classes?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(data, 'Failed to delete class session.'));

      setState(s => ({
        ...s,
        classSessions: s.classSessions.filter(x => x.id !== id),
        classEnrollments: s.classEnrollments.filter(x => x.classId !== id)
      }));
      showNotification("Class session deleted successfully.", 'success');
      return { success: true };
    } catch (e: any) {
      showNotification("Failed to delete class session: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const enrollStudent = async (studentId: string, classId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = state.classSessions.find(s => s.id === classId);
      if (!session) {
        showNotification("Class session not found.", 'error');
        return { success: false, error: 'Session not found' };
      }

      // Check if already enrolled
      const isAlreadyEnrolled = state.classEnrollments.some(e => e.studentId === studentId && e.classId === classId);
      if (isAlreadyEnrolled) {
        showNotification("Student is already enrolled in this class session.", 'info');
        return { success: true };
      }

      // Enforce capacity bounds
      const currentEnrolled = state.classEnrollments.filter(e => e.classId === classId && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active').length;
      if (currentEnrolled >= session.capacity && state.students.find(s => s.id === studentId)?.studentStatus === 'Active') {
        showNotification(`Cannot enroll: "${session.name}" has reached maximum capacity (${session.capacity}).`, 'error');
        return { success: false, error: 'Class is at full capacity' };
      }

      const enrollmentDate = academyDate();
      const { data, error } = await supabase
        .from('class_enrollments')
        .insert({ student_id: studentId, class_id: classId, enrollment_date: enrollmentDate })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const newEnrollment = { id: data.id, studentId, classId, enrollmentDate };
        setState(s => ({
          ...s,
          classEnrollments: [...s.classEnrollments.filter(x => x.id !== data.id), newEnrollment]
        }));
        showNotification("Student enrolled successfully.", 'success');
        return { success: true };
      }
      throw new Error('Enrollment save was not confirmed.');
    } catch (e: any) {
      console.error("[Store] enrollStudent error:", e);
      showNotification("Failed to enroll student: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const unenrollStudent = async (studentId: string, classId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('class_enrollments')
        .delete()
        .match({ student_id: studentId, class_id: classId }).select('id').single();

      if (error) throw error;
      if (!data) throw new Error('Enrollment removal was not confirmed.');
      setState(s => ({
        ...s,
        classEnrollments: s.classEnrollments.filter(x => x.studentId !== studentId || x.classId !== classId)
      }));
      showNotification("Student unenrolled successfully.", 'success');
      return { success: true };
    } catch (e: any) {
      console.error("[Store] unenrollStudent error:", e);
      showNotification("Failed to unenroll student: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const batchEnrollStudents = async (studentIds: string[], classId: number): Promise<{ success: boolean; enrolledCount: number; error?: string }> => {
    try {
      const session = state.classSessions.find(s => s.id === classId);
      if (!session) {
        showNotification("Class session not found.", 'error');
        return { success: false, enrolledCount: 0, error: 'Session not found' };
      }

      const existingEnrolledSet = new Set(
        state.classEnrollments.filter(e => e.classId === classId).map(e => e.studentId)
      );
      const toEnroll = studentIds.filter(id => !existingEnrolledSet.has(id));

      if (toEnroll.length === 0) {
        showNotification("All selected students are already enrolled.", 'info');
        return { success: true, enrolledCount: 0 };
      }

      const currentEnrolledCount = state.classEnrollments.filter(
        e => e.classId === classId && state.students.find(s => s.id === e.studentId)?.studentStatus === 'Active'
      ).length;

      const availableSlots = Math.max(0, session.capacity - currentEnrolledCount);
      if (availableSlots <= 0) {
        showNotification(`Cannot enroll: "${session.name}" is already at full capacity (${session.capacity}).`, 'error');
        return { success: false, enrolledCount: 0, error: 'Class is at full capacity' };
      }

      const allowedStudentIds = toEnroll.slice(0, availableSlots);
      if (allowedStudentIds.length < toEnroll.length) {
        showNotification(`Enrolling only ${allowedStudentIds.length} students due to session capacity limit (${session.capacity}).`, 'warning');
      }

      const enrollmentDate = academyDate();
      const recordsToInsert = allowedStudentIds.map(studentId => ({
        student_id: studentId,
        class_id: classId,
        enrollment_date: enrollmentDate
      }));

      const { data, error } = await supabase
        .from('class_enrollments')
        .insert(recordsToInsert)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const newEnrollments = data.map((d: any) => ({
          id: d.id,
          studentId: d.student_id,
          classId: d.class_id,
          enrollmentDate: d.enrollment_date
        }));

        const newIds = new Set(newEnrollments.map(x => x.id));
        setState(s => ({
          ...s,
          classEnrollments: [
            ...s.classEnrollments.filter(x => !newIds.has(x.id)),
            ...newEnrollments
          ]
        }));

        showNotification(`Successfully enrolled ${newEnrollments.length} student(s).`, 'success');
        return { success: true, enrolledCount: newEnrollments.length };
      }

      return { success: true, enrolledCount: 0 };
    } catch (e: any) {
      console.error("[Store] batchEnrollStudents error:", e);
      showNotification("Batch enrollment failed: " + (e.message || 'Unknown error'), 'error');
      return { success: false, enrolledCount: 0, error: e.message };
    }
  };

  const pendingLibraryKeys = React.useRef(new Map<string,string>());
  const libraryRequest = async (path:string,payload:unknown) => {
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)throw new Error('Please sign in again.');
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok)throw new Error(unwrapApiError(result,'Library update failed.'));
    return result.data;
  };
  const saveLibraryVideo = async (id:number|null, video:Partial<CurriculumVideo> & {muscleRelations?:Omit<AssetMuscleRelation,'assetId'>[]}) => {
    if(!can('action:curriculum_edit'))throw new Error('You do not have permission to edit the library.');
    const current=id===null?undefined:state.curriculumVideos.find(v=>v.id===id);
    if(id!==null&&!current)throw new Error('Library asset not found. Refresh and try again.');
    const merged={...current,...video};
    const category=merged.category || 'Forms (Poomsae)';
    const fitness=merged.minBeltLevel==='Fitness'||category.startsWith('Fitness:');
    let description=merged.description || '';
    try {const parsed=JSON.parse(description);description=JSON.stringify({...parsed,actualCategory:category});}
    catch {description=JSON.stringify({text:description,actualCategory:category});}
    const asset={title:merged.title || '',description,library_type:fitness?'Fitness':'Taekwondo',tkd_category:fitness?null:mapCategoryToDbEnum(category),fitness_category:fitness?category.replace('Fitness: ',''):null,target_level:fitness?'All':merged.minBeltLevel || 'White',video_url:merged.videoUrl || '',...(video.muscleRelations!==undefined?{muscleRelations:video.muscleRelations}:{})};
    const signature=JSON.stringify([state.currentUser?.id,asset]);
    const requestKey=pendingLibraryKeys.current.get(signature)||crypto.randomUUID();
    if(id===null)pendingLibraryKeys.current.set(signature,requestKey);
    const result=await libraryRequest('/api/admin/library-assets',id===null?{action:'CREATE',asset,requestKey}:{action:'UPDATE',id,asset});
    const data=result.asset;
    if(!data||!Array.isArray(result.relations))throw new Error('Library save was not confirmed.');
    if(id===null)pendingLibraryKeys.current.delete(signature);
    const mapped={id:data.id,title:data.title,description:data.description || '',category,minBeltLevel:fitness?'Fitness':data.target_level,videoUrl:data.video_url || '',createdAt:data.created_at};
    const relations=result.relations.map((r:any)=>({assetId:r.asset_id,muscleId:r.muscle_id,role:r.role}));
    setState(s=>({...s,curriculumVideos:[...s.curriculumVideos.filter(v=>v.id!==mapped.id),mapped],assetMuscleRelations:[...s.assetMuscleRelations.filter(r=>r.assetId!==mapped.id),...relations]}));
    showNotification(id===null?'Video added successfully.':'Video updated successfully.','success');
  };
  const addCurriculumVideo = async (video:Omit<CurriculumVideo,'id'|'createdAt'> & {muscleRelations?:Omit<AssetMuscleRelation,'assetId'>[]}) => {
    try {await saveLibraryVideo(null,video);}catch(e){showNotification(e instanceof Error?e.message:'Video save failed.','error');throw e;}
  };
  const updateCurriculumVideo = async (id:number,video:Partial<CurriculumVideo> & {muscleRelations?:Omit<AssetMuscleRelation,'assetId'>[]}) => {
    try {await saveLibraryVideo(id,video);}catch(e){showNotification(e instanceof Error?e.message:'Video save failed.','error');throw e;}
  };
  const deleteCurriculumVideo = async (id:number) => {
    try {
      if(!can('action:curriculum_edit'))throw new Error('You do not have permission to edit the library.');
      await libraryRequest('/api/admin/library-assets',{action:'DELETE',id});
      setState(s=>({...s,curriculumVideos:s.curriculumVideos.filter(v=>v.id!==id),assetMuscleRelations:s.assetMuscleRelations.filter(r=>r.assetId!==id)}));
      showNotification('Video deleted successfully.','success');
    }catch(e){showNotification(e instanceof Error?e.message:'Video deletion failed.','error');throw e;}
  };

  const addWorkoutTemplate = async (template: any) => {
    if(!can('action:curriculum_edit'))throw new Error('You do not have permission to edit routines.');
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          title: template.title,
          description: template.description,
          difficulty: template.difficulty,
          duration_mins: template.duration,
          creator_name: template.creator,
          structure: template.structure
        })
        .select()
        .single();

      if (error || !data) throw error || new Error('Routine save was not confirmed.');
      if (data) {
        const mapped = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          difficulty: data.difficulty,
          duration: data.duration_mins || 15,
          creator: data.creator_name || 'Coach',
          structure: data.structure
        };
        setState(s => ({
          ...s,
          workoutTemplates: [...s.workoutTemplates.filter(x => x.id !== mapped.id), mapped]
        }));
        showNotification("Workout template saved successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addWorkoutTemplate error:", e);
      showNotification("Failed to save workout template: " + e.message, 'error');
      throw e;
    }
  };

  const updateWorkoutTemplate = async (id: string, template: any) => {
    if(!can('action:curriculum_edit'))throw new Error('You do not have permission to edit routines.');
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .update({
          title: template.title,
          description: template.description,
          difficulty: template.difficulty,
          duration_mins: template.duration,
          creator_name: template.creator,
          structure: template.structure
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) throw error || new Error('Routine save was not confirmed.');
      if (data) {
        const mapped = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          difficulty: data.difficulty,
          duration: data.duration_mins || 15,
          creator: data.creator_name || 'Coach',
          structure: data.structure
        };
        setState(s => ({
          ...s,
          workoutTemplates: s.workoutTemplates.map(x => x.id === id ? mapped : x)
        }));
        showNotification("Workout template updated successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] updateWorkoutTemplate error:", e);
      showNotification("Failed to update workout template: " + e.message, 'error');
      throw e;
    }
  };

  const deleteWorkoutTemplate = async (id: string) => {
    if(!can('action:curriculum_edit'))throw new Error('You do not have permission to edit routines.');
    try {
      const { error } = await supabase.from('workout_templates').delete().eq('id', id).select('id').single();
      if (error) throw error;
      setState(s => ({
        ...s,
        workoutTemplates: s.workoutTemplates.filter(x => x.id !== id)
      }));
      showNotification("Workout template deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteWorkoutTemplate error:", e);
      showNotification("Failed to delete workout template: " + e.message, 'error');
      throw e;
    }
  };

  const toggleVideoProgress = async (studentId:string,videoId:number,isCompleted:boolean) => {
    try {
      if(!can('action:evaluations_grade'))throw new Error('You do not have permission to grade progress.');
      const data=await libraryRequest('/api/admin/library-assets/progress',{studentId,assetId:videoId,completed:isCompleted});
      setState(s=>({...s,videoProgress:[...s.videoProgress.filter(p=>p.studentId!==studentId||p.videoId!==videoId),...(isCompleted?[{id:data.id,studentId,videoId,status:'Completed' as const,lastWatchedAt:data.last_watched_at}]:[])]}));
      showNotification('Video watch status updated.','success');
    }catch(e){showNotification(e instanceof Error?e.message:'Video progress failed.','error');}
  };
  const markVideoWatched = async (studentId:string,videoId:number) => toggleVideoProgress(studentId,videoId,true);

  const addUser = async (user: Omit<User, 'id'> & { password?: string; studentId?: string }) => {
    const role = state.currentUser?.role;
    if (!can('action:staff_manage')) {
      return { success: false, error: 'Unauthorized Access: Only administrators can provision system accounts.' };
    }
    const email = user.email.trim();
    const password = user.password || undefined; // The API generates unique credentials when none are supplied.
    const username = user.username;
    const displayName = user.displayName;
    const userRole = user.role;

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) return { success: false, error: 'Authentication session not found. Please log in again.' };

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          password,
          username,
          displayName,
          role: userRole,
          studentId: user.studentId || (user as any).studentId || undefined,
          isActive: user.isActive !== undefined ? user.isActive : true,
          khmerName: user.khmerName || undefined,
          englishName: user.englishName || undefined,
          gender: user.gender,
          dob: user.dob || undefined,
          phone: user.phone || undefined,
          emergencyContactName: user.emergencyContactName || undefined,
          emergencyContactPhone: user.emergencyContactPhone || undefined,
          emergencyContactRelation: user.emergencyContactRelation || undefined,
          medicalNotes: user.medicalNotes || undefined,
          allergies: user.allergies || undefined,
          profilePicturePath: user.profilePicturePath || undefined,
          address: user.address,
          nationality: user.nationality || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = (typeof data.error === 'object' ? data.error?.message : data.error) || data.message || 'Failed to create user via admin API.';
        const normalized = reportError(errorMsg, 'Failed to Create User Account');
        return { success: false, error: normalized.message };
      }

      if (state.currentUser) {
        await fetchInitialData(state.currentUser.id);
      }
      if (data.data?.temporaryPassword) showConfirm(`Account: ${username}\nTemporary password: ${data.data.temporaryPassword}\nCopy this credential now and ask the user to change it after signing in.`, () => {}, 'New account credential');
      showNotification('User account created successfully.', 'success');
      return { success: true, temporaryPassword:data.data?.temporaryPassword };
    } catch (e: any) {
      const normalized = reportError(e, 'Failed to Create User Account');
      return { success: false, error: normalized.message };
    }
  };

  const commitRoster = async (date:string,branchId:number|'all',classId:number|'all') => {
    if(!can('action:attendance_mark'))throw new Error('Permission denied.');
    const weekday=new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
    const rows=state.classEnrollments.flatMap(e=>{
      const student=state.students.find(s=>s.id===e.studentId);
      const session=state.classSessions.find(c=>c.id===e.classId);
      if(!student || !session || student.studentStatus!=='Active' || (branchId!=='all' && session.branchId!==branchId) || (classId!=='all' && e.classId!==classId) || !session.daysOfWeek.includes(weekday) || date<(e.enrollmentDate || student.registrationDate).slice(0,10))return [];
      return [{student_id:student.id,date,class_id:e.classId,status:'Absent',marked_by:state.currentUser?.id}];
    });
    if(!rows.length)return {count:0};
    const {data,error}=await supabase.from('attendance').upsert(rows,{onConflict:'student_id,date,class_id',ignoreDuplicates:true}).select();
    if(error)throw error;
    setState(prev=>({...prev,attendanceRecords:[...prev.attendanceRecords,...(data||[]).filter(r=>!prev.attendanceRecords.some(a=>a.id===r.id)).map(r=>({id:r.id,studentId:r.student_id,date:r.date,status:r.status,classId:r.class_id ?? undefined}))]}));
    return {count:data?.length || 0};
  };

  const updateUser = async (id: string, data: Partial<User> & { password?: string }) => {
    const role = state.currentUser?.role;
    const isSelf = state.currentUser?.id === id;
    if (!can('action:staff_manage') && !isSelf) {
      showNotification('Unauthorized Access: You do not have permissions to modify this system account.', 'warning');
      throw new Error('Unauthorized Access: You do not have permissions to modify this system account.');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, data })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to update user details.'));

      setState(s => ({
        ...s,
        users: s.users.map(u => u.id === id ? { ...u, ...data } : u),
        currentUser: s.currentUser?.id === id ? { ...s.currentUser, ...data, ...(data.password ? {mustChangePassword:false} : {}) } : s.currentUser
      }));
    } catch (e: any) {
      console.error("Error updating user/member details:", e);
      showNotification(e.message || "Failed to save user updates.", "error");
      throw e;
    }
  };

  const deleteUser = async (id: string) => {
    const role = state.currentUser?.role;
    if (!can('action:staff_manage')) {
      showNotification('Unauthorized Access: Only administrators can delete system accounts.', 'warning');
      throw new Error('Unauthorized Access: Only administrators can delete system accounts.');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to delete user account.'));

      setState(s => ({
        ...s,
        users: s.users.filter(u => u.id !== id),
        classSessions: s.classSessions.map(c => ({
          ...c,
          coachId: c.coachId === id ? undefined : c.coachId,
        })),
        currentUser: s.currentUser?.id === id ? null : s.currentUser
      }));
      showNotification("User account deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteUser error:", e);
      showNotification(e.message || "Failed to delete user account.", 'error');
      throw e;
    }
  };

  const fetchStaffDanHistory = async (userId: string): Promise<StaffDanRecord[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/staff-dan?userId=${encodeURIComponent(userId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to fetch staff Dan history.'));
      return (json.data || []).map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        danLevel: d.dan_level,
        issueDate: d.issue_date,
        certificateNo: d.certificate_no || undefined,
        certificateUrl: d.certificate_url || undefined,
        examinerName: d.examiner_name || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    } catch (err: any) {
      console.error("[Store] fetchStaffDanHistory error:", err);
      return state.staffDanRecords.filter(r => r.userId === userId);
    }
  };

  const addStaffDanRecord = async (record: Omit<StaffDanRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data?: StaffDanRecord; error?: string }> => {
    const revision = sessionRevision.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/staff-dan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(record)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to add Dan record.'));

      if (revision !== sessionRevision.current) throw new Error('Your session changed. Reload to verify the saved record.');
      const d = json.data;
      const newRec: StaffDanRecord = {
        id: d.id,
        userId: d.user_id,
        danLevel: d.dan_level,
        issueDate: d.issue_date,
        certificateNo: d.certificate_no || undefined,
        certificateUrl: d.certificate_url || undefined,
        examinerName: d.examiner_name || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      };

      setState(s => ({ ...s, staffDanRecords: [...s.staffDanRecords.filter(x => x.id !== newRec.id), newRec] }));
      await refreshData().catch(() => showNotification('Dan record saved. Reload to refresh the staff profile.', 'info'));

      showNotification(`Added ${newRec.danLevel} Dan promotion record!`, 'success');
      return { success: true, data: newRec };
    } catch (err: any) {
      console.error("[Store] addStaffDanRecord error:", err);
      showNotification(err.message || 'Failed to record Dan promotion.', 'error');
      return { success: false, error: err.message };
    }
  };

  const updateStaffDanRecord = async (id: string, updates: Partial<StaffDanRecord>): Promise<{ success: boolean; error?: string }> => {
    const revision = sessionRevision.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/staff-dan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, ...updates })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to update Dan record.'));

      if (revision !== sessionRevision.current) throw new Error('Your session changed. Reload to verify the saved record.');
      const d = json.data;
      if (!d?.id) throw new Error('The saved Dan record could not be confirmed. Reload before retrying.');
      setState(s => ({ ...s, staffDanRecords: s.staffDanRecords.map(r => r.id === id ? {
        ...r, danLevel: d.dan_level, issueDate: d.issue_date, certificateNo: d.certificate_no || undefined,
        certificateUrl: d.certificate_url || undefined, examinerName: d.examiner_name || undefined,
        location: d.location || undefined, notes: d.notes || undefined, updatedAt: d.updated_at
      } : r) }));
      await refreshData().catch(() => showNotification('Dan record saved. Reload to refresh the staff profile.', 'info'));

      showNotification('Dan record updated successfully.', 'success');
      return { success: true };
    } catch (err: any) {
      console.error("[Store] updateStaffDanRecord error:", err);
      showNotification(err.message || 'Failed to update Dan record.', 'error');
      return { success: false, error: err.message };
    }
  };

  const deleteStaffDanRecord = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const revision = sessionRevision.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/admin/staff-dan?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to delete Dan record.'));

      if (revision !== sessionRevision.current) throw new Error('Your session changed. Reload to verify the removed record.');
      setState(s => ({ ...s, staffDanRecords: s.staffDanRecords.filter(r => r.id !== id) }));
      await refreshData().catch(() => showNotification('Dan record removed. Reload to refresh the staff profile.', 'info'));

      showNotification('Dan record removed.', 'info');
      return { success: true };
    } catch (err: any) {
      console.error("[Store] deleteStaffDanRecord error:", err);
      showNotification(err.message || 'Failed to delete Dan record.', 'error');
      return { success: false, error: err.message };
    }
  };

  const createPartner = async (partnerData: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data?: Partner; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(partnerData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to create partner.'));

      const d = json.data;
      const newPartner: Partner = {
        id: d.id,
        name: d.name,
        brandName: d.brand_name || undefined,
        logoUrl: d.logo_url || undefined,
        partnerType: d.partner_type || 'MOU',
        status: d.status || 'Active',
        description: d.description || undefined,
        collaborationScope: d.collaboration_scope || undefined,
        benefitsSummary: d.benefits_summary || undefined,
        founderName: d.founder_name || undefined,
        founderContact: d.founder_contact || undefined,
        contactName: d.contact_name || d.contact_person || undefined,
        contactRole: d.contact_role || undefined,
        email: d.email || undefined,
        phone: d.phone || undefined,
        telegramUsername: d.telegram_username || undefined,
        telegramLink: d.telegram_link || d.telegram_url || undefined,
        secondaryContactName: d.secondary_contact_name || d.secondary_contacts?.[0]?.name || undefined,
        secondaryContactPhone: d.secondary_contact_phone || d.secondary_contacts?.[0]?.phone || undefined,
        secondaryContactTelegram: d.secondary_contact_telegram || d.secondary_contacts?.[0]?.telegram || undefined,
        websiteUrl: d.website_url || d.website || undefined,
        address: d.address || d.city || undefined,
        country: d.country || 'Cambodia',
        mouSignedDate: d.mou_signed_date || undefined,
        mouExpiryDate: d.mou_expiry_date || undefined,
        contractDocumentUrl: d.contract_document_url || d.document_url || undefined,
        notes: d.notes || d.internal_notes || undefined,
        tags: d.tags || [],
        createdAt: d.created_at,
        updatedAt: d.updated_at
      };

      setState(s => ({
        ...s,
        partners: [newPartner, ...s.partners.filter(p => p.id !== newPartner.id)]
      }));
      showNotification(`Partner "${newPartner.name}" added successfully.`, 'success');
      return { success: true, data: newPartner };
    } catch (err: any) {
      const normalized = reportError(err, 'Failed to Create Partner');
      return { success: false, error: normalized.message };
    }
  };

  const updatePartner = async (id: string, updates: Partial<Partner>): Promise<{ success: boolean; error?: string }> => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (!isUuid) throw new Error('This partner has no valid database ID. Reload the partner list before editing.');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/partners', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, ...updates })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to update partner.'));

      setState(s => ({
        ...s,
        partners: s.partners.map(p => p.id === id ? mapPartnerRow(json.data) : p)
      }));
      showNotification("Partner details updated.", 'success');
      return { success: true };
    } catch (err: any) {
      const normalized = reportError(err, 'Failed to Update Partner');
      return { success: false, error: normalized.message };
    }
  };

  const deletePartner = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!isUuid) throw new Error('This partner has no valid database ID. Reload the partner list before deleting.');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/admin/partners?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(json, 'Failed to delete partner.'));

      setState(s => ({
        ...s,
        partners: s.partners.filter(p => p.id !== id)
      }));
      showNotification("Partner record removed.", 'info');
      return { success: true };
    } catch (err: any) {
      const normalized = reportError(err, 'Failed to Delete Partner');
      return { success: false, error: normalized.message };
    }
  };

  const fetchPartners = useCallback(async (): Promise<Partner[]> => {
    const revision = sessionRevision.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const res = await fetch('/api/admin/partners', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(unwrapApiError(json, 'Partners could not be loaded. Please retry.'));
      if (json?.success !== true || !Array.isArray(json.data)) throw new Error('The partner directory returned an invalid response. Please retry.');
      if (revision !== sessionRevision.current) throw new Error('Your session changed. Please reopen the partner directory.');
      const mapped = json.data.map(mapPartnerRow);
      setState(s => ({ ...s, partners: mapped,
        dataLoadErrors: s.dataLoadErrors?.filter(dataset => dataset !== 'partners'),
        dataLoadIssues: s.dataLoadIssues?.filter(issue => issue.dataset !== 'partners'),
      }));
      return mapped;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') throw new Error('Loading partners timed out. Please retry.');
      throw err instanceof Error ? err : new Error('Partners could not be loaded. Please retry.');
    }
  }, []);

  const upsertPhysicalEvaluation = async (studentId: string, skillName: string, beltLevel: string, grade: string) => {
    if (!can('action:evaluations_grade')) throw new Error('Permission denied.');
    try {
      const { data, error } = await supabase
        .from('student_physical_evaluations')
        .upsert({
          student_id: studentId,
          skill_name: skillName,
          belt_level: beltLevel,
          grade,
          evaluated_by: state.currentUser?.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id,skill_name'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const mapped = {
          id: data.id,
          studentId: data.student_id,
          skillName: data.skill_name,
          beltLevel: data.belt_level,
          grade: data.grade,
          evaluatedBy: data.evaluated_by,
          updatedAt: data.updated_at
        };
        setState(s => {
          const evals = s.physicalEvaluations.filter(x => x.id !== mapped.id && !(x.studentId === mapped.studentId && x.skillName === mapped.skillName));
          return { ...s, physicalEvaluations: [...evals, mapped] };
        });
        showNotification("Physical skill grade saved successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] Physical grade upsert failed:", e);
      showNotification("Failed to save physical evaluation: " + e.message, 'error');
      throw e;
    }
  };

  const addBodyComposition = async (composition: any) => {
    const role = state.currentUser?.role;
    if (!can('action:student_edit')) {
      showNotification('Unauthorized Access: You do not have permissions to record biometrics.', 'warning');
      throw new Error('You do not have permission to record biometrics.');
    }
    try {
      const measure = (value:any) => {
        if(value===undefined || value===null || String(value).trim()==='')return null;
        const number=Number(value);
        if(!Number.isFinite(number))throw new Error('Measurements must be valid numbers.');
        return number;
      };
      const payload = {
        student_id: composition.studentId,
        recorded_date: composition.recordedDate || academyDate(),
        height_cm: measure(composition.heightCm),weight_kg: measure(composition.weightKg),
        body_fat_percentage: measure(composition.bodyFatPercentage),skeletal_muscle_mass_kg: measure(composition.skeletalMuscleMassKg),
        neck_cm: measure(composition.neckCm),shoulder_width_cm: measure(composition.shoulderWidthCm),chest_cm: measure(composition.chestCm),
        waist_cm: measure(composition.waistCm),hips_cm: measure(composition.hipsCm),left_arm_cm: measure(composition.leftArmCm),right_arm_cm: measure(composition.rightArmCm),
        left_thigh_cm: measure(composition.leftThighCm),right_thigh_cm: measure(composition.rightThighCm),left_calf_cm: measure(composition.leftCalfCm),right_calf_cm: measure(composition.rightCalfCm)
      };
      const {data:{session}} = await supabase.auth.getSession();
      if(!session)throw new Error('Please sign in again.');
      const signature=JSON.stringify([session.user.id,payload]);
      const requestKey=pendingMeasurementKeys.current.get(signature)||crypto.randomUUID();
      pendingMeasurementKeys.current.set(signature,requestKey);
      const response=await fetch('/api/admin/body-compositions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({measurement:payload,requestKey})});
      const result=await response.json();
      if(!response.ok)throw new Error(unwrapApiError(result,'Measurement was not recorded.'));
      const data=result.data?.measurement;const latest=result.data?.latest;
      if(!data||!latest)throw new Error('Measurement save was not confirmed.');
      pendingMeasurementKeys.current.delete(signature);

      if (data) {
        const mapped = {
          id: data.id,
          studentId: data.student_id,
          recordedDate: data.recorded_date,
          heightCm: data.height_cm,
          weightKg: data.weight_kg,
          bodyFatPercentage: data.body_fat_percentage,
          skeletalMuscleMassKg: data.skeletal_muscle_mass_kg,
          neckCm: data.neck_cm,
          shoulderWidthCm: data.shoulder_width_cm,
          chestCm: data.chest_cm,
          waistCm: data.waist_cm,
          hipsCm: data.hips_cm,
          leftArmCm: data.left_arm_cm,
          rightArmCm: data.right_arm_cm,
          leftThighCm: data.left_thigh_cm,
          rightThighCm: data.right_thigh_cm,
          leftCalfCm: data.left_calf_cm,
          rightCalfCm: data.right_calf_cm,
          recordedBy: data.recorded_by,
          createdAt: data.created_at
        };

        setState(s => {
          const comps = [...s.bodyCompositions.filter(x => x.id !== mapped.id), mapped];
          const students = s.students.map(st => st.id === mapped.studentId ? {
            ...st,
            heightCm: latest.height_cm ?? st.heightCm,
            weightKg: latest.weight_kg ?? st.weightKg
          } : st);
          return { ...s, bodyCompositions: comps, students };
        });

        showNotification("Biometrics recorded successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addBodyComposition error:", e);
      showNotification("Failed to record biometrics: " + e.message, 'error');
      throw e;
    }
  };

  const addBeltTechnique = async (beltLevel: string, techniqueName: string, category: string) => {
    try {
      const { data, error } = await supabase
        .from('belt_techniques')
        .insert({
          belt_level: beltLevel,
          technique_name: techniqueName,
          category,
          created_by: state.currentUser?.id
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const mapped = {
          id: data.id,
          beltLevel: data.belt_level,
          techniqueName: data.technique_name,
          category: data.category || 'Kicks (Chagi)',
          createdAt: data.created_at,
          createdBy: data.created_by
        };
        setState(s => ({
          ...s,
          beltTechniques: [...s.beltTechniques.filter(x => x.id !== mapped.id), mapped]
        }));
        showNotification("Technique syllabus added successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] Add belt technique failed:", e);
      showNotification("Failed to add technique syllabus: " + e.message, 'error');
      throw e;
    }
  };

  const deleteBeltTechnique = async (id: string) => {
    try {
      if (!can('action:curriculum_edit')) throw new Error('Permission denied.');
      const { data, error } = await supabase.from('belt_techniques').delete().eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Technique removal was not confirmed.');
      setState(s => ({
        ...s,
        beltTechniques: s.beltTechniques.filter(x => x.id !== id)
      }));
      showNotification("Technique syllabus deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] Delete belt technique failed:", e);
      showNotification("Failed to delete technique syllabus: " + e.message, 'error');
      throw e;
    }
  };

  const updateAcademyProfile = async (updates: Partial<AcademyProfile>, expectedUpdatedAt?: string): Promise<{ success: boolean; error?: string; profile?: AcademyProfile }> => {
    const role = state.currentUser?.role;
    if (!can('action:staff_manage')) {
      showNotification('Unauthorized: Only administrators can update the academy profile.', 'error');
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if(!token)throw new Error('Please sign in again.');
      const payload={...academyProfileChanges(updates), ...(expectedUpdatedAt ? { expectedUpdatedAt } : {})};
      const res=await fetch('/api/admin/update-academy-profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload)});
      const result=await res.json();
      if (res.status === 409) {
        // Refresh the baseline so the form can identify conflicting local edits.
        const { data: latest, error } = await supabase.from('academy_profile').select('*').eq('id', 'default').maybeSingle();
        if (!error && latest) setState(s => ({ ...s, academyProfile: mapDbRowToAcademyProfile(latest) }));
      }
      if(!res.ok || !result.success || !result.data)throw new Error(unwrapApiError(result,'Academy settings were not saved.'));

      const profile = mapDbRowToAcademyProfile(result.data);
      setState(s => ({ ...s, academyProfile: profile }));
      return { success: true, profile };
    } catch (e: any) {
      console.error('[Store] updateAcademyProfile error:', e);
      return { success: false, error: e.message || 'Failed to update academy profile' };
    }
  };

  const can = useCallback((permissionKey: string, targetUserId?: string): boolean => {
    if (!state.currentUser) return false;
    if (state.currentUser.role !== 'Root' && state.currentUser.role !== 'Super Root' && !state.permissionsReady) return false;
    const userIdToCheck = targetUserId || state.currentUser.id;
    return hasPermission(
      state.currentUser.role,
      permissionKey,
      state.rolePermissions,
      userIdToCheck,
      state.userPermissions
    );
  }, [state.currentUser, state.rolePermissions, state.userPermissions, state.permissionsReady]);

  const canWrite = useCallback((module: SecurityModule, specificAction?: string, targetUserId?: string): boolean => {
    if (!state.currentUser) return false;
    if (state.currentUser.role === 'Root' || state.currentUser.role === 'Super Root') return true;
    if (specificAction) {
      return can(specificAction, targetUserId);
    }
    const def = MODULE_DEFINITIONS.find(m => m.module === module);
    if (!def) return false;
    return def.writeKeys.some(k => can(k, targetUserId));
  }, [state.currentUser, can]);

  const getAccessLevel = useCallback((module: SecurityModule, targetUserId?: string): AccessLevel => {
    if (!state.currentUser) return 'none';
    if (state.currentUser.role === 'Root' || state.currentUser.role === 'Super Root') return 'write';
    return getModuleAccessLevel(module, (key) => can(key, targetUserId));
  }, [state.currentUser, can]);

  const updateRolePermissionsBatch = async (
    updates: { role: Role; permissionKey: string; isGranted: boolean }[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: updates })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error?.message || 'Failed to update permissions.');
      }

      setState(s => {
        const next = { ...s.rolePermissions };
        updates.forEach(u => {
          next[`${u.role}:${u.permissionKey}`] = u.isGranted;
        });
        return { ...s, rolePermissions: next };
      });

      showNotification('Role permissions matrix saved successfully.', 'success');
      return { success: true };
    } catch (err: any) {
      showNotification(err.message || 'Error updating permissions.', 'error');
      return { success: false, error: err.message };
    }
  };

  const updateUserPermissionsBatch = async (
    userId: string,
    updates: { permissionKey: string; isGranted: boolean | null }[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const res = await fetch('/api/admin/user-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, updates })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error?.message || 'Failed to update user permissions.');
      }

      setState(s => {
        const next = { ...s.userPermissions };
        updates.forEach(u => {
          const key = `${userId}:${u.permissionKey}`;
          if (u.isGranted === null) {
            delete next[key];
          } else {
            next[key] = u.isGranted;
          }
        });
        return { ...s, userPermissions: next };
      });

      showNotification('Account custom permissions saved successfully.', 'success');
      return { success: true };
    } catch (err: any) {
      showNotification(err.message || 'Error updating account permissions.', 'error');
      return { success: false, error: err.message };
    }
  };

  return (
    <AppContext.Provider
      value={{
        state,
        login,
        logout,
        can,
        canWrite,
        getAccessLevel,
        updateRolePermissionsBatch,
        updateUserPermissionsBatch,
        fetchStaffDanHistory,
        addStaffDanRecord,
        updateStaffDanRecord,
        deleteStaffDanRecord,
        createPartner,
        updatePartner,
        deletePartner,
        fetchPartners,
        setTheme: (theme) => {
          setState((s) => ({ ...s, theme }));
          if (typeof window !== 'undefined') {
            localStorage.setItem('infinity_theme', theme);
          }
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },
        setLanguage: (language) => {
          setState((s) => ({ ...s, language }));
          if (typeof window !== 'undefined') {
            localStorage.setItem('infinity_lang', language);
          }
        },
        markAttendance,
        payInvoice,
        prepayInvoiceBulk,
        addStudent,
        updateStudent,
        deleteStudent,
        addBeltHistory,
        updateBeltHistory,
        deleteBeltHistory,
        addAchievement,
        saveAchievements,
        updateAchievement,
        deleteAchievement,
        addBranch,
        addClassSession,
        updateClassSession,
        deleteClassSession,
        enrollStudent,
        unenrollStudent,
        batchEnrollStudents,
        addCurriculumVideo,
        updateCurriculumVideo,
        deleteCurriculumVideo,
        markVideoWatched,
        toggleVideoProgress,
        addUser,
        updateUser,
        deleteUser,
        commitRoster,
        deleteAttendanceRecords,
        addWorkoutTemplate,
        updateWorkoutTemplate,
        deleteWorkoutTemplate,
        upsertPhysicalEvaluation,
        addBodyComposition,
        addBeltTechnique,
        deleteBeltTechnique,
        reconcileAllStudentBelts,
        showNotification,
        reportError,
        hideNotification,
        showConfirm,
        refreshData,
        hideConfirm,
        updateAcademyProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}

export interface MembershipBillingStatus {
  status: 'Current' | 'Due Soon' | 'Overdue';
  nextRenewalDate: string;
  daysRemaining: number;
  amountOwed: number;
}

export function getMembershipBillingStatus(student:Student,payments:Payment[],scholarships:Scholarship[],classEnrollments:ClassEnrollment[],config:AcademyProfile=DEFAULT_ACADEMY_PROFILE):MembershipBillingStatus {
  return membershipBilling(student,payments,scholarships,classEnrollments,config);
}
