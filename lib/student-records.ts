import type { SupabaseClient } from '@supabase/supabase-js';
import type { BeltHistory } from './store';
import { isCalendarDate } from './dates';

export type BeltHistoryDraft = Omit<BeltHistory, 'id'>;

export function beltHistoryPayload(history: Partial<BeltHistory>) {
  const row: Record<string, unknown> = {};
  const keys = { studentId: 'student_id', beltLevel: 'belt_level', promotionDate: 'promotion_date', testScore: 'test_score', program: 'program', certificateRef: 'certificate_id', kukkiwonDanCardId: 'kukkiwon_dan_card_id' } as const;
  for (const key of Object.keys(keys) as (keyof typeof keys)[]) {
    const value = history[key];
    if (value !== undefined) row[keys[key]] = (key === 'certificateRef' || key === 'kukkiwonDanCardId') && value === '' ? null : value;
  }
  return row;
}

export function mapBeltHistory(row: Record<string, any>): BeltHistory {
  return { id: row.id, studentId: row.student_id, beltLevel: row.belt_level, promotionDate: row.promotion_date, testScore: row.test_score, program: row.program, certificateRef: row.certificate_id, kukkiwonDanCardId: row.kukkiwon_dan_card_id };
}

export function validateBeltHistoryBatch(histories: BeltHistoryDraft[]) {
  if (!histories.length || histories.length > 100) throw new Error('Save between 1 and 100 belt records at a time.');
  const certificates = new Set<string>();
  for (const [index, row] of histories.entries()) {
    if (!row.studentId || row.studentId !== histories[0].studentId || !row.beltLevel?.trim() || !isCalendarDate(row.promotionDate)) {
      throw new Error(`Belt record ${index + 1} needs a student, belt and valid promotion date.`);
    }
    if (row.testScore !== undefined && (!Number.isFinite(row.testScore) || row.testScore < 0 || row.testScore > 100)) {
      throw new Error(`Belt record ${index + 1} needs a score between 0 and 100.`);
    }
    const certificate = row.certificateRef?.trim().toUpperCase();
    if (certificate && certificates.has(certificate)) throw new Error('Each certificate reference in the batch must be unique.');
    if (certificate) certificates.add(certificate);
  }
}

/** One INSERT statement: a rejected row rolls back the complete batch. */
export async function insertBeltHistoryBatch(client: SupabaseClient, histories: BeltHistoryDraft[]) {
  validateBeltHistoryBatch(histories);
  const { data, error } = await client.from('belt_histories').insert(histories.map(beltHistoryPayload)).select();
  if (error) {
    if (!error.code || error.code.startsWith('08')) {
      throw new Error('The belt save could not be confirmed. It may already have been saved; reload belt history before retrying.');
    }
    throw error;
  }
  if (!data || data.length !== histories.length) throw new Error('The saved belt records could not be verified. Reload the history before retrying.');
  return data.map(mapBeltHistory);
}
