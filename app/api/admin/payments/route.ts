import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, formatServerErrorResponse } from '@/lib/backend-security';

const schema = z.object({
  studentId: z.string().min(1).max(20), requestKey: z.string().uuid(),
  method: z.enum(['Cash','Bank Transfer','Credit Card','ABA Bank KHQR','Waived']),
  entries: z.array(z.object({ year: z.number().int().min(2000).max(2200),
    month: z.enum(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']),
    amount: z.number().min(0).max(100000).refine(n => Math.abs(n*100-Math.round(n*100)) < 0.00001, 'Use two decimal places'),
  }).strict()).min(1).max(24),
}).strict();

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, ['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    if (new Set(data.entries.map(e => `${e.year}-${e.month}`)).size !== data.entries.length)
      return NextResponse.json({ success:false, error:{message:'Duplicate billing month in payment request.'} }, {status:400});
    const { data: result, error } = await adminSupabase.rpc('portal_record_payments', {
      p_actor:context.userId, p_student_id:data.studentId, p_entries:data.entries,
      p_method:data.method, p_request_key:data.requestKey,
    });
    if (error) return formatServerErrorResponse(error);
    return NextResponse.json({success:true,data:result}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) { return formatServerErrorResponse(error); }
}
