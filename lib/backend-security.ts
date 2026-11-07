/**
 * Infinity TKD Central Backend & API Security Engine
 * Provides server-side authentication verification, RBAC authorization, BOLA/IDOR protection,
 * mass assignment prevention, Zod input validation, API rate limiting, and audit logging.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z, ZodType } from 'zod';
import { env } from './env';
import { needsAdministratorMfa } from './auth-assurance';
import { hasPermission, permissionDependencies, type PermissionKey } from './permissions';

function privateApiResponse(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Authorization, Cookie');
  return NextResponse.json(body, { ...init, headers });
}

function requestPermission(req: Request): PermissionKey | undefined {
  const path = new URL(req.url).pathname;
  if (path === '/api/admin/events' || path.startsWith('/api/admin/events/')) {
    if (req.method === 'GET') return 'page:calendar';
    if (path.endsWith('/publications') || path.endsWith('/archive')) return 'action:events_publish';
    if (path.endsWith('/notices')) return 'action:announcements_send';
    if (path.endsWith('/files')) return 'action:events_edit';
    return req.method === 'POST' ? 'action:events_create' : 'action:events_edit';
  }
  if (path === '/api/admin/library-assets/progress') return 'action:evaluations_grade';
  if (path === '/api/admin/library-assets') return 'action:curriculum_edit';
  if (path === '/api/admin/payments') return 'action:finance_record_payment';
  if (path === '/api/admin/households/payments') return 'action:finance_record_payment';
  if (path === '/api/admin/body-compositions') return 'action:student_edit';
  if (path === '/api/admin/achievements') return 'action:student_edit';
  if (path === '/api/admin/promotions/reconcile') return 'action:evaluations_grade';
  const read = req.method === 'GET';
  if (path === '/api/admin/branches/hours') return read ? 'page:settings' : 'action:staff_manage';
  if (path === '/api/belt-tests') return 'action:evaluations_grade';
  if (path.includes('/admin/staff-dan')) return read ? 'page:staff' : 'action:staff_manage';
  const actions: Record<string, PermissionKey> = {
    'create-student': 'action:student_create', 'update-student': 'action:student_edit',
    'delete-student': 'action:student_delete', 'delete-user': 'action:staff_manage', 'create-user':'action:staff_manage',
    'update-academy-profile': 'action:staff_manage',
  };
  const action = actions[path.split('/').pop() || ''];
  if (action) return action;
  if (path.includes('/admin/pos/products')) return read ? 'page:pos' : 'action:pos_manage_inventory';
  if (path.includes('/admin/pos/orders/cancel') || path.includes('/admin/pos/orders/refund')) return 'action:pos_cancel_order';
  if (path.includes('/admin/pos/orders')) return read ? 'page:pos' : 'action:pos_create_order';
  if (path.includes('/admin/classes')) return read ? 'page:schedule' : 'action:schedule_manage';
  if (path.includes('/admin/partners')) return read ? 'page:partners' : req.method === 'POST' ? 'action:partner_create' : req.method === 'DELETE' ? 'action:partner_delete' : 'action:partner_edit';
  return undefined;
}

export async function callerHasPermission(client: SupabaseClient, context: CallerSecurityContext, permission: string): Promise<boolean> {
  return callerHasAnyPermission(client, context, [permission]);
}

/** Resolve shared read purposes with one grant snapshot instead of one query pair per page. */
export async function callerHasAnyPermission(client: SupabaseClient, context: CallerSecurityContext, permissions: readonly string[]): Promise<boolean> {
  if (!permissions.length) return false;
  if (context.role === 'Root' || context.role === 'Super Root') return true;
  const dependencies = [...new Set(permissions.flatMap(permissionDependencies))];
  const [roleResult, userResult] = await Promise.all([
    client.from('role_permissions').select('permission_key,is_granted').eq('role', context.role).in('permission_key', dependencies),
    client.from('user_permissions').select('permission_key,is_granted').eq('user_id', context.userId).in('permission_key', dependencies),
  ]);
  if (roleResult.error || userResult.error) return false;
  const roleGrants = Object.fromEntries((roleResult.data ?? []).map(row => [`${context.role}:${row.permission_key}`, row.is_granted]));
  const userGrants = Object.fromEntries((userResult.data ?? []).map(row => [`${context.userId}:${row.permission_key}`, row.is_granted]));
  return permissions.some(permission => hasPermission(context.role, permission, roleGrants, context.userId, userGrants));
}

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
  if (apiRateLimitStore.size >= MAX_RATE_LIMIT_STORE_ENTRIES) {
    pruneExpiredRateLimits();
  }

  const record = apiRateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    if (!record && apiRateLimitStore.size >= MAX_RATE_LIMIT_STORE_ENTRIES) {
      return { allowed: false, remaining: 0, resetMs: windowMs };
    }
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
    const isLocalhost =
      originUrl.hostname === 'localhost' ||
      originUrl.hostname === '127.0.0.1' ||
      originUrl.hostname === '0.0.0.0';

    if (isLocalhost && process.env.NODE_ENV !== 'production') return true;
    return originUrl.host === host && (process.env.NODE_ENV !== 'production' || originUrl.protocol === 'https:');
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
      errorResponse: privateApiResponse(
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
    db: { retry: false },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token);
  if (authError || !user) {
    return {
      errorResponse: privateApiResponse(
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
      errorResponse: privateApiResponse(
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
    db: { retry: false },
    auth: { persistSession: false },
  });
  const { data: profile, error: profileErr } = await adminSupabase
    .from('profiles')
    .select('id, email, role, is_active, must_change_password')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    const setupIncomplete = profileErr?.code === '42703' || profileErr?.code === 'PGRST204';
    const unavailable = Boolean(profileErr && profileErr.code !== 'PGRST116');
    return {
      errorResponse: privateApiResponse(
        {
          success: false,
          data: null,
          error: {
            code: setupIncomplete ? 'AUTH_DATABASE_SETUP_REQUIRED' : unavailable ? 'AUTH_PROFILE_UNAVAILABLE' : 'AUTH_PROFILE_NOT_FOUND',
            message: setupIncomplete
              ? 'Account security setup is incomplete. Apply the profile security SQL repair in Supabase, then retry.'
              : unavailable ? 'Account verification is temporarily unavailable. Please retry.' : 'Forbidden: Security profile not found.',
          },
        },
        { status: unavailable ? 503 : 403, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  if (!['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Student'].includes(profile.role)) {
    return { errorResponse: privateApiResponse({success:false,error:{code:'AUTH_FORBIDDEN_ROLE',message:'Account role is not recognized. Contact an administrator.'}},{status:403}) };
  }
  if (!profile.is_active) {
    return {
      errorResponse: privateApiResponse(
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

  if(profile.must_change_password) {
    if(new URL(req.url).pathname !== '/api/admin/update-user') return {errorResponse:privateApiResponse({success:false,error:{message:'Change your temporary password before using the portal.'}},{status:403})};
    const { data:change, errorResponse:invalid }=await validateRequestBody(z.object({id:z.string().uuid(),data:z.object({password:z.string().min(12).max(256)}).strict()}).strict(),req.clone());
    if(invalid || change?.id!==profile.id)return {errorResponse:invalid || privateApiResponse({success:false,error:{message:'Change your own temporary password first.'}},{status:403})};
  }
  if(profile.role==='Student' && !allowedRoles.includes('Student'))return {errorResponse:privateApiResponse({success:false,error:{message:'Staff access required.'}},{status:403})};
  if(!profile.must_change_password && needsAdministratorMfa(profile.role, token)) {
    return {errorResponse:privateApiResponse({success:false,error:{code:'AUTH_MFA_REQUIRED',message:'Verify your authenticator code before using administrator functions.'}},{status:403,headers:{'Cache-Control':'no-store'}})};
  }

  const permission = requestPermission(req);
  const context: CallerSecurityContext = { userId: profile.id, email: profile.email, role: profile.role };
  const permitted = permission ? await callerHasPermission(adminSupabase, context, permission) : allowedRoles.length === 0 || allowedRoles.includes(profile.role);
  if (!permitted) {
    return {
      errorResponse: privateApiResponse(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ROLE',
            message: 'You do not have permission to perform this operation.',
          },
        },
        { status: 403 }
      ),
    };
  }

  if (!validateRequestOrigin(req)) return { errorResponse: privateApiResponse({ success:false, error:{message:'Request origin rejected.'} }, {status:403}) };
  const { data: slot, error: rateError } = await adminSupabase.rpc('portal_take_rate_slot', {
    p_key: `api:${profile.id}:${new URL(req.url).pathname}`, p_limit: req.method === 'GET' ? 180 : 120, p_seconds:60,
  });
  if (rateError || !slot) return {errorResponse:privateApiResponse({success:false,error:{message:rateError ? 'Service temporarily unavailable. Please retry.' : 'Too many requests. Please retry shortly.'}}, {status:rateError ? 503 : 429, headers:{'Retry-After':'60'}})};

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
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 1048576) return { errorResponse: privateApiResponse({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request exceeds 1 MB.' } }, { status: 413 }) };
    const reader = req.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1048576) { await reader.cancel(); return { errorResponse: privateApiResponse({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request exceeds 1 MB.' } }, { status: 413 }) }; }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    rawBody = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {
      errorResponse: privateApiResponse(
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
    const issues = result.error.issues.slice(0, 20).map(issue => ({
      field: issue.path.map(part => String(part).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64)).join('.') || 'Request',
      // Unknown keys and enum values may contain attacker-controlled text.
      message: issue.code === 'unrecognized_keys' ? 'Contains unsupported fields.'
        : issue.code === 'invalid_value' ? 'Select an allowed value.'
        : issue.code === 'invalid_type' ? 'Enter a value of the required type.'
        : issue.message.slice(0, 180),
    }));
    return {
      errorResponse: privateApiResponse(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid input. Please check the request fields.',
            issues,
            details: { fieldErrors: Object.fromEntries(issues.map(issue => [issue.field, [issue.message]])) },
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
      db: { retry: false },
      auth: { persistSession: false },
    });
    const { error } = await adminSupabase.from('audit_logs').insert({
      action: event.action,
      performed_by: event.performedBy,
      target_id: event.targetId || null,
      details: event.details || {},
      status: event.status,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
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
      : translated.code === 'PGRST116' || translated.code === 'P0002'
      ? 404
      : translated.code === 'AUTH_SESSION_EXPIRED' || translated.code === 'AUTH_UNAUTHORIZED'
      ? 401
      : ['23505','23503','40001','40P01'].includes(translated.code) ? 409
      : ['PGRST202','PGRST204','42P01','42703','NETWORK_OFFLINE'].includes(translated.code) ? 503
      : ['23502','23514','22023','22007','22008','22P02','P0001','VALIDATION_ERROR'].includes(translated.code) ? 400 : 500;

  return privateApiResponse(
    {
      success: false,
      data: null,
      error: {
        code: translated.code,
        message: process.env.NODE_ENV === 'production' && status >= 500
          ? 'The operation could not be completed. Please retry or contact an administrator.'
          : translated.userMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
    },
    { status }
  );
}
