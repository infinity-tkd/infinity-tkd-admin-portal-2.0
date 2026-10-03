'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { supabase, createSecondaryClient } from './supabase';
import { sanitizeStringInput, mapCategoryToDbEnum, normalizeCategory } from './utils';
import { normalizeError, NormalizedError } from './error-handler';
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
  id: number;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Late';
}

export interface Payment {
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
    legalName: row.legal_name || DEFAULT_ACADEMY_PROFILE.legalName,
    tagline: row.tagline || DEFAULT_ACADEMY_PROFILE.tagline,
    logoUrl: row.logo_url || DEFAULT_ACADEMY_PROFILE.logoUrl,
    websiteUrl: row.website_url || DEFAULT_ACADEMY_PROFILE.websiteUrl,
    portalUrl: row.portal_url || DEFAULT_ACADEMY_PROFILE.portalUrl,
    taxId: row.tax_id || '',
    contactPhone: row.contact_phone || DEFAULT_ACADEMY_PROFILE.contactPhone,
    supportEmail: row.support_email || DEFAULT_ACADEMY_PROFILE.supportEmail,
    primaryAddress: row.primary_address || DEFAULT_ACADEMY_PROFILE.primaryAddress,
    defaultBranchId: row.default_branch_id ?? 'all',
    currency: (row.currency as 'USD' | 'KHR') || 'USD',
    currencySymbol: row.currency_symbol || '$',
    tuitionGracePeriodDays: row.tuition_grace_period_days ?? 5,
    taxRatePercentage: Number(row.tax_rate_percentage) || 0,
    dateFormat: (row.date_format as any) || 'YYYY-MM-DD',
    defaultClassDurationMins: row.default_class_duration_mins ?? 60,
    examPassingScore: row.exam_passing_score ?? 70,
    minAttendanceExamPct: row.min_attendance_exam_pct ?? 80,
    allowStudentPortalLogin: row.allow_student_portal_login ?? true,
    enableAudioChimes: row.enable_audio_chimes ?? true,
    facebookUrl: row.facebook_url || DEFAULT_ACADEMY_PROFILE.facebookUrl,
    telegramChannel: row.telegram_channel || DEFAULT_ACADEMY_PROFILE.telegramChannel,
    instagramUrl: row.instagram_url || DEFAULT_ACADEMY_PROFILE.instagramUrl,
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
  markAttendance: (studentId: string, date: string, status: 'Present' | 'Absent' | 'Late') => Promise<void>;
  deleteAttendanceRecords: (date: string, studentIds: string[]) => Promise<void>;
  payInvoice: (studentId: string, year: number, month: string, amount: number) => Promise<void>;
  prepayInvoiceBulk: (studentId: string, prepayments: { year: number; month: string; amount: number }[]) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'registrationDate'>) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addBeltHistory: (history: Omit<BeltHistory, 'id'>) => Promise<void>;
  updateBeltHistory: (id: number, data: Partial<BeltHistory>) => Promise<void>;
  deleteBeltHistory: (id: number, studentId: string) => Promise<void>;
  addAchievement: (achievement: Omit<Achievement, 'id'>) => Promise<void>;
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
  addUser: (user: Omit<User, 'id'> & { password?: string; studentId?: string }) => Promise<{ success: boolean; error?: string }>;
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
  hideConfirm: () => void;
  updateAcademyProfile: (updates: Partial<AcademyProfile>) => Promise<{ success: boolean; error?: string }>;
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
  contactName: p.contactName || p.contact_name || p.contact_person || undefined,
  contactRole: p.contactRole || p.contact_role || undefined,
  email: p.email || undefined,
  phone: p.phone || undefined,
  telegramUsername: p.telegramUsername || p.telegram_username || undefined,
  telegramLink: p.telegramLink || p.telegram_link || p.telegram_url || undefined,
  secondaryContactName: p.secondaryContactName || p.secondary_contact_name || p.secondary_contacts?.[0]?.name || undefined,
  secondaryContactPhone: p.secondaryContactPhone || p.secondary_contact_phone || p.secondary_contacts?.[0]?.phone || undefined,
  secondaryContactTelegram: p.secondaryContactTelegram || p.secondary_contact_telegram || p.secondary_contacts?.[0]?.telegram || undefined,
  websiteUrl: p.websiteUrl || p.website_url || p.website || undefined,
  address: p.address || p.city || undefined,
  country: p.country || 'Cambodia',
  mouSignedDate: p.mouSignedDate || p.mou_signed_date || undefined,
  mouExpiryDate: p.mouExpiryDate || p.mou_expiry_date || undefined,
  contractDocumentUrl: p.contractDocumentUrl || p.contract_document_url || p.document_url || undefined,
  notes: p.notes || p.internal_notes || undefined,
  tags: Array.isArray(p.tags) ? p.tags : [],
  createdAt: p.createdAt || p.created_at,
  updatedAt: p.updatedAt || p.updated_at
});

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
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
    userPermissions: {},
    staffDanRecords: [],
    partners: [],
    systemNotification: null,
    systemConfirm: null
  });

  const fetchInitialData = async (userId: string) => {
    // Stale-While-Revalidate: Only block if we do not already have a cached session loaded in memory.
    setState(s => ({ ...s, isLoading: s.currentUser ? false : true }));

    // Safety Timeout Guard: prevent permanent loading hang
    const timeoutId = setTimeout(() => {
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
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('members').select('*').eq('id', userId).maybeSingle() as any
      ]);

      const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
      const memberProfile = memberResult.status === 'fulfilled' ? memberResult.value.data : null;

      if (memberResult.status === 'rejected' || (memberResult.status === 'fulfilled' && memberResult.value.error)) {
        console.warn('[Store] Members fetch error (non-blocking):', 
          memberResult.status === 'rejected' ? memberResult.reason : memberResult.value.error?.message);
      }

      // Explicit suspension check: only reject if profile explicitly exists AND is_active is false
      if (profile && profile.is_active === false) {
        clearTimeout(timeoutId);
        await supabase.auth.signOut({ scope: 'global' });
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('infinity_cached_user');
          sessionStorage.removeItem('infinity_cached_students');
          sessionStorage.removeItem('infinity_cached_branches');
          sessionStorage.removeItem('infinity_cached_videos');
          sessionStorage.removeItem('infinity_cached_techniques');
          sessionStorage.removeItem('infinity_cached_muscles');
          sessionStorage.removeItem('infinity_cached_asset_muscle_relations');
          sessionStorage.removeItem('infinity_cached_body_compositions');

          localStorage.removeItem('infinity_cached_user');
          localStorage.removeItem('infinity_cached_students');
          localStorage.removeItem('infinity_cached_branches');
          localStorage.removeItem('infinity_cached_videos');
          localStorage.removeItem('infinity_cached_techniques');
          localStorage.removeItem('infinity_cached_muscles');
          localStorage.removeItem('infinity_cached_asset_muscle_relations');
          localStorage.removeItem('infinity_cached_body_compositions');
        }
        setState(s => ({ ...s, currentUser: null, isLoading: false }));
        return;
      }

      // Fetch fallback auth user info if profile query returned null/error
      const { data: authUserData } = await supabase.auth.getUser();
      const authUser = authUserData?.user;

      // Strict portal isolation: Student accounts are restricted to the Student Portal
      if (profile?.role === 'Student' || authUser?.user_metadata?.role === 'Student') {
        clearTimeout(timeoutId);
        await supabase.auth.signOut({ scope: 'global' });
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
          localStorage.removeItem('infinity_cached_user');
        }
        setState(s => ({ ...s, currentUser: null, isLoading: false }));
        alert('Access Denied: Student accounts cannot log into the Admin Portal. Please use the Infinity TKD Student Portal.');
        return;
      }

      const mSelf = (memberProfile || {}) as any;
      const currentUser: User = {
        id: profile?.id || userId,
        username: profile?.username || authUser?.email?.split('@')[0] || 'User',
        email: profile?.email || authUser?.email || '',
        displayName: profile?.display_name || authUser?.user_metadata?.display_name || profile?.username || authUser?.email?.split('@')[0] || 'User',
        role: (profile?.role || authUser?.user_metadata?.role || 'Admin') as Role,
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

      // 2. Fetch Global Data concurrently using Promise.allSettled for resilient login
      const globalResults = await Promise.allSettled([
        supabase.from('profiles').select('*'),
        supabase.from('members').select('*, member_addresses(*)'),
        supabase.from('students').select('*, student_addresses(*)'),
        supabase.from('branches').select('*'),
        supabase.from('class_sessions').select('*'),
        supabase.from('class_enrollments').select('*'),
        supabase.from('scholarships').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('belt_histories').select('*'),
        supabase.from('achievements').select('*'),
        supabase.from('library_assets').select('*'),
        supabase.from('lms_progress').select('*'),
        supabase.from('workout_templates').select('*'),
        supabase.from('student_physical_evaluations').select('*'),
        supabase.from('belt_techniques').select('*'),
        supabase.from('muscles').select('*'),
        supabase.from('library_asset_muscles').select('*'),
        supabase.from('student_body_compositions').select('*'),
        supabase.from('academy_profile').select('*').maybeSingle(),
        supabase.from('role_permissions').select('*'),
        supabase.from('user_permissions').select('*'),
        supabase.from('staff_dan_history').select('*').order('dan_level', { ascending: true }),
        supabase.from('partners').select('*').order('created_at', { ascending: false })
      ]);

      const getVal = (res: PromiseSettledResult<any>, tableName?: string) => {
        if (res.status === 'fulfilled') {
          if (res.value.error) {
            const msg = res.value.error.message || '';
            const code = res.value.error.code || '';
            if (code === 'PGRST205' || msg.includes('schema cache') || msg.includes('Could not find the table')) {
              console.warn(`[Supabase Optional Table] ${tableName || 'table'}:`, msg);
              return null;
            }
            console.error(`[Supabase Query Error] ${tableName || 'table'}:`, res.value.error.message, res.value.error);
            return null;
          }
          return res.value.data;
        }
        console.error(`[Supabase Query Rejected] ${tableName || 'table'}:`, res.reason);
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
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (apiRes.ok) {
              const apiJson = await apiRes.json();
              if (Array.isArray(apiJson.data) && apiJson.data.length > 0) {
                finalPartners = apiJson.data.map(mapPartnerRow);
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
      } else if (membersData && (membersData as any[]).length > 0) {
        // Fallback: if profiles table fails (e.g. RLS infinite recursion), map directly from members table
        mappedUsers = (membersData as any[]).map((m: any) => {
          const ma = Array.isArray(m.member_addresses) ? m.member_addresses.find((a: any) => a.is_primary) || m.member_addresses[0] : null;
          const addressObj = ma ? { id: ma.address_id, line1: ma.address_line1, line2: ma.address_line2, city: ma.district_commune, stateProvince: ma.state_province_city, postalCode: ma.postal_code, country: ma.country } : undefined;
          return {
            id: m.id,
            username: m.username || m.english_name?.toLowerCase().replace(/\s+/g, '_') || 'user',
            email: m.email || '',
            displayName: m.english_name || m.khmer_name || 'Staff Member',
            role: (m.role || 'Coach') as Role,
            isActive: m.is_active ?? true,
            studentId: undefined,
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
            kukkiwonId: m.kukkiwon_id || undefined,
            currentDan: m.current_dan != null ? Number(m.current_dan) : undefined,
            danIssueDate: m.dan_issue_date || undefined,
            danCertificateUrl: m.dan_certificate_url || undefined
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

      // State updates will automatically trigger the encrypted reactive cache effect

      clearTimeout(timeoutId);
      setState(s => ({
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
        attendanceRecords: (attendanceData || []).map((a: any) => ({ id: a.id, studentId: a.student_id, date: a.date, status: a.status })),
        payments: (paymentsData || []).map((p: any) => ({ id: p.id, studentId: p.student_id, year: p.year, month: p.for_month, status: p.status, amountUsd: p.amount_usd })),
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
        userPermissions: mappedUserPermissions,
        staffDanRecords: mappedStaffDanRecords,
        partners: finalPartners,
        isLoading: false
      }));

      if (academyProfileData && typeof window !== 'undefined') {
        localStorage.setItem('infinity_academy_profile', JSON.stringify(mapDbRowToAcademyProfile(academyProfileData)));
      }

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error fetching initial data:", error);
      setState(s => ({ ...s, isLoading: false }));
    }
  };

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

        const cachedUser = decryptCache(sessionStorage.getItem('infinity_cached_user'));
        const cachedTheme = (localStorage.getItem('infinity_theme') as 'light' | 'dark') || 'light';
        const cachedLang = (localStorage.getItem('infinity_lang') as 'en' | 'kh' | 'zh') || 'en';
        const cachedProfileStr = localStorage.getItem('infinity_academy_profile');
        let cachedAcademyProfile = DEFAULT_ACADEMY_PROFILE;
        if (cachedProfileStr) {
          try {
            cachedAcademyProfile = { ...DEFAULT_ACADEMY_PROFILE, ...JSON.parse(cachedProfileStr) };
          } catch {}
        }

        if (cachedUser) {
          const cachedStudents = decryptCache(sessionStorage.getItem('infinity_cached_students'));
          const cachedBranches = decryptCache(sessionStorage.getItem('infinity_cached_branches'));
          const cachedVideos = decryptCache(sessionStorage.getItem('infinity_cached_videos'));
          const cachedTechniques = decryptCache(sessionStorage.getItem('infinity_cached_techniques'));
          const cachedMuscles = decryptCache(sessionStorage.getItem('infinity_cached_muscles'));
          const cachedAssetMuscleRelations = decryptCache(
            sessionStorage.getItem('infinity_cached_asset_muscle_relations')
          );

          setState((s) => ({
            ...s,
            currentUser: cachedUser,
            theme: cachedTheme,
            language: cachedLang,
            students: cachedStudents || [],
            branches: cachedBranches || [],
            curriculumVideos: cachedVideos || [],
            beltTechniques: cachedTechniques || [],
            muscles: cachedMuscles || [],
            assetMuscleRelations: cachedAssetMuscleRelations || [],
            bodyCompositions: decryptCache(sessionStorage.getItem('infinity_cached_body_compositions')) || [],
            academyProfile: cachedAcademyProfile,
            isLoading: false,
          }));
        } else {
          const hasToken =
            typeof window !== 'undefined' &&
            Object.keys(localStorage).some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
          setState((s) => ({
            ...s,
            theme: cachedTheme,
            language: cachedLang,
            academyProfile: cachedAcademyProfile,
            isLoading: hasToken,
          }));
        }
      } catch (e) {
        console.warn('Storage parse failed:', e);
      }
    }

    // 2. Authoritative cryptographic user verification via getUser()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (user && !error) {
        fetchInitialData(user.id);
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('infinity_cached_user');
          sessionStorage.removeItem('infinity_cached_students');
          sessionStorage.removeItem('infinity_cached_branches');
          sessionStorage.removeItem('infinity_cached_videos');
          sessionStorage.removeItem('infinity_cached_techniques');
          sessionStorage.removeItem('infinity_cached_muscles');
          sessionStorage.removeItem('infinity_cached_asset_muscle_relations');
          sessionStorage.removeItem('infinity_cached_body_compositions');
        }
        setState((s) => ({ ...s, currentUser: null, isLoading: false }));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchInitialData(session.user.id);
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('infinity_cached_user');
          sessionStorage.removeItem('infinity_cached_students');
          sessionStorage.removeItem('infinity_cached_branches');
          sessionStorage.removeItem('infinity_cached_videos');
          sessionStorage.removeItem('infinity_cached_techniques');
          sessionStorage.removeItem('infinity_cached_muscles');
          sessionStorage.removeItem('infinity_cached_asset_muscle_relations');
          sessionStorage.removeItem('infinity_cached_body_compositions');
        }
        setState((s) => ({ ...s, currentUser: null, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Encrypted Session Storage Caching Effect (Restricted strictly to ephemeral sessionStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (state.currentUser) {
        try {
          sessionStorage.setItem('infinity_cached_user', encryptCache(state.currentUser));
          sessionStorage.setItem('infinity_cached_students', encryptCache(state.students));
          sessionStorage.setItem('infinity_cached_branches', encryptCache(state.branches));
          sessionStorage.setItem('infinity_cached_videos', encryptCache(state.curriculumVideos));
          sessionStorage.setItem('infinity_cached_techniques', encryptCache(state.beltTechniques));
          sessionStorage.setItem('infinity_cached_muscles', encryptCache(state.muscles));
          sessionStorage.setItem('infinity_cached_asset_muscle_relations', encryptCache(state.assetMuscleRelations));
          sessionStorage.setItem('infinity_cached_body_compositions', encryptCache(state.bodyCompositions));
        } catch (e) {
          console.warn('SessionStorage auto-update failed:', e);
        }
      } else {
        sessionStorage.removeItem('infinity_cached_user');
        sessionStorage.removeItem('infinity_cached_students');
        sessionStorage.removeItem('infinity_cached_branches');
        sessionStorage.removeItem('infinity_cached_videos');
        sessionStorage.removeItem('infinity_cached_techniques');
        sessionStorage.removeItem('infinity_cached_muscles');
        sessionStorage.removeItem('infinity_cached_asset_muscle_relations');
        sessionStorage.removeItem('infinity_cached_body_compositions');
      }
    }
  }, [
    state.currentUser,
    state.students,
    state.branches,
    state.curriculumVideos,
    state.beltTechniques,
    state.muscles,
    state.assetMuscleRelations,
    state.bodyCompositions,
  ]);

  // Global Realtime Postgres Changes Subscription
  useEffect(() => {
    if (!state.currentUser) return;

    const mapStudentRow = (st: any) => ({
      id: st.id, profileId: st.profile_id || undefined, khmerName: st.khmer_name || '', englishName: st.english_name || '', gender: st.gender, dob: st.dob || '',
      registrationDate: st.registration_date, scholarshipId: st.scholarship_id, heightCm: st.height_cm, weightKg: st.weight_kg,
      homeBranchId: st.home_branch_id, currentBelt: st.current_belt || '', studentStatus: st.student_status || 'Active', 
      statusReason: st.status_reason || '', statusChangedAt: st.status_changed_at || '', pauseEndDate: st.pause_end_date || '', email: st.email,
      phone: st.phone, emergencyContactName: st.emergency_contact_name, emergencyContactPhone: st.emergency_contact_phone,
      emergencyContactRelation: st.emergency_contact_relation, medicalNotes: st.medical_notes, allergies: st.allergies,
      address: st.address, nationality: st.nationality, profilePicturePath: st.profile_picture_path || '', esignPath: st.esign_path, kukkiwonId: st.kukkiwon_id,
      notes: st.notes
    });

    const realtimeChannel = supabase.channel('infinity_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = mapStudentRow(payload.new);
          setState(s => ({ ...s, students: [...s.students.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, students: s.students.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, studentId: payload.new.student_id, date: payload.new.date, status: payload.new.status };
          setState(s => ({ 
            ...s, 
            attendanceRecords: [
              ...s.attendanceRecords.filter(x => x.id !== mapped.id && !(x.studentId === mapped.studentId && x.date === mapped.date)), 
              mapped
            ] 
          }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, attendanceRecords: s.attendanceRecords.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, studentId: payload.new.student_id, year: payload.new.year, month: payload.new.for_month, status: payload.new.status, amountUsd: payload.new.amount_usd };
          setState(s => ({ 
            ...s, 
            payments: [
              ...s.payments.filter(x => x.id !== mapped.id && !(x.studentId === mapped.studentId && x.year === mapped.year && x.month === mapped.month)), 
              mapped
            ] 
          }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, payments: s.payments.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'belt_histories' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { 
            id: payload.new.id, 
            studentId: payload.new.student_id, 
            beltLevel: payload.new.belt_level, 
            promotionDate: payload.new.promotion_date,
            testScore: payload.new.test_score,
            program: payload.new.program,
            certificateRef: payload.new.certificate_id,
            kukkiwonDanCardId: payload.new.kukkiwon_dan_card_id
          };
          setState(s => ({ ...s, beltHistories: [...s.beltHistories.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, beltHistories: s.beltHistories.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, studentId: payload.new.student_id, eventName: payload.new.event_name, date: payload.new.date, category: payload.new.category, division: payload.new.division, medalRank: payload.new.medal_rank, notes: payload.new.notes };
          setState(s => ({ ...s, achievements: [...s.achievements.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, achievements: s.achievements.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, name: payload.new.branch_name };
          setState(s => ({ ...s, branches: [...s.branches.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, branches: s.branches.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = {
            id: payload.new.id,
            branchId: payload.new.branch_id,
            name: payload.new.class_name,
            classType: (payload.new.class_type || 'General Class') as ClassCategory,
            daysOfWeek: (payload.new.days_of_week && payload.new.days_of_week.length > 0) ? payload.new.days_of_week : [payload.new.day_of_week || 'Monday'],
            dayOfWeek: payload.new.day_of_week || (payload.new.days_of_week && payload.new.days_of_week[0]) || 'Monday',
            startTime: payload.new.start_time,
            endTime: payload.new.end_time,
            capacity: payload.new.capacity,
            coachId: payload.new.coach_id || undefined,
            standardDurationMins: payload.new.standard_duration_mins || 90
          };
          setState(s => ({ ...s, classSessions: [...s.classSessions.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, classSessions: s.classSessions.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_enrollments' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, studentId: payload.new.student_id, classId: payload.new.class_id, enrollmentDate: payload.new.enrollment_date };
          setState(s => ({ ...s, classEnrollments: [...s.classEnrollments.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, classEnrollments: s.classEnrollments.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_assets' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const isFitness = payload.new.library_type === 'Fitness';
          const mapped = {
            id: payload.new.id,
            title: payload.new.title,
            description: payload.new.description || '',
            category: isFitness ? `Fitness: ${payload.new.fitness_category}` : payload.new.tkd_category,
            minBeltLevel: isFitness ? 'Fitness' : payload.new.target_level,
            videoUrl: payload.new.video_url || '',
            createdAt: payload.new.created_at || new Date().toISOString()
          };
          setState(s => ({ ...s, curriculumVideos: [...s.curriculumVideos.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, curriculumVideos: s.curriculumVideos.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_templates' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = {
            id: payload.new.id,
            title: payload.new.title,
            description: payload.new.description || '',
            difficulty: payload.new.difficulty,
            duration: payload.new.duration_mins || 15,
            creator: payload.new.creator_name || 'Coach',
            structure: payload.new.structure
          };
          setState(s => ({ ...s, workoutTemplates: [...s.workoutTemplates.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, workoutTemplates: s.workoutTemplates.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lms_progress' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = { id: payload.new.id, studentId: payload.new.student_id, videoId: payload.new.curriculum_id, status: payload.new.status, lastWatchedAt: payload.new.last_watched_at };
          setState(s => ({ ...s, videoProgress: [...s.videoProgress.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, videoProgress: s.videoProgress.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_body_compositions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = {
            id: payload.new.id,
            studentId: payload.new.student_id,
            recordedDate: payload.new.recorded_date,
            heightCm: payload.new.height_cm,
            weightKg: payload.new.weight_kg,
            bodyFatPercentage: payload.new.body_fat_percentage,
            skeletalMuscleMassKg: payload.new.skeletal_muscle_mass_kg,
            neckCm: payload.new.neck_cm,
            shoulderWidthCm: payload.new.shoulder_width_cm,
            chestCm: payload.new.chest_cm,
            waistCm: payload.new.waist_cm,
            hipsCm: payload.new.hips_cm,
            leftArmCm: payload.new.left_arm_cm,
            rightArmCm: payload.new.right_arm_cm,
            leftThighCm: payload.new.left_thigh_cm,
            rightThighCm: payload.new.right_thigh_cm,
            leftCalfCm: payload.new.left_calf_cm,
            rightCalfCm: payload.new.right_calf_cm,
            recordedBy: payload.new.recorded_by,
            createdAt: payload.new.created_at
          };
          setState(s => ({ ...s, bodyCompositions: [...s.bodyCompositions.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, bodyCompositions: s.bodyCompositions.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_physical_evaluations' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = {
            id: payload.new.id,
            studentId: payload.new.student_id,
            skillName: payload.new.skill_name,
            beltLevel: payload.new.belt_level,
            grade: payload.new.grade,
            evaluatedBy: payload.new.evaluated_by,
            updatedAt: payload.new.updated_at
          };
          setState(s => {
            const evals = s.physicalEvaluations.filter(x => x.id !== mapped.id && !(x.studentId === mapped.studentId && x.skillName === mapped.skillName));
            return { ...s, physicalEvaluations: [...evals, mapped] };
          });
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, physicalEvaluations: s.physicalEvaluations.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'belt_techniques' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = {
            id: payload.new.id,
            beltLevel: payload.new.belt_level,
            techniqueName: payload.new.technique_name,
            category: payload.new.category || 'Kicks (Chagi)',
            createdAt: payload.new.created_at,
            createdBy: payload.new.created_by
          };
          setState(s => {
            const techniques = s.beltTechniques.filter(x => x.id !== mapped.id);
            return { ...s, beltTechniques: [...techniques, mapped] };
          });
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, beltTechniques: s.beltTechniques.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          setState(s => {
            const updatedUsers = s.users.map(u => u.id === row.id ? { 
              ...u, 
              username: row.username, 
              email: row.email, 
              displayName: row.display_name, 
              role: row.role as Role, 
              isActive: row.is_active, 
              studentId: row.student_id || undefined,
              kukkiwonId: row.kukkiwon_id || undefined,
              currentDan: row.current_dan != null ? Number(row.current_dan) : undefined,
              danIssueDate: row.dan_issue_date || undefined,
              danCertificateUrl: row.dan_certificate_url || undefined
            } : u);
            const updatedCurrentUser = (s.currentUser && s.currentUser.id === row.id)
              ? { 
                  ...s.currentUser, 
                  username: row.username, 
                  email: row.email, 
                  displayName: row.display_name, 
                  role: row.role as Role, 
                  isActive: row.is_active, 
                  studentId: row.student_id || undefined,
                  kukkiwonId: row.kukkiwon_id || undefined,
                  currentDan: row.current_dan != null ? Number(row.current_dan) : undefined,
                  danIssueDate: row.dan_issue_date || undefined,
                  danCertificateUrl: row.dan_certificate_url || undefined
                }
              : s.currentUser;
            return { ...s, users: updatedUsers, currentUser: updatedCurrentUser };
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          setState(s => {
            const updatedUsers = s.users.map(u => u.id === row.id ? { ...u, khmerName: row.khmer_name || '', englishName: row.english_name || '', gender: row.gender, dob: row.dob || '', phone: row.phone || '', emergencyContactName: row.emergency_contact_name || '', emergencyContactPhone: row.emergency_contact_phone || '', emergencyContactRelation: row.emergency_contact_relation || '', medicalNotes: row.medical_notes || '', allergies: row.allergies || '', profilePicturePath: row.profile_picture_path || '' } : u);
            const updatedCurrentUser = (s.currentUser && s.currentUser.id === row.id)
              ? { ...s.currentUser, khmerName: row.khmer_name || '', englishName: row.english_name || '', gender: row.gender, dob: row.dob || '', phone: row.phone || '', emergencyContactName: row.emergency_contact_name || '', emergencyContactPhone: row.emergency_contact_phone || '', emergencyContactRelation: row.emergency_contact_relation || '', medicalNotes: row.medical_notes || '', allergies: row.allergies || '', profilePicturePath: row.profile_picture_path || '' }
              : s.currentUser;
            return { ...s, users: updatedUsers, currentUser: updatedCurrentUser };
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'muscles' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const m = payload.new;
          const mapped = {
            id: m.id,
            name: m.name,
            nameKh: m.name_kh || '',
            nameZh: m.name_zh || '',
            muscleGroup: m.muscle_group,
            targetFunction: m.target_function || '',
            diagramUrl: m.diagram_url || '',
            description: m.description || ''
          };
          setState(s => ({ ...s, muscles: [...s.muscles.filter(x => x.id !== mapped.id), mapped] }));
        } else if (payload.eventType === 'DELETE') {
          setState(s => ({ ...s, muscles: s.muscles.filter(x => x.id !== payload.old.id) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_asset_muscles' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const r = payload.new;
          const mapped = {
            assetId: r.asset_id,
            muscleId: r.muscle_id,
            role: r.role as 'Primary' | 'Secondary'
          };
          setState(s => ({ 
            ...s, 
            assetMuscleRelations: [...s.assetMuscleRelations.filter(x => !(x.assetId === mapped.assetId && x.muscleId === mapped.muscleId)), mapped] 
          }));
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old;
          setState(s => ({ 
            ...s, 
            assetMuscleRelations: s.assetMuscleRelations.filter(x => !(x.assetId === r.asset_id && x.muscleId === r.muscle_id)) 
          }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academy_profile' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mapped = mapDbRowToAcademyProfile(payload.new);
          setState(s => ({ ...s, academyProfile: mapped }));
          if (typeof window !== 'undefined') {
            localStorage.setItem('infinity_academy_profile', JSON.stringify(mapped));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const key = `${payload.new.role}:${payload.new.permission_key}`;
          setState(s => ({
            ...s,
            rolePermissions: { ...s.rolePermissions, [key]: payload.new.is_granted }
          }));
        } else if (payload.eventType === 'DELETE') {
          const key = `${payload.old.role}:${payload.old.permission_key}`;
          setState(s => {
            const next = { ...s.rolePermissions };
            delete next[key];
            return { ...s, rolePermissions: next };
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permissions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const key = `${payload.new.user_id}:${payload.new.permission_key}`;
          setState(s => ({
            ...s,
            userPermissions: { ...s.userPermissions, [key]: payload.new.is_granted }
          }));
        } else if (payload.eventType === 'DELETE') {
          const key = `${payload.old.user_id}:${payload.old.permission_key}`;
          setState(s => {
            const next = { ...s.userPermissions };
            delete next[key];
            return { ...s, userPermissions: next };
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_dan_history' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const d = payload.new as any;
          const rec: StaffDanRecord = {
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
          setState(s => ({
            ...s,
            staffDanRecords: [...s.staffDanRecords.filter(x => x.id !== rec.id), rec]
          }));
        } else if (payload.eventType === 'UPDATE') {
          const d = payload.new as any;
          setState(s => ({
            ...s,
            staffDanRecords: s.staffDanRecords.map(x => x.id === d.id ? {
              ...x,
              danLevel: d.dan_level,
              issueDate: d.issue_date,
              certificateNo: d.certificate_no || undefined,
              certificateUrl: d.certificate_url || undefined,
              examinerName: d.examiner_name || undefined,
              location: d.location || undefined,
              notes: d.notes || undefined,
              updatedAt: d.updated_at
            } : x)
          }));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as any;
          setState(s => ({
            ...s,
            staffDanRecords: s.staffDanRecords.filter(x => x.id !== old.id)
          }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const mapped = mapPartnerRow(payload.new);
          setState(s => ({
            ...s,
            partners: [mapped, ...s.partners.filter(x => x.id !== mapped.id)]
          }));
        } else if (payload.eventType === 'UPDATE') {
          const mapped = mapPartnerRow(payload.new);
          setState(s => ({
            ...s,
            partners: s.partners.map(x => x.id === mapped.id ? mapped : x)
          }));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as any;
          setState(s => ({
            ...s,
            partners: s.partners.filter(x => x.id !== old.id)
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [state.currentUser?.id]);

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

  const hideNotification = () => {
    setState(s => ({
      ...s,
      systemNotification: null
    }));
  };

  const showConfirm = (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => {
    setState(s => ({
      ...s,
      systemConfirm: { message, onConfirm, title, onCancel }
    }));
  };

  const hideConfirm = () => {
    setState(s => ({
      ...s,
      systemConfirm: null
    }));
  };

  const login = async (identifier: string, pass: string) => {
    let email = identifier.trim();

    if (!email.includes('@')) {
      let resolvedEmail = '';

      // Authoritative, rate-limited server API route to resolve username / student ID
      try {
        const res = await fetch('/api/auth/username-to-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email })
        });
        const resData = await res.json();
        if (res.ok && resData?.data?.email) {
          resolvedEmail = resData.data.email;
        } else if (!res.ok && resData?.error?.message) {
          return { success: false, error: resData.error.message };
        }
      } catch (e: any) {
        console.warn('Server username lookup error:', e);
      }

      if (resolvedEmail) {
        email = resolvedEmail;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      // Security guard: Student accounts are strictly restricted to the Student Portal
      let userRole = data.user.user_metadata?.role;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        if (prof?.role) userRole = prof.role;
      } catch (err) {
        console.warn('Role check error during login:', err);
      }

      if (userRole === 'Student') {
        await supabase.auth.signOut({ scope: 'global' });
        return {
          success: false,
          error: 'Access Denied: Student accounts are not permitted to access the Admin Portal. Please log in through the Infinity TKD Student Portal.'
        };
      }

      await fetchInitialData(data.user.id);
      return { success: true };
    }

    return { success: false, error: 'User session could not be established.' };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('infinity_cached_user');
      sessionStorage.removeItem('infinity_cached_students');
      sessionStorage.removeItem('infinity_cached_branches');
      sessionStorage.removeItem('infinity_cached_videos');
      sessionStorage.removeItem('infinity_cached_techniques');
      sessionStorage.removeItem('infinity_cached_muscles');
      sessionStorage.removeItem('infinity_cached_asset_muscle_relations');
      sessionStorage.removeItem('infinity_cached_body_compositions');

      localStorage.removeItem('infinity_cached_user');
      localStorage.removeItem('infinity_cached_students');
      localStorage.removeItem('infinity_cached_branches');
      localStorage.removeItem('infinity_cached_videos');
      localStorage.removeItem('infinity_cached_techniques');
      localStorage.removeItem('infinity_cached_muscles');
      localStorage.removeItem('infinity_cached_asset_muscle_relations');
      localStorage.removeItem('infinity_cached_body_compositions');
    }
    setState((s) => ({
      ...s,
      currentUser: null,
      students: [],
      bodyCompositions: [],
      attendanceRecords: [],
      payments: [],
    }));
  };

  const markAttendance = async (studentId: string, date: string, status: 'Present' | 'Absent' | 'Late') => {
    const role = state.currentUser?.role;
    if (role === 'Student') {
      showNotification("Permission Denied: Students cannot mark attendance.", 'error');
      return;
    }
    let rollback: Attendance[] = [];
    setState(s => {
      rollback = [...s.attendanceRecords];
      const records = [...s.attendanceRecords];
      const idx = records.findIndex(r => r.studentId === studentId && r.date === date);
      if (idx >= 0) {
        records[idx] = { ...records[idx], status };
      } else {
        records.push({ id: -Date.now(), studentId, date, status });
      }
      return { ...s, attendanceRecords: records };
    });

    try {
      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          date,
          status,
          marked_by: state.currentUser?.id
        }, {
          onConflict: 'student_id,date'
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (data) {
        setState(s => {
          const records = [...s.attendanceRecords];
          const idx = records.findIndex(r => r.studentId === studentId && r.date === date);
          if (idx >= 0) {
            records[idx] = { ...records[idx], id: data.id };
          }
          return { ...s, attendanceRecords: records };
        });
      }
    } catch (e) {
      console.error("[Store] markAttendance failed, rolling back:", e);
      setState(s => ({ ...s, attendanceRecords: rollback }));
      showNotification("Failed to sync attendance with server. Check your internet connection.", "error");
    }
  };

  const deleteAttendanceRecords = async (date: string, studentIds: string[]) => {
    const role = state.currentUser?.role;
    if (role === 'Student' || role === 'Assistant Coach') {
      showNotification("Permission Denied: Only Coaches or Admins can delete attendance records.", 'error');
      return;
    }
    let rollback: Attendance[] = [];
    setState(s => {
      rollback = [...s.attendanceRecords];
      return {
        ...s,
        attendanceRecords: s.attendanceRecords.filter(r => !(studentIds.includes(r.studentId) && r.date === date))
      };
    });

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('date', date)
        .in('student_id', studentIds);

      if (error) throw new Error(error.message);
    } catch (e) {
      console.error("[Store] deleteAttendanceRecords failed, rolling back:", e);
      setState(s => ({ ...s, attendanceRecords: rollback }));
      showNotification("Failed to delete attendance records from server.", "error");
      throw e;
    }
  };

  const payInvoice = async (studentId: string, year: number, month: string, amount: number) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin') {
      showNotification("Permission Denied: Only administrators can modify financial records.", 'error');
      return;
    }
    let rollback: Payment[] = [];
    setState(s => {
      rollback = [...s.payments];
      const payments = [...s.payments];
      const idx = payments.findIndex(p => p.studentId === studentId && p.year === year && p.month === month);
      if (idx >= 0) {
        payments[idx] = { ...payments[idx], status: 'Paid', amountUsd: amount };
      } else {
        payments.push({ id: -Date.now(), studentId, year, month, status: 'Paid', amountUsd: amount });
      }
      return { ...s, payments };
    });

    try {
      const { data, error } = await supabase
        .from('payments')
        .upsert({
          student_id: studentId,
          year,
          for_month: month,
          amount_usd: amount,
          status: 'Paid'
        }, {
          onConflict: 'student_id,year,for_month'
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (data) {
        setState(s => {
          const payments = [...s.payments];
          const idx = payments.findIndex(p => p.studentId === studentId && p.year === year && p.month === month);
          if (idx >= 0) {
            payments[idx] = { ...payments[idx], id: data.id };
          }
          return { ...s, payments };
        });
      }
    } catch (e) {
      console.error("[Store] payInvoice failed, rolling back:", e);
      setState(s => ({ ...s, payments: rollback }));
      showNotification("Failed to update payment status on server. Check your internet connection.", "error");
    }
  };

  const prepayInvoiceBulk = async (studentId: string, prepayments: { year: number; month: string; amount: number }[]) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin') {
      showNotification("Permission Denied: Only administrators can modify financial records.", 'error');
      return;
    }
    let rollback: Payment[] = [];
    setState(s => {
      rollback = [...s.payments];
      const payments = [...s.payments];
      prepayments.forEach(p => {
        const idx = payments.findIndex(x => x.studentId === studentId && x.year === p.year && x.month === p.month);
        if (idx >= 0) {
          payments[idx] = { ...payments[idx], status: 'Paid', amountUsd: p.amount };
        } else {
          payments.push({ id: -Date.now() - Math.random(), studentId, year: p.year, month: p.month, status: 'Paid', amountUsd: p.amount });
        }
      });
      return { ...s, payments };
    });

    try {
      const rows = prepayments.map(p => ({
        student_id: studentId,
        year: p.year,
        for_month: p.month,
        amount_usd: p.amount,
        status: 'Paid'
      }));
      const { data, error } = await supabase
        .from('payments')
        .upsert(rows, {
          onConflict: 'student_id,year,for_month'
        })
        .select();

      if (error) throw new Error(error.message);
      if (data) {
        setState(s => {
          const payments = [...s.payments];
          data.forEach((row: any) => {
            const idx = payments.findIndex(x => x.studentId === studentId && x.year === row.year && x.month === row.for_month);
            if (idx >= 0) {
              payments[idx] = { ...payments[idx], id: row.id };
            }
          });
          return { ...s, payments };
        });
      }
    } catch (e) {
      console.error("[Store] prepayInvoiceBulk failed, rolling back:", e);
      setState(s => ({ ...s, payments: rollback }));
      showNotification("Failed to save bulk prepayment on server. Check your connection.", "error");
    }
  };

  const addStudent = async (student: Omit<Student, 'id' | 'registrationDate'>) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach') {
      return { success: false, error: 'Unauthorized Access: You do not have permission to provision new student accounts.' };
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return { success: false, error: 'Authentication session expired. Please log in again.' };

      const studentId = (student as any).id || `STU-${student.gender === 'Male' ? 'M' : 'F'}-${String(state.students.length + 1).padStart(3, '0')}`;
      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ studentData: { ...student, id: studentId } })
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
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach' && role !== 'Coach') {
      showNotification('Unauthorized Access: You do not have permissions to modify student records.', 'warning');
      return;
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
        body: JSON.stringify({ id, data })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(unwrapApiError(resData, 'Failed to update student details.'));

      const existing = state.students.find(x => x.id === id);
      const email = existing?.email;
      const normalizedUsername = id.toLowerCase().replace(/-/g, '_');
      const profileUser = state.users.find(x => x.username === normalizedUsername || (email && x.email?.toLowerCase() === email.toLowerCase()));

      if (profileUser) {
        const updateObj: any = {};
        if (data.englishName) updateObj.display_name = data.englishName;
        if (data.email) updateObj.email = data.email;
        if (data.studentStatus) updateObj.is_active = data.studentStatus === 'Active';
        if (Object.keys(updateObj).length > 0) {
          await supabase.from('profiles').update(updateObj).eq('id', profileUser.id);
        }
      }

      setState(s => {
        const students = s.students.map(x => x.id === id ? { ...x, ...data } : x);
        let users = s.users;
        if (profileUser) {
          users = s.users.map(u => u.id === profileUser.id ? {
            ...u,
            displayName: data.englishName || u.displayName,
            email: data.email || u.email,
            isActive: data.studentStatus !== undefined ? data.studentStatus === 'Active' : u.isActive
          } : u);
        }
        return { ...s, students, users };
      });
    } catch (e: any) {
      showNotification('Failed to update student: ' + e.message, 'error');
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

      const existing = state.students.find(x => x.id === id);
      const email = existing?.email;
      const normalizedUsername = id.toLowerCase().replace(/-/g, '_');
      const profileUser = state.users.find(x => x.username === normalizedUsername || (email && x.email?.toLowerCase() === email.toLowerCase()));

      setState(s => ({
        ...s,
        students: s.students.filter(x => x.id !== id),
        classEnrollments: s.classEnrollments.filter(e => e.studentId !== id),
        beltHistories: s.beltHistories.filter(b => b.studentId !== id),
        users: profileUser ? s.users.map(u => u.id === profileUser.id ? { ...u, isActive: false } : u) : s.users
      }));
      showNotification("Student record deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteStudent error:", e);
      showNotification("Failed to delete student: " + (e.message || e), 'error');
    }
  };

  const addBeltHistory = async (history: Omit<BeltHistory, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('belt_histories')
        .insert({
          student_id: history.studentId,
          belt_level: history.beltLevel,
          promotion_date: history.promotionDate,
          test_score: history.testScore !== undefined ? Number(history.testScore) : null,
          program: history.program || null,
          certificate_id: history.certificateRef || null,
          kukkiwon_dan_card_id: history.kukkiwonDanCardId || null
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        // Query the database for the true up-to-date histories list for this student to avoid parallel race conditions
        const { data: dbHistories, error: fetchErr } = await supabase
          .from('belt_histories')
          .select('*')
          .eq('student_id', history.studentId);

        let latestBelt = 'White';
        if (!fetchErr && dbHistories) {
          const sorted = [...dbHistories].sort((a, b) => {
            const ta = new Date(a.promotion_date).getTime();
            const tb = new Date(b.promotion_date).getTime();
            return ta !== tb ? tb - ta : b.id - a.id;
          });
          if (sorted.length > 0) {
            latestBelt = sorted[0].belt_level;
          }
        } else {
          // Fallback to state calculation if fetch fails
          const studentHistories = [...state.beltHistories.filter(x => x.studentId === history.studentId), { ...history, id: data.id }];
          studentHistories.sort((a, b) => {
            const ta = new Date(a.promotionDate).getTime();
            const tb = new Date(b.promotionDate).getTime();
            return ta !== tb ? tb - ta : b.id - a.id;
          });
          latestBelt = studentHistories.length > 0 ? studentHistories[0].beltLevel : 'White';
        }

        await supabase.from('students').update({ current_belt: latestBelt }).eq('id', history.studentId);

        setState(s => {
          const students = s.students.map(st => st.id === history.studentId ? { ...st, currentBelt: latestBelt } : st);
          const exists = s.beltHistories.some(x => x.id === data.id);
          const nextHistories = exists ? s.beltHistories : [...s.beltHistories, { 
            id: data.id, 
            studentId: data.student_id, 
            beltLevel: data.belt_level, 
            promotionDate: data.promotion_date,
            testScore: data.test_score,
            program: data.program,
            certificateRef: data.certificate_id,
            kukkiwonDanCardId: data.kukkiwon_dan_card_id
          }];
          return {
            ...s,
            students,
            beltHistories: nextHistories
          };
        });
        showNotification("Promotion logged successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addBeltHistory database error:", e);
      showNotification("Failed to log promotion: " + e.message, 'error');
    }
  };

  const updateBeltHistory = async (id: number, data: Partial<BeltHistory>) => {
    try {
      const updatePayload: any = {};
      if (data.beltLevel !== undefined) updatePayload.belt_level = data.beltLevel;
      if (data.promotionDate !== undefined) updatePayload.promotion_date = data.promotionDate;
      if (data.testScore !== undefined) updatePayload.test_score = data.testScore !== null ? Number(data.testScore) : null;
      if (data.program !== undefined) updatePayload.program = data.program;
      if (data.certificateRef !== undefined) updatePayload.certificate_id = data.certificateRef;
      if (data.kukkiwonDanCardId !== undefined) updatePayload.kukkiwon_dan_card_id = data.kukkiwonDanCardId;

      const { data: dbData, error } = await supabase
        .from('belt_histories')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (dbData) {
        const { data: dbHistories, error: fetchErr } = await supabase
          .from('belt_histories')
          .select('*')
          .eq('student_id', dbData.student_id);

        let latestBelt = 'White';
        if (!fetchErr && dbHistories) {
          const sorted = [...dbHistories].sort((a, b) => {
            const ta = new Date(a.promotion_date).getTime();
            const tb = new Date(b.promotion_date).getTime();
            return ta !== tb ? tb - ta : b.id - a.id;
          });
          if (sorted.length > 0) {
            latestBelt = sorted[0].belt_level;
          }
        }

        await supabase.from('students').update({ current_belt: latestBelt }).eq('id', dbData.student_id);

        setState(s => {
          const students = s.students.map(st => st.id === dbData.student_id ? { ...st, currentBelt: latestBelt } : st);
          const nextHistories = s.beltHistories.map(x => x.id === id ? {
            id: dbData.id,
            studentId: dbData.student_id,
            beltLevel: dbData.belt_level,
            promotionDate: dbData.promotion_date,
            testScore: dbData.test_score ?? undefined,
            program: dbData.program ?? undefined,
            certificateRef: dbData.certificate_id ?? undefined,
            kukkiwonDanCardId: dbData.kukkiwon_dan_card_id ?? undefined
          } : x);

          return {
            ...s,
            students,
            beltHistories: nextHistories
          };
        });
        showNotification("Promotion record updated successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] updateBeltHistory database error:", e);
      showNotification("Failed to update promotion record: " + e.message, 'error');
    }
  };

  const deleteBeltHistory = async (id: number, studentId: string) => {
    try {
      const { error } = await supabase
        .from('belt_histories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const { data: dbHistories, error: fetchErr } = await supabase
        .from('belt_histories')
        .select('*')
        .eq('student_id', studentId);

      let latestBelt = 'White';
      if (!fetchErr && dbHistories) {
        const sorted = [...dbHistories].sort((a, b) => {
          const ta = new Date(a.promotion_date).getTime();
          const tb = new Date(b.promotion_date).getTime();
          return ta !== tb ? tb - ta : b.id - a.id;
        });
        if (sorted.length > 0) {
          latestBelt = sorted[0].belt_level;
        }
      }

      await supabase.from('students').update({ current_belt: latestBelt }).eq('id', studentId);

      setState(s => {
        const students = s.students.map(st => st.id === studentId ? { ...st, currentBelt: latestBelt } : st);
        const nextHistories = s.beltHistories.filter(x => x.id !== id);

        return {
          ...s,
          students,
          beltHistories: nextHistories
        };
      });
      showNotification("Promotion record deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteBeltHistory database error:", e);
      showNotification("Failed to delete promotion record: " + e.message, 'error');
    }
  };

  const reconcileAllStudentBelts = async () => {
    let corrected = 0;
    const details: string[] = [];
    const scanned = state.students.length;
    const updates: { studentId: string; currentBelt: string }[] = [];

    for (const student of state.students) {
      const studentHistories = state.beltHistories.filter(x => x.studentId === student.id);
      if (studentHistories.length === 0) {
        if (student.currentBelt !== 'White') {
          details.push(`${student.englishName} (${student.id}): Reset ${student.currentBelt} ➔ White (No logged promotions)`);
          updates.push({ studentId: student.id, currentBelt: 'White' });
        }
        continue;
      }
      const correctBelt = [...studentHistories].sort((a, b) => {
        const ta = new Date(a.promotionDate).getTime();
        const tb = new Date(b.promotionDate).getTime();
        return ta !== tb ? tb - ta : b.id - a.id;
      })[0].beltLevel;

      if (student.currentBelt !== correctBelt) {
        details.push(`${student.englishName} (${student.id}): Healed ${student.currentBelt} ➔ ${correctBelt}`);
        updates.push({ studentId: student.id, currentBelt: correctBelt });
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates.map(u => supabase.from('students').update({ current_belt: u.currentBelt }).eq('id', u.studentId)));
      setState(s => {
        const students = s.students.map(st => {
          const up = updates.find(x => x.studentId === st.id);
          return up ? { ...st, currentBelt: up.currentBelt } : st;
        });
        return { ...s, students };
      });
      corrected = updates.length;
    }
    return { success: true, scanned, corrected, details };
  };

  const addAchievement = async (achievement: Omit<Achievement, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert({
          student_id: achievement.studentId,
          event_name: achievement.eventName,
          date: achievement.date,
          category: achievement.category,
          division: achievement.division,
          medal_rank: achievement.medalRank,
          notes: achievement.notes,
          age_division: achievement.ageDivision,
          belt_division: achievement.beltDivision
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const newAchievement = { ...achievement, id: data.id };
        setState(s => ({
          ...s,
          achievements: [...s.achievements.filter(x => x.id !== data.id), newAchievement]
        }));
        showNotification("Achievement logged successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addAchievement database error:", e);
      showNotification("Failed to log achievement: " + e.message, 'error');
    }
  };

  const deleteAchievement = async (id: number) => {
    try {
      const { error } = await supabase.from('achievements').delete().eq('id', id);
      if (error) throw error;
      setState(s => ({
        ...s,
        achievements: s.achievements.filter(x => x.id !== id)
      }));
      showNotification("Achievement deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteAchievement database error:", e);
      showNotification("Failed to delete achievement: " + e.message, 'error');
    }
  };

  const updateAchievement = async (id: number, achievement: Partial<Omit<Achievement, 'id'>>) => {
    try {
      const updates: any = {};
      if (achievement.studentId !== undefined) updates.student_id = achievement.studentId;
      if (achievement.eventName !== undefined) updates.event_name = achievement.eventName;
      if (achievement.date !== undefined) updates.date = achievement.date;
      if (achievement.category !== undefined) updates.category = achievement.category;
      if (achievement.division !== undefined) updates.division = achievement.division;
      if (achievement.medalRank !== undefined) updates.medal_rank = achievement.medalRank;
      if (achievement.notes !== undefined) updates.notes = achievement.notes;
      if (achievement.ageDivision !== undefined) updates.age_division = achievement.ageDivision;
      if (achievement.beltDivision !== undefined) updates.belt_division = achievement.beltDivision;

      const { data, error } = await supabase
        .from('achievements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setState(s => ({
          ...s,
          achievements: s.achievements.map(x => x.id === id ? { ...x, ...achievement } : x)
        }));
        showNotification("Achievement updated successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] updateAchievement database error:", e);
      showNotification("Failed to update achievement: " + e.message, 'error');
    }
  };

  const addBranch = async (name: string) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach') {
      showNotification("Permission Denied: Only Head Coaches or Admins can add branches.", 'error');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({ branch_name: name })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const newBranch = { id: data.id, name };
        setState(s => ({
          ...s,
          branches: [...s.branches.filter(x => x.id !== data.id), newBranch]
        }));
        showNotification("Branch added successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addBranch error:", e);
      showNotification("Failed to add branch: " + e.message, 'error');
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
      if (currentEnrolled >= session.capacity) {
        showNotification(`Cannot enroll: "${session.name}" has reached maximum capacity (${session.capacity}).`, 'error');
        return { success: false, error: 'Class is at full capacity' };
      }

      const enrollmentDate = new Date().toISOString().split('T')[0];
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
      return { success: true };
    } catch (e: any) {
      console.error("[Store] enrollStudent error:", e);
      showNotification("Failed to enroll student: " + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message };
    }
  };

  const unenrollStudent = async (studentId: string, classId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('class_enrollments')
        .delete()
        .match({ student_id: studentId, class_id: classId });

      if (error) throw error;
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

      const enrollmentDate = new Date().toISOString().split('T')[0];
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

  const addCurriculumVideo = async (video: Omit<CurriculumVideo, 'id' | 'createdAt'> & { muscleRelations?: Omit<AssetMuscleRelation, 'assetId'>[] }) => {
    try {
      const isFitness = video.minBeltLevel === 'Fitness' || video.category.startsWith('Fitness:');
      
      let descriptionToSave = video.description || '';
      try {
        if (!descriptionToSave.trim().startsWith('{') || !descriptionToSave.trim().endsWith('}')) {
          descriptionToSave = JSON.stringify({
            text: descriptionToSave,
            difficulty: 'Beginner',
            instructions: [],
            focusZones: [],
            repsSets: '',
            thumbnailUrl: '',
            actualCategory: video.category
          });
        } else {
          const parsed = JSON.parse(descriptionToSave);
          if (!parsed.actualCategory) {
            parsed.actualCategory = video.category;
            descriptionToSave = JSON.stringify(parsed);
          }
        }
      } catch (e) {
        descriptionToSave = JSON.stringify({
          text: descriptionToSave,
          actualCategory: video.category
        });
      }

      const { data, error } = await supabase
        .from('library_assets')
        .insert({
          title: video.title,
          description: descriptionToSave,
          library_type: isFitness ? 'Fitness' : 'Taekwondo',
          tkd_category: isFitness ? null : mapCategoryToDbEnum(video.category),
          fitness_category: isFitness ? video.category.replace("Fitness: ", "") : null,
          target_level: isFitness ? 'All' : video.minBeltLevel,
          video_url: video.videoUrl || ''
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        let insertedRelations: AssetMuscleRelation[] = [];
        if (video.muscleRelations && video.muscleRelations.length > 0) {
          const relationRows = video.muscleRelations.map(r => ({
            asset_id: data.id,
            muscle_id: r.muscleId,
            role: r.role
          }));
          const { data: relData, error: relError } = await supabase
            .from('library_asset_muscles')
            .insert(relationRows)
            .select();
          if (relError) throw relError;
          if (relData) {
            insertedRelations = relData.map((r: any) => ({
              assetId: r.asset_id,
              muscleId: r.muscle_id,
              role: r.role as 'Primary' | 'Secondary'
            }));
          }
        }

        const newVideo = { 
          id: data.id, 
          title: video.title, 
          description: descriptionToSave, 
          category: video.category, 
          minBeltLevel: video.minBeltLevel, 
          videoUrl: video.videoUrl || '', 
          createdAt: data.created_at || new Date().toISOString() 
        };

        // Mirror to curriculum table for seamless LMS progress references
        try {
          let currCat = 'Recognized Poomsae';
          if (video.category === 'Demonstration' || video.category === 'Tricking') {
            currCat = video.category;
          }
          await supabase.from('curriculum').upsert({
            id: data.id,
            title: video.title.substring(0, 150),
            target_belt: video.minBeltLevel === 'Fitness' ? 'White' : (video.minBeltLevel || 'White'),
            category: currCat,
            is_active: true
          });
        } catch (currErr) {
          console.warn("[Store] Mirrored curriculum upsert notice:", currErr);
        }

        setState(s => ({
          ...s,
          curriculumVideos: [...s.curriculumVideos.filter(x => x.id !== data.id), newVideo],
          assetMuscleRelations: [
            ...s.assetMuscleRelations.filter(x => x.assetId !== data.id),
            ...insertedRelations
          ]
        }));
        showNotification("Video added successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] addCurriculumVideo error:", e);
      showNotification("Failed to add video: " + e.message, 'error');
    }
  };

  const deleteCurriculumVideo = async (id: number) => {
    try {
      // Clean up linked tables first to guarantee referential integrity
      await supabase.from('library_asset_muscles').delete().eq('asset_id', id);
      await supabase.from('lms_progress').delete().eq('curriculum_id', id);
      await supabase.from('curriculum').delete().eq('id', id);

      const { error } = await supabase.from('library_assets').delete().eq('id', id);
      if (error) throw error;
      setState(s => ({
        ...s,
        curriculumVideos: s.curriculumVideos.filter(x => x.id !== id),
        videoProgress: s.videoProgress.filter(x => x.videoId !== id),
        assetMuscleRelations: s.assetMuscleRelations.filter(x => x.assetId !== id)
      }));
      showNotification("Video deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteCurriculumVideo error:", e);
      showNotification("Failed to delete video: " + e.message, 'error');
    }
  };

  const updateCurriculumVideo = async (id: number, video: Partial<CurriculumVideo> & { muscleRelations?: Omit<AssetMuscleRelation, 'assetId'>[] }) => {
    try {
      const currentVideo = state.curriculumVideos.find(x => x.id === id);
      const isFitness = (video.minBeltLevel !== undefined ? video.minBeltLevel : currentVideo?.minBeltLevel) === 'Fitness' || 
                        ((video.category !== undefined ? video.category : currentVideo?.category || '').startsWith('Fitness:'));
      
      const updateData: any = {};
      if (video.title !== undefined) updateData.title = video.title;
      
      const targetCategory = video.category !== undefined ? video.category : currentVideo?.category;
      const targetDescription = video.description !== undefined ? video.description : currentVideo?.description;

      if (video.category !== undefined) {
        updateData.library_type = isFitness ? 'Fitness' : 'Taekwondo';
        updateData.tkd_category = isFitness ? null : mapCategoryToDbEnum(video.category);
        updateData.fitness_category = isFitness ? video.category.replace("Fitness: ", "") : null;
      }
      if (video.minBeltLevel !== undefined) {
        updateData.target_level = isFitness ? 'All' : video.minBeltLevel;
      }
      if (video.videoUrl !== undefined) {
        updateData.video_url = video.videoUrl || '';
      }

      if (targetDescription !== undefined) {
        let desc = targetDescription || '';
        try {
          if (!desc.trim().startsWith('{') || !desc.trim().endsWith('}')) {
            desc = JSON.stringify({
              text: desc,
              actualCategory: targetCategory
            });
          } else {
            const parsed = JSON.parse(desc);
            parsed.actualCategory = targetCategory;
            desc = JSON.stringify(parsed);
          }
        } catch (e) {
          desc = JSON.stringify({
            text: desc,
            actualCategory: targetCategory
          });
        }
        updateData.description = desc;
      }

      const { data, error } = await supabase
        .from('library_assets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        let nextRelations = [...state.assetMuscleRelations];
        if (video.muscleRelations !== undefined) {
          // Delete existing relations
          const { error: delError } = await supabase
            .from('library_asset_muscles')
            .delete()
            .eq('asset_id', id);
          if (delError) throw delError;

          // Insert new relations
          let insertedRelations: AssetMuscleRelation[] = [];
          if (video.muscleRelations.length > 0) {
            const relationRows = video.muscleRelations.map(r => ({
              asset_id: id,
              muscle_id: r.muscleId,
              role: r.role
            }));
            const { data: relData, error: relError } = await supabase
              .from('library_asset_muscles')
              .insert(relationRows)
              .select();
            if (relError) throw relError;
            if (relData) {
              insertedRelations = relData.map((r: any) => ({
                assetId: r.asset_id,
                muscleId: r.muscle_id,
                role: r.role as 'Primary' | 'Secondary'
              }));
            }
          }
          nextRelations = [
            ...state.assetMuscleRelations.filter(x => x.assetId !== id),
            ...insertedRelations
          ];
        }

        let actualCategory = isFitness ? `Fitness: ${data.fitness_category}` : data.tkd_category;
        if (data.description) {
          try {
            if (data.description.trim().startsWith('{') && data.description.trim().endsWith('}')) {
              const details = JSON.parse(data.description);
              if (details.actualCategory) {
                actualCategory = details.actualCategory;
              }
            }
          } catch (e) {}
        }
        if (!isFitness && actualCategory) {
          actualCategory = normalizeCategory(actualCategory);
        }

        const mapped = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          category: actualCategory,
          minBeltLevel: isFitness ? 'Fitness' : data.target_level,
          videoUrl: data.video_url || '',
          createdAt: data.created_at || new Date().toISOString()
        };

        // Keep curriculum table synchronized
        try {
          let currCat = 'Recognized Poomsae';
          if (mapped.category === 'Demonstration' || mapped.category === 'Tricking') {
            currCat = mapped.category;
          }
          await supabase.from('curriculum').upsert({
            id: id,
            title: mapped.title.substring(0, 150),
            target_belt: mapped.minBeltLevel === 'Fitness' ? 'White' : (mapped.minBeltLevel || 'White'),
            category: currCat,
            is_active: true
          });
        } catch (currErr) {
          console.warn("[Store] Mirrored curriculum update notice:", currErr);
        }

        setState(s => ({
          ...s,
          curriculumVideos: s.curriculumVideos.map(x => x.id === id ? mapped : x),
          assetMuscleRelations: nextRelations
        }));
        showNotification("Video updated successfully.", 'success');
      }
    } catch (e: any) {
      console.error("[Store] updateCurriculumVideo error:", e);
      showNotification("Failed to update video: " + e.message, 'error');
    }
  };

  const addWorkoutTemplate = async (template: any) => {
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

      if (error) throw error;
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
    }
  };

  const updateWorkoutTemplate = async (id: string, template: any) => {
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

      if (error) throw error;
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
    }
  };

  const deleteWorkoutTemplate = async (id: string) => {
    try {
      const { error } = await supabase.from('workout_templates').delete().eq('id', id);
      if (error) throw error;
      setState(s => ({
        ...s,
        workoutTemplates: s.workoutTemplates.filter(x => x.id !== id)
      }));
      showNotification("Workout template deleted successfully.", 'success');
    } catch (e: any) {
      console.error("[Store] deleteWorkoutTemplate error:", e);
      showNotification("Failed to delete workout template: " + e.message, 'error');
    }
  };

  const markVideoWatched = async (studentId: string, videoId: number) => {
    try {
      const video = state.curriculumVideos.find(v => v.id === videoId);
      const title = video?.title || 'Asset ' + videoId;
      let curriculumCategory = 'Recognized Poomsae';
      if (video?.category === 'Demonstration' || video?.category === 'Tricking') {
        curriculumCategory = video.category;
      }

      const { error: currError } = await supabase.from('curriculum').upsert({
        id: videoId,
        title: title.substring(0, 150),
        target_belt: 'White',
        category: curriculumCategory,
        is_active: true
      });
      if (currError) throw currError;

      const { data, error } = await supabase
        .from('lms_progress')
        .upsert({
          student_id: studentId,
          curriculum_id: videoId,
          status: 'Completed',
          last_watched_at: new Date().toISOString()
        }, {
          onConflict: 'student_id,curriculum_id'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setState(s => {
          let nextProgress;
          const existing = s.videoProgress.find(x => x.studentId === studentId && x.videoId === videoId);
          if (existing) {
            nextProgress = s.videoProgress.map(x => x.id === existing.id ? { ...x, status: 'Completed' as const, lastWatchedAt: data.last_watched_at } : x);
          } else {
            nextProgress = [...s.videoProgress, { id: data.id, studentId, videoId, status: 'Completed' as const, lastWatchedAt: data.last_watched_at }];
          }
          return { ...s, videoProgress: nextProgress };
        });
      }
    } catch (e: any) {
      console.error("[Store] markVideoWatched error:", e);
      showNotification("Failed to save watch progress: " + e.message, 'error');
    }
  };

  const toggleVideoProgress = async (studentId: string, videoId: number, isCompleted: boolean) => {
    try {
      if (isCompleted) {
        const video = state.curriculumVideos.find(v => v.id === videoId);
        const title = video?.title || 'Asset ' + videoId;
        let curriculumCategory = 'Recognized Poomsae';
        if (video?.category === 'Demonstration' || video?.category === 'Tricking') {
          curriculumCategory = video.category;
        }

        const { error: currError } = await supabase.from('curriculum').upsert({
          id: videoId,
          title: title.substring(0, 150),
          target_belt: 'White',
          category: curriculumCategory,
          is_active: true
        });
        if (currError) throw currError;

        const { data, error } = await supabase
          .from('lms_progress')
          .upsert({
            student_id: studentId,
            curriculum_id: videoId,
            status: 'Completed',
            last_watched_at: new Date().toISOString()
          }, {
            onConflict: 'student_id,curriculum_id'
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setState(s => {
            let nextProgress;
            const existing = s.videoProgress.find(x => x.studentId === studentId && x.videoId === videoId);
            if (existing) {
              nextProgress = s.videoProgress.map(x => x.id === existing.id ? { ...x, status: 'Completed' as const, lastWatchedAt: data.last_watched_at } : x);
            } else {
              nextProgress = [...s.videoProgress, { id: data.id, studentId, videoId, status: 'Completed' as const, lastWatchedAt: data.last_watched_at }];
            }
            return { ...s, videoProgress: nextProgress };
          });
        }
      } else {
        const { error } = await supabase
          .from('lms_progress')
          .delete()
          .match({ student_id: studentId, curriculum_id: videoId });

        if (error) throw error;
        setState(s => ({
          ...s,
          videoProgress: s.videoProgress.filter(x => x.studentId !== studentId || x.videoId !== videoId)
        }));
      }
      showNotification("Video watch status updated.", 'success');
    } catch (e: any) {
      console.error("[Store] toggleVideoProgress error:", e);
      showNotification("Failed to update video progress: " + e.message, 'error');
    }
  };

  const addUser = async (user: Omit<User, 'id'> & { password?: string; studentId?: string }) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin') {
      return { success: false, error: 'Unauthorized Access: Only administrators can provision system accounts.' };
    }
    const email = user.email.trim();
    const password = user.password || 'Admin123456!';
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
      showNotification('User account created successfully.', 'success');
      return { success: true };
    } catch (e: any) {
      const normalized = reportError(e, 'Failed to Create User Account');
      return { success: false, error: normalized.message };
    }
  };

  const commitRoster = async (date: string, branchId: number | 'all', classId: number | 'all') => {
    const getStudentEnrollDate = (st: any) => {
      const enrollments = state.classEnrollments.filter(e => e.studentId === st.id);
      if (enrollments.length === 0) return st.registrationDate?.split('T')[0];
      const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
      if (dates.length === 0) return st.registrationDate?.split('T')[0];
      return dates.sort()[0].split('T')[0];
    };

    const studentsToMark = state.students.filter(student => {
      const matchBranch = branchId === 'all' || student.homeBranchId === branchId;
      let matchClass = true;
      if (classId !== 'all') {
        matchClass = state.classEnrollments.some(ce => ce.studentId === student.id && ce.classId === classId);
      }
      
      const enrollDate = getStudentEnrollDate(student);
      const isNotYetEnrolled = enrollDate ? (date < enrollDate) : false;

      return matchBranch && matchClass && student.studentStatus === 'Active' && !isNotYetEnrolled;
    }).filter(student => !state.attendanceRecords.some(ar => ar.studentId === student.id && ar.date === date));

    if (studentsToMark.length === 0) return { count: 0 };

    const rows = studentsToMark.map(student => ({
      student_id: student.id,
      date,
      status: 'Absent' as const,
      marked_by: state.currentUser?.id
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(rows, {
        onConflict: 'student_id,date'
      })
      .select();

    if (!error && data) {
      setState(s => {
        const records = [...s.attendanceRecords];
        data.forEach((row: any) => {
          const idx = records.findIndex(ar => ar.studentId === row.student_id && ar.date === date);
          if (idx >= 0) {
            records[idx] = { ...records[idx], status: 'Absent' as const };
          } else {
            records.push({ id: row.id, studentId: row.student_id, date, status: 'Absent' as const });
          }
        });
        return { ...s, attendanceRecords: records };
      });
      return { count: studentsToMark.length };
    }
    throw error || new Error("Failed to commit bulk roster");
  };

  const updateUser = async (id: string, data: Partial<User> & { password?: string }) => {
    const role = state.currentUser?.role;
    const isSelf = state.currentUser?.id === id;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && !isSelf) {
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
        currentUser: s.currentUser?.id === id ? { ...s.currentUser, ...data } : s.currentUser
      }));
    } catch (e: any) {
      console.error("Error updating user/member details:", e);
      showNotification(e.message || "Failed to save user updates.", "error");
      throw e;
    }
  };

  const deleteUser = async (id: string) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin') {
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

      setState(s => {
        const nextRecords = [...s.staffDanRecords.filter(x => x.id !== newRec.id), newRec].sort((a, b) => a.danLevel - b.danLevel);
        const userRecords = nextRecords.filter(r => r.userId === newRec.userId);
        const highestDan = userRecords.reduce((max, r) => r.danLevel > max.danLevel ? r : max, userRecords[0]);

        const updatedUsers = s.users.map(u => u.id === newRec.userId ? {
          ...u,
          currentDan: highestDan?.danLevel ?? u.currentDan,
          danIssueDate: highestDan?.issueDate ?? u.danIssueDate,
          kukkiwonId: highestDan?.certificateNo ?? u.kukkiwonId,
          danCertificateUrl: highestDan?.certificateUrl ?? u.danCertificateUrl
        } : u);

        const updatedCurrentUser = s.currentUser?.id === newRec.userId ? {
          ...s.currentUser,
          currentDan: highestDan?.danLevel ?? s.currentUser.currentDan,
          danIssueDate: highestDan?.issueDate ?? s.currentUser.danIssueDate,
          kukkiwonId: highestDan?.certificateNo ?? s.currentUser.kukkiwonId,
          danCertificateUrl: highestDan?.certificateUrl ?? s.currentUser.danCertificateUrl
        } : s.currentUser;

        return {
          ...s,
          staffDanRecords: nextRecords,
          users: updatedUsers,
          currentUser: updatedCurrentUser
        };
      });

      showNotification(`Added ${newRec.danLevel} Dan promotion record!`, 'success');
      return { success: true, data: newRec };
    } catch (err: any) {
      console.error("[Store] addStaffDanRecord error:", err);
      showNotification(err.message || 'Failed to record Dan promotion.', 'error');
      return { success: false, error: err.message };
    }
  };

  const updateStaffDanRecord = async (id: string, updates: Partial<StaffDanRecord>): Promise<{ success: boolean; error?: string }> => {
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

      setState(s => ({
        ...s,
        staffDanRecords: s.staffDanRecords.map(r => r.id === id ? { ...r, ...updates } : r)
      }));

      showNotification('Dan record updated successfully.', 'success');
      return { success: true };
    } catch (err: any) {
      console.error("[Store] updateStaffDanRecord error:", err);
      showNotification(err.message || 'Failed to update Dan record.', 'error');
      return { success: false, error: err.message };
    }
  };

  const deleteStaffDanRecord = async (id: string, userId: string): Promise<{ success: boolean; error?: string }> => {
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

      setState(s => {
        const nextRecords = s.staffDanRecords.filter(r => r.id !== id);
        const userRecords = nextRecords.filter(r => r.userId === userId);
        const highestDan = userRecords.length > 0
          ? userRecords.reduce((max, r) => r.danLevel > max.danLevel ? r : max, userRecords[0])
          : null;

        const updatedUsers = s.users.map(u => u.id === userId ? {
          ...u,
          currentDan: highestDan ? highestDan.danLevel : undefined,
          danIssueDate: highestDan ? highestDan.issueDate : undefined,
          kukkiwonId: highestDan ? highestDan.certificateNo : u.kukkiwonId
        } : u);

        const updatedCurrentUser = s.currentUser?.id === userId ? {
          ...s.currentUser,
          currentDan: highestDan ? highestDan.danLevel : undefined,
          danIssueDate: highestDan ? highestDan.issueDate : undefined,
          kukkiwonId: highestDan ? highestDan.certificateNo : s.currentUser.kukkiwonId
        } : s.currentUser;

        return {
          ...s,
          staffDanRecords: nextRecords,
          users: updatedUsers,
          currentUser: updatedCurrentUser
        };
      });

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
      
      // If mock/sample item not in DB, update local state directly
      if (!isUuid) {
        setState(s => ({
          ...s,
          partners: s.partners.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
        showNotification("Partner details updated.", 'success');
        return { success: true };
      }

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
      if (!res.ok) {
        // Fallback for missing DB table or type mismatch
        if (json?.error?.code === '22P02' || json?.error?.code === '42P01') {
          setState(s => ({
            ...s,
            partners: s.partners.map(p => p.id === id ? { ...p, ...updates } : p)
          }));
          showNotification("Partner details updated.", 'success');
          return { success: true };
        }
        throw new Error(unwrapApiError(json, 'Failed to update partner.'));
      }

      setState(s => ({
        ...s,
        partners: s.partners.map(p => p.id === id ? { ...p, ...updates } : p)
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

      // If mock/sample item not in DB, delete from local state directly
      if (!isUuid) {
        setState(s => ({
          ...s,
          partners: s.partners.filter(p => p.id !== id)
        }));
        showNotification("Partner record removed.", 'info');
        return { success: true };
      }

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
      if (!res.ok) {
        // Fallback for missing DB table or type mismatch
        if (json?.error?.code === '22P02' || json?.error?.code === '42P01') {
          setState(s => ({
            ...s,
            partners: s.partners.filter(p => p.id !== id)
          }));
          showNotification("Partner record removed.", 'info');
          return { success: true };
        }
        throw new Error(unwrapApiError(json, 'Failed to delete partner.'));
      }

      setState(s => ({
        ...s,
        partners: s.partners.filter(p => p.id !== id)
      }));
      showNotification("Partner record removed.", 'info');
      return { success: true };
    } catch (err: any) {
      // Fallback: If user had a cached sample ID, still remove it locally
      if (err.message?.includes('uuid') || id.startsWith('p-')) {
        setState(s => ({
          ...s,
          partners: s.partners.filter(p => p.id !== id)
        }));
        showNotification("Partner record removed.", 'info');
        return { success: true };
      }
      const normalized = reportError(err, 'Failed to Delete Partner');
      return { success: false, error: normalized.message };
    }
  };

  const fetchPartners = async (): Promise<Partner[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return state.partners;

      const res = await fetch('/api/admin/partners', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          const mapped = json.data.map(mapPartnerRow);
          setState(s => ({
            ...s,
            partners: mapped
          }));
          return mapped;
        }
      }
    } catch (err: any) {
      console.warn('[Store] fetchPartners error:', err);
    }
    return state.partners;
  };

  const upsertPhysicalEvaluation = async (studentId: string, skillName: string, beltLevel: string, grade: string) => {
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
    }
  };

  const addBodyComposition = async (composition: any) => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin' && role !== 'Head Coach' && role !== 'Coach') {
      showNotification('Unauthorized Access: You do not have permissions to record biometrics.', 'warning');
      return;
    }
    try {
      const payload = {
        student_id: composition.studentId,
        recorded_date: composition.recordedDate || new Date().toISOString().split('T')[0],
        height_cm: composition.heightCm ? parseFloat(composition.heightCm) : null,
        weight_kg: composition.weightKg ? parseFloat(composition.weightKg) : null,
        body_fat_percentage: composition.bodyFatPercentage ? parseFloat(composition.bodyFatPercentage) : null,
        skeletal_muscle_mass_kg: composition.skeletalMuscleMassKg ? parseFloat(composition.skeletalMuscleMassKg) : null,
        neck_cm: composition.neckCm ? parseFloat(composition.neckCm) : null,
        shoulder_width_cm: composition.shoulderWidthCm ? parseFloat(composition.shoulderWidthCm) : null,
        chest_cm: composition.chestCm ? parseFloat(composition.chestCm) : null,
        waist_cm: composition.waistCm ? parseFloat(composition.waistCm) : null,
        hips_cm: composition.hipsCm ? parseFloat(composition.hipsCm) : null,
        left_arm_cm: composition.leftArmCm ? parseFloat(composition.leftArmCm) : null,
        right_arm_cm: composition.rightArmCm ? parseFloat(composition.rightArmCm) : null,
        left_thigh_cm: composition.leftThighCm ? parseFloat(composition.leftThighCm) : null,
        right_thigh_cm: composition.rightThighCm ? parseFloat(composition.rightThighCm) : null,
        left_calf_cm: composition.leftCalfCm ? parseFloat(composition.leftCalfCm) : null,
        right_calf_cm: composition.rightCalfCm ? parseFloat(composition.rightCalfCm) : null,
        recorded_by: state.currentUser?.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('student_body_compositions')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Update student's primary height/weight in database
      const { error: studentError } = await supabase
        .from('students')
        .update({
          height_cm: payload.height_cm,
          weight_kg: payload.weight_kg
        })
        .eq('id', composition.studentId);

      if (studentError) throw studentError;

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
            heightCm: mapped.heightCm ?? st.heightCm,
            weightKg: mapped.weightKg ?? st.weightKg
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
      const { error } = await supabase.from('belt_techniques').delete().eq('id', id);
      if (error) throw error;
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

  const updateAcademyProfile = async (updates: Partial<AcademyProfile>): Promise<{ success: boolean; error?: string }> => {
    const role = state.currentUser?.role;
    if (role !== 'Root' && role !== 'Super Root' && role !== 'Admin') {
      showNotification('Unauthorized: Only administrators can update the academy profile.', 'error');
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let apiSuccess = false;
      if (token) {
        try {
          const res = await fetch('/api/admin/update-academy-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updates)
          });
          const resData = await res.json();
          if (res.ok && resData.success) {
            apiSuccess = true;
          }
        } catch (apiErr) {
          console.warn('[Store] API update-academy-profile failed, falling back to direct client RPC:', apiErr);
        }
      }

      if (!apiSuccess) {
        const dbPayload: Record<string, any> = {
          id: 'default',
          updated_at: new Date().toISOString()
        };
        if (updates.academyName !== undefined) dbPayload.academy_name = updates.academyName;
        if (updates.legalName !== undefined) dbPayload.legal_name = updates.legalName;
        if (updates.tagline !== undefined) dbPayload.tagline = updates.tagline;
        if (updates.logoUrl !== undefined) dbPayload.logo_url = updates.logoUrl;
        if (updates.websiteUrl !== undefined) dbPayload.website_url = updates.websiteUrl;
        if (updates.portalUrl !== undefined) dbPayload.portal_url = updates.portalUrl;
        if (updates.taxId !== undefined) dbPayload.tax_id = updates.taxId;
        if (updates.contactPhone !== undefined) dbPayload.contact_phone = updates.contactPhone;
        if (updates.supportEmail !== undefined) dbPayload.support_email = updates.supportEmail;
        if (updates.primaryAddress !== undefined) dbPayload.primary_address = updates.primaryAddress;
        if (updates.defaultBranchId !== undefined) {
          dbPayload.default_branch_id = updates.defaultBranchId === 'all' || !updates.defaultBranchId ? null : updates.defaultBranchId;
        }
        if (updates.currency !== undefined) {
          dbPayload.currency = updates.currency;
          dbPayload.currency_symbol = updates.currency === 'USD' ? '$' : '៛';
        }
        if (updates.currencySymbol !== undefined) dbPayload.currency_symbol = updates.currencySymbol;
        if (updates.tuitionGracePeriodDays !== undefined) dbPayload.tuition_grace_period_days = updates.tuitionGracePeriodDays;
        if (updates.taxRatePercentage !== undefined) dbPayload.tax_rate_percentage = updates.taxRatePercentage;
        if (updates.dateFormat !== undefined) dbPayload.date_format = updates.dateFormat;
        if (updates.defaultClassDurationMins !== undefined) dbPayload.default_class_duration_mins = updates.defaultClassDurationMins;
        if (updates.examPassingScore !== undefined) dbPayload.exam_passing_score = updates.examPassingScore;
        if (updates.minAttendanceExamPct !== undefined) dbPayload.min_attendance_exam_pct = updates.minAttendanceExamPct;
        if (updates.allowStudentPortalLogin !== undefined) dbPayload.allow_student_portal_login = updates.allowStudentPortalLogin;
        if (updates.enableAudioChimes !== undefined) dbPayload.enable_audio_chimes = updates.enableAudioChimes;
        if (updates.facebookUrl !== undefined) dbPayload.facebook_url = updates.facebookUrl;
        if (updates.telegramChannel !== undefined) dbPayload.telegram_channel = updates.telegramChannel;
        if (updates.instagramUrl !== undefined) dbPayload.instagram_url = updates.instagramUrl;

        const { error } = await supabase.from('academy_profile').upsert(dbPayload, { onConflict: 'id' });
        if (error) {
          console.warn('[Store] Supabase direct upsert error:', error.message);
        }
      }

      setState(s => {
        const merged: AcademyProfile = {
          ...s.academyProfile,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('infinity_academy_profile', JSON.stringify(merged));
          localStorage.setItem('infinity_academy_config', JSON.stringify({
            academyName: merged.academyName,
            defaultBranchId: merged.defaultBranchId,
            contactPhone: merged.contactPhone,
            contactEmail: merged.supportEmail,
            currency: merged.currency,
            dateFormat: merged.dateFormat,
            defaultClassDuration: merged.defaultClassDurationMins,
            examPassingScore: merged.examPassingScore
          }));
        }
        return { ...s, academyProfile: merged };
      });

      showNotification('Academy profile synchronized successfully!', 'success');
      return { success: true };
    } catch (e: any) {
      console.error('[Store] updateAcademyProfile error:', e);
      showNotification('Failed to update academy profile: ' + (e.message || 'Unknown error'), 'error');
      return { success: false, error: e.message || 'Failed to update academy profile' };
    }
  };

  const can = useCallback((permissionKey: string, targetUserId?: string): boolean => {
    if (!state.currentUser) return false;
    const userIdToCheck = targetUserId || state.currentUser.id;
    return hasPermission(
      state.currentUser.role,
      permissionKey,
      state.rolePermissions,
      userIdToCheck,
      state.userPermissions
    );
  }, [state.currentUser, state.rolePermissions, state.userPermissions]);

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

export function getMembershipBillingStatus(
  student: Student,
  payments: Payment[],
  scholarships: Scholarship[],
  classEnrollments: ClassEnrollment[]
): MembershipBillingStatus {
  const enrollments = classEnrollments.filter(e => e.studentId === student.id);
  let baseDateStr = '';
  if (enrollments.length > 0) {
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length > 0) {
      baseDateStr = dates.sort()[0].split('T')[0];
    }
  }
  if (!baseDateStr) {
    baseDateStr = student.registrationDate || '';
  }
  if (!baseDateStr) {
    return { status: 'Current', nextRenewalDate: '-', daysRemaining: 999, amountOwed: 0 };
  }

  const baseDate = new Date(baseDateStr.split('T')[0]);
  baseDate.setDate(baseDate.getDate() - 1); // Billing anchor is enrollment date minus 1 day
  const anchorDay = baseDate.getDate();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth(); // 0-11

  // Get correct anniversary date for a specific year and month
  const getAnniversaryDate = (year: number, monthIndex: number, day: number) => {
    const d = new Date(year, monthIndex, day);
    // If month overflowed (e.g. Feb 30 -> Mar 2), cap it to the last day of the month
    if (d.getMonth() !== (monthIndex % 12 + 12) % 12) {
      return new Date(year, monthIndex + 1, 0);
    }
    return d;
  };

  const anniversaryThisMonth = getAnniversaryDate(currentYear, currentMonthIdx, anchorDay);

  let targetMonthName: string;
  let targetYear: number;
  let nextRenewalDate: Date;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (today < anniversaryThisMonth) {
    // Current billing cycle started on the anniversary of last month
    const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
    const prevYear = currentMonthIdx === 0 ? currentYear - 1 : currentYear;
    targetMonthName = monthNames[prevMonthIdx];
    targetYear = prevYear;
    nextRenewalDate = anniversaryThisMonth;
  } else {
    // Current billing cycle started on the anniversary of this month
    targetMonthName = monthNames[currentMonthIdx];
    targetYear = currentYear;
    // Next renewal is next month's anniversary
    const nextMonthIdx = currentMonthIdx === 11 ? 0 : currentMonthIdx + 1;
    const nextYear = currentMonthIdx === 11 ? currentYear + 1 : currentYear;
    nextRenewalDate = getAnniversaryDate(nextYear, nextMonthIdx, anchorDay);
  }

  const scholarship = scholarships.find(s => s.id === student.scholarshipId);
  const isStudentEarlyGroup = scholarship?.typeName === 'Early Group Student';
  const baseFee = isStudentEarlyGroup ? 25.00 : 45.00;
  const discountPct = isStudentEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
  const amountOwed = baseFee * (1 - discountPct / 100);
  const isFullScholarship = discountPct === 100;

  // Time calculations
  const diffTime = nextRenewalDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formatLocalDate = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  if (isFullScholarship) {
    return {
      status: 'Current',
      nextRenewalDate: formatLocalDate(nextRenewalDate),
      daysRemaining,
      amountOwed: 0
    };
  }

  const hasPaid = payments.some(
    p => p.studentId === student.id && p.month === targetMonthName && p.year === targetYear && p.status === 'Paid'
  );

  if (!hasPaid) {
    // Payment is overdue for the current billing cycle
    const overdueCycleStart = today < anniversaryThisMonth 
      ? getAnniversaryDate(targetYear, monthNames.indexOf(targetMonthName), anchorDay)
      : anniversaryThisMonth;
    const overdueDiff = today.getTime() - overdueCycleStart.getTime();
    const daysOverdue = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));

    return {
      status: 'Overdue',
      nextRenewalDate: formatLocalDate(overdueCycleStart),
      daysRemaining: -daysOverdue,
      amountOwed
    };
  }

  if (daysRemaining <= 5) {
    return {
      status: 'Due Soon',
      nextRenewalDate: formatLocalDate(nextRenewalDate),
      daysRemaining,
      amountOwed
    };
  }

  return {
    status: 'Current',
    nextRenewalDate: formatLocalDate(nextRenewalDate),
    daysRemaining,
    amountOwed
  };
}
