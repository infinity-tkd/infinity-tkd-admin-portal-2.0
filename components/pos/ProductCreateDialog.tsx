'use client';
import { stockAlertThreshold } from '@/lib/pos-catalog';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { UNIFORM_COLLAR_PRESETS, SPARRING_COLOR_PRESETS, TKD_KIDS_SIZES, TKD_ADULT_SIZES, APPAREL_SIZES } from '@/lib/pos-catalog';
import React from 'react';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Tag } from '@phosphor-icons/react/dist/csr/Tag';
import { Package } from '@phosphor-icons/react/dist/csr/Package';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Barcode } from '@phosphor-icons/react/dist/csr/Barcode';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import type { ProductItem } from '@/lib/pos-types';
import { ProductCatalogFields, type ProductFormData } from './ProductCatalogFields';






interface ProductCreateDialogProps {
  isAddSubmitting: boolean;
  handleAddNewItem: (e: React.FormEvent) => Promise<void>;
  setIsAddItemOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newItem: ProductFormData;
  handleNewItemNameChange: (name: string) => void;
  handleNewItemCategoryChange: (category: string) => void;
  dynamicCategories: string[];
  handleGenerateNewItemSku: () => void;
  setIsNewItemSkuManual: React.Dispatch<React.SetStateAction<boolean>>;
  setNewItem: React.Dispatch<React.SetStateAction<ProductFormData>>;
  newItemSkuConflict: ProductItem | null;
  newItemSkuFormatValid: { isValid: boolean; error?: string; };
  hasNewItemVariants: boolean;
  setHasNewItemVariants: React.Dispatch<React.SetStateAction<boolean>>;
  variantSizes: string[];
  variantStyles: string[];
  applyUniformQuickTemplate: () => void;
  handleNewItemSizeChange: (size: string) => void;
  totalMatrixStock: number;
  matrixVariants: { id?: string; sku: string; size: string; color: string; stock: number; price_override: number | null; }[];
  applySparringGearQuickTemplate: () => void;
  setVariantStyles: React.Dispatch<React.SetStateAction<string[]>>;
  setMatrixVariants: React.Dispatch<React.SetStateAction<{ id?: string; sku: string; size: string; color: string; stock: number; price_override: number | null; }[]>>;
  regenerateMatrix: (styles: string[], sizes: string[], baseName: string, baseCat: string, currentMatrix: { id?: string; sku: string; size: string; color: string; stock: number; price_override: number | null; }[]) => { id?: string; sku: string; size: string; color: string; stock: number; price_override: number | null; }[];
  toggleStyle: (style: string) => void;
  customStyleInput: string;
  setCustomStyleInput: React.Dispatch<React.SetStateAction<string>>;
  addCustomStyle: () => void;
  removeStyle: (style: string) => void;
  clearAllSizes: () => void;
  addSizePreset: (presetSizes: readonly string[]) => void;
  toggleSize: (size: string) => void;
  customSizeInput: string;
  setCustomSizeInput: React.Dispatch<React.SetStateAction<string>>;
  addCustomSize: () => void;
  removeSize: (size: string) => void;
  batchStockValue: number;
  setBatchStockValue: React.Dispatch<React.SetStateAction<number>>;
  applyBatchStockToAll: (qty: number) => void;
  updateMatrixVariant: (index: number, patch: Partial<{ sku: string; stock: number; price_override: number | null; }>) => void;
  removeMatrixVariant: (index: number) => void;
}

