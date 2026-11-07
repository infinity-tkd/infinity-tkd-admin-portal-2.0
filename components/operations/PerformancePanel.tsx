'use client';
import { useOperations } from '@/hooks/use-operations';
import { academyDate, addCalendarDays } from '@/lib/dates';
import { OperationSection } from './shared';
interface Metric { page: string; device: string; metric: string; samples: number; p75: number }
export function PerformancePanel() {
  const api = useOperations<Metric[]>('performance', { from: addCalendarDays(academyDate(), -7), to: academyDate() });
  return <OperationSection title="Real-device performance" {...api} onRefresh={() => void api.refresh()}><p className="text-xs text-neutral-500">Observed loading, interaction and layout stability from signed-in devices over the past seven days. The 75th percentile summarizes the latest 1,000 measurements; small samples are preliminary. No device model, medical data or student record content is collected.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{api.data?.map(row => <article key={row.page + row.device + row.metric} className="rounded-xl border p-3 text-sm dark:border-neutral-800"><p className="font-semibold">{row.metric} · {row.device}</p><p className="mt-1 text-xs text-neutral-500">{row.page} · {row.samples} samples</p><p className="mt-2 text-lg">{row.metric === 'CLS' ? row.p75.toFixed(3) : Math.round(row.p75) + ' ms'}</p></article>)}</div>{api.data && !api.data.length && <p className="text-sm text-neutral-500">No device measurements recorded yet. Open the deployed portal on real phones, tablets and desktops, interact with it, then review this report.</p>}</OperationSection>;
}

