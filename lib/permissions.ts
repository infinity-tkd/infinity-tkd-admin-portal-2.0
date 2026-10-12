/**
 * Infinity TKD Central Frontend Security Engine
 * Enforces defense-in-depth, RBAC permissions, XSS sanitization, rate-limiting,
 * session fingerprinting, safe error masking, and privacy-conscious logging.
 */

import type { Role } from './store';

// --- 1. RBAC Permission Definitions & Least Privilege Engine ---

export type PermissionKey =
  // Page / Tab Access
  | 'page:dashboard'
  | 'page:pos'
  | 'page:financials'
  | 'page:directory'
  | 'page:attendance'
  | 'page:schedule'
  | 'page:lms'
  | 'page:library'
  | 'page:staff'
  | 'page:partners'
  | 'page:settings'
  // Granular Actions
  | 'action:pos_create_order'
  | 'action:pos_manage_inventory'
  | 'action:pos_cancel_order'
  | 'action:student_create'
  | 'action:student_edit'
  | 'action:student_delete'
  | 'action:attendance_mark'
  | 'action:attendance_delete'
  | 'action:evaluations_grade'
  | 'action:curriculum_edit'
  | 'action:finance_record_payment'
  | 'action:schedule_manage'
  | 'action:staff_manage'
  | 'action:partner_create'
  | 'action:partner_edit'
  | 'action:partner_delete'
  // Legacy Aliases
  | 'manage:users'
  | 'manage:students'
  | 'manage:finances'
  | 'manage:pos'
  | 'manage:curriculum'
  | 'manage:branches'
  | 'manage:schedule'
  | 'view:financials'
  | 'view:pos'
  | 'view:analytics'
  | 'mark:attendance'
  | 'grade:evaluations'
  | 'view:own_dossier';

export type AccessType = 'read' | 'write';

export type SecurityModule =
  | 'dashboard'
  | 'pos'
  | 'directory'
  | 'attendance'
  | 'financials'
  | 'schedule'
  | 'lms'
  | 'library'
  | 'staff'
  | 'partners'
  | 'settings';

