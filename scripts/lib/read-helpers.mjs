import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Standalone diagnostics share the application's import-free read helpers.
// Compile them explicitly rather than relying on Node's ambiguous .ts module detection.
const helper = async relativePath => {
 const source = await readFile(new URL(relativePath,import.meta.url),'utf8');
 const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
};
const access = await helper('../../lib/data-access.ts');
const recovery = await helper('../../lib/read-recovery.ts');
export const fetchAllRows = access.fetchAllRows;
export const settleReads = recovery.settleReads;
