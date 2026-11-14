import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Form accessibility, checked statically on every component (WCAG 1.3.1, 3.3.2, 4.1.2):
//  1. a visible <label> that sits directly before a control (or a wrapper holding exactly one, or a conditional that
//     renders one) must be linked to it with htmlFor/id, otherwise screen readers announce the field without its label
//     and tapping the label text does not focus the field;
//  2. every <select>, and every <input>/<textarea> without a placeholder, needs an accessible name: aria-label,
//     aria-labelledby, title, an id a label points at, or a wrapping <label>/<Labeled>.
// The browser audit (scripts/check-a11y-browser.mjs) verifies the same on the rendered pages and dialogs.
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.tsx$/.test(entry.name) ? [full] : [];
});
const files = [...walk('components'), ...walk('app')];
const opening = node => ts.isJsxElement(node) ? node.openingElement : node;
const isElement = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
const tagName = node => isElement(node) ? opening(node).tagName.getText() : '';
const attr = (node, name) => opening(node).attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText() === name);
const spread = node => opening(node).attributes.properties.some(ts.isJsxSpreadAttribute);
const CONTROLS = new Set(['input', 'select', 'textarea']);
const SKIPPED_INPUTS = new Set(['hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button', 'reset', 'image']);
const typeOf = node => { const type = attr(node, 'type'); return type?.initializer && ts.isStringLiteral(type.initializer) ? type.initializer.text : ''; };
const isControl = node => CONTROLS.has(tagName(node)) && !(tagName(node) === 'input' && SKIPPED_INPUTS.has(typeOf(node)));
const controlsIn = node => { const found = []; const visit = child => { if (isElement(child) && isControl(child)) { found.push(child); return; } ts.forEachChild(child, visit); }; ts.forEachChild(node, visit); return found; };
// A label that wraps any form control (a checkbox too) is already associated with it.
const wraps = node => { let found = false; const visit = child => { if (found) return; if (isElement(child) && CONTROLS.has(tagName(child))) { found = true; return; } ts.forEachChild(child, visit); }; ts.forEachChild(node, visit); return found; };
// Components that link their label and control themselves (useId + cloneElement).
const NAMING_WRAPPERS = ['label', 'Labeled', 'Field'];
const where = (source, node) => `${source.fileName.replace(/\\/g, '/')}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

/** Controls a label points at: the next element if it is a control, a wrapper with exactly one, or the controls in a conditional. */
function targetsAfter(kids, index) {
  let next = index + 1;
  while (next < kids.length && ts.isJsxText(kids[next]) && kids[next].containsOnlyTriviaWhiteSpaces) next++;
  const node = kids[next];
  if (!node) return [];
  if (isElement(node) && isControl(node)) return [node];
  if (ts.isJsxElement(node) && ['div', 'span'].includes(tagName(node))) { const inner = controlsIn(node); return inner.length === 1 ? inner : []; }
  if (ts.isJsxExpression(node) && node.expression) {
    const leaves = expression => { let current = expression; while (ts.isParenthesizedExpression(current)) current = current.expression; if (ts.isConditionalExpression(current)) return [...leaves(current.whenTrue), ...leaves(current.whenFalse)]; if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return leaves(current.right); return [current]; };
    const perLeaf = leaves(node.expression).map(leaf => isElement(leaf) ? (isControl(leaf) ? [leaf] : controlsIn(leaf)) : []);
    return perLeaf.every(found => found.length <= 1) ? perLeaf.flat() : [];
  }
  return [];
}

test('every visible label is linked to the control it labels', () => {
  const unlinked = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        node.children.forEach((child, index) => {
          if (!ts.isJsxElement(child) || tagName(child) !== 'label' || attr(child, 'htmlFor') || attr(child, 'for') || wraps(child)) return;
          const targets = targetsAfter(node.children, index);
          if (targets.length) unlinked.push(`${where(source, child)}  ${child.getText().replace(/\s+/g, ' ').slice(0, 60)}`);
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(unlinked, [], `labels that precede a control without htmlFor/id:\n  ${unlinked.join('\n  ')}`);
});

test('every select, and every input or textarea without a placeholder, has an accessible name', () => {
  const unnamed = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (isElement(node) && isControl(node)) {
        const name = tagName(node);
        const named = attr(node, 'aria-label') || attr(node, 'aria-labelledby') || attr(node, 'title') || attr(node, 'id') || spread(node) || (name !== 'select' && attr(node, 'placeholder'));
        let wrapped = false;
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && NAMING_WRAPPERS.includes(tagName(parent))) { wrapped = true; break; }
        if (!named && !wrapped) unnamed.push(`${where(source, node)}  <${name}${typeOf(node) ? ' type=' + typeOf(node) : ''}>`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(unnamed, [], `controls without an accessible name:\n  ${unnamed.join('\n  ')}`);
});

test('every icon-only button has an accessible name', () => {
  // A <button> whose only content is an icon is announced as just "button" unless it carries aria-label, aria-labelledby or title (WCAG 4.1.2).
  const unnamed = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const icons = new Set();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause || !/phosphor-icons|lucide-react|heroicons|react-icons/.test(statement.moduleSpecifier.text)) continue;
      if (statement.importClause.name) icons.add(statement.importClause.name.text);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach(element => icons.add(element.name.text));
    }
    if (!icons.size) continue;
    const visit = node => {
      if (ts.isJsxElement(node) && tagName(node) === 'button' && !(attr(node, 'aria-label') || attr(node, 'aria-labelledby') || attr(node, 'title') || spread(node))) {
        let text = false, icon = false, dynamic = false;
        const inspect = child => {
          if (ts.isJsxText(child) && child.text.trim()) text = true;
          else if (ts.isJsxExpression(child)) { if (child.expression) { if (!/<[A-Z]/.test(child.expression.getText())) dynamic = true; ts.forEachChild(child, inspect); } }
          else if (isElement(child)) {
            const name = tagName(child);
            if (icons.has(name)) icon = true;
            else if (name === 'span' && /sr-only/.test(child.getText().slice(0, 120))) text = true;
            if (ts.isJsxElement(child)) child.children.forEach(inspect);
          } else if (ts.isJsxFragment(child)) child.children.forEach(inspect);
        };
        node.children.forEach(inspect);
        if (icon && !text && !dynamic) unnamed.push(where(source, node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(unnamed, [], `icon-only buttons without an accessible name:\n  ${unnamed.join('\n  ')}`);
});

test('a dialog wraps its form: no <form> carries role="dialog"', () => {
  // A form element may not take the dialog role (aria-allowed-role); the dialog is a wrapper around the form.
  const offenders = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (isElement(node) && tagName(node) === 'form') {
        const role = attr(node, 'role');
        if (role?.initializer && /dialog/.test(role.initializer.getText())) offenders.push(where(source, node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(offenders, [], `<form role="dialog"> found:\n  ${offenders.join('\n  ')}`);
});

test('the language switch and the skip link have a translation in every language', () => {
  for (const file of ['lib/i18n-en.ts', 'lib/i18n-kh.ts', 'lib/i18n-zh.ts']) {
    const count = (fs.readFileSync(file, 'utf8').match(/a11y_skip_to_content:/g) || []).length;
    assert.equal(count, 1, `${file} has the skip link text`);
  }
});
