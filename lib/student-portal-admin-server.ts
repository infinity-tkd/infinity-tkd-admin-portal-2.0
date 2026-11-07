import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { formatServerErrorResponse } from './backend-security';
import { publishedReadinessRequirementsSchema } from './student-portal-admin-contract';

export const preparationRoles = ['Root', 'Super Root', 'Admin', 'Head Coach'];
export const confirmationRoles = [...preparationRoles, 'Coach', 'Assistant Coach'];

const safeErrors = new Set([
  'Preparation access denied', 'Invalid preparation request', 'Preparation request key mismatch',
  'Academy preparation requires an administrator or head coach', 'Draft unavailable', 'Draft changed. Reload before saving',
  'Invalid draft revision', 'A correction reason is required', 'Invalid preparation draft', 'Draft kind cannot change',
  'Invalid readiness draft', 'Draft contains an unavailable curriculum lesson', 'Invalid ranking draft', 'Ranking student unavailable', 'Duplicate ranking student',
  'Student unavailable', 'Choose a currently approved and published readiness policy', 'Policy does not match the current student belt',
  'Overlapping readiness policies need academy review', 'Current rank history needs review before confirmation', 'Current rank start needs review before confirmation',
  'Policy lesson mapping needs review', 'Choose an active lesson requirement from this exact policy', 'Record the observed result and genuine evidence reference', 'The published requirement contract needs academy review',
  'Confirmation unavailable', 'Only the recording coach or academy reviewer can withdraw this confirmation', 'Confirmation already withdrawn',
]);
export function studentPortalAdminError(error: unknown) {
  const value = error as { code?: string; message?: string };
  const headers = { 'Cache-Control': 'no-store' };
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(value?.code ?? '')) return NextResponse.json({ success: false, error: { code: 'STUDENT_PORTAL_SETUP_REQUIRED', message: 'Student-portal preparation needs the shared publication schema and admin preparation migration.' } }, { status: 503, headers });
  if (safeErrors.has(value?.message ?? '')) return NextResponse.json({ success: false, error: { code: value.code, message: value.message } }, { status: value.code === '42501' ? 403 : value.code === '40001' ? 409 : value.code === 'P0002' ? 404 : 422, headers });
  return formatServerErrorResponse(error);
}

export async function readStudentPortalPreparation(client: SupabaseClient) {
  const now = new Date().toISOString();
  const [drafts, policies, rankings, curriculum] = await Promise.all([
    client.from('student_portal_admin_drafts').select('id,kind,title,payload,revision,updated_at').is('archived_at', null).order('updated_at', { ascending: false }).limit(100),
    client.from('student_portal_readiness_policies').select('id,target_belt,version,requirements,publish_from,publish_until').is('revoked_at', null).lte('publish_from', now).gt('publish_until', now).order('target_belt').limit(100),
    client.from('student_portal_ranking_publications').select('id,title,publish_from,publish_until', { count: 'exact' }).is('revoked_at', null).lte('publish_from', now).gt('publish_until', now).order('publish_from', { ascending: false }).limit(25),
    client.from('curriculum').select('id,title,target_belt').eq('is_active', true).order('id').limit(1000),
  ]);
  for (const result of [drafts, policies, rankings, curriculum]) if (result.error) throw result.error;
  return { drafts: drafts.data ?? [], policies: policies.data ?? [], rankings: rankings.data ?? [], currentRankingCount: rankings.count ?? 0, curriculum: curriculum.data ?? [], publicationEnabled: false };
}

export async function readStudentLessonConfirmations(client: SupabaseClient, studentId: string) {
  const student = await client.from('students').select('id,english_name,current_belt,initial_belt,registration_date').eq('id', studentId).is('deleted_at', null).maybeSingle();
  if (student.error) throw student.error;
  if (!student.data) throw { code: 'P0002', message: 'Student unavailable' };
  const now = new Date().toISOString();
  const [policies, confirmations] = await Promise.all([
    client.from('student_portal_readiness_policies').select('id,target_belt,version,requirements,publish_from,publish_until').eq('target_belt', student.data.current_belt).is('revoked_at', null).lte('publish_from', now).gt('publish_until', now).order('publish_from', { ascending: false }).limit(20),
    client.from('student_portal_coach_confirmations').select('id,policy_id,requirement_key,result,confirmed_by,confirmed_at,confirmation_reference,revoked_at').eq('student_id', studentId).order('confirmed_at', { ascending: false }).order('id', { ascending: false }).limit(100),
  ]);
  if (policies.error) throw policies.error;
  if (confirmations.error) throw confirmations.error;
  // Keep withdrawn rows in order: filtering them would resurrect an older pass.
  return { student: student.data, policies: policies.data ?? [], confirmations: confirmations.data ?? [] };
}

export async function validateLessonPolicyContract(client: SupabaseClient, policyId: string) {
  const policy = await client.from('student_portal_readiness_policies').select('requirements').eq('id', policyId).maybeSingle();
  if (policy.error) throw policy.error;
  if (!policy.data || !publishedReadinessRequirementsSchema.safeParse(policy.data.requirements).success) throw { code: '22023', message: 'The published requirement contract needs academy review' };
}
