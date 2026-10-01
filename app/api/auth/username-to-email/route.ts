import { NextResponse } from 'next/server';
import dns from 'node:dns';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkApiRateLimit, sanitizeString, validateRequestBody } from '@/lib/backend-security';

// Force Node.js to resolve IPv4 addresses first on Windows
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if unsupported in environment
}

const UsernameLookupSchema = z
  .object({
    username: z
      .string()
      .min(1, 'Username is required')
      .max(50, 'Username too long')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username contains invalid characters'),
  })
  .strict();

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Protection (Anti-Brute Force / Enumeration)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimit = checkApiRateLimit(`auth-lookup:${ip}`, 20, 60000); // 20 attempts per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication lookup requests. Please try again later.',
          },
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)) } }
      );
    }

    // 2. Strict Zod Payload Validation
    const { data: body, errorResponse: valErr } = await validateRequestBody(UsernameLookupSchema, req);
    if (valErr || !body) return valErr!;

    const rawUsername = sanitizeString(body.username).trim();
    const normalizedInput = rawUsername.toLowerCase();
    const underscoreVersion = normalizedInput.replace(/-/g, '_');
    const dashVersion = normalizedInput.replace(/_/g, '-');
    const alphanumericOnly = normalizedInput.replace(/[^a-z0-9]/g, '');

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Fast-path: Try PostgreSQL Security Definer RPC first
    try {
      const { data: rpcEmail, error: rpcErr } = await adminSupabase.rpc('get_email_by_username', {
        target_username: rawUsername,
      });
      if (!rpcErr && rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
        return NextResponse.json({
          success: true,
          data: { email: rpcEmail },
          email: rpcEmail,
          error: null,
        });
      }
    } catch (e) {
      // Non-blocking fallback to queries
    }

    // 4. Query Profiles Table (by username or student_id)
    const { data: profileRows } = await adminSupabase
      .from('profiles')
      .select('email, username')
      .or(`username.ilike.${rawUsername},username.ilike.${underscoreVersion},username.ilike.${dashVersion}`)
      .limit(5);

    if (profileRows && profileRows.length > 0) {
      const match = profileRows.find((p) => {
        if (!p.email) return false;
        const u = (p.username || '').toLowerCase();
        return (
          u === normalizedInput ||
          u === underscoreVersion ||
          u === dashVersion ||
          u.replace(/[^a-z0-9]/g, '') === alphanumericOnly
        );
      }) || profileRows[0];

      if (match?.email) {
        return NextResponse.json({
          success: true,
          data: { email: match.email },
          email: match.email,
          error: null,
        });
      }
    }

    // 5. Query Students Table directly by Student ID (e.g., STU-F-001, STU-M-002)
    const { data: studentRows } = await adminSupabase
      .from('students')
      .select('id, email, profile_id')
      .or(`id.ilike.${rawUsername},id.ilike.${dashVersion},id.ilike.${underscoreVersion}`)
      .limit(3);

    if (studentRows && studentRows.length > 0) {
      const student = studentRows[0];

      // A. If student record is linked to a profile_id
      if (student.profile_id) {
        const { data: linkedProfile } = await adminSupabase
          .from('profiles')
          .select('email')
          .eq('id', student.profile_id)
          .maybeSingle();

        if (linkedProfile?.email) {
          return NextResponse.json({
            success: true,
            data: { email: linkedProfile.email },
            email: linkedProfile.email,
            error: null,
          });
        }
      }

      // B. If student has email recorded, find matching auth profile
      if (student.email) {
        const { data: profileByEmail } = await adminSupabase
          .from('profiles')
          .select('email')
          .ilike('email', student.email)
          .maybeSingle();

        if (profileByEmail?.email) {
          return NextResponse.json({
            success: true,
            data: { email: profileByEmail.email },
            email: profileByEmail.email,
            error: null,
          });
        }
      }

      // C. Student exists in roster, but portal account is not yet provisioned
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_NOT_ACTIVATED',
            message: `Portal account for Student ${student.id} is not yet activated. Please contact your academy administrator or coach to activate your login.`,
          },
        },
        { status: 404 }
      );
    }

    // 6. User not found anywhere
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Username or Student ID not found. Please verify your credentials or sign in using your registered email.',
        },
      },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'LOOKUP_TIMED_OUT',
          message: 'Account resolution timed out. Please sign in with your email address directly.',
        },
      },
      { status: 500 }
    );
  }
}
