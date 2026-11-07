interface VariantDraft {sku:string;size:string;color:string;stock:number;price_override:number|null}

/** Translate editor fields to the catalog API contract without dropping override prices. */
export function productVariantPayloads(rows: VariantDraft[]) {
  if (!rows.length || rows.length > 200) throw new Error('A product needs between 1 and 200 variations.');
  const skus = new Set<string>();
  return rows.map(row=>{
    const sku = row.sku.trim().toUpperCase();
    if (!sku || sku.length>50 || skus.has(sku)) throw new Error('Each variation needs a unique SKU of up to 50 characters.');
    skus.add(sku);
    if (!Number.isSafeInteger(row.stock) || row.stock<0) throw new Error('Variation stock must be a non-negative whole number.');
    if (row.price_override!==null && (!Number.isFinite(row.price_override) || row.price_override<0)) throw new Error('Variation prices must be zero or greater.');
    if (row.size.trim().length>50 || row.color.trim().length>50) throw new Error('Variation size and style must be at most 50 characters.');
    return {sku,size:row.size.trim()||null,color:row.color.trim()||null,stock:row.stock,priceOverride:row.price_override};
  });
}
