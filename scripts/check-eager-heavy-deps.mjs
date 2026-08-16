#!/usr/bin/env node
/**
 * check-eager-heavy-deps.mjs — keeps multi-megabyte engines out of the entry chunk.
 *
 * Some dependencies are engines, not components: Mermaid (which drags d3 and
 * DOMPurify), the Rive WebGL2 runtime, xterm, React Flow, media-chrome. None of
 * them declares `sideEffects`, so a bundler MUST retain a static import edge even
 * when the component that needs it never renders. One `import { … } from "…"` at
 * the top of a barrel-reachable module therefore puts megabytes into the entry
 * chunk of every consumer, including the majority who never use the feature.
 *
 * `packages/ai/package.json` says `"sideEffects": false`, which frees @qlik-coe-emea/qlabs-components-ai's
 * OWN modules — it does nothing for the dependency. The only fix is to reach the
 * engine through a dynamic `import()`.
 *
 * This gate is a source-level RATCHET: it fails when a listed package gains a new
 * STATIC import site under a watched package's `src/`. Existing sites live in
 * `scripts/eager-heavy-deps-baseline.json` and the count may only go DOWN
 * (`--update` after you make one lazy). It is deliberately source-level: grepping
 * a production build per-PR is far too slow, and the static edge is the actual
 * cause.
 *
 * `import type { … }` is NOT a violation — type imports erase at build.
 *
 * ## Lazy boundaries
 *
 * Making an engine lazy usually means SPLITTING it into a module that is reached
 * only through `lazy(() => import("./x"))`. That module legitimately imports the
 * engine statically — its whole job is to be the chunk the engine lands in. Mark
 * it with an `@lazy-boundary` docblock tag:
 *
 *     /** … @lazy-boundary … *\/
 *
 * The marker is load-bearing, not a rubber stamp: a second rule asserts that
 * nothing STATICALLY imports a `@lazy-boundary` module. Import it statically and
 * the engine is back in the entry chunk, and the gate says so.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the baseline (only accepts a same-or-lower count).
 *
 * Dependency-free; ESM; locates packages relative to this file (cwd-independent).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE = join(SCRIPT_DIR, "eager-heavy-deps-baseline.json");

/** Packages whose `src/` is watched. */
export const WATCHED_PACKAGES = ["ai", "viewer"];

/**
 * Engines that must never be reached by a static import.
 * A specifier matches if it equals the entry or is a subpath of it.
 */
export const HEAVY_DEPS = [
  "@rive-app/react-canvas",
  "@rive-app/react-webgl2",
  "@streamdown/mermaid",
  "@xterm/xterm",
  "@xyflow/react",
  "media-chrome",
  "mermaid",
  // `@qlik-coe-emea/qlabs-components-viewer` file parsers (ADR 0024). These are
  // OPTIONAL PEERS, so the dynamic-import requirement is doubly load-bearing: a
  // static edge does not merely bloat the entry chunk, it makes the package fail
  // to resolve for every consumer that did not install that parser.
  "dompurify",
  "jszip",
  "mammoth",
  "papaparse",
  "pdfjs-dist",
  "xlsx",
];

const matchesDep = (specifier, deps) =>
  deps.some((dep) => specifier === dep || specifier.startsWith(`${dep}/`));

const isHeavy = (specifier) => matchesDep(specifier, HEAVY_DEPS);

/**
 * A watched package's OPTIONAL peer dependencies, which are heavy for that
 * package whether or not they are on the list above.
 *
 * Derived rather than listed because the consequence is harsher than bundle
 * weight: an optional peer reached by a static import makes the module
 * UNRESOLVABLE for every consumer who chose not to install it — a build error,
 * not a slow page. Deriving it means a newly-declared optional peer is policed
 * the moment it is declared, with nothing to remember. `@qlik-coe-emea/qlabs-components-ai`
 * declares none, so this rule is presently about `viewer`'s parser engines.
 *
 * @param {string} root
 * @param {string} pkg
 * @returns {string[]}
 */
export function optionalPeersOf(root, pkg) {
  try {
    const manifest = JSON.parse(readFileSync(join(root, "packages", pkg, "package.json"), "utf8"));
    return Object.entries(manifest.peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional === true)
      .map(([name]) => name);
  } catch {
    return [];
  }
}

/**
 * Static import specifiers in a module, excluding `import type` (erased) and
 * dynamic `import(...)` (the whole point of the fix).
 *
 * @param {string} source
 * @returns {string[]}
 */
