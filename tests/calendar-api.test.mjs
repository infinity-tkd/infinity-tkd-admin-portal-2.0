import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadTs } from './load-ts.mjs';

const studentId='STU-M-001',userId='93000000-0000-4000-8000-000000000001';
const eventId='93000000-0000-4000-8000-000000000010';
const source={title:'Fixture event',type:'academy',lifecycle:'scheduled',startDate:'2026-11-10',endDate:'2026-11-12',startsAt:null,endsAt:null,timezone:'Asia/Phnom_Penh',location:'Fixture academy',description:'Public description',internalNotes:'PRIVATE-NOTE',audience:{mode:'students',studentIds:['OTHER-STUDENT-PRIVATE']},attachments:[{id:randomUUID(),label:'Rules',url:'https://example.test/PRIVATE-FILE-URL',mimeType:'application/pdf',bytes:100,checksum:'PRIVATE-HASH',studentAvailable:true}],changeReason:''};
const row={id:eventId,revision:2,payload:source,previous_occurrence:null,published_at:'2026-11-01T00:00:00.000Z'};
const response=(data)=>Response.json({success:true,data:{...data,contractVersion:'calendar-v1'},error:null});
const student=loadTs('lib/calendar-student-server.ts',{
  './backend-security':{verifyCaller:async()=>({context:{userId,role:'Student'},adminSupabase:{}})},
  './operations-server':{ownedStudentIds:async()=>[studentId]},
  './calendar-admin-server':{calendarResponse:response},
});
const cursor=loadTs('lib/calendar-cursor.ts');
const sibling=path.resolve('..','infinitytkd student portal 2.0','lib');
const siblingPresent=fs.existsSync(path.join(sibling,'calendar-contract.ts'));


test('student projection allowlists public fields and matches the actual sibling calendar-v1 event schema',()=>{
  const detail=student.studentEvent(row,true);
  assert.equal(detail.type,'activity');assert.equal(detail.occurrence.endDate,'2026-11-13');
  const encoded=JSON.stringify(detail);
  for(const secret of ['PRIVATE-NOTE','OTHER-STUDENT-PRIVATE','PRIVATE-FILE-URL','PRIVATE-HASH','studentIds'])assert.ok(!encoded.includes(secret));
  if(siblingPresent){const actual=loadTs(path.join(sibling,'calendar-contract.ts'),{'./portal-domain':{ACADEMY_TIME_ZONE:'Asia/Phnom_Penh',isDateOnly:loadTs('lib/dates.ts').isCalendarDate}});assert.equal(actual.eventDetailSchema.safeParse(detail).success,true);}
  const cancelled=student.studentEvent({...row,payload:{...source,lifecycle:'postponed',changeReason:''}});assert.equal(cancelled.status,'cancelled');assert.ok(cancelled.changeReason);
});

test('student period reads reject extra/duplicate filters and scope cursor to account, student and selected period',async()=>{
  const before=process.env.PORTAL_CURSOR_SECRET;process.env.PORTAL_CURSOR_SECRET='calendar-fixture-only-signing-key';
  try{
    let calls=0;
    const rows=Array.from({length:51},()=>({...row,id:randomUUID()})).sort((a,b)=>a.id.localeCompare(b.id));
    const client={rpc:async(name,args)=>{calls++;assert.equal(name,'portal_calendar_student_events');assert.equal(args.p_student,studentId);assert.equal(args.p_limit,51);return {data:rows,error:null};}};
    const result=await student.studentCalendarPage(new Request('https://academy.test/api/portal/calendar?from=2026-11-01&to=2026-12-01&limit=50'),client,userId,studentId);
    const data=(await result.json()).data;assert.equal(data.events.length,50);assert.ok(data.nextCursor);assert.equal(data.subjectStudentId,studentId);
    const scope=JSON.stringify(['student-events',userId,studentId,'2026-11-01','2026-12-01']);assert.equal(cursor.decodeCalendarCursor(data.nextCursor,scope).after,rows[49].id);
    assert.throws(()=>cursor.decodeCalendarCursor(data.nextCursor,JSON.stringify(['student-events','different-account',studentId,'2026-11-01','2026-12-01'])));
    assert.throws(()=>cursor.decodeCalendarCursor(data.nextCursor+'x',scope));
    for(const query of ['from=2026-11-01&to=2026-12-01&studentId=OTHER','from=2026-11-01&from=2026-11-02&to=2026-12-01','from=2026-11-01&to=2027-12-01','from=2026-11-01&to=2026-12-01&limit=100'])await assert.rejects(student.studentCalendarPage(new Request('https://academy.test/api/portal/calendar?'+query),client,userId,studentId));
    assert.equal(calls,1,'invalid filters never query another scope');
  }finally{if(before===undefined)delete process.env.PORTAL_CURSOR_SECRET;else process.env.PORTAL_CURSOR_SECRET=before;}
});

