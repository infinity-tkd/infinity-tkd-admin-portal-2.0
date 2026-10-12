import { NextResponse } from 'next/server';
import { academySettingsRequestSchema } from '@/lib/academy-settings';
import { 
  verifyCaller, 
  validateRequestBody, 
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';

export async function POST(req: Request) {
  try {
    // The shared guard applies the fresh staff-management permission matrix.
    const callerRes = await verifyCaller(req, ['Root', 'Super Root', 'Admin','Head Coach','Coach','Assistant Coach']);
    if (callerRes.errorResponse || !callerRes.context || !callerRes.adminSupabase) return callerRes.errorResponse!;
    const caller = callerRes.context!;

    // 2. Validate request payload with Zod
    const bodyRes = await validateRequestBody(academySettingsRequestSchema, req);
    if (bodyRes.errorResponse) return bodyRes.errorResponse;
    const { expectedUpdatedAt, ...data } = bodyRes.data!;
    if (!Object.keys(data).length) return NextResponse.json({ success: false, error: { message: "No settings changes supplied." } }, { status: 422 });

    // 3. Map camelCase payload to snake_case DB columns
    const dbPayload: Record<string, any> = {
      id: 'default',
      updated_by: caller.userId,
      updated_at: new Date().toISOString()
    };

    if (data.earlyGroupTuitionUsd !== undefined) dbPayload.early_group_tuition_usd = data.earlyGroupTuitionUsd;
    if (data.standardTuitionUsd !== undefined) dbPayload.standard_tuition_usd = data.standardTuitionUsd;
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
    const client = callerRes.adminSupabase;

    const write = expectedUpdatedAt
      ? client.from('academy_profile').update(dbPayload).eq('id', 'default').eq('updated_at', expectedUpdatedAt)
      : client.from('academy_profile').upsert(dbPayload, { onConflict: 'id' });
    const { data: updatedRecord, error: upsertError } = await write.select().maybeSingle();
    if (!upsertError && !updatedRecord) {
      return NextResponse.json({ success: false, error: { message: 'Academy settings changed since you opened them. Reload the latest settings and review your edits before saving.' } }, { status: 409 });
    }

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
