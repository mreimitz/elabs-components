/**
 * charts-definition-isolation — no chart/part/surface family imports another family's
 * definition, and nothing outside a small allow-list imports the definition registry
 * (ADR 0042 §11, RM-181).
 *
 * A bundler does not drop unused object fields, and `sideEffects: false` does not help once a
 * module is imported: if a family imported the whole registry (or a sibling family's
 * `*.definition.ts`), every definition, contract and prose string in that import would ship in
 * every consumer bundle that uses just one chart — the tree-shake budget
 * (`packages/cli/scripts/check-chart-treeshake.mjs`) can only hold if the SOURCE graph never
 * creates that edge in the first place. This rule is the source-level half of that guarantee;
 * the built-output half is the post-build script.
 *
 * "Family" is the filename stem shared by a component (`charts/bar-chart.tsx`), its definition
 * (`definitions/bar-chart.definition.ts`) and its story — kebab-case, one dot before the
 * extension, so `basename.split(".")[0]` names it for every file in the package. A part's family
 * spans the same stem too (`charts/bar.tsx` / `definitions/parts/bar.definition.ts`).
 *
 * Two findings, both read from the TypeScript-AST runtime-import walk `charts-definitions-pure`
 * already exports (erasing `import type`, counting `import { type X }`, dynamic `import()`,
 * `require()`, `export * as X from` — see that module's header):
 *   - anything outside `REGISTRY_IMPORTER_ALLOWLIST` importing `definitions/registry.ts`;
 *   - a file whose own family differs from the family of a `*.definition.ts` file it relatively
 *     imports (checked against every file in `packages/charts/src/**`, not only `definitions/**`,
 *     because the leak this rule exists to catch is a component or story reaching across
 *     families just as much as one definition reaching into another).
 * `registry.ts` importing every family's definition is its entire job and is never flagged; the
 * check only fires on files OTHER than the registry doing the same thing.
 *
 * Only relative imports are inspected — the registry and every `*.definition.ts` file live inside
 * the package, so a cross-family or registry leak is always written as a relative specifier, and
 * a bare specifier is `charts-definitions-pure`'s and `charts-test-double`'s concern, not this
 * rule's.
 */
import { posix } from "node:path";

import { findRuntimeImports } from "./charts-definitions-pure.mjs";

const SRC = "packages/charts/src";

/** Test/story/fixture files never ship and are exempt as both importers and import targets —
 *  mirrors `charts-definitions-pure`'s ROOT_IGNORE, applied here across the whole package. */
const SCAN_IGNORE = [
  "**/*.test-d.ts",
  "**/*.{test,stories}.{ts,tsx}",
  "**/__fixtures__/**",
  "**/{node_modules,dist}/**",
];

/** The only files allowed to import the registry: the ADR 0042 §6 id→component binding, the
 *  test double (validates every registered definition), and AutoChart (renders any of them by
 *  id) — the gen step reads `registry.ts` as an esbuild ENTRY PATH, never an `import`, so it
 *  never shows up in this walk and needs no entry here (RM-178). */
const REGISTRY_IMPORTER_ALLOWLIST = [
  "packages/charts/src/definitions/components.ts",
  { prefix: "packages/charts/src/auto-chart/" },
  { prefix: "packages/charts/src/test/" },
];

const isAllowedRegistryImporter = (file) =>
  REGISTRY_IMPORTER_ALLOWLIST.some((entry) =>
    typeof entry === "string" ? file === entry : file.startsWith(entry.prefix),
  );

const REGISTRY_FILE = "packages/charts/src/definitions/registry.ts";
const isRegistryFile = (file) => file === REGISTRY_FILE;

/** `packages/charts/src/definitions/**\/*.definition.ts` (including `definitions/parts/**`). */
const isDefinitionFile = (file) =>
  file.startsWith(`${SRC}/definitions/`) && file.endsWith(".definition.ts");

/** The family a file belongs to: its basename up to the first dot. Kebab-case filenames never
 *  contain a literal dot before the extension, so this names a component, its definition and its
 *  story identically (`bar-chart.tsx` / `bar-chart.definition.ts` / `bar-chart.stories.tsx` →
 *  `"bar-chart"`). */
const familySlug = (file) => posix.basename(file).split(".")[0];

/** Resolve a relative specifier from `file` → the repo-relative file it names, or null. Mirrors
 *  `charts-definitions-pure`'s `resolveRelative` (not exported there — duplicated here rather
 *  than reached across a module boundary for a five-line helper). */
function resolveRelative(ctx, file, specifier) {
  const base = posix.normalize(posix.join(posix.dirname(file), specifier));
  const stem = base.replace(/\.(?:m|c)?jsx?$/, "");
  const candidates = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  return candidates.find((c) => ctx.exists(c) && /\.tsx?$/.test(c)) ?? null;
}

