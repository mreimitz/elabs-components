/**
 * memo-on-children — never wrap a component that takes `children` in
 * `memo`/`React.memo`: JSX children are a fresh object on every parent render,
 * so the shallow prop compare always fails and the memo only costs.
 *
 * The wrapped component is the first `memo(…)` argument, unwrapping `forwardRef(…)`,
 * or an identifier resolved to a same-file function/const. It "takes children" when:
 *   - its first parameter destructures `children`, or
 *   - that parameter's type is `PropsWithChildren<…>`, a type literal with a `children`
 *     member, or a same-file interface/type alias that has one (following same-file
 *     `extends` / `&` / `forwardRef<El, Props>` generics).
 * `children: string` (or another primitive) is exempt: it compares by value.
 * Inherited `HTMLAttributes` children are NOT counted (every DOM-props component would
 * match); a custom comparator (`memo(C, areEqual)`) is exempt — it can ignore children.
 */
import { calleeName, lineOfNode, parse, ts, walk } from "../lib/ts-ast.mjs";

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

/** Same-file type declarations and function/const bindings by name. */
function indexFile(sf) {
  const t = ts();
  const types = new Map();
  const values = new Map();
  walk(sf, (n) => {
    if (t.isInterfaceDeclaration(n) || t.isTypeAliasDeclaration(n)) types.set(n.name.text, n);
    if (t.isFunctionDeclaration(n) && n.name) values.set(n.name.text, n);
    if (t.isVariableDeclaration(n) && t.isIdentifier(n.name) && n.initializer)
      values.set(n.name.text, n.initializer);
  });
  return { types, values };
}

/** The `children` member's type node in `members` (`true` when untyped), else null. */
function childrenMember(members) {
  const t = ts();
  const m = members.find(
    (x) =>
      t.isPropertySignature(x) && x.name && t.isIdentifier(x.name) && x.name.text === "children",
  );
  return m ? (m.type ?? true) : null;
}

/**
 * What `children` a props type declares: its type node, `true` (present, type unknown —
 * `PropsWithChildren`), or null (none found in this file).
 */
function childrenOf(node, idx, seen = new Set()) {
  const t = ts();
  if (!node) return null;
  if (t.isTypeLiteralNode(node)) return childrenMember(node.members);
  if (t.isIntersectionTypeNode(node) || t.isUnionTypeNode(node)) {
    for (const x of node.types) {
      const c = childrenOf(x, idx, seen);
      if (c) return c;
    }
    return null;
  }
  if (t.isParenthesizedTypeNode(node)) return childrenOf(node.type, idx, seen);
  if (t.isTypeReferenceNode(node) || t.isExpressionWithTypeArguments(node)) {
    const nameNode = t.isTypeReferenceNode(node) ? node.typeName : node.expression;
    const name = t.isIdentifier(nameNode)
      ? nameNode.text
      : t.isQualifiedName(nameNode)
        ? nameNode.right.text
        : t.isPropertyAccessExpression(nameNode)
          ? nameNode.name.text
          : "";
    if (name === "PropsWithChildren") return true;
    if (seen.has(name)) return null;
    seen.add(name);
    const decl = idx.types.get(name);
    if (!decl) return null;
    if (t.isTypeAliasDeclaration(decl)) return childrenOf(decl.type, idx, seen);
    const own = childrenMember(decl.members);
    if (own) return own;
    for (const h of decl.heritageClauses ?? [])
      for (const x of h.types) {
        const c = childrenOf(x, idx, seen);
        if (c) return c;
      }
  }
  return null;
}

/** `children: string` / `number` compare by value — memo still works. */
function isPrimitive(typeNode) {
  const t = ts();
  if (typeNode === true || !typeNode) return false;
  if (t.isUnionTypeNode(typeNode)) return typeNode.types.every(isPrimitive);
  if (t.isLiteralTypeNode(typeNode)) return true;
  return [
    t.SyntaxKind.StringKeyword,
    t.SyntaxKind.NumberKeyword,
    t.SyntaxKind.BooleanKeyword,
    t.SyntaxKind.UndefinedKeyword,
    t.SyntaxKind.NullKeyword,
  ].includes(typeNode.kind);
}

/** A declared, non-primitive `children` in this props type? */
function typeHasChildren(node, idx) {
  const c = childrenOf(node, idx);
  return Boolean(c) && !isPrimitive(c);
}

