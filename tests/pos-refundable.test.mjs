import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { isRefundableSale, isCollectedSale } = loadTs('lib/pos-reporting.ts');

test('refunds follow the database rule: paid orders, including paid orders cancelled later', () => {
  assert.equal(isRefundableSale({ paymentStatus: 'PAID', orderStatus: 'COMPLETED' }), true);
  assert.equal(isRefundableSale({ paymentStatus: 'PAID', orderStatus: 'CANCELLED' }), true, 'cancelled after payment still needs its refund recorded');
  assert.equal(isCollectedSale({ paymentStatus: 'PAID', orderStatus: 'CANCELLED' }), false, 'but it is not collected revenue');
  assert.equal(isRefundableSale({ paymentStatus: 'REFUND_PENDING' }), true);
  for (const paymentStatus of ['PENDING', 'REFUNDED', 'VOID']) assert.equal(isRefundableSale({ paymentStatus }), false, paymentStatus);
  assert.equal(isRefundableSale({}), true, 'legacy records without a status are checked by the server');
});
