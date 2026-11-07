import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

// All identities, products, orders and writes below are fictional intercepted
// responses. The real database and the owner's browser session are never used.
const base = process.argv[2] || 'http://127.0.0.1:3100';
const actor = '9c000000-0000-4000-8000-000000000001';
const productId = '9c000000-0000-4000-8000-000000000002';
const variantProductId = '9c000000-0000-4000-8000-000000000003';
const archivedId = '9c000000-0000-4000-8000-000000000004';
const orderId = '9c000000-0000-4000-8000-000000000005';
const readyOrderId = '9c000000-0000-4000-8000-000000000006';
const timestamp = '2026-11-03T01:00:00.000Z';
const initialProducts = [
  { id: productId, sku: 'UNIFORM-BASE', name: 'Fixture counter uniform', category_name: 'Uniforms', price_usd: 25, cost_usd: 12, stock: 6, min_stock_threshold: 2, sizes: ['160'], has_variants: false, variants: [], is_active: true, allow_student_orders: false, description: 'Fixture counter description', updated_at: timestamp },
  { id: variantProductId, sku: 'UNIFORM-VARIANT', name: 'Fixture variant uniform', category_name: 'Uniforms', price_usd: 30, cost_usd: 14, stock: 10, min_stock_threshold: 2, sizes: ['150', '160', '170'], has_variants: true, variants: [{ id: '9c000000-0000-4000-8000-000000000010', sku: 'UNIFORM-VAR-150', size: '150', color: 'White', price_override: null, stock: 2, is_active: true }, { id: '9c000000-0000-4000-8000-000000000011', sku: 'UNIFORM-VAR-160', size: '160', color: 'Black', price_override: 35, stock: 5, is_active: true }, { id: '9c000000-0000-4000-8000-000000000013', sku: 'UNIFORM-VAR-170', size: '170', color: 'Grey', price_override: null, stock: 3, is_active: null }], is_active: true, allow_student_orders: true, description: 'Fixture variant description', updated_at: timestamp },
  { id: '9c000000-0000-4000-8000-000000000012', sku: 'UNSET-GEAR', name: 'Fixture unset availability', category_name: 'Sparring Gear', price_usd: 10, stock: 2, min_stock_threshold: 1, sizes: [], variants: [], is_active: null, allow_student_orders: null, updated_at: timestamp },
  { id: '9c000000-0000-4000-8000-000000000015', sku: 'UNCONFIGURED-VARIANTS', name: 'Fixture variants need setup', category_name: 'Uniforms', price_usd: 20, stock: 35, min_stock_threshold: 2, sizes: [], variants: [], has_variants: true, is_active: true, allow_student_orders: true, updated_at: timestamp },
  { id: archivedId, sku: 'ARCHIVED-GEAR', name: 'Fixture archived gear', category_name: 'Sparring Gear', price_usd: 20, stock: 4, min_stock_threshold: 1, sizes: [], variants: [], is_active: false, allow_student_orders: false, updated_at: timestamp },
];
const initialOrders = [
  { id: orderId, order_number: 'FIXTURE-ORDER-001', order_channel: 'STUDENT_PORTAL', customer_name: 'Fixture athlete', customer_phone: '+85512000000', subtotal_usd: 25, discount_usd: 0, total_usd: 25, payment_method: 'Cash', payment_status: 'PENDING', order_status: 'PENDING_CONFIRMATION', created_at: timestamp, updated_at: timestamp, items: [{ id: 'fixture-item-1', product_name: 'Fixture counter uniform', sku: 'UNIFORM-BASE', size: '160', color: 'White', quantity: 1, unit_price_usd: 25, total_price_usd: 25 }] },
  { id: readyOrderId, order_number: 'FIXTURE-ORDER-002', order_channel: 'STUDENT_PORTAL', customer_name: 'Fixture unpaid pickup', subtotal_usd: 35, discount_usd: 0, total_usd: 35, payment_method: 'Pay at Counter', payment_status: 'PENDING', order_status: 'READY_FOR_PICKUP', created_at: timestamp, updated_at: timestamp, items: [] },
];
initialOrders[0].created_at = '2020-01-01T00:00:00.000Z';
initialOrders.push({ id: '9c000000-0000-4000-8000-000000000014', order_number: 'FIXTURE-LEGACY-PAID', order_channel: 'ADMIN_POS', customer_name: 'Fixture legacy collection', subtotal_usd: 7.5, discount_usd: 0, total_usd: 7.5, payment_method: 'Cash', payment_status: 'PAID', order_status: 'COMPLETED', created_at: '2020-01-02T00:00:00.000Z', updated_at: timestamp, payment_recorded_at: null, items: [] });
const errors = [], results = [], writes = [];
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
let observedPage;

