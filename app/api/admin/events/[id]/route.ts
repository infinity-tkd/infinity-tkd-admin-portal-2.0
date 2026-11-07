import { adminCalendarRead,adminCalendarWrite } from '@/lib/calendar-api';
export const dynamic='force-dynamic';
type Route={params:Promise<{id:string}>};
export async function GET(req:Request,context:Route){return adminCalendarRead(req,(await context?.params)?.id || '');}
export async function PATCH(req:Request,context:Route){return adminCalendarWrite(req,'save',(await context?.params)?.id || '');}
