import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {activeClassEnrollmentCounts}=loadTs('lib/attendance-roster.ts');

test('class enrollment displays count unique active students consistently without changing the roster or capacity',()=>{
 const students=[{id:'ACTIVE',studentStatus:'Active'},{id:'INACTIVE',studentStatus:'Inactive'},{id:'PAUSED',studentStatus:'Paused'},{id:'SUSPENDED',studentStatus:'Suspended'}];
 const enrollments=[{studentId:'ACTIVE',classId:35},{studentId:'ACTIVE',classId:35},{studentId:'INACTIVE',classId:35},{studentId:'PAUSED',classId:35},{studentId:'SUSPENDED',classId:35},{studentId:'UNKNOWN',classId:35},{studentId:'ACTIVE',classId:36}];
 const before=JSON.stringify({students,enrollments});
 assert.deepEqual([...activeClassEnrollmentCounts(students,enrollments)],[[35,1],[36,1]]);
 assert.equal(JSON.stringify({students,enrollments}),before);
});
