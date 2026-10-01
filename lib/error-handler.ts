/**
 * INFINITY TKD - UNIFIED AUTO ERROR HANDLING ENGINE
 * 
 * Provides automated error parsing, normalization, human-friendly translation,
 * and categorization across Supabase, Next.js API Routes, PostgreSQL constraints,
 * network failures, and client-side exceptions.
 */

export interface NormalizedError {
  title: string;
  message: string;
  code: string;
  details?: string;
  severity: 'error' | 'warning' | 'info';
  isOperational: boolean; // Operational errors are expected business validation failures (e.g. duplicate email)
  timestamp: number;
}

/**
 * Extracts a clean string representation from unknown error inputs
 */
function extractRawMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const record = err as Record<string, any>;
    if (record.message && typeof record.message === 'string') return record.message;
    if (record.error) {
      if (typeof record.error === 'string') return record.error;
      if (typeof record.error === 'object' && record.error.message) return record.error.message;
    }
    if (record.msg && typeof record.msg === 'string') return record.msg;
    if (record.error_description && typeof record.error_description === 'string') return record.error_description;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * Normalizes any unknown runtime or API error into a structured, human-readable format.
 */
export function normalizeError(
  err: unknown,
  fallbackTitle = 'System Error',
  fallbackMessage = 'An unexpected error occurred while processing your request.'
): NormalizedError {
  const rawMsg = extractRawMessage(err);
  const rawLower = rawMsg.toLowerCase();
  const timestamp = Date.now();

  // 1. DUPLICATE ACCOUNT / USER CONFLICT
  // Pattern: "A user with email "..." is already registered with role "...""
  const duplicateEmailRoleMatch = rawMsg.match(/A user with email "([^"]+)" is already registered with role "([^"]+)"/i);
  if (duplicateEmailRoleMatch) {
    const [, email, role] = duplicateEmailRoleMatch;
    return {
      title: 'Account Conflict: Existing Email',
      message: `An account for "${email}" is already registered in the system with the role "${role}".\n\nTo prevent duplicate account conflicts, please use a different email or link this profile to their existing account.`,
      code: 'DUPLICATE_ACCOUNT_EMAIL',
      details: rawMsg,
      severity: 'error',
      isOperational: true,
      timestamp,
    };
  }

  // Pattern: "User already registered" / "Email already registered" / "Username already taken"
  if (
    rawLower.includes('already registered') ||
    rawLower.includes('already exists') ||
    rawLower.includes('email is already in use') ||
    rawLower.includes('username is already in use') ||
    rawLower.includes('duplicate key value')
  ) {
    let cleanMsg = 'A record with this identifier (email, username, or ID) already exists in the system.';
    if (rawLower.includes('username')) {
      cleanMsg = 'This username is already claimed. Please choose a different unique username.';
    } else if (rawLower.includes('email')) {
      cleanMsg = 'This email address is already linked to another account. Please verify or use another email.';
    } else if (rawLower.includes('student')) {
      cleanMsg = 'A student with this ID or enrollment record already exists.';
    }

    return {
      title: 'Duplicate Entry Conflict',
      message: cleanMsg,
      code: 'DUPLICATE_ENTRY',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 2. SUPABASE POSTGRES SCHEMA CACHE / COLUMN ERRORS
  // Pattern: "Could not find the '...' column of '...' in the schema cache"
  const schemaCacheMatch = rawMsg.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
  if (schemaCacheMatch) {
    const [, column, table] = schemaCacheMatch;
    return {
      title: 'Database Schema Sync Notice',
      message: `The system detected that the column "${column}" on table "${table}" is pending synchronization in the schema cache.\n\nPlease reload the page to refresh the schema cache, or verify the database migration status.`,
      code: 'SCHEMA_CACHE_MISMATCH',
      details: rawMsg,
      severity: 'error',
      isOperational: true,
      timestamp,
    };
  }

  // 3. ROW-LEVEL SECURITY / PERMISSIONS / AUTH FORBIDDEN
  if (
    rawLower.includes('row-level security') ||
    rawLower.includes('permission denied') ||
    rawLower.includes('unauthorized access') ||
    rawLower.includes('insufficient permissions') ||
    rawLower.includes('unauthorized') ||
    rawLower.includes('forbidden') ||
    rawLower.includes('403')
  ) {
    return {
      title: 'Permission Denied',
      message: 'Your current system role does not have authorization to perform this operation. Please contact a Root or Head Administrator if you require access.',
      code: 'AUTH_FORBIDDEN',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 4. SESSION TIMEOUT / JWT EXPIRED
  if (
    rawLower.includes('jwt expired') ||
    rawLower.includes('token expired') ||
    rawLower.includes('invalid refresh token') ||
    rawLower.includes('session expired') ||
    rawLower.includes('auth session missing')
  ) {
    return {
      title: 'Session Expired',
      message: 'Your secure login session has expired. Please sign in again to continue your work.',
      code: 'SESSION_EXPIRED',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 5. FOREIGN KEY CONSTRAINTS / LINKED RECORD NOT FOUND
  if (rawLower.includes('violates foreign key constraint') || rawLower.includes('foreign key')) {
    return {
      title: 'Associated Record Missing',
      message: 'This record cannot be saved or deleted because it is tied to other active data (such as class sessions, branches, or student profiles).',
      code: 'FOREIGN_KEY_VIOLATION',
      details: rawMsg,
      severity: 'error',
      isOperational: true,
      timestamp,
    };
  }

  // 6. NETWORK / OFFLINE / TIMEOUT
  if (
    rawLower.includes('failed to fetch') ||
    rawLower.includes('network error') ||
    rawLower.includes('networkrequestfailed') ||
    rawLower.includes('abort') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return {
      title: 'Network Connection Lost',
      message: 'Unable to reach the server. Your actions are safely preserved locally and will sync once connection is restored.',
      code: 'NETWORK_OFFLINE',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 7. RATE LIMITING (HTTP 429)
  if (rawLower.includes('rate limit') || rawLower.includes('too many requests') || rawLower.includes('429')) {
    return {
      title: 'Rate Limit Reached',
      message: 'Too many requests were sent in a short interval. Please wait a moment before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 8. CAPACITY LIMITS / CLASS FULL
  if (rawLower.includes('capacity') || rawLower.includes('full capacity')) {
    return {
      title: 'Class Capacity Reached',
      message: rawMsg,
      code: 'CAPACITY_LIMIT',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 9. GENERAL VALIDATION / FORM ERRORS
  if (rawLower.includes('validation') || rawLower.includes('required') || rawLower.includes('invalid')) {
    return {
      title: 'Input Validation Notice',
      message: rawMsg.length < 250 ? rawMsg : fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: rawMsg,
      severity: 'warning',
      isOperational: true,
      timestamp,
    };
  }

  // 10. DEFAULT / GENERIC ERROR
  return {
    title: fallbackTitle,
    message: rawMsg && rawMsg.length < 300 ? rawMsg : fallbackMessage,
    code: 'UNKNOWN_SYSTEM_ERROR',
    details: rawMsg !== fallbackMessage ? rawMsg : undefined,
    severity: 'error',
    isOperational: false,
    timestamp,
  };
}
