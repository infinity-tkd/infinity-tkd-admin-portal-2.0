import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
const cache=new Map();
export function loadTs(file,stubs={}){
 const absolute=path.resolve(file);const cached=Object.keys(stubs).length===0;
 if(cached && cache.has(absolute))return cache.get(absolute).exports;
 const mod=new Module(absolute);if(cached)cache.set(absolute,mod);mod.filename=absolute;mod.paths=Module._nodeModulePaths(path.dirname(absolute));
 const native=mod.require.bind(mod);
 mod.require=specifier=>{
  if(Object.hasOwn(stubs,specifier))return stubs[specifier];
  if(specifier.startsWith('.')){const resolved=path.resolve(path.dirname(absolute),specifier);if(fs.existsSync(resolved+'.ts'))return loadTs(resolved+'.ts',stubs);}
  return native(specifier);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,absolute);
 return mod.exports;
}
