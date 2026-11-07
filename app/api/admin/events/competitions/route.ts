import { calendarStaff, calendarResponse, calendarError } from '@/lib/calendar-admin-server';
import { calendarFailure } from '@/lib/calendar-cursor';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const access=await calendarStaff(req);if(access.errorResponse||!access.adminSupabase)return access.errorResponse!;
 const params=new URL(req.url).searchParams,term=(params.get('q')||'').trim();
 if(term.length>80||[...params.keys()].some(key=>key!=='q'||params.getAll(key).length!==1))calendarFailure('Invalid competition search.');
 let query=access.adminSupabase.from('academy_events').select('id,published_payload').is('archived_at',null).not('published_revision','is',null).eq('published_payload->>type','competition').order('published_at',{ascending:false}).limit(50);
 if(term)query=query.ilike('published_payload->>title',`%${term.replace(/[\\%_]/g,'\\$&')}%`);
 const result=await query;if(result.error)throw result.error;
 return calendarResponse({competitions:(result.data||[]).map(row=>({id:row.id,title:row.published_payload.title,startDate:row.published_payload.startDate}))});
}catch(error){return calendarError(error);}}
