import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {resolveOwnedStudentIds}=loadTs('lib/student-ownership.ts');
const actor='student-account', student={id:'STU-M-1',profile_id:actor,deleted_at:null,student_status:'Active'};
function fixture({profile={id:actor,role:'Student',is_active:true,must_change_password:false,student_id:student.id},reverse=[student],forward=student,claimants=[{id:actor}],error=null}={}){
 return {from(table){let field;const query={select(){return query;},eq(key){field=key;return query;},limit(){return Promise.resolve({data:table==='profiles'?claimants:reverse,error});},maybeSingle(){return Promise.resolve({data:table==='profiles'?profile:forward,error});}};return query;}};
}
test('student ownership accepts one consistent forward/reverse link and training pauses retain access',async()=>{
 assert.deepEqual(await resolveOwnedStudentIds(fixture(),actor),[student.id]);
 for(const student_status of ['Paused','Inactive','Graduated'])assert.deepEqual(await resolveOwnedStudentIds(fixture({forward:{...student,student_status},reverse:[{...student,student_status}]}),actor),[student.id]);
 assert.deepEqual(await resolveOwnedStudentIds(fixture({profile:{id:actor,role:'Student',is_active:true,student_id:null},claimants:[]}),actor),[student.id]);
 assert.deepEqual(await resolveOwnedStudentIds(fixture({reverse:[],forward:{...student,profile_id:null}}),actor),[student.id]);
});
test('student ownership fails closed for contradictory, duplicate, reassigned, deleted or suspended records',async()=>{
 for(const options of [
  {reverse:[{...student,id:'STU-M-2'}]},
  {reverse:[student,{...student,id:'STU-M-2'}]},
  {forward:{...student,profile_id:'another-account'}},
  {forward:null},
  {forward:{...student,deleted_at:'2026-11-01'}},
  {forward:{...student,student_status:'Suspended'}},
  {claimants:[{id:actor},{id:'another-account'}]},
  {profile:{role:'Coach',is_active:true,student_id:student.id}},
  {profile:{role:'Student',is_active:false,student_id:student.id}},
  {profile:{role:'Student',is_active:true,must_change_password:true,student_id:student.id}},
 ])await assert.rejects(resolveOwnedStudentIds(fixture(options),actor),error=>error.code==='42501');
});
test('unlinked accounts return no scope and query failures never become an empty authorized result',async()=>{
 assert.deepEqual(await resolveOwnedStudentIds(fixture({profile:{role:'Student',is_active:true,student_id:null},reverse:[]}),actor),[]);
 const error={code:'NETWORK_OFFLINE'};await assert.rejects(resolveOwnedStudentIds(fixture({error}),actor),value=>value===error);
});
