/**
 * dashboard-test-double — `@elabs-ai/components-charts/dashboard/test` never drifts (RM-077,
 * ADR 0037 §2). Sibling of `charts-test-double`/`process-test-double`, reusing its shared
 * rungs (b)(c)(d) but pointed at the double's actual location
 * (`packages/charts/src/dashboard/test`) and its own exports key (`./dashboard/test`) —
 * `charts-test-double` only ever checked `packages/charts/src/test` and the package's own
 * `./test` key, so the dashboard double was never covered.
 *   (a) DOUBLE NAMESPACE COMPLETENESS — every PascalCase value export from `doubles.tsx`
 *       (the double is a `DashboardSheet` double) and `contract.ts` (the validating
 *       `DashboardSpecError`/`assertDashboardSpec` helpers) is re-exported from
 *       `dashboard/test/index.ts`.
 *   (b) ENGINE ISOLATION — no runtime import graph from `dashboard/test/**` reaches
 *       `@dnd-kit/*`, `@visx/`, `d3-`, `motion`, `@number-flow/react`, `react-use-measure`,
 *       `@tanstack/react-virtual`, or a dashboard/charts family barrel.
 *   (c) WIRING — `./dashboard/test` in `packages/charts`'s `exports`, `publishConfig.exports`
 *       and a tsup entry (the double is a subpath of `charts`, not its own package).
 *   (d) MANIFEST EXCLUSION — as `charts-test-double` (shared, package-wide scan).
 */
import { MANIFEST } from "./charts-reuse.mjs";
import {
  isComponentExportName,
  parseExportedValueNames,
  sharedRungFindings,
} from "./charts-test-double.mjs";

const CHARTS = "packages/charts";
const DASHBOARD_TEST_DIR = `${CHARTS}/src/dashboard/test`;
const SUBPATH = "./dashboard/test";
const isDashboardBarrel = (s) =>
  /^\.\.\/index(\.ts)?$/.test(s) || // ../index -> the dashboard barrel itself
  /^\.\.\/\.\.\/index$/.test(s) || // ../../index -> the charts trunk barrel
  /^\.\.\/\.\.\/charts(\/index)?$/.test(s) ||
  /^\.\.\/\.\.\/gantt(\/index)?$/.test(s) ||
  /^\.\.\/\.\.\/auto-chart(\/index)?$/.test(s) ||
  s === "@elabs-ai/components-charts" ||
  s === "@elabs-ai/components-charts/dashboard";

// ── fixtures ─────────────────────────────────────────────────────────────────
const WIRED_PKG = JSON.stringify({
  exports: { ".": {}, "./dashboard/test": {} },
  publishConfig: { exports: { ".": {}, "./dashboard/test": {} } },
});
const TSUP =
  'entry: { index: "src/index.ts", "dashboard/test/index": "src/dashboard/test/index.ts" }';
function tree({
  doubles = "export const DashboardSheet = 1;",
  contract = "export class DashboardSpecError extends Error {}\nexport function assertDashboardSpec(x) {\n  return x;\n}",
  index = 'export { DashboardSheet } from "./doubles";\nexport { DashboardSpecError, assertDashboardSpec } from "./contract";',
  extra = {},
  pkg = WIRED_PKG,
  tsup = TSUP,
  subpaths = { "@elabs-ai/components-charts/core": {} },
} = {}) {
  return {
    files: {
      [MANIFEST]: JSON.stringify({
        packages: { "@elabs-ai/components-charts": { components: [], subpaths } },
      }),
      [`${CHARTS}/package.json`]: pkg,
      [`${CHARTS}/tsup.config.ts`]: tsup,
      [`${DASHBOARD_TEST_DIR}/doubles.tsx`]: doubles,
      [`${DASHBOARD_TEST_DIR}/contract.ts`]: contract,
      [`${DASHBOARD_TEST_DIR}/index.ts`]: index,
      ...extra,
    },
  };
}
const importing = (spec) =>
  tree({ extra: { [`${DASHBOARD_TEST_DIR}/primitives.tsx`]: `import { x } from "${spec}";` } });

