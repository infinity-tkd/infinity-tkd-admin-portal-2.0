import { z } from 'zod';
import { BELTS } from './library-catalog';
import { resolveLessonMedia } from './lesson-media';
import { libraryLearningContentSchema } from './library-publication';
import { LESSON_TEXT_LIMIT } from './library-student-projection';

/**
 * One learning-v1 lesson from a published curriculum row, using whitelisted
 * fields only. Returns null when the stored guidance fails the contract, so
 * the caller can report it instead of sending a lesson the student portal rejects.
 */
/**
 * Lesson order and length (curriculum.sort_order / duration_seconds) join learning-v1 only when
 * LEARNING_V1_LAYOUT_FIELDS=on: the student portal parses lessons with a strict schema, so the
 * fields stay off until it accepts them (see docs/STUDENT_PORTAL_EXTRAS_HANDOFF_2026-11-10.md).
 */
export const learningLayoutFieldsEnabled = () => process.env.LEARNING_V1_LAYOUT_FIELDS === 'on';
export function studentLesson(row: Record<string, any>, options: { layout?: boolean } = {}) {
  const media = resolveLessonMedia(row.video_url);
  const stored = row.learning_content && typeof row.learning_content === 'object' ? row.learning_content : {};
  const guidance = libraryLearningContentSchema.safeParse(Object.fromEntries(Object.keys(libraryLearningContentSchema.shape).filter(key => Object.hasOwn(stored, key)).map(key => [key, stored[key]])));
  if (!guidance.success) return null;
  return {
    id: row.id, targetBelt: row.target_belt, title: row.title,
    description: typeof row.description === 'string' ? row.description.slice(0, LESSON_TEXT_LIMIT) : null,
    videoUrl: media.kind === 'unavailable' ? null : media.href, media,
    thumbnailUrl: studentImageUrl(row.thumbnail_url),
    type: row.content_type, category: row.content_category || row.category, content: guidance.data,
    // Position within its belt and video length; null until staff set them in Library → Lesson order.
    ...(options.layout ? {
      position: Number.isInteger(row.sort_order) && row.sort_order > 0 ? row.sort_order : null,
      durationSeconds: Number.isInteger(row.duration_seconds) && row.duration_seconds > 0 ? row.duration_seconds : null,
    } : {}),
  };
}

export const catalogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().max(4000).optional(),
  q: z.string().trim().max(100).default(''),
  category: z.string().trim().max(100).optional(),
}).strict();
export const learningQuerySchema = catalogQuerySchema.extend({
  type: z.enum(['Taekwondo', 'Fitness', 'Dance']).optional(),
});
const money = z.coerce.number().finite().min(0).max(100000000);
export const studentProductSchema = z.object({
  id: z.string().uuid(), sku: z.string(), name: z.string(), category: z.string(),
  description: z.string().nullable(), imageUrl: z.string().nullable(), priceUsd: money,
  stock: z.number().int().nonnegative(), hasVariants: z.boolean(),
  variants: z.array(z.object({ id: z.string().uuid(), sku: z.string(), size: z.string().nullable(), color: z.string().nullable(), priceUsd: money, stock: z.number().int().nonnegative() }).strict()),
}).strict();
export type StudentProduct = z.infer<typeof studentProductSchema>;
/** Public images never carry URL credentials or executable/ambiguous schemes. */
export function studentImageUrl(value: unknown): string | null {
  if(typeof value!=='string')return null;
  const input=value.trim();
  if(!input || /[\\\u0000-\u001f\u007f]/.test(input))return null;
  try{
    if(input.startsWith('/')){
      const url=new URL(input,'https://catalog.invalid');
      return !input.startsWith('//') && url.origin==='https://catalog.invalid' ? input : null;
    }
    const url=new URL(input);
    return url.protocol==='https:' && !url.username && !url.password ? url.href : null;
  }catch{return null;}
}
/** Student DTOs are independent of administrative database row shapes. */
export function studentProduct(row: Record<string, unknown>): StudentProduct {
  const variants = Array.isArray(row.product_variants) ? row.product_variants as Record<string, unknown>[] : [];
  const active = variants.filter(variant => variant.is_active === true);
  const hasVariants = row.has_variants === true;
  if(!hasVariants && active.length)throw new Error('The product variant configuration needs academy review.');
  return studentProductSchema.parse({
    id: row.id, sku: row.sku, name: row.name, category: row.category_name,
    description: row.description ?? null, imageUrl: studentImageUrl(row.image_url), priceUsd: row.price_usd,
    stock: hasVariants ? active.reduce((sum, variant) => sum + Number(variant.stock), 0) : row.stock,
    hasVariants, variants: active.map(variant => ({ id: variant.id, sku: variant.sku, size: variant.size ?? null, color: variant.color ?? null, priceUsd: variant.price_override ?? row.price_usd, stock: variant.stock })),
  });
}
const normalizeBelt = (value: string) => value.toLowerCase().replace(/belt/g, '').replace(/[^a-z0-9]/g, '');
const defaultBeltCatalog = BELTS.filter(name => name !== 'All').map((belt_name, belt_order) => ({ belt_name, belt_order }));
/** A configured catalog is authoritative; an empty one uses the same defaults as Academy. */
export function studentLessonEligible(target: string, current: string, belts: Array<{ belt_name: string; belt_order: number }>) {
  if (['all', 'allbelts', 'alllevels', 'beginner'].includes(target.toLowerCase().replace(/[^a-z0-9]/g,''))) return true;
  const catalog = belts.length === 0 ? defaultBeltCatalog : belts;
  const own = catalog.find(belt => normalizeBelt(belt.belt_name) === normalizeBelt(current));
  const required = catalog.find(belt => normalizeBelt(belt.belt_name) === normalizeBelt(target));
  return Boolean(own && required && required.belt_order <= own.belt_order);
}
export function catalogParams<T>(req: Request, schema: z.ZodType<T>): T {
  const params = new URL(req.url).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw Object.assign(new Error('Use each catalog filter once.'), { code: '22023' });
  const parsed = schema.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw Object.assign(new Error('Choose supported catalog filters and a page size from 1 to 50.'), { code: '22023' });
  return parsed.data;
}
export const catalogSearch = (value: string) => '%' + value.replace(/[\\%_]/g, '\\$&') + '%';

