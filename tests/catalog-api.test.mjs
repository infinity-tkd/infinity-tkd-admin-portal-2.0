import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const actor = '86000000-0000-4000-8000-000000000001';
const product = '86000000-0000-4000-8000-000000000002';
const security = loadTs('lib/backend-security.ts', {
  './env': { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fictional-public', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service' } },
  '@/lib/supabase': { supabase: {} },
});
function fixture(result = { data: { id: product }, error: null }) {
  const calls = [];
  const query = { update: fields => { calls.push({ fields }); return query; }, eq: () => query, select: () => query, maybeSingle: async () => result };
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return result; }, from: () => query };
  const route = loadTs('app/api/admin/pos/products/route.ts', { '@/lib/backend-security': { ...security, verifyCaller: async () => ({ context: { userId: actor, role: 'Admin' }, adminSupabase: client }), logSecurityAuditEvent: async () => {} } });
  return { route, calls };
}

test('REST product updates use the transaction that checks variants and logs stock changes', async t => {
  t.mock.method(console, 'error', () => {});
  const check = fixture();
  const body = { productId: product, stock: 7, variants: [{ sku: 'FIXTURE-S', size: 'S', stock: 3 }] };
  const request = () => new Request('https://portal.example/api/admin/pos/products', { method: 'PUT', body: JSON.stringify(body) });
  assert.equal((await check.route.PUT(request())).status, 200);
  assert.equal(check.calls[0].name, 'portal_save_product');
  assert.equal(check.calls[0].args.p_actor, actor);
  assert.equal(check.calls[0].args.p_payload.action, 'UPDATE_PRODUCT');
  assert.equal(check.calls[0].args.p_payload.variants[0].stock, 3);
  assert.ok((await fixture({ data: null, error: null }).route.PUT(request())).status >= 400, 'unconfirmed mutations never report success');
});

test('REST deletion rejects malformed IDs and distinguishes a missing product', async () => {
  const check = fixture({ data: null, error: null });
  assert.equal((await check.route.DELETE(new Request('https://portal.example/api/admin/pos/products?id=invalid'))).status, 422);
  assert.equal(check.calls.length, 0);
  assert.equal((await check.route.DELETE(new Request(`https://portal.example/api/admin/pos/products?id=${product}`))).status, 404);
  assert.equal(check.calls.length, 1);
});

test('variant API accepts style-only prices and rejects misspelled override fields',async()=>{
  const check=fixture();
  const body={action:'CREATE_PRODUCT',sku:'FIXTURE',name:'Fixture',categoryName:'Belts',priceUsd:25,hasVariants:true,variants:[{sku:'FIXTURE-RED',size:null,color:'Red',stock:3,priceOverride:0}]};
  const request=value=>new Request('https://portal.example/api/admin/pos/products',{method:'POST',body:JSON.stringify(value)});
  assert.equal((await check.route.POST(request(body))).status,200);
  assert.equal(check.calls[0].args.p_payload.variants[0].priceOverride,0);
  assert.equal((await check.route.POST(request({...body,variants:[{...body.variants[0],price_override:0}]}))).status,422);
});

test('inventory API rejects restocks that remove stock and write-offs that add stock',async()=>{
  const check=fixture();
  const request=(reason,changeQty)=>new Request('https://portal.example/api/admin/pos/products',{method:'POST',body:JSON.stringify({action:'ADJUST_STOCK',productId:product,reason,changeQty})});
  assert.equal((await check.route.POST(request('RESTOCK',-2))).status,422);
  assert.equal((await check.route.POST(request('DAMAGE_WRITE_OFF',2))).status,422);
  assert.equal(check.calls.length,0);
  assert.equal((await check.route.POST(request('AUDIT_ADJUSTMENT',-2))).status,200);
  assert.equal(check.calls[0].args.p_change_qty,-2);
});
