/**
 * Shared helpers for class-string lint rules (./product-conventions.js).
 *
 * A "class unit" is one place a class list is authored:
 *   - a JSX `className`/`class` attribute (including every string inside nested
 *     `cn()`/`clsx()`/`cva()` calls in that attribute), or
 *   - a top-level class-utility call (`cn`/`clsx`/`cx`/`classNames`/`twMerge`/`tw`/`cva`)
 *     that is NOT already inside a className attribute or another class call.
 * Unit-level rules (focus stack, disabled recipe) look at all tokens of one unit together,
 * so a `cva` base + its variants count as one list.
 */

export const CLASS_FNS = new Set(["cn", "clsx", "cx", "classNames", "twMerge", "tw", "cva"]);

export function calleeName(callee) {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier")
    return callee.property.name;
  return null;
}

const isClassCall = (n) => n?.type === "CallExpression" && CLASS_FNS.has(calleeName(n.callee));
const isClassAttr = (n) =>
  n?.type === "JSXAttribute" && (n.name?.name === "className" || n.name?.name === "class");

/** Yield `{ value, node }` for every static string reachable from `node` (descends into class calls). */
export function* eachString(node) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") yield { value: node.value, node };
      return;
    case "TemplateLiteral":
      for (const q of node.quasis) yield { value: q.value.cooked ?? q.value.raw, node: q };
      for (const e of node.expressions) yield* eachString(e);
      return;
    case "ConditionalExpression":
      yield* eachString(node.consequent);
      yield* eachString(node.alternate);
      return;
    case "LogicalExpression":
      yield* eachString(node.left);
      yield* eachString(node.right);
      return;
    case "ArrayExpression":
      for (const el of node.elements) yield* eachString(el);
      return;
    case "ObjectExpression":
      for (const p of node.properties) {
        if (p.type === "Property") {
          yield* eachString(p.key);
          yield* eachString(p.value);
        }
      }
      return;
    case "CallExpression":
      if (isClassCall(node)) for (const a of node.arguments) yield* eachString(a);
      return;
    case "JSXExpressionContainer":
      yield* eachString(node.expression);
      return;
    default:
      return;
  }
}

/**
 * Split a class token into its variant chain and base utility.
 * `md:hover:!-ml-2` → `{ variants: ["md", "hover"], base: "-ml-2" }` (important `!` stripped).
 */
export function parseClass(cls) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of cls) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  const base = cur.replace(/^!/, "").replace(/!$/, "");
  return { variants: parts, base };
}

/** `[{ cls, variants, base, node }]` for every whitespace-separated token in a unit. */
export function tokensOf(rootNode) {
  const out = [];
  for (const { value, node } of eachString(rootNode)) {
    for (const cls of value.split(/\s+/)) {
      if (!cls) continue;
      out.push({ cls, node, ...parseClass(cls) });
    }
  }
  return out;
}

/** Visitor calling `onUnit(tokens, unitNode)` once per class unit. */
export function classUnitVisitor(context, onUnit) {
  const ancestorsOf = (node) => context.sourceCode?.getAncestors?.(node) ?? context.getAncestors();
  return {
    JSXAttribute(node) {
      if (!isClassAttr(node) || !node.value) return;
      onUnit(tokensOf(node.value), node);
    },
    CallExpression(node) {
      if (!isClassCall(node)) return;
      if (ancestorsOf(node).some((a) => isClassAttr(a) || isClassCall(a))) return;
      onUnit(
        node.arguments.flatMap((a) => tokensOf(a)),
        node,
      );
    },
  };
}

/** The static class tokens of a JSX opening element's own `className`. */
export function elementClassTokens(opening) {
  const attr = opening.attributes.find(isClassAttr);
  return attr?.value ? tokensOf(attr.value) : [];
}

/** `Foo`, `Foo.Bar` → last segment name of a JSX element name. */
export function jsxName(name) {
  if (!name) return "";
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return name.property.name;
  if (name.type === "JSXNamespacedName") return name.name.name;
  return "";
}
