'use client';
import React from 'react';
import { ELIGIBILITY_RULE_LABELS } from '@/lib/belt-test-scoring';
import type { Eligibility } from '@/lib/belt-test-contract';
import { Badge } from './ui';

/** The Belt Tests eligibility rules, as the student portal shows them. */
export function RuleChips({ entry }: { entry: { eligibility: Eligibility } }) {
  return <ul className="flex flex-wrap gap-1.5">{entry.eligibility.rules.map(rule => <li key={rule.key}>
    <Badge tone={rule.met ? 'green' : 'red'}>{rule.met ? '✓' : '✕'} {ELIGIBILITY_RULE_LABELS[rule.key] ?? rule.key}{rule.key === 'current_belt' || rule.key === 'active' ? '' : `: ${String(rule.current)} / ${String(rule.required)}`}</Badge>
  </li>)}</ul>;
}
