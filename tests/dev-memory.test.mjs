import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { developmentNodeOptions } from '../scripts/lib/dev-memory.mjs';
const GiB=1024**3;

test('development budget leaves room for native compiler allocations and respects explicit limits',()=>{
 assert.equal(developmentNodeOptions('',16*GiB).heapMiB,2048);
 assert.equal(developmentNodeOptions('',8*GiB).heapMiB,2048);
 assert.equal(developmentNodeOptions('',4*GiB).heapMiB,1024);
 for(const option of ['--max-old-space-size=3072','--max_old_space_size=3072','--max-old-space-size 3072']) {
  const result=developmentNodeOptions('--trace-warnings '+option,16*GiB);
  assert.equal(result.automatic,false);
  assert.equal(result.heapMiB,3072);
  assert.equal(result.nodeOptions,'--trace-warnings '+option);
 }
 const result=developmentNodeOptions('--trace-warnings',16*GiB);
 const child=spawnSync(process.execPath,['-e',"console.log(require('node:v8').getHeapStatistics().heap_size_limit/1024/1024)"],{env:{...process.env,NODE_OPTIONS:result.nodeOptions},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 const actual=Number(child.stdout);
 assert.ok(actual>=result.heapMiB&&actual<=result.heapMiB+128,'Node applies the selected budget');
});
