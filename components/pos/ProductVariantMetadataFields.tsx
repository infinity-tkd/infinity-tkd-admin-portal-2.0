'use client';

import type { ProductVariantItem } from '@/lib/pos-types';

export function ProductVariantMetadataFields({ variants, basePrice, onChange }: {
  variants: ProductVariantItem[];
  basePrice: number;
  onChange: (variants: ProductVariantItem[]) => void;
}) {
  const update = (index: number, patch: Partial<ProductVariantItem>) => onChange(variants.map((variant, position) => position === index ? { ...variant, ...patch } : variant));
  return <section aria-labelledby="existing-product-variants" className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
    <div><h4 id="existing-product-variants" className="text-xs font-semibold">Existing sizes & styles</h4><p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">Set a price override or pause a variant. Leave its price blank to use the product price. Stock changes use the separate adjustment workflow.</p></div>
    {variants.map((variant, index) => {
      const label = [variant.color, variant.size].filter(Boolean).join(' · ') || variant.sku;
      const inherited = variant.price_override === null || variant.price_override === undefined;
      return <div key={variant.id || variant.sku} className="space-y-2 rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-xs font-semibold">{label}</p><p className="mt-0.5 break-all font-mono text-[10px] text-neutral-500">{variant.sku}</p></div><span className="text-[10px] text-neutral-500">Stock: {variant.stock}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-semibold" htmlFor={`variant-price-${index}`}>Price override ($)<input id={`variant-price-${index}`} aria-label={`Price override for ${label}`} type="number" min="0" step="0.01" placeholder={`Product price $${Number.isFinite(basePrice) ? basePrice.toFixed(2) : '0.00'}`} value={inherited || !Number.isFinite(variant.price_override) ? '' : variant.price_override ?? ''} onChange={event => update(index, { price_override: event.target.value === '' ? null : event.target.valueAsNumber })} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-xs outline-none focus:border-[#EF2F38] dark:border-neutral-700" /></label><label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-xs"><input type="checkbox" aria-label={`Active variant ${label}`} checked={variant.is_active !== false} onChange={event => update(index, { is_active: event.target.checked })} className="h-4 w-4 accent-[#EF2F38]" />Active variant</label></div>
      </div>;
    })}
  </section>;
}
