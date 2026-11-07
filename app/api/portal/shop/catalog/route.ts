import { studentDomain, domainError, domainResponse } from '@/lib/student-domain-server';
import { catalogParams, catalogQuerySchema, catalogSearch, studentProduct } from '@/lib/student-catalog-contract';
import { domainCursor, domainFailure, readDomainCursor } from '@/lib/domain-cursor';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const access = await studentDomain(req, 'shop-v1');
    if (access.errorResponse || !access.context || !access.adminSupabase || !access.student) return access.errorResponse!;
    const { limit, cursor, q, category } = catalogParams(req, catalogQuerySchema);
    const scope = JSON.stringify(['shop-v1', access.context.userId, access.student.id, q, category, limit]);
    const after = readDomainCursor(cursor, scope);
    if (after && !z.string().uuid().safeParse(after).success) domainFailure('Refresh the catalog page.', '40001');
    let query = access.adminSupabase.from('products').select('id,sku,name,category_name,description,image_url,price_usd,stock,has_variants,product_variants(id,sku,size,color,price_override,stock,is_active)')
      .eq('is_active', true).eq('allow_student_orders', true).order('id').limit(limit + 1);
    if (after) query = query.gt('id', after);
    if (q) query = query.ilike('name', catalogSearch(q));
    if (category) query = query.eq('category_name', category);
    const result = await query.abortSignal(AbortSignal.any([req.signal, AbortSignal.timeout(15000)]));
    if (result.error) throw result.error;
    const rows = result.data || [], page = rows.slice(0, limit);
    let products;
    try { products = page.map(row => studentProduct(row)); }
    catch { domainFailure('Some shop records need academy review. Please retry later.', 'DATA_INTEGRITY'); }
    return domainResponse('shop-v1', { subjectStudentId: access.student.id, canOrder: access.student.student_status === 'Active', products,
      nextCursor: rows.length > limit ? domainCursor(scope, page.at(-1)!.id) : null, pricing: 'server_verified_at_checkout' });
  } catch (error) { return domainError(error); }
}

