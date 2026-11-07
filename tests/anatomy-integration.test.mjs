import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { normalizeMuscleNameFor3D: normalize, resolveAssetMuscleLoads } = loadTs('lib/anatomyUtils.ts');
const { resolveStudentMuscleLoads, relatedMaterialsForMuscle, atlasMuscleSelection } = loadTs('lib/anatomy-integration.ts');
const muscles = [{id:1,name:'Rectus femoris'},{id:2,name:'Vastus lateralis'},{id:3,name:'Biceps femoris'}];
const assetMuscleRelations = [{assetId:1,muscleId:1,role:'Secondary'},{assetId:1,muscleId:2,role:'Primary'},{assetId:2,muscleId:3,role:'Primary'}];
const curriculumVideos = [{id:1,title:'Front kick',category:'Kicking Basics'},{id:2,title:'Back kick',category:'Kicking Basics'}];
test('individual structures map to training groups without misclassifying eye or calf muscles',()=>{
 assert.equal(normalize('Left rectus femoris'),'Quadriceps'); assert.equal(normalize('Right iliacus'),'Hip Flexors'); assert.equal(normalize('Left biceps femoris'),'Hamstrings'); assert.equal(normalize('Triceps surae'),'Calves'); assert.equal(normalize('Inferior oblique'),'Inferior oblique'); assert.equal(normalize('Rhomboid major'),'Rhomboid major');
 assert.equal(normalize('Quadratus lumborum'),'Quadratus lumborum');assert.equal(normalize('Quadratus femoris'),'Quadratus femoris');assert.equal(normalize('Adductor pollicis'),'Adductor pollicis');assert.equal(normalize('Subscapularis'),'Rotator Cuff Tendons');
});
test('saved primary mapping wins across structures in the same muscle group',()=>{
 const result=resolveAssetMuscleLoads(curriculumVideos[0],{muscles,assetMuscleRelations});
 assert.deepEqual(result.muscleLoads,{Quadriceps:1}); assert.deepEqual(result.primaryMuscles,['Quadriceps']); assert.deepEqual(result.secondaryMuscles,[]); assert.equal(result.source,'database');
});
test('unmapped theory does not fabricate a whole-body training heatmap',()=>{
 const result=resolveAssetMuscleLoads({id:3,title:'Back mobility theory',category:'Theory'});
 assert.deepEqual(result.muscleLoads,{}); assert.equal(result.source,'none');
});
test('student coverage includes only own completed materials and counts each group once per material',()=>{
 const data={muscles,assetMuscleRelations,videoProgress:[{studentId:'a',videoId:1,status:'Completed'},{studentId:'a',videoId:1,status:'Completed'},{studentId:'a',videoId:2,status:'Started'},{studentId:'b',videoId:2,status:'Completed'}]};
 assert.deepEqual(resolveStudentMuscleLoads('a',data),{muscleLoads:{Quadriceps:1},maxLoad:1,completedAssetIds:[1]});
 assert.deepEqual(resolveStudentMuscleLoads('c',data).muscleLoads,{});
});
test('related materials use saved relations and the selected student completion state',()=>{
 const result=relatedMaterialsForMuscle('Quadriceps',{muscles,assetMuscleRelations,curriculumVideos,videoProgress:[{studentId:'b',videoId:1,status:'Completed'}]},'a');
 assert.equal(result.length,1); assert.equal(result[0].role,'Primary'); assert.equal(result[0].completed,false);
});
test('atlas selection preserves saved exact elements and otherwise resolves canonical groups',()=>{
 const atlas={parts:[{id:'r',name:'Right rectus femoris',conceptId:'r1'},{id:'v',name:'Left vastus lateralis',conceptId:'v1'}]};
 assert.deepEqual(atlasMuscleSelection(atlas,'Quadriceps'),['r','v']);
 assert.deepEqual(atlasMuscleSelection(atlas,'Quadriceps',[{name:'Quadriceps',elementIds:['v']}]),['v']);
});

test('WebGL capability probes run once per request and release the temporary context',()=>{
 const {detectAnatomyWebGL}=loadTs('lib/anatomy-webgl.ts');let calls=0;let released=0;
 const supported=detectAnatomyWebGL(()=>({getContext(kind){calls++;assert.equal(kind,'webgl2');return {getExtension(){return {loseContext(){released++;}};}};}}));
 assert.equal(supported,true);assert.equal(calls,1);assert.equal(released,1);
 assert.equal(detectAnatomyWebGL(()=>({getContext(){return null;}})),false);
 assert.equal(detectAnatomyWebGL(()=>{throw new Error('Unavailable');}),false);
});

test('legacy authored focus zones stay distinct from inferred references and saved links override them',()=>{
 const asset={id:1,title:'Academy exercise',category:'Conditioning',description:JSON.stringify({focusZones:['Rectus femoris','Vastus lateralis']})};
 const legacy=resolveAssetMuscleLoads(asset);
 assert.equal(legacy.source,'focus-zones');assert.deepEqual(legacy.muscleLoads,{Quadriceps:1});assert.deepEqual(legacy.primaryMuscles,['Quadriceps']);
 const linked=resolveAssetMuscleLoads(asset,{muscles:[{id:9,name:'Hamstrings'}],assetMuscleRelations:[{assetId:1,muscleId:9,role:'Secondary'}]});
 assert.equal(linked.source,'database');assert.deepEqual(linked.muscleLoads,{Hamstrings:0.55});
});
