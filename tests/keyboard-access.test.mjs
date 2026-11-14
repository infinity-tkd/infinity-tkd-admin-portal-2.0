import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// A div, span, li, tr or td with an onClick handler is invisible to the keyboard and to screen readers unless it is also given a role
// and a tab stop (see components/ui/pressable.ts), or it contains a real button or link that does the same thing. Backdrops that close a
// dialog are exempt: Escape closes the dialog.
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.tsx$/.test(entry.name) ? [full] : [];
});
const INTERACTIVE = new Set(['button', 'a', 'Link', 'input', 'select', 'textarea', 'summary']);
// The only pointer-only click target: a video thumbnail whose "Watch" button, right beside it, is the keyboard route.
const ALLOWED = [['components/LmsView.tsx', 'handlePlayVideo(video)']];

test('every clickable container can also be used from the keyboard', () => {
  const offenders = [];
  for (const file of [...walk('components'), ...walk('app')]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const containsInteractive = element => { let found = false; const look = node => { if (found) return; if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && INTERACTIVE.has(node.tagName.getText())) { found = true; return; } ts.forEachChild(node, look); }; look(element.parent); return found; };
    const visit = node => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText();
        if (['div', 'span', 'li', 'td', 'tr', 'p', 'section', 'article'].includes(tag)) {
          const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
          const has = name => attributes.some(attribute => attribute.name.getText() === name);
          const spread = node.attributes.properties.some(ts.isJsxSpreadAttribute);
          const click = attributes.find(attribute => attribute.name.getText() === 'onClick');
          if (click && !spread && !has('role') && !has('tabIndex') && !has('aria-hidden')) {
            const handler = click.initializer?.getText() ?? '';
            const className = attributes.find(attribute => attribute.name.getText() === 'className')?.initializer?.getText() ?? '';
            const backdrop = /stopPropagation/.test(handler) || (/(fixed|absolute)[^"]*inset-0|backdrop|bg-black|bg-neutral-950/.test(className) && !/cursor-pointer/.test(className));
            const allowed = ALLOWED.some(([where, text]) => file.replace(/\\/g, '/') === where && handler.includes(text));
            if (!backdrop && !allowed && !(ts.isJsxOpeningElement(node) && containsInteractive(node))) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart());
              offenders.push(`${file.replace(/\\/g, '/')}:${line + 1} <${tag}> onClick=${handler.slice(0, 60)}`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(offenders, [], `clickable elements the keyboard cannot reach (use <button>, or {...pressable(handler)} from components/ui/pressable):\n  ${offenders.join('\n  ')}`);
});

test('pressable() activates with Enter and Space, but not for keys typed in a nested field', () => {
  const source = fs.readFileSync('components/ui/pressable.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', code)(module, module.exports);
  const { pressable } = module.exports;
  let calls = 0;
  const props = pressable(() => { calls++; }, false);
  assert.equal(props.role, 'button'); assert.equal(props.tabIndex, 0); assert.equal(props['aria-pressed'], false);
  const self = {}, key = (name, target = self) => ({ key: name, target, currentTarget: self, preventDefault() {} });
  props.onKeyDown(key('Enter')); props.onKeyDown(key(' ')); props.onKeyDown(key('a')); props.onKeyDown(key('Enter', {}));
  assert.equal(calls, 2, 'Enter and Space activate; other keys and keys from a nested element do not');
  assert.equal('aria-pressed' in pressable(() => {}), false, 'a plain button is not announced as a toggle');
});
