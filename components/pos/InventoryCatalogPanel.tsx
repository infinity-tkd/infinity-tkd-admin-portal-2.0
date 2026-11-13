'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import type { ProductVariantItem, ProductItem } from '@/lib/pos-types';
import { inventoryRetailValue, inventoryStockStatus } from '@/lib/pos-catalog';
import { ProductVisibilityBadge, ProductVariantSetupNotice } from './ProductVisibilityBadge';
import { SafeImage } from '@/components/SafeImage';
import { Package } from '@phosphor-icons/react/dist/csr/Package';


interface InventoryCatalogPanelProps {
  canManageInventory: boolean;
  catalog: ProductItem[];
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValuation: number;
  inventoryCategory: string;
  setInventoryCategory: React.Dispatch<React.SetStateAction<string>>;
  dynamicCategories: string[];
  setInventoryStockFilter: React.Dispatch<React.SetStateAction<"ALL" | "LOW" | "OUT" | "HEALTHY">>;
  inventoryStockFilter: "ALL" | "LOW" | "OUT" | "HEALTHY";
  inventoryStockCounts: { ALL: number; LOW: number; OUT: number; HEALTHY: number; };
  inventoryVisibility: 'ALL' | 'STUDENT' | 'COUNTER' | 'INACTIVE';
  setInventoryVisibility: (value: 'ALL' | 'STUDENT' | 'COUNTER' | 'INACTIVE') => void;
  inventorySearch: string;
  setInventorySearch: React.Dispatch<React.SetStateAction<string>>;
  filteredInventory: ProductItem[];
  expandedProductIds: Set<string>;
  setExpandedProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  openEditProductModal: (product: ProductItem) => void;
  setAdjustingProduct: React.Dispatch<React.SetStateAction<ProductItem | null>>;
  setAdjustingVariant: React.Dispatch<React.SetStateAction<ProductVariantItem | null>>;
  handleDeleteProduct: (productId: string, productName: string) => void;
}

