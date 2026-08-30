#!/usr/bin/env node
/**
 * check-registry-published.mjs — registry:published:check (issue #31).
 *
 * The maintainer decision on #31 hosts the built registry
 * (`pnpm registry:build` → `registry/__output/*.json`) on GitHub Pages, at
 * `<homepage>/<version>/<item>.json` with a `<homepage>/latest/<item>.json`
 * alias (`scripts/publish-registry-pages.mjs`, wired into
 * `.github/workflows/release.yml`). Without a gate, the issue's own words:
 * "the endpoint rots silently and the docs go back to describing something
 * that does not work."
 *
 * ## Two checks, deliberately different in character
 *
 * 1. **Configuration (always runs, no network, a real defect if it fails).**
 *    `registry.json`'s top-level `homepage` must be a real, resolvable,
 *    non-placeholder `https://` URL — reusing `lib/registry-homepage.mjs`'s
 *    `findHomepageViolation` (also used by `validate-registry.mjs`), since
 *    that is already the one place this repo decides what counts as a
 *    placeholder. Without a real `homepage`, `pnpm registry:build` itself
 *    refuses (shadcn requires it on a root registry) — so this is
 *    load-bearing, not cosmetic.
 *
 * 2. **Liveness (network, best-effort, asymmetric).** This is the rung that
 *    needs a defensible answer for the window before GitHub Pages is enabled
 *    — see the brief for #31. The naive version ("every local registry.json
 *    entry must resolve at its hosted URL") is WRONG on this repo's own
 *    workflow: `latest` only advances on a release (`release.yml`), so a PR
 *    that adds a new registry item is EXPECTED to 404 for it until the next
 *    release ships — that is not rot, and failing PRs for it would make this
 *    gate a nuisance rather than a signal.
 *
 *    So instead of testing the LOCAL tree's item list, this fetches the
 *    REMOTE `<homepage>/latest/registry.json` snapshot — the aggregate file
 *    `shadcn build` itself emits, which IS what has actually been published
 *    — and checks THOSE item names' individual files are still reachable.
 *    That catches real rot (a published item whose file went missing or the
 *    branch got corrupted) without ever penalizing an unreleased addition.
 *
 *    Three outcomes for the `latest` canary — but which two are reachable
 *    depends on `everPublished` (PR #58 finding "Fail after a published
 *    registry canary disappears", NARROWING but not fully closing issue #60):
 *    a canary that is unreachable while `publish-registry-pages.mjs` has
 *    NEVER successfully pushed the `gh-pages` branch is "nothing published
 *    yet" (expected, not a defect); the SAME unreachable canary AFTER that
 *    branch demonstrably exists on `origin` means content that was pushed is
 *    not resolving — that is much more likely to be real rot than a pending
 *    setup step, and must fail the build rather than be silently skipped
 *    forever. `everPublished` is computed with the exact same
 *    `remoteBranchExists` helper `publish-registry-pages.mjs` uses to decide
 *    "first publish vs. not" — reused rather than reimplemented, and
 *    deliberately NOT a `git tag` check: a version tag can exist (a package
 *    release happened) with the registry-publish step never having run for
 *    it yet, which would make a tag-based signal false-positive-fail on the
 *    ordinary "registry publishing was just added, no release has gone
 *    through it yet" bootstrap window — verified against this exact repo's
 *    own state while building this fix (a `v4.0.0` tag exists here with no
 *    `gh-pages` branch ever pushed).
 *      - canary unreachable/non-ok AND `gh-pages` does not exist on origin →
 *        SKIPPED. Covers "the registry has never been published", "the
 *        maintainer has not enabled Pages yet", and "this runner has no/flaky
 *        egress" — none of those are things a PR can fix, so this never reds
 *        a build for a human's pending setting change.
 *      - canary unreachable/non-ok AND `gh-pages` EXISTS on origin → FAILS.
 *        Content has demonstrably been pushed at least once; a canary that
 *        still won't resolve is far more likely to be rot (a broken branch,
 *        Pages disabled after being enabled, a CDN/DNS issue) than an
 *        as-yet-unflipped Settings toggle.
 *      - the snapshot is reachable and every item it lists resolves → OK.
 *      - the snapshot is reachable but an item it lists does NOT resolve →
 *        FAILS regardless of `everPublished` — this is real rot by definition.
 *
 *    **Honest residual gap (why #60 narrows here rather than closes):** branch
 *    existence proves content was PUSHED, not that GitHub Pages was ever
 *    actually TOGGLED ON in Settings — that flag lives in GitHub's repo
 *    settings, unreadable here without a Pages-scoped API token this script
 *    deliberately does not take on (rejected for the same reasons noted
 *    below: added complexity, unreliable for fork PRs). So a repo that has
 *    pushed `gh-pages` content but whose maintainer has not yet flipped that
 *    one manual switch will still fail this rung, not skip it. That is a
 *    real, known false-positive window, strictly narrower and shorter-lived
 *    than the one this fix closes (which was permanent — a stale git tag
 *    would false-fail forever) — it lasts only until the maintainer visits
 *    Settings → Pages once, immediately after the FIRST successful publish.
 *
 * 3. **Historical/immutable-version liveness (network, best-effort, ONLY once
 *    rung 2 is OK).** PR #58 finding "Check immutable version directories for
 *    rot": rung 2 only ever probes `latest`, so a consumer who pinned an
 *    OLDER immutable `r/<version>/` URL (the whole point of versioning — see
 *    `publish-registry-pages.mjs`'s header comment) gets no coverage at all.
 *    `checkVersionedSnapshots` re-runs the same "fetch the version's own
 *    `registry.json` aggregate, then probe every item it lists" logic against
 *    each past release tag, newest-first, capped at
 *    `MAX_VERSIONED_SNAPSHOTS_CHECKED` so the check cost doesn't grow
 *    unbounded as release history grows. A version whose snapshot itself is
 *    unreachable is skipped silently — some tags predate this pipeline, or
 *    were never actually published as a registry version — that is "never
 *    published", not rot; only a version whose snapshot resolves but whose
 *    ITEMS don't is reported as a failure. Gated behind rung 2 == "ok" so a
 *    "Pages not live yet" skip doesn't cascade into N more misleading probes.
 *
 * `checkPublishedItems` / `checkVersionedSnapshots` take an injected
 * `fetchImpl` so the self-test never touches the network. Dependency-free
 * otherwise; ESM.
 *
 *   pnpm registry:published:check
 *   node scripts/check-registry-published.mjs [--timeout-ms 5000]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { findHomepageViolation } from "./lib/registry-homepage.mjs";
import { compareVersions } from "./lib/semver-lite.mjs";
import { remoteBranchExists } from "./publish-registry-pages.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY_PATH = join(REPO_ROOT, "registry", "registry.json");

// Bounds the cost of rung 3 (historical-version rot) as release history
// grows — the N most recent tags are checked, not the entire history.
const MAX_VERSIONED_SNAPSHOTS_CHECKED = 10;

/**
 * Rung 2 — the liveness check. Pure aside from the injected `fetchImpl`, so
 * it is unit-testable with a canned fetch and no real network.
 *
 * @param {{
 *   baseUrl: string,
 *   fetchImpl: (url: string, init?: object) => Promise<{ ok: boolean, status: number, json?: () => Promise<any> }>,
 *   timeoutMs?: number,
 *   everPublished?: boolean,
 * }} args
 * @returns {Promise<{ status: "skipped" | "ok" | "failed", reason?: string, unreachable?: string[] }>}
 */
