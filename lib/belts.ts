/**
 * The academy's ranks as stored in the belts table, in belt_order. Screens load the table
 * (hooks/use-belt-order.ts) and use this list until it arrives or when it cannot be read.
 * Names follow the portal convention: 'White' … 'Red', '1st Poom/Dan' … '4th Poom/Dan', '5th Dan', '6th Dan'.
 */
export const DEFAULT_BELT_ORDER: readonly string[] = Object.freeze([
  'White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red',
  '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan', '4th Poom/Dan', '5th Dan', '6th Dan',
]);

/** Belt names from belts table rows, ordered by belt_order; null when the rows give no usable list. */
export function normalizeBeltOrder(rows: readonly { belt_name?: string | null; belt_order?: number | null }[] | null | undefined): readonly string[] | null {
  const names: string[] = [];
  for (const row of [...(rows ?? [])].filter(row => typeof row.belt_name === 'string' && row.belt_name.trim() && Number.isFinite(row.belt_order)).sort((a, b) => Number(a.belt_order) - Number(b.belt_order))) {
    const name = row.belt_name!.trim();
    if (!names.includes(name)) names.push(name);
  }
  return names.length ? Object.freeze(names) : null;
}

/** Position of a belt in the order. Unknown names sort after every known belt instead of before White. */
export function beltRank(name: string | null | undefined, order: readonly string[] = DEFAULT_BELT_ORDER): number {
  const index = name ? order.indexOf(name) : -1;
  return index < 0 ? order.length : index;
}

/** The next rank in the order, or the same name for the highest or an unknown belt. */
export function nextBeltName(name: string, order: readonly string[] = DEFAULT_BELT_ORDER): string {
  const index = order.indexOf(name);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : name;
}
