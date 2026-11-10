import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { libraryContentSchema, libraryMetadataSchema } from '@/lib/library-content';

export const dynamic = 'force-dynamic';
// Reads need page:library; saving needs action:curriculum_edit (checked again in SQL).
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const saveSchema = z.object({ id: z.number().int().positive(), expectedRevision: z.number().int().positive(), metadata: libraryMetadataSchema, content: libraryContentSchema }).strict();
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status, headers });

/** One lesson's details, sections, translations and sources for the content editor. */
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return fail('Choose a lesson.', 422);
    const signal = AbortSignal.timeout(15000);
    const [asset, content] = await Promise.all([
      adminSupabase.from('library_assets').select('id,title,revision,published_revision,student_curriculum_id,target_level,category_id,content_kind,slug,korean_name,romanized,summary,level_note,tags,source_key').eq('id', id).abortSignal(signal).maybeSingle(),
      adminSupabase.from('library_asset_content').select('sections,translations,sources,updated_at').eq('asset_id', id).abortSignal(signal).maybeSingle(),
    ]);
    if (asset.error) throw asset.error;
    if (content.error) throw content.error;
    if (!asset.data) return fail('The lesson was not found.', 404);
    const a = asset.data;
    // Stored content is re-checked so the editor never opens on something it cannot save.
    const parsed = libraryContentSchema.safeParse({ sections: content.data?.sections ?? [], translations: content.data?.translations ?? {}, sources: content.data?.sources ?? [] });
    return NextResponse.json({ success: true, data: {
      asset: { id: a.id, title: a.title, revision: a.revision, publishedRevision: a.published_revision, studentCurriculumId: a.student_curriculum_id, targetLevel: a.target_level, sourceKey: a.source_key },
      metadata: { categoryId: a.category_id, kind: a.content_kind, slug: a.slug, koreanName: a.korean_name, romanized: a.romanized, summary: a.summary, levelNote: a.level_note, tags: a.tags ?? [] },
      content: parsed.success ? parsed.data : { sections: [], translations: {}, sources: [] },
      contentIssue: parsed.success ? null : 'Some saved content could not be read and was left out. Saving replaces it.',
      updatedAt: content.data?.updated_at ?? null,
    } }, { headers });
  } catch (error) { return operationsError(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(saveSchema, req);
    if (invalid || !data) return invalid!;
    const result = await adminSupabase.rpc('portal_save_library_content', { p_actor: context.userId, p_id: data.id, p_payload: { expectedRevision: data.expectedRevision, metadata: data.metadata, content: data.content } }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    if (!result.data?.asset) throw new Error('The lesson save was not confirmed.');
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return operationsError(error); }
}
