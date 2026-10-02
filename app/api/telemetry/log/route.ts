import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkApiRateLimit, sanitizeString } from '@/lib/backend-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TelemetryPayloadSchema = z.object({
  message: z.string().max(300).optional(),
  stack: z.string().max(1000).optional(),
  route: z.string().max(100).optional(),
  component: z.string().max(100).optional(),
  userAgent: z.string().max(200).optional(),
  level: z.enum(['INFO', 'WARN', 'ERROR', 'FATAL']).optional(),
  type: z.string().max(50).optional(),
  missingUrl: z.string().max(200).optional(),
  referrer: z.string().max(200).optional(),
  timestamp: z.string().max(50).optional(),
}).strict();

/**
 * Client Crash & Runtime Telemetry Logging Route
 * Infinity Admin Portal
 *
 * Hardened with sliding-window rate limiting, strict length caps,
 * input sanitization against log injection, and zero recursion guarantee.
 */
export async function POST(req: Request) {
  try {
    // 1. Sliding Window Rate Limiting (20 reports/minute per IP)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimit = checkApiRateLimit(`telemetry:${ip}`, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)) } }
      );
    }

    // 2. Body Parsing & Strict Payload Validation
    const rawPayload = await req.json().catch(() => ({}));
    const parseResult = TelemetryPayloadSchema.safeParse(rawPayload);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid telemetry schema.' },
        { status: 400 }
      );
    }

    const val = parseResult.data;

    // 3. Input Sanitization against log injection
    const cleanMessage = sanitizeString(val.message || 'Unknown Client Runtime Error');
    const cleanStack = sanitizeString(val.stack || '').split('\n')[0];
    const cleanRoute = sanitizeString(val.route || '');
    const cleanComponent = sanitizeString(val.component || '');
    const cleanUserAgent = sanitizeString(val.userAgent || '');
    const cleanTimestamp = val.timestamp && !isNaN(Date.parse(val.timestamp))
      ? new Date(val.timestamp).toISOString()
      : new Date().toISOString();

    // 4. Server Console Log (Structured)
    console.warn('[CLIENT_TELEMETRY_LOG]', {
      timestamp: cleanTimestamp,
      message: cleanMessage,
      route: cleanRoute,
      component: cleanComponent,
      stack: cleanStack || 'N/A',
      ip,
    });

    // 5. Persist to Supabase audit_logs with system sentinel UUID
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      try {
        await adminClient.from('audit_logs').insert({
          action: 'CLIENT_CRASH_REPORTED',
          performed_by: '00000000-0000-0000-0000-000000000000',
          details: {
            message: cleanMessage,
            stack: cleanStack,
            route: cleanRoute,
            component: cleanComponent,
            userAgent: cleanUserAgent,
            ip,
            timestamp: cleanTimestamp,
          },
          status: 'FAILURE',
          created_at: cleanTimestamp,
        });
      } catch (dbErr: any) {
        console.warn('[CLIENT_TELEMETRY_DB_FALLBACK]', dbErr?.message || dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { logged: true },
      error: null,
    });
  } catch (err: any) {
    // Zero recursion guarantee
    console.error('[TELEMETRY_ROUTE_ABSORBED]', err?.message || err);
    return NextResponse.json({
      success: true,
      data: { logged: false, reason: 'absorbed' },
      error: null,
    });
  }
}
