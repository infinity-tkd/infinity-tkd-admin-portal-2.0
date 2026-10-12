import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const DeleteUserRequestSchema = z
  .object({
    id: z.string().min(1, 'Target user ID is required').max(50),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(DeleteUserRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { id } = body;

    // 1. Check self-deletion prevention
    if (context.userId === id) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN_SELF_DELETION',
            message: 'You cannot delete your own account from the admin portal.',
          },
        },
        { status: 400 }
      );
    }

    // 2. Fetch target profile to verify existence and role hierarchy
    const { data: targetProfile, error: fetchErr } = await adminSupabase
      .from('profiles')
      .select('id, display_name, email, role')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !targetProfile) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Target user account not found.',
          },
        },
        { status: 404 }
      );
    }

    // 3. Prevent non-Root admins from deleting Root or Super Root accounts
    if (
      (targetProfile.role === 'Root' || targetProfile.role === 'Super Root') &&
      context.role !== 'Root' &&
      context.role !== 'Super Root'
    ) {
      await logSecurityAuditEvent({
        action: 'PRIVILEGE_VIOLATION_BLOCKED',
        performedBy: context.userId,
        targetId: id,
        details: { attemptedAction: 'DELETE_ROOT_USER', targetRole: targetProfile.role },
        status: 'BLOCKED',
      });
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ROOT_DELETION',
            message: 'Forbidden: Only Root administrators can delete Root accounts.',
          },
        },
        { status: 403 }
      );
    }

    const {error:archiveError}=await adminSupabase.rpc('portal_archive_user',{p_actor:context.userId,p_target:id});
    if(archiveError)return formatServerErrorResponse(archiveError);

    // 6. Log Security Audit Event
    await logSecurityAuditEvent({
      action: 'USER_ARCHIVED',
      performedBy: context.userId,
      targetId: id,
      details: {
        displayName: targetProfile.display_name,
        email: targetProfile.email,
        role: targetProfile.role,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        displayName: targetProfile.display_name,
        email: targetProfile.email,
      },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
