'use client';
import { inventoryStockStatus } from '@/lib/pos-catalog';
import { formatKHR } from '@/lib/pos-cart';
import React from 'react';
import { cn } from '@/lib/utils';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Tag } from '@phosphor-icons/react/dist/csr/Tag';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Storefront } from '@phosphor-icons/react/dist/csr/Storefront';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { SortAscending } from '@phosphor-icons/react/dist/csr/SortAscending';
import { GridFour } from '@phosphor-icons/react/dist/csr/GridFour';
import { List } from '@phosphor-icons/react/dist/csr/List';
import type { ProductVariantItem, ProductItem, CartItem } from '@/lib/pos-types';


interface CounterCatalogPanelProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setOnlyLowStock: React.Dispatch<React.SetStateAction<boolean>>;
  onlyLowStock: boolean;
  sortOption: "default" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc" | "name-asc";
  setSortOption: React.Dispatch<React.SetStateAction<"default" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc" | "name-asc">>;
  setPosViewMode: React.Dispatch<React.SetStateAction<"grid" | "compact">>;
  posViewMode: "grid" | "compact";
  fetchCatalog: () => Promise<ProductItem[] | undefined>;
  isCatalogLoading: boolean;
  dynamicCategories: string[];
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  filteredProducts: ProductItem[];
  catalog: ProductItem[];
  cartQuantities: Record<string, number>;
  canCreateOrder: boolean;
  addToCart: (product: ProductItem, variant?: ProductVariantItem, quantityToAdd?: number) => void;
  updateQuantity: (key: string, delta: number) => void;
  getCartItemKey: (item: { product: ProductItem; variant?: ProductVariantItem; }) => string;
  cart: CartItem[];
  grandTotal: number;
}

