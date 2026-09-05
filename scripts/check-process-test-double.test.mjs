/**
 * check-process-test-double.test.mjs — locks the RM-053 test-double anti-drift gate.
 * Run in CI: `node --test scripts/check-process-test-double.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never real files), per the repo's "a gate
 * ships with its self-test" convention.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkDoubleNamespaceParity,
  checkManifestExclusion,
  checkWiring,
  findEngineIsolationViolations,
  findRuntimeImportSpecifiers,
  isComponentExportName,
  isNonShippedFile,
  parseExportedValueNames,
} from "./check-process-test-double.mjs";

// ── (a) double namespace completeness ────────────────────────────────────────

test("isComponentExportName: PascalCase yes, SCREAMING_SNAKE no", () => {
  assert.equal(isComponentExportName("ProcessMapDouble"), true);
  assert.equal(isComponentExportName("DEFAULT_CHART_STATUS"), false);
  assert.equal(isComponentExportName("withProcessFixture"), false);
});

test("parseExportedValueNames: reads `export { A, B as C }` and `export const/function`", () => {
  const src = `
export { ProcessMapDouble, VariantExplorerDouble as VED } from "./doubles";
export type { ProcessContractSpec } from "./contract";
export const ProcessKpiStripDouble = 1;
export function withProcessFixture() {}
`;
  const names = parseExportedValueNames(src);
  assert.ok(names.has("ProcessMapDouble"));
  assert.ok(names.has("VED"));
  assert.ok(names.has("ProcessKpiStripDouble"));
  assert.ok(names.has("withProcessFixture"));
  assert.ok(!names.has("ProcessContractSpec"));
});

// FIXTURE (a): a double missing from test/index.ts — the gate must fail.
test("FIXTURE: checkDoubleNamespaceParity FAILS when a double is exported from doubles.tsx but not index.ts", () => {
  const doublesSrc = `
export const ProcessMapDouble = 1;
export const VariantExplorerDouble = 2;
`;
  const testIndexSrc = `export { ProcessMapDouble } from "./doubles";`; // VariantExplorerDouble missing
  const missing = checkDoubleNamespaceParity(doublesSrc, testIndexSrc);
  assert.deepEqual(missing, ["VariantExplorerDouble"]);
});

test("checkDoubleNamespaceParity PASSES when every double is re-exported", () => {
  const doublesSrc = `export const ProcessMapDouble = 1;`;
  const testIndexSrc = `export { ProcessMapDouble } from "./doubles";`;
  assert.deepEqual(checkDoubleNamespaceParity(doublesSrc, testIndexSrc), []);
});

test("checkDoubleNamespaceParity ignores non-component (helper) exports", () => {
  const doublesSrc = `export const ProcessMapDouble = 1;`;
  // withProcessFixture lives in a different module and is never required here.
  const testIndexSrc = `export { ProcessMapDouble } from "./doubles";\nexport { withProcessFixture } from "./primitives";`;
  assert.deepEqual(checkDoubleNamespaceParity(doublesSrc, testIndexSrc), []);
});

// ── (b) engine isolation ─────────────────────────────────────────────────────

test("FIXTURE: findEngineIsolationViolations FLAGS a runtime @xyflow/react import", () => {
  const src = `import { Handle } from "@xyflow/react";\nexport const x = Handle;`;
  const violations = findEngineIsolationViolations(src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "forbidden-engine");
  assert.equal(violations[0].specifier, "@xyflow/react");
});

test("findEngineIsolationViolations does NOT flag a type-only @xyflow/react import", () => {
  const src = `import type { Node } from "@xyflow/react";`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

test("findEngineIsolationViolations FLAGS d3-*, motion, @visx/*, @tanstack/react-virtual, react-use-measure", () => {
  for (const specifier of [
    "d3-shape",
    "motion/react",
    "@visx/shape",
    "@tanstack/react-virtual",
    "react-use-measure",
  ]) {
    const src = `import { x } from "${specifier}";`;
    assert.equal(findEngineIsolationViolations(src).length, 1, specifier);
  }
});

test("findEngineIsolationViolations FLAGS the sibling engine packages by name", () => {
  for (const specifier of [
    "@elabs-ai/components-flow",
    "@elabs-ai/components-charts",
    "@elabs-ai/components-data",
  ]) {
    const src = `import { x } from "${specifier}";`;
    assert.equal(findEngineIsolationViolations(src).length, 1, specifier);
  }
});

test("FIXTURE: findEngineIsolationViolations FLAGS a self-referencing package-name import", () => {
  const src = `import { ProcessMap } from "@elabs-ai/components-process";`;
  const violations = findEngineIsolationViolations(src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "forbidden-barrel");
});

test("findEngineIsolationViolations does NOT flag the permitted /core leaf", () => {
  const src = `import type { ProcessGraph } from "../core/types";\nimport { discoverGraph } from "../core/discover-graph";`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

test("findEngineIsolationViolations does NOT flag @elabs-ai/components-ui", () => {
  const src = `import { Button } from "@elabs-ai/components-ui";`;
  assert.deepEqual(findEngineIsolationViolations(src), []);
});

// REGRESSION (mirrors the charts gate's own regression test): a `from`-less
// `export const X = { … }` must NOT let a later, unrelated `from "…"` bleed in.
test("findRuntimeImportSpecifiers does not bleed a later `from` into a from-less `export const`", () => {
  const src = `
export const TABLE = {
  a: 1,
  b: 2,
};

import type { RealProps } from "../core/types";
`;
  assert.deepEqual(findRuntimeImportSpecifiers(src), []);
});

test("isNonShippedFile: co-located tests/stories are out of the engine-isolation walk", () => {
  assert.equal(isNonShippedFile("doubles.test.tsx"), true);
  assert.equal(isNonShippedFile("contract.test.ts"), true);
  assert.equal(isNonShippedFile("doubles.tsx"), false);
  assert.equal(isNonShippedFile("index.ts"), false);
});

// ── (c) wiring ────────────────────────────────────────────────────────────────

test("FIXTURE: checkWiring FAILS when publishConfig.exports is missing the ./test key", () => {
  const pkgJson = {
    exports: {
      ".": {},
      "./test": { types: "./src/test/index.ts", default: "./src/test/index.ts" },
    },
    publishConfig: { exports: { ".": {} } },
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

// ── (d) manifest exclusion ────────────────────────────────────────────────────

test("FIXTURE: checkManifestExclusion FAILS when a /test subpath is crawled into the manifest", () => {
  const manifest = {
    packages: {
      "@elabs-ai/components-process": {
        subpaths: { "@elabs-ai/components-process/test": { components: [] } },
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
      "@elabs-ai/components-process": {
        subpaths: { "@elabs-ai/components-process/core": { components: [] } },
      },
    },
  };
  assert.deepEqual(checkManifestExclusion(manifest), []);
});
