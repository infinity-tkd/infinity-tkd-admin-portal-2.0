import { supabase } from '@/lib/supabase';

export interface TranslatedError {
  userMessage: string;
  code: string;
  isAuthExpired: boolean;
  retryable: boolean;
  originalError?: unknown;
}

/**
 * Maps PostgreSQL and PostgREST error codes to human-readable UI messages.
 */
export function translateSupabaseError(error: any): TranslatedError {
  if (!error) {
    return {
      userMessage: 'An unknown error occurred.',
      code: 'UNKNOWN',
      isAuthExpired: false,
      retryable: false,
    };
  }

  const code: string = String(error.code || error.status || '').toUpperCase();
  const rawMsg: string = String(error.message || error.error_description || error.details || '');

  // 1. Session Expiration & Authentication
  if (
    code === '401' ||
    rawMsg.toLowerCase().includes('jwt expired') ||
    rawMsg.toLowerCase().includes('token expired') ||
    rawMsg.toLowerCase().includes('invalid claim') ||
    rawMsg.toLowerCase().includes('session not found')
  ) {
    return {
      userMessage: 'Your secure session has expired. Re-authenticating...',
      code: 'AUTH_SESSION_EXPIRED',
      isAuthExpired: true,
      retryable: true,
      originalError: error,
    };
  }

  // 2. PostgreSQL Unique Key Violations (duplicate ID, email, phone)
  if (code === '23505' || rawMsg.includes('duplicate key') || rawMsg.includes('already exists')) {
    if (rawMsg.includes('students_pkey') || rawMsg.includes('Key (id)=')) {
      return {
        userMessage: 'A student with this ID already exists. Please choose a unique identifier.',
        code: '23505',
        isAuthExpired: false,
        retryable: false,
        originalError: error,
      };
    }
    if (rawMsg.includes('email')) {
      return {
        userMessage: 'A user or student with this email address already exists.',
        code: '23505',
        isAuthExpired: false,
        retryable: false,
        originalError: error,
      };
    }
    return {
      userMessage: 'A record with this identifier or unique attribute already exists.',
      code: '23505',
      isAuthExpired: false,
      retryable: false,
      originalError: error,
    };
  }

  // 3. PostgreSQL Insufficient Privilege / RLS Policy Violations
  if (
    code === '42501' ||
    code === '403' ||
    rawMsg.includes('row-level security') ||
    rawMsg.includes('insufficient_privilege')
  ) {
    return {
      userMessage: 'Permission denied: Your account role lacks permission to modify or access this record.',
      code: '42501',
      isAuthExpired: false,
      retryable: false,
      originalError: error,
    };
  }

  // 4. PostgreSQL Foreign Key Violations
  if (code === '23503' || rawMsg.includes('foreign key constraint')) {
    return {
      userMessage: 'Cannot complete action: Dependent records or referenced entities exist.',
      code: '23503',
      isAuthExpired: false,
      retryable: false,
      originalError: error,
    };
  }

  // 5. PostgREST Single Row Fetch Failed (0 rows returned)
  if (code === 'PGRST116' || rawMsg.includes('JSON object requested, multiple (or no) rows returned')) {
    return {
      userMessage: 'The requested record was not found or has been removed.',
      code: 'PGRST116',
      isAuthExpired: false,
      retryable: true,
      originalError: error,
    };
  }

  // 6. PostgreSQL Invalid Text Representation / Data Type Mismatch
  if (code === '22P02' || rawMsg.includes('invalid input syntax')) {
    return {
      userMessage: 'Invalid input format provided for one or more fields.',
      code: '22P02',
      isAuthExpired: false,
      retryable: false,
      originalError: error,
    };
  }

  // 7. Transaction / Serialization Conflict
  if (code === '40001' || rawMsg.includes('could not serialize access')) {
    return {
      userMessage: 'Database concurrency conflict detected. Please retry.',
      code: '40001',
      isAuthExpired: false,
      retryable: true,
      originalError: error,
    };
  }

  // 8. Network Failure / Offline Connectivity
  if (
    code === 'NETWORK_ERROR' ||
    rawMsg.toLowerCase().includes('failed to fetch') ||
    rawMsg.toLowerCase().includes('network request failed') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return {
      userMessage: 'Network connection lost. Changes will sync once reconnected.',
      code: 'NETWORK_OFFLINE',
      isAuthExpired: false,
      retryable: true,
      originalError: error,
    };
  }

  // Default fallback
  return {
    userMessage: rawMsg || 'An unexpected database error occurred. Please try again.',
    code: code || 'DATABASE_ERROR',
    isAuthExpired: false,
    retryable: true,
    originalError: error,
  };
}

/**
 * Automatically intercepts expired sessions, attempts background token refresh,
 * and if unrecoverable, redirects to login while preserving return path.
 */
export async function handleSessionExpiryRecovery(currentPath?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (data?.session && !error) {
      console.info('[AUTH_RECOVERY] Background session refresh succeeded.');
      return true;
    }
  } catch (refreshErr) {
    console.warn('[AUTH_RECOVERY] Token refresh failed:', refreshErr);
  }

  // If refresh failed, redirect to login preserving return route
  if (typeof window !== 'undefined') {
    const returnPath = currentPath || window.location.pathname;
    try {
      sessionStorage.setItem('infinity_return_route', returnPath);
    } catch {
      // Ignore storage errors
    }
    window.location.href = `/?session_expired=true&return_to=${encodeURIComponent(returnPath)}`;
  }

  return false;
}
