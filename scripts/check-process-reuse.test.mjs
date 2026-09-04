/**
 * check-process-reuse.test.mjs — locks the RM-048 (#223) process reuse-audit gate.
 * Run in CI: `node --test scripts/check-process-reuse.test.mjs` (`pnpm process:reuse:check:test`).
 *
 * All fixtures are INLINE strings (hermetic — never real files), so the self-test keeps
 * passing when the package is empty AND when wave-1 fills it.
 *
 * A gate that can silently stop firing is worse than none: every rung has a
 * must-FLAG case AND a must-NOT-flag case, plus the escape hatch and the
 * comment-stripping behaviour.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findProcessReuseViolations,
  isCoreFile,
  exemptLines,
  BASE_PACKAGES,
  FORBIDDEN_PACKAGES,
  WRAPPED_XYFLOW_PRIMITIVES,
} from "./check-process-reuse.mjs";

/** Hermetic base-package name map — the shape `loadBaseNames()` returns. */
const baseNames = new Map([
  ["Card", "@elabs-ai/components-ui"],
  ["Button", "@elabs-ai/components-ui"],
  ["Slider", "@elabs-ai/components-ui"],
  ["DataTable", "@elabs-ai/components-data"],
  ["FilterBar", "@elabs-ai/components-data"],
  ["CanvasShell", "@elabs-ai/components-flow"],
  ["FlowNode", "@elabs-ai/components-flow"],
  ["ChartFrame", "@elabs-ai/components-charts"],
  ["MetricCard", "@elabs-ai/components-charts"],
]);

const find = (src, opts) => findProcessReuseViolations(src, baseNames, opts);
const kinds = (src, opts) => find(src, opts).map((v) => v.kind);
const isClean = (src, opts) => find(src, opts).length === 0;
const flags = (src, kind, opts) => kinds(src, opts).includes(kind);

// ── Rung 1: base-package name collision ──────────────────────────────────────

test("FLAGS: export function with a ui-owned name", () => {
  assert.ok(flags(`export function Card() { return null; }`, "collision"));
});

test("FLAGS: export const with a data-owned name", () => {
  assert.ok(flags(`export const DataTable = () => null;`, "collision"));
});

test("FLAGS: export class with a flow-owned name", () => {
  assert.ok(flags(`export class FlowNode {}`, "collision"));
});

test("FLAGS: export default function with a charts-owned name", () => {
  assert.ok(flags(`export default function ChartFrame() { return null; }`, "collision"));
});

test("FLAGS: export default bare identifier backed by a local declaration", () => {
  assert.ok(flags(`function Card() { return null; }\nexport default Card;\n`, "collision"));
});

test("the collision message names the OWNING base package", () => {
  const [v] = find(`export const FilterBar = () => null;`);
  assert.equal(v.kind, "collision");
  assert.equal(v.detail, "@elabs-ai/components-data");
});

test("DOES NOT FLAG: importing or re-exporting a base-package component", () => {
  assert.ok(isClean(`import { Card, DataTable } from "@elabs-ai/components-ui";`));
  assert.ok(isClean(`export { CanvasShell } from "@elabs-ai/components-flow";`));
});

test("DOES NOT FLAG: a process-scoped name", () => {
  assert.ok(isClean(`export function ProcessMapCard() { return null; }`));
  assert.ok(isClean(`export const VariantExplorerTable = () => null;`));
});

test("DOES NOT FLAG: a type-only export sharing a base-package name", () => {
  assert.ok(isClean(`export interface CardProps { className?: string; }`));
  assert.ok(isClean(`export type DataTable = { rows: number };`));
});

test("DOES NOT FLAG: export default of an IMPORTED base component", () => {
  assert.ok(isClean(`import { Card } from "@elabs-ai/components-ui";\nexport default Card;\n`));
});

// ── Rung 2: raw SVG primitives ───────────────────────────────────────────────

test("FLAGS: an authored <svg> / <path> / <rect> / <circle>", () => {
  assert.ok(flags(`const M = () => <svg viewBox="0 0 8 8" />;`, "raw-svg"));
  assert.ok(flags(`const M = () => <path d="M0 0" />;`, "raw-svg"));
  assert.ok(flags(`const M = () => <rect x={0} />;`, "raw-svg"));
  assert.ok(flags(`const M = () => <circle cx={1} />;`, "raw-svg"));
});

