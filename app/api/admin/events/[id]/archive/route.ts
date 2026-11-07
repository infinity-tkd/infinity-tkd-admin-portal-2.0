import { adminCalendarWrite } from '@/lib/calendar-api';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return adminCalendarWrite(req, 'archive', (await context?.params)?.id || '');
}
