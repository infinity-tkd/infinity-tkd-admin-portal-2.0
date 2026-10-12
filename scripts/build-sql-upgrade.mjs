import fs from 'node:fs';
const names=fs.readdirSync('supabase/migrations').filter(name=>/^20261009090[0-4]00_.*\.sql$/.test(name)||/^20261010090000_.*\.sql$/.test(name)||/^20261011090[0-2]00_.*\.sql$/.test(name)).sort();
if(names.length!==9)throw new Error('Expected the nine audited portal migrations.');
const source='-- Infinity TKD upgrade, 2026-10-09 through 2026-10-11. Existing database required.\n-- Apply once after preflight checks and schema rehearsal.\nBEGIN;\nSET LOCAL lock_timeout=\'5s\';\nSET LOCAL statement_timeout=\'120s\';\n'+names.map(name=>{
 const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');
 return '\n-- '+name+'\n'+sql.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'').replace(/^NOTIFY pgrst, 'reload schema';[ \t]*$/gm,'');
}).join('\n')+'\nNOTIFY pgrst, \'reload schema\';\nCOMMIT;\n';
fs.writeFileSync('supabase/production-upgrade-20261009.sql',source);
