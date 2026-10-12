import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {navigationScrollState,updateNavigationScroll}=loadTs('lib/navigation.ts');

test('compact navigation hides on the first down scroll and reveals on a deliberate up scroll',()=>{
 let state=updateNavigationScroll(navigationScrollState(),200,1000,false);
 assert.equal(state.visible,false);
 state=updateNavigationScroll(state,199,1000,false);
 assert.equal(state.visible,false,'one-pixel jitter does not reveal the navigation');
 state=updateNavigationScroll(state,185,1000,false);
 assert.equal(state.visible,true);
 state=updateNavigationScroll(state,210,1000,false);
 assert.equal(state.visible,true,'short direction reversals do not flicker');
 state=updateNavigationScroll(state,225,1000,false);
 assert.equal(state.visible,false);
});

test('rubber-band overscroll does not create a false upward gesture; top and pinned navigation remain accessible',()=>{
 let state=updateNavigationScroll(navigationScrollState(),1000,1000,false);
 assert.equal(state.visible,false);
 state=updateNavigationScroll(state,1080,1000,false);
 state=updateNavigationScroll(state,1000,1000,false);
 assert.equal(state.visible,false);
 assert.equal(updateNavigationScroll(state,20,1000,false).visible,true);
 assert.equal(updateNavigationScroll(state,-30,1000,false).top,0);
 for(const top of [200,400,1000])assert.equal(updateNavigationScroll(state,top,1000,true).visible,true,'desktop, drawers, keyboard focus and reduced motion pin navigation');
});
