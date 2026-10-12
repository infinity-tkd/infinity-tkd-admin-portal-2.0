import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {isCollectedSale} = loadTs('lib/pos-reporting.ts');
test('POS revenue excludes unpaid, voided, refunded and cancelled records', () => {
 const orders = [
  {paymentStatus:'PAID',orderStatus:'COMPLETED',total:25},
  {paymentStatus:'PENDING',orderStatus:'COMPLETED',total:50},
  {paymentStatus:'REFUNDED',orderStatus:'CANCELLED',total:75},
  {paymentStatus:'REFUND_PENDING',orderStatus:'CANCELLED',total:100},
  {paymentStatus:'VOID',orderStatus:'CANCELLED',total:125},
  {paymentStatus:'PAID',orderStatus:'CANCELLED',total:150},
  {total:200},
 ];
 assert.equal(orders.filter(isCollectedSale).reduce((sum, order) => sum + order.total, 0), 25);
 assert.equal(orders.length,7,'audit history remains intact');
});
