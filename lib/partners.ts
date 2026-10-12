/** An explicitly cleared modern field must not resurrect a legacy contact value. */
export function partnerField(row: Record<string, any>, camel: string, modern: string, legacy?: unknown): any {
  if (Object.hasOwn(row, camel)) return row[camel];
  if (Object.hasOwn(row, modern)) return row[modern];
  return legacy;
}
