/**
 * charts-test-double — `@elabs-ai/components-charts/test` never drifts (#364).
 * Ported from scripts/check-charts-test-double.mjs. Four rungs:
 *   (a) COMPONENT PARITY — every PascalCase component in the manifest's charts
 *       "components" bucket has a same-named value export from `src/test/index.ts`
 *       (Vitest's `vi.mock` factory proxy throws on any omitted export). SCREAMING_SNAKE
 *       constants are out of scope (they live in @visx-backed modules).
 *   (b) ENGINE ISOLATION — the runtime import graph rooted at the shipped files of
 *       `src/test/**` (tests/stories excluded, relative imports followed) never reaches
 *       `@visx/*`, `d3-*`, `motion`, `@number-flow/react`, `react-use-measure`,
 *       `@tanstack/react-virtual`, or a package/family barrel.
 *   (c) WIRING — `./test` in `exports`, `publishConfig.exports`, and a tsup entry.
 *   (d) MANIFEST EXCLUSION — no `…/test` subpath is crawled into brand-ui.manifest.json.
 * Shared helpers are exported for `process-test-double`.
 */
import { posix } from "node:path";

import { MANIFEST } from "./charts-reuse.mjs";

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** PascalCase and not SCREAMING_SNAKE. */
export const isComponentExportName = (name) => /^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name);

/** VALUE export names: `export { A, B as C }`, `export const|function|class X` (not `export type {}`). */
export function parseExportedValueNames(src) {
  const code = stripComments(src);
  const names = new Set();
  for (const m of code.matchAll(/export\s+(?!type\b)\{([\s\S]*?)\}/g))
    for (const part of m[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const name = (trimmed.match(/\bas\s+([A-Za-z0-9_$]+)/)?.[1] ?? trimmed).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  for (const m of code.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z0-9_$]+)/g))
    names.add(m[1]);
  return names;
}

/** RUNTIME import / re-export specifiers (re-export half anchored to `{…}`/`*`). */
export function findRuntimeImportSpecifiers(source) {
  const found = [];
  for (const m of source.matchAll(
    /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g,
  ))
    found.push(m[1]);
  for (const m of source.matchAll(
    /(?:^|\n)\s*export\s+(?!type\s)(?:\*|\{[\s\S]*?\})\s*from\s*["']([^"']+)["']/g,
  ))
    found.push(m[1]);
  return found;
}

const specifierMatcher = (list) => (s) =>
  list.some((dep) => s === dep || s === dep.replace(/-$/, "") || s.startsWith(dep));

/**
 * Rung (b): walk the runtime import graph from the shipped files under `testDir`.
 * @returns {{ file, specifier, rule: "forbidden-barrel"|"forbidden-engine" }[]}
 */
export function engineIsolationFindings(ctx, testDir, { forbidden, isForbiddenBarrel }) {
  const isForbidden = specifierMatcher(forbidden);
  const out = [];
  const visited = new Set();
  const queue = ctx.glob(`${testDir}/**/*.{ts,tsx}`, {
    ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**"],
  });
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file) || !ctx.exists(file)) continue;
    visited.add(file);
    const source = ctx.readFile(file);
    for (const specifier of findRuntimeImportSpecifiers(source)) {
      if (isForbiddenBarrel(specifier)) {
        out.push({ file, specifier, rule: "forbidden-barrel" });
        continue;
      }
      if (isForbidden(specifier)) out.push({ file, specifier, rule: "forbidden-engine" });
      if (!specifier.startsWith(".")) continue;
      const base = posix.normalize(posix.join(posix.dirname(file), specifier));
      const target = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ].find((c) => ctx.exists(c) && /\.tsx?$/.test(c));
      if (target && !visited.has(target)) queue.push(target);
    }
  }
  return out;
}

