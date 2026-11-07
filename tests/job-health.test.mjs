import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
import {spawnSync} from 'node:child_process';
const {finishJob,claimJob}=loadTs('lib/job-health.ts');
test('job health records partial membership failures and releases only its own lease',async()=>{
 const writes=[],filters=[];const client={from(table){const query={update(value){writes.push({table,value});return query;},delete(){writes.push({table,deleted:true});return query;},eq(...value){filters.push({table,value});return query;},select(){return query;},single:async()=>({data:{id:'old-run'},error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve);}};return query;}};
 await finishJob(client,'old-run',{operationsFailed:1});assert.equal(writes[0].value.status,'partial');assert.ok(filters.some(row=>row.table==='portal_job_leases'&&row.value[0]==='run_id'&&row.value[1]==='old-run'));
 await finishJob(client,'old-run',{},'WORKER_FAILED');assert.equal(writes.findLast(row=>row.table==='portal_job_runs').value.status,'failed');
});
test('job health surfaces storage failures and never releases a replacement lease after an abandoned run',async()=>{
 let released=false;const client={from(table){assert.equal(table,'portal_job_runs');const q={update(){return q;},eq(){return q;},select(){return q;},single:async()=>({data:null,error:{code:'PGRST116'}}),delete(){released=true;return q;}};return q;}};
 await assert.rejects(finishJob(client,'abandoned-run',{}),error=>error.code==='PGRST116');assert.equal(released,false);
 assert.equal(await claimJob({rpc:()=>({abortSignal:async()=>({data:null,error:null})})},'notifications'),null);
 await assert.rejects(claimJob({rpc:()=>({abortSignal:async()=>({error:{code:'08006'}})})},'notifications'),error=>error.code==='08006');
});
test('the notification worker starts on Node 22 and returns failure for partial membership work',()=>{
 for(const [data,status] of [[{completed:1,failed:0,deliveryFailed:0,operationsFailed:1},1],[{skipped:true},0]]) {
  const mock='data:text/javascript,'+encodeURIComponent(`globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:${JSON.stringify(data)}}),{status:200});`);
  const run=spawnSync(process.execPath,['--import',mock,'scripts/run-notifications.mjs','--once'],{encoding:'utf8',env:{...process.env,APP_URL:'http://127.0.0.1:3119',NOTIFICATION_JOB_SECRET:'fixture-job-secret-with-thirty-two-characters'},timeout:15000});
  assert.equal(run.status,status,run.stderr);assert.ok(run.stdout.includes('"time"'));
 }
});
