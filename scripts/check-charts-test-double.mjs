#!/usr/bin/env node
/**
 * check-charts-test-double.mjs — anti-drift gate for `@qlik-coe-emea/qlabs-components-charts/test` (#364).
 *
 * A test double that silently stops matching the real component's contract
 * makes a consumer's mocked tests lie again — the exact failure #364 fixes.
 * Discipline alone can't hold that line (a chart container renamed, or a new
 * `@visx` import added to `packages/charts/src/test/**`, is invisible to every
 * other gate), so this is enforcement, not a reminder. Three rungs:
 *
 *   (a) COMPONENT PARITY — every COMPONENT the real `.` barrel exports (every
 *       PascalCase name in the manifest's "components" bucket: the containers
 *       AND the composition primitives/providers) has a same-named export from
 *       `packages/charts/src/test/index.ts`. Full component parity is required,
 *       not just the containers, because Vitest's `vi.mock` factory proxy throws
 *       on ANY omitted export the moment the consumer's module reads it — see
 *       `requiredDoubleNames` below. SCREAMING_SNAKE constants, hooks and
 *       utility functions are deliberately out of scope (they cannot be
 *       re-exported without pulling `@visx` back in) — see
 *       `isComponentExportName`.
 *   (b) ENGINE ISOLATION — walk the import graph rooted at the SHIPPED files of
 *       `packages/charts/src/test/**` (co-located `*.test.ts(x)` excluded —
 *       tsup builds the subpath from `src/test/index.ts` alone, and the
 *       namespace-parity test must import the real barrel to prove the double
 *       covers it) and fail on any RUNTIME (non
 *       `import type`) edge reaching `@visx/*`, `d3-*`, `motion`,
 *       `@number-flow/react`, `react-use-measure`, `@tanstack/react-virtual`,
 *       or a package/family barrel (`charts/index.ts`, `gantt/index.ts`,
 *       `auto-chart/index.ts`, the package root `index.ts`) — any of those
 *       pulls the whole `@visx`-backed engine back into a jsdom test.
 *   (c) WIRING — the `./test` key exists in `package.json`'s `exports`, in
 *       `publishConfig.exports`, and as a `tsup.config.ts` entry.
 *   (d) MANIFEST EXCLUSION — no `…/test` subpath is crawled into
 *       `brand-ui.manifest.json`. The architect decision to keep the doubles out
 *       of the agent-facing build-with catalogue is a one-line denylist inside
 *       `readSubpathBarrels`; this rung is what makes deleting it fail.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates packages relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const CHARTS_DIR = join(REPO_ROOT, "packages", "charts");
const TEST_SRC_DIR = join(CHARTS_DIR, "src", "test");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * `true` for a manifest "components"-bucket name that is a real COMPONENT —
 * PascalCase, excluding the SCREAMING_SNAKE constants the same bucket carries
 * (`DEFAULT_CHART_STATUS`, `PROFIT_LOSS_POSITIVE_COLOR`, …). Constants are
 * deliberately out of parity: several live in `@visx`-backed modules
 * (`DEFAULT_HOVER_OFFSET` in `pie-chart.tsx`, `PROFIT_LOSS_*` in
 * `profit-loss-line.tsx`), so re-exporting them would drag the engine back into
 * the jsdom path — rung (b) would (correctly) fail. Hooks and utility functions
 * are out for the same reason; the documented escape hatch for all three is the
 * `importOriginal`-spread `vi.mock` form (see `packages/charts/src/test/index.ts`).
 * @param {string} name
 */
export function isComponentExportName(name) {
  return /^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name);
}

/**
 * The required "must-double" name set: EVERY component the real barrel exports,
 * not only the chart containers.
 *
 * Container-only parity was not enough, and the reason is the whole point of
 * this gate. The documented consumer wiring is a `vi.mock` FACTORY, and Vitest
 * wraps a factory's result in a proxy that THROWS on any export the factory
 * omitted (`[vitest] No "Line" export is defined on the … mock`) as soon as the
 * consumer's module reads the binding. So a missing `Line`/`XAxis`/`ChartTooltip`
 * breaks `<LineChart><Line dataKey="revenue" /></LineChart>` — the canonical
 * composition — at import time, not "harmlessly, because a container double
 * never mounts its children".
 *
 * @param {string[]} realBarrelComponentNames
 * @returns {string[]} sorted
 */
