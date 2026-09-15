/**
 * process-reuse — `@elabs-ai/components-process` (the one layer-3 package, ADR 0034)
 * composes; it never re-authors primitives. Ported from scripts/check-process-reuse.mjs.
 *
 *   collision   — a local runtime declaration named like a ui/flow/charts/data component.
 *   raw-svg     — an authored `<svg|path|rect|circle|line|polygon|polyline|ellipse>`.
 *   engine      — a VALUE import from `@xyflow/react` of a primitive flow already wraps.
 *   sideways    — an import from ai/maps/marketing/editor/viewer/terminal.
 *   core-engine — under `src/core/`, any React/React Flow/visx/d3/motion/brand import.
 * Per-line escape hatch: `// process-reuse-exempt: <reason>` (reason required).
 * Scope: packages/process/src, not tests/stories.
 */
import {
  MANIFEST,
  localDeclarations,
  manifestComponentNames,
  stripComments,
} from "./charts-reuse.mjs";

export const BASE_PACKAGES = [
  "@elabs-ai/components-ui",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-charts",
  "@elabs-ai/components-data",
];
export const FORBIDDEN_PACKAGES = [
  "@elabs-ai/components-ai",
  "@elabs-ai/components-maps",
  "@elabs-ai/components-marketing",
  "@elabs-ai/components-editor",
  "@elabs-ai/components-viewer",
  "@elabs-ai/components-terminal",
];
export const WRAPPED_XYFLOW_PRIMITIVES = new Set([
  "ReactFlow",
  "ReactFlowProvider",
  "Background",
  "BaseEdge",
  "Controls",
  "ControlButton",
  "MiniMap",
  "Handle",
  "NodeResizer",
  "NodeToolbar",
  "Panel",
]);
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
const CORE_FORBIDDEN_PREFIXES = [
  "react",
  "react-dom",
  "@xyflow/react",
  "@visx/",
  "d3",
  "d3-",
  "motion",
  "@elabs-ai/components-",
];
const EXEMPT_RE = /\/\/\s*process-reuse-exempt:\s*\S/;

const lineAt = (src, index) => src.slice(0, index).split("\n").length;
const coreForbidden = (spec) =>
  CORE_FORBIDDEN_PREFIXES.some((p) => spec === p || spec.startsWith(p) || spec.startsWith(`${p}/`));
const isCoreFile = (file) => /(^|\/)packages\/process\/src\/core\//.test(file);

/** Violations in one source string → `[{ kind, name, line, detail? }]`, sorted by line. */
export function findProcessReuseViolations(src, baseNames, { isCore = false } = {}) {
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
  const fromRe = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;

  if (isCore) {
    for (const m of code.matchAll(fromRe))
      if (coreForbidden(m[1])) add("core-engine", m[1], m.index);
    for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g))
      if (coreForbidden(m[1])) add("core-engine", m[1], m.index);
  }
  for (const m of code.matchAll(fromRe)) {
    const bad = FORBIDDEN_PACKAGES.find((p) => m[1] === p || m[1].startsWith(`${p}/`));
    if (bad) add("sideways", bad, m.index);
  }
  for (const m of code.matchAll(
    /\bimport\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]@xyflow\/react['"]/g,
  )) {
    if (m[1]) continue;
    for (const raw of m[2].split(",")) {
      const spec = raw.trim();
      if (!spec || spec.startsWith("type ")) continue;
      const imported = spec.split(/\s+as\s+/)[0].trim();
      if (WRAPPED_XYFLOW_PRIMITIVES.has(imported)) add("engine", imported, m.index);
    }
  }
  for (const m of code.matchAll(new RegExp(`<(${RAW_SVG_ELEMENTS.join("|")})(?=[\\s/>])`, "g")))
    add("raw-svg", m[1], m.index);
  for (const d of localDeclarations(code, baseNames))
    add("collision", d.name, d.index, baseNames.get(d.name));
  return out.sort((a, b) => a.line - b.line);
}

const MESSAGES = {
  collision: (v) =>
    `declares "${v.name}", which ${v.detail} already exports — use a process-scoped name`,
  "raw-svg": (v) =>
    `authors a raw <${v.name}> — a mark belongs in @elabs-ai/components-charts, a graph edge in @elabs-ai/components-flow`,
  engine: (v) =>
    `imports "${v.name}" from @xyflow/react — @elabs-ai/components-flow already wraps it (or add the wrapper to flow)`,
  sideways: (v) => `imports ${v.name} — a layer-2 leaf @elabs-ai/components-process may not reach`,
  "core-engine": (v) => `src/core/ imports "${v.name}" — /core is the framework-free subpath`,
};

