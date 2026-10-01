import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  verifyCaller, 
  validateRequestBody, 
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const AcademyProfileUpdateSchema = z.object({
  academyName: z.string().min(1, 'Academy name is required').max(255).optional(),
  legalName: z.string().max(255).optional().nullable(),
  tagline: z.string().max(255).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  websiteUrl: z.string().url('Invalid website URL').or(z.literal('')).optional().nullable(),
  portalUrl: z.string().url('Invalid portal URL').or(z.literal('')).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  supportEmail: z.string().email('Invalid support email address').or(z.literal('')).optional().nullable(),
  primaryAddress: z.string().max(500).optional().nullable(),
  defaultBranchId: z.union([z.number().int().positive(), z.literal('all')]).optional().nullable(),
  currency: z.enum(['USD', 'KHR']).optional(),
  currencySymbol: z.string().max(10).optional(),
  tuitionGracePeriodDays: z.number().int().min(0).max(60).optional(),
  taxRatePercentage: z.number().min(0).max(100).optional(),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']).optional(),
  defaultClassDurationMins: z.number().int().min(15).max(360).optional(),
  examPassingScore: z.number().int().min(50).max(100).optional(),
  minAttendanceExamPct: z.number().int().min(0).max(100).optional(),
  allowStudentPortalLogin: z.boolean().optional(),
  enableAudioChimes: z.boolean().optional(),
  facebookUrl: z.string().url().or(z.literal('')).optional().nullable(),
  telegramChannel: z.string().url().or(z.literal('')).optional().nullable(),
  instagramUrl: z.string().url().or(z.literal('')).optional().nullable(),
}).strict();

export async function POST(req: Request) {
  try {
    // 1. Verify caller with RBAC (only Root, Super Root, Admin can alter Academy Profile)
    const callerRes = await verifyCaller(req, ['Root', 'Super Root', 'Admin']);
    if (callerRes.errorResponse) return callerRes.errorResponse;
    const caller = callerRes.context!;

    // 2. Validate request payload with Zod
    const bodyRes = await validateRequestBody(AcademyProfileUpdateSchema, req);
    if (bodyRes.errorResponse) return bodyRes.errorResponse;
    const data = bodyRes.data!;

    // 3. Map camelCase payload to snake_case DB columns
    const dbPayload: Record<string, any> = {
      id: 'default',
      updated_by: caller.userId,
      updated_at: new Date().toISOString()
    };

    if (data.academyName !== undefined) dbPayload.academy_name = sanitizeString(data.academyName);
    if (data.legalName !== undefined) dbPayload.legal_name = sanitizeString(data.legalName || '');
    if (data.tagline !== undefined) dbPayload.tagline = sanitizeString(data.tagline || '');
    if (data.logoUrl !== undefined) dbPayload.logo_url = data.logoUrl;
    if (data.websiteUrl !== undefined) dbPayload.website_url = data.websiteUrl;
    if (data.portalUrl !== undefined) dbPayload.portal_url = data.portalUrl;
    if (data.taxId !== undefined) dbPayload.tax_id = sanitizeString(data.taxId || '');
    if (data.contactPhone !== undefined) dbPayload.contact_phone = sanitizeString(data.contactPhone || '');
    if (data.supportEmail !== undefined) dbPayload.support_email = data.supportEmail;
    if (data.primaryAddress !== undefined) dbPayload.primary_address = sanitizeString(data.primaryAddress || '');
    if (data.defaultBranchId !== undefined) {
      dbPayload.default_branch_id = data.defaultBranchId === 'all' || !data.defaultBranchId ? null : data.defaultBranchId;
    }
    if (data.currency !== undefined) {
      dbPayload.currency = data.currency;
      dbPayload.currency_symbol = data.currency === 'USD' ? '$' : '៛';
    }
    if (data.currencySymbol !== undefined) dbPayload.currency_symbol = data.currencySymbol;
    if (data.tuitionGracePeriodDays !== undefined) dbPayload.tuition_grace_period_days = data.tuitionGracePeriodDays;
    if (data.taxRatePercentage !== undefined) dbPayload.tax_rate_percentage = data.taxRatePercentage;
    if (data.dateFormat !== undefined) dbPayload.date_format = data.dateFormat;
    if (data.defaultClassDurationMins !== undefined) dbPayload.default_class_duration_mins = data.defaultClassDurationMins;
    if (data.examPassingScore !== undefined) dbPayload.exam_passing_score = data.examPassingScore;
    if (data.minAttendanceExamPct !== undefined) dbPayload.min_attendance_exam_pct = data.minAttendanceExamPct;
    if (data.allowStudentPortalLogin !== undefined) dbPayload.allow_student_portal_login = data.allowStudentPortalLogin;
    if (data.enableAudioChimes !== undefined) dbPayload.enable_audio_chimes = data.enableAudioChimes;
    if (data.facebookUrl !== undefined) dbPayload.facebook_url = data.facebookUrl;
    if (data.telegramChannel !== undefined) dbPayload.telegram_channel = data.telegramChannel;
    if (data.instagramUrl !== undefined) dbPayload.instagram_url = data.instagramUrl;

    // 4. Upsert using service role client for privileged database write
    const client = serviceRoleKey 
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : createClient(supabaseUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: updatedRecord, error: upsertError } = await client
      .from('academy_profile')
      .upsert(dbPayload, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      console.error('[API /api/admin/update-academy-profile] Upsert error:', upsertError);
      return formatServerErrorResponse(upsertError);
    }

    // 5. Log Security Audit Event
    await logSecurityAuditEvent({
      action: 'UPDATE_ACADEMY_PROFILE',
      performedBy: caller.email,
      targetId: 'default',
      status: 'SUCCESS',
      details: {
        updatedFields: Object.keys(data),
        academyName: updatedRecord?.academy_name,
        currency: updatedRecord?.currency,
        updatedAt: updatedRecord?.updated_at
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Academy profile updated successfully.'
    });
  } catch (err: any) {
    if (err instanceof NextResponse) {
      return err;
    }
    console.error('[API /api/admin/update-academy-profile] Exception:', err);
    return formatServerErrorResponse(err);
  }
}
