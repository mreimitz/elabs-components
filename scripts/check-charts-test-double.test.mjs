/**
 * check-charts-test-double.test.mjs — locks the #364 test-double anti-drift gate.
 * Run in CI: `node --test scripts/check-charts-test-double.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never real files), per the
 * repo's "a gate ships with its self-test" convention.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkContainerParity,
  checkManifestExclusion,
  checkWiring,
  findEngineIsolationViolations,
  findRuntimeImportSpecifiers,
  isComponentExportName,
  isNonShippedFile,
  parseExportedValueNames,
  requiredDoubleNames,
} from "./check-charts-test-double.mjs";

// ── (a) component parity ─────────────────────────────────────────────────────

test("requiredDoubleNames: requires EVERY component the barrel exports, not only containers", () => {
  const real = [
    "AreaChart",
    "LineChart",
    "AreaChartLoading",
    "ChartLegend",
    "Line",
    "XAxis",
    "ChartProvider",
    "Gantt",
    "Sparkline",
  ];
  const required = requiredDoubleNames(real);
  for (const name of real) assert.ok(required.includes(name), name);
});

test("requiredDoubleNames: SCREAMING_SNAKE constants are OUT of parity (they live in @visx-backed modules)", () => {
  const required = requiredDoubleNames([
    "LineChart",
    "DEFAULT_CHART_STATUS",
    "PROFIT_LOSS_POSITIVE_COLOR",
    "Y_AXIS_MAX_TICK_COUNT",
  ]);
  assert.deepEqual(required, ["LineChart"]);
  assert.equal(isComponentExportName("DEFAULT_CHART_STATUS"), false);
  assert.equal(isComponentExportName("Line"), true);
});

// FIXTURE (a'): a composition primitive missing — the failure that broke the
// documented `vi.mock` factory wiring (Vitest's proxy throws on an omitted
// export the moment `<Line …/>` reads the binding).
test("FIXTURE: checkContainerParity FAILS when a composition primitive is missing", () => {
  const real = ["LineChart", "Line", "XAxis"];
  const testIndexSrc = `export { LineChart } from "./doubles";`;
  const missing = checkContainerParity(real, testIndexSrc);
  assert.ok(missing.includes("Line"));
  assert.ok(missing.includes("XAxis"));
});

test("parseExportedValueNames: reads `export { A, B as C }` and `export const/function`", () => {
  const src = `
export { AreaChart, BarChart as Bar } from "./doubles";
export type { AreaChartProps } from "../charts/area-chart";
export const LineChart = 1;
export function Gantt() {}
`;
  const names = parseExportedValueNames(src);
  assert.ok(names.has("AreaChart"));
  assert.ok(names.has("Bar"));
  assert.ok(names.has("LineChart"));
  assert.ok(names.has("Gantt"));
  // the type-only export must NOT count as a value export
  assert.ok(!names.has("AreaChartProps"));
});

// FIXTURE (a): a double missing an export — the gate must fail.
test("FIXTURE: checkContainerParity FAILS when a required double is missing", () => {
  const real = ["AreaChart", "LineChart", "Gantt"];
  const testIndexSrc = `export { AreaChart } from "./doubles";`; // LineChart, Gantt missing
  const missing = checkContainerParity(real, testIndexSrc);
  assert.ok(missing.includes("LineChart"));
  assert.ok(missing.includes("Gantt"));
});

test("checkContainerParity PASSES when every required double is exported", () => {
  const real = ["AreaChart", "LineChart", "Gantt"];
  const testIndexSrc = `export { AreaChart, LineChart, Gantt } from "./doubles";`;
  assert.deepEqual(checkContainerParity(real, testIndexSrc), []);
});

// ── (b) engine isolation ─────────────────────────────────────────────────────

// FIXTURE (b): a src/test/ file with a runtime @visx/shape import — must fail.
test("FIXTURE: findEngineIsolationViolations FLAGS a runtime @visx import", () => {
  const src = `import { Bar } from "@visx/shape";\nexport const x = Bar;`;
  const violations = findEngineIsolationViolations(src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "forbidden-engine");
  assert.equal(violations[0].specifier, "@visx/shape");
});

test("findEngineIsolationViolations does NOT flag a type-only @visx import", () => {
  const src = `import type { ScaleTime } from "@visx/scale";`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

// REGRESSION (found while building this gate against the real doubles.tsx): a
// `from`-less `export const X = { … many lines … }` must NOT let the lazy
// re-export scan walk forward and mis-attribute a LATER, unrelated
// `import type … from "…"` to this statement.
test("findRuntimeImportSpecifiers does not bleed a later `from` into a from-less `export const`", () => {
  const src = `
export const TABLE = {
  a: 1,
  b: 2,
};

import type { RealProps } from "../charts/area-chart";
`;
  assert.deepEqual(findRuntimeImportSpecifiers(src), []);
});

test("findRuntimeImportSpecifiers still finds `export { X } from '…'` and `export * from '…'`", () => {
  const src = `
export const TABLE = { a: 1 };
export { Foo } from "./foo";
export * from "./bar";
`;
  assert.deepEqual(findRuntimeImportSpecifiers(src), ["./foo", "./bar"]);
});

test("findEngineIsolationViolations FLAGS d3-*, motion, react-use-measure, @tanstack/react-virtual", () => {
  for (const specifier of [
    "d3-shape",
    "motion/react",
    "react-use-measure",
    "@tanstack/react-virtual",
  ]) {
    const src = `import { x } from "${specifier}";`;
    assert.equal(findEngineIsolationViolations(src).length, 1, specifier);
  }
});

test("findEngineIsolationViolations FLAGS importing a package/family barrel", () => {
  const src = `export * from "../charts";`;
  const violations = findEngineIsolationViolations(src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "forbidden-barrel");
});

// FIXTURE (b'): the package's OWN name resolves back to src/index.ts via the
// `exports` map — the most natural way to reintroduce the whole engine.
test("FIXTURE: findEngineIsolationViolations FLAGS a self-referencing package-name import", () => {
  const src = `import { LineChart } from "@elabs/components-charts";`;
  const violations = findEngineIsolationViolations(src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "forbidden-barrel");
});

test("findEngineIsolationViolations does NOT flag the sibling @elabs/components-ui package", () => {
  const src = `import { MetricCard } from "@elabs/components-ui";`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

test("findEngineIsolationViolations does NOT flag a permitted leaf (chart-a11y, chart-phase)", () => {
  const src = `
import { ChartA11yLabel, useChartA11yContainerProps } from "../charts/chart-a11y";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { forwardRef } from "react";
`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

test("isNonShippedFile: co-located tests/stories are out of the engine-isolation walk, real modules are in", () => {
  assert.equal(isNonShippedFile("mock-namespace.test.tsx"), true);
  assert.equal(isNonShippedFile("contract.test.tsx"), true);
  assert.equal(isNonShippedFile("chart.stories.tsx"), true);
  assert.equal(isNonShippedFile("primitives.tsx"), false);
  assert.equal(isNonShippedFile("contract.ts"), false);
  assert.equal(isNonShippedFile("index.ts"), false);
});

// ── (c) wiring ────────────────────────────────────────────────────────────────

// FIXTURE (c): exports["./test"] present, publishConfig.exports["./test"] absent — must fail.
test("FIXTURE: checkWiring FAILS when publishConfig.exports is missing the ./test key", () => {
  const pkgJson = {
    exports: {
      ".": {},
      "./test": { types: "./src/test/index.ts", default: "./src/test/index.ts" },
    },
    publishConfig: { exports: { ".": {} } }, // no "./test"
  };
  const tsupSrc = `entry: { index: "src/index.ts", "test/index": "src/test/index.ts" }`;
  const problems = checkWiring(pkgJson, tsupSrc);
  assert.ok(problems.some((p) => p.includes("publishConfig.exports")));
});

test("checkWiring FAILS when exports is missing the ./test key", () => {
  const pkgJson = { exports: { ".": {} }, publishConfig: { exports: { ".": {} } } };
  const problems = checkWiring(pkgJson, `entry: { "test/index": "src/test/index.ts" }`);
  assert.ok(problems.some((p) => p.includes('"exports" is missing')));
});

test("checkWiring FAILS when tsup.config.ts has no test/index entry", () => {
  const pkgJson = {
    exports: { ".": {}, "./test": {} },
    publishConfig: { exports: { ".": {}, "./test": {} } },
  };
  const problems = checkWiring(pkgJson, `entry: { index: "src/index.ts" }`);
  assert.ok(problems.some((p) => p.includes("tsup.config.ts")));
});

// ── (d) manifest exclusion ────────────────────────────────────────────────────

// FIXTURE (d): the `/test` denylist in readSubpathBarrels was refactored away,
// so the doubles reappear in the agent-facing build-with catalogue.
test("FIXTURE: checkManifestExclusion FAILS when a /test subpath is crawled into the manifest", () => {
  const manifest = {
    packages: {
      "@elabs/components-charts": {
        subpaths: { "@elabs/components-charts/test": { components: [] } },
      },
    },
  };
  const problems = checkManifestExclusion(manifest);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /readSubpathBarrels/);
});

test("checkManifestExclusion PASSES for a legitimate non-/test subpath", () => {
  const manifest = {
    packages: {
      "@elabs/components-editor": {
        subpaths: { "@elabs/components-editor/markdown/parse": { components: [] } },
      },
      "@elabs/components-charts": {},
    },
  };
  assert.deepEqual(checkManifestExclusion(manifest), []);
});

test("checkWiring PASSES when all three are wired", () => {
  const pkgJson = {
    exports: {
      ".": {},
      "./test": { types: "./src/test/index.ts", default: "./src/test/index.ts" },
    },
    publishConfig: {
      exports: {
        ".": {},
        "./test": { types: "./dist/test/index.d.ts", default: "./dist/test/index.js" },
      },
    },
  };
  const tsupSrc = `entry: { index: "src/index.ts" }`,
    entry2 = `entry: { "test/index": "src/test/index.ts" }`;
  assert.deepEqual(checkWiring(pkgJson, tsupSrc + entry2), []);
});
