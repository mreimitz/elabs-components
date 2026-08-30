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
 *    Three outcomes, and only one of them fails the build:
 *      - the canary snapshot itself is unreachable (DNS/network/404/timeout)
 *        → SKIPPED. Covers both "the maintainer has not enabled Pages yet"
 *        and "no version has been released yet" and "this runner has no/flaky
 *        egress to a specific host" — none of those are things a PR can fix,
 *        so this never reds a build for a human's pending setting change.
 *      - the snapshot is reachable and every item it lists resolves → OK.
 *      - the snapshot is reachable but an item it lists does NOT resolve →
 *        FAILS. This is the only path that reds the build, and it only fires
 *        once hosting is demonstrably live — so the gate is never a permanent
 *        rubber stamp; it grows real teeth the moment the maintainer flips
 *        Settings → Pages → "Deploy from a branch" → `gh-pages`.
 *
 * `checkPublishedItems` takes an injected `fetchImpl` so the self-test never
 * touches the network. Dependency-free otherwise; ESM.
 *
 *   pnpm registry:published:check
 *   node scripts/check-registry-published.mjs [--timeout-ms 5000]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findHomepageViolation } from "./lib/registry-homepage.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY_PATH = join(REPO_ROOT, "registry", "registry.json");

/**
 * Rung 2 — the liveness check. Pure aside from the injected `fetchImpl`, so
 * it is unit-testable with a canned fetch and no real network.
 *
 * @param {{
 *   baseUrl: string,
 *   fetchImpl: (url: string, init?: object) => Promise<{ ok: boolean, status: number, json?: () => Promise<any> }>,
 *   timeoutMs?: number,
 * }} args
 * @returns {Promise<{ status: "skipped" | "ok" | "failed", reason?: string, unreachable?: string[] }>}
 */
export async function checkPublishedItems({ baseUrl, fetchImpl, timeoutMs = 5000 }) {
  const base = baseUrl.replace(/\/+$/, "");
  const canaryUrl = `${base}/latest/registry.json`;

  let canaryRes;
  try {
    canaryRes = await fetchImpl(canaryUrl, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    return {
      status: "skipped",
      reason: `${canaryUrl} is unreachable (${err.message}) — hosting is likely not live yet.`,
    };
  }
  if (!canaryRes || !canaryRes.ok) {
    return {
      status: "skipped",
      reason: `${canaryUrl} returned ${canaryRes ? canaryRes.status : "no response"} — hosting is likely not live yet.`,
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

  // Rung 2 — liveness, best-effort.
  const result = await checkPublishedItems({ baseUrl: registry.homepage, fetchImpl: fetch });

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
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code ?? 0));
}
