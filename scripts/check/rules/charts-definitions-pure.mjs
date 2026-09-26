/**
 * charts-definitions-pure — the runtime import closure of `packages/charts/src/definitions/**`
 * and `packages/charts/src/charts/props/**` reaches only pure modules (ADR 0042 §11, RM-172).
 *
 * Definitions and prop groups are read by the `./test` double, the gen step and every chart
 * family, so they must stay free of React, visx, d3, motion and any impure charts/ui module at
 * runtime. The imports are read with the TypeScript parser, not a regex: a top-level
 * `import type` / `export type … from` and a type-position `import("x").Y` are erased and skipped;
 * everything else is a runtime import — including `import { type X }` (a side-effect import under
 * `verbatimModuleSyntax`), a mixed clause, `export * as X from`, a dynamic `import()` (any string
 * or template specifier) and `require()`.
 * The walk follows relative imports TRANSITIVELY: a definition importing a pure-looking
 * local module that itself imports React still fails, because we read that module too, not just
 * the definition's own imports — and a RESOLVED file is always walked, even one already named on
 * `PURE_MODULE_ALLOWLIST` (a listed path is a promise a not-yet-created leaf will be pure, never
 * a trust shortcut once the file exists). Every bare (non-relative) specifier reached this way
 * must be on `PURE_MODULE_ALLOWLIST`. Both root directories are optional — the rule is green
 * while neither exists yet (RM-173..176 create them).
 *
 * The root walk skips `*.test-d.ts` (lockstep type assertions), `*.test.{ts,tsx}` /
 * `*.stories.{ts,tsx}` (RM-175's `definitions.test.ts`) and `__fixtures__/**` (RM-175's
 * fixtures) — none of these ship — plus `definitions/components.ts`, the ADR 0042 §6 module that
 * binds a definition id to its React component (imported only by AutoChart and the A2UI
 * renderer, never by a definition in the ordinary direction). All four are ROOT exemptions only:
 * if a definition reaches one of them through a relative import, the walk still follows it and
 * still fails on whatever impure import it finds there.
 */
import { posix } from "node:path";

import ts from "typescript";

const ROOTS = ["packages/charts/src/definitions", "packages/charts/src/charts/props"];

/** Not shipped, or (`components.ts`) the ADR-sanctioned id→component binding — never a ROOT of
 *  the walk, but still reached and checked if something under ROOTS relatively imports one. */
const ROOT_IGNORE = [
  "**/*.test-d.ts",
  "**/*.{test,stories}.{ts,tsx}",
  "**/__fixtures__/**",
  "**/{node_modules,dist}/**",
  "packages/charts/src/definitions/components.ts",
];

/** Never a real file on disk — exists only so a fixture can prove a resolved file already named
 *  on the allow-list is still walked, not trusted (RM-172 review, minor 2). Keep this entry: a
 *  future RM-173 leaf's path never collides with it (`__fixtures__/**` is a root exemption, not a
 *  real leaf location), and removing it drops that fixture's coverage. */
const ALLOWLIST_TEST_LEAF = "packages/charts/src/definitions/__fixtures__/allowlisted-leaf.ts";

/**
 * Bare specifiers a definition or prop group may import at runtime, plus the repo-relative pure
 * leaf files reached through a relative import. A listed path is checked as an exact string
 * ONLY while nothing resolves there yet (RM-173 has not created the leaf) — once a file exists
 * at that path it is walked like everything else, allow-listed or not. RM-173 appends its real
 * leaves here, one per line, under a `// RM-173` comment, as it creates them (`chart-
 * breakpoint.ts` etc. stay OUT of this list on purpose: they still import React/ui today and
 * must keep failing until the leaf split lands).
 */
export const PURE_MODULE_ALLOWLIST = [
  // ui definition base — RM-170/171
  "@elabs-ai/components-ui/definition",
  ALLOWLIST_TEST_LEAF,
  // Pure leaves — RM-173
  "packages/charts/src/charts/responsive.ts",
  "packages/charts/src/charts/chart-margin.ts",
  "packages/charts/src/charts/chart-stroke.ts",
  "packages/charts/src/charts/chart-opacity.ts",
  "packages/charts/src/charts/chart-interactions.ts",
  "packages/charts/src/charts/chart-a11y-types.ts",
  "packages/charts/src/charts/legend/container-legend-types.ts",
];

/** Exact match, or a subpath of an allow-listed specifier (mirrors charts-test-double's matcher). */
const isAllowedSpecifier = (s) =>
  PURE_MODULE_ALLOWLIST.some((dep) => s === dep || s.startsWith(`${dep}/`));
