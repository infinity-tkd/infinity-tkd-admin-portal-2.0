'use client';
import { useOperations } from '@/hooks/use-operations';
import { Field, OperationForm, OperationSection, text } from './shared';
import { useAppStore } from '@/lib/store';
interface Quality { checkedAt: string; findings: { key: string; title: string; record: string; explanation: string; review?: { note: string; reviewed_at: string } }[] }
export function QualityPanel() {
  const {can}=useAppStore();
  const api = useOperations<Quality>('quality');
  return <OperationSection title="Data-quality review" {...api} onRefresh={() => void api.refresh()}><p className="text-xs text-neutral-500">Findings identify records needing evidence or an operational decision. Recording a review keeps the finding visible until its underlying data is corrected.</p><p className="text-sm">Current findings: {api.data?.findings.length ?? '—'}</p><div className="max-h-[36rem] space-y-3 overflow-y-auto">{api.data?.findings.map(finding => <article key={finding.key} className="space-y-2 rounded-xl border p-3 dark:border-neutral-800"><h3 className="text-sm font-semibold">{finding.title}</h3><p className="text-xs text-neutral-500">{finding.record} · {finding.explanation}</p>{finding.review && <p className="text-xs">Last review: {finding.review.note} · {finding.review.reviewed_at.slice(0, 10)}</p>}{can('action:staff_manage') && <details><summary>Record a review</summary><OperationForm title={`Review ${finding.record}`} busy={api.busy} submitLabel="Save review note" onSubmit={form => api.run({ action: 'quality_review', findingKey: finding.key, note: text(form, 'note') })}><Field label="Evidence checked / next action" wide><textarea name="note" minLength={5} maxLength={500} required/></Field></OperationForm></details>}</article>)}</div></OperationSection>;
}
