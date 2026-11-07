import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const context={userId:'fixture-user',role:'Admin'};
function fixture({failure,permission=true,claim=true,muted=[],push=true}={}){
 const changes=[],sent=[];const notices=[{id:'notice',category:'billing',created_at:'2026-10-24T01:00:00Z',permission_key:'page:financials',body:'Private student name must never be pushed'}];
 const client={from(table){const q={table,select(){return q;},eq(){return q;},is(){return q;},gte(){return q;},update(body){changes.push({table,action:'update',body});return q;},delete(){changes.push({table,action:'delete'});return q;},maybeSingle:async()=>({data:{push_enabled:push,quiet_start:0,quiet_end:0,muted_categories:muted},error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;},rpc:async name=>({data:name==='portal_push_candidates'?notices:claim,error:null})};
 const transport={sendNotification:async(subscription,payload)=>{sent.push({subscription,payload:JSON.parse(payload)});if(failure)throw {statusCode:failure};}};
 const server=loadTs('lib/notifications-server.ts',{'./backend-security':{callerHasPermission:async()=>permission},'./operations-server':{featureRows:async query=>query.table==='portal_notifications'?notices:[{id:'subscription',endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{}}]},'web-push':transport});
 return {client,server,changes,sent};
}
async function withConfig(run){const keys=['WEB_PUSH_PUBLIC_KEY','WEB_PUSH_PRIVATE_KEY','WEB_PUSH_SUBJECT'];const old=keys.map(key=>process.env[key]);try{keys.forEach(key=>process.env[key]='fictional-test-value');await run();}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}}
test('push delivery uses a lease, generic payload and persistent delivery acknowledgment',()=>withConfig(async()=>{
 const f=fixture();assert.equal((await f.server.dispatchUserPush(f.client,context)).sent,1);assert.equal(f.sent.length,1);assert.equal(f.sent[0].payload.url,'/profile?notifications=open');assert.ok(!JSON.stringify(f.sent).includes('Private student'));assert.ok(f.changes.some(row=>row.table==='portal_push_deliveries'&&row.body.sent_at));
 for(const options of [{claim:false},{permission:false},{muted:['billing']},{push:false}]){const x=fixture(options);assert.equal((await x.server.dispatchUserPush(x.client,context)).sent,0);assert.equal(x.sent.length,0);}
}));
test('expired subscriptions are removed and transient failures persist a bounded retry time',()=>withConfig(async()=>{
 const expired=fixture({failure:410});assert.equal((await expired.server.dispatchUserPush(expired.client,context)).failed,1);assert.ok(expired.changes.some(row=>row.table==='portal_push_subscriptions'&&row.action==='delete'));
 const transient=fixture({failure:503});assert.equal((await transient.server.dispatchUserPush(transient.client,context)).failed,1);const retry=transient.changes.find(row=>row.table==='portal_push_deliveries');assert.equal(retry.body.last_error_code,503);assert.ok(Date.parse(retry.body.next_attempt_at)>Date.now()+29*60000);
 const deadline=fixture();await deadline.server.dispatchUserPush(deadline.client,context,Date.now());assert.equal(deadline.sent.length,0);
}));
