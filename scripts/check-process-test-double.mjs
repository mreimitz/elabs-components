#!/usr/bin/env node
/**
 * check-process-test-double.mjs — anti-drift gate for `@elabs-ai/components-process/test`
 * (RM-053, issue #228).
 *
 * A FORK of `check-charts-test-double.mjs` (#364), not an extension of it — that script
 * locates everything relative to `packages/charts` with no package parameter, so
 * generalising it would mean threading a package argument through every path/regex in a
 * script this gate's own author does not own. The roadmap item that asked for this
 * (`RM-053-fixtures-test-doubles-storybook-section.md`) explicitly allows this fallback:
 * "only add the analogue script if the charts gate is hard-coded to `packages/charts`" — it
 * is, so this is a fork.
 *
 * One rung is DELIBERATELY NARROWER than the charts original, documented here rather than
 * silently diverging: rung (a) below checks every export `doubles.tsx` declares is
 * re-exported from `test/index.ts` (namespace completeness WITHIN `src/test/`), not parity
 * against the real `.` barrel's component list — because `packages/process/src/index.ts`
 * intentionally ships zero components today (RM-051/052/054 land the first ones). Once a
 * real component lands with the same name as one of these doubles (dropping its `Double`
 * suffix — see `packages/process/src/test/contract.ts`'s header), this rung should be
 * widened to match the charts original's real-barrel parity.
 *
 *   (a) DOUBLE NAMESPACE COMPLETENESS — every value `doubles.tsx` exports has a same-named
 *       export from `test/index.ts` (Vitest's `vi.mock` factory proxy throws on ANY omitted
 *       export the moment consumer code reads the binding).
 *   (b) ENGINE ISOLATION — no RUNTIME (non `import type`) import under `src/test/**` reaches
 *       `@xyflow/react`, `@visx/`, `d3-`, `motion`, `@tanstack/react-virtual`,
 *       `react-use-measure`, or a package/family barrel (`@elabs-ai/components-process`,
 *       `@elabs-ai/components-flow`, `@elabs-ai/components-charts`, `@elabs-ai/components-data`,
 *       this package's own root `index.ts`) — any of those pulls a real rendering engine back
 *       into a jsdom test.
 *   (c) WIRING — the `./test` key exists in `package.json`'s `exports`, in
 *       `publishConfig.exports`, and as a `tsup.config.ts` entry.
 *   (d) MANIFEST EXCLUSION — no `…/test` subpath is crawled into `brand-ui.manifest.json`.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates the package relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const PROCESS_DIR = join(REPO_ROOT, "packages", "process");
const TEST_SRC_DIR = join(PROCESS_DIR, "src", "test");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * Parse the VALUE export names a module declares — `export { A, B as C }`,
 * `export const X`, `export function X`. Regex-level, same idiom as
 * `check-charts-test-double.mjs`'s `parseExportedValueNames`.
 * @param {string} src
 * @returns {Set<string>}
 */
