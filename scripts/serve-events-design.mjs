import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const file=path.resolve('docs/design/academy-events-prototype.html');
const port=Number(process.argv[2]??3192);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Choose a port from 1024 to 65535.');
const server=http.createServer((request,response)=>{
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Content-Type-Options','nosniff');
 response.setHeader('Referrer-Policy','no-referrer');
 response.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD'});response.end();return;}
 if(request.url==='/favicon.ico'){response.writeHead(204);response.end();return;}
 if(request.url!=='/'&&request.url!=='/calendar'){response.writeHead(404);response.end('Design route not found.');return;}
 try{const html=fs.readFileSync(file);response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(request.method==='HEAD'?undefined:html);}
 catch{response.writeHead(503);response.end('The design file is unavailable.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Events design preview: http://127.0.0.1:${port}`));
