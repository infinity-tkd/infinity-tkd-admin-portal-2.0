'use client';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import React from 'react';
import { Portal } from '@/components/Portal';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { ProductVariantItem, ProductItem } from '@/lib/pos-types';


interface StockAdjustmentDialogProps {
  handleAdjustStock: (e: React.FormEvent) => Promise<void>;
  adjustingProduct: ProductItem;
  setAdjustingProduct: React.Dispatch<React.SetStateAction<ProductItem | null>>;
  setAdjustingVariant: React.Dispatch<React.SetStateAction<ProductVariantItem | null>>;
  adjustingVariant: ProductVariantItem | null;
  adjustReason: "RESTOCK" | "DAMAGE_WRITE_OFF" | "AUDIT_ADJUSTMENT";
  setAdjustReason: React.Dispatch<React.SetStateAction<"RESTOCK" | "DAMAGE_WRITE_OFF" | "AUDIT_ADJUSTMENT">>;
  adjustQty: number;
  setAdjustQty: React.Dispatch<React.SetStateAction<number>>;
  adjustNotes: string;
  setAdjustNotes: React.Dispatch<React.SetStateAction<string>>;
  isAdjustSubmitting: boolean;
}

export function StockAdjustmentDialog({ handleAdjustStock, adjustingProduct, setAdjustingProduct, setAdjustingVariant, adjustingVariant, adjustReason, setAdjustReason, adjustQty, setAdjustQty, adjustNotes, setAdjustNotes, isAdjustSubmitting }: StockAdjustmentDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, () => { if (!isAdjustSubmitting) { setAdjustingProduct(null); setAdjustingVariant(null); } });
  return <>{(
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] max-w-md w-full p-4 sm:p-5 shadow-2xl font-mono text-neutral-900 dark:text-[#E4E4E4] my-auto max-h-[92dvh] overflow-y-auto" ref={dialog} role="dialog" aria-modal="true" aria-label="Adjust stock" tabIndex={-1} aria-busy={isAdjustSubmitting}
            ><form onSubmit={handleAdjustStock} className="contents"><fieldset disabled={isAdjustSubmitting} className="contents space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    ADJUST INVENTORY STOCK
                  </h3>
                  <p className="text-micro text-neutral-500 dark:text-neutral-400 truncate max-w-[260px]">{adjustingProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustingProduct(null);
                    setAdjustingVariant(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {adjustingProduct.hasVariants && adjustingProduct.variants && adjustingProduct.variants.length > 0 && (
                  <div>
                    <label htmlFor="stock-adjustment-dialog-select-specific-variation-size" className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                      SELECT SPECIFIC VARIATION / SIZE
                    </label>
                    <select id="stock-adjustment-dialog-select-specific-variation-size" required aria-label="Stock variation"
                      value={adjustingVariant?.id || ''}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const found = adjustingProduct.variants?.find(v => v.id === vId) || null;
                        setAdjustingVariant(found);
                      }}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-brand cursor-pointer pointer-coarse:min-h-11"
                    >
                      <option value="" disabled>Choose the size or style to adjust</option>
                      {adjustingProduct.variants.map((v) => (
                        <option key={v.id || v.sku} value={v.id || ''}>
                          {[v.color, v.size ? `Size: ${v.size}` : '', `(${v.stock} in stock)`, v.sku].filter(Boolean).join(' • ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {adjustingVariant ? `Variant Stock (${[adjustingVariant.color, adjustingVariant.size].filter(Boolean).join(' - ')}):` : 'Current Product Stock:'}
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {adjustingVariant ? adjustingVariant.stock : adjustingProduct.stock} units
                  </span>
                </div>

                <div>
                  <label htmlFor="stock-adjustment-dialog-reason-for-adjustment" className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">REASON FOR ADJUSTMENT</label>
                  <select id="stock-adjustment-dialog-reason-for-adjustment"
                    aria-label="Stock adjustment reason"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value as any)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-brand cursor-pointer pointer-coarse:min-h-11"
                  >
                    <option value="RESTOCK">Restock (Adding incoming shipment)</option>
                    <option value="DAMAGE_WRITE_OFF">Damage / Defect Write-off (Deduct stock)</option>
                    <option value="AUDIT_ADJUSTMENT">Physical Audit Correction</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stock-adjustment-dialog-quantity" className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                    QUANTITY ({adjustReason === 'DAMAGE_WRITE_OFF' ? 'TO DEDUCT' : adjustReason === 'AUDIT_ADJUSTMENT' ? 'SIGNED CHANGE' : 'TO ADD'})
                  </label>
                  <input id="stock-adjustment-dialog-quantity"
                    aria-label="Stock change quantity"
                    type="number"
                    min={adjustReason === 'AUDIT_ADJUSTMENT' ? undefined : 1}
                    required
                    value={adjustQty}
                    onChange={event => setAdjustQty(Number.isFinite(event.target.valueAsNumber) ? Math.trunc(event.target.valueAsNumber) : 0)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label htmlFor="stock-adjustment-dialog-notes-optional" className="block text-micro font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">NOTES (OPTIONAL)</label>
                  <input id="stock-adjustment-dialog-notes-optional"
                    aria-label="Stock adjustment notes"
                    maxLength={500}
                    type="text"
                    placeholder="e.g. Supplier Batch #49 Shipment"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustingProduct(null);
                    setAdjustingVariant(null);
                  }}
                  className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjustSubmitting}
                  className="px-5 py-2 min-h-[42px] bg-brand hover:bg-brand-strong text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  {isAdjustSubmitting ? 'Updating...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </fieldset></form></div>
          </div>
        </Portal>
      )}</>;
}