export function parseExportedValueNames(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const names = new Set();
  for (const m of code.matchAll(/export\s+(?!type\b)\{([\s\S]*?)\}/g)) {
    for (const part of m[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.match(/\bas\s+([A-Za-z0-9_$]+)/);
      const name = (asMatch ? asMatch[1] : trimmed).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  }
  for (const m of code.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(m[1]);
  }
  return names;
}

/** `true` for a name shaped like a component/double (PascalCase, not SCREAMING_SNAKE). */
export function isComponentExportName(name) {
  return /^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name);
}

/** Rung (a). @returns {string[]} missing names, sorted */
export function checkDoubleNamespaceParity(doublesSrc, testIndexSrc) {
  const required = [...parseExportedValueNames(doublesSrc)].filter(isComponentExportName).sort();
  const exported = parseExportedValueNames(testIndexSrc);
  return required.filter((n) => !exported.has(n));
}

// ── Rung (b): engine isolation ──────────────────────────────────────────────

export const FORBIDDEN_RUNTIME_SPECIFIERS = [
  "@xyflow/react",
  "@visx/",
  "d3-",
  "motion",
  "@tanstack/react-virtual",
  "react-use-measure",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-charts",
  "@elabs-ai/components-data",
];

function isForbiddenSpecifier(specifier) {
  return FORBIDDEN_RUNTIME_SPECIFIERS.some(
    (dep) => specifier === dep || specifier === dep.replace(/-$/, "") || specifier.startsWith(dep),
  );
}

/** A specifier that resolves to this package's OWN root barrel — the most natural accidental re-entry. */
function isForbiddenBarrel(specifier) {
  return (
    /^\.\.\/index$/.test(specifier) ||
    /^\.\.\/\.\.\/index$/.test(specifier) ||
    specifier === "@elabs-ai/components-process"
  );
}

/**
 * RUNTIME (non `import type`) import/re-export specifiers in `source`. Mirrors
 * `check-charts-test-double.mjs`'s `findRuntimeImportSpecifiers` (see that file's comment
 * for why the re-export half is anchored to `\{…\}`/`*` — a `from`-less
 * `export const TABLE = {…}` must not bleed into a later unrelated `from "…"`).
 * @param {string} source
 * @returns {string[]}
 */
export function findRuntimeImportSpecifiers(source) {
  const found = [];
  const re = /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;
  for (const m of source.matchAll(re)) found.push(m[1]);
  const reExport = /(?:^|\n)\s*export\s+(?!type\s)(?:\*|\{[\s\S]*?\})\s*from\s*["']([^"']+)["']/g;
  for (const m of source.matchAll(reExport)) found.push(m[1]);
  return found;
}

/**
 * @param {string} source
 * @returns {{specifier: string, rule: "forbidden-engine"|"forbidden-barrel"}[]}
 */
export function findEngineIsolationViolations(source) {
  const out = [];
  for (const specifier of findRuntimeImportSpecifiers(source)) {
    if (isForbiddenBarrel(specifier)) out.push({ specifier, rule: "forbidden-barrel" });
    else if (isForbiddenSpecifier(specifier)) out.push({ specifier, rule: "forbidden-engine" });
  }
  return out;
}

/** `true` for a co-located test/story file — not part of the shipped graph. */
export function isNonShippedFile(name) {
  return /\.(test|stories)\.tsx?$/.test(name);
}

function listSourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !isNonShippedFile(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Rung (b) over the real files rooted at `testSrcDir`. Also walks any file a double module
 * imports RELATIVELY outside `src/test/` (e.g. `../core/types`) so a permitted leaf that
 * later grows a bad import is caught too.
 * @returns {{file: string, specifier: string, rule: string}[]}
 */
export function collectEngineIsolationViolations(
  testSrcDir,
  { readFile = (f) => readFileSync(f, "utf8") } = {},
) {
  const out = [];
  const visited = new Set();
  const queue = listSourceFiles(testSrcDir);
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    let source;
    try {
      source = readFile(file);
    } catch {
      continue;
    }
    for (const v of findEngineIsolationViolations(source)) out.push({ file, ...v });
    for (const specifier of findRuntimeImportSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      if (isForbiddenBarrel(specifier)) continue;
      const target = resolveRelative(file, specifier);
      if (target && !visited.has(target)) queue.push(target);
    }
  }
  return out;
}

// ── Rung (c): wiring ─────────────────────────────────────────────────────────

/** @returns {string[]} problems found (empty = clean) */
export function checkWiring(pkgJson, tsupSrc) {
  const problems = [];
  if (!pkgJson?.exports?.["./test"])
    problems.push('package.json "exports" is missing the "./test" key');
  if (!pkgJson?.publishConfig?.exports?.["./test"]) {
    problems.push('package.json "publishConfig.exports" is missing the "./test" key');
  }
  if (!/["']test\/index["']\s*:/.test(tsupSrc) && !/test\/index\.ts/.test(tsupSrc)) {
    problems.push('tsup.config.ts has no entry for "test/index" (src/test/index.ts)');
  }
  return problems;
}

// ── Rung (d): the manifest exclusion stays in force ──────────────────────────

/** @returns {string[]} problems found (empty = clean) */
export function checkManifestExclusion(manifest) {
  const problems = [];
  for (const [pkgName, pkg] of Object.entries(manifest?.packages ?? {})) {
    for (const subpath of Object.keys(pkg?.subpaths ?? {})) {
      if (/\/test$/.test(subpath)) {
        problems.push(
          `"${subpath}" (${pkgName}) is crawled into brand-ui.manifest.json — a jsdom test ` +
            "double must never appear in the agent-facing build-with catalogue. Restore the " +
            "`/test` denylist in readSubpathBarrels (packages/cli/lib/core.mjs).",
        );
      }
    }
  }
  return problems;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const problems = [];

  const doublesFile = join(TEST_SRC_DIR, "doubles.tsx");
  const testIndexFile = join(TEST_SRC_DIR, "index.ts");
  if (!existsSync(doublesFile) || !existsSync(testIndexFile)) {
    problems.push(
      `(a) double-namespace: ${relative(REPO_ROOT, TEST_SRC_DIR)} is missing doubles.tsx or index.ts.`,
    );
  } else {
    const missing = checkDoubleNamespaceParity(
      readFileSync(doublesFile, "utf8"),
      readFileSync(testIndexFile, "utf8"),
    );
    for (const name of missing) {
      problems.push(
        `(a) double-namespace: "${name}" is exported from doubles.tsx but not re-exported from ` +
          "test/index.ts — a consumer's vi.mock factory proxy throws on it.",
      );
    }
  }

  if (existsSync(TEST_SRC_DIR)) {
    for (const v of collectEngineIsolationViolations(TEST_SRC_DIR)) {
      const rel = relative(REPO_ROOT, v.file);
      const reason =
        v.rule === "forbidden-barrel"
          ? `imports a package/family barrel ("${v.specifier}") — pulls the real engine back in`
          : `imports the rendering engine ("${v.specifier}") at runtime — jsdom cannot render it`;
      problems.push(`(b) engine-isolation: ${rel} ${reason}.`);
    }
  }

  const pkgJsonPath = join(PROCESS_DIR, "package.json");
  const tsupPath = join(PROCESS_DIR, "tsup.config.ts");
  if (existsSync(pkgJsonPath) && existsSync(tsupPath)) {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const tsupSrc = readFileSync(tsupPath, "utf8");
    for (const problem of checkWiring(pkgJson, tsupSrc)) problems.push(`(c) wiring: ${problem}.`);
  } else {
    problems.push(`(c) wiring: packages/process/package.json or tsup.config.ts is missing.`);
  }

  if (existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    for (const problem of checkManifestExclusion(manifest))
      problems.push(`(d) manifest-exclusion: ${problem}`);
  }

  if (problems.length) {
    const label = warnOnly ? "⚠ process-test-double" : "✖ process-test-double gate FAILED";
    console.error(`\n${label} (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\n  See packages/process/src/test/index.ts and .claude/rules/process-components.md (issue #228).",
    );
    if (!warnOnly) return 1;
    return 0;
  }

  console.log(
    "✔ process-test-double: double namespace completeness, engine isolation, exports/publishConfig/tsup " +
      "wiring and the manifest exclusion all hold.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
