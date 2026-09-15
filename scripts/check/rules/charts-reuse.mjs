/**
 * charts-reuse — `@elabs-ai/components-charts` never shadows a `@elabs-ai/components-ui`
 * component and never imports `@base-ui` (#168/#169). Ported from scripts/check-charts-reuse.mjs.
 *
 *   collision — a LOCAL runtime declaration (`export function|const|let|var|class`,
 *               `export default function`, `export default X` with a local decl) whose
 *               name is a `@elabs-ai/components-ui` component (from brand-ui.manifest.json).
 *               Type-only exports, imports and pass-through re-exports never flag.
 *   base-ui   — any import/re-export from `@base-ui/*` (value OR type).
 * Comments are stripped. Scope: packages/charts/src, not tests/stories.
 */
import { lineOf } from "../context.mjs";

export const MANIFEST = "brand-ui.manifest.json";

export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Component names of the given packages from the manifest → Map<name, pkg>; throws if missing. */
export function manifestComponentNames(ctx, packages) {
  if (!ctx.exists(MANIFEST)) throw new Error(`${MANIFEST} not found — run \`pnpm manifest\``);
  const manifest = ctx.json(MANIFEST);
  const names = new Map();
  for (const pkg of packages) {
    const info = manifest?.packages?.[pkg];
    if (!info) throw new Error(`${MANIFEST} is missing packages["${pkg}"] — run \`pnpm manifest\``);
    for (const c of info.components ?? [])
      if (c?.name && !names.has(c.name)) names.set(c.name, pkg);
  }
  return names;
}

/** Local runtime declarations whose name is in `names` → `[{ name, index, statement }]`. */
export function localDeclarations(code, names) {
  const out = [];
  for (const re of [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/g,
    /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
    /\bexport\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  ])
    for (const m of code.matchAll(re))
      if (names.has(m[1])) out.push({ name: m[1], index: m.index, statement: m[0] });
  for (const m of code.matchAll(/\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[;\n]/g)) {
    if (!names.has(m[1])) continue;
    const localDecl = new RegExp(
      `(?:^|[\\n;])\\s*(?:(?:export|async)\\s+)*(?:function|const|let|var|class)\\s+${m[1]}\\b`,
    );
    if (localDecl.test(code)) out.push({ name: m[1], index: m.index, statement: m[0] });
  }
  return out;
}

/** Violations in one source string → `[{ kind, name, index }]` (deduped). */
export function findChartsReuseViolations(src, uiNames) {
  const code = stripComments(src);
  const out = [];
  const seen = new Set();
  const add = (kind, name, index, statement) => {
    const key = `${kind}::${name}::${statement.replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, name, index });
  };
  for (const m of code.matchAll(
    /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"](@base-ui\/[^'"]+)['"]/g,
  ))
    add("base-ui", m[1], m.index, m[0]);
  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"](@base-ui\/[^'"]+)['"]/g))
    add("base-ui", m[1], m.index, m[0]);
  for (const d of localDeclarations(code, uiNames)) add("collision", d.name, d.index, d.statement);
  return out.map((v) => ({ ...v, code }));
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const UI = ["Card", "Button", "Tooltip", "TooltipContent", "Table", "Progress", "Separator"];
const manifest = JSON.stringify({
  packages: { "@elabs-ai/components-ui": { components: UI.map((name) => ({ name })) } },
});
const src = (body, file = "packages/charts/src/x.tsx") => ({
  files: { [MANIFEST]: manifest, [file]: body },
});

export default {
  id: "charts-reuse",
  scope: "packages",
  doc: "In `@elabs-ai/components-charts`, never declare a runtime export named like a `@elabs-ai/components-ui` component (use a chart-scoped name such as `ChartTooltipContent`) and never import `@base-ui/*`.",
  baseline: "none",
  run(ctx) {
    let uiNames;
    try {
      uiNames = manifestComponentNames(ctx, ["@elabs-ai/components-ui"]);
    } catch (err) {
      return [{ file: MANIFEST, line: 1, msg: err.message }];
    }
    const out = [];
    for (const file of ctx.glob("packages/charts/src/**/*.{ts,tsx}", {
      ignore: ["**/*.test.{ts,tsx}", "**/*.stories.tsx", "**/{node_modules,dist}/**"],
    }))
      for (const v of findChartsReuseViolations(ctx.readFile(file), uiNames))
        out.push({
          file,
          line: lineOf(v.code, v.index),
          msg:
            v.kind === "collision"
              ? `declares "${v.name}", which collides with @elabs-ai/components-ui — rename to a chart-scoped name`
              : `imports from ${v.name} — charts must have zero @base-ui usage`,
        });
    return out;
  },
  fixtures: {
    pass: [
      src('import { Card, Table, TooltipContent } from "@elabs-ai/components-ui";'),
      src('export { Card } from "@elabs-ai/components-ui";'),
      src('import { Table as TableIcon } from "lucide-react";'),
      src("export function MarkerTooltipContent() { return null; }"),
      src("export function ChartTooltipContent() { return null; }"),
      src('// dropped @base-ui Progress\n/* import { Card } from "@elabs-ai/components-ui" */'),
      src("export interface CardProps { className?: string; }"),
      src("export type ButtonProps = { onClick?: () => void; };"),
      src('import { Card } from "@elabs-ai/components-ui";\nexport default Card;\n'),
      src(
        'import { useSpring } from "motion/react";\nimport { something } from "base-ui-lookalike";',
      ),
      src("export function Card() { return null; }", "packages/charts/src/x.test.tsx"),
      src("export function Card() { return null; }", "packages/charts/src/x.stories.tsx"),
    ],
    fail: [
      src("export function TooltipContent() { return null; }"),
      src("export const Card = () => null;"),
      src("export class Button {}"),
      src("export default function Tooltip() { return null; }"),
      src("function Card() { return null; }\nexport default Card;\n"),
      src('import { Foo } from "@base-ui/react";'),
      src('import { x } from "@base-ui/something";'),
      src('import type { Foo } from "@base-ui/react";'),
      src('import "@base-ui/react";'),
      { files: { "packages/charts/src/x.tsx": "export const A = 1;" } }, // no manifest → throws
    ],
  },
};
