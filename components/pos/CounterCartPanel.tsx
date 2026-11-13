'use client';
import { formatKHR } from '@/lib/pos-cart';
import React from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { Money } from '@phosphor-icons/react/dist/csr/Money';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';

import { User } from '@phosphor-icons/react/dist/csr/User';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';

import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { ChatCenteredText } from '@phosphor-icons/react/dist/csr/ChatCenteredText';
import type { ProductVariantItem, ProductItem, CartItem } from '@/lib/pos-types';
import type { Student } from '@/lib/store';


interface CounterCartPanelProps {
  parkedCart: { cart: CartItem[]; selectedStudentId: string; discountPercent: number; paymentMethod: "ABA Bank KHQR" | "Cash"; orderNotes: string; parkedAt: number; } | null;
  parkedItemsCount: number;
  parkedGrandTotal: number;
  resumeParkedCart: () => void;
  discardParkedCart: () => void;
  cart: CartItem[];
  parkCurrentCart: () => void;
  clearCart: () => void;
  studentComboboxRef: React.RefObject<HTMLDivElement | null>;
  selectedStudentId: string;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string>>;
  setStudentSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  selectedStudent: Student | undefined;
  getBeltColorClass: (belt: string) => "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700" | "bg-amber-100 text-amber-900 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40" | "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/40" | "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40" | "bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40" | "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40" | "bg-gradient-to-r from-red-600 to-slate-900 text-white border-red-700 shadow-sm" | "bg-slate-900 text-white border-slate-950 dark:bg-black dark:text-white dark:border-red-500/50 shadow-sm" | "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-[#262626] dark:text-neutral-300 dark:border-[#333]";
  state: ReturnType<typeof useAppStore>['state'];
  studentSearchTerm: string;
  setIsStudentDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStudentDropdownOpen: boolean;
  filteredStudents: Student[];
  getCartItemKey: (item: { product: ProductItem; variant?: ProductVariantItem; }) => string;
  updateQuantity: (key: string, delta: number) => void;
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
  grandTotal: number;
  setPaymentMethod: React.Dispatch<React.SetStateAction<"ABA Bank KHQR" | "Cash">>;
  paymentMethod: "ABA Bank KHQR" | "Cash";
  cashTendered: string;
  setCashTendered: React.Dispatch<React.SetStateAction<string>>;
  isCashInsufficient: boolean;
  tenderedAmountNumber: number;
  changeDue: number;
  setIsKhqrModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canCreateOrder: boolean;
  executeCompleteSale: (bankReference?: string) => Promise<void>;
  isCatalogLoading: boolean;
  dataErrors: Record<string, string>;
  isCheckoutPending: boolean;
}

