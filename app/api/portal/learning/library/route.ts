import { studentDomain, domainError, domainResponse } from '@/lib/student-domain-server';
import { catalogParams, learningQuerySchema, catalogSearch, studentLessonEligible, studentLesson } from '@/lib/student-catalog-contract';
import { domainCursor, domainFailure, readDomainCursor } from '@/lib/domain-cursor';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const access = await studentDomain(req, 'learning-v1');
    if (access.errorResponse || !access.context || !access.adminSupabase || !access.student) return access.errorResponse!;
    const { limit, cursor, q, category, type } = catalogParams(req, learningQuerySchema);
    const scope = JSON.stringify(['learning-v1', access.context.userId, access.student.id, access.student.current_belt, q, category, type, limit]);
    const after = readDomainCursor(cursor, scope);
    if (after && !/^[1-9]\d{0,9}$/.test(after)) domainFailure('Refresh the lesson page.', '40001');
    let query = access.adminSupabase.from('curriculum').select('id,target_belt,category,title,description,video_url,thumbnail_url,content_type,content_category,learning_content')
      .eq('is_active', true).order('id').limit(limit + 1);
    if (after) query = query.gt('id', Number(after));
    if (q) query = query.ilike('title', catalogSearch(q));
    if (category) query = query.eq('content_category', category);
    if (type) query = query.eq('content_type', type);
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const [result, beltResult] = await Promise.all([query.abortSignal(signal), access.adminSupabase.from('belts').select('belt_name,belt_order').order('belt_order').limit(100).abortSignal(signal)]);
    if (result.error) throw result.error;
    if (beltResult.error) throw beltResult.error;
    const rows = result.data || [], scanned = rows.slice(0, limit);
    const lessons = scanned.filter(row => studentLessonEligible(row.target_belt, access.student!.current_belt, beltResult.data || [])).map(row => {
      const lesson = studentLesson(row);
      if (!lesson) domainFailure('Published lesson guidance needs academy review. Please retry later.', 'DATA_INTEGRITY');
      return lesson;
    });
    // Consume the scanned key range even when belt eligibility removes rows.
    return domainResponse('learning-v1', { subjectStudentId: access.student.id, lessons,
      nextCursor: rows.length > limit ? domainCursor(scope, String(scanned.at(-1)!.id)) : null });
  } catch (error) { return domainError(error); }
}

