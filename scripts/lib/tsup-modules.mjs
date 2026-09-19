/**
 * tsup-modules — build a package one source module per output file (RM-130).
 *
 * WHY: tsup bundled each package into one `dist/index.js`. A bundler can only drop
 * what an app does not use when it can drop whole FILES (`sideEffects`), and a
 * single file is all-or-nothing — a created dashboard shipped the date picker,
 * the carousel and every chart in its first download (609 KB gzip; 145 KB when the
 * same app resolved the packages' per-file sources).
 *
 * `moduleEntries()` walks the relative imports (static and dynamic) reachable from
 * a package's public entries and returns them as extra tsup entries. With
 * esbuild's code splitting (tsup's default for ESM) every module then lands in its
 * own chunk, imported by path from the public entry, so `sideEffects: false` (or a
 * CSS-only list) lets the app's bundler keep only the modules it reaches. The
 * public entries keep their names and paths, so `exports` does not change.
 *
 * Pair it with `dts: { entry: <the public entries> }` so the type output stays
 * exactly what it was. Dependency-free on purpose: tsup configs import it.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const CODE = /\.(tsx?|mjs|js)$/;
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
// `import … from "./x"`, `export … from "./x"`, `import("./x")`, `import "./x"`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;

function resolveModule(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = RESOLVE_SUFFIXES.map((suffix) => base + suffix);
  // TypeScript's NodeNext style names a `.ts` source by its output: `./x.js`.
  const stem = base.replace(/\.(m?js|jsx)$/, "");
  if (stem !== base) candidates.push(`${stem}.ts`, `${stem}.tsx`);
  for (const file of candidates) {
    if (CODE.test(file) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/** Every source module reachable from `files` through relative imports. */
export function reachableModules(files) {
  const seen = new Set();
  const queue = [...files];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const [, spec] of src.matchAll(SPECIFIER)) {
      const hit = resolveModule(file, spec);
      if (hit && !seen.has(hit)) queue.push(hit);
    }
  }
  return seen;
}

/**
 * tsup entries: the public ones as given, plus one per reachable module under
 * `srcDir`, named by its path without the extension (`components/button/button`).
 *
 * @param {Record<string, string>} publicEntries - name → source path, relative to `pkgDir`.
 * @param {{ pkgDir?: string, srcDir?: string, exclude?: string[] }} [opts] - `exclude`:
 *   module names another tsup pass emits (e.g. a subpath built without the
 *   "use client" banner); they stay in shared chunks here, never a second output.
 */
export function moduleEntries(
  publicEntries,
  { pkgDir = process.cwd(), srcDir = "src", exclude = [] } = {},
) {
  const src = resolve(pkgDir, srcDir);
  const publicFiles = new Set(Object.values(publicEntries).map((p) => resolve(pkgDir, p)));
  const entries = { ...publicEntries };
  for (const file of [...reachableModules(publicFiles)].sort()) {
    if (publicFiles.has(file)) continue;
    const rel = relative(src, file);
    if (rel.startsWith("..")) continue;
    const name = rel.replace(/\\/g, "/").replace(CODE, "");
    if (exclude.includes(name)) continue;
    if (name in entries)
      throw new Error(`tsup-modules: module entry "${name}" collides with a public entry`);
    entries[name] = relative(pkgDir, file).replace(/\\/g, "/");
  }
  return entries;
}
