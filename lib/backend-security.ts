/**
 * Infinity TKD Central Backend & API Security Engine
 * Provides server-side authentication verification, RBAC authorization, BOLA/IDOR protection,
 * mass assignment prevention, Zod input validation, API rate limiting, and audit logging.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z, ZodType } from 'zod';
import { env } from './env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

import { translateSupabaseError } from './errors/supabaseErrorTranslator';

// --- 1. Server-Side Rate Limiter ---
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const apiRateLimitStore = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_STORE_ENTRIES = 5000;

/**
 * Prunes expired rate limit records to prevent memory exhaustion
 */
function pruneExpiredRateLimits() {
  const now = Date.now();
  for (const [key, record] of apiRateLimitStore.entries()) {
    if (now > record.resetTime) {
      apiRateLimitStore.delete(key);
    }
  }
}

/**
 * Enforces sliding-window rate limiting on API endpoints per client IP / identifier.
 */
export function checkApiRateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();

  // Periodic eviction if store grows large
  if (apiRateLimitStore.size > MAX_RATE_LIMIT_STORE_ENTRIES) {
    pruneExpiredRateLimits();
  }

  const record = apiRateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    apiRateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetMs: record.resetTime - now };
  }

  record.count += 1;
  apiRateLimitStore.set(identifier, record);
  return { allowed: true, remaining: maxRequests - record.count, resetMs: record.resetTime - now };
}

/**
 * Validates request Origin and Host headers for state-mutating requests to mitigate CSRF
 */
export function validateRequestOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  if (!origin || !host) {
    // If no origin header (same-origin standard GET/direct), allow if sec-fetch-site is not cross-site
    const secFetchSite = req.headers.get('sec-fetch-site');
    return secFetchSite !== 'cross-site';
  }

  try {
    const originUrl = new URL(origin);
    const hostDomain = host.split(':')[0];
    const isLocalhost =
      originUrl.hostname === 'localhost' ||
      originUrl.hostname === '127.0.0.1' ||
      originUrl.hostname === '0.0.0.0';

    if (isLocalhost) return true;
    return originUrl.hostname === hostDomain;
  } catch {
    return false;
  }
}

// --- 2. Admin Auth & RBAC Caller Verification ---
export interface CallerSecurityContext {
  userId: string;
  email: string;
  role: 'Root' | 'Super Root' | 'Admin' | 'Head Coach' | 'Coach' | 'Assistant Coach' | 'Student';
}

/**
 * Validates the caller's JWT token and verifies their role in the profiles table.
 */
export async function verifyCaller(
  req: Request,
  allowedRoles: string[] = ['Root', 'Super Root', 'Admin']
): Promise<{
  errorResponse?: NextResponse;
  context?: CallerSecurityContext;
  adminSupabase?: SupabaseClient;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'Unauthorized: Missing or malformed Authorization header.',
          },
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await clientSupabase.auth.getUser(token);
  if (authError || !user) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_SESSION_EXPIRED',
            message: 'Unauthorized: Invalid or expired authentication token.',
          },
        },
        { status: 401 }
      ),
    };
  }

  if (!serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SERVER_CONFIG_ERROR',
            message: 'Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY missing.',
          },
        },
        { status: 500 }
      ),
    };
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: profile, error: profileErr } = await adminSupabase
    .from('profiles')
    .select('id, email, role, is_active')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_PROFILE_NOT_FOUND',
            message: 'Forbidden: Security profile not found.',
          },
        },
        { status: 403 }
      ),
    };
  }

  if (!profile.is_active) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_ACCOUNT_SUSPENDED',
            message: 'Forbidden: Account is suspended or inactive.',
          },
        },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ROLE',
            message: `Forbidden: Requires one of [${allowedRoles.join(', ')}] roles.`,
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    context: {
      userId: profile.id,
      email: profile.email,
      role: profile.role,
    },
    adminSupabase,
  };
}

// --- 3. Strict Zod Request Payload Validation ---

/**
 * Validates request JSON body against a strict Zod schema.
 * Rejects unmapped or malformed fields with HTTP 422 Unprocessable Entity.
 */
export async function validateRequestBody<T>(
  schema: ZodType<T>,
  req: Request
): Promise<{ data?: T; errorResponse?: NextResponse }> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (err: any) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MALFORMED_JSON',
            message: 'Malformed JSON payload in request body.',
          },
        },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Unprocessable Entity: Request payload validation failed.',
            details: result.error.flatten(),
          },
        },
        { status: 422 }
      ),
    };
  }

  return { data: result.data };
}

// --- 4. Input Sanitization & Mass Assignment Allowlisting ---

/**
 * Strips HTML tags and script injections from raw string values.
 */
export function sanitizeString(val: any): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Binds only allowlisted fields to prevent mass assignment vulnerabilities.
 */
export function filterAllowlistedFields<T extends Record<string, any>>(
  input: any,
  allowedKeys: (keyof T)[]
): Partial<T> {
  if (!input || typeof input !== 'object') return {};

  const cleanPayload: Partial<T> = {};
  for (const key of allowedKeys) {
    if (input[key] !== undefined) {
      if (typeof input[key] === 'string') {
        cleanPayload[key] = sanitizeString(input[key]) as any;
      } else {
        cleanPayload[key] = input[key];
      }
    }
  }
  return cleanPayload;
}

// --- 5. BOLA / IDOR Ownership Verification ---
/**
 * Verifies that the caller owns the resource or has administrative privileges.
 */
export function isOwnerOrAdmin(
  callerContext: CallerSecurityContext,
  resourceUserId: string
): boolean {
  if (
    callerContext.role === 'Root' ||
    callerContext.role === 'Super Root' ||
    callerContext.role === 'Admin'
  ) {
    return true;
  }
  return callerContext.userId === resourceUserId;
}

// --- 6. Security Audit Logging ---
export async function logSecurityAuditEvent(event: {
  action: string;
  performedBy: string;
  targetId?: string;
  details?: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
}) {
  if (!serviceRoleKey) return;

  try {
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    await adminSupabase.from('audit_logs').insert({
      action: event.action,
      performed_by: event.performedBy,
      target_id: event.targetId || null,
      details: event.details || {},
      status: event.status,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking log catch
    console.error('[AUDIT_LOG_ERROR]', err);
  }
}

// --- 7. Safe Server Error Response ---
export function formatServerErrorResponse(error: any): NextResponse {
  console.error('[SERVER_ERROR_TRACE]', error);
  const translated = translateSupabaseError(error);

  const status =
    translated.code === '42501' || translated.code === 'AUTH_FORBIDDEN'
      ? 403
      : translated.code === 'PGRST116'
      ? 404
      : translated.code === 'AUTH_SESSION_EXPIRED' || translated.code === 'AUTH_UNAUTHORIZED'
      ? 401
      : 400;

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: translated.code,
        message: translated.userMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
    },
    { status }
  );
}
