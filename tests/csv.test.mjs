import {test} from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import {loadTs} from './load-ts.mjs';
const {toCsv}=loadTs('lib/csv.ts');
test('CSV round trips quotes, commas, Khmer and multiline values',()=>{
 const csv=toCsv(['Name','Notes'],[['ចាន់, Dara','He said "hello"\nSecond line']]);
 assert.deepEqual(Papa.parse(csv).data,[['Name','Notes'],['ចាន់, Dara','He said "hello"\nSecond line']]);
});
test('CSV prevents spreadsheet formula execution without changing numeric values',()=>{
 const values=Papa.parse(toCsv(['A','B','C'],[[' =SUM(1,2)','@HYPERLINK("x")',-5]])).data[1];
 assert.equal(values[0],"' =SUM(1,2)");assert.equal(values[1],"'@HYPERLINK(\"x\")");assert.equal(values[2],'-5');
});
