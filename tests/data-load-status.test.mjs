import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const {dataLoadIssue, financialDataAffected, preserveUnavailableData} = loadTs('lib/data-load-status.ts');

test('missing transaction table names receipt data and requires database setup without exposing raw errors', () => {
  const issue = dataLoadIssue('payment_transactions', {code:'PGRST205',message:'private details'});
  assert.deepEqual(issue, {dataset:'payment_transactions',label:'Payment receipts and methods',code:'PGRST205',reason:'setup'});
  assert.equal(financialDataAffected([issue]), true);
  assert.equal(JSON.stringify(issue).includes('private details'), false);
});
test('library outages do not imply incomplete financial reports and permissions require different guidance', () => {
  assert.equal(financialDataAffected([dataLoadIssue('library_assets', new Error('Failed to fetch'))]), false);
  assert.equal(dataLoadIssue('students', {code:'42501'}).reason, 'permission');
  assert.equal(dataLoadIssue('profiles', {code:'PGRST301'}).reason, 'session');
  assert.equal(dataLoadIssue('members', {code:'PGRST200'}).reason, 'setup');
});
test('failed refresh retains complete records and receipts while accepting successful datasets', () => {
  const previous = {students:[{id:'student'}],payments:[{id:'payment',amountUsd:50,receiptNumber:'TKD-1',paymentMethod:'Cash'}],curriculumVideos:[],rolePermissions:{granted:true}};
  const incoming = {students:[],payments:[{id:'payment',amountUsd:60}],curriculumVideos:[{id:'new-video'}],rolePermissions:{}};
  const next = preserveUnavailableData(previous, incoming, [dataLoadIssue('students',{}),dataLoadIssue('payment_transactions',{}),dataLoadIssue('role_permissions',{})]);
  assert.equal(next.students, previous.students);
  assert.equal(next.payments[0].amountUsd, 60);
  assert.equal(next.payments[0].receiptNumber, 'TKD-1');
  assert.equal(next.payments[0].paymentMethod, 'Cash');
  assert.deepEqual(next.curriculumVideos, [{id:'new-video'}]);
  assert.deepEqual(next.rolePermissions, {});
  assert.deepEqual(preserveUnavailableData(previous, incoming, []).students, []);
  assert.equal(preserveUnavailableData(previous,incoming,[dataLoadIssue('payments',{})]).payments, previous.payments);
});
