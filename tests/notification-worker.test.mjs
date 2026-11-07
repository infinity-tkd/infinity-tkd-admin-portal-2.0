import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function worker({reject=false,windows=[]}={}){
 const listeners={},shown=[],opened=[];let config;
 const stub=class{};
 const self={__SW_MANIFEST:[],location:{origin:'https://academy.example'},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(title,data)=>{shown.push({title,...data});if(reject)throw new Error('Permission revoked');}},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}};
 const code=ts.transpileModule(fs.readFileSync('sw.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{self,exports:{},URL,Promise,Date,require:name=>name==='@serwist/next/worker'?{defaultCache:[]}:{Serwist:class{constructor(value){config=value;}addEventListeners(){}},CacheFirst:stub,NetworkOnly:stub,StaleWhileRevalidate:stub,ExpirationPlugin:stub}});
 return {listeners,shown,opened,get config(){return config;}};
}
test('PWA push is generic and catches malformed payloads and revoked permission',async()=>{
 for(const reject of [false,true]){const w=worker({reject});let pending;
 w.listeners.push({data:{json(){throw new Error('Malformed JSON');}},waitUntil(value){pending=value;}});await pending;
 assert.equal(w.shown[0].title,'Infinity TKD');assert.ok(!JSON.stringify(w.shown).includes('student'));
 assert.equal(w.shown[0].data.url,'/profile?notifications=open');}
});
test('PWA notification click ignores foreign URLs and navigates the existing academy window',async()=>{
 const navigated=[];let focused=0,closed=0,pending;
 const w=worker({windows:[{url:'https://foreign.example',navigate:()=>assert.fail('foreign window')},{url:'https://academy.example/attendance',navigate:async url=>navigated.push(url),focus:()=>focused++}]});
 w.listeners.notificationclick({notification:{data:{url:'https://evil.example'},close:()=>closed++},waitUntil(value){pending=value;}});await pending;
 assert.deepEqual(navigated,['https://academy.example/profile?notifications=open']);assert.equal(focused,1);assert.equal(closed,1);assert.equal(w.opened.length,0);
 const second=worker();second.listeners.notificationclick({notification:{close(){}},waitUntil(value){pending=value;}});await pending;assert.deepEqual(second.opened,['https://academy.example/profile?notifications=open']);
});
