/**
 * dashboard-reuse — the dashboard sheet surface (`packages/charts/src/dashboard/`, ADR 0037)
 * composes `charts`/`ui`; it never re-authors primitives and never reaches sideways.
 * Mirrors process-reuse.mjs.
 *
 *   collision   — a local runtime declaration named like a ui/charts component (names the
 *                 manifest attributes to `dashboard/` itself are not collisions).
 *   raw-svg     — an authored `<svg|path|rect|circle|line|polygon|polyline|ellipse>`.
 *   sideways    — an import from data/ai/flow/maps/process/viewer/terminal/editor/marketing;
 *                 their content reaches a sheet only as a host-registered tile kind.
 *   core-engine — under `dashboard/core/`, any React, react-dom, `@dnd-kit/*`, zustand React
 *                 binding or `@elabs-ai/components-*` import (`zustand/vanilla` and
 *                 `zustand/middleware` are framework-free and allowed).
 * Per-line escape hatch: `// dashboard-reuse-exempt: <reason>` (reason required).
 * Scope: packages/charts/src/dashboard, not tests/stories.
 */
import { MANIFEST, localDeclarations, stripComments } from "./charts-reuse.mjs";

export const BASE_PACKAGES = ["@elabs-ai/components-ui", "@elabs-ai/components-charts"];
export const FORBIDDEN_PACKAGES = [
  "@elabs-ai/components-data",
  "@elabs-ai/components-ai",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-maps",
  "@elabs-ai/components-process",
  "@elabs-ai/components-viewer",
  "@elabs-ai/components-terminal",
  "@elabs-ai/components-editor",
  "@elabs-ai/components-marketing",
];
const RAW_SVG_ELEMENTS = [
  "svg",
  "path",
  "rect",
  "circle",
  "line",
  "polygon",
  "polyline",
  "ellipse",
];
const CORE_FORBIDDEN_PREFIXES = ["react", "react-dom", "@dnd-kit/", "@elabs-ai/components-"];
const CORE_ALLOWED_ZUSTAND = new Set([
  "zustand/vanilla",
  "zustand/middleware",
  "zustand/vanilla/shallow",
]);
const EXEMPT_RE = /\/\/\s*dashboard-reuse-exempt:\s*\S/;
const DASHBOARD_MODULE_RE = /(^|\/)packages\/charts\/src\/dashboard\//;

const lineAt = (src, index) => src.slice(0, index).split("\n").length;
const coreForbidden = (spec) =>
  spec === "zustand" || spec.startsWith("zustand/")
    ? !CORE_ALLOWED_ZUSTAND.has(spec)
    : CORE_FORBIDDEN_PREFIXES.some(
        (p) =>
          spec === p ||
          (p.endsWith("/") || p.endsWith("-") ? spec.startsWith(p) : spec.startsWith(`${p}/`)),
      );
const isCoreFile = (file) => /(^|\/)packages\/charts\/src\/dashboard\/core\//.test(file);

/**
 * ui + charts component names from the manifest → Map<name, pkg>; throws if missing. Components
 * whose `module` lives under `dashboard/` are the surface's own exports, not a collision target.
 */
export function baseComponentNames(ctx) {
  if (!ctx.exists(MANIFEST)) throw new Error(`${MANIFEST} not found — run \`pnpm gen\``);
  const manifest = ctx.json(MANIFEST);
  const names = new Map();
  for (const pkg of BASE_PACKAGES) {
    const info = manifest?.packages?.[pkg];
    if (!info) throw new Error(`${MANIFEST} is missing packages["${pkg}"] — run \`pnpm gen\``);
    for (const c of info.components ?? [])
      if (c?.name && !DASHBOARD_MODULE_RE.test(c.module ?? "") && !names.has(c.name))
        names.set(c.name, pkg);
  }
  return names;
}

