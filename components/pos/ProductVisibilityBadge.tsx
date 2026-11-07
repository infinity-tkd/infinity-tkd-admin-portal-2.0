import type { ProductItem } from '@/lib/pos-types';
import { cn } from '@/lib/utils';

export function ProductVisibilityBadge({ product }: { product: ProductItem }) {
  const inactive = product.isActive === false;
  const student = !inactive && product.allowStudentOrders !== false;
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold', inactive ? 'border-neutral-300 text-neutral-500 dark:border-neutral-700' : student ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300' : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400')}>{inactive ? 'Inactive' : student ? 'Student shop' : 'Counter only'}</span>;
}

export function ProductVariantSetupNotice({ product }: { product: ProductItem }) {
  if (!product.hasVariants || product.variants?.length) return null;
  return <span title="Physical stock is retained. Configure size or style variants before selling this product." className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Variants need setup</span>;
}
