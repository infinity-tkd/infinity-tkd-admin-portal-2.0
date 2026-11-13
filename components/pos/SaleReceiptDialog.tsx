'use client';
import {useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import {formatKHR} from '@/lib/pos-cart';
import { isCollectedSale } from '@/lib/pos-reporting';
import { Portal } from '@/components/Portal';
import { Printer } from '@phosphor-icons/react/dist/csr/Printer';
import type {PosSaleTransaction} from '@/lib/pos-types';
export function SaleReceiptDialog({completedTx,onClose}:{completedTx:PosSaleTransaction|null;onClose:()=>void}){
const dialog=useRef<HTMLDivElement>(null);
useModalFocus(dialog,onClose,Boolean(completedTx));
const setCompletedTx=()=>onClose();
return <>
      {completedTx && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div ref={dialog} role="dialog" aria-modal="true" aria-label="Shop sale receipt" tabIndex={-1} className="bg-white text-neutral-900 w-full max-w-sm rounded-[10px] p-4 sm:p-6 font-mono shadow-2xl flex flex-col justify-between space-y-4 my-auto max-h-[92dvh] overflow-y-auto">
              <div id="printable-receipt">
                <div className="text-center border-b border-neutral-300 pb-3 mb-3">
                  <h2 className="text-sm font-black tracking-widest text-brand-ink">INFINITY TAEKWONDO ACADEMY</h2>
                  <p className="text-[9px] text-neutral-700 uppercase font-bold">PRO-SHOP OFFICIAL SALES RECEIPT</p>
                  <p className="text-[9px] text-neutral-500 mt-1">TX #: {completedTx.txId} {"// "}{completedTx.date}</p>
                </div>

                <div className="text-[10px] space-y-1 mb-3 text-neutral-800">
                  <p><strong>Customer:</strong> {completedTx.studentName}</p>
                  <p><strong>Payment Method:</strong> {completedTx.method}</p>
                  <p><strong>Payment Status:</strong> {completedTx.paymentStatus || 'UNKNOWN'}</p>
                </div>

                {/* Items List */}
                <div className="border-t border-b border-neutral-300 py-2 space-y-1 text-[10px] text-neutral-900">
                  {completedTx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.qty}x {item.name}</span>
                      <span>${(item.qty * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="pt-2 text-[10px] space-y-1">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span>${completedTx.subtotal.toFixed(2)}</span>
                  </div>
                  {completedTx.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>Discount:</span>
                      <span>-${completedTx.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-neutral-400 text-neutral-900">
                    <span>{isCollectedSale(completedTx) ? 'TOTAL PAID:' : 'ORDER TOTAL:'}</span>
                    <div className="text-right">
                      <div>${completedTx.total.toFixed(2)}</div>
                      <div className="text-[9px] font-normal text-neutral-600 font-mono">≈ {formatKHR(completedTx.total)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-neutral-300 pt-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white text-white-on-red text-[10px] font-bold rounded-[8px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  <Printer size={14} /> PRINT RECEIPT
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedTx()}
                  className="px-4 py-2 min-h-[42px] bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-[10px] font-bold rounded-[8px] cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

</>;
}
