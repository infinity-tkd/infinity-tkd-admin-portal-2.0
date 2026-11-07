import {portalCalendarEvent} from '@/lib/calendar-api';
export const dynamic='force-dynamic';
export async function GET(req:Request,context:{params:Promise<{id:string}>}){return portalCalendarEvent(req,(await context?.params)?.id || '');}
