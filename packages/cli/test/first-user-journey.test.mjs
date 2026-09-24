// 2026-09-21 new-user test (docs/review/2026-09-21-first-user-journey-review.md),
// wave 1: the hand-offs a first user hit inside the CLI. Each test is one finding.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiFallbackPath,
  declaringModule,
  extractPropTable,
  findRepoRoot,
  flat,
  loadManifest,
  resolveDocsHit,
} from "../lib/core.mjs";

const BIN = fileURLToPath(new URL("../bin/brand-ui.mjs", import.meta.url));
const BUNDLE_ASSETS = fileURLToPath(new URL("../scripts/bundle-assets.mjs", import.meta.url));
const repoRoot = findRepoRoot(fileURLToPath(import.meta.url));
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });

before(() => {
  if (!repoRoot) return;
  const r = spawnSync(process.execPath, [BUNDLE_ASSETS], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

// Finding 8 — `docs MetricCard` answered with the charts RE-EXPORT (no props).
test("resolveDocsHit: the owner package wins over a re-export, and pkg/Name picks one", () => {
  const rows = [
    {
      name: "MetricCard",
      pkg: "@elabs-ai/components-charts",
      module: "charts/metric-card/index.ts",
    },
    {
      name: "MetricCard",
      pkg: "@elabs-ai/components-ui",
      module: "ui/metric-card.tsx",
      props: { extends: [], props: [{ name: "label" }] },
    },
    { name: "MetricCard", pkg: "@elabs-ai/components-editor", module: "editor/x.ts" },
  ];
  const { hit, alternatives } = resolveDocsHit(rows, "metriccard");
  assert.equal(hit.pkg, "@elabs-ai/components-ui");
  assert.deepEqual(alternatives, ["@elabs-ai/components-charts", "@elabs-ai/components-editor"]);
  assert.equal(resolveDocsHit(rows, "charts/MetricCard").hit.pkg, "@elabs-ai/components-charts");
  assert.equal(
    resolveDocsHit(rows, "@elabs-ai/components-editor/MetricCard").hit.pkg,
    "@elabs-ai/components-editor",
  );
  assert.equal(
    resolveDocsHit(rows, "maps/MetricCard").hit,
    null,
    "named package that lacks it → none",
  );
  assert.equal(resolveDocsHit(rows, "Nope").hit, null);
});

// Finding 7 — `docs Text` resolved to editor's prose Text, not ui's typography.
test("resolveDocsHit: with no recorded API on either side, dependency order decides (ui before editor)", () => {
  const rows = [
    {
      name: "Text",
      pkg: "@elabs-ai/components-editor",
      module: "e",
      importPath: "@elabs-ai/components-editor/markdown",
    },
    { name: "Text", pkg: "@elabs-ai/components-ui", module: "u" },
  ];
  assert.equal(resolveDocsHit(rows, "Text").hit.pkg, "@elabs-ai/components-ui");
});

// Finding 8 — the fallback line printed a monorepo path a consumer cannot open.
test("apiFallbackPath: a consumer gets the installed .d.ts, the monorepo gets the source", () => {
  const hit = {
    name: "ToggleGroup",
    pkg: "@elabs-ai/components-ui",
    module: "packages/ui/src/x.tsx",
  };
  assert.equal(apiFallbackPath(hit, "/repo"), "packages/ui/src/x.tsx");
  assert.match(
    apiFallbackPath(hit, null),
    /^node_modules\/@elabs-ai\/components-ui\/dist\/index\.d\.ts/,
  );
  assert.match(apiFallbackPath(hit, null), /ToggleGroupProps/);
  const sub = {
    ...hit,
    importPath: "@elabs-ai/components-editor/markdown",
    pkg: "@elabs-ai/components-editor",
  };
  assert.match(apiFallbackPath(sub, null), /components-editor\/dist\/markdown\/index\.d\.ts/);
});

// Finding 21 — `docs HeatmapChart --brief` printed no props: the props live in the
// file the directory barrel re-exports from.
test("declaringModule: follows a barrel's re-export to the declaring file", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  assert.equal(
    declaringModule(repoRoot, "packages/charts/src/charts/heatmap/index.ts", "HeatmapChart"),
    "packages/charts/src/charts/heatmap/heatmap-chart.tsx",
  );
  assert.equal(
    declaringModule(
      repoRoot,
      "packages/charts/src/charts/annotations/index.ts",
      "ChartAnnotations",
    ),
    "packages/charts/src/charts/annotations/chart-annotations.tsx",
  );
  // A barrel that re-exports from ANOTHER package stays where it is.
  assert.equal(
    declaringModule(repoRoot, "packages/charts/src/metric-card/index.ts", "MetricCard"),
    "packages/charts/src/metric-card/index.ts",
  );
});

// Finding 21 — `annotations` was missing from LineChart: a second
// `export interface LineChartProps` block (declaration merging) was never read.
test("extractPropTable: merges a second interface declaration of the same name", () => {
  const src = `
export interface XProps extends Base {
  /** first */
  a?: string;
}
const X = () => null;
export interface XProps {
  /** second */
  b?: number;
}
`;
  const table = extractPropTable(src, "X");
  assert.deepEqual(table.extends, ["Base"]);
  assert.deepEqual(
    table.props.map((p) => p.name),
    ["a", "b"],
  );
});

test("manifest: the first-screen components record an API (no dead ends)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const rows = flat(loadManifest(repoRoot));
  for (const name of [
    "MetricCard",
    "ChartTooltip",
    "ToggleGroup",
    "Toaster",
    "HeatmapChart",
    "ChartAnnotations",
    "ChartFrame",
    "LineChart",
    "Text",
    "Heading",
  ]) {
    const { hit } = resolveDocsHit(rows, name);
    assert.ok(hit, `${name} found`);
    const api = hit.props?.props?.length || hit.props?.extends?.length || hit.variants;
    assert.ok(api, `${name} (${hit.pkg}) records props, extends or variants`);
  }
  const line = resolveDocsHit(rows, "LineChart").hit;
  assert.ok(
    line.props.props.some((p) => p.name === "annotations"),
    "LineChart lists annotations",
  );
});

// Finding 11 — `create --title` reached <title> and CLAUDE.md but not the app.
test("create --title: the sidebar brand slot shows the title", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-journey-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // With the default (flagship) shell the brand slot is the shell's
  // `productName`; with `--shell minimal` it is the template's own slot.
  for (const [template, shell, marker] of [
    ["dashboard", "flagship", /productName=\{"Foresight"\}/],
    ["dashboard", "minimal", /font-semibold[^>]*>\s*Foresight\s*<\/span>/],
    ["settings", "minimal", /<SidebarHeader[^>]*>Foresight<\/SidebarHeader>/],
  ]) {
    const target = `${template}-${shell}`;
    const r = run(
      ["create", target, "--template", template, "--shell", shell, "--title", "Foresight"],
      dir,
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const app = readFileSync(join(dir, target, "src/App.tsx"), "utf8");
    assert.match(app, marker, `${template}/${shell}: title in the brand slot`);
    assert.doesNotMatch(
      app,
      />\s*Analytics\s*<\/span>/,
      `${template}/${shell}: no template name left in the slot`,
    );
  }
  // Finding 6 — the generated CLAUDE.md no longer argues against brand themes.
  const claude = readFileSync(join(dir, "dashboard-flagship", "CLAUDE.md"), "utf8");
  assert.doesNotMatch(claude, /Two shipped themes/);
  assert.doesNotMatch(claude, /Don't touch the theme mechanism/);
  assert.match(claude, /themes\/<family>\//);
});
