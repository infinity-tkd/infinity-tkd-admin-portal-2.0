import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {fetchAllRows}=loadTs('lib/data-access.ts');
test('invalid pagination sizes cannot hang a snapshot load', async () => {
 for (const size of [0, -1, 1.5, 1001]) await assert.rejects(fetchAllRows({}, size), /Page size/);
});
test('pagination uses stable composite household keys and includes every page',async()=>{
 const keys=[],ranges=[];
 const query={url:new URL('https://fixture.supabase.co/rest/v1/household_students'),
  order(key){keys.push(key);return this;},
  async range(start,end){ranges.push([start,end]);return {data:start===0?[{student_id:'A'},{student_id:'B'}]:[{student_id:'C'}],error:null};}
 };
 const result=await fetchAllRows(query,2);
 assert.deepEqual(keys,['household_id','student_id']);
 assert.deepEqual(ranges,[[0,1],[2,3]]);
 assert.equal(result.data.length,3);
 assert.equal(result.error,null);
});
test('a later-page failure cannot be presented as a complete partial ledger',async()=>{
 const query={url:new URL('https://fixture.supabase.co/rest/v1/payments'),order(){return this;},
  async range(start){return start===0?{data:[{id:1},{id:2}],error:null}:{data:null,error:{message:'Connection lost'}};}
 };
 const result=await fetchAllRows(query,2);
 assert.equal(result.data,null);
 assert.equal(result.error.message,'Connection lost');
});
