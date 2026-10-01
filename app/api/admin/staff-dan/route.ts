import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  verifyCaller, 
  validateRequestBody, 
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';

const AddDanRecordSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  danLevel: z.number().int().min(1).max(9),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD'),
  certificateNo: z.string().max(50).optional().nullable(),
  certificateUrl: z.string().max(500).optional().nullable(),
  examinerName: z.string().max(100).optional().nullable(),
  location: z.string().max(150).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

const UpdateDanRecordSchema = z.object({
  id: z.string().uuid('Invalid record UUID'),
  danLevel: z.number().int().min(1).max(9).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD').optional(),
  certificateNo: z.string().max(50).optional().nullable(),
  certificateUrl: z.string().max(500).optional().nullable(),
  examinerName: z.string().max(100).optional().nullable(),
  location: z.string().max(150).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

/**
 * GET: Fetch Dan promotion history for a staff member
 */
export async function GET(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get('userId') || context.userId;

    // Coaches can only inspect their own record unless they hold an Admin/Root role
    const isPrivileged = ['Root', 'Super Root', 'Admin', 'Head Coach'].includes(context.role);
    if (!isPrivileged && targetUserId !== context.userId) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'You can only view your own Dan records.' } },
        { status: 403 }
      );
    }

    const { data: records, error } = await adminSupabase
      .from('staff_dan_history')
      .select('*')
      .eq('user_id', targetUserId)
      .order('dan_level', { ascending: true });

    if (error) return formatServerErrorResponse(error);

    return NextResponse.json({ success: true, data: records || [] });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * POST: Create a new Dan promotion entry
 */
export async function POST(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(AddDanRecordSchema, req);
    if (valErr || !body) return valErr!;

    const payload = {
      user_id: body.userId,
      dan_level: body.danLevel,
      issue_date: body.issueDate,
      certificate_no: body.certificateNo ? sanitizeString(body.certificateNo) : null,
      certificate_url: body.certificateUrl ? sanitizeString(body.certificateUrl) : null,
      examiner_name: body.examinerName ? sanitizeString(body.examinerName) : null,
      location: body.location ? sanitizeString(body.location) : 'Infinity Taekwondo Academy',
      notes: body.notes ? sanitizeString(body.notes) : null
    };

    const { data: inserted, error } = await adminSupabase
      .from('staff_dan_history')
      .insert(payload)
      .select()
      .single();

    if (error) return formatServerErrorResponse(error);

    await logSecurityAuditEvent({
      action: 'STAFF_DAN_RECORD_CREATED',
      performedBy: context.userId,
      targetId: body.userId,
      details: { danLevel: body.danLevel, issueDate: body.issueDate, certNo: body.certificateNo },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data: inserted });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * PUT: Update an existing Dan promotion entry
 */
export async function PUT(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateDanRecordSchema, req);
    if (valErr || !body) return valErr!;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (body.danLevel !== undefined) updates.dan_level = body.danLevel;
    if (body.issueDate !== undefined) updates.issue_date = body.issueDate;
    if (body.certificateNo !== undefined) updates.certificate_no = body.certificateNo ? sanitizeString(body.certificateNo) : null;
    if (body.certificateUrl !== undefined) updates.certificate_url = body.certificateUrl ? sanitizeString(body.certificateUrl) : null;
    if (body.examinerName !== undefined) updates.examiner_name = body.examinerName ? sanitizeString(body.examinerName) : null;
    if (body.location !== undefined) updates.location = body.location ? sanitizeString(body.location) : null;
    if (body.notes !== undefined) updates.notes = body.notes ? sanitizeString(body.notes) : null;

    const { data: updated, error } = await adminSupabase
      .from('staff_dan_history')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) return formatServerErrorResponse(error);

    await logSecurityAuditEvent({
      action: 'STAFF_DAN_RECORD_UPDATED',
      performedBy: context.userId,
      targetId: updated?.user_id,
      details: { id: body.id, updates },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * DELETE: Delete a Dan promotion entry
 */
export async function DELETE(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Missing record id' } },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase
      .from('staff_dan_history')
      .delete()
      .eq('id', id);

    if (error) return formatServerErrorResponse(error);

    await logSecurityAuditEvent({
      action: 'STAFF_DAN_RECORD_DELETED',
      performedBy: context.userId,
      details: { id },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}
