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

const UpdateSinglePermissionSchema = z.object({
  role: z.enum(['Admin', 'Head Coach', 'Coach', 'Assistant Coach', 'Student']),
  permissionKey: z.string().min(1).max(100),
  isGranted: z.boolean(),
}).strict();

const BatchUpdatePermissionsSchema = z.object({
  permissions: z.array(UpdateSinglePermissionSchema).min(1),
}).strict();

/**
 * GET /api/admin/permissions
 * Returns all current custom role permissions from public.role_permissions
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

    const { data, error } = await adminSupabase
      .from('role_permissions')
      .select('role, permission_key, is_granted, updated_at');

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
 * POST /api/admin/permissions
 * Strictly reserved for Root & Super Root to update role permissions dynamically.
 */
export async function POST(req: Request) {
  try {
    // 1. Strictly authenticate caller as System Owner (Root / Super Root)
    const callerRes = await verifyCaller(req, ['Root', 'Super Root']);
    if (callerRes.errorResponse) return callerRes.errorResponse;
    const caller = callerRes.context!;

    // 2. Validate request body
    const bodyRes = await validateRequestBody(BatchUpdatePermissionsSchema, req);
    if (bodyRes.errorResponse) return bodyRes.errorResponse;
    const { permissions } = bodyRes.data!;

    // 3. Upsert permissions into public.role_permissions
    const payload = permissions.map(p => ({
      role: p.role,
      permission_key: p.permissionKey,
      is_granted: p.isGranted,
      updated_at: new Date().toISOString(),
      updated_by: caller.userId,
    }));

    const { error: upsertError } = await adminSupabase
      .from('role_permissions')
      .upsert(payload, { onConflict: 'role,permission_key' });

    if (upsertError) {
      return formatServerErrorResponse(upsertError);
    }

    // 4. Log immutable security audit event
    await logSecurityAuditEvent({
      action: 'UPDATE_ROLE_PERMISSIONS_MATRIX',
      performedBy: caller.email,
      targetId: 'role_permissions',
      details: {
        updatedBy: caller.userId,
        itemsCount: permissions.length,
        updates: permissions,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      message: 'Role permissions matrix updated successfully.',
      data: payload,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
