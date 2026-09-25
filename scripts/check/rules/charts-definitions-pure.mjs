/**
 * charts-definitions-pure — the runtime import closure of `packages/charts/src/definitions/**`
 * and `packages/charts/src/charts/props/**` reaches only pure modules (ADR 0042 §11, RM-172).
 *
 * Definitions and prop groups are read by the `./test` double, the gen step and every chart
 * family, so they must stay free of React, visx, d3, motion and any impure charts/ui module at
 * runtime. `verbatimModuleSyntax` keeps `import { type X }` a side-effect (runtime) import, so
 * only a top-level `import type` is erased — `findRuntimeImportSpecifiers` (charts-test-
 * double.mjs) already tells the two apart, mixed clause and all. The walk follows relative
 * imports TRANSITIVELY: a definition importing a pure-looking local module that itself imports
 * React still fails, because we read that module too, not just the definition's own imports.
 * Every bare (non-relative) specifier reached this way must be on `PURE_MODULE_ALLOWLIST`.
 * Both root directories are optional — the rule is green while neither exists yet (RM-173..176
 * create them). `*.test-d.ts` is exempt: the lockstep type assertions there may import the
 * registry.
 */
import { posix } from "node:path";

import { findRuntimeImportSpecifiers } from "./charts-test-double.mjs";

const ROOTS = ["packages/charts/src/definitions", "packages/charts/src/charts/props"];

/**
 * Bare specifiers a definition or prop group may import at runtime, plus the repo-relative
 * pure leaf files reached through a relative import (checked as an exact path, never resolved
 * from disk — an entry that does not exist yet is tolerated). RM-173 appends its leaves here,
 * one per line, under a `// RM-173` comment, as it creates them (`chart-breakpoint.ts` etc. stay
 * OUT of this list on purpose: they still import React/ui today and must keep failing until the
 * leaf split lands).
 */
export const PURE_MODULE_ALLOWLIST = [
  // ui definition base — RM-170/171
  "@elabs-ai/components-ui/definition",
];

/** Exact match, or a subpath of an allow-listed specifier (mirrors charts-test-double's matcher). */
const isAllowedSpecifier = (s) =>
  PURE_MODULE_ALLOWLIST.some((dep) => s === dep || s.startsWith(`${dep}/`));
const isAllowedPath = (path) => PURE_MODULE_ALLOWLIST.includes(path);

/** Resolve a relative specifier from `file` → the repo-relative file it names, or null. */
function resolveRelative(ctx, file, specifier) {
  const base = posix.normalize(posix.join(posix.dirname(file), specifier));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  const resolved = candidates.find((c) => ctx.exists(c) && /\.tsx?$/.test(c));
  return { candidates, resolved };
}

/**
 * Walk the runtime import closure of `roots` → `[{ file, specifier }]` violations, `file` being
 * wherever the disallowed specifier is actually written (the root definition, or a module it
 * transitively reaches).
 */
export function pureClosureFindings(ctx, roots) {
  const out = [];
  const visited = new Set();
  const queue = roots.flatMap((root) =>
    ctx.glob(`${root}/**/*.{ts,tsx}`, {
      ignore: ["**/*.test-d.ts", "**/{node_modules,dist}/**"],
    }),
  );
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file) || !ctx.exists(file)) continue;
    visited.add(file);
    const source = ctx.readFile(file);
    for (const specifier of findRuntimeImportSpecifiers(source)) {
      if (!specifier.startsWith(".")) {
        if (!isAllowedSpecifier(specifier)) out.push({ file, specifier });
        continue;
      }
      const { candidates, resolved } = resolveRelative(ctx, file, specifier);
      if (resolved) {
        if (!isAllowedPath(resolved) && !visited.has(resolved)) queue.push(resolved);
        continue;
      }
      // Nothing on disk resolves it (yet) — pass only a path RM-173 has already named.
      if (!candidates.some(isAllowedPath)) out.push({ file, specifier });
    }
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const DEFINITION = "packages/charts/src/definitions/area.definition.ts";
const PROP_GROUP = "packages/charts/src/charts/props/frame-size.ts";
const BREAKPOINT = "packages/charts/src/charts/chart-breakpoint.ts";
const IMPURE_BREAKPOINT =
  '"use client";\nimport { useState } from "react";\nexport type ChartBreakpoint = "narrow" | "medium" | "wide";\nexport const CHART_BREAKPOINTS: ChartBreakpoint[] = ["narrow", "medium", "wide"];';

