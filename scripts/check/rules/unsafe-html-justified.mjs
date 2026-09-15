/**
 * unsafe-html-justified — every `dangerouslySetInnerHTML` carries its own local
 * justification: a comment on the same line or directly above it (a contiguous
 * comment block ending on the previous line) matching
 * /(sanitiz|trusted|safe-html|escaped)/i, AND an `__html` value that visibly
 * comes from a sanitiser — a call whose name contains `sanitiz`/`escape`/`purify`,
 * or an identifier/property named `sanitized*` / `safe*`.
 *
 * Complements `scripts/check-sanitizer-passthrough.mjs`, which proves the Streamdown
 * sanitiser chain cannot be bypassed on shipped code paths. This rule is the local,
 * reviewable claim at each sink. Matches JSX attributes and `dangerouslySetInnerHTML:`
 * object properties (createElement props); prose mentions in comments never match.
 */
import { lineOfNode, parse, ts, walk } from "../lib/ts-ast.mjs";

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

const JUSTIFY_RE = /(sanitiz|trusted|safe-html|escaped)/i;
const SANITIZER_CALL_RE = /(sanitiz|escape|purify)/i;
const SAFE_NAME_RE = /^(sanitized|safe)/i;

/** The `__html` value expression of `{{ __html: x }}` (or the whole expression). */
function htmlValue(expr) {
  const t = ts();
  while (expr && t.isParenthesizedExpression(expr)) expr = expr.expression;
  if (expr && t.isObjectLiteralExpression(expr)) {
    const p = expr.properties.find(
      (x) =>
        (t.isPropertyAssignment(x) || t.isShorthandPropertyAssignment(x)) &&
        x.name.getText() === "__html",
    );
    if (!p) return expr;
    return t.isPropertyAssignment(p) ? p.initializer : p.name;
  }
  return expr;
}

function valueIsSanitized(value) {
  const t = ts();
  while (
    value &&
    (t.isParenthesizedExpression(value) || t.isAsExpression(value) || t.isNonNullExpression(value))
  )
    value = value.expression;
  if (!value) return false;
  if (t.isCallExpression(value)) {
    const callee = value.expression;
    const name = t.isIdentifier(callee)
      ? callee.text
      : t.isPropertyAccessExpression(callee)
        ? callee.getText()
        : "";
    return SANITIZER_CALL_RE.test(name);
  }
  if (t.isIdentifier(value)) return SAFE_NAME_RE.test(value.text);
  if (t.isPropertyAccessExpression(value)) return SAFE_NAME_RE.test(value.name.text);
  return false;
}

function justified(lines, line) {
  // same line
  if (/(\/\/|\/\*|\{\/\*)/.test(lines[line - 1]) && JUSTIFY_RE.test(lines[line - 1])) return true;
  // contiguous comment block directly above
  let i = line - 2;
  let block = "";
  while (i >= 0 && /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(lines[i])) block = `${lines[i--]}\n${block}`;
  return JUSTIFY_RE.test(block);
}

export function scanText(file, text) {
  if (!text.includes("dangerouslySetInnerHTML")) return [];
  const sf = parse(file, text);
  const t = ts();
  const lines = text.split("\n");
  const out = [];
  walk(sf, (n) => {
    let expr;
    if (t.isJsxAttribute(n) && n.name.getText(sf) === "dangerouslySetInnerHTML")
      expr =
        n.initializer && t.isJsxExpression(n.initializer) ? n.initializer.expression : undefined;
    else if (t.isPropertyAssignment(n) && n.name.getText(sf) === "dangerouslySetInnerHTML")
      expr = n.initializer;
    else return;
    const line = lineOfNode(sf, n);
    const problems = [];
    if (!justified(lines, line)) problems.push("no adjacent sanitized/trusted/escaped comment");
    if (!valueIsSanitized(htmlValue(expr)))
      problems.push("`__html` is not a sanitiser call or a `sanitized*`/`safe*` value");
    if (problems.length)
      out.push({ file, line, msg: `dangerouslySetInnerHTML: ${problems.join("; ")}` });
  });
  return out;
}

const src = (body) => ({ files: { "packages/editor/src/math/math.tsx": body } });

export default {
  id: "unsafe-html-justified",
  scope: "components",
  doc: "Every `dangerouslySetInnerHTML` has a same-line or directly-preceding comment saying why it is sanitized/trusted/escaped, and its `__html` is a sanitiser call or a `sanitized*`/`safe*` value.",
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob("packages/*/src/**/*.{ts,tsx}", { ignore: IGNORE })
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      src(`const safeHtml = sanitizeSvg(svg);
return (
  <div
    role="img"
    // Mermaid output, re-sanitized with DOMPurify before insertion.
    dangerouslySetInnerHTML={{ __html: safeHtml }}
  />
);`),
      src(`return (
  <span
    role="math"
    // KaTeX output is escaped (trust:false); sanitized again below.
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
  />
);`),
      src(`// Streamdown mentions dangerouslySetInnerHTML only in this prose comment.
export const x = 1;`),
    ],
    fail: [
      // real shape from mermaid-diagram.tsx: justified, but the value is an unnamed string
      src(`<div
  className="overflow-x-auto"
  // Mermaid output; securityLevel "strict" sanitizes the source.
  dangerouslySetInnerHTML={{ __html: svg }}
/>`),
      // real shape from math.tsx: value named, comment does not use the vocabulary
      src(`<span
  role="math"
  aria-label={tex}
  dangerouslySetInnerHTML={{ __html: html }}
  {...props}
/>`),
      src(`return createElement("div", { dangerouslySetInnerHTML: { __html: safeMarkup } });`),
    ],
  },
};
