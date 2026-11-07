import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { operationsDatabase, root, coach } from './fixtures/operations-db.mjs';
import { loadTs } from './load-ts.mjs';

const alice='94000000-0000-4000-8000-000000000001';
const bob='94000000-0000-4000-8000-000000000002';
const admin='94000000-0000-4000-8000-000000000003';
const subject='STU-M-001';
const pdf=Buffer.from('%PDF-1.7\nFixture-only calendar rules\n%%EOF');
const pdfHash=createHash('sha256').update(pdf).digest('hex');
const draft={title:'Fixture inter-branch workshop',type:'workshop',lifecycle:'scheduled',startDate:'2026-11-10',endDate:'2026-11-12',startsAt:null,endsAt:null,timezone:'Asia/Phnom_Penh',location:'Fixture hall',description:'Approved public workshop description',internalNotes:'PRIVATE-PLANNING-DO-NOT-PUBLISH',audience:{mode:'branches',branchIds:[1],classIds:[],studentIds:[]},attachments:[],changeReason:''};
const {studentNoticePreview}=loadTs('components/calendar/calendar-notice.ts');

/** Parameterized transport adapter: all persisted rows and RPCs use real PostgreSQL. */
function databaseClient(db, tokens) {
  let failure=null;
  const quote=value=>{value=value.trim();if(!/^[a-z_][a-z0-9_]*$/i.test(value))throw Error('Unsupported fixture identifier');return '"'+value+'"';};
  return {
    failNext(error,name='*'){failure={error,name};},
    auth:{getUser:async token=>({data:{user:tokens.has(token)?{id:tokens.get(token)}:null},error:tokens.has(token)?null:{message:'Fixture identity rejected'}})},
    storage:{from:bucket=>({createSignedUrl:async path=>{assert.equal(bucket,'academy-events');return {data:{signedUrl:'https://calendar-fixture.supabase.co/storage/v1/object/sign/'+bucket+'/'+path},error:null};}})},
    from(table){
      let columns='*',one=false,required=false,limit=null;
      const predicates=[],values=[],orders=[];
      const filter=(column,operator,value)=>{values.push(value);predicates.push(quote(column)+' '+operator+' $'+values.length);return query;};
      const query={
        select(value){columns=value==='*'?'*':value.split(',').map(quote).join(',');return query;},
        eq:(column,value)=>filter(column,'=',value),lt:(column,value)=>filter(column,'<',value),gt:(column,value)=>filter(column,'>',value),
        in(column,items){values.push(items);predicates.push(quote(column)+' = ANY($'+values.length+')');return query;},
        is(column,value){assert.equal(value,null);predicates.push(quote(column)+' IS NULL');return query;},
        order(column,{ascending=true}={}){orders.push(quote(column)+(ascending?' ASC':' DESC'));return query;},
        limit(value){assert.ok(Number.isInteger(value)&&value>0);limit=value;return query;},
        single(){one=true;required=true;return query;},maybeSingle(){one=true;return query;},
        async then(resolve){try{
          const sql='SELECT '+columns+' FROM public.'+quote(table)+(predicates.length?' WHERE '+predicates.join(' AND '):'')+(orders.length?' ORDER BY '+orders.join(','):'')+(limit?' LIMIT '+limit:'');
          const rows=JSON.parse(JSON.stringify((await db.query(sql,values)).rows));
          resolve(one?{data:rows[0]??null,error:rows.length>1||required&&!rows.length?{code:'PGRST116',message:'Single row not found'}:null}:{data:rows,error:null});
        }catch(error){resolve({data:null,error});}}
      };
      return query;
    },
    async rpc(name,args={}){
      if(failure&&(failure.name==='*'||failure.name===name)){const error=failure.error;failure=null;return {data:null,error};}
      try{
        const entries=Object.entries(args),parameters=entries.map(([key],index)=>quote(key)+' => $'+(index+1));
        const set=name==='portal_calendar_student_events';
        const sql=(set?'SELECT * FROM ':'SELECT ')+quote(name)+'('+parameters.join(',')+')'+(set?'':' AS value');
        const rows=JSON.parse(JSON.stringify((await db.query(sql,entries.map(([,value])=>value))).rows));
        return {data:set?rows:rows[0].value,error:null};
      }catch(error){return {data:null,error};}
    }
  };
}

