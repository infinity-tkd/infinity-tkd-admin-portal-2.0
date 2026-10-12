import { toCsv } from './csv';
export const MAX_IMPORT_ROWS=500;
export const MAX_IMPORT_BYTES=2*1024*1024;
export function validateImportSize(text:string,rows?:number){
 if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error('Import files must be 2 MB or smaller.');
 if(rows!==undefined&&rows>MAX_IMPORT_ROWS)throw new Error('Import at most 500 rows per batch.');
}
export type ImportFailure={row:number;message:string};
export const importRowKey=(row:{index:number;data:unknown})=>JSON.stringify([row.index,row.data]);
export async function runImportRows<T extends {index:number;data:unknown}>(
 rows:T[],completed:Set<string>,save:(row:T)=>Promise<{success:boolean;error?:string}>,
 progress:(done:number,total:number)=>void,wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))
){
 validateImportSize('',rows.length);
 const pending=rows.filter(row=>!completed.has(importRowKey(row)));
 const failures:ImportFailure[]=[];
 for(let i=0;i<pending.length;i++){
  if(i>0)await wait(650);
  const row=pending[i];progress(i+1,pending.length);
  try {
   const result=await save(row);
   if(result.success)completed.add(importRowKey(row));
   else failures.push({row:row.index,message:result.error || 'Save was not confirmed. Check the directory before retrying.'});
  }catch(error){failures.push({row:row.index,message:error instanceof Error?error.message:'Save failed. Check the directory before retrying.'});}
 }
 return {success:rows.filter(row=>completed.has(importRowKey(row))).length,failed:failures.length,failures};
}
export function importFailureCsv(failures:ImportFailure[]){return toCsv(['Row','Error'],failures.map(f=>[f.row,f.message]));}
