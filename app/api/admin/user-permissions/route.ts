import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  verifyCaller, 
  validateRequestBody, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SingleUserPermissionUpdateSchema = z.object({
  permissionKey: z.string().min(1).max(100),
  isGranted: z.boolean().nullable(), // null indicates reset / inherit from role
}).strict();

const BatchUpdateUserPermissionsSchema = z.object({
  userId: z.string().uuid(),
  updates: z.array(SingleUserPermissionUpdateSchema).min(1),
}).strict();

/**
 * GET /api/admin/user-permissions
 * Returns user-specific permission overrides.
 * Query param: ?userId=... (optional)
 */
export async function GET(req: Request) {
  try {
    const callerRes = await verifyCaller(req, [
      'Root', 
      'Super Root', 
      'Admin', 
      'Head Coach', 
      'Coach', 
      'Assistant Coach', 
      'Student'
    ]);
    if (callerRes.errorResponse) return callerRes.errorResponse;

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    let query = adminSupabase
      .from('user_permissions')
      .select('user_id, permission_key, is_granted, updated_at');

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not be migrated yet; return empty list gracefully
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * POST /api/admin/user-permissions
 * Strictly reserved for Root & Super Root to set or clear user-level permission overrides.
 */
export async function POST(req: Request) {
  try {
    // 1. Strictly authenticate caller as System Owner (Root / Super Root)
    const callerRes = await verifyCaller(req, ['Root', 'Super Root']);
    if (callerRes.errorResponse) return callerRes.errorResponse;
    const caller = callerRes.context!;

    // 2. Validate request body
    const bodyRes = await validateRequestBody(BatchUpdateUserPermissionsSchema, req);
    if (bodyRes.errorResponse) return bodyRes.errorResponse;
    const { userId, updates } = bodyRes.data!;

    // 3. Separate upserts (isGranted is true/false) vs deletes (isGranted is null)
    const upserts = updates
      .filter(u => u.isGranted !== null)
      .map(u => ({
        user_id: userId,
        permission_key: u.permissionKey,
        is_granted: u.isGranted as boolean,
        updated_at: new Date().toISOString(),
        updated_by: caller.userId,
      }));

    const keysToDelete = updates
      .filter(u => u.isGranted === null)
      .map(u => u.permissionKey);

    // Execute upserts if any
    if (upserts.length > 0) {
      const { error: upsertError } = await adminSupabase
        .from('user_permissions')
        .upsert(upserts, { onConflict: 'user_id,permission_key' });

      if (upsertError) {
        return formatServerErrorResponse(upsertError);
      }
    }

    // Execute deletions if any (reverting to role default)
    if (keysToDelete.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .in('permission_key', keysToDelete);

      if (deleteError) {
        return formatServerErrorResponse(deleteError);
      }
    }

    // 4. Log immutable security audit event
    await logSecurityAuditEvent({
      action: 'UPDATE_USER_PERMISSIONS_OVERRIDE',
      performedBy: caller.email,
      targetId: `user_permissions:${userId}`,
      status: 'SUCCESS',
      details: {
        targetUserId: userId,
        updatedBy: caller.userId,
        upsertedCount: upserts.length,
        revertedCount: keysToDelete.length,
        modifiedKeys: updates.map(u => ({ key: u.permissionKey, state: u.isGranted })),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId,
        upsertedCount: upserts.length,
        revertedCount: keysToDelete.length,
      },
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
