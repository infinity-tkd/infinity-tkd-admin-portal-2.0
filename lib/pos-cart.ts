import type { CartItem, ProductItem, ProductVariantItem } from './pos-types';
import { decimalParts, roundPositiveRatio } from './money';

export const POS_MAX_LINE_QUANTITY = 1000;
export const POS_MAX_CART_LINES = 100;
export const POS_MAX_ORDER_NOTES = 500;

type CartChange = { ok: true; cart: CartItem[] } | { ok: false; message: string };

export function posCartItemKey(item: { product: ProductItem; variant?: ProductVariantItem }) {
  return `${item.product.id}_${item.variant?.id || item.variant?.sku || item.product.size || 'default'}`;
}

/** Compute a cart change without notifications or React state updates. */
export function addPosCartItem(cart: CartItem[], product: ProductItem, variant: ProductVariantItem | undefined, quantity: number): CartChange {
  if(product.isActive===false || variant?.is_active===false)return {ok:false,message:'This item is archived and is not available for sale.'};
  if(product.hasVariants && !variant)return {ok:false,message:'Choose a product variation before adding this item.'};
  if(variant && product.variants && !product.variants.some(row=>row.id ? row.id===variant.id : row.sku===variant.sku))return {ok:false,message:'This variation does not belong to the selected product.'};
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > POS_MAX_LINE_QUANTITY) {
    return { ok: false, message: `Choose a whole quantity between 1 and ${POS_MAX_LINE_QUANTITY}.` };
  }
  const price = variant?.price_override ?? product.price;
  if (!Number.isFinite(price) || price < 0 || price * quantity * 100 > Number.MAX_SAFE_INTEGER) {
    return { ok: false, message: 'This product has an invalid price. Refresh the product catalog before checkout.' };
  }
  const stock = variant ? variant.stock : product.stock;
  if (!Number.isSafeInteger(stock) || stock < 0) {
    return { ok: false, message: 'Stock is unavailable for this item. Refresh the product catalog before checkout.' };
  }
  const limit = Math.min(stock, POS_MAX_LINE_QUANTITY);
  const key = posCartItemKey({ product, variant });
  const existing = cart.find(item => posCartItemKey(item) === key);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > limit) {
    return { ok: false, message: `You can add ${Math.max(0, limit - (existing?.quantity ?? 0))} more of this item under the stock and order limits.` };
  }
  if (!existing && cart.length >= POS_MAX_CART_LINES) {
    return { ok: false, message: `An order can contain up to ${POS_MAX_CART_LINES} different items. Complete this sale before starting another.` };
  }
  return {
    ok: true,
    cart: existing
      ? cart.map(item => posCartItemKey(item) === key ? { ...item, quantity: nextQuantity } : item)
      : [...cart, { product, variant, quantity }],
  };
}

export function changePosCartQuantity(cart: CartItem[], key: string, delta: number): CartChange {
  if (!Number.isSafeInteger(delta)) return { ok: false, message: 'Choose a whole item quantity.' };
  const item = cart.find(row => posCartItemKey(row) === key);
  if (!item) return { ok: true, cart };
  const quantity = item.quantity + delta;
  if (quantity <= 0) return { ok: true, cart: cart.filter(row => posCartItemKey(row) !== key) };
  const others = cart.filter(row => posCartItemKey(row) !== key);
  const changed = addPosCartItem(others, item.product, item.variant, quantity);
  return changed.ok
    ? { ok: true, cart: cart.map(row => posCartItemKey(row) === key ? { ...row, quantity } : row) }
    : changed;
}

/** Match the database's line and discount rounding before showing a counter total. */
export function posCartTotals(cart: CartItem[], requestedDiscount: number) {
  const subtotalCents = cart.reduce((sum, item) => {
    const price = decimalParts(item.variant?.price_override ?? item.product.price);
    const lineCents = roundPositiveRatio(price.units * BigInt(item.quantity) * BigInt(100), price.divisor);
    return sum + lineCents;
  }, BigInt(0));
  const discountPercent = Number.isFinite(requestedDiscount) ? Math.max(0, Math.min(100, requestedDiscount)) : 0;
  const percentage = decimalParts(discountPercent);
  const discountCents = roundPositiveRatio(subtotalCents * percentage.units, percentage.divisor * BigInt(100));
  return {
    subtotal: Number(subtotalCents) / 100,
    discountPercent,
    discount: Number(discountCents) / 100,
    total: Number(subtotalCents - discountCents) / 100,
  };
}

export const POS_DISPLAY_KHR_RATE=4100;
export const formatKHR=(usd:number)=>`${Math.round(usd*POS_DISPLAY_KHR_RATE).toLocaleString()} ៛`;
