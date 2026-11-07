'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import { useOperations } from '@/hooks/use-operations';
import { useAppStore } from '@/lib/store';
import { academyDate, addCalendarDays, isCalendarDate } from '@/lib/dates';
import { Field, OperationForm, OperationSection, money, number, text } from './shared';
interface BankLine { id: string; bank_reference: string; amount_usd: number; transaction_date: string; receipt_id?: string }
interface Receipt { id: string; receipt_number: string; amount_usd: number; external_reference?: string; payment_date: string; student_id: string }
interface Reconciliation { lines: BankLine[]; receipts: Receipt[]; collections?: { total: number; legacy: number; receipts: number } }
interface ImportLine { reference: string; amount: number; transactionDate: string }
export function ReconciliationPanel() {
  const { can } = useAppStore(); const [from, setFrom] = useState(addCalendarDays(academyDate(), -30)), [to, setTo] = useState(academyDate());
  const api = useOperations<Reconciliation>('reconciliation', { from, to }); const [preview, setPreview] = useState<ImportLine[]>([]), [fileError, setFileError] = useState('');
  const parse = async (file?: File) => {
    setPreview([]); setFileError(''); if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFileError('Choose a CSV smaller than 2 MB.'); return; }
    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: 'greedy', transformHeader: value => value.trim().toLowerCase() });
    if (parsed.errors.length || !parsed.data.length || parsed.data.length > 500) { setFileError('Use a valid CSV with 1–500 rows and reference, amount, transaction_date columns.'); return; }
    const rows = parsed.data.map(row => ({ reference: row.reference?.trim(), amount: Number(row.amount), transactionDate: row.transaction_date?.trim() }));
    const invalid = rows.findIndex((row, index) => !row.reference || row.reference.length < 3 || row.reference.length > 120 || !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 100000 || Math.abs(row.amount * 100 - Math.round(row.amount * 100)) > 0.00001 || !isCalendarDate(row.transactionDate ?? '') || row.transactionDate > academyDate() || parsed.data[index].currency && parsed.data[index].currency.toUpperCase() !== 'USD');
    if (invalid >= 0) { setFileError(`Review CSV row ${invalid + 2}. Use a reference, positive USD amount with two decimals and a valid received date.`); return; }
    setPreview(rows);
  };
  return <OperationSection title="Collections and bank reconciliation" {...api} error={fileError || api.error} onRefresh={() => void api.refresh()}>
    <p className="text-xs text-neutral-500">Match bank records to received-funds receipts using the exact amount and reference. This records reconciliation and does not connect to a bank or initiate transfers.</p>
    <p className="text-xs text-neutral-500">Lists up to 500 bank lines and 500 matching receipts for the selected period. Narrow the dates when a list reaches that limit. Collection totals cover the full selected period.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Collections from"><input type="date" value={from} max={to} disabled={api.busy} onChange={event => setFrom(event.target.value)}/></Field><Field label="Collections through"><input type="date" value={to} min={from} disabled={api.busy} onChange={event => setTo(event.target.value)}/></Field></div>
    {api.data?.collections && <div className="rounded-xl border p-3 text-sm dark:border-neutral-800"><p>Recorded cash received in this period: <strong>{money(api.data.collections.total)}</strong></p><p className="mt-1 text-xs text-neutral-500">Includes partial-payment receipts and historical dated collections. Credits and waivers contribute no cash revenue. Historical payments without dates remain in data-quality review.</p></div>}
    {can('action:finance_record_payment') && <details><summary>Import a bank statement</summary><div className="space-y-3"><label className="block space-y-1 text-xs"><span>USD statement CSV: reference, amount, transaction_date; optional currency must be USD</span><input type="file" accept=".csv,text/csv" disabled={api.busy} onChange={event => void parse(event.target.files?.[0])}/></label>{preview.length > 0 && <><p className="text-sm">{preview.length} validated rows ready. Nothing has been imported yet.</p><div className="max-h-44 overflow-auto rounded border p-3 text-xs dark:border-neutral-800">{preview.slice(0, 20).map((row, index) => <p key={index}>{row.transactionDate} · {row.reference} · {money(row.amount)}</p>)}</div><button className="operation-primary" type="button" disabled={api.busy} onClick={() => void api.run({ action: 'bank_import', lines: preview }).then(saved => { if (saved) setPreview([]); })}>Import {preview.length} bank records</button></>}</div></details>}
    {can('action:finance_record_payment') && <details><summary>Add a bank record manually</summary><OperationForm title="Verified bank record" busy={api.busy} submitLabel="Save bank record" onSubmit={form => api.run({ action: 'bank_import', lines: [{ reference: text(form, 'reference'), amount: number(form, 'amount'), transactionDate: text(form, 'date') }] })}><Field label="Bank reference"><input name="reference" minLength={3} maxLength={120} required/></Field><Field label="Amount (USD)"><input name="amount" type="number" step="0.01" min="0.01" max="100000" required/></Field><Field label="Transaction date"><input name="date" type="date" max={academyDate()} required/></Field></OperationForm></details>}
    <div className="space-y-2">{api.data?.lines.map(line => {
      const match = api.data?.receipts.find(receipt => receipt.external_reference?.trim().toLowerCase() === line.bank_reference && Math.round(Number(receipt.amount_usd) * 100) === Math.round(Number(line.amount_usd) * 100) && !api.data?.lines.some(other => other.receipt_id === receipt.id));
      return <article key={line.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs dark:border-neutral-800"><div><p className="break-all font-semibold">{line.bank_reference} · {money(line.amount_usd)}</p><p className="mt-1 text-neutral-500">{line.transaction_date} · {line.receipt_id ? 'Matched to a receipt' : match ? `Exact candidate: ${match.receipt_number}` : 'No exact receipt match yet'}</p></div>{match && !line.receipt_id && can('action:finance_record_payment') && <button type="button" disabled={api.busy} className="operation-control" onClick={() => void api.run({ action: 'reconcile', bankLineId: line.id, receiptId: match.id })}>Confirm receipt match</button>}</article>;
    })}</div>
    {api.data && !api.data.lines.length && <p className="text-sm text-neutral-500">No bank records imported for this period.</p>}
  </OperationSection>;
}
