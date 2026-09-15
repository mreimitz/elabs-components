/**
 * process-test-double — `@elabs-ai/components-process/test` never drifts (RM-053, #228).
 * Ported from scripts/check-process-test-double.mjs (a fork of the charts gate).
 *   (a) DOUBLE NAMESPACE COMPLETENESS — every PascalCase value `src/test/doubles.tsx`
 *       exports is re-exported from `src/test/index.ts`. Deliberately narrower than the
 *       charts real-barrel parity while `process`'s `.` barrel ships no components.
 *   (b) ENGINE ISOLATION — no runtime import graph from `src/test/**` reaches
 *       `@xyflow/react`, `@visx/`, `d3-`, `motion`, `@tanstack/react-virtual`,
 *       `react-use-measure`, flow/charts/data, or this package's own barrel.
 *   (c) WIRING and (d) MANIFEST EXCLUSION — as `charts-test-double`.
 */
import { MANIFEST } from "./charts-reuse.mjs";
import {
  isComponentExportName,
  parseExportedValueNames,
  sharedRungFindings,
} from "./charts-test-double.mjs";

const PROCESS = "packages/process";
const isProcessBarrel = (s) =>
  /^\.\.\/index$/.test(s) || /^\.\.\/\.\.\/index$/.test(s) || s === "@elabs-ai/components-process";

// ── fixtures ─────────────────────────────────────────────────────────────────
const WIRED_PKG = JSON.stringify({
  exports: { ".": {}, "./test": {} },
  publishConfig: { exports: { ".": {}, "./test": {} } },
});
function tree({
  doubles = "export const ProcessMapDouble = 1;\nexport const VariantExplorerDouble = 2;\nexport const DEFAULT_SPEC = 3;",
  index = 'export { ProcessMapDouble, VariantExplorerDouble } from "./doubles";\nexport { withProcessFixture } from "./primitives";',
  extra = {},
  pkg = WIRED_PKG,
  tsup = 'entry: { index: "src/index.ts", "test/index": "src/test/index.ts" }',
  manifest = {
    packages: {
      "@elabs-ai/components-process": { subpaths: { "@elabs-ai/components-process/core": {} } },
    },
  },
} = {}) {
  return {
    files: {
      [MANIFEST]: JSON.stringify(manifest),
      [`${PROCESS}/package.json`]: pkg,
      [`${PROCESS}/tsup.config.ts`]: tsup,
      [`${PROCESS}/src/test/doubles.tsx`]: doubles,
      [`${PROCESS}/src/test/index.ts`]: index,
      ...extra,
    },
  };
}
const importing = (spec) =>
  tree({ extra: { [`${PROCESS}/src/test/primitives.tsx`]: `import { x } from "${spec}";` } });

export default {
  id: "process-test-double",
  scope: "packages",
  doc: "Keep `@elabs-ai/components-process/test` complete and engine-free: re-export every double from `src/test/index.ts`, never import React Flow/visx/d3/motion or flow/charts/data/process barrels at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest.",
  baseline: "none",
  run(ctx) {
    const out = [];
    const doublesFile = `${PROCESS}/src/test/doubles.tsx`;
    const indexFile = `${PROCESS}/src/test/index.ts`;
    if (!ctx.exists(doublesFile) || !ctx.exists(indexFile))
      out.push({
        file: indexFile,
        line: 1,
        msg: "(a) double-namespace: src/test is missing doubles.tsx or index.ts",
      });
    else {
      const exported = parseExportedValueNames(ctx.readFile(indexFile));
      for (const name of [...parseExportedValueNames(ctx.readFile(doublesFile))]
        .filter(isComponentExportName)
        .sort())
        if (!exported.has(name))
          out.push({
            file: indexFile,
            line: 1,
            msg: `(a) double-namespace: "${name}" is exported from doubles.tsx but not re-exported from test/index.ts — a vi.mock factory proxy throws on it`,
          });
    }
    return [
      ...out,
      ...sharedRungFindings(
        ctx,
        PROCESS,
        {
          forbidden: [
            "@xyflow/react",
            "@visx/",
            "d3-",
            "motion",
            "@tanstack/react-virtual",
            "react-use-measure",
            "@elabs-ai/components-flow",
            "@elabs-ai/components-charts",
            "@elabs-ai/components-data",
          ],
          isForbiddenBarrel: isProcessBarrel,
        },
        "pulls the real engine back in",
      ),
    ];
  },
  fixtures: {
    pass: [
      tree(),
      tree({
        index:
          'export { ProcessMapDouble as ProcessMapDouble, VariantExplorerDouble } from "./doubles";',
      }),
      tree({
        extra: {
          [`${PROCESS}/src/test/primitives.tsx`]:
            'import type { Node } from "@xyflow/react";\nimport type { ProcessGraph } from "../core/types";\nimport { discoverGraph } from "../core/discover-graph";\nimport { Button } from "@elabs-ai/components-ui";\nexport const TABLE = {\n  a: 1,\n};\n\nimport type { RealProps } from "../core/types";',
          [`${PROCESS}/src/core/discover-graph.ts`]: "export const discoverGraph = () => null;",
          [`${PROCESS}/src/test/doubles.test.tsx`]:
            'import "@xyflow/react";\nimport * as real from "../index";',
        },
      }),
    ],
    fail: [
      tree({ index: 'export { ProcessMapDouble } from "./doubles";' }),
      tree({
        index:
          'export { ProcessMapDouble } from "./doubles";\nexport type { VariantExplorerDouble } from "./doubles";',
      }),
      ...[
        "@xyflow/react",
        "d3-shape",
        "motion/react",
        "@visx/shape",
        "@tanstack/react-virtual",
        "react-use-measure",
        "@elabs-ai/components-flow",
        "@elabs-ai/components-charts",
        "@elabs-ai/components-data",
        "@elabs-ai/components-process",
        "../index",
      ].map(importing),
      tree({
        extra: {
          [`${PROCESS}/src/test/primitives.tsx`]:
            'import { discoverGraph } from "../core/discover-graph";',
          [`${PROCESS}/src/core/discover-graph.ts`]:
            'import { useMemo } from "react";\nimport { scaleLinear } from "d3-scale";',
        },
      }),
      tree({
        pkg: JSON.stringify({
          exports: { ".": {}, "./test": {} },
          publishConfig: { exports: { ".": {} } },
        }),
      }),
      tree({
        pkg: JSON.stringify({
          exports: { ".": {} },
          publishConfig: { exports: { ".": {}, "./test": {} } },
        }),
      }),
      tree({ tsup: 'entry: { index: "src/index.ts" }' }),
      tree({
        manifest: {
          packages: {
            "@elabs-ai/components-process": {
              subpaths: { "@elabs-ai/components-process/test": { components: [] } },
            },
          },
        },
      }),
      { files: { [`${PROCESS}/src/test/index.ts`]: "export {};" } },
    ],
  },
};
