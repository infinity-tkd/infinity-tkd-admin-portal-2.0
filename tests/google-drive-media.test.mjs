import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server.js';
import {loadTs} from './load-ts.mjs';
const {parseGoogleDriveFile,directImageSource}=loadTs('lib/google-drive-media.ts');
const id='fictional-drive-file-12345',resource='0-fictionalKey';

test('Drive image references preserve resource keys, support file IDs and reject folder/host-spoof links',()=>{
 const url=`https://drive.google.com/file/d/${id}/view?usp=sharing&resourcekey=${resource}`;
 assert.deepEqual(parseGoogleDriveFile(url),{fileId:id,resourceKey:resource});
 const proxy=new URL(directImageSource(url),'https://portal.example');assert.equal(proxy.pathname,'/api/image-proxy');assert.equal(proxy.searchParams.get('resourcekey'),resource);
 assert.equal(directImageSource(id),`/api/image-proxy?id=${id}`);
 assert.equal(directImageSource(`https://drive.google.com/drive/folders/${id}`),'');
 assert.equal(parseGoogleDriveFile(`https://drive.google.com.evil.example/file/d/${id}/view`),null);
 assert.equal(directImageSource('https://lh3.googleusercontent.com/a/avatar-image'),'https://lh3.googleusercontent.com/a/avatar-image');
 assert.equal(directImageSource('/logo.svg'),'/logo.svg');
});

test('image proxy carries the resource key only to allowlisted targets and never makes profile images shared-cacheable',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async input=>{calls.push(new URL(input));return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});});
 const {GET}=loadTs('app/api/image-proxy/route.ts',{'@/lib/backend-security':{checkApiRateLimit:()=>({allowed:true})}});
 const response=await GET(new NextRequest(`https://portal.example/api/image-proxy?id=${id}&resourcekey=${resource}`));
 assert.equal(response.status,200);assert.equal(calls[0].searchParams.get('resourcekey'),resource);assert.equal(calls[0].hostname,'lh3.googleusercontent.com');assert.match(response.headers.get('cache-control'),/^private/);assert.ok(!response.headers.get('cache-control').includes('s-maxage'));
 assert.equal((await GET(new NextRequest(`https://portal.example/api/image-proxy?id=${id}&resourcekey=bad%20key`))).status,400);assert.equal(calls.length,1);
});