export async function checkPublishedItems({
  baseUrl,
  fetchImpl,
  timeoutMs = 5000,
  everPublished = false,
}) {
  const base = baseUrl.replace(/\/+$/, "");
  const canaryUrl = `${base}/latest/registry.json`;
  // Once `publish-registry-pages.mjs` has successfully pushed the `gh-pages`
  // branch at least once, an unreachable `latest` canary is no longer
  // "nothing published yet" — content demonstrably exists and isn't
  // resolving. See the module header comment (PR #58 / issue #60) for why
  // this is branch-existence, not a `git tag` check, and for the residual
  // gap it does NOT close (Pages may still be un-toggled in Settings).
  const unreachableStatus = everPublished ? "failed" : "skipped";
  const unreachableSuffix = everPublished
    ? "the `gh-pages` branch already exists on origin (publish-registry-pages.mjs has " +
      "pushed content before), so this endpoint should be resolving — this looks like " +
      "real rot, not a pending first publish."
    : "hosting is likely not live yet.";

  let canaryRes;
  try {
    canaryRes = await fetchImpl(canaryUrl, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    return {
      status: unreachableStatus,
      reason: `${canaryUrl} is unreachable (${err.message}) — ${unreachableSuffix}`,
    };
  }
  if (!canaryRes || !canaryRes.ok) {
    return {
      status: unreachableStatus,
      reason: `${canaryUrl} returned ${canaryRes ? canaryRes.status : "no response"} — ${unreachableSuffix}`,
    };
  }

  let snapshot;
  try {
    snapshot = await canaryRes.json();
  } catch (err) {
    return {
      status: "failed",
      reason: `${canaryUrl} is reachable but is not valid JSON (${err.message}). The published registry is corrupt.`,
    };
  }
  const publishedNames = Array.isArray(snapshot?.items)
    ? snapshot.items.map((i) => i.name).filter(Boolean)
    : [];
  if (publishedNames.length === 0) {
    return {
      status: "failed",
      reason: `${canaryUrl} is reachable but lists no items — the published registry snapshot is empty or malformed.`,
    };
  }

  const unreachable = [];
  for (const name of publishedNames) {
    const url = `${base}/latest/${name}.json`;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res || !res.ok)
        unreachable.push(`${name} (${url} → ${res ? res.status : "no response"})`);
    } catch (err) {
      unreachable.push(`${name} (${url} → ${err.message})`);
    }
  }

  if (unreachable.length > 0) {
    return { status: "failed", unreachable };
  }
  return { status: "ok" };
}

