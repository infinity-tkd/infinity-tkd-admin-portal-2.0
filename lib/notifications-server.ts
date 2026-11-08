import type { SupabaseClient } from '@supabase/supabase-js';
import { callerHasPermission, type CallerSecurityContext } from './backend-security';
import { featureRows, loadMakeupData, ownedStudentIds } from './operations-server';
import { academyDate, addCalendarDays, daysBetween } from './dates';
import { membershipBilling } from './billing';
import { makeupCandidates } from './makeup';
import { defaultNoticePreferences, isQuietHour, isStudentQuietTime, validPushEndpoint, type PortalNotice, type NoticePreferences } from './notifications';
import webpush from 'web-push';

type Draft=Pick<PortalNotice,'source_key'|'category'|'title'|'body'|'href'|'permission_key'>;
export async function refreshNotices(client:SupabaseClient,context:CallerSecurityContext){
 const claim=await client.rpc('portal_claim_notification_refresh',{p_user:context.userId});if(claim.error)throw claim.error;if(!claim.data)return;
 try{
  const drafts:Draft[]=[];const today=academyDate();
  const [attendance,finance,orders]=context.role==='Student'?[false,false,false]:await Promise.all(['page:attendance','page:financials','page:pos'].map(permission=>callerHasPermission(client,context,permission)));
  if(attendance){
   const from=addCalendarDays(today,-14),data=await loadMakeupData(client,from,today);const missing=new Map<string,{name:string;count:number;date:string;dated:boolean}>();
   for(const row of makeupCandidates(data,from,today)){
    if(row.sourceStatus!=='Unmarked'||(['Coach','Assistant Coach'].includes(context.role)&&row.coachId&&row.coachId!==context.userId))continue;
    const key=`attendance:${row.classId}:${row.sourceDate}:${Math.floor(daysBetween(row.sourceDate,today)/3)}`,old=missing.get(key);missing.set(key,{name:row.className,count:(old?.count??0)+1,date:row.sourceDate,dated:Boolean(row.occurrenceId)});
   }
   for(const [key,row] of missing)drafts.push({source_key:key,category:'attendance',title:'Attendance needs review',body:`${row.name} · ${row.date}: ${row.count} unmarked student${row.count===1?'':'s'}. Confirm the roster or review makeup options.`,href:row.dated?`/operations?view=sessions&from=${row.date}&to=${row.date}`:`/attendance?class=${key.split(':')[1]}&date=${row.date}`,permission_key:'page:attendance'});
  }
  if(finance){
   const [students,payments,scholarships,enrollments,settings,invoices,pauses,policy]=await Promise.all([
    featureRows(client.from('students').select('id,english_name,registration_date,scholarship_id,billing_schedule,membership_start_date').in('student_status',['Active','Paused']).is('deleted_at',null)),
    featureRows(client.from('payments').select('id,student_id,year,for_month,status')),
    featureRows(client.from('scholarships').select('id,type_name,discount_percentage')),
    featureRows(client.from('class_enrollments').select('id,student_id,enrollment_date')),
    client.from('academy_profile').select('early_group_tuition_usd,standard_tuition_usd,tuition_grace_period_days').eq('id','default').maybeSingle(),
    featureRows(client.from('membership_invoices').select('id,student_id,cycle_month,amount_usd,balance_usd')),
    featureRows(client.from('membership_pauses').select('id,student_id,start_date,resume_date,voided_at')),
    client.from('academy_operations_policy').select('reminder_lead_days,late_grace_days').eq('id','default').single(),
   ]);if(settings.error)throw settings.error;
   if(policy.error)throw policy.error;
   const receipts=payments.map(row=>({studentId:row.student_id,year:row.year,month:row.for_month,status:row.status})),plans=scholarships.map(row=>({id:row.id,typeName:row.type_name,discountPercentage:Number(row.discount_percentage)})),enrolled=enrollments.map(row=>({studentId:row.student_id,enrollmentDate:row.enrollment_date}));
   const grace=policy.data?.late_grace_days??5;
   for(const row of students){
    const due=membershipBilling({id:row.id,registrationDate:row.registration_date,scholarshipId:row.scholarship_id,billingSchedule:row.billing_schedule,membershipStartDate:row.membership_start_date,billingInvoices:invoices.filter(i=>i.student_id===row.id).map(i=>({cycleMonth:i.cycle_month,amount:Number(i.amount_usd),balance:Number(i.balance_usd)})),membershipPauses:pauses.filter(p=>p.student_id===row.id).map(p=>({startDate:p.start_date,resumeDate:p.resume_date,voidedAt:p.voided_at}))},receipts,plans,enrolled,{earlyGroupTuitionUsd:Number(settings.data?.early_group_tuition_usd??25),standardTuitionUsd:Number(settings.data?.standard_tuition_usd??45),renewalReminderDays:policy.data?.reminder_lead_days??5,latePaymentGraceDays:grace});
    if(due.amountOwed<=0||due.nextRenewalDate==='-'||due.status==='Current')continue;
    const phase=due.status==='Due today'?'due':due.status==='Within grace'?'grace':due.status==='Overdue'?'overdue':'upcoming';
    drafts.push({source_key:`billing:${row.id}:${due.nextRenewalDate.slice(0,7)}:${phase}:${phase==='overdue'?Math.floor(Math.max(0,-due.daysRemaining-grace)/7):0}`,category:'billing',title:phase==='due'?'Membership due today':phase==='overdue'?'Membership follow-up needed':phase==='grace'?'Membership due — within grace':'Membership renewal approaching',body:`${row.english_name} · due ${due.nextRenewalDate}.${phase==='grace'?` Grace ends ${addCalendarDays(due.nextRenewalDate,grace)}.`:''} Review the ledger before contacting the student.`,href:`/financials?student=${encodeURIComponent(row.id)}`,permission_key:'page:financials'});
   }
  }
  if(context.role!=='Student'){
   for(const task of await featureRows(client.from('followup_tasks').select('id,title,due_date,category').eq('assigned_to',context.userId).in('status',['open','in_progress']).lte('due_date',today))){
    const permission=task.category==='billing'?'page:financials':task.category==='attendance'?'page:attendance':task.category==='orders'?'page:pos':'page:dashboard';
    if(!await callerHasPermission(client,context,permission))continue;
    drafts.push({source_key:`task:${task.id}:${Math.floor(daysBetween(task.due_date,today)/3)}`,category:'system',title:'Assigned follow-up is due',body:`${task.title} · due ${task.due_date}. Record the outcome when the follow-up is complete.`,href:'/operations?view=today',permission_key:permission});
   }
  }
  const ownStudents=context.role==='Student'?await ownedStudentIds(client,context.userId):[];
  if(orders||ownStudents.length){let query=client.from('pos_orders').select('id,order_number,order_status,payment_status,student_id').gte('created_at',addCalendarDays(today,-30));if(!orders)query=query.in('student_id',ownStudents);else query=query.eq('order_channel','STUDENT_PORTAL');
   for(const row of await featureRows(query)){if(orders&&row.order_status!=='PENDING_CONFIRMATION')continue;drafts.push({source_key:`orders:${row.id}:${row.order_status}:${row.payment_status}`,category:'orders',title:orders?'New student order':'Your order has an update',body:orders?`Order ${row.order_number} needs confirmation. Check stock and payment before fulfillment.`:`Order ${row.order_number}: ${row.order_status.replaceAll('_',' ').toLowerCase()}. Payment: ${row.payment_status.toLowerCase()}.`,href:orders?'/pos?orders=open':'/profile?orders=open',permission_key:orders?'page:pos':null});}
  }
  if(drafts.length){const saved=await client.from('portal_notifications').upsert(drafts.map(row=>({...row,user_id:context.userId,resolved_at:null})),{onConflict:'user_id,source_key',ignoreDuplicates:false});if(saved.error)throw saved.error;}
  const old=(await featureRows(client.from('portal_notifications').select('id,source_key,category').eq('user_id',context.userId).is('resolved_at',null))).filter(row=>['attendance','billing','orders'].includes(row.category)||row.source_key.startsWith('task:'));
  const active=new Set(drafts.map(row=>row.source_key));const resolved=old.filter(row=>!active.has(row.source_key)).map(row=>row.id);
  if(resolved.length){const result=await client.from('portal_notifications').update({resolved_at:new Date().toISOString()}).eq('user_id',context.userId).in('id',resolved);if(result.error)throw result.error;}
 }catch(error){await client.from('portal_notification_refresh').delete().eq('user_id',context.userId);throw error;}
}
export function pushConfiguration(){return {ready:Boolean(process.env.WEB_PUSH_PUBLIC_KEY&&process.env.WEB_PUSH_PRIVATE_KEY&&process.env.WEB_PUSH_SUBJECT),publicKey:process.env.WEB_PUSH_PUBLIC_KEY||''};}
export type StudentPushLanguage='en'|'kh'|'zh';
// The student portal worker (public/sw.js) drops any push without sourceType plus UUID sourceId/noticeId and renders its
// own localized lock-screen copy, so student pushes carry references only: no title, body, name or destination URL.
export function pushPayload(row:Pick<PortalNotice,'id'|'source_type'|'source_id'>,student:boolean,language:StudentPushLanguage='en'){
 return student?{sourceType:row.source_type,sourceId:row.source_id,noticeId:row.id,language}:{title:'Infinity TKD',body:'You have an academy update. Open the portal to review it.',tag:`infinity:${row.id}`,url:'/profile?notifications=open'};
}
// Presentation-only preference: an unreadable or missing row falls back to English rather than blocking delivery.
async function studentPushLanguage(client:SupabaseClient,userId:string):Promise<StudentPushLanguage>{
 const result=await client.from('student_portal_preferences').select('language').eq('user_id',userId).maybeSingle();
 const language=result.error?null:result.data?.language;
 return language==='kh'||language==='zh'?language:'en';
}
export async function dispatchUserPush(client:SupabaseClient,context:CallerSecurityContext,deadline=Date.now()+12000){
 if(!pushConfiguration().ready)return {sent:0,failed:0,configured:false};
 const student=context.role==='Student';
 if(student&&process.env.STUDENT_PORTAL_PUSH_ENABLED!=='true')return {sent:0,failed:0,configured:false};
 if(student){const ids=await ownedStudentIds(client,context.userId);const academy=await client.from('academy_profile').select('allow_student_portal_login').eq('id','default').maybeSingle();if(academy.error)throw academy.error;if(ids.length!==1||!academy.data?.allow_student_portal_login)return {sent:0,failed:0,configured:false};}
 const pref=await client.from('portal_notification_preferences').select('*').eq('user_id',context.userId).maybeSingle();if(pref.error)throw pref.error;
 const preferences:NoticePreferences=pref.data??defaultNoticePreferences;
 const quiet=student?isStudentQuietTime(pref.data?.student_quiet_start??null,pref.data?.student_quiet_end??null):isQuietHour(preferences);
 if(!preferences.push_enabled||quiet)return {sent:0,failed:0,configured:true};
 const subscriptions=await featureRows(client.from('portal_push_subscriptions').select('*').eq('user_id',context.userId).eq('app_scope',student?'student':'admin'));
 const language=student&&subscriptions.length?await studentPushLanguage(client,context.userId):'en';
 let sent=0,failed=0,attempts=0;
 for(const subscription of subscriptions){
  if(attempts>=40||Date.now()+5500>deadline)return {sent,failed,configured:true};
  if(!validPushEndpoint(subscription.endpoint))continue;
  const candidates=await client.rpc('portal_push_candidates',{p_user:context.userId,p_subscription:subscription.id,p_limit:20});if(candidates.error)throw candidates.error;
  for(const row of (candidates.data??[]) as PortalNotice[]){
  if(preferences.muted_categories.includes(row.category)||row.permission_key&&!await callerHasPermission(client,context,row.permission_key))continue;
   if(attempts>=40||Date.now()+5500>deadline)return {sent,failed,configured:true};
   const claim=await client.rpc('portal_claim_push',{p_notification:row.id,p_subscription:subscription.id});if(claim.error)throw claim.error;if(!claim.data)continue;attempts++;
   try{
    await webpush.sendNotification({endpoint:subscription.endpoint,keys:subscription.keys},JSON.stringify(pushPayload(row,student,language)),{vapidDetails:{subject:process.env.WEB_PUSH_SUBJECT!,publicKey:process.env.WEB_PUSH_PUBLIC_KEY!,privateKey:process.env.WEB_PUSH_PRIVATE_KEY!},TTL:3600,timeout:5000,urgency:'normal'});
    const done=await client.from('portal_push_deliveries').update({sent_at:new Date().toISOString(),lease_until:null}).eq('notification_id',row.id).eq('subscription_id',subscription.id);if(done.error)throw done.error;sent++;
   }catch(error){
    failed++;const code=Number((error as {statusCode?:number}).statusCode)||0;
    if(code===404||code===410){await client.from('portal_push_subscriptions').delete().eq('id',subscription.id).eq('user_id',context.userId);}
    else await client.from('portal_push_deliveries').update({lease_until:null,next_attempt_at:new Date(Date.now()+30*60000).toISOString(),last_error_code:code}).eq('notification_id',row.id).eq('subscription_id',subscription.id);
   }
  }
 }
 return {sent,failed,configured:true};
}
