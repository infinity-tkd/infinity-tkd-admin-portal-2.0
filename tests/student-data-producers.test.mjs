import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTs} from './load-ts.mjs';
import {operationsDatabase,root} from './fixtures/operations-db.mjs';
const {libraryStudentProjection}=loadTs('lib/library-student-projection.ts');
const {validateWorkoutTemplate,workoutStructureSeconds}=loadTs('lib/workout-structure.ts');
const {physicalGradeScore}=loadTs('lib/physical-grades.ts');
const {trainingAssignmentDataSchema}=loadTs('lib/student-training-contract.ts');

test('training responses reject malformed data before a student detail panel can render it',()=>{
 const valid={studentId:'STU-M-001',plans:[],templates:[],canManage:true,hasMorePlans:false,hasMoreTemplates:false};
 assert.equal(trainingAssignmentDataSchema.safeParse(valid).success,true);
 for(const changed of [{plans:null},{plans:[{id:'invalid'}]},{templates:[{title:{unexpected:'object'}}]}])assert.equal(trainingAssignmentDataSchema.safeParse({...valid,...changed}).success,false);
});

test('unrated and binary legacy assessments do not become invented numeric grading progress',()=>{
 for(const value of ['Unrated','Satisfactory','Unsatisfactory','',null,undefined])assert.equal(physicalGradeScore(value),null);
 for(const [value,expected] of [['Needs Work',1],['F',1],['Developing',2],['C',2],['Proficient',3],['B',3],['Outstanding',4],['A',4]])assert.equal(physicalGradeScore(value),expected);
});

test('public lesson projection includes authored text/media and excludes private or unsupported metadata',()=>{
 const result=libraryStudentProjection({description:JSON.stringify({text:'Approved lesson overview',thumbnailUrl:'https://images.example.test/cover.png',staffNotes:'Private coordination',instructions:['Unmapped rich content']}),video_url:'https://video.example.test/watch'});
 assert.deepEqual(result,{description:'Approved lesson overview',video_url:'https://video.example.test/watch',thumbnail_url:'https://images.example.test/cover.png'});
 assert.ok(!JSON.stringify(result).includes('Private'));
 for(const asset of [{description:'{bad',video_url:''},{description:'{}',video_url:'javascript:alert(1)'},{description:'{"thumbnailUrl":"http://example.test/photo.png"}',video_url:''}])assert.throws(()=>libraryStudentProjection(asset));
});

test('routines use the student reader limits, keep real exercises and calculate full sequences without trailing rest',()=>{
 const structure={routineType:'Taekwondo Workout',prepareSeconds:10,workSeconds:30,restSeconds:15,rounds:3,exercises:['Front kick','Side kick']};
 const input={title:'Academy routine',description:'A real selected sequence.',creator:'Coach',difficulty:'Intermediate',duration:99,structure};
 const saved=validateWorkoutTemplate(input);assert.equal(workoutStructureSeconds(saved.structure),265);assert.equal(saved.duration,5);
 for(const change of [{exercises:[]},{rounds:21},{prepareSeconds:301},{restSeconds:1801},{workSeconds:0},{exercises:['']},{rounds:20,workSeconds:3600,exercises:['A','B']}])assert.throws(()=>validateWorkoutTemplate({...input,structure:{...structure,...change}}));
});

test('library transaction mirrors future public content, keeps inactive lessons inactive and protects personal/readiness history',async()=>{
 const db=await operationsDatabase();
 try{
  await db.exec(fs.readFileSync('supabase/migrations/20261101033142_library_student_projection.sql','utf8'));
  const base={title:'Fixture lesson',description:JSON.stringify({text:'Public overview',staffNotes:'Never project this'}),library_type:'Taekwondo',tkd_category:'Poomsae',fitness_category:null,target_level:'White',video_url:'https://video.example.test/lesson',muscleRelations:[]};
  const payload={...base,studentProjection:libraryStudentProjection(base)};
  const call=(action,id,data,key)=>db.query('SELECT portal_save_library_asset($1,$2,$3,$4::jsonb,$5) AS result',[root,action,id,JSON.stringify(data),key]);
  const key='94000000-0000-4000-8000-000000000001';
  const result=(await call('CREATE',null,payload,key)).rows[0].result;
  const id=result.asset.id;assert.equal(result.studentLesson.id,id);assert.equal(result.studentLesson.description,'Public overview');assert.equal(result.studentLesson.video_url,base.video_url);
  assert.ok(!JSON.stringify(result.studentLesson).includes('Never project'));
  assert.equal((await call('CREATE',null,payload,key)).rows[0].result.asset.id,id,'request replay retains identity');
  await db.query("UPDATE curriculum SET is_active=false,category='Kicking Basics' WHERE id=$1",[id]);
  const changed={...base,description:'Updated public overview',studentProjection:{description:'Updated public overview',video_url:null,thumbnail_url:null}};
  const update=(await call('UPDATE',id,changed,null)).rows[0].result;assert.equal(update.studentLesson.is_active,false);assert.equal(update.studentLesson.category,'Kicking Basics');assert.equal(update.studentLesson.description,'Updated public overview');
  await assert.rejects(call('UPDATE',id,{...changed,studentProjection:{}},null),error=>error.code==='22023');
  await db.exec('CREATE TABLE public.student_portal_progress(student_id text,curriculum_id integer); CREATE TABLE public.student_portal_readiness_policies(requirements jsonb);');
  await db.query('INSERT INTO student_portal_progress VALUES($1,$2)',['STU-M-001',id]);
  await assert.rejects(call('DELETE',id,{},null),/student practice history/);
  await db.exec('DELETE FROM student_portal_progress');
  await db.query('INSERT INTO student_portal_readiness_policies VALUES($1::jsonb)',[JSON.stringify({lessons:[{curriculumId:id}]})]);
  await assert.rejects(call('DELETE',id,{},null),/readiness policy/);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(call('UPDATE',id,changed,null),/permission denied/);
 }finally{await db.close();}
});
