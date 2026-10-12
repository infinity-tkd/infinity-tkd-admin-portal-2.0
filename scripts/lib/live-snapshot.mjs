import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {createClient} from '@supabase/supabase-js';
import {fetchAllRows,settleReads} from './read-helpers.mjs';
const require = createRequire(import.meta.url);
const {loadEnvConfig} = require('@next/env');

/** Read real API data into memory only. Never print rows, keys or credentials. */
export async function liveSnapshot() {
 loadEnvConfig(process.cwd());
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error('Configure the server-only Supabase environment first.');
 const client = createClient(url,key,{db:{retry:false},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const tables = ['profiles','members','students','branches','class_sessions','class_enrollments','scholarships','attendance',
  'payments','belt_histories','achievements','library_assets','lms_progress','workout_templates',
  'student_physical_evaluations','belt_techniques','muscles','library_asset_muscles','student_body_compositions',
  'academy_profile','role_permissions','user_permissions','staff_dan_history','partners','payment_transactions'];
 const datasets = {}, summaries = [];
 const start = performance.now();
 const results = await settleReads(tables.map(table => async () => {
  let query = client.from(table).select(table==='members' ? '*,member_addresses(*)' : table==='students' ? '*,student_addresses(*)' : '*');
  if(table==='students') query=query.is('deleted_at',null);
  const began = performance.now();
  const result = await fetchAllRows(query);
  if(result.error) throw new Error(table + ': ' + (result.error.code || 'READ_FAILURE'));
  datasets[table] = result.data;
  summaries.push({dataset:table,rows:result.data.length,bytes:Buffer.byteLength(JSON.stringify(result.data)),ms:Math.round(performance.now()-began)});
 }));
 client.auth.dispose();
 const failures=results.flatMap((result,index)=>result.status==='rejected' ? [{dataset:tables[index],code:String(result.reason?.message||'READ_FAILURE').split(': ').pop()}] : []);
 if(failures.length) throw new Error('Live reads failed: '+JSON.stringify(failures));
 return {datasets,summaries:summaries.sort((a,b)=>a.dataset.localeCompare(b.dataset)),ms:Math.round(performance.now()-start)};
}
