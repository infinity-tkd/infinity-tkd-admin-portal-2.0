import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, formatServerErrorResponse } from '@/lib/backend-security';
import { libraryPublicationProjection, libraryCatalogSchema } from '@/lib/library-publication';

const asset = z.object({
  title: z.string().trim().min(1).max(150), description: z.string().max(100000), library_type: z.enum(['Fitness', 'Taekwondo']),
  tkd_category: z.string().max(50).nullable(), fitness_category: z.string().max(100).nullable(), target_level: z.string().trim().min(1).max(50),
  video_url: z.string().max(2000), muscleRelations: z.array(z.object({ muscleId: z.number().int().positive(), role: z.enum(['Primary', 'Secondary']) }).strict()).max(100).optional(),
}).strict().superRefine((value, context) => {
  try { libraryPublicationProjection(value); }
  catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Review the public lesson content.' }); }
});
const revision = z.number().int().positive();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), requestKey: z.string().uuid(), asset }).strict(),
  z.object({ action: z.literal('UPDATE'), id: z.number().int().positive(), expectedRevision: revision, asset }).strict(),
  z.object({ action: z.literal('DELETE'), id: z.number().int().positive(), expectedRevision: revision }).strict(),
  z.object({ action: z.literal('PUBLISH'), id: z.number().int().positive(), expectedRevision: revision, reason: z.string().trim().min(5).max(500) }).strict(),
  z.object({ action: z.literal('UNPUBLISH'), id: z.number().int().positive(), expectedRevision: revision, reason: z.string().trim().min(5).max(500) }).strict(),
]);
const querySchema = z.object({ search: z.string().trim().max(100).default(''), state: z.enum(['all', 'draft', 'published', 'changes', 'legacy']).default('all'), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict();
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status, headers });
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const params = new URL(req.url).searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) return fail('Review the library search and filters.', 422);
    const { search, state, limit, offset } = parsed.data;
    const result = await adminSupabase.rpc('portal_library_catalog', { p_actor: context.userId, p_search: search, p_state: state, p_limit: limit, p_offset: offset });
    if (result.error) return formatServerErrorResponse(result.error);
    const data = libraryCatalogSchema.safeParse(result.data);
    if (!data.success) throw new Error('The library catalog returned an invalid response.');
    return NextResponse.json({ success: true, data: data.data }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    let payload: Record<string, unknown>;
    if (data.action === 'CREATE' || data.action === 'UPDATE') {
      if (data.asset.muscleRelations && new Set(data.asset.muscleRelations.map(row => row.muscleId)).size !== data.asset.muscleRelations.length) return fail('Each muscle may be linked only once.', 422);
      payload = { ...data.asset, studentProjection: libraryPublicationProjection(data.asset), ...(data.action === 'UPDATE' ? { expectedRevision: data.expectedRevision } : {}) };
    } else if (data.action === 'PUBLISH') {
      const current = await adminSupabase.from('library_assets').select('description,video_url,library_type,target_level,tkd_category,fitness_category').eq('id', data.id).maybeSingle();
      if (current.error) return formatServerErrorResponse(current.error);
      if (!current.data) return fail('The library asset was not found.', 404);
      let projection;
      try { projection = libraryPublicationProjection(current.data); }
      catch (error) { return fail(error instanceof Error ? error.message : 'Review the public lesson content.', 422); }
      payload = { expectedRevision: data.expectedRevision, reason: data.reason, studentProjection: projection };
    } else payload = { expectedRevision: data.expectedRevision, ...(data.action === 'UNPUBLISH' ? { reason: data.reason } : {}) };
    const result = await adminSupabase.rpc('portal_save_library_asset', { p_actor: context.userId, p_action: data.action, p_id: data.action === 'CREATE' ? null : data.id, p_payload: payload, p_request_key: data.action === 'CREATE' ? data.requestKey : null });
    if (result.error) return formatServerErrorResponse(result.error);
    if (!result.data || (data.action === 'DELETE' ? !result.data.deleted : !result.data.asset)) throw new Error('Library save was not confirmed.');
    if (data.action !== 'DELETE' && (!Number.isSafeInteger(result.data.asset.student_curriculum_id) || result.data.studentLesson?.id !== result.data.asset.student_curriculum_id)) return formatServerErrorResponse({ code: 'PGRST202', message: 'Student lesson publication setup is incomplete.' });
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}