async function setup(){
  const db=await operationsDatabase();
  await db.exec(fs.readFileSync('supabase/migrations/20261101030526_academy_calendar_and_student_notices.sql','utf8'));
  for(const file of ['20261012065927_portal_achievement_integrity.sql','20261101033250_academy_event_achievement_links.sql','20261101042452_calendar_archive_and_inbox_reliability.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  await db.exec(`INSERT INTO branches(id,branch_name) VALUES(2,'Fixture second branch');UPDATE students SET home_branch_id=2 WHERE id='STU-M-002';
    INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('default','Fixture academy',true) ON CONFLICT(id) DO UPDATE SET allow_student_portal_login=true;
    INSERT INTO auth.users(id,email) VALUES('${alice}','alice@example.test'),('${bob}','bob@example.test'),('${admin}','admin@example.test');
    INSERT INTO profiles(id,username,email,display_name,role,student_id) VALUES('${alice}','alice','alice@example.test','Fixture Alice','Student','STU-M-001'),('${bob}','bob','bob@example.test','Fixture Bob','Student','STU-M-002'),('${admin}','admin','admin@example.test','Fixture administrator','Admin',null);
    UPDATE students SET profile_id='${alice}' WHERE id='STU-M-001';UPDATE students SET profile_id='${bob}' WHERE id='STU-M-002';SET ROLE service_role;`);
  const tokens=new Map(),tokenById=new Map();
  for(const id of [root,coach,alice,bob,admin]){const token='fixture.'+Buffer.from(JSON.stringify({sub:id,aal:'aal2'})).toString('base64url')+'.fixture-only';tokens.set(token,id);tokenById.set(id,token);}
  const client=databaseClient(db,tokens);
  const stubs={
    '@supabase/supabase-js':{createClient:()=>client},
    './env':{env:{NEXT_PUBLIC_SUPABASE_URL:'https://calendar-fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-publishable',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only'}},
  };
  const api=loadTs('lib/calendar-api.ts',stubs);
  const request=(path,id=alice,method='GET',body,headers={})=>new Request('https://calendar-fixture.test'+path,{method,headers:{...(id?{Authorization:'Bearer '+tokenById.get(id)}:{}),'X-Portal-Contract':'calendar-v1',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());assert.match(response.headers.get('cache-control')??'',/private.*no-store/);return (await response.json()).data;};
  return {db,client,api,request,json};
}

test('actual admin and student handlers complete the PostgreSQL-backed publish/notify flow without crossing audience or leaking drafts',async()=>{
  const priorUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,priorFetch=globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://calendar-fixture.supabase.co';
  let returnedPdf=pdf,fetches=0;
  globalThis.fetch=async(url,init)=>{assert.match(String(url),/^https:\/\/calendar-fixture\.supabase\.co\/storage\/v1\/object\/sign\/academy-events\//);assert.equal(init.redirect,'manual');fetches++;return new Response(returnedPdf,{headers:{'Content-Type':'application/pdf','Content-Length':String(returnedPdf.length)}});};
  const {db,api,request,json}=await setup();
  try{
    const createBody={...draft,requestKey:randomUUID()};
    // The immutable upload key is event-scoped, so attach after obtaining the event UUID.
    const created=await json(await api.adminCalendarWrite(request('/api/admin/events',root,'POST',createBody),'create'));
    const id=created.event.id,fileObject=randomUUID()+'.pdf';
    const body={...draft,attachments:[{label:'Fixture workshop rules',url:`https://calendar-fixture.supabase.co/storage/v1/object/authenticated/academy-events/${id}/${fileObject}`}],expectedRevision:created.event.revision,requestKey:randomUUID()};
    const saved=await json(await api.adminCalendarWrite(request('/api/admin/events/'+id,root,'PATCH',body),'save',id));
    assert.equal((await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')))).events.length,0);
    await json(await api.portalCalendarEvent(request('/api/portal/events/'+id),id),404);
    assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications')).rows[0].n,0,'save-only creates no inbox row');

    const publish={expectedRevision:saved.event.revision,requestKey:randomUUID(),notifyStudents:false};
    const published=await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/publications',root,'POST',publish),'publish',id));
    assert.equal(fetches,1,'publication checks actual PDF bytes through the private Storage adapter');
    const staffFeed=await json(await api.adminCalendarList(request('/api/admin/events?from=2026-11-01&to=2026-12-01',root)));
    assert.equal(staffFeed.events.length,1);assert.equal(staffFeed.lookups.students.length,2);
    const firstFeed=await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')));
    assert.equal(firstFeed.subjectStudentId,subject);assert.equal(firstFeed.contractVersion,'calendar-v1');assert.equal(firstFeed.events.length,1);
    assert.deepEqual(firstFeed.events[0].occurrence,{allDay:true,startDate:'2026-11-10',endDate:'2026-11-13'});
    const detail=await json(await api.portalCalendarEvent(request('/api/portal/events/'+id),id));
    const attachment=detail.event.attachments[0];assert.equal(attachment.bytes,pdf.length);assert.equal(attachment.mimeType,'application/pdf');
    const publicJson=JSON.stringify(detail);for(const value of ['PRIVATE-PLANNING','academy-events','checksum','branchIds','fixture-server-only'])assert.ok(!publicJson.includes(value),'student detail contains only the public projection');
    const file=await api.portalCalendarFile(request('/api/portal/events/'+id+'/files/'+attachment.id),id,attachment.id);
    assert.equal(file.status,200);assert.equal(createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),pdfHash);assert.match(file.headers.get('cache-control'),/no-store/);
    assert.equal((await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01',bob)))).events.length,0);
    await json(await api.portalCalendarEvent(request('/api/portal/events/'+id,bob),id),404);
    const beforeForbiddenFile=fetches;await json(await api.portalCalendarFile(request('/api/portal/events/'+id+'/files/'+attachment.id,bob),id,attachment.id),404);assert.equal(fetches,beforeForbiddenFile,'denied file never contacts its provider');

    const notice={expectedRevision:published.event.revision,requestKey:randomUUID()};
    const [notified,concurrentRetry]=await Promise.all([0,1].map(async()=>json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/notices',root,'POST',notice),'notice',id))));assert.equal(notified.queued,1);assert.equal(concurrentRetry.queued,1,'concurrent identical requests recover the same durable intent');
    assert.equal((await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/notices',root,'POST',notice),'notice',id))).queued,1,'same request resolves original committed receipt');
    assert.equal((await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/notices',root,'POST',{...notice,requestKey:randomUUID()}),'notice',id))).queued,0,'new request does not duplicate recipient/revision');
    const inbox=await json(await api.portalCalendarInbox(request('/api/portal/notifications')));
    assert.equal(inbox.unreadCount,1);assert.equal(inbox.notifications.length,1);assert.equal(inbox.notifications[0].sourceId,id);assert.equal(inbox.notifications[0].deliveryState,'delivered');assert.ok(inbox.notifications[0].deliveredAt);assert.equal(inbox.notifications[0].readAt,null);
    const bobInbox=await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob)));assert.equal(bobInbox.unreadCount,0);assert.equal(bobInbox.notifications.length,0);
    assert.deepEqual({title:inbox.notifications[0].title,body:inbox.notifications[0].body},studentNoticePreview(draft),'the displayed preview matches the committed default public message');
    const noticeId=inbox.notifications[0].id;
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob,'PATCH',{notificationId:noticeId})),404);
    assert.equal((await json(await api.portalCalendarInbox(request('/api/portal/notifications')))).unreadCount,1);
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',alice,'PATCH',{notificationId:noticeId})));
    const firstRead=(await db.query('SELECT read_at FROM portal_notifications WHERE id=$1',[noticeId])).rows[0].read_at;
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',alice,'PATCH',{notificationId:noticeId})));
    assert.deepEqual((await db.query('SELECT read_at FROM portal_notifications WHERE id=$1',[noticeId])).rows[0].read_at,firstRead);
    assert.equal((await json(await api.portalCalendarInbox(request('/api/portal/notifications')))).unreadCount,0);

    await db.query("INSERT INTO portal_notification_preferences(user_id,muted_categories) VALUES($1,ARRAY['orders'])",[alice]);
    const prefs={pushEnabled:false,mutedCategories:['events'],quietStart:'21:35',quietEnd:'06:20'};
    const savedPrefs=await json(await api.portalCalendarPreferences(request('/api/portal/notifications/preferences',alice,'PATCH',prefs)));assert.equal(savedPrefs.quietStart,prefs.quietStart);
    assert.deepEqual((await db.query('SELECT muted_categories FROM portal_notification_preferences WHERE user_id=$1',[alice])).rows[0].muted_categories,['orders','events']);
    assert.equal((await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')))).events.length,1,'muting alerts does not hide the calendar');
    const allAudience={...draft,title:'Fixture general academy update',changeReason:'The fixture workshop venue has been updated.',audience:{mode:'all',branchIds:[],classIds:[],studentIds:[]},requestKey:randomUUID()};
    const general=await json(await api.adminCalendarWrite(request('/api/admin/events',root,'POST',allAudience),'create'));
    const generalPublished=await json(await api.adminCalendarWrite(request('/api/admin/events/'+general.event.id+'/publications',root,'POST',{expectedRevision:general.event.revision,requestKey:randomUUID(),notifyStudents:true}),'publish',general.event.id));
    assert.equal(generalPublished.queued,2,'publish-and-notify atomically fans out to both authorized accounts');
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',alice,'PATCH',{markAll:true})));
    assert.equal((await json(await api.portalCalendarInbox(request('/api/portal/notifications')))).unreadCount,0);
    const otherInbox=await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob)));assert.equal(otherInbox.unreadCount,1,'mark-all never touches the other account');
    assert.deepEqual({title:otherInbox.notifications[0].title,body:otherInbox.notifications[0].body},studentNoticePreview(allAudience),'the displayed public change reason matches the committed message');
    const otherNotice=otherInbox.notifications[0].id;
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob,'PATCH',{notificationId:otherNotice,dismiss:true})));
    const firstDismiss=(await db.query('SELECT dismissed_at FROM portal_notifications WHERE id=$1',[otherNotice])).rows[0].dismissed_at;
    await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob,'PATCH',{notificationId:otherNotice,dismiss:true})));
    assert.deepEqual((await db.query('SELECT dismissed_at FROM portal_notifications WHERE id=$1',[otherNotice])).rows[0].dismissed_at,firstDismiss,'an unknown-outcome dismiss retry retains its first timestamp');
    assert.equal((await json(await api.portalCalendarInbox(request('/api/portal/notifications',bob)))).notifications.length,0);
    await db.query("UPDATE students SET home_branch_id=2 WHERE id='STU-M-001'");
    await json(await api.portalCalendarEvent(request('/api/portal/events/'+id),id),404);
    const beforeAudienceLoss=fetches;await json(await api.portalCalendarFile(request('/api/portal/events/'+id+'/files/'+attachment.id),id,attachment.id),404);assert.equal(fetches,beforeAudienceLoss);
    assert.ok((await json(await api.portalCalendarInbox(request('/api/portal/notifications')))).notifications.every(item=>item.sourceId!==id),'source audience loss hides its retained snapshot');
    await db.query("UPDATE students SET home_branch_id=1 WHERE id='STU-M-001'");
    const update={...body,title:'PRIVATE-UNPUBLISHED-TITLE',expectedRevision:published.event.revision,requestKey:randomUUID()};
    const changed=await json(await api.adminCalendarWrite(request('/api/admin/events/'+id,root,'PATCH',update),'save',id));
    assert.equal((await json(await api.portalCalendarEvent(request('/api/portal/events/'+id),id))).event.title,draft.title);
    await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/publications',root,'POST',{...publish,requestKey:randomUUID()}),'publish',id),409);
    returnedPdf=Buffer.from('%PDF-1.7\nChanged provider bytes\n%%EOF');
    await json(await api.portalCalendarFile(request('/api/portal/events/'+id+'/files/'+attachment.id),id,attachment.id),409);
    assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications WHERE source_id=$1',[id])).rows[0].n,1);
    assert.ok(changed.event.hasUnpublishedChanges);
    const publicHistory=(await db.query('SELECT public_payload FROM academy_event_revisions WHERE event_id=$1',[id])).rows;
    const archiveBody={expectedRevision:changed.event.revision,reason:'Fixture event withdrawn after staff review',requestKey:randomUUID()};
    const archived=await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/archive',root,'POST',archiveBody),'archive',id));
    assert.ok(archived.event.archivedAt);assert.equal(archived.event.archiveReason,archiveBody.reason);assert.equal(archived.event.editable,false);
    const repeatedArchive=await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/archive',root,'POST',archiveBody),'archive',id));
    assert.equal(repeatedArchive.event.archivedAt,archived.event.archivedAt,'archive retry returns its committed receipt');
    await json(await api.adminCalendarWrite(request('/api/admin/events/'+id+'/archive',root,'POST',{...archiveBody,requestKey:randomUUID()}),'archive',id),409);
    const staffArchived=await json(await api.adminCalendarRead(request('/api/admin/events/'+id,root),id));assert.equal(staffArchived.event.editable,false);
    assert.ok((await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')))).events.every(item=>item.id!==id));
    await json(await api.portalCalendarEvent(request('/api/portal/events/'+id),id),404);
    const beforeArchiveDenied=fetches;await json(await api.portalCalendarFile(request('/api/portal/events/'+id+'/files/'+attachment.id),id,attachment.id),404);assert.equal(fetches,beforeArchiveDenied);
    assert.ok((await json(await api.portalCalendarInbox(request('/api/portal/notifications')))).notifications.every(item=>item.sourceId!==id));
    assert.deepEqual((await db.query('SELECT public_payload FROM academy_event_revisions WHERE event_id=$1',[id])).rows,publicHistory,'archive retains immutable publication evidence');
    assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='CALENDAR_ARCHIVE' AND target_id=$1",[id])).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM portal_notifications WHERE source_id=$1',[id])).rows[0].n,1,'withdrawal does not erase inbox evidence');
  }finally{await db.close();globalThis.fetch=priorFetch;if(priorUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=priorUrl;}
});

