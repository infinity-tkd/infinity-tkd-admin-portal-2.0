'use client';
import NextImage from 'next/image';
import {SafeImage} from '@/components/SafeImage';
import type {TuitionReceiptSelection} from './TuitionReceiptDialogs';
import type {tuitionReceiptRecord} from '@/lib/tuition-receipt';
export function TuitionReceiptCard({ printId, receipt:showReceipt, model:receiptModel, branchName, accent:receiptAccentColor, showLogo:receiptShowLogo, showWatermark:receiptShowWatermark, notes:receiptCustomNotes }:{printId:string;receipt:TuitionReceiptSelection;model:ReturnType<typeof tuitionReceiptRecord>;branchName:string;accent:string;showLogo:boolean;showWatermark:boolean;notes:string}) {
const receiptPaymentMethod=receiptModel.method,receiptReferenceNumber=receiptModel.reference;
return (
      <div
        id={printId}
        className="w-full max-w-[380px] bg-white text-[#1f2937] font-sans p-6 sm:p-8 rounded-[8px] shadow-2xl relative overflow-hidden flex flex-col gap-6"
        style={{
          fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#ffffff',
          color: '#1f2937',
          position: 'relative',
          boxSizing: 'border-box',
          border: '1px solid #e5e7eb' // Clean, visible border to define the card edges against any white backgrounds
        }}
      >
        {/* Minimalist Premium Modern Watermark Stamp (Red Color, soft clean opacity) */}
        {receiptShowWatermark && (
          <div style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-12deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
            opacity: 0.12 /* Elegant, clean, non-obstructive visual weighting */
          }}>
            <div style={{
              borderTop: '2px solid #EF2F38',
              borderBottom: '2px solid #EF2F38',
              padding: '6px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                color: '#EF2F38',
                fontSize: '32px',
                fontWeight: '800',
                letterSpacing: '10px',
                textIndent: '10px', /* Centering text alignment */
                textTransform: 'uppercase',
                fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: '1'
              }}>
                {receiptModel.label}
              </span>
              <span style={{
                color: '#EF2F38',
                fontSize: '7px',
                fontWeight: '600',
                letterSpacing: '2px',
                textIndent: '2px',
                textTransform: 'uppercase',
                marginTop: '4px',
                fontFamily: 'var(--font-mono), monospace'
              }}>
                INFINITY ACADEMY
              </span>
            </div>
          </div>
        )}

        {/* Header Container */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${receiptAccentColor}`, paddingBottom: '16px', position: 'relative', zIndex: 1 }}>
          <div>
            {receiptShowLogo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <NextImage unoptimized width={28} height={28} src="/logo.svg"
                  alt="Infinity Logo"
                  style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1px', color: '#111827', margin: 0, fontFamily: 'var(--font-sans), sans-serif' }}>INFINITY</span>
              </div>
            )}
            <p style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', margin: 0 }}>TAEKWONDO ACADEMY</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '900', color: receiptAccentColor, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>{receiptModel.title}</h1>
            {/* Realtime Synced Customizable Reference ID */}
            <p style={{ fontSize: '8px', color: '#6b7280', fontFamily: 'var(--font-mono), monospace', margin: '4px 0 0 0' }}>Ref: {receiptReferenceNumber}</p>
          </div>
        </div>

        {/* Metadata Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SafeImage
              src={showReceipt.student.profilePicturePath}
              alt={showReceipt.student.englishName}
              containerClassName="w-10 h-10 rounded-[8px] bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
              crossOrigin="anonymous"
              fallback={<span className="font-bold text-gray-400 text-sm" style={{ fontWeight: 'bold', color: '#9ca3af', fontSize: '14px' }}>{showReceipt.student.englishName.charAt(0)}</span>}
            />
            <div>
              <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Billed To</span>
              <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', margin: '1px 0 0 0' }}>{showReceipt.student.englishName}</h4>
              <p style={{ fontSize: '9px', color: '#6b7280', fontFamily: 'var(--font-mono), monospace', margin: 0 }}>ID: {showReceipt.student.id}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Issued From</span>
            <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', margin: '1px 0 0 0' }}>{branchName}</h4>
            <p style={{ fontSize: '9px', color: '#6b7280', margin: 0 }}>Phnom Penh, Cambodia</p>
          </div>
        </div>

        {/* Transaction Table */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', width: '70%' }}>Description</th>
                <th style={{ padding: '8px 4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 4px', fontSize: '11px', color: '#1f2937' }}>
                  <div style={{ fontWeight: 'bold', color: '#111827' }}>Monthly invoice amount</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>Monthly training access fee for {showReceipt.month} {showReceipt.year}</div>
                </td>
                <td style={{ padding: '12px 4px', fontSize: '11px', fontWeight: 'bold', color: '#111827', textAlign: 'right', fontFamily: 'var(--font-mono), monospace' }}>
                  {receiptModel.billed===null?'Not recorded':'$'+receiptModel.billed.toFixed(2)}
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        {/* Total Paid Block */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 16px',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Payment Method</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: receiptAccentColor }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827' }}>{receiptPaymentMethod}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Collected toward this cycle</span>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: receiptAccentColor, margin: 0, fontFamily: 'var(--font-mono), monospace' }}>
              {receiptModel.collected===null?'Not recorded':'$'+receiptModel.collected.toFixed(2)}
            </h2>
          </div>
        </div>

        {/* Barcode & Footer Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', borderTop: '1px dashed #e5e7eb', paddingTop: '20px', gap: '4px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '1.5px', height: '24px', alignItems: 'center', marginBottom: '2px' }}>
            {[3,1,4,1,2,5,1,6,3,1,5,4,2,3,1,2,4,2,3,5,1,2,4,1,2,3].map((w, idx) => (
              <div key={idx} style={{ width: `${w}px`, height: '100%', backgroundColor: '#111827', opacity: idx % 3 === 0 ? 0.3 : 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '8px', color: '#9ca3af', fontFamily: 'var(--font-mono), monospace', letterSpacing: '2px' }}>{receiptReferenceNumber}</span>
          {receiptModel.summary && <p style={{fontSize:'9px'}}>Summary of invoice allocations. Individual receipts are available in the invoice ledger.</p>}
          <p style={{ fontSize: '9px', color: '#6b7280', margin: '4px 0 0 0', fontStyle: 'italic', maxWidth: '320px', lineHeight: '1.4' }}>
            {receiptCustomNotes || `"Infinity is not a limit, it's a standard." Thank you for training with us!`}
          </p>
        </div>
      </div>
    );
}
