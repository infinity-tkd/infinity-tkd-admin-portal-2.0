import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {academyDate,isCalendarDate,calendarDate}=loadTs('lib/dates.ts');
const {membershipBilling,tuitionAmount,householdTuitionEntries}=loadTs('lib/billing.ts');
test('academy dates cross midnight, validate real dates, and cap month ends',()=>{
 assert.equal(academyDate(new Date('2026-10-08T18:00:00Z')),'2026-10-09');
 assert.equal(isCalendarDate('2026-02-30'),false);assert.equal(isCalendarDate('2024-02-29'),true);
 assert.equal(calendarDate(2026,1,31),'2026-02-28');
 assert.equal(calendarDate(2026,-1,1),'2025-12-01');
});
test('billing anniversary handles enrollment on the first and last day',()=>{
 const student={id:'A',registrationDate:'2026-01-01',scholarshipId:1};
 const status=membershipBilling(student,[],[],[],{},new Date('2026-02-01T02:00:00Z'));
 assert.equal(status.nextRenewalDate,'2026-01-01');assert.equal(status.status,'Overdue');assert.equal(status.daysRemaining,-31);
 const end=membershipBilling({...student,registrationDate:'2026-01-31'},[{studentId:'A',year:2026,month:'Jan',status:'Paid'}],[],[],{},new Date('2026-02-27T02:00:00Z'));
 assert.equal(end.nextRenewalDate,'2026-02-28');assert.equal(end.daysRemaining,1);assert.equal(end.status,'Due Soon');
});
test('tuition discounts and configured fees agree, and absent enrollment is visible',()=>{
 assert.equal(tuitionAmount({id:1,typeName:'Early Group Student',discountPercentage:50},{earlyGroupTuitionUsd:30}),30);
 assert.equal(tuitionAmount({id:1,typeName:'Scholarship',discountPercentage:50},{standardTuitionUsd:60}),30);
 const s={id:'A',registrationDate:'',scholarshipId:1};
 assert.equal(membershipBilling(s,[],[],[]).status,'Overdue');
 assert.equal(membershipBilling({...s,registrationDate:'2026-01-01'},[],[{id:1,typeName:'Scholarship',discountPercentage:100}],[],{},new Date('2026-10-09T00:00:00Z')).amountOwed,0);
});
test('later paid months do not hide historical arrears',()=>{
 const result=membershipBilling({id:'A',registrationDate:'2026-08-15',scholarshipId:1},[{studentId:'A',year:2026,month:'Sep',status:'Paid'}],[],[],{},new Date('2026-10-09T00:00:00Z'));
 assert.equal(result.status,'Overdue');assert.equal(result.nextRenewalDate,'2026-08-15');assert.equal(result.amountOwed,45);
});

test('family collection excludes inactive and fully funded students and retains arrears',()=>{
 const students=['A','B','C','D'].map(id=>({id,englishName:id,registrationDate:'2026-08-01',scholarshipId:id==='D'?2:1,studentStatus:id==='B'?'Inactive':'Active'}));
 const payments=[{studentId:'A',year:2026,month:'Sep',status:'Paid'},{studentId:'C',year:2026,month:'Aug',status:'Paid'},{studentId:'C',year:2026,month:'Sep',status:'Paid'},{studentId:'C',year:2026,month:'Oct',status:'Paid'}];
 const entries=householdTuitionEntries(students,payments,[{id:1,typeName:'Standard',discountPercentage:0},{id:2,typeName:'Scholarship',discountPercentage:100}],[],{},new Date('2026-10-10T02:00:00Z'));
 assert.deepEqual(entries,[{studentId:'A',name:'A',year:2026,month:'Aug',amount:45}]);
});
