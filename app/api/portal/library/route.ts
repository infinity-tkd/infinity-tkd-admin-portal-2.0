import { studentDomain, domainError, domainResponse } from '@/lib/student-domain-server';
import { catalogParams, catalogSearch, studentLessonEligible } from '@/lib/student-catalog-contract';
import { domainCursor, domainFailure, readDomainCursor } from '@/lib/domain-cursor';
import { LIBRARY_V2, libraryV2Category, libraryV2QuerySchema, libraryV2Summary } from '@/lib/library-v2-contract';
import { publishedFormIds } from '@/lib/lms-server';

export const dynamic = 'force-dynamic';
/** library-v2: one page of published lessons the student's belt can see, plus the active categories. */
export async function GET(req: Request) {
  try {
    const access = await studentDomain(req, LIBRARY_V2);
    if (access.errorResponse || !access.context || !access.adminSupabase || !access.student) return access.errorResponse!;
    const { limit, cursor, q, category, kind, lang } = catalogParams(req, libraryV2QuerySchema);
    const scope = JSON.stringify([LIBRARY_V2, access.context.userId, access.student.id, access.student.current_belt, q, category ?? null, kind ?? null, lang, limit]);
    const after = readDomainCursor(cursor, scope);
    if (after && !/^[1-9]\d{0,9}$/.test(after)) domainFailure('Refresh the library.', '40001');
    const client = access.adminSupabase;
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const [page, belts, categories] = await Promise.all([
      client.rpc('portal_student_library_page', { p_lang: lang, p_category: category ?? null, p_kind: kind ?? null, p_pattern: q ? catalogSearch(q) : null, p_after: after ? Number(after) : null, p_limit: limit + 1 }).abortSignal(signal),
      client.from('belts').select('belt_name,belt_order').order('belt_order').limit(100).abortSignal(signal),
      client.from('library_categories').select('slug,title,korean_title,subtitle,description,icon,accent_color,library_type,translations').eq('is_active', true).order('sort_order').order('title').limit(500).abortSignal(signal),
    ]);
    if (page.error) throw page.error;
    if (belts.error) throw belts.error;
    if (categories.error) throw categories.error;
    const rows: Record<string, any>[] = Array.isArray(page.data) ? page.data : [];
    const scanned = rows.slice(0, limit);
    const visible = scanned.filter(row => studentLessonEligible(String(row.targetBelt ?? ''), access.student!.current_belt, belts.data ?? []));
    const forms = await publishedFormIds(client, visible.map(row => Number(row.id)), signal);
    const lessons = visible.map(row => libraryV2Summary(row, forms));
    // The scanned id range is consumed even when belt eligibility removes rows.
    return domainResponse(LIBRARY_V2, { subjectStudentId: access.student.id, lang, categories: (categories.data ?? []).map(row => libraryV2Category(row, lang)), lessons,
      nextCursor: rows.length > limit ? domainCursor(scope, String(scanned.at(-1)!.id)) : null });
  } catch (error) { return domainError(error); }
}
