import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {formatServerErrorResponse}=loadTs('lib/backend-security.ts',{
 './env':{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public-key-for-tests',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key-for-tests'}},
 '@/lib/supabase':{supabase:{}}
});
test('server errors distinguish invalid input, conflict and deployment failure',t=>{
 t.mock.method(console,'error',()=>{});
 for(const [code,status] of [['22023',400],['23514',400],['23505',409],['40001',409],['42P01',503],['PGRST202',503],['PGRST116',404],['42501',403]]){
  assert.equal(formatServerErrorResponse({code,message:'Failure'}).status,status,code);
 }
 assert.equal(formatServerErrorResponse(new Error('Unexpected failure')).status,500);
});
test('production errors hide internal SQL details and do not promise an unsaved offline sync',async t=>{
 t.mock.method(console,'error',()=>{});
 const previous=process.env.NODE_ENV;
 try {
  process.env.NODE_ENV='production';
  const response=formatServerErrorResponse({code:'42703',message:'Private internal column and value'});
  assert.equal(response.status,503);
  const body=await response.json();
  assert.ok(!JSON.stringify(body).includes('Private internal'));
  assert.equal(body.error.details,undefined);
  const translator=loadTs('lib/errors/supabaseErrorTranslator.ts',{'@/lib/supabase':{supabase:{}}});
  const message=translator.translateSupabaseError({message:'Failed to fetch'}).userMessage;
  assert.ok(!message.includes('will sync'));
  const normalizer = loadTs('lib/error-handler.ts');
  assert.ok(!normalizer.normalizeError(new Error('Failed to fetch')).message.includes('will sync'));
  assert.equal(normalizer.normalizeError(new Error('The request timed out')).code, 'NETWORK_OFFLINE');
 } finally {
  if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
 }
});