/** Rung (c) → problem strings. */
export function checkWiring(pkgJson, tsupSrc) {
  const problems = [];
  if (!pkgJson?.exports?.["./test"])
    problems.push('package.json "exports" is missing the "./test" key');
  if (!pkgJson?.publishConfig?.exports?.["./test"])
    problems.push('package.json "publishConfig.exports" is missing the "./test" key');
  if (!/["']test\/index["']\s*:/.test(tsupSrc) && !/test\/index\.ts/.test(tsupSrc))
    problems.push('tsup.config.ts has no entry for "test/index" (src/test/index.ts)');
  return problems;
}

/** Rungs (b)(c)(d) as findings for one package dir (`packages/<name>`). */
export function sharedRungFindings(ctx, pkgDir, isolation, barrelReason) {
  const out = [];
  const testDir = `${pkgDir}/src/test`;
  for (const v of engineIsolationFindings(ctx, testDir, isolation))
    out.push({
      file: v.file,
      line: 1,
      msg:
        v.rule === "forbidden-barrel"
          ? `(b) engine-isolation: imports a package/family barrel ("${v.specifier}") — ${barrelReason}`
          : `(b) engine-isolation: imports the rendering engine ("${v.specifier}") at runtime — jsdom cannot render it`,
    });
  const pkgPath = `${pkgDir}/package.json`;
  const tsupPath = `${pkgDir}/tsup.config.ts`;
  if (ctx.exists(pkgPath) && ctx.exists(tsupPath)) {
    for (const p of checkWiring(ctx.json(pkgPath), ctx.readFile(tsupPath)))
      out.push({ file: pkgPath, line: 1, msg: `(c) wiring: ${p}` });
  } else
    out.push({
      file: pkgPath,
      line: 1,
      msg: "(c) wiring: package.json or tsup.config.ts is missing",
    });
  if (ctx.exists(MANIFEST))
    for (const [pkgName, pkg] of Object.entries(ctx.json(MANIFEST)?.packages ?? {}))
      for (const subpath of Object.keys(pkg?.subpaths ?? {}))
        if (/\/test$/.test(subpath))
          out.push({
            file: MANIFEST,
            line: 1,
            msg: `(d) manifest-exclusion: "${subpath}" (${pkgName}) is crawled into the manifest — restore the /test denylist in readSubpathBarrels (packages/cli/lib/core.mjs)`,
          });
  return out;
}

const CHARTS = "packages/charts";
const isChartsBarrel = (s) =>
  /^\.\.\/charts(\/index)?$/.test(s) ||
  /^\.\.\/gantt(\/index)?$/.test(s) ||
  /^\.\.\/auto-chart(\/index)?$/.test(s) ||
  /^\.\.\/index$/.test(s) ||
  /^\.\.\/\.\.\/index$/.test(s) ||
  s === "@elabs-ai/components-charts";

// ── fixtures ─────────────────────────────────────────────────────────────────
const WIRED_PKG = JSON.stringify({
  exports: { ".": {}, "./test": {} },
  publishConfig: { exports: { ".": {}, "./test": {} } },
});
const TSUP = 'entry: { index: "src/index.ts", "test/index": "src/test/index.ts" }';
function tree({
  components = ["LineChart", "Line", "XAxis", "DEFAULT_CHART_STATUS"],
  index = 'export { LineChart, Line, XAxis } from "./doubles";\nexport type { LineChartProps } from "../charts/line-chart";',
  extra = {},
  pkg = WIRED_PKG,
  tsup = TSUP,
  subpaths = { "@elabs-ai/components-charts/core": {} },
} = {}) {
  return {
    files: {
      [MANIFEST]: JSON.stringify({
        packages: {
          "@elabs-ai/components-charts": {
            components: components.map((name) => ({ name })),
            subpaths,
          },
        },
      }),
      [`${CHARTS}/package.json`]: pkg,
      [`${CHARTS}/tsup.config.ts`]: tsup,
      [`${CHARTS}/src/test/index.ts`]: index,
      [`${CHARTS}/src/test/doubles.tsx`]:
        'import { forwardRef } from "react";\nexport const LineChart = 1;',
      ...extra,
    },
  };
}

export default {
  id: "charts-test-double",
  scope: "packages",
  doc: "Keep `@elabs-ai/components-charts/test` a faithful, engine-free double: export every real component from `src/test/index.ts`, never import @visx/d3/motion or a chart barrel at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest.",
  baseline: "none",
  run(ctx) {
    const out = [];
    if (!ctx.exists(MANIFEST))
      return [{ file: MANIFEST, line: 1, msg: `${MANIFEST} not found — run \`pnpm manifest\`` }];
    const chartsPkg = ctx.json(MANIFEST)?.packages?.["@elabs-ai/components-charts"];
    if (!chartsPkg)
      return [
        { file: MANIFEST, line: 1, msg: "manifest has no @elabs-ai/components-charts entry" },
      ];
    const indexFile = `${CHARTS}/src/test/index.ts`;
    if (!ctx.exists(indexFile))
      out.push({ file: indexFile, line: 1, msg: "(a) component-parity: file does not exist" });
    else {
      const exported = parseExportedValueNames(ctx.readFile(indexFile));
      const required = [
        ...new Set((chartsPkg.components ?? []).map((c) => c.name).filter(isComponentExportName)),
      ].sort();
      for (const name of required)
        if (!exported.has(name))
          out.push({
            file: indexFile,
            line: 1,
            msg: `(a) component-parity: "${name}" is exported by the real barrel but not by src/test/index.ts — a vi.mock factory proxy throws on it`,
          });
    }
    return [
      ...out,
      ...sharedRungFindings(
        ctx,
        CHARTS,
        {
          forbidden: [
            "@visx/",
            "d3-",
            "motion",
            "@number-flow/react",
            "react-use-measure",
            "@tanstack/react-virtual",
          ],
          isForbiddenBarrel: isChartsBarrel,
        },
        "pulls every @visx-backed chart",
      ),
    ];
  },
  fixtures: {
    pass: [
      tree(),
      tree({
        index:
          'export { LineChart } from "./doubles";\nexport const Line = 1;\nexport function XAxis() {}',
      }),
      tree({
        extra: {
          [`${CHARTS}/src/test/doubles.tsx`]:
            'import type { ScaleTime } from "@visx/scale";\nimport { ChartA11yLabel } from "../charts/chart-a11y";\nimport { MetricCard } from "@elabs-ai/components-ui";\nexport const TABLE = {\n  a: 1,\n};\n\nimport type { RealProps } from "../charts/area-chart";',
          [`${CHARTS}/src/charts/chart-a11y.tsx`]: 'import { forwardRef } from "react";',
          [`${CHARTS}/src/test/mock-namespace.test.tsx`]:
            'import * as real from "../index";\nimport "@visx/shape";',
        },
      }),
      tree({ tsup: 'entry: ["src/index.ts", "src/test/index.ts"]' }),
    ],
    fail: [
      tree({ index: 'export { LineChart } from "./doubles";' }),
      tree({
        index:
          'export { LineChart } from "./doubles";\nexport type { Line, XAxis } from "./types";',
      }),
      tree({
        extra: {
          [`${CHARTS}/src/test/doubles.tsx`]:
            'import { Bar } from "@visx/shape";\nexport const x = Bar;',
        },
      }),
      ...[
        "d3-shape",
        "motion/react",
        "react-use-measure",
        "@tanstack/react-virtual",
        "@number-flow/react",
      ].map((s) =>
        tree({ extra: { [`${CHARTS}/src/test/doubles.tsx`]: `import { x } from "${s}";` } }),
      ),
      tree({ extra: { [`${CHARTS}/src/test/doubles.tsx`]: 'export * from "../charts";' } }),
      tree({
        extra: {
          [`${CHARTS}/src/test/doubles.tsx`]:
            'import { LineChart } from "@elabs-ai/components-charts";',
        },
      }),
      // a permitted leaf that later grows a bad import is caught through the walk
      tree({
        extra: {
          [`${CHARTS}/src/test/doubles.tsx`]:
            'import { ChartA11yLabel } from "../charts/chart-a11y";',
          [`${CHARTS}/src/charts/chart-a11y.tsx`]: 'import { Group } from "@visx/group";',
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
      tree({ subpaths: { "@elabs-ai/components-charts/test": { components: [] } } }),
    ],
  },
};
