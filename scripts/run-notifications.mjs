import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const origin=process.env.APP_URL,secret=process.env.NOTIFICATION_JOB_SECRET;
if(!origin||!secret||secret.length<32)throw new Error('Set APP_URL and NOTIFICATION_JOB_SECRET before starting notification jobs.');
const url=new URL('/api/jobs/notifications',origin);
if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('The production job URL must use HTTPS.');
const once=process.argv.includes('--once');
async function run(){try{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(60000)});const result=await response.json();if(!response.ok||result.success!==true)throw new Error(result.error?.message||'Notification job failed');console.log(JSON.stringify({time:new Date().toISOString(),...result.data}));return !result.data.failed&&!result.data.deliveryFailed&&!result.data.operationsFailed;}catch(error){console.error('Notification job failed:',error.message);return false;}}
if(once){if(!await run())process.exitCode=1;}else{console.log('Notification worker started. Checking once per minute.');while(true){const started=Date.now();await run();await new Promise(resolve=>setTimeout(resolve,Math.max(0,60000-(Date.now()-started))));}}
