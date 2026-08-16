#!/usr/bin/env node
/**
 * check-registry-resolve.mjs — registry relative-import resolution gate.
 *
 * `pnpm registry:validate` checks that every `files[].path` exists ON DISK, but
 * never follows the relative imports INSIDE those files — so a component can
 * import a sibling that resolves in the repo tree but NOT at the installed
 * `target` layout (or vice versa) and the registry still validates clean. That
 * exact defect shipped in the registry-blocks unit (round 2): every data/lib
 * file's `target` put it under a top-level `data/<block>/`/`lib/<block>/`
 * folder, sibling to `components/`, while the importing `.tsx` used
 * `../data/<file>` — relative to `components/<block>/`, which the shadcn CLI
 * materializes as `components/<block>/data/<file>`, not `data/<block>/<file>`.
 * 13 imports were unresolvable at the install target while `registry:validate`
 * stayed green.
 *
 * This gate materializes each `registry:block`/`registry:component` item TWICE
 * — once keyed by its REPO `path` (the tree as it sits in `registry/`), once
 * keyed by its INSTALL `target` (the tree `npx shadcn add` would write) — and
 * statically resolves every relative import (`from "./x"` / `from "../x"` /
 * `import("./x")` / `require("./x")`) against both. An import that fails to
 * resolve in EITHER tree is a violation. Theme/style items (no file imports to
 * follow) are skipped.
 *
 * Dependency-free (repo convention); ESM. Run: `pnpm registry:resolve:check`
 * (`node scripts/check-registry-resolve.mjs`). Self-test:
 * `pnpm registry:resolve:check:test`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = resolve(ROOT, "registry/registry.json");

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

// Matches `from "./x"` / `from '../x'`, `import("./x")`, `require("./x")` —
// only relative specifiers (`./`, `../`); package/alias imports are ignored.
const RELATIVE_IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](\.\.?\/[^"']+)["']/g;

/** Extract the relative import specifiers referenced by a file's source. */
export function findRelativeImports(source) {
  const specs = [];
  for (const m of source.matchAll(RELATIVE_IMPORT_RE)) {
    specs.push(m[1]);
  }
  return specs;
}

/**
 * Does `importPath` (relative, e.g. "./data/x") resolve against a set of
 * known POSIX-normalized keys (`fromDir` + importPath, each tried with the
 * candidate suffixes)? `has(key)` is the existence predicate (fs.existsSync
 * for the repo tree, a Set#has for the virtual install tree).
 */
function resolvesAgainst(fromDirPosix, importPath, has) {
  const joined = posix.normalize(posix.join(fromDirPosix, importPath));
  return CANDIDATE_SUFFIXES.some((suf) => has(joined + suf));
}

/**
 * Check one registry item's files for relative imports that fail to resolve
 * either in the repo tree (by `path`) or the install tree (by `target`).
 * Returns an array of violation strings (empty if clean). Pure — no fs access
 * beyond the injected `readFile`/`fileExists`, so it's unit-testable with a
 * virtual fixture.
 */
export function checkItemResolution(item, { readFile, fileExists }) {
  const violations = [];
  if (!Array.isArray(item.files) || item.files.length === 0) return violations;

  // Build the virtual install-tree key set: every OTHER file's `target` in
  // this item (POSIX, no leading "./"). A file without a `target` can't be
  // reached at install time, so it isn't offered as an install-side match.
  const targetKeys = new Set(
    item.files.filter((f) => f.target).map((f) => posix.normalize(f.target.replace(/^\.\//, ""))),
  );
  const hasTarget = (key) => targetKeys.has(posix.normalize(key));

  for (const file of item.files) {
    if (!file.path) continue;
    let source;
    try {
      source = readFile(file.path);
    } catch {
      continue; // registry:validate already fails a missing path
    }
    const imports = findRelativeImports(source);
    if (imports.length === 0) continue;

    const repoDir = posix.dirname(file.path.replace(/\\/g, "/"));
    const hasRepo = (key) => fileExists(key);

    for (const spec of imports) {
      const repoOk = resolvesAgainst(repoDir, spec, hasRepo);
      if (!repoOk) {
        violations.push(
          `item "${item.name}": ${file.path} imports "${spec}" — does not resolve in the REPO tree.`,
        );
      }

      if (file.target) {
        const targetDir = posix.dirname(file.target.replace(/^\.\//, "").replace(/\\/g, "/"));
        const targetOk = resolvesAgainst(targetDir, spec, hasTarget);
        if (!targetOk) {
          violations.push(
            `item "${item.name}": ${file.path} (target ${file.target}) imports "${spec}" — ` +
              `does not resolve in the INSTALL tree (target layout).`,
          );
        }
      }
    }
  }
  return violations;
}

function main() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`✖ registry.json not found at ${REGISTRY_PATH}`);
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  if (!Array.isArray(registry.items)) {
    console.error("✖ registry.json must contain an `items` array.");
    process.exit(1);
  }

  const readFile = (p) => readFileSync(resolve(ROOT, p), "utf8");
  const fileExists = (p) => existsSync(resolve(ROOT, p));

  const allViolations = [];
  for (const item of registry.items) {
    if (item.type === "registry:theme" || item.type === "registry:style") continue;
    allViolations.push(...checkItemResolution(item, { readFile, fileExists }));
  }

  if (allViolations.length) {
    for (const v of allViolations) console.error(`✖ ${v}`);
    console.error(
      `\nregistry:resolve:check failed with ${allViolations.length} unresolvable relative import(s).`,
    );
    process.exit(1);
  }

  console.log(
    `✓ registry:resolve:check OK — every relative import resolves in both the repo tree and the install (target) tree.`,
  );
}

// Only run as a CLI — the self-test imports the pure helpers above.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