export function CounterCatalogPanel({ searchQuery, setSearchQuery, setOnlyLowStock, onlyLowStock, sortOption, setSortOption, setPosViewMode, posViewMode, fetchCatalog, isCatalogLoading, dynamicCategories, selectedCategory, categoryCounts, setSelectedCategory, filteredProducts, catalog, cartQuantities, canCreateOrder, addToCart, updateQuantity, getCartItemKey, cart, grandTotal }: CounterCatalogPanelProps) {
  return <>{<div className="lg:col-span-8 flex flex-col space-y-3.5">

            {/* Category Filter Pills, Search Bar & Quick Controls */}
            <div className="flex flex-col gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 sm:p-4 rounded-[8px] shadow-sm">
              {/* LINE 1: Primary Search Input & Terminal Action Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search Bar (takes flexible available space) */}
                <div className="relative flex-1">
                  <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search product name, SKU code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-9 pr-8 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-mono transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Right Controls: Low Stock Toggle + Sort Dropdown + Grid/List View Toggle + Refresh */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-1 sm:pb-0 shrink-0">
                  {/* Low Stock Toggle */}
                  <button
                    type="button"
                    onClick={() => setOnlyLowStock(!onlyLowStock)}
                    className={cn(
                      "px-3 py-1.5 min-h-[38px] text-[11px] font-mono rounded-[8px] border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      onlyLowStock
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-bold shadow-xs"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] dark:hover:text-white"
                    )}
                    title="Filter only low stock or out of stock items"
                  >
                    <Warning size={13} weight={onlyLowStock ? "fill" : "regular"} className={onlyLowStock ? "text-amber-500" : ""} />
                    <span>Low Stock</span>
                  </button>

                  {/* Sort By Dropdown */}
                  <div className="flex items-center bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1 min-h-[38px] gap-1.5 shrink-0">
                    <SortAscending size={13} className="text-neutral-400 shrink-0" />
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as any)}
                      aria-label="Sort product catalog"
                      className="bg-transparent text-neutral-800 dark:text-[#ccc] text-[11px] font-mono focus:outline-none cursor-pointer py-1"
                    >
                      <option value="default">Default</option>
                      <option value="name-asc">Name: A to Z</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="stock-asc">Stock: Low to High</option>
                      <option value="stock-desc">Stock: High to Low</option>
                    </select>
                  </div>

                  {/* Grid / List Mode Switcher */}
                  <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] p-0.5 border border-neutral-200 dark:border-[#262626] shrink-0 min-h-[38px]">
                    <button
                      type="button"
                      onClick={() => setPosViewMode('grid')}
                      className={cn(
                        "px-2.5 py-1 min-h-[32px] rounded-[6px] transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                        posViewMode === 'grid'
                          ? "bg-white dark:bg-[#222] text-neutral-900 dark:text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                      title="Card Grid View"
                    >
                      <GridFour size={13} weight={posViewMode === 'grid' ? "fill" : "regular"} />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosViewMode('compact')}
                      className={cn(
                        "px-2.5 py-1 min-h-[32px] rounded-[6px] transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                        posViewMode === 'compact'
                          ? "bg-white dark:bg-[#222] text-neutral-900 dark:text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                      title="Compact Rapid List View"
                    >
                      <List size={13} weight={posViewMode === 'compact' ? "bold" : "regular"} />
                      <span>List</span>
                    </button>
                  </div>

                  {/* Manual Refresh Sync Button */}
                  <button
                    type="button"
                    onClick={() => fetchCatalog()}
                    disabled={isCatalogLoading}
                    className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] cursor-pointer disabled:opacity-50 transition-colors shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                    title="Refresh live catalog from database"
                  >
                    <ArrowsClockwise size={14} className={isCatalogLoading ? "animate-spin text-[#EF2F38]" : ""} />
                  </button>
                </div>
              </div>

              {/* LINE 2: DEDICATED FULL-WIDTH CATEGORY FILTER ROW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-neutral-100 dark:border-[#202020]">
                {/* Horizontal Scrolling Pill Category Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap min-w-0">
                  {dynamicCategories.map(cat => {
                    const isSelected = selectedCategory === cat;
                    const count = categoryCounts[cat] ?? 0;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 min-h-[34px] text-[11px] font-mono rounded-[8px] border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 select-none active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                          isSelected
                            ? "bg-[#EF2F38] text-white font-bold border-[#EF2F38] shadow-sm shadow-red-500/20 ring-1 ring-[#EF2F38]"
                            : "bg-neutral-100/80 text-neutral-700 border-neutral-200/90 hover:bg-neutral-200/70 hover:text-neutral-900 dark:bg-[#1a1a1a] dark:text-neutral-300 dark:border-[#262626] dark:hover:bg-[#222] dark:hover:text-white"
                        )}
                      >
                        <span>{cat}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] rounded-full font-mono font-bold leading-none tabular-nums",
                            isSelected
                              ? "bg-white/25 text-white"
                              : "bg-neutral-200 dark:bg-[#292929] text-neutral-600 dark:text-neutral-400"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Filter Status & Reset Action */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0 self-end sm:self-center">
                  <span>
                    Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredProducts.length}</span> of {catalog.length}
                  </span>
                  {(selectedCategory !== 'All' || searchQuery || onlyLowStock) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        setSearchQuery('');
                        setOnlyLowStock(false);
                      }}
                      className="text-[#EF2F38] hover:underline font-bold cursor-pointer ml-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PRODUCT CATALOG DISPLAY (Grid vs Compact List) */}
            {isCatalogLoading && catalog.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 flex-1">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="animate-pulse border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#141414] space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-20" />
                      <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-16" />
                    </div>
                    <div className="h-5 bg-neutral-200 dark:bg-[#222] rounded w-3/4" />
                    <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-1/3" />
                    <div className="h-8 bg-neutral-200 dark:bg-[#222] rounded mt-4" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-[#262626] rounded-[8px] bg-neutral-50 dark:bg-[#0F0F0F] space-y-2">
                <Storefront size={28} className="mx-auto text-neutral-400 dark:text-neutral-500 mb-1" />
                <p className="font-bold text-neutral-700 dark:text-neutral-300">No products found</p>
                <p className="text-[11px] text-neutral-500">
                  {catalog.length === 0
                    ? 'No products available in the database. Use "+ ADD ITEM" to create one.'
                    : 'No items match your active search or category filters.'}
                </p>
                {(selectedCategory !== 'All' || searchQuery || onlyLowStock) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                      setOnlyLowStock(false);
                    }}
                    className="mt-2 px-3 py-1.5 bg-[#EF2F38] text-white text-[11px] rounded-[6px] font-bold cursor-pointer hover:bg-[#d6242c] transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : posViewMode === 'grid' ? (
              /* MODE A: CARD GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 flex-1">
                {filteredProducts.map(product => {
                  const inCartQty = cartQuantities[product.id] || 0;
                  const isLowStock = inventoryStockStatus(product) === 'LOW';
                  const isOutOfStock = inventoryStockStatus(product) === 'OUT';
                  const stockRatio = Math.min(100, Math.max(0, (product.stock / Math.max(product.minStockThreshold * 2, 10)) * 100));

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "group relative border rounded-[8px] p-3.5 flex flex-col justify-between transition-all duration-200 shadow-sm",
                        inCartQty > 0
                          ? "border-[#EF2F38]/60 ring-1 ring-[#EF2F38]/20 bg-red-50/40 dark:bg-red-950/15"
                          : isOutOfStock
                          ? "bg-neutral-50 dark:bg-[#111] border-neutral-200 dark:border-[#262626] opacity-65"
                          : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626] hover:border-[#EF2F38]/40 hover:shadow-md"
                      )}
                    >
                      <div>
                        {/* Header: SKU Badge + Stock Badge */}
                        <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                          <span className="bg-neutral-100 dark:bg-[#0F0F0F] px-2 py-0.5 rounded-[6px] border border-neutral-200 dark:border-[#262626] font-bold text-neutral-700 dark:text-neutral-300">
                            {product.sku}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-[6px] border border-rose-200 dark:border-rose-500/20">
                              <Warning size={10} weight="fill" /> OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-[6px] border border-amber-200 dark:border-amber-500/20">
                              <Warning size={10} weight="fill" /> LOW: {product.stock} LEFT
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-[6px] border border-emerald-200 dark:border-emerald-500/20">
                              {product.stock} IN STOCK
                            </span>
                          )}
                        </div>

                        {/* Visual Stock Meter Bar */}
                        <div className="w-full bg-neutral-100 dark:bg-[#202020] h-1 rounded-full overflow-hidden mb-2.5">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              isOutOfStock
                                ? "bg-rose-500"
                                : isLowStock
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${isOutOfStock ? 0 : Math.max(8, stockRatio)}%` }}
                          />
                        </div>

                        {/* Product Title & Metadata */}
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors leading-snug">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 flex-wrap">
                          <span>{product.category}</span>
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <>
                              <span>•</span>
                              <span className="bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 px-1.5 py-0.2 rounded font-bold">
                                {product.variants.length} Variations
                              </span>
                              {product.sizes && product.sizes.length > 0 && (
                                <span className="text-[9px] text-neutral-400 truncate max-w-[140px]">
                                  ({product.sizes.join(', ')})
                                </span>
                              )}
                            </>
                          ) : product.size ? (
                            <>
                              <span>•</span>
                              <span className="bg-neutral-100 dark:bg-[#1a1a1a] px-1.5 py-0.2 rounded border border-neutral-200 dark:border-[#262626] font-bold text-neutral-700 dark:text-neutral-300">
                                Size {product.size}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Card Footer: Price, Inventory Actions & Cart Controls */}
                      <div className="flex items-center justify-between border-t border-neutral-200 dark:border-[#262626] pt-3 mt-3">
                        {/* Price Tag with KHR estimate */}
                        <div className="flex flex-col">
                          <span className="text-sm font-black font-mono text-neutral-900 dark:text-white">
                            ${product.price.toFixed(2)}
                          </span>
                          <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 leading-none">
                            ≈ {formatKHR(product.price)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              {inCartQty > 0 && (
                                <span className="text-[10px] font-mono font-bold text-[#EF2F38] bg-red-50 dark:bg-red-950/30 border border-red-500/30 px-1.5 py-0.5 rounded">
                                  {inCartQty} in cart
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={!canCreateOrder || (isOutOfStock)}
                                onClick={() => addToCart(product)}
                                className={cn(
                                  "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation cursor-pointer pointer-coarse:min-h-11",
                                  isOutOfStock
                                    ? "bg-neutral-100 text-neutral-400 border border-neutral-200 dark:bg-[#1a1a1a] dark:text-[#555] dark:border-[#262626] cursor-not-allowed"
                                    : "bg-[#EF2F38] hover:bg-[#d6242c] text-white shadow-xs"
                                )}
                              >
                                <Tag size={13} weight="bold" /> Choose Size
                              </button>
                            </div>
                          ) : inCartQty > 0 ? (
                            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[8px] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#1f1f1f] text-neutral-800 dark:text-white rounded-[6px] transition cursor-pointer active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                                title="Decrease"
                              >
                                <Minus size={13} weight="bold" />
                              </button>
                              <span className="text-xs font-mono font-bold text-[#EF2F38] px-1.5 min-w-[22px] text-center">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={!canCreateOrder || (inCartQty >= product.stock)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#1f1f1f] text-neutral-800 dark:text-white rounded-[6px] transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                                title="Increase"
                              >
                                <Plus size={13} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!canCreateOrder || (isOutOfStock)}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 dark:bg-[#1a1a1a] dark:text-[#555] dark:border-[#262626] cursor-not-allowed"
                                  : "bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                              )}
                            >
                              <Plus size={13} weight="bold" /> ADD
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODE B: COMPACT LIST VIEW (RAPID RETAIL SCANNER) */
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-[10px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-[#262626]">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Product Name & Sizing</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Stock Status</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3 text-right">Quick Checkout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-[#1f1f1f]">
                      {filteredProducts.map(product => {
                        const inCartQty = cartQuantities[product.id] || 0;
                        const isLowStock = inventoryStockStatus(product) === 'LOW';
                        const isOutOfStock = inventoryStockStatus(product) === 'OUT';

                        return (
                          <tr
                            key={product.id}
                            className={cn(
                              "transition-colors",
                              inCartQty > 0
                                ? "bg-red-50/50 dark:bg-red-950/20"
                                : isOutOfStock
                                ? "opacity-60 bg-neutral-50/50 dark:bg-[#111]"
                                : "hover:bg-neutral-50 dark:hover:bg-[#1a1a1a]"
                            )}
                          >
                            <td className="py-2.5 px-3 font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                              {product.sku}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900 dark:text-white">
                                  {product.name}
                                </span>
                                {product.hasVariants && product.variants && product.variants.length > 0 ? (
                                  <span className="text-[9px] bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 px-1.5 py-0.2 rounded font-bold whitespace-nowrap">
                                    {product.variants.length} Variants
                                  </span>
                                ) : product.size ? (
                                  <span className="text-[9px] bg-neutral-100 dark:bg-[#222] px-1.5 py-0.2 rounded border border-neutral-200 dark:border-[#333] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                    Size {product.size}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                              {product.category}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isOutOfStock ? (
                                <span className="text-rose-700 dark:text-rose-400 font-bold text-[10px] flex items-center gap-1">
                                  <Warning size={10} weight="fill" /> OUT
                                </span>
                              ) : isLowStock ? (
                                <span className="text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1">
                                  <Warning size={10} weight="fill" /> LOW ({product.stock})
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                  {product.stock} in stock
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-black text-neutral-900 dark:text-white">
                                ${product.price.toFixed(2)}
                              </span>
                              <span className="block text-[9px] text-neutral-500 dark:text-neutral-400 leading-none">
                                ≈ {formatKHR(product.price)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end">
                                {product.hasVariants && product.variants && product.variants.length > 0 ? (
                                  <button
                                    type="button"
                                    disabled={!canCreateOrder || (isOutOfStock)}
                                    onClick={() => addToCart(product)}
                                    className={cn(
                                      "px-2.5 py-1 text-[10px] font-mono font-bold rounded-[6px] flex items-center gap-1 transition active:scale-95 touch-manipulation cursor-pointer",
                                      isOutOfStock
                                        ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                        : "bg-[#EF2F38] text-white hover:bg-[#d6242c]"
                                    )}
                                  >
                                    <Tag size={11} weight="bold" /> {inCartQty > 0 ? `(${inCartQty}) Choose` : 'Choose'}
                                  </button>
                                ) : inCartQty > 0 ? (
                                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[6px] p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer active:scale-90 touch-manipulation"
                                    >
                                      <Minus size={10} weight="bold" />
                                    </button>
                                    <span className="text-xs font-bold text-[#EF2F38] px-1.5 min-w-[18px] text-center">
                                      {inCartQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addToCart(product)}
                                      disabled={!canCreateOrder || (inCartQty >= product.stock)}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation"
                                    >
                                      <Plus size={10} weight="bold" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!canCreateOrder || (isOutOfStock)}
                                    onClick={() => addToCart(product)}
                                    className={cn(
                                      "px-2.5 py-1 text-[10px] font-mono font-bold rounded-[6px] flex items-center gap-1 transition active:scale-95 touch-manipulation",
                                      isOutOfStock
                                        ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                        : "bg-[#EF2F38]/10 text-[#EF2F38] hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                                    )}
                                  >
                                    <Plus size={10} weight="bold" /> ADD
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Rapid Row Scanner List */}
                <div className="md:hidden divide-y divide-neutral-200 dark:divide-[#1f1f1f]">
                  {filteredProducts.map(product => {
                    const inCartQty = cartQuantities[product.id] || 0;
                    const isLowStock = inventoryStockStatus(product) === 'LOW';
                    const isOutOfStock = inventoryStockStatus(product) === 'OUT';

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "p-3 flex items-center justify-between gap-3 transition-colors",
                          inCartQty > 0
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : isOutOfStock
                            ? "opacity-60 bg-neutral-50/50 dark:bg-[#111]"
                            : ""
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626]">
                              {product.sku}
                            </span>
                            {product.hasVariants && product.variants && product.variants.length > 0 ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 font-bold">
                                {product.variants.length} Variations
                              </span>
                            ) : product.size ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#222] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
                                {product.size}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate mt-1">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono">
                            <span className="font-bold text-[#EF2F38]">${product.price.toFixed(2)}</span>
                            <span>•</span>
                            {isOutOfStock ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">OUT</span>
                            ) : isLowStock ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{product.stock} left</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">{product.stock} in stock</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Touch Controls */}
                        <div className="shrink-0 flex items-center">
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <button
                              type="button"
                              disabled={!canCreateOrder || (isOutOfStock)}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1 transition active:scale-95 touch-manipulation cursor-pointer pointer-coarse:min-h-11",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                  : "bg-[#EF2F38] text-white shadow-xs"
                              )}
                            >
                              <Tag size={12} weight="bold" /> {inCartQty > 0 ? `(${inCartQty}) Choose` : 'Choose'}
                            </button>
                          ) : inCartQty > 0 ? (
                            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[8px] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                              >
                                <Minus size={12} weight="bold" />
                              </button>
                              <span className="text-xs font-bold font-mono text-[#EF2F38] px-1.5 min-w-[20px] text-center">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={!canCreateOrder || (inCartQty >= product.stock)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                              >
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!canCreateOrder || (isOutOfStock)}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1 transition active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                  : "bg-[#EF2F38]/10 text-[#EF2F38] hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                              )}
                            >
                              <Plus size={12} weight="bold" /> ADD
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile/Tablet Fixed Cart Quick Bar */}
            {cart.length > 0 && (
              <div className="lg:hidden fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-80 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 p-2.5 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2.5 pl-2">
                  <ShoppingCart size={18} className="text-[#EF2F38]" />
                  <div>
                    <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white block">
                      {cart.reduce((s, i) => s + i.quantity, 0)} items
                    </span>
                    <span className="text-xs font-mono font-black text-[#EF2F38]">
                      ${grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cartEl = document.getElementById('pos-checkout-cart');
                    cartEl?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 min-h-[44px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation flex items-center justify-center gap-1"
                >
                  Checkout →
                </button>
              </div>
            )}
          </div>}</>;
}