export type AccessLevel = 'none' | 'read' | 'write';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  category: 'Navigation & Pages' | 'Point-of-Sale (POS)' | 'Students & Directory' | 'Academic & LMS' | 'Operations & Staff';
  module: SecurityModule;
  accessType: AccessType;
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Navigation & Pages (READ)
  { key: 'page:dashboard', label: 'Executive Dashboard', category: 'Navigation & Pages', module: 'dashboard', accessType: 'read', description: 'Access executive stats, student metrics, and daily schedule' },
  { key: 'page:pos', label: 'Pro-Shop & POS Terminal', category: 'Navigation & Pages', module: 'pos', accessType: 'read', description: 'View product catalog, inventory levels, and order history' },
  { key: 'page:financials', label: 'Tuition & Financials', category: 'Navigation & Pages', module: 'financials', accessType: 'read', description: 'View monthly tuition payments, revenue graphs, and billing ledger' },
  { key: 'page:directory', label: 'Student Directory', category: 'Navigation & Pages', module: 'directory', accessType: 'read', description: 'View student database, addresses, and physical evaluations' },
  { key: 'page:attendance', label: 'Attendance Check-in', category: 'Navigation & Pages', module: 'attendance', accessType: 'read', description: 'View class attendance rosters, kiosk history, and logs' },
  { key: 'page:schedule', label: 'Master Schedule', category: 'Navigation & Pages', module: 'schedule', accessType: 'read', description: 'View dojo schedule, class sessions, and student enrollments' },
  { key: 'page:lms', label: 'E-Learning & LMS', category: 'Navigation & Pages', module: 'lms', accessType: 'read', description: 'View syllabus progression, video lessons, and completion tracking' },
  { key: 'page:library', label: 'Asset Library & Anatomy', category: 'Navigation & Pages', module: 'library', accessType: 'read', description: 'View video technique library, 2D/3D anatomy muscle maps' },
  { key: 'page:staff', label: 'Staff Directory', category: 'Navigation & Pages', module: 'staff', accessType: 'read', description: 'View instructor list, roles, and emergency contact details' },
  { key: 'page:partners', label: 'Partners & MOU Directory', category: 'Navigation & Pages', module: 'partners', accessType: 'read', description: 'View business partners, MOU agreements, sponsors, and key contacts' },
  { key: 'page:settings', label: 'Academy Settings', category: 'Navigation & Pages', module: 'settings', accessType: 'read', description: 'View academy profile, operational policies, and audit logs' },

  // POS (WRITE)
  { key: 'action:pos_create_order', label: 'Create POS Orders', category: 'Point-of-Sale (POS)', module: 'pos', accessType: 'write', description: 'Process customer cart checkout and accept ABA KHQR / Cash payments' },
  { key: 'action:pos_manage_inventory', label: 'Manage Inventory', category: 'Point-of-Sale (POS)', module: 'pos', accessType: 'write', description: 'Create and update products, variants, prices, and stock restocks' },
  { key: 'action:pos_cancel_order', label: 'Void / Cancel Orders', category: 'Point-of-Sale (POS)', module: 'pos', accessType: 'write', description: 'Cancel pending orders and restore inventory stock' },

  // Students & Directory (WRITE)
  { key: 'action:student_create', label: 'Register Students', category: 'Students & Directory', module: 'directory', accessType: 'write', description: 'Enroll new students and generate student IDs' },
  { key: 'action:student_edit', label: 'Edit Student Details', category: 'Students & Directory', module: 'directory', accessType: 'write', description: 'Update belt ranks, weights, contact information, and medical notes' },
  { key: 'action:student_delete', label: 'Archive / Delete Students', category: 'Students & Directory', module: 'directory', accessType: 'write', description: 'Soft-delete or permanently remove student records' },

  // Operations & Staff (WRITE)
  { key: 'action:attendance_mark', label: 'Mark Attendance', category: 'Operations & Staff', module: 'attendance', accessType: 'write', description: 'Check-in students as Present, Absent, or Late and operate scanner kiosk' },
  { key: 'action:attendance_delete', label: 'Delete Attendance Logs', category: 'Operations & Staff', module: 'attendance', accessType: 'write', description: 'Purge or modify historical attendance entries' },
  { key: 'action:finance_record_payment', label: 'Record Tuition Payments', category: 'Operations & Staff', module: 'financials', accessType: 'write', description: 'Log paid tuition invoices, prepayments, and generate receipts' },
  { key: 'action:schedule_manage', label: 'Manage Class Sessions', category: 'Operations & Staff', module: 'schedule', accessType: 'write', description: 'Create and update weekly class times, coaches, and capacities' },
  { key: 'action:staff_manage', label: 'Manage Staff Roles', category: 'Operations & Staff', module: 'staff', accessType: 'write', description: 'Invite staff members, assign roles, and toggle access' },
  { key: 'action:partner_create', label: 'Create Partner & MOU', category: 'Operations & Staff', module: 'partners', accessType: 'write', description: 'Add new business partners, MOU agreements, and sponsors' },
  { key: 'action:partner_edit', label: 'Edit Partner & Contacts', category: 'Operations & Staff', module: 'partners', accessType: 'write', description: 'Update partner details, contracts, Telegram, and manager contacts' },
  { key: 'action:partner_delete', label: 'Delete Partner Record', category: 'Operations & Staff', module: 'partners', accessType: 'write', description: 'Delete partner and collaboration agreements' },

  // Academic & LMS (WRITE)
  { key: 'action:evaluations_grade', label: 'Grade Physical Tests', category: 'Academic & LMS', module: 'lms', accessType: 'write', description: 'Enter technique scores and physical evaluations for students' },
  { key: 'action:curriculum_edit', label: 'Edit Curriculum & Videos', category: 'Academic & LMS', module: 'lms', accessType: 'write', description: 'Upload and modify syllabus videos, techniques, and muscle maps' },
];

