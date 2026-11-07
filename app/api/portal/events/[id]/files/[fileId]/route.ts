import {portalCalendarFile} from '@/lib/calendar-api';
export const dynamic='force-dynamic';
export async function GET(req:Request,context:{params:Promise<{id:string;fileId:string}>}){const {id='',fileId=''}=(await context?.params)||{};return portalCalendarFile(req,id,fileId);}
