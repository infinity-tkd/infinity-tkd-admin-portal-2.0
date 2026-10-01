import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Client Crash & Runtime Telemetry Logging Route
 * Infinity Admin Portal
 *
 * Guarantees zero crash recursion and logs runtime anomalies safely.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const {
      message = 'Unknown Client Runtime Error',
      stack = '',
      route = '',
      component = '',
      userAgent = '',
      timestamp = new Date().toISOString(),
    } = payload;

    // 1. Always log to server console for container log ingestion
    console.warn('[CLIENT_TELEMETRY_LOG]', {
      timestamp,
      message,
      route,
      component,
      stack: stack ? stack.split('\n')[0] : 'N/A',
    });

    // 2. Safely attempt to persist to Supabase audit_logs or error table if configured
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Insert into audit_logs table (which exists in the schema)
      try {
        await adminClient
          .from('audit_logs')
          .insert({
            action: 'CLIENT_CRASH_REPORTED',
            performed_by: '00000000-0000-0000-0000-000000000000', // Anonymous or system sentinel UUID
            details: {
              message,
              stack,
              route,
              component,
              userAgent,
              timestamp,
            },
            status: 'FAILURE',
            created_at: timestamp,
          });
      } catch (dbErr: any) {
        // Non-blocking log catch - never throw from telemetry
        console.warn('[CLIENT_TELEMETRY_DB_FALLBACK]', dbErr?.message || dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { logged: true },
      error: null,
    });
  } catch (err: any) {
    // Zero recursion guarantee - silently absorb
    console.error('[TELEMETRY_ROUTE_ABSORBED]', err?.message || err);
    return NextResponse.json({
      success: true,
      data: { logged: false, reason: 'absorbed' },
      error: null,
    });
  }
}
