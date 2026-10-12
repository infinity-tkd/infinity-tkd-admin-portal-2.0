import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {validateImportSize,runImportRows,importFailureCsv}=loadTs('lib/imports.ts');
test('imports are bounded by bytes and rows, including multibyte Khmer',()=>{
 assert.throws(()=>validateImportSize('ក'.repeat(800000)),/2 MB/);
 assert.throws(()=>validateImportSize('',501),/500 rows/);
 validateImportSize('Small import',500);
});
test('imports pace requests, recover thrown failures, and resume without replaying successful rows',async()=>{
 const rows=[1,2,3].map(index=>({index,data:{name:String(index)}}));const completed=new Set();const calls=[];const waits=[];
 let fail=true;
 const save=async row=>{calls.push(row.index);if(fail&&row.index===2)throw new Error('Temporary failure');return {success:true};};
 const result=await runImportRows(rows,completed,save,()=>{},async ms=>{waits.push(ms);});
 assert.deepEqual(calls,[1,2,3]);assert.equal(result.success,2);assert.equal(result.failed,1);assert.deepEqual(waits,[650,650]);
 fail=false;calls.length=0;
 const retry=await runImportRows(rows,completed,save,()=>{},async()=>{});
 assert.deepEqual(calls,[2]);assert.equal(retry.success,3);assert.equal(retry.failed,0);
 assert.ok(importFailureCsv([{row:2,message:'=UNTRUSTED()'}]).includes("'=UNTRUSTED()"));
});
