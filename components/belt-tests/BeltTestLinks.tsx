'use client';
import React from 'react';
import Link from 'next/link';
import { useNextBeltTest, useStudentBeltTests } from './use-belt-links';
import { Badge, CANDIDATE_STATUS, RESULT_LABEL } from './ui';

/**
 * LMS belt track: what students at the selected belt will be tested on at their
 * next belt test (data from useNextBeltTest). Items linked to a library lesson open that lesson.
 */
export function NextBeltTestPanel({ test, onOpenLesson, hasLesson }: { test: ReturnType<typeof useNextBeltTest>; onOpenLesson: (libraryAssetId: number) => void; hasLesson: (libraryAssetId: number) => boolean }) {
  const { next, syllabus, detail, loaded } = test;
  if (!loaded || !next) return null;
  if (!syllabus) return <p className="rounded-[8px] border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-[#333]">No published {next.belt_name} belt test syllabus yet. <Link href="/belt-tests" className="font-semibold text-[#EF2F38] underline">Create it in Belt Tests</Link></p>;
  if (!detail) return null;
  const color = detail.syllabus.track === 'color';
  return <section aria-labelledby="next-belt-test-title" className="space-y-3 rounded-[8px] border border-neutral-200 bg-white p-4 shadow-sm dark:border-[#262626] dark:bg-[#141414]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 id="next-belt-test-title" className="text-sm font-bold text-neutral-900 dark:text-white">{color ? `${next.belt_name} belt test` : `Kukkiwon ${next.belt_name} test`} · what is tested</h3>
        <p className="text-[11px] text-neutral-500">{detail.syllabus.title} v{detail.syllabus.version}{color ? ` · pass ${detail.syllabus.pass_mark}%` : ' · tested at Kukkiwon Cambodia via the CTF'}</p></div>
      <Link href="/belt-tests" className="text-xs font-semibold text-[#EF2F38] underline">Open Belt Tests</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{detail.sections.map(section => <div key={section.id} className="space-y-1.5 rounded-md bg-neutral-50 p-3 dark:bg-[#0F0F0F]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">{section.title}{color && section.weight != null ? ` · ${section.weight}%` : ''}</p>
      <ul className="space-y-1 text-xs">{detail.items.filter(item => item.section_id === section.id).map(item => <li key={item.id} className="flex flex-wrap items-center gap-1.5">
        {item.library_asset_id != null && hasLesson(item.library_asset_id)
          ? <button type="button" onClick={() => onOpenLesson(item.library_asset_id!)} className="text-left font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:text-[#EF2F38] dark:text-white">{item.title}</button>
          : <span className="text-neutral-800 dark:text-neutral-200">{item.title}</span>}
        {item.critical && <Badge tone="red">Critical</Badge>}
      </li>)}</ul>
    </div>)}</div>
  </section>;
}

/** A student's belt tests (staff view): results show once finalized, with a note until published to the student. */
export function StudentBeltTestHistory({ studentId, tone = 'light' }: { studentId: string; tone?: 'light' | 'plain' }) {
  const { tests, loaded, error, allowed } = useStudentBeltTests(studentId);
  if (!allowed) return null;
  const box = tone === 'light' ? 'rounded-[10px] border border-neutral-200 bg-neutral-50/50 p-5 dark:border-[#262626] dark:bg-[#141414]' : 'space-y-2';
  return <section aria-label="Belt test history" className={box + ' space-y-3'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">Belt test history</h3><Link href="/belt-tests" className="text-[11px] font-semibold text-[#EF2F38] underline">Open Belt Tests</Link></div>
    {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    {!loaded && !error && <p role="status" className="text-xs text-neutral-500">Loading belt tests…</p>}
    {loaded && !tests.length && <p className="text-xs text-neutral-500">No belt tests recorded in Belt Tests yet.</p>}
    <ul className="space-y-2">{tests.map(test => { const status = CANDIDATE_STATUS[test.status] ?? { label: test.status, tone: 'neutral' as const }; const result = test.result ? RESULT_LABEL[test.result] : null;
      return <li key={test.candidateId} className="space-y-1.5 rounded-[8px] border border-neutral-200 bg-white p-3 text-xs dark:border-[#262626] dark:bg-[#0F0F0F]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-neutral-900 dark:text-white">{test.title} · {test.examDate}</span>
          <span className="flex flex-wrap gap-1"><Badge tone={test.kind === 'kukkiwon' ? 'black' : 'neutral'}>{test.kind === 'kukkiwon' ? `Kukkiwon ${test.poomOrDan ?? ''}`.trim() : test.targetBelt}</Badge><Badge tone={status.tone}>{status.label}</Badge>
            {result && <Badge tone={result.tone}>{result.label}{test.overallPercent != null ? ` ${test.overallPercent}%` : ''}</Badge>}{test.cancelled && <Badge>Cancelled</Badge>}</span></div>
        {test.sections.length > 0 && <p className="text-neutral-500">{test.sections.map(section => `${section.title} ${section.percent}% (${section.grade})`).join(' · ')}</p>}
        {test.result && !test.resultsPublished && test.kind === 'color' && <p className="text-amber-700 dark:text-amber-300">Not yet published to the student.</p>}
        {test.certificateNo && <p className="text-neutral-500">Kukkiwon certificate {test.certificateNo}</p>}
      </li>; })}</ul>
  </section>;
}
