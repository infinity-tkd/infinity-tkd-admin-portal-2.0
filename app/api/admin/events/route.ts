import { adminCalendarList, adminCalendarWrite } from '@/lib/calendar-api';
export const dynamic='force-dynamic';
export const GET=adminCalendarList;
export async function POST(req:Request){return adminCalendarWrite(req,'create');}
