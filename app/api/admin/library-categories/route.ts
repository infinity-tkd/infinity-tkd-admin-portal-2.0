import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { libraryCategoryFromRow, libraryCategorySchema } from '@/lib/library-content';

export const dynamic = 'force-dynamic';
// Reads need page:library; changes need action:curriculum_edit (checked again in SQL).
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const revision = z.number().int().positive();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), category: libraryCategorySchema }).strict(),
  z.object({ action: z.literal('UPDATE'), id: z.string().uuid(), expectedRevision: revision, category: libraryCategorySchema }).strict(),
  z.object({ action: z.literal('DELETE'), id: z.string().uuid(), expectedRevision: revision }).strict(),
  z.object({ action: z.literal('REORDER'), order: z.array(z.string().uuid()).min(1).max(500) }).strict(),
]);

/** Library categories with how many lessons use each. */
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const signal = AbortSignal.timeout(15000);
    const [categories, assets] = await Promise.all([
      adminSupabase.from('library_categories').select('*').order('sort_order').order('title').limit(500).abortSignal(signal),
      adminSupabase.from('library_assets').select('category_id').not('category_id', 'is', null).limit(10000).abortSignal(signal),
    ]);
    if (categories.error) throw categories.error;
    if (assets.error) throw assets.error;
    const counts = new Map<string, number>();
    for (const row of assets.data ?? []) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    return NextResponse.json({ success: true, data: { categories: (categories.data ?? []).map(row => libraryCategoryFromRow({ ...row, lesson_count: counts.get(row.id) ?? 0 })) } }, { headers });
  } catch (error) { return operationsError(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    const payload = data.action === 'REORDER' ? { order: data.order }
      : data.action === 'DELETE' ? { expectedRevision: data.expectedRevision }
      : { ...data.category, ...(data.action === 'UPDATE' ? { expectedRevision: data.expectedRevision } : {}) };
    const result = await adminSupabase.rpc('portal_save_library_category', { p_actor: context.userId, p_action: data.action, p_id: 'id' in data ? data.id : null, p_payload: payload }).abortSignal(AbortSignal.timeout(15000));
    if (result.error) throw result.error;
    const saved = result.data && typeof result.data === 'object' && 'slug' in result.data ? libraryCategoryFromRow(result.data) : result.data;
    return NextResponse.json({ success: true, data: saved }, { headers });
  } catch (error) { return operationsError(error); }
}