export default {
  id: "dashboard-test-double",
  scope: "packages",
  doc: "Keep `@elabs-ai/components-charts/dashboard/test` a faithful, engine-free double: re-export `DashboardSheet` and the contract helpers from `dashboard/test/index.ts`, never import @dnd-kit/visx/d3/motion or a dashboard/charts barrel at runtime from `dashboard/test/**`, keep `./dashboard/test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest.",
  baseline: "none",
  run(ctx) {
    const out = [];
    const doublesFile = `${DASHBOARD_TEST_DIR}/doubles.tsx`;
    const contractFile = `${DASHBOARD_TEST_DIR}/contract.ts`;
    const indexFile = `${DASHBOARD_TEST_DIR}/index.ts`;
    if (!ctx.exists(doublesFile) || !ctx.exists(indexFile))
      out.push({
        file: indexFile,
        line: 1,
        msg: "(a) double-namespace: dashboard/test is missing doubles.tsx or index.ts",
      });
    else {
      const exported = parseExportedValueNames(ctx.readFile(indexFile));
      const sources = [doublesFile, ...(ctx.exists(contractFile) ? [contractFile] : [])];
      const required = new Set();
      for (const file of sources)
        for (const name of parseExportedValueNames(ctx.readFile(file)))
          if (isComponentExportName(name)) required.add(name);
      for (const name of [...required].sort())
        if (!exported.has(name))
          out.push({
            file: indexFile,
            line: 1,
            msg: `(a) double-namespace: "${name}" is exported from doubles.tsx/contract.ts but not re-exported from dashboard/test/index.ts — a vi.mock factory proxy throws on it`,
          });
    }
    return [
      ...out,
      ...sharedRungFindings(
        ctx,
        CHARTS,
        {
          forbidden: [
            "@dnd-kit/",
            "@visx/",
            "d3-",
            "motion",
            "@number-flow/react",
            "react-use-measure",
            "@tanstack/react-virtual",
          ],
          isForbiddenBarrel: isDashboardBarrel,
        },
        "pulls the real chart engine or dashboard runtime back in",
        { testDir: DASHBOARD_TEST_DIR, subpath: SUBPATH },
      ),
    ];
  },
  fixtures: {
    pass: [
      tree(),
      tree({
        index:
          'export { DashboardSheet as DashboardSheet } from "./doubles";\nexport { DashboardSpecError, assertDashboardSpec } from "./contract";',
      }),
      tree({
        extra: {
          [`${DASHBOARD_TEST_DIR}/primitives.tsx`]:
            'import { createDashboardStore } from "../core/store";\nimport type { DashboardSpec } from "../core/spec";\nexport const TABLE = {\n  a: 1,\n};',
          [`${CHARTS}/src/dashboard/core/store.ts`]:
            'import { createStore } from "zustand/vanilla";\nexport const createDashboardStore = () => createStore(() => ({}));',
        },
      }),
      tree({ tsup: 'entry: ["src/index.ts", "src/dashboard/test/index.ts"]' }),
    ],
    fail: [
      tree({ index: 'export { DashboardSheet } from "./doubles";' }),
      tree({
        index:
          'export { DashboardSheet } from "./doubles";\nexport type { DashboardSpecError } from "./contract";',
      }),
      ...[
        "@dnd-kit/core",
        "d3-shape",
        "motion/react",
        "@visx/shape",
        "@number-flow/react",
        "react-use-measure",
        "@tanstack/react-virtual",
        "../index",
        "../../index",
        "@elabs-ai/components-charts",
        "@elabs-ai/components-charts/dashboard",
      ].map(importing),
      tree({
        pkg: JSON.stringify({
          exports: { ".": {}, "./dashboard/test": {} },
          publishConfig: { exports: { ".": {} } },
        }),
      }),
      tree({
        pkg: JSON.stringify({
          exports: { ".": {} },
          publishConfig: { exports: { ".": {}, "./dashboard/test": {} } },
        }),
      }),
      tree({ tsup: 'entry: { index: "src/index.ts" }' }),
      tree({
        subpaths: { "@elabs-ai/components-charts/dashboard/test": { components: [] } },
      }),
      { files: { [`${DASHBOARD_TEST_DIR}/index.ts`]: "export {};" } },
    ],
  },
};