test("DOES NOT FLAG: an element whose name merely STARTS with an svg tag name", () => {
  // `<lineage>` / `<Rectangle>` are not `<line>` / `<rect>`.
  assert.ok(isClean(`const X = () => <lineage />;`));
  assert.ok(isClean(`const X = () => <Rectangle />;`));
  assert.ok(isClean(`const X = () => <pathfinder />;`));
});

test("DOES NOT FLAG: an SVG tag named only in a comment", () => {
  assert.ok(isClean(`// never author a <path> here\nexport const X = 1;`));
  assert.ok(isClean(`/* <svg> belongs in charts */\nexport const Y = 2;`));
});

// ── Rung 3: unwrapped @xyflow/react primitives ───────────────────────────────

test("FLAGS: importing a @xyflow/react primitive flow already wraps", () => {
  assert.ok(flags(`import { ReactFlow } from "@xyflow/react";`, "engine"));
  assert.ok(flags(`import { Background, BaseEdge } from "@xyflow/react";`, "engine"));
});

test("FLAGS: the wrapped primitive even when aliased", () => {
  assert.ok(flags(`import { MiniMap as Mini } from "@xyflow/react";`, "engine"));
});

test("DOES NOT FLAG: @xyflow/react hooks and types", () => {
  assert.ok(isClean(`import { useReactFlow, useNodesState } from "@xyflow/react";`));
  assert.ok(isClean(`import type { EdgeProps, Node } from "@xyflow/react";`));
  assert.ok(isClean(`import { type BaseEdge } from "@xyflow/react";`));
});

test("DOES NOT FLAG: the same names imported from @elabs-ai/components-flow", () => {
  assert.ok(isClean(`import { Background, MiniMap } from "@elabs-ai/components-flow";`));
});

test("every wrapped primitive in the set is actually flagged", () => {
  for (const name of WRAPPED_XYFLOW_PRIMITIVES) {
    assert.ok(
      flags(`import { ${name} } from "@xyflow/react";`, "engine"),
      `${name} should be flagged`,
    );
  }
});

// ── Rung 4: sideways imports ─────────────────────────────────────────────────

test("FLAGS: importing a forbidden layer-2 leaf", () => {
  for (const pkg of FORBIDDEN_PACKAGES) {
    assert.ok(flags(`import { X } from "${pkg}";`, "sideways"), `${pkg} should be flagged`);
  }
});

test("FLAGS: a sideways import via a subpath", () => {
  assert.ok(flags(`import { p } from "@elabs-ai/components-editor/markdown";`, "sideways"));
});

test("DOES NOT FLAG: the four allowed base packages", () => {
  for (const pkg of BASE_PACKAGES) {
    assert.ok(isClean(`import { Thing } from "${pkg}";`), `${pkg} should be allowed`);
  }
  assert.ok(isClean(`import { ThemeProvider } from "@elabs-ai/components-tokens";`));
  assert.ok(isClean(`import { Icon } from "@elabs-ai/components-icons";`));
});

test("FLAGS: a multi-line sideways import list", () => {
  const src = `import {\n  Terminal,\n  TerminalSurface,\n} from "@elabs-ai/components-terminal";`;
  assert.ok(flags(src, "sideways"));
});

// ── Rung 5: /core stays framework-free ───────────────────────────────────────

test("FLAGS: React in a /core module", () => {
  assert.ok(flags(`import { useMemo } from "react";`, "core-engine", { isCore: true }));
});

test("FLAGS: an engine or a brand package in a /core module", () => {
  const core = { isCore: true };
  assert.ok(flags(`import { ReactFlow } from "@xyflow/react";`, "core-engine", core));
  assert.ok(flags(`import { scaleLinear } from "d3-scale";`, "core-engine", core));
  assert.ok(flags(`import { Group } from "@visx/group";`, "core-engine", core));
  assert.ok(flags(`import { cn } from "@elabs-ai/components-ui";`, "core-engine", core));
});

test("FLAGS: a side-effect engine import in a /core module", () => {
  assert.ok(flags(`import "d3-shape";`, "core-engine", { isCore: true }));
});

