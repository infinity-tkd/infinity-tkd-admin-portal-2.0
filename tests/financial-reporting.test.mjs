import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {tuitionCollectionStats}=loadTs('lib/financial-reporting.ts');
test('tuition collection totals and average exclude pending invoices while keeping the ledger count',()=>{
 assert.deepEqual(tuitionCollectionStats([{status:'Paid',amountUsd:25},{status:'Paid',amountUsd:45},{status:'Unpaid',amountUsd:100},{status:'Pending',amountUsd:200},{status:'Waived',amountUsd:0}]),{count:5,paidCount:2,totalCollected:70,avgVal:35,maxVal:45});
 assert.deepEqual(tuitionCollectionStats([{status:'Unpaid',amountUsd:100}]),{count:1,paidCount:0,totalCollected:0,avgVal:0,maxVal:0});
});
