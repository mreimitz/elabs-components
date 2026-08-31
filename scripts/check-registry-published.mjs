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
 * ## Three checks, deliberately different in character
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
 *    An unreachable `latest` canary is ambiguous on its own — it means either
 *    "nothing published yet" (benign) or "was live, now broken" (real rot),
 *    and conflating them was the original #60 bug: both produced the same
 *    silent SKIP. Which outcome applies is decided by a **priority chain of
 *    two signals**, checked in this order:
 *
 *      1. **`pagesConfigured` (authoritative) — GitHub's own Settings → Pages
 *         flag**, read via `isPagesConfigured()` (`gh api
 *         repos/:owner/:repo/pages`). This is the ground truth the issue asked
 *         for: it answers "was the one manual Settings switch ever flipped",
 *         which branch existence alone cannot.
 *           - `"not-configured"` (API returns 404) → **always SKIPPED**,
 *             REGARDLESS of `everPublished` below. This is what closes the
 *             residual: a repo that pushed `gh-pages` once but never enabled
 *             Pages in Settings no longer false-positive-FAILs.
 *           - `"configured"` (API returns a clean response) → **always
 *             FAILED** on an unreachable canary. Pages is demonstrably live,
 *             so there is nothing ambiguous left — this is rot.
 *      2. **`everPublished` (fallback) — `gh-pages` branch existence on
 *         origin**, via the same `remoteBranchExists` helper
 *         `publish-registry-pages.mjs` uses to decide first-publish vs. not.
 *         Consulted ONLY when `pagesConfigured` is `"unknown"` — the Pages API
 *         call itself failed for a reason that says nothing about Pages being
 *         on or off (no `gh` binary, not authenticated, rate-limited, a
 *         network blip). This gate runs in the shared, unauthenticated
 *         `quality-gates.md` job on every PR with no elevated `permissions:`
 *         block, so treating an API hiccup as either "configured" or
 *         "not-configured" — or failing closed on it, the issue's alternative
 *         suggestion — would make an unrelated PR's CI hostage to `gh`
 *         flakiness. Falling back to the already-shipped, already-tested
 *         branch-existence signal is a **deliberate, commented choice**
 *         (`isPagesConfigured`'s doc comment), not a silent default: it costs
 *         nothing new and never regresses pre-#60 behaviour. Deliberately NOT
 *         a `git tag` check either — see `listReleasedVersions`'s doc comment
 *         for why a tag-based signal false-positive-fails during the ordinary
 *         "registry publishing was just added, no release has gone through it
 *         yet" bootstrap window (verified against this exact repo: a
 *         `v4.0.0` tag exists here with no `gh-pages` branch ever pushed).
 *           - unreachable AND `gh-pages` does not exist on origin → SKIPPED.
 *           - unreachable AND `gh-pages` EXISTS on origin → FAILED.
 *
 *    Once the canary IS reachable, neither signal matters:
 *      - every item the snapshot lists resolves → OK.
 *      - an item the snapshot lists does NOT resolve → FAILS, unconditionally
 *        — this is real rot by definition regardless of either signal above.
 *
 *    **Residual, stated rather than hidden:** the only remaining ambiguous
 *    window is `pagesConfigured === "unknown"` — i.e. this runner could not
 *    reach the GitHub API at all (no `gh`, no auth, rate-limited, offline). In
 *    that narrow case the gate is exactly as accurate as it was before this
 *    fix (the `everPublished` proxy) — never less accurate, and the common
 *    case (a `gh`-authenticated CI runner) now gets the authoritative answer.
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
 * `fetchImpl`, and `isPagesConfigured` takes an injected `execImpl`, so the
 * self-test never touches the network or shells out to `gh`. Dependency-free
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

// A `gh api` call that hangs (e.g. an interactive auth prompt with no TTY)
// must not hang the gate forever — kill it and fall back to "unknown" like
// any other exec failure.
const GH_API_TIMEOUT_MS = 10_000;

/**
 * The default `execImpl` for {@link isPagesConfigured} — shells out to
 * `gh api repos/:owner/:repo/pages`, the authoritative GitHub Pages
 * Settings-configuration endpoint (same `gh api repos/:owner/:repo/...`
 * idiom `check-merge-readiness.mjs` already uses against this exact repo).
 * Returns the raw stdout string on success; throws (with `.stderr` set,
 * matching `execFileSync`'s own error shape) on any failure — a 404
 * because Pages was never enabled, no `gh` binary, no auth, a rate limit,
 * or a network blip. Callers never see the child process directly; only
 * {@link isPagesConfigured} interprets the failure.
 *
 * @returns {string}
 */
function defaultGhApi() {
  return execFileSync("gh", ["api", "repos/:owner/:repo/pages"], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: GH_API_TIMEOUT_MS,
  });
}

