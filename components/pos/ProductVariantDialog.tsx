'use client';
import { POS_MAX_LINE_QUANTITY } from '@/lib/pos-cart';
import React, {useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import type { ProductVariantItem, ProductItem } from '@/lib/pos-types';


interface ProductVariantDialogProps {
  selectedVariantModalProduct: ProductItem;
  modalSelectedColor: string;
  modalSelectedSize: string;
  cartQuantities: Record<string, number>;
  setSelectedVariantModalProduct: React.Dispatch<React.SetStateAction<ProductItem | null>>;
  setModalSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  setModalSelectedSize: React.Dispatch<React.SetStateAction<string>>;
  setModalQuantity: React.Dispatch<React.SetStateAction<number>>;
  modalQuantity: number;
  canCreateOrder: boolean;
  addToCart: (product: ProductItem, variant?: ProductVariantItem, quantityToAdd?: number) => void;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
}

export function ProductVariantDialog({ selectedVariantModalProduct, modalSelectedColor, modalSelectedSize, cartQuantities, setSelectedVariantModalProduct, setModalSelectedColor, setModalSelectedSize, setModalQuantity, modalQuantity, canCreateOrder, addToCart, showNotification }: ProductVariantDialogProps) {
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,()=>setSelectedVariantModalProduct(null));
  return <>{(
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {(() => {
              const product = selectedVariantModalProduct;
              const variants = product.variants || [];
              const distinctColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
              const distinctSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];

              // Find active selected variant
              const activeVariant = variants.find(v => {
                const colorMatch = distinctColors.length === 0 || v.color === modalSelectedColor;
                const sizeMatch = distinctSizes.length === 0 || v.size === modalSelectedSize;
                return colorMatch && sizeMatch;
              }) || variants.find(v => distinctColors.length === 0 || v.color === modalSelectedColor) || variants[0];

              const unitPrice = activeVariant?.price_override ?? product.price;
              const inStock = activeVariant?.stock ?? 0;
              const inCart = activeVariant
                ? ((activeVariant.id ? cartQuantities['var_' + activeVariant.id] : 0) ||
                   (activeVariant.sku ? cartQuantities['sku_' + activeVariant.sku] : 0) || 0)
                : 0;
              const maxAddable = Math.max(0, Math.min(inStock, POS_MAX_LINE_QUANTITY) - inCart);

              return (
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-lg rounded-[10px] p-4 sm:p-5 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto" ref={dialog} role="dialog" aria-modal="true" aria-label="Choose product variation" tabIndex={-1}>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-micro uppercase font-bold px-2 py-0.5 rounded bg-brand/10 text-brand-ink">
                          {product.category}
                        </span>
                        <span className="text-micro text-neutral-400 font-mono">
                          {variants.length} variations
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                        {product.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedVariantModalProduct(null)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                      aria-label="Close modal"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Collar Style / Color Selector */}
                  {distinctColors.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        1. COLLAR STYLE / COLOR
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {distinctColors.map(c => {
                          const isSelected = modalSelectedColor === c;
                          const totalStockForColor = variants
                            .filter(v => v.color === c)
                            .reduce((sum, v) => sum + v.stock, 0);

                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setModalSelectedColor(c);
                                // If the current size doesn't exist for this new color, choose the first available size
                                const hasCurrentSize = variants.some(v => v.color === c && v.size === modalSelectedSize);
                                if (!hasCurrentSize) {
                                  const firstForColor = variants.find(v => v.color === c && v.stock > 0) || variants.find(v => v.color === c);
                                  if (firstForColor?.size) {
                                    setModalSelectedSize(firstForColor.size);
                                  }
                                }
                              }}
                              className={cn(
                                "px-3 py-2 rounded-[8px] text-xs font-bold border transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1.5",
                                isSelected
                                  ? "bg-brand text-white border-brand shadow-sm"
                                  : "bg-neutral-50 dark:bg-[#181818] text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-[#262626] hover:border-neutral-400"
                              )}
                            >
                              {isSelected && <Check size={13} weight="bold" />}
                              <span>{c}</span>
                              <span
                                className={cn(
                                  "text-micro px-1.5 py-0.5 rounded-full font-mono",
                                  isSelected ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-[#262626] text-neutral-500"
                                )}
                              >
                                {totalStockForColor} left
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Selector */}
                  {distinctSizes.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        2. SELECT SIZE
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {distinctSizes.map(sz => {
                          const isSelected = modalSelectedSize === sz;
                          const matchingVar = variants.find(
                            v => (distinctColors.length === 0 || v.color === modalSelectedColor) && v.size === sz
                          );
                          const stockForVariant = matchingVar ? matchingVar.stock : 0;
                          const isOutOfStock = stockForVariant <= 0;

                          return (
                            <button
                              key={sz}
                              type="button"
                              disabled={!matchingVar || isOutOfStock}
                              onClick={() => {
                                setModalSelectedSize(sz);
                                setModalQuantity(1);
                              }}
                              className={cn(
                                "p-2.5 rounded-[8px] border text-center transition-all cursor-pointer active:scale-95 touch-manipulation flex flex-col items-center justify-center min-h-[52px]",
                                isSelected
                                  ? "bg-brand text-white border-brand shadow-sm ring-2 ring-brand/20"
                                  : isOutOfStock
                                  ? "opacity-35 bg-neutral-100 dark:bg-[#141414] border-neutral-200 dark:border-neutral-800 text-neutral-400 cursor-not-allowed line-through"
                                  : "bg-neutral-50 dark:bg-[#181818] text-neutral-900 dark:text-white border-neutral-300 dark:border-[#262626] hover:border-brand"
                              )}
                            >
                              <span className="font-bold text-xs">{sz}</span>
                              <span
                                className={cn(
                                  "text-micro mt-0.5",
                                  isSelected ? "text-white/80" : isOutOfStock ? "text-rose-500" : "text-neutral-500 dark:text-neutral-400"
                                )}
                              >
                                {isOutOfStock ? 'Out of stock' : `${stockForVariant} available`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Summary Card for Selected Variant */}
                  <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-micro text-neutral-500 uppercase font-mono block">Selected Variant SKU</span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {activeVariant?.sku || product.sku}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-micro text-neutral-500 uppercase font-mono block">Unit Price</span>
                        <span className="font-bold text-base text-brand-ink">${unitPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200 dark:border-[#262626] text-micro">
                      <span className="text-neutral-600 dark:text-neutral-400">Inventory Status:</span>
                      <span
                        className={cn(
                          "font-bold",
                          inStock <= 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {inStock > 0 ? `${inStock} units in stock` : 'Out of Stock'}
                        {inCart > 0 && ` (${inCart} currently in cart)`}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Quantity to Add:</span>
                    <div className="flex items-center gap-2">
                      <button aria-label="Decrease quantity"
                        type="button"
                        disabled={modalQuantity <= 1}
                        onClick={() => setModalQuantity(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-[6px] bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer active:scale-90 touch-manipulation min-h-6 min-w-6"
                      >
                        <Minus size={13} weight="bold" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-neutral-900 dark:text-white font-mono">
                        {modalQuantity}
                      </span>
                      <button aria-label="Increase quantity"
                        type="button"
                        disabled={modalQuantity >= maxAddable || maxAddable <= 0}
                        onClick={() => setModalQuantity(prev => Math.min(maxAddable, prev + 1))}
                        className="w-8 h-8 rounded-[6px] bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer active:scale-90 touch-manipulation min-h-6 min-w-6"
                      >
                        <Plus size={13} weight="bold" />
                      </button>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                    <button
                      type="button"
                      onClick={() => setSelectedVariantModalProduct(null)}
                      className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateOrder || (!activeVariant || inStock <= 0 || maxAddable <= 0)}
                      onClick={() => {
                        if (!activeVariant) return;
                        addToCart(product, activeVariant, modalQuantity);
                        setSelectedVariantModalProduct(null);
                        showNotification(
                          `Added ${modalQuantity}x ${product.name} (${[activeVariant.color, activeVariant.size].filter(Boolean).join(' - ')}) to cart!`,
                          'success'
                        );
                      }}
                      className="px-5 py-2 min-h-[42px] bg-brand hover:bg-brand-strong text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-40 transition-colors active:scale-95 touch-manipulation flex items-center gap-1.5 pointer-coarse:min-h-11"
                    >
                      <ShoppingCart size={15} weight="bold" />
                      <span>
                        Add to Cart • ${(unitPrice * modalQuantity).toFixed(2)}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </Portal>
      )}</>;
}
