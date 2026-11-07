import { z } from 'zod';
import { NextResponse } from 'next/server';
import { callerHasPermission } from '@/lib/backend-security';
import { calendarStaff, calendarError, calendarResponse, calendarPrivateHeaders, canEditEvent, loadStaffEvent } from '@/lib/calendar-admin-server';
import { CalendarUploadError, readEventUpload, reserveEventUpload, storeEventUpload } from '@/lib/calendar-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Route = { params: Promise<{ id: string }> };

export async function POST(req: Request, route: Route) {
  let release: (() => void) | undefined;
  try {
    const access = await calendarStaff(req);
    if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    const { id } = await route.params;
    if (!z.string().uuid().safeParse(id).success) throw new CalendarUploadError(422, 'INVALID_EVENT_UPLOAD', 'Choose a valid saved event before uploading.');
    if (!await callerHasPermission(access.adminSupabase, access.context, 'action:events_edit')) throw new CalendarUploadError(403, 'EVENT_UPLOAD_FORBIDDEN', 'You do not have permission to upload event files.');
    const event = await loadStaffEvent(access.adminSupabase, id);
    if (!canEditEvent(event, access.context)) throw new CalendarUploadError(403, 'EVENT_UPLOAD_FORBIDDEN', 'Only the event owner or an administrator can upload its files.');
    if (event.draft.attachments.length >= 10) throw new CalendarUploadError(422, 'EVENT_ATTACHMENT_LIMIT', 'This event already has ten attachments. Review its draft before uploading another.');
    release = reserveEventUpload();
    const slot = await access.adminSupabase.rpc('portal_take_rate_slot', { p_key: `calendar-upload:${access.context.userId}`, p_limit: 12, p_seconds: 600 });
    if (slot.error) throw new CalendarUploadError(503, 'EVENT_UPLOAD_UNAVAILABLE', 'Upload checks are temporarily unavailable. Retry shortly.');
    if (!slot.data) throw new CalendarUploadError(429, 'EVENT_UPLOAD_RATE_LIMIT', 'Upload limit reached. Retry in a few minutes.');
    const upload = await readEventUpload(req);
    const attachment = await storeEventUpload(access.adminSupabase, event.id, upload, req.signal);
    return calendarResponse({ attachment }, 201);
  } catch (error) {
    if (error instanceof CalendarUploadError) return NextResponse.json({ success: false, data: null, error: { code: error.code, message: error.message } }, { status: error.status, headers: { ...calendarPrivateHeaders, ...(error.status === 429 ? { 'Retry-After': error.code === 'EVENT_UPLOAD_BUSY' ? '5' : '600' } : {}) } });
    return calendarError(error);
  } finally { release?.(); }
}