/**
 * The authoritative Pages-configuration signal (#60) — asks GitHub itself
 * whether Pages has ever been toggled on in Settings, rather than inferring
 * it from `gh-pages` branch existence (the `everPublished` proxy, which only
 * proves content was PUSHED, not that the one manual Settings switch was
 * ever flipped — see the module header comment). `execImpl` is injectable
 * (mirrors the `fetchImpl` convention on `checkPublishedItems` /
 * `checkVersionedSnapshots`) so the self-test never makes a real `gh`/network
 * call.
 *
 * Deliberately three-valued, not boolean — a `gh api` failure that is NOT a
 * 404 (no `gh` installed, not authenticated, rate-limited, offline runner) is
 * genuinely ambiguous and must not be read as either "configured" or
 * "not-configured": this gate runs in the shared, unauthenticated
 * `quality-gates.md` job on every PR with no elevated `permissions:` block,
 * so a `gh` hiccup failing an unrelated PR would be new brittleness, not a
 * signal. Callers fall back to the pre-existing `everPublished` behaviour on
 * `"unknown"` — see `checkPublishedItems`.
 *
 * @param {{ execImpl?: () => (string | Promise<string>) }} [args]
 * @returns {Promise<"configured" | "not-configured" | "unknown">}
 */
export async function isPagesConfigured({ execImpl = defaultGhApi } = {}) {
  let raw;
  try {
    raw = await execImpl();
  } catch (err) {
    const stderr = typeof err?.stderr === "string" ? err.stderr : (err?.stderr?.toString?.() ?? "");
    const message = `${stderr}\n${err?.message ?? ""}`;
    if (/Not Found|404/i.test(message)) return "not-configured";
    return "unknown"; // no `gh`, no auth, rate-limited, network — genuinely unknown, not "off".
  }
  try {
    JSON.parse(raw);
  } catch {
    return "unknown"; // a clean exit with unparseable output is not trustworthy either way.
  }
  return "configured";
}

/**
 * Rung 2 — the liveness check. Pure aside from the injected `fetchImpl`, so
 * it is unit-testable with a canned fetch and no real network.
 *
 * @param {{
 *   baseUrl: string,
 *   fetchImpl: (url: string, init?: object) => Promise<{ ok: boolean, status: number, json?: () => Promise<any> }>,
 *   timeoutMs?: number,
 *   everPublished?: boolean,
 *   pagesConfigured?: "configured" | "not-configured" | "unknown",
 * }} args
 * @returns {Promise<{ status: "skipped" | "ok" | "failed", reason?: string, unreachable?: string[] }>}
 */
export async function checkPublishedItems({
  baseUrl,
  fetchImpl,
  timeoutMs = 5000,
  everPublished = false,
  pagesConfigured = "unknown",
}) {
  const base = baseUrl.replace(/\/+$/, "");
  const canaryUrl = `${base}/latest/registry.json`;

  // What does an UNREACHABLE canary mean? Priority order (#60):
  //   1. pagesConfigured === "not-configured" → always "skipped", regardless
  //      of everPublished. GitHub's own Settings flag is authoritative and
  //      overrides the branch-existence proxy — this is what closes the
  //      residual: a repo that pushed `gh-pages` once but never flipped
  //      Settings → Pages no longer false-positive-FAILs.
  //   2. pagesConfigured === "configured" → always "failed". Pages is
  //      demonstrably live, so an unreachable canary is unambiguous rot.
  //   3. pagesConfigured === "unknown" (the API call itself couldn't answer)
  //      → fall back to the pre-existing `everPublished` (branch-existence)
  //      behaviour, unchanged. Keeps the gate network-tolerant: a `gh api`
  //      hiccup must not fail an unrelated PR (see `isPagesConfigured`'s doc
  //      comment for why this is a deliberate, commented choice rather than
  //      the issue's alternative "fail closed" suggestion).
  let unreachableStatus;
  let unreachableSuffix;
  if (pagesConfigured === "not-configured") {
    unreachableStatus = "skipped";
    unreachableSuffix =
      "GitHub Pages has not been enabled for this repo (Settings → Pages returned Not Found) " +
      "— hosting is not live yet.";
  } else if (pagesConfigured === "configured") {
    unreachableStatus = "failed";
    unreachableSuffix =
      "GitHub Pages IS enabled for this repo (Settings → Pages confirms it), so this endpoint " +
      "should be resolving — this looks like real rot, not a pending setup step.";
  } else if (everPublished) {
    unreachableStatus = "failed";
    unreachableSuffix =
      "the `gh-pages` branch already exists on origin (publish-registry-pages.mjs has " +
      "pushed content before), so this endpoint should be resolving — this looks like " +
      "real rot, not a pending first publish. (The Pages-configuration API was unreachable; " +
      "falling back to branch-existence.)";
  } else {
    unreachableStatus = "skipped";
    unreachableSuffix =
      "hosting is likely not live yet. (The Pages-configuration API was unreachable; falling " +
      "back to branch-existence.)";
  }

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

  // The authoritative signal (#60): has GitHub's own Settings → Pages flag
  // ever been toggled on for this repo? See `isPagesConfigured`'s doc comment
  // for the three-valued contract and why "unknown" falls back rather than
  // failing closed.
  const pagesConfigured = await isPagesConfigured();
  // Fallback signal: has `publish-registry-pages.mjs` ever successfully
  // pushed the `gh-pages` branch? Only consulted when `pagesConfigured` is
  // "unknown" (the Pages-config API itself couldn't answer) — reuses the
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
    pagesConfigured,
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
