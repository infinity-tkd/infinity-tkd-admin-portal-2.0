import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {rosterAttendance}=loadTs('lib/attendance.ts');
const {academyDate,addCalendarDays,isCalendarDate}=loadTs('lib/dates.ts');
test('class status filters keep conflicting same-day marks separate and combined roster is independent of row order',()=>{
 const date='2026-10-12';
 const rows=[{id:1,studentId:'A',date,classId:1,status:'Present'},{id:2,studentId:'A',date,classId:2,status:'Absent'},{id:3,studentId:'B',date,classId:2,status:'Late'}];
 assert.equal(rosterAttendance(rows,date,1).get('A').status,'Present');
 assert.equal(rosterAttendance(rows,date,2).get('A').status,'Absent');
 assert.equal(rosterAttendance(rows,date,1).has('B'),false);
 assert.deepEqual([...rosterAttendance(rows,date)].sort(),[...rosterAttendance([...rows].reverse(),date)].sort());
 assert.equal(rosterAttendance(rows,date).get('A').status,'Present');
 rows.push({id:4,studentId:'A',date,status:'Absent'});
 assert.equal(rosterAttendance(rows,date).get('A').status,'Absent','explicit daily mark wins in combined roster');
 assert.equal(rosterAttendance(rows,date,1).get('A').status,'Present');
 assert.equal(rosterAttendance(rows,'2026-10-13').size,0);
});
test('attendance quick dates follow the academy day and reject calendar rollovers',()=>{
 const today=academyDate(new Date('2026-10-11T18:00:00Z'));
 assert.equal(today,'2026-10-12');
 assert.equal(addCalendarDays(today,-1),'2026-10-11');
 assert.equal(addCalendarDays('2024-02-28',1),'2024-02-29');
 assert.equal(addCalendarDays('2026-12-31',1),'2027-01-01');
 assert.equal(isCalendarDate('2026-02-30'),false);
 assert.throws(()=>addCalendarDays('2026-02-30',1));
});
