import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Installability and offline audit against a production build (`next build` + `next start`).
// Only the local server is contacted; every other host is blocked, so no real data is read.
// Usage: node scripts/check-pwa-browser.mjs <baseUrl>
const base=(process.argv[2]||'http://127.0.0.1:3000').replace(/\/$/,'');
const origin=new URL(base).origin;

const pngSize=async path=>{
 const response=await fetch(base+path);assert.equal(response.status,200,path+' is served');
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(bytes.subarray(1,4).toString('latin1'),'PNG',path+' is a PNG');
 return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

const manifestResponse=await fetch(base+'/manifest.webmanifest');
assert.equal(manifestResponse.status,200);
const manifest=await manifestResponse.json();
assert.ok(manifest.start_url&&manifest.scope&&manifest.name&&manifest.short_name,'manifest names, scope and start URL');
assert.ok(!manifest.display_override?.includes('window-controls-overlay'),'the layout has no title-bar overlay support, so the overlay mode stays off');
for(const icon of manifest.icons.filter(icon=>icon.type==='image/png'))assert.equal(await pngSize(icon.src),icon.sizes,icon.src+' matches its declared size');
assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'),'a maskable icon is provided');
for(const shot of manifest.screenshots??[]){
 const actual=await pngSize(shot.src);assert.equal(actual,shot.sizes,shot.src+' matches its declared size');
 const [width,height]=actual.split('x').map(Number);
 assert.ok(shot.form_factor==='wide'?width>height:height>width,shot.src+' orientation matches '+shot.form_factor);
}

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/',{waitUntil:'load'});
 const worker=await page.evaluate(async()=>{
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker did not activate within 60s.')),60000))]);
  // `ready` resolves while the worker is still activating; wait for activation to finish.
  for(let attempt=0;attempt<120&&registration.active?.state!=='activated';attempt++)await new Promise(resolve=>setTimeout(resolve,500));
  const offline=await caches.match('/offline.html',{ignoreSearch:true});
  return {scope:registration.scope,active:registration.active?.state,offlineCached:Boolean(offline),offlineText:offline?(await offline.text()).includes("You're offline"):false};
 });
 assert.equal(worker.scope,origin+'/');assert.equal(worker.active,'activated');
 assert.ok(worker.offlineCached&&worker.offlineText,'the offline page is precached at install');
 await page.reload({waitUntil:'load'});
 assert.ok(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),'the worker controls the page after a reload');
 await context.setOffline(true);
 const response=await page.goto(base+'/students?offline-check=1',{waitUntil:'load'});
 assert.equal(response?.status(),200,'offline navigation is answered by the worker');
 await page.getByRole('heading',{name:"You're offline"}).waitFor({timeout:10000});
 assert.equal(new URL(page.url()).pathname,'/students','the requested address is kept so Try again reopens it');
 assert.ok(await page.getByRole('link',{name:'Try again'}).isVisible());
 await context.setOffline(false);
 assert.deepEqual(errors,[],'no page errors');
 console.log(JSON.stringify({passed:true,icons:manifest.icons.length,screenshots:manifest.screenshots?.length??0,offlineFallback:true}));
}finally{await browser.close();}
