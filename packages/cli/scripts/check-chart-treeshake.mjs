#!/usr/bin/env node
/**
 * check-chart-treeshake.mjs — proves a consumer bundling ONE chart, or the test double, never
 * pulls in what it did not ask for (ADR 0042 §11, RM-181).
 *
 * A bundler does not drop unused object fields, and `sideEffects: false` does not help once a
 * module is imported: if a family imported the registry, or another family's definition, every
 * definition, contract and prose string in that import would ship in every consumer bundle that
 * uses just one chart. `scripts/check/rules/charts-definition-isolation.mjs` proves the SOURCE
 * graph never creates that edge; this script proves the BUILT output backs it up, the same
 * "read what the compiler actually decided to keep" reasoning as `check-optional-peer-types.mjs`
 * and `check-css-assets.mjs` (both run in the same CI "Built-output checks" step, right after
 * `pnpm build`).
 *
 * Three things are checked, each read from an esbuild metafile:
 *
 * 1. A BarChart-only entry, bundled from the PUBLISHED `packages/charts/dist` (exactly what a
 *    real consumer's bundler resolves — `charts`'s own `exports` field points at source, but every
 *    package in this repo leaves `dependencies`/`peerDependencies` external in its build, so this
 *    mirrors that by marking `@elabs-ai/components-ui`/`@elabs-ai/components-tokens`/react
 *    external too, the same list `tsup` derives from `package.json`). The bundle's SHIPPED inputs
 *    (`metafile.outputs[…].inputs`, filtered to `bytesInOutput > 0` — not merely
 *    `metafile.inputs`, which also lists a file the main barrel imports at module scope but
 *    nothing ever references again, and which tree-shaking therefore drops from the actual output;
 *    verified against the real build, where the barrel's unused AutoChart re-export is "opened"
 *    for every entry but ships in none) must contain no other family's definition, no registry,
 *    and no AutoChart.
 * 2. A `./test` entry, same dist, same externals. Its SHIPPED inputs must contain no visx, d3,
 *    motion, or the sibling `charts-test-double` rule's other forbidden engine dependencies
 *    (`@number-flow/react`, `react-use-measure`, `@tanstack/react-virtual`) — the double is JSX
 *    stand-ins only and needs no chart-rendering engine at all.
 * 3. A per-family byte budget: every `definitions/*.definition.ts` and `definitions/parts/
 *    *.definition.ts` file, bundled alone from SOURCE (the ui definition base stays external —
 *    shared infrastructure, not counted per family), must weigh in under `BUDGET_BYTES`. A family
 *    that outgrows it splits into `<id>.defaults.ts` (runtime defaults/alias rows) and
 *    `<id>.definition.ts` (meta, contract, targets) per ADR 0042 §11 — this script only measures
 *    and fails; it does not perform the split.
 *
 * `BUDGET_BYTES` is set from a real measurement (`bar-chart.definition.ts`, the heaviest family
 * today, ~27.1 KB) with headroom for future prop growth — see the constant's own comment.
 *
 * Requires a fresh build: `pnpm --filter @elabs-ai/components-charts build` (checks 1–2 read
 * `packages/charts/dist`; check 3 reads source directly and needs no build). Exits loudly, not
 * silently, when `dist` is missing — unlike a survey gate that spans many packages, this script's
 * entire job depends on a fresh build having just run, so a missing `dist` is a misuse of the
 * script, not a package that legitimately has nothing to check.
 *
 * Dependency-free beyond `esbuild` (already a `packages/cli` devDependency); ESM; locates the repo
 * relative to this file (cwd-independent).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

import esbuild from "esbuild";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../../..");
const CHARTS_DIR = resolve(REPO_ROOT, "packages/charts");
const CHARTS_DIST = resolve(CHARTS_DIR, "dist");
const CHARTS_SRC = resolve(CHARTS_DIR, "src");
const DEFINITIONS_DIR = resolve(CHARTS_SRC, "definitions");
const PARTS_DIR = resolve(DEFINITIONS_DIR, "parts");

/** Everything `charts` leaves external at build time (`dependencies`/`peerDependencies` in
 *  `packages/charts/package.json` that are NOT bundled — `react`, `react-dom` and the two
 *  `@elabs-ai/components-*` peers). Mirrors what `tsup` (via esbuild) actually leaves unresolved
 *  in the real `dist`, verified against it directly: `dist/test/index.js` imports `MetricCard`
 *  from a bare `"@elabs-ai/components-ui"` specifier, never inlines it. Bundling with these NOT
 *  external — i.e. letting esbuild resolve `@elabs-ai/components-ui` down to its own multi-
 *  hundred-export SOURCE barrel, the only path esbuild has without this list, since no package in
 *  the repo declares a "production" export condition — pulls in unrelated ui components (and,
 *  transitively, `motion` via `use-scroll-progress.ts`) that the real published dist never ships;
 *  that is an artifact of over-eager source resolution, not a real leak (see the RM-181 PR body). */
