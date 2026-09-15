/**
 * ts-ast.mjs — a shared, memoised TypeScript AST for check rules that need real
 * syntax (hooks, memo, JSX attributes). `typescript` is resolved from the
 * workspace root (a devDependency), so the runner itself stays dependency-free.
 *
 * Parse cost is paid once per (file, text) across every rule in the process;
 * rules should pre-filter with a cheap substring test before calling `parse`.
 */
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../package.json", import.meta.url));

let tsModule;
/** The `typescript` module (loaded lazily on first use). */
export function ts() {
  return (tsModule ??= require("typescript"));
}

const cache = new Map();

/** Parse `text` as `file` (TSX when the extension says so) → ts.SourceFile, memoised. */
export function parse(file, text) {
  const hit = cache.get(file);
  if (hit && hit.text === text) return hit.sf;
  const t = ts();
  const kind = /\.tsx$/.test(file) ? t.ScriptKind.TSX : t.ScriptKind.TS;
  const sf = t.createSourceFile(file, text, t.ScriptTarget.Latest, true, kind);
  cache.set(file, { text, sf });
  return sf;
}

/** 1-based line of a node's start (after leading trivia). */
export function lineOfNode(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Depth-first walk; `visit(node)` returning `false` skips that node's children. */
export function walk(node, visit) {
  if (visit(node) === false) return;
  ts().forEachChild(node, (child) => walk(child, visit));
}

/** True for any function-like node (declaration, expression, arrow, method, accessor). */
export function isFunctionLike(node) {
  const t = ts();
  return (
    t.isFunctionDeclaration(node) ||
    t.isFunctionExpression(node) ||
    t.isArrowFunction(node) ||
    t.isMethodDeclaration(node) ||
    t.isGetAccessorDeclaration(node) ||
    t.isSetAccessorDeclaration(node) ||
    t.isConstructorDeclaration(node)
  );
}

/** Walk a function's own body, not descending into nested function-likes. */
export function walkOwn(fn, visit) {
  if (!fn.body) return;
  walk(fn.body, (n) => {
    if (n !== fn.body && isFunctionLike(n)) return false;
    return visit(n);
  });
}

/** `foo(…)` / `React.foo(…)` → "foo"; anything else → null. */
export function calleeName(call) {
  const t = ts();
  const e = call.expression;
  if (t.isIdentifier(e)) return e.text;
  if (t.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}
