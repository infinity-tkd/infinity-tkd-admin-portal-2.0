'use client';
import dynamic from 'next/dynamic';

import React from 'react';
import { useAppStore } from '@/lib/store';





















import type { ProductVariantItem, ProductItem, CartItem } from '@/lib/pos-types';



interface CounterTerminalPanelProps {
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
  parkedCart: { cart: CartItem[]; selectedStudentId: string; discountPercent: number; paymentMethod: "ABA Bank KHQR" | "Cash"; orderNotes: string; parkedAt: number; } | null;
  parkedItemsCount: number;
  parkedGrandTotal: number;
  resumeParkedCart: () => void;
  discardParkedCart: () => void;
  parkCurrentCart: () => void;
  clearCart: () => void;
  studentComboboxRef: React.RefObject<HTMLDivElement | null>;
  selectedStudentId: string;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string>>;
  setStudentSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  selectedStudent: import("@/lib/store").Student | undefined;
  getBeltColorClass: (belt: string) => "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700" | "bg-amber-100 text-amber-900 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40" | "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/40" | "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40" | "bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40" | "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40" | "bg-gradient-to-r from-red-600 to-slate-900 text-white border-red-700 shadow-sm" | "bg-slate-900 text-white border-slate-950 dark:bg-black dark:text-white dark:border-red-500/50 shadow-sm" | "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-[#262626] dark:text-neutral-300 dark:border-[#333]";
  state: ReturnType<typeof useAppStore>['state'];
  studentSearchTerm: string;
  setIsStudentDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStudentDropdownOpen: boolean;
  filteredStudents: import("@/lib/store").Student[];
  removeFromCart: (cartItemKey: string) => void;
  setIsNotesExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isNotesExpanded: boolean;
  orderNotes: string;
  setOrderNotes: React.Dispatch<React.SetStateAction<string>>;
  clampedDiscount: number;
  discountPercent: number;
  setDiscountPercent: React.Dispatch<React.SetStateAction<number>>;
  subtotal: number;
  discountAmount: number;
  setPaymentMethod: React.Dispatch<React.SetStateAction<"ABA Bank KHQR" | "Cash">>;
  paymentMethod: "ABA Bank KHQR" | "Cash";
  cashTendered: string;
  setCashTendered: React.Dispatch<React.SetStateAction<string>>;
  isCashInsufficient: boolean;
  tenderedAmountNumber: number;
  changeDue: number;
  setIsKhqrModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  executeCompleteSale: (bankReference?: string) => Promise<void>;
  dataErrors: Record<string, string>;
  isCheckoutPending: boolean;
}

const CounterCatalogPanel = dynamic(() => import('@/components/pos/CounterCatalogPanel').then(module => module.CounterCatalogPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const CounterCartPanel = dynamic(() => import('@/components/pos/CounterCartPanel').then(module => module.CounterCartPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

export function CounterTerminalPanel({ searchQuery, setSearchQuery, setOnlyLowStock, onlyLowStock, sortOption, setSortOption, setPosViewMode, posViewMode, fetchCatalog, isCatalogLoading, dynamicCategories, selectedCategory, categoryCounts, setSelectedCategory, filteredProducts, catalog, cartQuantities, canCreateOrder, addToCart, updateQuantity, getCartItemKey, cart, grandTotal, parkedCart, parkedItemsCount, parkedGrandTotal, resumeParkedCart, discardParkedCart, parkCurrentCart, clearCart, studentComboboxRef, selectedStudentId, setSelectedStudentId, setStudentSearchTerm, selectedStudent, getBeltColorClass, state, studentSearchTerm, setIsStudentDropdownOpen, isStudentDropdownOpen, filteredStudents, removeFromCart, setIsNotesExpanded, isNotesExpanded, orderNotes, setOrderNotes, clampedDiscount, discountPercent, setDiscountPercent, subtotal, discountAmount, setPaymentMethod, paymentMethod, cashTendered, setCashTendered, isCashInsufficient, tenderedAmountNumber, changeDue, setIsKhqrModalOpen, executeCompleteSale, dataErrors, isCheckoutPending }: CounterTerminalPanelProps) {
  return <fieldset disabled={isCheckoutPending} className="contents" aria-busy={isCheckoutPending}>{(
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-start">

          {/* CATALOG SECTION (8 Columns) */}
          <CounterCatalogPanel searchQuery={searchQuery} setSearchQuery={setSearchQuery} setOnlyLowStock={setOnlyLowStock} onlyLowStock={onlyLowStock} sortOption={sortOption} setSortOption={setSortOption} setPosViewMode={setPosViewMode} posViewMode={posViewMode} fetchCatalog={fetchCatalog} isCatalogLoading={isCatalogLoading} dynamicCategories={dynamicCategories} selectedCategory={selectedCategory} categoryCounts={categoryCounts} setSelectedCategory={setSelectedCategory} filteredProducts={filteredProducts} catalog={catalog} cartQuantities={cartQuantities} canCreateOrder={canCreateOrder} addToCart={addToCart} updateQuantity={updateQuantity} getCartItemKey={getCartItemKey} cart={cart} grandTotal={grandTotal} />

          {/* CART & CHECKOUT TERMINAL (4 Columns) - STICKY PANEL */}
          <CounterCartPanel parkedCart={parkedCart} parkedItemsCount={parkedItemsCount} parkedGrandTotal={parkedGrandTotal} resumeParkedCart={resumeParkedCart} discardParkedCart={discardParkedCart} cart={cart} parkCurrentCart={parkCurrentCart} clearCart={clearCart} studentComboboxRef={studentComboboxRef} selectedStudentId={selectedStudentId} setSelectedStudentId={setSelectedStudentId} setStudentSearchTerm={setStudentSearchTerm} selectedStudent={selectedStudent} getBeltColorClass={getBeltColorClass} state={state} studentSearchTerm={studentSearchTerm} setIsStudentDropdownOpen={setIsStudentDropdownOpen} isStudentDropdownOpen={isStudentDropdownOpen} filteredStudents={filteredStudents} getCartItemKey={getCartItemKey} updateQuantity={updateQuantity} removeFromCart={removeFromCart} setIsNotesExpanded={setIsNotesExpanded} isNotesExpanded={isNotesExpanded} orderNotes={orderNotes} setOrderNotes={setOrderNotes} clampedDiscount={clampedDiscount} discountPercent={discountPercent} setDiscountPercent={setDiscountPercent} subtotal={subtotal} discountAmount={discountAmount} grandTotal={grandTotal} setPaymentMethod={setPaymentMethod} paymentMethod={paymentMethod} cashTendered={cashTendered} setCashTendered={setCashTendered} isCashInsufficient={isCashInsufficient} tenderedAmountNumber={tenderedAmountNumber} changeDue={changeDue} setIsKhqrModalOpen={setIsKhqrModalOpen} canCreateOrder={canCreateOrder} executeCompleteSale={executeCompleteSale} isCatalogLoading={isCatalogLoading} dataErrors={dataErrors} isCheckoutPending={isCheckoutPending} />

        </div>
      )}</fieldset>;
}
