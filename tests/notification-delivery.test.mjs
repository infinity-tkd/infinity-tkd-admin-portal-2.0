import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const context={userId:'fixture-user',role:'Admin'};
const studentContext={userId:'fixture-student-user',role:'Student'};
const adminNotice={id:'notice',category:'billing',created_at:'2026-10-24T01:00:00Z',permission_key:'page:financials',body:'Private student name must never be pushed'};
const studentNotice={id:'6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',category:'events',source_type:'academy_event',source_id:'0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d',created_at:'2026-11-08T01:00:00Z',permission_key:null,title:'Private event title for a named student',body:'Private student name must never be pushed',href:'/calendar?event=private'};
function fixture({failure,permission=true,claim=true,muted=[],push=true,notices=[adminNotice],language,languageError=false,owned=['fixture-student']}={}){
 const changes=[],sent=[],reads=[],scopes=[];
 const rows={portal_notification_preferences:{push_enabled:push,quiet_start:0,quiet_end:0,muted_categories:muted},academy_profile:{allow_student_portal_login:true},student_portal_preferences:language===undefined?null:{language}};
 const client={from(table){const q={table,filters:{},select(){return q;},eq(key,value){q.filters[key]=value;return q;},is(){return q;},gte(){return q;},update(body){changes.push({table,action:'update',body});return q;},delete(){changes.push({table,action:'delete'});return q;},maybeSingle:async()=>{reads.push({table,filters:{...q.filters}});return table==='student_portal_preferences'&&languageError?{data:null,error:{message:'unavailable'}}:{data:rows[table]??null,error:null};},then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;},rpc:async name=>({data:name==='portal_push_candidates'?notices:claim,error:null})};
 const transport={sendNotification:async(subscription,payload)=>{sent.push({subscription,payload:JSON.parse(payload)});if(failure)throw {statusCode:failure};}};
 const server=loadTs('lib/notifications-server.ts',{'./backend-security':{callerHasPermission:async()=>permission},'./operations-server':{ownedStudentIds:async()=>owned,featureRows:async query=>{if(query.table==='portal_push_subscriptions')scopes.push(query.filters.app_scope);return query.table==='portal_notifications'?notices:[{id:'subscription',endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{}}];}},'web-push':transport});
 return {client,server,changes,sent,reads,scopes};
}
async function withEnv(values,run){const keys=Object.keys(values);const old=keys.map(key=>process.env[key]);try{keys.forEach(key=>process.env[key]=values[key]);await run();}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}}
const pushKeys={WEB_PUSH_PUBLIC_KEY:'fictional-test-value',WEB_PUSH_PRIVATE_KEY:'fictional-test-value',WEB_PUSH_SUBJECT:'fictional-test-value'};
const withConfig=run=>withEnv(pushKeys,run);
const withStudentPush=run=>withEnv({...pushKeys,STUDENT_PORTAL_PUSH_ENABLED:'true'},run);
// Mirrors the student portal worker's acceptance rule (student portal public/sw.js push handler and
// docs/design/STUDENT_PORTAL_CALENDAR_API_CONTRACT.md "Worker payload"): anything else is silently dropped.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const studentWorkerAccepts=data=>['academy_event','belt_test'].includes(data?.sourceType)&&typeof data.sourceId==='string'&&uuid.test(data.sourceId)&&typeof data.noticeId==='string'&&uuid.test(data.noticeId);
test('push delivery uses a lease, generic payload and persistent delivery acknowledgment',()=>withConfig(async()=>{
 const f=fixture();assert.equal((await f.server.dispatchUserPush(f.client,context)).sent,1);assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].payload,{title:'Infinity TKD',body:'You have an academy update. Open the portal to review it.',tag:'infinity:notice',url:'/profile?notifications=open'});assert.ok(!JSON.stringify(f.sent).includes('Private student'));assert.ok(f.changes.some(row=>row.table==='portal_push_deliveries'&&row.body.sent_at));
 assert.deepEqual(f.scopes,['admin']);assert.ok(!f.reads.some(row=>row.table==='student_portal_preferences'),'staff pushes do not read student presentation preferences');
 for(const options of [{claim:false},{permission:false},{muted:['billing']},{push:false}]){const x=fixture(options);assert.equal((await x.server.dispatchUserPush(x.client,context)).sent,0);assert.equal(x.sent.length,0);}
}));
test('expired subscriptions are removed and transient failures persist a bounded retry time',()=>withConfig(async()=>{
 const expired=fixture({failure:410});assert.equal((await expired.server.dispatchUserPush(expired.client,context)).failed,1);assert.ok(expired.changes.some(row=>row.table==='portal_push_subscriptions'&&row.action==='delete'));
 const transient=fixture({failure:503});assert.equal((await transient.server.dispatchUserPush(transient.client,context)).failed,1);const retry=transient.changes.find(row=>row.table==='portal_push_deliveries');assert.equal(retry.body.last_error_code,503);assert.ok(Date.parse(retry.body.next_attempt_at)>Date.now()+29*60000);
 const deadline=fixture();await deadline.server.dispatchUserPush(deadline.client,context,Date.now());assert.equal(deadline.sent.length,0);
}));
test('student pushes carry only the worker contract references and the student language',()=>withStudentPush(async()=>{
 const f=fixture({notices:[studentNotice],language:'kh'});assert.equal((await f.server.dispatchUserPush(f.client,studentContext)).sent,1);assert.equal(f.sent.length,1);
 const payload=f.sent[0].payload;
 assert.deepEqual(payload,{sourceType:'academy_event',sourceId:studentNotice.source_id,noticeId:studentNotice.id,language:'kh'});
 assert.ok(studentWorkerAccepts(payload),'the student service worker would display this push');
 assert.ok(!JSON.stringify(payload).includes('Private'),'no private title or body text');
 for(const key of ['title','body','tag','url','href'])assert.ok(!(key in payload),`student payload omits ${key}`);
 assert.deepEqual(f.scopes,['student']);
 assert.deepEqual(f.reads.find(row=>row.table==='student_portal_preferences')?.filters,{user_id:studentContext.userId});
 assert.ok(f.changes.some(row=>row.table==='portal_push_deliveries'&&row.body.sent_at));
 for(const options of [{},{language:'fr'},{languageError:true}]){const x=fixture({notices:[studentNotice],...options});assert.equal((await x.server.dispatchUserPush(x.client,studentContext)).sent,1);assert.equal(x.sent[0].payload.language,'en');}
 for(const language of ['en','zh']){const x=fixture({notices:[studentNotice],language});await x.server.dispatchUserPush(x.client,studentContext);assert.equal(x.sent[0].payload.language,language);}
 for(const options of [{claim:false},{push:false},{owned:[]},{owned:['first','second']}]){const x=fixture({notices:[studentNotice],language:'kh',...options});assert.equal((await x.server.dispatchUserPush(x.client,studentContext)).sent,0);assert.equal(x.sent.length,0);}
 const retry=fixture({notices:[studentNotice],failure:503});assert.equal((await retry.server.dispatchUserPush(retry.client,studentContext)).failed,1);assert.equal(retry.changes.find(row=>row.table==='portal_push_deliveries').body.last_error_code,503);
}));
test('student pushes stay off until the student release flag is enabled',()=>withEnv({...pushKeys,STUDENT_PORTAL_PUSH_ENABLED:'false'},async()=>{
 const f=fixture({notices:[studentNotice],language:'kh'});assert.deepEqual(await f.server.dispatchUserPush(f.client,studentContext),{sent:0,failed:0,configured:false});assert.equal(f.sent.length,0);
}));
test('the payload builder keeps the staff copy and never leaks student notice text',async()=>{
 const {pushPayload}=fixture().server;
 assert.deepEqual(pushPayload(studentNotice,false),{title:'Infinity TKD',body:'You have an academy update. Open the portal to review it.',tag:`infinity:${studentNotice.id}`,url:'/profile?notifications=open'});
 assert.deepEqual(pushPayload(studentNotice,true),{sourceType:'academy_event',sourceId:studentNotice.source_id,noticeId:studentNotice.id,language:'en'});
});
