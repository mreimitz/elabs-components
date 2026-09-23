/**
 * eager-heavy-deps — multi-megabyte engines stay out of the entry chunk (ADR 0019).
 * Ported from scripts/check-eager-heavy-deps.mjs.
 *
 * Mermaid, Rive, xterm, React Flow and the viewer's parsers declare no
 * `sideEffects`, so one static import in a barrel-reachable module ships the engine to every
 * consumer. Reach them through `import()`. A module reached only via `lazy(() => import())` may
 * hold the static import if its docblock carries `@lazy-boundary` — and then nothing may import
 * THAT module statically. A watched package's own OPTIONAL peers are heavy for it too: a static
 * edge makes the module unresolvable for consumers who skipped the peer. `import type` erases.
 */

/** Packages whose `src/` is watched. */
export const WATCHED_PACKAGES = ["ai", "terminal", "viewer"];

/** Engines that must never be reached by a static import (entry or subpath). */
export const HEAVY_DEPS = [
  "@rive-app/react-canvas",
  "@rive-app/react-webgl2",
  "@streamdown/cjk",
  "@streamdown/math",
  "@streamdown/mermaid",
  "@xterm/xterm",
  "@xyflow/react",
  "katex",
  "mermaid",
  // `@elabs-ai/components-viewer` file parsers (ADR 0024) — also optional peers.
  "dompurify",
  "jszip",
  "mammoth",
  "papaparse",
  "pdfjs-dist",
  "xlsx",
];

const matchesDep = (specifier, deps) =>
  deps.some((dep) => specifier === dep || specifier.startsWith(`${dep}/`));

/** Static heavy import specifiers (`import type` and dynamic `import()` excluded). */
export function findStaticHeavyImports(source, extraDeps = []) {
  const found = [];
  const heavy = (s) => matchesDep(s, HEAVY_DEPS) || matchesDep(s, extraDeps);
  // `(?!type\s)` skips `import type {T} from` but still catches `import {type T, value} from`.
  const re = /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;
  for (const m of source.matchAll(re)) if (heavy(m[1])) found.push(m[1]);
  const reExport = /(?:^|\n)\s*export\s+(?!type\s)[\s\S]*?\sfrom\s*["']([^"']+)["']/g;
  for (const m of source.matchAll(reExport)) if (heavy(m[1])) found.push(m[1]);
  return found;
}

/** `@lazy-boundary` in JSDoc-tag POSITION only — a prose/backtick mention does not count (R3). */
export function isLazyBoundary(source) {
  return /^[ \t]*(?:\/\*\*|\*)[ \t]*@lazy-boundary\b/m.test(source);
}

/** Relative specifiers imported STATICALLY (any form that keeps the edge). */
export function findStaticRelativeImports(source) {
  const out = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["'](\.[^"']*)["']/g;
  for (const m of source.matchAll(re)) out.push(m[1]);
  return out;
}