const PEER_EXTERNAL = [
  "react",
  "react-dom",
  "@elabs-ai/components-ui",
  "@elabs-ai/components-ui/*",
  "@elabs-ai/components-tokens",
  "@elabs-ai/components-tokens/*",
];

/** The sibling `charts-test-double` check rule's forbidden engine list (source-level, regex on
 *  relative imports only). This script re-checks the same list against the BUILT `./test` bundle's
 *  full transitive closure — including anything reached through a bare specifier — as the
 *  complementary "did the compiled output actually keep any of this" half. */
const FORBIDDEN_ENGINES = [
  { label: "@visx/*", re: /\/@visx\// },
  { label: "d3-*", re: /\/d3-[a-z]/ },
  { label: "motion", re: /\/motion\// },
  { label: "@number-flow/react", re: /\/@number-flow\/react\// },
  { label: "react-use-measure", re: /\/react-use-measure\// },
  { label: "@tanstack/react-virtual", re: /\/@tanstack\/react-virtual\// },
];

/** Measured: the heaviest family today (`bar-chart.definition.ts`) bundles to ~27.1 KB with
 *  `@elabs-ai/components-ui/definition` external. 40 KB gives ~48% headroom for prop growth
 *  before a family needs the `<id>.defaults.ts` / `<id>.definition.ts` split (ADR 0042 §11). */
const BUDGET_BYTES = 40_000;

/** Bundle `contents` (an ES module body) with esbuild from `resolveDir`, marking every peer
 *  external. Returns two different views of the metafile, plus the output's byte length:
 *  `inputs` — every file esbuild had to open to resolve the module graph (`metafile.inputs`,
 *  repo-relative, sorted) — and `shipped` — only the inputs that actually contributed bytes to
 *  the single output file (`metafile.outputs["stdin.js"].inputs`, filtered to `bytesInOutput >
 *  0`). The two differ real: a file merely IMPORTED (even at top level, by a barrel) but never
 *  referenced again is still opened and shows up in `inputs`, but tree-shaking can drop it from
 *  `shipped` entirely once esbuild proves it has no side effects — verified against the real
 *  build, where the main barrel's un-imported AutoChart re-export shows up in `inputs` for every
 *  entry (including a BarChart-only one) but contributes zero bytes to `shipped`. The isolation
 *  checks below use `shipped`, the true "what does a consumer's bundle actually contain" view;
 *  `inputs` is kept only for the report's file-count line. */
async function bundle(contents, resolveDir, sourcefile, external = PEER_EXTERNAL) {
  const result = await esbuild.build({
    stdin: { contents, resolveDir, sourcefile, loader: "js" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    metafile: true,
    treeShaking: true,
    external,
    absWorkingDir: REPO_ROOT,
    logLevel: "silent",
  });
  const [outputMeta] = Object.values(result.metafile.outputs);
  const shipped = Object.entries(outputMeta?.inputs ?? {})
    .filter(([, meta]) => meta.bytesInOutput > 0)
    .map(([file]) => file)
    .sort();
  return {
    inputs: Object.keys(result.metafile.inputs).sort(),
    shipped,
    bytes: result.outputFiles[0].contents.length,
  };
}

/** Bundle a single definition module from SOURCE, `@elabs-ai/components-ui/definition` external
 *  (shared infrastructure — counted once, not per family). Returns the output's byte length. */
async function measureDefinition(absPath) {
  const { bytes } = await bundle(`export * from "${absPath}";`, REPO_ROOT, "entry.js", [
    "@elabs-ai/components-ui/definition",
    "react",
    "react-dom",
  ]);
  return bytes;
}

/** `*.definition.ts` files directly in `dir` (non-recursive — `parts/` is walked separately by
 *  the caller), sorted. */
function definitionFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".definition.ts"))
    .sort()
    .map((f) => resolve(dir, f));
}

/** `packages/charts/dist/…` present → a build has run. */
function requireBuiltDist() {
  if (existsSync(CHARTS_DIST)) return;
  console.error(
    "✖ chart-treeshake: packages/charts/dist is missing.\n" +
      "  Run `pnpm --filter @elabs-ai/components-charts build` first, then re-run this script.",
  );
  process.exit(1);
}

/**
 * A workspace-internal module reachable from MORE than one tsup entry (e.g. a definition that is
 * both its own `moduleEntries()` entry AND a dependency the registry's entry shares) is extracted
 * by esbuild's own code-splitting into an anonymously hashed `chunk-XXXXXXXX.js` — the descriptive
 * `definitions/bar-chart.definition.ts`-shaped path is gone from the chunk's OWN filename (verified
 * against a seeded build: importing the registry from `bar-chart.tsx` renames every definition it
 * pulls in into a `chunk-*.js` sharing NO substring with its origin). Path matching on `inputs`
 * alone is therefore blind to exactly the failure this check exists to catch. Every `.js` tsup
 * emits ships a sibling `.js.map` whose `sources` field survives the renaming — reading it recovers
 * the true origin, chunk-hashing or not; a file with no `.map` (an npm dependency, or a pure
 * re-export shell with an empty `sources`) falls back to its own metafile path, which is already
 * descriptive in that case (checked against the real build, both with and without the seed).
 */
function originalSourcesOf(distFilePath, repoRoot) {
  const abs = resolve(repoRoot, distFilePath);
  const mapAbs = `${abs}.map`;
  if (!abs.endsWith(".js") || !existsSync(mapAbs)) return [distFilePath];
  try {
    const map = JSON.parse(readFileSync(mapAbs, "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources : [];
    if (sources.length === 0) return [distFilePath];
    return sources.map((s) => relative(repoRoot, resolve(dirname(abs), s)));
  } catch {
    return [distFilePath];
  }
}

/** Shared infrastructure every definition depends on — never counted as "another family's
 *  definition" even when it rides along inside a chunk with one. */
const DEFINITION_SHARED_INFRA =
  /\/definitions\/(define-chart|contract-types|cartesian-fields|components)\.ts$/;

/** Findings for the BarChart-only bundle: every SHIPPED input (see `bundle()` — not merely
 *  opened, actually contributing bytes to the output) whose true origin is under `definitions/`
 *  (the registry included — it lives there too) or `auto-chart/`, and is not BarChart's own
 *  definition or shared definition infrastructure. BarChart does not import its own definition
 *  today either (`charts/src/index.ts` carries no public definitions subpath yet, ADR 0042 §13),
 *  so in the current build this is a forward guard with nothing to find — it earns its keep the
 *  moment that changes, or the moment a leak is introduced (proven on a seeded build in the
 *  RM-181 PR body). */
function barChartFindings(shipped, repoRoot = REPO_ROOT) {
  const out = [];
  for (const input of shipped) {
    for (const origin of originalSourcesOf(input, repoRoot)) {
      if (DEFINITION_SHARED_INFRA.test(origin)) continue;
      if (/\/definitions\/bar-chart\.definition\.ts$/.test(origin)) continue;
      if (/\/definitions\//.test(origin) || /\/auto-chart\//.test(origin)) {
        out.push({ input, origin });
      }
    }
  }
  return out;
}

/** Findings for the `./test` bundle: every SHIPPED input matching a forbidden engine, labelled. */
function testDoubleFindings(shipped) {
  const out = [];
  for (const { label, re } of FORBIDDEN_ENGINES) {
    const matches = shipped.filter((f) => re.test(f));
    if (matches.length > 0) out.push({ label, count: matches.length, sample: matches[0] });
  }
  return out;
}

async function main() {
  requireBuiltDist();

  const barChart = await bundle(
    'export { BarChart } from "./index.js";',
    CHARTS_DIST,
    "barchart-entry.js",
  );
  const testDouble = await bundle(
    'export * from "./index.js";',
    resolve(CHARTS_DIST, "test"),
    "test-entry.js",
  );

  const barChartBad = barChartFindings(barChart.shipped);
  const testDoubleBad = testDoubleFindings(testDouble.shipped);

  const families = [...definitionFilesIn(DEFINITIONS_DIR), ...definitionFilesIn(PARTS_DIR)];
  const budgetRows = [];
  for (const file of families) {
    const bytes = await measureDefinition(file);
    budgetRows.push({ file: file.replace(`${REPO_ROOT}/`, ""), bytes });
  }
  budgetRows.sort((a, b) => b.bytes - a.bytes);
  const overBudget = budgetRows.filter((r) => r.bytes > BUDGET_BYTES);

  console.log("Chart tree-shake report");
  console.log("────────────────────────────────────────────────────────────");
  console.log(
    `BarChart-only bundle: ${barChart.inputs.length} opened, ${barChart.shipped.length} shipped, ${barChart.bytes.toLocaleString()} bytes`,
  );
  console.log(
    `./test bundle:        ${testDouble.inputs.length} opened, ${testDouble.shipped.length} shipped, ${testDouble.bytes.toLocaleString()} bytes`,
  );
  console.log("");
  console.log(`Per-family definition budget (${BUDGET_BYTES.toLocaleString()} bytes):`);
  for (const row of budgetRows) {
    const flag = row.bytes > BUDGET_BYTES ? " ✖ OVER BUDGET" : "";
    console.log(`  ${String(row.bytes).padStart(7)}  ${row.file}${flag}`);
  }
  console.log("────────────────────────────────────────────────────────────");

  let ok = true;

  if (barChartBad.length > 0) {
    ok = false;
    console.error(
      "\n✖ BarChart-only bundle contains another family's definition, the registry, or AutoChart:",
    );
    for (const f of barChartBad) console.error(`  ${f.origin}  (bundled via ${f.input})`);
  }

  if (testDoubleBad.length > 0) {
    ok = false;
    console.error("\n✖ ./test bundle contains a forbidden chart-rendering engine:");
    for (const f of testDoubleBad)
      console.error(`  ${f.label} (${f.count} input(s), e.g. ${f.sample})`);
  }

  if (overBudget.length > 0) {
    ok = false;
    console.error(
      `\n✖ Family definition(s) over the ${BUDGET_BYTES.toLocaleString()}-byte budget:`,
    );
    for (const r of overBudget) {
      console.error(
        `  ${r.file}: ${r.bytes.toLocaleString()} bytes — split into <id>.defaults.ts / <id>.definition.ts (ADR 0042 §11)`,
      );
    }
  }

  if (ok) {
    console.log(
      "\n✔ chart-treeshake: BarChart, ./test and every family definition are isolated and in budget.",
    );
    return 0;
  }
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

export { barChartFindings, testDoubleFindings, PEER_EXTERNAL, FORBIDDEN_ENGINES, BUDGET_BYTES };