export function CounterCartPanel({ parkedCart, parkedItemsCount, parkedGrandTotal, resumeParkedCart, discardParkedCart, cart, parkCurrentCart, clearCart, studentComboboxRef, selectedStudentId, setSelectedStudentId, setStudentSearchTerm, selectedStudent, getBeltColorClass, state, studentSearchTerm, setIsStudentDropdownOpen, isStudentDropdownOpen, filteredStudents, getCartItemKey, updateQuantity, removeFromCart, setIsNotesExpanded, isNotesExpanded, orderNotes, setOrderNotes, clampedDiscount, discountPercent, setDiscountPercent, subtotal, discountAmount, grandTotal, setPaymentMethod, paymentMethod, cashTendered, setCashTendered, isCashInsufficient, tenderedAmountNumber, changeDue, setIsKhqrModalOpen, canCreateOrder, executeCompleteSale, isCatalogLoading, dataErrors, isCheckoutPending }: CounterCartPanelProps) {
  return <>{<div
            id="pos-checkout-cart"
            className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-90px)] flex flex-col bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm relative"
          >
            {/* Parked / Held Cart Notification Banner */}
            {parkedCart && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-[8px] p-2.5 flex items-center justify-between text-xs font-mono text-amber-900 dark:text-amber-300 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Pause size={14} weight="bold" className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold">Hold: {parkedItemsCount} item{parkedItemsCount > 1 ? 's' : ''} (${parkedGrandTotal.toFixed(2)})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={resumeParkedCart}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] font-bold text-[10px] cursor-pointer transition flex items-center gap-1 shadow-sm"
                  >
                    <Play size={10} weight="fill" /> Resume
                  </button>
                  <button
                    type="button"
                    onClick={discardParkedCart}
                    className="p-1 hover:bg-amber-200 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 rounded-[6px] cursor-pointer transition"
                    title="Discard held cart"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-brand-ink" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-900 dark:text-white">
                  CHECKOUT TERMINAL
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {cart.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={parkCurrentCart}
                      className="px-2 py-0.5 text-[9px] font-mono text-neutral-700 hover:text-amber-600 dark:text-neutral-300 dark:hover:text-amber-400 border border-neutral-200 dark:border-[#262626] bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] transition cursor-pointer flex items-center gap-1"
                      title="Hold current cart to serve next customer"
                    >
                      <Pause size={10} weight="bold" /> Hold
                    </button>
                    <button
                      type="button"
                      onClick={clearCart}
                      className="px-2 py-0.5 text-[9px] font-mono text-neutral-700 hover:text-brand-ink dark:text-neutral-300 dark:hover:text-brand-ink border border-neutral-200 dark:border-[#262626] bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] transition cursor-pointer flex items-center gap-1"
                      title="Clear Cart"
                    >
                      <Trash size={10} /> Clear
                    </button>
                  </>
                )}
                <span className="text-[10px] font-mono bg-neutral-100 dark:bg-[#0F0F0F] px-2 py-0.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)} ITEMS
                </span>
              </div>
            </div>

            {/* Customer Tagging: Searchable Combobox with Belt Badges */}
            <div className="mb-3 shrink-0 relative" ref={studentComboboxRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] font-mono font-bold uppercase text-neutral-600 dark:text-neutral-400">
                  CUSTOMER / STUDENT
                </label>
                {selectedStudentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId('');
                      setStudentSearchTerm('');
                    }}
                    className="text-[9px] font-mono text-amber-700 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <X size={10} /> Switch to Walk-in
                  </button>
                )}
              </div>

              {selectedStudent ? (
                /* Selected Student Card */
                <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px] flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#202020] border-2 border-red-500/40 flex items-center justify-center font-bold text-xs text-neutral-800 dark:text-neutral-200 shrink-0">
                      {selectedStudent.englishName ? selectedStudent.englishName.slice(0, 2).toUpperCase() : 'ST'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {selectedStudent.englishName}
                        </p>
                        {selectedStudent.khmerName && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                            ({selectedStudent.khmerName})
                          </span>
                        )}
                        <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold", getBeltColorClass(selectedStudent.currentBelt))}>
                          {selectedStudent.currentBelt}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {state.branches.find(b => b.id === selectedStudent.homeBranchId)?.name || 'Dojang Member'} • {selectedStudent.phone || selectedStudent.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId('')}
                    className="p-1 text-neutral-400 hover:text-brand-ink dark:text-neutral-500 dark:hover:text-brand-ink cursor-pointer transition ml-2"
                    title="Remove Tag"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                /* Searchable Combobox Input */
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search student by name, belt, or phone..."
                      value={studentSearchTerm}
                      onFocus={() => setIsStudentDropdownOpen(true)}
                      onChange={e => {
                        setStudentSearchTerm(e.target.value);
                        setIsStudentDropdownOpen(true);
                      }}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 rounded-[8px] focus:outline-none focus:border-brand font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                    {studentSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options */}
                  {isStudentDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl max-h-56 overflow-y-auto scrollbar-thin">
                      <div
                        onClick={() => {
                          setSelectedStudentId('');
                          setStudentSearchTerm('');
                          setIsStudentDropdownOpen(false);
                        }}
                        className="px-3 py-2.5 min-h-[44px] text-xs font-mono text-amber-700 dark:text-amber-400 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] cursor-pointer border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between active:bg-neutral-200 dark:active:bg-[#202020] touch-manipulation"
                      >
                        <span className="font-bold">-- Walk-in Customer / Parent (No Tag) --</span>
                        <User size={14} />
                      </div>

                      {filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400">
                          No students found matching &quot;{studentSearchTerm}&quot;.
                        </div>
                      ) : (
                        filteredStudents.map(s => {
                          const branchName = state.branches.find(b => b.id === s.homeBranchId)?.name;
                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setIsStudentDropdownOpen(false);
                                setStudentSearchTerm('');
                              }}
                              className="px-3 py-2.5 min-h-[44px] text-xs font-mono hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] cursor-pointer border-b border-neutral-100 dark:border-[#1f1f1f] last:border-none flex items-center justify-between active:bg-neutral-200 dark:active:bg-[#202020] touch-manipulation"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-neutral-900 dark:text-white truncate">{s.englishName}</span>
                                  {s.khmerName && <span className="text-[10px] text-neutral-500 dark:text-neutral-400">({s.khmerName})</span>}
                                </div>
                                <p className="text-[9px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                  {branchName || 'Dojang'} • {s.phone || s.id}
                                </p>
                              </div>
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase shrink-0 font-bold", getBeltColorClass(s.currentBelt))}>
                                {s.currentBelt}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List - SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-[120px] max-h-[240px] space-y-2 mb-3">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-[#262626] rounded-[8px] flex flex-col items-center justify-center bg-neutral-50 dark:bg-transparent">
                  <ShoppingCart size={24} className="text-neutral-400 dark:text-[#444] mb-2" />
                  Cart is empty. Click items to add.
                </div>
              ) : (
                cart.map(item => {
                  const itemKey = getCartItemKey(item);
                  const itemPrice = item.variant?.price_override ?? item.product.price;
                  return (
                    <div key={itemKey} className="flex items-center justify-between bg-neutral-50 dark:bg-[#0F0F0F] p-2.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] shadow-sm">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-bold text-neutral-900 dark:text-white truncate">
                            {item.product.name}
                          </p>
                          {item.variant ? (
                            <>
                              {item.variant.color && (
                                <span className="text-[9px] font-mono bg-red-50 dark:bg-red-950/30 text-brand-ink border border-red-500/30 px-1 rounded font-bold">
                                  {item.variant.color}
                                </span>
                              )}
                              {item.variant.size && (
                                <span className="text-[9px] font-mono bg-neutral-200 dark:bg-[#202020] px-1 rounded text-neutral-700 dark:text-neutral-300 font-bold">
                                  {item.variant.size}
                                </span>
                              )}
                            </>
                          ) : item.product.size ? (
                            <span className="text-[9px] font-mono bg-neutral-200 dark:bg-[#202020] px-1 rounded text-neutral-600 dark:text-neutral-400">
                              {item.product.size}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[9px] font-mono text-neutral-600 dark:text-neutral-400 mt-0.5">
                          <span className="text-neutral-400 mr-1">SKU: {item.variant?.sku || item.product.sku}</span>
                          • ${itemPrice.toFixed(2)} × {item.quantity} = <strong className="text-brand-ink">${(itemPrice * item.quantity).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, -1)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1a1a1a] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[6px] cursor-pointer active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Decrease"
                        >
                          <Minus size={11} weight="bold" />
                        </button>
                        <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, 1)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1a1a1a] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[6px] cursor-pointer active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Increase"
                        >
                          <Plus size={11} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(itemKey)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center text-neutral-400 hover:text-brand-ink dark:text-neutral-500 dark:hover:text-brand-ink ml-0.5 cursor-pointer transition-colors active:scale-90 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          title="Remove"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Notes Collapsible Section */}
            <div className="mb-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                aria-expanded={isNotesExpanded}
                className="min-h-8 pointer-coarse:min-h-9 text-[10px] font-mono text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1 touch-manipulation"
              >
                <ChatCenteredText size={12} weight={orderNotes ? "fill" : "regular"} className={orderNotes ? "text-brand-ink" : ""} />
                <span>Order Notes {orderNotes ? `("${orderNotes.slice(0, 15)}...")` : ''}</span>
                <span className="text-[9px] text-neutral-400">({isNotesExpanded ? 'Hide' : 'Add'})</span>
              </button>
              {isNotesExpanded && (
                <div className="mt-1.5 animate-in fade-in">
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Embroidery name, uniform size swap, pickup notes..."
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] p-2 rounded-[6px] focus:outline-none focus:border-brand font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Financial Calculations & Checkout Tools */}
            <div className="border-t border-neutral-200 dark:border-[#262626] pt-3 space-y-3 shrink-0">

              {/* Discount Controls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                  <span>DISCOUNT ({clampedDiscount}%):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      inputMode="numeric"
                      aria-label="Discount percent"
                      onChange={e => setDiscountPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="min-h-8 pointer-coarse:min-h-9 w-14 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="flex gap-1">
                  {[0, 5, 10, 15, 20].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiscountPercent(d)}
                      className={cn(
                        "flex-1 py-1 min-h-[34px] text-[10px] font-mono rounded-[6px] border transition cursor-pointer font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                        discountPercent === d
                          ? "bg-brand text-white border-brand shadow-sm"
                          : "bg-neutral-100 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtotal & Dual-Currency Grand Total */}
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-brand-ink">
                    <span>Discount ({clampedDiscount}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1.5 border-t border-neutral-200 dark:border-[#262626]">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 dark:text-white block">GRAND TOTAL:</span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Exchange @ 4,100 KHR</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-brand-ink block leading-tight">
                      ${grandTotal.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 font-mono">
                      ≈ {formatKHR(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ABA Bank KHQR')}
                  className={cn(
                    "p-2.5 min-h-[44px] text-xs font-mono rounded-[8px] border flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 touch-manipulation",
                    paymentMethod === 'ABA Bank KHQR'
                      ? "bg-red-50 text-brand-ink border-brand dark:bg-red-500/10 dark:text-brand-ink dark:border-brand font-bold shadow-sm"
                      : "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <QrCode size={16} weight="bold" /> ABA KHQR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={cn(
                    "p-2.5 min-h-[44px] text-xs font-mono rounded-[8px] border flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 touch-manipulation",
                    paymentMethod === 'Cash'
                      ? "bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500 font-bold shadow-sm"
                      : "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <Money size={16} weight="bold" /> CASH DRAWER
                </button>
              </div>

              {/* CASH REGISTER TOOLS: Tendered & Change Calculator with KHR */}
              {paymentMethod === 'Cash' && cart.length > 0 && (
                <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px] space-y-2 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                    <span>CASH TENDERED (USD):</span>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-900 dark:text-white font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        className="w-20 bg-white dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2 py-1 text-right text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Preset Bills */}
                  <div className="flex gap-1">
                    {[10, 20, 50, 100].map(bill => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => setCashTendered(String(bill))}
                        className="flex-1 py-1.5 min-h-[36px] bg-white hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#202020] border border-neutral-200 dark:border-[#262626] text-xs font-mono text-neutral-800 dark:text-[#ccc] rounded-[6px] transition cursor-pointer font-bold active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                      >
                        ${bill}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal.toFixed(2))}
                      className="px-2.5 py-1.5 min-h-[36px] bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-xs font-mono text-emerald-800 dark:text-emerald-400 font-bold rounded-[6px] transition cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                      title="Exact amount"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Change Due Display in USD and KHR */}
                  <div className="flex items-center justify-between text-xs font-mono pt-1.5 border-t border-neutral-200 dark:border-[#1f1f1f]">
                    <span className="text-neutral-600 dark:text-neutral-400">CHANGE DUE:</span>
                    <div className="text-right">
                      <span className={cn("font-black block", isCashInsufficient ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {isCashInsufficient ? `Short by $${(grandTotal - tenderedAmountNumber).toFixed(2)}` : `$${changeDue.toFixed(2)}`}
                      </span>
                      {!isCashInsufficient && changeDue > 0 && (
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block">
                          ≈ {formatKHR(changeDue)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Checkout Actions */}
              {paymentMethod === 'ABA Bank KHQR' ? (
                <button
                  type="button"
                  onClick={() => setIsKhqrModalOpen(true)}
                  disabled={!canCreateOrder || (cart.length === 0)}
                  className={cn(
                    "w-full py-3.5 min-h-[48px] text-xs sm:text-sm font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 touch-manipulation",
                    cart.length === 0
                      ? "bg-neutral-200 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] border border-neutral-300 dark:border-[#262626] cursor-not-allowed"
                      : "bg-brand hover:bg-brand-strong text-white cursor-pointer shadow-red-500/20"
                  )}
                >
                  <QrCode size={18} weight="bold" />
                  VERIFY BANK PAYMENT (${grandTotal.toFixed(2)})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={()=>void executeCompleteSale()}
                  disabled={!canCreateOrder || (cart.length === 0 || isCashInsufficient || isCatalogLoading || Boolean(dataErrors.catalog) || isCheckoutPending)}
                  className={cn(
                    "w-full py-3.5 min-h-[48px] text-xs sm:text-sm font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 touch-manipulation",
                    cart.length === 0 || isCashInsufficient
                      ? "bg-neutral-200 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] border border-neutral-300 dark:border-[#262626] cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-500/20"
                  )}
                >
                  <CheckCircle size={18} weight="bold" />
                  {isCheckoutPending ? 'Recording sale…' : `COMPLETE CASH SALE ($${grandTotal.toFixed(2)})`}
                </button>
              )}

            </div>
          </div>}</>;
}
