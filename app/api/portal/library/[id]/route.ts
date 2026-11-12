import { studentDomain, domainError, domainResponse } from '@/lib/student-domain-server';
import { catalogParams, studentLessonEligible } from '@/lib/student-catalog-contract';
import { domainFailure } from '@/lib/domain-cursor';
import { LIBRARY_V2, libraryV2DetailQuerySchema, libraryV2Lesson } from '@/lib/library-v2-contract';
import { publishedFormIds } from '@/lib/lms-server';

export const dynamic = 'force-dynamic';
/** library-v2: one published lesson with its sections, in the requested language. */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await studentDomain(req, LIBRARY_V2);
    if (access.errorResponse || !access.context || !access.adminSupabase || !access.student) return access.errorResponse!;
    const id = (await context?.params)?.id ?? '';
    if (!/^[1-9]\d{0,9}$/.test(id)) domainFailure('Choose a lesson.');
    const { lang } = catalogParams(req, libraryV2DetailQuerySchema);
    const client = access.adminSupabase;
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const [lesson, published, belts] = await Promise.all([
      client.from('curriculum').select('id,target_belt,title,description,video_url,thumbnail_url,content_type,learning_content,sort_order,duration_seconds,is_active').eq('id', Number(id)).abortSignal(signal).maybeSingle(),
      client.from('library_published_content').select('content_kind,category_id,document').eq('curriculum_id', Number(id)).abortSignal(signal).maybeSingle(),
      client.from('belts').select('belt_name,belt_order').order('belt_order').limit(100).abortSignal(signal),
    ]);
    if (lesson.error) throw lesson.error;
    if (published.error) throw published.error;
    if (belts.error) throw belts.error;
    // Unpublished, hidden and above-belt lessons all read as unavailable.
    if (!lesson.data?.is_active || !studentLessonEligible(String(lesson.data.target_belt ?? ''), access.student.current_belt, belts.data ?? [])) domainFailure('This lesson is not available.', 'P0002');
    let categorySlug: string | null = null;
    if (published.data?.category_id) {
      const category = await client.from('library_categories').select('slug,is_active').eq('id', published.data.category_id).abortSignal(signal).maybeSingle();
      if (category.error) throw category.error;
      if (category.data && !category.data.is_active) domainFailure('This lesson is not available.', 'P0002');
      categorySlug = category.data?.slug ?? null;
    }
    const forms = await publishedFormIds(client, [Number(id)], signal);
    return domainResponse(LIBRARY_V2, { subjectStudentId: access.student.id, lang, lesson: libraryV2Lesson(lesson.data!, published.data, categorySlug, lang, forms.get(Number(id)) ?? null) });
  } catch (error) { return domainError(error); }
}
