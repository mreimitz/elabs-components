/**
 * distributables.mjs — THE derived source of truth for "which packages ship".
 *
 * The failure this fixes (#295): the publishable-package predicate lived as four
 * hand-copied implementations — `scripts/set-version.mjs`,
 * `scripts/check-publish-ready.mjs`, an inline `node -e` expression inside
 * `.github/workflows/release.yml`'s pack loop, and (a genuinely different one)
 * `scripts/check-consumer-install.mjs`. Nothing detected divergence between
 * them, which is the same convention-without-teeth that let v1.7.0 ship without
 * `@brand/maps`. One module, one predicate, one self-test.
 *
 * A package is DISTRIBUTABLE when it declares `publishConfig`, or it is not
 * marked `private`. That is the 11 component packages plus the CLI; apps and the
 * eslint/typescript config packages are `private: true` with no `publishConfig`,
 * so they stay off the release train and keep their own independent versions.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, resolved from this file (scripts/lib/ → scripts/ → root). */
export const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * A package is on the release train when it can be distributed: it declares
 * `publishConfig`, or it is not marked private. Pure — the whole predicate.
 */
export function isDistributable(pkgJson) {
  return Boolean(pkgJson?.publishConfig) || pkgJson?.private !== true;
}

/**
 * Every distributable package under `<root>/packages`, sorted by directory name.
 * Returns `{ name, version, dir, relDir, json }[]`. Derived by scanning the
 * workspace, never a hard-coded list, so a new package joins the day it is added.
 */
export function distributablePackages(root = REPO_ROOT) {
  const out = [];
  const pkgsDir = join(root, "packages");
  if (!existsSync(pkgsDir)) return out;
  for (const name of readdirSync(pkgsDir).sort()) {
    const relDir = join("packages", name);
    const pj = join(root, relDir, "package.json");
    if (!existsSync(pj)) continue;
    let json;
    try {
      json = JSON.parse(readFileSync(pj, "utf8"));
    } catch {
      continue;
    }
    if (!isDistributable(json)) continue;
    out.push({ name: json.name, version: json.version, dir: join(root, relDir), relDir, json });
  }
  return out;
}

/** `@elabs-ai/components-ui` @ 2.0.0 → `elabs-components-ui-2.0.0.tgz`. */
export function tarballName(pkgName, version) {
  return `${String(pkgName).replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}
