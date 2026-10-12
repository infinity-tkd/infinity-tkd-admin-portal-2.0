import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// Optional module path supports the desktop's bundled Playwright runtime.
const {chromium}=await import(process.argv[3]?pathToFileURL(process.argv[3]).href:'playwright');
const base=process.argv[2] || 'http://127.0.0.1:3102';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];
 page.on('console',message=>{if(message.type()==='error'&&/hydrat|didn't match|server rendered HTML/i.test(message.text()))errors.push(message.text());});
 page.on('pageerror',error=>errors.push(error.message));
 for(const path of ['/','/dashboard','/students']){
  const response=await page.goto(base+path,{waitUntil:'networkidle',timeout:120000});
  assert.equal(response.status(),200,path);
  const csp=response.headers()['content-security-policy'];
  const nonce=csp.match(/'nonce-([^']+)'/)?.[1];assert.ok(nonce);
  const scripts=await page.locator('script[nonce]').evaluateAll(nodes=>nodes.map(script=>({nonce:script.nonce,attribute:script.getAttribute('nonce')})));
  assert.ok(scripts.length>=2);assert.ok(scripts.every(script=>script.nonce===nonce),path+' script nonce must match the response policy');
  assert.ok(scripts.every(script=>script.attribute===''),path+' nonce attribute hiding reproduced');
  assert.match(await page.locator('body').innerText(),/INFINITY|Taekwondo|sign in/i);
  assert.deepEqual(errors,[],path+' hydration and page errors');
 }
 await page.evaluate(()=>localStorage.setItem('infinity_theme','dark'));
 await page.reload({waitUntil:'networkidle'});
 assert.ok(await page.locator('html').evaluate(html=>html.classList.contains('dark')));
 assert.deepEqual(errors,[],'dark-theme reload hydration');
 console.log('Browser hydration checks passed: three pages and a dark-theme reload; browser-hidden nonces match the CSP. No authenticated actions performed.');
}finally{await browser.close();}