test('calendar handlers enforce real role overrides, identity/account state, canonical login setting and private errors',async t=>{
  const {db,client,api,request,json}=await setup();
  try{
    await json(await api.adminCalendarWrite(request('/api/admin/events',coach,'POST',{...draft,requestKey:randomUUID()}),'create'),403);
    await db.query("INSERT INTO user_permissions(user_id,permission_key,is_granted)VALUES($1,'action:events_create',false)",[admin]);
    await json(await api.adminCalendarWrite(request('/api/admin/events',admin,'POST',{...draft,requestKey:randomUUID()}),'create'),403);
    assert.equal((await db.query('SELECT count(*)::int n FROM academy_events')).rows[0].n,0);
    await json(await api.adminCalendarWrite(request('/api/admin/events',root,'POST',{title:'Bad incomplete payload'}),'create'),422);
    await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01',null)),401);
    const badToken=request('/api/portal/calendar?from=2026-11-01&to=2026-12-01',alice,'GET',undefined,{Authorization:'Bearer unknown-fixture-token'});
    await json(await api.portalCalendarList(badToken),401);
    await db.query('UPDATE profiles SET is_active=false WHERE id=$1',[alice]);
    await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')),403);
    await db.query('UPDATE profiles SET is_active=true,must_change_password=true WHERE id=$1',[alice]);
    await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')),403);
    await db.query('UPDATE profiles SET must_change_password=false WHERE id=$1',[alice]);
    await db.query("INSERT INTO academy_profile(id,academy_name,allow_student_portal_login) VALUES('another','Fixture unrelated settings',true)");
    await db.query("UPDATE academy_profile SET allow_student_portal_login=false WHERE id='default'");
    await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')),403);
    await db.query("UPDATE academy_profile SET allow_student_portal_login=true WHERE id='default'");
    await json(await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01')));
    const log=t.mock.method(console,'error',()=>{});
    client.failNext({code:'NETWORK_OFFLINE',message:'Fixture upstream unavailable'},'portal_calendar_student_events');
    const outage=await api.portalCalendarList(request('/api/portal/calendar?from=2026-11-01&to=2026-12-01'));
    assert.equal(outage.status,503);assert.match(outage.headers.get('cache-control')??'',/private.*no-store/);assert.equal(log.mock.callCount(),1);
  }finally{await db.close();}
});