/**
 * Every isolation violation under `packages/charts/src/**` → `[{ file, line, msg }]`.
 */
export function isolationFindings(ctx) {
  const out = [];
  const files = ctx.glob(`${SRC}/**/*.{ts,tsx}`, { ignore: SCAN_IGNORE });

  for (const file of files) {
    for (const { specifier, line } of findRuntimeImports(ctx.readFile(file), file)) {
      if (!specifier.startsWith(".")) continue; // bare specifiers are the other rules' concern
      const resolved = resolveRelative(ctx, file, specifier);
      if (!resolved) continue;

      if (isRegistryFile(resolved)) {
        if (!isAllowedRegistryImporter(file)) {
          out.push({
            file,
            line,
            msg: `imports the chart definition registry ("${specifier}") — only AutoChart, definitions/components.ts and src/test/** may import the registry; a family imports only its own definition (ADR 0042 §11)`,
          });
        }
        continue;
      }

      if (isDefinitionFile(resolved) && !isRegistryFile(file)) {
        const importerFamily = familySlug(file);
        const targetFamily = familySlug(resolved);
        if (importerFamily !== targetFamily) {
          out.push({
            file,
            line,
            msg: `imports another family's definition ("${specifier}", family "${targetFamily}") — a family imports only its own definition, never another family's or the registry (ADR 0042 §11)`,
          });
        }
      }
    }
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const BAR_COMPONENT = "packages/charts/src/charts/bar-chart.tsx";
const BAR_DEFINITION = "packages/charts/src/definitions/bar-chart.definition.ts";
const AREA_DEFINITION = "packages/charts/src/definitions/area-chart.definition.ts";
const BAR_PART_DEFINITION = "packages/charts/src/definitions/parts/bar.definition.ts";
const REGISTRY = REGISTRY_FILE;
const COMPONENTS = "packages/charts/src/definitions/components.ts";

export default {
  id: "charts-definition-isolation",
  scope: "packages",
  doc: "No chart/part/surface family imports another family's definition, and only AutoChart, `definitions/components.ts` and `src/test/**` import the definition registry — a family stays tree-shakeable on its own (ADR 0042 §11; runtime imports read with the TypeScript parser, `import type` exempt; test/story/fixture files exempt).",
  baseline: "none",
  run(ctx) {
    return isolationFindings(ctx);
  },
  fixtures: {
    pass: [
      { files: {} }, // nothing under packages/charts/src yet — green until the package exists
      {
        files: {
          [BAR_COMPONENT]:
            'import type { BarChartProps } from "./bar-chart";\nexport function BarChart(props: BarChartProps) { return null; }',
          [BAR_DEFINITION]:
            'import type { BarChartProps } from "../charts/bar-chart";\nexport const BAR_CHART = { id: "BarChart" };',
        },
      }, // a family's own component/definition pair — same stem, no cross-family edge
      {
        files: {
          [BAR_DEFINITION]:
            'import { AREA_ID } from "./shared-ids";\nexport const BAR_CHART = { id: "BarChart", area: AREA_ID };',
          "packages/charts/src/definitions/shared-ids.ts": 'export const AREA_ID = "AreaChart";',
        },
      }, // a shared non-definition sibling (not `*.definition.ts`) is never a family edge
      {
        files: {
          [BAR_DEFINITION]:
            'import { frameSizeGroup } from "../charts/props/frame-size";\nexport const BAR_CHART = { id: "BarChart", frame: frameSizeGroup };',
          "packages/charts/src/charts/props/frame-size.ts":
            "export const frameSizeGroup = { plotHeight: 240 };",
        },
      }, // a shared prop group is not a `*.definition.ts` file — no family match required
      {
        files: {
          [REGISTRY]: `import { BAR_CHART } from "./bar-chart.definition";\nimport { AREA_CHART } from "./area-chart.definition";\nexport const CHART_DEFINITIONS = { BarChart: BAR_CHART, AreaChart: AREA_CHART };`,
          [BAR_DEFINITION]: 'export const BAR_CHART = { id: "BarChart" };',
          [AREA_DEFINITION]: 'export const AREA_CHART = { id: "AreaChart" };',
        },
      }, // the registry importing every family's definition is its own job, never flagged
      {
        files: {
          [COMPONENTS]:
            'import type { CHART_DEFINITIONS } from "./registry";\nimport { BarChart } from "../charts/bar-chart";\nexport const CHART_COMPONENTS = { BarChart };',
        },
      }, // components.ts's registry reference is type-only — erased before the walk sees it
      {
        files: {
          [COMPONENTS]:
            'import { CHART_DEFINITIONS } from "./registry";\nexport const ids = Object.keys(CHART_DEFINITIONS);',
        },
      }, // components.ts is on REGISTRY_IMPORTER_ALLOWLIST even for a genuine runtime import
      {
        files: {
          "packages/charts/src/auto-chart/auto-chart.tsx":
            '"use client";\nimport { CHART_DEFINITIONS } from "../definitions/registry";\nexport function AutoChart() { return CHART_DEFINITIONS; }',
        },
      }, // AutoChart is allowed to import the registry — it renders any definition by id
      {
        files: {
          "packages/charts/src/test/doubles.tsx":
            'import { CHART_DEFINITIONS } from "../definitions/registry";\nexport const doubles = CHART_DEFINITIONS;',
        },
      }, // the test double validates every registered definition — also allowed
      {
        files: {
          "packages/charts/src/definitions/registry.test-d.ts":
            'import { CHART_DEFINITIONS } from "./registry";\nimport { BAR_CHART } from "./bar-chart.definition";\n// lockstep assertions only run under a type checker',
        },
      }, // *.test-d.ts is exempt outright — never walked as an importer
      {
        files: {
          "packages/charts/src/definitions/definitions.test.ts":
            'import { describe, it, expect } from "vitest";\nimport { CHART_DEFINITIONS } from "./registry";\ndescribe("definitions", () => { it("is complete", () => { expect(CHART_DEFINITIONS).toBeDefined(); }); });',
        },
      }, // *.test.ts is exempt too, however many families' worth of imports it needs
      {
        files: {
          "packages/charts/src/charts/bar-chart.stories.tsx":
            'import { AREA_CHART } from "../definitions/area-chart.definition";\nexport default { title: "BarChart" };',
        },
      }, // a story pulling in another family's definition for a demo is exempt as a story file
      {
        files: {
          [BAR_PART_DEFINITION]: 'export const BAR_PART = { id: "Bar" };',
          "packages/charts/src/charts/bar.tsx":
            'import type { BarProps } from "../definitions/parts/bar.definition";\nexport function Bar(props: BarProps) { return null; }',
        },
      }, // a part family (`bar.tsx` / `parts/bar.definition.ts`) matches on stem too
    ],
    fail: [
      {
        files: {
          [BAR_COMPONENT]:
            'import { CHART_DEFINITIONS } from "../definitions/registry";\nexport function BarChart() { return CHART_DEFINITIONS; }',
          [REGISTRY]: "export const CHART_DEFINITIONS = {};",
        },
      }, // seeded: a chart component importing the registry directly
      {
        files: {
          [BAR_DEFINITION]:
            'import { CHART_DEFINITIONS } from "./registry";\nexport const BAR_CHART = { id: "BarChart", all: CHART_DEFINITIONS };',
          [REGISTRY]: "export const CHART_DEFINITIONS = {};",
        },
      }, // seeded: a definition importing the registry (the exact acceptance-fixture shape)
      {
        files: {
          [BAR_DEFINITION]:
            'import { AREA_CHART } from "./area-chart.definition";\nexport const BAR_CHART = { id: "BarChart", area: AREA_CHART };',
          [AREA_DEFINITION]: 'export const AREA_CHART = { id: "AreaChart" };',
        },
      }, // seeded: one family's definition importing another family's definition
      {
        files: {
          [BAR_COMPONENT]:
            'import { AREA_CHART } from "../definitions/area-chart.definition";\nexport function BarChart() { return AREA_CHART; }',
          [AREA_DEFINITION]: 'export const AREA_CHART = { id: "AreaChart" };',
        },
      }, // a component (not just a definition) reaching into a sibling family's definition
      {
        files: {
          [BAR_DEFINITION]:
            'import { AREA_CHART } from "../definitions/area-chart.definition";\nexport const BAR_CHART = { id: "BarChart", area: AREA_CHART };',
          [AREA_DEFINITION]: 'export const AREA_CHART = { id: "AreaChart" };',
        },
      }, // same finding via the longer `../definitions/…` spelling some part files would use
      {
        files: {
          [BAR_DEFINITION]:
            'export * as Area from "./area-chart.definition";\nexport const BAR_CHART = { id: "BarChart" };',
          [AREA_DEFINITION]: 'export const AREA_CHART = { id: "AreaChart" };',
        },
      }, // a namespace re-export of another family's definition is a runtime import too
      {
        files: {
          "packages/charts/src/definitions/parts/bar.definition.ts":
            'import { X_AXIS_PART } from "./x-axis.definition";\nexport const BAR_PART = { id: "Bar", axis: X_AXIS_PART };',
          "packages/charts/src/definitions/parts/x-axis.definition.ts":
            'export const X_AXIS_PART = { id: "XAxis" };',
        },
      }, // one part definition importing a different part's definition is a cross-family edge too
      {
        files: {
          [BAR_COMPONENT]:
            'export const load = () => import("../definitions/registry");\nexport function BarChart() { return null; }',
          [REGISTRY]: "export const CHART_DEFINITIONS = {};",
        },
      }, // a dynamic import() of the registry is a runtime import too
    ],
  },
};