export default {
  id: "charts-definitions-pure",
  scope: "packages",
  doc: "The runtime import closure of `packages/charts/src/definitions/**` and `charts/props/**` reaches only the pure `@elabs-ai/components-ui/definition` base and allow-listed leaves, walked transitively — never React, visx, d3, motion or `@elabs-ai/components-ui` at runtime (`import type` is exempt; `*.test-d.ts` is exempt) (ADR 0042 §11, RM-172).",
  baseline: "none",
  run(ctx) {
    return pureClosureFindings(ctx, ROOTS).map(({ file, specifier }) => ({
      file,
      line: 1,
      msg: `runtime import of "${specifier}" — definitions and prop groups must stay pure at runtime (ADR 0042 §11); use \`import type\`, or move the value into a pure leaf on PURE_MODULE_ALLOWLIST`,
    }));
  },
  fixtures: {
    pass: [
      { files: {} }, // neither root exists yet — green until RM-173..176 create them
      {
        files: {
          [DEFINITION]:
            'import type { ChartBreakpoint } from "../charts/chart-breakpoint";\nimport { field } from "@elabs-ai/components-ui/definition";\nexport const AREA_DEFINITION = { id: "AreaChart", plotHeight: field.number({ default: 240 }) };',
        },
      }, // top-level `import type` is erased; the ui definition base is allow-listed
      {
        files: {
          [PROP_GROUP]:
            'import { definePropGroup, field } from "@elabs-ai/components-ui/definition";\nexport const frameSizeGroup = definePropGroup({ plotHeight: field.number({ default: 320 }) });',
        },
      }, // the props/** root, same allow-list
      {
        files: {
          "packages/charts/src/definitions/shared-ids.ts": 'export const AREA_ID = "AreaChart";',
          [DEFINITION]:
            'import { AREA_ID } from "./shared-ids";\nexport const AREA_DEFINITION = { id: AREA_ID };',
        },
      }, // a genuinely pure relative sibling resolves clean — recursion terminates without a finding
      {
        files: {
          "packages/charts/src/definitions/registry.test-d.ts":
            'import { CHART_DEFINITIONS } from "./registry";\nimport { LineChart } from "../charts";\n// lockstep assertions only run under a type checker',
        },
      }, // *.test-d.ts is exempt — never walked, however impure its imports look
    ],
    fail: [
      {
        files: {
          [DEFINITION]:
            'import { CHART_BREAKPOINTS } from "../charts/chart-breakpoint";\nexport const AREA_DEFINITION = { id: "AreaChart", breakpoints: CHART_BREAKPOINTS };',
          [BREAKPOINT]: IMPURE_BREAKPOINT,
        },
      }, // a seeded runtime import of chart-breakpoint from a definition
      {
        files: {
          [DEFINITION]:
            'import { type ChartBreakpoint, CHART_BREAKPOINTS } from "../charts/chart-breakpoint";\nexport const AREA_DEFINITION: { id: string; b: ChartBreakpoint[] } = { id: "AreaChart", b: CHART_BREAKPOINTS };',
          [BREAKPOINT]: IMPURE_BREAKPOINT,
        },
      }, // mixed `import { type X, Y }` — the value half still makes it a runtime import
      {
        files: {
          [DEFINITION]:
            'import { type ChartBreakpoint } from "../charts/chart-breakpoint";\nexport const AREA_DEFINITION: ChartBreakpoint = "narrow";',
          [BREAKPOINT]: IMPURE_BREAKPOINT,
        },
      }, // `verbatimModuleSyntax` keeps an all-type `import { type X }` a side-effect import
      {
        files: {
          [DEFINITION]:
            'import { AREA_MARGIN } from "../charts/props/area-shared";\nexport const AREA_DEFINITION = { id: "AreaChart", margin: AREA_MARGIN };',
          "packages/charts/src/charts/props/area-shared.ts":
            'import { resolveHostMargin } from "../chart-context";\nexport const AREA_MARGIN = resolveHostMargin();',
          "packages/charts/src/charts/chart-context.tsx":
            '"use client";\nimport { createContext } from "react";\nimport { scaleLinear } from "@visx/scale";\nexport const ChartConfigContext = createContext(null);\nexport function resolveHostMargin() {\n  return { top: 8 };\n}',
        },
      }, // transitive: the definition's own import looks clean; two hops down is React + visx
      {
        files: { [DEFINITION]: 'import { useState } from "react";\nexport const x = useState;' },
      }, // a bare disallowed specifier straight from the definition
      {
        files: {
          [DEFINITION]: 'import { cn } from "@elabs-ai/components-ui";\nexport const x = cn;',
        },
      }, // the ui ROOT barrel is not the same as the `/definition` subpath
    ],
  },
};