/** Violations in one source string → `[{ kind, name, line, detail? }]`, sorted by line. */
export function findDashboardReuseViolations(src, baseNames, { isCore = false } = {}) {
  const exempt = new Set();
  src.split("\n").forEach((l, i) => EXEMPT_RE.test(l) && exempt.add(i + 1));
  const code = stripComments(src);
  const out = [];
  const seen = new Set();
  const add = (kind, name, index, detail) => {
    const line = lineAt(code, index);
    const key = `${kind}::${name}::${line}`;
    if (exempt.has(line) || seen.has(key)) return;
    seen.add(key);
    out.push({ kind, name, line, ...(detail ? { detail } : {}) });
  };
  const specifiers = [
    ...code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];

  for (const m of specifiers) {
    if (isCore && coreForbidden(m[1])) add("core-engine", m[1], m.index);
    const bad = FORBIDDEN_PACKAGES.find((p) => m[1] === p || m[1].startsWith(`${p}/`));
    if (bad) add("sideways", bad, m.index);
  }
  for (const m of code.matchAll(new RegExp(`<(${RAW_SVG_ELEMENTS.join("|")})(?=[\\s/>])`, "g")))
    add("raw-svg", m[1], m.index);
  for (const d of localDeclarations(code, baseNames))
    add("collision", d.name, d.index, baseNames.get(d.name));
  return out.sort((a, b) => a.line - b.line);
}

const MESSAGES = {
  collision: (v) =>
    `declares "${v.name}", which ${v.detail} already exports — compose it, or use a dashboard-scoped name`,
  "raw-svg": (v) =>
    `authors a raw <${v.name}> — marks belong to a @elabs-ai/components-charts family; compose it`,
  sideways: (v) =>
    `imports ${v.name} — dashboard/ may import only charts/ui/tokens/icons; register that content as a host tile kind (ADR 0037 §5)`,
  "core-engine": (v) =>
    `dashboard/core/ imports "${v.name}" — core is framework-free (only zustand/vanilla and zustand/middleware allowed)`,
};

// ── fixtures ─────────────────────────────────────────────────────────────────
const BASE = {
  "@elabs-ai/components-ui": [["Card"], ["Button"], ["SchemaForm"]],
  "@elabs-ai/components-charts": [
    ["ChartFrame"],
    ["AutoChart"],
    ["MetricCard"],
    ["DashboardSheet", "packages/charts/src/dashboard/dashboard-sheet/dashboard-sheet.tsx"],
  ],
};
const manifest = JSON.stringify({
  packages: Object.fromEntries(
    Object.entries(BASE).map(([p, names]) => [
      p,
      {
        components: names.map(([name, module = `packages/x/src/${name}.tsx`]) => ({
          name,
          module,
        })),
      },
    ]),
  ),
});
const src = (body, file = "packages/charts/src/dashboard/tiles/x.tsx") => ({
  files: { [MANIFEST]: manifest, [file]: body },
});
const core = (body) => src(body, "packages/charts/src/dashboard/core/store.ts");

