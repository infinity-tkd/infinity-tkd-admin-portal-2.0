import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callerHasPermission, formatServerErrorResponse, verifyCaller, type CallerSecurityContext } from './backend-security';
import { calendarFailure, calendarPeriod, decodeCalendarCursor, encodeCalendarCursor } from './calendar-cursor';
import { verifyEventAttachments } from './calendar-media';
import type { CalendarDraft, StoredAttachment } from './calendar-contract';
import type { EventRecord } from '@/components/calendar/types';

export const calendarPrivateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie', 'X-Portal-Contract': 'calendar-v1' };
export function calendarPrivateResponse<T extends Response>(response: T): T {
  for (const [name, value] of Object.entries(calendarPrivateHeaders)) response.headers.set(name, value);
  return response;
}
const staffRoles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
export type CalendarRow = { id: string; revision: number; draft: Omit<CalendarDraft, 'attachments'> & { attachments: StoredAttachment[] }; published_revision: number | null; published_payload: CalendarDraft | null; published_at: string | null; last_notified_revision: number | null; created_by: string; previous_occurrence: CalendarDraft | null; archived_at?: string | null; archived_reason?: string | null };
export async function calendarStaff(req: Request) {
  const access = await verifyCaller(req, staffRoles);
  if (!access.errorResponse && access.context && access.adminSupabase && !await callerHasPermission(access.adminSupabase, access.context, 'page:calendar')) return { ...access, errorResponse: NextResponse.json({ success: false, error: { message: 'Calendar access is not enabled for your account.' } }, { status: 403, headers: calendarPrivateHeaders }) };
  return access.errorResponse ? { ...access, errorResponse: calendarPrivateResponse(access.errorResponse) } : access;
}
export function calendarResponse(data: unknown, status = 200) {
  const payload = data && typeof data === 'object' && 'subjectStudentId' in data ? { ...data, contractVersion: 'calendar-v1' } : data;
  return NextResponse.json({ success: true, data: payload, error: null }, { status, headers: calendarPrivateHeaders });
}
export function calendarError(error: unknown) {
  const value = (error && typeof error === 'object' ? error : {}) as { code?: string; message?: string };
  const statuses: Record<string, number> = { '22023': 422, '40001': 409, '42501': 403, P0002: 404, AUTH_UNAUTHORIZED: 401 };
  if (value.code && statuses[value.code]) return NextResponse.json({ success: false, data: null, error: { code: value.code, message: (value.message || 'The calendar request could not be completed.').slice(0, 220) } }, { status: statuses[value.code], headers: calendarPrivateHeaders });
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(value.code || '')) return NextResponse.json({ success: false, data: null, error: { code: 'CALENDAR_SETUP_REQUIRED', message: 'Calendar database setup is incomplete. Apply the release migration and retry.' } }, { status: 503, headers: calendarPrivateHeaders });
  return calendarPrivateResponse(formatServerErrorResponse(error));
}
function canManageEvent(row: CalendarRow, context: CallerSecurityContext) { return ['Root', 'Super Root', 'Admin'].includes(context.role) || row.created_by === context.userId; }
export function canEditEvent(row: CalendarRow, context: CallerSecurityContext) { return !row.archived_at && canManageEvent(row, context); }
export function staffEvent(row: CalendarRow, context: CallerSecurityContext): EventRecord {
  return { ...row.draft, id: row.id, revision: row.revision, publishedRevision: row.published_revision,
    publishedAt: row.published_at, hasUnpublishedChanges: !row.archived_at && row.published_revision !== row.revision,
    archivedAt: row.archived_at || null, archiveReason: row.archived_reason || null,
    lastNotifiedRevision: row.last_notified_revision, previousStartDate: row.previous_occurrence?.startDate || null, editable: canEditEvent(row, context) };
}
export async function loadStaffEvent(client: SupabaseClient, id: string) {
  const result = await client.from('academy_events').select('*').eq('id', id).maybeSingle();
  if (result.error) throw result.error; if (!result.data) calendarFailure('Event not found.', 'P0002');
  return result.data as CalendarRow;
}
export async function loadAdminCalendar(req: Request, client: SupabaseClient, context: CallerSecurityContext) {
  const params = new URL(req.url).searchParams, { from, to } = calendarPeriod(params);
  if ([...params.keys()].some(name => !['from', 'to', 'cursor'].includes(name) || params.getAll(name).length !== 1)) calendarFailure('Unsupported calendar filter.');
  const scope = JSON.stringify(['staff', context.userId, from, to]), cursor = decodeCalendarCursor(params.get('cursor'), scope);
  let query = client.from('academy_events').select('*').lt('range_start', to).gt('range_end', from).order('id').limit(51);
  if (cursor) query = query.gt('id', cursor.after);
  const permissionKeys = ['action:events_create', 'action:events_edit', 'action:events_publish', 'action:announcements_send', 'page:directory'];
  const grants = await Promise.all(permissionKeys.map(permission => callerHasPermission(client, context, permission)));
  const [events, branches, classes, students] = await Promise.all([
    query,
    client.from('branches').select('id,branch_name').eq('is_active', true).order('branch_name').limit(500),
    client.from('class_sessions').select('id,class_name').order('class_name').limit(500),
    grants[4] && (grants[0] || grants[1]) ? client.from('students').select('id,english_name').is('deleted_at', null).order('id').limit(250) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [events, branches, classes, students]) if (result.error) throw result.error;
  const rows = (events.data || []) as CalendarRow[], page = rows.slice(0, 50);
  return { events: page.map(row => staffEvent(row, context)), nextCursor: rows.length > 50 ? encodeCalendarCursor(scope, page.at(-1)!.id) : null,
    lookups: { branches: (branches.data || []).map(row => ({ id: row.id, name: row.branch_name })), classes: (classes.data || []).map(row => ({ id: row.id, name: row.class_name })), students: (students.data || []).map(row => ({ id: row.id, name: row.english_name })) },
    permissions: { create: grants[0], edit: grants[1], publish: grants[2], notify: grants[3], archive: grants[2] && ['Root', 'Super Root', 'Admin'].includes(context.role) } };
}
export async function mutateCalendar(client: SupabaseClient, context: CallerSecurityContext, action: 'create' | 'save' | 'publish' | 'notice' | 'archive', id: string | null, body: Record<string, unknown>) {
  const { requestKey, expectedRevision, ...fields } = body;
  const row = id ? await loadStaffEvent(client, id) : null;
  const needed = { create: 'action:events_create', save: 'action:events_edit', publish: 'action:events_publish', notice: 'action:announcements_send', archive: 'action:events_publish' }[action];
  if (!await callerHasPermission(client, context, needed) || row && !canManageEvent(row, context) || action === 'archive' && !['Root', 'Super Root', 'Admin'].includes(context.role)) calendarFailure('You do not have permission to change this event.', '42501');
  const payload: Record<string, unknown> = { expectedRevision };
  if (action === 'create' || action === 'save') {
    const draft = fields as CalendarDraft;
    payload.event = { ...draft, attachments: draft.attachments.map((item, index) => {
      const previous = row?.draft.attachments.find(old => old.id === item.id && old.url === item.url);
      const hash = createHash('sha256').update(String(requestKey) + ':' + index + ':' + item.url).digest('hex');
      const stableId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      return { id: previous?.id || stableId, label: item.label, url: item.url, studentAvailable: false };
    }) };
  } else if (action === 'publish') {
    payload.notifyStudents = fields.notifyStudents;
  } else if (action === 'archive') {
    payload.reason = fields.reason;
  }
  // Resolve a committed retry before mutable external files can fail or change.
  const requestPayload = JSON.parse(JSON.stringify({ id, data: payload }));
  const prior = await client.from('portal_operation_requests').select('actor,action,payload,result').eq('request_key', requestKey).maybeSingle();
  if (prior.error) throw prior.error;
  if (prior.data) {
    const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    if (prior.data.actor !== context.userId || prior.data.action !== 'calendar:' + action || canonical(prior.data.payload) !== canonical(requestPayload)) calendarFailure('This request key was already used for a different calendar operation.');
    return { event: staffEvent(prior.data.result.event as CalendarRow, context), queued: Number(prior.data.result.queued) || 0, notificationCount: Number(prior.data.result.notificationCount) || 0 };
  }
  if (row?.archived_at) calendarFailure('Archived events are read-only.', '40001');
  if (action === 'publish' && row?.draft.attachments.length) payload.verifiedAttachments = await verifyEventAttachments(client, row.draft.attachments, row.id);
  const result = await client.rpc('portal_calendar_mutate', { p_actor: context.userId, p_action: action, p_id: id, p_payload: payload, p_request_key: requestKey });
  if (result.error) throw result.error;
  if (!result.data?.event?.id) throw new Error('Calendar save was not confirmed.');
  return { event: staffEvent(result.data.event as CalendarRow, context), queued: Number(result.data.queued) || 0, notificationCount: Number(result.data.notificationCount) || 0 };
}