export interface ModuleDefinition {
  module: SecurityModule;
  label: string;
  readKey: PermissionKey;
  writeKeys: PermissionKey[];
  description: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    module: 'pos',
    label: 'Point-of-Sale (POS)',
    readKey: 'page:pos',
    writeKeys: ['action:pos_create_order', 'action:pos_manage_inventory', 'action:pos_cancel_order'],
    description: 'Pro-Shop merchandise, customer order checkout, stock catalog',
  },
  {
    module: 'directory',
    label: 'Students & Directory',
    readKey: 'page:directory',
    writeKeys: ['action:student_create', 'action:student_edit', 'action:student_delete'],
    description: 'Student profiles, promotions, registration, demographic records',
  },
  {
    module: 'attendance',
    label: 'Attendance Check-in',
    readKey: 'page:attendance',
    writeKeys: ['action:attendance_mark', 'action:attendance_delete'],
    description: 'Daily check-in rosters, barcode scanner kiosk, history logs',
  },
  {
    module: 'financials',
    label: 'Tuition & Financials',
    readKey: 'page:financials',
    writeKeys: ['action:finance_record_payment'],
    description: 'Tuition subscriptions, revenue statements, payment recording',
  },
  {
    module: 'schedule',
    label: 'Master Schedule',
    readKey: 'page:schedule',
    writeKeys: ['action:schedule_manage'],
    description: 'Class timetable, session management, coach assignments',
  },
  {
    module: 'lms',
    label: 'Curriculum & LMS',
    readKey: 'page:lms',
    writeKeys: ['action:curriculum_edit', 'action:evaluations_grade'],
    description: 'Belt syllabus, video lessons, technique scoring & evaluations',
  },
  {
    module: 'library',
    label: 'Asset Library',
    readKey: 'page:library',
    writeKeys: ['action:curriculum_edit'],
    description: 'Instructional video library and 2D/3D muscle anatomy relations',
  },
  {
    module: 'staff',
    label: 'Staff Directory',
    readKey: 'page:staff',
    writeKeys: ['action:staff_manage'],
    description: 'Instructor profiles, system accounts, and administrative roles',
  },
  {
    module: 'partners',
    label: 'Partners & MOU',
    readKey: 'page:partners',
    writeKeys: ['action:partner_create', 'action:partner_edit', 'action:partner_delete'],
    description: 'Strategic partners, MOUs, sponsorships, and business contact directory',
  },
  {
    module: 'settings',
    label: 'Academy Settings',
    readKey: 'page:settings',
    writeKeys: ['action:staff_manage'],
    description: 'Academy branding, operational policies, and audit ledgers',
  },
];

/**
 * Computes the effective access level for a module:
 * - 'none': User cannot view this module
 * - 'read': User can view/read this module, but cannot perform write/mutation actions
 * - 'write': User has full access to read and mutate/write
 */
export function getModuleAccessLevel(
  module: SecurityModule,
  canFn: (key: string) => boolean
): AccessLevel {
  const def = MODULE_DEFINITIONS.find(m => m.module === module);
  if (!def) return 'none';
  if (!canFn(def.readKey)) return 'none';
  const hasWrite = def.writeKeys.some(k => canFn(k));
  return hasWrite ? 'write' : 'read';
}