export default {
  id: "dashboard-reuse",
  scope: "packages",
  doc: "In `@elabs-ai/components-charts/dashboard` (`packages/charts/src/dashboard/`, ADR 0037), compose charts/ui: no local component named like a ui/charts export, no raw SVG primitives, no data/ai/flow/maps/process/viewer/terminal/editor/marketing imports (host-registered tile kinds instead), and no React/dnd-kit/zustand-React/`@elabs-ai/components-*` import under `dashboard/core/`; exempt one line with `// dashboard-reuse-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    let baseNames;
    try {
      baseNames = baseComponentNames(ctx);
    } catch (err) {
      return [{ file: MANIFEST, line: 1, msg: err.message }];
    }
    const out = [];
    for (const file of ctx.glob("packages/charts/src/dashboard/**/*.{ts,tsx}", {
      ignore: ["**/*.test.{ts,tsx}", "**/*.stories.tsx", "**/{node_modules,dist}/**"],
    }))
      for (const v of findDashboardReuseViolations(ctx.readFile(file), baseNames, {
        isCore: isCoreFile(file),
      }))
        out.push({ file, line: v.line, msg: MESSAGES[v.kind](v) });
    return out;
  },
  fixtures: {
    pass: [
      src('import { Card, Button } from "@elabs-ai/components-ui";'),
      src('import { ChartFrame } from "../../chart-frame";'),
      src('import { AutoChart } from "@elabs-ai/components-charts";'),
      src('import { ThemeProvider } from "@elabs-ai/components-tokens";'),
      src('import { BrandLogo } from "@elabs-ai/components-icons";'),
      src('import { DndContext, useDraggable } from "@dnd-kit/core";'),
      src('import { useStore } from "zustand";'),
      src('import { useMemo } from "react";'),
      src("export function ChartTile() { return null; }"),
      src("export const MetricTile = () => null;"),
      src(
        "export interface CardProps { className?: string; }\nexport type ChartFrame = { id: string };",
      ),
      src("export function DashboardSheet() { return null; }"),
      src(
        "const X = () => <lineage />;\nconst Y = () => <Rectangle />;\nconst Z = () => <pathfinder />;",
      ),
      src(
        "// never author a <path> here\n/* a DataTable tile is host-registered */\nexport const X = 1;",
      ),
      src("const M = () => <rect x={0} />; // dashboard-reuse-exempt: resize-handle hit area"),
      src(
        'import { DataTable } from "@elabs-ai/components-data";',
        "packages/charts/src/dashboard/x.stories.tsx",
      ),
      src(
        'import { DataTable } from "@elabs-ai/components-data";',
        "packages/charts/src/dashboard/x.test.tsx",
      ),
      src(
        'import { DataTable } from "@elabs-ai/components-data";',
        "packages/charts/src/table/x.tsx",
      ),
      core(
        'import { createStore } from "zustand/vanilla";\nimport { subscribeWithSelector } from "zustand/middleware";',
      ),
      core('import type { GridSpec } from "./spec";\nexport { validateSpec } from "./validate";'),
      src(
        'export * from "./core";\n// Provider/Sheet/Tile/hooks — RM-074\n',
        "packages/charts/src/dashboard/index.ts",
      ),
      src(
        "// spec/validate/layout/expression — RM-070\nexport {};\n",
        "packages/charts/src/dashboard/core/index.ts",
      ),
    ],
    fail: [
      src('import { DataTable } from "@elabs-ai/components-data";'),
      ...FORBIDDEN_PACKAGES.map((p) => src(`import { X } from "${p}";`)),
      src('import { parseLog } from "@elabs-ai/components-process/core";'),
      src('import {\n  Terminal,\n  TerminalSurface,\n} from "@elabs-ai/components-terminal";'),
      src('const ChatTile = lazy(() => import("@elabs-ai/components-ai"));'),
      src('export { DataTable } from "@elabs-ai/components-data";'),
      src("export function Card() { return null; }"),
      src("export const ChartFrame = () => null;"),
      src("export default function MetricCard() { return null; }"),
      src('const M = () => <svg viewBox="0 0 8 8" />;'),
      src('const M = () => <path d="M0 0" />;'),
      src("const M = () => <rect x={0} />; // dashboard-reuse-exempt:"),
      core('import { useMemo } from "react";'),
      core('import type { ReactNode } from "react";'),
      core('import { createPortal } from "react-dom";'),
      core('import { DndContext } from "@dnd-kit/core";'),
      core('import { create } from "zustand";'),
      core('import { useStoreWithEqualityFn } from "zustand/traditional";'),
      core('import { cn } from "@elabs-ai/components-ui";'),
      core('import "react";'),
      { files: { "packages/charts/src/dashboard/x.tsx": "export const A = 1;" } },
    ],
  },
};
