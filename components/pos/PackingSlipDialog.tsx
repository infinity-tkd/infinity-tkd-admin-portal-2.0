'use client';
import {useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import { Portal } from '@/components/Portal';
import { Printer } from '@phosphor-icons/react/dist/csr/Printer';
import type {StudentOrderRecord} from '@/lib/pos-types';
export function PackingSlipDialog({packingSlipOrder,onClose}:{packingSlipOrder:StudentOrderRecord|null;onClose:()=>void}){
const dialog=useRef<HTMLDivElement>(null);
useModalFocus(dialog,onClose,Boolean(packingSlipOrder));
const setPackingSlipOrder=()=>onClose();
return <>
      {packingSlipOrder && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div ref={dialog} role="dialog" aria-modal="true" aria-label="Order packing slip" tabIndex={-1} className="bg-white text-neutral-900 w-full max-w-md rounded-[10px] p-4 sm:p-6 font-mono shadow-2xl flex flex-col justify-between space-y-4 my-auto max-h-[92dvh] overflow-y-auto">
              <div id="printable-packing-slip">
                {/* Slip Header */}
                <div className="text-center border-b-2 border-neutral-900 pb-3 mb-3">
                  <h2 className="text-sm font-black tracking-widest text-brand-ink">INFINITY TAEKWONDO ACADEMY</h2>
                  <p className="text-[10px] text-neutral-700 font-bold uppercase tracking-wider">
                    STUDENT GEAR BAG PACKING SLIP
                  </p>
                  <p className="text-[9px] text-neutral-500 mt-1">
                    ORDER #: {packingSlipOrder.order_number} {"// "}{new Date(packingSlipOrder.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Student Details */}
                <div className="bg-neutral-100 p-2.5 rounded text-[10px] space-y-1 mb-3 border border-neutral-300 text-neutral-900">
                  <div className="flex justify-between">
                    <span className="font-bold">Student:</span>
                    <span>{packingSlipOrder.students?.english_name || packingSlipOrder.customer_name}</span>
                  </div>
                  {packingSlipOrder.students?.current_belt && (
                    <div className="flex justify-between">
                      <span className="font-bold">Belt Rank:</span>
                      <span>{packingSlipOrder.students.current_belt}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-bold">Pickup Branch:</span>
                    <span>{packingSlipOrder.branches?.branch_name || 'Main Academy'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Contact Phone:</span>
                    <span>{packingSlipOrder.customer_phone || '—'}</span>
                  </div>
                </div>

                {/* Packing Checklist */}
                <div className="space-y-1 mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-700">ITEMS TO PACK</p>
                  <div className="border border-neutral-300 rounded overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-neutral-200 text-neutral-800 uppercase font-bold">
                        <tr>
                          <th className="p-1.5 text-center w-8">Pack</th>
                          <th className="p-1.5">SKU / Item Description</th>
                          <th className="p-1.5 text-center">Size</th>
                          <th className="p-1.5 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 text-neutral-900">
                        {packingSlipOrder.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 text-center">
                              <span className="inline-block w-3.5 h-3.5 border border-neutral-400 rounded-sm" />
                            </td>
                            <td className="p-1.5 font-semibold">
                              {it.product_name}
                              <span className="block text-[8px] text-neutral-600">{it.sku}</span>
                            </td>
                            <td className="p-1.5 text-center">{it.size || '—'}</td>
                            <td className="p-1.5 text-right font-bold">{it.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Student Notes */}
                {packingSlipOrder.student_notes && (
                  <div className="text-[9px] bg-neutral-50 border border-dashed border-neutral-300 p-2 rounded mb-3 text-neutral-800">
                    <strong>Notes:</strong> {packingSlipOrder.student_notes}
                  </div>
                )}

                {/* Signatures */}
                <div className="border-t border-neutral-300 pt-3 text-[9px] grid grid-cols-2 gap-4 text-neutral-600">
                  <div>
                    <p>Packed By: ________________</p>
                    <p className="mt-1">Date: ________________</p>
                  </div>
                  <div className="text-right">
                    <p>Received By: ________________</p>
                    <p className="mt-1">Date: ________________</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-neutral-300 pt-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white text-white-on-red text-[10px] font-bold rounded-[8px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors active:scale-95 touch-manipulation"
                >
                  <Printer size={14} /> PRINT PACKING SLIP
                </button>
                <button
                  type="button"
                  onClick={() => setPackingSlipOrder()}
                  className="px-4 py-2 min-h-[42px] bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-[10px] font-bold rounded-[8px] cursor-pointer active:scale-95 touch-manipulation"
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
