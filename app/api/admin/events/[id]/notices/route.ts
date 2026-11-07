import {adminCalendarWrite} from '@/lib/calendar-api';
export const dynamic='force-dynamic';
export async function POST(req:Request,context:{params:Promise<{id:string}>}){return adminCalendarWrite(req,'notice',(await context?.params)?.id || '');}
