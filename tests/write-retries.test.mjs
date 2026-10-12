import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('an ambiguous stock mutation is not replayed; an explicit read recovers from a transient failure', async t => {
  let writes = 0, reads = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'POST') {
      ++writes;
      return new Response(JSON.stringify({message:'Ambiguous provider failure'}), {status:503,headers:{'Content-Type':'application/json'}});
    }
    ++reads;
    return new Response(JSON.stringify(reads === 1 ? {message:'Temporary outage'} : [{id:1}]), {status:reads === 1 ? 503 : 200,headers:{'Content-Type':'application/json'}});
  });
  const {supabase} = loadTs('lib/supabase.ts', {'./env':{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-public'}}});
  try {
    const result = await supabase.rpc('portal_adjust_inventory', {p_change_qty:1});
    assert.ok(result.error);
    assert.equal(writes, 1, 'SDK must not retry a non-idempotent RPC');
    const {fetchAllRows} = loadTs('lib/data-access.ts');
    assert.deepEqual((await fetchAllRows(supabase.from('products').select('id'))).data, [{id:1}]);
    assert.equal(reads, 2, 'safe GET is retried');
  } finally { supabase.auth.dispose(); }
});
