import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { featureRows, featureError } from '@/lib/operations-server';
import { refreshNotices, dispatchUserPush, pushConfiguration } from '@/lib/notifications-server';
import type { CallerSecurityContext } from '@/lib/backend-security';
import { claimJob, finishJob } from '@/lib/job-health';
import { runLmsJobs } from '@/lib/lms-server';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const secret=process.env.NOTIFICATION_JOB_SECRET||'',provided=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(secret.length<32)return NextResponse.json({success:false,error:{message:'The notification scheduler is not configured.'}},{status:503});
 if(Buffer.byteLength(provided)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(provided),Buffer.from(secret)))return NextResponse.json({success:false,error:{message:'Unauthorized job request.'}},{status:401});
 const started=Date.now();
 const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},db:{retry:false}});
 let runId:string|null=null;
 try{
  runId=await claimJob(client,'notifications');
  if(!runId)return NextResponse.json({success:true,data:{skipped:true,reason:'A worker already holds the active lease.'}},{headers:{'Cache-Control':'no-store'}});
  const operations=await client.rpc('portal_process_membership_dates',{}).abortSignal(AbortSignal.timeout(15000));if(operations.error)throw operations.error;
  // LMS reminders and video retention, before delivery so new reminders go out in this run.
  const lms=await runLmsJobs(client,AbortSignal.timeout(15000));
  const users=await featureRows(client.from('profiles').select('id,email,role').eq('is_active',true).eq('must_change_password',false));
  const refreshed=await client.from('portal_notification_refresh').select('user_id,refreshed_at');if(refreshed.error)throw refreshed.error;
  const previous=new Map((refreshed.data??[]).map(row=>[row.user_id,row.refreshed_at]));users.sort((a,b)=>String(previous.get(a.id)??'').localeCompare(String(previous.get(b.id)??'')));
  let completed=0,failed=0,sent=0,deliveryFailed=0;
  for(const user of users){if(Date.now()-started>45000)break;try{const context={userId:user.id,email:user.email,role:user.role} as CallerSecurityContext;await refreshNotices(client,context);const delivery=await dispatchUserPush(client,context,started+45000);sent+=delivery.sent;deliveryFailed+=delivery.failed;completed++;}catch{failed++;}}
  const metrics={completed,failed,sent,deliveryFailed,operationsFailed:Number(operations.data?.failed??0),pushConfigured:pushConfiguration().ready,pending:users.length-completed-failed,...lms};
  await finishJob(client,runId,metrics);
  return NextResponse.json({success:true,data:metrics},{status:failed||metrics.operationsFailed||lms.lmsFailed?207:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){if(runId)await finishJob(client,runId,{},'WORKER_FAILED').catch(()=>{});return featureError(error);}
 finally{client.auth.dispose();}
}
export const GET=POST;
