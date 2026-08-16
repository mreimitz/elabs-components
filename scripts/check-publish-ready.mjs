#!/usr/bin/env node
/**
 * check-publish-ready.mjs — can these packages actually reach the registry?
 *
 * A registry rejects a publish for reasons that are invisible locally: a
 * `private: true` package is refused by the client before it ever leaves the
 * machine, a package with no `repository` field will not link back to the repo,
 * and a `publishConfig.registry` pointing somewhere else sends the whole release
 * to the wrong host. Each surfaces as a late, cryptic failure mid-release, and
 * npm versions are immutable — a half-published release cannot be undone.
 *
 * So this runs BEFORE anything is tagged or published, and states plainly what
 * is missing. Checks, per distributable package:
 *
 *   1. scope-mismatch    the package scope equals the GitHub owner, lowercased.
 *                        **GitHub Packages ONLY** — it is that registry's hard
 *                        requirement, not a general npm rule. On npmjs.org a
 *                        scope is owned independently of any GitHub account
 *                        (this repo publishes `@elabs-ai/*` from `mreimitz/…`), so
 *                        applying it there would fail a perfectly valid release.
 *                        Gated by `requiresOwnerScope(registry)`.
 *   2. private-package   `private: true` is gone — npm refuses to publish it
 *   3. missing-repository `repository` with a `directory`, so the package links
 *                        to this repo (and, on GitHub Packages, inherits its
 *                        visibility)
 *   4. missing-registry  `publishConfig.registry` points at the registry
 *
 * Plus one repo-level check: the root `.npmrc` maps EVERY published scope to the
 * registry. On a private host an unmapped scope means every consumer install
 * silently resolves from npmjs.org instead; on npmjs.org the mapping is
 * redundant at install time but is what declares the publish target here.
 *
 * PUBLISHING IS DISABLED WHENEVER `.npmrc` DECLARES NO SCOPED REGISTRY. Without
 * a target there is nothing to be "ready" for, and every rule above would report
 * a blocker for a publish nobody can perform — noise, not a gate. So the
 * preflight SKIPS (exit 0, loud message) in that state; re-adding the one
 * mapping line turns the whole battery back on. See docs/ADR/0016.
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

/**
 * The publish target, read from the root `.npmrc` rather than hard-coded — the
 * `.npmrc` is what actually decides where a publish and every consumer install
 * go, so deriving it here means the preflight can never assert a registry the
 * repo isn't configured for.
 * @param {string} npmrcText
 * @returns {{ scope: string, registry: string } | null} null = publishing disabled
 */
export function publishTarget(npmrcText) {
  const m = String(npmrcText ?? "").match(/^\s*@([^:\s]+):registry=(\S+)/m);
  return m ? { scope: m[1].toLowerCase(), registry: m[2] } : null;
}

/** `Some-Org/some-repo` → `some-org` (npm scopes are lowercase). */
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

/**
 * Does this registry require the npm scope to equal the repository owner?
 *
 * TRUE for GitHub Packages only. It is a property of that host — it derives a
 * package's owner and visibility from the repo — and NOT of npm publishing in
 * general. npmjs.org sells scopes independently of GitHub, which is exactly how
 * this repo publishes `@elabs-ai/*` out of `github.com/mreimitz/elabs-components`.
 * Applying the rule everywhere would block that valid release; applying it
 * nowhere would let a GitHub Packages release fail after the first package has
 * already published irreversibly. So it is gated on the host, not dropped.
 */
export function requiresOwnerScope(registry) {
  try {
    return new URL(registry).host.toLowerCase() === "npm.pkg.github.com";
  } catch {
    return false;
  }
}

/** `@elabs-ai/components-ui` → `elabs`; unscoped → null. */
export function scopeOf(pkgName) {
  return pkgName.startsWith("@") ? pkgName.slice(1).split("/")[0].toLowerCase() : null;
}

/**
 * Every publish blocker for one package.
 * @param {object} pkgJson
 * @param {{ owner: string, relDir?: string, registry: string }} ctx
 * @returns {{ rule: string, detail: string }[]}
 */