async function fixture(readOnly = false) {
  const products = structuredClone(initialProducts), orders = structuredClone(initialOrders);
  const profile = { id: actor, username: 'shop_fixture', email: 'shop@example.test', display_name: 'Fixture shop manager', role: readOnly ? 'Admin' : 'Root', is_active: true, must_change_password: false };
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(session => localStorage.setItem('sb-lyjxmkyvqazqxkzoeszr-auth-token', JSON.stringify(session)), { access_token: token, refresh_token: 'fictional-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
  await context.routeWebSocket('**/_next/webpack-hmr*', socket => socket.close());
  let failAdjustment = true, paymentRelease, signalPayment;
  const paymentStarted = new Promise(resolve => { signalPayment = resolve; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === new URL(base).origin) {
      if (url.pathname === '/api/admin/pos/products') {
        if (request.method() === 'GET') return json({ success: true, data: products });
        assert.equal(readOnly, false, 'read-only roles cannot submit catalog writes');
        const body = request.postDataJSON(); writes.push({ kind: 'product', body });
        if (body.action === 'ADJUST_STOCK') {
          if (failAdjustment) { failAdjustment = false; return json({ success: false, error: { message: 'Fixture unconfirmed adjustment; retry the same request.' } }, 503); }
          return json({ success: true, data: { new_balance: 8 } });
        }
        if (body.action === 'CREATE_PRODUCT') products.push({ id: '9c000000-0000-4000-8000-000000000099', sku: body.sku, name: body.name, category_name: body.categoryName, price_usd: body.priceUsd, cost_usd: body.costUsd, stock: body.stock, min_stock_threshold: body.minStockThreshold, sizes: body.sizes, variants: [], has_variants: false, is_active: body.isActive, allow_student_orders: body.allowStudentOrders, description: body.description, image_url: body.imageUrl, updated_at: timestamp });
        if (body.action === 'UPDATE_PRODUCT') Object.assign(products.find(product => product.id === body.productId), { name: body.name, price_usd: body.priceUsd, description: body.description, is_active: body.isActive, allow_student_orders: body.allowStudentOrders });
        return json({ success: true, data: { id: body.productId || products.at(-1).id } });
      }
      if (url.pathname === '/api/admin/pos/orders') {
        if (request.method() === 'GET') return json({ success: true, data: url.searchParams.has('channel') ? orders.filter(order => order.order_channel === url.searchParams.get('channel')) : orders });
        assert.equal(readOnly, false, 'read-only roles cannot submit order writes');
        const body = request.postDataJSON(); writes.push({ kind: 'order', body });
        if (body.paymentStatus === 'PAID') { signalPayment(); await new Promise(resolve => { paymentRelease = resolve; }); }
        const order = orders.find(row => row.id === body.orderId);
        assert.equal(body.expectedUpdatedAt, order.updated_at, 'every fulfillment/payment write carries the displayed revision');
        order.order_status = body.newOrderStatus;
        if (body.paymentStatus) {
          order.payment_status = body.paymentStatus;
          if (body.paymentStatus === 'PAID') order.payment_recorded_at = new Date().toISOString();
        }
        order.updated_at = new Date(Date.parse(order.updated_at) + 1000).toISOString();
        return json({ success: true, data: order });
      }
      if (url.pathname === '/api/admin/pos/orders/cancel') {
        assert.equal(readOnly, false);
        const body = request.postDataJSON(); writes.push({ kind: 'cancel', body });
        const order = orders.find(row => row.id === body.orderId); order.order_status = 'CANCELLED'; order.cancellation_reason = body.reason;
        return json({ success: true, data: order });
      }
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/api/telemetry/') && url.pathname !== '/api/performance') throw Error('Unexpected business mutation: ' + url.pathname);
        if (url.pathname === '/api/notifications') return json({ success: true, data: { notices: [], preferences: { push_enabled: false, muted_categories: [], quiet_start: 22, quiet_end: 7 }, push: { ready: false, publicKey: '' } } });
        return json({ success: true, data: [] });
      }
      return route.continue();
    }
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/token') return json({ user, access_token: token, refresh_token: 'fictional-refresh', expires_in: 3600, token_type: 'bearer' });
    if (url.pathname.startsWith('/rest/v1/')) {
      assert.ok(['GET', 'HEAD'].includes(request.method()), 'no direct table mutation');
      const table = url.pathname.split('/').pop();
      if (table === 'profiles') return json(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'members' && url.searchParams.has('id')) return json(null);
      if (table === 'academy_profile') return json({ id: 'default', academy_name: 'Fixture academy', enable_audio_chimes: false });
      if (table === 'user_permissions' && readOnly) return json(['action:pos_create_order', 'action:pos_manage_inventory', 'action:pos_cancel_order'].map(permission_key => ({ user_id: actor, permission_key, is_granted: false })));
      return json([]);
    }
    return route.abort();
  });
  const page = await context.newPage(); observedPage = page;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|Invalid hook|Maximum update depth/i.test(message.text())) errors.push(message.text()); });
  await page.goto(base + '/pos', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { name: 'Pro-Shop', exact: true }).waitFor({ timeout: 60000 });
  return { context, page, orders, releasePayment: () => paymentRelease(), paymentStarted };
}
const fits = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow');
const dismiss = async page => { const notice = page.getByRole('alertdialog'); await notice.waitFor({ state: 'visible', timeout: 15000 }); await notice.getByRole('button', { name: 'Dismiss Notification', exact: true }).click(); await notice.waitFor({ state: 'hidden' }); };
const tab = (page, name) => page.getByRole('button', { name: new RegExp('^' + name) }).first();