/** posix join + normalize for repo-relative paths. */
function joinRel(dir, spec) {
  const parts = [];
  for (const seg of `${dir}/${spec}`.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function resolveRelative(fromFile, specifier, fileSet) {
  const base = joinRel(fromFile.slice(0, fromFile.lastIndexOf("/")), specifier);
  return (
    [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) =>
      fileSet.has(c),
    ) ?? null
  );
}

function optionalPeersOf(ctx, pkg) {
  const rel = `packages/${pkg}/package.json`;
  try {
    return Object.entries(ctx.json(rel).peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional === true)
      .map(([name]) => name);
  } catch {
    return [];
  }
}

function lineOfSpecifier(source, specifier) {
  const i = source.search(
    new RegExp(`["']${specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}["']`),
  );
  return i < 0 ? 1 : source.slice(0, i).split("\n").length;
}

const src = (body, file = "packages/ai/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "eager-heavy-deps",
  scope: "packages",
  doc: "Reach heavy engines (mermaid, Rive, xterm, React Flow, viewer parsers) and a package's own optional peers only via dynamic `import()` or a `@lazy-boundary` module in `ai`/`terminal`/`viewer` src; never import a `@lazy-boundary` module statically.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const pkg of WATCHED_PACKAGES) {
      const files = ctx.glob(`packages/${pkg}/src/**/*.{ts,tsx}`, {
        ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**"],
      });
      const fileSet = new Set(files);
      const boundaries = new Set(files.filter((f) => isLazyBoundary(ctx.readFile(f))));
      const optionalPeers = optionalPeersOf(ctx, pkg);
      for (const file of files) {
        const source = ctx.readFile(file);
        if (!boundaries.has(file)) {
          for (const specifier of findStaticHeavyImports(source, optionalPeers)) {
            out.push({
              file,
              line: lineOfSpecifier(source, specifier),
              key: `${file}::eager-heavy-import::${specifier}`,
              msg: `eager-heavy-import: static import of "${specifier}" puts the engine in the entry chunk — use import(), a @lazy-boundary module, or import type`,
            });
          }
        }
        for (const specifier of findStaticRelativeImports(source)) {
          const target = resolveRelative(file, specifier, fileSet);
          if (target && boundaries.has(target)) {
            out.push({
              file,
              line: lineOfSpecifier(source, specifier),
              key: `${file}::static-import-of-lazy-boundary::${specifier}`,
              msg: `static-import-of-lazy-boundary: "${specifier}" is a @lazy-boundary module — import it via import()`,
            });
          }
        }
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      src(
        'import type { DiagramPlugin } from "@streamdown/mermaid";\nconst load = () => import("mermaid").then((m) => m.default);',
      ),
      src('import type { RiveParameters } from "@rive-app/react-webgl2";'),
      src('export type { ITheme } from "@xterm/xterm";'),
      src(
        'import { cn } from "@elabs-ai/components-ui/lib/cn";\nimport { code } from "@streamdown/code";\nimport { mermaidHelper } from "./mermaid-utils";\nimport { thing } from "mermaid-lookalike";',
      ),
      src('// A drop-in replacement for @streamdown/mermaid\'s plugin.\nconst name = "mermaid";'),
      // a boundary may hold the engine; it is reached via import()
      {
        files: {
          "packages/ai/src/_persona-rive.tsx":
            '/**\n * @lazy-boundary only via import()\n */\nimport { useRive } from "@rive-app/react-webgl2";',
          "packages/ai/src/persona.tsx": 'const Rive = lazy(() => import("./_persona-rive"));',
        },
      },
      // a prose mention of the tag does not make a module a boundary
      {
        files: {
          "packages/ai/src/_conformance.ts":
            "/**\n * Every `@lazy-boundary` sibling module uses THIS declaration.\n */\nexport type A = true;",
          "packages/ai/src/_persona-rive.tsx":
            '/** @lazy-boundary */\nimport { A } from "./_conformance";',
        },
      },
      // unwatched package, tests and stories are out of scope
      src('import mermaid from "mermaid";', "packages/ui/src/x.tsx"),
      src('import mermaid from "mermaid";', "packages/ai/src/x.test.tsx"),
      // `streamdown` is not heavy on its own
      src('import { Streamdown } from "streamdown";', "packages/viewer/src/x.tsx"),
    ],
    fail: [
      src('import { mermaid } from "@streamdown/mermaid";\nconst plugins = { mermaid };'),
      src('import { type RiveParameters, useRive } from "@rive-app/react-webgl2";'),
      src('import "@xterm/xterm";', "packages/terminal/src/x.tsx"),
      src('export { Terminal } from "@xterm/xterm";'),
      src('import renderMathInElement from "katex/contrib/auto-render";'),
      src('import {\n  useRive,\n  Layout,\n} from "@rive-app/react-webgl2";'),
      src('import * as pdf from "pdfjs-dist";', "packages/viewer/src/pdf.tsx"),
      // static import of a boundary
      {
        files: {
          "packages/ai/src/_persona-rive.tsx":
            '/** @lazy-boundary */\nimport { useRive } from "@rive-app/react-webgl2";',
          "packages/ai/src/persona.tsx": 'import PersonaRive from "./_persona-rive";',
        },
      },
      // a package's own optional peer is heavy for it
      {
        files: {
          "packages/viewer/package.json": JSON.stringify({
            name: "@elabs-ai/components-viewer",
            peerDependenciesMeta: { streamdown: { optional: true } },
          }),
          "packages/viewer/src/md.tsx": 'import { Streamdown } from "streamdown";',
        },
      },
    ],
  },
};
