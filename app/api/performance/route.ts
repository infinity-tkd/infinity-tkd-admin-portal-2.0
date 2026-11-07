import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { featureError } from '@/lib/operations-server';
const paths = ['/', '/dashboard', '/students', '/attendance', '/schedule', '/financials', '/pos', '/pro-shop', '/members', '/partners', '/settings', '/library', '/lms', '/operations', '/calendar', '/profile'];
const schema = z.object({ page: z.string().refine(path => paths.includes(path)), metric: z.enum(['LCP', 'INP', 'CLS']), value: z.number().min(0).max(600000), device: z.enum(['phone', 'tablet', 'desktop']), metricId: z.string().min(1).max(120) }).strict();
export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach']);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req); if (invalid || !data) return invalid!;
    if (data.metric === 'CLS' && data.value > 100) return NextResponse.json({ success: false, error: { message: 'Invalid metric value.' } }, { status: 422 });
    const { metricId, ...sample } = data;
    const metric_key = createHash('sha256').update(context.userId + ':' + metricId).digest('hex');
    const result = await adminSupabase.from('portal_performance_samples').upsert({ ...sample, metric_key }, { onConflict: 'metric_key', ignoreDuplicates: true });
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: { recorded: true } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return featureError(error); }
}