export function InventoryCatalogPanel({ canManageInventory, catalog, lowStockCount, outOfStockCount, totalInventoryValuation, inventoryCategory, setInventoryCategory, dynamicCategories, setInventoryStockFilter, inventoryStockFilter, inventoryStockCounts, inventoryVisibility, setInventoryVisibility, inventorySearch, setInventorySearch, filteredInventory, expandedProductIds, setExpandedProductIds, openEditProductModal, setAdjustingProduct, setAdjustingVariant, handleDeleteProduct }: InventoryCatalogPanelProps) {
  const signature = [inventoryCategory, inventoryStockFilter, inventoryVisibility, inventorySearch].join(':');
  const [page, setPage] = useState({ signature: '', limit: 48 });
  const limit = page.signature === signature ? page.limit : 48;
  const visibleInventory = filteredInventory.slice(0, limit);
  return <>{(
        <div className="flex flex-col space-y-4 flex-1">

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Total SKUs</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                {catalog.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Low Stock</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                {lowStockCount}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Out of Stock</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {outOfStockCount}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Retail stock value</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                ${totalInventoryValuation.toFixed(2)}
              </p>
              {catalog.some(product => product.hasVariants && !product.variants?.length) && (
                <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">Excludes stock needing variant setup.</p>
              )}
            </div>
          </div>

          {/* Table Filter Controls */}
          <div className="flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3 sm:p-3.5 rounded-[8px] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Category & Stock Health Pills */}
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex">
                {/* Category Filter */}
                <select
                  aria-label="Inventory category"
                  value={inventoryCategory}
                  onChange={e => setInventoryCategory(e.target.value)}
                  className="min-w-0 w-full sm:w-auto bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-2 sm:px-3 py-1.5 min-h-11 focus:outline-none focus:border-brand font-mono cursor-pointer"
                >
                  {dynamicCategories.map(c => (
                    <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
                  ))}
                </select>
                <select aria-label="Inventory availability" value={inventoryVisibility} onChange={event => setInventoryVisibility(event.target.value as InventoryCatalogPanelProps['inventoryVisibility'])} className="min-h-11 min-w-0 w-full sm:w-auto rounded-lg border border-neutral-200 bg-neutral-50 px-2 sm:px-3 text-xs text-neutral-900 outline-none focus:border-brand dark:border-neutral-700 dark:bg-[#0F0F0F] dark:text-neutral-100">
                  <option value="ALL">All availability</option><option value="STUDENT">Student shop</option><option value="COUNTER">Counter only</option><option value="INACTIVE">Inactive products</option>
                </select>
                </div>

                {/* Stock Health Filter Pills with Real-time Count Badges */}
                <div role="group" aria-label="Inventory stock health" className="flex w-full sm:w-auto items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 min-h-11">
                  {(['ALL', 'LOW', 'OUT', 'HEALTHY'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setInventoryStockFilter(f)}
                      className={cn(
                        "min-w-0 flex-1 sm:flex-initial px-1.5 sm:px-2.5 py-1 min-h-[38px] text-[10px] font-mono rounded-[6px] transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                        inventoryStockFilter === f
                          ? "bg-white text-neutral-900 shadow-sm font-bold border border-neutral-200/80 dark:bg-[#222] dark:text-white dark:border-neutral-700"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      <span>{f}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 text-[9px] rounded-full font-mono font-bold leading-none",
                          f === 'LOW' && (inventoryStockCounts.LOW > 0)
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
                            : f === 'OUT' && (inventoryStockCounts.OUT > 0)
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400"
                            : f === 'HEALTHY'
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-neutral-200 dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-400"
                        )}
                      >
                        {inventoryStockCounts[f]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Search Input with Clear Button */}
              <div className="relative w-full lg:w-64 shrink-0">
                <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                    aria-label="Search inventory"
                  type="text"
                  placeholder="Search SKU or product name..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-brand font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                />
                {inventorySearch && (
                  <button
                    type="button"
                    aria-label="Clear inventory search"
                    onClick={() => setInventorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar: Showing Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626] text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{visibleInventory.length}</span> of {filteredInventory.length} matching products
              </span>
              <span className="hidden sm:inline text-neutral-400 dark:text-neutral-600">
                    Stock alerts cover active products
              </span>
            </div>
          </div>

          {/* Desktop Inventory Ledger Table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm flex-1">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left text-xs font-mono">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock Health</th>
                    <th className="py-3 px-4 text-right">Valuation</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                        No inventory records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    visibleInventory.map(prod => {
                      const isLowStock = inventoryStockStatus(prod) === 'LOW';
                      const isOutOfStock = inventoryStockStatus(prod) === 'OUT';
                      const maxBar = Math.max(prod.minStockThreshold * 2.5, 20);
                      const percent = Math.min(100, Math.round((prod.stock / maxBar) * 100));

                      const isExpanded = expandedProductIds.has(prod.id);
                      const hasVar = Boolean(prod.hasVariants && prod.variants && prod.variants.length > 0);

                      return (
                        <React.Fragment key={prod.id}>
                          <tr className="hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
                            <td className="py-3 px-4 font-bold text-brand-ink">{prod.sku}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {prod.imageUrl && <SafeImage src={prod.imageUrl} alt="" width={48} height={48} containerClassName="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" fallback={<Package size={18} className="text-neutral-400" />} />}
                                <span className="font-bold text-neutral-900 dark:text-white">{prod.name}</span>
                                <ProductVisibilityBadge product={prod} />
                                <ProductVariantSetupNotice product={prod} />
                                {hasVar && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedProductIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(prod.id)) next.delete(prod.id);
                                        else next.add(prod.id);
                                        return next;
                                      });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 cursor-pointer flex items-center gap-1 transition-colors"
                                    title="View sizes and collar variations"
                                  >
                                    <Sparkle size={10} className="text-brand-ink" />
                                    <span>{prod.variants!.length} Variations</span>
                                    <CaretDown size={11} className={cn("transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{prod.category}</td>
                            <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                              {hasVar ? (
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                                  {prod.sizes && prod.sizes.length > 0 ? prod.sizes.join(', ') : 'Multi-size'}
                                </span>
                              ) : (
                                prod.size || '—'
                              )}
                            </td>
                            <td className="py-3 px-4 text-neutral-900 dark:text-white font-bold">${prod.price.toFixed(2)}</td>

                            {/* Stock Health Progress Bar */}
                            <td className="py-3 px-4 min-w-[150px]">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className={cn(
                                  "font-bold",
                                  isOutOfStock ? "text-rose-600 dark:text-rose-400" : isLowStock ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                                )}>
                                  {prod.stock} units
                                </span>
                                <span className="text-neutral-500 dark:text-neutral-500">min: {prod.minStockThreshold}</span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-200 dark:bg-[#262626] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                />
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-black text-neutral-900 dark:text-white">
                              ${inventoryRetailValue(prod).toFixed(2)}
                            </td>

                            {/* Actions: Edit, Adjust Stock & Delete */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openEditProductModal(prod)}
                                  title="Edit Product Details"
                                  aria-label={`Edit ${prod.name}`}
                                  className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-300 dark:hover:text-brand-ink dark:border-[#262626] rounded-[6px] transition cursor-pointer" disabled={!canManageInventory}
                                >
                                  <PencilSimple size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjustingProduct(prod);
                                    setAdjustingVariant(null);
                                  }}
                                  title="Adjust Stock / Restock"
                                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:hover:text-brand-ink dark:text-[#ccc] dark:border-[#262626] rounded-[6px] transition cursor-pointer text-[10px] font-bold" disabled={!canManageInventory}
                                >
                                  Restock
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  title="Archive Product"
                                  aria-label={`Archive ${prod.name}`}
                                  className="p-1.5 bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-[#888] dark:border-[#262626] rounded-[6px] transition cursor-pointer" disabled={!canManageInventory}
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Variant Sub-Ledger */}
                          {isExpanded && hasVar && (
                            <tr className="bg-neutral-50/80 dark:bg-[#0D0D0D]">
                              <td colSpan={8} className="py-2.5 px-4 sm:px-6 border-y border-neutral-200 dark:border-[#262626]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                                    <span className="flex items-center gap-1.5">
                                      <Sparkle size={12} className="text-brand-ink" />
                                      {prod.name} — Size & Style Variation Ledger
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono">
                                      {prod.variants!.length} active combinations
                                    </span>
                                  </div>

                                  <div className="border border-neutral-200 dark:border-[#222] rounded-[6px] overflow-hidden bg-white dark:bg-[#141414]">
                                    <table className="w-full text-left text-xs font-mono">
                                      <thead className="bg-neutral-100 dark:bg-[#1A1A1A] text-[9px] uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                                        <tr>
                                          <th className="py-1.5 px-3">Variant SKU</th>
                                          <th className="py-1.5 px-3">Collar / Style</th>
                                          <th className="py-1.5 px-3">Size</th>
                                          <th className="py-1.5 px-3">Price</th>
                                          <th className="py-1.5 px-3">Stock Units</th>
                                          <th className="py-1.5 px-3 text-right">Quick Restock</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-100 dark:divide-[#202020]">
                                        {prod.variants!.map(v => (
                                          <tr key={v.sku} className="hover:bg-neutral-50 dark:hover:bg-[#181818] transition-colors">
                                            <td className="py-1.5 px-3 font-bold text-brand-ink text-[11px]">{v.sku}</td>
                                            <td className="py-1.5 px-3 text-neutral-800 dark:text-neutral-200">
                                              {v.color ? (
                                                <span className="px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950/30 text-brand-ink border border-red-500/20 font-bold text-[10px]">
                                                  {v.color}
                                                </span>
                                              ) : 'Standard'}
                                            </td>
                                            <td className="py-1.5 px-3 text-neutral-800 dark:text-neutral-200">
                                              {v.size ? (
                                                <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#222] text-neutral-700 dark:text-neutral-300 font-bold text-[10px] border border-neutral-200 dark:border-[#333]">
                                                  {v.size}
                                                </span>
                                              ) : 'Standard'}
                                            </td>
                                            <td className="py-1.5 px-3 font-bold text-neutral-900 dark:text-white text-[11px]">
                                              ${(v.price_override ?? prod.price).toFixed(2)}
                                            </td>
                                            <td className="py-1.5 px-3 text-[11px]">
                                              <span className={cn(
                                                "font-bold px-1.5 py-0.2 rounded text-[10px]",
                                                v.stock <= 0
                                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                                  : v.stock <= (v.min_stock_threshold ?? prod.minStockThreshold)
                                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                              )}>
                                                {v.stock} units
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-right">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAdjustingProduct(prod);
                                                  setAdjustingVariant(v);
                                                }}
                                                className="px-2 py-0.5 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:bg-[#222] dark:hover:bg-[#2a2a2a] dark:text-[#E4E4E4] border border-neutral-300 dark:border-[#333] rounded-[4px] cursor-pointer transition active:scale-95" disabled={!canManageInventory}
                                              >
                                                Restock
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Inventory Cards View */}
          <div className="md:hidden space-y-3">
            {filteredInventory.length === 0 ? (
              <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                No inventory records match the current filters.
              </div>
            ) : (
              visibleInventory.map(prod => {
                const isLowStock = inventoryStockStatus(prod) === 'LOW';
                const isOutOfStock = inventoryStockStatus(prod) === 'OUT';
                const maxBar = Math.max(prod.minStockThreshold * 2.5, 20);
                const percent = Math.min(100, Math.round((prod.stock / maxBar) * 100));

                return (
                  <div
                    key={prod.id}
                    role="article" aria-label={`Inventory product ${prod.name}`}
                    className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-3 font-mono"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-brand-ink bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-1.5 py-0.5 rounded">
                            {prod.sku}
                          </span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            {prod.category}
                          </span>
                          {prod.size && (
                            <span className="text-[9px] bg-neutral-100 dark:bg-[#202020] px-1.5 py-0.2 rounded text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626]">
                              {prod.size}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white mt-1 leading-snug">
                          {prod.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-1"><ProductVisibilityBadge product={prod} /><ProductVariantSetupNotice product={prod} /></div>
                        {prod.hasVariants && !prod.variants?.length && <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">Physical stock is retained. Configure variants before selling this item.</p>}
                        {prod.description && <p className="mt-2 line-clamp-2 break-words text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">{prod.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-neutral-900 dark:text-white">${prod.price.toFixed(2)}</div>
                        <div className="text-[9px] text-neutral-500 dark:text-neutral-400">Retail: ${inventoryRetailValue(prod).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Stock Health Bar */}
                    <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={cn(
                          "font-bold",
                          isOutOfStock ? "text-rose-600 dark:text-rose-400" : isLowStock ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        )}>
                          {prod.stock} units in stock
                        </span>
                        <span className="text-neutral-500">Min: {prod.minStockThreshold}</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                          )}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                      <button
                        type="button"
                        onClick={() => openEditProductModal(prod)}
                        className="flex-1 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation pointer-coarse:min-h-11" disabled={!canManageInventory}
                      >
                        <PencilSimple size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAdjustingVariant(null); setAdjustingProduct(prod); }}
                        className="flex-1 py-2 min-h-[38px] bg-brand/10 hover:bg-brand text-brand-ink hover:text-white border border-brand/20 rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation pointer-coarse:min-h-11" disabled={!canManageInventory}
                      >
                        <ArrowsClockwise size={13} />
                        <span>Restock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-[#888] dark:border-[#262626] rounded-[8px] transition cursor-pointer active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                        title="Archive product" disabled={!canManageInventory}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filteredInventory.length > limit && <button type="button" onClick={() => setPage({ signature, limit: limit + 48 })} className="min-h-11 self-center rounded-lg border border-neutral-300 bg-white px-5 text-xs font-semibold dark:border-neutral-700 dark:bg-[#141414]">Load more products</button>}
        </div>
      )}</>;
}
