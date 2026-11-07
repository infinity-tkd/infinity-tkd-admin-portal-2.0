import {adminCalendarWrite} from '@/lib/calendar-api';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request,context:{params:Promise<{id:string}>}){return adminCalendarWrite(req,'publish',(await context?.params)?.id || '');}
