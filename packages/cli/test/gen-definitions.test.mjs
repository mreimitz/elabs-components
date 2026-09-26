/**
 * gen-definitions.test.mjs — the definitions snapshot and the chart codemod map (ADR 0042 §7,
 * RM-178). The `definitions` step of `pnpm gen` writes both; `pnpm gen:check` keeps the
 * committed files fresh. This file locks what they must hold and how they are built.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { planCodemod } from "../lib/engine.mjs";
import { loadManifest } from "../lib/core.mjs";
import {
  CHART_CODEMOD_MAP_PATH,
  DEFINITIONS_PATH,
  DEFINITION_SOURCES,
  canonical,
  codemodMapFrom,
  componentProse,
  docSummary,
  loadRegistry,
  renderDefinitionArtifacts,
} from "../scripts/gen-definitions.mjs";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(PKG_DIR, "..", "..");
const CHARTS = "@elabs-ai/components-charts";

const readJson = (rel) => JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));

test("snapshot: keyed by package, holding every chart, part and surface definition", async () => {
  const snapshot = readJson(DEFINITIONS_PATH);
  assert.deepEqual(
    Object.keys(snapshot),
    DEFINITION_SOURCES.map((s) => s.pkg),
  );
  const entries = snapshot[CHARTS];
  const registry = await loadRegistry(DEFINITION_SOURCES[0]);
  const expected = {
    CHART_DEFINITIONS: "chart",
    PART_DEFINITIONS: "part",
    SURFACE_DEFINITIONS: "surface",
  };
  const ids = [];
  for (const [exportName, kind] of Object.entries(expected)) {
    for (const id of Object.keys(registry[exportName])) {
      ids.push(id);
      assert.ok(entries[id], `${id} is in the snapshot`);
      assert.equal(entries[id].kind, kind, `${id} is a ${kind}`);
      assert.equal(entries[id].id, id);
    }
  }
  assert.deepEqual(Object.keys(entries).sort(), ids.sort(), "nothing else is in the snapshot");
  for (const [id, entry] of Object.entries(entries)) {
    assert.ok(entry.fields && typeof entry.fields === "object", `${id} has fields`);
    assert.ok(Array.isArray(entry.aliases), `${id} has its alias rows`);
    assert.match(entry.module, /^packages\/charts\/src\/.+\.tsx?$/, `${id} names its module`);
    assert.ok(entry.prose && typeof entry.prose === "object", `${id} has prose`);
    if (entry.kind === "chart") {
      assert.ok(Array.isArray(entry.specTypes), `${id} lists its spec types`);
      assert.ok(entry.contract?.dataKind, `${id} carries its contract`);
    }
  }
});

test("snapshot: every chart carries the @dataShape / @avoidWhen prose chart_for reads today", () => {
  const entries = readJson(DEFINITIONS_PATH)[CHARTS];
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.kind !== "chart") continue;
    assert.ok(entry.prose.dataShapes?.length, `${id} has at least one @dataShape`);
    assert.ok(entry.prose.avoidWhen, `${id} has an @avoidWhen`);
  }
  // Parity with the manifest's intent records, which `chart_for` ranks on today: the snapshot
  // must hand `chart_for` the same prose when it moves onto the snapshot (RM-199).
  const intent = loadManifest(repoRoot).packages[CHARTS].intent;
  let compared = 0;
  for (const [name, record] of Object.entries(intent)) {
    if (!entries[name] || (!record.dataShapes && !record.avoidWhen)) continue;
    compared++;
    assert.deepEqual(entries[name].prose.dataShapes, record.dataShapes, `${name} dataShapes`);
    assert.equal(entries[name].prose.avoidWhen, record.avoidWhen, `${name} avoidWhen`);
  }
  assert.ok(compared >= 26, `compared ${compared} components`);
});

test("snapshot: rendering twice gives the same bytes, with no absolute path", async () => {
  const first = await renderDefinitionArtifacts();
  const second = await renderDefinitionArtifacts();
  assert.deepEqual(Object.keys(first).sort(), [CHART_CODEMOD_MAP_PATH, DEFINITIONS_PATH].sort());
  for (const [file, content] of Object.entries(first)) {
    assert.equal(content, second[file], `${file} is deterministic`);
    assert.ok(!content.includes(repoRoot), `${file} holds no absolute path`);
    assert.ok(content.endsWith("}\n"), `${file} is formatted JSON`);
  }
});

test("codemod map: one props mapping per alias row, in the shape `brand-ui codemod` reads", () => {
  const row = (from, to, transform = "identity") => ({
    from,
    to,
    transform,
    precedence: "new-wins",
    since: "5.6.0",
    removeIn: "6.0.0",
  });
  const snapshot = {
    [CHARTS]: {
      XAxis: { kind: "part", aliases: [row("orientation", "position")] },
      BarChart: {
        kind: "chart",
        aliases: [row("showValues", "labels", "boolean-to-labels"), row("loading", "status")],
      },
      LineChart: { kind: "chart", aliases: [] },
    },
  };
  const map = codemodMapFrom(snapshot, CHARTS);
  assert.deepEqual(
    map.mappings.map((m) => `${m.source}.${m.alias.from}`),
    ["BarChart.showValues", "BarChart.loading", "XAxis.orientation"],
    "ordered by definition id, then by row as declared",
  );
  assert.deepEqual(map.mappings[0], {
    alias: row("showValues", "labels", "boolean-to-labels"),
    class: "props",
    kind: "chart",
    pkg: CHARTS,
    propRemap: { showValues: "labels" },
    source: "BarChart",
    target: "BarChart",
  });
  const plan = planCodemod(map);
  assert.equal(plan.status, "planned");
  const remaps = plan.phases.find((p) => p.name === "prop-remaps");
  assert.equal(remaps?.transforms.length, 3, "every row becomes a prop remap");
});

test("codemod map: the committed map is generated from the committed snapshot", () => {
  const map = readJson(CHART_CODEMOD_MAP_PATH);
  assert.deepEqual(map, codemodMapFrom(readJson(DEFINITIONS_PATH), CHARTS));
  assert.equal(planCodemod(map).status, "planned", "brand-ui codemod accepts it");
});

test("the shipped CLI never bundles: no bin/ or lib/ module imports esbuild", () => {
  for (const dir of ["bin", "lib"]) {
    for (const file of readdirSync(join(PKG_DIR, dir))) {
      if (!file.endsWith(".mjs")) continue;
      const src = readFileSync(join(PKG_DIR, dir, file), "utf8");
      assert.doesNotMatch(
        src,
        /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']esbuild["']/,
        `${dir}/${file}`,
      );
    }
  }
});

test("componentProse: a definition must name an exported component", () => {
  assert.throws(() => componentProse(repoRoot, [], "NotAComponent"), /NotAComponent/);
});

test("docSummary: paragraphs reflowed, list items and code fences kept, tags excluded", () => {
  const block = [
    "/**",
    " * `Chart` — a first sentence that wraps",
    " * onto a second line.",
    " *",
    " * - one item",
    " *   continued",
    " * - two",
    " *",
    " * ```tsx",
    " * <Chart data={rows}>",
    ' *   <Bar dataKey="a" />',
    " * </Chart>",
    " * ```",
    " *",
    " * @dataShape not part of the summary",
    " * @avoidWhen nor this",
    " */",
  ].join("\n");
  assert.equal(
    docSummary(block),
    [
      "`Chart` — a first sentence that wraps onto a second line.",
      "",
      "- one item continued\n- two",
      "",
      '```tsx\n<Chart data={rows}>\n  <Bar dataKey="a" />\n</Chart>\n```',
    ].join("\n"),
  );
  assert.equal(docSummary("/**\n * @dataShape only tags\n */"), undefined);
  assert.equal(docSummary(null), undefined);
});

test("canonical: sorted keys; functions and undefined dropped; non-finite numbers are null", () => {
  const out = canonical({ b: 1, a: { d: () => 1, c: [Infinity, undefined, "x"] }, e: undefined });
  assert.equal(JSON.stringify(out), '{"a":{"c":[null,"x"]},"b":1}');
});