/**
 * Rung 3 — historical/immutable-version liveness. For each version in
 * `versions` (newest-first is conventional but not required), fetch that
 * version's OWN `registry.json` aggregate and, if it resolves, probe every
 * item it lists at that SAME version path. A version whose own snapshot does
 * not resolve is skipped silently — it was never published as a registry
 * version (predates this pipeline, or the tag was never released through
 * `publish-registry-pages.mjs`) — that is absence, not rot. Only a version
 * whose snapshot resolves but whose listed items don't is real rot.
 *
 * Pure aside from the injected `fetchImpl` — unit-testable with a canned
 * fetch and no real network, same convention as `checkPublishedItems`.
 *
 * @param {{
 *   baseUrl: string,
 *   versions: string[],
 *   fetchImpl: (url: string, init?: object) => Promise<{ ok: boolean, status: number, json?: () => Promise<any> }>,
 *   timeoutMs?: number,
 * }} args
 * @returns {Promise<{ status: "ok" | "failed", failures?: { version: string, unreachable: string[] }[] }>}
 */
export async function checkVersionedSnapshots({ baseUrl, versions, fetchImpl, timeoutMs = 5000 }) {
  const base = baseUrl.replace(/\/+$/, "");
  const failures = [];

  for (const version of versions) {
    const snapshotUrl = `${base}/${version}/registry.json`;
    let res;
    try {
      res = await fetchImpl(snapshotUrl, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      continue; // never published under this tag — absence, not rot.
    }
    if (!res || !res.ok) continue; // same — this version has no snapshot to check.

    let snapshot;
    try {
      snapshot = await res.json();
    } catch (err) {
      failures.push({
        version,
        unreachable: [`${snapshotUrl} is not valid JSON (${err.message})`],
      });
      continue;
    }
    const names = Array.isArray(snapshot?.items)
      ? snapshot.items.map((i) => i.name).filter(Boolean)
      : [];

    const unreachable = [];
    for (const name of names) {
      const url = `${base}/${version}/${name}.json`;
      try {
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!r || !r.ok) unreachable.push(`${name} (${url} → ${r ? r.status : "no response"})`);
      } catch (err) {
        unreachable.push(`${name} (${url} → ${err.message})`);
      }
    }
    if (unreachable.length > 0) failures.push({ version, unreachable });
  }

  return failures.length > 0 ? { status: "failed", failures } : { status: "ok" };
}

/**
 * The N most recent versions (by `compareVersions`, newest first), capped at
 * `max` so rung 3's network cost stays bounded as release history grows.
 * Pure — no fs/git access — unit-testable with a fixture version list.
 *
 * @param {string[]} allVersions
 * @param {number} max
 * @returns {string[]}
 */
export function selectVersionsToCheck(allVersions, max = MAX_VERSIONED_SNAPSHOTS_CHECKED) {
  return [...allVersions].sort(compareVersions).reverse().slice(0, max);
}

