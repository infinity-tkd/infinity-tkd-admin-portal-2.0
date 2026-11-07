import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';
const file='.env.local';let source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const get=name=>source.match(new RegExp('^'+name+'\\s*=\\s*(.+)$','m'))?.[1]?.trim();
const publicKey=get('WEB_PUSH_PUBLIC_KEY'),privateKey=get('WEB_PUSH_PRIVATE_KEY');
if(Boolean(publicKey)!==Boolean(privateKey))throw new Error('The existing Web Push key pair is incomplete. Restore the matching pair before continuing.');
const entries=[];if(!publicKey){const keys=webpush.generateVAPIDKeys();entries.push(['WEB_PUSH_PUBLIC_KEY',keys.publicKey],['WEB_PUSH_PRIVATE_KEY',keys.privateKey]);}
if(!get('WEB_PUSH_SUBJECT'))entries.push(['WEB_PUSH_SUBJECT','mailto:contact@infinitytkd.com']);
if(!get('NOTIFICATION_JOB_SECRET'))entries.push(['NOTIFICATION_JOB_SECRET',crypto.randomBytes(32).toString('hex')]);
if(entries.length)fs.writeFileSync(file,source.trimEnd()+'\n\n# Server-side notification configuration\n'+entries.map(([name,value])=>name+'='+value).join('\n')+'\n');
console.log('Notification configuration prepared in .env.local. No credential values were printed and no existing keys were rotated.');
