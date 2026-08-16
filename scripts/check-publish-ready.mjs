#!/usr/bin/env node
/**
 * check-publish-ready.mjs — can these packages actually reach the registry?
 *
 * GitHub Packages rejects a publish for reasons that are invisible locally:
 * the npm scope MUST equal the repository owner, a `private: true` package is
 * refused by the client before it ever leaves the machine, and a package with
 * no `repository` field will not be linked to (or inherit visibility from) the
 * repo. Each of those surfaces as a late, cryptic failure mid-release.
 *
 * So this runs BEFORE anything is tagged or published, and states plainly what
 * is missing. Checks, per distributable package:
 *
 *   1. scope-mismatch    the package scope equals the GitHub owner, lowercased
 *                        (GitHub Packages' hard requirement)
 *   2. private-package   `private: true` is gone — npm refuses to publish it
 *   3. missing-repository `repository` with a `directory`, so the package links
 *                        to this repo and inherits its visibility
 *   4. missing-registry  `publishConfig.registry` points at the registry
 *
 * Plus one repo-level check: the root `.npmrc` maps the scope to the registry,
 * or every install by every consumer silently goes to npmjs.org instead.
 *
 * Owner resolution: $GITHUB_REPOSITORY (set in Actions) → the `origin` remote.
 *
 * Flags: --warn  report but never exit non-zero.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { distributablePackages } from "./lib/distributables.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const REGISTRY = "https://npm.pkg.github.com";

/** `Qlik-CoE-EMEA/qlabs-components` → `qlik-coe-emea` (npm scopes are lowercase). */
export function ownerFromRepo(nameWithOwner) {
  return String(nameWithOwner).split("/")[0].toLowerCase();
}

export function resolveOwner(root = REPO_ROOT) {
  if (process.env.GITHUB_REPOSITORY) return ownerFromRepo(process.env.GITHUB_REPOSITORY);
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const m = url.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (m) return m[1].toLowerCase();
  } catch {
    /* not a git checkout — fall through */
  }
  return null;
}

/** `@qlik-coe-emea/qlabs-components-ui` → `qlik-coe-emea`; unscoped → null. */
export function scopeOf(pkgName) {
  return pkgName.startsWith("@") ? pkgName.slice(1).split("/")[0].toLowerCase() : null;
}

/**
 * Every publish blocker for one package.
 * @returns {{ rule: string, detail: string }[]}
 */
export function publishBlockers(pkgJson, { owner, relDir }) {
  const out = [];
  const name = pkgJson.name;

  const scope = scopeOf(name);
  if (owner && scope !== owner) {
    out.push({
      rule: "scope-mismatch",
      detail:
        `"${name}" is scoped @${scope ?? "(unscoped)"}, but GitHub Packages only accepts ` +
        `packages scoped to the repository owner — @${owner}. Rename it to @${owner}/<name>.`,
    });
  }
  if (pkgJson.private === true) {
    out.push({
      rule: "private-package",
      detail: `"${name}" is private:true — npm refuses to publish it. Remove the flag (repo visibility already keeps the package private).`,
    });
  }
  if (!pkgJson.repository?.url) {
    out.push({
      rule: "missing-repository",
      detail: `"${name}" has no repository field — GitHub Packages needs it to link the package to the repo and inherit its visibility.`,
    });
  } else if (relDir && pkgJson.repository.directory !== relDir) {
    out.push({
      rule: "missing-repository",
      detail: `"${name}" repository.directory is ${JSON.stringify(pkgJson.repository.directory)}, expected "${relDir}".`,
    });
  }
  if (pkgJson.publishConfig?.registry !== REGISTRY) {
    out.push({
      rule: "missing-registry",
      detail: `"${name}" has no publishConfig.registry === "${REGISTRY}" — the publish would go to npmjs.org.`,
    });
  }
  return out;
}

/** The scope→registry mapping consumers and CI both rely on. */
export function npmrcBlockers(npmrcText, owner) {
  if (!owner) return [];
  const line = `@${owner}:registry=${REGISTRY}`;
  return npmrcText.includes(line)
    ? []
    : [
        {
          rule: "npmrc-unmapped",
          detail: `.npmrc does not contain "${line}" — installs would resolve @${owner}/* from npmjs.org.`,
        },
      ];
}

/**
 * Distributable = declares publishConfig, or is not private. THE predicate lives
 * once in `scripts/lib/distributables.mjs` (#295) — this used to be a hand-copy,
 * and nothing detected divergence between the copies.
 */
function distributables(root) {
  return distributablePackages(root);
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const owner = resolveOwner();

  if (!owner) {
    console.error(
      "✖ publish-ready: could not resolve the GitHub owner (no $GITHUB_REPOSITORY, no origin remote).",
    );
    return warnOnly ? 0 : 1;
  }

  const pkgs = distributables(REPO_ROOT);
  const violations = [];
  for (const { json, relDir } of pkgs) {
    for (const v of publishBlockers(json, { owner, relDir })) {
      violations.push({ pkg: json.name, ...v });
    }
  }

  const npmrcPath = join(REPO_ROOT, ".npmrc");
  const npmrc = existsSync(npmrcPath) ? readFileSync(npmrcPath, "utf8") : "";
  for (const v of npmrcBlockers(npmrc, owner)) violations.push({ pkg: "(repo)", ...v });

  if (violations.length === 0) {
    console.log(
      `✔ publish-ready: ${pkgs.length} package(s) can publish to ${REGISTRY} as @${owner}/*.`,
    );
    return 0;
  }

  // Group by rule — 11 identical scope errors should read as one problem.
  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule).push(v);
  }

  console.error(
    `✖ publish-ready: ${violations.length} blocker(s) across ${pkgs.length} package(s):\n`,
  );
  for (const [rule, list] of byRule) {
    console.error(`  ${rule} (${list.length})`);
    console.error(`    ${list[0].detail}`);
    if (list.length > 1) {
      console.error(
        `    …and ${list.length - 1} more: ${list
          .slice(1)
          .map((v) => v.pkg)
          .join(", ")}`,
      );
    }
    console.error("");
  }
  console.error("  Nothing has been tagged or published. Fix these first.");
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