/**
 * This repo's own released versions, derived from `git tag -l 'v*'` — used
 * ONLY to pick which versions rung 3 probes (a tag can exist for a package
 * release before the registry-publish step has ever run for it, which is
 * exactly why rung 2's `everPublished` signal is branch-existence, NOT this
 * list — see the module header comment). Returns `[]` (not a throw) on any
 * git failure — a shallow clone or a repo with no tags yet is a real,
 * tolerable state, not a script bug.
 *
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listReleasedVersions(repoRoot) {
  try {
    const raw = execFileSync("git", ["tag", "-l", "v*"], { cwd: repoRoot, encoding: "utf8" });
    return raw
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.replace(/^v/, ""));
  } catch {
    return [];
  }
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`✖ registry:published:check — ${REGISTRY_PATH} not found.`);
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));

  // Rung 1 — configuration. Always enforced; never network-dependent.
  const homepageViolation = findHomepageViolation(registry.homepage);
  if (homepageViolation || !registry.homepage) {
    console.error(
      `✖ registry:published:check — registry.json has no usable \`homepage\`: ${
        homepageViolation ?? "the field is missing."
      }`,
    );
    console.error(
      "  A real homepage is required for both `pnpm registry:build` (shadcn refuses without\n" +
        "  one on a root registry) and for consumers to resolve `npx shadcn add <homepage>/<item>.json`.\n" +
        "  Set it in registry/registry.items.json and run `pnpm gen:registry`.",
    );
    process.exit(1);
  }
  console.log(`✔ registry.json homepage: ${registry.homepage}`);

  // Has `publish-registry-pages.mjs` ever successfully pushed the `gh-pages`
  // branch? Decides whether an unreachable `latest` canary means "not set up
  // yet" (skip) or "content exists but isn't resolving" (fail) — reuses the
  // exact same helper that script uses to decide first-publish vs. not, per
  // the module header comment (PR #58 / issue #60).
  const everPublished = remoteBranchExists(REPO_ROOT, "gh-pages");
  // Release-tag history, used ONLY to pick rung 3's candidate versions.
  const allVersions = listReleasedVersions(REPO_ROOT);

  // Rung 2 — liveness, best-effort.
  const result = await checkPublishedItems({
    baseUrl: registry.homepage,
    fetchImpl: fetch,
    everPublished,
  });

  if (result.status === "skipped") {
    console.log(`• registry:published:check — SKIPPED live reachability: ${result.reason}`);
    console.log(
      "  This is expected until the maintainer enables GitHub Pages (Settings → Pages →\n" +
        '  "Deploy from a branch" → gh-pages → /(root)) and at least one version has been\n' +
        "  released (.github/workflows/release.yml runs `pnpm registry:build` +\n" +
        "  `node scripts/publish-registry-pages.mjs` on every version tag). Once hosting is\n" +
        "  live this check enforces every ALREADY-PUBLISHED item stays reachable — it never\n" +
        "  fails merely because a NEW, unreleased item 404s.",
    );
    return 0;
  }
  if (result.status === "failed") {
    if (result.unreachable) {
      console.error(
        `✖ registry:published:check — ${result.unreachable.length} published item(s) no longer resolve:`,
      );
      for (const u of result.unreachable) console.error(`  - ${u}`);
    } else {
      console.error(`✖ registry:published:check — ${result.reason}`);
    }
    return 1;
  }
  console.log("✔ registry:published:check — every published registry item is reachable.");

  // Rung 3 — historical/immutable-version liveness, only once `latest` is
  // demonstrably fine (no point probing N more versions when rung 2 already
  // told us hosting isn't live). See the module header comment.
  if (allVersions.length === 0) {
    console.log(
      "• registry:published:check — no released versions to check for rot (rung 3 skipped).",
    );
    return 0;
  }
  const versionsToCheck = selectVersionsToCheck(allVersions);
  const versionedResult = await checkVersionedSnapshots({
    baseUrl: registry.homepage,
    versions: versionsToCheck,
    fetchImpl: fetch,
  });
  if (versionedResult.status === "failed") {
    console.error(
      `✖ registry:published:check — rot in ${versionedResult.failures.length} immutable version ` +
        `director(y/ies) (checked ${versionsToCheck.length} of ${allVersions.length} released version(s)):`,
    );
    for (const f of versionedResult.failures) {
      console.error(`  - r/${f.version}/:`);
      for (const u of f.unreachable) console.error(`      - ${u}`);
    }
    return 1;
  }
  console.log(
    `✔ registry:published:check — no rot in ${versionsToCheck.length} checked immutable version ` +
      `director(y/ies) (of ${allVersions.length} released).`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code ?? 0));
}
