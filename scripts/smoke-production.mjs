import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://localhost:3100';
const request=async(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(15000)});
for(let attempt=0;attempt<20;attempt++){
 try{const ready=await request('/');await ready.arrayBuffer();if(ready.ok)break;}catch(error){if(attempt===19)throw error;}
 if(attempt===19)throw new Error('Production server did not become ready.');
 await new Promise(resolve=>setTimeout(resolve,500));
}
let checked=0;
for(const path of ['/','/profile','/dashboard','/students','/attendance','/schedule','/financials','/pos','/pro-shop','/lms','/library','/members','/partners','/settings','/offline']){
 const response=await request(path);assert.equal(response.status,200,path);
 const csp=response.headers.get('content-security-policy') || '';
 const scriptPolicy=csp.split(';').find(d=>d.trim().startsWith('script-src')) || '';
 assert.ok(scriptPolicy.includes("'strict-dynamic'"));assert.ok(!scriptPolicy.includes('unsafe-inline'));assert.ok(!scriptPolicy.includes('unsafe-eval'));
 const nonce=scriptPolicy.match(/'nonce-([^']+)'/)?.[1];assert.ok(nonce);
 const html=await response.text();assert.ok(html.includes(`nonce="${nonce}"`),path+' nonce');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');checked++;
}
for(const path of ['/api/admin/pos/orders','/api/admin/pos/products','/api/admin/households','/api/admin/export','/api/admin/permissions','/api/admin/classes','/api/admin/partners','/api/admin/staff-dan','/api/admin/user-permissions','/api/shop/order']){
 const response=await request(path);assert.equal(response.status,401,path+' must require authentication');checked++;
}
const writes={
 '/api/admin/achievements':['POST'],
 '/api/admin/create-user':['POST'],'/api/admin/create-student':['POST'],'/api/admin/delete-user':['POST'],'/api/admin/delete-student':['POST'],
 '/api/admin/update-user':['POST'],'/api/admin/update-student':['POST'],'/api/admin/update-academy-profile':['POST'],
 '/api/admin/households/payments':['POST'],'/api/admin/body-compositions':['POST'],'/api/admin/library-assets':['POST'],'/api/admin/library-assets/progress':['POST'],'/api/admin/households':['POST'],'/api/admin/payments':['POST'],'/api/admin/classes':['POST','PUT','DELETE','PATCH'],
 '/api/admin/partners':['POST','PUT','DELETE'],'/api/admin/staff-dan':['POST','PUT','DELETE'],
 '/api/admin/permissions':['POST'],'/api/admin/user-permissions':['POST'],'/api/admin/pos/products':['POST','PUT','DELETE'],
 '/api/admin/pos/orders':['POST','PUT'],'/api/admin/pos/orders/cancel':['POST'],'/api/admin/pos/orders/refund':['POST'],
 '/api/admin/promotions/reconcile':['POST'],'/api/shop/order':['POST']
};
for(const [path,methods] of Object.entries(writes))for(const method of methods){
 const response=await request(path,{method,headers:{Origin:'https://'+new URL(base).host,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,401,method+' '+path+' must require authentication');checked++;
}
const retired=await request('/api/auth/username-to-email',{method:'POST',headers:{Origin:'https://'+new URL(base).host,'Content-Type':'application/json'},body:'{}'});assert.equal(retired.status,410);checked++;
const invalidOrigin=await request('/api/admin/payments',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(invalidOrigin.status,403);checked++;
const invalidLogin=await request('/api/auth/login',{method:'POST',headers:{Origin:'https://'+new URL(base).host,'Content-Type':'application/json'},body:'{}'});assert.equal(invalidLogin.status,422);checked++;
const proxy=await request('/api/image-proxy?url='+encodeURIComponent('http://127.0.0.1/'));assert.equal(proxy.status,400);checked++;
const worker=await request('/sw.js');assert.equal(worker.status,200);assert.match(worker.headers.get('cache-control')||'',/no-store/);checked++;
console.log(`Production smoke checks passed: ${checked} routes and security cases. No database mutations submitted.`);
