import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {billingDueDate,membershipBilling,billingBaseDate}=loadTs('lib/billing.ts');
const {makeupCandidates}=loadTs('lib/makeup.ts');
const {validPushEndpoint,safeNotificationPath,isQuietHour,defaultNoticePreferences}=loadTs('lib/notifications.ts');
const student={id:'A',registrationDate:'2026-01-05',membershipStartDate:'2026-01-31',scholarshipId:1,billingSchedule:[{id:'change',day:15,effectiveMonth:'2026-04-01',changedAt:'2026-03-01T00:00:00Z'}]};
test('billing changes apply by cycle, cap short months and preserve older arrears',()=>{
 assert.equal(billingDueDate(student,[],'2026-02'),'2026-02-28');assert.equal(billingDueDate(student,[],'2026-04'),'2026-04-15');
 assert.equal(billingBaseDate(student,[{studentId:'A',enrollmentDate:'2026-05-01'}]),'2026-01-31');
 assert.equal(billingBaseDate(student,[]),'2026-01-31');
 const due=membershipBilling(student,[{studentId:'A',year:2026,month:'Apr',status:'Paid'}],[],[],{},new Date('2026-04-20T02:00:00Z'));assert.equal(due.nextRenewalDate,'2026-01-31');
 const paid=['Jan','Feb','Mar'].map(month=>({studentId:'A',year:2026,month,status:'Paid'}));assert.equal(membershipBilling(student,paid,[],[],{},new Date('2026-04-14T02:00:00Z')).nextRenewalDate,'2026-04-15');
 const first={...student,billingSchedule:[{day:1,effectiveMonth:'2026-01-01',changedAt:'2026-01-01'}]};assert.equal(billingDueDate(first,[],'2026-01'),'2026-01-31','a changed due date cannot precede actual membership commencement');
});
const fixture={students:[{id:'A',englishName:'Athlete',studentStatus:'Active',registrationDate:'2026-01-01'}],classes:[{id:1,name:'Monday class',daysOfWeek:['Monday'],startTime:'08:00',endTime:'09:00'}],enrollments:[{studentId:'A',classId:1,enrollmentDate:'2026-01-01'}],attendance:[],makeups:[]};
test('unmarked and absent enrolled classes enter makeup review after class end, not future or non-class days',()=>{
 const now=new Date('2026-10-19T03:00:00Z');const rows=makeupCandidates(fixture,'2026-10-19','2026-10-20',now);assert.equal(rows.length,1);assert.equal(rows[0].sourceStatus,'Unmarked');
 assert.equal(makeupCandidates(fixture,'2026-10-19','2026-10-19',new Date('2026-10-19T02:10:00Z')).length,0,'thirty-minute marking grace period');
 assert.equal(makeupCandidates({...fixture,attendance:[{studentId:'A',classId:1,date:'2026-10-19',status:'Absent'}]},'2026-10-19','2026-10-19',now)[0].sourceStatus,'Absent');
 assert.equal(makeupCandidates({...fixture,attendance:[{studentId:'A',classId:1,date:'2026-10-19',status:'Present'}]},'2026-10-19','2026-10-19',now).length,0);
 assert.equal(makeupCandidates({...fixture,makeups:[{student_id:'A',source_class_id:1,source_date:'2026-10-19'}]},'2026-10-19','2026-10-19',now).length,0);
 assert.equal(makeupCandidates({...fixture,students:[{...fixture.students[0],studentStatus:'Paused'}]},'2026-10-19','2026-10-19',now).length,0);
 assert.throws(()=>makeupCandidates(fixture,'2026-01-01','2026-10-19',now),/93 days/);
});
test('makeup handling isolates classes, honors registration and overnight sessions',()=>{
 const now=new Date('2026-10-20T02:00:00Z');
 assert.equal(makeupCandidates({...fixture,attendance:[{studentId:'A',classId:2,date:'2026-10-19',status:'Present'}]},'2026-10-19','2026-10-19',now).length,1);
 assert.equal(makeupCandidates({...fixture,enrollments:[{studentId:'A',classId:1,enrollmentDate:'2026-10-20'}]},'2026-10-19','2026-10-19',now).length,0);
 const overnight={...fixture,classes:[{...fixture.classes[0],startTime:'23:00',endTime:'01:00'}]};assert.equal(makeupCandidates(overnight,'2026-10-19','2026-10-19',new Date('2026-10-19T17:30:00Z')).length,0);assert.equal(makeupCandidates(overnight,'2026-10-19','2026-10-19',new Date('2026-10-19T19:00:00Z')).length,1);
});
test('push endpoints and notification navigation reject arbitrary destinations',()=>{
 for(const url of ['https://fcm.googleapis.com/fcm/send/example','https://updates.push.services.mozilla.com/wpush/v2/example','https://web.push.apple.com/example','https://wns2.notify.windows.com/w/example'])assert.equal(validPushEndpoint(url),true);
 for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','https://[::1]/x'])assert.equal(validPushEndpoint(url),false);
 assert.equal(safeNotificationPath('/financials?student=STU-M-001'),'/financials?student=STU-M-001');for(const path of ['https://evil.test','//evil.test','/api/admin/delete-user','/\\evil.test'])assert.equal(safeNotificationPath(path),'/dashboard');
});
test('academy quiet hours cross midnight and can be disabled',()=>{
 assert.equal(isQuietHour(defaultNoticePreferences,new Date('2026-10-23T16:00:00Z')),true);assert.equal(isQuietHour(defaultNoticePreferences,new Date('2026-10-24T02:00:00Z')),false);assert.equal(isQuietHour({...defaultNoticePreferences,quiet_start:0,quiet_end:0},new Date('2026-10-23T16:00:00Z')),false);
});
