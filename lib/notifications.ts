export const notificationCategories = ['attendance','billing','orders','system','events'] as const;
export type NotificationCategory = typeof notificationCategories[number];
export interface PortalNotice { id: string; source_key: string; category: NotificationCategory; title: string; body: string; href: string; permission_key?: string|null; read_at?: string|null; dismissed_at?: string|null; resolved_at?: string|null; created_at: string; source_type?:string|null;source_id?:string|null;source_revision?:number|null;subject_student_id?:string|null;delivered_at?:string|null }
export interface NoticePreferences { push_enabled:boolean; muted_categories:NotificationCategory[];quiet_start:number;quiet_end:number }
export const defaultNoticePreferences:NoticePreferences={push_enabled:false,muted_categories:[],quiet_start:22,quiet_end:7};
export function safeNotificationPath(value:unknown):string {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/dashboard';
 try{const url=new URL(value,'https://portal.invalid');return url.origin==='https://portal.invalid'&&['/dashboard','/attendance','/financials','/pos','/pro-shop','/students','/profile','/operations','/calendar'].includes(url.pathname)?url.pathname+url.search:'/dashboard';}catch{return '/dashboard';}
}
export function validPushEndpoint(value:string):boolean {
 try{
  const url=new URL(value);
  const trusted=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||url.hostname.endsWith('.notify.windows.com');
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&trusted;
 }catch{return false;}
}
export function isQuietHour(preferences:NoticePreferences,date=new Date()):boolean {
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',hour:'2-digit',hourCycle:'h23'}).format(date));
 const start=preferences.quiet_start,end=preferences.quiet_end;
 return start===end?false:start<end?hour>=start&&hour<end:hour>=start||hour<end;
}
export function isStudentQuietTime(start:string|null,end:string|null,date=new Date()):boolean {
 if(!start||!end)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 return start<end?parts>=start&&parts<end:parts>=start||parts<end;
}
export function pushSupported():boolean {return typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
