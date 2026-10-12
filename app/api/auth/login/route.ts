import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { env } from '@/lib/env';
import { validateRequestBody, validateRequestOrigin, checkApiRateLimit } from '@/lib/backend-security';

const schema = z.object({ identifier: z.string().trim().min(1).max(150), password: z.string().min(1).max(256) }).strict();
export async function POST(req: Request) {
  const started = Date.now();
  const failure = async (status = 401, setupRequired = false) => {
    await new Promise(r => setTimeout(r, Math.max(0, 350 - (Date.now() - started))));
    const message = setupRequired ? 'Sign-in database setup is incomplete. The academy administrator must apply the login SQL repair.'
      : status === 503 ? 'The sign-in service is unavailable. Please contact the academy administrator.'
      : status === 429 ? 'Too many sign-in attempts. Please wait a minute and retry.'
      : 'Unable to sign in. Check your credentials or contact the academy.';
    return NextResponse.json({ success: false, error: { message, ...(setupRequired ? { code: 'AUTH_DATABASE_SETUP_REQUIRED' } : {}) } }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
  };
  if (!validateRequestOrigin(req)) return failure(403);
  const ip = process.env.TRUST_PROXY_HEADERS === 'true' ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown' : 'untrusted-origin';
  if (!checkApiRateLimit(`login:${ip}`, 15).allowed) return failure(429);
  const { data: body, errorResponse } = await validateRequestBody(schema, req);
  if (errorResponse || !body) return errorResponse!;
  try {
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { retry: false }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: slot, error: slotError } = await admin.rpc('portal_take_rate_slot', { p_key: `login:${ip}`, p_limit: 15, p_seconds: 60 });
    if (slotError) {
      // Codes only: never log identifiers, credentials or returned tokens.
      console.error('[Login] Database rate limiter unavailable:', slotError.code || 'unknown');
      return failure(503, slotError.code === 'PGRST202' || slotError.code === '42883');
    }
    if (!slot) return failure(429);
    let email = body.identifier.toLowerCase();
    if (!email.includes('@')) {
      if (!/^[a-z0-9._-]+$/.test(email)) return failure();
      const { data, error } = await admin.from('profiles').select('email').ilike('username', email.replace(/_/g, '\\_')).limit(2);
      if (error || data?.length !== 1) return failure();
      email = data[0].email;
    }
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { db: { retry: false }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: body.password });
    if (error || !data.session) return failure();
    const { data: profile, error: profileError } = await admin.from('profiles').select('role,is_active').eq('id', data.user.id).single();
    if (profileError || !profile?.is_active || !['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'].includes(profile.role)) {
      await client.auth.signOut({ scope: 'local' });
      return failure();
    }
    return NextResponse.json({ success: true, data: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(503); }
}