test("DOES NOT FLAG: pure node/relative imports in a /core module", () => {
  const core = { isCore: true };
  assert.ok(isClean(`import { derive } from "./derive-graph";`, core));
  assert.ok(isClean(`export type { EventLog } from "./types";`, core));
});

test("the /core rung is INERT outside /core", () => {
  // The same React import is fine in the React half of the package.
  assert.ok(isClean(`import { useMemo } from "react";`));
});

test("isCoreFile recognises the core subtree and nothing else", () => {
  assert.ok(isCoreFile("packages/process/src/core/derive.ts"));
  assert.ok(isCoreFile("/abs/repo/packages/process/src/core/nested/derive.ts"));
  assert.ok(!isCoreFile("packages/process/src/process-map/process-map.tsx"));
  assert.ok(!isCoreFile("packages/process/src/core-views/x.tsx"));
});

// ── Escape hatch ─────────────────────────────────────────────────────────────

test("the per-line escape hatch suppresses a finding on THAT line only", () => {
  const exempted = `const M = () => <path d="M0 0" />; // process-reuse-exempt: measured glyph`;
  assert.ok(isClean(exempted));
  const notExempted = `const M = () => <path d="M0 0" />;\nconst N = () => <rect />;`;
  assert.equal(find(notExempted).length, 2);
});

test("the escape hatch REQUIRES a reason", () => {
  assert.ok(flags(`const M = () => <path d="M0 0" />; // process-reuse-exempt:`, "raw-svg"));
});

test("exemptLines reports 1-based line numbers", () => {
  const src = `const a = 1;\nconst b = 2; // process-reuse-exempt: why\nconst c = 3;`;
  assert.deepEqual([...exemptLines(src)], [2]);
});

// ── Reporting shape ──────────────────────────────────────────────────────────

test("every finding carries a 1-based line number", () => {
  const src = `import { Card } from "@elabs-ai/components-ui";\n\nexport const DataTable = () => null;`;
  const [v] = find(src);
  assert.equal(v.kind, "collision");
  assert.equal(v.line, 3);
});

test("a clean layer-3 composition produces no findings at all", () => {
  const src = `import { CanvasShell } from "@elabs-ai/components-flow";
import { ChartFrame } from "@elabs-ai/components-charts";
import { DataTable } from "@elabs-ai/components-data";
import { Card } from "@elabs-ai/components-ui";
import { deriveDirectlyFollows } from "./core";

export interface ProcessMapProps { log: unknown[] }

export function ProcessMap({ log }: ProcessMapProps) {
  return <CanvasShell>{String(deriveDirectlyFollows)}</CanvasShell>;
}
`;
  assert.deepEqual(find(src), []);
});

// ── End-to-end: the CLI really exits non-zero on a planted fixture ───────────
//
// The tests above drive the pure function. This one drives the SCRIPT, because a
// gate whose CLI wiring rots (a bad exit code, a swallowed finding, an unreadable
// manifest) is a gate that has silently stopped firing.

test("CLI: a planted violation exits 1; the same file exempted exits 0", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const gate = join(scriptDir, "check-process-reuse.mjs");
  const dir = mkdtempSync(join(tmpdir(), "process-reuse-"));
  try {
    const bad = join(dir, "bad.tsx");
    writeFileSync(bad, `export function Card() { return <svg />; }\n`);
    const fail = spawnSync(process.execPath, [gate, "--file", bad], { encoding: "utf8" });
    assert.equal(fail.status, 1, "a planted violation must fail the gate");
    assert.match(fail.stderr, /process-reuse gate FAILED/);

    const warn = spawnSync(process.execPath, [gate, "--file", bad, "--warn"], {
      encoding: "utf8",
    });
    assert.equal(warn.status, 0, "--warn must never exit non-zero");

    const good = join(dir, "good.tsx");
    writeFileSync(good, `export function ProcessMapCard() { return null; }\n`);
    const pass = spawnSync(process.execPath, [gate, "--file", good], { encoding: "utf8" });
    assert.equal(pass.status, 0, "a clean file must pass");
    assert.match(pass.stdout, /✔ process-reuse/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
