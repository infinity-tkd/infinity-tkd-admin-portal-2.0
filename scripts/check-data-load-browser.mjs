import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
const id = '70000000-0000-4000-8000-000000000099';
const user = {id,aud:'authenticated',role:'authenticated',email:'records@example.test',app_metadata:{provider:'email'},user_metadata:{}};
const profile = {id,username:'records_test',email:user.email,display_name:'Records Test Admin',role:'Root',is_active:true,must_change_password:false};
const token = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`;
let failedDataset = 'payment_transactions';
let profileOutage = false;
let stallLibrary = false;
let transactionRequests = 0;
let logouts = 0;
const errors = [];
const telemetry = [];
try {
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/telemetry/log') { telemetry.push(route.request().postDataJSON()); return json({success:true}); }
      if (url.pathname === '/api/auth/login') return json({success:true,data:{access_token:token,refresh_token:'fictional-refresh'}});
      if (url.pathname.startsWith('/api/admin/')) return json({success:true,data:[]});
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({user,access_token:token,refresh_token:'fictional-refresh',expires_in:3600,token_type:'bearer'});
    if (url.pathname === '/auth/v1/logout') { ++logouts; return route.fulfill({status:204}); }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') {
        if (profileOutage && url.searchParams.has('id')) return json({code:'08006',message:'Fictional transient profile outage'},503);
        return json(url.searchParams.has('id') ? profile : [profile]);
      }
      if (table === 'payment_transactions') ++transactionRequests;
      if (table === 'library_assets' && stallLibrary) return;
      if (table === failedDataset) return json({code:'PGRST205',message:'Fictional schema setup failure'},404);
      if (table === 'academy_profile') return json({id:'default',academy_name:'Infinity Taekwondo',updated_at:'2026-10-11T01:00:00Z'});
      return json([]);
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle',timeout:120000});
  await page.locator('#login-identifier').fill('records_test');
  await page.locator('#login-password').fill('Fictional-Test-Password');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard',{timeout:30000});
  const notice = page.getByRole('alert').filter({hasText:'Some records are unavailable'});
  await notice.getByText('Affected: Payment receipts and methods.',{exact:true}).waitFor();
  await notice.getByText(/Database setup or schema cache is incomplete/).waitFor();
  await notice.getByText(/Financial reports may be incomplete/).waitFor();
  await notice.getByText('Technical details',{exact:true}).click();
  await notice.getByText('payment_transactions',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Settings',exact:true}).first().click();
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:/academy/i}).click();
  const draft = page.getByLabel('Academy name',{exact:false});
  await draft.fill('Retained during retry');
  const retry = notice.getByRole('button',{name:'Retry loading records',exact:true});
  const initialRequests = transactionRequests;
  await retry.click();
  await page.waitForLoadState('networkidle');
  await retry.waitFor();
  assert.equal(transactionRequests,initialRequests+1,'one reload per retry');
  assert.equal(await draft.inputValue(),'Retained during retry','failed retry retains form draft');
  failedDataset = '';
  await retry.click();
  await notice.waitFor({state:'hidden'});
  assert.equal(await draft.inputValue(),'Retained during retry','successful retry retains form draft');
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  failedDataset = 'library_assets';
  await page.reload({waitUntil:'networkidle'});
  await notice.getByText('Affected: Library.',{exact:true}).waitFor();
  assert.equal(await notice.getByText(/Financial reports/).count(),0,'library failure does not imply financial corruption');
  profileOutage = true;
  await retry.click();
  await page.waitForLoadState('networkidle');
  await notice.getByText(/Affected: Staff accounts, Library/).waitFor();
  assert.equal(logouts,0,'transient profile failure must not sign out a verified user');
  assert.equal(new URL(page.url()).pathname,'/settings');
  profileOutage = false;
  failedDataset = 'partners';
  await retry.click();
  await notice.waitFor({state:'hidden'});
  assert.equal(logouts,0,'successful empty partner fallback clears its stale error');
  failedDataset = 'payment_transactions';
  await page.reload({waitUntil:'networkidle'});
  await notice.waitFor();
  await page.setViewportSize({width:375,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile warning fits without horizontal overflow');
  assert.ok((await retry.boundingBox()).height>=44,'retry has an accessible touch target');
  failedDataset = '';
  stallLibrary = true;
  await retry.click();
  await notice.getByText('Affected: Library.',{exact:true}).waitFor({timeout:25000});
  await notice.getByText(/The request failed/).waitFor();
  await retry.waitFor();
  assert.equal(await retry.isEnabled(),true,'an aborted request releases the retry control');
  stallLibrary = false;
  await retry.click();
  await notice.waitFor({state:'hidden'});
  // A reconnect safely reloads failed reads without resubmitting any mutation.
  failedDataset = 'students';
  await page.reload({waitUntil:'networkidle'});
  await notice.getByText('Affected: Students.',{exact:true}).waitFor();
  failedDataset = '';
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await notice.waitFor({state:'hidden',timeout:20000});
  await page.evaluate(() => {
    for(let i=0;i<2;i++) void Promise.reject(new Error('Synthetic verification exception'));
  });
  await page.getByRole('alertdialog').waitFor();
  await page.waitForTimeout(250);
  assert.equal(telemetry.length,1,'duplicate background errors report once');
  assert.equal(telemetry[0].component,'Unhandled Background Exception');
  assert.ok(!JSON.stringify(telemetry[0]).includes('Synthetic verification exception'),'private exception message is excluded');
  assert.deepEqual(errors,[]);
  console.log('Data-load browser checks passed: schema/permission notices, safe retries and retained drafts, profile outage, timeout recovery, online reconciliation and deduplicated runtime telemetry. All provider requests mocked; no live writes.');
} finally { await browser.close(); }