export function requiredDoubleNames(realBarrelComponentNames) {
  return [...new Set(realBarrelComponentNames.filter(isComponentExportName))].sort();
}

/**
 * Parse the VALUE export names a barrel `index.ts`/`doubles.tsx` declares —
 * `export { A, B }`, `export const X`, `export function X`. Regex-level (same
 * idiom as `check-charts-reuse.mjs`), not a real TS parse.
 * @param {string} src
 * @returns {Set<string>}
 */
export function parseExportedValueNames(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const names = new Set();
  // `export { A, B as C } ...` — but NOT `export type { ... }`.
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

/** Rung (a). @returns {string[]} missing names, sorted */
export function checkContainerParity(realBarrelComponentNames, testIndexSrc) {
  const required = requiredDoubleNames(realBarrelComponentNames);
  const exported = parseExportedValueNames(testIndexSrc);
  return required.filter((n) => !exported.has(n));
}

// ── Rung (b): engine isolation ──────────────────────────────────────────────

/** Bare specifiers that must never be reached at runtime from `src/test/**`. */
export const FORBIDDEN_RUNTIME_SPECIFIERS = [
  "@visx/",
  "d3-",
  "motion",
  "@number-flow/react",
  "react-use-measure",
  "@tanstack/react-virtual",
];

function isForbiddenSpecifier(specifier) {
  return FORBIDDEN_RUNTIME_SPECIFIERS.some(
    (dep) => specifier === dep || specifier === dep.replace(/-$/, "") || specifier.startsWith(dep),
  );
}

/**
 * A specifier that resolves to a package/family BARREL (pulls everything).
 * Covers the relative forms AND the package's own name — a self-reference
 * (`import { LineChart } from "@qlik-coe-emea/qlabs-components-charts"`, legal
 * via the `exports` map and the most natural way to reintroduce the engine by
 * accident) resolves straight back to `src/index.ts`.
 */
function isForbiddenBarrel(specifier) {
  return (
    /^\.\.\/charts(\/index)?$/.test(specifier) ||
    /^\.\.\/gantt(\/index)?$/.test(specifier) ||
    /^\.\.\/auto-chart(\/index)?$/.test(specifier) ||
    /^\.\.\/index$/.test(specifier) ||
    /^\.\.\/\.\.\/index$/.test(specifier) ||
    specifier === "@qlik-coe-emea/qlabs-components-charts"
  );
}

/**
 * RUNTIME (non `import type`) import/re-export specifiers in `source`.
 * Mirrors `check-eager-heavy-deps.mjs`'s `findStaticHeavyImports` shape, with
 * ONE deliberate divergence: the re-export half is anchored to `\{…\}` or `*`
 * immediately after `export` (not a bare `[\s\S]*?`). Without that anchor, a
 * `from`-less statement — `export const X = {…many lines…}`, exactly the
 * `CHART_CONTRACT_SPECS` table below — has no "from" of its own, so the lazy
 * `[\s\S]*?` walks forward past it and wrongly attaches the NEXT unrelated
 * `from "…"` in the file (a later `import type … from "../charts/area-chart"`)
 * to this statement, a false positive proven while building this very gate.
 * @param {string} source
 * @returns {string[]}
 */
export function findRuntimeImportSpecifiers(source) {
  const found = [];
  const re = /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;
  for (const m of source.matchAll(re)) found.push(m[1]);
  // Only `export { … } from "…"` / `export * from "…"` are re-exports — a bare
  // `export const/function/class` never has its own "from" clause to find.
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

/**
 * Every SHIPPED `.ts`/`.tsx` under `dir` (recursive, excluding node_modules/dist).
 *
 * `*.test.ts(x)` / `*.stories.ts(x)` are excluded: tsup builds the `./test`
 * subpath from `src/test/index.ts` alone, so a co-located test file never
 * reaches a consumer — and the namespace-parity test
 * (`packages/charts/src/test/mock-namespace.test.tsx`) MUST import the real
 * barrel (`vi.mock` + `vi.importActual`) to prove the double covers it. Gating
 * those would forbid the very test that proves the double is complete.
 */
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
 * Rung (b) over the real files rooted at `testSrcDir`. Also walks any file the
 * double module imports RELATIVELY outside `src/test/` (e.g. `../charts/chart-a11y`)
 * so a permitted leaf that later grows a bad import is caught too.
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
      if (!specifier.startsWith(".")) continue; // bare specifiers handled above
      if (isForbiddenBarrel(specifier)) continue; // already reported; don't also walk into it
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

/**
 * The `./test` subpath is deliberately kept OUT of `brand-ui.manifest.json`
 * (`readSubpathBarrels` in `packages/cli/lib/core.mjs` skips any key ending in
 * `/test`) — the manifest is the agent-facing BUILD-WITH catalogue, and a second
 * `LineChart` reachable from a `/test` import path is exactly the hallucination
 * it exists to prevent. That denylist is one `continue` inside a crawler with no
 * test of its own, so this rung is its teeth: if the exclusion is refactored
 * away, the doubles reappear in the catalogue and this fails.
 * @param {any} manifest
 * @returns {string[]} problems found (empty = clean)
 */
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

  // (a) component parity
  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      `✖ charts-test-double gate: manifest not found at ${MANIFEST_PATH}. Run \`pnpm manifest\`.`,
    );
    return warnOnly ? 0 : 1;
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const chartsPkg = manifest?.packages?.["@qlik-coe-emea/qlabs-components-charts"];
  if (!chartsPkg) {
    console.error(
      `✖ charts-test-double gate: manifest has no @qlik-coe-emea/qlabs-components-charts package entry.`,
    );
    return warnOnly ? 0 : 1;
  }
  const realNames = (chartsPkg.components ?? []).map((c) => c.name);
  const testIndexFile = join(TEST_SRC_DIR, "index.ts");
  if (!existsSync(testIndexFile)) {
    problems.push(`(a) component-parity: ${relative(REPO_ROOT, testIndexFile)} does not exist.`);
  } else {
    const missing = checkContainerParity(realNames, readFileSync(testIndexFile, "utf8"));
    for (const name of missing) {
      problems.push(
        `(a) component-parity: "${name}" is a component the real barrel exports but has no ` +
          `export from src/test/index.ts — a consumer's vi.mock factory proxy throws on it.`,
      );
    }
  }

  // (b) engine isolation
  if (existsSync(TEST_SRC_DIR)) {
    for (const v of collectEngineIsolationViolations(TEST_SRC_DIR)) {
      const rel = relative(REPO_ROOT, v.file);
      const reason =
        v.rule === "forbidden-barrel"
          ? `imports a package/family barrel ("${v.specifier}") — pulls every @visx-backed chart`
          : `imports the rendering engine ("${v.specifier}") at runtime — jsdom cannot render it`;
      problems.push(`(b) engine-isolation: ${rel} ${reason}.`);
    }
  }

  // (c) wiring
  const pkgJsonPath = join(CHARTS_DIR, "package.json");
  const tsupPath = join(CHARTS_DIR, "tsup.config.ts");
  if (existsSync(pkgJsonPath) && existsSync(tsupPath)) {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const tsupSrc = readFileSync(tsupPath, "utf8");
    for (const problem of checkWiring(pkgJson, tsupSrc)) {
      problems.push(`(c) wiring: ${problem}.`);
    }
  } else {
    problems.push(`(c) wiring: packages/charts/package.json or tsup.config.ts is missing.`);
  }

  // (d) the manifest exclusion stays in force
  for (const problem of checkManifestExclusion(manifest)) {
    problems.push(`(d) manifest-exclusion: ${problem}`);
  }

  if (problems.length) {
    const label = warnOnly ? "⚠ charts-test-double" : "✖ charts-test-double gate FAILED";
    console.error(`\n${label} (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\n  See packages/charts/src/test/index.ts and .claude/rules/chart-components.md " +
        '§ "Test double" (issue #364).',
    );
    if (!warnOnly) return 1;
    return 0;
  }

  console.log(
    "✔ charts-test-double: component parity, engine isolation, exports/publishConfig/tsup wiring " +
      "and the manifest exclusion all hold.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
