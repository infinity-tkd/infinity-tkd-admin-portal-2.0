export const UNIFORM_COLLAR_PRESETS = [
  'White V-Neck',
  'Black/Red V-Neck (Poom)',
  'Black V-Neck (Dan)'
] as const;

export const SPARRING_COLOR_PRESETS = [
  'Red',
  'Blue'
] as const;

export const TKD_KIDS_SIZES = ['100', '110', '120', '130', '140', '150'] as const;

export const TKD_ADULT_SIZES = ['160', '170', '180', '190', '200'] as const;

export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export function inventoryAdjustmentQuantity(reason: 'RESTOCK' | 'DAMAGE_WRITE_OFF' | 'AUDIT_ADJUSTMENT', quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity)>100000) throw new Error('Enter a non-zero whole stock quantity up to 100000 units.');
  return reason === 'DAMAGE_WRITE_OFF' ? -Math.abs(quantity) : reason === 'RESTOCK' ? Math.abs(quantity) : quantity;
}

export function validInventoryChange(reason: string, quantity: number) {
  return Number.isSafeInteger(quantity) && quantity!==0 && Math.abs(quantity)<=100000 &&
    (reason==='RESTOCK'?quantity>0:reason==='DAMAGE_WRITE_OFF'?quantity<0:reason==='AUDIT_ADJUSTMENT');
}

export function stockAlertThreshold(value: unknown, fallback = 5) {
  if (value === null || value === undefined || value === '') return fallback;
  const threshold = Number(value);
  return Number.isFinite(threshold) ? Math.max(0, Math.trunc(threshold)) : fallback;
}

/** Retail value is based on each physical variant's price, including a free override. */
export function inventoryRetailValue(product: import('./pos-types').ProductItem): number {
  const rows = product.hasVariants ? (product.variants ?? []).map(variant => ({price:variant.price_override ?? product.price, stock:variant.stock})) : [{price:product.price, stock:product.stock}];
  const cents=rows.reduce((total,row)=>{
    if(!Number.isSafeInteger(row.stock)||row.stock<0)throw new Error('Inventory stock must be a non-negative whole number.');
    const price=decimalParts(row.price);
    return total+roundPositiveRatio(price.units*BigInt(row.stock)*BigInt(100),price.divisor);
  },BigInt(0));
  return Number(cents)/100;
}

export function sellableProductStock(product: import('./pos-types').ProductItem): number {
  if(product.isActive===false)return 0;
  return product.hasVariants ? (product.variants ?? []).filter(row=>row.is_active!==false).reduce((sum,row)=>sum+row.stock,0) : product.stock;
}

/** Replenishment follows each active size's threshold, independently of archived stock. */
export function inventoryStockStatus(product: import('./pos-types').ProductItem): 'OUT' | 'LOW' | 'HEALTHY' {
  if (!product.hasVariants) {
    if (product.stock <= 0) return 'OUT';
    return product.stock <= product.minStockThreshold ? 'LOW' : 'HEALTHY';
  }
  const activeVariants = (product.variants ?? []).filter(variant => variant.is_active !== false);
  const available = activeVariants.reduce((total, variant) => total + variant.stock, 0);
  if (available <= 0) return 'OUT';
  return activeVariants.some(variant => variant.stock <= (variant.min_stock_threshold ?? product.minStockThreshold)) ? 'LOW' : 'HEALTHY';
}
import {decimalParts,roundPositiveRatio} from './money';

