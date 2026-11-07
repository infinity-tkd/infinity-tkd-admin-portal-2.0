import { z } from 'zod';
import { NextResponse } from 'next/server';
import { validateRequestBody } from './backend-security';
import { calendarStaff, calendarResponse, calendarError, loadAdminCalendar, loadStaffEvent, staffEvent, mutateCalendar, calendarPrivateHeaders, calendarPrivateResponse } from './calendar-admin-server';
import { calendarStudent, studentCalendarPage, loadStudentEvent, studentEvent, studentInbox, studentNoticePreference } from './calendar-student-server';
import { eventCreateSchema, eventUpdateSchema, eventPublicationSchema, eventNoticeSchema, eventArchiveSchema, portalNoticeMutation, portalPreferenceSchema } from './calendar-contract';
import { calendarFailure } from './calendar-cursor';
import { fetchCalendarFile } from './calendar-media';
import { validPushEndpoint } from './notifications';

export async function adminCalendarList(req: Request) {
  try { const access = await calendarStaff(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    return calendarResponse(await loadAdminCalendar(req, access.adminSupabase, access.context));
  } catch (error) { return calendarError(error); }
}
export async function adminCalendarRead(req: Request, id: string) {
  try { const access = await calendarStaff(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (!z.string().uuid().safeParse(id).success) calendarFailure('Invalid event reference.');
    return calendarResponse({ event: staffEvent(await loadStaffEvent(access.adminSupabase, id), access.context) });
  } catch (error) { return calendarError(error); }
}
export async function adminCalendarWrite(req: Request, action: 'create' | 'save' | 'publish' | 'notice' | 'archive', id: string | null = null) {
  try { const access = await calendarStaff(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (id && !z.string().uuid().safeParse(id).success) calendarFailure('Invalid event reference.');
    const schema = { create: eventCreateSchema, save: eventUpdateSchema, publish: eventPublicationSchema, notice: eventNoticeSchema, archive: eventArchiveSchema }[action];
    const parsed = await validateRequestBody(schema as z.ZodType<Record<string, unknown>>, req); if (parsed.errorResponse || !parsed.data) return calendarPrivateResponse(parsed.errorResponse!);
    return calendarResponse(await mutateCalendar(access.adminSupabase, access.context, action, id, parsed.data));
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarList(req: Request) {
  try { const access = await calendarStudent(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    return await studentCalendarPage(req, access.adminSupabase, access.context.userId, access.subjectStudentId);
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarEvent(req: Request, id: string) {
  try { const access = await calendarStudent(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    return calendarResponse({ subjectStudentId: access.subjectStudentId, event: studentEvent(await loadStudentEvent(access.adminSupabase, access.subjectStudentId, id), true) });
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarInbox(req: Request) {
  try { const access = await calendarStudent(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (req.method === 'GET') return await studentInbox(req, access.adminSupabase, access.context.userId, access.subjectStudentId);
    const parsed = await validateRequestBody(portalNoticeMutation, req); if (parsed.errorResponse || !parsed.data) return calendarPrivateResponse(parsed.errorResponse!);
    const value = parsed.data;
    const result = await access.adminSupabase.rpc('portal_calendar_inbox', { p_user: access.context.userId, p_student: access.subjectStudentId,
      p_action: 'markAll' in value ? 'mark-all' : 'dismiss' in value ? 'dismiss' : 'read', p_id: 'notificationId' in value ? value.notificationId : null });
    if (result.error) throw result.error;
    return calendarResponse({ subjectStudentId: access.subjectStudentId, updated: result.data?.saved === true });
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarPreferences(req: Request) {
  try { const access = await calendarStudent(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (req.method === 'PATCH') {
      const parsed = await validateRequestBody(portalPreferenceSchema, req); if (parsed.errorResponse || !parsed.data) return calendarPrivateResponse(parsed.errorResponse!);
      const saved = await access.adminSupabase.rpc('portal_calendar_preferences', { p_user: access.context.userId, p_payload: parsed.data }); if (saved.error) throw saved.error;
    }
    return calendarResponse({ subjectStudentId: access.subjectStudentId, ...await studentNoticePreference(access.adminSupabase, access.context.userId) });
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarFile(req: Request, id: string, fileId: string) {
  try { const access = await calendarStudent(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (!z.string().uuid().safeParse(fileId).success) calendarFailure('Invalid file reference.');
    const event = await loadStudentEvent(access.adminSupabase, access.subjectStudentId, id);
    const item = event.payload.attachments.find(file => file.id === fileId && file.studentAvailable);
    if (!item) calendarFailure('This file is no longer available to your account.', 'P0002');
    const file = await fetchCalendarFile(access.adminSupabase, item.url, event.id);
    if (file.checksum !== item.checksum || file.type !== item.mimeType || file.bytes.length !== item.bytes) calendarFailure('This file changed after publication. Ask the academy to republish the approved version.', '40001');
    return new NextResponse(new Uint8Array(file.bytes), { headers: { ...calendarPrivateHeaders, 'Content-Type': file.type,
      'Content-Length': String(file.bytes.length), 'Content-Disposition': `attachment; filename="event-file"; filename*=UTF-8''${encodeURIComponent(item.label.toWellFormed())}`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return calendarError(error); }
}
export async function adminCalendarFile(req: Request, id: string, fileId: string) {
  try { const access = await calendarStaff(req); if (access.errorResponse || !access.context || !access.adminSupabase) return access.errorResponse!;
    if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(fileId).success) calendarFailure('Invalid event file reference.');
    const event = await loadStaffEvent(access.adminSupabase, id), item = event.draft.attachments.find(file => file.id === fileId);
    if (!item) calendarFailure('This attachment is no longer in the event draft.', 'P0002');
    const file = await fetchCalendarFile(access.adminSupabase, item.url, event.id);
    return new NextResponse(new Uint8Array(file.bytes), { headers: { ...calendarPrivateHeaders, 'Content-Type': file.type,
      'Content-Length': String(file.bytes.length), 'Content-Disposition': `attachment; filename="event-file"; filename*=UTF-8''${encodeURIComponent(item.label.toWellFormed())}`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return calendarError(error); }
}
export async function portalCalendarPush(req: Request) {
  try { const access=await calendarStudent(req);if(access.errorResponse||!access.context||!access.adminSupabase)return access.errorResponse!;
    const enabled=process.env.STUDENT_PORTAL_PUSH_ENABLED==='true'&&Boolean(process.env.WEB_PUSH_PRIVATE_KEY&&process.env.WEB_PUSH_SUBJECT)&&/^[A-Za-z0-9_-]{87}$/.test(process.env.WEB_PUSH_PUBLIC_KEY||'');
    if(req.method==='GET')return calendarResponse({subjectStudentId:access.subjectStudentId,available:enabled,publicKey:enabled?process.env.WEB_PUSH_PUBLIC_KEY:null});
    const endpoint=z.string().max(2048).refine(validPushEndpoint,'Unsupported push provider.');
    const schema=req.method==='DELETE'?z.object({endpoint}).strict():z.object({endpoint,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)}).strict()}).strict();
    const parsed=await validateRequestBody(schema,req);if(parsed.errorResponse||!parsed.data)return calendarPrivateResponse(parsed.errorResponse!);
    if(!enabled&&req.method!=='DELETE')return NextResponse.json({success:false,error:{code:'PUSH_NOT_CONFIGURED',message:'Device alerts are not enabled yet. Your student inbox remains available.'}},{status:503,headers:calendarPrivateHeaders});
    const saved=await access.adminSupabase.rpc('portal_calendar_push_subscription',{p_user:access.context.userId,p_subscription:parsed.data,p_remove:req.method==='DELETE'});if(saved.error)throw saved.error;
    return calendarResponse({subjectStudentId:access.subjectStudentId,...(req.method==='DELETE'?{removed:true}:{subscribed:true})});
  }catch(error){return calendarError(error);}
}
