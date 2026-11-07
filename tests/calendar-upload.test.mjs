import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadTs } from './load-ts.mjs';

const eventId='94000000-0000-4000-8000-000000000001',actor='94000000-0000-4000-8000-000000000002';
const upload=loadTs('lib/calendar-upload.ts',{'./env':{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture-project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-only-private-key'}}});
function request(bytes=Buffer.from('%PDF-1.7\nFixture'),type='application/pdf',label='Competition rules'){
  const form=new FormData();form.append('file',new Blob([bytes],{type}),'rules.pdf');if(label!==null)form.append('label',label);
  return new Request('https://academy.test/api/admin/events/'+eventId+'/files',{method:'POST',body:form});
}

test('event multipart uploads enforce actual body/file limits, one-file fields, and MIME signatures',async()=>{
  const good=await upload.readEventUpload(request());assert.equal(good.label,'Competition rules');assert.equal(good.extension,'pdf');
  for(const [bytes,type] of [[Buffer.from('<html>login</html>'),'application/pdf'],[Buffer.from('%PDF-fake'),'image/png'],[Buffer.from('<svg/>'),'image/svg+xml']])await assert.rejects(upload.readEventUpload(request(bytes,type)),error=>error.status===422);
  const extra=new FormData();extra.append('file',new Blob(['%PDF-x'],{type:'application/pdf'}),'a.pdf');extra.append('file',new Blob(['%PDF-y'],{type:'application/pdf'}),'b.pdf');await assert.rejects(upload.readEventUpload(new Request('https://academy.test/upload',{method:'POST',body:extra})),error=>error.status===422);
  const forged=new FormData();forged.append('file',new Blob(['%PDF-x'],{type:'application/pdf'}),'a.pdf');forged.append('actor',actor);await assert.rejects(upload.readEventUpload(new Request('https://academy.test/upload',{method:'POST',body:forged})),error=>error.status===422);
  await assert.rejects(upload.readEventUpload(new Request('https://academy.test/upload',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=x','Content-Length':String(upload.eventUploadBodyLimit+1)},body:'x'})),error=>error.status===413);
  let chunks=0;
  const stream=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(1024*1024));if(chunks===20)controller.close();}});
  await assert.rejects(upload.readEventUpload(new Request('https://academy.test/upload',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=x','Content-Length':'1'},body:stream,duplex:'half'})),error=>error.status===413);
  assert.ok(chunks<20,'the reader stops without trusting the declared small length');
  const large=Buffer.alloc(upload.eventUploadFileLimit+1);large.write('%PDF-');await assert.rejects(upload.readEventUpload(request(large)),error=>error.status===413);
});

test('private upload rejects public buckets and invalid event scope, uses unique immutable paths, and never returns credentials',async()=>{
  let bucketCalls=0,fetchCalls=0,isPublic=false;
  const client={storage:{getBucket:async name=>{bucketCalls++;assert.equal(name,'academy-events');return {data:{public:isPublic},error:null};}}};
  const parsed=await upload.readEventUpload(request());
  const before=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{fetchCalls++;assert.equal(init.method,'POST');assert.equal(init.headers['x-upsert'],'false');assert.ok(init.signal);assert.equal(new URL(url).origin,'https://fixture-project.supabase.co');assert.ok(new URL(url).pathname.startsWith('/storage/v1/object/academy-events/'+eventId+'/'));return Response.json({Key:new URL(url).pathname.replace('/storage/v1/object/','')},{status:200});};
  try{
    await assert.rejects(upload.storeEventUpload(client,'../private',parsed));assert.equal(bucketCalls,0);assert.equal(fetchCalls,0);
    isPublic=true;await assert.rejects(upload.storeEventUpload(client,eventId,parsed),error=>error.status===503);assert.equal(fetchCalls,0);
    isPublic=false;const first=await upload.storeEventUpload(client,eventId,parsed),second=await upload.storeEventUpload(client,eventId,parsed);
    assert.notEqual(first.id,second.id);assert.notEqual(first.url,second.url);assert.equal(new URL(first.url).pathname,`/storage/v1/object/authenticated/academy-events/${eventId}/${first.id}.pdf`);assert.ok(!JSON.stringify(first).includes('fixture-only-private-key'));assert.ok(!first.url.includes('token='));
  }finally{globalThis.fetch=before;}
});

test('upload route authorizes actor, event ownership and edit permission before Storage and uses a durable actor rate slot',async()=>{
  let allowed=true,owner=true,rateAllowed=true,storageWrites=0,rateCalls=0,privateBucketChecks=0;
  const client={rpc:async(name,args)=>{rateCalls++;assert.equal(name,'portal_take_rate_slot');assert.equal(args.p_key,'calendar-upload:'+actor);assert.equal(args.p_limit,12);return {data:rateAllowed,error:null};},storage:{getBucket:async()=>{privateBucketChecks++;throw new Error('Unexpected Storage access in mocked route');}}};
  const route=loadTs('app/api/admin/events/[id]/files/route.ts',{
    '@/lib/backend-security':{callerHasPermission:async(_client,_context,key)=>{assert.equal(key,'action:events_edit');return allowed;}},
    '@/lib/calendar-admin-server':{calendarStaff:async()=>({context:{userId:actor,role:'Head Coach'},adminSupabase:client}),loadStaffEvent:async()=>({id:eventId,draft:{attachments:[]}}),canEditEvent:()=>owner,calendarResponse:(data,status)=>Response.json({success:true,data},{status}),calendarPrivateHeaders:{'Cache-Control':'private, no-store'},calendarError:()=>Response.json({success:false},{status:503})},
    '@/lib/calendar-upload':{...upload,storeEventUpload:async(_client,id,value)=>{storageWrites++;assert.equal(id,eventId);return {id:randomUUID(),label:value.label,url:'https://fixture-project.supabase.co/storage/v1/object/authenticated/academy-events/'+eventId+'/fixture.pdf'};}},
  });
  const context={params:Promise.resolve({id:eventId})};
  allowed=false;assert.equal((await route.POST(request(),context)).status,403);assert.equal(rateCalls,0);assert.equal(storageWrites,0);
  allowed=true;owner=false;assert.equal((await route.POST(request(),context)).status,403);assert.equal(rateCalls,0);assert.equal(storageWrites,0);
  owner=true;rateAllowed=false;const limited=await route.POST(request(),context);assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'600');assert.equal(storageWrites,0);
  rateAllowed=true;const good=await route.POST(request(),context);assert.equal(good.status,201);assert.equal(storageWrites,1);assert.equal(privateBucketChecks,0);assert.equal((await good.json()).data.attachment.label,'Competition rules');
});

test('event download cannot sign a private cross-bucket, cross-event or double-encoded traversal object',async()=>{
  const beforeProject=process.env.NEXT_PUBLIC_SUPABASE_URL,beforeFetch=globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture-project.supabase.co';
  const media=loadTs('lib/calendar-media.ts');
  let signs=0,downloads=0;
  const client={storage:{from:bucket=>({createSignedUrl:async(objectPath)=>{signs++;assert.equal(bucket,'academy-events');return {data:{signedUrl:`https://fixture-project.supabase.co/storage/v1/object/sign/academy-events/${objectPath}?token=fixture`},error:null};}})}};
  globalThis.fetch=async()=>{downloads++;return new Response('%PDF-1.7\nFixture',{headers:{'Content-Type':'application/pdf'}});};
  const other='94000000-0000-4000-8000-000000000099',file='94000000-0000-4000-8000-000000000100.pdf';
  try{
    for(const path of [`private-health/${eventId}/${file}`,`academy-events/${other}/${file}`,`academy-events/${eventId}/%252e%252e/${other}/${file}`,`academy-events/${eventId}/%5c..%5c${file}`]){
      await assert.rejects(media.fetchCalendarFile(client,'https://fixture-project.supabase.co/storage/v1/object/authenticated/'+path,eventId));
      assert.equal(signs,0,'a forbidden object must be rejected before privileged signing');assert.equal(downloads,0);
    }
    const result=await media.fetchCalendarFile(client,`https://fixture-project.supabase.co/storage/v1/object/authenticated/academy-events/${eventId}/${file}`,eventId);
    assert.equal(result.type,'application/pdf');assert.equal(signs,1);assert.equal(downloads,1);
  }finally{globalThis.fetch=beforeFetch;if(beforeProject===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=beforeProject;}
});

test('emoji filenames at the truncation boundary and legacy invalid Unicode labels remain downloadable for students and staff',async()=>{
  const form=new FormData();form.append('file',new Blob(['%PDF-1.7\nFixture'],{type:'application/pdf'}),'a'.repeat(119)+'🔥.pdf');
  const parsed=await upload.readEventUpload(new Request('https://academy.test/upload',{method:'POST',body:form}));
  assert.ok(parsed.label.length<=120);assert.doesNotThrow(()=>encodeURIComponent(parsed.label));
  const bytes=Buffer.from('%PDF-1.7\nFixture'),fileId='94000000-0000-4000-8000-000000000101';
  const item={id:fileId,label:'Legacy label \ud800',url:'https://fixture-project.supabase.co/private.pdf',studentAvailable:true,mimeType:'application/pdf',bytes:bytes.length,checksum:'fixture-checksum'};
  const api=loadTs('lib/calendar-api.ts',{
    './backend-security':{validateRequestBody:async()=>({})},
    './calendar-admin-server':{calendarStaff:async()=>({context:{userId:actor},adminSupabase:{}}),loadStaffEvent:async()=>({id:eventId,draft:{attachments:[item]}}),calendarPrivateHeaders:{'Cache-Control':'private, no-store'},calendarError:()=>Response.json({success:false},{status:503})},
    './calendar-student-server':{calendarStudent:async()=>({context:{userId:actor},adminSupabase:{},subjectStudentId:'STU-M-001'}),loadStudentEvent:async()=>({id:eventId,payload:{attachments:[item]}})},
    './calendar-media':{fetchCalendarFile:async()=>({bytes,type:'application/pdf',checksum:'fixture-checksum'})},
  });
  for(const handler of [api.portalCalendarFile,api.adminCalendarFile]){
    const response=await handler(new Request('https://academy.test/file'),eventId,fileId);
    assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.ok(response.headers.get('Content-Disposition').includes('%EF%BF%BD'));assert.equal(await response.text(),bytes.toString());
  }
});