export const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  'Root': [
    'page:dashboard',
    'page:pos',
    'page:financials',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:staff',
    'page:partners',
    'page:settings',
    'action:pos_create_order',
    'action:pos_manage_inventory',
    'action:pos_cancel_order',
    'action:student_create',
    'action:student_edit',
    'action:student_delete',
    'action:attendance_mark',
    'action:attendance_delete',
    'action:evaluations_grade',
    'action:curriculum_edit',
    'action:finance_record_payment',
    'action:schedule_manage',
    'action:staff_manage',
    'action:partner_create',
    'action:partner_edit',
    'action:partner_delete',
    'manage:users',
    'manage:students',
    'manage:finances',
    'manage:pos',
    'manage:curriculum',
    'manage:branches',
    'manage:schedule',
    'view:financials',
    'view:pos',
    'view:analytics',
    'mark:attendance',
    'grade:evaluations',
    'view:own_dossier',
  ],
  'Super Root': [
    'page:dashboard',
    'page:pos',
    'page:financials',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:staff',
    'page:partners',
    'page:settings',
    'action:pos_create_order',
    'action:pos_manage_inventory',
    'action:pos_cancel_order',
    'action:student_create',
    'action:student_edit',
    'action:student_delete',
    'action:attendance_mark',
    'action:attendance_delete',
    'action:evaluations_grade',
    'action:curriculum_edit',
    'action:finance_record_payment',
    'action:schedule_manage',
    'action:staff_manage',
    'action:partner_create',
    'action:partner_edit',
    'action:partner_delete',
    'manage:users',
    'manage:students',
    'manage:finances',
    'manage:pos',
    'manage:curriculum',
    'manage:branches',
    'manage:schedule',
    'view:financials',
    'view:pos',
    'view:analytics',
    'mark:attendance',
    'grade:evaluations',
    'view:own_dossier',
  ],
  'Admin': [
    'page:dashboard',
    'page:pos',
    'page:financials',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:staff',
    'page:partners',
    'page:settings',
    'action:pos_create_order',
    'action:pos_manage_inventory',
    'action:pos_cancel_order',
    'action:student_create',
    'action:student_edit',
    'action:attendance_mark',
    'action:attendance_delete',
    'action:evaluations_grade',
    'action:curriculum_edit',
    'action:finance_record_payment',
    'action:schedule_manage',
    'action:staff_manage',
    'action:partner_create',
    'action:partner_edit',
    'action:partner_delete',
    'manage:users',
    'manage:students',
    'manage:finances',
    'manage:pos',
    'manage:curriculum',
    'manage:branches',
    'manage:schedule',
    'view:financials',
    'view:pos',
    'view:analytics',
    'mark:attendance',
    'grade:evaluations',
    'view:own_dossier',
  ],
  'Head Coach': [
    'page:dashboard',
    'page:pos',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:staff',
    'page:partners',
    'action:pos_create_order',
    'action:student_create',
    'action:student_edit',
    'action:attendance_mark',
    'action:attendance_delete',
    'action:evaluations_grade',
    'action:curriculum_edit',
    'action:schedule_manage',
    'action:partner_create',
    'action:partner_edit',
    'manage:students',
    'manage:curriculum',
    'manage:schedule',
    'view:pos',
    'view:analytics',
    'mark:attendance',
    'grade:evaluations',
    'view:own_dossier',
  ],
  'Coach': [
    'page:dashboard',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:partners',
    'action:attendance_mark',
    'action:evaluations_grade',
    'action:curriculum_edit',
    'manage:curriculum',
    'mark:attendance',
    'grade:evaluations',
    'view:own_dossier',
  ],
  'Assistant Coach': [
    'page:dashboard',
    'page:directory',
    'page:attendance',
    'page:schedule',
    'page:lms',
    'page:library',
    'page:partners',
    'action:attendance_mark',
    'mark:attendance',
    'view:own_dossier',
  ],
  'Student': [
    'page:lms',
    'page:library',
    'view:own_dossier',
  ],
};

/**
 * Checks if a given user/role has explicit permission key.
 * Resolution precedence:
 * 1. Root / Super Root: Always true (unconditional full access).
 * 2. User-specific discretionary override (`userId:permissionKey` in userOverrides) -> true or false.
 * 3. Dynamic role matrix override (`role:permissionKey` in dynamicOverrides) -> true or false.
 * 4. Factory baseline default from ROLE_PERMISSIONS[role].
 */
export function hasPermission(
  role: Role | undefined | null,
  permission: PermissionKey | string,
  dynamicOverrides?: Record<string, boolean>,
  userId?: string,
  userOverrides?: Record<string, boolean>
): boolean {
  if (!role) return false;
  // Root and Super Root always have full privileges
  if (role === 'Root' || role === 'Super Root') return true;

  // 1. Check user-specific discretionary override: "userId:permissionKey" (Highest Precedence)
  if (userId && userOverrides) {
    const userKey = `${userId}:${permission}`;
    if (typeof userOverrides[userKey] === 'boolean') {
      return userOverrides[userKey];
    }
  }

  // 2. Check custom dynamic matrix role override: "role:permissionKey"
  if (dynamicOverrides) {
    const overrideKey = `${role}:${permission}`;
    if (typeof dynamicOverrides[overrideKey] === 'boolean') {
      return dynamicOverrides[overrideKey];
    }
  }

  // 3. Fall back to static baseline role permissions
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission as PermissionKey);
}

