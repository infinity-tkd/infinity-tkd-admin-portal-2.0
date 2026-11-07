'use client';
import { stockAlertThreshold } from '@/lib/pos-catalog';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import React from 'react';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Barcode } from '@phosphor-icons/react/dist/csr/Barcode';
import type { ProductItem } from '@/lib/pos-types';
import { ProductCatalogFields, type ProductFormData } from './ProductCatalogFields';
import { ProductVariantMetadataFields } from './ProductVariantMetadataFields';


interface ProductEditDialogProps {
  handleEditProduct: (e: React.FormEvent) => Promise<void>;
  editingProduct: ProductItem;
  setIsEditItemOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingProduct: React.Dispatch<React.SetStateAction<ProductItem | null>>;
  editFormData: ProductFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  handleGenerateEditItemSku: () => void;
  editItemSkuConflict: ProductItem | null;
  editItemSkuFormatValid: { isValid: boolean; error?: string; };
  dynamicCategories: string[];
  handleDeleteProduct: (productId: string, productName: string) => void;
  isEditSubmitting: boolean;
}

export function ProductEditDialog({ handleEditProduct, editingProduct, setIsEditItemOpen, setEditingProduct, editFormData, setEditFormData, handleGenerateEditItemSku, editItemSkuConflict, editItemSkuFormatValid, dynamicCategories, handleDeleteProduct, isEditSubmitting }: ProductEditDialogProps) {
  const dialog = useRef<HTMLFormElement>(null);
  useModalFocus(dialog, () => { if (!isEditSubmitting) setIsEditItemOpen(false); });
  return <>{(
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form onSubmit={handleEditProduct} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-md rounded-[10px] p-4 sm:p-5 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto" ref={dialog} role="dialog" aria-modal="true" aria-label="Edit product" tabIndex={-1} aria-busy={isEditSubmitting}><fieldset disabled={isEditSubmitting} className="contents space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-xs font-bold tracking-wider text-[#EF2F38]">{"// EDIT INVENTORY ITEM"}</h3>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-[260px]">{editingProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditItemOpen(false);
                    setEditingProduct(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">PRODUCT NAME</label>
                  <input
                    type="text"
                    required
                    aria-label="Product name" value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">SKU CODE</label>
                      <button
                        type="button"
                        onClick={handleGenerateEditItemSku}
                        className="text-[10px] font-mono font-bold text-[#EF2F38] hover:underline flex items-center gap-1 cursor-pointer py-0.5 active:scale-95 touch-manipulation"
                        title="Auto-generate standardized unique SKU"
                      >
                        <Barcode size={13} /> Auto Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      aria-label="Product SKU" value={editFormData.sku}
                      onChange={e => setEditFormData({ ...editFormData, sku: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                      className={cn(
                        "w-full bg-neutral-50 dark:bg-[#0F0F0F] border rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none font-mono text-xs",
                        editItemSkuConflict
                          ? "border-rose-500 focus:border-rose-500"
                          : editFormData.sku
                          ? "border-emerald-500/60 focus:border-emerald-500"
                          : "border-neutral-300 dark:border-[#262626] focus:border-[#EF2F38]"
                      )}
                    />
                    {editFormData.sku && (
                      <div className="mt-1 text-[9px] font-mono flex items-center gap-1">
                        {editItemSkuConflict ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                            <Warning size={10} weight="fill" /> Duplicate: Used by &quot;{editItemSkuConflict.name}&quot;
                          </span>
                        ) : !editItemSkuFormatValid.isValid ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Warning size={10} /> {editItemSkuFormatValid.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle size={10} weight="fill" /> Unique • 1D/2D Hardware Ready
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">CATEGORY</label>
                    <select
                      aria-label="Product category" value={editFormData.category}
                      onChange={e => setEditFormData({ ...editFormData, category: e.target.value as any })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      {dynamicCategories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">PRICE ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      aria-label="Product price" value={editFormData.price}
                      onChange={e => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">STOCK QTY</label>
                    <input
                      type="number"
                      min="0"
                      required
                      readOnly aria-label="Current stock; use Stock Adjustment to change" value={editFormData.stock}
                      title="Use Stock Adjustment so every quantity change is logged."
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">THRESHOLD</label>
                    <input
                      type="number"
                      min="0"
                      required
                      aria-label="Minimum stock threshold" value={editFormData.minStockThreshold}
                      onChange={e => setEditFormData({ ...editFormData, minStockThreshold: stockAlertThreshold(e.target.valueAsNumber) })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                </div>

                {!editingProduct.hasVariants && <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">SIZE / VARIATION (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="e.g. Size 3 (160cm) or Medium"
                    aria-label="Product size" value={editFormData.size}
                    onChange={e => setEditFormData({ ...editFormData, size: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>}
                {editingProduct.hasVariants && <ProductVariantMetadataFields variants={editFormData.variantMetadata} basePrice={editFormData.price} onChange={variantMetadata => setEditFormData(previous => ({ ...previous, variantMetadata }))} />}
                <ProductCatalogFields prefix="edit-product" value={editFormData} onChange={patch => setEditFormData(previous => ({ ...previous, ...patch }))} />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteProduct(editingProduct.id, editingProduct.name);
                  }}
                  className="px-3 py-2 min-h-[42px] bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs rounded-[8px] cursor-pointer transition-colors font-bold flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                  title="Archive this product while preserving stock and history"
                >
                  <Trash size={14} />
                  <span>Archive Product</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditItemOpen(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditSubmitting || !editFormData.name.trim() || !editFormData.sku.trim() || Boolean(editItemSkuConflict) || !editItemSkuFormatValid.isValid}
                    className="flex-1 sm:flex-initial px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation"
                  >
                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </fieldset></form>
          </div>
        </Portal>
      )}</>;
}