/** Does this component expression take (non-primitive) children? */
function takesChildren(expr, idx, seen = new Set()) {
  const t = ts();
  if (!expr) return false;
  if (t.isParenthesizedExpression(expr)) return takesChildren(expr.expression, idx, seen);
  if (t.isIdentifier(expr)) {
    if (seen.has(expr.text)) return false;
    seen.add(expr.text);
    return takesChildren(idx.values.get(expr.text), idx, seen);
  }
  if (t.isCallExpression(expr) && calleeName(expr) === "forwardRef") {
    const propsArg = expr.typeArguments?.[1];
    if (propsArg && typeHasChildren(propsArg, idx)) return true;
    return takesChildren(expr.arguments[0], idx, seen);
  }
  if (t.isFunctionDeclaration(expr) || t.isFunctionExpression(expr) || t.isArrowFunction(expr)) {
    const p = expr.parameters[0];
    if (!p) return false;
    const declared = childrenOf(p.type, idx);
    if (declared) return !isPrimitive(declared);
    // untyped here (e.g. `ComponentProps<typeof X>`), but the body reads `children`
    return (
      t.isObjectBindingPattern(p.name) &&
      p.name.elements.some(
        (e) => (e.propertyName ?? e.name).getText() === "children" && !e.dotDotDotToken,
      )
    );
  }
  return false;
}

export function scanText(file, text) {
  if (!/\bmemo\s*[(<]/.test(text)) return [];
  const sf = parse(file, text);
  const t = ts();
  const idx = indexFile(sf);
  const out = [];
  walk(sf, (n) => {
    if (!t.isCallExpression(n) || calleeName(n) !== "memo") return;
    if (
      t.isPropertyAccessExpression(n.expression) &&
      n.expression.expression.getText(sf) !== "React"
    )
      return;
    if (n.arguments.length !== 1) return; // custom comparator may ignore children
    const typeArg = n.typeArguments?.[0];
    if ((typeArg && typeHasChildren(typeArg, idx)) || takesChildren(n.arguments[0], idx)) {
      out.push({
        file,
        line: lineOfNode(sf, n),
        msg: "memo() wraps a component that takes `children` — inline children defeat the shallow compare; drop memo or memoise the children-free part",
      });
    }
  });
  return out;
}

const src = (body) => ({ files: { "packages/charts/src/charts/x.tsx": body } });

export default {
  id: "memo-on-children",
  scope: "components",
  doc: "Never wrap a component whose props include `children` in `memo`/`React.memo` — inline children defeat the shallow compare; memoise the children-free part instead.",
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob("packages/*/src/**/*.{ts,tsx}", { ignore: IGNORE })
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      src(`export const HeatmapCell = memo(function HeatmapCell({ cell }: HeatmapCellProps) {
  return <rect x={cell.x} />;
});
interface HeatmapCellProps { cell: Cell }`),
      src(`function DistributionBoxImpl({ data, scale }: { data: number[]; scale: Scale }) {
  return <g />;
}
export const DistributionBox = memo(DistributionBoxImpl);`),
      // custom comparator: exempt
      src(`const Row = memo(function Row({ children, id }: { children: ReactNode; id: string }) {
  return <tr>{children}</tr>;
}, (a, b) => a.id === b.id);`),
      src(`const useThing = () => useMemo(() => compute(), []);`),
      // real shape from shimmer.tsx: string children compare by value
      src(`export interface TextShimmerProps { children: string; duration?: number }
const ShimmerComponent = ({ children, duration = 2 }: TextShimmerProps) => <span>{children}</span>;
export const Shimmer = memo(ShimmerComponent);`),
    ],
    fail: [
      src(`export const ChartBrushLayout = memo(function ChartBrushLayout({
  children,
  height,
}: ChartBrushLayoutProps) {
  return <div style={{ height }}>{children}</div>;
});`),
      src(`interface BaseProps { children?: React.ReactNode }
interface FrameProps extends BaseProps { title: string }
function FrameImpl(props: FrameProps) { return <section>{props.children}</section>; }
export const Frame = React.memo(FrameImpl);`),
      src(`type Props = PropsWithChildren<{ tone: Tone }>;
export const Pill = memo(forwardRef<HTMLSpanElement, Props>(function Pill(props, ref) {
  return <span ref={ref}>{props.children}</span>;
}));`),
    ],
  },
};
