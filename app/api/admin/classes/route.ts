import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

// Strict Zod Schemas for Class Management
const CreateClassSchema = z
  .object({
    branchId: z.number().int().positive('branchId must be a positive integer'),
    name: z.string().min(1, 'Class name is required').max(100),
    daysOfWeek: z.array(z.string()).optional(),
    dayOfWeek: z.string().optional(),
    classType: z.string().max(50).optional(),
    coachId: z.string().uuid().nullable().optional(),
    standardDurationMins: z.number().int().min(15).max(360).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid start time format (HH:MM)'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid end time format (HH:MM)'),
    capacity: z.number().int().positive('Capacity must be greater than 0').max(500).optional(),
  })
  .strict()
  .refine(
    (val) => {
      const [sh, sm] = val.startTime.split(':').map(Number);
      const [eh, em] = val.endTime.split(':').map(Number);
      return eh * 60 + em > sh * 60 + sm;
    },
    {
      message: 'End time must be strictly after start time',
      path: ['endTime'],
    }
  );

const UpdateClassSchema = z
  .object({
    id: z.number().int().positive('id must be a positive integer'),
    data: z
      .object({
        name: z.string().min(1).max(100).optional(),
        daysOfWeek: z.array(z.string()).optional(),
        dayOfWeek: z.string().optional(),
        classType: z.string().max(50).optional(),
        coachId: z.string().uuid().nullable().optional(),
        standardDurationMins: z.number().int().min(15).max(360).optional(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).optional(),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).optional(),
        capacity: z.number().int().positive().max(500).optional(),
      })
      .strict()
      .refine(
        (val) => {
          if (val.startTime && val.endTime) {
            const [sh, sm] = val.startTime.split(':').map(Number);
            const [eh, em] = val.endTime.split(':').map(Number);
            return eh * 60 + em > sh * 60 + sm;
          }
          return true;
        },
        {
          message: 'End time must be strictly after start time',
          path: ['endTime'],
        }
      ),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const { errorResponse: authErr, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
      'Coach',
      'Assistant Coach',
    ]);
    if (authErr || !adminSupabase) return authErr!;

    const url = new URL(req.url);
    const branchIdParam = url.searchParams.get('branchId');

    let query = adminSupabase
      .from('class_sessions')
      .select('*')
      .order('start_time', { ascending: true });

    if (branchIdParam) {
      const branchId = parseInt(branchIdParam, 10);
      if (!isNaN(branchId) && branchId > 0) {
        query = query.eq('branch_id', branchId);
      }
    }

    const { data, error } = await query;
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(CreateClassSchema, req);
    if (valErr || !body) return valErr!;

    const days = body.daysOfWeek && body.daysOfWeek.length > 0 ? body.daysOfWeek : [body.dayOfWeek || 'Monday'];

    const { data, error } = await adminSupabase
      .from('class_sessions')
      .insert({
        branch_id: body.branchId,
        class_name: body.name,
        day_of_week: days[0],
        days_of_week: days,
        class_type: body.classType || 'General Class',
        coach_id: body.coachId || null,
        standard_duration_mins: body.standardDurationMins || 90,
        start_time: body.startTime,
        end_time: body.endTime,
        capacity: body.capacity || 30,
      })
      .select()
      .single();

    if (error) {
      return formatServerErrorResponse(error);
    }

    await logSecurityAuditEvent({
      action: 'CLASS_CREATED',
      performedBy: context.userId,
      targetId: String(data.id),
      details: { className: body.name, branchId: body.branchId },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data,
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateClassSchema, req);
    if (valErr || !body) return valErr!;

    const { id, data } = body;
    const payload: any = {};
    if (data.name !== undefined) payload.class_name = data.name;
    if (data.daysOfWeek !== undefined) {
      payload.days_of_week = data.daysOfWeek;
      payload.day_of_week = data.daysOfWeek[0] || 'Monday';
    } else if (data.dayOfWeek !== undefined) {
      payload.day_of_week = data.dayOfWeek;
      payload.days_of_week = [data.dayOfWeek];
    }
    if (data.classType !== undefined) payload.class_type = data.classType;
    if (data.coachId !== undefined) payload.coach_id = data.coachId;
    if (data.standardDurationMins !== undefined) payload.standard_duration_mins = data.standardDurationMins;
    if (data.startTime !== undefined) payload.start_time = data.startTime;
    if (data.endTime !== undefined) payload.end_time = data.endTime;
    if (data.capacity !== undefined) payload.capacity = data.capacity;

    const { error } = await adminSupabase.from('class_sessions').update(payload).eq('id', id);
    if (error) {
      return formatServerErrorResponse(error);
    }

    await logSecurityAuditEvent({
      action: 'CLASS_UPDATED',
      performedBy: context.userId,
      targetId: String(id),
      details: { updatedFields: Object.keys(payload) },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const url = new URL(req.url);
    const idParam = url.searchParams.get('id');

    if (!idParam) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MISSING_PARAM',
            message: 'Missing required query parameter: id',
          },
        },
        { status: 400 }
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_PARAM',
            message: 'Invalid id: must be a positive integer',
          },
        },
        { status: 422 }
      );
    }

    // First delete any associated enrollments so no orphan records remain
    await adminSupabase.from('class_enrollments').delete().eq('class_id', id);

    const { error } = await adminSupabase.from('class_sessions').delete().eq('id', id);
    if (error) {
      return formatServerErrorResponse(error);
    }

    await logSecurityAuditEvent({
      action: 'CLASS_DELETED',
      performedBy: context.userId,
      targetId: String(id),
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

const PatchClassSchema = z
  .object({
    id: z.number().int().positive('id must be a positive integer'),
    capacity: z.number().int().positive('Capacity must be greater than 0').max(500).optional(),
    coachId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(100).optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(PatchClassSchema, req);
    if (valErr || !body) return valErr!;

    const payload: any = {};
    if (body.capacity !== undefined) payload.capacity = body.capacity;
    if (body.coachId !== undefined) payload.coach_id = body.coachId;
    if (body.name !== undefined) payload.class_name = body.name;

    const { error } = await adminSupabase.from('class_sessions').update(payload).eq('id', body.id);
    if (error) {
      return formatServerErrorResponse(error);
    }

    await logSecurityAuditEvent({
      action: 'CLASS_UPDATED',
      performedBy: context.userId,
      targetId: String(body.id),
      details: { patchedFields: Object.keys(payload) },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id: body.id, ...payload },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