export function ProductCreateDialog({ isAddSubmitting, handleAddNewItem, setIsAddItemOpen, newItem, handleNewItemNameChange, handleNewItemCategoryChange, dynamicCategories, handleGenerateNewItemSku, setIsNewItemSkuManual, setNewItem, newItemSkuConflict, newItemSkuFormatValid, hasNewItemVariants, setHasNewItemVariants, variantSizes, variantStyles, applyUniformQuickTemplate, handleNewItemSizeChange, totalMatrixStock, matrixVariants, applySparringGearQuickTemplate, setVariantStyles, setMatrixVariants, regenerateMatrix, toggleStyle, customStyleInput, setCustomStyleInput, addCustomStyle, removeStyle, clearAllSizes, addSizePreset, toggleSize, customSizeInput, setCustomSizeInput, addCustomSize, removeSize, batchStockValue, setBatchStockValue, applyBatchStockToAll, updateMatrixVariant, removeMatrixVariant }: ProductCreateDialogProps) {
  const dialog = useRef<HTMLFormElement>(null);
  useModalFocus(dialog, () => { if (!isAddSubmitting) setIsAddItemOpen(false); });
  return <>{(
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form
              onSubmit={handleAddNewItem}
              className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-2xl sm:max-w-3xl rounded-[10px] p-4 sm:p-6 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto" ref={dialog} role="dialog" aria-modal="true" aria-label="Create product" tabIndex={-1} aria-busy={isAddSubmitting}
            ><fieldset disabled={isAddSubmitting} className="contents">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-[#EF2F38]" />
                  <h3 className="text-xs font-bold tracking-wider text-[#EF2F38]">{"// ADD NEW INVENTORY ITEM"}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Basic Product Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                      PRODUCT / UNIFORM NAME <span className="text-[#EF2F38]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Infinity TKD Grandmaster Uniform"
                      aria-label="Product name" value={newItem.name}
                      onChange={e => handleNewItemNameChange(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">CATEGORY</label>
                    <select
                      aria-label="Product category" value={newItem.category}
                      onChange={e => handleNewItemCategoryChange(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer pointer-coarse:min-h-11"
                    >
                      {dynamicCategories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        BASE SKU CODE <span className="text-[#EF2F38]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateNewItemSku}
                        className="text-[10px] font-mono font-bold text-[#EF2F38] hover:underline flex items-center gap-1 cursor-pointer py-0.5 active:scale-95 touch-manipulation"
                        title="Auto-detect item and generate unique barcode-compatible SKU"
                      >
                        <Barcode size={13} /> Auto Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ITKD-UNI-01"
                      aria-label="Product SKU" value={newItem.sku}
                      onChange={e => {
                        setIsNewItemSkuManual(true);
                        setNewItem({ ...newItem, sku: e.target.value.toUpperCase().replace(/\s+/g, '-') });
                      }}
                      className={cn(
                        "w-full bg-neutral-50 dark:bg-[#0F0F0F] border rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none font-mono text-xs",
                        newItemSkuConflict
                          ? "border-rose-500 focus:border-rose-500"
                          : newItem.sku
                          ? "border-emerald-500/60 focus:border-emerald-500"
                          : "border-neutral-300 dark:border-[#262626] focus:border-[#EF2F38]"
                      )}
                    />
                    {newItem.sku && (
                      <div className="mt-1 text-[9px] font-mono flex items-center gap-1">
                        {newItemSkuConflict ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                            <Warning size={10} weight="fill" /> Duplicate: Used by &quot;{newItemSkuConflict.name}&quot;
                          </span>
                        ) : !newItemSkuFormatValid.isValid ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Warning size={10} /> {newItemSkuFormatValid.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle size={10} weight="fill" /> Unique Base SKU
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variation Toggle Card */}
                <div className="p-3 sm:p-3.5 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Tag size={15} className="text-[#EF2F38]" /> Multi-Size & Collar Matrix Variations
                    </span>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Enable for uniforms, sparring gear, or apparel with sizes (100–200, S–XL) & collar styles (White, Poom, Dan)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hasNewItemVariants;
                      setHasNewItemVariants(next);
                      if (next && variantSizes.length === 0 && variantStyles.length === 0) {
                        applyUniformQuickTemplate();
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none touch-manipulation",
                      hasNewItemVariants ? "bg-[#EF2F38]" : "bg-neutral-300 dark:bg-neutral-700"
                    )}
                    role="switch"
                    aria-checked={hasNewItemVariants}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        hasNewItemVariants ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Non-Variant Single Item Form */}
                {!hasNewItemVariants && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">PRICE ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          aria-label="Product price" value={newItem.price}
                          onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">STOCK QTY</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={newItem.stock}
                          onChange={e => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">MIN THRESHOLD</label>
                        <input
                          type="number"
                          min="0"
                          required
                          aria-label="Minimum stock threshold" value={newItem.minStockThreshold}
                          onChange={e => setNewItem({ ...newItem, minStockThreshold: stockAlertThreshold(e.target.valueAsNumber) })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">SIZE / VARIATION (OPTIONAL)</label>
                      <input
                        type="text"
                        placeholder="e.g. One Size / Free Size"
                        aria-label="Product size" value={newItem.size}
                        onChange={e => handleNewItemSizeChange(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                      />
                    </div>
                  </div>
                )}

                {/* Variant Matrix Builder Form */}
                {hasNewItemVariants && (
                  <div className="space-y-4 pt-1">
                    {/* Defaults Bar & Quick Templates */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            BASE PRICE ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            aria-label="Product price" value={newItem.price}
                            onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            MIN THRESHOLD
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            aria-label="Minimum stock threshold" value={newItem.minStockThreshold}
                            onChange={e => setNewItem({ ...newItem, minStockThreshold: stockAlertThreshold(e.target.valueAsNumber) })}
                            className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            TOTAL MATRIX STOCK
                          </label>
                          <div className="w-full min-h-[40px] flex items-center px-3 bg-neutral-100 dark:bg-[#181818] border border-neutral-300 dark:border-[#262626] rounded-[8px] font-bold text-neutral-900 dark:text-white">
                            {totalMatrixStock} units ({matrixVariants.length} items)
                          </div>
                        </div>
                      </div>

                      {/* Quick 1-Click Templates */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-500">1-Click Presets:</span>
                        <button
                          type="button"
                          onClick={applyUniformQuickTemplate}
                          className="text-[10px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-[6px] border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        >
                          <Sparkle size={12} className="text-[#EF2F38]" /> TKD Uniform (Poom, Dan, White • 110-180)
                        </button>
                        <button
                          type="button"
                          onClick={applySparringGearQuickTemplate}
                          className="text-[10px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-[6px] border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        >
                          <Sparkle size={12} className="text-blue-500" /> Sparring Gear (Red, Blue • S-XL)
                        </button>
                      </div>
                    </div>

                    {/* Step 1: Collar Styles / Colors */}
                    <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300">
                          1. Collar Styles / Colors (Optional)
                        </span>
                        {variantStyles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setVariantStyles([]);
                              setMatrixVariants(prev => regenerateMatrix([], variantSizes, newItem.name, newItem.category, prev));
                            }}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                          >
                            Clear Styles
                          </button>
                        )}
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {[...UNIFORM_COLLAR_PRESETS, ...SPARRING_COLOR_PRESETS].map(style => {
                          const isSelected = variantStyles.includes(style);
                          return (
                            <button
                              key={style}
                              type="button"
                              onClick={() => toggleStyle(style)}
                              className={cn(
                                "px-2.5 py-1 rounded-[6px] text-[10px] font-bold border transition-colors cursor-pointer active:scale-95 touch-manipulation",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38]"
                                  : "bg-white dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-[#262626] hover:border-neutral-400"
                              )}
                            >
                              {isSelected ? `✓ ${style}` : `+ ${style}`}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Style Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Or type custom collar/color (e.g. Master Gold Collar)..."
                          value={customStyleInput}
                          onChange={e => setCustomStyleInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomStyle();
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                        <button
                          type="button"
                          onClick={addCustomStyle}
                          disabled={!customStyleInput.trim()}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded-[6px] text-xs font-bold disabled:opacity-40 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          Add Style
                        </button>
                      </div>

                      {/* Active Style Chips */}
                      {variantStyles.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200 dark:border-[#262626]">
                          {variantStyles.map(st => (
                            <span
                              key={st}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-800 dark:text-neutral-200"
                            >
                              {st}
                              <button
                                type="button"
                                onClick={() => removeStyle(st)}
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Sizes */}
                    <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300">
                          2. Sizes (Multi-Select)
                        </span>
                        {variantSizes.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAllSizes}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                          >
                            Clear Sizes
                          </button>
                        )}
                      </div>

                      {/* Size Batch Buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => addSizePreset(TKD_KIDS_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + TKD Kids (100–150)
                        </button>
                        <button
                          type="button"
                          onClick={() => addSizePreset(TKD_ADULT_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + TKD Adult (160–200)
                        </button>
                        <button
                          type="button"
                          onClick={() => addSizePreset(APPAREL_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + Apparel (XS–XXL)
                        </button>
                      </div>

                      {/* Quick Individual Size Pills */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[...TKD_KIDS_SIZES, ...TKD_ADULT_SIZES].map(sz => {
                          const isSelected = variantSizes.includes(sz);
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => toggleSize(sz)}
                              className={cn(
                                "w-9 h-7 rounded-[4px] text-[10px] font-bold border transition-colors flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38]"
                                  : "bg-white dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-[#262626]"
                              )}
                            >
                              {sz}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Size Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Or type custom size (e.g. Size 0, Free, 210)..."
                          value={customSizeInput}
                          onChange={e => setCustomSizeInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomSize();
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                        <button
                          type="button"
                          onClick={addCustomSize}
                          disabled={!customSizeInput.trim()}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded-[6px] text-xs font-bold disabled:opacity-40 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          Add Size
                        </button>
                      </div>

                      {/* Active Size Chips */}
                      {variantSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200 dark:border-[#262626]">
                          {variantSizes.map(sz => (
                            <span
                              key={sz}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-800 dark:text-neutral-200"
                            >
                              {sz}
                              <button
                                type="button"
                                onClick={() => removeSize(sz)}
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 3: Matrix Combinations Table & Stock Batch Setting */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <span>3. Matrix Combinations</span>
                          <span className="px-2 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] rounded-full text-[10px] font-bold">
                            {matrixVariants.length} Combinations
                          </span>
                        </span>

                        {matrixVariants.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500">Batch Stock:</span>
                            <input
                              type="number"
                              min="0"
                              value={batchStockValue}
                              onChange={e => setBatchStockValue(parseInt(e.target.value) || 0)}
                              className="w-16 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded px-2 py-1 text-xs text-neutral-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => applyBatchStockToAll(batchStockValue)}
                              className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-900 dark:text-white text-[10px] font-bold rounded cursor-pointer active:scale-95 touch-manipulation"
                            >
                              Apply to All
                            </button>
                          </div>
                        )}
                      </div>

                      {matrixVariants.length === 0 ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-[8px] text-amber-700 dark:text-amber-300 text-center text-xs">
                          Select collar styles or sizes above to generate variation combinations.
                        </div>
                      ) : (
                        <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden max-h-[260px] overflow-y-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-neutral-100 dark:bg-[#181818] sticky top-0 text-[10px] text-neutral-500 uppercase border-b border-neutral-200 dark:border-[#262626]">
                              <tr>
                                <th className="px-3 py-2">Collar / Style</th>
                                <th className="px-3 py-2">Size</th>
                                <th className="px-3 py-2">SKU</th>
                                <th className="px-3 py-2 w-20">Stock</th>
                                <th className="px-3 py-2 w-24">Price ($)</th>
                                <th className="px-2 py-2 text-center w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#101010]">
                              {matrixVariants.map((v, idx) => (
                                <tr key={`${v.color}_${v.size}_${idx}`} className="hover:bg-neutral-50 dark:hover:bg-[#151515]">
                                  <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-200">
                                    {v.color || <span className="text-neutral-400 italic">Default</span>}
                                  </td>
                                  <td className="px-3 py-2 font-bold text-neutral-900 dark:text-white">
                                    {v.size || <span className="text-neutral-400 italic">Free</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={v.sku}
                                      onChange={e => updateMatrixVariant(idx, { sku: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[10px] font-mono text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={v.stock}
                                      onChange={e => updateMatrixVariant(idx, { stock: Math.max(0, parseInt(e.target.value) || 0) })}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[11px] font-bold text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder={`$${newItem.price.toFixed(2)}`}
                                      value={v.price_override ?? ''}
                                      onChange={e => {
                                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                        updateMatrixVariant(idx, { price_override: isNaN(val as number) ? null : val });
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[11px] text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeMatrixVariant(idx)}
                                      className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer"
                                      title="Remove this variation"
                                    >
                                      <Trash size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <ProductCatalogFields prefix="new-product" value={newItem} onChange={patch => setNewItem(previous => ({ ...previous, ...patch }))} />

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !newItem.name.trim() ||
                    !newItem.sku.trim() ||
                    Boolean(newItemSkuConflict) ||
                    !newItemSkuFormatValid.isValid ||
                    (hasNewItemVariants && matrixVariants.length === 0)
                  }
                  className="px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation flex items-center gap-2 pointer-coarse:min-h-11"
                >
                  <Plus size={14} weight="bold" />
                  <span>
                    {isAddSubmitting ? 'Saving…' : hasNewItemVariants
                      ? `Create Product (${matrixVariants.length} Variations)`
                      : 'Add Single Item'}
                  </span>
                </button>
              </div>
            </fieldset></form>
          </div>
        </Portal>
      )}</>;
}