try {
  const { context, page, orders, paymentStarted, releasePayment } = await fixture();
  await page.getByText('Fixture counter uniform', { exact: true }).filter({ visible: true }).waitFor();
  assert.equal(await page.getByText('Fixture unset availability', { exact: true }).filter({ visible: true }).count(), 0, 'NULL product availability never becomes sellable');
  assert.equal(await page.getByText('Fixture archived gear', { exact: true }).filter({ visible: true }).count(), 0);
  await page.getByRole('button', { name: 'Low Stock', exact: true }).click();
  await page.getByText('Fixture variant uniform', { exact: true }).filter({ visible: true }).waitFor();
  assert.equal(await page.getByText('Fixture counter uniform', { exact: true }).filter({ visible: true }).count(), 0, 'counter low-stock filtering honors individual active variants');
  await page.getByRole('button', { name: 'Low Stock', exact: true }).click();
  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await tab(page, 'INVENTORY').click();
    await page.getByText('Excludes stock needing variant setup.', { exact: true }).waitFor();
    if (width === 390) {
      for (const group of [page.getByRole('group', { name: 'Shop workspace', exact: true }), page.getByRole('group', { name: 'Inventory stock health', exact: true })]) {
        assert.ok(await group.evaluate(element => element.scrollWidth <= element.clientWidth), 'mobile workspace and stock controls fit without a clipped scroll strip');
        assert.ok(await group.locator('button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth)), 'every mobile control label fits its button');
      }
    }
    await page.getByLabel('Inventory availability').selectOption('INACTIVE');
    await page.getByText('Fixture archived gear', { exact: true }).filter({ visible: true }).waitFor();
    await fits(page);
    await page.getByLabel('Inventory availability').selectOption('ALL');
    const health = page.getByRole('group', { name: 'Inventory stock health', exact: true });
    await health.getByRole('button', { name: /^LOW/ }).click();
    await page.getByText('Fixture variant uniform', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await page.getByText('Fixture counter uniform', { exact: true }).filter({ visible: true }).count(), 0, 'one low active variant surfaces its parent even when aggregate stock is healthy');
    await health.getByRole('button', { name: /^ALL/ }).click();
    await page.getByLabel('Search inventory').fill('UNIFORM-VAR-160');
    await page.getByText('Fixture variant uniform', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await page.getByText('Fixture archived gear', { exact: true }).filter({ visible: true }).count(), 0);
    await page.getByRole('button', { name: 'Clear inventory search' }).click();
    if (width === 390) await page.screenshot({ path: 'scratch/shop-management-inventory-mobile.png', fullPage: false });
    results.push({ view: 'inventory', width, passed: true });
  }
  const setupCard = page.getByRole('article', { name: 'Inventory product Fixture variants need setup', exact: true });
  await setupCard.getByText('Variants need setup', { exact: true }).waitFor();
  assert.ok((await setupCard.innerText()).includes('35 units in stock'), 'configuration warning preserves physical stock instead of inventing allocations');
  await setupCard.getByRole('button', { name: 'Edit', exact: true }).click();
  const setupEditor = page.getByRole('dialog', { name: 'Edit product', exact: true });
  await setupEditor.getByLabel('Product description', { exact: true }).fill('Unconfigured sizes remain pending physical stock review');
  await setupEditor.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await setupEditor.waitFor({ state: 'hidden' }); await dismiss(page);
  const setupEdit = writes.find(row => row.kind === 'product' && row.body.action === 'UPDATE_PRODUCT' && row.body.productId === '9c000000-0000-4000-8000-000000000015').body;
  assert.equal(Object.hasOwn(setupEdit, 'variants'), false, 'metadata saves never convert an unconfigured variant product to a simple sellable product');
  assert.equal(Object.hasOwn(setupEdit, 'hasVariants'), false);
  assert.equal(Object.hasOwn(setupEdit, 'stock'), false);
  const nullCard = page.getByRole('article', { name: 'Inventory product Fixture unset availability', exact: true });
  await nullCard.getByRole('button', { name: 'Edit', exact: true }).click();
  const nullEditor = page.getByRole('dialog', { name: 'Edit product', exact: true });
  assert.equal(await nullEditor.getByLabel('Active product', { exact: false }).isChecked(), false);
  assert.equal(await nullEditor.getByLabel('Available in student shop', { exact: false }).isChecked(), false, 'NULL visibility must stay hidden in the editor');
  await page.keyboard.press('Escape'); await nullEditor.waitFor({ state: 'hidden' });
  const variantCard = page.getByRole('article', { name: 'Inventory product Fixture variant uniform', exact: true });
  await variantCard.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit product', exact: true });
  await editor.getByLabel('Product description', { exact: true }).fill('Updated fictional catalog description');
  assert.equal(await editor.getByLabel('Active variant Grey · 170', { exact: true }).isChecked(), false, 'NULL variant availability stays inactive');
  await editor.getByLabel('Price override for White · 150', { exact: true }).fill('0');
  await editor.getByLabel('Active variant Black · 160', { exact: true }).uncheck();
  await editor.getByLabel('Available in student shop', { exact: false }).uncheck();
  await editor.getByRole('button', { name: 'Save Changes' }).click(); await editor.waitFor({ state: 'hidden' }); await dismiss(page);
  const edit = writes.find(row => row.kind === 'product' && row.body.action === 'UPDATE_PRODUCT' && row.body.productId === variantProductId).body;
  assert.equal(edit.expectedUpdatedAt, timestamp); assert.equal(edit.description, 'Updated fictional catalog description'); assert.equal(edit.allowStudentOrders, false); assert.equal(Object.hasOwn(edit, 'sizes'), false, 'catalog edits preserve every variant size');
  assert.equal(edit.variants.length, 3); assert.equal(edit.variants[0].priceOverride, 0); assert.equal(edit.variants[1].isActive, false);
  assert.ok(edit.variants.every(variant => variant.id && !Object.hasOwn(variant, 'stock')), 'variant metadata never writes stock or deletes identities');
  await page.getByRole('button', { name: 'ADD ITEM', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create product', exact: true });
  assert.equal(await create.getByLabel('Available in student shop', { exact: false }).isChecked(), false);
  await create.getByLabel('Product name', { exact: true }).fill('Fixture new product');
  await create.getByLabel('Product SKU', { exact: true }).fill('FIXTURE-NEW-001');
  await create.getByLabel('Product description', { exact: true }).fill('New fictional student catalog content');
  await create.getByRole('button', { name: 'Add Single Item', exact: true }).click(); await create.waitFor({ state: 'hidden' }); await dismiss(page);
  const created = writes.find(row => row.kind === 'product' && row.body.action === 'CREATE_PRODUCT').body;
  assert.equal(created.stock, 0); assert.equal(created.allowStudentOrders, false); assert.equal(created.isActive, true);
  const basic = page.getByRole('article', { name: 'Inventory product Fixture counter uniform', exact: true });
  await basic.getByRole('button', { name: 'Restock', exact: true }).click();
  const stock = page.getByRole('dialog', { name: 'Adjust stock', exact: true });
  await stock.getByLabel('Stock change quantity').fill('2');
  await stock.getByRole('button', { name: 'Save Stock Adjustment' }).click();
  await page.getByText('Fixture unconfirmed adjustment; retry the same request.', { exact: false }).waitFor(); await dismiss(page);
  await stock.getByRole('button', { name: 'Save Stock Adjustment' }).click(); await stock.waitFor({ state: 'hidden' }); await dismiss(page);
  const adjustments = writes.filter(row => row.kind === 'product' && row.body.action === 'ADJUST_STOCK');
  assert.equal(adjustments.length, 2); assert.equal(adjustments[0].body.requestKey, adjustments[1].body.requestKey, 'uncertain stock retries preserve their request key');
  await tab(page, 'STUDENT ORDERS').click();
  let card = page.getByRole('article', { name: 'Order FIXTURE-ORDER-001', exact: true });
  await card.screenshot({ path: 'scratch/shop-management-order-mobile.png' });
  await card.getByRole('button', { name: 'Accept order', exact: true }).click(); await card.getByRole('button', { name: 'Start preparing', exact: true }).waitFor();
  const accepted = writes.find(row => row.kind === 'order').body; assert.equal(accepted.newOrderStatus, 'CONFIRMED'); assert.equal(Object.hasOwn(accepted, 'paymentStatus'), false);
  await card.getByRole('button', { name: 'Record payment', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Record verified payment', exact: true });
  assert.equal(await payment.getByRole('button', { name: 'Record payment', exact: true }).isEnabled(), false);
  await payment.screenshot({ path: 'scratch/shop-management-payment-mobile.png' });
  await payment.getByLabel('Payment or receipt reference', { exact: true }).fill('FIXTURE-CASH-001');
  await payment.getByLabel('I verified that the full payment was received.', { exact: true }).check();
  await payment.getByRole('button', { name: 'Record payment', exact: true }).click(); await paymentStarted;
  assert.equal(await payment.getByRole('button', { name: 'Saving…', exact: true }).isEnabled(), false);
  assert.equal(writes.filter(row => row.kind === 'order' && row.body.paymentStatus === 'PAID').length, 1);
  releasePayment(); await payment.waitFor({ state: 'hidden' });
  const paid = writes.find(row => row.kind === 'order' && row.body.paymentStatus === 'PAID').body; assert.equal(paid.paymentReference, 'FIXTURE-CASH-001');
  await card.getByRole('button', { name: 'Start preparing', exact: true }).click(); await card.getByRole('button', { name: 'Mark ready', exact: true }).waitFor();
  await card.getByRole('button', { name: 'Mark ready', exact: true }).click(); await card.getByRole('button', { name: 'Complete handover', exact: true }).waitFor();
  await card.getByRole('button', { name: 'Complete handover', exact: true }).click();
  const handover = page.getByRole('dialog', { name: 'Complete handover', exact: true });
  await handover.getByLabel('The items have been handed to the customer.', { exact: true }).check();
  await handover.getByRole('button', { name: 'Complete handover', exact: true }).click(); await handover.waitFor({ state: 'hidden' });
  assert.equal(orders[0].order_status, 'COMPLETED');
  card = page.getByRole('article', { name: 'Order FIXTURE-ORDER-002', exact: true });
  assert.equal(await card.getByRole('button', { name: 'Complete handover', exact: true }).isEnabled(), false, 'unpaid orders cannot complete');
  await card.getByRole('button', { name: 'Cancel order', exact: true }).click();
  const cancel = page.getByRole('dialog', { name: 'Cancel student order', exact: true });
  assert.equal(await cancel.getByRole('button', { name: 'Cancel order', exact: true }).isEnabled(), false);
  await cancel.getByLabel('Cancellation reason', { exact: true }).fill('Fictional customer cancellation');
  await cancel.getByRole('button', { name: 'Cancel order', exact: true }).click(); await cancel.waitFor({ state: 'hidden' });
  assert.equal(writes.find(row => row.kind === 'cancel').body.reason, 'Fictional customer cancellation');
  await tab(page, 'SALES').click();
  await page.getByText('Recorded collections', { exact: true }).waitFor();
  for (const group of [page.getByRole('group', { name: 'Sales collection filters', exact: true }), page.getByRole('group', { name: 'Collection period', exact: true })]) {
    assert.ok(await group.evaluate(element => element.scrollWidth <= element.clientWidth), 'sales period and payment controls fit without clipping');
    assert.ok(await group.locator('button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth)), 'collection-period labels fit their buttons');
  }
  assert.ok(await page.getByRole('combobox', { name: 'Sales payment method', exact: true }).evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), 'the full payment-method control is on screen');
  await page.getByRole('button', { name: 'All Time', exact: true }).click();
  await page.getByText('FIXTURE-LEGACY-PAID', { exact: true }).filter({ visible: true }).waitFor();
  assert.ok(await page.getByText('Collection date needs review', { exact: true }).filter({ visible: true }).count() > 0, 'undated historical collections have a review label');
  await page.getByRole('button', { name: 'This Month', exact: true }).click();
  await page.getByText('FIXTURE-ORDER-001', { exact: true }).filter({ visible: true }).waitFor();
  assert.equal(await page.getByText('FIXTURE-LEGACY-PAID', { exact: true }).filter({ visible: true }).count(), 0, 'undated legacy collections are excluded from dated reports');
  assert.ok(orders[0].payment_recorded_at, 'the verified payment response supplies its collection timestamp');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByText('FIXTURE-ORDER-001', { exact: true }).filter({ visible: true }).waitFor();
  assert.equal(await page.getByText('FIXTURE-LEGACY-PAID', { exact: true }).filter({ visible: true }).count(), 0);
  await page.getByRole('button', { name: 'All Time', exact: true }).click();
  await page.getByText('FIXTURE-LEGACY-PAID', { exact: true }).filter({ visible: true }).waitFor();
  await page.screenshot({ path: 'scratch/shop-management-collections-mobile.png', fullPage: false });
  await fits(page); await context.close();
  const readonly = await fixture(true); await readonly.page.setViewportSize({ width: 390, height: 844 });
  await tab(readonly.page, 'STUDENT ORDERS').click();
  assert.equal(await readonly.page.getByRole('button', { name: 'Accept order', exact: true }).count(), 0);
  assert.equal(await readonly.page.getByRole('button', { name: 'Record payment', exact: true }).count(), 0);
  assert.equal(await readonly.page.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0);
  await fits(readonly.page); await readonly.context.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync('scratch/shop-management-browser-evidence.json', JSON.stringify({ passed: true, testedBaseURL: base, synthetic: true, liveWrites: 0, scenarios: results, verifiedPayment: true, collectionDateReporting: true, undatedCollectionReview: true, partialVariantStockAlerts: true, stockRetryKeys: true, catalogVisibility: true, staleVersions: true, readOnly: true, javascriptErrors: errors }, null, 2) + '\n');
  console.log('Shop management browser checks passed: desktop/tablet/mobile catalog, variant metadata preservation, explicit visibility, stock retry identity, separate fulfillment/payment, handover guard, cancellation reason and read-only controls. All provider calls mocked; zero live writes.');
} catch (error) {
  if (observedPage && !observedPage.isClosed()) await observedPage.screenshot({ path: 'scratch/shop-management-browser-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
