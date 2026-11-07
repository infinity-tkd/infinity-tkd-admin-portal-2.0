import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {loadTs} from '../tests/load-ts.mjs';
nextEnv.loadEnvConfig(process.cwd());
const {readOperations}=loadTs('lib/operations-read.ts');
const {academyDate,addCalendarDays}=loadTs('lib/dates.ts');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure the server database connection first.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false}});
// Service-only schema/read verification. This does not test a real user's login,
// call mutation functions, generate notifications, or print student/receipt rows.
try {
 const profile=await client.from('profiles').select('id,role').eq('is_active',true).eq('must_change_password',false).in('role',['Root','Super Root','Admin']).limit(1).maybeSingle();
 if(profile.error||!profile.data)throw new Error('An active administrator is required for scoped read verification.');
 const student=await client.from('students').select('id').is('deleted_at',null).limit(1).maybeSingle();if(student.error)throw new Error('Student schema verification failed.');
 const actor={userId:profile.data.id,role:profile.data.role};
 const results=[];
 for(const view of ['today','sessions','billing','reconciliation','timeline','grading','health','quality','performance','policy']) {
  if(!student.data&&['billing','timeline'].includes(view)){results.push({view,skipped:true});continue;}
  const params=new URLSearchParams({view,from:addCalendarDays(academyDate(),-7),to:academyDate(),...(student.data?{studentId:student.data.id}:{})});
  try {await readOperations(client,actor,params);results.push({view,ok:true});}
  catch(error){results.push({view,ok:false,code:typeof error?.code==='string'?error.code:'READ_FAILED'});}
 }
 console.log(JSON.stringify({scope:'real scoped service reads; no writes or row output',results,passed:results.every(row=>row.ok||row.skipped)},null,2));
 if(results.some(row=>row.ok===false))process.exitCode=1;
} finally {client.auth.dispose();}
