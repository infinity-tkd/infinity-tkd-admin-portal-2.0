import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, callerHasPermission } from '@/lib/backend-security';
import { featureError } from '@/lib/operations-server';
import { refreshNotices, dispatchUserPush, pushConfiguration } from '@/lib/notifications-server';
import { defaultNoticePreferences, notificationCategories, validPushEndpoint } from '@/lib/notifications';
export const runtime='nodejs';
// Students use the separately scoped calendar-v1 inbox; recipient ID alone is insufficient.
const roles=['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach'];
const endpoint=z.string().max(3000).refine(validPushEndpoint,'Unsupported push provider');
const schema=z.discriminatedUnion('action',[
 z.object({action:z.enum(['read','dismiss']),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('read-all')}).strict(),
 z.object({action:z.literal('preferences'),push_enabled:z.boolean(),muted_categories:z.array(z.enum(notificationCategories)).max(notificationCategories.length),quiet_start:z.number().int().min(0).max(23),quiet_end:z.number().int().min(0).max(23)}).strict(),
 z.object({action:z.literal('subscribe'),subscription:z.object({endpoint,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{86,90}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{20,26}$/)}).strict()}).strict()}).strict(),
 z.object({action:z.literal('unsubscribe'),endpoint}).strict(),
 z.object({action:z.literal('test')}).strict(),
]);
export async function GET(req:Request){try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,roles);if(errorResponse||!context||!adminSupabase)return errorResponse!;
 let refreshError=false;try{await refreshNotices(adminSupabase,context);}catch{refreshError=true;}
 const [notices,prefs]=await Promise.all([adminSupabase.from('portal_notifications').select('*').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(200),adminSupabase.from('portal_notification_preferences').select('push_enabled,muted_categories,quiet_start,quiet_end').eq('user_id',context.userId).maybeSingle()]);if(prefs.error)throw prefs.error;if(notices.error)throw notices.error;
 const access=new Map<string,boolean>();for(const row of notices.data??[])if(row.permission_key&&!access.has(row.permission_key))access.set(row.permission_key,await callerHasPermission(adminSupabase,context,row.permission_key));
 // LMS notices (reminders, feedback, achievements) belong to the student portal's inbox.
 const rows=(notices.data??[]).filter(row=>row.source_type!=='lms'&&(!row.permission_key||access.get(row.permission_key))).map(row=>context.role==='Student'&&row.category==='orders'?{...row,href:'/profile?orders=open'}:row);
 const preferences=prefs.data?{...prefs.data,muted_categories:(prefs.data.muted_categories??[]).filter((c:string)=>(notificationCategories as readonly string[]).includes(c))}:defaultNoticePreferences;
 return NextResponse.json({success:true,data:{notices:rows,preferences,push:pushConfiguration(),refreshError}},{headers:{'Cache-Control':'no-store'}});
}catch(error){return featureError(error);}}
export async function POST(req:Request){try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,roles);if(errorResponse||!context||!adminSupabase)return errorResponse!;
 const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
 let error;
 if(data.action==='read'||data.action==='dismiss'){({error}=await adminSupabase.from('portal_notifications').update(data.action==='read'?{read_at:new Date().toISOString()}:{dismissed_at:new Date().toISOString()}).eq('user_id',context.userId).eq('id',data.id));}
 else if(data.action==='read-all'){({error}=await adminSupabase.from('portal_notifications').update({read_at:new Date().toISOString()}).eq('user_id',context.userId).is('read_at',null).or('source_type.is.null,source_type.neq.lms'));}
 else if(data.action==='preferences'){
  // Keep student-portal (LMS) mutes, which this panel does not show.
  const current=await adminSupabase.from('portal_notification_preferences').select('muted_categories').eq('user_id',context.userId).maybeSingle();if(current.error)throw current.error;
  const kept=((current.data?.muted_categories??[]) as string[]).filter(c=>!(notificationCategories as readonly string[]).includes(c));
  ({error}=await adminSupabase.from('portal_notification_preferences').upsert({push_enabled:data.push_enabled,muted_categories:[...data.muted_categories,...kept],quiet_start:data.quiet_start,quiet_end:data.quiet_end,user_id:context.userId,updated_at:new Date().toISOString()}));}
 else if(data.action==='subscribe'){
  if(!pushConfiguration().ready)return NextResponse.json({success:false,error:{message:'Background notifications are not configured on this server yet.'}},{status:503});
  const subscriptions=await adminSupabase.from('portal_push_subscriptions').select('id,endpoint').eq('user_id',context.userId);if(subscriptions.error)throw subscriptions.error;if((subscriptions.data?.length??0)>=10&&!subscriptions.data?.some(row=>row.endpoint===data.subscription.endpoint))return NextResponse.json({success:false,error:{message:'Device limit reached. Remove an old subscription first.'}},{status:409});
  ({error}=await adminSupabase.from('portal_push_subscriptions').upsert({...data.subscription,user_id:context.userId,updated_at:new Date().toISOString()},{onConflict:'endpoint'}));
  if(!error)({error}=await adminSupabase.from('portal_notification_preferences').upsert({user_id:context.userId,push_enabled:true},{onConflict:'user_id'}));
 }else if(data.action==='unsubscribe'){({error}=await adminSupabase.from('portal_push_subscriptions').delete().eq('user_id',context.userId).eq('endpoint',data.endpoint));}
 else if(data.action==='test'){
  ({error}=await adminSupabase.from('portal_notifications').insert({user_id:context.userId,source_key:`test:${crypto.randomUUID()}`,category:'system',title:'Notifications are ready',body:'This is your notification test. Your academy records have not changed.',href:'/dashboard'}));
  if(!error)await dispatchUserPush(adminSupabase,context);
 }
 if(error)throw error;return NextResponse.json({success:true,data:{saved:true}},{headers:{'Cache-Control':'no-store'}});
}catch(error){return featureError(error);}}
