import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:3100';
await mkdir('scratch', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const id = '50000000-0000-4000-8000-000000000099';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'motion@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
const profile = { id, username: 'motion_admin', email: user.email, display_name: 'Motion Admin', role: 'Root', is_active: true, must_change_password: false };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.${Buffer.from('fictional-signature').toString('base64url')}`;
const errors = []; const performance = [];
async function session(reducedMotion, touch = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: touch ? {width:390,height:844} : { width: 1440, height: 1000 }, reducedMotion, hasTouch:touch, isMobile:touch });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/auth/login') return json({ success: true, data: { access_token: token, refresh_token: 'fictional-refresh' } });
      if (url.pathname.startsWith('/api/admin/')) return json({ success: true, data: [] });
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'fictional-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Infinity Taekwondo', updated_at: '2026-10-11T01:00:00Z' });
      return json([]);
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|didn't match|unhandled/i.test(message.text())) errors.push(message.text()); });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('#login-identifier').fill('motion_admin').catch(async error => {
    await page.screenshot({path:'scratch/motion-login-failure.png'});
    console.error('Mocked motion login diagnostic:', {url:page.url(), errors, text:(await page.locator('body').innerText()).slice(0,900)});
    throw error;
  });
  await page.locator('#login-password').fill('Fictional-Test-Password');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard');
  await page.getByText('Motion Admin', { exact: true }).first().waitFor({state:touch ? 'attached' : 'visible'});
  await page.waitForLoadState('networkidle');
  return { context, page };
}

try {
  const { context, page } = await session('no-preference');
  // Visit all admin views using client navigation, including existing dynamic bundles.
  const links = await page.getByRole('navigation', { name: 'Portal navigation' }).locator('a').evaluateAll(items => items.map(item => item.getAttribute('href')));
  for (const href of links) {
    await page.getByRole('navigation', { name: 'Portal navigation' }).locator(`a[href="${href}"]`).click();
    await page.waitForURL('**' + href);
    await page.locator('[data-page-surface]').first().waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('alertdialog').count(), 0, href + ' loads without a runtime modal');
  }
  await page.getByRole('navigation', { name: 'Portal navigation' }).locator('a[href="/settings"]').click();
  const nav = page.getByRole('navigation', { name: 'Settings sections' });
  await nav.getByRole('button', { name: /academy/i }).click();
  const name = page.getByLabel('Academy name', { exact: false });
  await name.fill('Retained motion draft');
  await name.evaluate(element => { element.dataset.motionProbe = 'same-dom-node'; });
  await nav.getByRole('button', { name: /preferences/i }).click();
  await nav.getByRole('button', { name: /academy/i }).click();
  assert.equal(await name.inputValue(), 'Retained motion draft');
  assert.equal(await name.getAttribute('data-motion-probe'), 'same-dom-node', 'tab fades do not remount forms');
  for (const width of [1280,1440]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(async()=>{
      const scroller=document.querySelector('[data-portal-scroll]');
      scroller.scrollTop=200;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator('[data-portal-header]').getAttribute('data-visible'),'true','desktop navigation remains visible at '+width);
    assert.equal(await page.locator('[data-portal-bottom-nav]').evaluate(element=>getComputedStyle(element).display),'none','desktop uses the sidebar at '+width);
  }
  for (const width of [1440, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at ' + width);
    await page.screenshot({ path: `scratch/motion-settings-${width}.png` });
  }
  const sidebar = page.getByRole('complementary', { name: 'Main navigation', includeHidden: true });
  await page.waitForFunction(() => document.querySelector('aside')?.inert === true);
  const opener = page.getByRole('button', { name: 'Open Navigation Menu', exact: true });
  await opener.click();
  await sidebar.getByRole('button', { name: 'Close Navigation Menu' }).waitFor();
  assert.equal(await sidebar.evaluate(element => element.contains(document.activeElement)), true);
  await sidebar.getByRole('button', { name: /sign out/i }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await sidebar.getByRole('button', { name: 'Close Navigation Menu' }).evaluate(element => element === document.activeElement), true, 'drawer traps forward Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await sidebar.getByRole('button', { name: /sign out/i }).evaluate(element => element === document.activeElement), true, 'drawer traps reverse Tab');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('aside')?.inert === true);
  assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'closing restores trigger focus');
  await name.focus();
  // Real nested content scrolling updates the hairline without changing width.
  const metrics = await page.evaluate(async () => {
    const field = document.querySelector('#setting-academyName');
    let scroller = field.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 300 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (!scroller) throw new Error('Settings scroll container not found');
    const longTasks = []; const shifts = [];
    const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) { if (entry.entryType === 'longtask') longTasks.push(entry.duration); if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) shifts.push(entry.value); } });
    observer.observe({ entryTypes: ['longtask', 'layout-shift'] });
    window.__motionScroller = scroller;
    for (let i = 1; i <= 20; i++) { scroller.scrollTop = i * 30; await new Promise(requestAnimationFrame); }
    observer.disconnect();
    return { longTasks, layoutShift: shifts.reduce((sum, value) => sum + value, 0), progressTransform: document.querySelector('[data-scroll-progress]').style.transform, progressWidth: document.querySelector('[data-scroll-progress]').style.width };
  });
  performance.push({ scope: 'headless mobile settings scroll', ...metrics });
  assert.equal(metrics.progressWidth, '', 'progress does not animate layout width');
  assert.notEqual(metrics.progressTransform, 'scaleX(0)', 'nested scroll is observed');
  const backToTop = page.getByRole('button', { name: 'Scroll to top of page' });
  await backToTop.click();
  await page.waitForFunction(() => window.__motionScroller.scrollTop < 1);
  assert.equal(await name.inputValue(), 'Retained motion draft');
  await page.getByLabel('Settings section', {exact:true}).selectOption('members');
  await page.getByRole('button', {name:'Edit',exact:true}).first().click();
  const editor = page.getByRole('dialog', {name:'Account editor',exact:true});
  await editor.waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.keyboard.press('Escape');
  await editor.waitFor({state:'hidden'});
  await page.getByRole('button', {name:'Edit',exact:true}).first().click();
  await editor.waitFor();
  await page.waitForFunction(() => { const dialog=document.querySelector('[role="dialog"][aria-label="Account editor"]'); return dialog && getComputedStyle(dialog).opacity==='1' && getComputedStyle(dialog).transform==='none'; });
  await page.keyboard.press('Escape');
  await editor.waitFor({state:'hidden'});
  assert.deepEqual(errors, []);
  await context.close();

  // Real compact-shell gestures include wide touch tablets, not just phones.
  const touch = await session('no-preference', true);
  const compactPage = touch.page;
  await compactPage.goto(base + '/settings', {waitUntil:'networkidle'});
  await compactPage.getByLabel('Settings section', {exact:true}).selectOption('profile');
  await compactPage.getByLabel('Academy name', {exact:false}).fill('Mobile spacing draft');
  for (const width of [320,375,768,1024,1366]) {
    await compactPage.setViewportSize({width,height:900});
    await compactPage.evaluate(async () => {
      document.activeElement?.blur();
      const field=document.querySelector('#setting-academyName');
      let scroller=field.parentElement;
      while(scroller && !(scroller.scrollHeight-scroller.clientHeight>250 && /auto|scroll/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
      if(!scroller)throw new Error('Compact content scroller not found');
      window.__motionScroller=scroller;scroller.scrollTop=0;
      // Let the scroll observer consume the reset before the next gesture.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    await compactPage.waitForFunction(() => document.querySelector('[data-portal-header]').dataset.visible==='true');
    await compactPage.waitForFunction(() => getComputedStyle(document.querySelector('[data-portal-bottom-nav]')).display!=='none');
    assert.equal(await compactPage.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,'compact overflow at '+width);
    const targets=await compactPage.locator('[data-portal-bottom-nav]').locator('a,button').evaluateAll(items=>items.map(item=>({width:item.getBoundingClientRect().width,height:item.getBoundingClientRect().height})));
    assert.ok(targets.every(item=>item.width>=44 && item.height>=44),'navigation touch targets at '+width);
    await compactPage.evaluate(()=>{window.__motionScroller.scrollTop=200;});
    await compactPage.waitForFunction(() => document.querySelector('[data-portal-header]').dataset.visible==='false');
    await compactPage.waitForFunction(() => document.querySelector('[data-portal-bottom-nav]').getBoundingClientRect().top>=innerHeight-1);
    assert.equal(await compactPage.locator('[data-portal-bottom-nav]').evaluate(element=>element.inert),true,'hidden controls are inert');
    await compactPage.evaluate(()=>{window.__motionScroller.scrollTop=186;});
    await compactPage.waitForFunction(() => document.querySelector('[data-portal-header]').dataset.visible==='true');
    await compactPage.waitForFunction(() => document.querySelector('[data-portal-header]').getBoundingClientRect().top>=-1 && document.querySelector('[data-portal-bottom-nav]').getBoundingClientRect().bottom<=innerHeight+1);
    await compactPage.getByRole('button',{name:'Open More Navigation Menu',exact:true}).tap();
    const compactSidebar=compactPage.getByRole('complementary',{name:'Main navigation'});
    await compactSidebar.getByRole('button',{name:'Close Navigation Menu'}).waitFor();
    await compactPage.evaluate(()=>{window.__motionScroller.scrollTop=260;});
    assert.equal(await compactPage.locator('[data-portal-header]').getAttribute('data-visible'),'true','open menu pins navigation');
    await compactSidebar.getByRole('button',{name:'Close Navigation Menu'}).tap();
    await compactPage.waitForFunction(()=>document.querySelector('aside').inert===true);
    await compactPage.evaluate(()=>{window.__motionScroller.scrollTop=360;});
    await compactPage.waitForFunction(()=>document.querySelector('[data-portal-header]').dataset.visible==='false');
    await compactPage.keyboard.press('Tab');
    await compactPage.waitForFunction(()=>document.querySelector('[data-portal-header]').dataset.visible==='true');
    await compactPage.evaluate(async()=>{
      document.activeElement?.blur();
      const scroller=window.__motionScroller;
      scroller.scrollTop=scroller.scrollHeight-scroller.clientHeight;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      scroller.scrollTop-=14;
    });
    await compactPage.waitForFunction(()=>document.querySelector('[data-portal-bottom-nav]').dataset.visible==='true');
    await compactPage.waitForFunction(()=>document.querySelector('[data-portal-bottom-nav]').getBoundingClientRect().bottom<=innerHeight+1);
    const clearance=await compactPage.getByRole('button',{name:'Save changes',exact:true}).evaluate(button=>{
      const bounds=button.getBoundingClientRect();const nav=document.querySelector('[data-portal-bottom-nav]').getBoundingClientRect();
      const hit=document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
      return {gap:nav.top-bounds.bottom,hit:button===hit||button.contains(hit),hitTag:hit?.tagName,hitClass:hit?.className,buttonDisabled:button.disabled,padding:parseFloat(getComputedStyle(document.querySelector('[data-portal-scroll]')).paddingBottom),navHeight:nav.height};
    });
    if(clearance.gap<8 || !clearance.hit)await compactPage.screenshot({path:`scratch/navigation-clearance-failure-${width}.png`});
    assert.ok(clearance.gap>=8 && clearance.hit,'Save control clears bottom navigation at '+width+': '+JSON.stringify(clearance));
    assert.ok(clearance.padding>=clearance.navHeight+24,'measured bottom clearance at '+width);
    await compactPage.screenshot({path:`scratch/navigation-touch-${width}.png`});
  }
  const originalNavHeight=await compactPage.locator('[data-portal-bottom-nav]').evaluate(element=>Math.ceil(element.getBoundingClientRect().height));
  await compactPage.evaluate(()=>{
    document.documentElement.style.setProperty('--portal-safe-top','24px');
    document.documentElement.style.setProperty('--portal-safe-bottom','34px');
  });
  await compactPage.waitForFunction(originalHeight=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--portal-footer-height'))>=originalHeight+34,originalNavHeight);
  assert.ok(await compactPage.locator('[data-portal-scroll]').evaluate((element,originalHeight)=>parseFloat(getComputedStyle(element).paddingBottom)>=originalHeight+34+24,originalNavHeight),'safe area is included in measured clearance');
  await compactPage.evaluate(()=>{
    document.documentElement.style.removeProperty('--portal-safe-top');
    document.documentElement.style.removeProperty('--portal-safe-bottom');
  });
  await compactPage.setViewportSize({width:320,height:900});
  await compactPage.evaluate(()=>window.dispatchEvent(new Event('offline')));
  const offlineNotice=compactPage.getByRole('status').filter({hasText:'Connection offline'});
  await offlineNotice.waitFor();
  assert.ok(await offlineNotice.evaluate(element=>{
    const bounds=element.getBoundingClientRect();
    const nav=document.querySelector('[data-portal-bottom-nav]').getBoundingClientRect();
    return bounds.left>=0 && bounds.right<=innerWidth && bounds.bottom<=nav.top-8 && getComputedStyle(element).pointerEvents==='none';
  }),'connectivity notice fits the phone and does not block controls');
  await compactPage.evaluate(()=>window.dispatchEvent(new Event('online')));
  await compactPage.locator('div[role="status"]').filter({hasText:'Connection restored'}).waitFor();
  assert.equal(await compactPage.getByRole('status').filter({hasText:'Connection restored'}).count(),1,'portal connection notices are not duplicated');
  assert.equal(await compactPage.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'connection notices do not increase the page height');
  assert.deepEqual(errors,[]);
  await touch.context.close();

  // Reduced-motion startup and hydration have a separate, fresh session.
  const reduced = await session('reduce', true);
  await reduced.page.setViewportSize({ width:390, height:844 });
  await reduced.page.goto(base + '/settings', { waitUntil:'networkidle' });
  await reduced.page.getByLabel('Settings section', {exact:true}).selectOption('members');
  await reduced.page.getByRole('button', {name:'Edit',exact:true}).first().click();
  const reducedEditor=reduced.page.getByRole('dialog', {name:'Account editor',exact:true});
  await reducedEditor.waitFor();
  const settings = await reducedEditor.evaluate(element => ({ duration:getComputedStyle(element).transitionDuration, transform:getComputedStyle(element).transform }));
  assert.equal(settings.duration,'0s');
  assert.equal(settings.transform,'none');
  await reduced.page.keyboard.press('Escape');
  await reducedEditor.waitFor({state:'hidden'});
  await reduced.page.getByLabel('Settings section', {exact:true}).selectOption('profile');
  await reduced.page.getByLabel('Academy name', {exact:false}).focus();
  await reduced.page.evaluate(() => { const element=document.querySelector('[data-portal-scroll]'); element.scrollTop=400; element.dispatchEvent(new Event('scroll')); });
  assert.ok(await reduced.page.locator('header[data-portal-navigation]').evaluate(element => element.getBoundingClientRect().top >= 0), 'reduced motion keeps navigation visible');
  assert.equal(await reduced.page.evaluate(() => document.getAnimations().filter(animation=>animation.playState==='running').length),0,'reduced motion has no ongoing UI animations');
  assert.deepEqual(errors, []);
  await reduced.context.close();
  console.log('Motion browser checks passed: all admin routes, retained form nodes/drafts, 320–1440px layouts including 1366px touch tablets, hide-down/reveal-up, touch focus, drawer/keyboard/inert behavior, safe-area and Save-button clearance, nested scrolling, return-to-top and reduced motion. Provider traffic mocked; no live writes.');
  console.log(JSON.stringify({ measuredPerformance:performance, note:'Headless browser observations; no device FPS guarantee or before/after benchmark.' },null,2));
} finally { await browser.close(); }