export function publishBlockers(pkgJson, { owner, relDir, registry }) {
  const out = [];
  const name = pkgJson.name;

  const scope = scopeOf(name);
  if (requiresOwnerScope(registry) && owner && scope !== owner) {
    out.push({
      rule: "scope-mismatch",
      detail:
        `"${name}" is scoped @${scope ?? "(unscoped)"}, but GitHub Packages only accepts ` +
        `packages scoped to the repository owner — @${owner}. Rename it to @${owner}/<name>, ` +
        `or publish to a registry that sells scopes independently (npmjs.org).`,
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
      detail: `"${name}" has no repository field — the registry needs it to link the package back to its source (and GitHub Packages additionally derives visibility from it).`,
    });
  } else if (relDir && pkgJson.repository.directory !== relDir) {
    out.push({
      rule: "missing-repository",
      detail: `"${name}" repository.directory is ${JSON.stringify(pkgJson.repository.directory)}, expected "${relDir}".`,
    });
  }
  if (pkgJson.publishConfig?.registry !== registry) {
    out.push({
      rule: "missing-registry",
      detail: `"${name}" has no publishConfig.registry === "${registry}" — the publish would go to npmjs.org.`,
    });
  }
  return out;
}

/**
 * The scope→registry mapping consumers and CI both rely on, asserted for EVERY
 * scope actually being published.
 *
 * Keyed on the published scopes, not on the repository owner: the two are the
 * same only on GitHub Packages. Checking the owner's scope here would demand a
 * `@mreimitz:registry=` line for a release that publishes `@elabs-ai/*`, while
 * saying nothing about the scope that ships — the check would be both wrong and
 * vacuous. Derived from the package names, so a second scope is covered the day
 * it is introduced.
 *
 * @param {string} npmrcText
 * @param {string[]|string} scopes  scope names WITHOUT the `@` (e.g. `["elabs"]`)
 * @param {string} registry
 */
export function npmrcBlockers(npmrcText, scopes, registry) {
  const list = [...new Set([scopes].flat().filter(Boolean))];
  const out = [];
  for (const scope of list) {
    const line = `@${scope}:registry=${registry}`;
    if (npmrcText.includes(line)) continue;
    out.push({
      rule: "npmrc-unmapped",
      detail: `.npmrc does not contain "${line}" — the publish target for @${scope}/* is undeclared, and on a private registry every consumer install would resolve it from npmjs.org instead.`,
    });
  }
  return out;
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

  const npmrcPath = join(REPO_ROOT, ".npmrc");
  const npmrc = existsSync(npmrcPath) ? readFileSync(npmrcPath, "utf8") : "";
  const target = publishTarget(npmrc);

  // Publishing disabled: no scoped registry in .npmrc, so there is no target to
  // be ready for. Skip loudly rather than reporting blockers for a publish that
  // cannot happen — every rule below stays wired for the day a registry returns.
  if (!target) {
    console.log(
      "• publish-ready: SKIPPED — publishing is disabled (no scoped registry in .npmrc).\n" +
        "  Add `@<scope>:registry=<url>` to .npmrc to re-enable this preflight.",
    );
    return 0;
  }

  // The owner is only load-bearing on GitHub Packages (rule 1). Refusing to run
  // without it on npmjs.org would make the preflight unusable from a checkout
  // with no `origin` — a tarball, a CI clone with a renamed remote — while
  // proving nothing about a scope GitHub does not own.
  const owner = resolveOwner();
  if (!owner && requiresOwnerScope(target.registry)) {
    console.error(
      "✖ publish-ready: could not resolve the GitHub owner (no $GITHUB_REPOSITORY, no origin remote).",
    );
    return warnOnly ? 0 : 1;
  }

  const pkgs = distributables(REPO_ROOT);
  const violations = [];
  for (const { json, relDir } of pkgs) {
    for (const v of publishBlockers(json, { owner, relDir, registry: target.registry })) {
      violations.push({ pkg: json.name, ...v });
    }
  }

  const publishedScopes = [...new Set(pkgs.map(({ json }) => scopeOf(json.name)).filter(Boolean))];
  for (const v of npmrcBlockers(npmrc, publishedScopes, target.registry)) {
    violations.push({ pkg: "(repo)", ...v });
  }

  if (violations.length === 0) {
    console.log(
      `✔ publish-ready: ${pkgs.length} package(s) can publish to ${target.registry} as ` +
        `${publishedScopes.map((s) => `@${s}/*`).join(", ")}.`,
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
