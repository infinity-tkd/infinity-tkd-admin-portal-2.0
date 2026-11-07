'use client';
import type { ProductVariantItem } from '@/lib/pos-types';

export interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  minStockThreshold: number;
  size: string;
  cost: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
  allowStudentOrders: boolean;
  variantMetadata: ProductVariantItem[];
}

export const newProductForm = (): ProductFormData => ({
  name: '', sku: '', category: 'Uniforms', price: 25, stock: 0,
  minStockThreshold: 5, size: '', cost: 0, description: '', imageUrl: '',
  isActive: true, allowStudentOrders: false, variantMetadata: [],
});

export function ProductCatalogFields({ prefix, value, onChange }: {
  prefix: string;
  value: ProductFormData;
  onChange: (patch: Partial<ProductFormData>) => void;
}) {
  const field = 'w-full min-h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-[#EF2F38] dark:border-neutral-700 dark:bg-[#0F0F0F] dark:text-neutral-100';
  const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400';
  return (
    <section aria-labelledby={`${prefix}-catalog-heading`} className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <div>
        <h4 id={`${prefix}-catalog-heading`} className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Catalog details & availability</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">Keep product information consistent at the counter and in the student shop.</p>
      </div>
      <div>
        <label htmlFor={`${prefix}-description`} className={label}>Product description</label>
        <textarea id={`${prefix}-description`} rows={3} maxLength={1000} value={value.description} onChange={event => onChange({ description: event.target.value })} className={`${field} resize-y`} placeholder="Fit, included items, care instructions or collection details." />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <div>
          <label htmlFor={`${prefix}-image`} className={label}>Product image URL</label>
          <input id={`${prefix}-image`} type="url" maxLength={2000} value={value.imageUrl} onChange={event => onChange({ imageUrl: event.target.value })} className={field} placeholder="https://…" />
        </div>
        <div>
          <label htmlFor={`${prefix}-cost`} className={label}>Unit cost ($)</label>
          <input id={`${prefix}-cost`} type="number" min="0" step="0.01" required value={Number.isFinite(value.cost) ? value.cost : ''} onChange={event => onChange({ cost: event.target.valueAsNumber })} className={field} />
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]">
        <input type="checkbox" aria-label="Active product" checked={value.isActive} onChange={event => onChange({ isActive: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#EF2F38]" />
        <span><span className="block text-xs font-semibold">Active product</span><span className="mt-1 block text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">Inactive products stay in the management catalog and cannot be sold.</span></span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]">
        <input type="checkbox" aria-label="Available in student shop" checked={value.allowStudentOrders} onChange={event => onChange({ allowStudentOrders: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#EF2F38]" />
        <span><span className="block text-xs font-semibold">Available in student shop</span><span className="mt-1 block text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">Make this active product available for student orders. Leave unchecked for counter sales only.</span></span>
      </label>
      {!value.isActive && <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">This product will remain hidden from students while inactive.</p>}
    </section>
  );
}
