import { z } from 'zod';
import { verifyCaller } from './backend-security';
import { ownedStudentIds } from './operations-server';
import { calendarFailure, calendarPeriod, decodeCalendarCursor, encodeCalendarCursor } from './calendar-cursor';
import { calendarResponse, calendarPrivateResponse } from './calendar-admin-server';
import { occurrence, type CalendarDraft, type StoredAttachment } from './calendar-contract';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function calendarStudent(req: Request) {
  if (req.headers.get('x-portal-contract') !== 'calendar-v1') calendarFailure('A verified calendar-v1 student gateway is required.', '42501');
  if (!/^Bearer [^\s]+$/i.test(req.headers.get('authorization') || '')) calendarFailure('Sign in to continue.', 'AUTH_UNAUTHORIZED');
  const access = await verifyCaller(req, ['Student']);
  if (access.errorResponse || !access.context || !access.adminSupabase) return { ...access, errorResponse: access.errorResponse ? calendarPrivateResponse(access.errorResponse) : undefined, subjectStudentId: '' };
  const client = access.adminSupabase;
  const [ids, settings] = await Promise.all([ownedStudentIds(client, access.context.userId), client.from('academy_profile').select('allow_student_portal_login').eq('id', 'default').limit(1)]);
  if (settings.error) throw settings.error;
  if (!settings.data?.[0]?.allow_student_portal_login) calendarFailure('Student access is temporarily disabled by the academy.', '42501');
  if (ids.length !== 1) calendarFailure('Ask the academy to review your student account link.', '42501');
  return { ...access, subjectStudentId: ids[0] };
}
type PublicEventRow = { id: string; revision: number; payload: Omit<CalendarDraft, 'attachments' | 'internalNotes'> & { attachments: StoredAttachment[] }; previous_occurrence: CalendarDraft | null; published_at: string };
export function studentEvent(row: PublicEventRow, details = false) {
  const source = row.payload;
  // The current student contract expresses calendar cancellation, not completion.
  const cancelled = ['cancelled', 'postponed'].includes(source.lifecycle);
  const event = { id: row.id, revision: row.revision, title: source.title, type: source.type === 'academy' ? 'activity' : source.type,
    publicationStatus: 'published' as const, status: cancelled ? 'cancelled' as const : 'scheduled' as const,
    occurrence: occurrence(source), timeZone: source.timezone, previousOccurrence: row.previous_occurrence ? occurrence(row.previous_occurrence) : null,
    changeReason: source.changeReason || (cancelled ? 'The academy has cancelled or postponed this occurrence.' : null), location: source.location || null, publishedAt: row.published_at };
  return details ? { ...event, description: source.description || null, publicNotes: null, contact: null,
    attachments: source.attachments.filter(item => item.studentAvailable && item.id && item.bytes && item.mimeType).map(item => ({ id: item.id, name: item.label, kind: item.mimeType!.startsWith('image/') ? 'picture' : 'document', mimeType: item.mimeType, bytes: item.bytes })) } : event;
}
export async function studentCalendarPage(req: Request, client: SupabaseClient, userId: string, studentId: string) {
  const params = new URL(req.url).searchParams, { from, to } = calendarPeriod(params);
  if ([...params.keys()].some(name => !['from', 'to', 'cursor', 'limit'].includes(name) || params.getAll(name).length !== 1) || params.has('limit') && params.get('limit') !== '50') calendarFailure('Unsupported calendar filters.');
  const scope = JSON.stringify(['student-events', userId, studentId, from, to]), cursor = decodeCalendarCursor(params.get('cursor'), scope);
  const result = await client.rpc('portal_calendar_student_events', { p_student: studentId, p_from: from, p_to: to, p_after: cursor?.after || null, p_id: null, p_limit: 51 });
  if (result.error) throw result.error;
  const rows = (result.data || []) as PublicEventRow[], page = rows.slice(0, 50);
  return calendarResponse({ subjectStudentId: studentId, events: page.map(row => studentEvent(row)), nextCursor: rows.length > 50 ? encodeCalendarCursor(scope, page.at(-1)!.id) : null });
}
export async function loadStudentEvent(client: SupabaseClient, studentId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) calendarFailure('Invalid event reference.');
  const result = await client.rpc('portal_calendar_student_events', { p_student: studentId, p_from: null, p_to: null, p_after: null, p_id: id, p_limit: 1 });
  if (result.error) throw result.error;
  const row = result.data?.[0] as PublicEventRow | undefined;
  if (!row) calendarFailure('This event is no longer available to your account.', 'P0002'); return row;
}
export async function studentInbox(req: Request, client: SupabaseClient, userId: string, studentId: string) {
  const params = new URL(req.url).searchParams;
  if ([...params.keys()].some(name => !['cursor', 'limit'].includes(name) || params.getAll(name).length !== 1) || params.has('limit') && params.get('limit') !== '50') calendarFailure('Unsupported inbox filters.');
  const scope = JSON.stringify(['student-inbox', userId, studentId]), cursor = decodeCalendarCursor(params.get('cursor'), scope);
  const result = await client.rpc('portal_calendar_inbox', { p_user: userId, p_student: studentId, p_action: 'list', p_id: null, p_before: cursor?.before || null, p_before_id: cursor?.after || null });
  if (result.error) throw result.error;
  const rows = result.data?.rows || [], page = rows.slice(0, 50), last = page.at(-1);
  return calendarResponse({ subjectStudentId: studentId, unreadCount: result.data.unreadCount,
    notifications: page.map((row: Record<string, unknown>) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at,
      sourceType: 'academy_event', sourceId: row.source_id, sourceRevision: row.source_revision,
      deliveryState: row.delivered_at ? 'delivered' : 'queued', deliveredAt: row.delivered_at || null, readAt: row.read_at || null })),
    nextCursor: rows.length > 50 ? encodeCalendarCursor(scope, last.id, last.created_at) : null });
}
export async function studentNoticePreference(client: SupabaseClient, userId: string) {
  const result = await client.from('portal_notification_preferences').select('push_enabled,muted_categories,student_quiet_start,student_quiet_end').eq('user_id', userId).maybeSingle();
  if (result.error) throw result.error;
  return { pushEnabled: result.data?.push_enabled ?? false, mutedCategories: result.data?.muted_categories?.includes('events') ? ['events'] : [],
    quietStart: result.data ? result.data.student_quiet_start : '22:00', quietEnd: result.data ? result.data.student_quiet_end : '07:00' };
}