// ── fixtures ─────────────────────────────────────────────────────────────────
const BASE = {
  "@elabs-ai/components-ui": ["Card", "Button", "Slider"],
  "@elabs-ai/components-data": ["DataTable", "FilterBar"],
  "@elabs-ai/components-flow": ["CanvasShell", "FlowNode"],
  "@elabs-ai/components-charts": ["ChartFrame", "MetricCard"],
};
const manifest = JSON.stringify({
  packages: Object.fromEntries(
    Object.entries(BASE).map(([p, names]) => [p, { components: names.map((name) => ({ name })) }]),
  ),
});
const src = (body, file = "packages/process/src/process-map/x.tsx") => ({
  files: { [MANIFEST]: manifest, [file]: body },
});
const core = (body) => src(body, "packages/process/src/core/derive.ts");

export default {
  id: "process-reuse",
  scope: "packages",
  doc: "In `@elabs-ai/components-process` (layer 3), compose base packages: no local component named like a ui/flow/charts/data export, no raw SVG primitives, no `@xyflow/react` primitive flow wraps, no ai/maps/marketing/editor/viewer/terminal imports, and no engine or React import under `src/core/`; exempt one line with `// process-reuse-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    let baseNames;
    try {
      baseNames = manifestComponentNames(ctx, BASE_PACKAGES);
    } catch (err) {
      return [{ file: MANIFEST, line: 1, msg: err.message }];
    }
    const out = [];
    for (const file of ctx.glob("packages/process/src/**/*.{ts,tsx}", {
      ignore: ["**/*.test.{ts,tsx}", "**/*.stories.tsx", "**/{node_modules,dist}/**"],
    }))
      for (const v of findProcessReuseViolations(ctx.readFile(file), baseNames, {
        isCore: isCoreFile(file),
      }))
        out.push({ file, line: v.line, msg: MESSAGES[v.kind](v) });
    return out;
  },
  fixtures: {
    pass: [
      src('import { Card, DataTable } from "@elabs-ai/components-ui";'),
      src('export { CanvasShell } from "@elabs-ai/components-flow";'),
      src("export function ProcessMapCard() { return null; }"),
      src("export const VariantExplorerTable = () => null;"),
      src(
        "export interface CardProps { className?: string; }\nexport type DataTable = { rows: number };",
      ),
      src('import { Card } from "@elabs-ai/components-ui";\nexport default Card;\n'),
      src(
        "const X = () => <lineage />;\nconst Y = () => <Rectangle />;\nconst Z = () => <pathfinder />;",
      ),
      src("// never author a <path> here\n/* <svg> belongs in charts */\nexport const X = 1;"),
      src('import { useReactFlow, useNodesState } from "@xyflow/react";'),
      src('import type { EdgeProps, Node } from "@xyflow/react";'),
      src('import { type BaseEdge } from "@xyflow/react";'),
      src('import { Background, MiniMap } from "@elabs-ai/components-flow";'),
      ...BASE_PACKAGES.map((p) => src(`import { Thing } from "${p}";`)),
      src('import { ThemeProvider } from "@elabs-ai/components-tokens";'),
      core('import { derive } from "./derive-graph";\nexport type { EventLog } from "./types";'),
      src('import { useMemo } from "react";'),
      src('import { useMemo } from "react";', "packages/process/src/core-views/x.tsx"),
      src('const M = () => <path d="M0 0" />; // process-reuse-exempt: measured glyph'),
      src("export function Card() { return <svg />; }", "packages/process/src/x.test.tsx"),
      src(`import { CanvasShell } from "@elabs-ai/components-flow";
import { ChartFrame } from "@elabs-ai/components-charts";
import { deriveDirectlyFollows } from "./core";
export interface ProcessMapProps { log: unknown[] }
export function ProcessMap({ log }: ProcessMapProps) {
  return <CanvasShell>{String(deriveDirectlyFollows)}</CanvasShell>;
}
`),
    ],
    fail: [
      src("export function Card() { return null; }"),
      src("export const DataTable = () => null;"),
      src("export class FlowNode {}"),
      src("export default function ChartFrame() { return null; }"),
      src("function Card() { return null; }\nexport default Card;\n"),
      src('const M = () => <svg viewBox="0 0 8 8" />;'),
      src("const M = () => <rect x={0} />;"),
      src('const M = () => <path d="M0 0" />; // process-reuse-exempt:'),
      ...[...WRAPPED_XYFLOW_PRIMITIVES].map((n) => src(`import { ${n} } from "@xyflow/react";`)),
      src('import { MiniMap as Mini } from "@xyflow/react";'),
      ...FORBIDDEN_PACKAGES.map((p) => src(`import { X } from "${p}";`)),
      src('import { p } from "@elabs-ai/components-editor/markdown";'),
      src('import {\n  Terminal,\n  TerminalSurface,\n} from "@elabs-ai/components-terminal";'),
      core('import { useMemo } from "react";'),
      core('import { scaleLinear } from "d3-scale";'),
      core('import { Group } from "@visx/group";'),
      core('import { cn } from "@elabs-ai/components-ui";'),
      core('import "d3-shape";'),
      { files: { "packages/process/src/x.tsx": "export const A = 1;" } },
    ],
  },
};