const isAllowedPath = (path) => PURE_MODULE_ALLOWLIST.includes(path);

/** Resolve a relative specifier from `file` → the repo-relative file it names, or null. */
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
  const resolved = candidates.find((c) => ctx.exists(c) && /\.tsx?$/.test(c));
  return { candidates, resolved };
}

/**
 * Every runtime import in `source` → `[{ specifier, line }]`, read from the TypeScript AST.
 * Skipped (erased at emit): `import type …`, `export type … from`, `import x = require()` marked
 * type-only, and an `ImportTypeNode` (`import("x").Y` / `typeof import("x")` in a type).
 * Counted: any other import or `export … from` declaration (an all-`type` named clause included —
 * `verbatimModuleSyntax` keeps it as a side-effect import), `import x = require("y")`, and a call
 * to `import(…)` or `require(…)` with a string or no-substitution template specifier.
 */
export function findRuntimeImports(source, fileName = "module.tsx") {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const add = (literal) => {
    if (!literal || !ts.isStringLiteralLike(literal)) return;
    const { line } = sf.getLineAndCharacterOfPosition(literal.getStart(sf));
    out.push({ specifier: literal.text, line: line + 1 });
  };
  const walk = (node) => {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause?.isTypeOnly) add(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && !node.isTypeOnly) add(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (!node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference))
        add(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      if (isDynamicImport || isRequire) add(node.arguments[0]);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

const shortPath = (p) => p.replace(/^packages\/charts\/src\//, "");

/**
 * Walk the runtime import closure of `roots` →
 * `[{ file, specifier, line, via }]` violations. `file` is wherever the disallowed specifier is
 * actually written (the root definition, or a module it transitively reaches); `via` is the
 * import chain from the root down to `file` (empty when the root itself is the offender).
 */
export function pureClosureFindings(ctx, roots) {
  const out = [];
  const visited = new Set();
  const parent = new Map(); // file → the file that first imported it

  const chainFor = (file) => {
    const chain = [file];
    for (let cur = file; parent.has(cur); ) {
      cur = parent.get(cur);
      chain.unshift(cur);
    }
    return chain;
  };

  const queue = roots.flatMap((root) => ctx.glob(`${root}/**/*.{ts,tsx}`, { ignore: ROOT_IGNORE }));

  const report = (file, specifier, line) => {
    const chain = chainFor(file);
    out.push({
      file,
      specifier,
      line,
      via: chain.length > 1 ? chain.map(shortPath).join(" → ") : "",
    });
  };

  const visit = (file, specifier, line) => {
    if (!specifier.startsWith(".")) {
      if (!isAllowedSpecifier(specifier)) report(file, specifier, line);
      return;
    }
    const { candidates, resolved } = resolveRelative(ctx, file, specifier);
    if (resolved) {
      if (!visited.has(resolved)) {
        if (!parent.has(resolved)) parent.set(resolved, file);
        queue.push(resolved);
      }
      return;
    }
    // Nothing on disk resolves it (yet) — pass only a path RM-173 has already named.
    if (!candidates.some(isAllowedPath)) report(file, specifier, line);
  };

  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file) || !ctx.exists(file)) continue;
    visited.add(file);
    for (const { specifier, line } of findRuntimeImports(ctx.readFile(file), file))
      visit(file, specifier, line);
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const DEFINITION = "packages/charts/src/definitions/area.definition.ts";
const PROP_GROUP = "packages/charts/src/charts/props/frame-size.ts";
const BREAKPOINT = "packages/charts/src/charts/chart-breakpoint.ts";
const COMPONENTS = "packages/charts/src/definitions/components.ts";
const IMPURE_BREAKPOINT =
  '"use client";\nimport { useState } from "react";\nexport type ChartBreakpoint = "narrow" | "medium" | "wide";\nexport const CHART_BREAKPOINTS: ChartBreakpoint[] = ["narrow", "medium", "wide"];';

export default {
  id: "charts-definitions-pure",
  scope: "packages",
  doc: "The runtime import closure of charts `definitions/**` and `charts/props/**` reaches only `@elabs-ai/components-ui/definition` and allow-listed pure leaves — never React/visx/d3/motion/ui at runtime (`import type` exempt; test/fixture files and `definitions/components.ts` exempt as roots only; ADR 0042 §11).",
  baseline: "none",
  run(ctx) {
    return pureClosureFindings(ctx, ROOTS).map(({ file, specifier, line, via }) => ({
      file,
      line,
      msg: `runtime import of "${specifier}"${via ? ` (via ${via})` : ""} — definitions and prop groups must stay pure at runtime (ADR 0042 §11); use \`import type\`, or move the value into a pure leaf on PURE_MODULE_ALLOWLIST`,
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
          [DEFINITION]:
            'export type N = import("react").ReactNode;\nexport const AREA_DEFINITION = { id: "AreaChart" };',
        },
      }, // a type-position import("x") is erased by TypeScript — not a runtime import
      {
        files: {
          "packages/charts/src/definitions/registry.test-d.ts":
            'import { CHART_DEFINITIONS } from "./registry";\nimport { LineChart } from "../charts";\n// lockstep assertions only run under a type checker',
        },
      }, // *.test-d.ts is exempt — never walked, however impure its imports look
      {
        files: {
          [COMPONENTS]:
            '"use client";\nimport { AreaChart } from "../charts";\nexport const CHART_COMPONENTS = { AreaChart };',
        },
      }, // definitions/components.ts (ADR 0042 §6) is a ROOT exemption — unreferenced, it is never walked
      {
        files: {
          "packages/charts/src/definitions/definitions.test.ts":
            'import { describe, expect, it } from "vitest";\nimport { CHART_DEFINITIONS } from "./registry";\ndescribe("definitions", () => {\n  it("is complete", () => {\n    expect(CHART_DEFINITIONS).toBeDefined();\n  });\n});',
        },
      }, // RM-175's definitions.test.ts matches the test/stories root exemption, however impure vitest looks
      {
        files: {
          "packages/charts/src/definitions/shared-ids.ts": 'export const AREA_ID = "AreaChart";',
          [DEFINITION]:
            'import { AREA_ID } from "./shared-ids.js";\nexport const AREA_DEFINITION = { id: AREA_ID };',
        },
      }, // a `.js`-suffixed relative specifier resolves to its `.ts` source
      {
        files: {
          [DEFINITION]:
            'export type { ReactNode } from "react";\nexport type Api = typeof import("react");\nexport const AREA_DEFINITION = { id: "AreaChart" };',
        },
      }, // `export type … from` and `typeof import("x")` are erased too
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
      {
        files: {
          [DEFINITION]:
            'import { AREA_COMPONENT } from "./components";\nexport const AREA_DEFINITION = { id: "AreaChart", Component: AREA_COMPONENT };',
          [COMPONENTS]:
            '"use client";\nimport { AreaChart } from "../charts";\nexport const AREA_COMPONENT = AreaChart;',
        },
      }, // components.ts is a ROOT exemption only — a definition importing it must still fail
      {
        files: {
          [DEFINITION]: `import { X } from "./__fixtures__/allowlisted-leaf";\nexport const AREA_DEFINITION = { id: "AreaChart", x: X };`,
          [ALLOWLIST_TEST_LEAF]:
            '"use client";\nimport { useState } from "react";\nexport const X = useState;',
        },
      }, // a resolved file already on PURE_MODULE_ALLOWLIST is still walked, not trusted
      {
        files: {
          [DEFINITION]:
            'export const AREA_DEFINITION = { id: "AreaChart", load: () => import("react") };',
        },
      }, // a dynamic import() is a runtime import too
      {
        files: {
          [DEFINITION]:
            'const { scaleLinear } = require("d3-scale");\nexport const AREA_DEFINITION = { id: "AreaChart", scale: scaleLinear };',
        },
      }, // so is require()
      {
        files: {
          [DEFINITION]:
            'export * as R from "react";\nexport const AREA_DEFINITION = { id: "AreaChart" };',
        },
      }, // a namespace re-export (`* as X from`) is a runtime import the re-export regex alone would miss
      {
        files: {
          [DEFINITION]:
            'export * as BP from "../charts/chart-breakpoint";\nexport const AREA_DEFINITION = { id: "AreaChart" };',
          [BREAKPOINT]: IMPURE_BREAKPOINT,
        },
      }, // same, one hop down a relative specifier (React + ui at runtime through chart-breakpoint)
      {
        files: {
          [DEFINITION]:
            'export const AREA_DEFINITION = { id: "AreaChart", load: () => import(`react`) };',
        },
      }, // a dynamic import() with a backtick specifier is a runtime import too
      {
        files: {
          [DEFINITION]:
            'export const AREA_DEFINITION = { id: "AreaChart", load: () => import("react").then((m) => m.useState) };',
        },
      }, // a dynamic import() chained with `.then` is still a runtime import
      {
        files: {
          [DEFINITION]:
            'import d3 = require("d3-scale");\nexport const AREA_DEFINITION = { id: "AreaChart", scale: d3 };',
        },
      }, // `import x = require()` is a runtime import
    ],
  },
};
