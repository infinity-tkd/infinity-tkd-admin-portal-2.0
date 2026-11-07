import { NextResponse } from 'next/server';
import { verifyCaller, callerHasAnyPermission, callerHasPermission, validateRequestBody, formatServerErrorResponse } from '@/lib/backend-security';
import { managedWorkout, workoutCommandSchema, workoutDraftPayload } from '@/lib/workout-authoring';
import { domainCursor, readDomainCursor } from '@/lib/domain-cursor';
import { catalogParams, catalogQuerySchema, catalogSearch } from '@/lib/student-catalog-contract';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie', 'X-Portal-Contract': 'academy-workouts-v1' };
function failure(error: unknown) {
  const response = formatServerErrorResponse(error);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
export async function GET(req: Request) {
  try {
    const access = await verifyCaller(req, roles);
    if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    const db = access.adminSupabase;
    if (!await callerHasAnyPermission(db, access.context, ['page:library', 'page:lms', 'page:directory'])) return NextResponse.json({ success: false, error: { message: 'Routine access is not enabled.' } }, { status: 403, headers });
    const {limit,cursor,q}=catalogParams(req,catalogQuerySchema.omit({category:true}));
    const scope=JSON.stringify(['academy-workouts-v1',access.context.userId,q,limit]);
    const after=readDomainCursor(cursor,scope);
    if(after&&!z.string().uuid().safeParse(after).success)return NextResponse.json({success:false,error:{message:'Reload the routine catalog.'}},{status:409,headers});
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(20000)]);
    let query=db.from('portal_workout_management').select('id,title,description,difficulty,duration_mins,creator_name,structure,revision,published_revision').order('id').limit(limit+1);
    if(after)query=query.gt('id',after);
    if(q)query=query.ilike('title',catalogSearch(q));
    const result=await query.abortSignal(signal);if(result.error)throw result.error;
    const rows=result.data||[],page=rows.slice(0,limit);
    return NextResponse.json({ success: true, data: { templates:page.map(row=>managedWorkout(row,row.published_revision,row.revision)),nextCursor:rows.length>limit?domainCursor(scope,page.at(-1)!.id):null,contractVersion: 'academy-workouts-v1' }, error: null }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const access = await verifyCaller(req, roles);
    if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (!await callerHasPermission(access.adminSupabase, access.context, 'action:curriculum_edit')) return NextResponse.json({ success: false, error: { message: 'You cannot manage routines.' } }, { status: 403, headers });
    const parsed = await validateRequestBody(workoutCommandSchema, req);
    if (parsed.errorResponse || !parsed.data) return parsed.errorResponse!;
    const input = parsed.data;
    if (input.action === 'PUBLISH' && input.reason.length < 5) return NextResponse.json({ success: false, error: { message: 'Record a publication reason of at least 5 characters.' } }, { status: 422, headers });
    let payload;
    try { payload = input.action === 'ARCHIVE' ? {} : workoutDraftPayload(input.template); }
    catch (error) { return NextResponse.json({ success: false, error: { message: error instanceof Error ? error.message : 'Review the routine.' } }, { status: 422, headers }); }
    const result = await access.adminSupabase.rpc('portal_save_workout_draft', { p_actor: access.context.userId, p_action: input.action, p_id: input.id, p_expected_revision: input.expectedRevision, p_request_key: input.requestKey, p_payload: payload, p_reason: input.action === 'ARCHIVE' ? '' : input.reason });
    if (result.error) throw result.error;
    if (!result.data?.id || (input.action === 'ARCHIVE' ? !result.data.archived : !result.data.template)) throw new Error('Routine save was not confirmed.');
    return NextResponse.json({ success: true, data: result.data, error: null }, { headers });
  } catch (error) { return failure(error); }
}

