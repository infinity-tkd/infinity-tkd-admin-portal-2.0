import type { RankingDraft, ReadinessDraft } from '@/lib/student-portal-admin-contract';
export interface PreparationDraft { id: string; kind: 'readiness' | 'ranking'; title: string; payload: unknown; revision: number; updated_at?: string }
export interface PublishedPolicy { id: string; target_belt: string; version: string; requirements: unknown; publish_from: string; publish_until: string }
export interface CurriculumChoice { id: number; title: string; target_belt: string }
export interface PreparationOverview { drafts: PreparationDraft[]; policies: PublishedPolicy[]; rankings: { id: string; title: string; publish_from: string; publish_until: string }[]; currentRankingCount: number; curriculum: CurriculumChoice[]; publicationEnabled: false }
export type SaveDraft = (kind: 'readiness' | 'ranking', title: string, payload: ReadinessDraft | RankingDraft) => Promise<boolean>;