export function findStaticHeavyImports(source, extraDeps = []) {
  const found = [];
  const heavy = (specifier) => isHeavy(specifier) || matchesDep(specifier, extraDeps);

  // `import … from "x"` / `import "x"` — but NOT `import type … from "x"`.
  // The `(?!type\s)` guard sits right after `import` so `import type {T} from`
  // is skipped while `import {type T, value} from` (a mixed import, which does
  // emit a runtime edge) is still caught.
  const re = /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;
  for (const m of source.matchAll(re)) {
    if (heavy(m[1])) found.push(m[1]);
  }

  // `export … from "x"` re-exports the module and keeps the edge too.
  const reExport = /(?:^|\n)\s*export\s+(?!type\s)[\s\S]*?\sfrom\s*["']([^"']+)["']/g;
  for (const m of source.matchAll(reExport)) {
    if (heavy(m[1])) found.push(m[1]);
  }

  return found;
}

/** A module declaring itself reachable only through a dynamic `import()`. */
export function isLazyBoundary(source) {
  return /@lazy-boundary\b/.test(source);
}

/**
 * Relative specifiers this module imports STATICALLY (any form that keeps the
 * edge). Used to prove nobody statically imports a `@lazy-boundary` module.
 */
export function findStaticRelativeImports(source) {
  const out = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["'](\.[^"']*)["']/g;
  for (const m of source.matchAll(re)) out.push(m[1]);
  return out;
}

/** Every `.ts`/`.tsx` under `dir`, excluding tests and stories. */
function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Resolve a relative import specifier to the source file it names, if any. */
function resolveRelative(fromFile, specifier) {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/** @returns {{ file: string, specifier: string, rule: string }[]} sorted deterministically. */
export function collectViolations({ root = REPO_ROOT, packages = WATCHED_PACKAGES } = {}) {
  const out = [];
  for (const pkg of packages) {
    const src = join(root, "packages", pkg, "src");
    let stat;
    try {
      stat = statSync(src);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const files = sourceFiles(src);
    const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
    const boundaries = new Set(files.filter((f) => isLazyBoundary(sources.get(f))));
    const optionalPeers = optionalPeersOf(root, pkg);

    for (const file of files) {
      const rel = relative(root, file);
      const source = sources.get(file);

      // A lazy boundary is ALLOWED to hold the static engine import — that is
      // the point of the split. Rule 2 below keeps the marker honest.
      if (!boundaries.has(file)) {
        for (const specifier of findStaticHeavyImports(source, optionalPeers)) {
          out.push({ file: rel, rule: "eager-heavy-import", specifier });
        }
      }

      // Nobody may statically import a lazy boundary, or the engine is back in
      // the entry chunk and the `lazy()` was pointless.
      for (const specifier of findStaticRelativeImports(source)) {
        const target = resolveRelative(file, specifier);
        if (target && boundaries.has(target)) {
          out.push({ file: rel, rule: "static-import-of-lazy-boundary", specifier });
        }
      }
    }
  }
  return out.sort((a, b) =>
    `${a.file}${a.rule}${a.specifier}`.localeCompare(`${b.file}${b.rule}${b.specifier}`),
  );
}

const key = (v) => `${v.file}::${v.rule}::${v.specifier}`;

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const update = argv.includes("--update");

  const violations = collectViolations();
  const current = violations.map(key);

  if (update) {
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`✔ eager-heavy-deps: baseline updated — ${current.length} eager site(s).`);
    return 0;
  }

  let baseline = [];
  try {
    baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    console.error(`✖ eager-heavy-deps: missing baseline at ${BASELINE} (run with --update).`);
    return warnOnly ? 0 : 1;
  }

  const allowed = new Set(baseline);
  const added = current.filter((k) => !allowed.has(k));

  if (added.length === 0) {
    const stale = baseline.filter((k) => !current.includes(k));
    const note = stale.length
      ? ` ${stale.length} baseline entr(y/ies) now clean — run \`--update\` to ratchet down.`
      : "";
    console.log(
      `✔ eager-heavy-deps: no new static imports of a heavy engine (${current.length} known eager site(s)).${note}`,
    );
    return 0;
  }

  console.error("✖ eager-heavy-deps: an engine is reachable from the entry chunk:");
  for (const k of added) console.error(`  ${k}`);
  console.error(
    "\n  eager-heavy-import: these packages declare no `sideEffects`, so a static edge\n" +
      "    puts the whole engine in the entry chunk of every consumer — even ones that\n" +
      "    never render the feature. Reach it through a dynamic `import()` (see\n" +
      "    packages/ai/src/_lazy-mermaid.ts), split it behind `lazy()` into a module\n" +
      "    tagged `@lazy-boundary` (see packages/ai/src/_persona-rive.tsx), or use\n" +
      "    `import type` if you only need types.\n" +
      "\n  static-import-of-lazy-boundary: importing a `@lazy-boundary` module statically\n" +
      "    drags its engine straight back into the entry chunk. Use `import()`.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
