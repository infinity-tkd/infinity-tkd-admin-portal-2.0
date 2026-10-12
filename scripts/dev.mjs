import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import { developmentNodeOptions } from './lib/dev-memory.mjs';

const require=createRequire(import.meta.url);
const memory=developmentNodeOptions(process.env.NODE_OPTIONS,os.totalmem());
const args=process.argv.slice(2);
const sourceMaps=process.env.PORTAL_DEV_SOURCE_MAPS==='1';
console.log(`[portal dev] Heap budget: ${memory.heapMiB} MiB (${memory.automatic?'automatic':'NODE_OPTIONS'}). Node stack source maps: ${sourceMaps?'enabled':'disabled'}.`);
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev',...(sourceMaps?[]:['--disable-source-maps']),...args],{
 stdio:'inherit',env:{...process.env,NODE_OPTIONS:memory.nodeOptions}
});
child.once('error',error=>{console.error('Development server could not start:',error.message);process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGINT'?130:1);});
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