test('calendar-v1 response includes the metadata required by the real student gateway',async()=>{
  const admin=loadTs('lib/calendar-admin-server.ts',{
    './backend-security':{verifyCaller:async()=>({}),callerHasPermission:async()=>true,formatServerErrorResponse:()=>Response.json({}, {status:503})},
    './calendar-media':{verifyEventAttachments:async()=>[]},
  });
  const value=await admin.calendarResponse({subjectStudentId:studentId,events:[],nextCursor:null}).json();
  assert.equal(value.data.contractVersion,'calendar-v1');assert.equal(value.data.subjectStudentId,studentId);
});

test('actual sibling gateway accepts validated metadata with strict preferences and rejects wrong identity/version or extra fields',{skip:!fs.existsSync(path.join(sibling,'academy-portal-backend.ts'))||!fs.existsSync(path.join(sibling,'notification-contract.ts'))},async()=>{
  const filename=path.join(sibling,'academy-portal-backend.ts');
  const gateway=loadTs(filename,{'server-only':{}});
  const prefs=loadTs(path.join(sibling,'notification-contract.ts')).notificationPreferencesSchema;
  const origin=process.env.ACADEMY_PORTAL_API_ORIGIN,version=process.env.ACADEMY_PORTAL_CONTRACT_VERSION,enabled=process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED,fetchBefore=globalThis.fetch;
  process.env.ACADEMY_PORTAL_API_ORIGIN='https://academy.test';process.env.ACADEMY_PORTAL_CONTRACT_VERSION='calendar-v1';process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED='true';
  let payload={subjectStudentId:studentId,contractVersion:'calendar-v1',pushEnabled:false,mutedCategories:[],quietStart:'22:00',quietEnd:'07:00'};
  globalThis.fetch=async()=>Response.json({success:true,data:payload,error:null});
  const request=new Request('https://student.test/api/student/notifications/preferences',{headers:{Authorization:'Bearer fixture-token'}});
  try{
    const parsed=await gateway.academyData(request,'/api/portal/notifications/preferences',studentId,prefs);assert.equal(parsed.quietStart,'22:00');assert.ok(!Object.hasOwn(parsed,'contractVersion'));
    process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED='false';await assert.rejects(gateway.academyData(request,'/api/portal/notifications/preferences',studentId,prefs),error=>error.code==='ACADEMY_INTEGRATION_UNAVAILABLE');process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED='true';
    payload={...payload,subjectStudentId:'OTHER'};await assert.rejects(gateway.academyData(request,'/api/portal/notifications/preferences',studentId,prefs),error=>error.code==='ACADEMY_CONTRACT_INVALID');
    payload={...payload,subjectStudentId:studentId,contractVersion:'wrong'};await assert.rejects(gateway.academyData(request,'/api/portal/notifications/preferences',studentId,prefs),error=>error.code==='ACADEMY_CONTRACT_INVALID');
    payload={...payload,contractVersion:'calendar-v1',unexpectedStaffField:'Private content must not be accepted'};await assert.rejects(gateway.academyData(request,'/api/portal/notifications/preferences',studentId,prefs),error=>error.code==='ACADEMY_CONTRACT_INVALID');
  }finally{globalThis.fetch=fetchBefore;if(origin===undefined)delete process.env.ACADEMY_PORTAL_API_ORIGIN;else process.env.ACADEMY_PORTAL_API_ORIGIN=origin;if(version===undefined)delete process.env.ACADEMY_PORTAL_CONTRACT_VERSION;else process.env.ACADEMY_PORTAL_CONTRACT_VERSION=version;if(enabled===undefined)delete process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED;else process.env.ACADEMY_PORTAL_INTEGRATION_ENABLED=enabled;}
});

test('quiet-hour contract rejects half-configured or identical boundaries',()=>{
  const schema=loadTs('lib/calendar-contract.ts').portalPreferenceSchema;
  const base={pushEnabled:false,mutedCategories:[],quietStart:'21:30',quietEnd:'06:15'};
  assert.equal(schema.safeParse(base).success,true);assert.equal(schema.safeParse({...base,quietEnd:null}).success,false);
  assert.equal(schema.safeParse({...base,quietEnd:'21:30'}).success,false);
});

test('calendar student gateway refuses missing contract or bearer before any database access',async()=>{
  let calls=0;
  const gateway=loadTs('lib/calendar-student-server.ts',{
    './backend-security':{verifyCaller:async()=>{calls++;throw new Error('Authentication must not run for an invalid gateway envelope');}},
    './operations-server':{ownedStudentIds:async()=>{throw new Error('Unexpected database access');}},
    './calendar-admin-server':{calendarResponse:response},
  });
  for(const headers of [{},{Authorization:'Bearer fixture-token'},{'X-Portal-Contract':'calendar-v1'},{'X-Portal-Contract':'other',Authorization:'Bearer fixture-token'}])await assert.rejects(gateway.calendarStudent(new Request('https://academy.test/api/portal/calendar',{headers})),error=>error.code===(headers['X-Portal-Contract']==='calendar-v1'?'AUTH_UNAUTHORIZED':'42501'));
  assert.equal(calls,0);
});
