import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const {inventoryStockStatus} = loadTs('lib/pos-catalog.ts');
const product = {id:'stock-fixture',sku:'FIXTURE',name:'Uniform',category:'Uniform',price:25,stock:100,minStockThreshold:5,hasVariants:true};

test('variant health identifies depleted sizes even when aggregate inventory looks healthy',()=>{
 const variant=(sku,stock,min_stock_threshold=3,is_active=true)=>({sku,stock,min_stock_threshold,is_active});
 assert.equal(inventoryStockStatus({...product,variants:[variant('S',1),variant('L',99)]}),'LOW');
 assert.equal(inventoryStockStatus({...product,variants:[variant('S',0,0),variant('L',10)]}),'LOW','an empty active size needs review while other sizes remain available');
 assert.equal(inventoryStockStatus({...product,variants:[variant('S',10),variant('OLD',0,3,false)]}),'HEALTHY','archived sizes do not create replenishment alerts');
 assert.equal(inventoryStockStatus({...product,variants:[variant('S',0),variant('OLD',100,3,false)]}),'OUT','archived stock does not mask an empty active catalog');
 assert.equal(inventoryStockStatus({...product,variants:[variant('OLD',100,3,false)]}),'OUT');
 assert.equal(inventoryStockStatus({...product,variants:[]}),'OUT');
 assert.equal(inventoryStockStatus({...product,variants:[variant('S',1,0)]}),'HEALTHY','zero is an explicit threshold rather than the parent fallback');
 assert.equal(inventoryStockStatus({...product,variants:[{sku:'S',stock:4}]}),'LOW','omitted variant thresholds use the parent value');
});

test('simple health uses canonical product mode and leaves archive visibility to callers',()=>{
 const simple={...product,hasVariants:false,variants:[{sku:'HISTORICAL',stock:0,min_stock_threshold:10}]};
 assert.equal(inventoryStockStatus({...simple,stock:0,minStockThreshold:0}),'OUT');
 assert.equal(inventoryStockStatus({...simple,stock:1,minStockThreshold:0}),'HEALTHY');
 assert.equal(inventoryStockStatus({...simple,stock:5}),'LOW');
 assert.equal(inventoryStockStatus({...simple,stock:6}),'HEALTHY');
 assert.equal(inventoryStockStatus({...simple,stock:6,isActive:false}),'HEALTHY','archived products retain physical health for management; alert counts exclude them separately');
});
